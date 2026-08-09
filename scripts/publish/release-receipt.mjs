import fs from "node:fs/promises";
import path from "node:path";
import { hashSnapshot, hashText } from "./lib.mjs";

export const RECEIPT_STATUSES = new Set([
  "accepted",
  "processing",
  "published",
  "verified",
  "failed",
  "superseded",
]);

export const ACTIVE_RECEIPT_STATUSES = new Set([
  "accepted",
  "processing",
  "published",
  "verified",
]);

export const TERMINAL_RECEIPT_STATUSES = new Set(["failed", "superseded"]);

export const RECEIPT_TRANSITIONS = Object.freeze({
  start: new Set(["accepted", "failed"]),
  accepted: new Set(["processing", "published", "failed", "superseded"]),
  processing: new Set(["published", "failed", "superseded"]),
  published: new Set(["verified", "failed", "superseded"]),
  verified: new Set(["superseded"]),
  failed: new Set(),
  superseded: new Set(),
});

export const RECEIPT_EVIDENCE_KINDS = new Set([
  "api_readback",
  "asset_fingerprint",
  "authenticated_readback",
  "error",
  "http_readback",
  "processing_status",
  "provider_request",
  "provider_response",
  "public_readback",
  "remote_metadata",
  "screenshot",
  "supersession",
]);

const VERIFICATION_EVIDENCE_KINDS = new Set([
  "api_readback",
  "authenticated_readback",
  "http_readback",
  "public_readback",
]);
const NON_MEANINGFUL_EVIDENCE = new Set([
  "complete",
  "completed",
  "good",
  "matched",
  "ok",
  "passed",
  "success",
  "true",
  "verified",
  "yes",
]);
const PLATFORM_REMOTE_ORIGINS = Object.freeze({
  "rss.com": ["https://rss.com", "https://www.rss.com", "https://media.rss.com"],
  spotify: ["https://open.spotify.com", "https://creators.spotify.com"],
  apple: ["https://podcasts.apple.com"],
  amazon: [
    "https://music.amazon.com",
    "https://www.amazon.com",
    "https://amazon.com",
    "https://www.audible.com",
    "https://audible.com",
  ],
  youtube: [
    "https://www.youtube.com",
    "https://youtube.com",
    "https://m.youtube.com",
    "https://youtu.be",
    "https://studio.youtube.com",
  ],
  vimeo: ["https://vimeo.com", "https://www.vimeo.com", "https://player.vimeo.com"],
  instagram: ["https://www.instagram.com", "https://instagram.com"],
});
const REMOTE_ID_URL_PLATFORMS = new Set(["apple", "spotify", "youtube", "vimeo"]);
const RFC3339_WITH_TIMEZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const OPERATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseHttpsUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function normalizeRemoteUrl(value) {
  if (value == null) return null;
  const trimmed = typeof value === "string" ? value.trim() : value;
  const url = parseHttpsUrl(trimmed);
  if (!url) return trimmed;
  url.hash = "";
  return url.href;
}

function receiptContent(receipt) {
  const { receiptHash: _receiptHash, ...content } = receipt;
  return content;
}

function targetFor(packet, platformId) {
  return packet?.snapshot?.targets?.find((candidate) => candidate.id === platformId);
}

function approvedRemoteOrigins(target) {
  const origins = new Set(PLATFORM_REMOTE_ORIGINS[target.id] || []);
  const channel = parseHttpsUrl(target.channelUrl);
  if (channel) origins.add(channel.origin);
  return origins;
}

function exactUrlTokens(url) {
  let pathSegments = [];
  try {
    pathSegments = url.pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
  } catch {
    pathSegments = url.pathname.split("/").filter(Boolean);
  }
  return new Set([...pathSegments, ...url.searchParams.values()]);
}

function remoteUrlBindingProblems(target, remote) {
  if (remote.url == null) return [];
  const problems = [];
  const url = parseHttpsUrl(remote.url);
  if (!url) return ["Receipt remote URL must be HTTPS."];
  if (url.username || url.password) problems.push("Receipt remote URL must not contain credentials.");
  if (new URL(remote.url).hash) problems.push("Receipt remote URL must not contain a fragment.");

  const origins = approvedRemoteOrigins(target);
  if (!origins.has(url.origin)) {
    problems.push(`Receipt remote URL origin is not approved for ${target.id}.`);
  }

  const tokens = exactUrlTokens(url);
  if (remote.id && REMOTE_ID_URL_PLATFORMS.has(target.id) && !tokens.has(remote.id)) {
    problems.push(`Receipt remote URL does not contain the ${target.id} remote id.`);
  }

  const containerId = target.destinationIds?.containerId;
  if (target.id === "apple" && containerId && !tokens.has(`id${containerId}`)) {
    problems.push("Receipt Apple URL does not identify the approved show.");
  }
  if (target.id === "rss.com" && containerId && !tokens.has(containerId)) {
    problems.push("Receipt RSS.com URL does not identify the approved show slug.");
  }
  return problems;
}

function meaningfulVerificationEvidence(evidence) {
  return evidence.some((item) => {
    if (
      !isPlainObject(item) ||
      typeof item.kind !== "string" ||
      typeof item.value !== "string"
    ) {
      return false;
    }
    const normalized = item.value.trim().toLowerCase().replace(/[.!]+$/g, "");
    return (
      VERIFICATION_EVIDENCE_KINDS.has(item.kind) &&
      normalized.length >= 12 &&
      !NON_MEANINGFUL_EVIDENCE.has(normalized)
    );
  });
}

function compareReceipts(left, right) {
  const timestampOrder = Date.parse(left.recordedAt) - Date.parse(right.recordedAt);
  if (timestampOrder) return timestampOrder;
  const statusOrder = ["accepted", "processing", "published", "verified", "failed", "superseded"];
  const lifecycleOrder = statusOrder.indexOf(left.status) - statusOrder.indexOf(right.status);
  if (lifecycleOrder) return lifecycleOrder;
  return left.receiptHash.localeCompare(right.receiptHash);
}

function latestReceiptsByOperation(receipts, platformId) {
  const latest = new Map();
  for (const receipt of receipts.filter((candidate) => candidate.platformId === platformId).sort(compareReceipts)) {
    latest.set(receipt.operationId, receipt);
  }
  return latest;
}

export function buildReleaseReceipt({
  packet,
  platformId,
  operationId,
  status,
  remoteId = null,
  remoteUrl = null,
  recordedAt = new Date().toISOString(),
  recordedBy,
  evidence = [],
}) {
  const target = targetFor(packet, platformId);
  if (!target) throw new Error(`${platformId} is not a selected destination in job ${packet?.id || "unknown"}.`);

  const receipt = {
    schemaVersion: 1,
    jobId: packet.id,
    approvalHash: packet.approvalHash,
    catalogBinding: structuredClone(packet.snapshot.catalogBinding),
    platformId,
    operationId,
    status,
    remote: {
      id: typeof remoteId === "string" && remoteId.trim() ? remoteId.trim() : null,
      url: normalizeRemoteUrl(remoteUrl),
    },
    recordedAt,
    recordedBy: recordedBy?.trim() || "",
    binding: {
      targetSha256: hashSnapshot(target),
      assetSha256: target.assetSha256 || null,
      approvedCopySha256: target.approvedCopy == null ? null : hashText(target.approvedCopy),
      releasePlanSha256: target.releasePlan == null ? null : hashSnapshot(target.releasePlan),
    },
    evidence: evidence.map((item) => ({
      kind: typeof item.kind === "string" ? item.kind.trim() : item.kind,
      value: typeof item.value === "string" ? item.value.trim() : item.value,
    })),
  };
  receipt.receiptHash = hashSnapshot(receipt);
  return receipt;
}

export function releaseReceiptProblems(packet, receipt) {
  const problems = [];
  if (!isPlainObject(receipt)) return ["Receipt must be a JSON object."];
  if (receipt.schemaVersion !== 1) problems.push("Receipt schema version is invalid.");
  if (receipt.jobId !== packet?.id) problems.push("Receipt job id does not match the packet.");
  if (receipt.approvalHash !== packet?.approvalHash) problems.push("Receipt approval hash does not match the packet.");

  const target = targetFor(packet, receipt.platformId);
  if (!target) problems.push("Receipt platform is not selected in the packet.");
  if (typeof receipt.operationId !== "string" || !OPERATION_ID.test(receipt.operationId)) {
    problems.push("Receipt operation id is invalid.");
  }
  if (!RECEIPT_STATUSES.has(receipt.status)) problems.push("Receipt status is invalid.");
  if (
    typeof receipt.recordedAt !== "string" ||
    !RFC3339_WITH_TIMEZONE.test(receipt.recordedAt) ||
    Number.isNaN(Date.parse(receipt.recordedAt))
  ) {
    problems.push("Receipt timestamp is invalid.");
  }
  if (typeof receipt.recordedBy !== "string" || !receipt.recordedBy.trim()) {
    problems.push("Receipt recorder attribution is missing.");
  }
  if (!isPlainObject(receipt.remote)) {
    problems.push("Receipt remote identity is missing.");
  } else {
    if (receipt.remote.id != null && (typeof receipt.remote.id !== "string" || !receipt.remote.id.trim())) {
      problems.push("Receipt remote id is invalid.");
    }
    if (receipt.remote.url != null && !parseHttpsUrl(receipt.remote.url)) {
      problems.push("Receipt remote URL must be HTTPS.");
    } else if (target) {
      problems.push(...remoteUrlBindingProblems(target, receipt.remote));
    }
    if (["published", "verified"].includes(receipt.status) && !receipt.remote.id && !receipt.remote.url) {
      problems.push(`${receipt.status} receipt requires a remote id or URL.`);
    }
  }
  if (!Array.isArray(receipt.evidence)) {
    problems.push("Receipt evidence must be an array.");
  } else {
    for (const item of receipt.evidence) {
      if (!isPlainObject(item) || typeof item.kind !== "string" || !RECEIPT_EVIDENCE_KINDS.has(item.kind)) {
        problems.push("Receipt evidence kind is invalid or unsupported.");
        continue;
      }
      if (typeof item.value !== "string" || !item.value.trim()) {
        problems.push("Receipt evidence value is invalid.");
      }
    }
    if (receipt.status === "verified" && !meaningfulVerificationEvidence(receipt.evidence)) {
      problems.push(
        "Verified receipt requires meaningful typed readback evidence from the API, authenticated dashboard, HTTP response, or public destination.",
      );
    }
  }

  if (!isPlainObject(receipt.catalogBinding) || !isPlainObject(receipt.binding)) {
    problems.push("Receipt immutable binding is missing.");
  } else if (target) {
    if (hashSnapshot(receipt.catalogBinding) !== hashSnapshot(packet.snapshot.catalogBinding)) {
      problems.push("Receipt catalog binding does not match the packet.");
    }
    const expected = {
      targetSha256: hashSnapshot(target),
      assetSha256: target.assetSha256 || null,
      approvedCopySha256: target.approvedCopy == null ? null : hashText(target.approvedCopy),
      releasePlanSha256: target.releasePlan == null ? null : hashSnapshot(target.releasePlan),
    };
    if (hashSnapshot(receipt.binding) !== hashSnapshot(expected)) {
      problems.push("Receipt destination binding does not match the packet.");
    }
  }

  if (typeof receipt.receiptHash !== "string" || !/^[a-f0-9]{64}$/.test(receipt.receiptHash)) {
    problems.push("Receipt hash is missing or invalid.");
  } else if (hashSnapshot(receiptContent(receipt)) !== receipt.receiptHash) {
    problems.push("Receipt content does not match its hash.");
  }
  return [...new Set(problems)];
}

export function releaseReceiptAppendProblems(existingReceipts, receipt) {
  const problems = [];
  const sameOperation = existingReceipts
    .filter(
      (candidate) =>
        candidate.platformId === receipt.platformId && candidate.operationId === receipt.operationId,
    )
    .sort(compareReceipts);
  const prior = sameOperation.at(-1) || null;

  if (sameOperation.some((candidate) => candidate.status === receipt.status)) {
    problems.push(
      `A ${receipt.status} receipt already exists for ${receipt.platformId} operation ${receipt.operationId}.`,
    );
  }
  if (prior && Date.parse(receipt.recordedAt) < Date.parse(prior.recordedAt)) {
    problems.push("Receipt timestamp regresses behind the prior operation receipt.");
  }
  const allowed = RECEIPT_TRANSITIONS[prior?.status || "start"] || new Set();
  if (!allowed.has(receipt.status)) {
    problems.push(
      prior
        ? `${receipt.platformId} operation ${receipt.operationId} cannot transition from ${prior.status} to ${receipt.status}.`
        : `${receipt.platformId} operation ${receipt.operationId} must start as accepted or failed.`,
    );
  }

  const knownIds = new Set(sameOperation.map((candidate) => candidate.remote.id).filter(Boolean));
  const knownUrls = new Set(
    sameOperation.map((candidate) => normalizeRemoteUrl(candidate.remote.url)).filter(Boolean),
  );
  if (receipt.remote.id && knownIds.size && !knownIds.has(receipt.remote.id)) {
    problems.push(`Remote id conflicts with the existing ${receipt.platformId} operation receipt.`);
  }
  if (receipt.remote.url && knownUrls.size && !knownUrls.has(normalizeRemoteUrl(receipt.remote.url))) {
    problems.push(`Remote URL conflicts with the existing ${receipt.platformId} operation receipt.`);
  }
  if (["published", "verified"].includes(receipt.status)) {
    if (knownIds.size && !receipt.remote.id) {
      problems.push("Receipt must retain the operation's existing remote id.");
    }
    if (knownUrls.size && !receipt.remote.url) {
      problems.push("Receipt must retain the operation's existing remote URL.");
    }
  }

  const latestByOperation = latestReceiptsByOperation(existingReceipts, receipt.platformId);
  const activeOtherOperation = [...latestByOperation.values()].find(
    (candidate) =>
      candidate.operationId !== receipt.operationId &&
      ACTIVE_RECEIPT_STATUSES.has(candidate.status) &&
      ACTIVE_RECEIPT_STATUSES.has(receipt.status),
  );
  if (activeOtherOperation) {
    problems.push(
      `${receipt.platformId} already has an active ${activeOtherOperation.status} operation ` +
        `${activeOtherOperation.operationId}; record it as failed or superseded before another delivery.`,
    );
  }
  return [...new Set(problems)];
}

export function releaseReceiptLedgerProblems(packet, receipts) {
  const problems = [];
  const accepted = [];
  for (const receipt of [...receipts].sort(compareReceipts)) {
    const receiptProblems = releaseReceiptProblems(packet, receipt);
    problems.push(...receiptProblems);
    if (receiptProblems.length) continue;
    problems.push(...releaseReceiptAppendProblems(accepted, receipt));
    accepted.push(receipt);
  }
  return [...new Set(problems)];
}

export async function withReceiptWriteLock(jobDirectory, callback, options = {}) {
  const timeoutMs = options.timeoutMs ?? 5000;
  const retryMs = options.retryMs ?? 25;
  const staleMs = options.staleMs ?? 15 * 60_000;
  const now = options.now ?? Date.now;
  const isProcessAlive = options.isProcessAlive ?? ((pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return error.code === "EPERM";
    }
  });
  const lockPath = path.join(jobDirectory, ".receipt-write.lock");
  const ownerPath = path.join(lockPath, "owner.json");
  const deadline = now() + timeoutMs;

  while (true) {
    try {
      await fs.mkdir(lockPath, { mode: 0o700 });
      await fs.writeFile(
        ownerPath,
        `${JSON.stringify({ pid: process.pid, acquiredAt: new Date(now()).toISOString() })}\n`,
        { mode: 0o600, flag: "wx" },
      );
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      let removedStale = false;
      try {
        const stats = await fs.stat(lockPath);
        if (now() - stats.mtimeMs >= staleMs) {
          let owner = null;
          try {
            owner = JSON.parse(await fs.readFile(ownerPath, "utf8"));
          } catch {}
          if (!Number.isSafeInteger(owner?.pid) || !isProcessAlive(owner.pid)) {
            await fs.rm(lockPath, { recursive: true, force: true });
            removedStale = true;
          }
        }
      } catch (staleError) {
        if (staleError.code !== "ENOENT") throw staleError;
        removedStale = true;
      }
      if (removedStale) continue;
      if (now() >= deadline) {
        throw new Error(`Timed out waiting for the receipt write lock: ${lockPath}`);
      }
      await new Promise((resolve) => setTimeout(resolve, retryMs));
    }
  }

  try {
    return await callback();
  } finally {
    await fs.rm(lockPath, { recursive: true, force: true });
  }
}

export function receiptFileName(receipt) {
  const timestamp = receipt.recordedAt.replace(/[-:.]/g, "").toLowerCase();
  return `${timestamp}-${receipt.platformId}-${receipt.status}-${receipt.receiptHash.slice(0, 16)}.json`;
}
