import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { SecureCredentialError, readSecureCredentialText } from "../secure-credential.mjs";

import {
  YouTubeAdapterError,
  createYouTubeAdapter,
  resolveYouTubeCredentialPaths,
} from "./youtube.mjs";

const EXPECTED_CHANNEL = `UC${"A".repeat(22)}`;
const OTHER_CHANNEL = `UC${"B".repeat(22)}`;
const ACCESS_TOKEN = "test-access-token-never-log";
const REFRESH_TOKEN = "test-refresh-token-never-log";
const CLIENT_SECRET = "test-client-secret-never-log";
const UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos?upload_id=test-session";
const FIXED_NOW = Date.parse("2026-08-08T18:00:00.000Z");

function jsonResponse(document, status = 200, headers = {}) {
  return new Response(JSON.stringify(document), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function emptyResponse(status, headers = {}) {
  return new Response(null, { status, headers });
}

function requestDetails(url, init = {}) {
  return {
    url: String(url),
    method: init.method ?? "GET",
    headers: Object.fromEntries(new Headers(init.headers ?? {}).entries()),
    body: init.body,
  };
}

function scriptedFetch(steps) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const call = requestDetails(url, init);
    calls.push(call);
    const step = steps.shift();
    assert.ok(step, `Unexpected fetch: ${call.method} ${call.url}`);
    if (step.assert) await step.assert(call);
    return typeof step.response === "function" ? step.response(call) : step.response;
  };
  fetch.calls = calls;
  fetch.assertComplete = () => assert.equal(steps.length, 0, `${steps.length} expected fetch calls did not occur`);
  return fetch;
}

async function makeFixture(t, { token = {}, videoBytes = 32, thumbnailBytes = 16 } = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "youtube-adapter-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const clientSecretPath = path.join(directory, "client_secret.json");
  const tokenPath = path.join(directory, "token.json");
  const videoPath = path.join(directory, "video.mp4");
  const thumbnailPath = path.join(directory, "thumbnail.jpg");
  await fs.writeFile(
    clientSecretPath,
    JSON.stringify({
      installed: {
        client_id: "test-client-id.apps.googleusercontent.com",
        client_secret: CLIENT_SECRET,
        token_uri: "https://oauth2.googleapis.com/token",
      },
    }),
    { mode: 0o600 }
  );
  await fs.writeFile(
    tokenPath,
    JSON.stringify({
      access_token: ACCESS_TOKEN,
      refresh_token: REFRESH_TOKEN,
      scope: "https://www.googleapis.com/auth/youtube.upload",
      token_type: "Bearer",
      expiry_date: FIXED_NOW + 3_600_000,
      ...token,
    }),
    { mode: 0o600 }
  );
  const video = Buffer.alloc(videoBytes, 0x5a);
  const thumbnail = Buffer.alloc(thumbnailBytes, 0x42);
  await fs.writeFile(videoPath, video);
  await fs.writeFile(thumbnailPath, thumbnail);
  return {
    directory,
    clientSecretPath,
    tokenPath,
    videoPath,
    thumbnailPath,
    videoSha256: createHash("sha256").update(video).digest("hex"),
    thumbnailSha256: createHash("sha256").update(thumbnail).digest("hex"),
  };
}

function target(channelId = EXPECTED_CHANNEL) {
  return { destinationIds: { accountId: channelId, containerId: null } };
}

function publication(fixture, overrides = {}) {
  return {
    videoPath: fixture.videoPath,
    videoSha256: fixture.videoSha256,
    thumbnailPath: fixture.thumbnailPath,
    thumbnailSha256: fixture.thumbnailSha256,
    metadata: {
      title: "Brain Health Test",
      description: "Approved description",
      tags: ["brain health", "Dr. David Musnick"],
      categoryId: "27",
      ...overrides.metadata,
    },
    status: {
      privacyStatus: "private",
      madeForKids: false,
      license: "youtube",
      containsSyntheticMedia: false,
      notifySubscribers: false,
      ...overrides.status,
    },
    ...Object.fromEntries(Object.entries(overrides).filter(([key]) => !new Set(["metadata", "status"]).has(key))),
  };
}

function adapterOptions(fixture, overrides = {}) {
  return {
    target: target(),
    assetStagingRoot: path.join(fixture.directory, "publisher-state", "assets", "sha256"),
    credentialPaths: {
      clientSecretPath: fixture.clientSecretPath,
      tokenPath: fixture.tokenPath,
    },
    maxPollAttempts: 2,
    pollIntervalMs: 1,
    ...overrides,
  };
}

function lifecycleHarness({ checkpoint = null, beforeWrite = null, onCheckpoint = null } = {}) {
  const writes = [];
  const checkpoints = [];
  return {
    writes,
    checkpoints,
    runtime: {
      checkpoint,
      async beforeWrite(event) {
        writes.push(structuredClone(event));
        if (beforeWrite) await beforeWrite(event);
      },
      async onCheckpoint(event) {
        checkpoints.push(structuredClone(event));
        if (onCheckpoint) await onCheckpoint(event);
      },
    },
  };
}

function channelResponse(channelId = EXPECTED_CHANNEL) {
  return jsonResponse({ items: [{ id: channelId, snippet: { title: "Dr. M Experienced" } }] });
}

test("secure credential reads reject symlinks and modes other than exact 0600", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "secure-credential-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const targetPath = path.join(directory, "token-target.json");
  const symlinkPath = path.join(directory, "token.json");
  await fs.writeFile(targetPath, "secret", { mode: 0o600 });
  await fs.symlink(targetPath, symlinkPath);

  await assert.rejects(
    readSecureCredentialText(symlinkPath),
    (error) => error instanceof SecureCredentialError && error.code === "credential_symlink",
  );

  await fs.unlink(symlinkPath);
  await fs.chmod(targetPath, 0o640);
  await assert.rejects(
    readSecureCredentialText(targetPath),
    (error) => error instanceof SecureCredentialError && error.code === "credential_insecure_mode",
  );
});

test("secure credential reads reject the wrong owner and an lstat/open race", async () => {
  const baseStats = {
    ctimeMs: 1,
    dev: 1,
    ino: 1,
    isFile: () => true,
    isSymbolicLink: () => false,
    mode: 0o100600,
    mtimeMs: 1,
    size: 6,
    uid: 1000,
  };
  const fakeHandle = (stats) => ({
    async close() {},
    async readFile() { return "secret"; },
    async stat() { return stats; },
  });

  await assert.rejects(
    readSecureCredentialText("/credentials/owner", {
      expectedUid: 1000,
      fsImpl: {
        async lstat() { return baseStats; },
        async open() { return fakeHandle({ ...baseStats, uid: 1001 }); },
      },
    }),
    (error) => error instanceof SecureCredentialError && error.code === "credential_wrong_owner",
  );

  await assert.rejects(
    readSecureCredentialText("/credentials/raced", {
      expectedUid: 1000,
      fsImpl: {
        async lstat() { return baseStats; },
        async open() { return fakeHandle({ ...baseStats, ino: 2 }); },
      },
    }),
    (error) => error instanceof SecureCredentialError && error.code === "credential_changed",
  );
});

test("credential paths use the private per-user config directory and accept env overrides", () => {
  assert.deepEqual(resolveYouTubeCredentialPaths({ env: {}, homeDirectory: "/home/tester" }), {
    clientSecretPath: "/home/tester/.config/drm-publisher/youtube/client_secret.json",
    tokenPath: "/home/tester/.config/drm-publisher/youtube/token.json",
  });
  assert.deepEqual(
    resolveYouTubeCredentialPaths({
      env: {
        DRM_YOUTUBE_CLIENT_SECRET_PATH: "~/oauth/client.json",
        DRM_YOUTUBE_TOKEN_PATH: "/secure/token.json",
      },
      homeDirectory: "/home/tester",
    }),
    {
      clientSecretPath: "/home/tester/oauth/client.json",
      tokenPath: "/secure/token.json",
    }
  );
});

test("dry-run preflight injects fs/fetch, verifies the exact channel, and makes no content write", async (t) => {
  const fixture = await makeFixture(t);
  const fetch = scriptedFetch([{ response: channelResponse() }]);
  let credentialOpens = 0;
  const injectedFs = {
    ...fs,
    async open(...args) {
      if (new Set([fixture.clientSecretPath, fixture.tokenPath]).has(args[0])) credentialOpens += 1;
      return fs.open(...args);
    },
  };
  const adapter = createYouTubeAdapter(adapterOptions(fixture), {
    fetch,
    fs: injectedFs,
    now: () => FIXED_NOW,
    sleep: async () => {},
  });

  const evidence = await adapter.publish(publication(fixture), { dryRun: true });

  assert.equal(evidence.mode, "dry_run");
  assert.equal(evidence.result, "ready");
  assert.equal(evidence.channel.id, EXPECTED_CHANNEL);
  assert.equal(evidence.remoteWrites, 0);
  assert.match(evidence.request.video.sha256, /^[a-f0-9]{64}$/);
  assert.match(evidence.request.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(credentialOpens, 2, "injected fs was not used for both credentials");
  assert.equal(fetch.calls.length, 1);
  assert.equal(fetch.calls[0].method, "GET");
  assert.match(fetch.calls[0].url, /channels\?/);
  fetch.assertComplete();
});

test("preflight rejects video or thumbnail bytes that changed after approval", async (t) => {
  const fixture = await makeFixture(t);
  await fs.writeFile(fixture.videoPath, Buffer.alloc(33, 0x7a));
  let fetchCalls = 0;
  const adapter = createYouTubeAdapter(adapterOptions(fixture), {
    fetch: async () => {
      fetchCalls += 1;
      throw new Error("network must not be reached");
    },
    now: () => FIXED_NOW,
  });
  await assert.rejects(
    adapter.preflight(publication(fixture)),
    (error) => error instanceof YouTubeAdapterError && error.code === "asset_changed",
  );
  assert.equal(fetchCalls, 0);
});

test("channel mismatch hard-fails before videos.insert", async (t) => {
  const fixture = await makeFixture(t);
  const fetch = scriptedFetch([{ response: channelResponse(OTHER_CHANNEL) }]);
  const adapter = createYouTubeAdapter(adapterOptions(fixture), {
    fetch,
    now: () => FIXED_NOW,
  });

  const lifecycle = lifecycleHarness();
  await assert.rejects(adapter.publish(publication(fixture), lifecycle.runtime), (error) => {
    assert.ok(error instanceof YouTubeAdapterError);
    assert.equal(error.code, "channel_mismatch");
    assert.deepEqual(error.evidence.observedChannelIds, [OTHER_CHANNEL]);
    return true;
  });
  assert.equal(fetch.calls.length, 1);
  assert.ok(!fetch.calls.some((call) => call.url.includes("/videos")));
  assert.deepEqual(lifecycle.writes, []);
  assert.deepEqual(lifecycle.checkpoints, []);
  fetch.assertComplete();
});

test("non-private and scheduled visibility are blocked without scoped authorization", async (t) => {
  const fixture = await makeFixture(t);
  const fetch = scriptedFetch([]);
  const adapter = createYouTubeAdapter(adapterOptions(fixture), { fetch, now: () => FIXED_NOW });

  await assert.rejects(
    adapter.preflight(publication(fixture, { status: { privacyStatus: "unlisted" } })),
    (error) => error instanceof YouTubeAdapterError && error.code === "visibility_not_authorized"
  );
  await assert.rejects(
    adapter.preflight(
      publication(fixture, {
        status: { privacyStatus: "private", publishAt: "2026-08-09T18:00:00.000Z" },
      })
    ),
    (error) => error instanceof YouTubeAdapterError && error.code === "visibility_not_authorized"
  );
  assert.equal(fetch.calls.length, 0);
  fetch.assertComplete();
});

test("visibility capability is scoped by status, schedule permission, reference, and expiry", async (t) => {
  const fixture = await makeFixture(t);
  const fetch = scriptedFetch([{ response: channelResponse() }, { response: channelResponse() }]);
  const adapter = createYouTubeAdapter(
    adapterOptions(fixture, {
      visibilityCapability: {
        enabled: true,
        authorizationId: "approval-packet-episode-8",
        allowedPrivacyStatuses: ["unlisted"],
        allowScheduledPublic: true,
        expiresAt: "2026-08-10T00:00:00.000Z",
      },
    }),
    { fetch, now: () => FIXED_NOW }
  );

  const unlisted = await adapter.preflight(publication(fixture, { status: { privacyStatus: "unlisted" } }));
  assert.equal(unlisted.request.visibilityAuthorizationId, "approval-packet-episode-8");
  const scheduled = await adapter.preflight(
    publication(fixture, {
      status: { privacyStatus: "private", publishAt: "2026-08-09T18:00:00.000Z" },
    })
  );
  assert.equal(scheduled.request.status.publishAt, "2026-08-09T18:00:00.000Z");

  await assert.rejects(
    adapter.preflight(publication(fixture, { status: { privacyStatus: "public" } })),
    (error) => error instanceof YouTubeAdapterError && error.code === "visibility_not_authorized"
  );
  fetch.assertComplete();
});

test("expired access token refreshes atomically, preserves refresh token, and does not expose secrets", async (t) => {
  const fixture = await makeFixture(t, { token: { expiry_date: FIXED_NOW - 1 } });
  const fetch = scriptedFetch([
    {
      assert(call) {
        assert.equal(call.url, "https://oauth2.googleapis.com/token");
        assert.equal(call.method, "POST");
        assert.match(String(call.body), /grant_type=refresh_token/);
      },
      response: jsonResponse({
        access_token: "new-test-access-token-never-log",
        expires_in: 3600,
        scope: "https://www.googleapis.com/auth/youtube.upload",
        token_type: "Bearer",
      }),
    },
    { response: channelResponse() },
  ]);
  const adapter = createYouTubeAdapter(adapterOptions(fixture), {
    fetch,
    now: () => FIXED_NOW,
    randomUUID: () => "fixed-temp-id",
  });

  const evidence = await adapter.preflight(publication(fixture));
  const savedToken = JSON.parse(await fs.readFile(fixture.tokenPath, "utf8"));
  const mode = (await fs.stat(fixture.tokenPath)).mode & 0o777;

  assert.equal(savedToken.refresh_token, REFRESH_TOKEN);
  assert.equal(savedToken.access_token, "new-test-access-token-never-log");
  assert.equal(savedToken.expiry_date, FIXED_NOW + 3_600_000);
  assert.equal(mode, 0o600);
  const serializedEvidence = JSON.stringify(evidence);
  for (const secret of [ACCESS_TOKEN, REFRESH_TOKEN, CLIENT_SECRET, savedToken.access_token]) {
    assert.ok(!serializedEvidence.includes(secret));
  }
  fetch.assertComplete();
});

test("resumable upload sends complete metadata, custom thumbnail, polls, and returns verified evidence", async (t) => {
  const videoBytes = 300_000;
  const fixture = await makeFixture(t, { videoBytes });
  let initiationBody;
  const fetch = scriptedFetch([
    { response: channelResponse() },
    {
      assert(call) {
        assert.equal(call.method, "POST");
        assert.match(call.url, /upload\/youtube\/v3\/videos/);
        assert.match(call.url, /uploadType=resumable/);
        assert.equal(call.headers["x-upload-content-length"], String(videoBytes));
        initiationBody = JSON.parse(call.body);
      },
      response: emptyResponse(200, { location: UPLOAD_URL }),
    },
    {
      assert(call) {
        assert.equal(call.method, "PUT");
        assert.equal(call.headers["content-range"], `bytes 0-${256 * 1024 - 1}/${videoBytes}`);
        assert.equal(call.body.length, 256 * 1024);
        assert.ok(call.body.equals(Buffer.alloc(256 * 1024, 0x5a)));
      },
      response: emptyResponse(308, { range: `bytes=0-${256 * 1024 - 1}` }),
    },
    {
      assert(call) {
        assert.equal(call.headers["content-range"], `bytes ${256 * 1024}-${videoBytes - 1}/${videoBytes}`);
        assert.ok(call.body.equals(Buffer.alloc(videoBytes - 256 * 1024, 0x5a)));
      },
      response: jsonResponse({ id: "video12345" }),
    },
    {
      assert(call) {
        assert.equal(call.method, "POST");
        assert.match(call.url, /thumbnails\/set/);
        assert.match(call.url, /videoId=video12345/);
        assert.equal(call.headers["content-type"], "image/jpeg");
      },
      response: jsonResponse({ items: [{ snippet: { thumbnails: { default: {}, high: {} } } }] }),
    },
    {
      assert(call) {
        assert.equal(call.method, "GET");
        assert.match(call.url, /youtube\/v3\/videos/);
        assert.match(call.url, /id=video12345/);
      },
      response: jsonResponse({
        items: [
          {
            id: "video12345",
            snippet: {
              title: "Brain Health Test",
              description: "Approved description",
              tags: ["brain health", "Dr. David Musnick"],
              categoryId: "27",
            },
            status: {
              privacyStatus: "private",
              license: "youtube",
              selfDeclaredMadeForKids: false,
              containsSyntheticMedia: false,
              uploadStatus: "processed",
            },
            processingDetails: { processingStatus: "succeeded" },
          },
        ],
      }),
    },
  ]);
  const adapter = createYouTubeAdapter(adapterOptions(fixture, { chunkSize: 256 * 1024 }), {
    fetch,
    now: () => FIXED_NOW,
    sleep: async () => assert.fail("poll sleep should not be needed"),
  });

  let sourceMutated = false;
  const lifecycle = lifecycleHarness({
    async beforeWrite({ step }) {
      if (step === "initiate_resumable_upload" && !sourceMutated) {
        sourceMutated = true;
        await fs.writeFile(fixture.videoPath, Buffer.alloc(videoBytes, 0x11));
      }
    },
  });
  const evidence = await adapter.publish(publication(fixture), lifecycle.runtime);

  assert.deepEqual(initiationBody, {
    snippet: {
      title: "Brain Health Test",
      description: "Approved description",
      tags: ["brain health", "Dr. David Musnick"],
      categoryId: "27",
    },
    status: {
      privacyStatus: "private",
      license: "youtube",
      selfDeclaredMadeForKids: false,
      containsSyntheticMedia: false,
    },
  });
  assert.equal(evidence.result, "verified");
  assert.equal(evidence.upload.videoId, "video12345");
  assert.equal(evidence.upload.chunksUploaded, 2);
  assert.deepEqual(evidence.thumbnail, { set: true, variants: ["default", "high"] });
  assert.equal(evidence.readback.url, "https://www.youtube.com/watch?v=video12345");
  assert.equal(evidence.readback.processingStatus, "succeeded");
  assert.equal(evidence.remoteWrites, 2);
  assert.equal(evidence.staging.video.sha256, fixture.videoSha256);
  assert.equal(evidence.staging.thumbnail.sha256, fixture.thumbnailSha256);
  assert.equal(evidence.staging.video.reused, false);
  assert.equal(sourceMutated, true);
  assert.deepEqual(lifecycle.writes.map(({ step }) => step), [
    "initiate_resumable_upload",
    "upload_video_chunk",
    "upload_video_chunk",
    "set_thumbnail",
  ]);
  assert.deepEqual(lifecycle.checkpoints.map(({ checkpoint }) => checkpoint.phase), [
    "session_created",
    "uploading",
    "video_created",
    "thumbnail_set",
    "verified",
  ]);
  const accepted = lifecycle.checkpoints.find(({ providerAccepted }) => providerAccepted);
  assert.equal(accepted.remoteId, "video12345");
  assert.equal(accepted.remoteUrl, "https://www.youtube.com/watch?v=video12345");
  fetch.assertComplete();
});

test("readback mismatch fails with structured evidence and never exposes credentials", async (t) => {
  const fixture = await makeFixture(t);
  const fetch = scriptedFetch([
    { response: channelResponse() },
    { response: emptyResponse(200, { location: UPLOAD_URL }) },
    { response: jsonResponse({ id: "video-mismatch" }) },
    { response: jsonResponse({ items: [{ snippet: { thumbnails: { default: {} } } }] }) },
    {
      response: jsonResponse({
        items: [
          {
            id: "video-mismatch",
            snippet: {
              title: "Wrong title",
              description: "Approved description",
              tags: ["brain health", "Dr. David Musnick"],
              categoryId: "27",
            },
            status: {
              privacyStatus: "private",
              license: "youtube",
              selfDeclaredMadeForKids: false,
              containsSyntheticMedia: false,
              uploadStatus: "processed",
            },
            processingDetails: { processingStatus: "succeeded" },
          },
        ],
      }),
    },
  ]);
  const adapter = createYouTubeAdapter(adapterOptions(fixture), { fetch, now: () => FIXED_NOW });

  await assert.rejects(adapter.publish(publication(fixture), lifecycleHarness().runtime), (error) => {
    assert.ok(error instanceof YouTubeAdapterError);
    assert.equal(error.code, "readback_mismatch");
    assert.equal(error.evidence.result, "failed");
    assert.equal(error.evidence.failure.videoId, "video-mismatch");
    assert.deepEqual(error.evidence.failure.mismatches, ["title"]);
    const serialized = JSON.stringify(error.evidence);
    for (const secret of [ACCESS_TOKEN, REFRESH_TOKEN, CLIENT_SECRET]) assert.ok(!serialized.includes(secret));
    return true;
  });
  fetch.assertComplete();
});

test("processing poll tolerates eventual readback and waits until the uploaded video succeeds", async (t) => {
  const fixture = await makeFixture(t);
  const expectedSnippet = {
    title: "Brain Health Test",
    description: "Approved description",
    tags: ["brain health", "Dr. David Musnick"],
    categoryId: "27",
  };
  const expectedStatus = {
    privacyStatus: "private",
    license: "youtube",
    selfDeclaredMadeForKids: false,
    containsSyntheticMedia: false,
    uploadStatus: "uploaded",
  };
  const fetch = scriptedFetch([
    { response: channelResponse() },
    { response: emptyResponse(200, { location: UPLOAD_URL }) },
    { response: jsonResponse({ id: "video-poll" }) },
    { response: jsonResponse({ items: [] }) },
    {
      response: jsonResponse({
        items: [
          {
            id: "video-poll",
            snippet: expectedSnippet,
            status: expectedStatus,
            processingDetails: { processingStatus: "processing" },
          },
        ],
      }),
    },
    {
      response: jsonResponse({
        items: [
          {
            id: "video-poll",
            snippet: expectedSnippet,
            status: { ...expectedStatus, uploadStatus: "processed" },
            processingDetails: { processingStatus: "succeeded" },
          },
        ],
      }),
    },
  ]);
  let sleeps = 0;
  const adapter = createYouTubeAdapter(adapterOptions(fixture, { maxPollAttempts: 3 }), {
    fetch,
    now: () => FIXED_NOW,
    sleep: async () => {
      sleeps += 1;
    },
  });

  const lifecycle = lifecycleHarness();
  const evidence = await adapter.publish(
    publication(fixture, { thumbnailPath: null, thumbnailSha256: null }),
    lifecycle.runtime,
  );

  assert.equal(evidence.readback.attempts, 3);
  assert.equal(evidence.thumbnail.set, false);
  assert.equal(sleeps, 2);
  assert.ok(lifecycle.checkpoints.some(({ checkpoint }) => checkpoint.phase === "processing"));
  fetch.assertComplete();
});

test("a crash immediately after session creation leaves a resumable durable checkpoint", async (t) => {
  const fixture = await makeFixture(t);
  const fetch = scriptedFetch([
    { response: channelResponse() },
    { response: emptyResponse(200, { location: UPLOAD_URL }) },
  ]);
  const lifecycle = lifecycleHarness({
    onCheckpoint(event) {
      if (event.checkpoint.phase === "session_created") throw new Error("simulated process loss");
    },
  });
  const adapter = createYouTubeAdapter(adapterOptions(fixture), {
    fetch,
    now: () => FIXED_NOW,
  });

  await assert.rejects(
    adapter.publish(publication(fixture), lifecycle.runtime),
    (error) => error instanceof YouTubeAdapterError && error.code === "checkpoint_persist_failed",
  );

  assert.deepEqual(lifecycle.writes.map(({ step }) => step), ["initiate_resumable_upload"]);
  assert.equal(lifecycle.checkpoints.length, 1);
  assert.equal(lifecycle.checkpoints[0].checkpoint.protocolVersion, 1);
  assert.equal(lifecycle.checkpoints[0].checkpoint.phase, "session_created");
  assert.equal(lifecycle.checkpoints[0].checkpoint.uploadUrl, UPLOAD_URL);
  assert.equal(lifecycle.checkpoints[0].providerAccepted, false);
  assert.ok(!fetch.calls.some((call) => call.headers["content-range"]?.startsWith("bytes 0-")));
  fetch.assertComplete();
});

test("reconcile resumes the exact saved YouTube session and provider offset without another insert", async (t) => {
  const fixture = await makeFixture(t);
  let durableCheckpoint = null;
  const initialFetch = scriptedFetch([
    { response: channelResponse() },
    { response: emptyResponse(200, { location: UPLOAD_URL }) },
  ]);
  const initialLifecycle = lifecycleHarness({
    onCheckpoint(event) {
      durableCheckpoint = structuredClone(event.checkpoint);
      if (event.checkpoint.phase === "session_created") throw new Error("simulated process loss");
    },
  });
  const firstAdapter = createYouTubeAdapter(adapterOptions(fixture), {
    fetch: initialFetch,
    now: () => FIXED_NOW,
  });
  await assert.rejects(firstAdapter.publish(publication(fixture), initialLifecycle.runtime));
  initialFetch.assertComplete();

  const fetch = scriptedFetch([
    { response: channelResponse() },
    {
      assert(call) {
        assert.equal(call.url, UPLOAD_URL);
        assert.equal(call.method, "PUT");
        assert.equal(call.headers["content-range"], "bytes */32");
        assert.equal(call.headers["content-length"], "0");
      },
      response: emptyResponse(308, { range: "bytes=0-9" }),
    },
    {
      assert(call) {
        assert.equal(call.url, UPLOAD_URL);
        assert.equal(call.headers["content-range"], "bytes 10-31/32");
        assert.equal(call.body.length, 22);
      },
      response: jsonResponse({ id: "video-resumed" }),
    },
    { response: jsonResponse({ items: [{ snippet: { thumbnails: { default: {} } } }] }) },
    {
      response: jsonResponse({
        items: [{
          id: "video-resumed",
          snippet: {
            title: "Brain Health Test",
            description: "Approved description",
            tags: ["brain health", "Dr. David Musnick"],
            categoryId: "27",
          },
          status: {
            privacyStatus: "private",
            license: "youtube",
            selfDeclaredMadeForKids: false,
            containsSyntheticMedia: false,
            uploadStatus: "processed",
          },
          processingDetails: { processingStatus: "succeeded" },
        }],
      }),
    },
  ]);
  const lifecycle = lifecycleHarness({ checkpoint: durableCheckpoint });
  const adapter = createYouTubeAdapter(adapterOptions(fixture), {
    fetch,
    now: () => FIXED_NOW,
    sleep: async () => {},
  });

  const evidence = await adapter.reconcile(publication(fixture), lifecycle.runtime);

  assert.equal(evidence.upload.videoId, "video-resumed");
  assert.equal(evidence.upload.resumed, true);
  assert.equal(fetch.calls.filter((call) => call.method === "POST" && call.url.includes("/videos")).length, 0);
  assert.deepEqual(lifecycle.writes.map(({ step }) => step), ["upload_video_chunk", "set_thumbnail"]);
  assert.equal(lifecycle.checkpoints.at(-1).checkpoint.phase, "verified");
  fetch.assertComplete();
});

test("an expired checkpointed session fails closed without initiating another upload", async (t) => {
  const fixture = await makeFixture(t);
  let durableCheckpoint = null;
  const initialFetch = scriptedFetch([
    { response: channelResponse() },
    { response: emptyResponse(200, { location: UPLOAD_URL }) },
  ]);
  const initialLifecycle = lifecycleHarness({
    onCheckpoint(event) {
      durableCheckpoint = structuredClone(event.checkpoint);
      throw new Error("simulated process loss");
    },
  });
  const firstAdapter = createYouTubeAdapter(adapterOptions(fixture), {
    fetch: initialFetch,
    now: () => FIXED_NOW,
  });
  await assert.rejects(firstAdapter.publish(publication(fixture), initialLifecycle.runtime));
  initialFetch.assertComplete();

  const fetch = scriptedFetch([
    { response: channelResponse() },
    {
      assert(call) {
        assert.equal(call.url, UPLOAD_URL);
        assert.equal(call.headers["content-range"], "bytes */32");
      },
      response: emptyResponse(410),
    },
  ]);
  const lifecycle = lifecycleHarness({ checkpoint: durableCheckpoint });
  const adapter = createYouTubeAdapter(adapterOptions(fixture), {
    fetch,
    now: () => FIXED_NOW,
  });

  await assert.rejects(
    adapter.reconcile(publication(fixture), lifecycle.runtime),
    (error) => error instanceof YouTubeAdapterError && error.code === "upload_session_expired",
  );

  assert.equal(fetch.calls.filter((call) => call.method === "POST" && call.url.includes("/videos")).length, 0);
  assert.deepEqual(lifecycle.writes, []);
  assert.deepEqual(lifecycle.checkpoints, []);
  fetch.assertComplete();
});

test("publish treats any supplied unusable checkpoint as prior state and never starts a new session", async (t) => {
  const fixture = await makeFixture(t);
  const fetch = scriptedFetch([{ response: channelResponse() }]);
  const lifecycle = lifecycleHarness({ checkpoint: "corrupt-checkpoint" });
  const adapter = createYouTubeAdapter(adapterOptions(fixture), {
    fetch,
    now: () => FIXED_NOW,
  });

  await assert.rejects(
    adapter.publish(publication(fixture), lifecycle.runtime),
    (error) => error instanceof YouTubeAdapterError && error.code === "checkpoint_missing",
  );

  assert.deepEqual(lifecycle.writes, []);
  assert.ok(!fetch.calls.some((call) => call.method === "POST"));
  fetch.assertComplete();
});

test("reconcile recovers a checkpointed video ID through readback without a new session", async (t) => {
  const fixture = await makeFixture(t);
  const approvedPublication = publication(fixture, { thumbnailPath: null, thumbnailSha256: null });
  let acceptedCheckpoint = null;
  const initialFetch = scriptedFetch([
    { response: channelResponse() },
    { response: emptyResponse(200, { location: UPLOAD_URL }) },
    { response: jsonResponse({ id: "video-recovered" }) },
  ]);
  const initialLifecycle = lifecycleHarness({
    onCheckpoint(event) {
      if (event.checkpoint.videoId) {
        acceptedCheckpoint = structuredClone(event.checkpoint);
        throw new Error("simulated process loss after provider acceptance");
      }
    },
  });
  const firstAdapter = createYouTubeAdapter(adapterOptions(fixture), {
    fetch: initialFetch,
    now: () => FIXED_NOW,
  });
  await assert.rejects(firstAdapter.publish(approvedPublication, initialLifecycle.runtime));
  assert.equal(acceptedCheckpoint.videoId, "video-recovered");
  initialFetch.assertComplete();

  const fetch = scriptedFetch([
    { response: channelResponse() },
    {
      assert(call) {
        assert.equal(call.method, "GET");
        assert.match(call.url, /id=video-recovered/);
      },
      response: jsonResponse({
        items: [{
          id: "video-recovered",
          snippet: {
            title: "Brain Health Test",
            description: "Approved description",
            tags: ["brain health", "Dr. David Musnick"],
            categoryId: "27",
          },
          status: {
            privacyStatus: "private",
            license: "youtube",
            selfDeclaredMadeForKids: false,
            containsSyntheticMedia: false,
            uploadStatus: "processed",
          },
          processingDetails: { processingStatus: "succeeded" },
        }],
      }),
    },
  ]);
  const lifecycle = lifecycleHarness({ checkpoint: acceptedCheckpoint });
  const adapter = createYouTubeAdapter(adapterOptions(fixture), {
    fetch,
    now: () => FIXED_NOW,
  });

  const evidence = await adapter.reconcile(approvedPublication, lifecycle.runtime);

  assert.equal(evidence.readback.videoId, "video-recovered");
  assert.equal(evidence.remoteWrites, 0);
  assert.deepEqual(lifecycle.writes, []);
  assert.ok(!fetch.calls.some((call) => call.url.includes("upload/youtube/v3/videos")));
  assert.equal(lifecycle.checkpoints.at(-1).checkpoint.phase, "verified");
  fetch.assertComplete();
});
