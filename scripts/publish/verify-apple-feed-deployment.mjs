import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { XMLValidator } from "fast-xml-parser";
import { loadAppleFeedOverlayConfig } from "./apple-feed-overlay.mjs";

const MAX_FEED_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_ATTEMPTS = 61;
const DEFAULT_POLL_INTERVAL_MS = 10_000;

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function validatePositiveInteger(value, label, maximum) {
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new TypeError(`${label} must be an integer from 1 through ${maximum}.`);
  }
}

function assertExpectedFinalUrl(response, requestedUrl) {
  if (!response.url) {
    throw new Error("Published Apple feed response did not expose its final URL.");
  }
  const requested = new URL(requestedUrl);
  const final = new URL(response.url);
  if (
    final.protocol !== requested.protocol ||
    final.hostname !== requested.hostname ||
    final.port !== requested.port ||
    final.pathname !== requested.pathname
  ) {
    throw new Error(
      "Published Apple feed redirected outside its approved origin and path.",
    );
  }
}

export async function fetchPublishedAppleFeed(
  publicFeedUrl,
  {
    fetchImpl = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    cacheBust = `${Date.now()}`,
  } = {},
) {
  const requestUrl = new URL(publicFeedUrl);
  if (cacheBust !== null) {
    requestUrl.searchParams.set("apple_overlay_verify", cacheBust);
  }
  const response = await fetchImpl(requestUrl, {
    redirect: "follow",
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml;q=0.9",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "User-Agent": "DrMAppleFeedDeploymentVerifier/1.0",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  assertExpectedFinalUrl(response, requestUrl);
  if (response.status !== 200) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`Published Apple feed returned HTTP ${response.status}.`);
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("xml") && !contentType.includes("rss")) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(
      `Published Apple feed returned ${contentType || "no content type"}.`,
    );
  }
  const declaredBytes = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredBytes) && declaredBytes > MAX_FEED_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`Published Apple feed exceeds ${MAX_FEED_BYTES} bytes.`);
  }
  const xml = await response.text();
  if (Buffer.byteLength(xml, "utf8") > MAX_FEED_BYTES) {
    throw new Error(`Published Apple feed exceeds ${MAX_FEED_BYTES} bytes.`);
  }
  const xmlValidation = XMLValidator.validate(xml);
  if (xmlValidation !== true) {
    const detail = xmlValidation?.err?.msg
      ? `: ${xmlValidation.err.msg}`
      : "";
    throw new Error(`Published Apple feed is not valid XML${detail}`);
  }

  return {
    xml,
    response: {
      status: response.status,
      contentType,
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
    },
  };
}

export async function verifyAppleFeedDeployment({
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  sleepImpl = sleep,
  expectedSha256 = process.env.EXPECTED_APPLE_FEED_SHA256 ?? null,
  cacheBust = process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT ?? "1"}`
    : `${Date.now()}`,
} = {}) {
  validatePositiveInteger(maxAttempts, "Deployment maxAttempts", 120);
  if (
    !Number.isInteger(pollIntervalMs) ||
    pollIntervalMs < 0 ||
    pollIntervalMs > 60_000
  ) {
    throw new TypeError(
      "Deployment pollIntervalMs must be an integer from 0 through 60000.",
    );
  }
  if (typeof sleepImpl !== "function") {
    throw new TypeError("Deployment sleepImpl must be a function.");
  }
  if (!/^[a-f0-9]{64}$/.test(expectedSha256 ?? "")) {
    throw new TypeError(
      "Deployment expectedSha256 must be the lowercase SHA-256 of the generated feed artifact.",
    );
  }

  const config = await loadAppleFeedOverlayConfig();
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const published = await fetchPublishedAppleFeed(config.publicFeedUrl, {
        fetchImpl,
        timeoutMs,
        cacheBust: `${cacheBust}-${attempt}`,
      });
      const publicSha256 = sha256(published.xml);
      if (publicSha256 !== expectedSha256) {
        throw new Error(
          `Published Apple feed does not exactly match the deployed artifact (expected ${expectedSha256}, found ${publicSha256}).`,
        );
      }
      const bare = await fetchPublishedAppleFeed(config.publicFeedUrl, {
        fetchImpl,
        timeoutMs,
        cacheBust: null,
      });
      const bareSha256 = sha256(bare.xml);
      if (bareSha256 !== expectedSha256) {
        throw new Error(
          `Bare Apple feed URL does not exactly match the deployed artifact (expected ${expectedSha256}, found ${bareSha256}).`,
        );
      }

      return {
        verifiedAt: new Date().toISOString(),
        attempts: attempt,
        publicFeedUrl: config.publicFeedUrl,
        sourceFeedUrl: config.sourceFeedUrl,
        appleShowId: config.appleShowId,
        httpStatus: bare.response.status,
        contentType: bare.response.contentType,
        publicSha256: bareSha256,
        expectedSha256,
        exactDeployedArtifact: true,
        bareUrlVerified: true,
      };
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts && pollIntervalMs > 0) {
        await sleepImpl(pollIntervalMs);
      }
    }
  }

  throw new Error(
    `Apple feed deployment did not verify after ${maxAttempts} attempts: ${lastError?.message ?? "unknown error"}`,
    { cause: lastError },
  );
}

const invokedPath = process.argv[1];
if (
  invokedPath &&
  fileURLToPath(import.meta.url) === path.resolve(invokedPath)
) {
  try {
    const report = await verifyAppleFeedDeployment();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
