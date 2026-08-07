import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_CATALOG_PATH,
  resolveCatalogAsset,
  resolveSourceRef,
  sourcesConfigPath,
  validateCatalog,
} from "./catalog.mjs";
import {
  DEFAULT_AUDIT_PATH,
  validateIntegratedAudioAudit,
} from "./integrate-delivery-batch.mjs";
import { hashFile } from "./lib.mjs";

export const PLATFORM_VARIANT_BATCH_ID = "20260806T2321-0600-ep5-direct-platform";
export const BASE_CATALOG_REVISION = 7;
export const NEXT_CATALOG_REVISION = 8;
export const EPISODE_NUMBER = 5;
export const MASTER_ASSET_ID = "episode-005-master-video";
export const DERIVED_ASSET_ID = "episode-005-spotify-video";
export const DERIVED_ASSET_URI =
  "dropbox:episodes/005-episode-5-energy/platform-video.mp4";
export const RECEIPT_URI =
  "dropbox:episodes/005-episode-5-energy/platform-video.receipt.json";

const EXPECTED_SPOTIFY_BLOCKED_ACTION =
  "generate_validated_sub_25_mbps_derivative_then_attach_to_existing_rss_episode";
const NEXT_SPOTIFY_ACTION =
  "attach_validated_platform_derivative_to_existing_rss_episode";
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const RFC3339_WITH_TIMEZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const PLATFORM_BITRATE_CEILING = 24_000_000;
const EVIDENCE_FILES = {
  sourceProbe: "source.ffprobe.json",
  artifactProbe: "platform-video.ffprobe.json",
  fullDecodeLog: "full-decode.err",
  loudness: "loudness.json",
  packetRate: "video-packet-rate.json",
  gop: "gop.json",
  mp4AtomTrace: "mp4-atom-trace.log",
  sourceAudioPackets: "source.audio-packets.tsv",
  artifactAudioPackets: "platform-video.audio-packets.tsv",
  encodeCommand: "encode-command.txt",
  encodeLog: "encode.log",
};

export class PlatformDerivedVideoIntegrationError extends Error {
  constructor(problems) {
    const list = Array.isArray(problems) ? problems : [String(problems)];
    super(
      `Platform-derived video integration is blocked:\n${list
        .map((entry) => `- ${entry}`)
        .join("\n")}`
    );
    this.name = "PlatformDerivedVideoIntegrationError";
    this.problems = list;
  }
}

function problem(condition, message, problems) {
  if (!condition) problems.push(message);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, expected, label, problems) {
  if (!isPlainObject(value)) {
    problems.push(`${label} must be an object.`);
    return false;
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (!isDeepStrictEqual(actual, wanted)) {
    problems.push(`${label} keys must be exactly ${wanted.join(", ")}.`);
    return false;
  }
  return true;
}

function validTimestamp(value) {
  return (
    typeof value === "string" &&
    RFC3339_WITH_TIMEZONE.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function validFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function validPositiveNumber(value) {
  return validFiniteNumber(value) && value > 0;
}

function validPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function validSha256(value) {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function closeEnough(left, right, tolerance = 0.000_001) {
  return validFiniteNumber(left) && validFiniteNumber(right) && Math.abs(left - right) <= tolerance;
}

function sha256Text(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function readStableText(filePath, label) {
  let before;
  try {
    before = await fs.lstat(filePath);
  } catch (error) {
    throw new PlatformDerivedVideoIntegrationError(
      `${label} cannot be inspected (${error.message}): ${filePath}`
    );
  }
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new PlatformDerivedVideoIntegrationError(
      `${label} must be a regular, non-symlink file: ${filePath}`
    );
  }
  const text = await fs.readFile(filePath, "utf8");
  const after = await fs.lstat(filePath);
  if (
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.size !== after.size ||
    before.mtimeMs !== after.mtimeMs
  ) {
    throw new PlatformDerivedVideoIntegrationError(
      `${label} changed while it was being read: ${filePath}`
    );
  }
  return { text, sha256: sha256Text(text), sizeBytes: before.size };
}

async function readStableJson(filePath, label) {
  const record = await readStableText(filePath, label);
  let value;
  try {
    value = JSON.parse(record.text);
  } catch (error) {
    throw new PlatformDerivedVideoIntegrationError(
      `${label} is not valid JSON (${error.message}): ${filePath}`
    );
  }
  return { ...record, value };
}

function validateReceiptShape(receipt) {
  const problems = [];
  if (
    !exactKeys(
      receipt,
      [
        "schemaVersion",
        "episodeNumber",
        "artifactKind",
        "status",
        "uploadAuthorized",
        "createdAt",
        "source",
        "artifact",
        "encode",
        "validation",
        "evidence",
      ],
      "Receipt",
      problems
    )
  ) {
    return problems;
  }

  problem(receipt.schemaVersion === 1, "Receipt schemaVersion must be 1.", problems);
  problem(receipt.episodeNumber === EPISODE_NUMBER, "Receipt episodeNumber must be 5.", problems);
  problem(
    receipt.artifactKind === "direct_platform_video",
    "Receipt artifactKind must be direct_platform_video.",
    problems
  );
  problem(receipt.status === "validated_local", "Receipt status must be validated_local.", problems);
  problem(receipt.uploadAuthorized === false, "Receipt uploadAuthorized must be false.", problems);
  problem(validTimestamp(receipt.createdAt), "Receipt createdAt must be a valid RFC 3339 timestamp.", problems);

  for (const [key, label] of [
    ["source", "Receipt source"],
    ["artifact", "Receipt artifact"],
  ]) {
    if (exactKeys(receipt[key], ["path", "sha256", "sizeBytes"], label, problems)) {
      problem(
        typeof receipt[key].path === "string" && path.isAbsolute(receipt[key].path),
        `${label} path must be absolute.`,
        problems
      );
      problem(validSha256(receipt[key].sha256), `${label} SHA-256 is invalid.`, problems);
      problem(validPositiveInteger(receipt[key].sizeBytes), `${label} sizeBytes is invalid.`, problems);
    }
  }
  if (isPlainObject(receipt.artifact)) {
    problem(
      receipt.artifact.sizeBytes < 10_000_000_000,
      "Receipt artifact must be smaller than 10,000,000,000 bytes.",
      problems
    );
  }

  if (
    exactKeys(
      receipt.encode,
      [
        "ffmpegVersion",
        "videoCodec",
        "preset",
        "crf",
        "profile",
        "level",
        "pixelFormat",
        "configuredMaxRateBitsPerSecond",
        "configuredBufferSizeBits",
        "bFrames",
        "gopFrames",
        "sceneCutThreshold",
        "videoPadSeconds",
        "audioMode",
        "fastStart",
        "negativeCtsOffsets",
        "editListsDisabled",
      ],
      "Receipt encode",
      problems
    )
  ) {
    const encode = receipt.encode;
    problem(
      typeof encode.ffmpegVersion === "string" && encode.ffmpegVersion.startsWith("ffmpeg version "),
      "Receipt encode ffmpegVersion is invalid.",
      problems
    );
    for (const [key, expected] of Object.entries({
      videoCodec: "libx264",
      preset: "slow",
      crf: 18,
      profile: "High",
      level: "4.2",
      pixelFormat: "yuv420p",
      configuredMaxRateBitsPerSecond: 18_000_000,
      configuredBufferSizeBits: 5_000_000,
      bFrames: 2,
      gopFrames: 60,
      sceneCutThreshold: 0,
      audioMode: "packet_copy",
      fastStart: true,
      negativeCtsOffsets: true,
      editListsDisabled: true,
    })) {
      problem(encode[key] === expected, `Receipt encode ${key} must be ${JSON.stringify(expected)}.`, problems);
    }
    problem(
      validFiniteNumber(encode.videoPadSeconds) &&
        encode.videoPadSeconds >= 0 &&
        encode.videoPadSeconds <= 0.25,
      "Receipt encode videoPadSeconds must be between 0 and 0.25.",
      problems
    );
  }

  if (
    exactKeys(
      receipt.validation,
      [
        "fullDecodePassed",
        "constantFrameRatePassed",
        "editListAtomsAbsent",
        "moovBeforeMdat",
        "sourceDurationSeconds",
        "sourceVideoDurationSeconds",
        "sourceAudioDurationSeconds",
        "artifactDurationSeconds",
        "durationDeltaSeconds",
        "audioVideoDurationDeltaSeconds",
        "sameTrackDurationPassed",
        "firstVideoPtsSeconds",
        "sourceVideoFrameCount",
        "artifactVideoFrameCount",
        "paddingFrameCount",
        "maximumGopGapSeconds",
        "gopTailSeconds",
        "streamCount",
        "video",
        "audio",
        "formatBitRate",
        "peakOneSecondVideoPacketPayloadBitsPerSecond",
        "platformBitRateCeilingBitsPerSecond",
      ],
      "Receipt validation",
      problems
    )
  ) {
    const validation = receipt.validation;
    for (const key of [
      "fullDecodePassed",
      "constantFrameRatePassed",
      "editListAtomsAbsent",
      "moovBeforeMdat",
      "sameTrackDurationPassed",
    ]) {
      problem(validation[key] === true, `Receipt validation ${key} must be true.`, problems);
    }
    for (const key of [
      "sourceDurationSeconds",
      "sourceVideoDurationSeconds",
      "sourceAudioDurationSeconds",
      "artifactDurationSeconds",
    ]) {
      problem(
        validPositiveNumber(validation[key]) && validation[key] < 14_400,
        `Receipt validation ${key} must be between 0 and 14,400 seconds.`,
        problems
      );
    }
    problem(
      validFiniteNumber(validation.durationDeltaSeconds) &&
        validation.durationDeltaSeconds >= 0 &&
        validation.durationDeltaSeconds <= 0.25,
      "Receipt validation durationDeltaSeconds must be between 0 and 0.25.",
      problems
    );
    problem(
      validFiniteNumber(validation.audioVideoDurationDeltaSeconds) &&
        validation.audioVideoDurationDeltaSeconds >= 0 &&
        validation.audioVideoDurationDeltaSeconds <= 0.025,
      "Receipt validation audioVideoDurationDeltaSeconds must be between 0 and 0.025.",
      problems
    );
    problem(
      validFiniteNumber(validation.firstVideoPtsSeconds) &&
        validation.firstVideoPtsSeconds >= 0 &&
        validation.firstVideoPtsSeconds <= 0.05,
      "Receipt validation firstVideoPtsSeconds must be between 0 and 0.05.",
      problems
    );
    problem(validPositiveInteger(validation.sourceVideoFrameCount), "Receipt source frame count is invalid.", problems);
    problem(validPositiveInteger(validation.artifactVideoFrameCount), "Receipt artifact frame count is invalid.", problems);
    problem(
      Number.isSafeInteger(validation.paddingFrameCount) && validation.paddingFrameCount >= 0,
      "Receipt padding frame count is invalid.",
      problems
    );
    if (
      validPositiveInteger(validation.sourceVideoFrameCount) &&
      validPositiveInteger(validation.artifactVideoFrameCount) &&
      Number.isSafeInteger(validation.paddingFrameCount)
    ) {
      problem(
        validation.artifactVideoFrameCount ===
          validation.sourceVideoFrameCount + validation.paddingFrameCount,
        "Receipt artifact frame count does not equal source plus padding frames.",
        problems
      );
    }
    if (isPlainObject(receipt.encode) && validFiniteNumber(receipt.encode.videoPadSeconds)) {
      problem(
        Math.abs(validation.paddingFrameCount / 60 - receipt.encode.videoPadSeconds) <= 0.01,
        "Receipt padding frame count does not match videoPadSeconds at 60 fps.",
        problems
      );
    }
    problem(
      validPositiveNumber(validation.maximumGopGapSeconds) &&
        validation.maximumGopGapSeconds <= 1.05,
      "Receipt maximum GOP gap must be no more than 1.05 seconds.",
      problems
    );
    problem(
      validFiniteNumber(validation.gopTailSeconds) &&
        validation.gopTailSeconds >= 0 &&
        validation.gopTailSeconds <= 1.05,
      "Receipt GOP tail must be between 0 and 1.05 seconds.",
      problems
    );
    problem(validation.streamCount === 2, "Receipt streamCount must be 2.", problems);
    problem(
      validation.platformBitRateCeilingBitsPerSecond === PLATFORM_BITRATE_CEILING,
      "Receipt platform bitrate ceiling must be 24,000,000 bits per second.",
      problems
    );
    for (const key of ["formatBitRate", "peakOneSecondVideoPacketPayloadBitsPerSecond"]) {
      problem(
        validPositiveInteger(validation[key]) && validation[key] <= PLATFORM_BITRATE_CEILING,
        `Receipt validation ${key} must be a positive integer no greater than the platform ceiling.`,
        problems
      );
    }
    if (
      validPositiveNumber(validation.sourceDurationSeconds) &&
      validPositiveNumber(validation.artifactDurationSeconds) &&
      validFiniteNumber(validation.durationDeltaSeconds)
    ) {
      problem(
        closeEnough(
          Math.abs(validation.sourceDurationSeconds - validation.artifactDurationSeconds),
          validation.durationDeltaSeconds
        ),
        "Receipt durationDeltaSeconds does not match the source and artifact durations.",
        problems
      );
    }

    if (
      exactKeys(
        validation.video,
        [
          "codec",
          "profile",
          "width",
          "height",
          "frameRate",
          "colorRange",
          "colorSpace",
          "colorTransfer",
          "colorPrimaries",
          "fieldOrder",
          "bitRate",
        ],
        "Receipt validation video",
        problems
      )
    ) {
      for (const [key, expected] of Object.entries({
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
      })) {
        problem(
          validation.video[key] === expected,
          `Receipt validation video ${key} must be ${JSON.stringify(expected)}.`,
          problems
        );
      }
      problem(
        validPositiveInteger(validation.video.bitRate) &&
          validation.video.bitRate <= PLATFORM_BITRATE_CEILING,
        "Receipt validation video bitRate must be no greater than the platform ceiling.",
        problems
      );
    }

    if (
      exactKeys(
        validation.audio,
        [
          "codec",
          "profile",
          "sampleRateHz",
          "channels",
          "sourceStreamSha256",
          "artifactStreamSha256",
          "packetIdentityPassed",
          "packetSignatureSha256",
          "sourceExtradataSha256",
          "artifactExtradataSha256",
          "extradataIdentityPassed",
          "integratedLufs",
          "truePeakDbtp",
        ],
        "Receipt validation audio",
        problems
      )
    ) {
      const audio = validation.audio;
      for (const [key, expected] of Object.entries({
        codec: "aac",
        profile: "LC",
        sampleRateHz: 48_000,
        channels: 2,
        packetIdentityPassed: true,
        extradataIdentityPassed: true,
      })) {
        problem(audio[key] === expected, `Receipt validation audio ${key} must be ${JSON.stringify(expected)}.`, problems);
      }
      for (const key of [
        "sourceStreamSha256",
        "artifactStreamSha256",
        "packetSignatureSha256",
        "sourceExtradataSha256",
        "artifactExtradataSha256",
      ]) {
        problem(validSha256(audio[key]), `Receipt validation audio ${key} is invalid.`, problems);
      }
      problem(
        audio.sourceStreamSha256 === audio.artifactStreamSha256,
        "Receipt source and artifact audio stream hashes must match.",
        problems
      );
      problem(
        audio.sourceExtradataSha256 === audio.artifactExtradataSha256,
        "Receipt source and artifact audio extradata hashes must match.",
        problems
      );
      problem(
        validFiniteNumber(audio.integratedLufs) &&
          audio.integratedLufs >= -17 &&
          audio.integratedLufs <= -15,
        "Receipt audio integrated loudness must be between -17 and -15 LUFS.",
        problems
      );
      problem(
        validFiniteNumber(audio.truePeakDbtp) && audio.truePeakDbtp <= -1,
        "Receipt audio true peak must be no higher than -1 dBTP.",
        problems
      );
    }
  }

  if (
    exactKeys(
      receipt.evidence,
      ["batchPath", ...Object.keys(EVIDENCE_FILES)],
      "Receipt evidence",
      problems
    )
  ) {
    const evidence = receipt.evidence;
    problem(
      typeof evidence.batchPath === "string" && path.isAbsolute(evidence.batchPath),
      "Receipt evidence batchPath must be absolute.",
      problems
    );
    for (const key of Object.keys(EVIDENCE_FILES)) {
      const required = key === "fullDecodeLog" ? ["path", "sha256", "sizeBytes"] : ["path", "sha256"];
      if (exactKeys(evidence[key], required, `Receipt evidence ${key}`, problems)) {
        problem(
          typeof evidence[key].path === "string" && path.isAbsolute(evidence[key].path),
          `Receipt evidence ${key} path must be absolute.`,
          problems
        );
        problem(validSha256(evidence[key].sha256), `Receipt evidence ${key} SHA-256 is invalid.`, problems);
        if (key === "fullDecodeLog") {
          problem(
            Number.isSafeInteger(evidence[key].sizeBytes) && evidence[key].sizeBytes >= 0,
            "Receipt evidence fullDecodeLog sizeBytes is invalid.",
            problems
          );
        }
      }
    }
  }
  return problems;
}

function validateCurrentState({ catalog, audit, receipt }) {
  const problems = [];
  const catalogValidation = validateCatalog(catalog);
  if (!catalogValidation.valid) {
    problems.push(...catalogValidation.errors.map((entry) => `Input catalog: ${entry}`));
  }
  const auditValidation = validateIntegratedAudioAudit(audit);
  if (!auditValidation.valid) {
    problems.push(...auditValidation.errors.map((entry) => `Input audio audit: ${entry}`));
  }
  problem(
    catalog.revision === BASE_CATALOG_REVISION,
    `Catalog revision must be ${BASE_CATALOG_REVISION}.`,
    problems
  );
  problem(
    !Object.hasOwn(catalog.assetRegistry ?? {}, DERIVED_ASSET_ID),
    `Catalog asset ${DERIVED_ASSET_ID} must not already exist.`,
    problems
  );
  const episode = catalog.episodes?.find((entry) => entry.number === EPISODE_NUMBER);
  problem(Boolean(episode), "Catalog Episode 5 is missing.", problems);
  problem(
    episode?.assetRefs?.fullVideo === MASTER_ASSET_ID,
    `Catalog Episode 5 fullVideo must remain ${MASTER_ASSET_ID}.`,
    problems
  );
  const masterAsset = catalog.assetRegistry?.[MASTER_ASSET_ID];
  problem(Boolean(masterAsset), `Catalog asset ${MASTER_ASSET_ID} is missing.`, problems);
  if (masterAsset) {
    problem(masterAsset.kind === "video", "Episode 5 master asset kind must be video.", problems);
    problem(masterAsset.role === "fullVideo", "Episode 5 master asset role must be fullVideo.", problems);
    problem(masterAsset.status === "verified", "Episode 5 master asset must be verified.", problems);
    problem(masterAsset.mediaType === "video/mp4", "Episode 5 master asset must be video/mp4.", problems);
    problem(validSha256(masterAsset.sha256), "Episode 5 master asset SHA-256 is invalid.", problems);
    problem(validPositiveInteger(masterAsset.sizeBytes), "Episode 5 master asset size is invalid.", problems);
    problem(receipt.source?.sha256 === masterAsset.sha256, "Receipt source SHA-256 does not match the catalog master.", problems);
    problem(receipt.source?.sizeBytes === masterAsset.sizeBytes, "Receipt source size does not match the catalog master.", problems);
  }

  problem(audit.localDelivery?.catalogRevision === BASE_CATALOG_REVISION, "Audio audit local delivery must reference catalog revision 7.", problems);
  problem(audit.localDelivery?.uploadAuthorized === false, "Audio audit must not authorize uploads.", problems);
  problem(audit.localDelivery?.uploadsPerformed === false, "Audio audit must not claim uploads were performed.", problems);
  const auditEpisode = audit.episodes?.find((entry) => entry.number === EPISODE_NUMBER);
  problem(Boolean(auditEpisode), "Audio audit Episode 5 is missing.", problems);
  if (episode && auditEpisode) {
    problem(auditEpisode.title === episode.title, "Audio audit Episode 5 title does not match the catalog.", problems);
    problem(auditEpisode.rssGuid === episode.rssGuid, "Audio audit Episode 5 RSS GUID does not match the catalog.", problems);
  }
  const auditedMaster = auditEpisode?.validatedDelivery?.masterVideo;
  if (masterAsset && auditedMaster) {
    problem(auditedMaster.assetId === MASTER_ASSET_ID, "Audio audit Episode 5 master asset ID is wrong.", problems);
    problem(auditedMaster.sha256 === masterAsset.sha256, "Audio audit Episode 5 master SHA-256 does not match the catalog.", problems);
    problem(auditedMaster.sizeBytes === masterAsset.sizeBytes, "Audio audit Episode 5 master size does not match the catalog.", problems);
    problem(
      Math.abs(auditedMaster.durationSeconds - receipt.validation.sourceDurationSeconds) <= 0.25,
      "Receipt source duration does not match the audited Episode 5 master.",
      problems
    );
  }
  problem(
    Array.isArray(auditEpisode?.validatedDelivery?.platformDerivedVideos) &&
      auditEpisode.validatedDelivery.platformDerivedVideos.length === 0,
    "Audio audit Episode 5 must not already contain a platform-derived video.",
    problems
  );
  const spotifyTargets = (auditEpisode?.remoteReplacementTargets ?? []).filter(
    (entry) => entry.platform === "spotify"
  );
  problem(spotifyTargets.length === 1, "Audio audit Episode 5 must contain exactly one Spotify target.", problems);
  const spotifyTarget = spotifyTargets[0];
  if (spotifyTarget) {
    problem(spotifyTarget.assetRole === "fullVideo", "Episode 5 Spotify target assetRole must be fullVideo.", problems);
    problem(
      spotifyTarget.status === "blocked_platform_derivative_required",
      "Episode 5 Spotify target must be blocked on its platform derivative.",
      problems
    );
    problem(
      spotifyTarget.action === EXPECTED_SPOTIFY_BLOCKED_ACTION,
      "Episode 5 Spotify target action does not match the approved blocked state.",
      problems
    );
  }
  return { problems, episode, auditEpisode, masterAsset, spotifyTarget };
}

export function validatePlatformVideoReceiptData({
  receipt,
  receiptSha256,
  expectedReceiptSha256,
  catalog,
  audit,
}) {
  const problems = validateReceiptShape(receipt);
  problem(validSha256(expectedReceiptSha256), "An expected receipt SHA-256 is required.", problems);
  problem(validSha256(receiptSha256), "Calculated receipt SHA-256 is invalid.", problems);
  problem(
    receiptSha256 === expectedReceiptSha256,
    "Receipt SHA-256 does not match the approved handoff hash.",
    problems
  );
  if (problems.length === 0) {
    problems.push(...validateCurrentState({ catalog, audit, receipt }).problems);
  }
  if (problems.length > 0) throw new PlatformDerivedVideoIntegrationError(problems);
}

async function stableHashMatches(filePath, expectedSize, expectedHash, label) {
  let before;
  try {
    before = await fs.lstat(filePath);
  } catch (error) {
    throw new PlatformDerivedVideoIntegrationError(
      `${label} cannot be inspected (${error.message}): ${filePath}`
    );
  }
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new PlatformDerivedVideoIntegrationError(`${label} must be a regular, non-symlink file.`);
  }
  if (before.size !== expectedSize) {
    throw new PlatformDerivedVideoIntegrationError(`${label} byte size does not match its receipt.`);
  }
  const actualHash = await hashFile(filePath);
  const after = await fs.lstat(filePath);
  if (
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.size !== after.size ||
    before.mtimeMs !== after.mtimeMs
  ) {
    throw new PlatformDerivedVideoIntegrationError(`${label} changed while it was being hashed.`);
  }
  if (actualHash !== expectedHash) {
    throw new PlatformDerivedVideoIntegrationError(`${label} SHA-256 does not match its receipt.`);
  }
}

function probeStreams(probe, type) {
  return Array.isArray(probe?.streams)
    ? probe.streams.filter((stream) => stream?.codec_type === type)
    : [];
}

function numberValue(value) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateEvidenceSemantics({ receipt, evidenceRecords }) {
  const problems = [];
  const sourceProbe = evidenceRecords.sourceProbe.value;
  const artifactProbe = evidenceRecords.artifactProbe.value;
  const sourceVideos = probeStreams(sourceProbe, "video");
  const sourceAudios = probeStreams(sourceProbe, "audio");
  const artifactVideos = probeStreams(artifactProbe, "video");
  const artifactAudios = probeStreams(artifactProbe, "audio");
  problem(sourceVideos.length === 1 && sourceAudios.length === 1, "Source probe must contain one video and one audio stream.", problems);
  problem(artifactVideos.length === 1 && artifactAudios.length === 1, "Artifact probe must contain one video and one audio stream.", problems);

  const video = artifactVideos[0];
  if (video) {
    for (const [key, expected] of Object.entries({
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
    })) {
      problem(video[key] === expected, `Artifact probe video ${key} must be ${JSON.stringify(expected)}.`, problems);
    }
    problem(numberValue(video.bit_rate) === receipt.validation.video.bitRate, "Artifact probe video bitrate does not match the receipt.", problems);
    problem(numberValue(video.nb_frames) === receipt.validation.artifactVideoFrameCount, "Artifact probe frame count does not match the receipt.", problems);
  }
  const audio = artifactAudios[0];
  if (audio) {
    for (const [key, expected] of Object.entries({
      codec_name: "aac",
      profile: "LC",
      sample_rate: "48000",
      channels: 2,
      channel_layout: "stereo",
    })) {
      problem(audio[key] === expected, `Artifact probe audio ${key} must be ${JSON.stringify(expected)}.`, problems);
    }
  }
  const sourceVideo = sourceVideos[0];
  if (sourceVideo) {
    problem(numberValue(sourceVideo.nb_frames) === receipt.validation.sourceVideoFrameCount, "Source probe frame count does not match the receipt.", problems);
    problem(closeEnough(numberValue(sourceVideo.duration), receipt.validation.sourceVideoDurationSeconds), "Source probe video duration does not match the receipt.", problems);
  }
  const sourceAudio = sourceAudios[0];
  if (sourceAudio) {
    problem(closeEnough(numberValue(sourceAudio.duration), receipt.validation.sourceAudioDurationSeconds), "Source probe audio duration does not match the receipt.", problems);
  }
  problem(closeEnough(numberValue(sourceProbe?.format?.duration), receipt.validation.sourceDurationSeconds), "Source probe format duration does not match the receipt.", problems);
  problem(closeEnough(numberValue(artifactProbe?.format?.duration), receipt.validation.artifactDurationSeconds), "Artifact probe format duration does not match the receipt.", problems);
  problem(numberValue(artifactProbe?.format?.size) === receipt.artifact.sizeBytes, "Artifact probe byte size does not match the receipt.", problems);
  problem(numberValue(artifactProbe?.format?.bit_rate) === receipt.validation.formatBitRate, "Artifact probe format bitrate does not match the receipt.", problems);

  const loudness = evidenceRecords.loudness.value;
  problem(numberValue(loudness?.input_i) === receipt.validation.audio.integratedLufs, "Loudness evidence integrated LUFS does not match the receipt.", problems);
  problem(numberValue(loudness?.input_tp) === receipt.validation.audio.truePeakDbtp, "Loudness evidence true peak does not match the receipt.", problems);
  const packetRate = evidenceRecords.packetRate.value;
  problem(numberValue(packetRate?.windowSeconds) === 1, "Packet-rate evidence must use a one-second window.", problems);
  problem(
    numberValue(packetRate?.peakPayloadBitsPerSecond) ===
      receipt.validation.peakOneSecondVideoPacketPayloadBitsPerSecond,
    "Packet-rate evidence does not match the receipt.",
    problems
  );
  const gop = evidenceRecords.gop.value;
  problem(numberValue(gop?.maximumGapSeconds) === receipt.validation.maximumGopGapSeconds, "GOP evidence maximum gap does not match the receipt.", problems);
  problem(numberValue(gop?.tailSeconds) === receipt.validation.gopTailSeconds, "GOP evidence tail does not match the receipt.", problems);

  const decodeText = evidenceRecords.fullDecodeLog.text;
  problem(/VFR:0\.000000 \(0\/[1-9][0-9]*\)/.test(decodeText), "Full-decode evidence does not confirm constant frame rate.", problems);
  const atomText = evidenceRecords.mp4AtomTrace.text;
  problem(!/type:'(?:edts|elst)'/.test(atomText), "MP4 atom evidence contains an edit list.", problems);
  const moovIndex = atomText.indexOf("type:'moov' parent:'root'");
  const mdatIndex = atomText.indexOf("type:'mdat' parent:'root'");
  problem(moovIndex >= 0 && mdatIndex >= 0 && moovIndex < mdatIndex, "MP4 atom evidence does not place moov before mdat.", problems);
  const command = evidenceRecords.encodeCommand.text;
  for (const fragment of [
    "-c:a copy",
    "-maxrate 18M",
    "-g 60",
    "-sc_threshold 0",
    "-movflags +faststart+negative_cts_offsets",
    "-use_editlist 0",
  ]) {
    problem(command.includes(fragment), `Encode command evidence is missing ${fragment}.`, problems);
  }
  problem(
    receipt.evidence.sourceAudioPackets.sha256 === receipt.evidence.artifactAudioPackets.sha256 &&
      receipt.evidence.sourceAudioPackets.sha256 === receipt.validation.audio.packetSignatureSha256,
    "Audio packet evidence hashes do not prove packet identity.",
    problems
  );
  if (problems.length > 0) throw new PlatformDerivedVideoIntegrationError(problems);
}

export async function verifyPlatformVideoFiles({ receipt, receiptPath, catalog, configPath }) {
  const expectedReceiptPath = await resolveSourceRef(RECEIPT_URI, { configPath });
  const actualReceiptPath = await fs.realpath(receiptPath);
  if (actualReceiptPath !== expectedReceiptPath) {
    throw new PlatformDerivedVideoIntegrationError(
      `Receipt path must resolve to ${RECEIPT_URI}.`
    );
  }

  const expectedSourcePath = await resolveCatalogAsset(catalog, MASTER_ASSET_ID, { configPath });
  const actualSourcePath = await fs.realpath(receipt.source.path);
  if (actualSourcePath !== expectedSourcePath) {
    throw new PlatformDerivedVideoIntegrationError(
      `Receipt source path does not resolve to catalog asset ${MASTER_ASSET_ID}.`
    );
  }
  const expectedArtifactPath = await resolveSourceRef(DERIVED_ASSET_URI, { configPath });
  const actualArtifactPath = await fs.realpath(receipt.artifact.path);
  if (actualArtifactPath !== expectedArtifactPath) {
    throw new PlatformDerivedVideoIntegrationError(
      `Receipt artifact path must resolve to ${DERIVED_ASSET_URI}.`
    );
  }
  if (actualSourcePath === actualArtifactPath) {
    throw new PlatformDerivedVideoIntegrationError("Source and derived artifact paths must differ.");
  }
  await stableHashMatches(
    actualSourcePath,
    receipt.source.sizeBytes,
    receipt.source.sha256,
    "Episode 5 source master"
  );
  await stableHashMatches(
    actualArtifactPath,
    receipt.artifact.sizeBytes,
    receipt.artifact.sha256,
    "Episode 5 Spotify derivative"
  );

  const batchPath = path.resolve(receipt.evidence.batchPath);
  let batchStats;
  try {
    batchStats = await fs.lstat(batchPath);
  } catch (error) {
    throw new PlatformDerivedVideoIntegrationError(
      `Evidence batch cannot be inspected (${error.message}): ${batchPath}`
    );
  }
  if (
    !path.isAbsolute(receipt.evidence.batchPath) ||
    path.basename(batchPath) !== PLATFORM_VARIANT_BATCH_ID ||
    !batchStats.isDirectory() ||
    batchStats.isSymbolicLink() ||
    (await fs.realpath(batchPath)) !== batchPath
  ) {
    throw new PlatformDerivedVideoIntegrationError(
      `Evidence batch must be a regular ${PLATFORM_VARIANT_BATCH_ID} directory.`
    );
  }

  const evidenceRecords = {};
  for (const [key, filename] of Object.entries(EVIDENCE_FILES)) {
    const entry = receipt.evidence[key];
    const expectedPath = path.join(batchPath, filename);
    if (path.resolve(entry.path) !== expectedPath) {
      throw new PlatformDerivedVideoIntegrationError(
        `Evidence ${key} path must be ${expectedPath}.`
      );
    }
    const stats = await fs.lstat(expectedPath);
    await stableHashMatches(expectedPath, stats.size, entry.sha256, `Evidence ${key}`);
    if (key === "fullDecodeLog" && stats.size !== entry.sizeBytes) {
      throw new PlatformDerivedVideoIntegrationError(
        "Evidence fullDecodeLog byte size does not match its receipt."
      );
    }
    if (["sourceProbe", "artifactProbe", "loudness", "packetRate", "gop"].includes(key)) {
      evidenceRecords[key] = await readStableJson(expectedPath, `Evidence ${key}`);
    } else if (["fullDecodeLog", "mp4AtomTrace", "encodeCommand"].includes(key)) {
      evidenceRecords[key] = await readStableText(expectedPath, `Evidence ${key}`);
    }
    if (evidenceRecords[key]?.sha256 !== undefined && evidenceRecords[key].sha256 !== entry.sha256) {
      throw new PlatformDerivedVideoIntegrationError(
        `Evidence ${key} changed between integrity and semantic validation.`
      );
    }
  }
  validateEvidenceSemantics({ receipt, evidenceRecords });
}

export function buildPlatformDerivedVideoIntegration({
  catalog,
  audit,
  receipt,
  receiptSha256,
  now,
}) {
  if (!validTimestamp(now)) {
    throw new PlatformDerivedVideoIntegrationError("Integration timestamp must be valid RFC 3339.");
  }
  const current = validateCurrentState({ catalog, audit, receipt });
  if (current.problems.length > 0) {
    throw new PlatformDerivedVideoIntegrationError(current.problems);
  }

  const nextCatalog = structuredClone(catalog);
  nextCatalog.assetRegistry[DERIVED_ASSET_ID] = {
    kind: "video",
    role: "spotifyVideo",
    uri: DERIVED_ASSET_URI,
    sha256: receipt.artifact.sha256,
    sizeBytes: receipt.artifact.sizeBytes,
    mediaType: "video/mp4",
    status: "verified",
  };
  nextCatalog.revision = NEXT_CATALOG_REVISION;
  nextCatalog.updatedAt = now;
  if (!isDeepStrictEqual(nextCatalog.episodes, catalog.episodes)) {
    throw new PlatformDerivedVideoIntegrationError("Generated catalog changed episode bindings.");
  }
  const catalogValidation = validateCatalog(nextCatalog);
  if (!catalogValidation.valid) {
    throw new PlatformDerivedVideoIntegrationError(
      catalogValidation.errors.map((entry) => `Generated catalog: ${entry}`)
    );
  }

  const nextAudit = structuredClone(audit);
  nextAudit.updatedAt = now;
  const nextEpisode = nextAudit.episodes.find((entry) => entry.number === EPISODE_NUMBER);
  nextEpisode.validatedDelivery.platformDerivedVideos.push({
    platform: "spotify",
    assetId: DERIVED_ASSET_ID,
    catalogRevision: NEXT_CATALOG_REVISION,
    receiptSha256,
    uri: DERIVED_ASSET_URI,
    sha256: receipt.artifact.sha256,
    sizeBytes: receipt.artifact.sizeBytes,
    mediaType: "video/mp4",
    videoCodec: receipt.validation.video.codec,
    averageBitrateBitsPerSecond: receipt.validation.formatBitRate,
    durationSeconds: receipt.validation.artifactDurationSeconds,
    integratedLufs: receipt.validation.audio.integratedLufs,
    truePeakDbtp: receipt.validation.audio.truePeakDbtp,
    status: "validated_local_derivative",
  });
  const spotifyTarget = nextEpisode.remoteReplacementTargets.find(
    (entry) => entry.platform === "spotify"
  );
  spotifyTarget.action = NEXT_SPOTIFY_ACTION;
  spotifyTarget.status = "pending";
  const auditValidation = validateIntegratedAudioAudit(nextAudit);
  if (!auditValidation.valid) {
    throw new PlatformDerivedVideoIntegrationError(
      auditValidation.errors.map((entry) => `Generated audio audit: ${entry}`)
    );
  }
  problem(nextAudit.localDelivery.uploadAuthorized === false, "Generated audit authorized uploads.", current.problems);
  problem(nextAudit.localDelivery.uploadsPerformed === false, "Generated audit claimed uploads.", current.problems);
  if (current.problems.length > 0) {
    throw new PlatformDerivedVideoIntegrationError(current.problems);
  }
  return { catalog: nextCatalog, audit: nextAudit };
}

async function writeAtomic(filePath, text) {
  const temporary = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
  const handle = await fs.open(temporary, "wx", 0o644);
  try {
    await handle.writeFile(text, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await fs.rename(temporary, filePath);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
}

async function applyIntegration({
  catalogPath,
  auditPath,
  catalogRecord,
  auditRecord,
  nextCatalog,
  nextAudit,
}) {
  const lockPath = path.join(
    path.dirname(catalogPath),
    ".platform-derived-video-integration.lock"
  );
  let lock;
  try {
    lock = await fs.open(lockPath, "wx", 0o600);
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new PlatformDerivedVideoIntegrationError(
        `Integration lock already exists: ${lockPath}`
      );
    }
    throw error;
  }

  try {
    const currentCatalog = await fs.readFile(catalogPath, "utf8");
    const currentAudit = await fs.readFile(auditPath, "utf8");
    if (currentCatalog !== catalogRecord.text || currentAudit !== auditRecord.text) {
      throw new PlatformDerivedVideoIntegrationError(
        "Catalog or audio audit changed after preflight; refusing to apply."
      );
    }
    const nextCatalogText = `${JSON.stringify(nextCatalog, null, 2)}\n`;
    const nextAuditText = `${JSON.stringify(nextAudit, null, 2)}\n`;
    try {
      await writeAtomic(catalogPath, nextCatalogText);
      await writeAtomic(auditPath, nextAuditText);
    } catch (error) {
      await writeAtomic(catalogPath, catalogRecord.text);
      await writeAtomic(auditPath, auditRecord.text);
      throw error;
    }
    const writtenCatalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
    const writtenAudit = JSON.parse(await fs.readFile(auditPath, "utf8"));
    const catalogValidation = validateCatalog(writtenCatalog);
    const auditValidation = validateIntegratedAudioAudit(writtenAudit);
    if (!catalogValidation.valid || !auditValidation.valid) {
      await writeAtomic(catalogPath, catalogRecord.text);
      await writeAtomic(auditPath, auditRecord.text);
      throw new PlatformDerivedVideoIntegrationError(
        "Post-write validation failed; original files were restored."
      );
    }
  } finally {
    await lock?.close();
    await fs.rm(lockPath, { force: true });
  }
}

export async function integratePlatformDerivedVideo({
  receiptPath,
  expectedReceiptSha256,
  catalogPath = DEFAULT_CATALOG_PATH,
  auditPath = DEFAULT_AUDIT_PATH,
  configPath = sourcesConfigPath(),
  apply = false,
  now = new Date().toISOString(),
  verifyFiles = true,
}) {
  const resolvedReceiptPath = path.resolve(receiptPath);
  const catalogRecord = await readStableJson(path.resolve(catalogPath), "Master catalog");
  const auditRecord = await readStableJson(path.resolve(auditPath), "Audio replacement audit");
  const receiptRecord = await readStableJson(resolvedReceiptPath, "Platform video receipt");
  validatePlatformVideoReceiptData({
    receipt: receiptRecord.value,
    receiptSha256: receiptRecord.sha256,
    expectedReceiptSha256,
    catalog: catalogRecord.value,
    audit: auditRecord.value,
  });
  if (verifyFiles) {
    await verifyPlatformVideoFiles({
      receipt: receiptRecord.value,
      receiptPath: resolvedReceiptPath,
      catalog: catalogRecord.value,
      configPath,
    });
  }
  const next = buildPlatformDerivedVideoIntegration({
    catalog: catalogRecord.value,
    audit: auditRecord.value,
    receipt: receiptRecord.value,
    receiptSha256: receiptRecord.sha256,
    now,
  });
  if (apply) {
    await applyIntegration({
      catalogPath: path.resolve(catalogPath),
      auditPath: path.resolve(auditPath),
      catalogRecord,
      auditRecord,
      nextCatalog: next.catalog,
      nextAudit: next.audit,
    });
  }
  return {
    applied: apply,
    episodeNumber: EPISODE_NUMBER,
    assetId: DERIVED_ASSET_ID,
    artifactSha256: receiptRecord.value.artifact.sha256,
    receiptSha256: receiptRecord.sha256,
    catalogRevisionBefore: catalogRecord.value.revision,
    catalogRevisionAfter: next.catalog.revision,
    remoteUploadsClaimed: false,
  };
}

function usage() {
  return [
    "Usage:",
    "  node scripts/publish/integrate-platform-derived-video.mjs \\",
    "    --receipt <platform-video.receipt.json> \\",
    "    --receipt-sha256 <approved-sha256> [--apply]",
    "",
    "Without --apply, every receipt, catalog, audit, binary, and evidence check runs without writing.",
    "This command never uploads media or changes a remote service.",
  ].join("\n");
}

function parseArguments(argv) {
  const options = { apply: false };
  const nextValue = (index, argument) => {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new PlatformDerivedVideoIntegrationError(`${argument} requires a value.`);
    }
    return value;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") options.apply = true;
    else if (argument === "--receipt") options.receiptPath = nextValue(index++, argument);
    else if (argument === "--receipt-sha256") {
      options.expectedReceiptSha256 = nextValue(index++, argument);
    } else if (argument === "--catalog") options.catalogPath = nextValue(index++, argument);
    else if (argument === "--audit") options.auditPath = nextValue(index++, argument);
    else if (argument === "--sources-config") options.configPath = nextValue(index++, argument);
    else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new PlatformDerivedVideoIntegrationError(`Unknown argument: ${argument}`);
  }
  if (!options.help && !options.receiptPath) {
    throw new PlatformDerivedVideoIntegrationError("--receipt is required.");
  }
  if (!options.help && !options.expectedReceiptSha256) {
    throw new PlatformDerivedVideoIntegrationError("--receipt-sha256 is required.");
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (options.apply && os.userInfo().username !== "otto") {
    throw new PlatformDerivedVideoIntegrationError(
      "--apply must run as the otto desktop user."
    );
  }
  const result = await integratePlatformDerivedVideo(options);
  process.stdout.write(
    `${result.applied ? "Applied" : "Validated"} Episode ${result.episodeNumber} Spotify derivative: catalog ${result.catalogRevisionBefore} -> ${result.catalogRevisionAfter}; remote uploads claimed: no.\n`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
