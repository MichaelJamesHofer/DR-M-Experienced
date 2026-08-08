import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { catalogHash, episodeHash, loadCatalog } from "./catalog.mjs";
import {
  approvalRecordProblems,
  buildApprovalSnapshot,
  buildTargetPlan,
  canonicalJson,
  hashFile,
  hashSnapshot,
  hashText,
  hostingMigrationIsActive,
  normalizeManifest,
  packetIntegrityProblems,
  releaseApprovalProblems,
  renderApprovalPacket,
  resolveDestinationCopy,
  reviewDocumentProblems,
  validateMediaAssets,
  validateManifest,
  verifySnapshotAssets,
  writePrivateJson,
  writePrivateText,
} from "./lib.mjs";

function resolvedReleasePlan(target, overrides = {}) {
  const values = {
    "rss.com": { initialVisibility: "draft", finalVisibility: "public", license: "not_applicable" },
    spotify: { initialVisibility: "draft", finalVisibility: "public", license: "not_applicable" },
    youtube: { initialVisibility: "private", finalVisibility: "public", license: "youtube" },
    vimeo: { initialVisibility: "nobody", finalVisibility: "anybody", license: "none" },
    instagram: { initialVisibility: "not_applicable", finalVisibility: "public", license: "not_applicable" },
    rumble: {
      initialVisibility: "unlisted",
      finalVisibility: "unlisted",
      license: "rumble_only_option_c",
      monetization: "enabled",
      syndication: { youtube: false, vimeo: false, facebook: false },
      premiumExclusive: false,
      termsRevision: "2026-07-21",
      humanAttestation: {
        termsAcceptance: "human_only_not_recorded",
        rightsConfirmation: "human_only_not_recorded",
        aiMlLicenseAcknowledgement: "human_only_not_recorded",
        thirdPartyRightsConfirmation: "human_only_not_recorded",
      },
    },
  };
  return {
    releaseMode: "hold",
    monetization: "unchanged",
    notifications: "disabled",
    ...values[target],
    ...overrides,
  };
}

function platformIdentity(accountId, containerId, requiredDestinationIds) {
  return {
    destinationIds: { accountId, containerId },
    requiredDestinationIds,
  };
}

function validManifest() {
  return {
    episodeNumber: 8,
    slug: "episode-8",
    title: "Test",
    description: "Approved description",
    publishAt: null,
    explicit: false,
    madeForKids: false,
    containsSyntheticMedia: false,
    paidPromotion: false,
    tags: ["health"],
    assets: { fullVideo: "/tmp/video.mp4", podcastAudio: "/tmp/audio.mp3", instagramReel: null },
    copy: {},
    releasePlan: {
      "rss.com": resolvedReleasePlan("rss.com"),
      spotify: resolvedReleasePlan("spotify"),
      instagram: resolvedReleasePlan("instagram"),
    },
    targets: ["rss.com", "spotify", "apple", "amazon", "instagram"],
  };
}

function validPlatformConfig() {
  return {
    brand: "Dr. M Experienced, with Dr. David Musnick",
    rssFeed: "https://example.test/podcast.rss",
    podcastDistribution: {
      canonicalHost: "rss.com",
      hostAssets: ["podcastAudio"],
      rssDownstream: ["spotify", "apple", "amazon"],
    },
    platforms: {
      "rss.com": { label: "RSS.com", mode: "manual_host_upload", asset: "podcastAudio", rssRole: "canonical_host", channelUrl: "https://example.test/rss-com", ...platformIdentity(null, "dr-m-experienced", ["containerId"]), notes: "" },
      spotify: { label: "Spotify", mode: "manual_video_replacement_after_rss_ingest", asset: "fullVideo", rssRole: "direct_media_destination", channelUrl: "https://example.test/spotify", ...platformIdentity("spotify-account", "abcdefghijklmnopqrstuv", ["containerId"]), notes: "" },
      apple: { label: "Apple", mode: "rss_fanout", source: "rss", dependsOn: "rss.com", channelUrl: "https://example.test/apple", ...platformIdentity(null, "1870433419", ["containerId"]), notes: "" },
      amazon: { label: "Amazon", mode: "rss_fanout", source: "rss", dependsOn: "rss.com", channelUrl: null, ...platformIdentity(null, "amazon-show", ["containerId"]), notes: "" },
      youtube: { label: "YouTube", mode: "api_after_auth_and_audit", asset: "fullVideo", channelUrl: "https://example.test/youtube", ...platformIdentity("UCabcdefghijklmnopqrstuv", "PLabcdefghijklmnopqrstuvwx", ["accountId", "containerId"]), notes: "" },
      vimeo: { label: "Vimeo", mode: "api_after_auth", asset: "fullVideo", channelUrl: "https://example.test/vimeo", ...platformIdentity("12345678", null, ["accountId"]), notes: "" },
      instagram: { label: "Instagram", mode: "api_after_auth", asset: "instagramReel", channelUrl: "https://example.test/instagram", ...platformIdentity("17841400000000000", null, ["accountId"]), notes: "" },
      rumble: { label: "Rumble", mode: "manual_human_only", asset: "fullVideo", channelUrl: "https://example.test/rumble", ...platformIdentity(null, "rumble-channel", ["containerId"]), notes: "" },
    },
  };
}

function assetRecord(key, overrides = {}) {
  return {
    key,
    path: `/tmp/${key}`,
    sizeBytes: 1024,
    modifiedMs: 1,
    sha256: "a".repeat(64),
    media: { durationSeconds: 60, streams: [] },
    loudness: { integratedLufs: -16, truePeakDbtp: -1.5 },
    ...overrides,
  };
}

function validApprovalPacket() {
  const manifest = {
    ...validManifest(),
    episodeNumber: 47,
    title: "Test",
    category: "Health & Fitness",
    publishAt: "2026-08-15T15:00:00.000Z",
    copy: { youtube: "Approved YouTube copy" },
    releasePlan: { youtube: resolvedReleasePlan("youtube") },
    targets: ["youtube"],
  };
  const assets = {
    fullVideo: assetRecord("fullVideo", {
      media: { durationSeconds: 60, streams: [{ type: "video", codec: "h264" }, { type: "audio", codec: "aac" }] },
    }),
  };
  const validation = validateMediaAssets(assets, manifest);
  const targets = buildTargetPlan(validPlatformConfig(), manifest, assets, validation.targetErrors);
  const snapshot = buildApprovalSnapshot({
    platformConfig: validPlatformConfig(),
    manifest,
    assets,
    targets,
    warnings: validation.warnings,
    catalogBinding: {
      revision: 1,
      catalogHash: "c".repeat(64),
      episodeNumber: manifest.episodeNumber,
      episodeHash: "d".repeat(64),
    },
  });
  return {
    id: "episode-8-20260804t120000z",
    status: "prepared",
    createdAt: "2026-08-04T18:00:00.000Z",
    sourceManifestPath: "/tmp/episode.json",
    approvalHash: hashSnapshot(snapshot),
    snapshot,
  };
}

function validRumbleApprovalPacket() {
  const packet = validApprovalPacket();
  packet.snapshot.manifest = {
    ...packet.snapshot.manifest,
    copy: {},
    releasePlan: { rumble: resolvedReleasePlan("rumble") },
    targets: ["rumble"],
  };
  packet.snapshot.targets = buildTargetPlan(
    validPlatformConfig(),
    packet.snapshot.manifest,
    packet.snapshot.assets
  );
  packet.approvalHash = hashSnapshot(packet.snapshot);
  return packet;
}

function validApprovalRecord(packet, reviewDocument) {
  return {
    schemaVersion: 2,
    jobId: packet.id,
    approvalHash: packet.approvalHash,
    reviewDocumentSha256: hashText(reviewDocument),
    approvedAt: "2026-08-04T18:05:00.000Z",
    approvedBy: "Otto",
    attestationType: "self-reported-local-review",
    authorizesUpload: false,
    authorizesRelease: false,
  };
}

test("canonical JSON and approval hashes do not depend on object insertion order", () => {
  const left = { b: 2, a: { d: 4, c: 3 } };
  const right = { a: { c: 3, d: 4 }, b: 2 };
  assert.equal(canonicalJson(left), canonicalJson(right));
  assert.equal(hashSnapshot(left), hashSnapshot(right));
});

test("manifest validation enforces approval flags and known targets", () => {
  const manifest = validManifest();
  delete manifest.explicit;
  manifest.targets.push("unknown");
  const result = validateManifest(manifest);
  assert.ok(result.errors.some((error) => error.includes("explicit")));
  assert.ok(result.errors.some((error) => error.includes("Unknown target")));
});

test("manifest validation keeps episode numbers structured and rejects legacy title prefixes", () => {
  const missingNumber = validManifest();
  delete missingNumber.episodeNumber;
  const result = validateManifest(missingNumber);
  assert.ok(result.errors.some((error) => error.includes("episodeNumber")), result.errors.join("\n"));

  assert.deepEqual(validateManifest(validManifest()).errors, []);

  for (const title of ["Episode 8: Test", "Episode 9 - Test", "Ep. #8: Test"]) {
    const legacyTitle = validManifest();
    legacyTitle.title = title;
    const legacyResult = validateManifest(legacyTitle);
    assert.ok(
      legacyResult.errors.some((error) => error.includes("must omit the leading episode number")),
      `${title} was accepted`
    );
  }
});

test("manifest validation rejects fields and values excluded by the JSON schema", () => {
  const manifest = validManifest();
  manifest.category = 42;
  manifest.copy = { youtube: 42, unexpected: "not supported" };
  manifest.unexpected = true;

  const result = validateManifest(manifest);
  assert.ok(result.errors.some((error) => error.includes("category")), result.errors.join("\n"));
  assert.ok(result.errors.some((error) => error.includes("copy.youtube")), result.errors.join("\n"));
  assert.ok(result.errors.some((error) => error.includes("copy.unexpected")), result.errors.join("\n"));
  assert.ok(result.errors.some((error) => error.includes("unexpected") && !error.includes("copy.")), result.errors.join("\n"));
});

test("manifest validation binds release plans to selected direct destinations", () => {
  const missing = validManifest();
  delete missing.releasePlan["rss.com"];
  let result = validateManifest(missing);
  assert.ok(result.errors.some((error) => error.includes("releasePlan.rss.com is required")), result.errors.join("\n"));

  const extra = validManifest();
  extra.releasePlan.youtube = resolvedReleasePlan("youtube");
  result = validateManifest(extra);
  assert.ok(result.errors.some((error) => error.includes("youtube is not selected")), result.errors.join("\n"));

  const rssFanout = {
    ...validManifest(),
    releasePlan: { "rss.com": resolvedReleasePlan("rss.com") },
    targets: ["rss.com", "apple", "amazon"],
  };
  assert.deepEqual(validateManifest(rssFanout).errors, []);
});

test("scheduled release modes require publishAt and unresolved choices stay visible", () => {
  const manifest = {
    ...validManifest(),
    publishAt: null,
    releasePlan: {
      spotify: resolvedReleasePlan("spotify", {
        releaseMode: "scheduled",
        finalVisibility: "not_selected",
      }),
    },
    targets: ["spotify"],
  };
  const result = validateManifest(manifest);
  assert.ok(result.errors.some((error) => error.includes("scheduled but publishAt is not set")), result.errors.join("\n"));
  assert.ok(result.warnings.some((warning) => warning.includes("finalVisibility")), result.warnings.join("\n"));
});

test("manifest validation rejects unsupported platform visibility and license values", () => {
  const manifest = {
    ...validManifest(),
    releasePlan: {
      youtube: resolvedReleasePlan("youtube", {
        initialVisibility: "banana",
        license: "not-a-real-license",
      }),
    },
    targets: ["youtube"],
  };
  const result = validateManifest(manifest);
  assert.ok(result.errors.some((error) => error.includes("initialVisibility")), result.errors.join("\n"));
  assert.ok(result.errors.some((error) => error.includes("license")), result.errors.join("\n"));
});

test("Rumble release policy permits only Unlisted non-exclusive Option C with syndication and Premium disabled", () => {
  const manifest = {
    ...validManifest(),
    releasePlan: { rumble: resolvedReleasePlan("rumble") },
    targets: ["rumble"],
  };
  assert.deepEqual(validateManifest(manifest).errors, []);
  assert.deepEqual(releaseApprovalProblems(manifest), []);

  const plan = buildTargetPlan(
    validPlatformConfig(),
    manifest,
    { fullVideo: assetRecord("fullVideo") }
  );
  assert.equal(plan[0].readiness, "manual_human_submission_required");
  assert.deepEqual(plan[0].releasePolicyIssues, []);

  for (const license of [
    "exclusive_video_management",
    "video_management_excluding_youtube",
    "rumble_player",
    "personal_use",
  ]) {
    const changed = structuredClone(manifest);
    changed.releasePlan.rumble.license = license;
    const validation = validateManifest(changed);
    assert.ok(validation.errors.some((error) => error.includes("license")), `${license} was accepted`);
  }

  const unsafeChanges = [
    ["public initial visibility", (release) => { release.initialVisibility = "public"; }],
    ["YouTube syndication", (release) => { release.syndication.youtube = true; }],
    ["Vimeo syndication", (release) => { release.syndication.vimeo = true; }],
    ["Facebook syndication", (release) => { release.syndication.facebook = true; }],
    ["Premium exclusivity", (release) => { release.premiumExclusive = true; }],
    ["stale terms", (release) => { release.termsRevision = "2026-07-20"; }],
    ["machine-recorded acceptance", (release) => { release.humanAttestation.termsAcceptance = "accepted"; }],
  ];
  for (const [label, change] of unsafeChanges) {
    const changed = structuredClone(manifest);
    change(changed.releasePlan.rumble);
    const validation = validateManifest(changed);
    assert.ok(validation.errors.length > 0, `${label} was accepted`);
    const changedPlan = buildTargetPlan(
      validPlatformConfig(),
      changed,
      { fullVideo: assetRecord("fullVideo") }
    );
    assert.equal(changedPlan[0].readiness, "release_policy_violation", label);
  }

  const publicAfterManualReview = structuredClone(manifest);
  publicAfterManualReview.releasePlan.rumble.finalVisibility = "public";
  assert.deepEqual(validateManifest(publicAfterManualReview).errors, []);
  assert.equal(
    buildTargetPlan(
      validPlatformConfig(),
      publicAfterManualReview,
      { fullVideo: assetRecord("fullVideo") }
    )[0].readiness,
    "manual_human_submission_required"
  );
});

test("Rumble unresolved controls stay visible and pre-policy release plans fail closed", () => {
  const unresolved = {
    ...validManifest(),
    releasePlan: {
      rumble: resolvedReleasePlan("rumble", {
        license: "not_selected",
        syndication: { youtube: "not_selected", vimeo: false, facebook: false },
        premiumExclusive: "not_selected",
        termsRevision: "not_selected",
      }),
    },
    targets: ["rumble"],
  };
  const validation = validateManifest(unresolved);
  assert.deepEqual(validation.errors, []);
  assert.ok(validation.warnings.some((warning) => warning.includes("syndication.youtube")));
  assert.ok(validation.warnings.some((warning) => warning.includes("premiumExclusive")));
  assert.ok(validation.warnings.some((warning) => warning.includes("termsRevision")));
  assert.ok(releaseApprovalProblems(unresolved).some((problem) => problem.includes("unresolved")));
  const plan = buildTargetPlan(
    validPlatformConfig(),
    unresolved,
    { fullVideo: assetRecord("fullVideo") }
  );
  assert.equal(plan[0].readiness, "release_choices_required");

  const legacy = structuredClone(unresolved);
  legacy.releasePlan.rumble = {
    releaseMode: "hold",
    initialVisibility: "unlisted",
    finalVisibility: "unlisted",
    license: "rumble_only_option_c",
    monetization: "enabled",
    notifications: "disabled",
  };
  const legacyValidation = validateManifest(legacy);
  assert.ok(legacyValidation.errors.some((error) => error.includes("syndication")));
  assert.ok(legacyValidation.errors.some((error) => error.includes("termsRevision")));
  assert.ok(legacyValidation.errors.some((error) => error.includes("humanAttestation")));
});

test("checked-in example keeps every Rumble release decision unresolved", async () => {
  const example = JSON.parse(
    await fs.readFile(new URL("../../publishing/episode.example.json", import.meta.url), "utf8")
  );
  const rumble = example.releasePlan.rumble;
  assert.equal(rumble.releaseMode, "hold");
  for (const key of [
    "initialVisibility",
    "finalVisibility",
    "license",
    "monetization",
    "notifications",
    "premiumExclusive",
    "termsRevision",
  ]) {
    assert.equal(rumble[key], "not_selected", `example preselected Rumble ${key}`);
  }
  assert.deepEqual(rumble.syndication, {
    youtube: "not_selected",
    vimeo: "not_selected",
    facebook: "not_selected",
  });
  assert.deepEqual(validateManifest(example).errors, []);
  assert.ok(releaseApprovalProblems(example).some((problem) => problem.includes("rumble release choices are unresolved")));
});

test("manifest validation requires timezone-qualified RFC 3339 publish times", () => {
  for (const publishAt of [
    "2026-08-15",
    "August 15, 2026",
    "2026-08-15T09:00:00",
    "2026-02-30T09:00:00Z",
    0,
    "2026-08-15T09:00:00+25:00",
  ]) {
    const manifest = validManifest();
    manifest.publishAt = publishAt;
    const result = validateManifest(manifest);
    assert.ok(result.errors.some((error) => error.includes("publishAt")), `${JSON.stringify(publishAt)} was accepted`);
  }

  for (const publishAt of ["2026-08-15T09:00:00-06:00", "2026-08-15T15:00:00Z"]) {
    const manifest = validManifest();
    manifest.publishAt = publishAt;
    assert.deepEqual(validateManifest(manifest).errors, [], `${publishAt} was rejected`);
  }
});

test("manifest normalization freezes publish time as a UTC instant without mutating input", () => {
  const manifest = validManifest();
  manifest.publishAt = "2026-08-15T09:00:00-06:00";

  const normalized = normalizeManifest(manifest);
  assert.equal(normalized.publishAt, "2026-08-15T15:00:00.000Z");
  assert.equal(manifest.publishAt, "2026-08-15T09:00:00-06:00");
});

test("manifest schema and semantic rules agree on platform asset dependencies", () => {
  const spotifyVideo = {
    ...validManifest(),
    assets: { fullVideo: "/tmp/video.mp4" },
    releasePlan: { spotify: resolvedReleasePlan("spotify") },
    targets: ["spotify"],
  };
  assert.deepEqual(validateManifest(spotifyVideo).errors, []);

  const audioOnlySpotify = {
    ...spotifyVideo,
    assets: { podcastAudio: "/tmp/audio.mp3" },
  };
  assert.ok(validateManifest(audioOnlySpotify).errors.some((error) => error.includes("fullVideo")));

  const missingVideo = {
    ...audioOnlySpotify,
    releasePlan: { youtube: resolvedReleasePlan("youtube") },
    targets: ["youtube"],
  };
  assert.ok(validateManifest(missingVideo).errors.some((error) => error.includes("fullVideo")));

  const missingRssAudio = {
    ...audioOnlySpotify,
    assets: { fullVideo: "/tmp/video.mp4" },
    releasePlan: { "rss.com": resolvedReleasePlan("rss.com") },
    targets: ["rss.com"],
  };
  assert.ok(validateManifest(missingRssAudio).errors.some((error) => error.includes("podcastAudio")));

  const missingHost = { ...audioOnlySpotify, releasePlan: {}, targets: ["apple"] };
  assert.ok(validateManifest(missingHost).errors.some((error) => error.includes("rss.com")));
});

test("manifest validation warns when a selected Instagram target lacks a Reel", () => {
  const result = validateManifest(validManifest());
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some((warning) => warning.includes("instagramReel")));
});

test("target planning models RSS fan-out and account gates", () => {
  const manifest = validManifest();
  const config = validPlatformConfig();
  const assets = {
    fullVideo: { sha256: "b".repeat(64) },
    podcastAudio: { sha256: "a".repeat(64) },
    instagramReel: null,
  };
  const plan = buildTargetPlan(config, manifest, assets);
  assert.equal(plan.find((item) => item.id === "rss.com").readiness, "manual_upload_required");
  assert.equal(
    plan.find((item) => item.id === "spotify").readiness,
    "manual_video_replacement_required"
  );
  assert.equal(plan.find((item) => item.id === "apple").readiness, "waiting_for_host_publish");
  assert.equal(plan.find((item) => item.id === "amazon").readiness, "directory_setup_required");
  assert.equal(plan.find((item) => item.id === "instagram").readiness, "asset_required");
});

test("target plans bind stable destination IDs and every release control", () => {
  const manifest = {
    ...validManifest(),
    releasePlan: { youtube: resolvedReleasePlan("youtube") },
    targets: ["youtube"],
  };
  const assets = { fullVideo: { sha256: "b".repeat(64) } };
  const plan = buildTargetPlan(validPlatformConfig(), manifest, assets);
  assert.deepEqual(plan[0].destinationIds, {
    accountId: "UCabcdefghijklmnopqrstuv",
    containerId: "PLabcdefghijklmnopqrstuvwx",
  });
  assert.deepEqual(plan[0].missingDestinationIds, []);
  assert.equal(plan[0].releasePlan.license, "youtube");

  const changedIdentity = structuredClone(plan);
  changedIdentity[0].destinationIds.containerId = "different-playlist";
  assert.notEqual(hashSnapshot(plan), hashSnapshot(changedIdentity));

  const changedRelease = structuredClone(plan);
  changedRelease[0].releasePlan.finalVisibility = "unlisted";
  assert.notEqual(hashSnapshot(plan), hashSnapshot(changedRelease));
});

test("direct video copy defaults to plain text, preserves overrides, and never generates an Instagram caption", () => {
  const manifest = {
    ...validManifest(),
    description: "<p>Master <strong>description</strong> &amp; details.</p><ul><li>First</li></ul>",
    copy: { vimeo: "Exact Vimeo override", instagram: "Exact Reel caption" },
  };

  assert.deepEqual(resolveDestinationCopy(manifest, "youtube"), {
    approvedCopy: "Master description & details.\n\n- First",
    copySource: "description (deterministic YouTube-safe plain-text projection)",
  });
  assert.deepEqual(resolveDestinationCopy(manifest, "rumble"), {
    approvedCopy: "Master description & details.\n\n- First",
    copySource: "description (deterministic plain-text projection)",
  });
  assert.deepEqual(resolveDestinationCopy(manifest, "vimeo"), {
    approvedCopy: "Exact Vimeo override",
    copySource: "copy.vimeo",
  });
  const plan = buildTargetPlan(
    validPlatformConfig(),
    {
      ...manifest,
      releasePlan: {
        youtube: resolvedReleasePlan("youtube"),
        vimeo: resolvedReleasePlan("vimeo"),
        rumble: resolvedReleasePlan("rumble"),
      },
      targets: ["youtube", "vimeo", "rumble"],
    },
    { fullVideo: { sha256: "b".repeat(64) } }
  );
  assert.deepEqual(
    plan.map(({ id, approvedCopy, copySource }) => ({ id, approvedCopy, copySource })),
    [
      {
        id: "youtube",
        approvedCopy: "Master description & details.\n\n- First",
        copySource: "description (deterministic YouTube-safe plain-text projection)",
      },
      { id: "vimeo", approvedCopy: "Exact Vimeo override", copySource: "copy.vimeo" },
      {
        id: "rumble",
        approvedCopy: "Master description & details.\n\n- First",
        copySource: "description (deterministic plain-text projection)",
      },
    ]
  );
  assert.deepEqual(resolveDestinationCopy(manifest, "instagram"), {
    approvedCopy: "Exact Reel caption",
    copySource: "copy.instagram",
  });

  delete manifest.copy.instagram;
  assert.deepEqual(resolveDestinationCopy(manifest, "instagram"), {
    approvedCopy: null,
    copySource: "not provided",
  });
  const validation = validateManifest({
    ...manifest,
    releasePlan: { instagram: resolvedReleasePlan("instagram") },
    targets: ["instagram"],
  });
  assert.ok(validation.warnings.some((warning) => warning.includes("no caption will be generated")));
});

test("target planning blocks missing IDs and unresolved release choices", () => {
  const manifest = {
    ...validManifest(),
    releasePlan: { youtube: resolvedReleasePlan("youtube") },
    targets: ["youtube"],
  };
  const assets = { fullVideo: { sha256: "b".repeat(64) } };
  const missingIdentityConfig = validPlatformConfig();
  missingIdentityConfig.platforms.youtube.destinationIds.accountId = null;
  let plan = buildTargetPlan(missingIdentityConfig, manifest, assets);
  assert.equal(plan[0].readiness, "destination_id_required");
  assert.deepEqual(plan[0].missingDestinationIds, ["accountId"]);

  manifest.releasePlan.youtube.finalVisibility = "not_selected";
  plan = buildTargetPlan(validPlatformConfig(), manifest, assets);
  assert.equal(plan[0].readiness, "release_choices_required");
  assert.deepEqual(plan[0].unresolvedReleaseChoices, ["finalVisibility"]);

  const invalidIdentityConfig = validPlatformConfig();
  invalidIdentityConfig.platforms.youtube.destinationIds.accountId = "wrong-channel";
  plan = buildTargetPlan(invalidIdentityConfig, {
    ...manifest,
    releasePlan: { youtube: resolvedReleasePlan("youtube") },
  }, assets);
  assert.equal(plan[0].readiness, "destination_id_invalid");
  assert.deepEqual(plan[0].invalidDestinationIds, ["accountId"]);
});

test("RSS destinations cannot appear ready without the canonical host action", () => {
  const manifest = { ...validManifest(), releasePlan: {}, targets: ["apple"] };
  const plan = buildTargetPlan(validPlatformConfig(), manifest, {});
  assert.equal(plan[0].readiness, "host_publish_dependency_missing");
  assert.equal(plan[0].asset, "rss_feed");
});

test("RSS.com requires real audio while an explicit Spotify target requires replacement video", () => {
  const noAudio = assetRecord("podcastAudio", {
    media: { durationSeconds: 60, streams: [{ type: "video", codec: "h264" }] },
  });
  const rssManifest = {
    ...validManifest(),
    releasePlan: { "rss.com": resolvedReleasePlan("rss.com") },
    targets: ["rss.com"],
  };
  const rssValidation = validateMediaAssets({ podcastAudio: noAudio }, rssManifest);
  assert.deepEqual(rssValidation.targetErrors["rss.com"], ["podcastAudio has no audio stream."]);

  const spotifyManifest = {
    ...validManifest(),
    assets: { fullVideo: null, podcastAudio: "/tmp/audio.mp3" },
    releasePlan: { spotify: resolvedReleasePlan("spotify") },
    targets: ["spotify"],
  };
  assert.ok(
    validateManifest(spotifyManifest).errors.some((error) =>
      error.includes("Spotify replacement requires assets.fullVideo")
    )
  );
});

test("RSS.com and Spotify block unmeasured or out-of-range loudness", () => {
  const audioMedia = { durationSeconds: 60, streams: [{ type: "audio", codec: "mp3" }] };
  const rssManifest = {
    ...validManifest(),
    releasePlan: { "rss.com": resolvedReleasePlan("rss.com") },
    targets: ["rss.com"],
  };
  const quietAudio = assetRecord("podcastAudio", {
    media: audioMedia,
    loudness: { integratedLufs: -28.75, truePeakDbtp: -7.5 },
  });
  const quietValidation = validateMediaAssets({ podcastAudio: quietAudio }, rssManifest);
  assert.ok(
    quietValidation.targetErrors["rss.com"].some((error) => error.includes("outside the approved")),
    quietValidation.warnings.join("\n")
  );

  const unmeasuredAudio = assetRecord("podcastAudio", { media: audioMedia, loudness: null });
  const unmeasuredValidation = validateMediaAssets({ podcastAudio: unmeasuredAudio }, rssManifest);
  assert.ok(
    unmeasuredValidation.targetErrors["rss.com"].some((error) => error.includes("missing a valid")),
    unmeasuredValidation.warnings.join("\n")
  );

  const spotifyManifest = {
    ...validManifest(),
    releasePlan: { spotify: resolvedReleasePlan("spotify") },
    targets: ["spotify"],
  };
  const hotVideo = assetRecord("fullVideo", {
    media: {
      durationSeconds: 60,
      streams: [{ type: "video", codec: "h264" }, { type: "audio", codec: "aac" }],
    },
    loudness: { integratedLufs: -16, truePeakDbtp: -0.25 },
  });
  const hotValidation = validateMediaAssets({ fullVideo: hotVideo }, spotifyManifest);
  assert.ok(
    hotValidation.targetErrors.spotify.some((error) => error.includes("true peak")),
    hotValidation.warnings.join("\n")
  );
});

test("media preflight applies upload limits only to selected targets", () => {
  const fullVideo = assetRecord("fullVideo", {
    sizeBytes: 257 * 1024 ** 3,
    media: { durationSeconds: 13 * 60 * 60, streams: [{ type: "video", codec: "h264" }, { type: "audio", codec: "aac" }] },
  });

  const vimeoManifest = {
    ...validManifest(),
    releasePlan: { vimeo: resolvedReleasePlan("vimeo") },
    targets: ["vimeo"],
  };
  const vimeoValidation = validateMediaAssets({ fullVideo }, vimeoManifest);
  assert.deepEqual(vimeoValidation.targetErrors.vimeo, []);
  assert.ok(!vimeoValidation.warnings.some((warning) => warning.includes("YouTube")), vimeoValidation.warnings.join("\n"));

  const youtubeManifest = {
    ...validManifest(),
    releasePlan: { youtube: resolvedReleasePlan("youtube") },
    targets: ["youtube"],
  };
  const youtubeValidation = validateMediaAssets({ fullVideo }, youtubeManifest);
  assert.ok(youtubeValidation.targetErrors.youtube.some((error) => error.includes("12-hour")), youtubeValidation.warnings.join("\n"));
  assert.ok(!youtubeValidation.warnings.some((warning) => warning.includes("Vimeo")), youtubeValidation.warnings.join("\n"));
  const youtubePlan = buildTargetPlan(
    validPlatformConfig(),
    youtubeManifest,
    { fullVideo },
    youtubeValidation.targetErrors
  );
  assert.equal(youtubePlan[0].readiness, "asset_invalid");
});

test("media preflight enforces the Instagram API's 300 MB Reel limit", () => {
  const instagramReel = assetRecord("instagramReel", {
    sizeBytes: 301 * 1024 ** 2,
    media: {
      durationSeconds: 60,
      streams: [
        { type: "video", codec: "h264", width: 1080, height: 1920 },
        { type: "audio", codec: "aac", sampleRate: 48000 },
      ],
    },
  });
  const manifest = {
    ...validManifest(),
    releasePlan: { instagram: resolvedReleasePlan("instagram") },
    targets: ["instagram"],
  };
  const validation = validateMediaAssets({ instagramReel }, manifest);
  assert.ok(validation.targetErrors.instagram.some((error) => error.includes("300 MB")), validation.warnings.join("\n"));
  const plan = buildTargetPlan(validPlatformConfig(), manifest, { instagramReel }, validation.targetErrors);
  assert.equal(plan[0].readiness, "asset_invalid");
});

test("approval rendering is deterministic and includes every publishing field", () => {
  const packet = validApprovalPacket();
  const { assets, manifest } = packet.snapshot;

  const rendered = renderApprovalPacket(packet);
  const reorderedPacket = structuredClone(packet);
  reorderedPacket.snapshot.manifest = Object.fromEntries(Object.entries(manifest).reverse());
  reorderedPacket.snapshot.assets = Object.fromEntries(Object.entries(assets).reverse());
  assert.equal(rendered, renderApprovalPacket(reorderedPacket));
  assert.match(rendered, /Episode number:\s*47/i);
  assert.match(rendered, /Category:\s*Health & Fitness/i);
  assert.match(rendered, /2026-08-15T15:00:00.000Z/);
  assert.match(rendered, /Approved YouTube copy/);
  assert.match(rendered, /Synthetic media:\s*false/i);
  assert.match(rendered, /Paid promotion:\s*false/i);
  assert.match(rendered, /UCabcdefghijklmnopqrstuv/);
  assert.match(rendered, /PLabcdefghijklmnopqrstuvwx/);
  assert.match(rendered, /Initial visibility/);
  assert.match(rendered, /Final visibility/);
  assert.match(rendered, /youtube/);
  assert.match(rendered, /unchanged/);
  assert.match(rendered, /disabled/);
  assert.match(rendered, /Master catalog binding/);
  assert.match(rendered, new RegExp("c{64}"));
  assert.match(rendered, new RegExp("d{64}"));

  const changedBinding = structuredClone(packet.snapshot);
  changedBinding.catalogBinding.episodeHash = "e".repeat(64);
  assert.notEqual(hashSnapshot(packet.snapshot), hashSnapshot(changedBinding));
});

test("approval rendering surfaces every Rumble safety control and leaves attestations human-only", () => {
  const rendered = renderApprovalPacket(validRumbleApprovalPacket());
  assert.match(rendered, /Rumble non-exclusive safety controls/);
  assert.match(rendered, /rumble_only_option_c/);
  assert.match(rendered, /YouTube syndication \| false/);
  assert.match(rendered, /Vimeo syndication \| false/);
  assert.match(rendered, /Facebook syndication \| false/);
  assert.match(rendered, /Premium exclusive \| false/);
  assert.match(rendered, /2026-07-21/);
  assert.match(rendered, /AI\/ML license/i);
  assert.match(rendered, /human-only/i);
  assert.match(rendered, /prohibit automated site interaction/i);
  assert.match(rendered, /cannot accept them or submit the form/i);
});

test("packet and review integrity helpers detect stale or tampered state", () => {
  const packet = validApprovalPacket();
  const reviewDocument = renderApprovalPacket(packet);
  assert.deepEqual(packetIntegrityProblems(packet, packet.id), []);
  assert.deepEqual(reviewDocumentProblems(packet, reviewDocument), []);

  const tamperedPacket = structuredClone(packet);
  tamperedPacket.snapshot.manifest.title = "Tampered title";
  assert.ok(packetIntegrityProblems(tamperedPacket, packet.id).some((problem) => problem.includes("approval hash")));
  assert.ok(reviewDocumentProblems(tamperedPacket, reviewDocument).length > 0);
  assert.ok(packetIntegrityProblems(packet, "different-job").some((problem) => problem.includes("job id")));
  assert.ok(reviewDocumentProblems(packet, `${reviewDocument}\nTampered`).length > 0);

  const unsupportedPacket = structuredClone(packet);
  unsupportedPacket.snapshot.schemaVersion = 99;
  unsupportedPacket.approvalHash = hashSnapshot(unsupportedPacket.snapshot);
  assert.ok(packetIntegrityProblems(unsupportedPacket, packet.id).some((problem) => problem.includes("schema version")));

  const preRumblePolicyPacket = structuredClone(packet);
  preRumblePolicyPacket.snapshot.schemaVersion = 4;
  preRumblePolicyPacket.approvalHash = hashSnapshot(preRumblePolicyPacket.snapshot);
  assert.ok(
    packetIntegrityProblems(preRumblePolicyPacket, packet.id).some((problem) => problem.includes("schema version"))
  );

  const unsafeRumblePacket = validRumbleApprovalPacket();
  unsafeRumblePacket.snapshot.manifest.releasePlan.rumble.syndication.youtube = true;
  unsafeRumblePacket.snapshot.targets[0].releasePlan.syndication.youtube = true;
  unsafeRumblePacket.snapshot.targets[0].releasePolicyIssues = ["Rumble youtube syndication must be disabled."];
  unsafeRumblePacket.approvalHash = hashSnapshot(unsafeRumblePacket.snapshot);
  assert.ok(
    packetIntegrityProblems(unsafeRumblePacket, unsafeRumblePacket.id).some((problem) =>
      problem.includes("Stored packet manifest is invalid")
    )
  );

  const invalidBinding = structuredClone(packet);
  invalidBinding.snapshot.catalogBinding.episodeNumber += 1;
  invalidBinding.approvalHash = hashSnapshot(invalidBinding.snapshot);
  assert.ok(packetIntegrityProblems(invalidBinding, packet.id).some((problem) => problem.includes("master episode number")));

  const missingBinding = structuredClone(packet);
  delete missingBinding.snapshot.catalogBinding;
  missingBinding.approvalHash = hashSnapshot(missingBinding.snapshot);
  assert.ok(packetIntegrityProblems(missingBinding, packet.id).some((problem) => problem.includes("binding is missing")));
});

test("approval records remain bound to the packet and exact reviewed document", () => {
  const packet = validApprovalPacket();
  const reviewDocument = renderApprovalPacket(packet);
  const approval = validApprovalRecord(packet, reviewDocument);
  assert.deepEqual(approvalRecordProblems(packet, approval, reviewDocument), []);

  const staleApproval = { ...approval, approvalHash: "0".repeat(64) };
  assert.ok(approvalRecordProblems(packet, staleApproval, reviewDocument).some((problem) => problem.includes("hash")));

  const releaseEscalation = { ...approval, authorizesRelease: true };
  assert.ok(approvalRecordProblems(packet, releaseEscalation, reviewDocument).some((problem) => problem.includes("must not authorize")));

  const uploadEscalation = { ...approval, authorizesUpload: true };
  assert.ok(approvalRecordProblems(packet, uploadEscalation, reviewDocument).some((problem) => problem.includes("must not authorize")));

  assert.ok(
    approvalRecordProblems(packet, approval, `${reviewDocument}\nTampered`).some((problem) => problem.includes("reviewed document"))
  );
});

test("asset verification detects changed content", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "drm-publisher-test-"));
  const filePath = path.join(directory, "asset.txt");
  try {
    await fs.writeFile(filePath, "approved");
    const sha256 = await hashFile(filePath);
    const stats = await fs.stat(filePath);
    const snapshot = { assets: { fullVideo: { key: "fullVideo", path: filePath, sizeBytes: stats.size, sha256 } } };
    assert.deepEqual(await verifySnapshotAssets(snapshot), []);
    await fs.writeFile(filePath, "modified");
    assert.ok((await verifySnapshotAssets(snapshot)).length > 0);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

async function assertAtomicExclusiveWrites(write, read) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "drm-publisher-exclusive-test-"));
  const filePath = path.join(directory, "exclusive-output");
  try {
    const results = await Promise.allSettled(
      Array.from({ length: 128 }, (_, index) => write(filePath, index))
    );
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    assert.equal(fulfilled.length, 1, `${fulfilled.length} exclusive writers succeeded`);
    assert.ok(Number.isInteger(await read(filePath)));
    assert.equal((await fs.stat(filePath)).mode & 0o777, 0o600);
    assert.deepEqual((await fs.readdir(directory)).sort(), ["exclusive-output"]);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

test("private writers provide atomic exclusive creation under contention", async () => {
  await assertAtomicExclusiveWrites(
    (filePath, index) => writePrivateJson(filePath, { index }, { exclusive: true }),
    async (filePath) => JSON.parse(await fs.readFile(filePath, "utf8")).index
  );
  await assertAtomicExclusiveWrites(
    (filePath, index) => writePrivateText(filePath, String(index), { exclusive: true }),
    async (filePath) => Number(await fs.readFile(filePath, "utf8"))
  );
});

test("hosting migration gate requires aligned active nonterminal records", () => {
  const activeMigration = {
    status: "pre_redirect_cleanup",
    decision: { active: true },
    gates: { redirectVerified: false },
  };
  const activePending = { active: true, status: "pre_redirect_cleanup" };
  assert.equal(hostingMigrationIsActive(activeMigration, activePending), true);
  assert.equal(
    hostingMigrationIsActive({ ...activeMigration, decision: { active: false } }, activePending),
    false
  );
  assert.equal(hostingMigrationIsActive(activeMigration, { ...activePending, active: false }), false);
  assert.equal(
    hostingMigrationIsActive(
      { ...activeMigration, status: "completed", decision: { active: false } },
      { active: false, status: "completed" }
    ),
    false
  );
  assert.equal(hostingMigrationIsActive(null, { active: true }), false);
});

test("CLI prepare rejects episodes missing from or drifting from the master catalog before inspecting media", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "drm-publisher-catalog-bind-test-"));
  const cliPath = fileURLToPath(new URL("./cli.mjs", import.meta.url));
  const examplePath = fileURLToPath(new URL("../../publishing/episode.example.json", import.meta.url));
  const example = JSON.parse(await fs.readFile(examplePath, "utf8"));
  const runCli = (manifestPath) =>
    spawnSync(process.execPath, [cliPath, "prepare", manifestPath], {
      encoding: "utf8",
      env: { ...process.env, DRM_PUBLISH_HOME: path.join(directory, "state"), HOME: directory },
    });

  try {
    const unregisteredPath = path.join(directory, "unregistered.json");
    await fs.writeFile(unregisteredPath, `${JSON.stringify(example, null, 2)}\n`);
    const unregistered = runCli(unregisteredPath);
    assert.equal(unregistered.status, 1);
    assert.match(unregistered.stderr, /is not in publishing\/master-catalog\.json/);
    assert.doesNotMatch(unregistered.stdout, /Inspecting/);

    const driftedPath = path.join(directory, "drifted.json");
    await fs.writeFile(driftedPath, `${JSON.stringify({ ...example, episodeNumber: 1 }, null, 2)}\n`);
    const drifted = runCli(driftedPath);
    assert.equal(drifted.status, 1);
    assert.match(drifted.stderr, /Manifest differs from the master catalog/);
    assert.doesNotMatch(drifted.stdout, /Inspecting/);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("CLI fails closed on review tampering, bad confirmation, and stale assets", async () => {
  const { spawn } = await import("node:child_process");
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "drm-publisher-cli-test-"));
  const state = path.join(directory, "state");
  const assetPath = path.join(directory, "video.mp4");
  const cliPath = fileURLToPath(new URL("./cli.mjs", import.meta.url));
  const runCli = (...args) =>
    spawnSync(process.execPath, [cliPath, ...args], {
      encoding: "utf8",
      env: { ...process.env, DRM_PUBLISH_HOME: state, HOME: directory },
    });
  const runCliAsync = (...args) =>
    new Promise((resolve) => {
      const child = spawn(process.execPath, [cliPath, ...args], {
        env: { ...process.env, DRM_PUBLISH_HOME: state, HOME: directory },
      });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("close", (status) => resolve({ status, stdout, stderr }));
    });

  try {
    await fs.writeFile(assetPath, "approved asset", { mode: 0o600 });
    const stats = await fs.stat(assetPath);
    const packet = validApprovalPacket();
    const catalog = await loadCatalog();
    const catalogEpisode = catalog.episodes[0];
    Object.assign(packet.snapshot.manifest, {
      episodeNumber: catalogEpisode.number,
      slug: catalogEpisode.slug,
      title: catalogEpisode.title,
      description: catalogEpisode.description.full,
      explicit: catalogEpisode.contentFlags.explicit,
    });
    packet.snapshot.catalogBinding = {
      revision: catalog.revision,
      catalogHash: catalogHash(catalog),
      episodeNumber: catalogEpisode.number,
      episodeHash: episodeHash(catalogEpisode),
    };
    packet.snapshot.assets.fullVideo.path = assetPath;
    packet.snapshot.assets.fullVideo.sizeBytes = stats.size;
    packet.snapshot.assets.fullVideo.sha256 = await hashFile(assetPath);
    packet.snapshot.targets[0].assetSha256 = packet.snapshot.assets.fullVideo.sha256;
    packet.approvalHash = hashSnapshot(packet.snapshot);

    const jobDirectory = path.join(state, "jobs", packet.id);
    const reviewDocument = renderApprovalPacket(packet);
    await fs.mkdir(jobDirectory, { recursive: true, mode: 0o700 });
    await fs.writeFile(path.join(jobDirectory, "packet.json"), `${JSON.stringify(packet, null, 2)}\n`, { mode: 0o600 });
    await fs.writeFile(path.join(jobDirectory, "approval.md"), reviewDocument, { mode: 0o600 });

    const shown = runCli("show", packet.id);
    assert.equal(shown.status, 0, shown.stderr);
    assert.equal(shown.stdout, reviewDocument);

    const staleCatalogPacket = structuredClone(packet);
    staleCatalogPacket.snapshot.catalogBinding.catalogHash = "0".repeat(64);
    staleCatalogPacket.approvalHash = hashSnapshot(staleCatalogPacket.snapshot);
    const staleCatalogReview = renderApprovalPacket(staleCatalogPacket);
    await fs.writeFile(path.join(jobDirectory, "packet.json"), `${JSON.stringify(staleCatalogPacket, null, 2)}\n`, { mode: 0o600 });
    await fs.writeFile(path.join(jobDirectory, "approval.md"), staleCatalogReview, { mode: 0o600 });
    const staleCatalog = runCli("show", packet.id);
    assert.equal(staleCatalog.status, 1);
    assert.match(staleCatalog.stderr, /master catalog binding is stale/i);
    await fs.writeFile(path.join(jobDirectory, "packet.json"), `${JSON.stringify(packet, null, 2)}\n`, { mode: 0o600 });
    await fs.writeFile(path.join(jobDirectory, "approval.md"), reviewDocument, { mode: 0o600 });

    for (const readiness of [
      "destination_id_required",
      "destination_id_invalid",
      "release_choices_required",
      "release_policy_violation",
    ]) {
      const blockedPacket = structuredClone(packet);
      blockedPacket.snapshot.targets[0].readiness = readiness;
      blockedPacket.approvalHash = hashSnapshot(blockedPacket.snapshot);
      const blockedReview = renderApprovalPacket(blockedPacket);
      await fs.writeFile(path.join(jobDirectory, "packet.json"), `${JSON.stringify(blockedPacket, null, 2)}\n`, { mode: 0o600 });
      await fs.writeFile(path.join(jobDirectory, "approval.md"), blockedReview, { mode: 0o600 });
      const blockedConfirmation = `approve ${blockedPacket.id} ${blockedPacket.approvalHash}`;
      const blocked = runCli(
        "approve",
        blockedPacket.id,
        "--hash",
        blockedPacket.approvalHash,
        "--by",
        "Reviewer",
        "--confirm",
        blockedConfirmation
      );
      assert.equal(blocked.status, 1);
      assert.match(blocked.stderr, new RegExp(readiness));
    }
    await fs.writeFile(path.join(jobDirectory, "packet.json"), `${JSON.stringify(packet, null, 2)}\n`, { mode: 0o600 });
    await fs.writeFile(path.join(jobDirectory, "approval.md"), reviewDocument, { mode: 0o600 });

    await fs.appendFile(path.join(jobDirectory, "approval.md"), "tampered\n");
    const tampered = runCli("show", packet.id);
    assert.equal(tampered.status, 1);
    assert.match(tampered.stderr, /review integrity check failed/i);
    await fs.writeFile(path.join(jobDirectory, "approval.md"), reviewDocument, { mode: 0o600 });

    const confirmation = `approve ${packet.id} ${packet.approvalHash}`;
    const rejected = runCli(
      "approve",
      packet.id,
      "--hash",
      packet.approvalHash,
      "--by",
      "Reviewer",
      "--confirm",
      `${confirmation}-wrong`
    );
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /confirmation phrase/i);

    const approved = runCli(
      "approve",
      packet.id,
      "--hash",
      packet.approvalHash,
      "--by",
      "Reviewer",
      "--confirm",
      confirmation
    );
    assert.equal(approved.status, 0, approved.stderr);

    const operationId = "youtube-upload-test-1";
    const receiptConfirmation =
      `record-receipt ${packet.id} youtube ${packet.approvalHash} ${operationId}`;
    const rejectedReceipt = runCli(
      "receipt",
      packet.id,
      "--platform",
      "youtube",
      "--operation-id",
      operationId,
      "--status",
      "accepted",
      "--by",
      "test-adapter",
      "--confirm",
      `${receiptConfirmation}-wrong`,
    );
    assert.equal(rejectedReceipt.status, 1);
    assert.match(rejectedReceipt.stderr, /confirmation phrase/i);

    const acceptedReceipt = runCli(
      "receipt",
      packet.id,
      "--platform",
      "youtube",
      "--operation-id",
      operationId,
      "--status",
      "accepted",
      "--by",
      "test-adapter",
      "--evidence",
      "provider_request=accepted",
      "--confirm",
      receiptConfirmation,
    );
    assert.equal(acceptedReceipt.status, 0, acceptedReceipt.stderr);
    assert.match(acceptedReceipt.stdout, /Recorded immutable youtube accepted receipt/);

    const publishedReceipt = runCli(
      "receipt",
      packet.id,
      "--platform",
      "youtube",
      "--operation-id",
      operationId,
      "--status",
      "published",
      "--by",
      "test-adapter",
      "--remote-id",
      "video123",
      "--remote-url",
      "https://www.youtube.com/watch?v=video123",
      "--evidence",
      "public_readback=matched",
      "--confirm",
      receiptConfirmation,
    );
    assert.equal(publishedReceipt.status, 0, publishedReceipt.stderr);

    const duplicateReceipt = runCli(
      "receipt",
      packet.id,
      "--platform",
      "youtube",
      "--operation-id",
      operationId,
      "--status",
      "published",
      "--by",
      "test-adapter",
      "--remote-id",
      "video123",
      "--confirm",
      receiptConfirmation,
    );
    assert.equal(duplicateReceipt.status, 1);
    assert.match(duplicateReceipt.stderr, /already exists/);

    const genericVerification = runCli(
      "receipt",
      packet.id,
      "--platform",
      "youtube",
      "--operation-id",
      operationId,
      "--status",
      "verified",
      "--by",
      "test-adapter",
      "--remote-id",
      "video123",
      "--remote-url",
      "https://www.youtube.com/watch?v=video123",
      "--evidence",
      "public_readback=matched",
      "--confirm",
      receiptConfirmation,
    );
    assert.equal(genericVerification.status, 1);
    assert.match(genericVerification.stderr, /meaningful typed readback/);

    const inconsistentUrl = runCli(
      "receipt",
      packet.id,
      "--platform",
      "youtube",
      "--operation-id",
      operationId,
      "--status",
      "verified",
      "--by",
      "test-adapter",
      "--remote-id",
      "video123",
      "--remote-url",
      "https://youtu.be/video123",
      "--evidence",
      "public_readback=Title, description, artwork, and video matched",
      "--confirm",
      receiptConfirmation,
    );
    assert.equal(inconsistentUrl.status, 1);
    assert.match(inconsistentUrl.stderr, /Remote URL conflicts/);

    const verifiedReceipt = runCli(
      "receipt",
      packet.id,
      "--platform",
      "youtube",
      "--operation-id",
      operationId,
      "--status",
      "verified",
      "--by",
      "test-adapter",
      "--remote-id",
      "video123",
      "--remote-url",
      "https://www.youtube.com/watch?v=video123",
      "--evidence",
      "public_readback=Title, description, artwork, and video matched",
      "--confirm",
      receiptConfirmation,
    );
    assert.equal(verifiedReceipt.status, 0, verifiedReceipt.stderr);

    const regressedReceipt = runCli(
      "receipt",
      packet.id,
      "--platform",
      "youtube",
      "--operation-id",
      operationId,
      "--status",
      "processing",
      "--by",
      "test-adapter",
      "--confirm",
      receiptConfirmation,
    );
    assert.equal(regressedReceipt.status, 1);
    assert.match(regressedReceipt.stderr, /cannot transition from verified to processing/);

    const supersededReceipt = runCli(
      "receipt",
      packet.id,
      "--platform",
      "youtube",
      "--operation-id",
      operationId,
      "--status",
      "superseded",
      "--by",
      "test-adapter",
      "--remote-id",
      "video123",
      "--remote-url",
      "https://www.youtube.com/watch?v=video123",
      "--evidence",
      "supersession=Replacement upload operation was approved",
      "--confirm",
      receiptConfirmation,
    );
    assert.equal(supersededReceipt.status, 0, supersededReceipt.stderr);

    const terminalReuse = runCli(
      "receipt",
      packet.id,
      "--platform",
      "youtube",
      "--operation-id",
      operationId,
      "--status",
      "failed",
      "--by",
      "test-adapter",
      "--evidence",
      "error=Late failure after terminal state",
      "--confirm",
      receiptConfirmation,
    );
    assert.equal(terminalReuse.status, 1);
    assert.match(terminalReuse.stderr, /cannot transition from superseded to failed/);

    const concurrentOperationId = "youtube-upload-test-2";
    const concurrentConfirmation =
      `record-receipt ${packet.id} youtube ${packet.approvalHash} ${concurrentOperationId}`;
    const concurrentArgs = [
      "receipt",
      packet.id,
      "--platform",
      "youtube",
      "--operation-id",
      concurrentOperationId,
      "--status",
      "accepted",
      "--by",
      "test-adapter",
      "--evidence",
      "provider_request=Provider accepted replacement operation",
      "--confirm",
      concurrentConfirmation,
    ];
    const concurrentResults = await Promise.all([
      runCliAsync(...concurrentArgs),
      runCliAsync(...concurrentArgs),
    ]);
    assert.equal(concurrentResults.filter((result) => result.status === 0).length, 1);
    assert.equal(concurrentResults.filter((result) => result.status === 1).length, 1);
    assert.match(concurrentResults.find((result) => result.status === 1).stderr, /already exists/);

    const receipts = runCli("receipts", packet.id);
    assert.equal(receipts.status, 0, receipts.stderr);
    assert.match(receipts.stdout, /youtube\taccepted\tyoutube-upload-test-1/);
    assert.match(receipts.stdout, /youtube\tpublished\tyoutube-upload-test-1\tvideo123/);
    assert.match(receipts.stdout, /youtube\tverified\tyoutube-upload-test-1\tvideo123/);
    assert.match(receipts.stdout, /youtube\tsuperseded\tyoutube-upload-test-1\tvideo123/);
    assert.match(receipts.stdout, /youtube\taccepted\tyoutube-upload-test-2/);

    const status = runCli("status", packet.id);
    assert.equal(status.status, 0, status.stderr);
    assert.match(status.stdout, /Upload\/release authorization: not granted/);
    assert.match(status.stdout, /Remote delivery receipts: 5/);
    assert.match(status.stdout, /receipt accepted \(youtube-upload-test-2\)/);

    await fs.appendFile(assetPath, "changed");
    const stale = runCli("status", packet.id);
    assert.equal(stale.status, 1);
    assert.match(stale.stderr, /Asset verification failed/i);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
