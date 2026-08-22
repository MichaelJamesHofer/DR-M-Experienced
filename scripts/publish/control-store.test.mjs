import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  deterministicOperationId,
  openControlStore,
  operationBinding,
} from "./control-store.mjs";
import { canonicalJson } from "./lib.mjs";

function fixtures() {
  const packet = {
    id: "episode-eight-20260808t230000z",
    approvalHash: "a".repeat(64),
    snapshot: {
      manifest: { episodeNumber: 8, slug: "episode-eight", publishAt: null },
      targets: [
        {
          id: "rss.com",
          mode: "api_after_auth",
          dependsOn: null,
          assetSha256: "1".repeat(64),
          approvedCopy: "Approved RSS copy",
          releasePlan: { releaseMode: "publish_now", finalVisibility: "public" },
        },
        {
          id: "apple",
          mode: "rss_fanout",
          dependsOn: "rss.com",
          assetSha256: null,
          approvedCopy: "Approved RSS copy",
          releasePlan: null,
        },
      ],
    },
  };
  const authorization = {
    authorizationHash: "b".repeat(64),
    targets: ["apple", "rss.com"],
  };
  return { packet, authorization };
}

async function withStore(callback) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "drm-control-store-"));
  let now = new Date("2026-08-08T23:00:00.000Z");
  const store = await openControlStore({
    filePath: path.join(directory, "publisher.sqlite3"),
    now: () => now,
  });
  try {
    await callback({ store, setNow: (value) => { now = new Date(value); }, directory });
  } finally {
    store.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
}

function legacyOperation(overrides = {}) {
  const binding = overrides.binding || {
    schemaVersion: 1,
    action: "create",
    jobId: overrides.jobId || "legacy-job",
    episodeNumber: 8,
    slug: "episode-eight",
    platformId: overrides.platformId || "vimeo",
  };
  const bindingJson = canonicalJson(binding);
  return {
    operationId: "vimeo-episode-eight-legacy",
    jobId: binding.jobId || "legacy-job",
    platformId: binding.platformId || "vimeo",
    kind: "publish",
    binding,
    bindingHash: createHash("sha256").update(bindingJson).digest("hex"),
    authorizationHash: "b".repeat(64),
    state: "waiting",
    attempts: 1,
    nextAttemptAt: "2026-08-08T23:00:00.000Z",
    providerWriteStartedAt: "2026-08-08T22:58:00.000Z",
    providerAcceptedAt: "2026-08-08T22:59:00.000Z",
    providerCheckpoint: {
      phase: "video_created",
      videoId: "1234567890",
      uploadUrl: "https://uploads.example.test/private-resume-secret",
    },
    remoteId: "1234567890",
    remoteUrl: "https://vimeo.com/1234567890",
    createdAt: "2026-08-08T22:57:00.000Z",
    updatedAt: "2026-08-08T22:59:00.000Z",
    ...overrides,
  };
}

async function createLegacyDatabase(filePath, rows) {
  const { DatabaseSync } = await import("node:sqlite");
  const database = new DatabaseSync(filePath);
  database.exec(`
    PRAGMA user_version = 1;
    CREATE TABLE operations (
      operation_id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      platform_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      binding_hash TEXT NOT NULL,
      binding_json TEXT NOT NULL,
      authorization_hash TEXT NOT NULL,
      dependency_operation_id TEXT REFERENCES operations(operation_id),
      state TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT NOT NULL,
      lease_owner TEXT,
      lease_expires_at TEXT,
      provider_write_started_at TEXT,
      provider_accepted_at TEXT,
      provider_checkpoint_json TEXT,
      remote_id TEXT,
      remote_url TEXT,
      last_error_code TEXT,
      last_error_message TEXT,
      result_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (job_id, platform_id, binding_hash)
    );
    CREATE TABLE operation_events (
      event_id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_id TEXT NOT NULL REFERENCES operations(operation_id),
      from_state TEXT,
      to_state TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      detail_json TEXT NOT NULL
    );
  `);
  const insert = database.prepare(`
    INSERT INTO operations (
      operation_id, job_id, platform_id, kind, binding_hash, binding_json,
      authorization_hash, dependency_operation_id, state, attempts, next_attempt_at,
      lease_owner, lease_expires_at, provider_write_started_at, provider_accepted_at,
      provider_checkpoint_json, remote_id, remote_url, last_error_code,
      last_error_message, result_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)
  `);
  for (const row of rows) {
    const bindingJson = canonicalJson(row.binding);
    insert.run(
      row.operationId,
      row.jobId,
      row.platformId,
      row.kind,
      row.bindingHash,
      bindingJson,
      row.authorizationHash,
      row.state,
      row.attempts,
      row.nextAttemptAt,
      row.providerWriteStartedAt,
      row.providerAcceptedAt,
      row.providerCheckpoint == null ? null : canonicalJson(row.providerCheckpoint),
      row.remoteId,
      row.remoteUrl,
      row.createdAt,
      row.updatedAt,
    );
  }
  if (rows.some((row) => Object.hasOwn(row, "providerCheckpointHash"))) {
    database.exec(`
      ALTER TABLE operations ADD COLUMN provider_checkpoint_sequence INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE operations ADD COLUMN provider_checkpoint_hash TEXT;
    `);
    const update = database.prepare(`
      UPDATE operations SET provider_checkpoint_sequence = ?, provider_checkpoint_hash = ?
      WHERE operation_id = ?
    `);
    for (const row of rows) {
      update.run(row.providerCheckpointSequence || 0, row.providerCheckpointHash || null, row.operationId);
    }
  }
  database.close();
}

test("operation ids bind the exact approved platform payload", () => {
  const { packet, authorization } = fixtures();
  const target = packet.snapshot.targets[0];
  const first = deterministicOperationId(packet, target, authorization);
  const second = deterministicOperationId(packet, { ...target, approvedCopy: "Changed" }, authorization);
  assert.match(first, /^rss\.com-episode-eight-[a-f0-9]{24}$/);
  assert.notEqual(first, second);
  assert.equal(operationBinding(packet, target, authorization).authorizationHash, authorization.authorizationHash);
});

test("an authenticated Vimeo TUS-host incident can recover exactly one blocked replacement checkpoint", async () => {
  await withStore(async ({ store }) => {
    const remoteId = "1204939658";
    const remoteUrl = `https://vimeo.com/${remoteId}`;
    const assetSha256 = "e".repeat(64);
    const binding = {
      schemaVersion: 1,
      action: "replace",
      jobId: "episode-5-energy-incident",
      approvalHash: "a".repeat(64),
      authorizationHash: "b".repeat(64),
      episodeNumber: 5,
      episodeHash: "c".repeat(64),
      platformId: "vimeo",
      remoteId,
      remoteUrl,
      destinationAccountId: "253415660",
      assetPath: "/approved/master-video.mp4",
      assetSha256,
      assetSizeBytes: 8_743_493_742,
    };
    const operationId = "vimeo-episode-5-replace-recovery-test";
    store.enqueue({
      operationId,
      jobId: binding.jobId,
      platformId: "vimeo",
      kind: "replace",
      binding,
      authorizationHash: binding.authorizationHash,
      notBefore: "2026-08-08T23:00:00.000Z",
    });
    store.leaseNext({ workerId: "incident-worker" });
    store.beginProviderWrite(operationId, {
      workerId: "incident-worker",
      at: "2026-08-22T20:04:57.303Z",
      requestSummary: "Vimeo replacement version request is beginning.",
    });
    store.completeLease(operationId, {
      workerId: "incident-worker",
      state: "blocked",
      at: "2026-08-22T20:04:58.036Z",
      errorCode: "INVALID_PROVIDER_RESPONSE",
      errorMessage: "Vimeo returned a TUS upload URL outside its documented host family.",
    });

    const checkpoint = {
      schemaVersion: 1,
      protocolVersion: 1,
      platform: "vimeo",
      phase: "provider_accepted",
      operation: "replace",
      accountId: binding.destinationAccountId,
      approvalHash: binding.approvalHash,
      episodeHash: binding.episodeHash,
      assetSha256,
      sizeBytes: binding.assetSizeBytes,
      videoId: remoteId,
      canonicalUrl: remoteUrl,
      tusUploadUrl: "https://global.upload.vimeo.com/tus/private-session",
      providerCreateStatus: null,
      versionUri: `/videos/${remoteId}/versions/1225722222`,
      providerRecovery: {
        kind: "authenticated_version_readback_and_tus_head",
        versionId: "1225722222",
        versionUri: `/videos/${remoteId}/versions/1225722222`,
        videoId: remoteId,
        accountId: binding.destinationAccountId,
        appId: "540274",
        filename: "master-video.mp4",
        assetSha256,
        sizeBytes: binding.assetSizeBytes,
        writeIntentAt: "2026-08-22T20:04:57.303Z",
        blockedAt: "2026-08-22T20:04:58.036Z",
        createdTime: "2026-08-22T20:04:57+00:00",
        versionReadbackSha256: "d".repeat(64),
        uploadLinkSha256: createHash("sha256")
          .update("https://global.upload.vimeo.com/tus/private-session")
          .digest("hex"),
        tusHead: {
          httpStatus: 200,
          tusResumable: "1.0.0",
          uploadLength: binding.assetSizeBytes,
          uploadOffset: 0,
        },
      },
    };

    assert.throws(
      () => store.recoverProviderCheckpoint(operationId, {
        checkpoint: { ...checkpoint, assetSha256: "0".repeat(64) },
        remoteId,
        remoteUrl,
        evidenceSummary: "Authenticated exact-version GET and empty TUS HEAD matched.",
        at: "2026-08-22T20:05:00.000Z",
      }),
      /does not match the blocked replacement binding/,
    );
    assert.equal(store.get(operationId).state, "blocked");
    assert.equal(store.get(operationId).providerCheckpoint, null);

    const recovered = store.recoverProviderCheckpoint(operationId, {
      checkpoint,
      remoteId,
      remoteUrl,
      evidenceSummary: "Authenticated exact-version GET and empty TUS HEAD matched.",
      at: "2026-08-22T20:05:00.000Z",
    });
    assert.equal(recovered.state, "waiting");
    assert.equal(recovered.providerAcceptedAt, "2026-08-22T20:05:00.000Z");
    assert.equal(recovered.providerCheckpointSequence, 1);
    assert.equal(recovered.providerCheckpoint.versionUri, checkpoint.versionUri);
    assert.equal(recovered.remoteId, remoteId);
    assert.deepEqual(store.list()[0].providerCheckpoint, { phase: "provider_accepted", redacted: true });
    assert.ok(!JSON.stringify(store.list()).includes("private-session"));
    assert.ok(!JSON.stringify(store.events(operationId)).includes("private-session"));
    assert.throws(
      () => store.recoverProviderCheckpoint(operationId, {
        checkpoint,
        remoteId,
        remoteUrl,
        evidenceSummary: "Duplicate recovery must fail.",
      }),
      /Only a blocked replacement/,
    );
  });
});

test("authorized operations enqueue idempotently and honor dependencies", async () => {
  await withStore(async ({ store }) => {
    const { packet, authorization } = fixtures();
    const first = store.enqueueAuthorizedJob(packet, authorization);
    assert.deepEqual(first.map((item) => item.operation.platformId), ["rss.com", "apple"]);
    assert.ok(first.every((item) => item.created));

    const repeated = store.enqueueAuthorizedJob(packet, authorization);
    assert.ok(repeated.every((item) => !item.created));
    assert.equal(store.list().length, 2);

    const host = store.leaseNext({ workerId: "worker-a", leaseMs: 60_000 });
    assert.equal(host.platformId, "rss.com");
    assert.equal(host.state, "running");
    assert.equal(store.leaseNext({ workerId: "worker-b" }), null);

    store.completeLease(host.operationId, {
      workerId: "worker-a",
      state: "verified",
      remoteId: "episode-remote-id",
      remoteUrl: "https://rss.com/podcasts/dr-m-experienced/episode-8/",
      result: { verified: true },
    });
    const fanout = store.leaseNext({ workerId: "worker-b" });
    assert.equal(fanout.platformId, "apple");
  });
});

test("expired leases recover without creating a duplicate operation", async () => {
  await withStore(async ({ store, setNow }) => {
    const binding = { action: "create", episodeNumber: 8, exact: "payload" };
    store.enqueue({
      operationId: "youtube-episode-eight-test",
      jobId: "episode-eight-20260808t230000z",
      platformId: "youtube",
      binding,
      authorizationHash: "b".repeat(64),
      notBefore: "2026-08-08T23:00:00.000Z",
    });
    const first = store.leaseNext({ workerId: "worker-a", leaseMs: 1_000 });
    assert.equal(first.attempts, 1);

    setNow("2026-08-08T23:00:02.000Z");
    assert.equal(store.recoverExpiredLeases(), 1);
    assert.equal(store.get(first.operationId).state, "retry");
    const second = store.leaseNext({ workerId: "worker-b", leaseMs: 1_000 });
    assert.equal(second.operationId, first.operationId);
    assert.equal(second.attempts, 2);
    assert.deepEqual(
      store.events(first.operationId).map((event) => event.toState),
      ["queued", "running", "retry", "running"],
    );
  });
});

test("lease renewal prevents recovery while a long upload is active", async () => {
  await withStore(async ({ store, setNow }) => {
    const { packet, authorization } = fixtures();
    const [entry] = store.enqueueAuthorizedJob(packet, { ...authorization, targets: ["rss.com"] });
    const leased = store.leaseNext({ workerId: "long-upload", leaseMs: 1_000 });
    setNow("2026-08-08T23:00:00.500Z");
    const renewed = store.renewLease(leased.operationId, { workerId: "long-upload", leaseMs: 2_000 });
    assert.equal(renewed.leaseExpiresAt, "2026-08-08T23:00:02.500Z");
    setNow("2026-08-08T23:00:01.500Z");
    assert.equal(store.recoverExpiredLeases(), 0);
    assert.equal(store.get(entry.operation.operationId).state, "running");
  });
});

test("an expired post-write lease waits for reconciliation and retains its checkpoint", async () => {
  await withStore(async ({ store, setNow }) => {
    const { packet, authorization } = fixtures();
    const [entry] = store.enqueueAuthorizedJob(packet, { ...authorization, targets: ["rss.com"] });
    const leased = store.leaseNext({ workerId: "worker-checkpoint", leaseMs: 1_000 });
    store.beginProviderWrite(leased.operationId, {
      workerId: "worker-checkpoint",
      requestSummary: "Creating a private RSS.com episode draft.",
    });
    store.recordProviderCheckpoint(leased.operationId, {
      workerId: "worker-checkpoint",
      checkpoint: {
        phase: "audio_upload_created",
        uploadId: "upload-123",
        uploadUrl: "https://uploads.example.test/private-resume-secret",
      },
      providerAccepted: true,
      remoteId: "episode-remote",
    });

    setNow("2026-08-08T23:00:02.000Z");
    assert.equal(store.recoverExpiredLeases(), 1);
    const recovered = store.get(entry.operation.operationId);
    assert.equal(recovered.state, "waiting");
    assert.equal(recovered.lastErrorCode, "provider_reconciliation_required");
    assert.equal(recovered.providerCheckpoint.uploadId, "upload-123");
    assert.equal(recovered.providerCheckpointSequence, 1);
    assert.match(recovered.providerCheckpointHash, /^[a-f0-9]{64}$/);
    assert.equal(recovered.remoteId, "episode-remote");
    const listed = store.list()[0];
    assert.deepEqual(listed.providerCheckpoint, { phase: "audio_upload_created", redacted: true });
    assert.ok(!JSON.stringify(listed).includes("private-resume-secret"), "queue listings must redact resume data");
  });
});

test("one platform create slot cannot be duplicated across separately authorized jobs", async () => {
  await withStore(async ({ store }) => {
    const { packet, authorization } = fixtures();
    store.enqueueAuthorizedJob(packet, { ...authorization, targets: ["rss.com"] });
    const duplicatePacket = structuredClone(packet);
    duplicatePacket.id = "episode-eight-second-job-20260808t230100z";
    const duplicateAuthorization = {
      ...authorization,
      authorizationHash: "c".repeat(64),
      targets: ["rss.com"],
    };
    assert.throws(
      () => store.enqueueAuthorizedJob(duplicatePacket, duplicateAuthorization),
      /already has create operation/,
    );
  });
});

test("an authorized multi-target enqueue is atomic when a later create slot conflicts", async () => {
  await withStore(async ({ store }) => {
    const { packet, authorization } = fixtures();
    store.enqueueAuthorizedJob(packet, { ...authorization, targets: ["rss.com"] });

    const duplicatePacket = structuredClone(packet);
    duplicatePacket.id = "episode-eight-multi-target-20260808t230200z";
    duplicatePacket.snapshot.targets.unshift({
      id: "vimeo",
      mode: "api",
      dependsOn: null,
      assetSha256: "2".repeat(64),
      approvedCopy: "Approved Vimeo copy",
      releasePlan: { releaseMode: "publish_now", finalVisibility: "public" },
    });
    const duplicateAuthorization = {
      ...authorization,
      authorizationHash: "d".repeat(64),
      targets: ["vimeo", "rss.com"],
    };

    assert.throws(
      () => store.enqueueAuthorizedJob(duplicatePacket, duplicateAuthorization),
      /already has create operation/,
    );
    assert.equal(store.list().length, 1);
    assert.equal(store.list()[0].platformId, "rss.com");
  });
});

test("a proven pre-write failure can release and transfer its create slot", async () => {
  await withStore(async ({ store }) => {
    const { packet, authorization } = fixtures();
    const [entry] = store.enqueueAuthorizedJob(packet, { ...authorization, targets: ["rss.com"] });
    const leased = store.leaseNext({ workerId: "worker-supersede" });
    store.completeLease(leased.operationId, {
      workerId: "worker-supersede",
      state: "blocked",
      errorCode: "credential_missing",
      errorMessage: "No provider request was made.",
    });
    const released = store.supersedeNoRemoteWrite(entry.operation.operationId, {
      reason: "The immutable authorization expired before credentials were configured.",
      evidence: "Controller event log and null provider_write_started_at prove no remote request began.",
    });
    assert.equal(released.createSlotActive, false);
    assert.equal(released.slotResolution, "superseded_no_remote_write");
    assert.throws(
      () => store.requeueBlocked(released.operationId, { reason: "Cannot reuse released authorization." }),
      /released its create slot/,
    );

    const replacementPacket = structuredClone(packet);
    replacementPacket.id = "episode-eight-replacement-20260808t230300z";
    const replacement = store.enqueueAuthorizedJob(replacementPacket, {
      ...authorization,
      authorizationHash: "f".repeat(64),
      targets: ["rss.com"],
    });
    assert.equal(replacement[0].created, true);
  });
});

test("an ambiguous or accepted provider attempt permanently retains its create slot", async () => {
  await withStore(async ({ store }) => {
    const { packet, authorization } = fixtures();
    const [entry] = store.enqueueAuthorizedJob(packet, { ...authorization, targets: ["rss.com"] });
    const leased = store.leaseNext({ workerId: "worker-ambiguous" });
    store.beginProviderWrite(leased.operationId, {
      workerId: "worker-ambiguous",
      requestSummary: "Provider create request started.",
    });
    store.completeLease(leased.operationId, {
      workerId: "worker-ambiguous",
      state: "blocked",
      errorCode: "ambiguous_provider_response",
      errorMessage: "Connection closed after request bytes were sent.",
    });
    assert.throws(
      () => store.supersedeNoRemoteWrite(entry.operation.operationId, {
        reason: "Prepare a replacement job.",
        evidence: "The remote provider was checked.",
      }),
      /after any provider write or ambiguous attempt/,
    );
    assert.throws(
      () => store.requeueBlocked(entry.operation.operationId, { reason: "Try the create again." }),
      /explicit reconciliation instead of retry/,
    );
    assert.throws(
      () => store.requeueReconciliation(entry.operation.operationId, { reason: "Search provider." }),
      /durable provider checkpoint/,
    );
    assert.equal(store.get(entry.operation.operationId).createSlotActive, true);
  });
});

test("a blocked checkpointed operation can only return through reconciliation", async () => {
  await withStore(async ({ store }) => {
    const { packet, authorization } = fixtures();
    const [entry] = store.enqueueAuthorizedJob(packet, { ...authorization, targets: ["rss.com"] });
    const leased = store.leaseNext({ workerId: "worker-reconcile" });
    store.beginProviderWrite(leased.operationId, {
      workerId: "worker-reconcile",
      requestSummary: "Create request began.",
    });
    store.recordProviderCheckpoint(leased.operationId, {
      workerId: "worker-reconcile",
      checkpoint: { phase: "episode_accepted", episodeId: "3050767" },
      providerAccepted: true,
      remoteId: "3050767",
    });
    store.completeLease(leased.operationId, {
      workerId: "worker-reconcile",
      state: "blocked",
      errorCode: "readback_mismatch",
      errorMessage: "Provider readback has not converged.",
    });
    const waiting = store.requeueReconciliation(entry.operation.operationId, {
      reason: "Provider processing completed; re-read the exact episode ID.",
    });
    assert.equal(waiting.state, "waiting");
    assert.equal(waiting.providerCheckpoint.episodeId, "3050767");
  });
});

test("operation id collisions and invalid lease completions fail closed", async () => {
  await withStore(async ({ store, directory }) => {
    const base = {
      operationId: "vimeo-episode-eight-test",
      jobId: "episode-eight-20260808t230000z",
      platformId: "vimeo",
      binding: { action: "create", episodeNumber: 8, exact: "payload" },
      authorizationHash: "b".repeat(64),
      notBefore: "2026-08-08T23:00:00.000Z",
    };
    store.enqueue(base);
    assert.throws(
      () => store.enqueue({
        ...base,
        binding: { action: "create", episodeNumber: 8, exact: "changed" },
      }),
      /collision/,
    );
    const leased = store.leaseNext({ workerId: "worker-a" });
    assert.throws(
      () => store.completeLease(leased.operationId, { workerId: "worker-b", state: "failed" }),
      /does not hold the lease/,
    );
    assert.throws(
      () => store.completeLease(leased.operationId, { workerId: "worker-a", state: "waiting" }),
      /nextAttemptAt/,
    );
    const mode = (await fs.stat(path.join(directory, "publisher.sqlite3"))).mode & 0o777;
    assert.equal(mode, 0o600);
  });
});

test("an authorized fanout cannot omit its host dependency", async () => {
  await withStore(async ({ store }) => {
    const { packet, authorization } = fixtures();
    const incomplete = { ...authorization, targets: ["apple"] };
    assert.throws(() => store.enqueueAuthorizedJob(packet, incomplete), /requires rss\.com/);
  });
});

test("only blocked operations can be explicitly requeued with an audit reason", async () => {
  await withStore(async ({ store }) => {
    const { packet, authorization } = fixtures();
    const [entry] = store.enqueueAuthorizedJob(packet, authorization);
    assert.throws(
      () => store.requeueBlocked(entry.operation.operationId, { reason: "credentials repaired" }),
      /Only a blocked operation/,
    );
    const lease = store.leaseNext({ workerId: "worker-requeue" });
    store.completeLease(lease.operationId, {
      workerId: "worker-requeue",
      state: "blocked",
      errorCode: "auth_required",
      errorMessage: "Credential is absent.",
    });
    const retried = store.requeueBlocked(lease.operationId, { reason: "Owner OAuth completed." });
    assert.equal(retried.state, "retry");
    assert.equal(retried.lastErrorCode, null);
    assert.equal(store.events(lease.operationId).at(-1).detail.reason, "Owner OAuth completed.");
  });
});

test("legacy migration backfills immutable identity, checkpoint integrity, and create slots", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "drm-control-migrate-"));
  const filePath = path.join(directory, "publisher.sqlite3");
  await createLegacyDatabase(filePath, [legacyOperation()]);
  const store = await openControlStore({ filePath });
  try {
    const migrated = store.get("vimeo-episode-eight-legacy");
    assert.equal(migrated.kind, "create");
    assert.equal(migrated.episodeNumber, 8);
    assert.equal(migrated.providerCheckpointSequence, 1);
    assert.equal(
      migrated.providerCheckpointHash,
      createHash("sha256").update(canonicalJson(migrated.providerCheckpoint)).digest("hex"),
    );
    assert.equal(migrated.createSlotActive, true);
    assert.equal(migrated.slotResolution, null);
    assert.throws(
      () => store.enqueue({
        operationId: "vimeo-episode-eight-replacement",
        jobId: "replacement-job",
        platformId: "vimeo",
        binding: { action: "create", episodeNumber: 8, exact: "replacement" },
        authorizationHash: "c".repeat(64),
      }),
      /already has create operation vimeo-episode-eight-legacy/,
    );
  } finally {
    store.close();
  }
  const { DatabaseSync } = await import("node:sqlite");
  const migratedDatabase = new DatabaseSync(filePath);
  assert.equal(migratedDatabase.prepare("PRAGMA user_version").get().user_version, 2);
  migratedDatabase.close();
  await fs.rm(directory, { recursive: true, force: true });
});

test("legacy migration rolls back rather than guessing between duplicate create slots", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "drm-control-migrate-conflict-"));
  const filePath = path.join(directory, "publisher.sqlite3");
  const first = legacyOperation();
  const second = legacyOperation({
    operationId: "vimeo-episode-eight-legacy-second",
    jobId: "legacy-job-second",
    binding: {
      ...first.binding,
      jobId: "legacy-job-second",
      approvalHash: "c".repeat(64),
    },
  });
  second.bindingHash = createHash("sha256").update(canonicalJson(second.binding)).digest("hex");
  await createLegacyDatabase(filePath, [first, second]);
  await assert.rejects(
    openControlStore({ filePath }),
    /conflicting active create operations for vimeo episode 8/,
  );

  const { DatabaseSync } = await import("node:sqlite");
  const unchanged = new DatabaseSync(filePath);
  assert.equal(unchanged.prepare("PRAGMA user_version").get().user_version, 1);
  assert.equal(
    unchanged.prepare("PRAGMA table_info(operations)").all().some((column) => column.name === "episode_number"),
    false,
  );
  unchanged.close();
  await fs.rm(directory, { recursive: true, force: true });
});

test("legacy migration rejects unclassifiable bindings and conflicting checkpoint hashes", async () => {
  for (const invalid of ["binding", "checkpoint"]) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), `drm-control-migrate-${invalid}-`));
    const filePath = path.join(directory, "publisher.sqlite3");
    const row = invalid === "binding"
      ? legacyOperation({
        kind: "publish",
        binding: { jobId: "legacy-job", episodeNumber: 8, platformId: "vimeo" },
      })
      : legacyOperation({
        providerCheckpointHash: "f".repeat(64),
        providerCheckpointSequence: 1,
      });
    row.bindingHash = createHash("sha256").update(canonicalJson(row.binding)).digest("hex");
    await createLegacyDatabase(filePath, [row]);
    await assert.rejects(
      openControlStore({ filePath }),
      invalid === "binding" ? /unclassifiable action/ : /conflicting provider checkpoint hash/,
    );
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("lease completion cannot replace a durable checkpoint remote identity", async () => {
  await withStore(async ({ store }) => {
    const { packet, authorization } = fixtures();
    const [entry] = store.enqueueAuthorizedJob(packet, { ...authorization, targets: ["rss.com"] });
    const leased = store.leaseNext({ workerId: "identity-worker" });
    store.beginProviderWrite(leased.operationId, {
      workerId: "identity-worker",
      requestSummary: "Create request began.",
    });
    store.recordProviderCheckpoint(leased.operationId, {
      workerId: "identity-worker",
      checkpoint: { phase: "episode_accepted", episodeId: "3050767" },
      providerAccepted: true,
      remoteId: "3050767",
      remoteUrl: "https://rss.com/podcasts/dr-m-experienced/3050767/",
    });
    assert.throws(
      () => store.completeLease(entry.operation.operationId, {
        workerId: "identity-worker",
        state: "verified",
        remoteId: "9999999",
        remoteUrl: "https://rss.com/podcasts/dr-m-experienced/9999999/",
      }),
      /Lease completion remote id conflicts/,
    );
    const retained = store.get(entry.operation.operationId);
    assert.equal(retained.state, "running");
    assert.equal(retained.remoteId, "3050767");
    assert.equal(retained.remoteUrl, "https://rss.com/podcasts/dr-m-experienced/3050767/");
  });
});
