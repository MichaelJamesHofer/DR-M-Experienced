import { createHash, randomUUID as nodeRandomUUID } from "node:crypto";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AssetStagingError, stageApprovedAsset } from "../asset-staging.mjs";
import { SecureCredentialError, readSecureCredentialText } from "../secure-credential.mjs";

const YOUTUBE_API_ROOT = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_UPLOAD_ROOT = "https://www.googleapis.com/upload/youtube/v3";
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
const YOUTUBE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload";
const YOUTUBE_FULL_SCOPE = "https://www.googleapis.com/auth/youtube";
const MIN_CHUNK_SIZE = 256 * 1024;
const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;
const TOKEN_REFRESH_SKEW_MS = 60_000;
const TRANSIENT_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const CHECKPOINT_PHASES = new Set([
  "session_created",
  "uploading",
  "video_created",
  "thumbnail_set",
  "processing",
  "verified",
]);

export const YOUTUBE_CREDENTIAL_ENV = Object.freeze({
  clientSecretPath: "DRM_YOUTUBE_CLIENT_SECRET_PATH",
  tokenPath: "DRM_YOUTUBE_TOKEN_PATH",
});

export const DEFAULT_YOUTUBE_CREDENTIAL_PATHS = Object.freeze({
  clientSecretPath: path.join(os.homedir(), ".config", "drm-publisher", "youtube", "client_secret.json"),
  tokenPath: path.join(os.homedir(), ".config", "drm-publisher", "youtube", "token.json"),
});

export class YouTubeAdapterError extends Error {
  constructor(code, message, evidence = null, { retryable = false } = {}) {
    super(message);
    this.name = "YouTubeAdapterError";
    this.code = code;
    this.evidence = evidence;
    if (retryable) this.retryable = true;
  }
}

function cleanString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function expandHome(filePath, homeDirectory) {
  if (filePath === "~") return homeDirectory;
  if (filePath?.startsWith("~/")) return path.join(homeDirectory, filePath.slice(2));
  return filePath;
}

export function resolveYouTubeCredentialPaths({ env = process.env, homeDirectory = os.homedir() } = {}) {
  const defaultDirectory = path.join(homeDirectory, ".config", "drm-publisher", "youtube");
  return {
    clientSecretPath: path.resolve(
      expandHome(env[YOUTUBE_CREDENTIAL_ENV.clientSecretPath] || path.join(defaultDirectory, "client_secret.json"), homeDirectory)
    ),
    tokenPath: path.resolve(
      expandHome(env[YOUTUBE_CREDENTIAL_ENV.tokenPath] || path.join(defaultDirectory, "token.json"), homeDirectory)
    ),
  };
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

function isoTime(now) {
  return new Date(now()).toISOString();
}

async function readJsonFile(fs, filePath, label) {
  let text;
  try {
    text = await readSecureCredentialText(filePath, { fsImpl: fs });
  } catch (error) {
    if (error instanceof SecureCredentialError && error.code === "credential_missing") {
      throw new YouTubeAdapterError("credentials_missing", `${label} was not found at ${filePath}.`);
    }
    if (error instanceof SecureCredentialError && error.code !== "credential_unreadable") {
      throw new YouTubeAdapterError(
        "credentials_insecure",
        `${label} must be a non-symlink regular file owned by the current user with mode 0600 at ${filePath}.`,
      );
    }
    throw new YouTubeAdapterError("credentials_unreadable", `${label} could not be read at ${filePath}.`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new YouTubeAdapterError("credentials_invalid", `${label} is not valid JSON at ${filePath}.`);
  }
}

async function writePrivateJsonAtomic(fs, filePath, value, randomUUID) {
  const directory = path.dirname(filePath);
  const tempPath = path.join(directory, `.${path.basename(filePath)}.${randomUUID()}.tmp`);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.chmod(directory, 0o700);
  try {
    await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await fs.chmod(tempPath, 0o600);
    await fs.rename(tempPath, filePath);
    await fs.chmod(filePath, 0o600);
  } catch (error) {
    await fs.unlink(tempPath).catch(() => {});
    throw error;
  }
}

function parseOAuthClient(document) {
  const client = document?.installed ?? document?.web;
  const clientId = cleanString(client?.client_id);
  const clientSecret = cleanString(client?.client_secret);
  const tokenUri = cleanString(client?.token_uri) ?? DEFAULT_TOKEN_URI;
  if (!clientId || !clientSecret) {
    throw new YouTubeAdapterError(
      "oauth_client_invalid",
      "The YouTube OAuth client file must contain an installed or web client_id and client_secret."
    );
  }
  let parsedTokenUri;
  try {
    parsedTokenUri = new URL(tokenUri);
  } catch {
    throw new YouTubeAdapterError("oauth_client_invalid", "The OAuth token URI is invalid.");
  }
  if (parsedTokenUri.protocol !== "https:") {
    throw new YouTubeAdapterError("oauth_client_invalid", "The OAuth token URI must use HTTPS.");
  }
  if (!new Set(["oauth2.googleapis.com", "www.googleapis.com"]).has(parsedTokenUri.hostname)) {
    throw new YouTubeAdapterError("oauth_client_invalid", "The OAuth token URI must be an official Google endpoint.");
  }
  return { clientId, clientSecret, tokenUri: parsedTokenUri.toString() };
}

function tokenExpiresAt(token) {
  for (const candidate of [token?.expiry_date, token?.expires_at, token?.expiresAt]) {
    if (Number.isFinite(Number(candidate))) return Number(candidate);
  }
  return null;
}

function tokenScopes(token) {
  if (Array.isArray(token?.scope)) return token.scope.filter((scope) => typeof scope === "string");
  if (typeof token?.scope === "string") return token.scope.split(/\s+/).filter(Boolean);
  return [];
}

function assertUploadScope(token) {
  const scopes = tokenScopes(token);
  if (scopes.length && !scopes.includes(YOUTUBE_UPLOAD_SCOPE) && !scopes.includes(YOUTUBE_FULL_SCOPE)) {
    throw new YouTubeAdapterError(
      "oauth_scope_missing",
      "The stored OAuth grant does not include a YouTube upload scope. Reauthorize the local client."
    );
  }
}

function createCredentialManager({ fs, fetch, now, randomUUID, credentialPaths }) {
  let cachedClient = null;
  let cachedToken = null;

  async function loadClient() {
    if (!cachedClient) {
      cachedClient = parseOAuthClient(
        await readJsonFile(fs, credentialPaths.clientSecretPath, "YouTube OAuth client credentials")
      );
    }
    return cachedClient;
  }

  async function loadToken() {
    if (!cachedToken) {
      cachedToken = await readJsonFile(fs, credentialPaths.tokenPath, "YouTube OAuth token");
    }
    assertUploadScope(cachedToken);
    return cachedToken;
  }

  async function refreshToken(previousToken) {
    const refreshTokenValue = cleanString(previousToken?.refresh_token);
    if (!refreshTokenValue) {
      throw new YouTubeAdapterError(
        "oauth_refresh_unavailable",
        "The YouTube OAuth token is expired and does not contain a refresh token. Reauthorize the local client."
      );
    }
    const client = await loadClient();
    const body = new URLSearchParams({
      client_id: client.clientId,
      client_secret: client.clientSecret,
      refresh_token: refreshTokenValue,
      grant_type: "refresh_token",
    });
    let response;
    try {
      response = await fetch(client.tokenUri, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      });
    } catch {
      throw new YouTubeAdapterError("oauth_refresh_failed", "The YouTube OAuth token refresh request failed.");
    }
    if (!response.ok) {
      throw new YouTubeAdapterError(
        "oauth_refresh_failed",
        `The YouTube OAuth token refresh request failed with HTTP ${response.status}.`
      );
    }
    let refreshed;
    try {
      refreshed = await response.json();
    } catch {
      throw new YouTubeAdapterError("oauth_refresh_failed", "The YouTube OAuth refresh response was invalid.");
    }
    const accessToken = cleanString(refreshed?.access_token);
    if (!accessToken) {
      throw new YouTubeAdapterError("oauth_refresh_failed", "The YouTube OAuth refresh response had no access token.");
    }
    const expiresIn = Number(refreshed.expires_in);
    cachedToken = {
      ...previousToken,
      ...refreshed,
      access_token: accessToken,
      refresh_token: cleanString(refreshed.refresh_token) ?? refreshTokenValue,
      expiry_date: Number.isFinite(expiresIn) ? now() + expiresIn * 1000 : previousToken.expiry_date,
    };
    assertUploadScope(cachedToken);
    try {
      await writePrivateJsonAtomic(fs, credentialPaths.tokenPath, cachedToken, randomUUID);
    } catch {
      throw new YouTubeAdapterError(
        "oauth_token_persist_failed",
        "The refreshed YouTube OAuth token could not be saved securely."
      );
    }
    return cachedToken;
  }

  async function accessToken({ forceRefresh = false } = {}) {
    // Validate both credential artifacts during every fresh adapter session so
    // preflight cannot pass with an unusable refresh configuration.
    await loadClient();
    const token = await loadToken();
    const expiresAt = tokenExpiresAt(token);
    const expired = expiresAt !== null && expiresAt <= now() + TOKEN_REFRESH_SKEW_MS;
    if (forceRefresh || !cleanString(token.access_token) || expired) {
      return (await refreshToken(token)).access_token;
    }
    return token.access_token;
  }

  return { accessToken };
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function apiErrorMessage(operation, response, document) {
  const reason = cleanString(document?.error?.errors?.[0]?.reason);
  const suffix = reason ? ` (${reason})` : "";
  return `${operation} failed with HTTP ${response.status}${suffix}.`;
}

function isGoogleUploadUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "googleapis.com" || url.hostname.endsWith(".googleapis.com"));
  } catch {
    return false;
  }
}

function targetChannelId(target) {
  const channelId = cleanString(target?.destinationIds?.accountId);
  if (!channelId) {
    throw new YouTubeAdapterError(
      "target_channel_missing",
      "YouTube target.destinationIds.accountId is required before authorization or upload."
    );
  }
  if (!/^UC[A-Za-z0-9_-]{20,}$/.test(channelId)) {
    throw new YouTubeAdapterError(
      "target_channel_invalid",
      "YouTube target.destinationIds.accountId is not a valid channel ID."
    );
  }
  return channelId;
}

function mimeTypeFor(filePath, kind, supplied) {
  if (cleanString(supplied)) {
    const normalized = supplied.trim().toLowerCase();
    const allowed =
      kind === "thumbnail"
        ? new Set(["image/jpeg", "image/png"])
        : new Set(["video/mp4", "video/quicktime", "video/webm", "video/x-matroska"]);
    return allowed.has(normalized) ? normalized : null;
  }
  const extension = path.extname(filePath).toLowerCase();
  const mappings =
    kind === "thumbnail"
      ? { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" }
      : { ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm", ".mkv": "video/x-matroska" };
  return mappings[extension] ?? null;
}

async function readExact(fileHandle, length, position) {
  const buffer = Buffer.allocUnsafe(length);
  let filled = 0;
  while (filled < length) {
    const result = await fileHandle.read(buffer, filled, length - filled, position + filled);
    if (!result.bytesRead) throw new YouTubeAdapterError("asset_read_failed", "The video file ended unexpectedly.");
    filled += result.bytesRead;
  }
  return buffer;
}

async function inspectAsset(fs, filePath, kind, suppliedMimeType) {
  if (!cleanString(filePath)) {
    throw new YouTubeAdapterError("asset_missing", `A ${kind} path is required.`);
  }
  const absolutePath = path.resolve(filePath);
  let stats;
  try {
    stats = await fs.stat(absolutePath);
  } catch {
    throw new YouTubeAdapterError("asset_missing", `The ${kind} file was not found at ${absolutePath}.`);
  }
  if (!stats.isFile() || stats.size <= 0) {
    throw new YouTubeAdapterError("asset_invalid", `The ${kind} path must identify a non-empty regular file.`);
  }
  if (kind === "thumbnail" && stats.size > MAX_THUMBNAIL_BYTES) {
    throw new YouTubeAdapterError("thumbnail_too_large", "The YouTube thumbnail exceeds the 2 MiB API limit.");
  }
  const mimeType = mimeTypeFor(absolutePath, kind, suppliedMimeType);
  if (!mimeType) {
    throw new YouTubeAdapterError("asset_mime_unknown", `The ${kind} MIME type could not be determined.`);
  }
  const hash = createHash("sha256");
  const handle = await fs.open(absolutePath, "r");
  try {
    for (let position = 0; position < stats.size; position += DEFAULT_CHUNK_SIZE) {
      const length = Math.min(DEFAULT_CHUNK_SIZE, stats.size - position);
      hash.update(await readExact(handle, length, position));
    }
  } finally {
    await handle.close();
  }
  return { path: absolutePath, sizeBytes: stats.size, mimeType, sha256: hash.digest("hex") };
}

function normalizeTags(tags) {
  if (tags === undefined) return [];
  if (!Array.isArray(tags) || tags.some((tag) => !cleanString(tag))) {
    throw new YouTubeAdapterError("metadata_invalid", "YouTube tags must be non-empty strings.");
  }
  const normalized = [...new Set(tags.map((tag) => tag.trim()))];
  if (normalized.join(",").length > 500) {
    throw new YouTubeAdapterError("metadata_invalid", "YouTube tags exceed the combined 500-character limit.");
  }
  return normalized;
}

function assertVisibilityCapability(status, publishAt, capability, now) {
  const nonPrivate = status !== "private";
  const scheduled = Boolean(publishAt);
  if (!nonPrivate && !scheduled) return null;
  const authorizationId = cleanString(capability?.authorizationId);
  const allowedStatuses = Array.isArray(capability?.allowedPrivacyStatuses)
    ? capability.allowedPrivacyStatuses
    : [];
  const expiry = capability?.expiresAt ? Date.parse(capability.expiresAt) : null;
  if (
    capability?.enabled !== true ||
    !authorizationId ||
    (nonPrivate && !allowedStatuses.includes(status)) ||
    (scheduled && capability?.allowScheduledPublic !== true) ||
    (expiry !== null && (!Number.isFinite(expiry) || expiry <= now()))
  ) {
    throw new YouTubeAdapterError(
      "visibility_not_authorized",
      "YouTube uploads are private-only unless a valid scoped visibility authorization explicitly permits this status."
    );
  }
  return authorizationId;
}

function normalizePublication(publication, capability, now) {
  const title = cleanString(publication?.metadata?.title);
  const description = typeof publication?.metadata?.description === "string" ? publication.metadata.description.trim() : null;
  const madeForKids = publication?.status?.madeForKids;
  if (!title || title.length > 100) {
    throw new YouTubeAdapterError("metadata_invalid", "YouTube title must contain 1 to 100 characters.");
  }
  if (description === null || description.length > 5000) {
    throw new YouTubeAdapterError("metadata_invalid", "YouTube description must contain at most 5000 characters.");
  }
  if (typeof madeForKids !== "boolean") {
    throw new YouTubeAdapterError("status_invalid", "YouTube status.madeForKids must be explicitly true or false.");
  }
  const privacyStatus = cleanString(publication?.status?.privacyStatus) ?? "private";
  if (!new Set(["private", "unlisted", "public"]).has(privacyStatus)) {
    throw new YouTubeAdapterError("status_invalid", "YouTube privacyStatus must be private, unlisted, or public.");
  }
  const license = cleanString(publication?.status?.license) ?? "youtube";
  if (!new Set(["youtube", "creativeCommon"]).has(license)) {
    throw new YouTubeAdapterError("status_invalid", "YouTube license must be youtube or creativeCommon.");
  }
  const publishAt = cleanString(publication?.status?.publishAt);
  if (publishAt) {
    const timestamp = Date.parse(publishAt);
    if (!Number.isFinite(timestamp) || timestamp <= now()) {
      throw new YouTubeAdapterError("status_invalid", "YouTube publishAt must be a future RFC 3339 timestamp.");
    }
    if (privacyStatus !== "private") {
      throw new YouTubeAdapterError("status_invalid", "A scheduled YouTube upload must have privacyStatus private.");
    }
  }
  const authorizationId = assertVisibilityCapability(privacyStatus, publishAt, capability, now);
  const categoryId = cleanString(publication?.metadata?.categoryId);
  if (categoryId && !/^\d+$/.test(categoryId)) {
    throw new YouTubeAdapterError("metadata_invalid", "YouTube categoryId must be numeric.");
  }
  const containsSyntheticMedia = publication?.status?.containsSyntheticMedia;
  if (containsSyntheticMedia !== undefined && typeof containsSyntheticMedia !== "boolean") {
    throw new YouTubeAdapterError("status_invalid", "YouTube containsSyntheticMedia must be a boolean when supplied.");
  }
  const tags = normalizeTags(publication?.metadata?.tags);
  const body = {
    snippet: {
      title,
      description,
      ...(tags.length ? { tags } : {}),
      ...(categoryId ? { categoryId } : {}),
    },
    status: {
      privacyStatus,
      license,
      selfDeclaredMadeForKids: madeForKids,
      ...(publishAt ? { publishAt: new Date(publishAt).toISOString() } : {}),
      ...(containsSyntheticMedia !== undefined ? { containsSyntheticMedia } : {}),
    },
  };
  return {
    body,
    authorizationId,
    notifySubscribers: publication?.status?.notifySubscribers === true,
  };
}

function evidenceRequest(targetId, publication, normalized, video, thumbnail) {
  const sanitized = {
    targetChannelId: targetId,
    metadata: normalized.body.snippet,
    status: normalized.body.status,
    notifySubscribers: normalized.notifySubscribers,
    video: {
      path: video.path,
      sizeBytes: video.sizeBytes,
      mimeType: video.mimeType,
      sha256: video.sha256,
    },
    thumbnail: thumbnail
      ? {
          path: thumbnail.path,
          sizeBytes: thumbnail.sizeBytes,
          mimeType: thumbnail.mimeType,
          sha256: thumbnail.sha256,
        }
      : null,
    visibilityAuthorizationId: normalized.authorizationId,
  };
  return { ...sanitized, fingerprint: sha256Text(canonicalJson(sanitized)) };
}

function makeDependencies(overrides = {}) {
  const fetchImplementation = overrides.fetch ?? globalThis.fetch;
  if (typeof fetchImplementation !== "function") throw new Error("A fetch implementation is required.");
  return {
    fetch: fetchImplementation,
    fs: overrides.fs ?? fsPromises,
    sleep: overrides.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))),
    now: overrides.now ?? Date.now,
    randomUUID: overrides.randomUUID ?? nodeRandomUUID,
    stageAsset: overrides.stageAsset ?? stageApprovedAsset,
  };
}

export function createYouTubeAdapter(options = {}, dependencyOverrides = {}) {
  const deps = makeDependencies(dependencyOverrides);
  const expectedChannelId = targetChannelId(options.target);
  const credentialPaths = options.credentialPaths ?? resolveYouTubeCredentialPaths(options.pathOptions);
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  if (!Number.isInteger(chunkSize) || chunkSize < MIN_CHUNK_SIZE || chunkSize % MIN_CHUNK_SIZE !== 0) {
    throw new YouTubeAdapterError(
      "chunk_size_invalid",
      "YouTube resumable upload chunks must be a positive multiple of 256 KiB."
    );
  }
  const maxUploadAttempts = options.maxUploadAttempts ?? 5;
  const maxPollAttempts = options.maxPollAttempts ?? 60;
  const pollIntervalMs = options.pollIntervalMs ?? 10_000;
  if (!Number.isInteger(maxUploadAttempts) || maxUploadAttempts < 1) {
    throw new YouTubeAdapterError("retry_config_invalid", "maxUploadAttempts must be a positive integer.");
  }
  if (!Number.isInteger(maxPollAttempts) || maxPollAttempts < 1) {
    throw new YouTubeAdapterError("poll_config_invalid", "maxPollAttempts must be a positive integer.");
  }
  if (!Number.isFinite(pollIntervalMs) || pollIntervalMs < 0) {
    throw new YouTubeAdapterError("poll_config_invalid", "pollIntervalMs must be zero or greater.");
  }
  const visibilityCapability = options.visibilityCapability ?? null;
  const credentials = createCredentialManager({ ...deps, credentialPaths });

  async function stageUploadAsset(asset, label) {
    let staged;
    try {
      staged = await deps.stageAsset(
        { path: asset.path, sha256: asset.sha256, sizeBytes: asset.sizeBytes },
        {
          fsImpl: deps.fs,
          env: options.pathOptions?.env ?? process.env,
          homeDir: options.pathOptions?.homeDirectory,
          rootDir: options.assetStagingRoot,
        },
      );
    } catch (cause) {
      const changed = cause instanceof AssetStagingError &&
        /(?:SOURCE|REUSE|HASH|BINDING)/.test(cause.code);
      throw new YouTubeAdapterError(
        changed ? "asset_changed" : "asset_staging_failed",
        `The approved YouTube ${label} could not be staged safely.`,
      );
    }
    if (!staged || typeof staged.path !== "string" || staged.sha256 !== asset.sha256 ||
        staged.sizeBytes !== asset.sizeBytes || path.resolve(staged.path) === path.resolve(asset.path)) {
      throw new YouTubeAdapterError(
        "asset_staging_failed",
        `The approved YouTube ${label} staging result was not the exact content-addressed asset.`,
      );
    }
    return {
      ...asset,
      path: staged.path,
      sourcePath: asset.path,
      staged: { reused: staged.reused === true, sha256: staged.sha256 },
    };
  }

  async function stagePreparedAssets(prepared) {
    const video = await stageUploadAsset(prepared.video, "video");
    const thumbnail = prepared.thumbnail
      ? await stageUploadAsset(prepared.thumbnail, "thumbnail")
      : null;
    return { ...prepared, video, thumbnail };
  }

  async function authorizedFetch(url, init = {}, { retryAuth = true, beforeRequest = null } = {}) {
    const request = async (forceRefresh) => {
      const accessToken = await credentials.accessToken({ forceRefresh });
      const headers = new Headers(init.headers ?? {});
      headers.set("authorization", `Bearer ${accessToken}`);
      if (beforeRequest) {
        try {
          await beforeRequest();
        } catch {
          throw new YouTubeAdapterError(
            "lifecycle_before_write_failed",
            "The durable controller did not authorize the next YouTube write.",
          );
        }
      }
      return deps.fetch(url, { ...init, headers });
    };
    let response = await request(false);
    if (response.status === 401 && retryAuth) response = await request(true);
    return response;
  }

  async function verifyTargetChannel() {
    const url = new URL(`${YOUTUBE_API_ROOT}/channels`);
    url.searchParams.set("part", "id,snippet");
    url.searchParams.set("mine", "true");
    url.searchParams.set("maxResults", "50");
    const response = await authorizedFetch(url);
    const document = await safeJson(response);
    if (!response.ok) {
      throw new YouTubeAdapterError("channel_lookup_failed", apiErrorMessage("YouTube channel verification", response, document));
    }
    const channels = Array.isArray(document?.items) ? document.items : [];
    const ids = channels.map((channel) => cleanString(channel?.id)).filter(Boolean);
    if (ids.length !== 1 || ids[0] !== expectedChannelId) {
      throw new YouTubeAdapterError(
        "channel_mismatch",
        `Authenticated YouTube channel mismatch: expected ${expectedChannelId}, received ${ids.length === 1 ? ids[0] : `${ids.length} channels`}.`,
        { expectedChannelId, observedChannelIds: ids }
      );
    }
    return {
      id: ids[0],
      title: cleanString(channels[0]?.snippet?.title),
    };
  }

  async function prepare(publication) {
    const normalized = normalizePublication(publication, visibilityCapability, deps.now);
    const [video, thumbnail] = await Promise.all([
      inspectAsset(deps.fs, publication?.videoPath, "video", publication?.videoMimeType),
      publication?.thumbnailPath
        ? inspectAsset(deps.fs, publication.thumbnailPath, "thumbnail", publication.thumbnailMimeType)
        : null,
    ]);
    const expectedVideoSha256 = cleanString(publication?.videoSha256);
    const expectedThumbnailSha256 = cleanString(publication?.thumbnailSha256);
    if (!expectedVideoSha256 || !/^[a-f0-9]{64}$/.test(expectedVideoSha256)) {
      throw new YouTubeAdapterError(
        "asset_binding_missing",
        "An approved YouTube video SHA-256 fingerprint is required.",
      );
    }
    if (video.sha256 !== expectedVideoSha256) {
      throw new YouTubeAdapterError("asset_changed", "The YouTube video no longer matches the approved fingerprint.");
    }
    if (thumbnail && (!expectedThumbnailSha256 || !/^[a-f0-9]{64}$/.test(expectedThumbnailSha256))) {
      throw new YouTubeAdapterError(
        "asset_binding_missing",
        "An approved YouTube thumbnail SHA-256 fingerprint is required.",
      );
    }
    if (thumbnail && thumbnail.sha256 !== expectedThumbnailSha256) {
      throw new YouTubeAdapterError("asset_changed", "The YouTube thumbnail no longer matches the approved fingerprint.");
    }
    if (!thumbnail && expectedThumbnailSha256) {
      throw new YouTubeAdapterError("asset_binding_mismatch", "Approved YouTube thumbnail media is missing.");
    }
    return {
      normalized,
      video,
      thumbnail,
      request: evidenceRequest(expectedChannelId, publication, normalized, video, thumbnail),
    };
  }

  async function preflight(publication) {
    const startedAt = isoTime(deps.now);
    const prepared = await prepare(publication);
    const channel = await verifyTargetChannel();
    return {
      schemaVersion: 1,
      platform: "youtube",
      operation: "upload_preflight",
      mode: "dry_run",
      startedAt,
      completedAt: isoTime(deps.now),
      channel,
      request: prepared.request,
      remoteWrites: 0,
      result: "ready",
    };
  }

  function requireLifecycle(lifecycle) {
    if (
      !lifecycle ||
      typeof lifecycle.beforeWrite !== "function" ||
      typeof lifecycle.onCheckpoint !== "function"
    ) {
      throw new YouTubeAdapterError(
        "lifecycle_required",
        "YouTube publishing requires durable beforeWrite and onCheckpoint lifecycle callbacks.",
      );
    }
    return lifecycle;
  }

  function remoteUrl(videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  function checkpointTemplate(prepared) {
    return {
      schemaVersion: 1,
      protocolVersion: 1,
      platform: "youtube",
      phase: "session_created",
      targetChannelId: expectedChannelId,
      requestFingerprint: prepared.request.fingerprint,
      videoSha256: prepared.video.sha256,
      videoSizeBytes: prepared.video.sizeBytes,
      uploadUrl: null,
      uploadedBytes: 0,
      videoId: null,
      remoteUrl: null,
      thumbnailRequired: Boolean(prepared.thumbnail),
      thumbnailSet: false,
      processingStatus: null,
      uploadStatus: null,
    };
  }

  function validateCheckpoint(checkpoint, prepared) {
    if (!checkpoint || typeof checkpoint !== "object" || Array.isArray(checkpoint)) {
      throw new YouTubeAdapterError(
        "checkpoint_missing",
        "A prior YouTube provider write can only resume from its durable checkpoint.",
      );
    }
    const expected = checkpointTemplate(prepared);
    const mismatches = [];
    if (checkpoint.schemaVersion !== 1) mismatches.push("schemaVersion");
    if (checkpoint.protocolVersion !== 1) mismatches.push("protocolVersion");
    if (checkpoint.platform !== "youtube") mismatches.push("platform");
    if (checkpoint.targetChannelId !== expected.targetChannelId) mismatches.push("targetChannelId");
    if (checkpoint.requestFingerprint !== expected.requestFingerprint) mismatches.push("requestFingerprint");
    if (checkpoint.videoSha256 !== expected.videoSha256) mismatches.push("videoSha256");
    if (checkpoint.videoSizeBytes !== expected.videoSizeBytes) mismatches.push("videoSizeBytes");
    if (checkpoint.thumbnailRequired !== expected.thumbnailRequired) mismatches.push("thumbnailRequired");
    if (typeof checkpoint.thumbnailSet !== "boolean") mismatches.push("thumbnailSet");
    if (checkpoint.thumbnailSet === true && !expected.thumbnailRequired) mismatches.push("thumbnailSet");
    if (!CHECKPOINT_PHASES.has(checkpoint.phase)) mismatches.push("phase");

    const videoId = cleanString(checkpoint.videoId);
    const uploadUrl = cleanString(checkpoint.uploadUrl);
    if (!videoId && (!uploadUrl || !isGoogleUploadUrl(uploadUrl))) mismatches.push("uploadUrl");
    if (uploadUrl && !isGoogleUploadUrl(uploadUrl)) mismatches.push("uploadUrl");
    if (videoId && checkpoint.remoteUrl !== remoteUrl(videoId)) mismatches.push("remoteUrl");
    if (!videoId && checkpoint.remoteUrl != null) mismatches.push("remoteUrl");
    const uploadedBytes = Number(checkpoint.uploadedBytes);
    if (!Number.isSafeInteger(uploadedBytes) || uploadedBytes < 0 || uploadedBytes > prepared.video.sizeBytes) {
      mismatches.push("uploadedBytes");
    }
    if (videoId && uploadedBytes !== prepared.video.sizeBytes) mismatches.push("uploadedBytes");
    if (mismatches.length) {
      throw new YouTubeAdapterError(
        "checkpoint_invalid",
        `The YouTube checkpoint does not match the approved operation: ${[...new Set(mismatches)].join(", ")}.`,
      );
    }
    return {
      ...expected,
      ...checkpoint,
      uploadUrl,
      uploadedBytes,
      videoId,
      remoteUrl: videoId ? remoteUrl(videoId) : null,
      thumbnailSet: checkpoint.thumbnailSet === true,
    };
  }

  function checkpointWriter(prepared, lifecycle, initial = null) {
    let current = initial ? validateCheckpoint(initial, prepared) : checkpointTemplate(prepared);
    async function write(patch, { providerAccepted = false, providerSummary = null } = {}) {
      const next = validateCheckpoint({ ...current, ...patch }, prepared);
      if (providerAccepted && !next.videoId) {
        throw new YouTubeAdapterError(
          "provider_identity_missing",
          "A provider-accepted YouTube checkpoint requires the durable video ID.",
        );
      }
      try {
        await lifecycle.onCheckpoint({
          checkpoint: next,
          providerAccepted,
          remoteId: providerAccepted ? next.videoId : null,
          remoteUrl: providerAccepted ? next.remoteUrl : null,
          providerSummary,
        });
      } catch {
        throw new YouTubeAdapterError(
          "checkpoint_persist_failed",
          "The YouTube provider checkpoint could not be persisted durably.",
        );
      }
      current = next;
      return current;
    }
    return { current: () => current, write };
  }

  async function initiateUpload(prepared, lifecycle) {
    const url = new URL(`${YOUTUBE_UPLOAD_ROOT}/videos`);
    url.searchParams.set("uploadType", "resumable");
    url.searchParams.set("part", "snippet,status");
    url.searchParams.set("notifySubscribers", String(prepared.normalized.notifySubscribers));
    const response = await authorizedFetch(
      url,
      {
        method: "POST",
        headers: {
          "content-type": "application/json; charset=UTF-8",
          "x-upload-content-length": String(prepared.video.sizeBytes),
          "x-upload-content-type": prepared.video.mimeType,
        },
        body: JSON.stringify(prepared.normalized.body),
      },
      {
        retryAuth: false,
        beforeRequest: () => lifecycle.beforeWrite({ step: "initiate_resumable_upload" }),
      },
    );
    const document = response.ok ? null : await safeJson(response);
    if (!response.ok) {
      throw new YouTubeAdapterError("upload_initiation_failed", apiErrorMessage("YouTube upload initiation", response, document));
    }
    const uploadUrl = response.headers.get("location");
    if (!uploadUrl || !isGoogleUploadUrl(uploadUrl)) {
      throw new YouTubeAdapterError("upload_session_invalid", "YouTube returned an invalid resumable upload session URL.");
    }
    return uploadUrl;
  }

  function uploadedOffset(response) {
    const range = response.headers.get("range");
    const match = range?.match(/^bytes=0-(\d+)$/i);
    return match ? Number(match[1]) + 1 : 0;
  }

  async function queryUpload(uploadUrl, totalBytes) {
    let response;
    try {
      response = await authorizedFetch(uploadUrl, {
        method: "PUT",
        headers: {
          "content-length": "0",
          "content-range": `bytes */${totalBytes}`,
        },
      });
    } catch (error) {
      if (error instanceof YouTubeAdapterError) throw error;
      throw new YouTubeAdapterError(
        "upload_status_network_failed",
        "The YouTube resumable upload status query failed before a response.",
        null,
        { retryable: true },
      );
    }
    if (response.status === 308) {
      const offset = uploadedOffset(response);
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > totalBytes) {
        throw new YouTubeAdapterError(
          "upload_status_invalid",
          "The YouTube resumable upload status returned an invalid committed offset.",
        );
      }
      return { offset, resource: null };
    }
    const document = await safeJson(response);
    if (response.ok && cleanString(document?.id)) return { offset: totalBytes, resource: document };
    if (response.status === 404 || response.status === 410) {
      throw new YouTubeAdapterError("upload_session_expired", "The YouTube resumable upload session expired.");
    }
    throw new YouTubeAdapterError(
      "upload_status_failed",
      apiErrorMessage("YouTube upload status query", response, document),
      { httpStatus: response.status },
      { retryable: TRANSIENT_STATUS.has(response.status) },
    );
  }

  async function uploadVideo(uploadUrl, video, lifecycle, checkpoints, initialOffset = 0) {
    const fileHandle = await deps.fs.open(video.path, "r");
    let offset = initialOffset;
    let chunksUploaded = 0;

    async function accepted(resource, completedChunks = chunksUploaded) {
      const videoId = cleanString(resource?.id);
      if (!videoId) {
        throw new YouTubeAdapterError("upload_response_invalid", "YouTube finalized the upload without a video ID.");
      }
      await checkpoints.write(
        {
          phase: "video_created",
          uploadedBytes: video.sizeBytes,
          videoId,
          remoteUrl: remoteUrl(videoId),
          uploadStatus: "uploaded",
        },
        {
          providerAccepted: true,
          providerSummary: `YouTube accepted video ${videoId} on channel ${expectedChannelId}.`,
        },
      );
      return { resource, chunksUploaded: completedChunks };
    }

    try {
      while (offset < video.sizeBytes) {
        const end = Math.min(offset + chunkSize, video.sizeBytes) - 1;
        const body = await readExact(fileHandle, end - offset + 1, offset);
        let completed = null;
        let advanced = false;
        for (let attempt = 0; attempt < maxUploadAttempts; attempt += 1) {
          try {
            const response = await authorizedFetch(
              uploadUrl,
              {
                method: "PUT",
                headers: {
                  "content-length": String(body.length),
                  "content-range": `bytes ${offset}-${end}/${video.sizeBytes}`,
                  "content-type": video.mimeType,
                },
                body,
              },
              { beforeRequest: () => lifecycle.beforeWrite({ step: "upload_video_chunk" }) },
            );
            if (response.status === 308) {
              const nextOffset = uploadedOffset(response);
              if (!Number.isSafeInteger(nextOffset) || nextOffset > video.sizeBytes) {
                throw new YouTubeAdapterError(
                  "upload_status_invalid",
                  "The YouTube resumable upload returned an invalid committed offset.",
                );
              }
              if (nextOffset <= offset) {
                if (attempt + 1 < maxUploadAttempts) {
                  await deps.sleep(Math.min(2 ** attempt * 1_000, 16_000));
                  continue;
                }
                throw new YouTubeAdapterError(
                  "upload_stalled",
                  "The YouTube resumable upload did not advance.",
                  null,
                  { retryable: true },
                );
              }
              await checkpoints.write({ phase: "uploading", uploadedBytes: nextOffset });
              offset = nextOffset;
              chunksUploaded += 1;
              advanced = true;
              break;
            }
            const document = await safeJson(response);
            if (response.ok && cleanString(document?.id)) {
              return await accepted(document, chunksUploaded + 1);
            }
            if (!TRANSIENT_STATUS.has(response.status)) {
              throw new YouTubeAdapterError("upload_failed", apiErrorMessage("YouTube video upload", response, document));
            }
          } catch (error) {
            if (error instanceof YouTubeAdapterError && !new Set(["upload_status_failed"]).has(error.code)) throw error;
          }

          try {
            const status = await queryUpload(uploadUrl, video.sizeBytes);
            if (status.resource) {
              return await accepted(status.resource);
            }
            if (status.offset > offset) {
              await checkpoints.write({ phase: "uploading", uploadedBytes: status.offset });
              offset = status.offset;
              chunksUploaded += 1;
              advanced = true;
              break;
            }
          } catch (error) {
            if (error instanceof YouTubeAdapterError && error.code === "upload_session_expired") throw error;
          }
          if (attempt + 1 < maxUploadAttempts) await deps.sleep(Math.min(2 ** attempt * 1_000, 16_000));
        }
        if (completed) return await accepted(completed);
        if (!advanced) {
          throw new YouTubeAdapterError(
            "upload_retry_exhausted",
            "YouTube video upload retry attempts were exhausted.",
            null,
            { retryable: true },
          );
        }
      }
    } finally {
      await fileHandle.close();
    }
    const status = await queryUpload(uploadUrl, video.sizeBytes);
    if (!status.resource) {
      throw new YouTubeAdapterError(
        "upload_incomplete",
        "YouTube did not finalize the uploaded video.",
        null,
        { retryable: true },
      );
    }
    return accepted(status.resource);
  }

  async function setThumbnail(videoId, thumbnail, lifecycle) {
    const url = new URL(`${YOUTUBE_UPLOAD_ROOT}/thumbnails/set`);
    url.searchParams.set("videoId", videoId);
    url.searchParams.set("uploadType", "media");
    const body = await deps.fs.readFile(thumbnail.path);
    let response;
    try {
      response = await authorizedFetch(
        url,
        {
          method: "POST",
          headers: {
            "content-length": String(body.length),
            "content-type": thumbnail.mimeType,
          },
          body,
        },
        { beforeRequest: () => lifecycle.beforeWrite({ step: "set_thumbnail" }) },
      );
    } catch (error) {
      if (error instanceof YouTubeAdapterError) throw error;
      throw new YouTubeAdapterError(
        "thumbnail_network_failed",
        "The YouTube thumbnail request failed before a response.",
        null,
        { retryable: true },
      );
    }
    const document = await safeJson(response);
    if (!response.ok) {
      throw new YouTubeAdapterError(
        "thumbnail_failed",
        apiErrorMessage("YouTube thumbnail upload", response, document),
        { httpStatus: response.status },
        { retryable: TRANSIENT_STATUS.has(response.status) },
      );
    }
    return {
      set: true,
      variants: Object.keys(document?.items?.[0]?.snippet?.thumbnails ?? {}).sort(),
    };
  }

  async function readVideo(videoId) {
    if (!cleanString(videoId)) throw new YouTubeAdapterError("video_id_invalid", "A YouTube video ID is required.");
    const url = new URL(`${YOUTUBE_API_ROOT}/videos`);
    url.searchParams.set("part", "id,snippet,status,processingDetails,contentDetails");
    url.searchParams.set("id", videoId);
    let response;
    try {
      response = await authorizedFetch(url);
    } catch (error) {
      if (error instanceof YouTubeAdapterError) throw error;
      throw new YouTubeAdapterError(
        "readback_network_failed",
        "The YouTube video readback failed before a response.",
        null,
        { retryable: true },
      );
    }
    const document = await safeJson(response);
    if (!response.ok) {
      throw new YouTubeAdapterError(
        "readback_failed",
        apiErrorMessage("YouTube video readback", response, document),
        { httpStatus: response.status },
        { retryable: TRANSIENT_STATUS.has(response.status) },
      );
    }
    const items = Array.isArray(document?.items) ? document.items : [];
    if (items.length !== 1 || items[0]?.id !== videoId) {
      throw new YouTubeAdapterError(
        "readback_missing",
        `YouTube readback did not return video ${videoId}.`,
        null,
        { retryable: true },
      );
    }
    return items[0];
  }

  function readbackProblems(resource, expected) {
    const problems = [];
    const snippet = resource?.snippet ?? {};
    const status = resource?.status ?? {};
    if (snippet.title !== expected.snippet.title) problems.push("title");
    if (snippet.description !== expected.snippet.description) problems.push("description");
    if (canonicalJson(snippet.tags ?? []) !== canonicalJson(expected.snippet.tags ?? [])) problems.push("tags");
    if (expected.snippet.categoryId && snippet.categoryId !== expected.snippet.categoryId) problems.push("categoryId");
    if (status.privacyStatus !== expected.status.privacyStatus) problems.push("privacyStatus");
    if (status.license !== expected.status.license) problems.push("license");
    if (status.selfDeclaredMadeForKids !== expected.status.selfDeclaredMadeForKids) problems.push("madeForKids");
    if (
      expected.status.publishAt &&
      new Date(status.publishAt ?? 0).toISOString() !== new Date(expected.status.publishAt).toISOString()
    ) {
      problems.push("publishAt");
    }
    if (
      expected.status.containsSyntheticMedia !== undefined &&
      status.containsSyntheticMedia !== expected.status.containsSyntheticMedia
    ) {
      problems.push("containsSyntheticMedia");
    }
    return problems;
  }

  async function pollReadback(videoId, expected, onProgress = null) {
    let lastResource = null;
    for (let attempt = 1; attempt <= maxPollAttempts; attempt += 1) {
      try {
        lastResource = await readVideo(videoId);
      } catch (error) {
        const retryable =
          error instanceof YouTubeAdapterError &&
          (error.code === "readback_missing" ||
            (error.code === "readback_failed" && TRANSIENT_STATUS.has(error.evidence?.httpStatus)));
        if (!retryable || attempt === maxPollAttempts) throw error;
        await deps.sleep(pollIntervalMs);
        continue;
      }
      const processing = lastResource?.processingDetails?.processingStatus;
      const upload = lastResource?.status?.uploadStatus;
      if (new Set(["failed", "terminated"]).has(processing) || new Set(["failed", "rejected", "deleted"]).has(upload)) {
        throw new YouTubeAdapterError("processing_failed", `YouTube processing ended with ${processing ?? upload}.`, {
          videoId,
          processingStatus: processing ?? null,
          uploadStatus: upload ?? null,
        });
      }
      if (processing === "succeeded" || upload === "processed") {
        const problems = readbackProblems(lastResource, expected);
        if (problems.length) {
          throw new YouTubeAdapterError("readback_mismatch", `YouTube readback differs in: ${problems.join(", ")}.`, {
            videoId,
            mismatches: problems,
          });
        }
        return { resource: lastResource, attempts: attempt };
      }
      if (onProgress) await onProgress({ attempt, processingStatus: processing ?? null, uploadStatus: upload ?? null });
      if (attempt < maxPollAttempts) await deps.sleep(pollIntervalMs);
    }
    throw new YouTubeAdapterError(
      "processing_timeout",
      "YouTube processing did not complete before the polling limit.",
      {
        videoId,
        processingStatus: lastResource?.processingDetails?.processingStatus ?? null,
        uploadStatus: lastResource?.status?.uploadStatus ?? null,
      },
      { retryable: true },
    );
  }

  async function execute(publication, lifecycleInput, { allowInitiation }) {
    const lifecycle = requireLifecycle(lifecycleInput);
    const startedAt = isoTime(deps.now);
    let prepared = await prepare(publication);

    // This read is deliberately performed inside every publishing call. A prior
    // preflight is never treated as authorization for a later remote write.
    const channel = await verifyTargetChannel();
    prepared = await stagePreparedAssets(prepared);
    const evidence = {
      schemaVersion: 1,
      platform: "youtube",
      operation: "video_insert",
      mode: allowInitiation ? "publish" : "reconcile",
      startedAt,
      channel,
      request: prepared.request,
      staging: {
        video: prepared.video.staged,
        thumbnail: prepared.thumbnail?.staged ?? null,
      },
      remoteWrites: 0,
      result: "in_progress",
    };

    try {
      const resuming = lifecycle.checkpoint !== null && lifecycle.checkpoint !== undefined;
      let saved = resuming
        ? validateCheckpoint(lifecycle.checkpoint, prepared)
        : null;
      if (!allowInitiation && !saved) {
        throw new YouTubeAdapterError(
          "checkpoint_missing",
          "YouTube reconciliation cannot initiate a replacement resumable upload session.",
        );
      }
      const checkpoints = checkpointWriter(prepared, lifecycle, saved);
      let upload;
      if (!saved) {
        const uploadUrl = await initiateUpload(prepared, lifecycle);
        await checkpoints.write({ uploadUrl, phase: "session_created", uploadedBytes: 0 });
        evidence.remoteWrites += 1;
        saved = checkpoints.current();
      }

      if (saved.videoId) {
        upload = {
          resource: { id: saved.videoId },
          chunksUploaded: 0,
          resumed: true,
        };
        await checkpoints.write(
          { phase: saved.phase, videoId: saved.videoId, remoteUrl: remoteUrl(saved.videoId) },
          {
            providerAccepted: true,
            providerSummary: `YouTube accepted video ${saved.videoId} on channel ${expectedChannelId}.`,
          },
        );
      } else if (resuming) {
        const status = await queryUpload(saved.uploadUrl, prepared.video.sizeBytes);
        if (status.resource) {
          const videoId = cleanString(status.resource.id);
          await checkpoints.write(
            {
              phase: "video_created",
              uploadedBytes: prepared.video.sizeBytes,
              videoId,
              remoteUrl: remoteUrl(videoId),
              uploadStatus: "uploaded",
            },
            {
              providerAccepted: true,
              providerSummary: `YouTube accepted video ${videoId} on channel ${expectedChannelId}.`,
            },
          );
          upload = { resource: status.resource, chunksUploaded: 0, resumed: true };
        } else {
          await checkpoints.write({ phase: "uploading", uploadedBytes: status.offset });
          upload = await uploadVideo(saved.uploadUrl, prepared.video, lifecycle, checkpoints, status.offset);
          upload.resumed = true;
        }
      } else {
        upload = await uploadVideo(saved.uploadUrl, prepared.video, lifecycle, checkpoints, 0);
        upload.resumed = false;
      }

      const videoId = upload.resource.id;
      evidence.upload = {
        videoId,
        chunksUploaded: upload.chunksUploaded,
        resumable: true,
        resumed: upload.resumed === true,
      };
      const current = checkpoints.current();
      if (prepared.thumbnail && !current.thumbnailSet) {
        const thumbnail = await setThumbnail(videoId, prepared.thumbnail, lifecycle);
        await checkpoints.write(
          { phase: "thumbnail_set", thumbnailSet: true },
          {
            providerAccepted: true,
            providerSummary: `YouTube accepted video ${videoId} and its approved thumbnail.`,
          },
        );
        evidence.thumbnail = thumbnail;
        evidence.remoteWrites += 1;
      } else {
        evidence.thumbnail = prepared.thumbnail
          ? { set: true, variants: [], recoveredFromCheckpoint: true }
          : { set: false, variants: [] };
      }
      const readback = await pollReadback(
        videoId,
        prepared.normalized.body,
        ({ processingStatus, uploadStatus }) => checkpoints.write({
          phase: "processing",
          processingStatus,
          uploadStatus,
        }, {
          providerAccepted: true,
          providerSummary: `YouTube is processing accepted video ${videoId}.`,
        }),
      );
      await checkpoints.write(
        {
          phase: "verified",
          processingStatus: readback.resource.processingDetails?.processingStatus ?? null,
          uploadStatus: readback.resource.status?.uploadStatus ?? null,
          thumbnailSet: prepared.thumbnail ? true : checkpoints.current().thumbnailSet,
        },
        {
          providerAccepted: true,
          providerSummary: `YouTube accepted and verified video ${videoId}.`,
        },
      );
      evidence.readback = {
        videoId,
        url: remoteUrl(videoId),
        attempts: readback.attempts,
        uploadStatus: readback.resource.status?.uploadStatus ?? null,
        processingStatus: readback.resource.processingDetails?.processingStatus ?? null,
        privacyStatus: readback.resource.status?.privacyStatus ?? null,
        license: readback.resource.status?.license ?? null,
        madeForKids: readback.resource.status?.selfDeclaredMadeForKids ?? null,
        publishAt: readback.resource.status?.publishAt ?? null,
        title: readback.resource.snippet?.title ?? null,
      };
      evidence.completedAt = isoTime(deps.now);
      evidence.result = "verified";
      return evidence;
    } catch (error) {
      evidence.completedAt = isoTime(deps.now);
      evidence.result = "failed";
      evidence.errorCode = error instanceof YouTubeAdapterError ? error.code : "unexpected_error";
      if (error instanceof YouTubeAdapterError) {
        error.evidence = { ...evidence, failure: error.evidence };
        throw error;
      }
      throw new YouTubeAdapterError("unexpected_error", "The YouTube publishing operation failed.", evidence);
    }
  }

  async function publish(publication, lifecycle = {}) {
    if (lifecycle.dryRun === true) return preflight(publication);
    return execute(publication, lifecycle, { allowInitiation: true });
  }

  async function reconcile(publication, lifecycle = {}) {
    return execute(publication, lifecycle, { allowInitiation: false });
  }

  return {
    checkpointProtocolVersion: 1,
    expectedChannelId,
    credentialPaths: { ...credentialPaths },
    preflight,
    publish,
    reconcile,
    readVideo,
    verifyTargetChannel,
  };
}
