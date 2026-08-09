#!/usr/bin/env node

import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  findEpisode,
  loadCatalog,
  manifestCatalogProblems,
} from "./catalog.mjs";
import {
  publisherHome,
  validateManifest,
  writePrivateJson,
  writePrivateText,
} from "./lib.mjs";

const execFileAsync = promisify(execFile);
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PROJECT_ROOT = path.resolve(moduleDirectory, "../..");
const DEFAULT_INBOX = "/home/otto/Dropbox/Dr M Experienced/publisher-inbox";
const DELIVERY_FILE = "delivery.json";
const MANIFEST_FILE = "episode.json";
const READY_FILE = "READY";
const READY_CONTENT = "drm-publisher-delivery-v1\n";
const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const JOB_ID = /^[a-z0-9][a-z0-9-]*$/;
const ASSET_EXTENSIONS = Object.freeze({
  fullVideo: new Set([".mp4", ".mov"]),
  podcastAudio: new Set([".mp3", ".m4a", ".wav"]),
  instagramReel: new Set([".mp4", ".mov"]),
  thumbnail: new Set([".jpg", ".jpeg", ".png", ".webp"]),
  captions: new Set([".srt", ".vtt"]),
});
const MAX_JSON_BYTES = 512 * 1024;
const schema = JSON.parse(
  await fs.readFile(new URL("../../publishing/dropbox-delivery.schema.json", import.meta.url), "utf8"),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv, { mode: "full" });
const validateDeliverySchema = ajv.compile(schema);

export class DropboxIntakeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DropboxIntakeError";
    this.code = code;
  }
}

function intakeError(code, message) {
  throw new DropboxIntakeError(code, message);
}

function schemaProblem(error) {
  const location = error.instancePath || "/";
  return `${location} ${error.message}`;
}

function assertSafeId(value, label) {
  if (typeof value !== "string" || value.length > 100 || !SAFE_ID.test(value)) {
    intakeError("invalid_identifier", `${label} must be a lowercase hyphenated identifier.`);
  }
  return value;
}

function assertSafeFileName(value, label) {
  if (typeof value !== "string" || !SAFE_FILE.test(value)) {
    intakeError("invalid_filename", `${label} must be one plain filename without directories.`);
  }
  return value;
}

function assertSecureStats(stats, expectedType, label) {
  const isExpected = expectedType === "directory" ? stats.isDirectory() : stats.isFile();
  if (!isExpected || stats.isSymbolicLink()) {
    intakeError("insecure_input", `${label} must be a regular ${expectedType}.`);
  }
  if ((Number(stats.mode) & 0o022) !== 0) {
    intakeError("insecure_input", `${label} must not be writable by group or other users.`);
  }
  if (typeof process.getuid === "function" && Number(stats.uid) !== process.getuid()) {
    intakeError("insecure_input", `${label} must be owned by the publisher user.`);
  }
  if (expectedType === "file" && Number(stats.nlink) !== 1) {
    intakeError("insecure_input", `${label} must not be hard-linked.`);
  }
}

async function assertSecureDirectory(directory, label) {
  let stats;
  try {
    stats = await fs.lstat(directory, { bigint: true });
  } catch (error) {
    if (error.code === "ENOENT") intakeError("missing_directory", `${label} does not exist.`);
    throw error;
  }
  assertSecureStats(stats, "directory", label);
}

function sameFile(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

async function inspectSecureFile(filePath, { expectedSize = null, expectedSha256 = null, capture = false, label }) {
  let handle;
  try {
    handle = await fs.open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  } catch (error) {
    if (["ELOOP", "ENOENT"].includes(error.code)) {
      intakeError("insecure_input", `${label} is missing or is a symbolic link.`);
    }
    throw error;
  }

  try {
    const before = await handle.stat({ bigint: true });
    assertSecureStats(before, "file", label);
    if (before.size > BigInt(Number.MAX_SAFE_INTEGER)) {
      intakeError("file_too_large", `${label} is too large to represent safely.`);
    }
    const sizeBytes = Number(before.size);
    if (expectedSize != null && sizeBytes !== expectedSize) {
      intakeError("size_mismatch", `${label} byte size does not match delivery.json.`);
    }
    if (capture && sizeBytes > MAX_JSON_BYTES) {
      intakeError("file_too_large", `${label} exceeds the intake metadata size limit.`);
    }

    const digest = createHash("sha256");
    const chunks = [];
    let bytesRead = 0;
    const stream = handle.createReadStream({ autoClose: false });
    for await (const chunk of stream) {
      digest.update(chunk);
      bytesRead += chunk.length;
      if (capture) chunks.push(chunk);
    }
    const after = await handle.stat({ bigint: true });
    if (!sameFile(before, after) || bytesRead !== sizeBytes) {
      intakeError("file_changed_during_scan", `${label} changed while it was being verified.`);
    }
    const sha256 = digest.digest("hex");
    if (expectedSha256 != null && sha256 !== expectedSha256) {
      intakeError("hash_mismatch", `${label} SHA-256 does not match delivery.json.`);
    }
    return {
      sha256,
      sizeBytes,
      content: capture ? Buffer.concat(chunks).toString("utf8") : null,
    };
  } finally {
    await handle.close();
  }
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch {
    intakeError("invalid_json", `${label} is not valid JSON.`);
  }
}

function assertNoRumble(manifest) {
  if (manifest.targets?.includes("rumble")) {
    intakeError("rumble_forbidden", "Automated Dropbox intake cannot include Rumble.");
  }
}

function manifestAssetEntries(manifest) {
  return Object.entries(manifest.assets ?? {}).filter(([, value]) => value != null);
}

function assertManifestBinding(envelope, manifest) {
  if (manifest.episodeNumber !== envelope.episodeNumber || manifest.slug !== envelope.episodeSlug) {
    intakeError(
      "episode_identity_mismatch",
      "Episode identity must match explicitly between delivery.json and episode.json.",
    );
  }
  const declaredAssets = Object.entries(envelope.assets).sort(([left], [right]) => left.localeCompare(right));
  const manifestAssets = manifestAssetEntries(manifest).sort(([left], [right]) => left.localeCompare(right));
  if (
    declaredAssets.length !== manifestAssets.length ||
    declaredAssets.some(([role], index) => role !== manifestAssets[index]?.[0])
  ) {
    intakeError("asset_set_mismatch", "delivery.json and episode.json must declare the same asset roles.");
  }
  for (const [role, record] of declaredAssets) {
    const filename = assertSafeFileName(record.file, `assets.${role}.file`);
    if (manifest.assets[role] !== filename) {
      intakeError("asset_path_mismatch", `${role} must use the same plain filename in both metadata files.`);
    }
    const extension = path.extname(filename).toLowerCase();
    if (!ASSET_EXTENSIONS[role]?.has(extension)) {
      intakeError("asset_extension_invalid", `${role} does not use an allowed media extension.`);
    }
  }
}

async function assertCatalogBinding(manifest, catalogPath) {
  const catalog = await loadCatalog(catalogPath);
  const episode = findEpisode(catalog, manifest.episodeNumber);
  if (!episode) {
    intakeError(
      "catalog_episode_missing",
      "The explicitly selected episode is not registered in the master catalog.",
    );
  }
  const problems = manifestCatalogProblems(manifest, episode);
  if (problems.length) {
    intakeError("catalog_metadata_mismatch", "Episode metadata does not match the master catalog.");
  }
}

async function readEnvelope(bundleDirectory) {
  const inspected = await inspectSecureFile(path.join(bundleDirectory, DELIVERY_FILE), {
    capture: true,
    label: DELIVERY_FILE,
  });
  const envelope = parseJson(inspected.content, DELIVERY_FILE);
  if (!validateDeliverySchema(envelope)) {
    const detail = (validateDeliverySchema.errors ?? []).map(schemaProblem).join("; ");
    intakeError("delivery_schema_invalid", `delivery.json does not match schema: ${detail}`);
  }
  return { envelope, envelopeSha256: inspected.sha256 };
}

async function assertExactBundleEntries(bundleDirectory, envelope) {
  const expected = new Set([
    DELIVERY_FILE,
    READY_FILE,
    envelope.manifest.file,
    ...Object.values(envelope.assets).map((asset) => asset.file),
  ]);
  if (expected.size !== 3 + Object.keys(envelope.assets).length) {
    intakeError("filename_collision", "Every delivery file must have a unique filename.");
  }
  const entries = await fs.readdir(bundleDirectory, { withFileTypes: true });
  if (entries.length !== expected.size || entries.some((entry) => !entry.isFile() || !expected.has(entry.name))) {
    intakeError("undeclared_bundle_entry", "The bundle contains missing, nested, or undeclared entries.");
  }
}

export async function validateDeliveryBundle(bundleDirectory, {
  catalogPath = path.join(DEFAULT_PROJECT_ROOT, "publishing", "master-catalog.json"),
} = {}) {
  const directory = path.resolve(bundleDirectory);
  const deliveryId = assertSafeId(path.basename(directory), "Bundle directory name");
  await assertSecureDirectory(directory, "Delivery bundle");
  const ready = await inspectSecureFile(path.join(directory, READY_FILE), {
    capture: true,
    label: READY_FILE,
  });
  if (ready.content !== READY_CONTENT) {
    intakeError("ready_marker_invalid", "READY has invalid content.");
  }

  const { envelope, envelopeSha256 } = await readEnvelope(directory);
  if (envelope.deliveryId !== deliveryId) {
    intakeError("delivery_id_mismatch", "deliveryId must exactly match the bundle directory name.");
  }
  await assertExactBundleEntries(directory, envelope);

  const manifestResult = await inspectSecureFile(path.join(directory, envelope.manifest.file), {
    expectedSize: envelope.manifest.sizeBytes,
    expectedSha256: envelope.manifest.sha256,
    capture: true,
    label: MANIFEST_FILE,
  });
  const manifest = parseJson(manifestResult.content, MANIFEST_FILE);
  const manifestValidation = validateManifest(manifest);
  if (manifestValidation.errors.length) {
    intakeError("episode_manifest_invalid", "episode.json does not satisfy the publishing manifest contract.");
  }
  assertNoRumble(manifest);
  assertManifestBinding(envelope, manifest);

  for (const [role, record] of Object.entries(envelope.assets)) {
    await inspectSecureFile(path.join(directory, record.file), {
      expectedSize: record.sizeBytes,
      expectedSha256: record.sha256,
      label: role,
    });
  }
  await assertCatalogBinding(manifest, catalogPath);
  return Object.freeze({
    deliveryId,
    envelopeSha256,
    episodeNumber: manifest.episodeNumber,
    episodeSlug: manifest.slug,
    manifestPath: path.join(directory, MANIFEST_FILE),
    manifestSha256: manifestResult.sha256,
  });
}

async function fileRecord(bundleDirectory, filename, label) {
  const inspected = await inspectSecureFile(path.join(bundleDirectory, filename), { label });
  return { file: filename, sha256: inspected.sha256, sizeBytes: inspected.sizeBytes };
}

export async function sealDeliveryBundle(bundleDirectory, {
  deliveryId,
  catalogPath = path.join(DEFAULT_PROJECT_ROOT, "publishing", "master-catalog.json"),
  now = () => new Date(),
} = {}) {
  const directory = path.resolve(bundleDirectory);
  const explicitId = assertSafeId(deliveryId, "deliveryId");
  if (path.basename(directory) !== explicitId) {
    intakeError("delivery_id_mismatch", "The explicit deliveryId must match the bundle directory name.");
  }
  await assertSecureDirectory(directory, "Delivery bundle");
  const entries = await fs.readdir(directory, { withFileTypes: true });
  if (entries.some((entry) => [DELIVERY_FILE, READY_FILE].includes(entry.name))) {
    intakeError("already_sealed", "The delivery already contains seal files; create a new deliveryId to revise it.");
  }

  const manifestResult = await inspectSecureFile(path.join(directory, MANIFEST_FILE), {
    capture: true,
    label: MANIFEST_FILE,
  });
  const manifest = parseJson(manifestResult.content, MANIFEST_FILE);
  const validation = validateManifest(manifest);
  if (validation.errors.length) {
    intakeError("episode_manifest_invalid", "episode.json does not satisfy the publishing manifest contract.");
  }
  assertNoRumble(manifest);
  await assertCatalogBinding(manifest, catalogPath);

  const assets = {};
  const expectedEntries = new Set([MANIFEST_FILE]);
  for (const [role, filename] of manifestAssetEntries(manifest)) {
    assertSafeFileName(filename, `assets.${role}`);
    const extension = path.extname(filename).toLowerCase();
    if (!ASSET_EXTENSIONS[role]?.has(extension)) {
      intakeError("asset_extension_invalid", `${role} does not use an allowed media extension.`);
    }
    if (expectedEntries.has(filename)) {
      intakeError("filename_collision", "Every delivery file must have a unique filename.");
    }
    expectedEntries.add(filename);
    assets[role] = await fileRecord(directory, filename, role);
  }
  if (assets.rumble) intakeError("rumble_forbidden", "Rumble cannot be part of automated intake.");
  if (
    entries.length !== expectedEntries.size ||
    entries.some((entry) => !entry.isFile() || !expectedEntries.has(entry.name))
  ) {
    intakeError("undeclared_bundle_entry", "The unsealed bundle contains nested or undeclared entries.");
  }

  const envelope = {
    $schema: path.relative(directory, path.join(DEFAULT_PROJECT_ROOT, "publishing", "dropbox-delivery.schema.json")),
    schemaVersion: 1,
    deliveryId: explicitId,
    createdAt: now().toISOString(),
    episodeNumber: manifest.episodeNumber,
    episodeSlug: manifest.slug,
    manifest: {
      file: MANIFEST_FILE,
      sha256: manifestResult.sha256,
      sizeBytes: manifestResult.sizeBytes,
    },
    assets,
    readyForPreparation: true,
    authorizesUpload: false,
    authorizesRelease: false,
  };
  if (!validateDeliverySchema(envelope)) {
    intakeError("delivery_schema_invalid", "Generated delivery metadata failed its schema check.");
  }
  await writePrivateJson(path.join(directory, DELIVERY_FILE), envelope, { exclusive: true });
  await writePrivateText(path.join(directory, READY_FILE), READY_CONTENT, { exclusive: true });
  return envelope;
}

async function readIntakeState(statePath) {
  try {
    await fs.access(statePath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  try {
    const inspected = await inspectSecureFile(statePath, { capture: true, label: "Intake state" });
    return parseJson(inspected.content, "Intake state");
  } catch (error) {
    throw error;
  }
}

async function defaultPrepareRunner({ manifestPath, projectRoot, env }) {
  const cli = path.join(projectRoot, "scripts", "publish", "cli.mjs");
  let result;
  try {
    result = await execFileAsync(process.execPath, [cli, "prepare", manifestPath], {
      cwd: projectRoot,
      env,
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (error) {
    const exitCode = Number.isSafeInteger(error.code) ? error.code : null;
    const wrapped = new DropboxIntakeError("prepare_failed", "The existing prepare gate rejected the delivery.");
    wrapped.exitCode = exitCode;
    throw wrapped;
  }
  const match = /^Prepared job:\s+([a-z0-9][a-z0-9-]*)$/m.exec(result.stdout);
  if (!match || !JOB_ID.test(match[1])) {
    intakeError("prepare_result_invalid", "The prepare gate did not return a valid job identifier.");
  }
  return { jobId: match[1] };
}

async function stateForExistingClaim(statePath, validated) {
  const existing = await readIntakeState(statePath);
  if (!existing) return null;
  if (existing.deliveryId !== validated.deliveryId || existing.envelopeSha256 !== validated.envelopeSha256) {
    intakeError("delivery_id_reused", "A deliveryId cannot be reused for different bytes.");
  }
  if (existing.status === "prepared" && JOB_ID.test(existing.jobId ?? "")) {
    return { deliveryId: validated.deliveryId, status: "already_prepared", jobId: existing.jobId };
  }
  return {
    deliveryId: validated.deliveryId,
    status: "manual_recovery_required",
    reasonCode: existing.blockedReason ?? "preparation_outcome_ambiguous",
  };
}

async function prepareValidatedDelivery(validated, {
  stateRoot,
  projectRoot,
  env,
  prepareRunner,
  now,
}) {
  const statePath = path.join(stateRoot, `${validated.deliveryId}.json`);
  const existing = await stateForExistingClaim(statePath, validated);
  if (existing) return existing;

  const claim = {
    schemaVersion: 1,
    status: "preparing",
    deliveryId: validated.deliveryId,
    envelopeSha256: validated.envelopeSha256,
    manifestSha256: validated.manifestSha256,
    episodeNumber: validated.episodeNumber,
    episodeSlug: validated.episodeSlug,
    startedAt: now().toISOString(),
  };
  try {
    await writePrivateJson(statePath, claim, { exclusive: true });
  } catch (error) {
    if (!String(error.message).includes("Refusing to overwrite existing file")) throw error;
    return stateForExistingClaim(statePath, validated);
  }

  try {
    const { jobId } = await prepareRunner({
      manifestPath: validated.manifestPath,
      projectRoot,
      env,
    });
    if (!JOB_ID.test(jobId ?? "")) {
      intakeError("prepare_result_invalid", "The prepare gate returned an invalid job identifier.");
    }
    await writePrivateJson(statePath, {
      ...claim,
      status: "prepared",
      jobId,
      preparedAt: now().toISOString(),
    });
    return { deliveryId: validated.deliveryId, status: "prepared", jobId };
  } catch (error) {
    await writePrivateJson(statePath, {
      ...claim,
      status: "blocked",
      blockedReason: error instanceof DropboxIntakeError ? error.code : "prepare_failed",
      prepareExitCode: Number.isSafeInteger(error.exitCode) ? error.exitCode : null,
      blockedAt: now().toISOString(),
    });
    return {
      deliveryId: validated.deliveryId,
      status: "manual_recovery_required",
      reasonCode: error instanceof DropboxIntakeError ? error.code : "prepare_failed",
    };
  }
}

export async function scanDropboxInbox({
  inbox = process.env.DRM_DELIVERY_INBOX || DEFAULT_INBOX,
  stateRoot = path.join(publisherHome(), "intake"),
  projectRoot = DEFAULT_PROJECT_ROOT,
  catalogPath = path.join(projectRoot, "publishing", "master-catalog.json"),
  env = process.env,
  prepareRunner = defaultPrepareRunner,
  now = () => new Date(),
  validateOnly = false,
} = {}) {
  const resolvedInbox = path.resolve(inbox);
  try {
    await assertSecureDirectory(resolvedInbox, "Dropbox intake root");
  } catch (error) {
    if (error instanceof DropboxIntakeError && error.code === "missing_directory") return [];
    throw error;
  }
  if (!validateOnly) {
    await fs.mkdir(stateRoot, { recursive: true, mode: 0o700 });
    await fs.chmod(stateRoot, 0o700);
  }
  const entries = (await fs.readdir(resolvedInbox, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && SAFE_ID.test(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name));
  const results = [];
  for (const entry of entries) {
    const bundleDirectory = path.join(resolvedInbox, entry.name);
    try {
      await fs.access(path.join(bundleDirectory, READY_FILE));
    } catch {
      continue;
    }
    try {
      const validated = await validateDeliveryBundle(bundleDirectory, { catalogPath });
      if (validateOnly) {
        results.push({ deliveryId: validated.deliveryId, status: "validated" });
      } else {
        results.push(await prepareValidatedDelivery(validated, {
          stateRoot,
          projectRoot,
          env,
          prepareRunner,
          now,
        }));
      }
    } catch (error) {
      results.push({
        deliveryId: entry.name,
        status: "rejected",
        reasonCode: error instanceof DropboxIntakeError ? error.code : "intake_failure",
      });
    }
  }
  return results;
}

function usage() {
  return `Usage:
  node scripts/publish/dropbox-intake.mjs scan [--inbox <path>] [--state-root <path>] [--validate-only]
  node scripts/publish/dropbox-intake.mjs seal <bundle-directory> --delivery-id <id>\n`;
}

function parseArguments(argv) {
  const args = [...argv];
  const command = args[0] && !args[0].startsWith("--") ? args.shift() : "scan";
  const values = { command, validateOnly: false };
  if (command === "seal") {
    if (!args[0] || args[0].startsWith("--")) throw new Error(usage());
    values.bundleDirectory = args.shift();
  }
  while (args.length) {
    const token = args.shift();
    if (token === "--validate-only") {
      values.validateOnly = true;
      continue;
    }
    if (!["--inbox", "--state-root", "--delivery-id", "--catalog"].includes(token)) {
      throw new Error(`Unknown argument: ${token}`);
    }
    if (!args.length) throw new Error(`${token} requires a value.`);
    const key = {
      "--inbox": "inbox",
      "--state-root": "stateRoot",
      "--delivery-id": "deliveryId",
      "--catalog": "catalogPath",
    }[token];
    values[key] = args.shift();
  }
  return values;
}

async function main(argv) {
  const parsed = parseArguments(argv);
  if (parsed.command === "seal") {
    if (!parsed.bundleDirectory || !parsed.deliveryId) {
      throw new Error(usage());
    }
    const envelope = await sealDeliveryBundle(parsed.bundleDirectory, parsed);
    process.stdout.write(`Sealed delivery ${envelope.deliveryId}; no upload or release was authorized.\n`);
    return;
  }
  if (parsed.command !== "scan") throw new Error(usage());
  const results = await scanDropboxInbox(parsed);
  if (!results.length) {
    process.stdout.write("No ready Dropbox deliveries found.\n");
    return;
  }
  for (const result of results) {
    const detail = result.jobId ? ` job=${result.jobId}` : result.reasonCode ? ` reason=${result.reasonCode}` : "";
    process.stdout.write(`delivery=${result.deliveryId} status=${result.status}${detail}\n`);
  }
  if (results.some((result) => ["rejected", "manual_recovery_required"].includes(result.status))) {
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main(process.argv.slice(2)).catch((error) => {
    const code = error instanceof DropboxIntakeError ? error.code : "intake_failure";
    process.stderr.write(`Dropbox intake stopped (${code}).\n`);
    process.exitCode = 1;
  });
}
