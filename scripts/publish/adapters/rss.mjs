import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AssetStagingError, stageApprovedAsset } from "../asset-staging.mjs";

export const RSS_API_VERSION = "v4";
export const RSS_API_BASE_URL = "https://api.rss.com";
export const RSS_API_KEY_ENV = "DRM_RSS_COM_API_KEY";
export const RSS_API_KEY_PATH_ENV = "DRM_RSS_COM_API_KEY_PATH";

const SHA256 = /^[a-f0-9]{64}$/;
const NUMERIC_ID = /^\d+$/;
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TRANSIENT_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const PROCESSING_DONE = "done";
const PROCESSING_FAILED = "error";
const MAX_AUDIO_BYTES = 2 * 1024 ** 3;
const MAX_ARTWORK_BYTES = 20 * 1024 ** 2;

export class RssAdapterError extends Error {
  constructor(message, {
    code = "RSS_ADAPTER_ERROR",
    cause,
    retryable = false,
    status = null,
    evidence = null,
  } = {}) {
    super(message, { cause });
    this.name = "RssAdapterError";
    this.code = code;
    this.retryable = retryable;
    this.status = status;
    this.evidence = evidence;
  }
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new RssAdapterError(`${label} must be a non-empty string.`, { code: "INVALID_INPUT" });
  }
  return value.trim();
}

function numericId(value, label) {
  const result = String(value ?? "").trim();
  if (!NUMERIC_ID.test(result)) {
    throw new RssAdapterError(`${label} must be a numeric RSS.com ID.`, { code: "INVALID_INPUT" });
  }
  return result;
}

function safeSlug(value, label) {
  const result = requiredString(value, label);
  if (!SAFE_SLUG.test(result)) {
    throw new RssAdapterError(`${label} must be a lowercase RSS.com slug.`, { code: "INVALID_INPUT" });
  }
  return result;
}

function assetRecord(value, label, allowedMimeTypes) {
  if (typeof value === "string") value = { path: value };
  if (!isObject(value)) {
    throw new RssAdapterError(`${label} is missing from the approved asset snapshot.`, {
      code: "INVALID_INPUT",
    });
  }
  const filePath = requiredString(value.path, `${label}.path`);
  const mimeType = value.mediaType ?? value.mimeType ?? mimeTypeFromPath(filePath);
  if (!allowedMimeTypes.has(mimeType)) {
    throw new RssAdapterError(`${label} must use one of: ${[...allowedMimeTypes].join(", ")}.`, {
      code: "INVALID_INPUT",
    });
  }
  const sha256 = typeof value.sha256 === "string" ? value.sha256.toLowerCase() : null;
  if (sha256 != null && !SHA256.test(sha256)) {
    throw new RssAdapterError(`${label}.sha256 is not a valid SHA-256 fingerprint.`, {
      code: "INVALID_INPUT",
    });
  }
  return {
    path: filePath,
    mimeType,
    sha256,
    sizeBytes: Number.isSafeInteger(value.sizeBytes) ? value.sizeBytes : null,
  };
}

function mimeTypeFromPath(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return ({
    ".aac": "audio/aac",
    ".m4a": "audio/mp4",
    ".mp3": "audio/mpeg",
    ".opus": "audio/opus",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
  })[extension] ?? null;
}

function operationInput(input) {
  const supplied = typeof input.operation === "string" ? { kind: input.operation } : input.operation;
  if (!isObject(supplied) || !["create", "replace", "update"].includes(supplied.kind)) {
    throw new RssAdapterError("RSS.com operation.kind must explicitly be create, replace, or update.", {
      code: "INVALID_INPUT",
    });
  }
  return {
    kind: supplied.kind === "update" ? "replace" : supplied.kind,
    requestedKind: supplied.kind,
    existingEpisodeId: supplied.existingEpisodeId ?? input.existingEpisodeId ?? null,
    expectedGuid: supplied.expectedGuid ?? input.expectedGuid ?? null,
    approvedBinding: supplied.approvedBinding ?? input.approvedBinding ?? null,
  };
}

function releaseSchedule(releasePlan, manifest, now) {
  if (!isObject(releasePlan)) {
    throw new RssAdapterError("The approved RSS.com release plan is missing.", { code: "INVALID_INPUT" });
  }
  const unresolved = ["license", "monetization", "notifications"]
    .filter((key) => releasePlan[key] === "not_selected");
  if (unresolved.length) {
    throw new RssAdapterError(`RSS.com release choices remain unresolved: ${unresolved.join(", ")}.`, {
      code: "UNSUPPORTED_RELEASE_CHOICE",
    });
  }
  if (
    releasePlan.license !== "not_applicable" ||
    releasePlan.monetization !== "not_applicable" ||
    releasePlan.notifications !== "not_applicable"
  ) {
    throw new RssAdapterError(
      "RSS.com licensing, monetization, and notifications must be explicitly not_applicable.",
      { code: "UNSUPPORTED_RELEASE_CHOICE" },
    );
  }
  if (!["hold", "publish_now", "scheduled"].includes(releasePlan.releaseMode)) {
    throw new RssAdapterError(`Unsupported RSS.com release mode: ${releasePlan.releaseMode}.`, {
      code: "UNSUPPORTED_RELEASE_CHOICE",
    });
  }
  if (releasePlan.initialVisibility !== "draft" || releasePlan.finalVisibility !== "public") {
    throw new RssAdapterError(
      "RSS.com requires approved initialVisibility draft and finalVisibility public.",
      { code: "UNSUPPORTED_RELEASE_CHOICE" },
    );
  }
  if (releasePlan.releaseMode === "hold") return { releaseMode: "hold", scheduleDatetime: null };
  if (releasePlan.releaseMode === "publish_now") {
    return { releaseMode: "publish_now", scheduleDatetime: new Date(now()).toISOString() };
  }
  const publishAt = requiredString(manifest.publishAt, "manifest.publishAt");
  const timestamp = Date.parse(publishAt);
  if (!Number.isFinite(timestamp)) {
    throw new RssAdapterError("manifest.publishAt must be a valid RFC 3339 date-time.", {
      code: "INVALID_INPUT",
    });
  }
  if (timestamp <= now()) {
    throw new RssAdapterError("A scheduled RSS.com release must be in the future.", {
      code: "UNSUPPORTED_RELEASE_CHOICE",
    });
  }
  return { releaseMode: "scheduled", scheduleDatetime: new Date(timestamp).toISOString() };
}

function assertReplacementBinding(plan, packet) {
  const { operation } = plan;
  operation.existingEpisodeId = numericId(operation.existingEpisodeId, "operation.existingEpisodeId");
  operation.expectedGuid = requiredString(operation.expectedGuid, "operation.expectedGuid");
  if (!isObject(operation.approvedBinding)) {
    throw new RssAdapterError("RSS.com replacement requires an approved exact-ID binding.", {
      code: "REPLACEMENT_BINDING_REQUIRED",
    });
  }
  const expected = {
    platformId: "rss.com",
    action: "replace_episode_audio",
    remoteId: operation.existingEpisodeId,
    destinationPodcastId: plan.podcastId,
    destinationSlug: plan.podcastSlug,
    assetSha256: plan.audio.sha256,
    approvalHash: packet?.approvalHash ?? null,
    episodeHash: packet?.snapshot?.catalogBinding?.episodeHash ?? null,
    rssGuid: operation.expectedGuid,
  };
  const mismatches = Object.entries(expected)
    .filter(([, value]) => value != null)
    .filter(([key, value]) => operation.approvedBinding[key] !== value)
    .map(([key]) => key);
  if (mismatches.length) {
    throw new RssAdapterError(`Approved RSS.com replacement binding does not match: ${mismatches.join(", ")}.`, {
      code: "REPLACEMENT_BINDING_MISMATCH",
    });
  }
  if (!SHA256.test(plan.audio.sha256 ?? "") || !SHA256.test(expected.approvalHash ?? "") ||
      !SHA256.test(expected.episodeHash ?? "")) {
    throw new RssAdapterError(
      "Replacement must bind the audio, approval, and catalog episode SHA-256 fingerprints.",
      { code: "REPLACEMENT_BINDING_REQUIRED" },
    );
  }
}

function normalizeInput(input, now) {
  if (!isObject(input)) {
    throw new RssAdapterError("RSS.com adapter input must be an object.", { code: "INVALID_INPUT" });
  }
  const packet = input.packet ?? null;
  const snapshot = input.snapshot ?? packet?.snapshot ?? null;
  const manifest = input.manifest ?? snapshot?.manifest;
  const assets = input.assets ?? snapshot?.assets;
  const target = input.target ?? snapshot?.targets?.find((candidate) => candidate?.id === "rss.com");
  if (!isObject(manifest) || !isObject(assets) || !isObject(target) || target.id !== "rss.com") {
    throw new RssAdapterError("The approved RSS.com manifest, assets, and target are required.", {
      code: "INVALID_INPUT",
    });
  }
  const podcastId = numericId(target.destinationIds?.accountId, "target.destinationIds.accountId");
  const podcastSlug = safeSlug(target.destinationIds?.containerId, "target.destinationIds.containerId");
  const audio = assetRecord(
    assets.podcastAudio,
    "assets.podcastAudio",
    new Set(["audio/aac", "audio/mp4", "audio/mpeg", "audio/opus"]),
  );
  if (target.assetSha256 && target.assetSha256 !== audio.sha256) {
    throw new RssAdapterError("The RSS.com target fingerprint does not match assets.podcastAudio.", {
      code: "INVALID_INPUT",
    });
  }
  const artworkValue = input.artwork ?? assets.podcastArtwork ?? assets.episodeArtwork ?? null;
  const artwork = artworkValue == null
    ? null
    : assetRecord(artworkValue, "RSS.com episode artwork", new Set(["image/jpeg", "image/png"]));
  const title = requiredString(manifest.title, "manifest.title");
  const description = requiredString(target.approvedCopy ?? manifest.description, "target.approvedCopy");
  if (title.length > 250) {
    throw new RssAdapterError("RSS.com episode titles cannot exceed 250 characters.", { code: "INVALID_INPUT" });
  }
  if (description.length > 4000) {
    throw new RssAdapterError("RSS.com episode descriptions cannot exceed 4,000 characters.", {
      code: "INVALID_INPUT",
    });
  }
  if (!Number.isSafeInteger(manifest.episodeNumber) || manifest.episodeNumber < 1) {
    throw new RssAdapterError("manifest.episodeNumber must be a positive integer.", { code: "INVALID_INPUT" });
  }
  if (typeof manifest.explicit !== "boolean") {
    throw new RssAdapterError("manifest.explicit must be explicitly true or false.", { code: "INVALID_INPUT" });
  }
  const operation = operationInput(input);
  const schedule = releaseSchedule(target.releasePlan, manifest, now);
  const customLink = manifest.customLink ?? manifest.episodeUrl ?? null;
  if (customLink != null) {
    let parsed;
    try { parsed = new URL(customLink); } catch { /* handled below */ }
    if (!parsed || !["http:", "https:"].includes(parsed.protocol) || customLink.length > 500) {
      throw new RssAdapterError("The RSS.com custom episode link must be an HTTP(S) URL of 500 characters or fewer.", {
        code: "INVALID_INPUT",
      });
    }
  }
  const plan = {
    audio,
    artwork,
    podcastId,
    podcastSlug,
    title,
    description,
    explicit: manifest.explicit,
    episodeNumber: manifest.episodeNumber,
    seasonNumber: Number.isSafeInteger(manifest.seasonNumber) && manifest.seasonNumber > 0
      ? manifest.seasonNumber
      : null,
    episodeType: manifest.episodeType ?? "full",
    aiContent: typeof manifest.containsSyntheticMedia === "boolean" ? manifest.containsSyntheticMedia : null,
    customLink,
    operation,
    ...schedule,
  };
  if (!["full", "trailer", "bonus"].includes(plan.episodeType)) {
    throw new RssAdapterError("manifest.episodeType must be full, trailer, or bonus.", { code: "INVALID_INPUT" });
  }
  if (operation.kind === "replace") assertReplacementBinding(plan, packet);
  else if (operation.existingEpisodeId != null || operation.expectedGuid != null || operation.approvedBinding != null) {
    throw new RssAdapterError("Create operations cannot carry an existing episode binding.", {
      code: "INVALID_INPUT",
    });
  }
  return plan;
}

function safeUploadUrl(value) {
  let parsed;
  try { parsed = new URL(value); } catch { /* handled below */ }
  if (!parsed || parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new RssAdapterError("RSS.com returned an unsafe presigned upload URL.", {
      code: "INVALID_PROVIDER_RESPONSE",
    });
  }
  return parsed.href;
}

function publicEpisode(body) {
  return {
    id: body?.id == null ? null : String(body.id),
    guid: typeof body?.guid === "string" ? body.guid : null,
    title: body?.title ?? null,
    description: body?.description ?? null,
    status: body?.status ?? null,
    audioUrl: body?.audio_url ?? null,
    audioPreviewUrl: body?.audio_preview_url ?? null,
    coverUrl: body?.cover_url ?? null,
    dashboardUrl: body?.dashboard_url ?? null,
    websiteUrl: body?.website_url ?? null,
    publishDatetime: body?.publish_datetime ?? null,
    scheduleDatetime: body?.schedule_datetime ?? null,
    itunesExplicit: body?.itunes_explicit ?? null,
    itunesEpisode: body?.itunes_episode ?? null,
    itunesSeason: body?.itunes_season ?? null,
    itunesEpisodeType: body?.itunes_episode_type ?? null,
    aiContent: body?.ai_content ?? null,
    processing: body?.processing?.transcode
      ? { transcode: { status: body.processing.transcode.status, details: body.processing.transcode.details ?? null } }
      : { transcode: { status: null, details: null } },
  };
}

function expectedStatus(plan, now) {
  if (plan.releaseMode === "hold") return "draft";
  if (plan.releaseMode === "scheduled" && Date.parse(plan.scheduleDatetime) > now()) return "scheduled";
  return "published";
}

function episodeProblems(plan, body, now) {
  const episode = publicEpisode(body);
  const problems = [];
  if (episode.id == null || !NUMERIC_ID.test(episode.id)) problems.push("episode ID");
  if (!episode.guid) problems.push("GUID");
  if (episode.title !== plan.title) problems.push("title");
  if (episode.description !== plan.description) problems.push("description");
  if (episode.itunesExplicit !== plan.explicit) problems.push("explicit flag");
  if (episode.itunesEpisode !== plan.episodeNumber) problems.push("episode number");
  if ((episode.itunesSeason ?? null) !== plan.seasonNumber) problems.push("season number");
  if (episode.itunesEpisodeType !== plan.episodeType) problems.push("episode type");
  if ((episode.aiContent ?? null) !== plan.aiContent) problems.push("AI content flag");
  if (episode.status !== expectedStatus(plan, now)) problems.push("release status");
  if (plan.operation.kind === "replace" && episode.guid !== plan.operation.expectedGuid) {
    problems.push("preserved GUID");
  }
  if (episode.status === "published" && !episode.audioUrl) problems.push("public audio URL");
  if (episode.status !== "published" && !episode.audioPreviewUrl && !episode.audioUrl) {
    problems.push("audio preview URL");
  }
  return { episode, problems };
}

export function createRssAdapter({
  fetchImpl = globalThis.fetch,
  fsImpl = fs,
  createReadStreamImpl = createReadStream,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  now = Date.now,
  env = process.env,
  homeDir = env.HOME || os.homedir(),
  apiKeyPath = env[RSS_API_KEY_PATH_ENV] || path.join(homeDir, ".config", "drm-publisher", "rss.com", "api-key"),
  apiBaseUrl = RSS_API_BASE_URL,
  expectedCredentialOwnerUid = typeof process.getuid === "function" ? process.getuid() : null,
  pollIntervalMs = 15_000,
  maxPolls = 240,
  assetStagingRoot,
  stageAssetImpl = stageApprovedAsset,
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl must be a function.");
  if (!isObject(fsImpl)) throw new TypeError("fsImpl must be an object.");
  if (typeof createReadStreamImpl !== "function") throw new TypeError("createReadStreamImpl must be a function.");
  if (typeof stageAssetImpl !== "function") throw new TypeError("stageAssetImpl must be a function.");
  if (typeof sleep !== "function" || typeof now !== "function") throw new TypeError("sleep and now must be functions.");
  if (!Number.isSafeInteger(maxPolls) || maxPolls < 1) throw new TypeError("maxPolls must be a positive integer.");
  const apiOrigin = new URL(apiBaseUrl);
  if (apiOrigin.protocol !== "https:" && !["127.0.0.1", "localhost"].includes(apiOrigin.hostname)) {
    throw new TypeError("apiBaseUrl must use HTTPS outside local tests.");
  }

  async function hashFile(filePath, size) {
    const hash = createHash("sha256");
    const handle = await fsImpl.open(filePath, "r");
    try {
      for (let offset = 0; offset < size;) {
        const length = Math.min(8 * 1024 * 1024, size - offset);
        const buffer = Buffer.allocUnsafe(length);
        const read = await handle.read(buffer, 0, length, offset);
        if (read.bytesRead !== length) {
          throw new RssAdapterError("An approved RSS.com asset ended before its expected size.", {
            code: "ASSET_CHANGED",
          });
        }
        hash.update(buffer.subarray(0, read.bytesRead));
        offset += read.bytesRead;
      }
    } finally {
      await handle.close();
    }
    return hash.digest("hex");
  }

  async function inspectAsset(asset, label, maxBytes) {
    let stats;
    try { stats = await fsImpl.stat(asset.path); } catch (cause) {
      throw new RssAdapterError(`${label} is not readable.`, { code: "ASSET_UNAVAILABLE", cause });
    }
    if ((typeof stats.isFile === "function" && !stats.isFile()) || !Number.isSafeInteger(stats.size) || stats.size < 1) {
      throw new RssAdapterError(`${label} must be a non-empty regular file.`, { code: "ASSET_UNAVAILABLE" });
    }
    if (stats.size > maxBytes) {
      throw new RssAdapterError(`${label} exceeds this publisher's guarded upload limit.`, {
        code: "ASSET_TOO_LARGE",
      });
    }
    if (asset.sizeBytes != null && stats.size !== asset.sizeBytes) {
      throw new RssAdapterError(`${label} size no longer matches the approved snapshot.`, { code: "ASSET_CHANGED" });
    }
    const sha256 = await hashFile(asset.path, stats.size);
    if (asset.sha256 != null && sha256 !== asset.sha256) {
      throw new RssAdapterError(`${label} SHA-256 no longer matches the approved snapshot.`, {
        code: "ASSET_CHANGED",
      });
    }
    return { sizeBytes: stats.size, sha256 };
  }

  async function localPlan(input) {
    const plan = normalizeInput(input, now);
    const audio = await inspectAsset(plan.audio, "assets.podcastAudio", MAX_AUDIO_BYTES);
    const artwork = plan.artwork
      ? await inspectAsset(plan.artwork, "RSS.com episode artwork", MAX_ARTWORK_BYTES)
      : null;
    return { plan, stats: { audio, artwork } };
  }

  async function stageUploadAsset(asset, stats, label) {
    let staged;
    try {
      staged = await stageAssetImpl(
        { path: asset.path, sha256: asset.sha256, sizeBytes: stats.sizeBytes },
        { fsImpl, env, homeDir, rootDir: assetStagingRoot },
      );
    } catch (cause) {
      const changed = cause instanceof AssetStagingError &&
        /(?:SOURCE|REUSE|HASH|BINDING)/.test(cause.code);
      throw new RssAdapterError(`${label} could not be staged from its approved fingerprint.`, {
        code: changed ? "ASSET_CHANGED" : "ASSET_STAGING_FAILED",
        cause,
      });
    }
    if (!isObject(staged) || typeof staged.path !== "string" ||
        staged.sha256 !== asset.sha256 || staged.sizeBytes !== stats.sizeBytes ||
        path.resolve(staged.path) === path.resolve(asset.path)) {
      throw new RssAdapterError(`${label} staging did not return the exact private content-addressed asset.`, {
        code: "ASSET_STAGING_FAILED",
      });
    }
    return {
      ...asset,
      path: staged.path,
      sourcePath: asset.path,
      staged: { reused: staged.reused === true, sha256: staged.sha256 },
    };
  }

  async function stagePlanAssets(plan, stats) {
    const audio = await stageUploadAsset(plan.audio, stats.audio, "assets.podcastAudio");
    const artwork = plan.artwork
      ? await stageUploadAsset(plan.artwork, stats.artwork, "RSS.com episode artwork")
      : null;
    return { ...plan, audio, artwork };
  }

  async function loadApiKey() {
    const environmentKey = typeof env[RSS_API_KEY_ENV] === "string" ? env[RSS_API_KEY_ENV].trim() : "";
    if (environmentKey) return { apiKey: environmentKey, source: "environment" };
    let stats;
    try { stats = await fsImpl.stat(apiKeyPath); } catch (cause) {
      throw new RssAdapterError(
        `RSS.com API key is unavailable. Set ${RSS_API_KEY_ENV} or create the private API-key file.`,
        { code: "AUTH_REQUIRED", cause },
      );
    }
    if ((typeof stats.isFile === "function" && !stats.isFile()) || (stats.mode & 0o077) !== 0) {
      throw new RssAdapterError("The RSS.com API-key file must be a regular mode-0600 owner-only file.", {
        code: "INSECURE_CREDENTIAL_FILE",
      });
    }
    if (Number.isInteger(expectedCredentialOwnerUid) && Number.isInteger(stats.uid) &&
        stats.uid !== expectedCredentialOwnerUid) {
      throw new RssAdapterError("The RSS.com API-key file is not owned by the publisher process user.", {
        code: "INSECURE_CREDENTIAL_FILE",
      });
    }
    let apiKey;
    try { apiKey = (await fsImpl.readFile(apiKeyPath, "utf8")).trim(); } catch (cause) {
      throw new RssAdapterError("The RSS.com API-key file could not be read.", { code: "AUTH_REQUIRED", cause });
    }
    if (!apiKey) throw new RssAdapterError("The RSS.com API-key file is empty.", { code: "AUTH_REQUIRED" });
    return { apiKey, source: "file" };
  }

  async function parseResponse(response) {
    const text = await response.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch { return { message: text.slice(0, 500) }; }
  }

  async function apiRequest({ apiKey, method, uri, body, expected }) {
    const url = new URL(uri, apiOrigin);
    const headers = { Accept: "application/json", "X-Api-Key": apiKey };
    const init = { method, headers };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    let response;
    try { response = await fetchImpl(url.href, init); } catch (cause) {
      throw new RssAdapterError(`RSS.com ${method} ${url.pathname} failed before a response.`, {
        code: "NETWORK_ERROR", cause, retryable: true,
      });
    }
    const parsed = await parseResponse(response);
    if (!response.ok || !expected.includes(response.status)) {
      const providerMessage = typeof parsed?.message === "string"
        ? parsed.message.replaceAll(apiKey, "[redacted]").slice(0, 300)
        : null;
      const suffix = providerMessage ? `: ${providerMessage}` : ".";
      const common = { status: response.status, retryable: TRANSIENT_STATUS.has(response.status) };
      if (response.status === 402 || response.status === 403) {
        throw new RssAdapterError(
          `RSS.com API access is unavailable for this account or plan (HTTP ${response.status})${suffix}`,
          { ...common, code: "API_PLAN_UNAVAILABLE" },
        );
      }
      if (response.status === 401) {
        throw new RssAdapterError(`RSS.com rejected the configured API key (HTTP 401)${suffix}`, {
          ...common, code: "AUTH_REJECTED",
        });
      }
      throw new RssAdapterError(`RSS.com ${method} ${url.pathname} returned HTTP ${response.status}${suffix}`, {
        ...common, code: "PROVIDER_ERROR",
      });
    }
    return parsed;
  }

  async function verifyPodcast(plan, apiKey) {
    const body = await apiRequest({
      apiKey,
      method: "GET",
      uri: `/v4/podcasts/${plan.podcastId}`,
      expected: [200],
    });
    const actualId = body?.id == null ? null : String(body.id);
    const actualSlug = typeof body?.slug === "string" ? body.slug : null;
    if (actualId !== plan.podcastId || actualSlug !== plan.podcastSlug) {
      throw new RssAdapterError(
        `RSS.com podcast binding mismatch: expected ${plan.podcastId}/${plan.podcastSlug}, received ${actualId ?? "missing"}/${actualSlug ?? "missing"}.`,
        { code: "PODCAST_MISMATCH" },
      );
    }
    if (body.hibernated === true) {
      throw new RssAdapterError("The bound RSS.com podcast is hibernated and cannot accept a release.", {
        code: "API_PLAN_UNAVAILABLE",
      });
    }
    return {
      id: actualId,
      slug: actualSlug,
      title: body.title ?? null,
      role: body.role ?? null,
      hibernated: body.hibernated ?? null,
      feedUrl: body.feed_url ?? null,
    };
  }

  async function verifyExisting(plan, apiKey) {
    const body = await apiRequest({
      apiKey,
      method: "GET",
      uri: `/v4/podcasts/${plan.podcastId}/episodes/${plan.operation.existingEpisodeId}`,
      expected: [200],
    });
    const episode = publicEpisode(body);
    if (episode.id !== plan.operation.existingEpisodeId || episode.guid !== plan.operation.expectedGuid) {
      throw new RssAdapterError("The existing RSS.com episode ID/GUID does not match the approved replacement binding.", {
        code: "EPISODE_MISMATCH",
      });
    }
    return episode;
  }

  async function createPresignedUpload(plan, apiKey, assetType, asset) {
    const body = await apiRequest({
      apiKey,
      method: "POST",
      uri: `/v4/podcasts/${plan.podcastId}/assets/presigned-uploads`,
      body: {
        asset_type: assetType,
        expected_mime: asset.mimeType,
        filename: path.basename(asset.sourcePath ?? asset.path),
      },
      expected: [201],
    });
    const uploadId = requiredString(body?.id, "RSS.com presigned upload id");
    const uploadUrl = safeUploadUrl(body?.url);
    if (body.asset_type !== assetType || body.expected_mime !== asset.mimeType) {
      throw new RssAdapterError("RSS.com returned a presigned upload with mismatched type or MIME.", {
        code: "INVALID_PROVIDER_RESPONSE",
      });
    }
    return { id: uploadId, url: uploadUrl, assetType, mimeType: asset.mimeType };
  }

  async function uploadPresigned(upload, asset, stats) {
    const stream = createReadStreamImpl(asset.path);
    let response;
    try {
      response = await fetchImpl(upload.url, {
        method: "PUT",
        headers: { "Content-Type": asset.mimeType, "Content-Length": String(stats.sizeBytes) },
        body: stream,
        duplex: "half",
      });
    } catch (cause) {
      if (typeof stream?.destroy === "function") stream.destroy();
      throw new RssAdapterError(`The RSS.com ${upload.assetType} upload failed before a response.`, {
        code: "UPLOAD_ERROR", cause, retryable: true,
      });
    }
    if (!response.ok) {
      throw new RssAdapterError(`The RSS.com ${upload.assetType} upload returned HTTP ${response.status}.`, {
        code: "UPLOAD_ERROR", status: response.status, retryable: TRANSIENT_STATUS.has(response.status),
      });
    }
    return { id: upload.id, assetType: upload.assetType, mimeType: asset.mimeType, sizeBytes: stats.sizeBytes };
  }

  function episodePayload(plan, uploads) {
    const body = {
      title: plan.title,
      description: plan.description,
      itunes_explicit: plan.explicit,
      itunes_episode: plan.episodeNumber,
      itunes_season: plan.seasonNumber,
      itunes_episode_type: plan.episodeType,
      custom_link: plan.customLink,
      schedule_datetime: plan.scheduleDatetime,
      apple_episode_access_type: "PUBLIC",
      ai_content: plan.aiContent,
      audio_upload_id: uploads.audio.id,
    };
    if (uploads.artwork) body.cover_upload_id = uploads.artwork.id;
    return body;
  }

  async function waitForVerification(plan, apiKey, episodeId) {
    let last = null;
    for (let poll = 1; poll <= maxPolls; poll += 1) {
      last = await apiRequest({
        apiKey,
        method: "GET",
        uri: `/v4/podcasts/${plan.podcastId}/episodes/${episodeId}`,
        expected: [200],
      });
      const status = last?.processing?.transcode?.status;
      if (status === PROCESSING_FAILED) {
        throw new RssAdapterError("RSS.com reported an audio transcode failure.", {
          code: "PROCESSING_FAILED",
        });
      }
      const result = episodeProblems(plan, last, now);
      if (status === PROCESSING_DONE && result.problems.length === 0) {
        return { ...result, polls: poll };
      }
      if (poll < maxPolls) await sleep(pollIntervalMs);
    }
    const result = episodeProblems(plan, last, now);
    throw new RssAdapterError(
      `RSS.com readback did not converge after ${maxPolls} polls: ${result.problems.join(", ") || "transcode incomplete"}.`,
      { code: "VERIFICATION_TIMEOUT", retryable: true },
    );
  }

  async function dryRun(input) {
    const { plan, stats } = await localPlan(input);
    return {
      schemaVersion: 1,
      platform: "rss.com",
      apiVersion: RSS_API_VERSION,
      mode: "dry_run",
      writes: false,
      operation: plan.operation.kind,
      podcast: { expectedId: plan.podcastId, expectedSlug: plan.podcastSlug },
      asset: { role: "podcastAudio", ...stats.audio, mimeType: plan.audio.mimeType },
      artwork: plan.artwork
        ? { supplied: true, ...stats.artwork, mimeType: plan.artwork.mimeType }
        : { supplied: false },
      episode: {
        title: plan.title,
        description: plan.description,
        itunesExplicit: plan.explicit,
        itunesEpisode: plan.episodeNumber,
        itunesSeason: plan.seasonNumber,
        itunesEpisodeType: plan.episodeType,
        aiContent: plan.aiContent,
        releaseMode: plan.releaseMode,
        scheduleDatetime: plan.scheduleDatetime,
      },
      replacement: plan.operation.kind === "replace"
        ? { existingEpisodeId: plan.operation.existingEpisodeId, expectedGuid: plan.operation.expectedGuid, bindingVerified: true }
        : null,
      workflow: [
        "GET exact podcast ID and verify permanent slug",
        ...(plan.operation.kind === "replace" ? ["GET exact episode ID and verify preserved GUID"] : []),
        "request presigned audio upload and upload approved bytes",
        ...(plan.artwork ? ["request presigned artwork upload and upload approved bytes"] : []),
        `${plan.operation.kind === "replace" ? "PATCH exact episode ID" : "POST new episode"} with approved metadata and upload IDs`,
        "poll processing and verify exact episode readback",
      ],
    };
  }

  async function preflight(input) {
    const { plan, stats } = await localPlan(input);
    const credentials = await loadApiKey();
    const podcast = await verifyPodcast(plan, credentials.apiKey);
    const existingEpisode = plan.operation.kind === "replace"
      ? await verifyExisting(plan, credentials.apiKey)
      : null;
    return {
      schemaVersion: 1,
      platform: "rss.com",
      writes: false,
      ready: true,
      credentials: { source: credentials.source },
      podcast: { ...podcast, matched: true },
      existingEpisode,
      asset: { role: "podcastAudio", ...stats.audio, mimeType: plan.audio.mimeType },
      artwork: plan.artwork ? { supplied: true, ...stats.artwork, mimeType: plan.artwork.mimeType } : { supplied: false },
    };
  }

  function requireLifecycle(lifecycle) {
    if (
      !isObject(lifecycle) ||
      typeof lifecycle.beforeWrite !== "function" ||
      typeof lifecycle.onCheckpoint !== "function"
    ) {
      throw new RssAdapterError(
        "RSS.com publishing requires the controller's durable lifecycle callbacks.",
        { code: "CHECKPOINT_PROTOCOL_REQUIRED" },
      );
    }
    return lifecycle;
  }

  function initialCheckpoint(plan) {
    return {
      schemaVersion: 1,
      phase: "prepared",
      operation: plan.operation.kind,
      podcastId: plan.podcastId,
      audioSha256: plan.audio.sha256,
      artworkSha256: plan.artwork?.sha256 || null,
      audio: null,
      artwork: null,
      episode: null,
    };
  }

  function resumeCheckpoint(value, plan) {
    if (!isObject(value)) {
      throw new RssAdapterError("RSS.com reconciliation requires a durable provider checkpoint.", {
        code: "RECONCILIATION_CHECKPOINT_REQUIRED",
      });
    }
    const expected = initialCheckpoint(plan);
    if (
      value.schemaVersion !== 1 ||
      typeof value.phase !== "string" ||
      value.operation !== expected.operation ||
      value.podcastId !== expected.podcastId ||
      value.audioSha256 !== expected.audioSha256 ||
      value.artworkSha256 !== expected.artworkSha256
    ) {
      throw new RssAdapterError("RSS.com provider checkpoint does not match the approved operation.", {
        code: "RECONCILIATION_CHECKPOINT_MISMATCH",
      });
    }
    const checkpoint = structuredClone(value);
    for (const role of ["audio", "artwork"]) {
      const upload = checkpoint[role];
      if (upload == null) continue;
      if (!isObject(upload) || typeof upload.id !== "string" || !upload.id.trim() || typeof upload.url !== "string") {
        throw new RssAdapterError(`RSS.com ${role} checkpoint is invalid.`, {
          code: "RECONCILIATION_CHECKPOINT_INVALID",
        });
      }
      upload.url = safeUploadUrl(upload.url);
      if (typeof upload.uploaded !== "boolean") {
        throw new RssAdapterError(`RSS.com ${role} upload state is invalid.`, {
          code: "RECONCILIATION_CHECKPOINT_INVALID",
        });
      }
    }
    if (checkpoint.episode != null) {
      if (!isObject(checkpoint.episode)) {
        throw new RssAdapterError("RSS.com episode checkpoint is invalid.", {
          code: "RECONCILIATION_CHECKPOINT_INVALID",
        });
      }
      checkpoint.episode.id = numericId(checkpoint.episode.id, "RSS.com checkpoint episode id");
      if (checkpoint.episode.guid != null && typeof checkpoint.episode.guid !== "string") {
        throw new RssAdapterError("RSS.com checkpoint episode GUID is invalid.", {
          code: "RECONCILIATION_CHECKPOINT_INVALID",
        });
      }
    }
    return checkpoint;
  }

  async function execute(input, lifecycleInput, { resume = false } = {}) {
    const lifecycle = requireLifecycle(lifecycleInput);
    const local = await localPlan(input);
    let { plan } = local;
    const { stats } = local;
    const credentials = await loadApiKey();
    let remoteWrites = 0;
    let episodeWriteAttempted = false;
    let episodeId = plan.operation.kind === "replace" ? plan.operation.existingEpisodeId : null;
    let podcast;
    let before;
    let audio;
    let artwork;
    let verified;
    let checkpoint = resume
      ? resumeCheckpoint(lifecycle.checkpoint, plan)
      : initialCheckpoint(plan);
    const saveCheckpoint = async (
      next,
      { providerAccepted = false, remoteId = null, remoteUrl = null, providerSummary = null } = {},
    ) => {
      checkpoint = structuredClone(next);
      await lifecycle.onCheckpoint({
        checkpoint,
        providerAccepted,
        remoteId,
        remoteUrl,
        providerSummary,
      });
    };
    const ensureUpload = async (role, asset, assetStats) => {
      if (!asset) return null;
      let upload = checkpoint[role];
      if (!upload) {
        await saveCheckpoint({ ...checkpoint, phase: `${role}_session_intent` });
        await lifecycle.beforeWrite({ step: `create_${role}_upload_session` });
        const session = await createPresignedUpload(plan, credentials.apiKey, role === "audio" ? "audio" : "image", asset);
        remoteWrites += 1;
        upload = {
          ...session,
          sizeBytes: assetStats.sizeBytes,
          uploaded: false,
        };
        await saveCheckpoint({ ...checkpoint, phase: `${role}_session_created`, [role]: upload });
      }
      if (!upload.uploaded) {
        await lifecycle.beforeWrite({ step: `upload_${role}_bytes` });
        const uploaded = await uploadPresigned(upload, asset, assetStats);
        remoteWrites += 1;
        upload = { ...upload, ...uploaded, uploaded: true };
        await saveCheckpoint({ ...checkpoint, phase: `${role}_uploaded`, [role]: upload });
      }
      return {
        id: upload.id,
        assetType: upload.assetType,
        mimeType: upload.mimeType,
        sizeBytes: upload.sizeBytes,
      };
    };
    try {
      podcast = await verifyPodcast(plan, credentials.apiKey);
      before = plan.operation.kind === "replace"
        ? await verifyExisting(plan, credentials.apiKey)
        : null;
      plan = await stagePlanAssets(plan, stats);
      audio = await ensureUpload("audio", plan.audio, stats.audio);
      artwork = await ensureUpload("artwork", plan.artwork, stats.artwork);
      const payload = episodePayload(plan, { audio, artwork });
      const uri = plan.operation.kind === "replace"
        ? `/v4/podcasts/${plan.podcastId}/episodes/${plan.operation.existingEpisodeId}`
        : `/v4/podcasts/${plan.podcastId}/episodes`;
      if (!checkpoint.episode) {
        if (resume && checkpoint.phase === "episode_write_intent" && plan.operation.kind === "create") {
          throw new RssAdapterError(
            "RSS.com create response is ambiguous and no episode ID was durably checkpointed; a second episode POST is blocked.",
            { code: "AMBIGUOUS_EPISODE_CREATE" },
          );
        }
        await saveCheckpoint({ ...checkpoint, phase: "episode_write_intent" });
        await lifecycle.beforeWrite({ step: plan.operation.kind === "replace" ? "replace_exact_episode" : "create_episode" });
        episodeWriteAttempted = true;
        const created = await apiRequest({
          apiKey: credentials.apiKey,
          method: plan.operation.kind === "replace" ? "PATCH" : "POST",
          uri,
          body: payload,
          expected: [plan.operation.kind === "replace" ? 200 : 201],
        });
        remoteWrites += 1;
        episodeId = numericId(created?.id, "RSS.com episode response id");
        if (plan.operation.kind === "replace" && episodeId !== plan.operation.existingEpisodeId) {
          throw new RssAdapterError("RSS.com replacement returned a different episode ID.", {
            code: "INVALID_PROVIDER_RESPONSE",
          });
        }
        if (plan.operation.kind === "replace" && created?.guid !== plan.operation.expectedGuid) {
          throw new RssAdapterError("RSS.com replacement changed the episode GUID.", { code: "GUID_CHANGED" });
        }
        const accepted = publicEpisode(created);
        const remoteUrl = accepted.websiteUrl || `https://rss.com/podcasts/${plan.podcastSlug}/${episodeId}/`;
        await saveCheckpoint(
          {
            ...checkpoint,
            phase: "episode_accepted",
            episode: { id: episodeId, guid: accepted.guid, url: remoteUrl },
          },
          {
            providerAccepted: true,
            remoteId: episodeId,
            remoteUrl,
            providerSummary: `RSS.com accepted episode ${episodeId} in podcast ${plan.podcastId}.`,
          },
        );
      } else {
        episodeId = checkpoint.episode.id;
      }
      verified = await waitForVerification(plan, credentials.apiKey, episodeId);
      await saveCheckpoint(
        {
          ...checkpoint,
          phase: "verified",
          episode: {
            id: episodeId,
            guid: verified.episode.guid,
            url: verified.episode.websiteUrl || checkpoint.episode?.url || null,
          },
        },
        {
          providerAccepted: true,
          remoteId: episodeId,
          remoteUrl: verified.episode.websiteUrl || checkpoint.episode?.url || null,
          providerSummary: `RSS.com retained episode ${episodeId} while processing completed.`,
        },
      );
    } catch (error) {
      if (error instanceof RssAdapterError) {
        error.evidence = {
          remoteWrites,
          episodeWriteAttempted,
          operation: plan.operation.kind,
          podcastId: plan.podcastId,
          existingEpisodeId: plan.operation.existingEpisodeId,
          knownEpisodeId: episodeId,
        };
      }
      throw error;
    }
    return {
      schemaVersion: 1,
      platform: "rss.com",
      apiVersion: RSS_API_VERSION,
      outcome: "verified",
      writes: true,
      operation: plan.operation.kind,
      operationId: `rss.com:${plan.operation.kind}:${plan.podcastId}:${episodeId}`,
      credentials: { source: credentials.source },
      podcast: { ...podcast, matched: true },
      before,
      remote: verified.episode,
      uploads: {
        audio,
        artwork,
        presignedUrlsRedacted: true,
      },
      verification: {
        metadataMatched: true,
        podcastBindingMatched: true,
        guidPreserved: plan.operation.kind === "replace" ? verified.episode.guid === plan.operation.expectedGuid : null,
        processingStatus: verified.episode.processing.transcode.status,
        polls: verified.polls,
      },
      evidence: [
        { kind: "podcast_binding", value: "matched", details: { id: plan.podcastId, slug: plan.podcastSlug } },
        { kind: "audio_upload", value: "accepted", details: { uploadId: audio.id, sizeBytes: audio.sizeBytes, sha256: stats.audio.sha256 } },
        ...(artwork ? [{ kind: "artwork_upload", value: "accepted", details: { uploadId: artwork.id, sizeBytes: artwork.sizeBytes, sha256: stats.artwork.sha256 } }] : []),
        { kind: "episode_readback", value: "verified", details: { id: episodeId, guid: verified.episode.guid, status: verified.episode.status } },
      ],
    };
  }

  async function publish(input, lifecycle) {
    if (lifecycle?.checkpoint != null) {
      throw new RssAdapterError("RSS.com publish cannot start with an existing provider checkpoint.", {
        code: "CHECKPOINT_ALREADY_EXISTS",
      });
    }
    return execute(input, lifecycle, { resume: false });
  }

  async function reconcile(input, lifecycle) {
    return execute(input, lifecycle, { resume: true });
  }

  return Object.freeze({ checkpointProtocolVersion: 1, dryRun, preflight, publish, reconcile });
}
