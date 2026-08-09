import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { RssAdapterError, createRssAdapter } from "./rss.mjs";

const API_KEY = "rss_secret_api_key_never_return_this";
const PODCAST_ID = "397420";
const PODCAST_SLUG = "dr-m-experienced";
const AUDIO_PATH = "/media/episode-8.mp3";
const ART_PATH = "/media/episode-8-art.jpg";
const KEY_PATH = "/home/test/.config/drm-publisher/rss.com/api-key";
const AUDIO = Buffer.from("approved normalized podcast audio bytes");
const ART = Buffer.from("approved square artwork bytes");
const AUDIO_SHA = createHash("sha256").update(AUDIO).digest("hex");
const ART_SHA = createHash("sha256").update(ART).digest("hex");
const STAGED_AUDIO_PATH = `/private/sha256/${AUDIO_SHA}`;
const STAGED_ART_PATH = `/private/sha256/${ART_SHA}`;
const APPROVAL_HASH = "a".repeat(64);
const EPISODE_HASH = "b".repeat(64);
const GUID = "episode-eight-stable-guid";

async function stageAssetForTest(asset) {
  const stagedPath = asset.sha256 === AUDIO_SHA ? STAGED_AUDIO_PATH : STAGED_ART_PATH;
  return { path: stagedPath, sha256: asset.sha256, sizeBytes: asset.sizeBytes, reused: false };
}

function memoryFs({ keyMode = 0o100600, keyUid = 1002, includeKey = true } = {}) {
  const files = new Map([
    [AUDIO_PATH, AUDIO],
    [ART_PATH, ART],
    ...(includeKey ? [[KEY_PATH, Buffer.from(`${API_KEY}\n`)]] : []),
  ]);
  return {
    async stat(filePath) {
      const value = files.get(filePath);
      if (!value) throw Object.assign(new Error("missing"), { code: "ENOENT" });
      return {
        size: value.length,
        mode: filePath === KEY_PATH ? keyMode : 0o100600,
        uid: filePath === KEY_PATH ? keyUid : 1002,
        isFile: () => true,
      };
    },
    async readFile(filePath, encoding) {
      const value = files.get(filePath);
      if (!value) throw Object.assign(new Error("missing"), { code: "ENOENT" });
      return encoding ? value.toString(encoding) : Buffer.from(value);
    },
    async open(filePath) {
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

function responseJson(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function responseEmpty(status = 200) {
  return new Response(null, { status });
}

function podcastBody(overrides = {}) {
  return {
    id: Number(PODCAST_ID),
    slug: PODCAST_SLUG,
    title: "Dr. M Experienced, with Dr. David Musnick",
    role: "owner",
    hibernated: false,
    feed_url: `https://media.rss.com/${PODCAST_SLUG}/feed.xml`,
    ...overrides,
  };
}

function episodeBody({ id = 3050767, guid = "new-guid", status = "published", processing = "done", ...rest } = {}) {
  return {
    id,
    guid,
    title: "Exercise as Medicine - Building Capacity That Lasts",
    description: "<p>Exact approved RSS.com show notes.</p>",
    itunes_explicit: false,
    itunes_episode: 8,
    itunes_season: null,
    itunes_episode_type: "full",
    ai_content: false,
    status,
    audio_url: status === "published" ? "https://content.rss.com/episodes/397420/3050767/audio.mp3" : null,
    audio_preview_url: status === "published" ? null : "https://preview.rss.com/audio.mp3",
    cover_url: "https://content.rss.com/episodes/397420/3050767/cover.jpg",
    dashboard_url: "https://dashboard.rss.com/podcasts/dr-m-experienced/episodes/3050767",
    website_url: "https://rss.com/podcasts/dr-m-experienced/3050767/",
    schedule_datetime: null,
    processing: { transcode: { status: processing, details: null } },
    ...rest,
  };
}

function approvedInput({
  operation = "create",
  artwork = true,
  releaseMode = "publish_now",
  existingEpisodeId = null,
  expectedGuid = null,
  approvedBinding = null,
} = {}) {
  return {
    packet: {
      id: "exercise-as-medicine-20260808t220000z",
      approvalHash: APPROVAL_HASH,
      snapshot: {
        catalogBinding: { episodeHash: EPISODE_HASH },
        manifest: {
          episodeNumber: 8,
          title: "Exercise as Medicine - Building Capacity That Lasts",
          description: "<p>Exact approved RSS.com show notes.</p>",
          publishAt: "2026-09-01T15:00:00.000Z",
          explicit: false,
          containsSyntheticMedia: false,
        },
        assets: {
          podcastAudio: {
            path: AUDIO_PATH,
            sizeBytes: AUDIO.length,
            sha256: AUDIO_SHA,
            mediaType: "audio/mpeg",
          },
          podcastArtwork: artwork
            ? { path: ART_PATH, sizeBytes: ART.length, sha256: ART_SHA, mediaType: "image/jpeg" }
            : null,
        },
        targets: [{
          id: "rss.com",
          assetSha256: AUDIO_SHA,
          approvedCopy: "<p>Exact approved RSS.com show notes.</p>",
          destinationIds: { accountId: PODCAST_ID, containerId: PODCAST_SLUG },
          releasePlan: {
            releaseMode,
            initialVisibility: "draft",
            finalVisibility: "public",
            license: "not_applicable",
            monetization: "not_applicable",
            notifications: "not_applicable",
          },
        }],
      },
    },
    operation: { kind: operation, existingEpisodeId, expectedGuid, approvedBinding },
  };
}

function exactBinding(episodeId = "3050767") {
  return {
    platformId: "rss.com",
    action: "replace_episode_audio",
    remoteId: episodeId,
    destinationPodcastId: PODCAST_ID,
    destinationSlug: PODCAST_SLUG,
    assetSha256: AUDIO_SHA,
    approvalHash: APPROVAL_HASH,
    episodeHash: EPISODE_HASH,
    rssGuid: GUID,
  };
}

function fakeReadStream(filePath) {
  return { filePath, destroy() {} };
}

function durableLifecycle(initialCheckpoint = null) {
  let checkpoint = initialCheckpoint == null ? null : structuredClone(initialCheckpoint);
  const writes = [];
  const checkpoints = [];
  return {
    get checkpoint() { return checkpoint; },
    writes,
    checkpoints,
    async beforeWrite({ step }) { writes.push(step); },
    async onCheckpoint(entry) {
      checkpoint = structuredClone(entry.checkpoint);
      checkpoints.push(structuredClone(entry));
    },
  };
}

test("dryRun validates exact assets and destination without reading credentials or using the network", async () => {
  let fetchCount = 0;
  let keyRead = false;
  const baseFs = memoryFs();
  const adapter = createRssAdapter({
    fetchImpl: async () => { fetchCount += 1; throw new Error("network must not be used"); },
    fsImpl: {
      ...baseFs,
      async readFile(filePath, encoding) {
        if (filePath === KEY_PATH) keyRead = true;
        return baseFs.readFile(filePath, encoding);
      },
    },
    env: {},
    homeDir: "/home/test",
    expectedCredentialOwnerUid: 1002,
    now: () => Date.parse("2026-08-08T22:00:00Z"),
  });

  const result = await adapter.dryRun(approvedInput());

  assert.equal(result.writes, false);
  assert.equal(result.podcast.expectedId, PODCAST_ID);
  assert.equal(result.podcast.expectedSlug, PODCAST_SLUG);
  assert.equal(result.asset.sha256, AUDIO_SHA);
  assert.equal(result.artwork.sha256, ART_SHA);
  assert.equal(fetchCount, 0);
  assert.equal(keyRead, false);
  assert.ok(!JSON.stringify(result).includes(API_KEY));
});

test("preflight requires an owner-only API-key file and blocks missing credentials", async () => {
  for (const fixture of [
    { fsImpl: memoryFs({ includeKey: false }), code: "AUTH_REQUIRED" },
    { fsImpl: memoryFs({ keyMode: 0o100640 }), code: "INSECURE_CREDENTIAL_FILE" },
    { fsImpl: memoryFs({ keyUid: 9999 }), code: "INSECURE_CREDENTIAL_FILE" },
  ]) {
    const adapter = createRssAdapter({
      fetchImpl: async () => { throw new Error("network must not be used"); },
      fsImpl: fixture.fsImpl,
      env: {},
      homeDir: "/home/test",
      expectedCredentialOwnerUid: 1002,
    });
    await assert.rejects(adapter.preflight(approvedInput()), (error) => error.code === fixture.code);
  }
});

test("preflight verifies the exact numeric podcast ID and permanent slug with no write", async () => {
  const calls = [];
  const adapter = createRssAdapter({
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return responseJson(podcastBody());
    },
    fsImpl: memoryFs(),
    env: {},
    homeDir: "/home/test",
    expectedCredentialOwnerUid: 1002,
  });

  const result = await adapter.preflight(approvedInput());

  assert.equal(result.ready, true);
  assert.equal(result.credentials.source, "file");
  assert.equal(result.podcast.id, PODCAST_ID);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, "GET");
  assert.equal(new URL(calls[0].url).pathname, `/v4/podcasts/${PODCAST_ID}`);
  assert.equal(calls[0].init.headers["X-Api-Key"], API_KEY);
  assert.ok(!JSON.stringify(result).includes(API_KEY));
});

test("account/slug mismatch and plan/API denial hard block before writes", async () => {
  for (const fixture of [
    { response: responseJson(podcastBody({ slug: "wrong-show" })), code: "PODCAST_MISMATCH" },
    { response: responseJson({ status: 402, message: "Max plan required" }, 402), code: "API_PLAN_UNAVAILABLE" },
  ]) {
    const methods = [];
    const adapter = createRssAdapter({
      fetchImpl: async (_url, init) => { methods.push(init.method); return fixture.response; },
      fsImpl: memoryFs(),
      env: { ["DRM_RSS_COM_API_KEY"]: API_KEY },
      createReadStreamImpl: fakeReadStream,
    });
    await assert.rejects(adapter.publish(approvedInput(), durableLifecycle()), (error) => error.code === fixture.code);
    assert.deepEqual(methods, ["GET"]);
  }
});

test("publish uploads approved audio/artwork, creates one episode, and verifies exact readback", async () => {
  const calls = [];
  let readCount = 0;
  const adapter = createRssAdapter({
    fetchImpl: async (urlValue, init) => {
      const url = new URL(urlValue);
      calls.push({ url: url.href, method: init.method, headers: init.headers, body: init.body });
      if (url.hostname === "api.rss.com" && url.pathname === `/v4/podcasts/${PODCAST_ID}`) {
        return responseJson(podcastBody());
      }
      if (url.hostname === "api.rss.com" && url.pathname.endsWith("/assets/presigned-uploads")) {
        const body = JSON.parse(init.body);
        return responseJson({
          id: body.asset_type === "audio" ? "audio-upload-id" : "cover-upload-id",
          url: `https://uploads.rss.test/${body.asset_type}?signature=secret-signed-value`,
          asset_type: body.asset_type,
          expected_mime: body.expected_mime,
          filename: body.filename,
        }, 201);
      }
      if (url.hostname === "uploads.rss.test") {
        assert.equal(init.headers["X-Api-Key"], undefined);
        assert.equal(init.headers["Content-Length"], url.pathname === "/audio" ? String(AUDIO.length) : String(ART.length));
        assert.equal(init.body.filePath, url.pathname === "/audio" ? STAGED_AUDIO_PATH : STAGED_ART_PATH);
        return responseEmpty(200);
      }
      if (url.hostname === "api.rss.com" && url.pathname.endsWith("/episodes") && init.method === "POST") {
        const body = JSON.parse(init.body);
        assert.deepEqual(body, {
          title: "Exercise as Medicine - Building Capacity That Lasts",
          description: "<p>Exact approved RSS.com show notes.</p>",
          itunes_explicit: false,
          itunes_episode: 8,
          itunes_season: null,
          itunes_episode_type: "full",
          custom_link: null,
          schedule_datetime: "2026-08-08T22:00:00.000Z",
          apple_episode_access_type: "PUBLIC",
          ai_content: false,
          audio_upload_id: "audio-upload-id",
          cover_upload_id: "cover-upload-id",
        });
        return responseJson(episodeBody({ processing: "pending" }), 201);
      }
      if (url.hostname === "api.rss.com" && url.pathname.endsWith("/episodes/3050767")) {
        readCount += 1;
        return responseJson(episodeBody({ processing: readCount === 1 ? "processing" : "done" }));
      }
      throw new Error(`Unexpected ${init.method} ${url.href}`);
    },
    fsImpl: memoryFs(),
    createReadStreamImpl: fakeReadStream,
    stageAssetImpl: stageAssetForTest,
    env: { ["DRM_RSS_COM_API_KEY"]: API_KEY },
    sleep: async () => {},
    now: () => Date.parse("2026-08-08T22:00:00Z"),
  });

  const lifecycle = durableLifecycle();
  const result = await adapter.publish(approvedInput(), lifecycle);

  assert.equal(result.outcome, "verified");
  assert.equal(result.remote.id, "3050767");
  assert.equal(result.remote.status, "published");
  assert.equal(result.uploads.audio.id, "audio-upload-id");
  assert.equal(result.uploads.artwork.id, "cover-upload-id");
  assert.equal(result.uploads.presignedUrlsRedacted, true);
  assert.equal(result.verification.processingStatus, "done");
  assert.equal(result.verification.polls, 2);
  assert.ok(!JSON.stringify(result).includes(API_KEY));
  assert.ok(!JSON.stringify(result).includes("secret-signed-value"));
  assert.equal(calls.filter((call) => call.method === "POST" && new URL(call.url).pathname.endsWith("/episodes")).length, 1);
  assert.deepEqual(lifecycle.writes, [
    "create_audio_upload_session",
    "upload_audio_bytes",
    "create_artwork_upload_session",
    "upload_artwork_bytes",
    "create_episode",
  ]);
  assert.equal(lifecycle.checkpoint.phase, "verified");
  assert.equal(lifecycle.checkpoints.filter((entry) => entry.providerAccepted).length, 2);
});

test("reconcile resumes a checkpointed episode identity without another create or upload", async () => {
  const lifecycle = durableLifecycle();
  let episodeCreates = 0;
  let uploadPuts = 0;
  const first = createRssAdapter({
    fetchImpl: async (urlValue, init) => {
      const url = new URL(urlValue);
      if (url.pathname === `/v4/podcasts/${PODCAST_ID}`) return responseJson(podcastBody());
      if (url.pathname.endsWith("/assets/presigned-uploads")) {
        return responseJson({
          id: "audio-resume-id",
          url: "https://uploads.rss.test/audio?signature=private",
          asset_type: "audio",
          expected_mime: "audio/mpeg",
          filename: "episode-8.mp3",
        }, 201);
      }
      if (url.hostname === "uploads.rss.test") {
        uploadPuts += 1;
        return responseEmpty(200);
      }
      if (url.pathname.endsWith("/episodes") && init.method === "POST") {
        episodeCreates += 1;
        return responseJson(episodeBody({ processing: "pending" }), 201);
      }
      if (url.pathname.endsWith("/episodes/3050767")) {
        return responseJson(episodeBody({ processing: "processing" }));
      }
      throw new Error(`Unexpected ${init.method} ${url.href}`);
    },
    fsImpl: memoryFs(),
    createReadStreamImpl: fakeReadStream,
    stageAssetImpl: stageAssetForTest,
    env: { ["DRM_RSS_COM_API_KEY"]: API_KEY },
    maxPolls: 1,
    now: () => Date.parse("2026-08-08T22:00:00Z"),
  });
  await assert.rejects(
    first.publish(approvedInput({ artwork: false }), lifecycle),
    (error) => error.code === "VERIFICATION_TIMEOUT" && error.retryable === true,
  );
  assert.equal(lifecycle.checkpoint.phase, "episode_accepted");

  const second = createRssAdapter({
    fetchImpl: async (urlValue, init) => {
      const url = new URL(urlValue);
      if (url.pathname === `/v4/podcasts/${PODCAST_ID}`) return responseJson(podcastBody());
      if (url.pathname.endsWith("/episodes/3050767") && init.method === "GET") {
        return responseJson(episodeBody({ processing: "done" }));
      }
      throw new Error(`Reconciliation must not write: ${init.method} ${url.href}`);
    },
    fsImpl: memoryFs(),
    createReadStreamImpl: fakeReadStream,
    stageAssetImpl: stageAssetForTest,
    env: { ["DRM_RSS_COM_API_KEY"]: API_KEY },
    now: () => Date.parse("2026-08-08T22:00:00Z"),
  });
  const result = await second.reconcile(approvedInput({ artwork: false }), lifecycle);
  assert.equal(result.remote.id, "3050767");
  assert.equal(lifecycle.checkpoint.phase, "verified");
  assert.equal(episodeCreates, 1);
  assert.equal(uploadPuts, 1);
});

test("an ambiguous create response cannot trigger a second episode POST", async () => {
  const lifecycle = durableLifecycle();
  let episodeCreates = 0;
  const first = createRssAdapter({
    fetchImpl: async (urlValue, init) => {
      const url = new URL(urlValue);
      if (url.pathname === `/v4/podcasts/${PODCAST_ID}`) return responseJson(podcastBody());
      if (url.pathname.endsWith("/assets/presigned-uploads")) {
        return responseJson({
          id: "audio-ambiguous-id",
          url: "https://uploads.rss.test/audio",
          asset_type: "audio",
          expected_mime: "audio/mpeg",
          filename: "episode-8.mp3",
        }, 201);
      }
      if (url.hostname === "uploads.rss.test") return responseEmpty(200);
      if (url.pathname.endsWith("/episodes") && init.method === "POST") {
        episodeCreates += 1;
        throw new Error("connection closed after request");
      }
      throw new Error(`Unexpected ${init.method} ${url.href}`);
    },
    fsImpl: memoryFs(),
    createReadStreamImpl: fakeReadStream,
    stageAssetImpl: stageAssetForTest,
    env: { ["DRM_RSS_COM_API_KEY"]: API_KEY },
    now: () => Date.parse("2026-08-08T22:00:00Z"),
  });
  await assert.rejects(
    first.publish(approvedInput({ artwork: false }), lifecycle),
    (error) => error.code === "NETWORK_ERROR",
  );
  assert.equal(lifecycle.checkpoint.phase, "episode_write_intent");

  const second = createRssAdapter({
    fetchImpl: async (urlValue, init) => {
      const url = new URL(urlValue);
      if (url.pathname === `/v4/podcasts/${PODCAST_ID}`) return responseJson(podcastBody());
      if (init.method === "POST") episodeCreates += 1;
      throw new Error(`Unexpected reconciliation request: ${init.method} ${url.href}`);
    },
    fsImpl: memoryFs(),
    createReadStreamImpl: fakeReadStream,
    stageAssetImpl: stageAssetForTest,
    env: { ["DRM_RSS_COM_API_KEY"]: API_KEY },
    now: () => Date.parse("2026-08-08T22:00:00Z"),
  });
  await assert.rejects(
    second.reconcile(approvedInput({ artwork: false }), lifecycle),
    (error) => error.code === "AMBIGUOUS_EPISODE_CREATE",
  );
  assert.equal(episodeCreates, 1);
});

test("replacement requires an exact immutable episode/GUID binding before network access", async () => {
  const adapter = createRssAdapter({
    fetchImpl: async () => { throw new Error("network must not be used"); },
    fsImpl: memoryFs(),
    env: { ["DRM_RSS_COM_API_KEY"]: API_KEY },
  });
  const input = approvedInput({
    operation: "replace",
    existingEpisodeId: "3050767",
    expectedGuid: GUID,
    approvedBinding: { ...exactBinding(), rssGuid: "wrong-guid" },
  });

  await assert.rejects(
    adapter.dryRun(input),
    (error) => error instanceof RssAdapterError && error.code === "REPLACEMENT_BINDING_MISMATCH",
  );
});

test("release mode, visibility, and unsupported controls cannot contradict the approved RSS action", async () => {
  const adapter = createRssAdapter({
    fetchImpl: async () => { throw new Error("network must not be used"); },
    fsImpl: memoryFs(),
    env: { ["DRM_RSS_COM_API_KEY"]: API_KEY },
    now: () => Date.parse("2026-08-08T22:00:00Z"),
  });
  for (const mutate of [
    (plan) => { plan.finalVisibility = "draft"; },
    (plan) => { plan.initialVisibility = "public"; },
    (plan) => { plan.monetization = "enabled"; },
    (plan) => { plan.notifications = "enabled"; },
  ]) {
    const input = approvedInput();
    mutate(input.packet.snapshot.targets[0].releasePlan);
    await assert.rejects(
      adapter.dryRun(input),
      (error) => error instanceof RssAdapterError && error.code === "UNSUPPORTED_RELEASE_CHOICE",
    );
  }
});

test("replacement reads exact ID/GUID before upload, patches that ID, and verifies GUID preservation", async () => {
  const calls = [];
  let exactEpisodeReads = 0;
  const adapter = createRssAdapter({
    fetchImpl: async (urlValue, init) => {
      const url = new URL(urlValue);
      calls.push({ method: init.method, url: url.href, body: init.body });
      if (url.hostname === "api.rss.com" && url.pathname === `/v4/podcasts/${PODCAST_ID}`) {
        return responseJson(podcastBody());
      }
      if (url.hostname === "api.rss.com" && url.pathname.endsWith("/episodes/3050767") && init.method === "GET") {
        exactEpisodeReads += 1;
        return responseJson(episodeBody({ guid: GUID, processing: "done" }));
      }
      if (url.hostname === "api.rss.com" && url.pathname.endsWith("/assets/presigned-uploads")) {
        return responseJson({
          id: "replacement-audio-upload",
          url: "https://uploads.rss.test/audio?signature=redacted",
          asset_type: "audio",
          expected_mime: "audio/mpeg",
          filename: "episode-8.mp3",
        }, 201);
      }
      if (url.hostname === "uploads.rss.test") return responseEmpty(200);
      if (url.hostname === "api.rss.com" && url.pathname.endsWith("/episodes/3050767") && init.method === "PATCH") {
        assert.equal(JSON.parse(init.body).audio_upload_id, "replacement-audio-upload");
        return responseJson(episodeBody({ guid: GUID, processing: "pending" }));
      }
      throw new Error(`Unexpected ${init.method} ${url.href}`);
    },
    fsImpl: memoryFs(),
    createReadStreamImpl: fakeReadStream,
    stageAssetImpl: stageAssetForTest,
    env: { ["DRM_RSS_COM_API_KEY"]: API_KEY },
    now: () => Date.parse("2026-08-08T22:00:00Z"),
  });
  const input = approvedInput({
    operation: "update",
    artwork: false,
    existingEpisodeId: "3050767",
    expectedGuid: GUID,
    approvedBinding: exactBinding(),
  });

  const result = await adapter.publish(input, durableLifecycle());

  assert.equal(result.operation, "replace");
  assert.equal(result.before.guid, GUID);
  assert.equal(result.remote.id, "3050767");
  assert.equal(result.remote.guid, GUID);
  assert.equal(result.verification.guidPreserved, true);
  assert.equal(exactEpisodeReads, 2);
  assert.deepEqual(
    calls.filter((call) => call.method === "GET" || call.method === "PATCH").map((call) => call.method),
    ["GET", "GET", "PATCH", "GET"],
  );
});

test("processing failure and GUID mutation are never reported as verified", async () => {
  for (const fixture of [
    { created: episodeBody({ guid: GUID, processing: "pending" }), read: episodeBody({ guid: GUID, processing: "error" }), code: "PROCESSING_FAILED" },
    { created: episodeBody({ guid: "changed-guid", processing: "pending" }), read: null, code: "GUID_CHANGED" },
  ]) {
    let episodeReads = 0;
    const adapter = createRssAdapter({
      fetchImpl: async (urlValue, init) => {
        const url = new URL(urlValue);
        if (url.pathname === `/v4/podcasts/${PODCAST_ID}`) return responseJson(podcastBody());
        if (url.pathname.endsWith("/episodes/3050767") && init.method === "GET") {
          episodeReads += 1;
          if (episodeReads === 1) return responseJson(episodeBody({ guid: GUID, processing: "done" }));
          return responseJson(fixture.read ?? episodeBody({ guid: GUID, processing: "done" }));
        }
        if (url.pathname.endsWith("/assets/presigned-uploads")) {
          return responseJson({ id: "audio-id", url: "https://uploads.rss.test/audio", asset_type: "audio", expected_mime: "audio/mpeg", filename: "episode-8.mp3" }, 201);
        }
        if (url.hostname === "uploads.rss.test") return responseEmpty(200);
        if (url.pathname.endsWith("/episodes/3050767") && init.method === "PATCH") return responseJson(fixture.created);
        throw new Error(`Unexpected ${init.method} ${url.href}`);
      },
      fsImpl: memoryFs(),
      createReadStreamImpl: fakeReadStream,
      stageAssetImpl: stageAssetForTest,
      env: { ["DRM_RSS_COM_API_KEY"]: API_KEY },
      sleep: async () => {},
      now: () => Date.parse("2026-08-08T22:00:00Z"),
    });
    const input = approvedInput({ operation: "replace", artwork: false, existingEpisodeId: "3050767", expectedGuid: GUID, approvedBinding: exactBinding() });
    await assert.rejects(adapter.publish(input, durableLifecycle()), (error) => {
      assert.equal(error.code, fixture.code);
      assert.equal(error.evidence.episodeWriteAttempted, true);
      assert.ok(error.evidence.remoteWrites >= 1);
      assert.equal(JSON.stringify(error.evidence).includes(API_KEY), false);
      return true;
    });
  }
});
