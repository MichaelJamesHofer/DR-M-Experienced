import { createHash, randomUUID as nodeRandomUUID } from "node:crypto";
import { constants } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const SHA256 = /^[a-f0-9]{64}$/;
const COPY_CHUNK_BYTES = 8 * 1024 * 1024;

export const ASSET_STAGING_ROOT_ENV = "DRM_PUBLISHER_ASSET_STAGING_ROOT";

export class AssetStagingError extends Error {
  constructor(code, message, { cause = null, path: filePath = null } = {}) {
    super(message, { cause });
    this.name = "AssetStagingError";
    this.code = code;
    this.path = filePath;
  }
}

function cleanPath(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AssetStagingError("ASSET_STAGING_INPUT_INVALID", `${label} must be a non-empty path.`);
  }
  return path.resolve(value);
}

function expectedDigest(value) {
  const digest = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!SHA256.test(digest)) {
    throw new AssetStagingError(
      "ASSET_STAGING_BINDING_REQUIRED",
      "A valid approved SHA-256 fingerprint is required before an asset can be staged.",
    );
  }
  return digest;
}

export function resolveAssetStagingRoot({
  env = process.env,
  homeDir = env.HOME || os.homedir(),
  rootDir = env[ASSET_STAGING_ROOT_ENV],
} = {}) {
  if (rootDir) return cleanPath(rootDir, "asset staging root");
  const stateHome = env.XDG_STATE_HOME
    ? cleanPath(env.XDG_STATE_HOME, "XDG_STATE_HOME")
    : path.join(homeDir, ".local", "state");
  return path.join(stateHome, "drm-publisher", "assets", "sha256");
}

export function contentAddressedAssetPath(expectedSha256, options = {}) {
  const digest = expectedDigest(expectedSha256);
  return path.join(resolveAssetStagingRoot(options), digest.slice(0, 2), digest);
}

function statValue(stats, key) {
  const value = stats?.[key];
  return typeof value === "bigint" ? value.toString() : String(value ?? "");
}

function stableIdentity(before, after) {
  return ["dev", "ino", "size", "mtimeNs", "ctimeNs"]
    .every((key) => statValue(before, key) === statValue(after, key));
}

function assertRegularFile(stats, label, filePath) {
  if (typeof stats?.isFile !== "function" || !stats.isFile() || stats.isSymbolicLink?.()) {
    throw new AssetStagingError(
      "ASSET_STAGING_FILE_INVALID",
      `${label} must be a regular, non-symlink file.`,
      { path: filePath },
    );
  }
}

async function ensurePrivateDirectory(fsImpl, directory) {
  await fsImpl.mkdir(directory, { recursive: true, mode: 0o700 });
  await fsImpl.chmod(directory, 0o700);
  const stats = await fsImpl.lstat(directory);
  if (typeof stats.isDirectory !== "function" || !stats.isDirectory() || stats.isSymbolicLink?.()) {
    throw new AssetStagingError(
      "ASSET_STAGING_DIRECTORY_INVALID",
      `Asset staging directory must be a real directory: ${directory}`,
      { path: directory },
    );
  }
}

async function readAndHash(handle, sizeBytes, onChunk = null) {
  const hash = createHash("sha256");
  let offset = 0;
  while (offset < sizeBytes) {
    const length = Math.min(COPY_CHUNK_BYTES, sizeBytes - offset);
    const buffer = Buffer.allocUnsafe(length);
    let filled = 0;
    while (filled < length) {
      const { bytesRead } = await handle.read(buffer, filled, length - filled, offset + filled);
      if (!bytesRead) {
        throw new AssetStagingError(
          "ASSET_STAGING_SOURCE_CHANGED",
          "The approved source asset ended while it was being staged.",
        );
      }
      filled += bytesRead;
    }
    hash.update(buffer);
    if (onChunk) await onChunk(buffer, offset);
    offset += length;
  }
  return hash.digest("hex");
}

async function writeAll(handle, buffer, position) {
  let written = 0;
  while (written < buffer.length) {
    const result = await handle.write(buffer, written, buffer.length - written, position + written);
    if (!result.bytesWritten) {
      throw new AssetStagingError("ASSET_STAGING_WRITE_FAILED", "The staged asset write did not advance.");
    }
    written += result.bytesWritten;
  }
}

async function verifyExistingStage(fsImpl, stagedPath, digest, expectedSizeBytes) {
  let pathStats;
  try {
    pathStats = await fsImpl.lstat(stagedPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new AssetStagingError(
      "ASSET_STAGING_UNAVAILABLE",
      `The staged asset could not be inspected: ${stagedPath}`,
      { cause: error, path: stagedPath },
    );
  }
  assertRegularFile(pathStats, "The staged asset", stagedPath);
  await fsImpl.chmod(stagedPath, 0o600);
  const handle = await fsImpl.open(stagedPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const before = await handle.stat({ bigint: true });
    assertRegularFile(before, "The staged asset", stagedPath);
    const sizeBytes = Number(before.size);
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 ||
        (expectedSizeBytes != null && sizeBytes !== expectedSizeBytes)) {
      throw new AssetStagingError(
        "ASSET_STAGING_REUSE_MISMATCH",
        "The existing staged asset size does not match the approved asset.",
        { path: stagedPath },
      );
    }
    const actual = await readAndHash(handle, sizeBytes);
    const after = await handle.stat({ bigint: true });
    if (!stableIdentity(before, after) || actual !== digest) {
      throw new AssetStagingError(
        "ASSET_STAGING_REUSE_MISMATCH",
        "The existing staged asset failed immutable SHA-256 verification.",
        { path: stagedPath },
      );
    }
    return { path: stagedPath, sha256: digest, sizeBytes, reused: true };
  } finally {
    await handle.close();
  }
}

export async function stageApprovedAsset(asset, {
  fsImpl = fs,
  env = process.env,
  homeDir = env.HOME || os.homedir(),
  rootDir,
  randomUUID = nodeRandomUUID,
} = {}) {
  const sourcePath = cleanPath(asset?.path, "asset.path");
  const digest = expectedDigest(asset?.sha256);
  const expectedSizeBytes = asset?.sizeBytes == null ? null : Number(asset.sizeBytes);
  if (expectedSizeBytes != null && (!Number.isSafeInteger(expectedSizeBytes) || expectedSizeBytes < 1)) {
    throw new AssetStagingError(
      "ASSET_STAGING_INPUT_INVALID",
      "asset.sizeBytes must be a positive safe integer when supplied.",
    );
  }

  const stagingRoot = resolveAssetStagingRoot({ env, homeDir, rootDir });
  const bucketDirectory = path.join(stagingRoot, digest.slice(0, 2));
  const stagedPath = path.join(bucketDirectory, digest);
  if (sourcePath === stagedPath) {
    const reused = await verifyExistingStage(fsImpl, stagedPath, digest, expectedSizeBytes);
    if (!reused) {
      throw new AssetStagingError(
        "ASSET_STAGING_REUSE_MISMATCH",
        "A content-addressed source path was expected to exist.",
        { path: stagedPath },
      );
    }
    return { ...reused, sourcePath };
  }

  await ensurePrivateDirectory(fsImpl, stagingRoot);
  await ensurePrivateDirectory(fsImpl, bucketDirectory);
  const reusable = await verifyExistingStage(fsImpl, stagedPath, digest, expectedSizeBytes);
  if (reusable) return { ...reusable, sourcePath };

  let sourcePathStats;
  try {
    sourcePathStats = await fsImpl.lstat(sourcePath);
  } catch (error) {
    throw new AssetStagingError(
      "ASSET_STAGING_SOURCE_UNAVAILABLE",
      `The approved source asset could not be inspected: ${sourcePath}`,
      { cause: error, path: sourcePath },
    );
  }
  assertRegularFile(sourcePathStats, "The approved source asset", sourcePath);

  const temporaryPath = path.join(bucketDirectory, `.${digest}.${process.pid}.${randomUUID()}.tmp`);
  let sourceHandle = null;
  let temporaryHandle = null;
  try {
    sourceHandle = await fsImpl.open(sourcePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const before = await sourceHandle.stat({ bigint: true });
    assertRegularFile(before, "The approved source asset", sourcePath);
    if (statValue(sourcePathStats, "dev") !== statValue(before, "dev") ||
        statValue(sourcePathStats, "ino") !== statValue(before, "ino")) {
      throw new AssetStagingError(
        "ASSET_STAGING_SOURCE_CHANGED",
        "The approved source asset was replaced before it could be staged.",
        { path: sourcePath },
      );
    }
    const sizeBytes = Number(before.size);
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 ||
        (expectedSizeBytes != null && sizeBytes !== expectedSizeBytes)) {
      throw new AssetStagingError(
        "ASSET_STAGING_SOURCE_CHANGED",
        "The approved source asset size does not match its approved snapshot.",
        { path: sourcePath },
      );
    }

    temporaryHandle = await fsImpl.open(
      temporaryPath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      0o600,
    );
    const actualDigest = await readAndHash(
      sourceHandle,
      sizeBytes,
      (buffer, offset) => writeAll(temporaryHandle, buffer, offset),
    );
    const after = await sourceHandle.stat({ bigint: true });
    const currentPathStats = await fsImpl.lstat(sourcePath);
    if (!stableIdentity(before, after) ||
        statValue(after, "dev") !== statValue(currentPathStats, "dev") ||
        statValue(after, "ino") !== statValue(currentPathStats, "ino")) {
      throw new AssetStagingError(
        "ASSET_STAGING_SOURCE_CHANGED",
        "The approved source asset changed while it was being staged.",
        { path: sourcePath },
      );
    }
    if (actualDigest !== digest) {
      throw new AssetStagingError(
        "ASSET_STAGING_SOURCE_HASH_MISMATCH",
        "The source asset does not match its approved SHA-256 fingerprint.",
        { path: sourcePath },
      );
    }
    await temporaryHandle.sync();
    await temporaryHandle.close();
    temporaryHandle = null;
    await fsImpl.chmod(temporaryPath, 0o600);

    const racedStage = await verifyExistingStage(fsImpl, stagedPath, digest, expectedSizeBytes);
    if (racedStage) {
      await fsImpl.rm(temporaryPath, { force: true });
      return { ...racedStage, sourcePath };
    }
    await fsImpl.rename(temporaryPath, stagedPath);
    await fsImpl.chmod(stagedPath, 0o600);
    return { path: stagedPath, sourcePath, sha256: digest, sizeBytes, reused: false };
  } catch (error) {
    if (error instanceof AssetStagingError) throw error;
    throw new AssetStagingError(
      "ASSET_STAGING_FAILED",
      `The approved asset could not be staged: ${sourcePath}`,
      { cause: error, path: sourcePath },
    );
  } finally {
    await temporaryHandle?.close().catch(() => {});
    await sourceHandle?.close().catch(() => {});
    await fsImpl.rm(temporaryPath, { force: true }).catch(() => {});
  }
}
