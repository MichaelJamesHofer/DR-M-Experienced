import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  AssetStagingError,
  contentAddressedAssetPath,
  stageApprovedAsset,
} from "./asset-staging.mjs";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function fixture(t, bytes = Buffer.from("approved episode bytes")) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "publisher-asset-staging-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const sourcePath = path.join(directory, "dropbox", "episode.mp4");
  const rootDir = path.join(directory, "state", "assets", "sha256");
  await fs.mkdir(path.dirname(sourcePath), { recursive: true });
  await fs.writeFile(sourcePath, bytes);
  return { bytes, digest: sha256(bytes), directory, rootDir, sourcePath };
}

test("stages approved bytes at the private content-addressed path with an atomic rename", async (t) => {
  const item = await fixture(t);
  const renames = [];
  const fsImpl = new Proxy(fs, {
    get(target, property) {
      if (property === "rename") {
        return async (source, destination) => {
          renames.push({ source, destination });
          return fs.rename(source, destination);
        };
      }
      return Reflect.get(target, property);
    },
  });

  const result = await stageApprovedAsset(
    { path: item.sourcePath, sha256: item.digest, sizeBytes: item.bytes.length },
    { fsImpl, rootDir: item.rootDir, randomUUID: () => "fixed" },
  );
  const expectedPath = contentAddressedAssetPath(item.digest, { rootDir: item.rootDir });

  assert.equal(result.path, expectedPath);
  assert.equal(result.reused, false);
  assert.equal(result.sha256, item.digest);
  assert.deepEqual(await fs.readFile(result.path), item.bytes);
  assert.equal((await fs.stat(item.rootDir)).mode & 0o777, 0o700);
  assert.equal((await fs.stat(path.dirname(result.path))).mode & 0o777, 0o700);
  assert.equal((await fs.stat(result.path)).mode & 0o777, 0o600);
  assert.equal(renames.length, 1);
  assert.equal(renames[0].destination, expectedPath);
  assert.match(path.basename(renames[0].source), /^\.[a-f0-9]{64}\.\d+\.fixed\.tmp$/);
  assert.deepEqual((await fs.readdir(path.dirname(result.path))).sort(), [item.digest]);
});

test("reuses only a hash-verified immutable staged path even if the Dropbox source later changes", async (t) => {
  const item = await fixture(t);
  const asset = { path: item.sourcePath, sha256: item.digest, sizeBytes: item.bytes.length };
  const first = await stageApprovedAsset(asset, { rootDir: item.rootDir });
  await fs.writeFile(item.sourcePath, Buffer.alloc(item.bytes.length, 0x78));

  const reused = await stageApprovedAsset(asset, { rootDir: item.rootDir });

  assert.equal(reused.path, first.path);
  assert.equal(reused.reused, true);
  assert.deepEqual(await fs.readFile(reused.path), item.bytes);
});

test("a source hash mismatch removes the temporary copy and never creates the immutable path", async (t) => {
  const item = await fixture(t);
  const wrongDigest = sha256(Buffer.from("different approved bytes"));
  const finalPath = contentAddressedAssetPath(wrongDigest, { rootDir: item.rootDir });

  await assert.rejects(
    stageApprovedAsset(
      { path: item.sourcePath, sha256: wrongDigest, sizeBytes: item.bytes.length },
      { rootDir: item.rootDir, randomUUID: () => "mismatch" },
    ),
    (error) => error instanceof AssetStagingError && error.code === "ASSET_STAGING_SOURCE_HASH_MISMATCH",
  );

  await assert.rejects(fs.stat(finalPath), (error) => error.code === "ENOENT");
  assert.deepEqual(await fs.readdir(path.dirname(finalPath)), []);
});

test("a corrupted content-addressed path fails closed and is not silently replaced", async (t) => {
  const item = await fixture(t);
  const asset = { path: item.sourcePath, sha256: item.digest, sizeBytes: item.bytes.length };
  const staged = await stageApprovedAsset(asset, { rootDir: item.rootDir });
  const corrupt = Buffer.alloc(item.bytes.length, 0x63);
  await fs.writeFile(staged.path, corrupt);

  await assert.rejects(
    stageApprovedAsset(asset, { rootDir: item.rootDir }),
    (error) => error instanceof AssetStagingError && error.code === "ASSET_STAGING_REUSE_MISMATCH",
  );
  assert.deepEqual(await fs.readFile(staged.path), corrupt);
});

test("detects a source mutation during a multi-chunk copy and cleans up the partial stage", async (t) => {
  const bytes = Buffer.alloc(9 * 1024 * 1024, 0x41);
  const item = await fixture(t, bytes);
  let sourceReads = 0;
  const fsImpl = new Proxy(fs, {
    get(target, property) {
      if (property !== "open") return Reflect.get(target, property);
      return async (filePath, ...args) => {
        const handle = await fs.open(filePath, ...args);
        if (path.resolve(filePath) !== item.sourcePath) return handle;
        return new Proxy(handle, {
          get(handleTarget, handleProperty) {
            if (handleProperty !== "read") return Reflect.get(handleTarget, handleProperty, handleTarget);
            return async (...readArgs) => {
              const result = await handleTarget.read(...readArgs);
              sourceReads += 1;
              if (sourceReads === 1) {
                await fs.writeFile(item.sourcePath, Buffer.alloc(bytes.length, 0x42));
              }
              return result;
            };
          },
        });
      };
    },
  });

  await assert.rejects(
    stageApprovedAsset(
      { path: item.sourcePath, sha256: item.digest, sizeBytes: bytes.length },
      { fsImpl, rootDir: item.rootDir, randomUUID: () => "mutated" },
    ),
    (error) => error instanceof AssetStagingError &&
      new Set(["ASSET_STAGING_SOURCE_CHANGED", "ASSET_STAGING_SOURCE_HASH_MISMATCH"]).has(error.code),
  );
  const finalPath = contentAddressedAssetPath(item.digest, { rootDir: item.rootDir });
  await assert.rejects(fs.stat(finalPath), (error) => error.code === "ENOENT");
  assert.deepEqual(await fs.readdir(path.dirname(finalPath)), []);
});
