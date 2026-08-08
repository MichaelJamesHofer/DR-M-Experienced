import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const packageRoot = path.join(repoRoot, "publishing/brand/show-package/1.0.0-rc1");
const manifest = JSON.parse(await fs.readFile(path.join(packageRoot, "package-manifest.json"), "utf8"));
const catalog = JSON.parse(await fs.readFile(path.join(repoRoot, "publishing/master-catalog.json"), "utf8"));
const assetManifest = JSON.parse(
  await fs.readFile(path.join(repoRoot, "publishing/brand/asset-manifest.json"), "utf8")
);
const sourceConfigPath =
  process.env.DRM_PUBLISH_SOURCES_CONFIG ??
  path.join(process.env.HOME ?? os.homedir(), ".config/drm-publisher/sources.json");
const sourceConfig = JSON.parse(await fs.readFile(sourceConfigPath, "utf8"));
const dropboxRoot = sourceConfig?.roots?.dropbox;

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function evidence(file) {
  const buffer = await fs.readFile(file);
  const stat = await fs.stat(file);
  return { sizeBytes: stat.size, sha256: sha256(buffer), buffer };
}

function resolveDropboxUri(uri) {
  assert.equal(typeof dropboxRoot, "string");
  assert.match(uri, /^dropbox:/);
  return path.join(dropboxRoot, uri.slice("dropbox:".length));
}

test("candidate remains review-only and uses the canonical identity", () => {
  assert.equal(manifest.packageVersion, "1.0.0-rc1");
  assert.equal(manifest.status, "review_owner_approval_required");
  assert.deepEqual(manifest.show, {
    fullTitle: "Dr. M Experienced, with Dr. David Musnick",
    shortTitle: "Dr. M Experienced",
    displayWordmark: "DR. M EXPERIENCED,",
    hostLine: "with Dr. David Musnick",
  });
  assert.equal(manifest.direction.mark, "Cutline");
  assert.equal(manifest.direction.portraitDependency, false);
  assert.equal(manifest.approval.ownerVisualApprovalRequired, true);
  assert.equal(manifest.approval.remotePublishingAuthorized, false);
  assert.deepEqual(manifest.approval.approvedDestinations, []);
});

test("catalog revision 12 mounts exact candidate hashes without publishing approval", () => {
  assert.equal(catalog.revision, 12);
  assert.equal(assetManifest.showPackage.packageVersion, manifest.packageVersion);
  assert.equal(assetManifest.showPackage.status, "review_owner_approval_required");
  assert.equal(assetManifest.showPackage.catalogRevision, catalog.revision);
  assert.equal(assetManifest.showPackage.remotePublishingAuthorized, false);
  assert.deepEqual(assetManifest.showPackage.approvedDestinations, []);

  for (const [assetId, mounted] of Object.entries(manifest.mountedCatalogAssets)) {
    const catalogAsset = catalog.assetRegistry[assetId];
    const recordedAsset = assetManifest.showPackage.assets[assetId];
    assert.ok(catalogAsset, `${assetId} missing from catalog`);
    assert.ok(recordedAsset, `${assetId} missing from brand manifest`);
    assert.equal(catalogAsset.uri, mounted.uri, `${assetId} catalog URI`);
    assert.equal(catalogAsset.sizeBytes, mounted.sizeBytes, `${assetId} catalog byte size`);
    assert.equal(catalogAsset.sha256, mounted.sha256, `${assetId} catalog SHA-256`);
    assert.equal(catalogAsset.status, "verified", `${assetId} catalog status`);
    assert.equal(recordedAsset.uri, mounted.uri, `${assetId} brand-manifest URI`);
    assert.equal(recordedAsset.sizeBytes, mounted.sizeBytes, `${assetId} brand-manifest byte size`);
    assert.equal(recordedAsset.sha256, mounted.sha256, `${assetId} brand-manifest SHA-256`);
  }

  assert.equal(
    catalog.assetRegistry["show-podcast-cover"].publishedUrl,
    "https://media.rss.com/dr-m-experienced/podcast_cover.jpg"
  );
});

test("every package manifest entry matches the checked-in binary", async () => {
  for (const item of manifest.files) {
    const file = path.join(repoRoot, item.path);
    const actual = await evidence(file);
    assert.equal(actual.sizeBytes, item.sizeBytes, `${item.path} byte size`);
    assert.equal(actual.sha256, item.sha256, `${item.path} SHA-256`);
  }
});

test("catalog aliases and public copies are byte-identical to mounted evidence", async () => {
  const publicRoot = path.join(repoRoot, "public/images/brand/show/1.0.0-rc1");
  for (const [assetId, asset] of Object.entries(manifest.mountedCatalogAssets)) {
    const dropboxFile = resolveDropboxUri(asset.uri);
    const actual = await evidence(dropboxFile);
    assert.equal(actual.sizeBytes, asset.sizeBytes, `${assetId} byte size`);
    assert.equal(actual.sha256, asset.sha256, `${assetId} SHA-256`);

    const publicFile = path.join(publicRoot, path.basename(dropboxFile));
    const publicActual = await evidence(publicFile);
    assert.equal(publicActual.sha256, actual.sha256, `${assetId} public copy`);

    const metadata = await sharp(actual.buffer).metadata();
    assert.equal(metadata.width, asset.width, `${assetId} width`);
    assert.equal(metadata.height, asset.height, `${assetId} height`);
  }
});

test("platform raster exports meet required geometry and encoding limits", async () => {
  const cover = await sharp(path.join(packageRoot, "exports/podcast-cover-3000x3000.jpg")).metadata();
  assert.equal(cover.format, "jpeg");
  assert.equal(cover.width, 3000);
  assert.equal(cover.height, 3000);
  assert.equal(cover.space, "srgb");
  assert.equal(cover.hasAlpha, false);

  const bannerPath = path.join(packageRoot, "exports/youtube-banner-2560x1440.png");
  const banner = await sharp(bannerPath).metadata();
  assert.equal(banner.width, 2560);
  assert.equal(banner.height, 1440);
  assert.ok((await fs.stat(bannerPath)).size < 6_000_000, "YouTube banner must stay under 6 MB");

  const og = await sharp(path.join(packageRoot, "exports/open-graph-1200x630.jpg")).metadata();
  assert.equal(og.width, 1200);
  assert.equal(og.height, 630);

  const avatar = await sharp(path.join(packageRoot, "exports/avatar-1200x1200.png")).metadata();
  assert.equal(avatar.width, 1200);
  assert.equal(avatar.height, 1200);
});

test("identity masters are outlined and small-size exports are exact", async () => {
  for (const name of ["logo-horizontal.svg", "logo-stacked.svg", "logo-mark.svg"]) {
    const svg = await fs.readFile(path.join(packageRoot, "source", name), "utf8");
    assert.doesNotMatch(svg, /<text\b/i, `${name} contains live text`);
  }
  const horizontal = await fs.readFile(path.join(packageRoot, "source/logo-horizontal.svg"), "utf8");
  assert.match(horizontal, /aria-label="DR\. M EXPERIENCED,"/);
  assert.match(horizontal, /aria-label="with Dr\. David Musnick"/);

  for (const size of [16, 24, 32, 48, 180, 512]) {
    const metadata = await sharp(path.join(packageRoot, `exports/logo-mark-${size}.png`)).metadata();
    assert.equal(metadata.width, size);
    assert.equal(metadata.height, size);
  }
});

test("motion exports are silent H.264 at the specified duration", () => {
  for (const [name, duration] of [
    ["intro-sting-silent-1920x1080.mp4", 1.2],
    ["end-screen-silent-1920x1080.mp4", 7],
  ]) {
    const raw = execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-show_entries",
        "stream=codec_name,codec_type,width,height,r_frame_rate",
        "-of",
        "json",
        path.join(packageRoot, "exports", name),
      ],
      { encoding: "utf8" }
    );
    const probe = JSON.parse(raw);
    assert.equal(probe.streams.length, 1, `${name} must contain video only`);
    assert.deepEqual(probe.streams[0], {
      codec_name: "h264",
      codec_type: "video",
      width: 1920,
      height: 1080,
      r_frame_rate: "30/1",
    });
    assert.equal(Number(probe.format.duration), duration);
  }
});
