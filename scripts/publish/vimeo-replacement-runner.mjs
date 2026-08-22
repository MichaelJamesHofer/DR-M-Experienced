import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  claimAdapterAccepted,
  readReceiptLedger,
  recordAdapterVerified,
} from "./adapter-receipts.mjs";
import {
  assertAutomationRunning,
  loadAutomationControl,
} from "./automation-control.mjs";
import { createVimeoAdapter } from "./adapters/vimeo.mjs";
import { openControlStore } from "./control-store.mjs";
import {
  assertAutomationCurrentlyAllowed,
  loadAuthorizedJobContext,
} from "./controller.mjs";
import { canonicalJson, hashSnapshot, publisherHome } from "./lib.mjs";

export const EPISODE_5_NUMBER = 5;
export const VIMEO_REPLACEMENT_PLATFORM = "vimeo";
const SHA256 = /^[a-f0-9]{64}$/;
const VIMEO_ID = /^\d+$/;
const PINNED_COMMIT = /^[a-f0-9]{40}$/;

export class VimeoReplacementRunnerError extends Error {
  constructor(code, message, detail = null) {
    super(message);
    this.name = "VimeoReplacementRunnerError";
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, message, detail = null) {
  throw new VimeoReplacementRunnerError(code, message, detail);
}

function errorResult(error) {
  return {
    code: typeof error?.code === "string" ? error.code : "vimeo_replacement_error",
    message: error instanceof Error ? error.message : String(error),
    detail: error?.detail ?? error?.evidence ?? null,
  };
}

function canonicalVimeoUrl(videoId) {
  return `https://vimeo.com/${videoId}`;
}

function targetFor(context) {
  return context.packet?.snapshot?.targets?.find(
    (candidate) => candidate?.id === VIMEO_REPLACEMENT_PLATFORM,
  ) || null;
}

function fullVideoFor(context) {
  return context.packet?.snapshot?.assets?.fullVideo || null;
}

function exactReceipt(receipt, plan) {
  if (!receipt) return;
  if (receipt.remote?.id != null && receipt.remote.id !== plan.existingVideoId) {
    fail(
      "receipt_remote_mismatch",
      `Existing Vimeo receipt targets ${receipt.remote.id}, not approved video ${plan.existingVideoId}.`,
    );
  }
  if (receipt.remote?.url != null && receipt.remote.url !== plan.remoteUrl) {
    fail(
      "receipt_remote_mismatch",
      `Existing Vimeo receipt URL does not match approved video ${plan.existingVideoId}.`,
    );
  }
}

/**
 * Derive every replacement value from the immutable job, authorization, and
 * catalog-bound episode. The caller supplies the expected remote ID so a typo
 * or stale operator instruction fails before an authenticated provider call.
 */
export function buildEpisode5VimeoReplacementPlan(context, { existingVideoId } = {}) {
  const packet = context?.packet;
  const authorization = context?.authorization;
  const catalogEpisode = context?.catalogEpisode;
  const target = targetFor(context);
  const fullVideo = fullVideoFor(context);
  const episodeNumber = packet?.snapshot?.catalogBinding?.episodeNumber;
  const manifestEpisodeNumber = packet?.snapshot?.manifest?.episodeNumber;

  if (episodeNumber !== EPISODE_5_NUMBER || manifestEpisodeNumber !== EPISODE_5_NUMBER) {
    fail(
      "episode_scope_mismatch",
      `This runner is locked to Episode ${EPISODE_5_NUMBER}; the approved job is for Episode ${episodeNumber ?? "unknown"}.`,
    );
  }
  if (!target || !packet.snapshot.manifest?.targets?.includes(VIMEO_REPLACEMENT_PLATFORM)) {
    fail("vimeo_target_missing", "The approved Episode 5 packet does not select Vimeo.");
  }
  if (!authorization?.targets?.includes(VIMEO_REPLACEMENT_PLATFORM)) {
    fail("vimeo_not_authorized", "The immutable release authorization does not authorize Vimeo.");
  }
  if (!authorization?.targetBindings?.vimeo) {
    fail("vimeo_authorization_binding_missing", "The release authorization has no Vimeo target binding.");
  }
  if (!VIMEO_ID.test(existingVideoId || "")) {
    fail("invalid_vimeo_id", "An exact numeric existing Vimeo video ID is required.");
  }

  const catalogVideoId = catalogEpisode?.destinations?.vimeo?.id;
  const catalogVideoUrl = catalogEpisode?.destinations?.vimeo?.url;
  if (catalogVideoId !== existingVideoId) {
    fail(
      "catalog_remote_mismatch",
      `Approved Episode 5 catalog identity is Vimeo ${catalogVideoId || "missing"}, not ${existingVideoId}.`,
    );
  }
  if (catalogVideoUrl !== canonicalVimeoUrl(existingVideoId)) {
    fail(
      "catalog_remote_url_mismatch",
      "The approved Episode 5 Vimeo catalog URL is missing or does not match its stable video ID.",
    );
  }

  const accountId = target.destinationIds?.accountId;
  if (!VIMEO_ID.test(accountId || "")) {
    fail("invalid_vimeo_account", "The approved Vimeo destination account ID is missing or invalid.");
  }
  if (
    !fullVideo ||
    typeof fullVideo.path !== "string" ||
    !path.isAbsolute(fullVideo.path) ||
    !Number.isSafeInteger(fullVideo.sizeBytes) ||
    fullVideo.sizeBytes < 1 ||
    !SHA256.test(fullVideo.sha256 || "")
  ) {
    fail(
      "approved_asset_binding_invalid",
      "The approved packet must bind fullVideo to an absolute path, positive size, and SHA-256.",
    );
  }
  if (target.assetSha256 !== fullVideo.sha256) {
    fail("approved_asset_binding_mismatch", "The Vimeo target does not bind the approved fullVideo hash.");
  }
  if (!SHA256.test(packet.approvalHash || "")) {
    fail("approval_hash_invalid", "The approved packet hash is missing or invalid.");
  }
  const episodeHash = packet.snapshot.catalogBinding?.episodeHash;
  if (!SHA256.test(episodeHash || "")) {
    fail("episode_hash_invalid", "The approved catalog episode hash is missing or invalid.");
  }
  if (!SHA256.test(authorization.authorizationHash || "")) {
    fail("authorization_hash_invalid", "The immutable release authorization hash is missing or invalid.");
  }

  const approvedBinding = Object.freeze({
    schemaVersion: 1,
    platformId: VIMEO_REPLACEMENT_PLATFORM,
    action: "replace_source",
    remoteId: existingVideoId,
    destinationAccountId: accountId,
    assetSha256: fullVideo.sha256,
    approvalHash: packet.approvalHash,
    episodeHash,
    authorizationHash: authorization.authorizationHash,
  });
  const binding = Object.freeze({
    schemaVersion: 1,
    action: "replace",
    providerAction: "replace_source",
    jobId: packet.id,
    approvalHash: packet.approvalHash,
    authorizationHash: authorization.authorizationHash,
    episodeNumber: EPISODE_5_NUMBER,
    episodeHash,
    slug: packet.snapshot.manifest.slug,
    platformId: VIMEO_REPLACEMENT_PLATFORM,
    remoteId: existingVideoId,
    remoteUrl: canonicalVimeoUrl(existingVideoId),
    destinationAccountId: accountId,
    assetRole: "fullVideo",
    assetPath: fullVideo.path,
    assetSizeBytes: fullVideo.sizeBytes,
    assetSha256: fullVideo.sha256,
    targetSha256: hashSnapshot(target),
    authorizationTargetBindingSha256: hashSnapshot(authorization.targetBindings.vimeo),
    approvedBindingSha256: hashSnapshot(approvedBinding),
  });
  const bindingHash = createHash("sha256").update(canonicalJson(binding)).digest("hex");
  const operationId = `vimeo-episode-5-replace-${bindingHash.slice(0, 24)}`;

  return Object.freeze({
    accountId,
    adapterInput: Object.freeze({
      packet,
      target,
      operation: Object.freeze({
        kind: "replace",
        existingVideoId,
        approvedBinding,
      }),
    }),
    approvalHash: packet.approvalHash,
    approvedBinding,
    asset: Object.freeze({
      path: fullVideo.path,
      sha256: fullVideo.sha256,
      sizeBytes: fullVideo.sizeBytes,
    }),
    authorizationHash: authorization.authorizationHash,
    binding,
    bindingHash,
    episodeHash,
    existingVideoId,
    jobId: packet.id,
    operationId,
    remoteUrl: canonicalVimeoUrl(existingVideoId),
    target,
  });
}

export function vimeoReplacementDatabasePath(plan, env = process.env) {
  return path.join(
    publisherHome(env),
    "control",
    "vimeo-replacements",
    `${plan.operationId}.sqlite3`,
  );
}

export function vimeoReplacementConfirmation(plan) {
  return `execute-vimeo-replacement ${plan.operationId} ${plan.authorizationHash} ${plan.existingVideoId}`;
}

async function loadPlan({
  jobId,
  existingVideoId,
  env,
  now,
  allowExpiredAuthorization = false,
  loadContext,
}) {
  const context = await loadContext(jobId, {
    env,
    now,
    allowExpiredAuthorization,
  });
  const plan = buildEpisode5VimeoReplacementPlan(context, { existingVideoId });
  return { context, plan };
}

export async function dryRunEpisode5VimeoReplacement({
  jobId,
  existingVideoId,
  env = process.env,
  now = new Date(),
  loadContext = loadAuthorizedJobContext,
  adapter = createVimeoAdapter(),
} = {}) {
  const { plan } = await loadPlan({ jobId, existingVideoId, env, now, loadContext });
  const result = await adapter.dryRun(plan.adapterInput);
  return { plan, result };
}

export async function preflightEpisode5VimeoReplacement({
  jobId,
  existingVideoId,
  env = process.env,
  now = new Date(),
  loadContext = loadAuthorizedJobContext,
  adapter = createVimeoAdapter(),
} = {}) {
  const { plan } = await loadPlan({ jobId, existingVideoId, env, now, loadContext });
  const result = await adapter.preflight(plan.adapterInput);
  return { plan, result };
}

function enqueueInStore(store, plan) {
  return store.enqueue({
    operationId: plan.operationId,
    jobId: plan.jobId,
    platformId: VIMEO_REPLACEMENT_PLATFORM,
    kind: "replace",
    binding: plan.binding,
    authorizationHash: plan.authorizationHash,
  });
}

export async function enqueueEpisode5VimeoReplacement({
  jobId,
  existingVideoId,
  env = process.env,
  now = new Date(),
  loadContext = loadAuthorizedJobContext,
  store = null,
} = {}) {
  const { context, plan } = await loadPlan({ jobId, existingVideoId, env, now, loadContext });
  const ownedStore = store || await openControlStore({
    filePath: vimeoReplacementDatabasePath(plan, env),
    env,
  });
  try {
    const queued = enqueueInStore(ownedStore, plan);
    return { context, databasePath: ownedStore.path, plan, ...queued };
  } finally {
    if (!store) ownedStore.close();
  }
}

export async function statusEpisode5VimeoReplacement({
  jobId,
  existingVideoId,
  env = process.env,
  now = new Date(),
  loadContext = loadAuthorizedJobContext,
  store = null,
} = {}) {
  const { plan } = await loadPlan({
    jobId,
    existingVideoId,
    env,
    now,
    allowExpiredAuthorization: true,
    loadContext,
  });
  const databasePath = vimeoReplacementDatabasePath(plan, env);
  if (!store) {
    try {
      await fs.access(databasePath);
    } catch (error) {
      if (error.code === "ENOENT") {
        return { databasePath, events: [], operation: null, plan };
      }
      throw error;
    }
  }
  const ownedStore = store || await openControlStore({ filePath: databasePath, env });
  try {
    const operation = ownedStore.list({ jobId: plan.jobId })
      .find((candidate) => candidate.operationId === plan.operationId) || null;
    if (operation) assertStoredOperation(operation, plan);
    return {
      databasePath: ownedStore.path,
      events: operation ? ownedStore.events(plan.operationId) : [],
      operation,
      plan,
    };
  } finally {
    if (!store) ownedStore.close();
  }
}

function assertStoredOperation(operation, plan) {
  const problems = [];
  if (!operation) problems.push("operation missing");
  if (operation?.operationId !== plan.operationId) problems.push("operation id");
  if (operation?.jobId !== plan.jobId) problems.push("job id");
  if (operation?.episodeNumber !== EPISODE_5_NUMBER) problems.push("episode number");
  if (operation?.platformId !== VIMEO_REPLACEMENT_PLATFORM) problems.push("platform");
  if (operation?.kind !== "replace") problems.push("operation kind");
  if (operation?.bindingHash !== plan.bindingHash) problems.push("binding hash");
  if (canonicalJson(operation?.binding) !== canonicalJson(plan.binding)) problems.push("binding content");
  if (operation?.authorizationHash !== plan.authorizationHash) problems.push("authorization hash");
  if (problems.length) {
    fail(
      "replacement_operation_binding_mismatch",
      `Durable Vimeo replacement operation does not match: ${problems.join(", ")}.`,
    );
  }
}

function assertResultBinding(result, plan) {
  const problems = [];
  if (result?.operation !== "replace") problems.push("operation");
  if (result?.remote?.id !== plan.existingVideoId) problems.push("remote id");
  if (result?.remote?.url !== plan.remoteUrl) problems.push("remote URL");
  if (result?.remote?.ownerId !== plan.accountId) problems.push("owner");
  if (result?.asset?.sha256 !== plan.asset.sha256) problems.push("asset hash");
  if (result?.asset?.sizeBytes !== plan.asset.sizeBytes) problems.push("asset size");
  if (problems.length) {
    fail(
      "replacement_result_binding_mismatch",
      `Verified Vimeo result does not match the immutable replacement: ${problems.join(", ")}.`,
    );
  }
}

function retryAt(now, delayMs = 60_000) {
  return new Date(now.getTime() + delayMs).toISOString();
}

function latestOperationReceipt(receipts, operationId) {
  return receipts
    .filter(
      (receipt) =>
        receipt.platformId === VIMEO_REPLACEMENT_PLATFORM &&
        receipt.operationId === operationId,
    )
    .at(-1) || null;
}

function assertPinnedBuild(env) {
  const buildCommit = env.DRM_PUBLISH_BUILD_COMMIT || null;
  if (!PINNED_COMMIT.test(buildCommit || "")) {
    fail(
      "unpinned_publisher_build",
      "Vimeo replacement execution requires DRM_PUBLISH_BUILD_COMMIT with the deployed full Git commit.",
    );
  }
  return buildCommit;
}

/**
 * Execute exactly one previously queued Episode 5 replacement. This function
 * never falls back to create. A prior write always resumes through the
 * adapter's checkpoint-bound reconcile method.
 */
export async function runEpisode5VimeoReplacementOnce({
  jobId,
  existingVideoId,
  confirmation,
  env = process.env,
  now = () => new Date(),
  loadContext = loadAuthorizedJobContext,
  loadControl = loadAutomationControl,
  adapterFactory = () => createVimeoAdapter(),
  store = null,
  leaseMs = 5 * 60_000,
  heartbeatMs = 60_000,
  workerId = `vimeo-replacement-${randomUUID()}`,
} = {}) {
  if (!Number.isInteger(leaseMs) || leaseMs < 60_000) {
    fail("invalid_lease", "Vimeo replacement leaseMs must be at least one minute.");
  }
  if (!Number.isInteger(heartbeatMs) || heartbeatMs < 1_000 || heartbeatMs >= leaseMs) {
    fail("invalid_heartbeat", "Vimeo replacement heartbeatMs must be at least one second and shorter than leaseMs.");
  }

  // Discovery permits an expired authorization only so an already-started,
  // immutable operation can be located. Fresh writes are revalidated below.
  const discovered = await loadPlan({
    jobId,
    existingVideoId,
    env,
    now: now(),
    allowExpiredAuthorization: true,
    loadContext,
  });
  const ownedStore = store || await openControlStore({
    filePath: vimeoReplacementDatabasePath(discovered.plan, env),
    env,
  });
  let leased = null;
  let heartbeat = null;
  let heartbeatError = null;
  try {
    ownedStore.recoverExpiredLeases(now().toISOString());
    const storedOperations = ownedStore.list();
    if (
      storedOperations.length !== 1 ||
      storedOperations[0].operationId !== discovered.plan.operationId
    ) {
      fail(
        "replacement_store_scope_mismatch",
        "The isolated Vimeo replacement store does not contain exactly the approved operation.",
      );
    }
    const stored = ownedStore.get(discovered.plan.operationId);
    assertStoredOperation(stored, discovered.plan);
    if (confirmation !== vimeoReplacementConfirmation(discovered.plan)) {
      fail(
        "replacement_confirmation_mismatch",
        "Vimeo replacement confirmation does not match the immutable operation, authorization, and video ID.",
      );
    }

    const buildCommit = assertPinnedBuild(env);
    const allowExpiredAuthorization = stored.providerWriteStartedAt != null;
    const { context, plan } = await loadPlan({
      jobId,
      existingVideoId,
      env,
      now: now(),
      allowExpiredAuthorization,
      loadContext,
    });
    assertStoredOperation(stored, plan);
    assertAutomationCurrentlyAllowed(context, plan.target);
    const hostControl = await loadControl({ env });
    assertAutomationRunning(hostControl, VIMEO_REPLACEMENT_PLATFORM);

    leased = ownedStore.leaseNext({ workerId, leaseMs, at: now().toISOString() });
    if (!leased) {
      return { state: stored.state, operation: ownedStore.get(plan.operationId), plan };
    }
    assertStoredOperation(leased, plan);
    heartbeat = setInterval(() => {
      try {
        ownedStore.renewLease(plan.operationId, {
          workerId,
          leaseMs,
          at: now().toISOString(),
        });
      } catch (error) {
        heartbeatError = error;
      }
    }, heartbeatMs);
    heartbeat.unref?.();

    let current = leased;
    const receipts = await readReceiptLedger(context.directory, context.packet);
    let acceptedReceipt = latestOperationReceipt(receipts, plan.operationId);
    exactReceipt(acceptedReceipt, plan);
    if (acceptedReceipt?.status === "verified") {
      const completed = ownedStore.completeLease(plan.operationId, {
        workerId,
        state: "verified",
        at: now().toISOString(),
        remoteId: plan.existingVideoId,
        remoteUrl: plan.remoteUrl,
        result: { recoveredFromReceipt: acceptedReceipt.receiptHash, buildCommit },
      });
      return { state: "verified", operation: completed, recovered: true, plan };
    }
    if (acceptedReceipt && (!current.providerAcceptedAt || !current.providerCheckpoint)) {
      fail(
        "ambiguous_prior_attempt",
        "A Vimeo replacement receipt exists without the matching durable provider checkpoint.",
      );
    }
    if (acceptedReceipt && !["accepted", "processing", "published"].includes(acceptedReceipt.status)) {
      fail(
        "terminal_prior_receipt",
        `Vimeo replacement receipt is terminal at ${acceptedReceipt.status}.`,
      );
    }
    if (!acceptedReceipt && current.providerAcceptedAt && current.providerCheckpoint) {
      const claimed = await claimAdapterAccepted({
        jobDirectory: context.directory,
        packet: context.packet,
        platformId: VIMEO_REPLACEMENT_PLATFORM,
        operationId: plan.operationId,
        remoteId: plan.existingVideoId,
        remoteUrl: plan.remoteUrl,
        providerSummary: `Durable Vimeo checkpoint proves acceptance of replacement version for video ${plan.existingVideoId}.`,
        recordedAt: now().toISOString(),
      });
      acceptedReceipt = claimed.receipt;
      exactReceipt(acceptedReceipt, plan);
    }

    const adapter = adapterFactory({ context, plan });
    if (adapter?.checkpointProtocolVersion !== 1) {
      fail("adapter_checkpoint_protocol_required", "Vimeo replacement requires checkpoint protocol version 1.");
    }
    const preflight = await adapter.preflight(plan.adapterInput);
    if (heartbeatError) throw heartbeatError;

    const beforeWrite = async ({ step = "vimeo_replacement_write" } = {}) => {
      if (heartbeatError) throw heartbeatError;
      const currentControl = await loadControl({ env });
      assertAutomationRunning(currentControl, VIMEO_REPLACEMENT_PLATFORM);
      current = ownedStore.beginProviderWrite(plan.operationId, {
        workerId,
        at: now().toISOString(),
        requestSummary: `Vimeo replacement mutating step ${step} is beginning for video ${plan.existingVideoId}.`,
        buildCommit,
      });
      return current;
    };
    const onCheckpoint = async ({
      checkpoint,
      providerAccepted = false,
      remoteId = null,
      remoteUrl = null,
      providerSummary = null,
    }) => {
      if (heartbeatError) throw heartbeatError;
      if (remoteId != null && remoteId !== plan.existingVideoId) {
        fail("checkpoint_remote_mismatch", "Vimeo checkpoint returned a different video ID.");
      }
      if (remoteUrl != null && remoteUrl !== plan.remoteUrl) {
        fail("checkpoint_remote_mismatch", "Vimeo checkpoint returned a different video URL.");
      }
      current = ownedStore.recordProviderCheckpoint(plan.operationId, {
        workerId,
        checkpoint,
        providerAccepted,
        remoteId,
        remoteUrl,
        at: now().toISOString(),
      });
      if (providerAccepted && !acceptedReceipt) {
        const claimed = await claimAdapterAccepted({
          jobDirectory: context.directory,
          packet: context.packet,
          platformId: VIMEO_REPLACEMENT_PLATFORM,
          operationId: plan.operationId,
          remoteId: plan.existingVideoId,
          remoteUrl: plan.remoteUrl,
          providerSummary:
            providerSummary || `Vimeo accepted a replacement version for video ${plan.existingVideoId}.`,
          recordedAt: now().toISOString(),
        });
        acceptedReceipt = claimed.receipt;
        exactReceipt(acceptedReceipt, plan);
      }
    };

    const runtime = {
      checkpoint: current.providerCheckpoint,
      beforeWrite,
      onCheckpoint,
    };
    const result = current.providerWriteStartedAt
      ? await adapter.reconcile(plan.adapterInput, runtime)
      : await adapter.publish(plan.adapterInput, runtime);
    if (heartbeatError) {
      fail(
        "lease_heartbeat_failed_after_write",
        "Vimeo replacement completed but its durable lease could not be renewed; reconciliation is required.",
      );
    }
    assertResultBinding(result, plan);
    current = ownedStore.get(plan.operationId);
    if (!current.providerAcceptedAt || !current.providerCheckpoint || !acceptedReceipt) {
      fail(
        "provider_checkpoint_missing_after_write",
        "Vimeo replacement returned success without durable provider acceptance evidence.",
      );
    }

    const receiptsWritten = await recordAdapterVerified({
      jobDirectory: context.directory,
      packet: context.packet,
      platformId: VIMEO_REPLACEMENT_PLATFORM,
      operationId: plan.operationId,
      remoteId: plan.existingVideoId,
      remoteUrl: plan.remoteUrl,
      providerSummary: `Vimeo processed the approved replacement source for video ${plan.existingVideoId}.`,
      readbackSummary:
        `Vimeo API readback matched replacement video ${plan.existingVideoId}, account ${plan.accountId}, and approved metadata.`,
      recordedAt: now().toISOString(),
    });
    const completed = ownedStore.completeLease(plan.operationId, {
      workerId,
      state: "verified",
      at: now().toISOString(),
      remoteId: plan.existingVideoId,
      remoteUrl: plan.remoteUrl,
      result: {
        adapter: result,
        preflight,
        receiptHash: receiptsWritten.verified.receiptHash,
        buildCommit,
      },
    });
    return { state: "verified", operation: completed, plan, result };
  } catch (error) {
    if (!leased) throw error;
    const failure = errorResult(error);
    const current = ownedStore.get(discovered.plan.operationId);
    const touchedProvider = current?.providerWriteStartedAt != null;
    const checkpointed = current?.providerCheckpoint != null;
    const retryableBeforeWrite = !touchedProvider && error?.retryable === true;
    const resumableAfterWrite =
      touchedProvider &&
      checkpointed &&
      (
        error?.retryable === true ||
        [
          "automation_paused",
          "platform_not_locally_allowed",
          "lease_heartbeat_failed_after_write",
        ].includes(failure.code)
      );
    const state = resumableAfterWrite ? "waiting" : retryableBeforeWrite ? "retry" : "blocked";
    const completed = ownedStore.completeLease(discovered.plan.operationId, {
      workerId,
      state,
      at: now().toISOString(),
      nextAttemptAt: ["waiting", "retry"].includes(state) ? retryAt(now()) : null,
      errorCode: failure.code,
      errorMessage: failure.message,
      result: { failure },
    });
    return { state, operation: completed, error: failure, plan: discovered.plan };
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    if (!store) ownedStore.close();
  }
}

export async function reconcileBlockedEpisode5VimeoReplacement({
  jobId,
  existingVideoId,
  confirmation,
  reason,
  env = process.env,
  now = new Date(),
  loadContext = loadAuthorizedJobContext,
  store = null,
} = {}) {
  if (typeof reason !== "string" || !reason.trim()) {
    fail("reconciliation_reason_required", "A Vimeo replacement reconciliation reason is required.");
  }
  const { plan } = await loadPlan({
    jobId,
    existingVideoId,
    env,
    now,
    allowExpiredAuthorization: true,
    loadContext,
  });
  const expected = `reconcile-vimeo-replacement ${plan.operationId} ${plan.existingVideoId}`;
  if (confirmation !== expected) {
    fail("reconciliation_confirmation_mismatch", "Vimeo reconciliation confirmation is not exact.");
  }
  const ownedStore = store || await openControlStore({
    filePath: vimeoReplacementDatabasePath(plan, env),
    env,
  });
  try {
    const current = ownedStore.get(plan.operationId);
    assertStoredOperation(current, plan);
    const operation = ownedStore.requeueReconciliation(plan.operationId, { reason, at: new Date(now).toISOString() });
    return { databasePath: ownedStore.path, operation, plan };
  } finally {
    if (!store) ownedStore.close();
  }
}
