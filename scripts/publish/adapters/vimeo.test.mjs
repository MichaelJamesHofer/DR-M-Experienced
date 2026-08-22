import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createVimeoAdapter, VimeoAdapterError } from "./vimeo.mjs";

const ACCOUNT_ID = "253415660";
const APPROVAL_HASH = "a".repeat(64);
const EPISODE_HASH = "b".repeat(64);
const TOKEN = "test-vimeo-token-never-returned";
const VIDEO_PATH = "/approved/episode.mp4";
const THUMB_PATH = "/approved/thumbnail.jpg";
const VIDEO_BYTES = Buffer.from("abcdefghij");
const THUMB_BYTES = Buffer.from("jpeg-thumbnail");
const VIDEO_SHA = createHash("sha256").update(VIDEO_BYTES).digest("hex");
const THUMB_SHA = createHash("sha256").update(THUMB_BYTES).digest("hex");
const STAGED_VIDEO_PATH = `/private/sha256/${VIDEO_SHA}`;
const STAGED_THUMB_PATH = `/private/sha256/${THUMB_SHA}`;

async function stageAssetForTest(asset) {
  const stagedPath = asset.sha256 === VIDEO_SHA ? STAGED_VIDEO_PATH : STAGED_THUMB_PATH;
  return { path: stagedPath, sha256: asset.sha256, sizeBytes: asset.sizeBytes, reused: false };
}

function responseJson(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function responseEmpty(status = 204, headers = {}) {
  return new Response(null, { status, headers });
}

function memoryFs({ token = TOKEN, accessedPaths = null } = {}) {
  const files = new Map([
    [VIDEO_PATH, VIDEO_BYTES],
    [THUMB_PATH, THUMB_BYTES],
    [STAGED_VIDEO_PATH, VIDEO_BYTES],
    [STAGED_THUMB_PATH, THUMB_BYTES],
  ]);
  const tokenStats = {
    ctimeMs: 1,
    dev: 1,
    ino: 99,
    isFile: () => true,
    isSymbolicLink: () => false,
    mode: 0o100600,
    mtimeMs: 1,
    size: token.length + 1,
    uid: process.getuid(),
  };
  return {
    async lstat(filePath) {
      if (filePath.endsWith("/.config/drm-publisher/vimeo/token")) return tokenStats;
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    },
    async stat(filePath) {
      if (filePath.endsWith("/.config/drm-publisher/vimeo/token")) {
        return tokenStats;
      }
      const value = files.get(filePath);
      if (!value) throw Object.assign(new Error("missing"), { code: "ENOENT" });
      return { size: value.length, isFile: () => true };
    },
    async readFile(filePath, encoding) {
      accessedPaths?.push(filePath);
      if (filePath.endsWith("/.config/drm-publisher/vimeo/token")) {
        return encoding === "utf8" ? `${token}\n` : Buffer.from(`${token}\n`);
      }
      const value = files.get(filePath);
      if (!value) throw Object.assign(new Error("missing"), { code: "ENOENT" });
      return encoding ? value.toString(encoding) : Buffer.from(value);
    },
    async open(filePath) {
      accessedPaths?.push(filePath);
      if (filePath.endsWith("/.config/drm-publisher/vimeo/token")) {
        return {
          async close() {},
          async readFile(options) {
            return options?.encoding === "utf8" ? `${token}\n` : Buffer.from(`${token}\n`);
          },
          async stat() {
            return tokenStats;
          },
        };
      }
      const value = files.get(filePath);
      if (!value) throw Object.assign(new Error("missing"), { code: "ENOENT" });
      return {
        async read(buffer, offset, length, position) {
          const bytesRead = value.copy(buffer, offset, position, position + length);
          return { buffer, bytesRead };
        },
        async close() {},
      };
    },
  };
}

function approvedInput({
  operation = "create",
  existingVideoId = null,
  approvedBinding = null,
  thumbnail = false,
  license = "none",
  releaseMode = "publish_now",
  initialVisibility = "nobody",
  finalVisibility = "anybody",
} = {}) {
  return {
    packet: {
      approvalHash: APPROVAL_HASH,
      snapshot: {
        catalogBinding: { episodeHash: EPISODE_HASH },
        manifest: {
          title: "Approved Vimeo title",
          description: "Canonical HTML is projected before the adapter.",
        },
        assets: {
          fullVideo: {
            path: VIDEO_PATH,
            sizeBytes: VIDEO_BYTES.length,
            sha256: VIDEO_SHA,
          },
          thumbnail: thumbnail
            ? { path: THUMB_PATH, sizeBytes: THUMB_BYTES.length, sha256: THUMB_SHA }
            : null,
        },
        targets: [
          {
            id: "vimeo",
            assetSha256: VIDEO_SHA,
            approvedCopy: "Exact approved Vimeo description.",
            destinationIds: { accountId: ACCOUNT_ID, containerId: null },
            releasePlan: {
              releaseMode,
              initialVisibility,
              finalVisibility,
              license,
              monetization: "unchanged",
              notifications: "disabled",
            },
          },
        ],
      },
    },
    operation: {
      kind: operation,
      existingVideoId,
      approvedBinding,
    },
  };
}

function meBody(id = ACCOUNT_ID) {
  return { uri: `/users/${id}`, name: "Dr. M Experienced", link: "https://vimeo.com/drmexperienced" };
}

function videoBody({
  id,
  license = null,
  name = "Approved Vimeo title",
  description = "Exact approved Vimeo description.",
  privacy = "anybody",
  status = "available",
  transcode = "complete",
} = {}) {
  return {
    uri: `/videos/${id}`,
    link: `https://vimeo.com/${id}`,
    name,
    description,
    privacy: { view: privacy },
    license,
    status,
    transcode: { status: transcode },
    user: { uri: `/users/${ACCOUNT_ID}` },
    metadata: { connections: { pictures: { uri: `/videos/${id}/pictures` } } },
  };
}

function runtimeHarness({ checkpoint = null, afterCheckpoint = null } = {}) {
  let latestCheckpoint = checkpoint == null ? null : structuredClone(checkpoint);
  const checkpoints = [];
  const writes = [];
  return {
    checkpoints,
    get checkpoint() {
      return latestCheckpoint;
    },
    runtime: {
      checkpoint,
      async beforeWrite({ step }) {
        writes.push(step);
      },
      async onCheckpoint(event) {
        latestCheckpoint = structuredClone(event.checkpoint);
        checkpoints.push(structuredClone(event));
        await afterCheckpoint?.(event);
      },
    },
    writes,
  };
}

test("dryRun validates the immutable local plan without loading credentials or using the network", async () => {
  let fetchCount = 0;
  let tokenRead = false;
  const baseFs = memoryFs();
  const adapter = createVimeoAdapter({
    fetchImpl: async () => {
      fetchCount += 1;
      throw new Error("network must not be used");
    },
    fsImpl: {
      ...baseFs,
      async readFile(filePath, encoding) {
        if (filePath.endsWith("/token")) tokenRead = true;
        return baseFs.readFile(filePath, encoding);
      },
    },
    env: {},
    homeDir: "/home/test",
  });

  const result = await adapter.dryRun(approvedInput({ thumbnail: true }));

  assert.equal(result.mode, "dry_run");
  assert.equal(result.writes, false);
  assert.equal(result.account.expectedId, ACCOUNT_ID);
  assert.equal(result.asset.sizeBytes, VIDEO_BYTES.length);
  assert.equal(result.thumbnail.contentType, "image/jpeg");
  assert.equal(fetchCount, 0);
  assert.equal(tokenRead, false);
  assert.ok(!JSON.stringify(result).includes(TOKEN));
});

test("preflight loads the private token file and returns only its non-secret source", async () => {
  const calls = [];
  const adapter = createVimeoAdapter({
    fetchImpl: async (url, init) => {
      calls.push({ init, url });
      return responseJson(meBody());
    },
    fsImpl: memoryFs(),
    env: {},
    homeDir: "/home/test",
  });

  const result = await adapter.preflight(approvedInput());

  assert.equal(result.credentials.source, "file");
  assert.equal(result.account.matched, true);
  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0].url).pathname, "/me");
  assert.equal(calls[0].init.method, "GET");
  assert.ok(!JSON.stringify(result).includes(TOKEN));
});

test("Vimeo transport and 408, 429, and 5xx responses are retryable", async () => {
  const transportAdapter = createVimeoAdapter({
    fetchImpl: async () => { throw new TypeError("socket reset"); },
    fsImpl: memoryFs(),
    env: { VIMEO_ACCESS_TOKEN: TOKEN },
  });
  await assert.rejects(transportAdapter.preflight(approvedInput()), (error) => {
    assert.ok(error instanceof VimeoAdapterError);
    assert.equal(error.code, "NETWORK_ERROR");
    assert.equal(error.retryable, true);
    return true;
  });

  for (const status of [408, 429, 500, 502, 503, 599]) {
    const adapter = createVimeoAdapter({
      fetchImpl: async () => responseJson({ error: "transient" }, status),
      fsImpl: memoryFs(),
      env: { VIMEO_ACCESS_TOKEN: TOKEN },
    });
    await assert.rejects(adapter.preflight(approvedInput()), (error) => {
      assert.ok(error instanceof VimeoAdapterError);
      assert.equal(error.code, "PROVIDER_ERROR");
      assert.equal(error.status, status);
      assert.equal(error.retryable, true);
      return true;
    });
  }
});

test("Vimeo auth, policy, binding, and terminal HTTP errors are not retryable", async () => {
  for (const status of [400, 401, 403, 404, 409, 422]) {
    const adapter = createVimeoAdapter({
      fetchImpl: async () => responseJson({ error: "terminal" }, status),
      fsImpl: memoryFs(),
      env: { VIMEO_ACCESS_TOKEN: TOKEN },
    });
    await assert.rejects(adapter.preflight(approvedInput()), (error) => {
      assert.ok(error instanceof VimeoAdapterError);
      assert.equal(error.code, "PROVIDER_ERROR");
      assert.equal(error.status, status);
      assert.equal(error.retryable, false);
      return true;
    });
  }

  const mismatchAdapter = createVimeoAdapter({
    fetchImpl: async () => responseJson(meBody("999999")),
    fsImpl: memoryFs(),
    env: { VIMEO_ACCESS_TOKEN: TOKEN },
  });
  await assert.rejects(mismatchAdapter.preflight(approvedInput()), (error) => {
    assert.equal(error.code, "ACCOUNT_MISMATCH");
    assert.equal(error.retryable, false);
    return true;
  });
});

test("publish blocks an authenticated account mismatch before any write", async () => {
  const calls = [];
  const adapter = createVimeoAdapter({
    fetchImpl: async (url, init) => {
      calls.push({ method: init.method, url });
      return responseJson(meBody("999999"));
    },
    fsImpl: memoryFs(),
    env: { VIMEO_ACCESS_TOKEN: TOKEN },
  });
  const lifecycle = runtimeHarness();

  await assert.rejects(
    adapter.publish(approvedInput(), lifecycle.runtime),
    (error) => error instanceof VimeoAdapterError && error.code === "ACCOUNT_MISMATCH",
  );
  assert.deepEqual(calls.map((call) => call.method), ["GET"]);
  assert.deepEqual(lifecycle.writes, []);
});

test("publish creates a TUS video, uploads chunks, activates a thumbnail, and verifies exact readback", async () => {
  const calls = [];
  const uploadedChunks = [];
  const sleeps = [];
  let tusOffset = 0;
  let headCount = 0;
  let pollCount = 0;
  let thumbnailActive = false;
  let thumbnailUploaded = false;
  let state = {
    description: "",
    license: null,
    name: "Untitled",
    privacy: "nobody",
  };
  const accessedPaths = [];
  const videoId = "123456789";
  const pictureUri = `/videos/${videoId}/pictures/987654321`;

  const adapter = createVimeoAdapter({
    chunkSizeBytes: 4,
    env: { VIMEO_ACCESS_TOKEN: TOKEN },
    fsImpl: memoryFs({ accessedPaths }),
    stageAssetImpl: stageAssetForTest,
    sleep: async (milliseconds) => sleeps.push(milliseconds),
    fetchImpl: async (urlValue, init) => {
      const url = new URL(urlValue);
      calls.push({ body: init.body, headers: init.headers, method: init.method, url: url.href });
      if (url.hostname === "api.vimeo.com" && url.pathname === "/me") {
        return responseJson(meBody());
      }
      if (url.hostname === "api.vimeo.com" && url.pathname === "/me/videos" && init.method === "POST") {
        return responseJson({
          uri: `/videos/${videoId}`,
          upload: { approach: "tus", upload_link: "https://files.tus.vimeo.com/upload/create-1" },
        });
      }
      if (url.hostname === "files.tus.vimeo.com" && init.method === "HEAD") {
        headCount += 1;
        return responseEmpty(200, {
          "Upload-Length": String(VIDEO_BYTES.length),
          "Upload-Offset": String(tusOffset),
        });
      }
      if (url.hostname === "files.tus.vimeo.com" && init.method === "PATCH") {
        const body = Buffer.from(init.body);
        assert.equal(init.headers["Upload-Offset"], String(tusOffset));
        uploadedChunks.push(body);
        tusOffset += body.length;
        return responseEmpty(204, { "Upload-Offset": String(tusOffset) });
      }
      if (url.hostname === "api.vimeo.com" && url.pathname === `/videos/${videoId}`) {
        const fields = url.searchParams.get("fields");
        if (init.method === "GET" && fields === "uri,status,transcode.status") {
          pollCount += 1;
          return responseJson({
            uri: `/videos/${videoId}`,
            status: pollCount === 1 ? "transcoding" : "available",
            transcode: { status: pollCount === 1 ? "in_progress" : "complete" },
          });
        }
        if (init.method === "PATCH") {
          const body = JSON.parse(init.body);
          state = {
            description: body.description ?? state.description,
            license: body.license ?? state.license,
            name: body.name ?? state.name,
            privacy: body.privacy?.view ?? state.privacy,
          };
          return responseJson(videoBody({ id: videoId, ...state }));
        }
        return responseJson(videoBody({ id: videoId, ...state }));
      }
      if (url.hostname === "api.vimeo.com" && url.pathname === `/videos/${videoId}/pictures` && init.method === "POST") {
        return responseJson({ uri: pictureUri, link: "https://pictures.vimeo.com/upload/picture-1" }, 201);
      }
      if (url.hostname === "pictures.vimeo.com" && init.method === "PUT") {
        assert.deepEqual(Buffer.from(init.body), THUMB_BYTES);
        assert.equal(init.headers["Content-Type"], "image/jpeg");
        thumbnailUploaded = true;
        return responseEmpty(200);
      }
      if (url.hostname === "api.vimeo.com" && url.pathname === pictureUri && init.method === "PATCH") {
        assert.deepEqual(JSON.parse(init.body), { active: true });
        assert.equal(thumbnailUploaded, true);
        thumbnailActive = true;
        return responseJson({ uri: pictureUri, active: true, type: "custom" });
      }
      if (url.hostname === "api.vimeo.com" && url.pathname === pictureUri && init.method === "GET") {
        return responseJson({
          uri: pictureUri,
          active: thumbnailActive,
          type: "custom",
        });
      }
      throw new Error(`Unexpected ${init.method} ${url.href}`);
    },
  });
  const lifecycle = runtimeHarness();

  assert.equal(adapter.checkpointProtocolVersion, 1);
  const result = await adapter.publish(approvedInput({ thumbnail: true }), lifecycle.runtime);

  const createCall = calls.find((call) => new URL(call.url).pathname === "/me/videos");
  const createBody = JSON.parse(createCall.body);
  assert.deepEqual(createBody, {
    privacy: { view: "nobody" },
    upload: { approach: "tus", size: VIDEO_BYTES.length },
  });
  const mutatingCalls = calls.filter((call) => ["POST", "PATCH", "PUT"].includes(call.method));
  const finalMutation = mutatingCalls.at(-1);
  assert.equal(new URL(finalMutation.url).pathname, `/videos/${videoId}`);
  assert.deepEqual(JSON.parse(finalMutation.body), {
    name: "Approved Vimeo title",
    description: "Exact approved Vimeo description.",
    privacy: { view: "anybody" },
  });
  assert.deepEqual(
    mutatingCalls.filter((call) => {
      if (typeof call.body !== "string") return false;
      try {
        return JSON.parse(call.body).privacy?.view === "anybody";
      } catch {
        return false;
      }
    }),
    [finalMutation],
  );
  assert.equal(lifecycle.writes.length, mutatingCalls.length);
  assert.equal(lifecycle.writes.at(-1), "vimeo_apply_final_metadata_and_visibility");
  assert.equal(lifecycle.checkpoints[0].checkpoint.phase, "provider_accepted");
  assert.equal(lifecycle.checkpoints[0].providerAccepted, true);
  assert.equal(lifecycle.checkpoints[0].remoteId, videoId);
  assert.equal(lifecycle.checkpoints[0].remoteUrl, `https://vimeo.com/${videoId}`);
  assert.equal(lifecycle.checkpoints.at(-1).checkpoint.phase, "final_metadata_applied");
  assert.deepEqual(Buffer.concat(uploadedChunks), VIDEO_BYTES);
  assert.equal(headCount, 2);
  assert.equal(pollCount, 2);
  assert.deepEqual(sleeps, [15_000]);
  assert.equal(result.outcome, "verified");
  assert.equal(result.remote.id, videoId);
  assert.equal(result.remote.url, `https://vimeo.com/${videoId}`);
  assert.equal(result.upload.chunkCount, 3);
  assert.equal(result.thumbnail.active, true);
  assert.equal(result.verification.metadataMatched, true);
  assert.ok(accessedPaths.includes(STAGED_VIDEO_PATH));
  assert.ok(accessedPaths.includes(STAGED_THUMB_PATH));
  assert.ok(!JSON.stringify(result).includes(TOKEN));
  assert.ok(!JSON.stringify(result).includes("files.tus.vimeo.com"));
  assert.equal(calls.some((call) => new URL(call.url).hostname === "files.tus.vimeo.com" && call.headers.Authorization), false);

  const mutationCount = mutatingCalls.length;
  const completedLifecycle = runtimeHarness({ checkpoint: lifecycle.checkpoint });
  const reconciled = await adapter.reconcile(
    approvedInput({ thumbnail: true }),
    completedLifecycle.runtime,
  );
  assert.equal(reconciled.remote.id, videoId);
  assert.equal(
    calls.filter((call) => ["POST", "PATCH", "PUT"].includes(call.method)).length,
    mutationCount,
  );
  assert.deepEqual(completedLifecycle.writes, []);
});

test("replacement requires an exact approval, episode, account, asset, and remote-ID binding", async () => {
  const input = approvedInput({
    operation: "replace",
    existingVideoId: "1156414707",
    approvedBinding: {
      platformId: "vimeo",
      action: "replace_source",
      remoteId: "different",
      destinationAccountId: ACCOUNT_ID,
      assetSha256: VIDEO_SHA,
      approvalHash: APPROVAL_HASH,
      episodeHash: EPISODE_HASH,
    },
  });
  const adapter = createVimeoAdapter({
    fetchImpl: async () => {
      throw new Error("network must not be used");
    },
    fsImpl: memoryFs(),
    env: { VIMEO_ACCESS_TOKEN: TOKEN },
  });

  await assert.rejects(
    adapter.dryRun(input),
    (error) => error instanceof VimeoAdapterError && error.code === "REPLACEMENT_BINDING_MISMATCH",
  );
});

test("recoverSession authenticates one incident-bound Vimeo version and empty global TUS session without a write", async () => {
  const videoId = "1204939658";
  const versionId = "1225722222";
  const createdTime = "2026-08-22T20:04:57+00:00";
  const writeIntentAt = "2026-08-22T20:04:57.303Z";
  const blockedAt = "2026-08-22T20:04:58.036Z";
  const uploadLink = "https://global.upload.vimeo.com/tus/recovered-session";
  const calls = [];
  const binding = {
    platformId: "vimeo",
    action: "replace_source",
    remoteId: videoId,
    destinationAccountId: ACCOUNT_ID,
    assetSha256: VIDEO_SHA,
    approvalHash: APPROVAL_HASH,
    episodeHash: EPISODE_HASH,
  };
  const version = {
    uri: `/videos/${videoId}/versions/${versionId}`,
    filename: "episode.mp4",
    filesize: VIDEO_BYTES.length,
    upload_date: createdTime,
    created_time: createdTime,
    modified_time: createdTime,
    duration: 0,
    active: false,
    is_deleted: false,
    user: { uri: `/users/${ACCOUNT_ID}` },
    app: { uri: "/apps/540274" },
    transcode: { status: "in_progress" },
    upload: {
      status: "in_progress",
      approach: "tus",
      size: VIDEO_BYTES.length,
      upload_link: uploadLink,
    },
    play: { status: "unavailable" },
  };
  const adapter = createVimeoAdapter({
    env: { VIMEO_ACCESS_TOKEN: TOKEN },
    fsImpl: memoryFs(),
    fetchImpl: async (urlValue, init) => {
      const url = new URL(urlValue);
      calls.push({ method: init.method, redirect: init.redirect, url: url.href });
      if (url.hostname === "api.vimeo.com" && url.pathname === "/me") return responseJson(meBody());
      if (url.hostname === "api.vimeo.com" && url.pathname === `/videos/${videoId}`) {
        return responseJson(videoBody({ id: videoId }));
      }
      if (url.hostname === "api.vimeo.com" && url.pathname === "/oauth/verify") {
        return responseJson({
          app: { uri: "/apps/540274" },
          user: { uri: `/users/${ACCOUNT_ID}` },
          scope: "private edit upload video_files public",
        });
      }
      if (url.hostname === "api.vimeo.com" && url.pathname === `/videos/${videoId}/versions`) {
        return responseJson({
          total: 3,
          data: [
            version,
            { ...version, uri: `/videos/${videoId}/versions/1221215613`, active: true, created_time: "2026-08-01T00:00:00+00:00" },
            { ...version, uri: `/videos/${videoId}/versions/1208872480`, created_time: "2026-07-01T00:00:00+00:00" },
          ],
        });
      }
      if (url.hostname === "api.vimeo.com" && url.pathname === version.uri) return responseJson(version);
      if (url.hostname === "global.upload.vimeo.com" && init.method === "HEAD") {
        return responseEmpty(200, {
          "Tus-Resumable": "1.0.0",
          "Upload-Length": String(VIDEO_BYTES.length),
          "Upload-Offset": "0",
        });
      }
      throw new Error(`Unexpected ${init.method} ${url.href}`);
    },
  });

  const result = await adapter.recoverSession(approvedInput({
    operation: "replace",
    existingVideoId: videoId,
    approvedBinding: binding,
  }), {
    versionId,
    providerWriteStartedAt: writeIntentAt,
    providerBlockedAt: blockedAt,
    expectedAppId: "540274",
  });

  assert.deepEqual([...new Set(calls.map((call) => call.method))].sort(), ["GET", "HEAD"]);
  assert.equal(calls.some((call) => ["POST", "PATCH", "PUT", "DELETE"].includes(call.method)), false);
  assert.equal(calls.find((call) => call.method === "HEAD").redirect, "error");
  assert.equal(result.checkpoint.providerCreateStatus, null);
  assert.equal(result.checkpoint.providerRecovery.versionId, versionId);
  assert.equal(result.checkpoint.providerRecovery.tusHead.uploadLength, VIDEO_BYTES.length);
  assert.equal(result.checkpoint.providerRecovery.tusHead.uploadOffset, 0);
  assert.equal(result.checkpoint.providerRecovery.blockedAt, blockedAt);
  assert.equal(
    result.checkpoint.providerRecovery.uploadLinkSha256,
    createHash("sha256").update(uploadLink).digest("hex"),
  );
  assert.ok(!JSON.stringify(result.recovery).includes(uploadLink));
});

test("recoverSession rejects a Vimeo-looking redirect host and a non-empty TUS session", async (t) => {
  const videoId = "1204939658";
  const versionId = "1225722222";
  const createdTime = "2026-08-22T20:04:57+00:00";
  const binding = {
    platformId: "vimeo",
    action: "replace_source",
    remoteId: videoId,
    destinationAccountId: ACCOUNT_ID,
    assetSha256: VIDEO_SHA,
    approvalHash: APPROVAL_HASH,
    episodeHash: EPISODE_HASH,
  };
  for (const scenario of [
    { label: "lookalike host", uploadLink: "https://global.upload.vimeo.com.attacker.invalid/tus", offset: 0, code: "INVALID_PROVIDER_RESPONSE" },
    { label: "non-empty session", uploadLink: "https://global.upload.vimeo.com/tus/session", offset: 1, code: "RECOVERY_TUS_BINDING_MISMATCH" },
  ]) {
    await t.test(scenario.label, async () => {
      const version = {
        uri: `/videos/${videoId}/versions/${versionId}`,
        filename: "episode.mp4",
        filesize: VIDEO_BYTES.length,
        upload_date: createdTime,
        created_time: createdTime,
        modified_time: createdTime,
        duration: 0,
        active: false,
        is_deleted: false,
        user: { uri: `/users/${ACCOUNT_ID}` },
        app: { uri: "/apps/540274" },
        transcode: { status: "in_progress" },
        upload: { status: "in_progress", approach: "tus", size: VIDEO_BYTES.length, upload_link: scenario.uploadLink },
        play: { status: "unavailable" },
      };
      const adapter = createVimeoAdapter({
        env: { VIMEO_ACCESS_TOKEN: TOKEN },
        fsImpl: memoryFs(),
        fetchImpl: async (urlValue, init) => {
          const url = new URL(urlValue);
          if (url.hostname === "api.vimeo.com" && url.pathname === "/me") return responseJson(meBody());
          if (url.hostname === "api.vimeo.com" && url.pathname === `/videos/${videoId}`) return responseJson(videoBody({ id: videoId }));
          if (url.hostname === "api.vimeo.com" && url.pathname === "/oauth/verify") {
            return responseJson({ app: { uri: "/apps/540274" }, user: { uri: `/users/${ACCOUNT_ID}` } });
          }
          if (url.hostname === "api.vimeo.com" && url.pathname === `/videos/${videoId}/versions`) {
            return responseJson({ total: 1, data: [version] });
          }
          if (url.hostname === "api.vimeo.com" && url.pathname === version.uri) return responseJson(version);
          if (url.hostname === "global.upload.vimeo.com" && init.method === "HEAD") {
            return responseEmpty(200, {
              "Tus-Resumable": "1.0.0",
              "Upload-Length": String(VIDEO_BYTES.length),
              "Upload-Offset": String(scenario.offset),
            });
          }
          throw new Error(`Unexpected ${init.method} ${url.href}`);
        },
      });
      await assert.rejects(
        adapter.recoverSession(approvedInput({ operation: "replace", existingVideoId: videoId, approvedBinding: binding }), {
          versionId,
          providerWriteStartedAt: "2026-08-22T20:04:57.303Z",
          providerBlockedAt: "2026-08-22T20:04:58.036Z",
          expectedAppId: "540274",
        }),
        (error) => error instanceof VimeoAdapterError && error.code === scenario.code,
      );
    });
  }
});

test("publish replaces the source only on the explicitly bound Vimeo ID and patches approved metadata", async () => {
  const videoId = "1156414707";
  const calls = [];
  let tusOffset = 0;
  let fullVideoReads = 0;
  let state = {
    description: "Exact approved Vimeo description.",
    license: "by",
    name: "Approved Vimeo title",
    privacy: "unlisted",
  };
  const binding = {
    platformId: "vimeo",
    action: "replace_source",
    remoteId: videoId,
    destinationAccountId: ACCOUNT_ID,
    assetSha256: VIDEO_SHA,
    approvalHash: APPROVAL_HASH,
    episodeHash: EPISODE_HASH,
  };
  const adapter = createVimeoAdapter({
    chunkSizeBytes: VIDEO_BYTES.length,
    env: { VIMEO_ACCESS_TOKEN: TOKEN },
    fsImpl: memoryFs(),
    stageAssetImpl: stageAssetForTest,
    fetchImpl: async (urlValue, init) => {
      const url = new URL(urlValue);
      calls.push({ body: init.body, method: init.method, url: url.href });
      if (url.hostname === "api.vimeo.com" && url.pathname === "/me") return responseJson(meBody());
      if (url.hostname === "api.vimeo.com" && url.pathname === `/videos/${videoId}` && init.method === "GET") {
        fullVideoReads += 1;
        return responseJson(videoBody({ id: videoId, ...state }));
      }
      if (url.hostname === "api.vimeo.com" && url.pathname === `/videos/${videoId}/versions` && init.method === "POST") {
        return responseJson({
          upload: { approach: "tus", upload_link: "https://files.tus.vimeo.com/upload/replacement-1" },
        }, 201);
      }
      if (url.hostname === "files.tus.vimeo.com" && init.method === "HEAD") {
        return responseEmpty(200, {
          "Upload-Length": String(VIDEO_BYTES.length),
          "Upload-Offset": String(tusOffset),
        });
      }
      if (url.hostname === "files.tus.vimeo.com" && init.method === "PATCH") {
        tusOffset += Buffer.from(init.body).length;
        return responseEmpty(204, { "Upload-Offset": String(tusOffset) });
      }
      if (url.hostname === "api.vimeo.com" && url.pathname === `/videos/${videoId}` && init.method === "PATCH") {
        const body = JSON.parse(init.body);
        state = {
          description: body.description ?? state.description,
          license: body.license ?? state.license,
          name: body.name ?? state.name,
          privacy: body.privacy?.view ?? state.privacy,
        };
        return responseJson(videoBody({ id: videoId, ...state }));
      }
      throw new Error(`Unexpected ${init.method} ${url.href}`);
    },
  });
  const lifecycle = runtimeHarness();

  const result = await adapter.publish(approvedInput({
    operation: "replace",
    existingVideoId: videoId,
    approvedBinding: binding,
    license: "by",
    finalVisibility: "unlisted",
  }), lifecycle.runtime);

  const versionCall = calls.find((call) => new URL(call.url).pathname.endsWith("/versions") && call.method === "POST");
  assert.deepEqual(JSON.parse(versionCall.body), {
    file_name: "episode.mp4",
    upload: { status: "in_progress", size: VIDEO_BYTES.length, approach: "tus" },
  });
  const videoPatches = calls.filter(
    (call) => new URL(call.url).pathname === `/videos/${videoId}` && call.method === "PATCH",
  );
  assert.deepEqual(JSON.parse(videoPatches[0].body), { privacy: { view: "nobody" } });
  const metadataCall = videoPatches.at(-1);
  assert.deepEqual(JSON.parse(metadataCall.body), {
    name: "Approved Vimeo title",
    description: "Exact approved Vimeo description.",
    privacy: { view: "unlisted" },
    license: "by",
  });
  assert.ok(fullVideoReads >= 3);
  assert.equal(lifecycle.writes.at(-1), "vimeo_apply_final_metadata_and_visibility");
  assert.equal(result.operation, "replace");
  assert.equal(result.remote.id, videoId);
  assert.equal(result.provider.versionUri, null);
  assert.equal(result.operationId, `vimeo:replace:${videoId}:${VIDEO_SHA.slice(0, 16)}`);
});

test("a retryable transport failure after acceptance reconciles the exact video without another create", async () => {
  const videoId = "223344550";
  let createCount = 0;
  let failInitialHead = true;
  let tusOffset = 0;
  let state = {
    description: "",
    license: null,
    name: "Untitled",
    privacy: "nobody",
  };
  const adapter = createVimeoAdapter({
    chunkSizeBytes: VIDEO_BYTES.length,
    env: { VIMEO_ACCESS_TOKEN: TOKEN },
    fsImpl: memoryFs(),
    stageAssetImpl: stageAssetForTest,
    sleep: async () => {},
    fetchImpl: async (urlValue, init) => {
      const url = new URL(urlValue);
      if (url.hostname === "api.vimeo.com" && url.pathname === "/me") {
        return responseJson(meBody());
      }
      if (url.hostname === "api.vimeo.com" && url.pathname === "/me/videos" && init.method === "POST") {
        createCount += 1;
        return responseJson({
          uri: `/videos/${videoId}`,
          upload: { approach: "tus", upload_link: "https://files.tus.vimeo.com/upload/resume-transport" },
        }, 201);
      }
      if (url.hostname === "files.tus.vimeo.com" && init.method === "HEAD") {
        if (failInitialHead) {
          failInitialHead = false;
          throw new TypeError("connection reset before the offset response");
        }
        return responseEmpty(200, {
          "Upload-Length": String(VIDEO_BYTES.length),
          "Upload-Offset": String(tusOffset),
        });
      }
      if (url.hostname === "files.tus.vimeo.com" && init.method === "PATCH") {
        tusOffset += Buffer.from(init.body).length;
        return responseEmpty(204, { "Upload-Offset": String(tusOffset) });
      }
      if (url.hostname === "api.vimeo.com" && url.pathname === `/videos/${videoId}`) {
        if (init.method === "PATCH") {
          const body = JSON.parse(init.body);
          state = {
            description: body.description ?? state.description,
            license: body.license ?? state.license,
            name: body.name ?? state.name,
            privacy: body.privacy?.view ?? state.privacy,
          };
        }
        return responseJson(videoBody({ id: videoId, ...state }));
      }
      throw new Error(`Unexpected ${init.method} ${url.href}`);
    },
  });
  const firstLifecycle = runtimeHarness();

  await assert.rejects(adapter.publish(approvedInput(), firstLifecycle.runtime), (error) => {
    assert.ok(error instanceof VimeoAdapterError);
    assert.equal(error.code, "NETWORK_ERROR");
    assert.equal(error.retryable, true);
    return true;
  });
  assert.equal(firstLifecycle.checkpoint.phase, "private_staged");
  assert.equal(firstLifecycle.checkpoint.videoId, videoId);
  assert.equal(createCount, 1);

  const resumedLifecycle = runtimeHarness({ checkpoint: firstLifecycle.checkpoint });
  const result = await adapter.reconcile(approvedInput(), resumedLifecycle.runtime);

  assert.equal(createCount, 1);
  assert.equal(tusOffset, VIDEO_BYTES.length);
  assert.equal(result.remote.id, videoId);
  assert.equal(result.outcome, "verified");
});

test("reconcile resumes the checkpointed TUS session after a crash without creating a second video", async () => {
  const videoId = "223344556";
  let createCount = 0;
  let tusOffset = 0;
  let state = {
    description: "",
    license: null,
    name: "Untitled",
    privacy: "nobody",
  };
  const calls = [];
  const adapter = createVimeoAdapter({
    chunkSizeBytes: VIDEO_BYTES.length,
    env: { VIMEO_ACCESS_TOKEN: TOKEN },
    fsImpl: memoryFs(),
    stageAssetImpl: stageAssetForTest,
    fetchImpl: async (urlValue, init) => {
      const url = new URL(urlValue);
      calls.push({ body: init.body, method: init.method, url: url.href });
      if (url.hostname === "api.vimeo.com" && url.pathname === "/me") {
        return responseJson(meBody());
      }
      if (url.hostname === "api.vimeo.com" && url.pathname === "/me/videos" && init.method === "POST") {
        createCount += 1;
        return responseJson({
          uri: `/videos/${videoId}`,
          upload: { approach: "tus", upload_link: "https://files.tus.vimeo.com/upload/resume-1" },
        }, 201);
      }
      if (url.hostname === "files.tus.vimeo.com" && init.method === "HEAD") {
        return responseEmpty(200, {
          "Upload-Length": String(VIDEO_BYTES.length),
          "Upload-Offset": String(tusOffset),
        });
      }
      if (url.hostname === "files.tus.vimeo.com" && init.method === "PATCH") {
        tusOffset += Buffer.from(init.body).length;
        return responseEmpty(204, { "Upload-Offset": String(tusOffset) });
      }
      if (url.hostname === "api.vimeo.com" && url.pathname === `/videos/${videoId}`) {
        if (init.method === "PATCH") {
          const body = JSON.parse(init.body);
          state = {
            description: body.description ?? state.description,
            license: body.license ?? state.license,
            name: body.name ?? state.name,
            privacy: body.privacy?.view ?? state.privacy,
          };
          return responseJson(videoBody({ id: videoId, ...state }));
        }
        return responseJson(videoBody({ id: videoId, ...state }));
      }
      throw new Error(`Unexpected ${init.method} ${url.href}`);
    },
  });
  const crash = new Error("simulated controller crash after durable acceptance");
  const firstLifecycle = runtimeHarness({
    async afterCheckpoint(event) {
      if (event.providerAccepted) throw crash;
    },
  });

  await assert.rejects(
    adapter.publish(approvedInput(), firstLifecycle.runtime),
    (error) => error === crash,
  );
  assert.equal(createCount, 1);
  assert.equal(firstLifecycle.checkpoint.phase, "provider_accepted");
  assert.equal(firstLifecycle.checkpoint.videoId, videoId);

  const resumedLifecycle = runtimeHarness({ checkpoint: firstLifecycle.checkpoint });
  const result = await adapter.reconcile(approvedInput(), resumedLifecycle.runtime);

  assert.equal(createCount, 1);
  assert.equal(
    calls.filter((call) => new URL(call.url).pathname === "/me/videos" && call.method === "POST").length,
    1,
  );
  assert.equal(tusOffset, VIDEO_BYTES.length);
  assert.equal(result.remote.id, videoId);
  assert.equal(result.outcome, "verified");
  assert.equal(resumedLifecycle.checkpoint.phase, "final_metadata_applied");
});

test("reconcile fails closed before network access when a prior write has no usable checkpoint", async () => {
  let fetchCount = 0;
  const adapter = createVimeoAdapter({
    env: { VIMEO_ACCESS_TOKEN: TOKEN },
    fsImpl: memoryFs(),
    fetchImpl: async () => {
      fetchCount += 1;
      throw new Error("network must not be used");
    },
  });
  const lifecycle = runtimeHarness();

  await assert.rejects(
    adapter.reconcile(approvedInput(), lifecycle.runtime),
    (error) => error instanceof VimeoAdapterError && error.code === "AMBIGUOUS_PRIOR_WRITE",
  );
  assert.equal(fetchCount, 0);
  assert.deepEqual(lifecycle.writes, []);
});

test("publish never starts a second create when any prior checkpoint is supplied", async () => {
  let fetchCount = 0;
  const adapter = createVimeoAdapter({
    env: { VIMEO_ACCESS_TOKEN: TOKEN },
    fsImpl: memoryFs(),
    fetchImpl: async () => {
      fetchCount += 1;
      throw new Error("network must not be used");
    },
  });
  const lifecycle = runtimeHarness({ checkpoint: { phase: "provider_accepted" } });

  await assert.rejects(
    adapter.publish(approvedInput(), lifecycle.runtime),
    (error) => error instanceof VimeoAdapterError && error.code === "RECONCILIATION_REQUIRED",
  );
  assert.equal(fetchCount, 0);
  assert.deepEqual(lifecycle.writes, []);
});

test("TUS upload reconciles the server offset after an ambiguous chunk response", async () => {
  const videoId = "333444555";
  let patchAttempts = 0;
  let headCount = 0;
  let serverOffset = 0;
  const adapter = createVimeoAdapter({
    chunkSizeBytes: VIDEO_BYTES.length,
    env: { VIMEO_ACCESS_TOKEN: TOKEN },
    fsImpl: memoryFs(),
    stageAssetImpl: stageAssetForTest,
    sleep: async () => {},
    fetchImpl: async (urlValue, init) => {
      const url = new URL(urlValue);
      if (url.hostname === "api.vimeo.com" && url.pathname === "/me") return responseJson(meBody());
      if (url.hostname === "api.vimeo.com" && url.pathname === "/me/videos" && init.method === "POST") {
        return responseJson({
          uri: `/videos/${videoId}`,
          upload: { approach: "tus", upload_link: "https://files.tus.vimeo.com/upload/recover-1" },
        });
      }
      if (url.hostname === "files.tus.vimeo.com" && init.method === "HEAD") {
        headCount += 1;
        return responseEmpty(200, {
          "Upload-Length": String(VIDEO_BYTES.length),
          "Upload-Offset": String(serverOffset),
        });
      }
      if (url.hostname === "files.tus.vimeo.com" && init.method === "PATCH") {
        patchAttempts += 1;
        serverOffset = VIDEO_BYTES.length;
        throw new TypeError("connection closed after provider accepted bytes");
      }
      if (url.hostname === "api.vimeo.com" && url.pathname === `/videos/${videoId}`) {
        return responseJson(videoBody({ id: videoId }));
      }
      throw new Error(`Unexpected ${init.method} ${url.href}`);
    },
  });
  const lifecycle = runtimeHarness();

  const result = await adapter.publish(approvedInput(), lifecycle.runtime);

  assert.equal(patchAttempts, 1);
  assert.equal(headCount, 3);
  assert.equal(result.upload.finalOffset, VIDEO_BYTES.length);
  assert.equal(result.outcome, "verified");
});

test("unsupported scheduled, password, and unresolved release choices fail locally", async () => {
  const adapter = createVimeoAdapter({
    fetchImpl: async () => {
      throw new Error("network must not be used");
    },
    fsImpl: memoryFs(),
    env: { VIMEO_ACCESS_TOKEN: TOKEN },
  });

  await assert.rejects(
    adapter.dryRun(approvedInput({ releaseMode: "scheduled" })),
    (error) => error.code === "UNSUPPORTED_RELEASE_CHOICE",
  );
  await assert.rejects(
    adapter.dryRun(approvedInput({ finalVisibility: "password" })),
    (error) => error.code === "UNSUPPORTED_RELEASE_CHOICE",
  );
  await assert.rejects(
    adapter.dryRun(approvedInput({ license: "not_selected" })),
    (error) => error.code === "UNSUPPORTED_RELEASE_CHOICE",
  );
});
