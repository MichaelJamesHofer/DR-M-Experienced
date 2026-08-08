import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import {
  configuredDropboxRoot,
  loadShortFormCatalog,
  resolveLogicalAsset,
  shortFormCatalogHash,
  validateShortFormCatalog,
  validateShortFormPlatformRegistry,
  verifyShortFormCatalogFiles,
} from "./short-form-catalog.mjs";

const platformRegistryFile = new URL("../../publishing/platforms.json", import.meta.url);

async function loadPlatformRegistry() {
  return JSON.parse(await fs.readFile(platformRegistryFile, "utf8"));
}

test("checked-in short-form catalog validates with stable platform identities", async () => {
  const catalog = await loadShortFormCatalog();
  assert.equal(catalog.schemaVersion, 2);
  assert.equal(catalog.revision, 3);
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
      ["short-brain-fog-what-it-feels-like", "3818274203859121888", "DT9PCiID3bg", "1216695521"],
      ["short-brain-fog-testing-and-basic-solutions", "3818276316521641998", "DT9PhRsjzgO", "1216695522"],
      ["short-cilantro-basil-pesto", "3928186163131134659", "DaDuIDBCTLD", "1204939542"],
    ]
  );
  assert.deepEqual(
    catalog.items.map((item) => item.destinations.website),
    [
      {
        state: "published",
        path: "/shorts/what-brain-fog-feels-like/",
        url: "https://drmexperienced.com/shorts/what-brain-fog-feels-like/",
        verifiedAt: "2026-08-08T21:49:06Z",
      },
      {
        state: "published",
        path: "/shorts/brain-fog-testing-and-basic-solutions/",
        url: "https://drmexperienced.com/shorts/brain-fog-testing-and-basic-solutions/",
        verifiedAt: "2026-08-08T21:49:06Z",
      },
      {
        state: "published",
        path: "/shorts/cilantro-basil-pesto-with-broccoli-sprouts/",
        url: "https://drmexperienced.com/shorts/cilantro-basil-pesto-with-broccoli-sprouts/",
        verifiedAt: "2026-08-08T21:49:06Z",
      },
    ]
  );
});

test("checked-in Vimeo platform summary is an exact projection of the short-form catalog", async () => {
  const catalog = await loadShortFormCatalog();
  const platformRegistry = await loadPlatformRegistry();
  const result = validateShortFormPlatformRegistry(catalog, platformRegistry);

  assert.deepEqual(result, { valid: true, errors: [] });
  assert.equal(platformRegistry.platforms.vimeo.currentVideoCount, 10);
  assert.equal(platformRegistry.platforms.vimeo.currentShortVideoCount, 3);
  assert.deepEqual(platformRegistry.platforms.vimeo.catalogedShortVideoIds, [
    "1216695521",
    "1216695522",
    "1204939542",
  ]);
  assert.deepEqual(platformRegistry.platforms.vimeo.shortMetadataDriftVideoIds, []);
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

test("short-form verification timestamps and Vimeo identity bindings reject stale ledger mutations", async () => {
  const catalog = await loadShortFormCatalog();
  const futureVerification = new Date(Date.parse(catalog.lastVerifiedAt) + 1_000).toISOString();

  const oldSchemaVersion = structuredClone(catalog);
  oldSchemaVersion.schemaVersion = 1;
  let result = validateShortFormCatalog(oldSchemaVersion);
  assert.equal(result.valid, false);

  for (const destination of ["instagram", "vimeo", "website"]) {
    const futureChildVerification = structuredClone(catalog);
    futureChildVerification.items[0].destinations[destination].verifiedAt = futureVerification;
    result = validateShortFormCatalog(futureChildVerification);
    assert.equal(result.valid, false, destination);
    assert.ok(
      result.errors.some((error) => error.includes("cannot be later than catalog lastVerifiedAt")),
      destination
    );
  }

  const mismatchedVimeoUrl = structuredClone(catalog);
  mismatchedVimeoUrl.items[0].destinations.vimeo.url = "https://vimeo.com/1204939542";
  result = validateShortFormCatalog(mismatchedVimeoUrl);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("URL does not match its stable video ID")));

  const mismatchedWebsiteUrl = structuredClone(catalog);
  mismatchedWebsiteUrl.items[0].destinations.website.url =
    "https://drmexperienced.com/shorts/brain-fog-testing-and-basic-solutions/";
  result = validateShortFormCatalog(mismatchedWebsiteUrl);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("website URL does not match")));
});

test("website publication evidence is complete and forbidden before deployment", async () => {
  const catalog = await loadShortFormCatalog();

  const readyWithoutEvidence = structuredClone(catalog);
  const readyWebsite = readyWithoutEvidence.items[0].destinations.website;
  readyWebsite.state = "ready_for_deployment";
  delete readyWebsite.url;
  delete readyWebsite.verifiedAt;
  assert.deepEqual(validateShortFormCatalog(readyWithoutEvidence), {
    valid: true,
    errors: [],
  });

  for (const missingField of ["url", "verifiedAt"]) {
    const missingEvidence = structuredClone(catalog);
    delete missingEvidence.items[0].destinations.website[missingField];
    const result = validateShortFormCatalog(missingEvidence);
    assert.equal(result.valid, false, missingField);
  }

  for (const forbiddenField of ["url", "verifiedAt"]) {
    const prematureEvidence = structuredClone(catalog);
    const website = prematureEvidence.items[0].destinations.website;
    website.state = "ready_for_deployment";
    delete website[forbiddenField === "url" ? "verifiedAt" : "url"];
    const result = validateShortFormCatalog(prematureEvidence);
    assert.equal(result.valid, false, forbiddenField);
  }
});

test("Vimeo parity flags remain derived from observed copy and selected poster evidence", async () => {
  const catalog = await loadShortFormCatalog();

  for (const field of ["observedTitle", "observedDescription"]) {
    const falseParityClaim = structuredClone(catalog);
    falseParityClaim.items[0].destinations.vimeo[field] += " stale";
    const result = validateShortFormCatalog(falseParityClaim);
    assert.equal(result.valid, false, field);
    assert.ok(
      result.errors.some((error) => error.includes("metadataParity must exactly reflect")),
      field
    );
  }

  const staleFalseParity = structuredClone(catalog);
  staleFalseParity.items[0].destinations.vimeo.metadataParity = false;
  let result = validateShortFormCatalog(staleFalseParity);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("metadataParity must exactly reflect")));

  const posterWithoutSelection = structuredClone(catalog);
  posterWithoutSelection.items[0].destinations.vimeo.selectedThumbnailId = null;
  result = validateShortFormCatalog(posterWithoutSelection);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("posterParity requires a selected thumbnail ID")));

  const representedDrift = structuredClone(catalog);
  representedDrift.items[0].destinations.vimeo.observedTitle += " stale";
  representedDrift.items[0].destinations.vimeo.metadataParity = false;
  representedDrift.items[0].destinations.vimeo.posterParity = false;
  result = validateShortFormCatalog(representedDrift);
  assert.deepEqual(result, { valid: true, errors: [] });

  const driftRegistry = await loadPlatformRegistry();
  driftRegistry.platforms.vimeo.shortMetadataDriftVideoIds = [
    representedDrift.items[0].destinations.vimeo.id,
  ];
  assert.deepEqual(validateShortFormPlatformRegistry(representedDrift, driftRegistry), {
    valid: true,
    errors: [],
  });
});

test("Vimeo platform registry rejects stale counts, IDs, timestamps, and drift projection", async () => {
  const catalog = await loadShortFormCatalog();
  const platformRegistry = await loadPlatformRegistry();
  const latestVimeoVerification = Math.max(
    ...catalog.items.map((item) => Date.parse(item.destinations.vimeo.verifiedAt))
  );
  const mutations = [
    (value) => {
      value.platforms.vimeo.currentShortVideoCount -= 1;
    },
    (value) => {
      value.platforms.vimeo.currentVideoCount -= 1;
    },
    (value) => {
      value.platforms.vimeo.catalogedShortVideoIds[0] = "9999999999";
    },
    (value) => {
      value.platforms.vimeo.shortMetadataDriftVideoIds = ["1216695521"];
    },
    (value) => {
      value.platforms.vimeo.shortStateAuditedAt = new Date(
        latestVimeoVerification - 1
      ).toISOString();
    },
  ];

  for (const mutate of mutations) {
    const candidate = structuredClone(platformRegistry);
    mutate(candidate);
    assert.equal(validateShortFormPlatformRegistry(catalog, candidate).valid, false);
  }

  const laterWebsiteOnlyVerification = structuredClone(catalog);
  const laterTimestamp = new Date(Date.parse(catalog.lastVerifiedAt) + 1_000).toISOString();
  laterWebsiteOnlyVerification.lastVerifiedAt = laterTimestamp;
  for (const item of laterWebsiteOnlyVerification.items) {
    item.destinations.website.verifiedAt = laterTimestamp;
  }
  assert.deepEqual(
    validateShortFormPlatformRegistry(laterWebsiteOnlyVerification, platformRegistry),
    { valid: true, errors: [] }
  );
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
