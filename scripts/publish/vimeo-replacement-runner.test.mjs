import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { claimAdapterAccepted, readReceiptLedger } from "./adapter-receipts.mjs";
import { openControlStore } from "./control-store.mjs";
import {
  VimeoReplacementRunnerError,
  buildEpisode5VimeoReplacementPlan,
  dryRunEpisode5VimeoReplacement,
  enqueueEpisode5VimeoReplacement,
  preflightEpisode5VimeoReplacement,
  recoverEpisode5VimeoReplacementSession,
  runEpisode5VimeoReplacementOnce,
  statusEpisode5VimeoReplacement,
  vimeoReplacementConfirmation,
  vimeoSessionRecoveryConfirmation,
} from "./vimeo-replacement-runner.mjs";

const VIDEO_ID = "1204939658";
const VERSION_ID = "1225722222";
const APP_ID = "540274";
const ACCOUNT_ID = "253415660";
const ASSET_SHA = "1".repeat(64);
const APPROVAL_HASH = "2".repeat(64);
const EPISODE_HASH = "3".repeat(64);
const AUTHORIZATION_HASH = "4".repeat(64);
const TARGET_BINDING = Object.freeze({
  targetSha256: "5".repeat(64),
  assetSha256: ASSET_SHA,
  approvedCopySha256: "6".repeat(64),
  releasePlanSha256: "7".repeat(64),
  schedule: {
    publishAt: null,
    releaseMode: "publish_now",
    initialVisibility: "nobody",
    finalVisibility: "anybody",
  },
});

function contextFixture(directory, overrides = {}) {
  const target = {
    id: "vimeo",
    label: "Vimeo",
    mode: "api_after_auth",
    channelUrl: "https://vimeo.com/drmexperienced",
    destinationIds: { accountId: ACCOUNT_ID, containerId: null },
    assetSha256: ASSET_SHA,
    approvedCopy: "Approved Vimeo Episode 5 copy.",
    releasePlan: {
      releaseMode: "publish_now",
      initialVisibility: "nobody",
      finalVisibility: "anybody",
      license: "none",
      monetization: "unchanged",
      notifications: "disabled",
    },
  };
  const packet = {
    id: "episode-5-correction-20260822t190000z",
    approvalHash: APPROVAL_HASH,
    snapshot: {
      catalogBinding: {
        revision: 13,
        catalogHash: "8".repeat(64),
        episodeNumber: 5,
        episodeHash: EPISODE_HASH,
      },
      manifest: {
        episodeNumber: 5,
        slug: "episode-5-energy-correction",
        title: "Energy - Understanding Fatigue and Mitochondrial Health",
        targets: ["vimeo"],
      },
      assets: {
        fullVideo: {
          path: "/approved/episode-5-corrected.mp4",
          sizeBytes: 987654321,
          sha256: ASSET_SHA,
        },
        thumbnail: null,
      },
      targets: [target],
    },
  };
  const base = {
    directory,
    packet,
    approval: { approved: true },
    authorization: {
      targets: ["vimeo"],
      targetBindings: { vimeo: TARGET_BINDING },
      authorizationHash: AUTHORIZATION_HASH,
    },
    catalogEpisode: {
      number: 5,
      destinations: {
        vimeo: { id: VIDEO_ID, url: `https://vimeo.com/${VIDEO_ID}` },
      },
    },
    platformConfig: {
      publishingAutomation: { enabled: true },
      platforms: {
        vimeo: {
          mode: "api_after_auth",
          apiAutomation: { enabled: true, appId: Number(APP_ID) },
        },
      },
    },
  };
  return { ...base, ...overrides };
}

async function withHarness(callback) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "drm-vimeo-replacement-"));
  const jobDirectory = path.join(directory, "job");
  await fs.mkdir(jobDirectory, { mode: 0o700 });
  const store = await openControlStore({ filePath: path.join(directory, "replacement.sqlite3") });
  const context = contextFixture(jobDirectory);
  try {
    await callback({ context, directory, jobDirectory, store });
  } finally {
    store.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
}

function runningControl() {
  return {
    schemaVersion: 1,
    generation: 1,
    mode: "running",
    allowedPlatforms: ["vimeo"],
    updatedAt: "2026-08-22T19:00:00Z",
  };
}

function verifiedResult(plan) {
  return {
    operation: "replace",
    remote: {
      id: plan.existingVideoId,
      url: plan.remoteUrl,
      ownerId: plan.accountId,
    },
    asset: {
      sha256: plan.asset.sha256,
      sizeBytes: plan.asset.sizeBytes,
    },
  };
}

function blockAmbiguousReplacement(store, plan) {
  const workerId = "vimeo-ambiguous-write-worker";
  const baseMs = Date.now() + 10_000;
  const leased = store.leaseNext({
    workerId,
    leaseMs: 60_000,
    at: new Date(baseMs).toISOString(),
  });
  assert.equal(leased.operationId, plan.operationId);
  const started = store.beginProviderWrite(plan.operationId, {
    workerId,
    at: new Date(baseMs + 1_000).toISOString(),
    requestSummary: `Vimeo replacement version write for ${VIDEO_ID}.`,
    buildCommit: "a".repeat(40),
  });
  const blocked = store.completeLease(plan.operationId, {
    workerId,
    state: "blocked",
    at: new Date(baseMs + 2_000).toISOString(),
    errorCode: "INVALID_PROVIDER_RESPONSE",
    errorMessage: "Vimeo returned a TUS upload URL outside its documented host family.",
    result: { failure: { code: "INVALID_PROVIDER_RESPONSE" } },
  });
  assert.equal(blocked.providerWriteStartedAt, started.providerWriteStartedAt);
  return blocked;
}

function recoveredSessionResult(plan, blocked) {
  const versionUri = `/videos/${VIDEO_ID}/versions/${VERSION_ID}`;
  const tusUploadUrl = "https://global.upload.vimeo.com/tus/recovered-secret-session";
  const providerRecovery = {
    kind: "authenticated_version_readback_and_tus_head",
    versionId: VERSION_ID,
    versionUri,
    videoId: VIDEO_ID,
    accountId: ACCOUNT_ID,
    appId: APP_ID,
    assetSha256: ASSET_SHA,
    sizeBytes: plan.asset.sizeBytes,
    filename: path.basename(plan.asset.path),
    writeIntentAt: blocked.providerWriteStartedAt,
    blockedAt: blocked.updatedAt,
    createdTime: blocked.providerWriteStartedAt,
    versionReadbackSha256: "9".repeat(64),
    uploadLinkSha256: createHash("sha256").update(tusUploadUrl).digest("hex"),
    tusHead: {
      httpStatus: 200,
      tusResumable: "1.0.0",
      uploadLength: plan.asset.sizeBytes,
      uploadOffset: 0,
    },
  };
  return {
    checkpoint: {
      schemaVersion: 1,
      protocolVersion: 1,
      platform: "vimeo",
      phase: "provider_accepted",
      operation: "replace",
      accountId: ACCOUNT_ID,
      approvalHash: APPROVAL_HASH,
      episodeHash: EPISODE_HASH,
      assetSha256: ASSET_SHA,
      sizeBytes: plan.asset.sizeBytes,
      videoId: VIDEO_ID,
      canonicalUrl: plan.remoteUrl,
      versionUri,
      tusUploadUrl,
      providerCreateStatus: null,
      providerRecovery,
    },
    providerAccepted: true,
    remoteId: VIDEO_ID,
    remoteUrl: plan.remoteUrl,
    providerSummary:
      `Authenticated Vimeo version ${VERSION_ID} and its empty TUS session matched the durable write intent.`,
    recovery: {
      versionId: VERSION_ID,
      versionUri,
      createdTime: blocked.providerWriteStartedAt,
      filename: path.basename(plan.asset.path),
      sizeBytes: plan.asset.sizeBytes,
      appId: APP_ID,
      accountId: ACCOUNT_ID,
      uploadLinkSha256: providerRecovery.uploadLinkSha256,
      tusHead: providerRecovery.tusHead,
    },
  };
}

test("replacement plan binds Episode 5, stable Vimeo identity, authorization, and packet asset", () => {
  const context = contextFixture("/private/job");
  const plan = buildEpisode5VimeoReplacementPlan(context, { existingVideoId: VIDEO_ID });

  assert.equal(plan.adapterInput.operation.kind, "replace");
  assert.equal(plan.adapterInput.operation.existingVideoId, VIDEO_ID);
  assert.equal(plan.adapterInput.operation.approvedBinding.assetSha256, ASSET_SHA);
  assert.equal(plan.binding.action, "replace");
  assert.equal(plan.binding.episodeNumber, 5);
  assert.equal(plan.binding.remoteId, VIDEO_ID);
  assert.equal(plan.binding.assetPath, "/approved/episode-5-corrected.mp4");
  assert.equal(plan.binding.assetSha256, ASSET_SHA);
  assert.equal(plan.binding.authorizationHash, AUTHORIZATION_HASH);
  assert.match(plan.operationId, /^vimeo-episode-5-replace-[a-f0-9]{24}$/);
});

test("replacement plan rejects another episode, remote identity drift, and target/asset drift", () => {
  const base = contextFixture("/private/job");
  const wrongEpisode = structuredClone(base);
  wrongEpisode.packet.snapshot.manifest.episodeNumber = 6;
  assert.throws(
    () => buildEpisode5VimeoReplacementPlan(wrongEpisode, { existingVideoId: VIDEO_ID }),
    (error) => error instanceof VimeoReplacementRunnerError && error.code === "episode_scope_mismatch",
  );
  assert.throws(
    () => buildEpisode5VimeoReplacementPlan(base, { existingVideoId: "999999999" }),
    (error) => error.code === "catalog_remote_mismatch",
  );
  const wrongAsset = structuredClone(base);
  wrongAsset.packet.snapshot.targets[0].assetSha256 = "9".repeat(64);
  assert.throws(
    () => buildEpisode5VimeoReplacementPlan(wrongAsset, { existingVideoId: VIDEO_ID }),
    (error) => error.code === "approved_asset_binding_mismatch",
  );
});

test("dry-run and preflight invoke only the adapter read paths with kind=replace", async () => {
  const context = contextFixture("/private/job");
  const calls = [];
  const adapter = {
    async dryRun(input) {
      calls.push({ method: "dryRun", input });
      return { mode: "dry_run", writes: false };
    },
    async preflight(input) {
      calls.push({ method: "preflight", input });
      return { mode: "preflight", writes: false, existingVideo: { id: VIDEO_ID } };
    },
  };
  const loadContext = async () => context;

  const dry = await dryRunEpisode5VimeoReplacement({
    jobId: context.packet.id,
    existingVideoId: VIDEO_ID,
    loadContext,
    adapter,
  });
  const preflight = await preflightEpisode5VimeoReplacement({
    jobId: context.packet.id,
    existingVideoId: VIDEO_ID,
    loadContext,
    adapter,
  });

  assert.equal(dry.result.writes, false);
  assert.equal(preflight.result.writes, false);
  assert.deepEqual(calls.map((call) => call.method), ["dryRun", "preflight"]);
  assert.ok(calls.every((call) => call.input.operation.kind === "replace"));
  assert.ok(calls.every((call) => call.input.packet.snapshot.assets.fullVideo.sha256 === ASSET_SHA));
});

test("queue is idempotent, durable, and uses the non-create replacement action", async () => {
  await withHarness(async ({ context, store }) => {
    const input = {
      jobId: context.packet.id,
      existingVideoId: VIDEO_ID,
      loadContext: async () => context,
      store,
    };
    const first = await enqueueEpisode5VimeoReplacement(input);
    const repeated = await enqueueEpisode5VimeoReplacement(input);
    const status = await statusEpisode5VimeoReplacement(input);

    assert.equal(first.created, true);
    assert.equal(repeated.created, false);
    assert.equal(status.operation.kind, "replace");
    assert.equal(status.operation.createSlotActive, false);
    assert.equal(status.operation.bindingHash, first.plan.bindingHash);
    assert.equal(store.list().length, 1);
  });
});

test("session recovery checkpoints before its receipt and calls only authenticated recovery", async () => {
  await withHarness(async ({ context, jobDirectory, store }) => {
    const loadContext = async () => context;
    const queued = await enqueueEpisode5VimeoReplacement({
      jobId: context.packet.id,
      existingVideoId: VIDEO_ID,
      loadContext,
      store,
    });
    const blocked = blockAmbiguousReplacement(store, queued.plan);
    const calls = [];
    const adapterFactory = () => ({
      async recoverSession(input, options) {
        calls.push({ method: "recoverSession", input, options });
        assert.equal(input.operation.kind, "replace");
        assert.deepEqual(options, {
          versionId: VERSION_ID,
          providerWriteStartedAt: blocked.providerWriteStartedAt,
          providerBlockedAt: blocked.updatedAt,
          expectedAppId: APP_ID,
        });
        return recoveredSessionResult(queued.plan, blocked);
      },
      async publish() {
        throw new Error("recovery must never publish");
      },
      async reconcile() {
        throw new Error("recovery must never reconcile");
      },
    });
    const claimAccepted = async (input) => {
      const checkpointed = store.get(queued.plan.operationId);
      assert.equal(checkpointed.state, "waiting", "checkpoint must be stored first");
      assert.equal(checkpointed.providerCheckpoint.providerRecovery.versionId, VERSION_ID);
      assert.equal(checkpointed.providerCheckpointSequence, 1);
      return claimAdapterAccepted(input);
    };
    const recovered = await recoverEpisode5VimeoReplacementSession({
      jobId: context.packet.id,
      existingVideoId: VIDEO_ID,
      versionId: VERSION_ID,
      confirmation: vimeoSessionRecoveryConfirmation(queued.plan, VERSION_ID),
      now: new Date(Date.parse(blocked.updatedAt) + 1_000),
      loadContext,
      adapterFactory,
      claimAccepted,
      store,
    });

    assert.deepEqual(calls.map((call) => call.method), ["recoverSession"]);
    assert.equal(recovered.state, "waiting");
    assert.equal(recovered.remoteId, VIDEO_ID);
    assert.equal(recovered.recovery.versionId, VERSION_ID);
    assert.equal(recovered.recovery.appId, APP_ID);
    assert.equal(recovered.receiptCreated, true);
    assert.doesNotMatch(JSON.stringify(recovered), /tusUploadUrl|recovered-secret-session/);

    const durable = store.get(queued.plan.operationId);
    assert.equal(durable.providerAcceptedAt != null, true);
    assert.equal(durable.providerCheckpoint.providerRecovery.appId, APP_ID);
    assert.equal(durable.providerCheckpoint.tusUploadUrl.includes("recovered-secret-session"), true);
    const receipts = await readReceiptLedger(jobDirectory, context.packet);
    assert.deepEqual(receipts.map((receipt) => receipt.status), ["accepted"]);
    assert.equal(receipts[0].remote.id, VIDEO_ID);
  });
});

test("session recovery fails closed before provider reads on wrong state, IDs, app, confirmation, or receipt", async (t) => {
  await withHarness(async ({ context, jobDirectory, store }) => {
    const loadContext = async () => context;
    const queued = await enqueueEpisode5VimeoReplacement({
      jobId: context.packet.id,
      existingVideoId: VIDEO_ID,
      loadContext,
      store,
    });
    let adapterCalls = 0;
    const adapterFactory = () => ({
      async recoverSession() {
        adapterCalls += 1;
        throw new Error("must not reach provider recovery");
      },
    });
    const common = {
      jobId: context.packet.id,
      existingVideoId: VIDEO_ID,
      versionId: VERSION_ID,
      confirmation: vimeoSessionRecoveryConfirmation(queued.plan, VERSION_ID),
      loadContext,
      adapterFactory,
      store,
    };

    await t.test("operation is not blocked", async () => {
      await assert.rejects(
        recoverEpisode5VimeoReplacementSession(common),
        (error) => error.code === "provider_session_not_recoverable",
      );
    });

    const blocked = blockAmbiguousReplacement(store, queued.plan);
    common.now = new Date(Date.parse(blocked.updatedAt) + 1_000);
    await t.test("confirmation is not exact", async () => {
      await assert.rejects(
        recoverEpisode5VimeoReplacementSession({ ...common, confirmation: "recover-vimeo-session wrong" }),
        (error) => error.code === "provider_session_recovery_confirmation_mismatch",
      );
    });
    await t.test("version ID is not numeric", async () => {
      await assert.rejects(
        recoverEpisode5VimeoReplacementSession({ ...common, versionId: "version-latest" }),
        (error) => error.code === "invalid_vimeo_version_id",
      );
    });
    await t.test("configured app ID is missing", async () => {
      const missingApp = structuredClone(context);
      missingApp.platformConfig.platforms.vimeo.apiAutomation.appId = null;
      await assert.rejects(
        recoverEpisode5VimeoReplacementSession({
          ...common,
          loadContext: async () => missingApp,
        }),
        (error) => error.code === "provider_session_recovery_app_id_missing",
      );
    });

    await claimAdapterAccepted({
      jobDirectory,
      packet: context.packet,
      platformId: "vimeo",
      operationId: queued.plan.operationId,
      remoteId: VIDEO_ID,
      remoteUrl: queued.plan.remoteUrl,
      providerSummary: "Preexisting acceptance receipt for the ambiguous provider response.",
      recordedAt: new Date(Date.parse(blocked.updatedAt) + 500).toISOString(),
    });
    await t.test("an operation receipt already exists", async () => {
      await assert.rejects(
        recoverEpisode5VimeoReplacementSession(common),
        (error) => error.code === "provider_session_recovery_receipt_exists",
      );
    });
    assert.equal(adapterCalls, 0);
  });
});

test("a checkpointed replacement resumes through reconcile and never calls create/publish twice", async () => {
  await withHarness(async ({ context, jobDirectory, store }) => {
    const loadContext = async () => context;
    const queued = await enqueueEpisode5VimeoReplacement({
      jobId: context.packet.id,
      existingVideoId: VIDEO_ID,
      loadContext,
      store,
    });
    let clockMs = Date.now() + 1_000;
    const now = () => new Date(clockMs++);
    const calls = { preflight: 0, publish: 0, reconcile: 0 };
    let attempt = 0;
    const adapterFactory = ({ plan }) => {
      attempt += 1;
      return {
        checkpointProtocolVersion: 1,
        async preflight(input) {
          calls.preflight += 1;
          assert.equal(input.operation.kind, "replace");
          return { mode: "preflight", existingVideo: { id: VIDEO_ID } };
        },
        async publish(input, runtime) {
          calls.publish += 1;
          assert.equal(input.operation.kind, "replace");
          await runtime.beforeWrite({ step: "vimeo_create_replacement_version" });
          await runtime.onCheckpoint({
            checkpoint: {
              phase: "provider_accepted",
              operation: "replace",
              videoId: VIDEO_ID,
              assetSha256: ASSET_SHA,
            },
            providerAccepted: true,
            remoteId: VIDEO_ID,
            remoteUrl: plan.remoteUrl,
            providerSummary: `Vimeo accepted replacement version for ${VIDEO_ID}.`,
          });
          throw Object.assign(new Error("transient upload interruption"), {
            code: "NETWORK_ERROR",
            retryable: true,
          });
        },
        async reconcile(input, runtime) {
          calls.reconcile += 1;
          assert.equal(input.operation.kind, "replace");
          assert.equal(runtime.checkpoint.videoId, VIDEO_ID);
          await runtime.beforeWrite({ step: "vimeo_resume_replacement_upload" });
          await runtime.onCheckpoint({
            checkpoint: {
              ...runtime.checkpoint,
              phase: "final_metadata_applied",
            },
            remoteId: VIDEO_ID,
            remoteUrl: plan.remoteUrl,
          });
          return verifiedResult(plan);
        },
      };
    };
    const common = {
      jobId: context.packet.id,
      existingVideoId: VIDEO_ID,
      confirmation: vimeoReplacementConfirmation(queued.plan),
      env: { DRM_PUBLISH_BUILD_COMMIT: "a".repeat(40) },
      now,
      loadContext,
      loadControl: async () => runningControl(),
      adapterFactory,
      store,
      leaseMs: 60_000,
      heartbeatMs: 10_000,
      workerId: "vimeo-replacement-test-worker",
    };

    const first = await runEpisode5VimeoReplacementOnce(common);
    assert.equal(first.state, "waiting");
    assert.equal(store.get(queued.plan.operationId).providerCheckpoint.phase, "provider_accepted");
    clockMs += 120_000;
    const second = await runEpisode5VimeoReplacementOnce(common);

    assert.equal(second.state, "verified");
    assert.equal(attempt, 2);
    assert.deepEqual(calls, { preflight: 2, publish: 1, reconcile: 1 });
    assert.equal(store.get(queued.plan.operationId).state, "verified");
    const receipts = await readReceiptLedger(jobDirectory, context.packet);
    assert.deepEqual(receipts.map((receipt) => receipt.status), ["accepted", "published", "verified"]);
    assert.ok(receipts.every((receipt) => receipt.remote.id === VIDEO_ID));
  });
});

test("execution fails before adapter resolution when confirmation or durable binding differs", async () => {
  await withHarness(async ({ context, store }) => {
    const loadContext = async () => context;
    const queued = await enqueueEpisode5VimeoReplacement({
      jobId: context.packet.id,
      existingVideoId: VIDEO_ID,
      loadContext,
      store,
    });
    let adapters = 0;
    await assert.rejects(
      runEpisode5VimeoReplacementOnce({
        jobId: context.packet.id,
        existingVideoId: VIDEO_ID,
        confirmation: "execute-vimeo-replacement wrong",
        env: { DRM_PUBLISH_BUILD_COMMIT: "a".repeat(40) },
        loadContext,
        loadControl: async () => runningControl(),
        adapterFactory: () => {
          adapters += 1;
          throw new Error("must not resolve");
        },
        store,
      }),
      (error) => error.code === "replacement_confirmation_mismatch",
    );
    assert.equal(adapters, 0);
    assert.equal(store.get(queued.plan.operationId).state, "queued");
  });
});

test("CLI exposes separate read-only, queue, recovery, run, status, and reconciliation actions", () => {
  const cliPath = fileURLToPath(new URL("./cli.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [cliPath, "--help"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  for (const action of [
    "dry-run",
    "preflight",
    "queue",
    "run",
    "status",
    "recover-session",
    "reconcile",
  ]) {
    assert.match(result.stdout, new RegExp(`drm-publish vimeo-replace ${action}`));
  }
  assert.match(result.stdout, /execute-vimeo-replacement <operation-id> <authorization-hash> <existing-id>/);
  assert.match(
    result.stdout,
    /recover-vimeo-session <operation-id> <authorization-hash> <existing-id> <version-id>/,
  );
});
