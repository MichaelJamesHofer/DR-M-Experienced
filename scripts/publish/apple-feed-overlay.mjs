import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { XMLParser, XMLValidator } from "fast-xml-parser";

export const APPLE_FEED_OVERLAY_CONFIG_PATH = new URL(
  "../../publishing/apple-feed-overlay.json",
  import.meta.url,
);
export const APPLE_FEED_OVERLAY_SCHEMA_PATH = new URL(
  "../../publishing/apple-feed-overlay.schema.json",
  import.meta.url,
);

const REPOSITORY_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 20_000;

const schema = JSON.parse(
  await fs.readFile(APPLE_FEED_OVERLAY_SCHEMA_PATH, "utf8"),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv, { mode: "full" });
const validateSchema = ajv.compile(schema);

function schemaPath(error) {
  const parts = error.instancePath
    .split("/")
    .filter(Boolean)
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
  if (error.keyword === "required") parts.push(error.params.missingProperty);
  if (error.keyword === "additionalProperties") {
    parts.push(error.params.additionalProperty);
  }
  return parts.join(".") || "config";
}

function scalar(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return scalar(value["#text"]);
  return String(value).trim();
}

function asArray(value) {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let offset = 0;
  while (true) {
    const next = haystack.indexOf(needle, offset);
    if (next === -1) return count;
    count += 1;
    offset = next + needle.length;
  }
}

function replaceExactlyOnce(value, before, after, label) {
  const count = countOccurrences(value, before);
  if (count !== 1) {
    throw new Error(`${label} must occur exactly once; found ${count}.`);
  }
  return value.replace(before, after);
}

function containsNewFeedUrlElement(xml) {
  const document = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    processEntities: false,
    trimValues: false,
  }).parse(xml);
  const pending = [document];

  while (pending.length > 0) {
    const value = pending.pop();
    if (Array.isArray(value)) {
      pending.push(...value);
      continue;
    }
    if (!value || typeof value !== "object") continue;

    for (const [qualifiedName, child] of Object.entries(value)) {
      if (
        !qualifiedName.startsWith("@_") &&
        qualifiedName.split(":").at(-1)?.toLowerCase() === "new-feed-url"
      ) {
        return true;
      }
      if (child && typeof child === "object") pending.push(child);
    }
  }

  return false;
}

function validateXml(xml, label) {
  const result = XMLValidator.validate(xml);
  if (result !== true) {
    const detail = result?.err?.msg ? `: ${result.err.msg}` : "";
    throw new Error(`${label} is not valid XML${detail}`);
  }
}

function parseFeed(xml, label) {
  validateXml(xml, label);
  const document = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    processEntities: false,
    trimValues: true,
    isArray: (_name, jpath) => jpath === "rss.channel.item",
  }).parse(xml);
  const channel = document?.rss?.channel;
  if (!channel || typeof channel !== "object") {
    throw new Error(`${label} must contain one RSS channel.`);
  }

  const selfLinks = asArray(channel["atom:link"])
    .filter((entry) => entry?.["@_rel"] === "self")
    .map((entry) => ({
      href: scalar(entry?.["@_href"]),
      type: scalar(entry?.["@_type"]),
    }));
  const episodes = asArray(channel.item).map((item, index) => {
    const episodeNumberText = scalar(item?.["itunes:episode"]);
    const episodeNumber =
      episodeNumberText && /^\d+$/.test(episodeNumberText)
        ? Number(episodeNumberText)
        : null;
    return {
      index,
      title: scalar(item?.title),
      link: scalar(item?.link),
      guid: scalar(item?.guid),
      episodeNumber,
      enclosure: {
        url: scalar(item?.enclosure?.["@_url"]),
        length: scalar(item?.enclosure?.["@_length"]),
        type: scalar(item?.enclosure?.["@_type"]),
      },
    };
  });

  return { selfLinks, episodes };
}

function duplicateValues(entries) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of entries) {
    if (!value) continue;
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function assertExpectedFinalUrl(response, requestedUrl, label) {
  if (!response.url) {
    throw new Error(`${label} response did not expose its final URL.`);
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
      `${label} redirected outside its approved origin and path.`,
    );
  }
}

function assertSourceEpisodes(feed, config) {
  if (feed.episodes.length < config.minimumEpisodeCount) {
    throw new Error(
      `Source feed must contain at least ${config.minimumEpisodeCount} episodes; found ${feed.episodes.length}.`,
    );
  }

  const missingGuids = feed.episodes.filter((episode) => !episode.guid);
  if (missingGuids.length > 0) {
    throw new Error("Every source episode must contain a non-empty GUID.");
  }
  const duplicateGuids = duplicateValues(
    feed.episodes.map((episode) => episode.guid),
  );
  if (duplicateGuids.length > 0) {
    throw new Error(`Source feed contains duplicate GUIDs: ${duplicateGuids.join(", ")}.`);
  }

  const duplicateEnclosures = duplicateValues(
    feed.episodes.map((episode) => episode.enclosure.url),
  );
  if (duplicateEnclosures.length > 0) {
    throw new Error("Source feed contains duplicate enclosure URLs.");
  }
  const duplicateEpisodeNumbers = duplicateValues(
    feed.episodes.map((episode) => episode.episodeNumber),
  );
  if (duplicateEpisodeNumbers.length > 0) {
    throw new Error("Source feed contains duplicate episode numbers.");
  }
  for (const episode of feed.episodes) {
    if (!episode.title) {
      throw new Error(`Source episode ${episode.guid} must have a non-empty title.`);
    }
    if (!Number.isInteger(episode.episodeNumber) || episode.episodeNumber < 1) {
      throw new Error(
        `Source episode ${episode.guid} must have a positive integer episode number.`,
      );
    }
    try {
      if (new URL(episode.link).protocol !== "https:") throw new Error("not HTTPS");
    } catch {
      throw new Error(`Source episode ${episode.guid} must have a valid HTTPS link.`);
    }
    const { url, length, type } = episode.enclosure;
    if (!url || !/^\d+$/.test(length ?? "") || Number(length) < 1 || !type) {
      throw new Error(
        `Source episode ${episode.guid} must have a complete enclosure URL, length, and type.`,
      );
    }
    if (config.mediaVerification.requireHttps && new URL(url).protocol !== "https:") {
      throw new Error(`Source episode ${episode.guid} enclosure must use HTTPS.`);
    }
  }

  for (const mapping of config.guidMappings) {
    const matches = feed.episodes.filter(
      (episode) => episode.guid === mapping.sourceGuid,
    );
    if (matches.length !== 1) {
      throw new Error(
        `Episode ${mapping.episodeNumber} source GUID must identify exactly one source item; found ${matches.length}.`,
      );
    }
    const episode = matches[0];
    let observedRssComEpisodeId = null;
    try {
      const linkUrl = new URL(episode.link);
      const match = /^\/podcasts\/dr-m-experienced\/(\d+)\/?$/.exec(
        linkUrl.pathname,
      );
      if (linkUrl.hostname === "rss.com") observedRssComEpisodeId = match?.[1] ?? null;
    } catch {
      observedRssComEpisodeId = null;
    }
    if (observedRssComEpisodeId !== mapping.rssComEpisodeId) {
      throw new Error(
        `Episode ${mapping.episodeNumber} RSS.com episode ID mismatch; expected ${mapping.rssComEpisodeId}, found ${observedRssComEpisodeId ?? "invalid link"}.`,
      );
    }
    for (const [field, expected, actual] of [
      ["title", mapping.title, episode.title],
      ["link", mapping.link, episode.link],
      ["episode number", mapping.episodeNumber, episode.episodeNumber],
    ]) {
      if (actual !== expected) {
        throw new Error(
          `Episode ${mapping.episodeNumber} ${field} mismatch; expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}.`,
        );
      }
    }
  }

  for (const assertion of config.preservedGuidAssertions) {
    const matches = feed.episodes.filter(
      (episode) => episode.episodeNumber === assertion.episodeNumber,
    );
    if (matches.length !== 1 || matches[0].guid !== assertion.guid) {
      throw new Error(
        `Episode ${assertion.episodeNumber} must retain GUID ${assertion.guid}.`,
      );
    }
  }
}

export function validateAppleFeedOverlayConfig(config) {
  const valid = validateSchema(config);
  const errors = valid
    ? []
    : validateSchema.errors.map(
        (error) => `${schemaPath(error)} ${error.message}`,
      );
  return { valid: errors.length === 0, errors };
}

export async function loadAppleFeedOverlayConfig(
  configPath = APPLE_FEED_OVERLAY_CONFIG_PATH,
) {
  const config = JSON.parse(await fs.readFile(configPath, "utf8"));
  const result = validateAppleFeedOverlayConfig(config);
  if (!result.valid) {
    throw new Error(
      `Apple feed overlay config is invalid:\n${result.errors
        .map((error) => `- ${error}`)
        .join("\n")}`,
    );
  }
  return config;
}

export function buildAppleFeedOverlay(sourceXml, config) {
  const configResult = validateAppleFeedOverlayConfig(config);
  if (!configResult.valid) {
    throw new Error(
      `Apple feed overlay config is invalid:\n${configResult.errors
        .map((error) => `- ${error}`)
        .join("\n")}`,
    );
  }
  if (typeof sourceXml !== "string" || sourceXml.length === 0) {
    throw new TypeError("Source feed XML must be a non-empty string.");
  }
  if (Buffer.byteLength(sourceXml, "utf8") > MAX_SOURCE_BYTES) {
    throw new Error(`Source feed exceeds ${MAX_SOURCE_BYTES} bytes.`);
  }
  validateXml(sourceXml, "Source feed");
  if (containsNewFeedUrlElement(sourceXml)) {
    throw new Error("Source feed must not contain a new-feed-url element.");
  }

  const sourceFeed = parseFeed(sourceXml, "Source feed");
  if (
    sourceFeed.selfLinks.length !== 1 ||
    sourceFeed.selfLinks[0].href !== config.sourceSelfUrl
  ) {
    throw new Error(
      `Source feed must contain exactly one atom:link rel=self for ${config.sourceSelfUrl}.`,
    );
  }
  assertSourceEpisodes(sourceFeed, config);

  if (countOccurrences(sourceXml, config.publicFeedUrl) !== 0) {
    throw new Error("Source feed already contains the Apple overlay public URL.");
  }
  for (const mapping of config.guidMappings) {
    if (mapping.sourceGuid.length !== mapping.appleGuid.length) {
      throw new Error(
        `Episode ${mapping.episodeNumber} source and Apple GUID lengths differ.`,
      );
    }
    if (countOccurrences(sourceXml, mapping.appleGuid) !== 0) {
      throw new Error(
        `Episode ${mapping.episodeNumber} Apple GUID already occurs in the source feed.`,
      );
    }
  }

  let outputXml = replaceExactlyOnce(
    sourceXml,
    config.sourceSelfUrl,
    config.publicFeedUrl,
    "Source atom:link rel=self URL",
  );
  for (const mapping of config.guidMappings) {
    outputXml = replaceExactlyOnce(
      outputXml,
      mapping.sourceGuid,
      mapping.appleGuid,
      `Episode ${mapping.episodeNumber} source GUID`,
    );
  }

  let restoredXml = replaceExactlyOnce(
    outputXml,
    config.publicFeedUrl,
    config.sourceSelfUrl,
    "Apple overlay atom:link rel=self URL",
  );
  for (const mapping of config.guidMappings) {
    restoredXml = replaceExactlyOnce(
      restoredXml,
      mapping.appleGuid,
      mapping.sourceGuid,
      `Episode ${mapping.episodeNumber} Apple GUID`,
    );
  }
  if (restoredXml !== sourceXml) {
    throw new Error("Overlay changed bytes outside the approved self URL and GUID mappings.");
  }

  const outputFeed = parseFeed(outputXml, "Apple overlay feed");
  if (
    outputFeed.selfLinks.length !== 1 ||
    outputFeed.selfLinks[0].href !== config.publicFeedUrl
  ) {
    throw new Error("Apple overlay feed has an incorrect atom:link rel=self URL.");
  }
  if (containsNewFeedUrlElement(outputXml)) {
    throw new Error("Apple overlay feed must not contain a new-feed-url element.");
  }

  const expectedGuids = sourceFeed.episodes.map((episode) => {
    const mapping = config.guidMappings.find(
      (candidate) => candidate.sourceGuid === episode.guid,
    );
    return mapping?.appleGuid ?? episode.guid;
  });
  const outputGuids = outputFeed.episodes.map((episode) => episode.guid);
  if (JSON.stringify(outputGuids) !== JSON.stringify(expectedGuids)) {
    throw new Error("Apple overlay GUID sequence does not match the approved projection.");
  }
  if (duplicateValues(outputGuids).length > 0) {
    throw new Error("Apple overlay feed contains duplicate GUIDs.");
  }

  return {
    xml: outputXml,
    episodes: outputFeed.episodes,
    report: {
      sourceSha256: sha256(sourceXml),
      outputSha256: sha256(outputXml),
      sourceBytes: Buffer.byteLength(sourceXml, "utf8"),
      outputBytes: Buffer.byteLength(outputXml, "utf8"),
      episodeCount: outputFeed.episodes.length,
      futureEpisodeCount: Math.max(
        0,
        outputFeed.episodes.length - config.minimumEpisodeCount,
      ),
      outputGuids,
      selfUrl: config.publicFeedUrl,
      byteIdenticalExceptApprovedChanges: true,
      itunesNewFeedUrlPresent: false,
    },
  };
}

function contentRangeTotal(value) {
  const match = /^bytes 0-0\/(\d+)$/.exec(value ?? "");
  return match ? Number(match[1]) : null;
}

async function verifyOneEnclosure(episode, fetchImpl, timeoutMs) {
  const response = await fetchImpl(episode.enclosure.url, {
    method: "GET",
    redirect: "follow",
    headers: {
      Accept: "audio/*",
      "Accept-Encoding": "identity",
      Range: "bytes=0-0",
      "User-Agent": "DrMAppleFeedOverlay/1.0",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (response.status !== 206) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(
      `Episode ${episode.episodeNumber ?? episode.guid} enclosure range request returned HTTP ${response.status}.`,
    );
  }
  const contentType = response.headers.get("content-type")?.split(";")[0];
  if (!contentType?.startsWith("audio/")) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(
      `Episode ${episode.episodeNumber ?? episode.guid} enclosure returned non-audio content.`,
    );
  }
  const totalBytes = contentRangeTotal(response.headers.get("content-range"));
  if (totalBytes !== Number(episode.enclosure.length)) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(
      `Episode ${episode.episodeNumber ?? episode.guid} enclosure byte-range total does not match the feed length.`,
    );
  }
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && contentLength !== "1") {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(
      `Episode ${episode.episodeNumber ?? episode.guid} range response must contain one byte.`,
    );
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== 1) {
    throw new Error(
      `Episode ${episode.episodeNumber ?? episode.guid} range response body must contain one byte.`,
    );
  }
  return {
    episodeNumber: episode.episodeNumber,
    guid: episode.guid,
    status: response.status,
    mediaType: contentType,
    totalBytes,
  };
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function verifyOneEnclosureWithRetries(
  episode,
  fetchImpl,
  { timeoutMs, maxAttempts, retryDelayMs, sleepImpl },
) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await verifyOneEnclosure(episode, fetchImpl, timeoutMs);
      return { ...result, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts && retryDelayMs > 0) {
        await sleepImpl(retryDelayMs * attempt);
      }
    }
  }
  throw new Error(
    `${lastError?.message ?? "Enclosure verification failed."} Failed after ${maxAttempts} attempts.`,
    { cause: lastError },
  );
}

export async function verifyAppleFeedEnclosures(
  episodes,
  {
    fetchImpl = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    concurrency = 4,
    maxAttempts = 3,
    retryDelayMs = 500,
    sleepImpl = sleep,
  } = {},
) {
  if (!Array.isArray(episodes) || episodes.length === 0) {
    throw new TypeError("Overlay enclosure verification requires episodes.");
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) {
    throw new TypeError("Enclosure maxAttempts must be an integer from 1 through 5.");
  }
  if (!Number.isInteger(retryDelayMs) || retryDelayMs < 0 || retryDelayMs > 5000) {
    throw new TypeError("Enclosure retryDelayMs must be an integer from 0 through 5000.");
  }
  if (typeof sleepImpl !== "function") {
    throw new TypeError("Enclosure sleepImpl must be a function.");
  }
  const results = new Array(episodes.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < episodes.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await verifyOneEnclosureWithRetries(
        episodes[index],
        fetchImpl,
        { timeoutMs, maxAttempts, retryDelayMs, sleepImpl },
      );
    }
  }
  const workerCount = Math.max(
    1,
    Math.min(episodes.length, Number.isInteger(concurrency) ? concurrency : 1),
  );
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export async function fetchAppleFeedSource(
  sourceFeedUrl,
  {
    fetchImpl = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    cacheBust = `${Date.now()}`,
  } = {},
) {
  const requestUrl = new URL(sourceFeedUrl);
  requestUrl.searchParams.set("apple_overlay_build", cacheBust);
  const response = await fetchImpl(requestUrl, {
    redirect: "follow",
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml;q=0.9",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "User-Agent": "DrMAppleFeedOverlay/1.0",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  assertExpectedFinalUrl(response, requestUrl, "RSS.com source feed");
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`RSS.com source feed returned HTTP ${response.status}.`);
  }
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("xml") && !contentType.includes("rss")) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`RSS.com source feed returned ${contentType || "no content type"}.`);
  }
  const declaredBytes = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredBytes) && declaredBytes > MAX_SOURCE_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`RSS.com source feed exceeds ${MAX_SOURCE_BYTES} bytes.`);
  }
  const xml = await response.text();
  if (Buffer.byteLength(xml, "utf8") > MAX_SOURCE_BYTES) {
    throw new Error(`RSS.com source feed exceeds ${MAX_SOURCE_BYTES} bytes.`);
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

async function writeAtomic(outputPath, contents) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, contents, { encoding: "utf8", mode: 0o644 });
    await fs.rename(temporaryPath, outputPath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function generateAppleFeedOverlay({
  configPath = APPLE_FEED_OVERLAY_CONFIG_PATH,
  outputPath = null,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  cacheBust = process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT ?? "1"}`
    : `${Date.now()}`,
} = {}) {
  const config = await loadAppleFeedOverlayConfig(configPath);
  const configuredOutputPath = path.resolve(REPOSITORY_ROOT, config.outputPath);
  const resolvedOutputPath = outputPath
    ? path.resolve(outputPath)
    : configuredOutputPath;
  if (!outputPath && resolvedOutputPath !== configuredOutputPath) {
    throw new Error("Configured Apple feed output path escaped the repository.");
  }

  const source = await fetchAppleFeedSource(config.sourceFeedUrl, {
    fetchImpl,
    timeoutMs,
    cacheBust,
  });
  const overlay = buildAppleFeedOverlay(source.xml, config);
  const media = await verifyAppleFeedEnclosures(overlay.episodes, {
    fetchImpl,
    timeoutMs,
    maxAttempts: config.mediaVerification.maxAttempts,
    retryDelayMs: config.mediaVerification.retryDelayMs,
  });
  await writeAtomic(resolvedOutputPath, overlay.xml);
  return {
    ...overlay.report,
    sourceHttpStatus: source.response.status,
    sourceContentType: source.response.contentType,
    sourceEtag: source.response.etag,
    sourceLastModified: source.response.lastModified,
    playableByteRangeEnclosureCount: media.length,
    outputPath: path.relative(REPOSITORY_ROOT, resolvedOutputPath),
  };
}

function isMainModule() {
  return process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  generateAppleFeedOverlay()
    .then((report) => {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    })
    .catch((error) => {
      process.stderr.write(`apple-feed-overlay: ${error.message}\n`);
      process.exitCode = 1;
    });
}
