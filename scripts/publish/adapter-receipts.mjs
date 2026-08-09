import fs from "node:fs/promises";
import path from "node:path";
import { writePrivateJson } from "./lib.mjs";
import {
  buildReleaseReceipt,
  receiptFileName,
  releaseReceiptAppendProblems,
  releaseReceiptLedgerProblems,
  releaseReceiptProblems,
  withReceiptWriteLock,
} from "./release-receipt.mjs";

const RECEIPT_STATUS_ORDER = ["accepted", "processing", "published", "verified", "failed", "superseded"];

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function readReceiptLedger(jobDirectory, packet) {
  const receiptsDirectory = path.join(jobDirectory, "receipts");
  let entries = [];
  try {
    entries = await fs.readdir(receiptsDirectory, { withFileTypes: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const receipts = [];
  for (const entry of entries.filter((candidate) => candidate.isFile() && candidate.name.endsWith(".json"))) {
    const receipt = await readJson(path.join(receiptsDirectory, entry.name));
    const problems = releaseReceiptProblems(packet, receipt);
    if (problems.length) {
      throw new Error(`Receipt ${entry.name} failed integrity validation:\n- ${problems.join("\n- ")}`);
    }
    if (entry.name !== receiptFileName(receipt)) {
      throw new Error(`Receipt filename does not match its immutable content: ${entry.name}`);
    }
    receipts.push(receipt);
  }
  const sorted = receipts.sort(
    (left, right) =>
      Date.parse(left.recordedAt) - Date.parse(right.recordedAt) ||
      RECEIPT_STATUS_ORDER.indexOf(left.status) - RECEIPT_STATUS_ORDER.indexOf(right.status) ||
      left.receiptHash.localeCompare(right.receiptHash),
  );
  const problems = releaseReceiptLedgerProblems(packet, sorted);
  if (problems.length) {
    throw new Error(`Receipt ledger failed lifecycle validation:\n- ${problems.join("\n- ")}`);
  }
  return sorted;
}

async function appendReceipt(jobDirectory, packet, input) {
  return withReceiptWriteLock(jobDirectory, async () => {
    const existing = await readReceiptLedger(jobDirectory, packet);
    const receipt = buildReleaseReceipt({ packet, ...input });
    const problems = [
      ...releaseReceiptProblems(packet, receipt),
      ...releaseReceiptAppendProblems(existing, receipt),
    ];
    if (problems.length) {
      throw new Error(`Adapter receipt validation failed:\n- ${[...new Set(problems)].join("\n- ")}`);
    }
    const destination = path.join(jobDirectory, "receipts", receiptFileName(receipt));
    await writePrivateJson(destination, receipt, { exclusive: true });
    return receipt;
  });
}

function latestOperationReceipt(receipts, platformId, operationId) {
  return receipts
    .filter((receipt) => receipt.platformId === platformId && receipt.operationId === operationId)
    .at(-1) || null;
}

export async function recordAdapterAccepted({
  jobDirectory,
  packet,
  platformId,
  operationId,
  recordedBy = "drm-publisher-controller",
  requestSummary,
  providerSummary,
  remoteId = null,
  remoteUrl = null,
  recordedAt,
}) {
  return (await claimAdapterAccepted({
    jobDirectory,
    packet,
    platformId,
    operationId,
    recordedBy,
    requestSummary,
    providerSummary,
    remoteId,
    remoteUrl,
    recordedAt,
  })).receipt;
}

export async function claimAdapterAccepted({
  jobDirectory,
  packet,
  platformId,
  operationId,
  recordedBy = "drm-publisher-controller",
  requestSummary,
  providerSummary,
  remoteId = null,
  remoteUrl = null,
  recordedAt,
}) {
  return withReceiptWriteLock(jobDirectory, async () => {
    const existing = await readReceiptLedger(jobDirectory, packet);
    const latest = latestOperationReceipt(existing, platformId, operationId);
    if (latest) return { receipt: latest, created: false };
    const summary = providerSummary || requestSummary;
    if (typeof summary !== "string" || !summary.trim()) {
      throw new Error("Provider acceptance evidence is required.");
    }
    const receipt = buildReleaseReceipt({
      packet,
      platformId,
      operationId,
      status: "accepted",
      remoteId,
      remoteUrl,
      recordedBy,
      recordedAt,
      evidence: [{ kind: "provider_response", value: summary }],
    });
    const problems = [
      ...releaseReceiptProblems(packet, receipt),
      ...releaseReceiptAppendProblems(existing, receipt),
    ];
    if (problems.length) {
      throw new Error(`Adapter receipt validation failed:\n- ${[...new Set(problems)].join("\n- ")}`);
    }
    const destination = path.join(jobDirectory, "receipts", receiptFileName(receipt));
    await writePrivateJson(destination, receipt, { exclusive: true });
    return { receipt, created: true };
  });
}

export async function recordAdapterVerified({
  jobDirectory,
  packet,
  platformId,
  operationId,
  remoteId,
  remoteUrl,
  recordedBy = "drm-publisher-controller",
  providerSummary,
  readbackSummary,
  recordedAt = new Date().toISOString(),
}) {
  const existing = await readReceiptLedger(jobDirectory, packet);
  const latest = latestOperationReceipt(existing, platformId, operationId);
  if (!latest) throw new Error("An accepted adapter receipt is required before verification.");
  if (latest.status === "verified") return { published: latest, verified: latest };
  if (!["accepted", "processing", "published"].includes(latest.status)) {
    throw new Error(`Cannot record adapter verification after ${latest.status}.`);
  }

  let published = latest;
  if (latest.status !== "published") {
    published = await appendReceipt(jobDirectory, packet, {
      platformId,
      operationId,
      status: "published",
      remoteId,
      remoteUrl,
      recordedBy,
      recordedAt,
      evidence: [{ kind: "provider_response", value: providerSummary }],
    });
  }
  const verifiedAt = new Date(Math.max(Date.now(), Date.parse(recordedAt)) + 1).toISOString();
  const verified = await appendReceipt(jobDirectory, packet, {
    platformId,
    operationId,
    status: "verified",
    remoteId,
    remoteUrl,
    recordedBy,
    recordedAt: verifiedAt,
    evidence: [{ kind: "api_readback", value: readbackSummary }],
  });
  return { published, verified };
}
