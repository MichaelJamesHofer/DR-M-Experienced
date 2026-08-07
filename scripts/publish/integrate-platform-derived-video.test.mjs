import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BASE_CATALOG_REVISION,
  DERIVED_ASSET_ID,
  DERIVED_ASSET_URI,
  NEXT_CATALOG_REVISION,
  PLATFORM_VARIANT_BATCH_ID,
  PlatformDerivedVideoIntegrationError,
  integratePlatformDerivedVideo,
} from "./integrate-platform-derived-video.mjs";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleDirectory, "../..");
const catalogTemplate = JSON.parse(
  await fs.readFile(path.join(projectRoot, "publishing", "master-catalog.json"), "utf8")
);
const auditTemplate = JSON.parse(
  await fs.readFile(
    path.join(projectRoot, "publishing", "audio-replacement-audit.json"),
    "utf8"
  )
);

const BLOCKED_ACTION =
  "generate_validated_sub_25_mbps_derivative_then_attach_to_existing_rss_episode";
const NEXT_ACTION =
  "attach_validated_platform_derivative_to_existing_rss_episode";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const text = `${JSON.stringify(value, null, 2)}\n`;
  await fs.writeFile(filePath, text);
  return sha256(text);
}

function normalizedCatalog(source, sourcePath) {
  const catalog = structuredClone(catalogTemplate);
  catalog.revision = BASE_CATALOG_REVISION;
  catalog.updatedAt = "2026-08-07T05:20:25.932Z";
  delete catalog.assetRegistry[DERIVED_ASSET_ID];
  const episode = catalog.episodes.find((entry) => entry.number === 5);
  episode.assetRefs.fullVideo = "episode-005-master-video";
  Object.assign(catalog.assetRegistry[episode.assetRefs.fullVideo], {
    kind: "video",
    role: "fullVideo",
    uri: "dropbox:episodes/005-episode-5-energy/master-video.mp4",
    sha256: sha256(source),
    sizeBytes: source.length,
    mediaType: "video/mp4",
    status: "verified",
  });
  assert.equal(
    sourcePath.endsWith("/episodes/005-episode-5-energy/master-video.mp4"),
    true
  );
  return catalog;
}

function normalizedAudit(catalog, source) {
  const audit = structuredClone(auditTemplate);
  audit.updatedAt = "2026-08-07T05:20:25.932Z";
  audit.localDelivery.catalogRevision = BASE_CATALOG_REVISION;
  audit.localDelivery.uploadAuthorized = false;
  audit.localDelivery.uploadsPerformed = false;
  const episode = audit.episodes.find((entry) => entry.number === 5);
  const catalogEpisode = catalog.episodes.find((entry) => entry.number === 5);
  episode.title = catalogEpisode.title;
  episode.rssGuid = catalogEpisode.rssGuid;
  Object.assign(episode.validatedDelivery.masterVideo, {
    assetId: "episode-005-master-video",
    sha256: sha256(source),
    sizeBytes: source.length,
    durationSeconds: 12,
  });
  episode.validatedDelivery.platformDerivedVideos = [];
  const spotify = episode.remoteReplacementTargets.find(
    (entry) => entry.platform === "spotify"
  );
  spotify.assetRole = "fullVideo";
  spotify.action = BLOCKED_ACTION;
  spotify.status = "blocked_platform_derivative_required";
  return audit;
}

async function prepareFixture(context) {
  const temporary = await fs.mkdtemp(
    path.join(os.tmpdir(), "drm-platform-derived-integration-")
  );
  context.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const dropboxRoot = path.join(temporary, "Dropbox", "Dr M Experienced");
  const episodeDirectory = path.join(
    dropboxRoot,
    "episodes",
    "005-episode-5-energy"
  );
  const sourcePath = path.join(episodeDirectory, "master-video.mp4");
  const artifactPath = path.join(episodeDirectory, "platform-video.mp4");
  const receiptPath = path.join(episodeDirectory, "platform-video.receipt.json");
  const batchPath = path.join(temporary, PLATFORM_VARIANT_BATCH_ID);
  const catalogPath = path.join(temporary, "publishing", "master-catalog.json");
  const auditPath = path.join(
    temporary,
    "publishing",
    "audio-replacement-audit.json"
  );
  const configPath = path.join(temporary, "sources.json");
  const source = Buffer.from("episode five normalized source\n");
  const artifact = Buffer.from("episode five spotify derivative\n");
  await fs.mkdir(episodeDirectory, { recursive: true });
  await fs.mkdir(batchPath, { recursive: true });
  await fs.writeFile(sourcePath, source);
  await fs.writeFile(artifactPath, artifact);

  const catalog = normalizedCatalog(source, sourcePath);
  const audit = normalizedAudit(catalog, source);
  await writeJson(catalogPath, catalog);
  await writeJson(auditPath, audit);
  await writeJson(configPath, { roots: { dropbox: dropboxRoot } });

  const evidenceValues = {
    "source.ffprobe.json": {
      streams: [
        {
          codec_type: "video",
          codec_name: "h264",
          profile: "High",
          width: 1920,
          height: 1080,
          pix_fmt: "yuv420p",
          avg_frame_rate: "60/1",
          field_order: "progressive",
          color_range: "tv",
          color_space: "bt709",
          color_transfer: "bt709",
          color_primaries: "bt709",
          duration: "12.000000",
          nb_frames: "720",
        },
        {
          codec_type: "audio",
          codec_name: "aac",
          profile: "LC",
          sample_rate: "48000",
          channels: 2,
          duration: "12.000000",
        },
      ],
      format: { duration: "12.000000" },
    },
    "platform-video.ffprobe.json": {
      streams: [
        {
          codec_type: "video",
          codec_name: "h264",
          profile: "High",
          width: 1920,
          height: 1080,
          pix_fmt: "yuv420p",
          sample_aspect_ratio: "1:1",
          display_aspect_ratio: "16:9",
          r_frame_rate: "60/1",
          avg_frame_rate: "60/1",
          field_order: "progressive",
          color_range: "tv",
          color_space: "bt709",
          color_transfer: "bt709",
          color_primaries: "bt709",
          bit_rate: "4000000",
          duration: "12.000000",
          nb_frames: "720",
        },
        {
          codec_type: "audio",
          codec_name: "aac",
          profile: "LC",
          sample_rate: "48000",
          channels: 2,
          channel_layout: "stereo",
          duration: "12.000000",
        },
      ],
      format: {
        duration: "12.000000",
        size: String(artifact.length),
        bit_rate: "4300000",
      },
    },
    "loudness.json": { input_i: "-16.08", input_tp: "-1.35" },
    "video-packet-rate.json": {
      packetCount: 720,
      windowSeconds: 1,
      peakPayloadBitsPerSecond: 5000000,
    },
    "gop.json": {
      keyframeCount: 12,
      firstKeyframeDtsSeconds: 0,
      lastKeyframeDtsSeconds: 11,
      maximumGapSeconds: 1,
      tailSeconds: 1,
    },
  };
  const evidenceText = {
    "full-decode.err": "frame=720 VFR:0.000000 (0/719)\n",
    "mp4-atom-trace.log":
      "type:'moov' parent:'root' sz: 128 8 1024\ntype:'mdat' parent:'root' sz: 896 136 1024\n",
    "source.audio-packets.tsv": "1024\t256\tSHA256:abc\n",
    "platform-video.audio-packets.tsv": "1024\t256\tSHA256:abc\n",
    "encode-command.txt":
      "ffmpeg -i source -c:v libx264 -maxrate 18M -g 60 -sc_threshold 0 -c:a copy -movflags +faststart+negative_cts_offsets -use_editlist 0 output\n",
    "encode.log": "encoded fixture\n",
  };
  for (const [filename, value] of Object.entries(evidenceValues)) {
    evidenceText[filename] = `${JSON.stringify(value, null, 2)}\n`;
  }
  for (const [filename, text] of Object.entries(evidenceText)) {
    await fs.writeFile(path.join(batchPath, filename), text);
  }

  const evidence = {
    batchPath,
    sourceProbe: evidenceEntry(batchPath, "source.ffprobe.json", evidenceText),
    artifactProbe: evidenceEntry(
      batchPath,
      "platform-video.ffprobe.json",
      evidenceText
    ),
    fullDecodeLog: {
      ...evidenceEntry(batchPath, "full-decode.err", evidenceText),
      sizeBytes: Buffer.byteLength(evidenceText["full-decode.err"]),
    },
    loudness: evidenceEntry(batchPath, "loudness.json", evidenceText),
    packetRate: evidenceEntry(batchPath, "video-packet-rate.json", evidenceText),
    gop: evidenceEntry(batchPath, "gop.json", evidenceText),
    mp4AtomTrace: evidenceEntry(batchPath, "mp4-atom-trace.log", evidenceText),
    sourceAudioPackets: evidenceEntry(
      batchPath,
      "source.audio-packets.tsv",
      evidenceText
    ),
    artifactAudioPackets: evidenceEntry(
      batchPath,
      "platform-video.audio-packets.tsv",
      evidenceText
    ),
    encodeCommand: evidenceEntry(batchPath, "encode-command.txt", evidenceText),
    encodeLog: evidenceEntry(batchPath, "encode.log", evidenceText),
  };
  const audioStreamHash = sha256("identical encoded audio stream");
  const extradataHash = sha256("identical audio extradata");
  const receipt = {
    schemaVersion: 1,
    episodeNumber: 5,
    artifactKind: "direct_platform_video",
    status: "validated_local",
    uploadAuthorized: false,
    createdAt: "2026-08-07T06:30:00-06:00",
    source: {
      path: sourcePath,
      sha256: sha256(source),
      sizeBytes: source.length,
    },
    artifact: {
      path: artifactPath,
      sha256: sha256(artifact),
      sizeBytes: artifact.length,
    },
    encode: {
      ffmpegVersion: "ffmpeg version 7.0 fixture",
      videoCodec: "libx264",
      preset: "slow",
      crf: 18,
      profile: "High",
      level: "4.2",
      pixelFormat: "yuv420p",
      configuredMaxRateBitsPerSecond: 18000000,
      configuredBufferSizeBits: 5000000,
      bFrames: 2,
      gopFrames: 60,
      sceneCutThreshold: 0,
      videoPadSeconds: 0,
      audioMode: "packet_copy",
      fastStart: true,
      negativeCtsOffsets: true,
      editListsDisabled: true,
    },
    validation: {
      fullDecodePassed: true,
      constantFrameRatePassed: true,
      editListAtomsAbsent: true,
      moovBeforeMdat: true,
      sourceDurationSeconds: 12,
      sourceVideoDurationSeconds: 12,
      sourceAudioDurationSeconds: 12,
      artifactDurationSeconds: 12,
      durationDeltaSeconds: 0,
      audioVideoDurationDeltaSeconds: 0,
      sameTrackDurationPassed: true,
      firstVideoPtsSeconds: 0,
      sourceVideoFrameCount: 720,
      artifactVideoFrameCount: 720,
      paddingFrameCount: 0,
      maximumGopGapSeconds: 1,
      gopTailSeconds: 1,
      streamCount: 2,
      video: {
        codec: "h264",
        profile: "High",
        width: 1920,
        height: 1080,
        frameRate: "60/1",
        colorRange: "tv",
        colorSpace: "bt709",
        colorTransfer: "bt709",
        colorPrimaries: "bt709",
        fieldOrder: "progressive",
        bitRate: 4000000,
      },
      audio: {
        codec: "aac",
        profile: "LC",
        sampleRateHz: 48000,
        channels: 2,
        sourceStreamSha256: audioStreamHash,
        artifactStreamSha256: audioStreamHash,
        packetIdentityPassed: true,
        packetSignatureSha256: evidence.sourceAudioPackets.sha256,
        sourceExtradataSha256: extradataHash,
        artifactExtradataSha256: extradataHash,
        extradataIdentityPassed: true,
        integratedLufs: -16.08,
        truePeakDbtp: -1.35,
      },
      formatBitRate: 4300000,
      peakOneSecondVideoPacketPayloadBitsPerSecond: 5000000,
      platformBitRateCeilingBitsPerSecond: 24000000,
    },
    evidence,
  };
  const receiptSha256 = await writeJson(receiptPath, receipt);
  return {
    temporary,
    dropboxRoot,
    sourcePath,
    artifactPath,
    receiptPath,
    batchPath,
    catalogPath,
    auditPath,
    configPath,
    catalog,
    audit,
    receipt,
    receiptSha256,
  };
}

function evidenceEntry(batchPath, filename, evidenceText) {
  return {
    path: path.join(batchPath, filename),
    sha256: sha256(evidenceText[filename]),
  };
}

async function rewriteReceipt(fixture, mutate) {
  const receipt = structuredClone(fixture.receipt);
  mutate(receipt);
  fixture.receipt = receipt;
  fixture.receiptSha256 = await writeJson(fixture.receiptPath, receipt);
  return fixture.receiptSha256;
}

function integrationOptions(fixture, extra = {}) {
  return {
    receiptPath: fixture.receiptPath,
    expectedReceiptSha256: fixture.receiptSha256,
    catalogPath: fixture.catalogPath,
    auditPath: fixture.auditPath,
    configPath: fixture.configPath,
    now: "2026-08-07T12:45:00Z",
    ...extra,
  };
}

test("dry run validates the derivative without modifying state", async (context) => {
  const fixture = await prepareFixture(context);
  const catalogBefore = await fs.readFile(fixture.catalogPath, "utf8");
  const auditBefore = await fs.readFile(fixture.auditPath, "utf8");
  const result = await integratePlatformDerivedVideo(integrationOptions(fixture));
  assert.deepEqual(result, {
    applied: false,
    episodeNumber: 5,
    assetId: DERIVED_ASSET_ID,
    artifactSha256: fixture.receipt.artifact.sha256,
    receiptSha256: fixture.receiptSha256,
    catalogRevisionBefore: BASE_CATALOG_REVISION,
    catalogRevisionAfter: NEXT_CATALOG_REVISION,
    remoteUploadsClaimed: false,
  });
  assert.equal(await fs.readFile(fixture.catalogPath, "utf8"), catalogBefore);
  assert.equal(await fs.readFile(fixture.auditPath, "utf8"), auditBefore);
});

test("apply registers the derivative while preserving the master binding", async (context) => {
  const fixture = await prepareFixture(context);
  const masterBindingBefore = fixture.catalog.episodes.find(
    (entry) => entry.number === 5
  ).assetRefs.fullVideo;
  const result = await integratePlatformDerivedVideo(
    integrationOptions(fixture, { apply: true })
  );
  assert.equal(result.applied, true);
  const catalog = JSON.parse(await fs.readFile(fixture.catalogPath, "utf8"));
  const audit = JSON.parse(await fs.readFile(fixture.auditPath, "utf8"));
  assert.equal(catalog.revision, NEXT_CATALOG_REVISION);
  assert.equal(
    catalog.episodes.find((entry) => entry.number === 5).assetRefs.fullVideo,
    masterBindingBefore
  );
  assert.deepEqual(catalog.assetRegistry[DERIVED_ASSET_ID], {
    kind: "video",
    role: "spotifyVideo",
    uri: DERIVED_ASSET_URI,
    sha256: fixture.receipt.artifact.sha256,
    sizeBytes: fixture.receipt.artifact.sizeBytes,
    mediaType: "video/mp4",
    status: "verified",
  });
  const episode = audit.episodes.find((entry) => entry.number === 5);
  assert.deepEqual(episode.validatedDelivery.platformDerivedVideos, [
    {
      platform: "spotify",
      assetId: DERIVED_ASSET_ID,
      catalogRevision: NEXT_CATALOG_REVISION,
      receiptSha256: fixture.receiptSha256,
      uri: DERIVED_ASSET_URI,
      sha256: fixture.receipt.artifact.sha256,
      sizeBytes: fixture.receipt.artifact.sizeBytes,
      mediaType: "video/mp4",
      videoCodec: "h264",
      averageBitrateBitsPerSecond: 4300000,
      durationSeconds: 12,
      integratedLufs: -16.08,
      truePeakDbtp: -1.35,
      status: "validated_local_derivative",
    },
  ]);
  const spotify = episode.remoteReplacementTargets.find(
    (entry) => entry.platform === "spotify"
  );
  assert.equal(spotify.action, NEXT_ACTION);
  assert.equal(spotify.status, "pending");
  assert.equal(audit.localDelivery.uploadAuthorized, false);
  assert.equal(audit.localDelivery.uploadsPerformed, false);
  assert.equal(audit.localDelivery.catalogRevision, BASE_CATALOG_REVISION);
});

test("rejects a receipt that authorizes an upload", async (context) => {
  const fixture = await prepareFixture(context);
  await rewriteReceipt(fixture, (receipt) => {
    receipt.uploadAuthorized = true;
  });
  await assert.rejects(
    integratePlatformDerivedVideo(integrationOptions(fixture)),
    (error) =>
      error instanceof PlatformDerivedVideoIntegrationError &&
      error.message.includes("uploadAuthorized must be false")
  );
});

test("rejects source master hash drift", async (context) => {
  const fixture = await prepareFixture(context);
  const original = await fs.readFile(fixture.sourcePath);
  const changed = Buffer.from(original);
  changed[0] ^= 0xff;
  await fs.writeFile(fixture.sourcePath, changed);
  await assert.rejects(
    integratePlatformDerivedVideo(integrationOptions(fixture)),
    (error) =>
      error instanceof PlatformDerivedVideoIntegrationError &&
      error.message.includes("source master SHA-256")
  );
});

test("rejects derived artifact hash drift", async (context) => {
  const fixture = await prepareFixture(context);
  const original = await fs.readFile(fixture.artifactPath);
  const changed = Buffer.from(original);
  changed[0] ^= 0xff;
  await fs.writeFile(fixture.artifactPath, changed);
  await assert.rejects(
    integratePlatformDerivedVideo(integrationOptions(fixture)),
    (error) =>
      error instanceof PlatformDerivedVideoIntegrationError &&
      error.message.includes("Spotify derivative SHA-256")
  );
});

test("rejects bitrate claims above the validated platform ceiling", async (context) => {
  const fixture = await prepareFixture(context);
  await rewriteReceipt(fixture, (receipt) => {
    receipt.validation.formatBitRate = 24_000_001;
  });
  await assert.rejects(
    integratePlatformDerivedVideo(integrationOptions(fixture)),
    (error) =>
      error instanceof PlatformDerivedVideoIntegrationError &&
      error.message.includes("formatBitRate")
  );
});

test("rejects evidence hash drift", async (context) => {
  const fixture = await prepareFixture(context);
  await fs.appendFile(path.join(fixture.batchPath, "encode.log"), "changed\n");
  await assert.rejects(
    integratePlatformDerivedVideo(integrationOptions(fixture)),
    (error) =>
      error instanceof PlatformDerivedVideoIntegrationError &&
      error.message.includes("Evidence encodeLog SHA-256")
  );
});

test("rejects unexpected receipt fields", async (context) => {
  const fixture = await prepareFixture(context);
  await rewriteReceipt(fixture, (receipt) => {
    receipt.remoteUpload = "complete";
  });
  await assert.rejects(
    integratePlatformDerivedVideo(integrationOptions(fixture)),
    (error) =>
      error instanceof PlatformDerivedVideoIntegrationError &&
      error.message.includes("Receipt keys must be exactly")
  );
});
