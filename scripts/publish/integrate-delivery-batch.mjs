import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  DEFAULT_CATALOG_PATH,
  resolveCatalogAsset,
  sourcesConfigPath,
  validateCatalog,
} from "./catalog.mjs";
import { hashFile } from "./lib.mjs";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

export const DELIVERY_BATCH_ID = "20260806T2253-0600-first-seven-loudness-v2";
export const SOURCE_EVIDENCE_BATCH_ID = "20260806T2241-0600-first-seven-loudness";
export const BASE_CATALOG_REVISION = 6;
export const DEFAULT_AUDIT_PATH = path.resolve(
  moduleDirectory,
  "../../publishing/audio-replacement-audit.json"
);
export const DEFAULT_AUDIT_SCHEMA_PATH = path.resolve(
  moduleDirectory,
  "../../publishing/audio-replacement-audit.schema.json"
);

export const APPROVED_SOURCE_SHA256 = new Map([
  [1, "5be4feefbdca2417e8a97527ea3f13d072bb07b0549127d590998f1977c6dd60"],
  [2, "7e138b91dc4c0385420f8b4f75cb316efcc77db8e88ed249b31352dbb6e5ab81"],
  [3, "a9cdd14dc73af1e16571ac3378e47cac1d3be9b25fdc87a307326667fd5eb3e4"],
  [4, "3e819ed30bc8393dfb684c0669a5b32e68843a2adeb4942f6c65991b42029d9d"],
  [5, "e625018ef62d01c90d605e5a057c0c89e79e8e71ad6c5c920604274c0076bad6"],
  [6, "846a8b843657f058a440eca57c7d43af12bf4b15c3bf57d28ba58c1d26791e8b"],
  [7, "4e8f3315048427ba5d55c7f3f46fea7945b59b977238e14fa80b41132d77354a"],
]);

const EXPECTED_NUMBERS = [...APPROVED_SOURCE_SHA256.keys()];
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const RFC3339_WITH_TIMEZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const LEGACY_AUDIT_STATUS = "awaiting_corrected_audio_and_video_masters";
const LOCAL_DELIVERY_STATUS = "validated_local_delivery";
const SOURCE_MEASUREMENT_STATUS = "measured_source_inputs";
const INTEGRATED_AUDIT_STATUS = "validated_local_delivery_pending_remote_replacement";
const EXPECTED_TARGET = { integratedLufs: -16, truePeakDbtp: -1.5, loudnessRangeLu: 11 };
const EXPECTED_ACCEPTANCE = {
  integratedLufsMinimum: -17,
  integratedLufsMaximum: -15,
  truePeakDbtpMaximum: -1,
};

const auditSchema = JSON.parse(await fs.readFile(DEFAULT_AUDIT_SCHEMA_PATH, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv, { mode: "full" });
const validateAuditSchema = ajv.compile(auditSchema);

export function validateIntegratedAudioAudit(value) {
  const valid = validateAuditSchema(value);
  return {
    valid,
    errors: valid
      ? []
      : (validateAuditSchema.errors ?? []).map(
          (error) => `${schemaErrorPath(error)} ${error.message}.`
        ),
  };
}

export class DeliveryBatchIntegrationError extends Error {
  constructor(problems) {
    const list = Array.isArray(problems) ? problems : [String(problems)];
    super(`Delivery batch integration is blocked:\n${list.map((problem) => `- ${problem}`).join("\n")}`);
    this.name = "DeliveryBatchIntegrationError";
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

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalJson(item)])
    );
  }
  return value;
}

function jsonSha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function schemaErrorPath(error) {
  const parts = error.instancePath
    .split("/")
    .filter(Boolean)
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
  if (error.keyword === "required") parts.push(error.params.missingProperty);
  if (error.keyword === "additionalProperties") parts.push(error.params.additionalProperty);
  return parts.join(".") || "audit";
}

async function readStableText(filePath, label) {
  const before = await fs.lstat(filePath);
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new DeliveryBatchIntegrationError(`${label} must be a regular, non-symlink file: ${filePath}`);
  }
  const text = await fs.readFile(filePath, "utf8");
  const after = await fs.lstat(filePath);
  if (
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.size !== after.size ||
    before.mtimeMs !== after.mtimeMs
  ) {
    throw new DeliveryBatchIntegrationError(`${label} changed while it was being read: ${filePath}`);
  }
  return { text, sha256: jsonSha256(text) };
}

async function readStableJson(filePath, label) {
  const record = await readStableText(filePath, label);
  let value;
  try {
    value = JSON.parse(record.text);
  } catch (error) {
    throw new DeliveryBatchIntegrationError(`${label} is not valid JSON (${error.message}): ${filePath}`);
  }
  return { value, ...record };
}

async function findFilesNamed(directory, filename) {
  const matches = [];
  async function visit(current) {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(entryPath);
      else if (entry.isFile() && entry.name === filename) matches.push(path.resolve(entryPath));
    }
  }
  await visit(directory);
  return matches.sort();
}

function catalogEpisodeMap(catalog, problems) {
  const episodes = Array.isArray(catalog?.episodes) ? catalog.episodes : [];
  const byNumber = new Map();
  for (const episode of episodes) {
    if (byNumber.has(episode?.number)) {
      problems.push(`Catalog contains duplicate episode number ${episode?.number}.`);
    } else {
      byNumber.set(episode?.number, episode);
    }
  }
  problem(
    isDeepStrictEqual([...byNumber.keys()].sort((left, right) => left - right), EXPECTED_NUMBERS),
    "Catalog must contain exactly episodes 1 through 7 for this batch.",
    problems
  );
  return byNumber;
}

function legacyAuditEpisodeMap(audit, catalogByNumber, problems) {
  problem(audit?.schemaVersion === 1, "Input audio audit schemaVersion must be 1.", problems);
  problem(
    audit?.auditId === "canonical-audio-loudness-2026-08-06",
    "Input audio audit ID does not match the approved baseline.",
    problems
  );
  problem(audit?.status === LEGACY_AUDIT_STATUS, `Input audio audit status must be ${LEGACY_AUDIT_STATUS}.`, problems);
  const entries = Array.isArray(audit?.episodes) ? audit.episodes : [];
  const byNumber = new Map();
  for (const entry of entries) {
    if (byNumber.has(entry?.number)) problems.push(`Audio audit contains duplicate episode number ${entry?.number}.`);
    else byNumber.set(entry?.number, entry);
  }
  problem(
    isDeepStrictEqual([...byNumber.keys()].sort((left, right) => left - right), EXPECTED_NUMBERS),
    "Input audio audit must contain exactly episodes 1 through 7.",
    problems
  );
  for (const number of EXPECTED_NUMBERS) {
    const entry = byNumber.get(number);
    const episode = catalogByNumber.get(number);
    if (!entry || !episode) continue;
    problem(entry.title === episode.title, `Episode ${number} audit title does not match the catalog.`, problems);
    problem(entry.rssGuid === episode.rssGuid, `Episode ${number} audit RSS GUID does not match the catalog.`, problems);
    problem(
      validFiniteNumber(entry.inputIntegratedLufs),
      `Episode ${number} baseline integrated loudness is missing or invalid.`,
      problems
    );
    problem(
      validFiniteNumber(entry.inputTruePeakDbtp),
      `Episode ${number} baseline true peak is missing or invalid.`,
      problems
    );
  }
  return byNumber;
}

function sourceMeasurementMap(sidecar, batchDirectory, problems) {
  if (
    exactKeys(
      sidecar,
      ["schemaVersion", "batchId", "status", "uploadAuthorized", "episodes", "completedAt"],
      "Source measurements sidecar",
      problems
    )
  ) {
    problem(sidecar.schemaVersion === 1, "Source measurements schemaVersion must be 1.", problems);
    problem(sidecar.batchId === DELIVERY_BATCH_ID, "Source measurements batch ID does not match.", problems);
    problem(sidecar.status === SOURCE_MEASUREMENT_STATUS, "Source measurements status is invalid.", problems);
    problem(sidecar.uploadAuthorized === false, "Source measurements must not authorize upload.", problems);
    problem(validTimestamp(sidecar.completedAt), "Source measurements completedAt is invalid.", problems);
  }
  const entries = Array.isArray(sidecar?.episodes) ? sidecar.episodes : [];
  const byNumber = new Map();
  for (const entry of entries) {
    const label = `Source measurement ${entry?.episodeNumber ?? "unknown"}`;
    if (
      exactKeys(
        entry,
        [
          "episodeNumber",
          "sourceSha256",
          "evidencePath",
          "evidenceSha256",
          "integratedLufs",
          "truePeakDbtp",
          "decodePassedProvenance",
        ],
        label,
        problems
      )
    ) {
      const number = entry.episodeNumber;
      problem(Number.isSafeInteger(number) && number > 0, `${label} episodeNumber is invalid.`, problems);
      problem(
        entry.sourceSha256 === APPROVED_SOURCE_SHA256.get(number),
        `${label} source SHA-256 does not match the approved render.`,
        problems
      );
      const expectedEvidencePath = path.resolve(
        batchDirectory,
        "..",
        SOURCE_EVIDENCE_BATCH_ID,
        "preflight-originals",
        `ep${number}.loudnorm.json`
      );
      problem(entry.evidencePath === expectedEvidencePath, `${label} evidence path is not canonical.`, problems);
      problem(SHA256_PATTERN.test(entry.evidenceSha256), `${label} evidence SHA-256 is invalid.`, problems);
      problem(validFiniteNumber(entry.integratedLufs), `${label} integrated loudness is invalid.`, problems);
      problem(validFiniteNumber(entry.truePeakDbtp), `${label} true peak is invalid.`, problems);
      if (
        exactKeys(
          entry.decodePassedProvenance,
          ["status", "evidencePath", "evidenceSha256"],
          `${label}.decodePassedProvenance`,
          problems
        )
      ) {
        const expectedDecodePath = path.resolve(
          batchDirectory,
          "..",
          SOURCE_EVIDENCE_BATCH_ID,
          "preflight-originals",
          `ep${number}.result.txt`
        );
        problem(entry.decodePassedProvenance.status === "passed", `${label} decode provenance did not pass.`, problems);
        problem(
          entry.decodePassedProvenance.evidencePath === expectedDecodePath,
          `${label} decode evidence path is not canonical.`,
          problems
        );
        problem(
          SHA256_PATTERN.test(entry.decodePassedProvenance.evidenceSha256),
          `${label} decode evidence SHA-256 is invalid.`,
          problems
        );
      }
      if (validFiniteNumber(entry.integratedLufs)) {
        problem(
          entry.integratedLufs < EXPECTED_ACCEPTANCE.integratedLufsMinimum,
          `${label} is not below the delivery acceptance range as expected.`,
          problems
        );
      }
      if (byNumber.has(number)) problems.push(`Source measurements contain duplicate episode ${number}.`);
      else byNumber.set(number, entry);
    }
  }
  problem(entries.length === 7, "Source measurements must contain exactly seven episodes.", problems);
  problem(
    isDeepStrictEqual([...byNumber.keys()].sort((left, right) => left - right), EXPECTED_NUMBERS),
    "Source measurements must be the exact episode sequence 1 through 7.",
    problems
  );
  return byNumber;
}

function validateResult(result, sourceMeasurement, catalogByNumber, dropboxRoot, acceptance, problems) {
  const label = `Episode ${result?.episodeNumber ?? "unknown"} result`;
  if (
    !exactKeys(
      result,
      [
        "status",
        "episodeNumber",
        "slug",
        "title",
        "sourceMode",
        "source",
        "masterVideo",
        "podcastAudio",
        "verification",
        "completedAt",
      ],
      label,
      problems
    )
  ) {
    return;
  }
  const number = result.episodeNumber;
  const episode = catalogByNumber.get(number);
  problem(Number.isSafeInteger(number) && number > 0, `${label} episodeNumber must be a positive integer.`, problems);
  problem(Boolean(episode), `${label} does not identify a catalog episode.`, problems);
  if (!episode) return;
  problem(result.status === LOCAL_DELIVERY_STATUS, `${label} status is not validated local delivery.`, problems);
  const deliverySlug = `${String(number).padStart(3, "0")}-${episode.slug}`;
  problem(result.slug === deliverySlug, `${label} delivery slug does not match the catalog episode.`, problems);
  problem(result.title === episode.title, `${label} title does not match the catalog.`, problems);
  problem(
    ["reencoded", "validated_v1_candidate"].includes(result.sourceMode),
    `${label} sourceMode is invalid.`,
    problems
  );
  problem(validTimestamp(result.completedAt), `${label} completedAt is not RFC 3339 with a timezone.`, problems);

  if (
    exactKeys(
      result.source,
      ["path", "sha256"],
      `${label}.source`,
      problems
    )
  ) {
    problem(
      typeof result.source.path === "string" && path.isAbsolute(result.source.path),
      `${label} source path must be absolute.`,
      problems
    );
    problem(
      result.source.sha256 === APPROVED_SOURCE_SHA256.get(number),
      `${label} source SHA-256 does not match the approved render.`,
      problems
    );
    problem(sourceMeasurement?.sourceSha256 === result.source.sha256, `${label} source measurement does not bind to result source SHA-256.`, problems);
  }

  const expectedDirectory = path.join(
    dropboxRoot,
    "episodes",
    deliverySlug
  );
  for (const [key, filename] of [
    ["masterVideo", "master-video.mp4"],
    ["podcastAudio", "podcast-audio.mp3"],
  ]) {
    const asset = result[key];
    const assetLabel = `${label}.${key}`;
    if (
      !exactKeys(
        asset,
        ["path", "sha256", "sizeBytes", "durationSeconds", "integratedLufs", "truePeakDbtp"],
        assetLabel,
        problems
      )
    ) {
      continue;
    }
    problem(asset.path === path.join(expectedDirectory, filename), `${assetLabel} path is not canonical.`, problems);
    problem(SHA256_PATTERN.test(asset.sha256), `${assetLabel} SHA-256 is invalid.`, problems);
    problem(Number.isSafeInteger(asset.sizeBytes) && asset.sizeBytes > 0, `${assetLabel} sizeBytes is invalid.`, problems);
    problem(validFiniteNumber(asset.durationSeconds) && asset.durationSeconds > 0, `${assetLabel} duration is invalid.`, problems);
    problem(validFiniteNumber(asset.integratedLufs), `${assetLabel} integrated loudness is invalid.`, problems);
    problem(validFiniteNumber(asset.truePeakDbtp), `${assetLabel} true peak is invalid.`, problems);
    if (validFiniteNumber(asset.integratedLufs)) {
      problem(
        asset.integratedLufs >= acceptance.integratedLufsMinimum &&
          asset.integratedLufs <= acceptance.integratedLufsMaximum,
        `${assetLabel} integrated loudness is outside the approved range.`,
        problems
      );
    }
    if (validFiniteNumber(asset.truePeakDbtp)) {
      problem(
        asset.truePeakDbtp <= acceptance.truePeakDbtpMaximum,
        `${assetLabel} true peak exceeds the approved maximum.`,
        problems
      );
    }
  }

  if (isPlainObject(result.masterVideo) && isPlainObject(result.podcastAudio)) {
    const videoDuration = result.masterVideo.durationSeconds;
    const audioDuration = result.podcastAudio.durationSeconds;
    if (validFiniteNumber(videoDuration) && validFiniteNumber(audioDuration)) {
      problem(
        Math.abs(videoDuration - audioDuration) <= 0.25,
        `${label} video/audio duration delta exceeds 0.25 seconds.`,
        problems
      );
    }
  }

  if (
    exactKeys(
      result.verification,
      ["fullDecode", "sourceUnchanged", "videoPacketContentPreserved", "videoEssenceSha256"],
      `${label}.verification`,
      problems
    )
  ) {
    for (const key of ["fullDecode", "sourceUnchanged", "videoPacketContentPreserved"]) {
      problem(result.verification[key] === true, `${label} verification.${key} must be true.`, problems);
    }
    problem(
      SHA256_PATTERN.test(result.verification.videoEssenceSha256),
      `${label} video essence SHA-256 is invalid.`,
      problems
    );
  }
}

export function validateDeliveryBatchData({
  manifest,
  batchStatus,
  sourceMeasurements,
  batchDirectory,
  results,
  resultStatuses,
  catalog,
  audit,
  dropboxRoot,
}) {
  const problems = [];
  const catalogValidation = validateCatalog(catalog);
  problems.push(...catalogValidation.errors.map((entry) => `Catalog: ${entry}`));
  problem(catalog.revision === BASE_CATALOG_REVISION, `Catalog revision must be ${BASE_CATALOG_REVISION}.`, problems);
  problem(
    catalog.show?.canonicalPodcastFeed?.provider === "rss_com",
    "Catalog canonical podcast provider must be rss_com.",
    problems
  );
  problem(
    typeof dropboxRoot === "string" && path.isAbsolute(dropboxRoot),
    "Dropbox root must be an absolute path.",
    problems
  );
  const catalogByNumber = catalogEpisodeMap(catalog, problems);
  legacyAuditEpisodeMap(audit, catalogByNumber, problems);
  const measurementsByNumber = sourceMeasurementMap(sourceMeasurements, batchDirectory, problems);
  problem(audit.canonicalFeedUrl === catalog.show?.canonicalPodcastFeed?.url, "Audio audit feed URL does not match the catalog.", problems);

  if (
    exactKeys(
      manifest,
      [
        "schemaVersion",
        "batchId",
        "status",
        "uploadAuthorized",
        "target",
        "acceptance",
        "concurrency",
        "availableBytesBefore",
        "availableBytesAfter",
        "episodes",
        "completedAt",
      ],
      "Batch manifest",
      problems
    )
  ) {
    problem(manifest.schemaVersion === 1, "Batch manifest schemaVersion must be 1.", problems);
    problem(manifest.batchId === DELIVERY_BATCH_ID, `Batch manifest ID must be ${DELIVERY_BATCH_ID}.`, problems);
    problem(manifest.status === LOCAL_DELIVERY_STATUS, "Batch manifest is not a validated local delivery.", problems);
    problem(manifest.uploadAuthorized === false, "Batch manifest must not authorize upload.", problems);
    problem(isDeepStrictEqual(manifest.target, EXPECTED_TARGET), "Batch loudness target does not match the approved policy.", problems);
    problem(
      isDeepStrictEqual(manifest.acceptance, EXPECTED_ACCEPTANCE),
      "Batch acceptance limits do not match the approved policy.",
      problems
    );
    problem(manifest.concurrency === 2, "Batch concurrency evidence must be 2.", problems);
    problem(
      Number.isSafeInteger(manifest.availableBytesBefore) && manifest.availableBytesBefore >= 0,
      "Batch availableBytesBefore is invalid.",
      problems
    );
    problem(
      Number.isSafeInteger(manifest.availableBytesAfter) && manifest.availableBytesAfter >= 0,
      "Batch availableBytesAfter is invalid.",
      problems
    );
    problem(validTimestamp(manifest.completedAt), "Batch manifest completedAt is invalid.", problems);
  }

  if (
    exactKeys(
      batchStatus,
      ["status", "uploadAuthorized", "completedAt"],
      "Batch status",
      problems
    )
  ) {
    problem(batchStatus.status === LOCAL_DELIVERY_STATUS, "Batch status is not validated local delivery.", problems);
    problem(batchStatus.uploadAuthorized === false, "Batch status must not authorize upload.", problems);
    problem(validTimestamp(batchStatus.completedAt), "Batch status completedAt is invalid.", problems);
  }

  const manifestEpisodes = Array.isArray(manifest?.episodes) ? manifest.episodes : [];
  const resultEntries = Array.isArray(results) ? results : [];
  const perEpisodeStatuses = Array.isArray(resultStatuses) ? resultStatuses : [];
  problem(manifestEpisodes.length === 7, "Batch manifest must contain exactly seven episode results.", problems);
  problem(resultEntries.length === 7, "Batch directory must contain exactly seven result.json files.", problems);
  problem(perEpisodeStatuses.length === 7, "Batch directory must contain exactly seven episode status.json files.", problems);

  const resultByNumber = new Map();
  for (const result of resultEntries) {
    if (resultByNumber.has(result?.episodeNumber)) problems.push(`Duplicate result for episode ${result?.episodeNumber}.`);
    else resultByNumber.set(result?.episodeNumber, result);
  }
  problem(
    isDeepStrictEqual([...resultByNumber.keys()].sort((left, right) => left - right), EXPECTED_NUMBERS),
    "Batch results must be the exact episode sequence 1 through 7.",
    problems
  );

  for (const number of EXPECTED_NUMBERS) {
    const result = resultByNumber.get(number);
    const manifestResult = manifestEpisodes.find((entry) => entry?.episodeNumber === number);
    if (!result || !manifestResult) {
      problems.push(`Episode ${number} is missing from the manifest or result records.`);
      continue;
    }
    problem(
      isDeepStrictEqual(canonicalJson(result), canonicalJson(manifestResult)),
      `Episode ${number} manifest entry does not exactly match result.json.`,
      problems
    );
    const episodeStatus = perEpisodeStatuses.find((entry) => entry.episodeNumber === number)?.value;
    if (!episodeStatus) {
      problems.push(`Episode ${number} status.json is missing.`);
    } else if (
      exactKeys(episodeStatus, ["status", "completedAt"], `Episode ${number} status`, problems)
    ) {
      problem(episodeStatus.status === LOCAL_DELIVERY_STATUS, `Episode ${number} status is not validated.`, problems);
      problem(validTimestamp(episodeStatus.completedAt), `Episode ${number} status timestamp is invalid.`, problems);
    }
    validateResult(
      result,
      measurementsByNumber.get(number),
      catalogByNumber,
      dropboxRoot,
      EXPECTED_ACCEPTANCE,
      problems
    );
  }

  if (problems.length > 0) throw new DeliveryBatchIntegrationError(problems);
  return { catalogByNumber, resultByNumber, measurementsByNumber };
}

function requireUnmountedAsset(asset, assetId, expected) {
  const problems = [];
  problem(Boolean(asset), `Catalog asset ${assetId} is missing.`, problems);
  if (!asset) throw new DeliveryBatchIntegrationError(problems);
  problem(asset.kind === expected.kind, `Catalog asset ${assetId} kind drifted.`, problems);
  problem(asset.role === expected.role, `Catalog asset ${assetId} role drifted.`, problems);
  problem(asset.uri === expected.uri, `Catalog asset ${assetId} URI drifted.`, problems);
  problem(asset.status === "unmounted", `Catalog asset ${assetId} must still be unmounted.`, problems);
  problem(asset.sha256 === null, `Catalog asset ${assetId} already has a SHA-256.`, problems);
  problem(asset.sizeBytes === null, `Catalog asset ${assetId} already has a byte size.`, problems);
  problem(asset.mediaType === expected.mediaType, `Catalog asset ${assetId} media type drifted.`, problems);
  if (problems.length > 0) throw new DeliveryBatchIntegrationError(problems);
}

function remoteReplacementTargets(episode, podcastAsset) {
  const spotifyNeedsDerivedVideo = episode.number === 5;
  return [
    {
      platform: "rssCom",
      assetRole: "podcastAudio",
      action: "replace_audio_in_existing_episode",
      status: "pending",
      existingId: episode.rssGuid,
      existingUrl: podcastAsset.publishedUrl,
    },
    {
      platform: "spotify",
      assetRole: "fullVideo",
      action: spotifyNeedsDerivedVideo
        ? "generate_validated_sub_25_mbps_derivative_then_attach_to_existing_rss_episode"
        : "attach_video_to_existing_rss_episode",
      status: spotifyNeedsDerivedVideo ? "blocked_platform_derivative_required" : "pending",
      existingId: episode.destinations.spotify.id,
      existingUrl: episode.destinations.spotify.url,
    },
    {
      platform: "vimeo",
      assetRole: "fullVideo",
      action: "replace_existing_video_version_if_supported",
      status: "pending_capability_confirmation",
      existingId: episode.destinations.vimeo.id,
      existingUrl: episode.destinations.vimeo.url,
    },
    {
      platform: "youtube",
      assetRole: "fullVideo",
      action: "new_private_upload_requires_new_id_decision",
      status: "decision_required",
      existingId: episode.destinations.youtube.id,
      existingUrl: episode.destinations.youtube.url,
    },
    {
      platform: "rumble",
      assetRole: "fullVideo",
      action: "inspect_replace_support_or_stage_unlisted",
      status: "inspection_required",
      existingId: episode.destinations.rumble.id,
      existingUrl: episode.destinations.rumble.url,
    },
    {
      platform: "apple",
      assetRole: "podcastAudio",
      action: "rss_fanout_after_rss_com_replacement",
      status: "pending_rss_fanout",
      existingId: null,
      existingUrl: null,
    },
    {
      platform: "amazon",
      assetRole: "podcastAudio",
      action: "rss_fanout_after_show_claim",
      status: "blocked_show_unclaimed",
      existingId: null,
      existingUrl: null,
    },
    {
      platform: "instagram",
      assetRole: "instagramReel",
      action: "separate_repost_decision_required",
      status: "not_in_scope",
      existingId: null,
      existingUrl: null,
    },
  ];
}

export function buildDeliveryIntegration({
  catalog,
  audit,
  manifest,
  manifestSha256,
  sourceMeasurements,
  sourceMeasurementsSha256,
  now,
}) {
  if (!validTimestamp(now)) throw new DeliveryBatchIntegrationError("Integration timestamp must be RFC 3339 with a timezone.");
  if (!SHA256_PATTERN.test(manifestSha256)) throw new DeliveryBatchIntegrationError("Manifest SHA-256 is invalid.");
  if (!SHA256_PATTERN.test(sourceMeasurementsSha256)) {
    throw new DeliveryBatchIntegrationError("Source measurements SHA-256 is invalid.");
  }

  const nextCatalog = structuredClone(catalog);
  const catalogByNumber = new Map(nextCatalog.episodes.map((episode) => [episode.number, episode]));
  const auditByNumber = new Map(audit.episodes.map((episode) => [episode.number, episode]));
  const resultByNumber = new Map(manifest.episodes.map((result) => [result.episodeNumber, result]));
  const measurementsByNumber = new Map(
    sourceMeasurements.episodes.map((entry) => [entry.episodeNumber, entry])
  );
  const nextAuditEpisodes = [];

  for (const number of EXPECTED_NUMBERS) {
    const episode = catalogByNumber.get(number);
    const baseline = auditByNumber.get(number);
    const result = resultByNumber.get(number);
    const sourceMeasurement = measurementsByNumber.get(number);
    const directory = `dropbox:episodes/${String(number).padStart(3, "0")}-${episode.slug}`;
    const videoId = episode.assetRefs.fullVideo;
    const audioId = episode.assetRefs.podcastAudio;
    const videoAsset = nextCatalog.assetRegistry[videoId];
    const audioAsset = nextCatalog.assetRegistry[audioId];

    requireUnmountedAsset(videoAsset, videoId, {
      kind: "video",
      role: "fullVideo",
      uri: `${directory}/master-video.mp4`,
      mediaType: "video/mp4",
    });
    requireUnmountedAsset(audioAsset, audioId, {
      kind: "audio",
      role: "podcastAudio",
      uri: `${directory}/podcast-audio.wav`,
      mediaType: "audio/wav",
    });
    if (typeof audioAsset.publishedUrl !== "string" || !audioAsset.publishedUrl.startsWith("https://")) {
      throw new DeliveryBatchIntegrationError(`Catalog asset ${audioId} lacks its current published enclosure URL.`);
    }

    Object.assign(videoAsset, {
      sha256: result.masterVideo.sha256,
      sizeBytes: result.masterVideo.sizeBytes,
      status: "verified",
    });
    Object.assign(audioAsset, {
      uri: `${directory}/podcast-audio.mp3`,
      sha256: result.podcastAudio.sha256,
      sizeBytes: result.podcastAudio.sizeBytes,
      mediaType: "audio/mpeg",
      status: "verified",
    });

    nextAuditEpisodes.push({
      number,
      title: episode.title,
      rssGuid: episode.rssGuid,
      publishedAudioBaseline: {
        measuredAt: audit.auditedAt,
        integratedLufs: baseline.inputIntegratedLufs,
        truePeakDbtp: baseline.inputTruePeakDbtp,
        status: "published_pending_replacement",
      },
      correctedSourceRender: {
        sha256: result.source.sha256,
        integratedLufs: sourceMeasurement.integratedLufs,
        truePeakDbtp: sourceMeasurement.truePeakDbtp,
        measurementEvidenceSha256: sourceMeasurement.evidenceSha256,
        decodeEvidenceSha256: sourceMeasurement.decodePassedProvenance.evidenceSha256,
        assessment: "under_delivery_target",
      },
      validatedDelivery: {
        status: LOCAL_DELIVERY_STATUS,
        sourceMode: result.sourceMode,
        completedAt: result.completedAt,
        masterVideo: {
          assetId: videoId,
          sha256: result.masterVideo.sha256,
          sizeBytes: result.masterVideo.sizeBytes,
          durationSeconds: result.masterVideo.durationSeconds,
          integratedLufs: result.masterVideo.integratedLufs,
          truePeakDbtp: result.masterVideo.truePeakDbtp,
        },
        podcastAudio: {
          assetId: audioId,
          sha256: result.podcastAudio.sha256,
          sizeBytes: result.podcastAudio.sizeBytes,
          durationSeconds: result.podcastAudio.durationSeconds,
          integratedLufs: result.podcastAudio.integratedLufs,
          truePeakDbtp: result.podcastAudio.truePeakDbtp,
        },
        platformDerivedVideos: [],
        verification: structuredClone(result.verification),
      },
      remoteReplacementTargets: remoteReplacementTargets(episode, audioAsset),
    });
  }

  nextCatalog.revision += 1;
  nextCatalog.updatedAt = now;
  const catalogValidation = validateCatalog(nextCatalog);
  if (!catalogValidation.valid) {
    throw new DeliveryBatchIntegrationError(
      catalogValidation.errors.map((entry) => `Generated catalog: ${entry}`)
    );
  }

  const nextAudit = {
    $schema: "./audio-replacement-audit.schema.json",
    schemaVersion: 2,
    auditId: audit.auditId,
    auditedAt: audit.auditedAt,
    updatedAt: now,
    status: INTEGRATED_AUDIT_STATUS,
    canonicalFeedUrl: audit.canonicalFeedUrl,
    measurement: structuredClone(audit.measurement),
    protectedIdentityFields: structuredClone(audit.protectedIdentityFields),
    localDelivery: {
      batchId: manifest.batchId,
      manifestSha256,
      sourceMeasurementsSha256,
      status: LOCAL_DELIVERY_STATUS,
      validatedAt: manifest.completedAt,
      integratedAt: now,
      catalogRevision: nextCatalog.revision,
      uploadAuthorized: false,
      uploadsPerformed: false,
    },
    episodes: nextAuditEpisodes,
    replacementPolicy: structuredClone(audit.replacementPolicy),
    platformNotes: structuredClone(audit.platformNotes),
  };

  const auditValidation = validateIntegratedAudioAudit(nextAudit);
  if (!auditValidation.valid) {
    throw new DeliveryBatchIntegrationError(
      auditValidation.errors.map((error) => `Generated audio audit ${error}`)
    );
  }
  return { catalog: nextCatalog, audit: nextAudit };
}

async function stableHashMatches(filePath, expectedSize, expectedHash, label) {
  const before = await fs.lstat(filePath);
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new DeliveryBatchIntegrationError(`${label} must be a regular, non-symlink file.`);
  }
  if (before.size !== expectedSize) {
    throw new DeliveryBatchIntegrationError(`${label} byte size does not match result.json.`);
  }
  const actualHash = await hashFile(filePath);
  const after = await fs.lstat(filePath);
  if (
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.size !== after.size ||
    before.mtimeMs !== after.mtimeMs
  ) {
    throw new DeliveryBatchIntegrationError(`${label} changed while it was being hashed.`);
  }
  if (actualHash !== expectedHash) {
    throw new DeliveryBatchIntegrationError(`${label} SHA-256 does not match result.json.`);
  }
}

export async function verifyDeliveryFiles({ catalog, manifest, configPath }) {
  for (const result of manifest.episodes) {
    const episode = catalog.episodes.find((entry) => entry.number === result.episodeNumber);
    for (const [role, resultKey] of [
      ["fullVideo", "masterVideo"],
      ["podcastAudio", "podcastAudio"],
    ]) {
      const assetId = episode.assetRefs[role];
      const expectedPath = await resolveCatalogAsset(catalog, assetId, { configPath });
      const suppliedPath = await fs.realpath(result[resultKey].path);
      if (suppliedPath !== expectedPath) {
        throw new DeliveryBatchIntegrationError(
          `Episode ${result.episodeNumber} ${role} result path does not resolve to catalog asset ${assetId}.`
        );
      }
      await stableHashMatches(
        suppliedPath,
        result[resultKey].sizeBytes,
        result[resultKey].sha256,
        `Episode ${result.episodeNumber} ${role}`
      );
    }
  }
}

function parsePreflightResult(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    for (const field of line.split("|")) {
      const separator = field.indexOf("=");
      if (separator > 0) values.set(field.slice(0, separator), field.slice(separator + 1));
    }
  }
  return values;
}

export async function verifySourceMeasurementEvidence(sourceMeasurements) {
  for (const entry of sourceMeasurements.episodes) {
    const label = `Episode ${entry.episodeNumber} source measurement`;
    const loudnessRecord = await readStableJson(entry.evidencePath, `${label} loudness evidence`);
    if (loudnessRecord.sha256 !== entry.evidenceSha256) {
      throw new DeliveryBatchIntegrationError(`${label} loudness evidence SHA-256 does not match the sidecar.`);
    }
    const evidenceIntegrated = Number(loudnessRecord.value?.input_i);
    const evidenceTruePeak = Number(loudnessRecord.value?.input_tp);
    if (
      !Number.isFinite(evidenceIntegrated) ||
      !Number.isFinite(evidenceTruePeak) ||
      evidenceIntegrated !== entry.integratedLufs ||
      evidenceTruePeak !== entry.truePeakDbtp
    ) {
      throw new DeliveryBatchIntegrationError(`${label} values do not match the loudnorm evidence.`);
    }

    const decodeRecord = await readStableText(
      entry.decodePassedProvenance.evidencePath,
      `${label} decode evidence`
    );
    if (decodeRecord.sha256 !== entry.decodePassedProvenance.evidenceSha256) {
      throw new DeliveryBatchIntegrationError(`${label} decode evidence SHA-256 does not match the sidecar.`);
    }
    const decodeValues = parsePreflightResult(decodeRecord.text);
    const required = new Map([
      ["episode", String(entry.episodeNumber)],
      ["sha256", entry.sourceSha256],
      ["sha_rc", "0"],
      ["probe_rc", "0"],
      ["decode_rc", "0"],
      ["loudnorm_rc", "0"],
      ["stable", "yes"],
      ["decode_error_bytes", "0"],
      ["probe_error_bytes", "0"],
      ["input_i", String(entry.integratedLufs)],
      ["input_tp", String(entry.truePeakDbtp)],
    ]);
    for (const [key, expected] of required) {
      if (decodeValues.get(key) !== expected) {
        throw new DeliveryBatchIntegrationError(`${label} decode evidence ${key} is not ${expected}.`);
      }
    }
  }
}

export async function loadDeliveryBatch(batchDirectory) {
  const resolvedBatch = path.resolve(batchDirectory);
  if (path.basename(resolvedBatch) !== DELIVERY_BATCH_ID) {
    throw new DeliveryBatchIntegrationError(`Batch directory name must be ${DELIVERY_BATCH_ID}.`);
  }
  const batchStats = await fs.lstat(resolvedBatch);
  if (!batchStats.isDirectory() || batchStats.isSymbolicLink()) {
    throw new DeliveryBatchIntegrationError("Batch path must be a regular, non-symlink directory.");
  }
  const manifestRecord = await readStableJson(path.join(resolvedBatch, "manifest.json"), "Batch manifest");
  const batchStatusRecord = await readStableJson(path.join(resolvedBatch, "status.json"), "Batch status");
  const sourceMeasurementsRecord = await readStableJson(
    path.join(resolvedBatch, "source-measurements.json"),
    "Source measurements sidecar"
  );
  const resultRoot = path.join(resolvedBatch, "results");
  const resultPaths = await findFilesNamed(resultRoot, "result.json");
  const expectedResultPaths = EXPECTED_NUMBERS.map((number) =>
    path.resolve(resultRoot, `ep${number}`, "result.json")
  ).sort();
  if (!isDeepStrictEqual(resultPaths, expectedResultPaths)) {
    throw new DeliveryBatchIntegrationError("Batch result.json paths are not exactly results/ep1 through results/ep7.");
  }

  const results = [];
  const resultStatuses = [];
  for (const number of EXPECTED_NUMBERS) {
    const resultRecord = await readStableJson(path.join(resultRoot, `ep${number}`, "result.json"), `Episode ${number} result`);
    const statusRecord = await readStableJson(path.join(resultRoot, `ep${number}`, "status.json"), `Episode ${number} status`);
    results.push(resultRecord.value);
    resultStatuses.push({ episodeNumber: number, value: statusRecord.value });
  }

  const manifestAfter = await fs.readFile(path.join(resolvedBatch, "manifest.json"), "utf8");
  const statusAfter = await fs.readFile(path.join(resolvedBatch, "status.json"), "utf8");
  const sourceMeasurementsAfter = await fs.readFile(
    path.join(resolvedBatch, "source-measurements.json"),
    "utf8"
  );
  if (
    manifestAfter !== manifestRecord.text ||
    statusAfter !== batchStatusRecord.text ||
    sourceMeasurementsAfter !== sourceMeasurementsRecord.text
  ) {
    throw new DeliveryBatchIntegrationError("Batch completion records changed during ingestion.");
  }
  return {
    directory: resolvedBatch,
    manifest: manifestRecord.value,
    manifestSha256: manifestRecord.sha256,
    batchStatus: batchStatusRecord.value,
    sourceMeasurements: sourceMeasurementsRecord.value,
    sourceMeasurementsSha256: sourceMeasurementsRecord.sha256,
    results,
    resultStatuses,
  };
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

async function applyIntegration({ catalogPath, auditPath, catalogRecord, auditRecord, nextCatalog, nextAudit }) {
  const lockPath = path.join(path.dirname(catalogPath), ".delivery-batch-integration.lock");
  let lock;
  try {
    lock = await fs.open(lockPath, "wx", 0o600);
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new DeliveryBatchIntegrationError(`Integration lock already exists: ${lockPath}`);
    }
    throw error;
  }

  try {
    const currentCatalog = await fs.readFile(catalogPath, "utf8");
    const currentAudit = await fs.readFile(auditPath, "utf8");
    if (currentCatalog !== catalogRecord.text || currentAudit !== auditRecord.text) {
      throw new DeliveryBatchIntegrationError("Catalog or audio audit changed after preflight; refusing to apply.");
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
    if (!catalogValidation.valid || !validateIntegratedAudioAudit(writtenAudit).valid) {
      await writeAtomic(catalogPath, catalogRecord.text);
      await writeAtomic(auditPath, auditRecord.text);
      throw new DeliveryBatchIntegrationError("Post-write validation failed; original files were restored.");
    }
  } finally {
    await lock?.close();
    await fs.rm(lockPath, { force: true });
  }
}

export async function integrateDeliveryBatch({
  batchDirectory,
  catalogPath = DEFAULT_CATALOG_PATH,
  auditPath = DEFAULT_AUDIT_PATH,
  configPath = sourcesConfigPath(),
  apply = false,
  now = new Date().toISOString(),
  verifyFiles = true,
}) {
  const catalogRecord = await readStableJson(path.resolve(catalogPath), "Master catalog");
  const auditRecord = await readStableJson(path.resolve(auditPath), "Audio replacement audit");
  const batch = await loadDeliveryBatch(batchDirectory);
  const sourceConfig = JSON.parse(await fs.readFile(configPath, "utf8"));
  const dropboxRoot = sourceConfig?.roots?.dropbox;

  validateDeliveryBatchData({
    manifest: batch.manifest,
    batchStatus: batch.batchStatus,
    sourceMeasurements: batch.sourceMeasurements,
    batchDirectory: batch.directory,
    results: batch.results,
    resultStatuses: batch.resultStatuses,
    catalog: catalogRecord.value,
    audit: auditRecord.value,
    dropboxRoot,
  });
  await verifySourceMeasurementEvidence(batch.sourceMeasurements);
  const next = buildDeliveryIntegration({
    catalog: catalogRecord.value,
    audit: auditRecord.value,
    manifest: batch.manifest,
    manifestSha256: batch.manifestSha256,
    sourceMeasurements: batch.sourceMeasurements,
    sourceMeasurementsSha256: batch.sourceMeasurementsSha256,
    now,
  });
  if (verifyFiles) await verifyDeliveryFiles({ catalog: next.catalog, manifest: batch.manifest, configPath });
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
    batchId: batch.manifest.batchId,
    manifestSha256: batch.manifestSha256,
    catalogRevisionBefore: catalogRecord.value.revision,
    catalogRevisionAfter: next.catalog.revision,
    episodeCount: next.audit.episodes.length,
    remoteUploadsClaimed: false,
  };
}

function usage() {
  return [
    "Usage:",
    "  node scripts/publish/integrate-delivery-batch.mjs --batch <directory> [--apply]",
    "",
    "Without --apply, all batch, catalog, audit, and binary checks run without writing.",
  ].join("\n");
}

function parseArguments(argv) {
  const options = { apply: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") options.apply = true;
    else if (argument === "--batch") options.batchDirectory = argv[++index];
    else if (argument === "--catalog") options.catalogPath = argv[++index];
    else if (argument === "--audit") options.auditPath = argv[++index];
    else if (argument === "--sources-config") options.configPath = argv[++index];
    else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new DeliveryBatchIntegrationError(`Unknown argument: ${argument}`);
  }
  if (!options.help && !options.batchDirectory) {
    throw new DeliveryBatchIntegrationError("--batch is required.");
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
    throw new DeliveryBatchIntegrationError("--apply must run as the otto desktop user.");
  }
  const result = await integrateDeliveryBatch(options);
  process.stdout.write(
    `${result.applied ? "Applied" : "Validated"} ${result.batchId}: ${result.episodeCount} episodes, catalog ${result.catalogRevisionBefore} -> ${result.catalogRevisionAfter}; remote uploads claimed: no.\n`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
