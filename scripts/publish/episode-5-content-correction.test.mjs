import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  EPISODE_5_CONTENT_CORRECTION_IDENTITIES,
  EPISODE_5_CONTENT_CORRECTION_SOURCE,
  validateEpisode5ContentCorrection,
} from "./episode-5-content-correction.mjs";

const root = new URL("../../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

function pendingTarget({ action, source, existingId, existingUrl = null, status = "pending" }) {
  return {
    status,
    action,
    source,
    sourceSha256: null,
    sourceSizeBytes: null,
    existingId,
    existingUrl,
    replacementId: null,
    replacementUrl: null,
    verifiedAt: null,
    evidenceSha256: null,
  };
}

function pendingReceipt() {
  return {
    $schema: "./episode-5-content-correction.schema.json",
    schemaVersion: 1,
    correctionId: "episode-5-content-correction-2026-08-22",
    status: "corrected_source_validated",
    recordedAt: "2026-08-22T19:00:00Z",
    updatedAt: "2026-08-22T19:00:00Z",
    catalog: {
      source: "publishing/master-catalog.json",
      baselineRevision: 12,
      currentRevision: null,
      publisherHash: null,
    },
    episode: {
      ...EPISODE_5_CONTENT_CORRECTION_IDENTITIES,
      contaminatedYouTubeVideoIds: [
        ...EPISODE_5_CONTENT_CORRECTION_IDENTITIES.contaminatedYouTubeVideoIds,
      ],
    },
    correctedSource: {
      ...EPISODE_5_CONTENT_CORRECTION_SOURCE,
      validatedAt: "2026-08-22T19:00:00Z",
      badExchangeRemoved: true,
      fullDecodePassed: true,
    },
    targets: {
      rssCom: pendingTarget({
        action: "replace_existing_episode_audio",
        source: "episode-005-podcast-audio",
        existingId: "3050762",
      }),
      spotify: pendingTarget({
        action: "replace_existing_episode_video",
        source: "episode-005-spotify-video",
        existingId: "6fQAClcR4AAuueHjBNlrJC",
        existingUrl: "https://open.spotify.com/episode/6fQAClcR4AAuueHjBNlrJC",
      }),
      youtube: pendingTarget({
        action: "publish_corrected_video_and_archive_contaminated_uploads",
        source: "episode-005-master-video",
        existingId: "N_F0hhHkIQ4",
        existingUrl: "https://www.youtube.com/watch?v=N_F0hhHkIQ4",
      }),
      vimeo: pendingTarget({
        action: "replace_existing_video_version",
        source: "episode-005-master-video",
        existingId: "1204939658",
        existingUrl: "https://vimeo.com/1204939658",
      }),
      rumble: pendingTarget({
        action: "manual_human_only_reupload",
        source: "episode-005-master-video",
        existingId: "v7bvj32",
        status: "pending_manual_human_action",
      }),
      apple: pendingTarget({
        action: "verify_rss_fanout",
        source: "rss.com",
        existingId: "1000774398633",
        status: "pending_rss_fanout",
      }),
      website: pendingTarget({
        action: "deploy_verified_episode_projection",
        source: "publishing/master-catalog.json",
        existingId: null,
        existingUrl: "https://drmexperienced.com/episodes/episode-5-energy/",
      }),
    },
    completion: {
      verifiedComplete: [],
      pending: ["rssCom", "spotify", "youtube", "vimeo", "rumble", "apple", "website"],
    },
  };
}

function completeTarget(receipt, name, { id, url }) {
  const target = receipt.targets[name];
  target.status = "complete_verified";
  target.sourceSha256 = "a".repeat(64);
  target.sourceSizeBytes = 1234;
  target.replacementId = id;
  target.replacementUrl = url;
  target.verifiedAt = "2026-08-22T20:00:00Z";
  target.evidenceSha256 = "b".repeat(64);
  receipt.completion.pending = receipt.completion.pending.filter(
    (candidate) => candidate !== name,
  );
  receipt.completion.verifiedComplete.push(name);
}

test("checked-in Episode 5 receipt matches the current catalog and approved asset routing", async () => {
  const [receipt, catalog] = await Promise.all([
    readJson("publishing/episode-5-content-correction.json"),
    readJson("publishing/master-catalog.json"),
  ]);

  assert.deepEqual(validateEpisode5ContentCorrection(receipt, { catalog }), {
    valid: true,
    errors: [],
  });
  assert.equal(receipt.catalog.currentRevision, catalog.revision);

  for (const [targetName, assetId] of [
    ["rssCom", "episode-005-podcast-audio"],
    ["spotify", "episode-005-spotify-video"],
    ["youtube", "episode-005-master-video"],
    ["vimeo", "episode-005-master-video"],
    ["rumble", "episode-005-master-video"],
  ]) {
    const target = receipt.targets[targetName];
    const asset = catalog.assetRegistry[assetId];
    assert.equal(target.source, assetId, `${targetName} source routing drifted`);
    assert.equal(target.sourceSha256, asset.sha256, `${targetName} source SHA-256 drifted`);
    assert.equal(target.sourceSizeBytes, asset.sizeBytes, `${targetName} source size drifted`);
  }

  assert.equal(receipt.targets.apple.sourceSha256, receipt.targets.rssCom.sourceSha256);
  assert.equal(receipt.targets.apple.sourceSizeBytes, receipt.targets.rssCom.sourceSizeBytes);
});

test("pending Episode 5 receipt pins source and stable identities while remote fields remain null", async () => {
  const receipt = pendingReceipt();
  const catalog = await readJson("publishing/master-catalog.json");

  assert.deepEqual(validateEpisode5ContentCorrection(receipt, { catalog }), {
    valid: true,
    errors: [],
  });
  assert.equal(receipt.correctedSource.sha256, EPISODE_5_CONTENT_CORRECTION_SOURCE.sha256);
  assert.equal(receipt.correctedSource.sizeBytes, EPISODE_5_CONTENT_CORRECTION_SOURCE.sizeBytes);
  assert.equal(receipt.episode.rssGuid, catalog.episodes[4].rssGuid);
  assert.ok(
    Object.values(receipt.targets).every(
      (target) => target.replacementId === null && target.verifiedAt === null,
    ),
  );

  receipt.targets.youtube.replacementId = "Ep5Fix2026A";
  assert.deepEqual(
    validateEpisode5ContentCorrection(receipt, { catalog }),
    { valid: true, errors: [] },
    "a pending provider ID may be recorded before its final URL/readback fields arrive",
  );
});

test("receipt rejects corrected-source or protected-identity drift", async (t) => {
  const cases = [
    {
      label: "corrected master SHA",
      mutate(receipt) {
        receipt.correctedSource.sha256 = "f".repeat(64);
      },
      pattern: /correctedSource\.sha256.*equal to constant/,
    },
    {
      label: "RSS GUID",
      mutate(receipt) {
        receipt.episode.rssGuid = "00000000-0000-4000-8000-000000000005";
      },
      pattern: /episode\.rssGuid.*equal to constant/,
    },
    {
      label: "Spotify episode ID",
      mutate(receipt) {
        receipt.targets.spotify.existingId = "A".repeat(22);
      },
      pattern: /targets\.spotify\.existingId.*equal to constant/,
    },
    {
      label: "Vimeo source routing",
      mutate(receipt) {
        receipt.targets.vimeo.source = "episode-005-spotify-video";
      },
      pattern: /targets\.vimeo\.source.*equal to constant/,
    },
  ];

  for (const fixture of cases) {
    await t.test(fixture.label, () => {
      const receipt = pendingReceipt();
      fixture.mutate(receipt);
      const result = validateEpisode5ContentCorrection(receipt);
      assert.equal(result.valid, false);
      assert.ok(
        result.errors.some((error) => fixture.pattern.test(error)),
        result.errors.join("\n"),
      );
    });
  }
});

test("verified targets require final remote evidence and preserve in-place IDs", () => {
  const receipt = pendingReceipt();
  completeTarget(receipt, "vimeo", {
    id: "1204939658",
    url: "https://vimeo.com/1204939658",
  });
  assert.deepEqual(validateEpisode5ContentCorrection(receipt), {
    valid: true,
    errors: [],
  });

  receipt.targets.vimeo.replacementId = "9999999999";
  receipt.targets.vimeo.replacementUrl = "https://vimeo.com/9999999999";
  const changedIdentity = validateEpisode5ContentCorrection(receipt);
  assert.equal(changedIdentity.valid, false);
  assert.ok(
    changedIdentity.errors.some((error) => /targets\.vimeo/.test(error)),
    changedIdentity.errors.join("\n"),
  );

  const missingEvidence = pendingReceipt();
  missingEvidence.targets.vimeo.status = "complete_verified";
  missingEvidence.completion.verifiedComplete.push("vimeo");
  missingEvidence.completion.pending = missingEvidence.completion.pending.filter(
    (target) => target !== "vimeo",
  );
  const missingEvidenceResult = validateEpisode5ContentCorrection(missingEvidence);
  assert.equal(missingEvidenceResult.valid, false);
  assert.ok(
    missingEvidenceResult.errors.some(
      (error) => error.includes("targets.vimeo.sourceSha256") || error.includes("targets.vimeo.replacementId"),
    ),
    missingEvidenceResult.errors.join("\n"),
  );
});

test("YouTube correction cannot reuse either contaminated upload", () => {
  const receipt = pendingReceipt();
  completeTarget(receipt, "youtube", {
    id: "N_F0hhHkIQ4",
    url: "https://www.youtube.com/watch?v=N_F0hhHkIQ4",
  });

  const result = validateEpisode5ContentCorrection(receipt);
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((error) => error.includes("must not reuse a contaminated upload")),
    result.errors.join("\n"),
  );
});
