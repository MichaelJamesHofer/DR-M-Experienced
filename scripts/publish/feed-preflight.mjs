#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { isIP } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { comparePublishedCatalogFeed } from "./catalog.mjs";
import { writePrivateText } from "./lib.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(scriptPath), "..", "..");
const redirectStatuses = new Set([301, 302, 303, 307, 308]);
const defaultTimeoutMs = 15_000;
const maxFeedBytes = 10 * 1024 * 1024;
const defaultEdgeDecodeTimeoutMs = 30 * 60 * 1000;
const defaultMaxDecodedMediaBytes = 1024 * 1024 * 1024;

function usage() {
  return `Usage:
  node scripts/publish/feed-preflight.mjs --source <feed-url> --candidate <feed-url> [options]

Options:
  --snapshot-dir <directory>   Save both raw feeds as private 0600 files outside the repository.
  --target-metadata <json>     Require candidate metadata from a JSON object or its targetMetadata field.
  --verify-media               Check every candidate enclosure with HEAD and a one-byte range request.
  --verify-artwork             Require and probe every candidate episode's item-level artwork URL.
  --decode-edge-audio          Fully download and ffmpeg-decode the oldest and newest candidate audio.
                                Downloads use private OS temp files, are capped at 1 GiB each, and are deleted.
  --timeout-ms <milliseconds>  Per-request timeout (default: ${defaultTimeoutMs}).
  -h, --help                   Show this help.

The default command writes no files. Optional snapshots and decode temp files stay outside the repository.
This command never changes a hosting service.`;
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

function artworkUrl(value) {
  for (const name of ["image", "thumbnail"]) {
    for (const artwork of arrayValue(childByLocalName(value, name))) {
      const url =
        attributeByLocalName(artwork, "href") ??
        attributeByLocalName(artwork, "url") ??
        textValue(childByLocalName(artwork, "url")) ??
        textValue(artwork);
      if (url) return url;
    }
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

function comparableDescription(value) {
  if (value == null) return null;
  const entities = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return String(value)
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, digits) => String.fromCodePoint(Number.parseInt(digits, 16)))
    .replace(/&#([0-9]+);/g, (_, digits) => String.fromCodePoint(Number.parseInt(digits, 10)))
    .replace(/&(amp|apos|gt|lt|nbsp|quot);/gi, (_, name) => entities[name.toLowerCase()])
    .replace(/\s+/g, " ")
    .trim();
}

function parseRssItem(item) {
  const guid = textValue(childByLocalName(item, "guid")) ?? textValue(childByLocalName(item, "id"));
  const title = textValue(childByLocalName(item, "title"));
  const pubDate = textValue(childByLocalName(item, "pubdate")) ?? textValue(childByLocalName(item, "published"));
  const duration = textValue(childByLocalName(item, "duration"));
  const mediaUrl = enclosureUrl(item);
  const episodeArtworkUrl = artworkUrl(item);
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
    artworkPresent: Boolean(episodeArtworkUrl),
    artworkUrl: episodeArtworkUrl,
  };
}

function channelArtworkPresent(channel) {
  return Boolean(artworkUrl(channel));
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
    const sourceValue = field === "description" ? comparableDescription(source[field]) : source[field];
    const candidateValue = field === "description" ? comparableDescription(candidate[field]) : candidate[field];
    if (sourceValue !== candidateValue) showMetadataMismatches.push(field);
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
    if (comparableDescription(sourceEpisode.description) !== comparableDescription(candidateEpisode.description)) {
      fields.push("description");
    }
    if (sourceEpisode.comparablePubDate !== candidateEpisode.comparablePubDate) fields.push("pubDate");
    if (sourceEpisode.comparableDuration !== candidateEpisode.comparableDuration) fields.push("duration");
    if (sourceEpisode.explicit !== candidateEpisode.explicit) fields.push("explicit");
    if (sourceEpisode.episodeNumber !== candidateEpisode.episodeNumber) fields.push("episodeNumber");
    if (sourceEpisode.seasonNumber !== candidateEpisode.seasonNumber) fields.push("seasonNumber");
    if (sourceEpisode.episodeType !== candidateEpisode.episodeType) fields.push("episodeType");
    if (sourceEpisode.enclosurePresent !== candidateEpisode.enclosurePresent) fields.push("enclosure");
    if (sourceEpisode.artworkPresent !== candidateEpisode.artworkPresent) fields.push("artwork");
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

export function compareTargetMetadata(candidate, expected) {
  const supportedFields = ["title", "description", "language", "author", "explicit", "podcastType"];
  const checkedFields = supportedFields.filter((field) => Object.hasOwn(expected ?? {}, field));
  if (!checkedFields.length) {
    throw new Error("Target metadata must define at least one supported show field.");
  }
  if (checkedFields.some((field) => expected[field] == null || typeof expected[field] === "object")) {
    throw new Error("Target metadata fields must contain scalar values.");
  }

  const mismatches = [];
  for (const field of checkedFields) {
    let normalize = (value) => value;
    if (field === "description") normalize = comparableDescription;
    if (["language", "podcastType"].includes(field)) normalize = (value) => textValue(value)?.toLowerCase() ?? null;
    if (field === "explicit") normalize = comparableBoolean;
    if (normalize(candidate[field]) !== normalize(expected[field])) mismatches.push(field);
  }
  return { ok: mismatches.length === 0, checkedFields, mismatches };
}

export async function loadTargetMetadata(filePath) {
  let document;
  try {
    document = JSON.parse(await fs.readFile(path.resolve(filePath), "utf8"));
  } catch {
    throw new Error("Target metadata JSON could not be read and parsed.");
  }
  const metadata = document?.targetMetadata ?? document;
  compareTargetMetadata({}, metadata);
  return metadata;
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

async function probeArtworkUrl(url, options) {
  const head = await requestWithRedirects(url, {
    ...options,
    method: "HEAD",
    headers: { "user-agent": "DrM-RSS-Migration-Preflight/1.0" },
  });
  const headStatus = head.ok ? head.response.status : null;
  const headUsable = head.ok && headStatus >= 200 && headStatus < 300;
  const headContentType = headUsable ? normalizedContentType(head.response.headers.get("content-type")) : null;
  const headContentLength = headUsable ? positiveIntegerHeader(head.response.headers.get("content-length")) : null;
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
  const rangeUsable = ranged.ok && rangeStatus >= 200 && rangeStatus < 300;
  const rangeContentType = rangeUsable ? normalizedContentType(ranged.response.headers.get("content-type")) : null;
  const rangeTotal = rangeUsable
    ? contentRangeTotal(ranged.response.headers.get("content-range")) ??
      positiveIntegerHeader(ranged.response.headers.get("content-length"))
    : null;
  if (ranged.ok) await cancelBody(ranged.response);

  const contentType = rangeContentType ?? headContentType;
  const contentLength = headContentLength ?? rangeTotal;
  const checks = {
    imageContentType: Boolean(contentType?.startsWith("image/")),
    positiveContentLength: Boolean(contentLength),
    reachableGet: rangeUsable,
  };
  return {
    ok: Object.values(checks).every(Boolean),
    headStatus,
    rangeStatus,
    contentType,
    contentLength,
    checks,
    headChain: head.chain,
    rangeChain: ranged.chain,
  };
}

export async function verifyCandidateArtwork(candidateFeed, options = {}) {
  const episodes = candidateFeed.episodes.filter((episode) => episode.guid && episode.artworkUrl);
  return mapWithConcurrency(episodes, options.concurrency ?? 3, async (episode) => {
    const probe = await probeArtworkUrl(episode.artworkUrl, options);
    return {
      ...probe,
      fingerprint: guidFingerprint(episode.guid),
      title: episode.title,
    };
  });
}

function codedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

async function writeFullResponseToFile(response, filePath, { timeoutMs, maxBytes }) {
  const declaredLength = positiveIntegerHeader(response.headers.get("content-length"));
  if (declaredLength && declaredLength > maxBytes) throw codedError("media_exceeds_size_limit");
  if (!response.body) throw codedError("media_body_missing");

  const handle = await fs.open(filePath, "wx", 0o600);
  const reader = response.body.getReader();
  let bytesWritten = 0;
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    void reader.cancel().catch(() => {});
  }, timeoutMs);
  timeout.unref?.();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (timedOut) throw codedError("media_download_timeout");
      if (done) break;
      bytesWritten += value.byteLength;
      if (bytesWritten > maxBytes) throw codedError("media_exceeds_size_limit");

      const chunk = Buffer.from(value);
      let offset = 0;
      while (offset < chunk.length) {
        const { bytesWritten: written } = await handle.write(chunk, offset, chunk.length - offset, null);
        if (!written) throw codedError("media_file_write_failed");
        offset += written;
      }
    }
    if (timedOut) throw codedError("media_download_timeout");
    if (!bytesWritten) throw codedError("media_body_empty");

    const contentEncoding = response.headers.get("content-encoding")?.toLowerCase();
    if (declaredLength && (!contentEncoding || contentEncoding === "identity") && bytesWritten !== declaredLength) {
      throw codedError("media_content_length_mismatch");
    }
    return bytesWritten;
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    clearTimeout(timeout);
    await handle.close();
  }
}

async function downloadFullMedia(url, filePath, options = {}) {
  const fetched = await requestWithRedirects(url, {
    ...options,
    method: "GET",
    headers: {
      accept: "audio/*, application/octet-stream;q=0.5",
      "accept-encoding": "identity",
      "user-agent": "DrM-RSS-Migration-Preflight/1.0",
    },
  });
  if (!fetched.ok) return { ok: false, error: fetched.error, chain: fetched.chain };
  if (fetched.response.status !== 200) {
    await cancelBody(fetched.response);
    return { ok: false, error: "http_status", chain: fetched.chain, status: fetched.response.status };
  }

  const contentType = normalizedContentType(fetched.response.headers.get("content-type"));
  try {
    const bytes = await writeFullResponseToFile(fetched.response, filePath, {
      timeoutMs: options.edgeDecodeTimeoutMs ?? defaultEdgeDecodeTimeoutMs,
      maxBytes: options.maxDecodedMediaBytes ?? defaultMaxDecodedMediaBytes,
    });
    return { ok: true, bytes, contentType, chain: fetched.chain, status: fetched.response.status };
  } catch (error) {
    await fs.rm(filePath, { force: true });
    return {
      ok: false,
      error: error.code ?? "media_download_failed",
      contentType,
      chain: fetched.chain,
      status: fetched.response.status,
    };
  }
}

export async function decodeAudioFile(filePath, options = {}) {
  const spawnImpl = options.spawnImpl ?? spawn;
  const ffmpegPath = options.ffmpegPath ?? "ffmpeg";
  const timeoutMs = options.edgeDecodeTimeoutMs ?? defaultEdgeDecodeTimeoutMs;
  return new Promise((resolve) => {
    let child;
    try {
      child = spawnImpl(
        ffmpegPath,
        ["-nostdin", "-v", "error", "-xerror", "-i", filePath, "-map", "0:a:0", "-f", "null", "-"],
        { stdio: ["ignore", "ignore", "ignore"] }
      );
    } catch {
      resolve({ ok: false, error: "ffmpeg_start_failed" });
      return;
    }

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ ok: false, error: "ffmpeg_timeout" });
    }, timeoutMs);
    timeout.unref?.();
    child.once("error", () => finish({ ok: false, error: "ffmpeg_start_failed" }));
    child.once("close", (status, signal) =>
      finish(status === 0 ? { ok: true } : { ok: false, error: signal ? "ffmpeg_terminated" : "ffmpeg_decode_failed" })
    );
  });
}

function edgeEpisodes(candidateFeed) {
  const expectedCount = Math.min(2, candidateFeed.episodes.length);
  if (!candidateFeed.episodes.length) {
    return { ok: false, selectionOk: false, expectedCount, error: "candidate_has_no_episodes", episodes: [] };
  }

  const dated = [];
  for (const episode of candidateFeed.episodes) {
    const timestamp = Date.parse(episode.pubDate ?? "");
    if (!episode.guid || !episode.enclosureUrl || !Number.isFinite(timestamp)) {
      return {
        ok: false,
        selectionOk: false,
        expectedCount,
        error: "candidate_edge_selection_metadata_invalid",
        episodes: [],
      };
    }
    dated.push({ episode, timestamp });
  }
  dated.sort((left, right) => left.timestamp - right.timestamp);
  const first = dated[0].episode;
  const last = dated.at(-1).episode;
  return {
    ok: true,
    selectionOk: true,
    expectedCount,
    episodes: first.guid === last.guid ? [{ role: "oldest/newest", episode: first }] : [
      { role: "oldest", episode: first },
      { role: "newest", episode: last },
    ],
  };
}

export async function verifyCandidateEdgeAudio(candidateFeed, options = {}) {
  const selection = edgeEpisodes(candidateFeed);
  if (!selection.ok) return { ...selection, results: [] };

  const temporaryRoot = path.resolve(options.temporaryRoot ?? os.tmpdir());
  const resolvedProjectRoot = await fs.realpath(projectRoot);
  const prospectiveRoot = await resolveThroughExistingAncestor(temporaryRoot);
  if (isInside(resolvedProjectRoot, prospectiveRoot)) {
    throw new Error("Edge decode temporary files must be outside the project repository.");
  }
  await fs.mkdir(temporaryRoot, { recursive: true, mode: 0o700 });
  const temporaryDirectory = await fs.mkdtemp(path.join(temporaryRoot, "drm-feed-edge-audio-"));
  await fs.chmod(temporaryDirectory, 0o700);

  const results = [];
  try {
    for (const [index, selected] of selection.episodes.entries()) {
      const filePath = path.join(temporaryDirectory, `candidate-${index + 1}.media`);
      const download = await downloadFullMedia(selected.episode.enclosureUrl, filePath, options);
      const decoded = download.ok
        ? await (options.decodeImpl ?? decodeAudioFile)(filePath, options)
        : { ok: false, error: "not_decoded" };
      results.push({
        ok: download.ok && decoded.ok,
        role: selected.role,
        fingerprint: guidFingerprint(selected.episode.guid),
        title: selected.episode.title,
        downloadedBytes: download.bytes ?? null,
        contentType: download.contentType ?? null,
        downloadError: download.ok ? null : download.error,
        decodeError: decoded.ok ? null : decoded.error,
      });
    }
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }

  return {
    ok: results.length === selection.expectedCount && results.every((result) => result.ok),
    expectedCount: selection.expectedCount,
    selectionOk: true,
    results,
  };
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

function finalFetchedUrl(fetched) {
  return fetched?.chain?.at(-1)?.url ?? null;
}

function buildCatalogBinding({ catalog, required, sourceFetch, candidateFetch, sourceFeed, candidateFeed }) {
  if (!catalog && !required) return null;

  const sourceFinalUrl = finalFetchedUrl(sourceFetch);
  const candidateFinalUrl = finalFetchedUrl(candidateFetch);
  const sourceRedirectedToCandidate = Boolean(
    sourceFetch?.chain?.length > 1 &&
      sourceFinalUrl &&
      candidateFinalUrl &&
      sourceFinalUrl === candidateFinalUrl
  );
  const binding = {
    required: true,
    phase: sourceRedirectedToCandidate ? "post_redirect" : "pre_redirect",
    sourceRequired: !sourceRedirectedToCandidate,
    sourceRedirectedToCandidate,
    source: null,
    candidate: null,
    error: null,
    ok: false,
  };

  if (!catalog) {
    binding.error = "A validated master catalog was not supplied.";
    return binding;
  }

  try {
    if (sourceFeed) binding.source = comparePublishedCatalogFeed(catalog, sourceFeed);
    if (candidateFeed) binding.candidate = comparePublishedCatalogFeed(catalog, candidateFeed);
  } catch (error) {
    binding.error = error.message;
    return binding;
  }

  binding.ok =
    Boolean(binding.candidate?.ok) &&
    (!binding.sourceRequired || Boolean(binding.source?.ok));
  return binding;
}

function catalogGuidLabel(guid) {
  return typeof guid === "string" && guid ? guidFingerprint(guid) : "missing-guid";
}

function renderCatalogFeedBinding(label, result, { required }) {
  const lines = [`${label}${required ? " (required)" : " (informational after redirect)"}`];
  if (!result) {
    lines.push("- result: FAIL (feed could not be parsed and checked)");
    return lines;
  }

  const guidSetOk = result.guidSetMatches && result.uniqueGuids;
  const order = (values) => values.map((value) => value ?? "missing").join(" > ");
  lines.push(
    `- episode count: ${result.episodeCountMatches ? "PASS" : "FAIL"} (${result.actualEpisodeCount}/${result.expectedEpisodeCount})`,
    `- exact unique GUID set: ${guidSetOk ? "PASS" : "FAIL"}`,
    `- canonical titles by GUID: ${result.titleMatches ? "PASS" : "FAIL"}`,
    `- structured episode numbers by GUID: ${result.structuredNumbersMatch ? "PASS" : "FAIL"}`,
    `- canonical descriptions by GUID: ${result.descriptionsMatch ? "PASS" : "FAIL"}`,
    `- no season metadata: ${result.noSeasonMetadata ? "PASS" : "FAIL"}`,
    `- reverse episode-number order: ${result.feedOrderMatches ? "PASS" : "FAIL"} (${order(result.actualFeedOrder)})`,
    `- legacy episode-number title prefixes: ${result.noLegacyTitlePrefixes ? "none" : "FAIL"}`,
    `- result: ${result.ok ? "PASS" : "FAIL"}`
  );
  if (!result.feedOrderMatches) {
    lines.push(`- expected order: ${order(result.expectedFeedOrder)}`);
  }
  if (result.missingGuids.length) {
    lines.push(`- missing catalog GUID fingerprints: ${result.missingGuids.map(catalogGuidLabel).join(", ")}`);
  }
  if (result.extraGuids.length) {
    lines.push(`- extra feed GUID fingerprints: ${result.extraGuids.map(catalogGuidLabel).join(", ")}`);
  }
  for (const duplicate of result.duplicateGuids) {
    lines.push(`- duplicate GUID ${catalogGuidLabel(duplicate.guid)}: ${duplicate.count} occurrences`);
  }
  if (result.missingGuidIndexes.length) {
    lines.push(`- missing GUID at feed indexes: ${result.missingGuidIndexes.join(", ")}`);
  }
  for (const mismatch of result.titleMismatches) {
    lines.push(
      `- title mismatch ${catalogGuidLabel(mismatch.guid)}: expected ${safeText(mismatch.expected, 100)}; actual ${safeText(mismatch.actual.join(" | "), 100)}`
    );
  }
  for (const mismatch of result.episodeNumberMismatches) {
    lines.push(
      `- episode number mismatch ${catalogGuidLabel(mismatch.guid)}: expected ${mismatch.expected}; actual ${mismatch.actual.map((value) => value ?? "missing").join(" | ") || "missing"}`
    );
  }
  for (const mismatch of result.descriptionMismatches) {
    lines.push(
      `- description mismatch ${catalogGuidLabel(mismatch.guid)} (${safeText(mismatch.title, 100)})`
    );
  }
  for (const episode of result.seasonMetadataEpisodes) {
    lines.push(
      `- season metadata ${catalogGuidLabel(episode.guid)} (${safeText(episode.title, 100)}) at feed index ${episode.index}: ${safeText(episode.seasonNumber, 40)}`
    );
  }
  return lines;
}

export function renderPreflightReport({
  sourceFetch,
  candidateFetch,
  sourceFeed,
  candidateFeed,
  sourceBaseline,
  targetMetadata,
  catalogBinding,
  comparison,
  media,
  artwork,
  edgeAudio,
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

  if (targetMetadata) {
    lines.push("Canonical target metadata");
    lines.push(`- checked fields: ${targetMetadata.checkedFields.join(", ")}`);
    lines.push(`- exact target values: ${targetMetadata.ok ? "PASS" : "FAIL"}`);
    if (targetMetadata.mismatches.length) {
      lines.push(`- mismatches: ${targetMetadata.mismatches.join(", ")}`);
    }
    lines.push("");
  }

  if (catalogBinding) {
    lines.push("Master catalog episode binding");
    if (catalogBinding.sourceRedirectedToCandidate) {
      lines.push(
        "- routing observation: source resolves to the candidate endpoint",
        "- source result is informational; candidate was fetched and checked separately"
      );
    } else {
      lines.push("- routing observation: source and candidate returned independently; both are required");
    }
    if (catalogBinding.error) lines.push(`- gate error: ${safeText(catalogBinding.error)}`);
    lines.push(
      ...renderCatalogFeedBinding("Source feed catalog binding", catalogBinding.source, {
        required: catalogBinding.sourceRequired,
      }),
      ...renderCatalogFeedBinding("Candidate feed catalog binding", catalogBinding.candidate, {
        required: true,
      }),
      `- catalog gate: ${catalogBinding.ok ? "PASS" : "FAIL"}`,
      ""
    );
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
      `- source item artwork: ${sourceFeed.episodes.filter((episode) => episode.artworkPresent).length}/${sourceFeed.episodes.length}`,
      `- candidate item artwork: ${candidateFeed.episodes.filter((episode) => episode.artworkPresent).length}/${candidateFeed.episodes.length}`,
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

  if (artwork) {
    const failures = artwork.filter((item) => !item.ok);
    const passedChecks = (name) => artwork.filter((item) => item.checks[name]).length;
    const expectedChecks = candidateFeed?.episodes.length ?? 0;
    const coverageOk = expectedChecks > 0 && artwork.length === expectedChecks;
    const artworkStatus = (name) =>
      artwork.length
        ? `${passedChecks(name) === artwork.length ? "PASS" : "FAIL"} (${passedChecks(name)}/${artwork.length})`
        : "NOT CHECKED (no candidate artwork)";
    lines.push("Candidate item-level artwork availability");
    lines.push(`- checked: ${artwork.length}`);
    lines.push(`- episode coverage: ${coverageOk ? "PASS" : "FAIL"} (${artwork.length}/${expectedChecks})`);
    lines.push(`- image content-type: ${artworkStatus("imageContentType")}`);
    lines.push(`- positive content length: ${artworkStatus("positiveContentLength")}`);
    lines.push(`- reachable GET: ${artworkStatus("reachableGet")}`);
    lines.push(`- result: ${coverageOk && !failures.length ? "PASS" : "FAIL"}`);
    for (const failure of failures) {
      const failedChecks = Object.entries(failure.checks)
        .filter(([, passed]) => !passed)
        .map(([name]) => name)
        .join(", ");
      lines.push(
        `- unavailable ${failure.fingerprint} (${safeText(failure.title, 100)}): ${failedChecks}; HEAD ${failure.headStatus ?? "no response"}, GET ${failure.rangeStatus ?? "no response"}`
      );
    }
    lines.push("");
  }

  if (edgeAudio) {
    lines.push("Oldest/newest full audio decode");
    lines.push(`- edge selection: ${edgeAudio.selectionOk === false ? "FAIL" : "PASS"}`);
    lines.push(`- episode coverage: ${edgeAudio.results.length === edgeAudio.expectedCount ? "PASS" : "FAIL"} (${edgeAudio.results.length}/${edgeAudio.expectedCount})`);
    for (const result of edgeAudio.results) {
      lines.push(
        `- ${result.role} ${result.fingerprint} (${safeText(result.title, 100)}): ${result.ok ? `PASS (${result.downloadedBytes} bytes downloaded and decoded)` : `FAIL (${safeText(result.downloadError ?? result.decodeError)})`}`
      );
    }
    if (edgeAudio.error) lines.push(`- error: ${safeText(edgeAudio.error)}`);
    lines.push(`- result: ${edgeAudio.ok ? "PASS" : "FAIL"}`, "");
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
  const artworkOk =
    !artwork ||
    (Boolean(candidateFeed?.episodes.length) &&
      artwork.length === candidateFeed.episodes.length &&
      artwork.every((item) => item.ok));
  const baselineOk = !sourceBaseline || sourceBaseline.ok;
  const targetMetadataOk = !targetMetadata || targetMetadata.ok;
  const catalogBindingOk = !catalogBinding || catalogBinding.ok;
  const edgeAudioOk = !edgeAudio || edgeAudio.ok;
  const passed =
    sourceFetch.ok &&
    candidateFetch.ok &&
    baselineOk &&
    targetMetadataOk &&
    catalogBindingOk &&
    Boolean(comparison?.ok) &&
    mediaOk &&
    artworkOk &&
    edgeAudioOk;
  lines.push(`RESULT: ${passed ? "PASS - all requested feed gates passed" : "FAIL - do not cut over or redirect"}`);
  return `${lines.join("\n")}\n`;
}

function parseArguments(args) {
  const options = {
    verifyMedia: false,
    verifyArtwork: false,
    decodeEdgeAudio: false,
    timeoutMs: defaultTimeoutMs,
  };
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
    if (argument === "--verify-artwork") {
      options.verifyArtwork = true;
      continue;
    }
    if (argument === "--decode-edge-audio") {
      options.decodeEdgeAudio = true;
      continue;
    }
    if (["--source", "--candidate", "--snapshot-dir", "--target-metadata", "--timeout-ms"].includes(argument)) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
      index += 1;
      if (argument === "--source") options.source = value;
      if (argument === "--candidate") options.candidate = value;
      if (argument === "--snapshot-dir") options.snapshotDirectory = value;
      if (argument === "--target-metadata") options.targetMetadataPath = value;
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
  let targetMetadata = null;
  let catalogBinding = null;
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
  if (candidateFeed && options.expectedCandidate) {
    targetMetadata = compareTargetMetadata(candidateFeed, options.expectedCandidate);
  }
  catalogBinding = buildCatalogBinding({
    catalog: options.catalog,
    required: options.requireCatalogBinding,
    sourceFetch,
    candidateFetch,
    sourceFeed,
    candidateFeed,
  });
  if (sourceFeed && candidateFeed) comparison = comparePodcastFeeds(sourceFeed, candidateFeed);

  let media = null;
  if (options.verifyMedia && candidateFeed) media = await verifyCandidateMedia(candidateFeed, fetchOptions);
  let artwork = null;
  if (options.verifyArtwork && candidateFeed) artwork = await verifyCandidateArtwork(candidateFeed, fetchOptions);
  let edgeAudio = null;
  if (options.decodeEdgeAudio && candidateFeed) {
    edgeAudio = await verifyCandidateEdgeAudio(candidateFeed, { ...fetchOptions, ...options.edgeAudioOptions });
  }
  const report = renderPreflightReport({
    sourceFetch,
    candidateFetch,
    sourceFeed,
    candidateFeed,
    sourceBaseline,
    targetMetadata,
    catalogBinding,
    comparison,
    media,
    artwork,
    edgeAudio,
    snapshots,
  });
  return {
    ok:
      sourceFetch.ok &&
      candidateFetch.ok &&
      (!sourceBaseline || sourceBaseline.ok) &&
      (!targetMetadata || targetMetadata.ok) &&
      (!catalogBinding || catalogBinding.ok) &&
      Boolean(comparison?.ok) &&
      (!media ||
        (Boolean(candidateFeed?.episodes.length) &&
          media.length === candidateFeed.episodes.length &&
          media.every((item) => item.ok))) &&
      (!artwork ||
        (Boolean(candidateFeed?.episodes.length) &&
          artwork.length === candidateFeed.episodes.length &&
          artwork.every((item) => item.ok))) &&
      (!edgeAudio || edgeAudio.ok),
    report,
    sourceBaseline,
    targetMetadata,
    catalogBinding,
    comparison,
    media,
    artwork,
    edgeAudio,
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (options.targetMetadataPath) {
    options.expectedCandidate = await loadTargetMetadata(options.targetMetadataPath);
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
