import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  readReceiptLedger,
  recordAdapterAccepted,
  recordAdapterVerified,
} from "./adapter-receipts.mjs";
import {
  PublishingControllerError,
  createPublishingController,
  defaultResolveAdapter,
  youtubePublication,
} from "./controller.mjs";
import { openControlStore } from "./control-store.mjs";

function fixture(jobDirectory) {
  const target = {
    id: "vimeo",
    label: "Vimeo",
    mode: "api_after_auth",
    channelUrl: "https://vimeo.com/drmexperienced",
    destinationIds: { accountId: "253415660", containerId: null },
    assetSha256: "d".repeat(64),
    approvedCopy: "Approved Vimeo description",
    releasePlan: {
      releaseMode: "publish_now",
      initialVisibility: "nobody",
      finalVisibility: "anybody",
      license: "none",
      notifications: "disabled",
    },
  };
  const packet = {
    id: "episode-eight-20260808t230000z",
    approvalHash: "a".repeat(64),
    snapshot: {
      catalogBinding: {
        revision: 12,
        catalogHash: "b".repeat(64),
        episodeNumber: 8,
        episodeHash: "c".repeat(64),
      },
      manifest: { episodeNumber: 8, slug: "episode-eight" },
      targets: [target],
    },
  };
  const authorization = {
    targets: ["vimeo"],
    authorizationHash: "e".repeat(64),
  };
  return {
    directory: jobDirectory,
    packet,
    authorization,
    catalogEpisode: { number: 8, destinations: {}, publicationState: "draft" },
    platformConfig: {
      publishingAutomation: { enabled: true },
      platforms: {
        vimeo: { mode: "api_after_auth", apiAutomation: { enabled: true } },
      },
    },
  };
}

function advancingClock() {
  let value = Date.parse("2026-08-09T23:00:00.000Z");
  return () => new Date(value++);
}

async function runningControl() {
  return {
    schemaVersion: 1,
    generation: 1,
    mode: "running",
    allowedPlatforms: ["vimeo"],
    updatedAt: "2026-08-09T23:00:00Z",
  };
}

async function setup() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "drm-controller-"));
  const jobDirectory = path.join(directory, "job");
  await fs.mkdir(jobDirectory, { mode: 0o700 });
  const store = await openControlStore({
    filePath: path.join(directory, "publisher.sqlite3"),
    now: advancingClock(),
  });
  const context = fixture(jobDirectory);
  const [queued] = store.enqueueAuthorizedJob(context.packet, context.authorization);
  return { directory, jobDirectory, store, context, operation: queued.operation };
}

test("controller preflights, publishes, records immutable receipts, and verifies the lease", async () => {
  const state = await setup();
  try {
    let preflights = 0;
    let publishes = 0;
    const controller = createPublishingController({
      store: state.store,
      now: advancingClock(),
      loadControl: runningControl,
      loadContext: async () => state.context,
      resolveAdapter: async () => ({
        input: { approved: true },
        adapter: {
          checkpointProtocolVersion: 1,
          async preflight() {
            preflights += 1;
            return { account: "253415660", remoteWrites: 0 };
          },
          async publish(_input, lifecycle) {
            publishes += 1;
            await lifecycle.beforeWrite({ step: "create_private_video" });
            await lifecycle.onCheckpoint({
              checkpoint: { phase: "video_created", videoId: "1234567890" },
              providerAccepted: true,
              remoteId: "1234567890",
              remoteUrl: "https://vimeo.com/1234567890",
              providerSummary: "Vimeo accepted private video 1234567890.",
            });
            return { remote: { id: "1234567890", url: "https://vimeo.com/1234567890" } };
          },
        },
        resultIdentity(result) {
          return {
            remoteId: result.remote.id,
            remoteUrl: result.remote.url,
            providerSummary: "Vimeo accepted and processed video 1234567890.",
            readbackSummary: "Vimeo API readback matched video 1234567890 on account 253415660.",
          };
        },
      }),
    });

    const result = await controller.runOnce();
    assert.equal(result.state, "verified");
    assert.equal(preflights, 1);
    assert.equal(publishes, 1);
    assert.equal(state.store.get(state.operation.operationId).state, "verified");
    const receipts = await readReceiptLedger(state.jobDirectory, state.context.packet);
    assert.deepEqual(receipts.map((receipt) => receipt.status), ["accepted", "published", "verified"]);
  } finally {
    state.store.close();
    await fs.rm(state.directory, { recursive: true, force: true });
  }
});

test("controller honors the global and per-platform runtime automation kill switches", async () => {
  for (const disabled of ["global", "platform"]) {
    const state = await setup();
    try {
      if (disabled === "global") state.context.platformConfig.publishingAutomation.enabled = false;
      else state.context.platformConfig.platforms.vimeo.apiAutomation.enabled = false;
      let resolved = false;
      const controller = createPublishingController({
        store: state.store,
        now: advancingClock(),
        loadControl: runningControl,
        loadContext: async () => state.context,
        resolveAdapter: async () => {
          resolved = true;
          throw new Error("must not resolve while automation is disabled");
        },
      });
      const result = await controller.runOnce();
      assert.equal(result.state, "blocked");
      assert.equal(
        result.error.code,
        disabled === "global" ? "publishing_kill_switch_active" : "platform_automation_disabled",
      );
      assert.equal(resolved, false);
      assert.equal(state.store.get(state.operation.operationId).providerWriteStartedAt, null);
    } finally {
      state.store.close();
      await fs.rm(state.directory, { recursive: true, force: true });
    }
  }
});

test("a paused machine-local control leases no work", async () => {
  const state = await setup();
  try {
    let contextLoaded = false;
    const controller = createPublishingController({
      store: state.store,
      now: advancingClock(),
      loadControl: async () => ({
        schemaVersion: 1,
        generation: 2,
        mode: "paused",
        allowedPlatforms: [],
        updatedAt: "2026-08-09T23:00:00Z",
      }),
      loadContext: async () => {
        contextLoaded = true;
        return state.context;
      },
    });
    const result = await controller.runOnce();
    assert.equal(result.state, "paused");
    assert.equal(contextLoaded, false);
    assert.equal(state.store.get(state.operation.operationId).state, "queued");
    assert.equal(state.store.get(state.operation.operationId).attempts, 0);
  } finally {
    state.store.close();
    await fs.rm(state.directory, { recursive: true, force: true });
  }
});

test("controller never replays an operation that already has an accepted receipt", async () => {
  const state = await setup();
  try {
    await recordAdapterAccepted({
      jobDirectory: state.jobDirectory,
      packet: state.context.packet,
      platformId: "vimeo",
      operationId: state.operation.operationId,
      requestSummary: "A prior authenticated Vimeo request passed preflight.",
      recordedAt: "2026-08-08T22:59:00.000Z",
    });
    let adapterResolved = false;
    const controller = createPublishingController({
      store: state.store,
      now: advancingClock(),
      loadControl: runningControl,
      loadContext: async () => state.context,
      resolveAdapter: async () => {
        adapterResolved = true;
        throw new Error("must not resolve");
      },
    });

    const result = await controller.runOnce();
    assert.equal(result.state, "blocked");
    assert.equal(result.error.code, "ambiguous_prior_attempt");
    assert.equal(adapterResolved, false);
    assert.equal(state.store.get(state.operation.operationId).state, "blocked");
  } finally {
    state.store.close();
    await fs.rm(state.directory, { recursive: true, force: true });
  }
});

test("verified-receipt recovery rejects a remote identity that conflicts with the checkpoint", async () => {
  const state = await setup();
  try {
    const leased = state.store.leaseNext({ workerId: "prior-worker" });
    state.store.beginProviderWrite(leased.operationId, {
      workerId: "prior-worker",
      requestSummary: "Creating the exact authorized private Vimeo video.",
    });
    state.store.recordProviderCheckpoint(leased.operationId, {
      workerId: "prior-worker",
      checkpoint: { phase: "video_created", videoId: "1234567890" },
      providerAccepted: true,
      remoteId: "1234567890",
      remoteUrl: "https://vimeo.com/1234567890",
    });
    state.store.completeLease(leased.operationId, {
      workerId: "prior-worker",
      state: "waiting",
      nextAttemptAt: "2026-08-08T23:00:00.000Z",
      errorCode: "processing_timeout",
      errorMessage: "The durable remote video is still processing.",
    });
    await recordAdapterAccepted({
      jobDirectory: state.jobDirectory,
      packet: state.context.packet,
      platformId: "vimeo",
      operationId: state.operation.operationId,
      providerSummary: "Vimeo accepted a different video.",
      remoteId: "9999999999",
      remoteUrl: "https://vimeo.com/9999999999",
      recordedAt: "2026-08-08T22:59:00.000Z",
    });
    await recordAdapterVerified({
      jobDirectory: state.jobDirectory,
      packet: state.context.packet,
      platformId: "vimeo",
      operationId: state.operation.operationId,
      remoteId: "9999999999",
      remoteUrl: "https://vimeo.com/9999999999",
      providerSummary: "Vimeo published a different video.",
      readbackSummary: "Vimeo readback matched only the different video.",
      recordedAt: "2026-08-08T23:00:00.000Z",
    });
    let adapterResolved = false;
    const controller = createPublishingController({
      store: state.store,
      now: advancingClock(),
      loadControl: runningControl,
      loadContext: async () => state.context,
      resolveAdapter: async () => {
        adapterResolved = true;
        throw new Error("must not resolve");
      },
    });

    const result = await controller.runOnce();
    assert.equal(result.state, "blocked");
    assert.equal(result.error.code, "verified_receipt_identity_mismatch");
    assert.equal(adapterResolved, false);
    const retained = state.store.get(state.operation.operationId);
    assert.equal(retained.state, "blocked");
    assert.equal(retained.remoteId, "1234567890");
    assert.equal(retained.remoteUrl, "https://vimeo.com/1234567890");
  } finally {
    state.store.close();
    await fs.rm(state.directory, { recursive: true, force: true });
  }
});

test("an uncheckpointed provider response loss blocks without claiming acceptance or replaying", async () => {
  const state = await setup();
  try {
    let publishes = 0;
    const controller = createPublishingController({
      store: state.store,
      now: advancingClock(),
      loadControl: runningControl,
      loadContext: async () => state.context,
      resolveAdapter: async () => ({
        input: {},
        adapter: {
          checkpointProtocolVersion: 1,
          async preflight() {
            return { remoteWrites: 0 };
          },
          async publish(_input, lifecycle) {
            publishes += 1;
            await lifecycle.beforeWrite({ step: "create_private_video" });
            const error = new Error("provider response was interrupted");
            error.code = "ambiguous_provider_response";
            throw error;
          },
        },
        resultIdentity() {
          throw new Error("unreachable");
        },
      }),
    });

    const result = await controller.runOnce();
    assert.equal(result.state, "blocked");
    assert.equal(publishes, 1);
    const receipts = await readReceiptLedger(state.jobDirectory, state.context.packet);
    assert.deepEqual(receipts.map((receipt) => receipt.status), []);
    assert.equal(await controller.runOnce().then((next) => next.state), "idle");
  } finally {
    state.store.close();
    await fs.rm(state.directory, { recursive: true, force: true });
  }
});

test("a checkpointed transient failure resumes the exact remote resource", async () => {
  const state = await setup();
  try {
    let creates = 0;
    let reconciles = 0;
    const expiryModes = [];
    const resolveAdapter = async () => ({
      input: {},
      adapter: {
        checkpointProtocolVersion: 1,
        async preflight() {
          return { remoteWrites: 0 };
        },
        async publish(_input, lifecycle) {
          creates += 1;
          await lifecycle.beforeWrite({ step: "create_private_video" });
          await lifecycle.onCheckpoint({
            checkpoint: { phase: "video_created", videoId: "1234567890" },
            providerAccepted: true,
            remoteId: "1234567890",
            remoteUrl: "https://vimeo.com/1234567890",
            providerSummary: "Vimeo accepted private video 1234567890.",
          });
          const error = new Error("processing readback timed out");
          error.code = "processing_timeout";
          error.retryable = true;
          throw error;
        },
        async reconcile(_input, lifecycle) {
          reconciles += 1;
          assert.equal(lifecycle.checkpoint.videoId, "1234567890");
          return { remote: { id: "1234567890", url: "https://vimeo.com/1234567890" } };
        },
      },
      resultIdentity(result) {
        return {
          remoteId: result.remote.id,
          remoteUrl: result.remote.url,
          providerSummary: "Vimeo accepted and processed video 1234567890.",
          readbackSummary: "Vimeo API readback matched video 1234567890 on account 253415660.",
        };
      },
    });
    const controller = createPublishingController({
      store: state.store,
      now: advancingClock(),
      loadControl: runningControl,
      loadContext: async (_jobId, options) => {
        expiryModes.push(options.allowExpiredAuthorization);
        return state.context;
      },
      resolveAdapter,
    });

    const first = await controller.runOnce();
    assert.equal(first.state, "waiting");
    assert.equal(creates, 1);
    assert.equal(state.store.get(state.operation.operationId).state, "waiting");
    const dueController = createPublishingController({
      store: state.store,
      now: () => new Date("2026-08-10T00:00:00.000Z"),
      loadControl: runningControl,
      loadContext: async (_jobId, options) => {
        expiryModes.push(options.allowExpiredAuthorization);
        return state.context;
      },
      resolveAdapter,
    });
    const second = await dueController.runOnce();
    assert.equal(second.state, "verified");
    assert.equal(creates, 1);
    assert.equal(reconciles, 1);
    assert.deepEqual(expiryModes, [false, true]);
  } finally {
    state.store.close();
    await fs.rm(state.directory, { recursive: true, force: true });
  }
});

test("YouTube scheduled mapping cannot drift from private-to-public semantics", async () => {
  const target = {
    id: "youtube",
    destinationIds: { accountId: `UC${"A".repeat(22)}` },
    approvedCopy: "Approved YouTube copy",
    assetSha256: "d".repeat(64),
    releasePlan: {
      releaseMode: "scheduled",
      initialVisibility: "private",
      finalVisibility: "unlisted",
      license: "youtube",
      monetization: "not_applicable",
      notifications: "disabled",
    },
  };
  const packet = {
    snapshot: {
      manifest: {
        title: "Scheduled test",
        publishAt: "2026-09-01T15:00:00.000Z",
        paidPromotion: false,
        madeForKids: false,
        containsSyntheticMedia: false,
        tags: [],
        category: "Health & Fitness",
      },
      assets: {
        fullVideo: { path: "/tmp/video.mp4", sha256: "d".repeat(64) },
        thumbnail: { path: "/tmp/thumb.jpg", sha256: "e".repeat(64) },
      },
    },
  };
  assert.throws(
    () => youtubePublication(packet, target),
    (error) => error instanceof PublishingControllerError && error.code === "youtube_schedule_visibility_unsupported",
  );

  target.releasePlan.finalVisibility = "public";
  const publication = youtubePublication(packet, target);
  assert.equal(publication.status.privacyStatus, "private");
  assert.equal(publication.status.publishAt, packet.snapshot.manifest.publishAt);
  assert.equal(publication.videoSha256, packet.snapshot.assets.fullVideo.sha256);

  await assert.rejects(
    defaultResolveAdapter({
      context: {
        packet,
        authorization: { authorizationHash: "f".repeat(64) },
        catalogEpisode: { destinations: {}, publicationState: "draft" },
        platformConfig: {
          platforms: { youtube: { apiAutomation: { enabled: false, publicUploadAuditVerified: false } } },
        },
      },
      target,
    }),
    (error) => error instanceof PublishingControllerError && error.code === "youtube_public_upload_audit_required",
  );
});

test("RSS create never substitutes the 16:9 video thumbnail for podcast artwork", async () => {
  const target = {
    id: "rss.com",
    destinationIds: { accountId: "397420", containerId: "dr-m-experienced" },
  };
  const execution = await defaultResolveAdapter({
    context: {
      packet: {
        snapshot: {
          manifest: { paidPromotion: false },
          assets: { thumbnail: { path: "/tmp/video-thumbnail-1920x1080.jpg" } },
        },
      },
      catalogEpisode: { destinations: {}, publicationState: "draft", guid: null },
    },
    target,
  });
  assert.equal(Object.hasOwn(execution.input, "artwork"), false);
});
