import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVE_RECEIPT_STATUSES,
  buildReleaseReceipt,
  receiptFileName,
  releaseReceiptAppendProblems,
  releaseReceiptLedgerProblems,
  releaseReceiptProblems,
} from "./release-receipt.mjs";

function packet() {
  return {
    id: "episode-08-20260808t120000z",
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
          id: "youtube",
          channelUrl: "https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv",
          destinationIds: {
            accountId: "UCabcdefghijklmnopqrstuv",
            containerId: "UUabcdefghijklmnopqrstuv",
          },
          assetSha256: "d".repeat(64),
          approvedCopy: "Approved copy",
          releasePlan: { initialVisibility: "private", finalVisibility: "public" },
        },
      ],
    },
  };
}

test("release receipt binds a remote result to the immutable approved destination", () => {
  const source = packet();
  const receipt = buildReleaseReceipt({
    packet: source,
    platformId: "youtube",
    operationId: "youtube-videos.insert-abc123",
    status: "verified",
    remoteId: "video123",
    remoteUrl: "https://www.youtube.com/watch?v=video123",
    recordedAt: "2026-08-08T20:00:00Z",
    recordedBy: "publisher-adapter",
    evidence: [{ kind: "public_readback", value: "title, copy, art, duration matched" }],
  });

  assert.deepEqual(releaseReceiptProblems(source, receipt), []);
  assert.match(receipt.receiptHash, /^[a-f0-9]{64}$/);
  assert.equal(
    receiptFileName(receipt),
    `20260808t200000z-youtube-verified-${receipt.receiptHash.slice(0, 16)}.json`,
  );
});

test("release receipt detects tampering and stale approval bindings", () => {
  const source = packet();
  const receipt = buildReleaseReceipt({
    packet: source,
    platformId: "youtube",
    operationId: "youtube-videos.insert-abc123",
    status: "published",
    remoteId: "video123",
    recordedAt: "2026-08-08T20:00:00Z",
    recordedBy: "publisher-adapter",
  });
  receipt.remote.id = "other-video";
  assert.match(releaseReceiptProblems(source, receipt).join("\n"), /does not match its hash/);

  const stale = structuredClone(source);
  stale.approvalHash = "e".repeat(64);
  assert.match(releaseReceiptProblems(stale, receipt).join("\n"), /approval hash/);
});

test("published and verified receipts require a remote identity", () => {
  const source = packet();
  const receipt = buildReleaseReceipt({
    packet: source,
    platformId: "youtube",
    operationId: "youtube-videos.insert-abc123",
    status: "verified",
    recordedAt: "2026-08-08T20:00:00Z",
    recordedBy: "publisher-adapter",
  });
  assert.match(releaseReceiptProblems(source, receipt).join("\n"), /requires a remote id or URL/);
});

test("verified receipts require a typed, meaningful readback", () => {
  const source = packet();
  const generic = buildReleaseReceipt({
    packet: source,
    platformId: "youtube",
    operationId: "youtube-videos.insert-abc123",
    status: "verified",
    remoteId: "video123",
    remoteUrl: "https://www.youtube.com/watch?v=video123",
    recordedAt: "2026-08-08T20:00:00Z",
    recordedBy: "publisher-adapter",
    evidence: [{ kind: "public_readback", value: "matched" }],
  });
  assert.match(releaseReceiptProblems(source, generic).join("\n"), /meaningful typed readback/);

  const unsupported = buildReleaseReceipt({
    packet: source,
    platformId: "youtube",
    operationId: "youtube-videos.insert-abc123",
    status: "verified",
    remoteId: "video123",
    remoteUrl: "https://www.youtube.com/watch?v=video123",
    recordedAt: "2026-08-08T20:00:00Z",
    recordedBy: "publisher-adapter",
    evidence: [{ kind: "freeform_note", value: "The public result looked correct." }],
  });
  assert.match(releaseReceiptProblems(source, unsupported).join("\n"), /unsupported/);
});

test("remote URLs use an approved origin and bind the platform remote id", () => {
  const source = packet();
  const wrongOrigin = buildReleaseReceipt({
    packet: source,
    platformId: "youtube",
    operationId: "youtube-videos.insert-abc123",
    status: "published",
    remoteId: "video123",
    remoteUrl: "https://example.invalid/watch?v=video123",
    recordedAt: "2026-08-08T20:00:00Z",
    recordedBy: "publisher-adapter",
  });
  assert.match(releaseReceiptProblems(source, wrongOrigin).join("\n"), /origin is not approved/);

  const wrongId = buildReleaseReceipt({
    packet: source,
    platformId: "youtube",
    operationId: "youtube-videos.insert-abc123",
    status: "published",
    remoteId: "video123",
    remoteUrl: "https://www.youtube.com/watch?v=other-video",
    recordedAt: "2026-08-08T20:00:00Z",
    recordedBy: "publisher-adapter",
  });
  assert.match(releaseReceiptProblems(source, wrongId).join("\n"), /does not contain.*remote id/);
});

test("receipt lifecycle rejects regressions, terminal reuse, URL drift, and overlapping active operations", () => {
  const source = packet();
  const makeReceipt = ({ operationId = "operation-1", status, recordedAt, remote = false, evidence = [] }) =>
    buildReleaseReceipt({
      packet: source,
      platformId: "youtube",
      operationId,
      status,
      remoteId: remote ? "video123" : null,
      remoteUrl: remote ? "https://www.youtube.com/watch?v=video123" : null,
      recordedAt,
      recordedBy: "publisher-adapter",
      evidence,
    });

  const accepted = makeReceipt({ status: "accepted", recordedAt: "2026-08-08T20:00:00Z" });
  const processing = makeReceipt({ status: "processing", recordedAt: "2026-08-08T20:01:00Z" });
  const published = makeReceipt({ status: "published", recordedAt: "2026-08-08T20:02:00Z", remote: true });
  const verified = makeReceipt({
    status: "verified",
    recordedAt: "2026-08-08T20:03:00Z",
    remote: true,
    evidence: [{ kind: "public_readback", value: "Title, description, and media matched." }],
  });
  assert.deepEqual(releaseReceiptLedgerProblems(source, [accepted, processing, published, verified]), []);

  const regressed = makeReceipt({ status: "processing", recordedAt: "2026-08-08T20:04:00Z" });
  assert.match(releaseReceiptAppendProblems([accepted, processing, published], regressed).join("\n"), /cannot transition/);

  assert.deepEqual(
    [...ACTIVE_RECEIPT_STATUSES],
    ["accepted", "processing", "published", "verified"],
  );
  for (const activeHistory of [
    [accepted],
    [accepted, processing],
    [accepted, processing, published],
    [accepted, processing, published, verified],
  ]) {
    const secondOperation = makeReceipt({
      operationId: "operation-2",
      status: "accepted",
      recordedAt: "2026-08-08T20:04:00Z",
    });
    assert.match(
      releaseReceiptAppendProblems(activeHistory, secondOperation).join("\n"),
      /already has an active .* operation/,
    );
  }

  const changedUrl = buildReleaseReceipt({
    packet: source,
    platformId: "youtube",
    operationId: "operation-1",
    status: "verified",
    remoteId: "video123",
    remoteUrl: "https://youtu.be/video123",
    recordedAt: "2026-08-08T20:03:00Z",
    recordedBy: "publisher-adapter",
    evidence: [{ kind: "public_readback", value: "Title, description, and media matched." }],
  });
  assert.match(releaseReceiptAppendProblems([accepted, processing, published], changedUrl).join("\n"), /Remote URL conflicts/);

  const superseded = makeReceipt({ status: "superseded", recordedAt: "2026-08-08T20:04:00Z", remote: true });
  assert.deepEqual(releaseReceiptAppendProblems([accepted, processing, published, verified], superseded), []);
  const afterTerminal = makeReceipt({ status: "failed", recordedAt: "2026-08-08T20:05:00Z", remote: true });
  assert.match(
    releaseReceiptAppendProblems([accepted, processing, published, verified, superseded], afterTerminal).join("\n"),
    /cannot transition from superseded/,
  );

  const failed = makeReceipt({
    operationId: "failed-operation",
    status: "failed",
    recordedAt: "2026-08-08T20:06:00Z",
    evidence: [{ kind: "error", value: "Provider rejected the upload request." }],
  });
  const restartFailed = makeReceipt({
    operationId: "failed-operation",
    status: "accepted",
    recordedAt: "2026-08-08T20:07:00Z",
  });
  assert.deepEqual(releaseReceiptAppendProblems([], failed), []);
  assert.match(releaseReceiptAppendProblems([failed], restartFailed).join("\n"), /cannot transition from failed/);
});
