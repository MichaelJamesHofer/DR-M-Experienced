#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MANIFEST_NAME = "release-integrity.json";
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;

async function hashFile(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function insideRoot(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

async function scanRelease(root, { sealed }) {
  const entries = [];

  async function visit(directory) {
    const children = await fs.readdir(directory, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const child of children) {
      const absolute = path.join(directory, child.name);
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      if (relative === MANIFEST_NAME) continue;
      const stats = await fs.lstat(absolute);

      if (stats.isDirectory()) {
        entries.push({ path: relative, type: "directory", mode: sealed ? stats.mode & 0o777 : 0o555 });
        await visit(absolute);
      } else if (stats.isFile()) {
        const executable = (stats.mode & 0o111) !== 0;
        entries.push({
          path: relative,
          type: "file",
          mode: sealed ? stats.mode & 0o777 : executable ? 0o555 : 0o444,
          sha256: await hashFile(absolute),
        });
      } else if (stats.isSymbolicLink()) {
        const target = await fs.readlink(absolute);
        const resolvedTarget = path.resolve(path.dirname(absolute), target);
        if (path.isAbsolute(target) || !insideRoot(root, resolvedTarget)) {
          throw new Error(`Release symlink escapes its root: ${relative}`);
        }
        entries.push({ path: relative, type: "symlink", target });
      } else {
        throw new Error(`Unsupported release entry type: ${relative}`);
      }
    }
  }

  await visit(root);
  return entries.sort((left, right) => left.path.localeCompare(right.path, "en"));
}

async function makeReadOnly(root) {
  const directories = [root];

  async function visit(directory) {
    for (const child of await fs.readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, child.name);
      const stats = await fs.lstat(absolute);
      if (stats.isDirectory()) {
        directories.push(absolute);
        await visit(absolute);
      } else if (stats.isFile()) {
        await fs.chmod(absolute, (stats.mode & 0o111) !== 0 ? 0o555 : 0o444);
      } else if (!stats.isSymbolicLink()) {
        throw new Error(`Unsupported release entry type: ${path.relative(root, absolute)}`);
      }
    }
  }

  await visit(root);
  directories.sort((left, right) => right.length - left.length);
  for (const directory of directories) await fs.chmod(directory, 0o555);
}

function assertCommit(commit) {
  if (!COMMIT_PATTERN.test(commit)) throw new Error(`Invalid release commit: ${commit}`);
}

export async function sealRelease(rootPath, commit) {
  assertCommit(commit);
  const root = path.resolve(rootPath);
  const rootStats = await fs.lstat(root);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
    throw new Error(`Release root must be a real directory: ${root}`);
  }

  const manifestPath = path.join(root, MANIFEST_NAME);
  const entries = await scanRelease(root, { sealed: false });
  const manifest = { schemaVersion: 1, commit, entries };
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  await makeReadOnly(root);
  await verifyRelease(root, commit);
}

export async function verifyRelease(rootPath, commit) {
  assertCommit(commit);
  const root = path.resolve(rootPath);
  const rootStats = await fs.lstat(root);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
    throw new Error(`Release root must be a real directory: ${root}`);
  }
  if ((rootStats.mode & 0o777) !== 0o555) {
    throw new Error("Release root is not read-only mode 0555.");
  }

  const manifestPath = path.join(root, MANIFEST_NAME);
  const manifestStats = await fs.lstat(manifestPath);
  if (!manifestStats.isFile() || (manifestStats.mode & 0o777) !== 0o444) {
    throw new Error("Release integrity manifest is missing or writable.");
  }
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  if (manifest.schemaVersion !== 1 || manifest.commit !== commit || !Array.isArray(manifest.entries)) {
    throw new Error("Release integrity manifest does not match the expected commit.");
  }
  const paths = manifest.entries.map((entry) => entry?.path);
  if (paths.some((entryPath) => typeof entryPath !== "string") || new Set(paths).size !== paths.length) {
    throw new Error("Release integrity manifest contains invalid or duplicate paths.");
  }

  const actualEntries = await scanRelease(root, { sealed: true });
  if (JSON.stringify(actualEntries) !== JSON.stringify(manifest.entries)) {
    throw new Error("Release contents do not match the sealed integrity manifest.");
  }

  const releaseMetadata = JSON.parse(await fs.readFile(path.join(root, "release.json"), "utf8"));
  if (releaseMetadata.schemaVersion !== 1 || releaseMetadata.commit !== commit) {
    throw new Error("Release metadata does not match the expected commit.");
  }
  return { commit, entryCount: actualEntries.length };
}

async function main() {
  const [command, root, commit] = process.argv.slice(2);
  if (!root || !commit || !["seal", "verify"].includes(command)) {
    throw new Error(`Usage: ${path.basename(process.argv[1])} <seal|verify> <release-root> <commit>`);
  }
  if (command === "seal") await sealRelease(root, commit);
  else await verifyRelease(root, commit);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
