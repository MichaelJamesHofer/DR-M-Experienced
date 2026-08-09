import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assertAutomationRunning,
  AutomationControlError,
  automationPauseRequestDirectory,
  loadAutomationControl,
  requestAutomationPause,
  setAutomationRunning,
} from "./automation-control.mjs";

async function fixture(document, mode = 0o600) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "drm-automation-control-"));
  const filePath = path.join(directory, "automation-control.json");
  await fs.writeFile(filePath, `${JSON.stringify(document)}\n`, { mode });
  await fs.chmod(filePath, mode);
  return { directory, filePath };
}

const valid = {
  schemaVersion: 1,
  generation: 1,
  mode: "running",
  allowedPlatforms: ["vimeo"],
  updatedAt: "2026-08-08T23:00:00Z",
};

test("owner-only automation control allows only its explicit platforms", async () => {
  const state = await fixture(valid);
  try {
    const control = await loadAutomationControl({ filePath: state.filePath });
    assert.doesNotThrow(() => assertAutomationRunning(control, "vimeo"));
    assert.throws(
      () => assertAutomationRunning(control, "youtube"),
      (error) => error instanceof AutomationControlError && error.code === "platform_not_locally_allowed",
    );
  } finally {
    await fs.rm(state.directory, { recursive: true, force: true });
  }
});

test("missing, permissive, malformed, paused, and Rumble controls fail closed", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "drm-automation-control-missing-"));
  await assert.rejects(() => loadAutomationControl({ filePath: path.join(directory, "missing.json") }), /does not exist/);
  await fs.rm(directory, { recursive: true, force: true });

  for (const [document, mode, pattern] of [
    [valid, 0o644, /mode 0600/],
    [{ ...valid, generation: 0 }, 0o600, /generation/],
    [{ ...valid, allowedPlatforms: ["rumble"] }, 0o600, /Rumble/],
  ]) {
    const state = await fixture(document, mode);
    try {
      await assert.rejects(() => loadAutomationControl({ filePath: state.filePath }), pattern);
    } finally {
      await fs.rm(state.directory, { recursive: true, force: true });
    }
  }
  assert.throws(
    () => assertAutomationRunning({ ...valid, mode: "paused" }, "vimeo"),
    (error) => error instanceof AutomationControlError && error.code === "automation_paused",
  );
});

test("pause requests are durable, explicit, and cleared only by a serialized run", async () => {
  const state = await fixture(valid);
  try {
    const paused = await requestAutomationPause({ filePath: state.filePath });
    assert.equal(paused.mode, "paused");
    assert.equal(paused.pauseRequestCount, 1);
    assert.equal((await loadAutomationControl({ filePath: state.filePath })).mode, "paused");

    const running = await setAutomationRunning({
      filePath: state.filePath,
      allowedPlatforms: ["vimeo"],
    });
    assert.equal(running.mode, "running");
    assert.deepEqual(running.allowedPlatforms, ["vimeo"]);
    assert.equal((await loadAutomationControl({ filePath: state.filePath })).mode, "running");
  } finally {
    await fs.rm(state.directory, { recursive: true, force: true });
  }
});

test("a pause request created during run wins and cannot be removed by that run", async () => {
  const state = await fixture(valid);
  try {
    await requestAutomationPause({ filePath: state.filePath });
    const pauseDirectory = automationPauseRequestDirectory({ filePath: state.filePath });
    await assert.rejects(
      () => setAutomationRunning({
        filePath: state.filePath,
        allowedPlatforms: ["vimeo"],
        onRunningControlWritten: async () => {
          await fs.writeFile(path.join(pauseDirectory, "pause-concurrent.json"), "{}\n", {
            mode: 0o600,
            flag: "wx",
          });
        },
      }),
      (error) => error instanceof AutomationControlError && error.code === "automation_pause_won_race",
    );
    const control = await loadAutomationControl({ filePath: state.filePath });
    assert.equal(control.mode, "paused");
    assert.equal(control.pauseRequestCount, 1);
  } finally {
    await fs.rm(state.directory, { recursive: true, force: true });
  }
});

test("a secure pause request fails closed even when the main control file is absent", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "drm-automation-pause-only-"));
  const filePath = path.join(directory, "automation-control.json");
  try {
    const paused = await requestAutomationPause({ filePath });
    assert.equal(paused.generation, 1);
    await fs.rm(filePath);
    const loaded = await loadAutomationControl({ filePath });
    assert.equal(loaded.mode, "paused");
    assert.equal(loaded.pauseRequestCount, 1);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
