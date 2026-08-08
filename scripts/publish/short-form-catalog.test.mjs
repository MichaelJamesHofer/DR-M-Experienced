import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import {
  configuredDropboxRoot,
  loadShortFormCatalog,
  resolveLogicalAsset,
  shortFormCatalogHash,
  validateShortFormCatalog,
  verifyShortFormCatalogFiles,
} from "./short-form-catalog.mjs";

test("checked-in short-form catalog validates with stable platform identities", async () => {
  const catalog = await loadShortFormCatalog();
  assert.equal(catalog.schemaVersion, 1);
  assert.equal(catalog.revision, 1);
  assert.equal(catalog.items.length, 3);
  assert.match(shortFormCatalogHash(catalog), /^[a-f0-9]{64}$/);

  assert.deepEqual(
    catalog.items.map((item) => [
      item.id,
      item.destinations.instagram.mediaId,
      item.destinations.instagram.shortcode,
      item.destinations.vimeo.id,
    ]),
    [
      ["short-brain-fog-what-it-feels-like", "3818274203859121888", "DT9PCiID3bg", null],
      ["short-brain-fog-testing-and-basic-solutions", "3818276316521641998", "DT9PhRsjzgO", null],
      ["short-cilantro-basil-pesto", "3928186163131134659", "DaDuIDBCTLD", "1204939542"],
    ]
  );
});

test("short-form semantic validation rejects duplicate and contradictory identity", async () => {
  const catalog = await loadShortFormCatalog();

  const duplicate = structuredClone(catalog);
  duplicate.items[1].destinations.instagram.mediaId = duplicate.items[0].destinations.instagram.mediaId;
  let result = validateShortFormCatalog(duplicate);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("Duplicate Instagram media ID")));

  const badWebsitePath = structuredClone(catalog);
  badWebsitePath.items[0].destinations.website.path = "/media/legacy/";
  result = validateShortFormCatalog(badWebsitePath);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("website path must be")));

  const unboundVimeo = structuredClone(catalog);
  unboundVimeo.items[2].destinations.vimeo.id = null;
  result = validateShortFormCatalog(unboundVimeo);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("published Vimeo destination")));

  const duplicateCaption = structuredClone(catalog);
  duplicateCaption.items[1].destinationCopy.instagramCaption =
    `  ${duplicateCaption.items[0].destinationCopy.instagramCaption.toUpperCase()}  `;
  result = validateShortFormCatalog(duplicateCaption);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("Duplicate normalized Instagram caption")));
});

test("website posters are checked-in, immutable catalog assets", async () => {
  const catalog = await loadShortFormCatalog();
  const result = await verifyShortFormCatalogFiles({
    catalog,
    dropboxRoot: "/not-used",
    verifyDropbox: false,
  });
  assert.deepEqual(result, { valid: true, problems: [] });
});

test("logical Dropbox references remain inside the configured project root", () => {
  assert.equal(
    resolveLogicalAsset("dropbox:shorts/001/master.mp4", "/srv/drm"),
    "/srv/drm/shorts/001/master.mp4"
  );
  assert.throws(
    () => resolveLogicalAsset("dropbox:../outside.mp4", "/srv/drm"),
    /escapes the configured project root/
  );
  assert.throws(
    () => resolveLogicalAsset("dropbox:/absolute.mp4", "/srv/drm"),
    /Invalid project-relative/
  );
});

test("configured workstation Dropbox masters retain their verified fingerprints", async (t) => {
  let dropboxRoot;
  try {
    dropboxRoot = await configuredDropboxRoot();
    await fs.access(dropboxRoot);
  } catch {
    t.skip("project Dropbox source is not mounted in this environment");
    return;
  }

  const catalog = await loadShortFormCatalog();
  const result = await verifyShortFormCatalogFiles({ catalog, dropboxRoot });
  assert.deepEqual(result, { valid: true, problems: [] });
});
