import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const opsRoot = path.dirname(fileURLToPath(import.meta.url));

async function source(relative) {
  return fs.readFile(path.join(opsRoot, relative), "utf8");
}

test("publisher host and intake installers have valid shell syntax", () => {
  for (const script of ["install-publisher-host.sh", "install-publisher-intake.sh"]) {
    const result = spawnSync("bash", ["-n", path.join(opsRoot, script)], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  }
});

test("host deployment verifies sealed commit releases and runs npm under pinned Node 22", async () => {
  const host = await source("install-publisher-host.sh");
  assert.match(host, /node_root=\/home\/otto\/\.nvm\/versions\/node\/v22\.22\.0/);
  assert.match(host, /"\$\(\$node_bin --version\)" != "v22\.22\.0"/);
  assert.match(host, /PATH="\$node_root\/bin:\/usr\/bin:\/bin" "\$npm_bin" ci --omit=dev --ignore-scripts/);
  assert.match(host, /release-integrity\.mjs" verify "\$release_root" "\$commit"/);
  assert.match(host, /release-integrity\.mjs" seal "\$temporary" "\$commit"/);
  assert.match(host, /invalid_release="\$\{release_root\}\.invalid-/);
});

test("host refreshes intake without enabling it implicitly", async () => {
  const host = await source("install-publisher-host.sh");
  const intake = await source("install-publisher-intake.sh");
  assert.match(host, /intake_args=\(--preserve-state\)/);
  assert.match(host, /if \$enable; then\s+intake_args=\(--enable\)/);
  assert.match(host, /install-publisher-intake\.sh" "\$\{intake_args\[@\]\}"/);
  assert.match(intake, /--enable\|--preserve-state/);
  assert.match(intake, /timer_was_active/);
  assert.match(intake, /prior timer activation was preserved/);
});

test("both systemd services mount the exact pinned project read-only", async () => {
  for (const unit of ["systemd/drm-publisher-controller.service", "systemd/drm-publisher-intake.service"]) {
    const contents = await source(unit);
    assert.match(contents, /^WorkingDirectory=@PROJECT_ROOT@$/m);
    assert.match(contents, /^ReadOnlyPaths=@PROJECT_ROOT@$/m);
  }
});

test("systemd timers schedule from activation instead of depending on boot time", async () => {
  for (const timer of ["systemd/drm-publisher-controller.timer", "systemd/drm-publisher-intake.timer"]) {
    const contents = await source(timer);
    assert.match(contents, /^OnActiveSec=\S+$/m);
    assert.match(contents, /^OnUnitActiveSec=\S+$/m);
    assert.doesNotMatch(contents, /^OnBootSec=/m);
  }
});

test("Dropbox intake condition preserves the inbox path with spaces", async () => {
  const contents = await source("systemd/drm-publisher-intake.service");
  assert.match(
    contents,
    /^ConditionPathIsDirectory="\/home\/otto\/Dropbox\/Dr M Experienced\/publisher-inbox"$/m,
  );
  assert.doesNotMatch(contents, /Dr\\x20M\\x20Experienced/);
});
