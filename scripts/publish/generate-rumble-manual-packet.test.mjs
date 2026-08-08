import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  defaultRumbleManualPacketPath,
  generateRumbleManualPacket,
} from "./generate-rumble-manual-packet.mjs";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleDirectory, "../..");
const generatorPath = path.join(moduleDirectory, "generate-rumble-manual-packet.mjs");
const catalogTemplate = JSON.parse(
  await fs.readFile(path.join(projectRoot, "publishing", "master-catalog.json"), "utf8")
);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function prepareFixture(context) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "drm-rumble-manual-packet-"));
  context.after(() => fs.rm(temporary, { recursive: true, force: true }));

  const dropboxRoot = path.join(temporary, "Dropbox", "Dr M Experienced");
  const catalogPath = path.join(temporary, "master-catalog.json");
  const sourcesConfigPath = path.join(temporary, "sources.json");
  const outputPath = path.join(temporary, "state", "rumble-packet.md");
  const catalog = structuredClone(catalogTemplate);
  const fixtureAssets = new Map();

  for (const episode of catalog.episodes.filter((entry) => entry.number >= 1 && entry.number <= 7)) {
    for (const role of ["fullVideo", "thumbnail"]) {
      const assetId = episode.assetRefs[role];
      const asset = catalog.assetRegistry[assetId];
      const relativePath = asset.uri.slice("dropbox:".length);
      const absolutePath = path.join(dropboxRoot, ...relativePath.split("/"));
      const content = Buffer.from(`episode ${episode.number} ${role} verified fixture\n`);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, content);
      Object.assign(asset, {
        status: "verified",
        sizeBytes: content.length,
        sha256: sha256(content),
      });
      fixtureAssets.set(`${episode.number}:${role}`, { absolutePath, content, assetId });
    }
  }

  const firstEpisode = catalog.episodes.find((episode) => episode.number === 1);
  firstEpisode.title = "Exact fixture title - ready to copy";
  firstEpisode.description.full =
    "<p>Exact <strong>Rumble</strong> &amp; direct.</p><ul><li>First</li></ul>";

  await fs.writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  await fs.writeFile(
    sourcesConfigPath,
    `${JSON.stringify({ schemaVersion: 1, roots: { dropbox: dropboxRoot } }, null, 2)}\n`
  );

  return { catalogPath, sourcesConfigPath, outputPath, fixtureAssets };
}

test("manual packet verifies and renders the exact seven catalog-bound videos and thumbnails", async (context) => {
  const fixture = await prepareFixture(context);
  const generatedAt = "2026-08-08T12:00:00.000Z";
  const result = await generateRumbleManualPacket({ ...fixture, generatedAt });

  assert.equal(result.outputPath, fixture.outputPath);
  assert.equal(result.packet.generatedAt, generatedAt);
  assert.equal(result.packet.episodes.length, 7);
  assert.equal(result.packet.verifiedAssetCount, 14);
  assert.equal(result.packet.episodes[0].title, "Exact fixture title - ready to copy");
  assert.equal(result.packet.episodes[0].description, "Exact Rumble & direct.\n\n- First");

  for (const episode of result.packet.episodes) {
    for (const role of ["fullVideo", "thumbnail"]) {
      const actual = episode[role];
      const expected = fixture.fixtureAssets.get(`${episode.number}:${role}`);
      assert.equal(path.isAbsolute(actual.path), true);
      assert.equal(actual.path, expected.absolutePath);
      assert.equal(actual.sizeBytes, expected.content.length);
      assert.equal(actual.sha256, sha256(expected.content));
      assert.match(result.content, new RegExp(actual.sha256));
    }
  }

  assert.equal((result.content.match(/Set visibility to \*\*Unlisted\*\*/g) ?? []).length, 7);
  assert.equal((result.content.match(/Option C: Rumble Only \(non-exclusive, similar to YouTube\)/g) ?? []).length, 7);
  assert.equal((result.content.match(/off every syndication control/g) ?? []).length, 7);
  assert.equal((result.content.match(/Keep \*\*Premium and every exclusive placement option off\*\*/g) ?? []).length, 7);
  assert.equal((result.content.match(/Human only:\*\* review and accept the \*\*July 21, 2026 Terms/g) ?? []).length, 7);
  assert.match(result.content, /Automation permission request/);
  assert.match(result.content, /SENT TO support@rumble\.com ON AUGUST 8, 2026 - RESPONSE PENDING/);
  assert.match(result.content, /would not scrape Rumble/);
  assert.match(result.content, /submit an exact release only after the owner has approved that release packet/);
  assert.doesNotMatch(result.content, /<strong>|<p>|<ul>|<li>/);

  const stored = await fs.readFile(fixture.outputPath, "utf8");
  assert.equal(stored, result.content);
  const mode = (await fs.stat(fixture.outputPath)).mode & 0o777;
  assert.equal(mode, 0o600);
});

test("manual packet fails before output when a bound file's size or SHA-256 drifts", async (context) => {
  await context.test("byte size drift", async (subcontext) => {
    const fixture = await prepareFixture(subcontext);
    const target = fixture.fixtureAssets.get("2:thumbnail").absolutePath;
    await fs.appendFile(target, "drift");

    await assert.rejects(
      generateRumbleManualPacket(fixture),
      /Episode 2 thumbnail byte size differs from the catalog/
    );
    assert.equal(await exists(fixture.outputPath), false);
  });

  await context.test("same-size content drift", async (subcontext) => {
    const fixture = await prepareFixture(subcontext);
    const target = fixture.fixtureAssets.get("4:fullVideo");
    await fs.writeFile(target.absolutePath, Buffer.alloc(target.content.length, 120));

    await assert.rejects(
      generateRumbleManualPacket(fixture),
      /Episode 4 fullVideo SHA-256 differs from the catalog/
    );
    assert.equal(await exists(fixture.outputPath), false);
  });
});

test("manual packet defaults to private publisher state and rejects repository output", async (context) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "drm-rumble-default-path-"));
  context.after(() => fs.rm(temporary, { recursive: true, force: true }));
  assert.equal(
    defaultRumbleManualPacketPath({ XDG_STATE_HOME: temporary, HOME: "/unused" }),
    path.join(temporary, "drm-publisher", "rumble", "manual-release-episodes-1-7.md")
  );

  const fixture = await prepareFixture(context);
  await assert.rejects(
    generateRumbleManualPacket({
      ...fixture,
      outputPath: path.join(projectRoot, "rumble-manual-packet-should-not-exist.md"),
    }),
    /must never be written inside the repository/
  );
  assert.equal(
    await exists(path.join(projectRoot, "rumble-manual-packet-should-not-exist.md")),
    false
  );
});

test("manual packet generator has no network or browser integration", async () => {
  const source = await fs.readFile(generatorPath, "utf8");
  assert.doesNotMatch(source, /from\s+["']node:(?:http|https|net|tls|dns|dgram)["']/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /drm-browser|playwright|puppeteer|selenium/i);
});
