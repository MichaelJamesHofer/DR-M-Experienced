import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { publisherHome, writePrivateJson } from "./lib.mjs";

const SAFE_PLATFORM = /^[a-z0-9][a-z0-9.-]{0,63}$/;
const SAFE_PAUSE_REQUEST = /^pause-[a-zA-Z0-9._-]{1,180}\.json$/;
const CONTROL_LOCK_STALE_MS = 15 * 60_000;
const CONTROL_LOCK_WAIT_MS = 10_000;

export class AutomationControlError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AutomationControlError";
    this.code = code;
  }
}

export function automationControlPath(env = process.env) {
  return path.join(publisherHome(env), "automation-control.json");
}

export function automationPauseRequestDirectory({ env = process.env, filePath } = {}) {
  const controlPath = path.resolve(filePath || automationControlPath(env));
  return path.join(path.dirname(controlPath), "automation-pause-requests");
}

function automationControlLockPath({ env = process.env, filePath } = {}) {
  const controlPath = path.resolve(filePath || automationControlPath(env));
  return path.join(path.dirname(controlPath), "automation-control.lock");
}

function assertOwnerOnly(stats, label, expectedMode) {
  if ((stats.mode & 0o777) !== expectedMode) {
    throw new AutomationControlError(
      "automation_control_insecure",
      `${label} must have mode ${expectedMode.toString(8).padStart(4, "0")}.`,
    );
  }
  if (typeof process.getuid === "function" && stats.uid !== process.getuid()) {
    throw new AutomationControlError(
      "automation_control_insecure",
      `${label} must be owned by the publisher user.`,
    );
  }
}

async function readControlDocument(resolvedPath, { allowMissing = false } = {}) {
  let stats;
  try {
    stats = await fs.lstat(resolvedPath);
  } catch (error) {
    if (error.code === "ENOENT" && allowMissing) return null;
    if (error.code === "ENOENT") {
      throw new AutomationControlError(
        "automation_control_missing",
        `Automation is paused because ${resolvedPath} does not exist.`,
      );
    }
    throw new AutomationControlError("automation_control_unreadable", "Automation control metadata is unreadable.");
  }
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new AutomationControlError("automation_control_insecure", "Automation control must be a regular file.");
  }
  assertOwnerOnly(stats, "Automation control", 0o600);
  let document;
  try {
    document = JSON.parse(await fs.readFile(resolvedPath, "utf8"));
  } catch {
    throw new AutomationControlError("automation_control_invalid", "Automation control is not valid JSON.");
  }
  return validateControl(document);
}

async function listPauseRequests({ env = process.env, filePath } = {}) {
  const directory = automationPauseRequestDirectory({ env, filePath });
  let stats;
  try {
    stats = await fs.lstat(directory);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw new AutomationControlError("automation_control_unreadable", "Pause-request state is unreadable.");
  }
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new AutomationControlError("automation_control_insecure", "Pause-request state must be a regular directory.");
  }
  assertOwnerOnly(stats, "Pause-request directory", 0o700);
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const requests = [];
  for (const entry of entries) {
    if (!entry.isFile() || !SAFE_PAUSE_REQUEST.test(entry.name)) {
      throw new AutomationControlError("automation_control_insecure", "Pause-request state contains an invalid entry.");
    }
    const requestPath = path.join(directory, entry.name);
    const requestStats = await fs.lstat(requestPath);
    if (!requestStats.isFile() || requestStats.isSymbolicLink()) {
      throw new AutomationControlError("automation_control_insecure", "Pause request must be a regular file.");
    }
    assertOwnerOnly(requestStats, "Pause request", 0o600);
    requests.push(entry.name);
  }
  return requests.sort();
}

async function pauseRequestOwner(requestDirectory, requestName) {
  try {
    const request = JSON.parse(await fs.readFile(path.join(requestDirectory, requestName), "utf8"));
    return Number.isSafeInteger(request?.pid) ? request.pid : null;
  } catch {
    return null;
  }
}

function processIsAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

async function recoverStaleControlLock(lockPath) {
  let stats;
  try {
    stats = await fs.lstat(lockPath);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  if (!stats.isDirectory() || stats.isSymbolicLink()) return;
  if (Date.now() - stats.mtimeMs < CONTROL_LOCK_STALE_MS) return;
  let owner = null;
  try {
    owner = JSON.parse(await fs.readFile(path.join(lockPath, "owner.json"), "utf8"));
  } catch {}
  if (processIsAlive(owner?.pid)) return;
  await fs.rm(lockPath, { recursive: true, force: true });
}

async function withControlMutationLock({ env = process.env, filePath } = {}, callback) {
  const lockPath = automationControlLockPath({ env, filePath });
  await fs.mkdir(path.dirname(lockPath), { recursive: true, mode: 0o700 });
  await fs.chmod(path.dirname(lockPath), 0o700);
  const deadline = Date.now() + CONTROL_LOCK_WAIT_MS;
  while (true) {
    try {
      await fs.mkdir(lockPath, { mode: 0o700 });
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      await recoverStaleControlLock(lockPath);
      if (Date.now() >= deadline) {
        throw new AutomationControlError("automation_control_locked", "Another host-control change is still running.");
      }
      await sleep(25);
    }
  }
  try {
    await writePrivateJson(path.join(lockPath, "owner.json"), {
      schemaVersion: 1,
      pid: process.pid,
      startedAt: new Date().toISOString(),
    }, { exclusive: true });
    return await callback();
  } finally {
    await fs.rm(lockPath, { recursive: true, force: true });
  }
}

function validateControl(document) {
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new AutomationControlError("automation_control_invalid", "Automation control must be a JSON object.");
  }
  if (document.schemaVersion !== 1) {
    throw new AutomationControlError("automation_control_invalid", "Automation control schemaVersion must be 1.");
  }
  if (!Number.isSafeInteger(document.generation) || document.generation < 1) {
    throw new AutomationControlError("automation_control_invalid", "Automation control generation must be positive.");
  }
  if (!["paused", "running"].includes(document.mode)) {
    throw new AutomationControlError("automation_control_invalid", "Automation control mode must be paused or running.");
  }
  if (!Array.isArray(document.allowedPlatforms) || document.allowedPlatforms.some((id) => !SAFE_PLATFORM.test(id))) {
    throw new AutomationControlError("automation_control_invalid", "Automation control allowedPlatforms is invalid.");
  }
  if (new Set(document.allowedPlatforms).size !== document.allowedPlatforms.length) {
    throw new AutomationControlError("automation_control_invalid", "Automation control allowedPlatforms contains duplicates.");
  }
  if (
    typeof document.updatedAt !== "string" ||
    Number.isNaN(Date.parse(document.updatedAt)) ||
    !/[zZ]|[+-]\d{2}:\d{2}$/.test(document.updatedAt)
  ) {
    throw new AutomationControlError("automation_control_invalid", "Automation control updatedAt is invalid.");
  }
  if (document.allowedPlatforms.includes("rumble")) {
    throw new AutomationControlError("automation_control_invalid", "Rumble cannot be enabled in automation control.");
  }
  return Object.freeze({
    schemaVersion: 1,
    generation: document.generation,
    mode: document.mode,
    allowedPlatforms: Object.freeze([...document.allowedPlatforms]),
    updatedAt: document.updatedAt,
  });
}

export async function loadAutomationControl({ env = process.env, filePath } = {}) {
  const resolvedPath = path.resolve(filePath || automationControlPath(env));
  const requests = await listPauseRequests({ env, filePath: resolvedPath });
  const control = await readControlDocument(resolvedPath, { allowMissing: requests.length > 0 });
  if (requests.length > 0) {
    return Object.freeze({
      schemaVersion: 1,
      generation: control?.generation || 0,
      mode: "paused",
      allowedPlatforms: Object.freeze([]),
      updatedAt: control?.updatedAt || new Date(0).toISOString(),
      pauseRequestCount: requests.length,
    });
  }
  return control;
}

export async function requestAutomationPause({ env = process.env, filePath } = {}) {
  const resolvedPath = path.resolve(filePath || automationControlPath(env));
  const requestDirectory = automationPauseRequestDirectory({ env, filePath: resolvedPath });
  await fs.mkdir(requestDirectory, { recursive: true, mode: 0o700 });
  await fs.chmod(requestDirectory, 0o700);
  const requestName = `pause-${Date.now()}-${process.pid}-${randomUUID()}.json`;
  await writePrivateJson(path.join(requestDirectory, requestName), {
    schemaVersion: 1,
    requestedAt: new Date().toISOString(),
    pid: process.pid,
  }, { exclusive: true });

  return withControlMutationLock({ env, filePath: resolvedPath }, async () => {
    const current = await readControlDocument(resolvedPath, { allowMissing: true });
    const next = {
      schemaVersion: 1,
      generation: (current?.generation || 0) + 1,
      mode: "paused",
      allowedPlatforms: [],
      updatedAt: new Date().toISOString(),
    };
    await writePrivateJson(resolvedPath, next);
    return Object.freeze({ ...next, pauseRequestCount: (await listPauseRequests({ env, filePath: resolvedPath })).length });
  });
}

export async function setAutomationRunning({
  env = process.env,
  filePath,
  allowedPlatforms,
  onRunningControlWritten = null,
} = {}) {
  if (!Array.isArray(allowedPlatforms)) {
    throw new AutomationControlError("automation_control_invalid", "An exact platform allowlist is required.");
  }
  const resolvedPath = path.resolve(filePath || automationControlPath(env));
  return withControlMutationLock({ env, filePath: resolvedPath }, async () => {
    const current = await readControlDocument(resolvedPath, { allowMissing: true });
    const baselineRequests = await listPauseRequests({ env, filePath: resolvedPath });
    const requestDirectory = automationPauseRequestDirectory({ env, filePath: resolvedPath });
    for (const request of baselineRequests) {
      const ownerPid = await pauseRequestOwner(requestDirectory, request);
      if (ownerPid !== process.pid && (ownerPid == null || processIsAlive(ownerPid))) {
        throw new AutomationControlError(
          "automation_pause_won_race",
          "A live or unreadable pause request exists; publishing remains paused.",
        );
      }
    }
    const next = validateControl({
      schemaVersion: 1,
      generation: (current?.generation || 0) + 1,
      mode: "running",
      allowedPlatforms: [...allowedPlatforms],
      updatedAt: new Date().toISOString(),
    });
    await writePrivateJson(resolvedPath, next);
    if (onRunningControlWritten) await onRunningControlWritten();
    for (const request of baselineRequests) {
      await fs.rm(path.join(requestDirectory, request), { force: true });
    }
    const remaining = await listPauseRequests({ env, filePath: resolvedPath });
    if (remaining.length > 0) {
      throw new AutomationControlError(
        "automation_pause_won_race",
        "A concurrent pause request won; publishing remains paused.",
      );
    }
    return next;
  });
}

export function assertAutomationRunning(control, platformId = null) {
  if (control.mode !== "running") {
    throw new AutomationControlError("automation_paused", "Workstation publishing automation is paused.");
  }
  if (platformId && !control.allowedPlatforms.includes(platformId)) {
    throw new AutomationControlError(
      "platform_not_locally_allowed",
      `${platformId} is not allowed by the workstation automation control.`,
    );
  }
}
