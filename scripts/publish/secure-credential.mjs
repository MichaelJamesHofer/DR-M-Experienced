import { constants as fsConstants } from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";

const DEFAULT_MAX_BYTES = 1024 * 1024;

export class SecureCredentialError extends Error {
  constructor(code, message, { cause } = {}) {
    super(message, { cause });
    this.name = "SecureCredentialError";
    this.code = code;
  }
}

function currentUid() {
  const uid = typeof process.getuid === "function" ? process.getuid() : null;
  if (!Number.isInteger(uid) || uid < 0) {
    throw new SecureCredentialError(
      "credential_owner_unverifiable",
      "The current process user ID is unavailable, so credential ownership cannot be verified.",
    );
  }
  return uid;
}

function sameIdentity(left, right) {
  return left?.dev !== undefined && left?.ino !== undefined &&
    right?.dev !== undefined && right?.ino !== undefined &&
    left.dev === right.dev && left.ino === right.ino;
}

function isRegularFile(stats) {
  return typeof stats?.isFile === "function" && stats.isFile();
}

function isSymbolicLink(stats) {
  return typeof stats?.isSymbolicLink === "function" && stats.isSymbolicLink();
}

function assertDescriptorSecurity(stats, expectedUid) {
  if (!isRegularFile(stats)) {
    throw new SecureCredentialError(
      "credential_not_regular",
      "The credential path must identify a regular file.",
    );
  }
  if (!Number.isInteger(stats.uid) || stats.uid !== expectedUid) {
    throw new SecureCredentialError(
      "credential_wrong_owner",
      "The credential file must be owned by the current process user.",
    );
  }
  if (!Number.isInteger(stats.mode) || (stats.mode & 0o777) !== 0o600) {
    throw new SecureCredentialError(
      "credential_insecure_mode",
      "The credential file mode must be exactly 0600.",
    );
  }
}

function unchangedDescriptor(before, after) {
  return sameIdentity(before, after) &&
    before.size === after.size &&
    before.mtimeMs === after.mtimeMs &&
    before.ctimeMs === after.ctimeMs;
}

function pathError(error) {
  if (error instanceof SecureCredentialError) return error;
  if (error?.code === "ENOENT") {
    return new SecureCredentialError("credential_missing", "The credential file does not exist.", { cause: error });
  }
  if (error?.code === "ELOOP") {
    return new SecureCredentialError("credential_symlink", "The credential path must not be a symbolic link.", { cause: error });
  }
  return new SecureCredentialError("credential_unreadable", "The credential file could not be read securely.", { cause: error });
}

export async function readSecureCredentialText(filePath, {
  fsImpl = fsPromises,
  expectedUid = currentUid(),
  maxBytes = DEFAULT_MAX_BYTES,
} = {}) {
  if (typeof filePath !== "string" || !filePath.trim()) {
    throw new SecureCredentialError("credential_path_invalid", "A credential file path is required.");
  }
  if (!Number.isInteger(expectedUid) || expectedUid < 0) {
    throw new SecureCredentialError("credential_owner_unverifiable", "A valid expected credential owner is required.");
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new SecureCredentialError("credential_limit_invalid", "The credential size limit must be a positive integer.");
  }

  const resolvedPath = path.resolve(filePath);
  let pathBefore;
  try {
    pathBefore = await fsImpl.lstat(resolvedPath);
  } catch (error) {
    throw pathError(error);
  }
  if (isSymbolicLink(pathBefore)) {
    throw new SecureCredentialError("credential_symlink", "The credential path must not be a symbolic link.");
  }
  if (!isRegularFile(pathBefore)) {
    throw new SecureCredentialError("credential_not_regular", "The credential path must identify a regular file.");
  }

  const noFollow = Number.isInteger(fsConstants.O_NOFOLLOW) ? fsConstants.O_NOFOLLOW : 0;
  let handle;
  try {
    handle = await fsImpl.open(resolvedPath, fsConstants.O_RDONLY | noFollow);
  } catch (error) {
    throw pathError(error);
  }

  try {
    const descriptorBefore = await handle.stat();
    assertDescriptorSecurity(descriptorBefore, expectedUid);
    if (!sameIdentity(pathBefore, descriptorBefore)) {
      throw new SecureCredentialError(
        "credential_changed",
        "The credential path changed while it was being opened.",
      );
    }
    if (!Number.isSafeInteger(descriptorBefore.size) || descriptorBefore.size > maxBytes) {
      throw new SecureCredentialError(
        "credential_too_large",
        `The credential file exceeds the ${maxBytes}-byte safety limit.`,
      );
    }

    const value = await handle.readFile({ encoding: "utf8" });
    const descriptorAfter = await handle.stat();
    assertDescriptorSecurity(descriptorAfter, expectedUid);
    if (!unchangedDescriptor(descriptorBefore, descriptorAfter)) {
      throw new SecureCredentialError(
        "credential_changed",
        "The credential file changed while it was being read.",
      );
    }

    let pathAfter;
    try {
      pathAfter = await fsImpl.lstat(resolvedPath);
    } catch (error) {
      throw pathError(error);
    }
    if (isSymbolicLink(pathAfter) || !sameIdentity(descriptorAfter, pathAfter)) {
      throw new SecureCredentialError(
        "credential_changed",
        "The credential path changed while it was being read.",
      );
    }
    return value;
  } catch (error) {
    throw pathError(error);
  } finally {
    await handle.close().catch(() => {});
  }
}
