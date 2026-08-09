import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { writePrivateFile, writePrivateJson, writePrivateText } from "./lib.mjs";

function recordingFileSystem(events) {
  return {
    async mkdir(directory) {
      events.push(`mkdir:${directory}`);
    },
    async open(filePath, flags, mode) {
      const isDirectory = flags === "r";
      events.push(isDirectory ? `open-directory:${filePath}` : `open-file:${flags}:${mode.toString(8)}`);
      return {
        async chmod(value) {
          events.push(`chmod:${value.toString(8)}`);
        },
        async writeFile(value) {
          events.push(`write:${value}`);
        },
        async sync() {
          events.push(isDirectory ? "sync-directory" : "sync-file");
        },
        async close() {
          events.push(isDirectory ? "close-directory" : "close-file");
        },
      };
    },
    async link(source, destination) {
      events.push(`link:${path.basename(source)}:${path.basename(destination)}`);
    },
    async rename(source, destination) {
      events.push(`rename:${path.basename(source)}:${path.basename(destination)}`);
    },
    async rm(filePath) {
      events.push(`rm:${path.basename(filePath)}`);
    },
  };
}

test("private replacement syncs file contents before rename and directory after rename", async () => {
  const events = [];
  await writePrivateFile("/state/value.json", "payload", {
    fileSystem: recordingFileSystem(events),
    createId: () => "fixed",
  });

  assert.deepEqual(events, [
    "mkdir:/state",
    "open-file:wx:600",
    "chmod:600",
    "write:payload",
    "sync-file",
    "close-file",
    `rename:value.json.tmp-${process.pid}-fixed:value.json`,
    "open-directory:/state",
    "sync-directory",
    "close-directory",
  ]);
});

test("private exclusive creation syncs the committed link and temporary unlink", async () => {
  const events = [];
  await writePrivateFile("/state/value.json", "payload", {
    exclusive: true,
    fileSystem: recordingFileSystem(events),
    createId: () => "fixed",
  });

  assert.deepEqual(events, [
    "mkdir:/state",
    "open-file:wx:600",
    "chmod:600",
    "write:payload",
    "sync-file",
    "close-file",
    `link:value.json.tmp-${process.pid}-fixed:value.json`,
    "open-directory:/state",
    "sync-directory",
    "close-directory",
    `rm:value.json.tmp-${process.pid}-fixed`,
    "open-directory:/state",
    "sync-directory",
    "close-directory",
  ]);
});

test("private JSON and text writers replace atomically at mode 0600 and never overwrite exclusively", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "drm-private-write-"));
  const filePath = path.join(directory, "state.json");
  try {
    await fs.writeFile(filePath, "stale", { mode: 0o644 });
    await writePrivateJson(filePath, { state: "current" });
    assert.deepEqual(JSON.parse(await fs.readFile(filePath, "utf8")), { state: "current" });
    assert.equal((await fs.stat(filePath)).mode & 0o777, 0o600);

    await assert.rejects(
      writePrivateText(filePath, "must-not-replace", { exclusive: true }),
      /Refusing to overwrite existing file/
    );
    assert.deepEqual(JSON.parse(await fs.readFile(filePath, "utf8")), { state: "current" });
    assert.deepEqual((await fs.readdir(directory)).sort(), ["state.json"]);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
