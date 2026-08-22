import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { canonicalJson, publisherHome } from "./lib.mjs";

export const OPERATION_STATES = new Set([
  "queued",
  "running",
  "waiting",
  "retry",
  "verified",
  "failed",
  "blocked",
]);

const LEASABLE_STATES = ["queued", "waiting", "retry"];
const TERMINAL_STATES = new Set(["verified", "failed", "blocked"]);
const CONTROL_STORE_SCHEMA_VERSION = 2;
const OPERATION_ACTIONS = new Set(["create", "reconcile", "replace"]);

function assertTimestamp(value, label) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be an RFC 3339 timestamp.`);
  }
}

function assertOperationId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(value)) {
    throw new Error("Operation id is invalid.");
  }
}

function parseJson(value, fallback = null) {
  if (value == null) return fallback;
  return JSON.parse(value);
}

function operationFromRow(row, { redactCheckpoint = false } = {}) {
  if (!row) return null;
  const providerCheckpoint = parseJson(row.provider_checkpoint_json);
  if (providerCheckpoint != null) {
    const actualHash = createHash("sha256").update(canonicalJson(providerCheckpoint)).digest("hex");
    if (actualHash !== row.provider_checkpoint_hash) {
      throw new Error(`Provider checkpoint integrity failed for ${row.operation_id}.`);
    }
  }
  return {
    operationId: row.operation_id,
    jobId: row.job_id,
    episodeNumber: row.episode_number,
    platformId: row.platform_id,
    kind: row.kind,
    bindingHash: row.binding_hash,
    binding: parseJson(row.binding_json, {}),
    authorizationHash: row.authorization_hash,
    dependencyOperationId: row.dependency_operation_id,
    state: row.state,
    attempts: row.attempts,
    nextAttemptAt: row.next_attempt_at,
    leaseOwner: row.lease_owner,
    leaseExpiresAt: row.lease_expires_at,
    providerWriteStartedAt: row.provider_write_started_at,
    providerAcceptedAt: row.provider_accepted_at,
    providerCheckpointSequence: row.provider_checkpoint_sequence,
    providerCheckpointHash: row.provider_checkpoint_hash,
    providerCheckpoint: redactCheckpoint && providerCheckpoint
      ? { phase: providerCheckpoint.phase, redacted: true }
      : providerCheckpoint,
    remoteId: row.remote_id,
    remoteUrl: row.remote_url,
    createSlotActive: row.create_slot_active === 1,
    slotResolution: row.slot_resolution,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
    result: parseJson(row.result_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function operationKind(target) {
  return target.mode === "rss_fanout" || target.source === "rss" ? "reconcile" : "create";
}

export function operationBinding(packet, target, authorization) {
  return {
    schemaVersion: 1,
    action: operationKind(target),
    jobId: packet.id,
    approvalHash: packet.approvalHash,
    authorizationHash: authorization.authorizationHash,
    episodeNumber: packet.snapshot.manifest.episodeNumber,
    slug: packet.snapshot.manifest.slug,
    platformId: target.id,
    targetSha256: createHash("sha256").update(canonicalJson(target)).digest("hex"),
    assetSha256: target.assetSha256 || null,
    approvedCopySha256:
      target.approvedCopy == null
        ? null
        : createHash("sha256").update(target.approvedCopy, "utf8").digest("hex"),
    releasePlanSha256:
      target.releasePlan == null
        ? null
        : createHash("sha256").update(canonicalJson(target.releasePlan)).digest("hex"),
  };
}

export function deterministicOperationId(packet, target, authorization) {
  const binding = operationBinding(packet, target, authorization);
  const digest = createHash("sha256").update(canonicalJson(binding)).digest("hex").slice(0, 24);
  return `${target.id}-${packet.snapshot.manifest.slug}-${digest}`;
}

async function defaultDatabasePath(env = process.env) {
  return path.join(publisherHome(env), "control", "publisher.sqlite3");
}

async function loadSqlite() {
  try {
    return await import("node:sqlite");
  } catch (error) {
    throw new Error(
      `The publisher controller requires Node.js 22 or newer with node:sqlite (${error.code || error.message}).`,
    );
  }
}

function inTransaction(database, callback) {
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = callback();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function tableColumns(database, tableName) {
  return new Set(
    database.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name),
  );
}

function schemaVersion(database) {
  return Number(database.prepare("PRAGMA user_version").get().user_version);
}

function migrationFailure(message) {
  return new Error(`Control-store migration failed closed: ${message}`);
}

function legacyOperationClassification(row) {
  let binding;
  try {
    binding = JSON.parse(row.binding_json);
  } catch {
    throw migrationFailure(`operation ${row.operation_id} has invalid binding JSON.`);
  }
  if (!binding || typeof binding !== "object" || Array.isArray(binding)) {
    throw migrationFailure(`operation ${row.operation_id} has an invalid binding object.`);
  }
  const actualBindingHash = createHash("sha256").update(canonicalJson(binding)).digest("hex");
  if (actualBindingHash !== row.binding_hash) {
    throw migrationFailure(`operation ${row.operation_id} has a conflicting binding hash.`);
  }

  const bindingAction = OPERATION_ACTIONS.has(binding.action) ? binding.action : null;
  const storedAction = OPERATION_ACTIONS.has(row.kind) ? row.kind : null;
  if (binding.action != null && !bindingAction) {
    throw migrationFailure(`operation ${row.operation_id} has an unsupported binding action.`);
  }
  if (storedAction && bindingAction && storedAction !== bindingAction) {
    throw migrationFailure(`operation ${row.operation_id} has conflicting stored and bound actions.`);
  }
  const action = bindingAction || storedAction;
  if (!action) {
    throw migrationFailure(`operation ${row.operation_id} has an unclassifiable action.`);
  }

  const boundEpisodeNumber = Number.isSafeInteger(binding.episodeNumber) && binding.episodeNumber > 0
    ? binding.episodeNumber
    : null;
  const storedEpisodeNumber = Number.isSafeInteger(row.episode_number) && row.episode_number > 0
    ? row.episode_number
    : null;
  if (row.episode_number != null && storedEpisodeNumber == null) {
    throw migrationFailure(`operation ${row.operation_id} has an invalid stored episode number.`);
  }
  if (binding.episodeNumber != null && boundEpisodeNumber == null) {
    throw migrationFailure(`operation ${row.operation_id} has an invalid bound episode number.`);
  }
  if (storedEpisodeNumber && boundEpisodeNumber && storedEpisodeNumber !== boundEpisodeNumber) {
    throw migrationFailure(`operation ${row.operation_id} has conflicting stored and bound episode numbers.`);
  }
  const episodeNumber = boundEpisodeNumber || storedEpisodeNumber;
  if (!episodeNumber) {
    throw migrationFailure(`operation ${row.operation_id} has an unclassifiable episode number.`);
  }

  let checkpoint = null;
  let checkpointHash = null;
  let checkpointSequence = 0;
  if (row.provider_checkpoint_json != null) {
    try {
      checkpoint = JSON.parse(row.provider_checkpoint_json);
    } catch {
      throw migrationFailure(`operation ${row.operation_id} has invalid provider checkpoint JSON.`);
    }
    if (!checkpoint || typeof checkpoint !== "object" || Array.isArray(checkpoint)) {
      throw migrationFailure(`operation ${row.operation_id} has an invalid provider checkpoint object.`);
    }
    if (typeof checkpoint.phase !== "string" || !checkpoint.phase.trim()) {
      throw migrationFailure(`operation ${row.operation_id} has an unclassifiable provider checkpoint.`);
    }
    checkpointHash = createHash("sha256").update(canonicalJson(checkpoint)).digest("hex");
    if (row.provider_checkpoint_hash != null && row.provider_checkpoint_hash !== checkpointHash) {
      throw migrationFailure(`operation ${row.operation_id} has a conflicting provider checkpoint hash.`);
    }
    checkpointSequence = Number.isSafeInteger(row.provider_checkpoint_sequence) &&
      row.provider_checkpoint_sequence > 0
      ? row.provider_checkpoint_sequence
      : 1;
  } else {
    if (row.provider_checkpoint_hash != null) {
      throw migrationFailure(`operation ${row.operation_id} has a checkpoint hash without a checkpoint.`);
    }
    if (row.provider_checkpoint_sequence != null && row.provider_checkpoint_sequence !== 0) {
      throw migrationFailure(`operation ${row.operation_id} has a checkpoint sequence without a checkpoint.`);
    }
  }

  let createSlotActive = action === "create" ? 1 : 0;
  let slotResolution = action === "create" ? null : `not_applicable_${action}`;
  if (action === "create" && row.create_slot_active === 0) {
    const noProviderWrite =
      row.provider_write_started_at == null &&
      row.provider_accepted_at == null &&
      checkpoint == null &&
      row.remote_id == null &&
      row.remote_url == null;
    if (row.slot_resolution !== "superseded_no_remote_write" || !noProviderWrite) {
      throw migrationFailure(`operation ${row.operation_id} has an unsafe released create slot.`);
    }
    createSlotActive = 0;
    slotResolution = row.slot_resolution;
  } else if (action === "create" && row.slot_resolution != null) {
    throw migrationFailure(`operation ${row.operation_id} has a resolution while its create slot is active.`);
  }

  return {
    action,
    episodeNumber,
    checkpointHash,
    checkpointSequence,
    createSlotActive,
    slotResolution,
  };
}

function migrateControlStore(database) {
  const version = schemaVersion(database);
  if (!Number.isSafeInteger(version) || version < 0 || version > CONTROL_STORE_SCHEMA_VERSION) {
    throw migrationFailure(`unsupported schema version ${version}.`);
  }
  if (version === CONTROL_STORE_SCHEMA_VERSION) {
    const required = new Set([
      "episode_number",
      "provider_write_started_at",
      "provider_accepted_at",
      "provider_checkpoint_json",
      "provider_checkpoint_sequence",
      "provider_checkpoint_hash",
      "create_slot_active",
      "slot_resolution",
    ]);
    const columns = tableColumns(database, "operations");
    const missing = [...required].filter((column) => !columns.has(column));
    if (missing.length) {
      throw migrationFailure(`schema version ${version} is missing column(s): ${missing.join(", ")}.`);
    }
    return;
  }

  inTransaction(database, () => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS operations (
        operation_id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        episode_number INTEGER CHECK (episode_number IS NULL OR episode_number > 0),
        platform_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        binding_hash TEXT NOT NULL,
        binding_json TEXT NOT NULL,
        authorization_hash TEXT NOT NULL,
        dependency_operation_id TEXT REFERENCES operations(operation_id),
        state TEXT NOT NULL CHECK (state IN ('queued','running','waiting','retry','verified','failed','blocked')),
        attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
        next_attempt_at TEXT NOT NULL,
        lease_owner TEXT,
        lease_expires_at TEXT,
        provider_write_started_at TEXT,
        provider_accepted_at TEXT,
        provider_checkpoint_json TEXT,
        provider_checkpoint_sequence INTEGER NOT NULL DEFAULT 0 CHECK (provider_checkpoint_sequence >= 0),
        provider_checkpoint_hash TEXT,
        remote_id TEXT,
        remote_url TEXT,
        create_slot_active INTEGER NOT NULL DEFAULT 1 CHECK (create_slot_active IN (0, 1)),
        slot_resolution TEXT,
        last_error_code TEXT,
        last_error_message TEXT,
        result_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (job_id, platform_id, binding_hash)
      );
      CREATE TABLE IF NOT EXISTS operation_events (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation_id TEXT NOT NULL REFERENCES operations(operation_id),
        from_state TEXT,
        to_state TEXT NOT NULL,
        recorded_at TEXT NOT NULL,
        detail_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS operation_events_operation_idx
        ON operation_events(operation_id, event_id);
      DROP INDEX IF EXISTS operations_create_episode_idx;
    `);
    const columns = tableColumns(database, "operations");
    const additions = [
      ["episode_number", "episode_number INTEGER CHECK (episode_number IS NULL OR episode_number > 0)"],
      ["provider_write_started_at", "provider_write_started_at TEXT"],
      ["provider_accepted_at", "provider_accepted_at TEXT"],
      ["provider_checkpoint_json", "provider_checkpoint_json TEXT"],
      ["provider_checkpoint_sequence", "provider_checkpoint_sequence INTEGER NOT NULL DEFAULT 0 CHECK (provider_checkpoint_sequence >= 0)"],
      ["provider_checkpoint_hash", "provider_checkpoint_hash TEXT"],
      ["create_slot_active", "create_slot_active INTEGER NOT NULL DEFAULT 1 CHECK (create_slot_active IN (0, 1))"],
      ["slot_resolution", "slot_resolution TEXT"],
    ];
    for (const [name, definition] of additions) {
      if (!columns.has(name)) database.exec(`ALTER TABLE operations ADD COLUMN ${definition}`);
    }

    const rows = database.prepare("SELECT * FROM operations ORDER BY operation_id").all();
    const update = database.prepare(`
      UPDATE operations
      SET kind = ?, episode_number = ?, provider_checkpoint_sequence = ?,
          provider_checkpoint_hash = ?, create_slot_active = ?, slot_resolution = ?
      WHERE operation_id = ?
    `);
    for (const row of rows) {
      const classified = legacyOperationClassification(row);
      update.run(
        classified.action,
        classified.episodeNumber,
        classified.checkpointSequence,
        classified.checkpointHash,
        classified.createSlotActive,
        classified.slotResolution,
        row.operation_id,
      );
    }

    const conflicts = database.prepare(`
      SELECT platform_id, episode_number, GROUP_CONCAT(operation_id, ',') AS operation_ids
      FROM operations
      WHERE kind = 'create' AND create_slot_active = 1
      GROUP BY platform_id, episode_number
      HAVING COUNT(*) > 1
      ORDER BY platform_id, episode_number
    `).all();
    if (conflicts.length) {
      const conflict = conflicts[0];
      throw migrationFailure(
        `conflicting active create operations for ${conflict.platform_id} episode ` +
          `${conflict.episode_number}: ${conflict.operation_ids}.`,
      );
    }
    database.exec(`
      CREATE INDEX IF NOT EXISTS operations_due_idx
        ON operations(state, next_attempt_at, created_at);
      CREATE UNIQUE INDEX operations_create_episode_idx
        ON operations(platform_id, episode_number)
        WHERE kind = 'create' AND create_slot_active = 1;
      PRAGMA user_version = ${CONTROL_STORE_SCHEMA_VERSION};
    `);
  });
}

export async function openControlStore({ filePath, env = process.env, now = () => new Date() } = {}) {
  const resolvedPath = path.resolve(filePath || (await defaultDatabasePath(env)));
  const directory = path.dirname(resolvedPath);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.chmod(directory, 0o700);

  const { DatabaseSync } = await loadSqlite();
  const database = new DatabaseSync(resolvedPath);
  database.exec("PRAGMA journal_mode=WAL");
  database.exec("PRAGMA synchronous=FULL");
  database.exec("PRAGMA foreign_keys=ON");
  database.exec("PRAGMA busy_timeout=5000");
  try {
    migrateControlStore(database);
  } catch (error) {
    database.close();
    throw error;
  }
  await fs.chmod(resolvedPath, 0o600);

  const insertOperation = database.prepare(`
    INSERT OR IGNORE INTO operations (
      operation_id, job_id, episode_number, platform_id, kind, binding_hash, binding_json,
      authorization_hash, dependency_operation_id, state, next_attempt_at, create_slot_active,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?)
  `);
  const selectOperation = database.prepare("SELECT * FROM operations WHERE operation_id = ?");
  const selectCreateSlot = database.prepare(
    "SELECT * FROM operations WHERE platform_id = ? AND episode_number = ? AND kind = 'create' AND create_slot_active = 1",
  );
  const insertEvent = database.prepare(`
    INSERT INTO operation_events(operation_id, from_state, to_state, recorded_at, detail_json)
    VALUES (?, ?, ?, ?, ?)
  `);

  function timestamp() {
    const value = now().toISOString();
    assertTimestamp(value, "Clock value");
    return value;
  }

  function enqueueWithoutTransaction({
    operationId,
    jobId,
    platformId,
    kind = null,
    binding,
    authorizationHash,
    dependencyOperationId = null,
    notBefore = timestamp(),
  }) {
    assertOperationId(operationId);
    if (!jobId || !platformId || !authorizationHash) throw new Error("Queued operation identity is incomplete.");
    assertTimestamp(notBefore, "notBefore");
    const resolvedKind = kind ?? binding?.action ?? "create";
    if (!OPERATION_ACTIONS.has(resolvedKind)) {
      throw new Error("Queued operation action must be create, reconcile, or replace.");
    }
    if (binding?.action != null && binding.action !== resolvedKind) {
      throw new Error("Queued operation action conflicts with its immutable binding.");
    }
    const bindingJson = canonicalJson(binding);
    const bindingHash = createHash("sha256").update(bindingJson).digest("hex");
    const episodeNumber = Number.isSafeInteger(binding?.episodeNumber) ? binding.episodeNumber : null;
    if (!episodeNumber || episodeNumber < 1) {
      throw new Error("Queued operation requires a positive bound episode number.");
    }
    const createdAt = timestamp();
    const result = insertOperation.run(
      operationId,
      jobId,
      episodeNumber,
      platformId,
      resolvedKind,
      bindingHash,
      bindingJson,
      authorizationHash,
      dependencyOperationId,
      notBefore,
      resolvedKind === "create" ? 1 : 0,
      createdAt,
      createdAt,
    );
    const stored = operationFromRow(selectOperation.get(operationId));
    if (!stored) {
      const occupied = resolvedKind === "create" && episodeNumber != null
        ? operationFromRow(selectCreateSlot.get(platformId, episodeNumber))
        : null;
      if (occupied) {
        throw new Error(
          `${platformId} episode ${episodeNumber} already has create operation ${occupied.operationId}; ` +
            "retry or explicitly resolve that operation instead of creating another job.",
        );
      }
      throw new Error("Queued operation could not be read back.");
    }
    if (
      stored.jobId !== jobId ||
      stored.episodeNumber !== episodeNumber ||
      stored.platformId !== platformId ||
      stored.kind !== resolvedKind ||
      stored.bindingHash !== bindingHash ||
      stored.authorizationHash !== authorizationHash ||
      stored.dependencyOperationId !== dependencyOperationId
    ) {
      throw new Error(`Operation id collision for ${operationId}.`);
    }
    if (result.changes === 1) {
      insertEvent.run(operationId, null, "queued", createdAt, canonicalJson({ reason: "enqueued" }));
    }
    return { operation: stored, created: result.changes === 1 };
  }

  function enqueue(options) {
    return inTransaction(database, () => enqueueWithoutTransaction(options));
  }

  function enqueueAuthorizedJob(packet, authorization) {
    const authorizedIds = authorization.targets;
    const targets = authorizedIds.map((platformId) => {
      const target = packet.snapshot.targets.find((candidate) => candidate.id === platformId);
      if (!target) throw new Error(`Authorized target ${platformId} is missing from the packet.`);
      return target;
    });
    const operationIds = new Map(
      targets.map((target) => [target.id, deterministicOperationId(packet, target, authorization)]),
    );
    const byId = new Map(targets.map((target) => [target.id, target]));
    for (const target of targets) {
      if (target.dependsOn && !byId.has(target.dependsOn)) {
        throw new Error(`Authorized target ${target.id} requires ${target.dependsOn} in the same release.`);
      }
    }
    const ordered = [];
    const visiting = new Set();
    const visited = new Set();
    const visit = (target) => {
      if (visited.has(target.id)) return;
      if (visiting.has(target.id)) throw new Error(`Release dependency cycle includes ${target.id}.`);
      visiting.add(target.id);
      if (target.dependsOn) visit(byId.get(target.dependsOn));
      visiting.delete(target.id);
      visited.add(target.id);
      ordered.push(target);
    };
    for (const target of targets) visit(target);

    return inTransaction(database, () => ordered.map((target) =>
      enqueueWithoutTransaction({
        operationId: operationIds.get(target.id),
        jobId: packet.id,
        platformId: target.id,
        kind: operationKind(target),
        binding: operationBinding(packet, target, authorization),
        authorizationHash: authorization.authorizationHash,
        dependencyOperationId: target.dependsOn ? operationIds.get(target.dependsOn) || null : null,
        notBefore: timestamp(),
      }),
    ));
  }

  function recoverExpiredLeases(at = timestamp()) {
    assertTimestamp(at, "Recovery time");
    return inTransaction(database, () => {
      const expired = database
        .prepare("SELECT * FROM operations WHERE state = 'running' AND lease_expires_at <= ?")
        .all(at);
      const update = database.prepare(`
        UPDATE operations
        SET state = ?, next_attempt_at = ?, lease_owner = NULL, lease_expires_at = NULL,
            last_error_code = ?, last_error_message = ?,
            updated_at = ?
        WHERE operation_id = ? AND state = 'running'
      `);
      for (const row of expired) {
        const providerWriteStarted = row.provider_write_started_at != null;
        const nextState = providerWriteStarted ? "waiting" : "retry";
        const errorCode = providerWriteStarted ? "provider_reconciliation_required" : "lease_expired";
        const errorMessage = providerWriteStarted
          ? "Worker lease expired after provider write intent; reconcile the durable provider checkpoint before continuing."
          : "Worker lease expired before any provider write began.";
        update.run(nextState, at, errorCode, errorMessage, at, row.operation_id);
        insertEvent.run(
          row.operation_id,
          "running",
          nextState,
          at,
          canonicalJson({
            reason: errorCode,
            previousLeaseOwner: row.lease_owner,
            providerCheckpointPresent: row.provider_checkpoint_json != null,
          }),
        );
      }
      return expired.length;
    });
  }

  function renewLease(
    operationId,
    { workerId, leaseMs = 5 * 60_000, at = timestamp() } = {},
  ) {
    assertOperationId(operationId);
    if (typeof workerId !== "string" || !workerId.trim()) throw new Error("workerId is required.");
    if (!Number.isInteger(leaseMs) || leaseMs < 1_000) throw new Error("leaseMs must be at least 1000.");
    assertTimestamp(at, "Lease renewal time");
    const expiresAt = new Date(Date.parse(at) + leaseMs).toISOString();
    const result = database
      .prepare(`
        UPDATE operations
        SET lease_expires_at = ?, updated_at = ?
        WHERE operation_id = ? AND state = 'running' AND lease_owner = ?
      `)
      .run(expiresAt, at, operationId, workerId);
    if (result.changes !== 1) {
      throw new Error(`Worker ${workerId} cannot renew lease ${operationId}.`);
    }
    return operationFromRow(selectOperation.get(operationId));
  }

  function leaseNext({ workerId = randomUUID(), leaseMs = 5 * 60_000, at = timestamp() } = {}) {
    if (!workerId.trim()) throw new Error("workerId is required.");
    if (!Number.isInteger(leaseMs) || leaseMs < 1_000) throw new Error("leaseMs must be at least 1000.");
    assertTimestamp(at, "Lease time");
    const expiresAt = new Date(Date.parse(at) + leaseMs).toISOString();
    return inTransaction(database, () => {
      const placeholders = LEASABLE_STATES.map(() => "?").join(",");
      const row = database
        .prepare(`
          SELECT candidate.*
          FROM operations candidate
          LEFT JOIN operations dependency
            ON dependency.operation_id = candidate.dependency_operation_id
          WHERE candidate.state IN (${placeholders})
            AND candidate.next_attempt_at <= ?
            AND (candidate.dependency_operation_id IS NULL OR dependency.state = 'verified')
          ORDER BY candidate.next_attempt_at, candidate.created_at, candidate.operation_id
          LIMIT 1
        `)
        .get(...LEASABLE_STATES, at);
      if (!row) return null;
      const result = database
        .prepare(`
          UPDATE operations
          SET state = 'running', attempts = attempts + 1, lease_owner = ?, lease_expires_at = ?, updated_at = ?
          WHERE operation_id = ? AND state = ?
        `)
        .run(workerId, expiresAt, at, row.operation_id, row.state);
      if (result.changes !== 1) return null;
      insertEvent.run(
        row.operation_id,
        row.state,
        "running",
        at,
        canonicalJson({ workerId, leaseExpiresAt: expiresAt }),
      );
      return operationFromRow(selectOperation.get(row.operation_id));
    });
  }

  function beginProviderWrite(
    operationId,
    {
      workerId,
      at = timestamp(),
      requestSummary = "Provider write is beginning.",
      buildCommit = null,
    } = {},
  ) {
    assertOperationId(operationId);
    if (typeof workerId !== "string" || !workerId.trim()) throw new Error("workerId is required.");
    if (typeof requestSummary !== "string" || !requestSummary.trim()) {
      throw new Error("A provider write summary is required.");
    }
    if (buildCommit != null && !/^[a-f0-9]{40}$/.test(buildCommit)) {
      throw new Error("buildCommit must be a full lowercase Git commit SHA.");
    }
    assertTimestamp(at, "Provider write time");
    return inTransaction(database, () => {
      const current = operationFromRow(selectOperation.get(operationId));
      if (!current) throw new Error(`Unknown operation: ${operationId}`);
      if (current.state !== "running" || current.leaseOwner !== workerId) {
        throw new Error(`Worker ${workerId} does not hold the lease for ${operationId}.`);
      }
      if (current.providerWriteStartedAt) return current;
      database
        .prepare(`
          UPDATE operations
          SET provider_write_started_at = ?, updated_at = ?
          WHERE operation_id = ? AND state = 'running' AND lease_owner = ?
        `)
        .run(at, at, operationId, workerId);
      insertEvent.run(
        operationId,
        "running",
        "running",
        at,
        canonicalJson({
          reason: "provider_write_intent",
          requestSummary: requestSummary.trim(),
          buildCommit,
        }),
      );
      return operationFromRow(selectOperation.get(operationId));
    });
  }

  function recordProviderCheckpoint(
    operationId,
    {
      workerId,
      checkpoint,
      providerAccepted = false,
      remoteId = null,
      remoteUrl = null,
      at = timestamp(),
    } = {},
  ) {
    assertOperationId(operationId);
    if (typeof workerId !== "string" || !workerId.trim()) throw new Error("workerId is required.");
    if (!checkpoint || typeof checkpoint !== "object" || Array.isArray(checkpoint)) {
      throw new Error("A provider checkpoint object is required.");
    }
    if (typeof checkpoint.phase !== "string" || !checkpoint.phase.trim()) {
      throw new Error("Provider checkpoint phase is required.");
    }
    assertTimestamp(at, "Provider checkpoint time");
    return inTransaction(database, () => {
      const current = operationFromRow(selectOperation.get(operationId));
      if (!current) throw new Error(`Unknown operation: ${operationId}`);
      if (current.state !== "running" || current.leaseOwner !== workerId) {
        throw new Error(`Worker ${workerId} does not hold the lease for ${operationId}.`);
      }
      if (!current.providerWriteStartedAt) {
        throw new Error("Provider write intent must be recorded before a provider checkpoint.");
      }
      if (current.remoteId && remoteId && current.remoteId !== remoteId) {
        throw new Error(`Provider checkpoint remote id conflicts for ${operationId}.`);
      }
      if (current.remoteUrl && remoteUrl && current.remoteUrl !== remoteUrl) {
        throw new Error(`Provider checkpoint remote URL conflicts for ${operationId}.`);
      }
      const acceptedAt = providerAccepted ? current.providerAcceptedAt || at : current.providerAcceptedAt;
      const checkpointJson = canonicalJson(checkpoint);
      const checkpointHash = createHash("sha256").update(checkpointJson).digest("hex");
      const checkpointSequence = current.providerCheckpointSequence + 1;
      database
        .prepare(`
          UPDATE operations
          SET provider_checkpoint_json = ?, provider_checkpoint_sequence = ?, provider_checkpoint_hash = ?,
              provider_accepted_at = ?,
              remote_id = COALESCE(?, remote_id), remote_url = COALESCE(?, remote_url), updated_at = ?
          WHERE operation_id = ? AND state = 'running' AND lease_owner = ?
        `)
        .run(
          checkpointJson,
          checkpointSequence,
          checkpointHash,
          acceptedAt,
          remoteId,
          remoteUrl,
          at,
          operationId,
          workerId,
        );
      insertEvent.run(
        operationId,
        "running",
        "running",
        at,
        canonicalJson({
          reason: "provider_checkpoint",
          phase: checkpoint.phase,
          sequence: checkpointSequence,
          providerAccepted,
          remoteId,
          remoteUrl,
        }),
      );
      return operationFromRow(selectOperation.get(operationId));
    });
  }

  function completeLease(
    operationId,
    {
      workerId,
      state,
      at = timestamp(),
      nextAttemptAt = null,
      remoteId = null,
      remoteUrl = null,
      errorCode = null,
      errorMessage = null,
      result = null,
    },
  ) {
    assertOperationId(operationId);
    if (!OPERATION_STATES.has(state) || state === "running" || state === "queued") {
      throw new Error(`Invalid post-lease state: ${state}`);
    }
    assertTimestamp(at, "Completion time");
    if (["waiting", "retry"].includes(state)) {
      assertTimestamp(nextAttemptAt, "nextAttemptAt");
    } else if (nextAttemptAt != null) {
      throw new Error(`${state} cannot have nextAttemptAt.`);
    }
    return inTransaction(database, () => {
      const current = operationFromRow(selectOperation.get(operationId));
      if (!current) throw new Error(`Unknown operation: ${operationId}`);
      if (current.state !== "running" || current.leaseOwner !== workerId) {
        throw new Error(`Worker ${workerId} does not hold the lease for ${operationId}.`);
      }
      if (current.remoteId && remoteId && current.remoteId !== remoteId) {
        throw new Error(`Lease completion remote id conflicts for ${operationId}.`);
      }
      if (current.remoteUrl && remoteUrl && current.remoteUrl !== remoteUrl) {
        throw new Error(`Lease completion remote URL conflicts for ${operationId}.`);
      }
      database
        .prepare(`
          UPDATE operations
          SET state = ?, next_attempt_at = ?, lease_owner = NULL, lease_expires_at = NULL,
              remote_id = COALESCE(?, remote_id), remote_url = COALESCE(?, remote_url),
              last_error_code = ?, last_error_message = ?, result_json = ?, updated_at = ?
          WHERE operation_id = ?
        `)
        .run(
          state,
          nextAttemptAt || at,
          remoteId,
          remoteUrl,
          errorCode,
          errorMessage,
          result == null ? null : canonicalJson(result),
          at,
          operationId,
        );
      insertEvent.run(
        operationId,
        "running",
        state,
        at,
        canonicalJson({ remoteId, remoteUrl, errorCode, errorMessage, nextAttemptAt }),
      );
      return operationFromRow(selectOperation.get(operationId));
    });
  }

  function get(operationId) {
    assertOperationId(operationId);
    return operationFromRow(selectOperation.get(operationId));
  }

  function list({ jobId = null, states = [] } = {}) {
    for (const state of states) {
      if (!OPERATION_STATES.has(state)) throw new Error(`Unknown operation state: ${state}`);
    }
    const clauses = [];
    const values = [];
    if (jobId) {
      clauses.push("job_id = ?");
      values.push(jobId);
    }
    if (states.length) {
      clauses.push(`state IN (${states.map(() => "?").join(",")})`);
      values.push(...states);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    return database
      .prepare(`SELECT * FROM operations ${where} ORDER BY created_at, operation_id`)
      .all(...values)
      .map((row) => operationFromRow(row, { redactCheckpoint: true }));
  }

  function events(operationId) {
    assertOperationId(operationId);
    return database
      .prepare("SELECT * FROM operation_events WHERE operation_id = ? ORDER BY event_id")
      .all(operationId)
      .map((row) => ({
        eventId: row.event_id,
        operationId: row.operation_id,
        fromState: row.from_state,
        toState: row.to_state,
        recordedAt: row.recorded_at,
        detail: parseJson(row.detail_json, {}),
      }));
  }

  function requeueBlocked(operationId, { reason, at = timestamp() } = {}) {
    assertOperationId(operationId);
    if (typeof reason !== "string" || !reason.trim()) {
      throw new Error("A retry reason is required.");
    }
    assertTimestamp(at, "Retry time");
    return inTransaction(database, () => {
      const current = operationFromRow(selectOperation.get(operationId));
      if (!current) throw new Error(`Unknown operation: ${operationId}`);
      if (current.state !== "blocked") {
        throw new Error(`Only a blocked operation can be requeued; ${operationId} is ${current.state}.`);
      }
      if (!current.createSlotActive) {
        throw new Error(`Operation ${operationId} released its create slot and cannot be requeued.`);
      }
      if (current.providerWriteStartedAt) {
        throw new Error(
          `Operation ${operationId} touched its provider; use explicit reconciliation instead of retry.`,
        );
      }
      database
        .prepare(`
          UPDATE operations
          SET state = 'retry', next_attempt_at = ?, lease_owner = NULL, lease_expires_at = NULL,
              last_error_code = NULL, last_error_message = NULL, updated_at = ?
          WHERE operation_id = ? AND state = 'blocked'
        `)
        .run(at, at, operationId);
      insertEvent.run(
        operationId,
        "blocked",
        "retry",
        at,
        canonicalJson({ reason: reason.trim() }),
      );
      return operationFromRow(selectOperation.get(operationId));
    });
  }

  function requeueReconciliation(operationId, { reason, at = timestamp() } = {}) {
    assertOperationId(operationId);
    if (typeof reason !== "string" || !reason.trim()) {
      throw new Error("A reconciliation reason is required.");
    }
    assertTimestamp(at, "Reconciliation time");
    return inTransaction(database, () => {
      const current = operationFromRow(selectOperation.get(operationId));
      if (!current) throw new Error(`Unknown operation: ${operationId}`);
      if (current.state !== "blocked") {
        throw new Error(`Only a blocked operation can be reconciled; ${operationId} is ${current.state}.`);
      }
      if (!current.providerWriteStartedAt || !current.providerCheckpoint) {
        throw new Error("Reconciliation requires a durable provider checkpoint; blind replay remains blocked.");
      }
      database
        .prepare(`
          UPDATE operations
          SET state = 'waiting', next_attempt_at = ?, lease_owner = NULL, lease_expires_at = NULL,
              last_error_code = NULL, last_error_message = NULL, updated_at = ?
          WHERE operation_id = ? AND state = 'blocked'
        `)
        .run(at, at, operationId);
      insertEvent.run(
        operationId,
        "blocked",
        "waiting",
        at,
        canonicalJson({ reason: reason.trim(), action: "reconcile_exact_provider_checkpoint" }),
      );
      return operationFromRow(selectOperation.get(operationId));
    });
  }

  function supersedeNoRemoteWrite(
    operationId,
    { reason, evidence, at = timestamp() } = {},
  ) {
    assertOperationId(operationId);
    if (typeof reason !== "string" || !reason.trim()) throw new Error("A supersede reason is required.");
    if (typeof evidence !== "string" || !evidence.trim()) {
      throw new Error("Evidence that no remote write occurred is required.");
    }
    assertTimestamp(at, "Supersede time");
    return inTransaction(database, () => {
      const current = operationFromRow(selectOperation.get(operationId));
      if (!current) throw new Error(`Unknown operation: ${operationId}`);
      if (current.kind !== "create" || !current.createSlotActive) {
        throw new Error(`Operation ${operationId} does not hold an active create slot.`);
      }
      if (!["blocked", "failed"].includes(current.state)) {
        throw new Error("Only a blocked or failed create operation can release its slot.");
      }
      if (
        current.providerWriteStartedAt ||
        current.providerCheckpoint ||
        current.providerAcceptedAt ||
        current.remoteId ||
        current.remoteUrl
      ) {
        throw new Error("A create slot cannot be released after any provider write or ambiguous attempt.");
      }
      const resolution = "superseded_no_remote_write";
      database
        .prepare(`
          UPDATE operations
          SET create_slot_active = 0, slot_resolution = ?, updated_at = ?
          WHERE operation_id = ? AND create_slot_active = 1
        `)
        .run(resolution, at, operationId);
      insertEvent.run(
        operationId,
        current.state,
        current.state,
        at,
        canonicalJson({ resolution, reason: reason.trim(), evidence: evidence.trim() }),
      );
      return operationFromRow(selectOperation.get(operationId));
    });
  }

  function close() {
    database.close();
  }

  return {
    path: resolvedPath,
    enqueue,
    enqueueAuthorizedJob,
    recoverExpiredLeases,
    renewLease,
    leaseNext,
    beginProviderWrite,
    recordProviderCheckpoint,
    completeLease,
    get,
    list,
    events,
    requeueBlocked,
    requeueReconciliation,
    supersedeNoRemoteWrite,
    close,
  };
}

export function isTerminalOperationState(state) {
  return TERMINAL_STATES.has(state);
}
