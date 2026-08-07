import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  APPROVED_SOURCE_SHA256,
  BASE_CATALOG_REVISION,
  DELIVERY_BATCH_ID,
  DeliveryBatchIntegrationError,
  integrateDeliveryBatch,
  validateIntegratedAudioAudit,
} from "./integrate-delivery-batch.mjs";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleDirectory, "../..");
const catalogTemplate = JSON.parse(
  await fs.readFile(path.join(projectRoot, "publishing", "master-catalog.json"), "utf8")
);
const auditTemplate = JSON.parse(
  await fs.readFile(path.join(projectRoot, "publishing", "audio-replacement-audit.json"), "utf8")
);

const publishedBaseline = new Map([
  [1, [-28.75, -7.5]],
  [2, [-28.42, -6.62]],
  [3, [-28.46, -5.42]],
  [4, [-29.25, -8.6]],
  [5, [-28.99, -8.28]],
  [6, [-30.99, -8.79]],
  [7, [-30.7, -7.39]],
]);
const sourceLoudness = new Map([
  [1, [-22.51, -1.18]],
  [2, [-22.78, -0.95]],
  [3, [-24.02, -0.98]],
  [4, [-21.81, -1.02]],
  [5, [-21.75, -1.08]],
  [6, [-23.16, -1.08]],
  [7, [-23.27, -0.93]],
]);

test("verified public video cutovers require typed cutover evidence", () => {
  assert.deepEqual(validateIntegratedAudioAudit(auditTemplate), { valid: true, errors: [] });

  const missingEvidence = structuredClone(auditTemplate);
  const youtube = missingEvidence.episodes[0].remoteReplacementTargets.find(
    (target) => target.platform === "youtube"
  );
  delete youtube.cutover;

  const result = validateIntegratedAudioAudit(missingEvidence);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("cutover")), result.errors.join("\n"));
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function legacyCatalog() {
  const catalog = structuredClone(catalogTemplate);
  catalog.revision = BASE_CATALOG_REVISION;
  catalog.updatedAt = "2026-08-07T04:30:13Z";
  for (const episode of catalog.episodes) {
    const directory = `dropbox:episodes/${String(episode.number).padStart(3, "0")}-${episode.slug}`;
    const video = catalog.assetRegistry[episode.assetRefs.fullVideo];
    const audio = catalog.assetRegistry[episode.assetRefs.podcastAudio];
    Object.assign(video, {
      uri: `${directory}/master-video.mp4`,
      sha256: null,
      sizeBytes: null,
      mediaType: "video/mp4",
      status: "unmounted",
    });
    Object.assign(audio, {
      uri: `${directory}/podcast-audio.wav`,
      sha256: null,
      sizeBytes: null,
      mediaType: "audio/wav",
      status: "unmounted",
    });
  }
  return catalog;
}

function legacyAudit(catalog) {
  return {
    schemaVersion: 1,
    auditId: "canonical-audio-loudness-2026-08-06",
    auditedAt: "2026-08-06",
    status: "awaiting_corrected_audio_and_video_masters",
    canonicalFeedUrl: catalog.show.canonicalPodcastFeed.url,
    measurement: structuredClone(auditTemplate.measurement),
    protectedIdentityFields: structuredClone(auditTemplate.protectedIdentityFields),
    episodes: catalog.episodes.map((episode) => ({
      number: episode.number,
      title: episode.title,
      rssGuid: episode.rssGuid,
      inputIntegratedLufs: publishedBaseline.get(episode.number)[0],
      inputTruePeakDbtp: publishedBaseline.get(episode.number)[1],
      replacementRecommended: true,
    })),
    replacementPolicy: structuredClone(auditTemplate.replacementPolicy),
    platformNotes: structuredClone(auditTemplate.platformNotes),
  };
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function prepareFixture(context) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "drm-delivery-integration-"));
  context.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const batchDirectory = path.join(temporary, DELIVERY_BATCH_ID);
  const evidenceDirectory = path.join(
    temporary,
    "20260806T2241-0600-first-seven-loudness",
    "preflight-originals"
  );
  const dropboxRoot = path.join(temporary, "Dropbox", "Dr M Experienced");
  const catalog = legacyCatalog();
  const audit = legacyAudit(catalog);
  const results = [];
  const sourceMeasurementEpisodes = [];

  for (const episode of catalog.episodes) {
    const number = episode.number;
    const directory = path.join(
      dropboxRoot,
      "episodes",
      `${String(number).padStart(3, "0")}-${episode.slug}`
    );
    const videoPath = path.join(directory, "master-video.mp4");
    const audioPath = path.join(directory, "podcast-audio.mp3");
    const video = Buffer.from(`validated delivery video ${number}\n`);
    const audio = Buffer.from(`validated podcast audio ${number}\n`);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(videoPath, video);
    await fs.writeFile(audioPath, audio);
    const [sourceIntegratedLufs, sourceTruePeakDbtp] = sourceLoudness.get(number);
    results.push({
      status: "validated_local_delivery",
      episodeNumber: number,
      slug: `${String(number).padStart(3, "0")}-${episode.slug}`,
      title: episode.title,
      sourceMode: number <= 2 ? "validated_v1_candidate" : "reencoded",
      source: {
        path: path.join(dropboxRoot, "source-renders", `episode-${number}.mov`),
        sha256: APPROVED_SOURCE_SHA256.get(number),
      },
      masterVideo: {
        path: videoPath,
        sha256: sha256(video),
        sizeBytes: video.length,
        durationSeconds: 1000 + number,
        integratedLufs: -16.1,
        truePeakDbtp: -1.4,
      },
      podcastAudio: {
        path: audioPath,
        sha256: sha256(audio),
        sizeBytes: audio.length,
        durationSeconds: 1000.1 + number,
        integratedLufs: -16.2,
        truePeakDbtp: -1.6,
      },
      verification: {
        fullDecode: true,
        sourceUnchanged: true,
        videoPacketContentPreserved: true,
        videoEssenceSha256: sha256(`video essence ${number}`),
      },
      completedAt: `2026-08-07T05:0${number}:00Z`,
    });

    const loudnessPath = path.join(evidenceDirectory, `ep${number}.loudnorm.json`);
    const decodePath = path.join(evidenceDirectory, `ep${number}.result.txt`);
    const loudnessText = `${JSON.stringify(
      { input_i: sourceIntegratedLufs.toFixed(2), input_tp: sourceTruePeakDbtp.toFixed(2) },
      null,
      2
    )}\n`;
    const decodeText = [
      `episode=${number}`,
      `path=${path.join(dropboxRoot, "source-renders", `episode-${number}.mov`)}`,
      `sha256=${APPROVED_SOURCE_SHA256.get(number)}`,
      "sha_rc=0",
      "probe_rc=0",
      "decode_rc=0",
      "loudnorm_rc=0",
      "stable=yes",
      "decode_error_bytes=0",
      "probe_error_bytes=0",
      `input_i=${sourceIntegratedLufs}|input_tp=${sourceTruePeakDbtp}`,
      "",
    ].join("\n");
    await fs.mkdir(evidenceDirectory, { recursive: true });
    await fs.writeFile(loudnessPath, loudnessText);
    await fs.writeFile(decodePath, decodeText);
    sourceMeasurementEpisodes.push({
      episodeNumber: number,
      sourceSha256: APPROVED_SOURCE_SHA256.get(number),
      evidencePath: loudnessPath,
      evidenceSha256: sha256(loudnessText),
      integratedLufs: sourceIntegratedLufs,
      truePeakDbtp: sourceTruePeakDbtp,
      decodePassedProvenance: {
        status: "passed",
        evidencePath: decodePath,
        evidenceSha256: sha256(decodeText),
      },
    });
  }

  const manifest = {
    schemaVersion: 1,
    batchId: DELIVERY_BATCH_ID,
    status: "validated_local_delivery",
    uploadAuthorized: false,
    target: { integratedLufs: -16, truePeakDbtp: -1.5, loudnessRangeLu: 11 },
    acceptance: {
      integratedLufsMinimum: -17,
      integratedLufsMaximum: -15,
      truePeakDbtpMaximum: -1,
    },
    concurrency: 2,
    availableBytesBefore: 45_000_000_000,
    availableBytesAfter: 30_000_000_000,
    episodes: structuredClone(results),
    completedAt: "2026-08-07T05:10:00Z",
  };
  const batchStatus = {
    status: "validated_local_delivery",
    uploadAuthorized: false,
    completedAt: "2026-08-07T05:10:00Z",
  };
  const sourceMeasurements = {
    schemaVersion: 1,
    batchId: DELIVERY_BATCH_ID,
    status: "measured_source_inputs",
    uploadAuthorized: false,
    episodes: sourceMeasurementEpisodes,
    completedAt: "2026-08-07T05:11:00Z",
  };

  const catalogPath = path.join(temporary, "publishing", "master-catalog.json");
  const auditPath = path.join(temporary, "publishing", "audio-replacement-audit.json");
  const configPath = path.join(temporary, "sources.json");
  await writeJson(catalogPath, catalog);
  await writeJson(auditPath, audit);
  await writeJson(configPath, { schemaVersion: 1, roots: { dropbox: dropboxRoot } });
  await writeJson(path.join(batchDirectory, "manifest.json"), manifest);
  await writeJson(path.join(batchDirectory, "status.json"), batchStatus);
  await writeJson(path.join(batchDirectory, "source-measurements.json"), sourceMeasurements);
  for (const result of results) {
    await writeJson(path.join(batchDirectory, "results", `ep${result.episodeNumber}`, "result.json"), result);
    await writeJson(path.join(batchDirectory, "results", `ep${result.episodeNumber}`, "status.json"), {
      status: "validated_local_delivery",
      completedAt: result.completedAt,
    });
  }
  return {
    temporary,
    batchDirectory,
    dropboxRoot,
    catalogPath,
    auditPath,
    configPath,
    catalog,
    audit,
    manifest,
    results,
    sourceMeasurements,
  };
}

async function mutateResultAndManifest(fixture, episodeNumber, mutate) {
  const resultPath = path.join(fixture.batchDirectory, "results", `ep${episodeNumber}`, "result.json");
  const result = JSON.parse(await fs.readFile(resultPath, "utf8"));
  mutate(result);
  await writeJson(resultPath, result);
  const manifestPath = path.join(fixture.batchDirectory, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  mutate(manifest.episodes.find((entry) => entry.episodeNumber === episodeNumber));
  await writeJson(manifestPath, manifest);
}

async function mutateSourceMeasurements(fixture, episodeNumber, mutate) {
  const sidecarPath = path.join(fixture.batchDirectory, "source-measurements.json");
  const sidecar = JSON.parse(await fs.readFile(sidecarPath, "utf8"));
  mutate(sidecar.episodes.find((entry) => entry.episodeNumber === episodeNumber));
  await writeJson(sidecarPath, sidecar);
}

test("dry run validates all seven records and binaries without changing repository state", async (context) => {
  const fixture = await prepareFixture(context);
  const catalogBefore = await fs.readFile(fixture.catalogPath, "utf8");
  const auditBefore = await fs.readFile(fixture.auditPath, "utf8");
  const result = await integrateDeliveryBatch({
    batchDirectory: fixture.batchDirectory,
    catalogPath: fixture.catalogPath,
    auditPath: fixture.auditPath,
    configPath: fixture.configPath,
    now: "2026-08-07T05:20:00Z",
  });

  assert.deepEqual(result, {
    applied: false,
    batchId: DELIVERY_BATCH_ID,
    manifestSha256: result.manifestSha256,
    catalogRevisionBefore: 6,
    catalogRevisionAfter: 7,
    episodeCount: 7,
    remoteUploadsClaimed: false,
  });
  assert.match(result.manifestSha256, /^[a-f0-9]{64}$/);
  assert.equal(await fs.readFile(fixture.catalogPath, "utf8"), catalogBefore);
  assert.equal(await fs.readFile(fixture.auditPath, "utf8"), auditBefore);
});

test("apply binds exact Dropbox masters and records only pending remote work", async (context) => {
  const fixture = await prepareFixture(context);
  const oldPublishedUrls = new Map(
    fixture.catalog.episodes.map((episode) => [
      episode.number,
      fixture.catalog.assetRegistry[episode.assetRefs.podcastAudio].publishedUrl,
    ])
  );
  const result = await integrateDeliveryBatch({
    batchDirectory: fixture.batchDirectory,
    catalogPath: fixture.catalogPath,
    auditPath: fixture.auditPath,
    configPath: fixture.configPath,
    apply: true,
    now: "2026-08-07T05:20:00Z",
  });
  assert.equal(result.applied, true);

  const catalog = JSON.parse(await fs.readFile(fixture.catalogPath, "utf8"));
  const audit = JSON.parse(await fs.readFile(fixture.auditPath, "utf8"));
  assert.equal(catalog.revision, 7);
  assert.equal(audit.schemaVersion, 2);
  assert.equal(audit.status, "validated_local_delivery_pending_remote_replacement");
  assert.equal(audit.localDelivery.uploadAuthorized, false);
  assert.equal(audit.localDelivery.uploadsPerformed, false);
  assert.equal(audit.localDelivery.catalogRevision, 7);

  for (const episode of catalog.episodes) {
    const source = fixture.results.find((entry) => entry.episodeNumber === episode.number);
    const video = catalog.assetRegistry[episode.assetRefs.fullVideo];
    const audio = catalog.assetRegistry[episode.assetRefs.podcastAudio];
    const auditEpisode = audit.episodes.find((entry) => entry.number === episode.number);
    assert.deepEqual(
      [video.status, video.sha256, video.sizeBytes, video.mediaType],
      ["verified", source.masterVideo.sha256, source.masterVideo.sizeBytes, "video/mp4"]
    );
    assert.deepEqual(
      [audio.status, audio.sha256, audio.sizeBytes, audio.mediaType],
      ["verified", source.podcastAudio.sha256, source.podcastAudio.sizeBytes, "audio/mpeg"]
    );
    assert.match(audio.uri, /\/podcast-audio\.mp3$/);
    assert.equal(audio.publishedUrl, oldPublishedUrls.get(episode.number));
    assert.equal(
      auditEpisode.correctedSourceRender.integratedLufs,
      fixture.sourceMeasurements.episodes.find((entry) => entry.episodeNumber === episode.number)
        .integratedLufs
    );
    assert.equal(auditEpisode.validatedDelivery.podcastAudio.integratedLufs, source.podcastAudio.integratedLufs);
    assert.deepEqual(auditEpisode.validatedDelivery.platformDerivedVideos, []);
    assert.equal(auditEpisode.remoteReplacementTargets.length, 8);
    assert.ok(
      auditEpisode.remoteReplacementTargets.every(
        (target) => !["uploaded", "published", "complete", "completed", "replaced"].includes(target.status)
      )
    );
  }
  assert.doesNotMatch(JSON.stringify(audit), /source-renders/);

  const episodeFiveAudit = audit.episodes.find((entry) => entry.number === 5);
  assert.equal(
    episodeFiveAudit.remoteReplacementTargets.find((target) => target.platform === "spotify")
      .status,
    "blocked_platform_derivative_required"
  );
  episodeFiveAudit.validatedDelivery.platformDerivedVideos.push({
    platform: "spotify",
    assetId: "episode-005-spotify-video",
    catalogRevision: 8,
    receiptSha256: "b".repeat(64),
    uri: "dropbox:episodes/005-episode-5-energy/derived/spotify-video.mp4",
    sha256: "a".repeat(64),
    sizeBytes: 5_000_000_000,
    mediaType: "video/mp4",
    videoCodec: "h264",
    averageBitrateBitsPerSecond: 24_000_000,
    durationSeconds: 1861.9,
    integratedLufs: -16.1,
    truePeakDbtp: -1.4,
    status: "validated_local_derivative",
  });
  assert.deepEqual(validateIntegratedAudioAudit(audit), { valid: true, errors: [] });
});

test("missing result record blocks the entire integration", async (context) => {
  const fixture = await prepareFixture(context);
  await fs.rm(path.join(fixture.batchDirectory, "results", "ep7", "result.json"));
  await assert.rejects(
    integrateDeliveryBatch({
      batchDirectory: fixture.batchDirectory,
      catalogPath: fixture.catalogPath,
      auditPath: fixture.auditPath,
      configPath: fixture.configPath,
      verifyFiles: false,
    }),
    /result\.json paths are not exactly/
  );
});

test("manifest upload authorization is rejected", async (context) => {
  const fixture = await prepareFixture(context);
  const manifestPath = path.join(fixture.batchDirectory, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  manifest.uploadAuthorized = true;
  await writeJson(manifestPath, manifest);
  await assert.rejects(
    integrateDeliveryBatch({
      batchDirectory: fixture.batchDirectory,
      catalogPath: fixture.catalogPath,
      auditPath: fixture.auditPath,
      configPath: fixture.configPath,
      verifyFiles: false,
    }),
    /must not authorize upload/
  );
});

test("missing source loudness sidecar field is rejected", async (context) => {
  const fixture = await prepareFixture(context);
  await mutateSourceMeasurements(fixture, 2, (entry) => delete entry.integratedLufs);
  await assert.rejects(
    integrateDeliveryBatch({
      batchDirectory: fixture.batchDirectory,
      catalogPath: fixture.catalogPath,
      auditPath: fixture.auditPath,
      configPath: fixture.configPath,
      verifyFiles: false,
    }),
    /Source measurement 2 keys must be exactly/
  );
});

test("unapproved source hash and out-of-policy delivery both fail closed", async (context) => {
  const hashFixture = await prepareFixture(context);
  await mutateResultAndManifest(hashFixture, 3, (result) => {
    result.source.sha256 = sha256("different source");
  });
  await assert.rejects(
    integrateDeliveryBatch({
      batchDirectory: hashFixture.batchDirectory,
      catalogPath: hashFixture.catalogPath,
      auditPath: hashFixture.auditPath,
      configPath: hashFixture.configPath,
      verifyFiles: false,
    }),
    /source SHA-256 does not match/
  );

  const loudnessFixture = await prepareFixture(context);
  await mutateResultAndManifest(loudnessFixture, 4, (result) => {
    result.podcastAudio.integratedLufs = -18;
  });
  await assert.rejects(
    integrateDeliveryBatch({
      batchDirectory: loudnessFixture.batchDirectory,
      catalogPath: loudnessFixture.catalogPath,
      auditPath: loudnessFixture.auditPath,
      configPath: loudnessFixture.configPath,
      verifyFiles: false,
    }),
    /integrated loudness is outside/
  );
});

test("failed validation flag and partially bound catalog both block integration", async (context) => {
  const verificationFixture = await prepareFixture(context);
  await mutateResultAndManifest(verificationFixture, 5, (result) => {
    result.verification.fullDecode = false;
  });
  await assert.rejects(
    integrateDeliveryBatch({
      batchDirectory: verificationFixture.batchDirectory,
      catalogPath: verificationFixture.catalogPath,
      auditPath: verificationFixture.auditPath,
      configPath: verificationFixture.configPath,
      verifyFiles: false,
    }),
    /verification\.fullDecode must be true/
  );

  const catalogFixture = await prepareFixture(context);
  const catalog = JSON.parse(await fs.readFile(catalogFixture.catalogPath, "utf8"));
  const asset = catalog.assetRegistry[catalog.episodes[0].assetRefs.fullVideo];
  asset.status = "verified";
  asset.sha256 = catalogFixture.results[0].masterVideo.sha256;
  asset.sizeBytes = catalogFixture.results[0].masterVideo.sizeBytes;
  await writeJson(catalogFixture.catalogPath, catalog);
  await assert.rejects(
    integrateDeliveryBatch({
      batchDirectory: catalogFixture.batchDirectory,
      catalogPath: catalogFixture.catalogPath,
      auditPath: catalogFixture.auditPath,
      configPath: catalogFixture.configPath,
      verifyFiles: false,
    }),
    /must still be unmounted/
  );
});

test("binary hash drift blocks integration after JSON validation", async (context) => {
  const fixture = await prepareFixture(context);
  const videoPath = fixture.results[0].masterVideo.path;
  await fs.appendFile(videoPath, "changed");
  await assert.rejects(
    integrateDeliveryBatch({
      batchDirectory: fixture.batchDirectory,
      catalogPath: fixture.catalogPath,
      auditPath: fixture.auditPath,
      configPath: fixture.configPath,
    }),
    DeliveryBatchIntegrationError
  );
});

test("source measurement evidence drift blocks integration", async (context) => {
  const fixture = await prepareFixture(context);
  const evidencePath = fixture.sourceMeasurements.episodes[0].evidencePath;
  const evidence = JSON.parse(await fs.readFile(evidencePath, "utf8"));
  evidence.changed = true;
  await writeJson(evidencePath, evidence);
  await assert.rejects(
    integrateDeliveryBatch({
      batchDirectory: fixture.batchDirectory,
      catalogPath: fixture.catalogPath,
      auditPath: fixture.auditPath,
      configPath: fixture.configPath,
      verifyFiles: false,
    }),
    /loudness evidence SHA-256 does not match/
  );
});
