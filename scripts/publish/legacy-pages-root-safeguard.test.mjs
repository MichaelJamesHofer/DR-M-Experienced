import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const controlPath = path.join(
  repositoryRoot,
  "publishing/legacy-pages-root-safeguard.json",
);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

test("legacy Pages root safeguard is complete, exact, and media staged", async () => {
  const control = JSON.parse(await fs.readFile(controlPath, "utf8"));
  assert.equal(control.schemaVersion, 1);
  assert.equal(control.mode, "temporary_legacy_pages_root_safeguard");
  assert.equal(control.sourceArtifact.workflowRunId, 33141504981);
  assert.equal(
    control.sourceArtifact.sourceCommit,
    "71fcbf9bd93a493d7960883d26c86a7261882db6",
  );

  const manifestPath = path.join(
    repositoryRoot,
    control.inventory.manifestPath,
  );
  const manifest = await fs.readFile(manifestPath);
  assert.equal(sha256(manifest), control.inventory.manifestSha256);

  const entries = manifest
    .toString("utf8")
    .trimEnd()
    .split("\n")
    .map((line) => {
      const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
      assert.ok(match, `Invalid safeguard manifest line: ${line}`);
      return { expectedSha256: match[1], relativePath: match[2] };
    });
  assert.equal(entries.length, control.inventory.fileCount);
  assert.equal(new Set(entries.map(({ relativePath }) => relativePath)).size, entries.length);

  for (const { expectedSha256, relativePath } of entries) {
    assert.equal(path.isAbsolute(relativePath), false);
    assert.equal(relativePath.split(path.sep).includes(".."), false);
    const absolutePath = path.join(repositoryRoot, relativePath);
    const stat = await fs.lstat(absolutePath);
    assert.equal(stat.isFile(), true, `${relativePath} must be a regular file`);
    assert.equal(stat.isSymbolicLink(), false, `${relativePath} must not be a symlink`);
    assert.equal(sha256(await fs.readFile(absolutePath)), expectedSha256);
  }

  const inventory = new Set(entries.map(({ relativePath }) => relativePath));
  for (const required of [
    ".nojekyll",
    "CNAME",
    "index.html",
    "404.html",
    "apple-podcasts/feed.xml",
    "apple-podcasts/media/brain-fog-part-1-9f9402d98ec297cd.mpga",
  ]) {
    assert.equal(inventory.has(required), true, `${required} is required`);
  }
  assert.equal(await fs.readFile(path.join(repositoryRoot, "CNAME"), "utf8"), "drmexperienced.com");
  assert.equal((await fs.readFile(path.join(repositoryRoot, ".nojekyll"))).length, 0);

  const appleDirectory = path.join(repositoryRoot, "apple-podcasts");
  assert.deepEqual((await fs.readdir(appleDirectory)).sort(), ["feed.xml", "media"]);
  const feed = await fs.readFile(path.join(appleDirectory, "feed.xml"));
  assert.equal(sha256(feed), control.appleMediaStagedState.feedSha256);
  assert.equal(control.appleMediaStagedState.phase, "media_staged");
  const mediaPath = path.join(
    repositoryRoot,
    control.appleMediaStagedState.candidateMediaPath,
  );
  const media = await fs.readFile(mediaPath);
  assert.equal(media.length, control.appleMediaStagedState.candidateMediaBytes);
  assert.equal(sha256(media), control.appleMediaStagedState.candidateMediaSha256);
  assert.equal(control.appleMediaStagedState.candidateMediaContentType, "audio/mpeg");
  assert.equal(control.appleMediaStagedState.candidateMediaIncluded, true);
});
