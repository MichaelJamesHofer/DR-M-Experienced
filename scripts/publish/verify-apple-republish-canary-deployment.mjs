import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAppleFeedSource } from "./apple-feed-overlay.mjs";
import {
  buildAppleRepublishCanaryOverlay,
  loadAppleRepublishCanaryAuthorities,
} from "./apple-republish-canary-prototype.mjs";
import { fetchPublishedAppleFeed } from "./verify-apple-feed-deployment.mjs";

const DEFAULT_TIMEOUT_MS = 60_000;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertExactDirectResponse(response, requestedUrl, label) {
  if (!response.url) {
    throw new Error(`${label} response did not expose its final URL.`);
  }
  if (response.url !== requestedUrl) {
    throw new Error(`${label} must not redirect.`);
  }
}

function mediaType(response) {
  return response.headers.get("content-type")?.split(";")[0] ?? null;
}

function assertDirectHeaders(response, enclosure, label) {
  if (mediaType(response) !== enclosure.mediaType) {
    throw new Error(`${label} returned ${mediaType(response) ?? "no content type"}.`);
  }
  const declared = response.headers.get("content-length");
  if (declared !== null && !/^\d+$/.test(declared)) {
    throw new Error(`${label} returned an invalid content length.`);
  }
}

async function readBodyIdentity(response, maximumBytes) {
  if (!response.body) throw new Error("Media response returned no body.");
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of response.body) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > maximumBytes) {
      throw new Error("Media response exceeded its pinned byte length.");
    }
    hash.update(buffer);
  }
  return { bytes, sha256: hash.digest("hex") };
}

async function verifyOneRange(
  enclosure,
  start,
  end,
  { fetchImpl, timeoutMs, expectedSha256 = null },
) {
  const response = await fetchImpl(enclosure.url, {
    method: "GET",
    redirect: "manual",
    headers: {
      Accept: enclosure.mediaType,
      "Accept-Encoding": "identity",
      Range: `bytes=${start}-${end}`,
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "User-Agent": "DrMAppleRepublishCanaryVerifier/1.0",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  assertExactDirectResponse(response, enclosure.url, "Canary media range");
  if (response.status !== 206) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`Canary media range returned HTTP ${response.status}.`);
  }
  assertDirectHeaders(response, enclosure, "Canary media range");
  const expectedLength = end - start + 1;
  const expectedContentRange = `bytes ${start}-${end}/${enclosure.length}`;
  if (response.headers.get("content-range") !== expectedContentRange) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("Canary media returned an incorrect Content-Range.");
  }
  if (response.headers.get("content-length") !== String(expectedLength)) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("Canary media range returned an incorrect Content-Length.");
  }
  const identity = await readBodyIdentity(response, expectedLength);
  if (identity.bytes !== expectedLength) {
    throw new Error("Canary media range returned the wrong number of bytes.");
  }
  if (expectedSha256 !== null && identity.sha256 !== expectedSha256) {
    throw new Error("Canary media first-range hash drifted.");
  }
  return { start, end, ...identity };
}

export async function verifyDirectAppleCanaryMedia(
  config,
  { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {},
) {
  const enclosure = config.canary.candidateEnclosure;
  const head = await fetchImpl(enclosure.url, {
    method: "HEAD",
    redirect: "manual",
    headers: {
      Accept: enclosure.mediaType,
      "Accept-Encoding": "identity",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "User-Agent": "DrMAppleRepublishCanaryVerifier/1.0",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  assertExactDirectResponse(head, enclosure.url, "Canary media HEAD");
  if (head.status !== 200) {
    await head.body?.cancel().catch(() => undefined);
    throw new Error(`Canary media HEAD returned HTTP ${head.status}.`);
  }
  assertDirectHeaders(head, enclosure, "Canary media HEAD");
  if (head.headers.get("content-length") !== String(enclosure.length)) {
    throw new Error("Canary media HEAD returned an incorrect Content-Length.");
  }
  if (
    !head.headers
      .get("accept-ranges")
      ?.split(",")
      .map((value) => value.trim().toLowerCase())
      .includes("bytes")
  ) {
    throw new Error("Canary media HEAD did not advertise byte ranges.");
  }

  const middleStart = Math.floor(enclosure.length / 2);
  const lastStart = enclosure.length - 4096;
  const ranges = [];
  ranges.push(
    await verifyOneRange(enclosure, 0, 4095, {
      fetchImpl,
      timeoutMs,
      expectedSha256: config.validationEvidence.rangeProbeSha256,
    }),
  );
  ranges.push(
    await verifyOneRange(enclosure, middleStart, middleStart + 4095, {
      fetchImpl,
      timeoutMs,
    }),
  );
  ranges.push(
    await verifyOneRange(enclosure, lastStart, enclosure.length - 1, {
      fetchImpl,
      timeoutMs,
    }),
  );

  const full = await fetchImpl(enclosure.url, {
    method: "GET",
    redirect: "manual",
    headers: {
      Accept: enclosure.mediaType,
      "Accept-Encoding": "identity",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "User-Agent": "DrMAppleRepublishCanaryVerifier/1.0",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  assertExactDirectResponse(full, enclosure.url, "Canary media full readback");
  if (full.status !== 200) {
    await full.body?.cancel().catch(() => undefined);
    throw new Error(`Canary media full readback returned HTTP ${full.status}.`);
  }
  assertDirectHeaders(full, enclosure, "Canary media full readback");
  if (full.headers.get("content-length") !== String(enclosure.length)) {
    await full.body?.cancel().catch(() => undefined);
    throw new Error("Canary media full readback returned an incorrect Content-Length.");
  }
  const fullIdentity = await readBodyIdentity(full, enclosure.length);
  if (
    fullIdentity.bytes !== enclosure.length ||
    fullIdentity.sha256 !== enclosure.sha256
  ) {
    throw new Error("Canary media full readback did not match its pinned identity.");
  }

  return {
    publicUrl: enclosure.url,
    directNoRedirect: true,
    headStatus: head.status,
    acceptRanges: true,
    rangeStatus: 206,
    verifiedRangeCount: ranges.length,
    fullStatus: full.status,
    bytes: fullIdentity.bytes,
    sha256: fullIdentity.sha256,
  };
}

export async function verifyAppleRepublishCanaryDeployment({
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  expectedFeedSha256 = process.env.EXPECTED_APPLE_REPUBLISH_CANARY_FEED_SHA256 ??
    null,
  cacheBust = `${Date.now()}`,
  dependencies = {},
} = {}) {
  if (!/^[a-f0-9]{64}$/.test(expectedFeedSha256 ?? "")) {
    throw new TypeError(
      "expectedFeedSha256 must be the lowercase SHA-256 of the candidate feed artifact.",
    );
  }
  const {
    loadAuthorities = loadAppleRepublishCanaryAuthorities,
    fetchSource = fetchAppleFeedSource,
    buildOverlay = buildAppleRepublishCanaryOverlay,
    fetchPublished = fetchPublishedAppleFeed,
    verifyMedia = verifyDirectAppleCanaryMedia,
  } = dependencies;
  const { config, activeConfig } = await loadAuthorities();
  const source = await fetchSource(config.sourceFeedUrl, {
    fetchImpl,
    timeoutMs,
    cacheBust: `${cacheBust}-source`,
  });
  const expected = buildOverlay(
    source.xml,
    activeConfig,
    config,
  );
  if (sha256(expected.xml) !== expectedFeedSha256) {
    throw new Error("Expected canary feed SHA does not match the current canonical projection.");
  }
  const published = await fetchPublished(activeConfig.publicFeedUrl, {
    fetchImpl,
    timeoutMs,
    cacheBust: `${cacheBust}-feed`,
  });
  const publicSha256 = sha256(published.xml);
  if (
    publicSha256 !== expectedFeedSha256 ||
    published.xml !== expected.xml
  ) {
    throw new Error("Published Apple feed is not the exact candidate artifact.");
  }
  const bare = await fetchPublished(activeConfig.publicFeedUrl, {
    fetchImpl,
    timeoutMs,
    cacheBust: null,
  });
  const bareSha256 = sha256(bare.xml);
  if (bareSha256 !== expectedFeedSha256 || bare.xml !== expected.xml) {
    throw new Error("Bare Apple feed URL is not the exact candidate artifact.");
  }
  const media = await verifyMedia(config, {
    fetchImpl,
    timeoutMs,
  });
  return {
    verifiedAt: new Date().toISOString(),
    appleShowId: config.appleShowId,
    publicFeedUrl: activeConfig.publicFeedUrl,
    publicFeedSha256: publicSha256,
    exactCandidateFeed: true,
    bareUrlVerified: true,
    bareFeedSha256: bareSha256,
    canaryEpisodeNumber: config.canary.episodeNumber,
    canaryGuid: config.canary.candidateGuid.value,
    media,
  };
}

const invokedPath = process.argv[1];
if (invokedPath && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  try {
    const report = await verifyAppleRepublishCanaryDeployment();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`apple-republish-canary-verifier: ${error.message}\n`);
    process.exitCode = 1;
  }
}
