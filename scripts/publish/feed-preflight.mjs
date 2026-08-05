#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import { isIP } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { writePrivateText } from "./lib.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(scriptPath), "..", "..");
const redirectStatuses = new Set([301, 302, 303, 307, 308]);
const defaultTimeoutMs = 15_000;
const maxFeedBytes = 10 * 1024 * 1024;

function usage() {
  return `Usage:
  node scripts/publish/feed-preflight.mjs --source <feed-url> --candidate <feed-url> [options]

Options:
  --snapshot-dir <directory>  Save both raw feeds as private 0600 files outside the repository.
  --verify-media              Check candidate enclosures with HEAD or a one-byte range request.
  --timeout-ms <milliseconds> Per-request timeout (default: ${defaultTimeoutMs}).
  -h, --help                  Show this help.

This command only reads public feed and media URLs. It never changes a hosting service.`;
}

function arrayValue(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function localName(key) {
  return key.replace(/^@_?/, "").split(":").at(-1).toLowerCase();
}

function childByLocalName(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const match = Object.entries(value).find(([key]) => !key.startsWith("@") && localName(key) === name);
  return match?.[1];
}

function attributeByLocalName(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const match = Object.entries(value).find(([key]) => key.startsWith("@") && localName(key) === name);
  return textValue(match?.[1]);
}

function textValue(value) {
  if (value == null) return null;
  if (["string", "number", "boolean"].includes(typeof value)) {
    const text = String(value).trim();
    return text || null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = textValue(item);
      if (text) return text;
    }
    return null;
  }
  if (typeof value === "object") return textValue(value["#text"] ?? value.__cdata);
  return null;
}

function enclosureUrl(item) {
  for (const enclosure of arrayValue(childByLocalName(item, "enclosure"))) {
    const url = attributeByLocalName(enclosure, "url") ?? textValue(enclosure);
    if (url) return url;
  }
  return null;
}

function parseDuration(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text);
  const parts = text.split(":");
  if (![2, 3].includes(parts.length) || parts.some((part) => !/^\d+(?:\.\d+)?$/.test(part))) return text;
  const values = parts.map(Number);
  if (parts.length === 2) return values[0] * 60 + values[1];
  return values[0] * 3600 + values[1] * 60 + values[2];
}

function comparableBoolean(value) {
  const text = textValue(value)?.toLowerCase();
  if (text == null) return null;
  if (["yes", "true", "explicit"].includes(text)) return true;
  if (["no", "false", "clean"].includes(text)) return false;
  return text;
}

function comparableDate(value) {
  if (value == null) return null;
  const milliseconds = Date.parse(value);
  return Number.isNaN(milliseconds) ? value : new Date(milliseconds).toISOString();
}

function parseRssItem(item) {
  const guid = textValue(childByLocalName(item, "guid")) ?? textValue(childByLocalName(item, "id"));
  const title = textValue(childByLocalName(item, "title"));
  const pubDate = textValue(childByLocalName(item, "pubdate")) ?? textValue(childByLocalName(item, "published"));
  const duration = textValue(childByLocalName(item, "duration"));
  const mediaUrl = enclosureUrl(item);
  return {
    guid,
    title,
    description:
      textValue(childByLocalName(item, "description")) ??
      textValue(childByLocalName(item, "summary")) ??
      textValue(childByLocalName(item, "encoded")),
    pubDate,
    comparablePubDate: comparableDate(pubDate),
    duration,
    comparableDuration: parseDuration(duration),
    explicit: comparableBoolean(childByLocalName(item, "explicit")),
    episodeNumber: textValue(childByLocalName(item, "episode")),
    seasonNumber: textValue(childByLocalName(item, "season")),
    episodeType: textValue(childByLocalName(item, "episodetype"))?.toLowerCase() ?? null,
    enclosurePresent: Boolean(mediaUrl),
    enclosureUrl: mediaUrl,
  };
}

function channelArtworkPresent(channel) {
  const image = childByLocalName(channel, "image");
  if (!image) return false;
  return Boolean(attributeByLocalName(image, "href") ?? textValue(childByLocalName(image, "url")) ?? textValue(image));
}

export function parsePodcastFeed(xml) {
  if (typeof xml !== "string" || XMLValidator.validate(xml) !== true) {
    throw new Error("Feed XML is not well formed.");
  }

  let document;
  try {
    document = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      textNodeName: "#text",
      trimValues: true,
      parseTagValue: false,
      parseAttributeValue: false,
      allowBooleanAttributes: true,
    }).parse(xml);
  } catch {
    throw new Error("Feed XML could not be parsed.");
  }

  const rss = childByLocalName(document, "rss") ?? document;
  const channel = childByLocalName(rss, "channel");
  if (!channel || typeof channel !== "object") throw new Error("Feed does not contain an RSS channel.");

  const episodes = arrayValue(childByLocalName(channel, "item")).map(parseRssItem);
  return {
    title: textValue(childByLocalName(channel, "title")),
    description: textValue(childByLocalName(channel, "description")),
    language: textValue(childByLocalName(channel, "language"))?.toLowerCase() ?? null,
    author: textValue(childByLocalName(channel, "author")),
    explicit: comparableBoolean(childByLocalName(channel, "explicit")),
    podcastType: textValue(childByLocalName(channel, "type"))?.toLowerCase() ?? null,
    artworkPresent: channelArtworkPresent(channel),
    generator: textValue(childByLocalName(channel, "generator")),
    episodes,
  };
}

export function guidFingerprint(guid) {
  return createHash("sha256").update(guid).digest("hex").slice(0, 12);
}

function duplicateGuids(episodes) {
  const counts = new Map();
  for (const episode of episodes) {
    if (episode.guid) counts.set(episode.guid, (counts.get(episode.guid) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([guid, count]) => ({ fingerprint: guidFingerprint(guid), count }));
}

function missingRequiredMetadata(episodes) {
  const missing = [];
  for (const episode of episodes) {
    const fields = [];
    if (!episode.guid) fields.push("guid");
    if (!episode.title) fields.push("title");
    if (!episode.pubDate) fields.push("pubDate");
    if (!episode.enclosurePresent) fields.push("enclosure");
    if (fields.length) {
      missing.push({ fingerprint: episode.guid ? guidFingerprint(episode.guid) : "missing-guid", fields });
    }
  }
  return missing;
}

export function comparePodcastFeeds(source, candidate) {
  const issues = [];
  const showMetadataMismatches = [];
  const sourceDuplicates = duplicateGuids(source.episodes);
  const candidateDuplicates = duplicateGuids(candidate.episodes);
  const sourceMissingMetadata = missingRequiredMetadata(source.episodes);
  const candidateMissingMetadata = missingRequiredMetadata(candidate.episodes);

  if (!source.episodes.length) {
    issues.push({ code: "source_empty", message: "Source feed contains no episodes." });
  }
  if (!candidate.episodes.length) {
    issues.push({ code: "candidate_empty", message: "Candidate feed contains no episodes." });
  }

  if (source.episodes.length !== candidate.episodes.length) {
    issues.push({
      code: "episode_count",
      message: `Episode count differs (${source.episodes.length} source, ${candidate.episodes.length} candidate).`,
    });
  }
  if (sourceDuplicates.length) {
    issues.push({ code: "source_duplicate_guids", message: "Source feed contains duplicate GUIDs." });
  }
  if (candidateDuplicates.length) {
    issues.push({ code: "candidate_duplicate_guids", message: "Candidate feed contains duplicate GUIDs." });
  }
  if (sourceMissingMetadata.length) {
    issues.push({ code: "source_missing_metadata", message: "Source episodes are missing required migration metadata." });
  }
  if (candidateMissingMetadata.length) {
    issues.push({ code: "candidate_missing_metadata", message: "Candidate episodes are missing required migration metadata." });
  }

  for (const field of ["title", "description", "language", "author", "explicit", "podcastType", "artworkPresent"]) {
    if (source[field] !== candidate[field]) showMetadataMismatches.push(field);
  }
  if (showMetadataMismatches.length) {
    issues.push({ code: "show_metadata", message: "Show-level metadata differs." });
  }

  const episodesByGuid = (episodes) => {
    const mapped = new Map();
    for (const episode of episodes) {
      if (episode.guid && !mapped.has(episode.guid)) mapped.set(episode.guid, episode);
    }
    return mapped;
  };
  const sourceByGuid = episodesByGuid(source.episodes);
  const candidateByGuid = episodesByGuid(candidate.episodes);
  const missingGuids = [...sourceByGuid.keys()]
    .filter((guid) => !candidateByGuid.has(guid))
    .map((guid) => guidFingerprint(guid));
  const extraGuids = [...candidateByGuid.keys()]
    .filter((guid) => !sourceByGuid.has(guid))
    .map((guid) => guidFingerprint(guid));
  if (missingGuids.length || extraGuids.length) {
    issues.push({ code: "guid_set", message: "Candidate GUID set does not exactly match the source feed." });
  }

  const metadataMismatches = [];
  let sharedGuidCount = 0;
  for (const [guid, sourceEpisode] of sourceByGuid) {
    const candidateEpisode = candidateByGuid.get(guid);
    if (!candidateEpisode) continue;
    sharedGuidCount += 1;
    const fields = [];
    if (sourceEpisode.title !== candidateEpisode.title) fields.push("title");
    if (sourceEpisode.description !== candidateEpisode.description) fields.push("description");
    if (sourceEpisode.comparablePubDate !== candidateEpisode.comparablePubDate) fields.push("pubDate");
    if (sourceEpisode.comparableDuration !== candidateEpisode.comparableDuration) fields.push("duration");
    if (sourceEpisode.explicit !== candidateEpisode.explicit) fields.push("explicit");
    if (sourceEpisode.episodeNumber !== candidateEpisode.episodeNumber) fields.push("episodeNumber");
    if (sourceEpisode.seasonNumber !== candidateEpisode.seasonNumber) fields.push("seasonNumber");
    if (sourceEpisode.episodeType !== candidateEpisode.episodeType) fields.push("episodeType");
    if (sourceEpisode.enclosurePresent !== candidateEpisode.enclosurePresent) fields.push("enclosure");
    if (fields.length) {
      metadataMismatches.push({
        fingerprint: guidFingerprint(guid),
        title: sourceEpisode.title,
        fields,
      });
    }
  }
  if (metadataMismatches.length) {
    issues.push({ code: "episode_metadata", message: "Per-GUID episode metadata differs." });
  }

  return {
    ok: issues.length === 0,
    issues,
    sourceDuplicates,
    candidateDuplicates,
    sourceMissingMetadata,
    candidateMissingMetadata,
    showMetadataMismatches,
    missingGuids,
    extraGuids,
    sharedGuidCount,
    metadataMismatches,
  };
}

export function compareSourceBaseline(source, expected = {}) {
  const expectedCount = expected.expectedEpisodeCount;
  const expectedGuids = Array.isArray(expected.expectedGuids) ? expected.expectedGuids : [];
  const actualGuids = source.episodes.map((episode) => episode.guid).filter(Boolean);
  const expectedSet = new Set(expectedGuids);
  const actualSet = new Set(actualGuids);
  const countMatches = Number.isInteger(expectedCount) && source.episodes.length === expectedCount;
  const guidSetMatches =
    expectedGuids.length > 0 &&
    expectedSet.size === expectedGuids.length &&
    actualSet.size === actualGuids.length &&
    expectedSet.size === actualSet.size &&
    [...expectedSet].every((guid) => actualSet.has(guid));

  return {
    ok: countMatches && guidSetMatches,
    countMatches,
    guidSetMatches,
    expectedCount,
    actualCount: source.episodes.length,
    missingGuids: [...expectedSet].filter((guid) => !actualSet.has(guid)).map(guidFingerprint),
    extraGuids: [...actualSet].filter((guid) => !expectedSet.has(guid)).map(guidFingerprint),
  };
}

function parseHttpUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Feed and media URLs must be valid HTTP or HTTPS URLs.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Feed and media URLs must use HTTP or HTTPS.");
  }
  return url;
}

function blockedHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  ) {
    return true;
  }

  if (isIP(normalized) === 4) {
    const [first, second] = normalized.split(".").map(Number);
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      first >= 224
    );
  }

  if (isIP(normalized) === 6) {
    if (normalized === "::" || normalized === "::1") return true;
    if (/^f[cd]/.test(normalized)) return true;
    if (/^fe[89ab]/.test(normalized)) return true;
    if (normalized.startsWith("::ffff:")) return blockedHostname(normalized.slice(7));
  }
  return false;
}

function remoteUrl(value, { allowPrivateNetwork = false } = {}) {
  const url = parseHttpUrl(value);
  if (!allowPrivateNetwork && blockedHostname(url.hostname)) {
    const error = new Error("Local, private, and link-local network targets are blocked.");
    error.code = "ERR_BLOCKED_TARGET";
    throw error;
  }
  return url;
}

export function safeUrl(value) {
  try {
    const url = parseHttpUrl(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return redactEmail(url.toString());
  } catch {
    return "[invalid URL]";
  }
}

async function cancelBody(response) {
  try {
    await response?.body?.cancel();
  } catch {
    // The body may already be consumed or closed.
  }
}

async function requestWithRedirects(
  urlValue,
  {
    fetchImpl = globalThis.fetch,
    method = "GET",
    headers = {},
    timeoutMs = defaultTimeoutMs,
    maxRedirects = 10,
    allowPrivateNetwork = false,
  } = {}
) {
  let current;
  try {
    current = remoteUrl(urlValue, { allowPrivateNetwork });
  } catch (error) {
    return { ok: false, error: error.code === "ERR_BLOCKED_TARGET" ? "blocked_network_target" : "invalid_url", chain: [] };
  }
  const visited = new Set();
  const chain = [];

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    if (visited.has(current.href)) return { ok: false, error: "redirect_loop", chain };
    visited.add(current.href);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    timeout.unref?.();
    let response;
    try {
      response = await fetchImpl(current.href, {
        method,
        headers,
        redirect: "manual",
        signal: controller.signal,
      });
    } catch {
      clearTimeout(timeout);
      return { ok: false, error: "request_failed", chain };
    }
    clearTimeout(timeout);
    chain.push({ url: safeUrl(current.href), status: response.status });

    if (!redirectStatuses.has(response.status)) return { ok: true, response, chain };
    const location = response.headers.get("location");
    await cancelBody(response);
    if (!location) return { ok: false, error: "redirect_without_location", chain };
    if (redirectCount === maxRedirects) return { ok: false, error: "too_many_redirects", chain };
    try {
      current = remoteUrl(new URL(location, current).href, { allowPrivateNetwork });
    } catch {
      return { ok: false, error: "blocked_or_invalid_redirect", chain };
    }
  }
  return { ok: false, error: "too_many_redirects", chain };
}

async function readLimitedBody(response, limitBytes = maxFeedBytes) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > limitBytes) throw new Error("Feed exceeds the size limit.");
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limitBytes) throw new Error("Feed exceeds the size limit.");
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }
  return Buffer.concat(chunks, size).toString("utf8");
}

export async function fetchPodcastFeed(url, options = {}) {
  const requestUrl = safeUrl(url);
  const result = await requestWithRedirects(url, {
    ...options,
    method: "GET",
    headers: {
      accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8",
      "user-agent": "DrM-RSS-Migration-Preflight/1.0",
      ...options.headers,
    },
  });
  if (!result.ok) return { ok: false, requestUrl, chain: result.chain, error: result.error };
  if (result.response.status < 200 || result.response.status >= 300) {
    await cancelBody(result.response);
    return { ok: false, requestUrl, chain: result.chain, error: "http_status" };
  }
  try {
    const xml = await readLimitedBody(result.response, options.maxBytes ?? maxFeedBytes);
    return { ok: true, requestUrl, chain: result.chain, xml };
  } catch (error) {
    return {
      ok: false,
      requestUrl,
      chain: result.chain,
      error: error.message === "Feed exceeds the size limit." ? "feed_too_large" : "body_read_failed",
    };
  }
}

function positiveIntegerHeader(value) {
  return /^\d+$/.test(value ?? "") && Number(value) > 0 ? Number(value) : null;
}

function contentRangeTotal(value) {
  const match = /^bytes\s+0-0\/(\d+)$/i.exec(value?.trim() ?? "");
  return match && Number(match[1]) > 0 ? Number(match[1]) : null;
}

function normalizedContentType(value) {
  return value?.split(";", 1)[0].trim().toLowerCase() || null;
}

async function probeMediaUrl(url, options) {
  const head = await requestWithRedirects(url, {
    ...options,
    method: "HEAD",
    headers: { "user-agent": "DrM-RSS-Migration-Preflight/1.0" },
  });
  const headStatus = head.ok ? head.response.status : null;
  const headUsable = head.ok && headStatus >= 200 && headStatus < 300;
  const headContentType = headUsable ? normalizedContentType(head.response.headers.get("content-type")) : null;
  const headContentLength = headUsable ? positiveIntegerHeader(head.response.headers.get("content-length")) : null;
  const advertisedByteRanges = headUsable && /(?:^|,)\s*bytes\s*(?:,|$)/i.test(head.response.headers.get("accept-ranges") ?? "");
  if (head.ok) await cancelBody(head.response);

  const ranged = await requestWithRedirects(url, {
    ...options,
    method: "GET",
    headers: {
      range: "bytes=0-0",
      "accept-encoding": "identity",
      "user-agent": "DrM-RSS-Migration-Preflight/1.0",
    },
  });
  const rangeStatus = ranged.ok ? ranged.response.status : null;
  const rangeContentType = ranged.ok ? normalizedContentType(ranged.response.headers.get("content-type")) : null;
  const rangeTotal = ranged.ok ? contentRangeTotal(ranged.response.headers.get("content-range")) : null;
  if (ranged.ok) await cancelBody(ranged.response);

  const contentType = rangeContentType ?? headContentType;
  const contentLength = headContentLength ?? rangeTotal;
  const checks = {
    audioContentType: Boolean(contentType?.startsWith("audio/")),
    positiveContentLength: Boolean(contentLength),
    oneByteRange206: rangeStatus === 206,
  };
  return {
    ok: Object.values(checks).every(Boolean),
    headStatus,
    rangeStatus,
    contentType,
    contentLength,
    advertisedByteRanges,
    checks,
    headChain: head.chain,
    rangeChain: ranged.chain,
  };
}

async function mapWithConcurrency(values, concurrency, worker) {
  const output = new Array(values.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      output[index] = await worker(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => run()));
  return output;
}

export async function verifyCandidateMedia(candidateFeed, options = {}) {
  const episodes = candidateFeed.episodes.filter((episode) => episode.guid && episode.enclosureUrl);
  return mapWithConcurrency(episodes, options.concurrency ?? 3, async (episode) => {
    const probe = await probeMediaUrl(episode.enclosureUrl, options);
    return {
      ...probe,
      fingerprint: guidFingerprint(episode.guid),
      title: episode.title,
    };
  });
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function resolveThroughExistingAncestor(target) {
  let cursor = target;
  const suffix = [];
  while (true) {
    try {
      const ancestor = await fs.realpath(cursor);
      return path.join(ancestor, ...suffix);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const parent = path.dirname(cursor);
      if (parent === cursor) throw error;
      suffix.unshift(path.basename(cursor));
      cursor = parent;
    }
  }
}

export async function saveRawFeedSnapshots({ sourceXml, candidateXml, directory, root = projectRoot, now = new Date() }) {
  if (!directory) throw new Error("A snapshot directory must be supplied explicitly.");
  if (typeof sourceXml !== "string" || typeof candidateXml !== "string") {
    throw new Error("Both raw feeds are required before snapshots can be saved.");
  }

  const resolvedRoot = await fs.realpath(root);
  const resolvedDirectory = path.resolve(directory);
  const prospectiveDirectory = await resolveThroughExistingAncestor(resolvedDirectory);
  if (isInside(resolvedRoot, prospectiveDirectory)) {
    throw new Error("Snapshot directory must be outside the project repository.");
  }

  await fs.mkdir(resolvedDirectory, { recursive: true, mode: 0o700 });
  const actualDirectory = await fs.realpath(resolvedDirectory);
  if (isInside(resolvedRoot, actualDirectory)) {
    throw new Error("Snapshot directory must be outside the project repository.");
  }
  await fs.chmod(actualDirectory, 0o700);

  const timestamp = now.toISOString().replace(/[-:.]/g, "").toLowerCase();
  const suffix = randomBytes(4).toString("hex");
  const sourcePath = path.join(actualDirectory, `source-${timestamp}-${suffix}.xml`);
  const candidatePath = path.join(actualDirectory, `candidate-${timestamp}-${suffix}.xml`);
  await writePrivateText(sourcePath, sourceXml, { exclusive: true });
  try {
    await writePrivateText(candidatePath, candidateXml, { exclusive: true });
  } catch (error) {
    await fs.rm(sourcePath, { force: true });
    throw error;
  }
  return { sourcePath, candidatePath };
}

function redactEmail(value) {
  return String(value).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]");
}

function safeText(value, maximumLength = 180) {
  if (value == null) return "missing";
  const clean = redactEmail(value).replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return clean.length > maximumLength ? `${clean.slice(0, maximumLength - 3)}...` : clean;
}

function renderEndpoint(label, fetched, feed) {
  const lines = [`${label}`, `- requested: ${fetched.requestUrl}`];
  if (fetched.chain.length) {
    lines.push("- HTTP chain:");
    for (const hop of fetched.chain) lines.push(`  ${hop.status} ${hop.url}`);
  } else {
    lines.push("- HTTP chain: request failed before a response");
  }
  if (!fetched.ok) {
    lines.push(`- feed status: FAIL (${safeText(fetched.error)})`);
    return lines;
  }
  lines.push("- feed status: PASS");
  if (feed) {
    lines.push(`- title: ${safeText(feed.title)}`);
    lines.push(`- generator: ${safeText(feed.generator)}`);
    lines.push(`- episodes: ${feed.episodes.length}`);
  }
  return lines;
}

export function renderPreflightReport({
  sourceFetch,
  candidateFetch,
  sourceFeed,
  candidateFeed,
  sourceBaseline,
  comparison,
  media,
  snapshots,
}) {
  const lines = ["RSS host migration preflight", ""];
  lines.push(...renderEndpoint("Source feed", sourceFetch, sourceFeed), "");
  lines.push(...renderEndpoint("Candidate feed", candidateFetch, candidateFeed), "");

  if (sourceBaseline) {
    lines.push("Recorded source baseline");
    lines.push(
      `- episode count: ${sourceBaseline.countMatches ? "PASS" : "FAIL"} (${sourceBaseline.actualCount}/${sourceBaseline.expectedCount})`,
      `- exact GUID set: ${sourceBaseline.guidSetMatches ? "PASS" : "FAIL"}`
    );
    if (sourceBaseline.missingGuids.length) {
      lines.push(`- missing GUID fingerprints: ${sourceBaseline.missingGuids.join(", ")}`);
    }
    if (sourceBaseline.extraGuids.length) {
      lines.push(`- extra GUID fingerprints: ${sourceBaseline.extraGuids.join(", ")}`);
    }
    lines.push("");
  }

  if (comparison) {
    const sourceHasEpisodes = sourceFeed.episodes.length > 0;
    const candidateHasEpisodes = candidateFeed.episodes.length > 0;
    const sharedGuidsExist = comparison.sharedGuidCount > 0;
    lines.push("Migration comparison");
    lines.push(
      `- episode count: ${sourceFeed.episodes.length === candidateFeed.episodes.length ? "PASS" : "FAIL"}`,
      `- source GUID uniqueness: ${sourceHasEpisodes ? (comparison.sourceDuplicates.length ? "FAIL" : "PASS") : "NOT CHECKED (source feed has no episodes)"}`,
      `- candidate GUID uniqueness: ${candidateHasEpisodes ? (comparison.candidateDuplicates.length ? "FAIL" : "PASS") : "NOT CHECKED (candidate feed has no episodes)"}`,
      `- exact GUID set: ${comparison.missingGuids.length || comparison.extraGuids.length ? "FAIL" : "PASS"}`,
      `- show metadata: ${comparison.showMetadataMismatches.length ? "FAIL" : "PASS"}`,
      `- per-GUID metadata: ${sharedGuidsExist ? (comparison.metadataMismatches.length ? "FAIL" : "PASS") : "NOT CHECKED (no shared GUIDs)"}`,
      `- required source episode metadata: ${sourceHasEpisodes ? (comparison.sourceMissingMetadata.length ? "FAIL" : "PASS") : "NOT CHECKED (source feed has no episodes)"}`,
      `- required candidate episode metadata: ${candidateHasEpisodes ? (comparison.candidateMissingMetadata.length ? "FAIL" : "PASS") : "NOT CHECKED (candidate feed has no episodes)"}`
    );
    if (comparison.showMetadataMismatches.length) {
      lines.push(`- show metadata mismatches: ${comparison.showMetadataMismatches.join(", ")}`);
    }
    if (comparison.missingGuids.length) lines.push(`- missing GUID fingerprints: ${comparison.missingGuids.join(", ")}`);
    if (comparison.extraGuids.length) lines.push(`- extra GUID fingerprints: ${comparison.extraGuids.join(", ")}`);
    for (const mismatch of comparison.metadataMismatches) {
      lines.push(
        `- metadata mismatch ${mismatch.fingerprint} (${safeText(mismatch.title, 100)}): ${mismatch.fields.join(", ")}`
      );
    }
    for (const duplicate of comparison.sourceDuplicates) {
      lines.push(`- source duplicate ${duplicate.fingerprint}: ${duplicate.count} occurrences`);
    }
    for (const duplicate of comparison.candidateDuplicates) {
      lines.push(`- candidate duplicate ${duplicate.fingerprint}: ${duplicate.count} occurrences`);
    }
    lines.push("");
  }

  if (media) {
    const failures = media.filter((item) => !item.ok);
    const passedChecks = (name) => media.filter((item) => item.checks[name]).length;
    const expectedChecks = candidateFeed?.episodes.length ?? 0;
    const coverageOk = expectedChecks > 0 && media.length === expectedChecks;
    const mediaStatus = (name) =>
      media.length ? `${passedChecks(name) === media.length ? "PASS" : "FAIL"} (${passedChecks(name)}/${media.length})` : "NOT CHECKED (no candidate media)";
    lines.push("Candidate media availability");
    lines.push(`- checked: ${media.length}`);
    lines.push(`- episode coverage: ${coverageOk ? "PASS" : "FAIL"} (${media.length}/${expectedChecks})`);
    lines.push(`- audio content-type: ${mediaStatus("audioContentType")}`);
    lines.push(`- positive full content length: ${mediaStatus("positiveContentLength")}`);
    lines.push(`- one-byte range returned 206: ${mediaStatus("oneByteRange206")}`);
    lines.push(`- Accept-Ranges: bytes advertised: ${media.filter((item) => item.advertisedByteRanges).length}/${media.length}`);
    lines.push(`- result: ${coverageOk && !failures.length ? "PASS" : "FAIL"}`);
    for (const failure of failures) {
      const failedChecks = Object.entries(failure.checks)
        .filter(([, passed]) => !passed)
        .map(([name]) => name)
        .join(", ");
      lines.push(
        `- unavailable ${failure.fingerprint} (${safeText(failure.title, 100)}): ${failedChecks}; HEAD ${failure.headStatus ?? "no response"}, range ${failure.rangeStatus ?? "no response"}`
      );
    }
    lines.push("");
  }

  if (snapshots) {
    lines.push("Private raw snapshots");
    lines.push(`- source: ${safeText(snapshots.sourcePath)}`);
    lines.push(`- candidate: ${safeText(snapshots.candidatePath)}`);
    lines.push("");
  }

  const mediaOk =
    !media ||
    (Boolean(candidateFeed?.episodes.length) && media.length === candidateFeed.episodes.length && media.every((item) => item.ok));
  const baselineOk = !sourceBaseline || sourceBaseline.ok;
  const passed = sourceFetch.ok && candidateFetch.ok && baselineOk && Boolean(comparison?.ok) && mediaOk;
  lines.push(`RESULT: ${passed ? "PASS - feeds are structurally consistent" : "FAIL - do not cut over or redirect"}`);
  return `${lines.join("\n")}\n`;
}

function parseArguments(args) {
  const options = { verifyMedia: false, timeoutMs: defaultTimeoutMs };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (["-h", "--help"].includes(argument)) {
      options.help = true;
      continue;
    }
    if (argument === "--verify-media") {
      options.verifyMedia = true;
      continue;
    }
    if (["--source", "--candidate", "--snapshot-dir", "--timeout-ms"].includes(argument)) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
      index += 1;
      if (argument === "--source") options.source = value;
      if (argument === "--candidate") options.candidate = value;
      if (argument === "--snapshot-dir") options.snapshotDirectory = value;
      if (argument === "--timeout-ms") options.timeoutMs = Number(value);
      continue;
    }
    throw new Error(`Unknown option: ${argument}`);
  }
  if (!options.help && (!options.source || !options.candidate)) {
    throw new Error("Both --source and --candidate are required.");
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1000 || options.timeoutMs > 120_000) {
    throw new Error("--timeout-ms must be an integer between 1000 and 120000.");
  }
  return options;
}

export async function runPreflight(options) {
  const fetchOptions = { timeoutMs: options.timeoutMs, fetchImpl: options.fetchImpl };
  const [sourceFetch, candidateFetch] = await Promise.all([
    fetchPodcastFeed(options.source, fetchOptions),
    fetchPodcastFeed(options.candidate, fetchOptions),
  ]);

  let snapshots = null;
  if (options.snapshotDirectory) {
    if (!sourceFetch.ok || !candidateFetch.ok) {
      throw new Error("Both feeds must be retrieved before raw snapshots can be saved.");
    }
    snapshots = await saveRawFeedSnapshots({
      sourceXml: sourceFetch.xml,
      candidateXml: candidateFetch.xml,
      directory: options.snapshotDirectory,
    });
  }

  let sourceFeed = null;
  let candidateFeed = null;
  let sourceBaseline = null;
  let comparison = null;
  if (sourceFetch.ok) {
    try {
      sourceFeed = parsePodcastFeed(sourceFetch.xml);
    } catch {
      sourceFetch.ok = false;
      sourceFetch.error = "invalid_rss_xml";
    }
  }
  if (candidateFetch.ok) {
    try {
      candidateFeed = parsePodcastFeed(candidateFetch.xml);
    } catch {
      candidateFetch.ok = false;
      candidateFetch.error = "invalid_rss_xml";
    }
  }
  if (sourceFeed && options.expectedSource) sourceBaseline = compareSourceBaseline(sourceFeed, options.expectedSource);
  if (sourceFeed && candidateFeed) comparison = comparePodcastFeeds(sourceFeed, candidateFeed);

  let media = null;
  if (options.verifyMedia && candidateFeed) media = await verifyCandidateMedia(candidateFeed, fetchOptions);
  const report = renderPreflightReport({
    sourceFetch,
    candidateFetch,
    sourceFeed,
    candidateFeed,
    sourceBaseline,
    comparison,
    media,
    snapshots,
  });
  return {
    ok:
      sourceFetch.ok &&
      candidateFetch.ok &&
      (!sourceBaseline || sourceBaseline.ok) &&
      Boolean(comparison?.ok) &&
      (!media || media.every((item) => item.ok)),
    report,
    sourceBaseline,
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const result = await runPreflight(options);
  process.stdout.write(result.report);
  if (!result.ok) process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    process.stderr.write(`feed-preflight: ${safeText(error.message)}\n`);
    process.exitCode = 1;
  });
}
