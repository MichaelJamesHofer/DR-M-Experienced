import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { sealRelease, verifyRelease } from "./release-integrity.mjs";

const COMMIT = "1".repeat(40);

async function makeWritableForRemoval(directory) {
  try {
    await fs.chmod(directory, 0o700);
    for (const child of await fs.readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, child.name);
      if (child.isDirectory()) await makeWritableForRemoval(absolute);
      else if (!child.isSymbolicLink()) await fs.chmod(absolute, 0o600);
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function fixture() {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "drm-release-integrity-"));
  const root = path.join(parent, "release");
  await fs.mkdir(path.join(root, "bin"), { recursive: true });
  await fs.mkdir(path.join(root, "node_modules", "dependency"), { recursive: true });
  await fs.writeFile(path.join(root, "bin", "publisher"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  await fs.writeFile(path.join(root, "source.mjs"), "export const ready = true;\n", { mode: 0o644 });
  await fs.writeFile(path.join(root, "node_modules", "dependency", "index.js"), "module.exports = true;\n");
  await fs.symlink("../source.mjs", path.join(root, "bin", "source-link"));
  await fs.writeFile(
    path.join(root, "release.json"),
    `${JSON.stringify({ schemaVersion: 1, commit: COMMIT, installedAt: "2026-08-08T00:00:00Z" })}\n`
  );
  return { parent, root };
}

test("sealed releases verify exact content while preserving executable dependencies", async () => {
  const { parent, root } = await fixture();
  try {
    await sealRelease(root, COMMIT);
    const result = await verifyRelease(root, COMMIT);
    assert.equal(result.commit, COMMIT);
    assert.ok(result.entryCount >= 7);
    assert.equal((await fs.stat(root)).mode & 0o777, 0o555);
    assert.equal((await fs.stat(path.join(root, "source.mjs"))).mode & 0o777, 0o444);
    assert.equal((await fs.stat(path.join(root, "bin", "publisher"))).mode & 0o777, 0o555);
    assert.equal(
      (await fs.stat(path.join(root, "node_modules", "dependency", "index.js"))).mode & 0o777,
      0o444
    );
    assert.equal(await fs.readFile(path.join(root, "node_modules", "dependency", "index.js"), "utf8"), "module.exports = true;\n");
    assert.equal(spawnSync(path.join(root, "bin", "publisher")).status, 0);
  } finally {
    await makeWritableForRemoval(root);
    await fs.rm(parent, { recursive: true, force: true });
  }
});

test("verification rejects modified, missing, and additional release content", async () => {
  for (const mutation of ["modified", "missing", "additional"]) {
    const { parent, root } = await fixture();
    try {
      await sealRelease(root, COMMIT);
      if (mutation === "modified") {
        const source = path.join(root, "source.mjs");
        await fs.chmod(source, 0o644);
        await fs.writeFile(source, "export const ready = false;\n");
        await fs.chmod(source, 0o444);
      } else if (mutation === "missing") {
        await fs.chmod(path.join(root, "bin"), 0o755);
        await fs.rm(path.join(root, "bin", "source-link"));
        await fs.chmod(path.join(root, "bin"), 0o555);
      } else {
        await fs.chmod(root, 0o755);
        await fs.writeFile(path.join(root, "unexpected.txt"), "unexpected", { mode: 0o444 });
        await fs.chmod(root, 0o555);
      }
      await assert.rejects(verifyRelease(root, COMMIT), /do not match the sealed integrity manifest/);
    } finally {
      await makeWritableForRemoval(root);
      await fs.rm(parent, { recursive: true, force: true });
    }
  }
});

test("release sealing rejects symlinks that escape the pinned tree", async () => {
  const { parent, root } = await fixture();
  try {
    await fs.symlink("/tmp", path.join(root, "external"));
    await assert.rejects(sealRelease(root, COMMIT), /symlink escapes its root/);
  } finally {
    await makeWritableForRemoval(root);
    await fs.rm(parent, { recursive: true, force: true });
  }
});
