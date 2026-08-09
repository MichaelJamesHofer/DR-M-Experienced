import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  claimAdapterAccepted,
  readReceiptLedger,
  recordAdapterAccepted,
  recordAdapterVerified,
} from "./adapter-receipts.mjs";

function packet() {
  return {
    id: "episode-eight-20260808t230000z",
    approvalHash: "a".repeat(64),
    snapshot: {
      catalogBinding: {
        revision: 12,
        catalogHash: "b".repeat(64),
        episodeNumber: 8,
        episodeHash: "c".repeat(64),
      },
      targets: [
        {
          id: "vimeo",
          channelUrl: "https://vimeo.com/drmexperienced",
          destinationIds: { accountId: "253415660", containerId: null },
          assetSha256: "d".repeat(64),
          approvedCopy: "Approved Vimeo description",
          releasePlan: { releaseMode: "publish_now", finalVisibility: "anybody" },
        },
      ],
    },
  };
}

test("adapter receipts append accepted, published, and verified evidence", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "drm-adapter-receipts-"));
  try {
    const value = packet();
    const common = {
      jobDirectory: directory,
      packet: value,
      platformId: "vimeo",
      operationId: "vimeo-episode-eight-test",
      recordedBy: "controller-test",
    };
    const accepted = await recordAdapterAccepted({
      ...common,
      requestSummary: "Vimeo account and immutable upload request passed preflight.",
      recordedAt: "2026-08-08T23:00:00.000Z",
    });
    assert.equal(accepted.status, "accepted");

    const result = await recordAdapterVerified({
      ...common,
      remoteId: "1234567890",
      remoteUrl: "https://vimeo.com/1234567890",
      providerSummary: "Vimeo accepted and transcoded video 1234567890.",
      readbackSummary: "Vimeo API readback verified video 1234567890 for account 253415660.",
      recordedAt: "2026-08-08T23:01:00.000Z",
    });
    assert.equal(result.published.status, "published");
    assert.equal(result.verified.status, "verified");

    const receipts = await readReceiptLedger(directory, value);
    assert.deepEqual(receipts.map((receipt) => receipt.status), ["accepted", "published", "verified"]);
    assert.ok(receipts.every((receipt) => receipt.operationId === common.operationId));

    const repeated = await recordAdapterVerified({
      ...common,
      remoteId: "1234567890",
      remoteUrl: "https://vimeo.com/1234567890",
      providerSummary: "Vimeo accepted and transcoded video 1234567890.",
      readbackSummary: "Vimeo API readback verified video 1234567890 for account 253415660.",
    });
    assert.equal(repeated.verified.receiptHash, result.verified.receiptHash);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("accepted receipt claim is atomic and only one worker may proceed", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "drm-adapter-receipts-"));
  try {
    const input = {
      jobDirectory: directory,
      packet: packet(),
      platformId: "vimeo",
      operationId: "vimeo-episode-eight-claim",
      requestSummary: "Vimeo exact-account preflight passed for the approved release.",
      recordedAt: "2026-08-08T23:00:00.000Z",
    };
    const claims = await Promise.all([claimAdapterAccepted(input), claimAdapterAccepted(input)]);
    assert.equal(claims.filter((claim) => claim.created).length, 1);
    assert.equal(claims[0].receipt.receiptHash, claims[1].receipt.receiptHash);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("verification cannot bypass an accepted receipt", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "drm-adapter-receipts-"));
  try {
    await assert.rejects(
      recordAdapterVerified({
        jobDirectory: directory,
        packet: packet(),
        platformId: "vimeo",
        operationId: "vimeo-episode-eight-test",
        remoteId: "1234567890",
        remoteUrl: "https://vimeo.com/1234567890",
        providerSummary: "Provider response exists.",
        readbackSummary: "Provider API readback exists.",
      }),
      /accepted adapter receipt/,
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
