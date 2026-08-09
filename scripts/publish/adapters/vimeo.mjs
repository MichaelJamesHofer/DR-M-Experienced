import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AssetStagingError, stageApprovedAsset } from "../asset-staging.mjs";
import { SecureCredentialError, readSecureCredentialText } from "../secure-credential.mjs";

export const VIMEO_API_VERSION = "3.4";
export const VIMEO_TUS_VERSION = "1.0.0";
export const DEFAULT_VIMEO_CHUNK_SIZE_BYTES = 256 * 1024 * 1024;
export const VIMEO_CHECKPOINT_PROTOCOL_VERSION = 1;

const VIMEO_API_ACCEPT = `application/vnd.vimeo.*+json;version=${VIMEO_API_VERSION}`;
const SAFE_PRIVACY_VALUES = new Set(["anybody", "disable", "nobody", "unlisted"]);
const CREATIVE_COMMONS_LICENSES = new Set([
  "by",
  "by-nc",
  "by-nc-nd",
  "by-nc-sa",
  "by-nd",
  "by-sa",
  "cc0",
]);
const READY_TRANSCODE_STATUSES = new Set(["available", "complete"]);
const FAILED_TRANSCODE_STATUSES = new Set(["error", "failed"]);
const RETRYABLE_HTTP_STATUSES = new Set([408, 429]);
const MAX_VIDEO_BYTES = 300 * 1024 ** 3;
const SHA256 = /^[a-f0-9]{64}$/;
const RESOURCE_ID = /^\d+$/;
const VIMEO_MEDIA_HOST_SUFFIXES = [".vimeo.com", ".vimeocdn.com", ".akamaized.net"];
const CHECKPOINT_PHASES = new Set([
  "provider_accepted",
  "private_staged",
  "upload_complete",
  "transcode_complete",
  "thumbnail_create_intent",
  "thumbnail_resource_created",
  "thumbnail_uploaded",
  "thumbnail_complete",
  "final_metadata_applied",
]);
const CHECKPOINT_PHASE_ORDER = new Map([
  ["provider_accepted", 0],
  ["private_staged", 1],
  ["upload_complete", 2],
  ["transcode_complete", 3],
  ["thumbnail_create_intent", 4],
  ["thumbnail_resource_created", 5],
  ["thumbnail_uploaded", 6],
  ["thumbnail_complete", 7],
  ["final_metadata_applied", 8],
]);

export class VimeoAdapterError extends Error {
  constructor(message, { code = "VIMEO_ADAPTER_ERROR", cause, retryable = false, status = null } = {}) {
    super(message, { cause });
    this.name = "VimeoAdapterError";
    this.code = code;
    this.retryable = retryable;
    this.status = status;
  }
}

function retryableHttpStatus(status) {
  return RETRYABLE_HTTP_STATUSES.has(status) || (status >= 500 && status <= 599);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new VimeoAdapterError(`${label} must be a non-empty string.`, {
      code: "INVALID_INPUT",
    });
  }
  return value.trim();
}

function resourceId(uri, type) {
  if (typeof uri !== "string") return null;
  return uri.match(new RegExp(`^/${type}/(\\d+)(?:$|/)`))?.[1] ?? null;
}

function safeApiUri(uri, label) {
  if (typeof uri !== "string" || !uri.startsWith("/") || uri.startsWith("//")) {
    throw new VimeoAdapterError(`Vimeo returned an invalid ${label} URI.`, {
      code: "INVALID_PROVIDER_RESPONSE",
    });
  }
  return uri;
}

function safeHttpsUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new VimeoAdapterError(`Vimeo returned an invalid ${label} URL.`, {
      code: "INVALID_PROVIDER_RESPONSE",
    });
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new VimeoAdapterError(`Vimeo returned an unsafe ${label} URL.`, {
      code: "INVALID_PROVIDER_RESPONSE",
    });
  }
  return url.href;
}

function safeTusUploadUrl(value) {
  const link = safeHttpsUrl(value, "TUS upload");
  const hostname = new URL(link).hostname.toLowerCase();
  if (hostname !== "files.tus.vimeo.com" && !hostname.endsWith("-files.tus.vimeo.com")) {
    throw new VimeoAdapterError("Vimeo returned a TUS upload URL outside its documented host family.", {
      code: "INVALID_PROVIDER_RESPONSE",
    });
  }
  return link;
}

function safeThumbnailUploadUrl(value) {
  const link = safeHttpsUrl(value, "thumbnail upload");
  const hostname = new URL(link).hostname.toLowerCase();
  if (!VIMEO_MEDIA_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    throw new VimeoAdapterError("Vimeo returned a thumbnail upload URL outside its media host family.", {
      code: "INVALID_PROVIDER_RESPONSE",
    });
  }
  return link;
}

function withFields(uri, fields) {
  const separator = uri.includes("?") ? "&" : "?";
  return `${uri}${separator}fields=${encodeURIComponent(fields.join(","))}`;
}

function expectedLicense(value) {
  if (value === "none") return null;
  if (CREATIVE_COMMONS_LICENSES.has(value)) return value;
  throw new VimeoAdapterError(`Unsupported Vimeo license value: ${value}.`, {
    code: "UNSUPPORTED_RELEASE_CHOICE",
  });
}

function readbackLicense(value) {
  return value == null || value === "" || value === "none" ? null : value;
}

function privacyForRelease(releasePlan) {
  if (!isPlainObject(releasePlan)) {
    throw new VimeoAdapterError("The approved Vimeo release plan is missing.", {
      code: "INVALID_INPUT",
    });
  }
  if (releasePlan.releaseMode === "scheduled") {
    throw new VimeoAdapterError(
      "Scheduled Vimeo release is not implemented because the approved manifest does not bind Vimeo scheduling semantics.",
      { code: "UNSUPPORTED_RELEASE_CHOICE" },
    );
  }
  if (!["hold", "publish_now"].includes(releasePlan.releaseMode)) {
    throw new VimeoAdapterError(`Unsupported Vimeo release mode: ${releasePlan.releaseMode}.`, {
      code: "UNSUPPORTED_RELEASE_CHOICE",
    });
  }
  const value = releasePlan.releaseMode === "publish_now"
    ? releasePlan.finalVisibility
    : releasePlan.initialVisibility;
  if (!SAFE_PRIVACY_VALUES.has(value)) {
    throw new VimeoAdapterError(
      `Vimeo privacy ${value} requires behavior that this adapter cannot apply safely.`,
      { code: "UNSUPPORTED_RELEASE_CHOICE" },
    );
  }
  if (!["unchanged", "not_applicable"].includes(releasePlan.monetization)) {
    throw new VimeoAdapterError("Vimeo monetization changes are not supported by this adapter.", {
      code: "UNSUPPORTED_RELEASE_CHOICE",
    });
  }
  if (!["disabled", "not_applicable"].includes(releasePlan.notifications)) {
    throw new VimeoAdapterError("Vimeo notifications cannot be enabled by this adapter.", {
      code: "UNSUPPORTED_RELEASE_CHOICE",
    });
  }
  return value;
}

function assetRecord(value, label) {
  if (typeof value === "string") return { path: value, sizeBytes: null, sha256: null };
  if (!isPlainObject(value)) {
    throw new VimeoAdapterError(`${label} is missing from the approved asset snapshot.`, {
      code: "INVALID_INPUT",
    });
  }
  return {
    path: requiredString(value.path, `${label}.path`),
    sizeBytes: Number.isSafeInteger(value.sizeBytes) ? value.sizeBytes : null,
    sha256: typeof value.sha256 === "string" ? value.sha256.toLowerCase() : null,
  };
}

function operationInput(input) {
  const operation = typeof input.operation === "string"
    ? { kind: input.operation }
    : input.operation ?? {};
  const kind = operation.kind;
  if (kind == null) {
    throw new VimeoAdapterError("Vimeo operation.kind must explicitly be create or replace.", {
      code: "INVALID_INPUT",
    });
  }
  if (!new Set(["create", "replace"]).has(kind)) {
    throw new VimeoAdapterError(`Unsupported Vimeo operation: ${kind}.`, {
      code: "INVALID_INPUT",
    });
  }
  return {
    kind,
    existingVideoId: operation.existingVideoId ?? input.existingVideoId ?? null,
    approvedBinding: operation.approvedBinding ?? input.approvedBinding ?? null,
  };
}

function assertReplacementBinding({ binding, existingVideoId, accountId, assetSha256, approvalHash, episodeHash }) {
  if (!RESOURCE_ID.test(existingVideoId ?? "")) {
    throw new VimeoAdapterError("Replacement requires an explicitly supplied numeric Vimeo video ID.", {
      code: "REPLACEMENT_BINDING_REQUIRED",
    });
  }
  if (!isPlainObject(binding)) {
    throw new VimeoAdapterError("Replacement requires an approved Vimeo source-replacement binding.", {
      code: "REPLACEMENT_BINDING_REQUIRED",
    });
  }
  const expected = {
    platformId: "vimeo",
    action: "replace_source",
    remoteId: existingVideoId,
    destinationAccountId: accountId,
    assetSha256,
    approvalHash,
    episodeHash,
  };
  const mismatches = Object.entries(expected)
    .filter(([, value]) => value != null)
    .filter(([key, value]) => binding[key] !== value)
    .map(([key]) => key);
  if (mismatches.length) {
    throw new VimeoAdapterError(
      `Approved Vimeo replacement binding does not match: ${mismatches.join(", ")}.`,
      { code: "REPLACEMENT_BINDING_MISMATCH" },
    );
  }
  if (!SHA256.test(assetSha256 ?? "")) {
    throw new VimeoAdapterError("Replacement requires the approved fullVideo SHA-256 fingerprint.", {
      code: "REPLACEMENT_BINDING_REQUIRED",
    });
  }
  if (!SHA256.test(approvalHash ?? "") || !SHA256.test(episodeHash ?? "")) {
    throw new VimeoAdapterError(
      "Replacement binding must be tied to the immutable approval and catalog episode hashes.",
      { code: "REPLACEMENT_BINDING_REQUIRED" },
    );
  }
}

function normalizeInput(input) {
  if (!isPlainObject(input)) {
    throw new VimeoAdapterError("Vimeo adapter input must be an object.", { code: "INVALID_INPUT" });
  }
  const packet = input.packet ?? null;
  const snapshot = input.snapshot ?? packet?.snapshot ?? null;
  const target = input.target ?? snapshot?.targets?.find((candidate) => candidate?.id === "vimeo");
  const manifest = input.manifest ?? snapshot?.manifest;
  const assets = input.assets ?? snapshot?.assets;
  if (!isPlainObject(target) || target.id !== "vimeo") {
    throw new VimeoAdapterError("The approved Vimeo target is missing.", { code: "INVALID_INPUT" });
  }
  if (!isPlainObject(manifest) || !isPlainObject(assets)) {
    throw new VimeoAdapterError("The approved manifest and asset snapshot are required.", {
      code: "INVALID_INPUT",
    });
  }

  const accountId = requiredString(target.destinationIds?.accountId, "target.destinationIds.accountId");
  if (!RESOURCE_ID.test(accountId)) {
    throw new VimeoAdapterError("target.destinationIds.accountId must be a numeric Vimeo user ID.", {
      code: "INVALID_INPUT",
    });
  }
  const fullVideo = assetRecord(assets.fullVideo, "assets.fullVideo");
  if (fullVideo.sha256 != null && !SHA256.test(fullVideo.sha256)) {
    throw new VimeoAdapterError("assets.fullVideo.sha256 is not a valid SHA-256 fingerprint.", {
      code: "INVALID_INPUT",
    });
  }
  if (target.assetSha256 && target.assetSha256 !== fullVideo.sha256) {
    throw new VimeoAdapterError("The Vimeo target fingerprint does not match assets.fullVideo.", {
      code: "INVALID_INPUT",
    });
  }
  const thumbnail = assets.thumbnail == null ? null : assetRecord(assets.thumbnail, "assets.thumbnail");
  const title = requiredString(manifest.title, "manifest.title");
  if (title.length > 128) {
    throw new VimeoAdapterError("Vimeo titles cannot exceed 128 characters.", { code: "INVALID_INPUT" });
  }
  const description = requiredString(target.approvedCopy, "target.approvedCopy");
  if (description.length > 5000) {
    throw new VimeoAdapterError("Vimeo descriptions cannot exceed 5,000 characters.", {
      code: "INVALID_INPUT",
    });
  }
  const privacy = privacyForRelease(target.releasePlan);
  const license = expectedLicense(target.releasePlan.license);
  const operation = operationInput(input);
  const approvalHash = input.approvalHash ?? packet?.approvalHash ?? null;
  const episodeHash = input.episodeHash ?? snapshot?.catalogBinding?.episodeHash ?? null;
  if (operation.kind === "replace") {
    assertReplacementBinding({
      binding: operation.approvedBinding,
      existingVideoId: operation.existingVideoId,
      accountId,
      assetSha256: fullVideo.sha256,
      approvalHash,
      episodeHash,
    });
  } else if (operation.existingVideoId != null || operation.approvedBinding != null) {
    throw new VimeoAdapterError("Create operations cannot carry a replacement video ID or binding.", {
      code: "INVALID_INPUT",
    });
  }

  return {
    accountId,
    approvalHash,
    description,
    episodeHash,
    fullVideo,
    license,
    operation,
    privacy,
    thumbnail,
    title,
  };
}

function thumbnailContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if ([".jpg", ".jpeg"].includes(extension)) return "image/jpeg";
  if (extension === ".png") return "image/png";
  throw new VimeoAdapterError("Vimeo custom thumbnails must be JPEG or PNG files.", {
    code: "INVALID_INPUT",
  });
}

function transcodeStatus(body) {
  return body?.transcode?.status ?? body?.version_transcode_status ?? body?.status ?? null;
}

function providerErrorMessage(body) {
  if (!isPlainObject(body)) return null;
  return body.developer_message ?? body.error ?? body.message ?? null;
}

function stripCredential(value, token) {
  if (typeof value !== "string") return value;
  return token ? value.replaceAll(token, "[redacted]") : value;
}

function evidence(kind, value, details = {}) {
  return { kind, value, details };
}

function canonicalVideoUrl(videoId) {
  return `https://vimeo.com/${videoId}`;
}

function publicPlan(plan, stats) {
  const metadata = {
    name: plan.title,
    description: plan.description,
    privacy: { view: plan.privacy },
  };
  if (plan.license) metadata.license = plan.license;
  return {
    schemaVersion: 1,
    platform: "vimeo",
    apiVersion: VIMEO_API_VERSION,
    mode: "dry_run",
    writes: false,
    operation: plan.operation.kind,
    account: { expectedId: plan.accountId },
    asset: {
      role: "fullVideo",
      sizeBytes: stats.fullVideo.size,
      sha256: plan.fullVideo.sha256,
    },
    metadata,
    stagingMetadata: {
      privacy: { view: "nobody" },
      finalMetadataDeferred: true,
    },
    replacement: plan.operation.kind === "replace"
      ? { existingVideoId: plan.operation.existingVideoId, bindingVerified: true }
      : null,
    thumbnail: plan.thumbnail
      ? { supplied: true, sizeBytes: stats.thumbnail.size, contentType: thumbnailContentType(plan.thumbnail.path) }
      : { supplied: false },
    workflow: [
      "GET /me account binding",
      ...(plan.operation.kind === "replace"
        ? [
            `GET /videos/${plan.operation.existingVideoId} owner binding`,
            `POST /videos/${plan.operation.existingVideoId}/versions TUS replacement`,
          ]
        : ["POST /me/videos TUS placeholder"]),
      "PATCH TUS upload URL in resumable chunks",
      "poll Vimeo transcode status",
      ...(plan.thumbnail ? ["upload and activate custom thumbnail"] : []),
      "PATCH exact approved metadata and privacy as the final provider mutation",
      "GET final video and verify exact readback",
    ],
  };
}

export function createVimeoAdapter({
  fetchImpl = globalThis.fetch,
  fsImpl = fs,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  env = process.env,
  homeDir = env.HOME || os.homedir(),
  tokenPath = path.join(homeDir, ".config", "drm-publisher", "vimeo", "token"),
  apiBaseUrl = "https://api.vimeo.com",
  chunkSizeBytes = DEFAULT_VIMEO_CHUNK_SIZE_BYTES,
  transcodePollIntervalMs = 15_000,
  transcodeMaxPolls = 240,
  tusMaxRetries = 4,
  assetStagingRoot,
  stageAssetImpl = stageApprovedAsset,
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl must be a function.");
  if (!isPlainObject(fsImpl)) throw new TypeError("fsImpl must be an object.");
  if (typeof sleep !== "function") throw new TypeError("sleep must be a function.");
  if (typeof stageAssetImpl !== "function") throw new TypeError("stageAssetImpl must be a function.");
  if (!Number.isSafeInteger(chunkSizeBytes) || chunkSizeBytes < 1) {
    throw new TypeError("chunkSizeBytes must be a positive safe integer.");
  }
  if (!Number.isSafeInteger(transcodeMaxPolls) || transcodeMaxPolls < 1) {
    throw new TypeError("transcodeMaxPolls must be a positive safe integer.");
  }
  if (!Number.isSafeInteger(tusMaxRetries) || tusMaxRetries < 0) {
    throw new TypeError("tusMaxRetries must be a non-negative safe integer.");
  }
  const apiOrigin = new URL(apiBaseUrl);
  if (apiOrigin.protocol !== "https:" && apiOrigin.hostname !== "127.0.0.1" && apiOrigin.hostname !== "localhost") {
    throw new TypeError("apiBaseUrl must use HTTPS outside local tests.");
  }

  async function hashLocalFile(filePath, sizeBytes) {
    const handle = await fsImpl.open(filePath, "r");
    const hash = createHash("sha256");
    let offset = 0;
    try {
      while (offset < sizeBytes) {
        const length = Math.min(8 * 1024 * 1024, sizeBytes - offset);
        const buffer = Buffer.allocUnsafe(length);
        const read = await handle.read(buffer, 0, length, offset);
        if (read.bytesRead !== length) {
          throw new VimeoAdapterError("An approved asset ended before its expected size.", {
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

  async function inspectLocalFile(asset, label) {
    let stats;
    try {
      stats = await fsImpl.stat(asset.path);
    } catch (error) {
      throw new VimeoAdapterError(`${label} is not readable.`, { code: "ASSET_UNAVAILABLE", cause: error });
    }
    if (typeof stats.isFile === "function" && !stats.isFile()) {
      throw new VimeoAdapterError(`${label} is not a regular file.`, { code: "ASSET_UNAVAILABLE" });
    }
    if (!Number.isSafeInteger(stats.size) || stats.size < 1) {
      throw new VimeoAdapterError(`${label} has an invalid or empty size.`, { code: "ASSET_UNAVAILABLE" });
    }
    if (asset.sizeBytes != null && asset.sizeBytes !== stats.size) {
      throw new VimeoAdapterError(`${label} size no longer matches the approved snapshot.`, {
        code: "ASSET_CHANGED",
      });
    }
    if (asset.sha256 != null) {
      const actualSha256 = await hashLocalFile(asset.path, stats.size);
      if (actualSha256 !== asset.sha256) {
        throw new VimeoAdapterError(`${label} SHA-256 no longer matches the approved snapshot.`, {
          code: "ASSET_CHANGED",
        });
      }
    }
    return stats;
  }

  async function localPlan(input) {
    const plan = normalizeInput(input);
    const fullVideo = await inspectLocalFile(plan.fullVideo, "assets.fullVideo");
    if (fullVideo.size > MAX_VIDEO_BYTES) {
      throw new VimeoAdapterError("assets.fullVideo exceeds Vimeo's 300 GB API limit.", {
        code: "ASSET_TOO_LARGE",
      });
    }
    const thumbnail = plan.thumbnail
      ? await inspectLocalFile(plan.thumbnail, "assets.thumbnail")
      : null;
    if (plan.thumbnail) thumbnailContentType(plan.thumbnail.path);
    return { plan, stats: { fullVideo, thumbnail } };
  }

  async function stageUploadAsset(asset, stats, label) {
    let staged;
    try {
      staged = await stageAssetImpl(
        { path: asset.path, sha256: asset.sha256, sizeBytes: stats.size },
        { fsImpl, env, homeDir, rootDir: assetStagingRoot },
      );
    } catch (cause) {
      const changed = cause instanceof AssetStagingError &&
        /(?:SOURCE|REUSE|HASH|BINDING)/.test(cause.code);
      throw new VimeoAdapterError(`${label} could not be staged from its approved fingerprint.`, {
        code: changed ? "ASSET_CHANGED" : "ASSET_STAGING_FAILED",
        cause,
      });
    }
    if (!isPlainObject(staged) || typeof staged.path !== "string" ||
        staged.sha256 !== asset.sha256 || staged.sizeBytes !== stats.size ||
        path.resolve(staged.path) === path.resolve(asset.path)) {
      throw new VimeoAdapterError(`${label} staging did not return the exact private content-addressed asset.`, {
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

  async function stageAuthenticatedPlan(authenticated) {
    const fullVideo = await stageUploadAsset(
      authenticated.plan.fullVideo,
      authenticated.stats.fullVideo,
      "assets.fullVideo",
    );
    const thumbnail = authenticated.plan.thumbnail
      ? await stageUploadAsset(
          authenticated.plan.thumbnail,
          authenticated.stats.thumbnail,
          "assets.thumbnail",
        )
      : null;
    return {
      ...authenticated,
      plan: { ...authenticated.plan, fullVideo, thumbnail },
    };
  }

  async function loadToken() {
    const environmentToken = typeof env.VIMEO_ACCESS_TOKEN === "string"
      ? env.VIMEO_ACCESS_TOKEN.trim()
      : "";
    if (environmentToken) return { token: environmentToken, source: "environment" };
    let token;
    try {
      token = (await readSecureCredentialText(tokenPath, { fsImpl })).trim();
    } catch (error) {
      if (error instanceof SecureCredentialError && error.code !== "credential_missing") {
        throw new VimeoAdapterError(
          "The private Vimeo token must be a non-symlink regular file owned by the current user with mode 0600.",
          { code: "INSECURE_CREDENTIAL_FILE", cause: error },
        );
      }
      throw new VimeoAdapterError(
        "Vimeo access token is unavailable. Set VIMEO_ACCESS_TOKEN or create the private Vimeo token file.",
        { code: "AUTH_REQUIRED", cause: error },
      );
    }
    if (!token) {
      throw new VimeoAdapterError("The private Vimeo token file is empty.", { code: "AUTH_REQUIRED" });
    }
    return { token, source: "file" };
  }

  async function responseBody(response) {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { message: text.slice(0, 1000) };
    }
  }

  async function apiRequest({
    method,
    uri,
    token,
    body,
    expected = [],
    beforeWrite = null,
    writeStep = null,
  }) {
    const requestUri = safeApiUri(uri, "API request");
    if (["POST", "PATCH", "PUT", "DELETE"].includes(method) && typeof beforeWrite !== "function") {
      throw new VimeoAdapterError(`Vimeo ${method} ${requestUri} is missing its durable write gate.`, {
        code: "CHECKPOINT_RUNTIME_REQUIRED",
      });
    }
    const headers = {
      Accept: VIMEO_API_ACCEPT,
      Authorization: `bearer ${token}`,
    };
    const init = { method, headers };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    if (beforeWrite) await beforeWrite({ step: writeStep || `${method.toLowerCase()}_${requestUri}` });
    let response;
    try {
      response = await fetchImpl(new URL(requestUri, apiOrigin).href, init);
    } catch (error) {
      throw new VimeoAdapterError(`Vimeo ${method} ${requestUri} failed before a response.`, {
        code: "NETWORK_ERROR",
        cause: error,
        retryable: true,
      });
    }
    let parsed;
    try {
      parsed = await responseBody(response);
    } catch (error) {
      throw new VimeoAdapterError(`Vimeo ${method} ${requestUri} response could not be read.`, {
        code: "NETWORK_ERROR",
        cause: error,
        retryable: true,
      });
    }
    if (!response.ok || (expected.length && !expected.includes(response.status))) {
      const message = stripCredential(providerErrorMessage(parsed), token);
      throw new VimeoAdapterError(
        `Vimeo ${method} ${requestUri} returned HTTP ${response.status}${message ? `: ${message}` : "."}`,
        { code: "PROVIDER_ERROR", retryable: retryableHttpStatus(response.status), status: response.status },
      );
    }
    return { body: parsed, headers: response.headers, status: response.status };
  }

  async function verifyAccount(plan, token) {
    const response = await apiRequest({
      method: "GET",
      uri: withFields("/me", ["uri", "name", "link", "account"]),
      token,
      expected: [200],
    });
    const actualId = resourceId(response.body?.uri, "users");
    if (!actualId) {
      throw new VimeoAdapterError("Vimeo /me did not return a numeric user identity.", {
        code: "INVALID_PROVIDER_RESPONSE",
      });
    }
    if (actualId !== plan.accountId) {
      throw new VimeoAdapterError(
        `Authenticated Vimeo account ${actualId} does not match approved account ${plan.accountId}; no write was attempted.`,
        { code: "ACCOUNT_MISMATCH" },
      );
    }
    return {
      expectedId: plan.accountId,
      actualId,
      matched: true,
      uri: response.body.uri,
      name: response.body.name ?? null,
    };
  }

  const VIDEO_FIELDS = [
    "uri",
    "link",
    "name",
    "description",
    "privacy.view",
    "license",
    "status",
    "transcode.status",
    "pictures",
    "metadata.connections.pictures.uri",
    "user.uri",
  ];

  async function getVideo(videoId, token) {
    return (await apiRequest({
      method: "GET",
      uri: withFields(`/videos/${videoId}`, VIDEO_FIELDS),
      token,
      expected: [200],
    })).body;
  }

  function verifyVideoOwner(video, videoId, accountId) {
    const actualVideoId = resourceId(video?.uri, "videos");
    const ownerId = resourceId(video?.user?.uri, "users");
    if (actualVideoId !== videoId) {
      throw new VimeoAdapterError("Vimeo video readback did not match the requested video ID.", {
        code: "REMOTE_BINDING_MISMATCH",
      });
    }
    if (ownerId !== accountId) {
      throw new VimeoAdapterError(
        `Vimeo video ${videoId} is not bound to approved account ${accountId}; no write was attempted.`,
        { code: "REMOTE_BINDING_MISMATCH" },
      );
    }
    return { videoId: actualVideoId, ownerId };
  }

  async function authenticatedPreflight(local) {
    const credential = await loadToken();
    const account = await verifyAccount(local.plan, credential.token);
    let existingVideo = null;
    if (local.plan.operation.kind === "replace") {
      existingVideo = await getVideo(local.plan.operation.existingVideoId, credential.token);
      verifyVideoOwner(
        existingVideo,
        local.plan.operation.existingVideoId,
        local.plan.accountId,
      );
      if (local.plan.license == null && readbackLicense(existingVideo.license) != null) {
        throw new VimeoAdapterError(
          "The approved replacement requires All Rights Reserved, but the existing video has a Creative Commons license that the documented Vimeo edit API cannot clear safely.",
          { code: "UNSUPPORTED_RELEASE_CHOICE" },
        );
      }
    }
    return { ...local, account, credential, existingVideo };
  }

  function runtimeContract(runtime, { requireCheckpoint = false } = {}) {
    if (!isPlainObject(runtime) || typeof runtime.beforeWrite !== "function" ||
        typeof runtime.onCheckpoint !== "function") {
      throw new VimeoAdapterError(
        "Vimeo writes require controller-provided beforeWrite and onCheckpoint callbacks.",
        { code: "CHECKPOINT_RUNTIME_REQUIRED" },
      );
    }
    if (requireCheckpoint && !isPlainObject(runtime.checkpoint)) {
      throw new VimeoAdapterError(
        "A prior Vimeo write has no usable durable checkpoint; automatic replay is blocked.",
        { code: "AMBIGUOUS_PRIOR_WRITE" },
      );
    }
    return {
      beforeWrite: runtime.beforeWrite,
      checkpoint: runtime.checkpoint ?? null,
      onCheckpoint: runtime.onCheckpoint,
    };
  }

  function checkpointBase(plan, videoSize, {
    phase,
    videoId,
    tusUploadUrl,
    providerCreateStatus,
    versionUri = null,
  }) {
    return {
      schemaVersion: 1,
      protocolVersion: VIMEO_CHECKPOINT_PROTOCOL_VERSION,
      platform: "vimeo",
      phase,
      operation: plan.operation.kind,
      accountId: plan.accountId,
      approvalHash: plan.approvalHash,
      episodeHash: plan.episodeHash,
      assetSha256: plan.fullVideo.sha256,
      sizeBytes: videoSize,
      videoId,
      canonicalUrl: canonicalVideoUrl(videoId),
      tusUploadUrl,
      providerCreateStatus,
      versionUri,
    };
  }

  function checkpointAtLeast(checkpoint, phase) {
    return (CHECKPOINT_PHASE_ORDER.get(checkpoint.phase) ?? -1) >=
      (CHECKPOINT_PHASE_ORDER.get(phase) ?? Number.POSITIVE_INFINITY);
  }

  function validateCheckpoint(checkpoint, plan, videoSize) {
    if (!isPlainObject(checkpoint)) {
      throw new VimeoAdapterError(
        "A prior Vimeo write has no usable durable checkpoint; automatic replay is blocked.",
        { code: "AMBIGUOUS_PRIOR_WRITE" },
      );
    }
    const expected = {
      schemaVersion: 1,
      protocolVersion: VIMEO_CHECKPOINT_PROTOCOL_VERSION,
      platform: "vimeo",
      operation: plan.operation.kind,
      accountId: plan.accountId,
      approvalHash: plan.approvalHash,
      episodeHash: plan.episodeHash,
      assetSha256: plan.fullVideo.sha256,
      sizeBytes: videoSize,
    };
    const mismatches = Object.entries(expected)
      .filter(([, expectedValue]) => expectedValue != null)
      .filter(([key, expectedValue]) => checkpoint[key] !== expectedValue)
      .map(([key]) => key);
    if (mismatches.length) {
      throw new VimeoAdapterError(
        `Vimeo checkpoint does not match the approved operation: ${mismatches.join(", ")}.`,
        { code: "CHECKPOINT_BINDING_MISMATCH" },
      );
    }
    if (!CHECKPOINT_PHASES.has(checkpoint.phase)) {
      throw new VimeoAdapterError("Vimeo checkpoint has an unknown lifecycle phase.", {
        code: "INVALID_CHECKPOINT",
      });
    }
    if (!RESOURCE_ID.test(checkpoint.videoId ?? "")) {
      throw new VimeoAdapterError("Vimeo checkpoint does not contain a numeric video ID.", {
        code: "INVALID_CHECKPOINT",
      });
    }
    if (plan.operation.kind === "replace" && checkpoint.videoId !== plan.operation.existingVideoId) {
      throw new VimeoAdapterError("Vimeo replacement checkpoint targets a different video ID.", {
        code: "CHECKPOINT_BINDING_MISMATCH",
      });
    }
    if (checkpoint.canonicalUrl !== canonicalVideoUrl(checkpoint.videoId)) {
      throw new VimeoAdapterError("Vimeo checkpoint canonical URL does not match its video ID.", {
        code: "INVALID_CHECKPOINT",
      });
    }
    safeTusUploadUrl(checkpoint.tusUploadUrl);
    if (![200, 201].includes(checkpoint.providerCreateStatus)) {
      throw new VimeoAdapterError("Vimeo checkpoint provider status is invalid.", {
        code: "INVALID_CHECKPOINT",
      });
    }
    if (checkpoint.versionUri != null) {
      const versionUri = safeApiUri(checkpoint.versionUri, "checkpoint video version");
      if (!versionUri.startsWith(`/videos/${checkpoint.videoId}/versions/`)) {
        throw new VimeoAdapterError("Vimeo checkpoint version does not match its video ID.", {
          code: "CHECKPOINT_BINDING_MISMATCH",
        });
      }
    }
    if (checkpoint.thumbnail != null) {
      if (!isPlainObject(checkpoint.thumbnail)) {
        throw new VimeoAdapterError("Vimeo checkpoint thumbnail state is invalid.", {
          code: "INVALID_CHECKPOINT",
        });
      }
      const pictureUri = checkpoint.thumbnail.pictureUri;
      if (pictureUri != null) {
        const safePictureUri = safeApiUri(pictureUri, "checkpoint picture");
        if (!safePictureUri.startsWith(`/videos/${checkpoint.videoId}/pictures/`)) {
          throw new VimeoAdapterError("Vimeo checkpoint picture does not match its video ID.", {
            code: "CHECKPOINT_BINDING_MISMATCH",
          });
        }
      }
      if (checkpoint.thumbnail.uploadUrl != null) {
        safeThumbnailUploadUrl(checkpoint.thumbnail.uploadUrl);
      }
    }
    if (checkpointAtLeast(checkpoint, "upload_complete") &&
        (!isPlainObject(checkpoint.upload) || checkpoint.upload.approach !== "tus" ||
          checkpoint.upload.finalOffset !== videoSize || checkpoint.upload.sizeBytes !== videoSize)) {
      throw new VimeoAdapterError("Vimeo checkpoint does not prove a complete TUS upload.", {
        code: "INVALID_CHECKPOINT",
      });
    }
    if (checkpointAtLeast(checkpoint, "transcode_complete") &&
        (!isPlainObject(checkpoint.transcode) || !READY_TRANSCODE_STATUSES.has(checkpoint.transcode.status))) {
      throw new VimeoAdapterError("Vimeo checkpoint does not prove completed transcoding.", {
        code: "INVALID_CHECKPOINT",
      });
    }
    if (checkpoint.phase === "thumbnail_create_intent" && !checkpoint.thumbnail?.pictureUri) {
      throw new VimeoAdapterError(
        "A prior Vimeo thumbnail-create request has no durable picture identity; automatic replay is blocked.",
        { code: "AMBIGUOUS_THUMBNAIL_CREATE" },
      );
    }
    if (checkpointAtLeast(checkpoint, "thumbnail_resource_created") && plan.thumbnail &&
        (!checkpoint.thumbnail?.pictureUri || !checkpoint.thumbnail?.uploadUrl)) {
      throw new VimeoAdapterError("Vimeo thumbnail checkpoint is missing its resumable resource binding.", {
        code: "INVALID_CHECKPOINT",
      });
    }
    if (checkpointAtLeast(checkpoint, "thumbnail_complete") && plan.thumbnail &&
        checkpoint.thumbnail?.active !== true) {
      throw new VimeoAdapterError("Vimeo checkpoint does not prove thumbnail activation.", {
        code: "INVALID_CHECKPOINT",
      });
    }
    return structuredClone(checkpoint);
  }

  async function saveCheckpoint(runtime, checkpoint, {
    providerAccepted = false,
    summary,
  } = {}) {
    await runtime.onCheckpoint({
      checkpoint,
      providerAccepted,
      remoteId: checkpoint.videoId,
      remoteUrl: checkpoint.canonicalUrl,
      providerSummary: summary,
      summary,
    });
    return checkpoint;
  }

  async function headTus(uploadLink) {
    const link = safeTusUploadUrl(uploadLink);
    let response;
    try {
      response = await fetchImpl(link, {
        method: "HEAD",
        headers: { Accept: VIMEO_API_ACCEPT, "Tus-Resumable": VIMEO_TUS_VERSION },
      });
    } catch (error) {
      throw new VimeoAdapterError("Vimeo TUS offset check failed before a response.", {
        code: "NETWORK_ERROR",
        cause: error,
        retryable: true,
      });
    }
    if (!response.ok) {
      throw new VimeoAdapterError(`Vimeo TUS offset check returned HTTP ${response.status}.`, {
        code: "PROVIDER_ERROR",
        retryable: response.status === 409 || response.status === 423 || retryableHttpStatus(response.status),
        status: response.status,
      });
    }
    const offset = Number(response.headers.get("upload-offset"));
    const lengthHeader = response.headers.get("upload-length");
    const length = lengthHeader == null ? null : Number(lengthHeader);
    if (!Number.isSafeInteger(offset) || offset < 0 || (length != null && (!Number.isSafeInteger(length) || length < 0))) {
      throw new VimeoAdapterError("Vimeo TUS response contained invalid upload offsets.", {
        code: "INVALID_PROVIDER_RESPONSE",
      });
    }
    return { length, offset };
  }

  async function patchTus(uploadLink, offset, chunk, beforeWrite) {
    const link = safeTusUploadUrl(uploadLink);
    await beforeWrite({ step: `vimeo_tus_upload_offset_${offset}` });
    let response;
    try {
      response = await fetchImpl(link, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/offset+octet-stream",
          "Tus-Resumable": VIMEO_TUS_VERSION,
          "Upload-Offset": String(offset),
        },
        body: chunk,
      });
    } catch (error) {
      throw new VimeoAdapterError("Vimeo TUS chunk upload failed before a response.", {
        code: "NETWORK_ERROR",
        cause: error,
        retryable: true,
      });
    }
    if (!response.ok) {
      throw new VimeoAdapterError(`Vimeo TUS chunk upload returned HTTP ${response.status}.`, {
        code: "PROVIDER_ERROR",
        retryable: response.status === 409 || response.status === 423 || retryableHttpStatus(response.status),
        status: response.status,
      });
    }
    const nextOffset = Number(response.headers.get("upload-offset"));
    if (!Number.isSafeInteger(nextOffset) || nextOffset <= offset) {
      throw new VimeoAdapterError("Vimeo TUS chunk response did not advance the upload offset.", {
        code: "INVALID_PROVIDER_RESPONSE",
      });
    }
    return nextOffset;
  }

  async function uploadTus(filePath, uploadLink, sizeBytes, beforeWrite) {
    let state = await headTus(uploadLink);
    if (state.length !== sizeBytes) {
      throw new VimeoAdapterError("Vimeo TUS upload length does not match the approved file size.", {
        code: "REMOTE_BINDING_MISMATCH",
      });
    }
    if (state.offset > sizeBytes) {
      throw new VimeoAdapterError("Vimeo TUS upload offset exceeds the approved file size.", {
        code: "INVALID_PROVIDER_RESPONSE",
      });
    }

    const handle = await fsImpl.open(filePath, "r");
    let chunks = 0;
    let recoveries = 0;
    try {
      while (state.offset < sizeBytes) {
        const bytesToRead = Math.min(chunkSizeBytes, sizeBytes - state.offset);
        const buffer = Buffer.allocUnsafe(bytesToRead);
        const read = await handle.read(buffer, 0, bytesToRead, state.offset);
        if (read.bytesRead !== bytesToRead) {
          throw new VimeoAdapterError("assets.fullVideo ended before its approved size.", {
            code: "ASSET_CHANGED",
          });
        }
        try {
          const nextOffset = await patchTus(
            uploadLink,
            state.offset,
            buffer.subarray(0, read.bytesRead),
            beforeWrite,
          );
          if (nextOffset > sizeBytes) {
            throw new VimeoAdapterError("Vimeo TUS upload offset exceeds the approved file size.", {
              code: "INVALID_PROVIDER_RESPONSE",
            });
          }
          state.offset = nextOffset;
          chunks += 1;
          recoveries = 0;
        } catch (error) {
          if (!(error instanceof VimeoAdapterError) || (error.code !== "NETWORK_ERROR" && !error.retryable) || recoveries >= tusMaxRetries) {
            throw error;
          }
          recoveries += 1;
          await sleep(Math.min(1_000 * 2 ** (recoveries - 1), 8_000));
          state = await headTus(uploadLink);
          if (state.length !== sizeBytes) {
            throw new VimeoAdapterError("Vimeo TUS upload length changed during recovery.", {
              code: "REMOTE_BINDING_MISMATCH",
            });
          }
        }
      }
    } finally {
      await handle.close();
    }
    const verified = await headTus(uploadLink);
    if (verified.offset !== sizeBytes || verified.length !== sizeBytes) {
      throw new VimeoAdapterError("Vimeo did not confirm receipt of the complete video file.", {
        code: "UPLOAD_INCOMPLETE",
      });
    }
    return { approach: "tus", chunkCount: chunks, finalOffset: verified.offset, sizeBytes };
  }

  async function pollTranscode(uri, token) {
    const pollUri = safeApiUri(uri, "transcode polling");
    const isVersion = /^\/videos\/\d+\/versions\/[^/]+$/.test(pollUri);
    const fields = isVersion
      ? ["uri", "transcode.status", "version_transcode_status", "upload.status"]
      : ["uri", "status", "transcode.status"];
    let lastStatus = null;
    for (let poll = 1; poll <= transcodeMaxPolls; poll += 1) {
      const body = (await apiRequest({
        method: "GET",
        uri: withFields(pollUri, fields),
        token,
        expected: [200],
      })).body;
      lastStatus = transcodeStatus(body);
      if (READY_TRANSCODE_STATUSES.has(lastStatus)) {
        return { polls: poll, status: lastStatus, uri: body?.uri ?? pollUri };
      }
      if (FAILED_TRANSCODE_STATUSES.has(lastStatus)) {
        throw new VimeoAdapterError(`Vimeo transcoding failed with status ${lastStatus}.`, {
          code: "TRANSCODE_FAILED",
        });
      }
      if (poll < transcodeMaxPolls) await sleep(transcodePollIntervalMs);
    }
    throw new VimeoAdapterError(
      `Vimeo transcoding did not complete after ${transcodeMaxPolls} polls (last status: ${lastStatus ?? "unknown"}).`,
      { code: "TRANSCODE_TIMEOUT" },
    );
  }

  async function getPicture(pictureUri, token) {
    return (await apiRequest({
      method: "GET",
      uri: withFields(pictureUri, ["uri", "active", "type"]),
      token,
      expected: [200],
    })).body;
  }

  function verifyPicture(readback, pictureUri) {
    if (readback?.uri !== pictureUri || readback?.active !== true || readback?.type !== "custom") {
      throw new VimeoAdapterError("Vimeo custom thumbnail activation did not verify.", {
        code: "READBACK_MISMATCH",
      });
    }
  }

  async function uploadThumbnail(videoId, thumbnail, token, runtime, checkpoint) {
    const contentType = thumbnailContentType(thumbnail.sourcePath ?? thumbnail.path);
    const video = await getVideo(videoId, token);
    const picturesUri = safeApiUri(
      video?.metadata?.connections?.pictures?.uri ?? `/videos/${videoId}/pictures`,
      "pictures connection",
    );
    if (!picturesUri.startsWith(`/videos/${videoId}/pictures`)) {
      throw new VimeoAdapterError("Vimeo pictures connection did not match the target video.", {
        code: "REMOTE_BINDING_MISMATCH",
      });
    }

    let thumbnailState = checkpoint.thumbnail ?? null;
    if (checkpoint.phase === "thumbnail_create_intent" && !thumbnailState?.pictureUri) {
      throw new VimeoAdapterError(
        "A prior Vimeo thumbnail-create request has no durable picture identity; automatic replay is blocked.",
        { code: "AMBIGUOUS_THUMBNAIL_CREATE" },
      );
    }
    if (!thumbnailState?.pictureUri) {
      checkpoint = await saveCheckpoint(runtime, {
        ...checkpoint,
        phase: "thumbnail_create_intent",
        thumbnail: { state: "create_intent" },
      }, {
        summary: `Vimeo thumbnail creation is beginning for video ${videoId}.`,
      });
      const created = await apiRequest({
        method: "POST",
        uri: picturesUri,
        token,
        expected: [201],
        beforeWrite: runtime.beforeWrite,
        writeStep: "vimeo_create_thumbnail_resource",
      });
      const uploadUrl = safeThumbnailUploadUrl(created.body?.link);
      const pictureUri = safeApiUri(created.body?.uri, "picture");
      if (!pictureUri.startsWith(`/videos/${videoId}/pictures/`)) {
        throw new VimeoAdapterError("Vimeo picture resource did not match the target video.", {
          code: "REMOTE_BINDING_MISMATCH",
        });
      }
      thumbnailState = { pictureUri, state: "resource_created", uploadUrl };
      checkpoint = await saveCheckpoint(runtime, {
        ...checkpoint,
        phase: "thumbnail_resource_created",
        thumbnail: thumbnailState,
      }, {
        summary: `Vimeo created a custom thumbnail resource for video ${videoId}.`,
      });
    }

    const pictureUri = safeApiUri(thumbnailState.pictureUri, "picture");
    let readback = await getPicture(pictureUri, token);
    if (readback?.uri === pictureUri && readback?.active === true && readback?.type === "custom") {
      checkpoint = await saveCheckpoint(runtime, {
        ...checkpoint,
        phase: "thumbnail_complete",
        thumbnail: { ...thumbnailState, active: true, state: "complete" },
      }, {
        summary: `Vimeo custom thumbnail is active for video ${videoId}.`,
      });
      return {
        checkpoint,
        result: { active: true, contentType, supplied: true, type: "custom", uri: pictureUri },
      };
    }

    if (!thumbnailState.uploadUrl) {
      throw new VimeoAdapterError(
        "Vimeo thumbnail checkpoint has no resumable upload URL and the picture is not active.",
        { code: "INVALID_CHECKPOINT" },
      );
    }
    const image = await fsImpl.readFile(thumbnail.path);
    if (thumbnail.sizeBytes != null && image.length !== thumbnail.sizeBytes) {
      throw new VimeoAdapterError("assets.thumbnail changed after preflight.", {
        code: "ASSET_CHANGED",
      });
    }
    const thumbnailUploadUrl = safeThumbnailUploadUrl(thumbnailState.uploadUrl);
    await runtime.beforeWrite({ step: "vimeo_upload_thumbnail_bytes" });
    let uploaded;
    try {
      uploaded = await fetchImpl(thumbnailUploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: image,
      });
    } catch (error) {
      throw new VimeoAdapterError("Vimeo thumbnail upload failed before a response.", {
        code: "NETWORK_ERROR",
        cause: error,
        retryable: true,
      });
    }
    if (!uploaded.ok) {
      throw new VimeoAdapterError(`Vimeo thumbnail upload returned HTTP ${uploaded.status}.`, {
        code: "PROVIDER_ERROR",
        retryable: retryableHttpStatus(uploaded.status),
        status: uploaded.status,
      });
    }
    thumbnailState = { ...thumbnailState, state: "uploaded" };
    checkpoint = await saveCheckpoint(runtime, {
      ...checkpoint,
      phase: "thumbnail_uploaded",
      thumbnail: thumbnailState,
    }, {
      summary: `Vimeo received the custom thumbnail bytes for video ${videoId}.`,
    });

    await apiRequest({
      method: "PATCH",
      uri: pictureUri,
      token,
      body: { active: true },
      expected: [200],
      beforeWrite: runtime.beforeWrite,
      writeStep: "vimeo_activate_thumbnail",
    });
    readback = await getPicture(pictureUri, token);
    verifyPicture(readback, pictureUri);
    checkpoint = await saveCheckpoint(runtime, {
      ...checkpoint,
      phase: "thumbnail_complete",
      thumbnail: { ...thumbnailState, active: true, state: "complete" },
    }, {
      summary: `Vimeo custom thumbnail is active for video ${videoId}.`,
    });
    return {
      checkpoint,
      result: { active: true, contentType, supplied: true, type: "custom", uri: pictureUri },
    };
  }

  function finalMetadataBody(plan) {
    const body = {
      name: plan.title,
      description: plan.description,
      privacy: { view: plan.privacy },
    };
    if (plan.license) body.license = plan.license;
    return body;
  }

  function initialCreateBody(sizeBytes) {
    return {
      privacy: { view: "nobody" },
      upload: { approach: "tus", size: sizeBytes },
    };
  }

  function finalMetadataMatches(video, plan) {
    return video?.name === plan.title &&
      video?.description === plan.description &&
      video?.privacy?.view === plan.privacy &&
      readbackLicense(video?.license) === plan.license;
  }

  function verifyFinalReadback(video, plan, videoId, thumbnail) {
    const link = safeHttpsUrl(video?.link, "video");
    const linkedUrl = new URL(link);
    const mismatches = [];
    const actualId = resourceId(video?.uri, "videos");
    const ownerId = resourceId(video?.user?.uri, "users");
    if (actualId !== videoId) mismatches.push("id");
    if (ownerId !== plan.accountId) mismatches.push("owner");
    if (video?.name !== plan.title) mismatches.push("name");
    if (video?.description !== plan.description) mismatches.push("description");
    if (video?.privacy?.view !== plan.privacy) mismatches.push("privacy.view");
    if (readbackLicense(video?.license) !== plan.license) mismatches.push("license");
    if (!READY_TRANSCODE_STATUSES.has(transcodeStatus(video))) mismatches.push("transcode.status");
    if (!/(^|\.)vimeo\.com$/i.test(linkedUrl.hostname) || !linkedUrl.pathname.split("/").includes(videoId)) {
      mismatches.push("link");
    }
    if (thumbnail?.supplied && thumbnail.active !== true) mismatches.push("thumbnail");
    if (mismatches.length) {
      throw new VimeoAdapterError(`Vimeo final readback differs from approval: ${mismatches.join(", ")}.`, {
        code: "READBACK_MISMATCH",
      });
    }
    return {
      description: video.description,
      id: videoId,
      license: readbackLicense(video.license),
      name: video.name,
      ownerId,
      privacy: { view: video.privacy.view },
      status: video.status ?? null,
      transcodeStatus: video.transcode?.status ?? null,
      providerLink: link,
      url: canonicalVideoUrl(videoId),
    };
  }

  async function dryRun(input) {
    const local = await localPlan(input);
    return publicPlan(local.plan, local.stats);
  }

  async function preflight(input) {
    const authenticated = await authenticatedPreflight(await localPlan(input));
    const plan = publicPlan(authenticated.plan, authenticated.stats);
    return {
      ...plan,
      mode: "preflight",
      credentials: { present: true, source: authenticated.credential.source },
      account: authenticated.account,
      existingVideo: authenticated.existingVideo
        ? {
            id: resourceId(authenticated.existingVideo.uri, "videos"),
            ownerId: resourceId(authenticated.existingVideo.user?.uri, "users"),
            url: authenticated.existingVideo.link ?? null,
          }
        : null,
      evidence: [
        evidence(
          "authenticated_readback",
          `Authenticated Vimeo user ${authenticated.account.actualId} matched the approved destination.`,
          { accountId: authenticated.account.actualId, matched: true },
        ),
        ...(authenticated.existingVideo
          ? [evidence(
              "api_readback",
              `Existing Vimeo video ${authenticated.plan.operation.existingVideoId} is owned by the approved destination.`,
              {
                accountId: authenticated.account.actualId,
                remoteId: authenticated.plan.operation.existingVideoId,
              },
            )]
          : []),
      ],
    };
  }

  async function createProviderSession(authenticated, runtime) {
    const { credential, plan, stats } = authenticated;
    const token = credential.token;
    const videoSize = stats.fullVideo.size;
    let created;
    let videoId;
    let versionUri = null;

    if (plan.operation.kind === "create") {
      created = await apiRequest({
        method: "POST",
        uri: "/me/videos",
        token,
        body: initialCreateBody(videoSize),
        expected: [200, 201],
        beforeWrite: runtime.beforeWrite,
        writeStep: "vimeo_create_private_video",
      });
      videoId = resourceId(created.body?.uri, "videos");
      if (!videoId) {
        throw new VimeoAdapterError("Vimeo did not return a video ID for the new upload.", {
          code: "INVALID_PROVIDER_RESPONSE",
        });
      }
    } else {
      videoId = plan.operation.existingVideoId;
      created = await apiRequest({
        method: "POST",
        uri: `/videos/${videoId}/versions`,
        token,
        body: {
          file_name: path.basename(plan.fullVideo.sourcePath ?? plan.fullVideo.path),
          upload: { status: "in_progress", size: videoSize, approach: "tus" },
        },
        expected: [200, 201],
        beforeWrite: runtime.beforeWrite,
        writeStep: "vimeo_create_replacement_version",
      });
      if (created.body?.uri != null) {
        versionUri = safeApiUri(created.body.uri, "video version");
        if (!versionUri.startsWith(`/videos/${videoId}/versions/`)) {
          throw new VimeoAdapterError("Vimeo replacement version did not match the bound video.", {
            code: "REMOTE_BINDING_MISMATCH",
          });
        }
      }
    }
    if (created.body?.upload?.approach !== "tus") {
      throw new VimeoAdapterError("Vimeo did not create the required TUS upload session.", {
        code: "INVALID_PROVIDER_RESPONSE",
      });
    }
    const tusUploadUrl = safeTusUploadUrl(created.body?.upload?.upload_link);
    const checkpoint = checkpointBase(plan, videoSize, {
      phase: "provider_accepted",
      videoId,
      tusUploadUrl,
      providerCreateStatus: created.status,
      versionUri,
    });
    return saveCheckpoint(runtime, checkpoint, {
      providerAccepted: true,
      summary: `Vimeo accepted the ${plan.operation.kind} TUS resource for video ${videoId}.`,
    });
  }

  async function verifyCheckpointThumbnail(checkpoint, token, thumbnail) {
    const pictureUri = checkpoint.thumbnail?.pictureUri;
    if (!pictureUri) {
      throw new VimeoAdapterError("Vimeo final checkpoint is missing its thumbnail identity.", {
        code: "INVALID_CHECKPOINT",
      });
    }
    const readback = await getPicture(pictureUri, token);
    verifyPicture(readback, pictureUri);
    return {
      active: true,
      contentType: thumbnailContentType(thumbnail.sourcePath ?? thumbnail.path),
      supplied: true,
      type: "custom",
      uri: pictureUri,
    };
  }

  function buildResult({ account, checkpoint, plan, remote, thumbnail, transcode, upload, videoSize }) {
    const videoId = checkpoint.videoId;
    const versionUri = checkpoint.versionUri ?? null;
    const operationId = plan.operation.kind === "replace"
      ? `vimeo:replace:${videoId}:${versionUri?.split("/").at(-1) ?? plan.fullVideo.sha256.slice(0, 16)}`
      : `vimeo:create:${videoId}`;
    return {
      schemaVersion: 1,
      platform: "vimeo",
      apiVersion: VIMEO_API_VERSION,
      outcome: "verified",
      operation: plan.operation.kind,
      operationId,
      account,
      asset: {
        role: "fullVideo",
        sha256: plan.fullVideo.sha256,
        sizeBytes: videoSize,
      },
      provider: {
        placeholderStatus: checkpoint.providerCreateStatus ?? null,
        versionUri,
      },
      upload,
      transcode,
      thumbnail,
      remote,
      verification: {
        accountMatched: true,
        metadataMatched: true,
        ownerMatched: true,
        thumbnailMatched: !plan.thumbnail || thumbnail.active === true,
        transcodeComplete: true,
      },
      evidence: [
        evidence(
          "authenticated_readback",
          `Authenticated Vimeo user ${account.actualId} matched the approved destination.`,
          { accountId: account.actualId, matched: true },
        ),
        evidence(
          "provider_response",
          `Vimeo accepted the ${plan.operation.kind} TUS resource for video ${videoId}.`,
          {
            operation: plan.operation.kind,
            remoteId: videoId,
            status: checkpoint.providerCreateStatus ?? null,
            versionUri,
          },
        ),
        evidence(
          "processing_status",
          `Vimeo TUS upload reached ${upload.finalOffset} of ${upload.sizeBytes} bytes and transcoding completed.`,
          { ...upload, transcodePolls: transcode.polls, transcodeStatus: transcode.status },
        ),
        ...(plan.thumbnail
          ? [evidence(
              "api_readback",
              `Vimeo custom thumbnail ${thumbnail.uri} is active.`,
              { active: true, remoteId: videoId, type: thumbnail.type, uri: thumbnail.uri },
            )]
          : []),
        evidence(
          "api_readback",
          `Vimeo video ${videoId} matched the approved title, description, privacy, license, owner, and completed transcode state.`,
          remote,
        ),
      ],
    };
  }

  async function continueProviderSession(authenticated, runtime, initialCheckpoint) {
    const { account, credential, plan, stats } = authenticated;
    const token = credential.token;
    const videoSize = stats.fullVideo.size;
    let checkpoint = validateCheckpoint(initialCheckpoint, plan, videoSize);
    const videoId = checkpoint.videoId;
    let video = await getVideo(videoId, token);
    verifyVideoOwner(video, videoId, plan.accountId);

    if (checkpoint.phase === "final_metadata_applied" && finalMetadataMatches(video, plan)) {
      const thumbnail = plan.thumbnail
        ? await verifyCheckpointThumbnail(checkpoint, token, plan.thumbnail)
        : { supplied: false };
      const remote = verifyFinalReadback(video, plan, videoId, thumbnail);
      return buildResult({
        account,
        checkpoint,
        plan,
        remote,
        thumbnail,
        transcode: checkpoint.transcode ?? { polls: 0, status: transcodeStatus(video), uri: `/videos/${videoId}` },
        upload: checkpoint.upload ?? { approach: "tus", chunkCount: 0, finalOffset: videoSize, sizeBytes: videoSize },
        videoSize,
      });
    }

    if (video?.privacy?.view !== "nobody") {
      await apiRequest({
        method: "PATCH",
        uri: `/videos/${videoId}`,
        token,
        body: { privacy: { view: "nobody" } },
        expected: [200],
        beforeWrite: runtime.beforeWrite,
        writeStep: "vimeo_stage_private_visibility",
      });
    }
    if ((CHECKPOINT_PHASE_ORDER.get(checkpoint.phase) ?? -1) < CHECKPOINT_PHASE_ORDER.get("upload_complete")) {
      checkpoint = await saveCheckpoint(runtime, {
        ...checkpoint,
        phase: "private_staged",
      }, {
        summary: `Vimeo video ${videoId} is staged with private visibility.`,
      });
    }

    const upload = await uploadTus(
      plan.fullVideo.path,
      checkpoint.tusUploadUrl,
      videoSize,
      runtime.beforeWrite,
    );
    checkpoint = await saveCheckpoint(runtime, {
      ...checkpoint,
      phase: "upload_complete",
      upload,
    }, {
      summary: `Vimeo received all ${videoSize} approved video bytes for video ${videoId}.`,
    });

    const transcodeUri = checkpoint.versionUri ?? `/videos/${videoId}`;
    const transcode = await pollTranscode(transcodeUri, token);
    checkpoint = await saveCheckpoint(runtime, {
      ...checkpoint,
      phase: "transcode_complete",
      transcode,
    }, {
      summary: `Vimeo transcoding completed for video ${videoId}.`,
    });

    let thumbnail = { supplied: false };
    if (plan.thumbnail) {
      const uploadedThumbnail = await uploadThumbnail(
        videoId,
        plan.thumbnail,
        token,
        runtime,
        checkpoint,
      );
      checkpoint = uploadedThumbnail.checkpoint;
      thumbnail = uploadedThumbnail.result;
    }

    video = await getVideo(videoId, token);
    verifyVideoOwner(video, videoId, plan.accountId);
    await apiRequest({
      method: "PATCH",
      uri: `/videos/${videoId}`,
      token,
      body: finalMetadataBody(plan),
      expected: [200],
      beforeWrite: runtime.beforeWrite,
      writeStep: "vimeo_apply_final_metadata_and_visibility",
    });
    checkpoint = await saveCheckpoint(runtime, {
      ...checkpoint,
      phase: "final_metadata_applied",
      finalMetadataApplied: true,
    }, {
      summary: `Vimeo applied the approved final metadata and visibility to video ${videoId}.`,
    });

    const finalVideo = await getVideo(videoId, token);
    const remote = verifyFinalReadback(finalVideo, plan, videoId, thumbnail);
    return buildResult({
      account,
      checkpoint,
      plan,
      remote,
      thumbnail,
      transcode,
      upload,
      videoSize,
    });
  }

  async function publish(input, runtimeInput) {
    const local = await localPlan(input);
    const runtime = runtimeContract(runtimeInput);
    if (runtime.checkpoint != null) {
      throw new VimeoAdapterError(
        "Vimeo publish cannot create while a provider checkpoint exists; use reconcile instead.",
        { code: "RECONCILIATION_REQUIRED" },
      );
    }
    const authenticated = await stageAuthenticatedPlan(await authenticatedPreflight(local));
    const checkpoint = await createProviderSession(authenticated, runtime);
    return continueProviderSession(authenticated, runtime, checkpoint);
  }

  async function reconcile(input, runtimeInput) {
    const local = await localPlan(input);
    const runtime = runtimeContract(runtimeInput, { requireCheckpoint: true });
    const checkpoint = validateCheckpoint(runtime.checkpoint, local.plan, local.stats.fullVideo.size);
    const authenticated = await stageAuthenticatedPlan(await authenticatedPreflight(local));
    return continueProviderSession(authenticated, runtime, checkpoint);
  }

  return Object.freeze({
    checkpointProtocolVersion: VIMEO_CHECKPOINT_PROTOCOL_VERSION,
    dryRun,
    preflight,
    publish,
    reconcile,
  });
}

export default createVimeoAdapter;
