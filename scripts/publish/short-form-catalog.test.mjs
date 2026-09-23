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

test("local-frame posters retain exact source identity and cannot masquerade as Instagram captures", async () => {
  const catalog = await loadShortFormCatalog();
  const item = catalog.items[0];
  item.poster.sourcePlatform = "local_master";
  item.poster.sourceMasterSha256 = item.master.sha256;
  delete item.poster.sourceMediaId;
  assert.deepEqual(validateShortFormCatalog(catalog), { valid: true, errors: [] });

  item.poster.sourceMasterSha256 = "0".repeat(64);
  assert.ok(validateShortFormCatalog(catalog).errors.some((error) => error.includes("exact verified master")));
  item.poster.sourceMasterSha256 = item.master.sha256;
  item.poster.sourceMediaId = item.destinations.instagram.mediaId;
  assert.equal(validateShortFormCatalog(catalog).valid, false);
});

test("TikTok bindings reject foreign handles, stale verification and duplicate IDs", async () => {
  const catalog = await loadShortFormCatalog();
  const item = catalog.items[0];
  item.destinations.tiktok = {
    state: "published", id: "1234567890123456789",
    url: "https://www.tiktok.com/@drmexperienced/video/1234567890123456789",
    publishedAt: catalog.lastVerifiedAt, verifiedAt: catalog.lastVerifiedAt,
  };
  item.destinationCopy.tiktokCaption = "Test fixture only; never a real post.";
  assert.deepEqual(validateShortFormCatalog(catalog), { valid: true, errors: [] });
  const minutePrecision = structuredClone(catalog);
  const minuteDestination = minutePrecision.items[0].destinations.tiktok;
  minuteDestination.publishedAt = "2026-08-08T10:00Z";
  minuteDestination.publishedAtPrecision = "minute";
  assert.deepEqual(validateShortFormCatalog(minutePrecision), { valid: true, errors: [] });
  minuteDestination.publishedAt = "2026-02-30T10:00Z";
  assert.equal(validateShortFormCatalog(minutePrecision).valid, false);
  minuteDestination.publishedAt = "2026-08-08T10:00Z";
  delete minuteDestination.publishedAtPrecision;
  assert.equal(validateShortFormCatalog(minutePrecision).valid, false);
  const foreign = structuredClone(catalog);
  foreign.items[0].destinations.tiktok.url = "https://www.tiktok.com/@someoneelse/video/1234567890123456789";
  assert.equal(validateShortFormCatalog(foreign).valid, false);
  const future = structuredClone(catalog);
  future.items[0].destinations.tiktok.verifiedAt = new Date(Date.parse(catalog.lastVerifiedAt) + 1000).toISOString();
  assert.ok(validateShortFormCatalog(future).errors.some((error) => error.includes("cannot be later")));
  catalog.items[1].destinations.tiktok = structuredClone(item.destinations.tiktok);
  catalog.items[1].destinationCopy.tiktokCaption = "Different test fixture.";
  assert.ok(validateShortFormCatalog(catalog).errors.some((error) => error.includes("Duplicate TikTok video ID")));
});

test("kitchen methods and affiliate resources require useful content and disclosure", async () => {
  const catalog = await loadShortFormCatalog();
  const item = catalog.items[0];
  item.contentType = "kitchen_method";
  assert.ok(validateShortFormCatalog(catalog).errors.some((error) => error.includes("source-backed steps")));
  item.method = { title: "Method shown", steps: ["Follow the recorded demonstration."], note: "Test fixture." };
  item.resources = [{ label: "Product resources", url: "https://drmexperienced.com/affiliates/#block-blue-light", affiliate: true }];
  assert.ok(validateShortFormCatalog(catalog).errors.some((error) => error.includes("visible disclosure")));
  item.affiliateDisclosure = "Affiliate links may earn a commission.";
  assert.deepEqual(validateShortFormCatalog(catalog), { valid: true, errors: [] });
});

async function loadPlatformRegistry() {
  return JSON.parse(await fs.readFile(platformRegistryFile, "utf8"));
}

test("checked-in short-form catalog validates with stable platform identities", async () => {
  const catalog = await loadShortFormCatalog();
  assert.equal(catalog.schemaVersion, 2);
  assert.ok(catalog.revision >= 3);
  assert.ok(catalog.items.length >= 3);
  assert.match(shortFormCatalogHash(catalog), /^[a-f0-9]{64}$/);
  const historicalIds = new Set([
    "short-brain-fog-what-it-feels-like",
    "short-brain-fog-testing-and-basic-solutions",
    "short-cilantro-basil-pesto",
  ]);
  const historical = catalog.items.filter((item) => historicalIds.has(item.id));
  assert.equal(historical.length, 3);

  assert.deepEqual(
    historical.map((item) => [
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
    historical.map((item) => item.destinations.website.path),
    [
      "/shorts/what-brain-fog-feels-like/",
      "/shorts/brain-fog-testing-and-basic-solutions/",
      "/shorts/cilantro-basil-pesto-with-broccoli-sprouts/",
    ]
  );
});

test("checked-in Vimeo platform summary is an exact projection of the short-form catalog", async () => {
  const catalog = await loadShortFormCatalog();
  const platformRegistry = await loadPlatformRegistry();
  const result = validateShortFormPlatformRegistry(catalog, platformRegistry);

  assert.deepEqual(result, { valid: true, errors: [] });
  assert.equal(platformRegistry.platforms.vimeo.currentVideoCount, 11);
  assert.equal(platformRegistry.platforms.vimeo.currentEpisodeVideoCount, 8);
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
    ...catalog.items
      .filter((item) => item.destinations.vimeo.state === "published")
      .map((item) => Date.parse(item.destinations.vimeo.verifiedAt))
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
    if (item.destinations.website.state === "published") {
      item.destinations.website.verifiedAt = laterTimestamp;
    }
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
