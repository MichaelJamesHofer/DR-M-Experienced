import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  episodeHash,
  findEpisode,
  loadCatalog,
  manifestCatalogProblems,
} from "./catalog.mjs";
import {
  approvalRecordProblems,
  canonicalJson,
  hashSnapshot,
  packetIntegrityProblems,
  publisherHome,
  reviewDocumentProblems,
  verifySnapshotAssets,
} from "./lib.mjs";
import {
  deterministicOperationId,
  openControlStore,
  operationBinding,
} from "./control-store.mjs";
import { readReceiptLedger, recordAdapterAccepted, recordAdapterVerified } from "./adapter-receipts.mjs";
import { releaseAuthorizationProblems } from "./release-authorization.mjs";
import { createVimeoAdapter } from "./adapters/vimeo.mjs";
import { createYouTubeAdapter } from "./adapters/youtube.mjs";
import {
  assertAutomationRunning,
  loadAutomationControl,
} from "./automation-control.mjs";

const AUTOMATED_DIRECT_TARGETS = new Set(["rss.com", "youtube", "vimeo"]);
const CATEGORY_IDS = Object.freeze({ "Health & Fitness": "26" });
const SAFE_JOB_ID = /^[a-z0-9][a-z0-9-]*$/;
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const platformConfigPath = path.join(projectRoot, "publishing", "platforms.json");

export class PublishingControllerError extends Error {
  constructor(code, message, detail = null) {
    super(message);
    this.name = "PublishingControllerError";
    this.code = code;
    this.detail = detail;
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function safeJobId(jobId) {
  if (typeof jobId !== "string" || !SAFE_JOB_ID.test(jobId)) {
    throw new PublishingControllerError("invalid_job_id", `Invalid publishing job id: ${jobId}`);
  }
  return jobId;
}

function assertCurrentCatalogBinding(packet, catalog) {
  const binding = packet.snapshot.catalogBinding;
  const episode = findEpisode(catalog, binding.episodeNumber);
  const problems = [];
  if (!episode) problems.push(`episode ${binding.episodeNumber} is missing`);
  if (episode && binding.episodeHash !== episodeHash(episode)) problems.push("catalog episode SHA-256 changed");
  if (episode) problems.push(...manifestCatalogProblems(packet.snapshot.manifest, episode));
  if (problems.length) {
    throw new PublishingControllerError(
      "catalog_binding_stale",
      `The approved job no longer matches the master catalog:\n- ${[...new Set(problems)].join("\n- ")}`,
    );
  }
  return episode;
}

export async function loadAuthorizedJobContext(
  jobId,
  {
    env = process.env,
    now = new Date(),
    catalogLoader = loadCatalog,
    allowExpiredAuthorization = false,
  } = {},
) {
  const id = safeJobId(jobId);
  const directory = path.join(publisherHome(env), "jobs", id);
  const [packet, storedReview, approval, authorization, catalog, platformConfig] = await Promise.all([
    readJson(path.join(directory, "packet.json")),
    fs.readFile(path.join(directory, "approval.md"), "utf8"),
    readJson(path.join(directory, "approval.json")),
    readJson(path.join(directory, "release-authorization.json")),
    catalogLoader(),
    readJson(platformConfigPath),
  ]);

  const packetProblems = packetIntegrityProblems(packet, id);
  if (packetProblems.length) {
    throw new PublishingControllerError(
      "packet_integrity_failed",
      `Stored packet integrity check failed:\n- ${packetProblems.join("\n- ")}`,
    );
  }
  const reviewProblems = reviewDocumentProblems(packet, storedReview);
  if (reviewProblems.length) {
    throw new PublishingControllerError(
      "review_integrity_failed",
      `Stored review integrity check failed:\n- ${reviewProblems.join("\n- ")}`,
    );
  }
  const approvalProblems = approvalRecordProblems(packet, approval, storedReview);
  if (approvalProblems.length) {
    throw new PublishingControllerError(
      "approval_integrity_failed",
      `Stored approval integrity check failed:\n- ${approvalProblems.join("\n- ")}`,
    );
  }
  const authorizationProblems = releaseAuthorizationProblems(
    packet,
    approval,
    storedReview,
    authorization,
    { now, allowExpired: allowExpiredAuthorization },
  );
  if (authorizationProblems.length) {
    throw new PublishingControllerError(
      "authorization_invalid",
      `Release authorization failed validation:\n- ${authorizationProblems.join("\n- ")}`,
    );
  }
  const assetProblems = await verifySnapshotAssets(packet.snapshot);
  if (assetProblems.length) {
    throw new PublishingControllerError(
      "asset_integrity_failed",
      `Approved media changed or is unavailable:\n- ${assetProblems.join("\n- ")}`,
    );
  }
  const catalogEpisode = assertCurrentCatalogBinding(packet, catalog);
  for (const target of packet.snapshot.targets) {
    const current = platformConfig.platforms?.[target.id];
    if (
      !current ||
      current.mode !== target.mode ||
      canonicalJson(
        current.apiAutomation
          ? {
              enabled: current.apiAutomation.enabled === true,
              policyRevision: current.apiAutomation.policyRevision ?? null,
            }
          : null,
      ) !== canonicalJson(target.automationPolicy ?? null) ||
      current.channelUrl !== target.channelUrl ||
      canonicalJson(current.destinationIds || {}) !== canonicalJson(target.destinationIds || {})
    ) {
      throw new PublishingControllerError(
        "destination_routing_changed",
        `${target.id} mode, account, or channel routing changed after review; prepare a new job.`,
      );
    }
  }
  return {
    directory,
    packet,
    storedReview,
    approval,
    authorization,
    catalog,
    catalogEpisode,
    platformConfig,
  };
}

export function assertAutomationCurrentlyAllowed(context, target) {
  const hostPolicy = context.platformConfig?.publishingAutomation;
  const current = context.platformConfig?.platforms?.[target.id];
  if (hostPolicy?.enabled !== true) {
    throw new PublishingControllerError(
      "publishing_kill_switch_active",
      "The workstation publishing automation kill switch is not enabled.",
    );
  }
  if (!current || current.mode !== target.mode) {
    throw new PublishingControllerError(
      "automation_mode_changed",
      `${target.id} is no longer configured in the approved API mode.`,
    );
  }
  if (current.apiAutomation?.enabled !== true) {
    throw new PublishingControllerError(
      "platform_automation_disabled",
      `${target.id} automation is disabled until its current authorization and platform gates are complete.`,
    );
  }
}

function unsupportedAuthorizationTargets(authorization) {
  return authorization.targets.filter((platformId) => !AUTOMATED_DIRECT_TARGETS.has(platformId));
}

export async function enqueueAuthorizedRelease(
  jobId,
  { env = process.env, store = null, loadContext = loadAuthorizedJobContext } = {},
) {
  const context = await loadContext(jobId, { env });
  const unsupported = unsupportedAuthorizationTargets(context.authorization);
  if (unsupported.includes("rumble")) {
    throw new PublishingControllerError(
      "rumble_excluded",
      "Rumble is excluded from this automated controller pending written platform permission.",
    );
  }
  if (unsupported.length) {
    throw new PublishingControllerError(
      "adapter_unavailable",
      `No unattended official adapter is configured for: ${unsupported.join(", ")}.`,
    );
  }
  const ownedStore = store || (await openControlStore({ env }));
  try {
    const queued = ownedStore.enqueueAuthorizedJob(context.packet, context.authorization);
    return { context, queued, databasePath: ownedStore.path };
  } finally {
    if (!store) ownedStore.close();
  }
}

function releaseVisibility(target) {
  const releasePlan = target.releasePlan;
  if (releasePlan.releaseMode === "scheduled") return "private";
  if (releasePlan.releaseMode === "hold") return releasePlan.initialVisibility;
  return releasePlan.finalVisibility;
}

export function youtubePublication(packet, target) {
  const manifest = packet.snapshot.manifest;
  const assets = packet.snapshot.assets;
  if (manifest.paidPromotion === true) {
    throw new PublishingControllerError(
      "youtube_paid_promotion_unsupported",
      "YouTube paid-promotion disclosure is not yet implemented and cannot be omitted.",
    );
  }
  if (target.releasePlan.monetization !== "not_applicable") {
    throw new PublishingControllerError(
      "youtube_monetization_unsupported",
      "YouTube monetization changes are not implemented; choose not_applicable or use an attended release.",
    );
  }
  if (
    target.releasePlan.releaseMode === "scheduled" &&
    (target.releasePlan.initialVisibility !== "private" || target.releasePlan.finalVisibility !== "public")
  ) {
    throw new PublishingControllerError(
      "youtube_schedule_visibility_unsupported",
      "YouTube scheduling requires approved initialVisibility private and finalVisibility public.",
    );
  }
  const categoryId = manifest.category == null ? undefined : CATEGORY_IDS[manifest.category];
  if (manifest.category && !categoryId) {
    throw new PublishingControllerError(
      "youtube_category_unmapped",
      `No reviewed YouTube category mapping exists for ${manifest.category}.`,
    );
  }
  return {
    videoPath: assets.fullVideo.path,
    videoSha256: assets.fullVideo.sha256,
    thumbnailPath: assets.thumbnail?.path || undefined,
    thumbnailSha256: assets.thumbnail?.sha256 || undefined,
    metadata: {
      title: manifest.title,
      description: target.approvedCopy,
      tags: manifest.tags,
      categoryId,
    },
    status: {
      privacyStatus: releaseVisibility(target),
      madeForKids: manifest.madeForKids,
      license: target.releasePlan.license,
      publishAt: target.releasePlan.releaseMode === "scheduled" ? manifest.publishAt : undefined,
      containsSyntheticMedia: manifest.containsSyntheticMedia,
      notifySubscribers: target.releasePlan.notifications === "enabled",
    },
  };
}

function assertCreateDoesNotDuplicate(context, platformId) {
  const existing = context.catalogEpisode.destinations?.[platformId];
  if (existing?.id || existing?.url) {
    throw new PublishingControllerError(
      "existing_destination_requires_explicit_replacement",
      `${platformId} already has a cataloged destination for this episode; create was blocked.`,
      { platformId, remoteId: existing.id || null },
    );
  }
  if (
    platformId === "rss.com" &&
    (context.catalogEpisode.guid || context.catalogEpisode.publicationState === "published")
  ) {
    throw new PublishingControllerError(
      "existing_rss_episode_requires_explicit_update",
      "RSS.com already has a published identity for this episode; create was blocked.",
    );
  }
}

export async function defaultResolveAdapter({ context, target }) {
  assertCreateDoesNotDuplicate(context, target.id);
  if (context.packet.snapshot.manifest.paidPromotion === true && target.id !== "youtube") {
    throw new PublishingControllerError(
      "paid_promotion_unsupported",
      `${target.id} paid-promotion disclosure is not implemented and cannot be omitted.`,
    );
  }
  if (context.packet.snapshot.manifest.containsSyntheticMedia === true && target.id === "vimeo") {
    throw new PublishingControllerError(
      "vimeo_synthetic_media_disclosure_unsupported",
      "Vimeo synthetic-media disclosure is not implemented and cannot be omitted.",
    );
  }
  if (target.id === "vimeo") {
    return {
      adapter: createVimeoAdapter(),
      input: { packet: context.packet, target, operation: { kind: "create" } },
      resultIdentity(result) {
        return {
          remoteId: result.remote.id,
          remoteUrl: result.remote.url,
          providerSummary: `Vimeo accepted and processed video ${result.remote.id}.`,
          readbackSummary: `Vimeo API readback matched video ${result.remote.id} on account ${result.remote.ownerId}.`,
        };
      },
    };
  }
  if (target.id === "youtube") {
    const privacyStatus = releaseVisibility(target);
    if (
      (privacyStatus !== "private" || target.releasePlan.releaseMode === "scheduled") &&
      context.platformConfig.platforms.youtube.apiAutomation?.publicUploadAuditVerified !== true
    ) {
      throw new PublishingControllerError(
        "youtube_public_upload_audit_required",
        "YouTube public or unlisted API uploads remain blocked until the project compliance audit is recorded as verified.",
      );
    }
    const visibilityCapability = {
      enabled: true,
      authorizationId: context.authorization.authorizationHash,
      allowedPrivacyStatuses: [privacyStatus],
      allowScheduledPublic: target.releasePlan.releaseMode === "scheduled",
      expiresAt: context.authorization.expiresAt,
    };
    return {
      adapter: createYouTubeAdapter({ target, visibilityCapability }),
      input: youtubePublication(context.packet, target),
      resultIdentity(result) {
        const readback = result.readback;
        return {
          remoteId: readback.videoId,
          remoteUrl: readback.url,
          providerSummary: `YouTube accepted and processed video ${readback.videoId}.`,
          readbackSummary: `YouTube API readback matched video ${readback.videoId} on channel ${result.channel.id}.`,
        };
      },
    };
  }
  if (target.id === "rss.com") {
    const { createRssAdapter } = await import("./adapters/rss.mjs");
    const adapter = createRssAdapter();
    const input = {
      packet: context.packet,
      target,
      operation: { kind: "create" },
    };
    return {
      adapter,
      input,
      resultIdentity(result) {
        return {
          remoteId: result.remote.id,
          remoteUrl: result.remote.websiteUrl,
          providerSummary: `RSS.com accepted and processed episode ${result.remote.id}.`,
          readbackSummary: `RSS.com API readback matched episode ${result.remote.id} in podcast ${result.podcast.id}.`,
        };
      },
    };
  }
  throw new PublishingControllerError("adapter_unavailable", `No adapter exists for ${target.id}.`);
}

function assertOperationMatchesAuthorization(operation, context, target) {
  const expectedBinding = operationBinding(context.packet, target, context.authorization);
  const expectedOperationId = deterministicOperationId(context.packet, target, context.authorization);
  const problems = [];
  if (operation.authorizationHash !== context.authorization.authorizationHash) problems.push("authorization hash");
  if (operation.operationId !== expectedOperationId) problems.push("operation id");
  if (operation.bindingHash !== hashSnapshot(expectedBinding)) problems.push("binding hash");
  if (canonicalJson(operation.binding) !== canonicalJson(expectedBinding)) problems.push("binding content");
  if (operation.kind !== expectedBinding.action) problems.push("operation action");
  if (problems.length) {
    throw new PublishingControllerError(
      "operation_binding_mismatch",
      `Queued operation no longer matches its authorization: ${problems.join(", ")}.`,
    );
  }
}

function errorResult(error) {
  return {
    code: typeof error?.code === "string" ? error.code : "controller_error",
    message: error instanceof Error ? error.message : String(error),
    detail: error?.detail ?? error?.evidence ?? null,
  };
}

function latestOperationReceipt(receipts, operation) {
  return receipts
    .filter(
      (receipt) =>
        receipt.platformId === operation.platformId && receipt.operationId === operation.operationId,
    )
    .at(-1) || null;
}

function retryAt(now, delayMs = 60_000) {
  return new Date(now.getTime() + delayMs).toISOString();
}

export function createPublishingController({
  store,
  env = process.env,
  workerId = `publisher-${randomUUID()}`,
  loadContext = loadAuthorizedJobContext,
  resolveAdapter = defaultResolveAdapter,
  loadControl = loadAutomationControl,
  now = () => new Date(),
  leaseMs = 5 * 60_000,
  heartbeatMs = 60_000,
  requirePinnedBuild = false,
} = {}) {
  if (!store) throw new Error("A durable control store is required.");
  if (!Number.isInteger(leaseMs) || leaseMs < 60_000) throw new Error("leaseMs must be at least one minute.");
  if (!Number.isInteger(heartbeatMs) || heartbeatMs < 1_000 || heartbeatMs >= leaseMs) {
    throw new Error("heartbeatMs must be at least one second and shorter than leaseMs.");
  }

  async function runOnce() {
    const buildCommit = env.DRM_PUBLISH_BUILD_COMMIT || null;
    if (requirePinnedBuild && !/^[a-f0-9]{40}$/.test(buildCommit || "")) {
      return {
        state: "paused",
        operation: null,
        error: {
          code: "unpinned_publisher_build",
          message: "Publisher service must run from a pinned full Git commit.",
          detail: null,
        },
      };
    }
    let hostControl;
    try {
      hostControl = await loadControl({ env });
      assertAutomationRunning(hostControl);
    } catch (error) {
      return { state: "paused", operation: null, error: errorResult(error) };
    }
    store.recoverExpiredLeases(now().toISOString());
    const operation = store.leaseNext({ workerId, leaseMs, at: now().toISOString() });
    if (!operation) return { state: "idle", operation: null };
    let heartbeatError = null;
    const heartbeat = setInterval(() => {
      try {
        store.renewLease(operation.operationId, {
          workerId,
          leaseMs,
          at: now().toISOString(),
        });
      } catch (error) {
        heartbeatError = error;
      }
    }, heartbeatMs);
    heartbeat.unref?.();

    try {
      // The first provider write durably consumes the exact authorization. After
      // that point, expiry cannot turn a crash into a stranded partial upload:
      // reconciliation may continue only this already-bound operation/resource.
      const context = await loadContext(operation.jobId, {
        env,
        now: now(),
        allowExpiredAuthorization: operation.providerWriteStartedAt != null,
      });
      const target = context.packet.snapshot.targets.find(
        (candidate) => candidate.id === operation.platformId,
      );
      if (!target || !context.authorization.targets.includes(operation.platformId)) {
        throw new PublishingControllerError(
          "authorization_scope_mismatch",
          "The queued target is not present in the current immutable release authorization.",
        );
      }
      assertOperationMatchesAuthorization(operation, context, target);
      assertAutomationCurrentlyAllowed(context, target);
      assertAutomationRunning(hostControl, operation.platformId);

      const receipts = await readReceiptLedger(context.directory, context.packet);
      const latest = latestOperationReceipt(receipts, operation);
      if (latest?.status === "verified") {
        const identityConflicts = [];
        if (operation.remoteId && latest.remote.id !== operation.remoteId) {
          identityConflicts.push("remote id");
        }
        if (operation.remoteUrl && latest.remote.url !== operation.remoteUrl) {
          identityConflicts.push("remote URL");
        }
        if (identityConflicts.length) {
          throw new PublishingControllerError(
            "verified_receipt_identity_mismatch",
            `Verified receipt conflicts with the durable provider ${identityConflicts.join(" and ")}; recovery was blocked.`,
            { receiptHash: latest.receiptHash },
          );
        }
        const completed = store.completeLease(operation.operationId, {
          workerId,
          state: "verified",
          at: now().toISOString(),
          remoteId: latest.remote.id,
          remoteUrl: latest.remote.url,
          result: { recoveredFromReceipt: latest.receiptHash },
        });
        return { state: "verified", operation: completed, recovered: true };
      }
      if (latest && (!operation.providerAcceptedAt || !operation.providerCheckpoint)) {
        throw new PublishingControllerError(
          "ambiguous_prior_attempt",
          `Operation has a ${latest.status} receipt without a matching durable provider checkpoint; automatic replay was blocked.`,
          { receiptHash: latest.receiptHash },
        );
      }

      const execution = await resolveAdapter({ context, operation, target });
      if (execution.adapter.checkpointProtocolVersion !== 1) {
        throw new PublishingControllerError(
          "adapter_checkpoint_protocol_required",
          `${operation.platformId} adapter does not implement the durable checkpoint protocol.`,
        );
      }
      const preflight = await execution.adapter.preflight(execution.input);
      if (heartbeatError) throw heartbeatError;
      let current = store.get(operation.operationId);
      const resuming = current.providerWriteStartedAt != null;

      let acceptedReceipt = receipts
        .filter(
          (receipt) =>
            receipt.platformId === operation.platformId &&
            receipt.operationId === operation.operationId &&
            receipt.status === "accepted",
        )
        .at(-1) || null;
      const onCheckpoint = async ({
        checkpoint,
        providerAccepted = false,
        remoteId = null,
        remoteUrl = null,
        providerSummary = null,
      }) => {
        current = store.recordProviderCheckpoint(operation.operationId, {
          workerId,
          checkpoint,
          providerAccepted,
          remoteId,
          remoteUrl,
          at: now().toISOString(),
        });
        if (providerAccepted && !acceptedReceipt) {
          if (!remoteId && !remoteUrl) {
            throw new PublishingControllerError(
              "provider_identity_missing",
              "A provider-accepted checkpoint must include the durable remote identity.",
            );
          }
          acceptedReceipt = await recordAdapterAccepted({
            jobDirectory: context.directory,
            packet: context.packet,
            platformId: operation.platformId,
            operationId: operation.operationId,
            remoteId,
            remoteUrl,
            providerSummary:
              providerSummary || `${operation.platformId} accepted remote resource ${remoteId || remoteUrl}.`,
            recordedAt: now().toISOString(),
          });
        }
      };
      const beforeWrite = async ({ step = "provider_write" } = {}) => {
        const latestControl = await loadControl({ env });
        assertAutomationRunning(latestControl, operation.platformId);
        current = store.beginProviderWrite(operation.operationId, {
          workerId,
          at: now().toISOString(),
          requestSummary: `${operation.platformId} mutating step ${step} is beginning.`,
          buildCommit,
        });
        return current;
      };
      const runtime = { checkpoint: current.providerCheckpoint, beforeWrite, onCheckpoint };
      let result;
      if (resuming) {
        if (typeof execution.adapter.reconcile !== "function") {
          throw new PublishingControllerError(
            "adapter_reconciliation_required",
            `${operation.platformId} has a prior provider write and must be reconciled before another create request.`,
          );
        }
        result = await execution.adapter.reconcile(execution.input, runtime);
      } else {
        result = await execution.adapter.publish(execution.input, runtime);
      }
      if (heartbeatError) {
        throw new PublishingControllerError(
          "lease_heartbeat_failed_after_write",
          "The provider operation completed but its controller lease could not be renewed; manual reconciliation is required.",
        );
      }
      const identity = execution.resultIdentity(result);
      current = store.get(operation.operationId);
      if (!current.providerAcceptedAt || !current.providerCheckpoint || !acceptedReceipt) {
        throw new PublishingControllerError(
          "provider_checkpoint_missing_after_write",
          `${operation.platformId} returned success without durably checkpointing provider acceptance.`,
        );
      }
      if (
        (current.remoteId && current.remoteId !== identity.remoteId) ||
        (current.remoteUrl && current.remoteUrl !== identity.remoteUrl)
      ) {
        throw new PublishingControllerError(
          "provider_identity_mismatch",
          `${operation.platformId} final identity differs from its durable accepted checkpoint.`,
        );
      }
      const receiptsWritten = await recordAdapterVerified({
        jobDirectory: context.directory,
        packet: context.packet,
        platformId: operation.platformId,
        operationId: operation.operationId,
        ...identity,
        recordedAt: now().toISOString(),
      });
      const completed = store.completeLease(operation.operationId, {
        workerId,
        state: "verified",
        at: now().toISOString(),
        remoteId: identity.remoteId,
        remoteUrl: identity.remoteUrl,
        result: {
          adapter: result,
          preflight,
          receiptHash: receiptsWritten.verified.receiptHash,
          buildCommit,
        },
      });
      return { state: "verified", operation: completed, result };
    } catch (error) {
      const failure = errorResult(error);
      const current = store.get(operation.operationId);
      const shouldReconcile =
        current?.providerCheckpoint != null &&
        current?.providerWriteStartedAt != null &&
        (
          error?.retryable === true ||
          failure.code === "ambiguous_provider_response" ||
          failure.code === "lease_heartbeat_failed_after_write" ||
          failure.code === "automation_paused" ||
          failure.code === "platform_not_locally_allowed"
        );
      const blocked = store.completeLease(operation.operationId, {
        workerId,
        state: shouldReconcile ? "waiting" : "blocked",
        at: now().toISOString(),
        nextAttemptAt: shouldReconcile ? retryAt(now()) : null,
        errorCode: failure.code,
        errorMessage: failure.message,
        result: { failure },
      });
      return { state: shouldReconcile ? "waiting" : "blocked", operation: blocked, error: failure };
    } finally {
      clearInterval(heartbeat);
    }
  }

  return Object.freeze({ runOnce, workerId });
}

export async function runControllerOnce({ env = process.env } = {}) {
  const store = await openControlStore({ env });
  try {
    return await createPublishingController({ store, env, requirePinnedBuild: true }).runOnce();
  } finally {
    store.close();
  }
}

export { AUTOMATED_DIRECT_TARGETS };
