import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

import {
  comparePublishedCatalogFeed,
  DEFAULT_CATALOG_PATH,
  validateCatalog,
} from "./catalog.mjs";
import {
  comparePodcastFeeds,
  decodeAudioFile,
  parsePodcastFeed,
} from "./feed-preflight.mjs";
import {
  DEFAULT_AUDIT_PATH,
  validateIntegratedAudioAudit,
} from "./integrate-delivery-batch.mjs";
import { hashFile, measureLoudness, probeFile } from "./lib.mjs";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleDirectory, "../..");

export const BASE_CATALOG_REVISION = 8;
export const NEXT_CATALOG_REVISION = 9;
export const EXPECTED_EPISODE_COUNT = 7;
export const CANONICAL_FEED_URL =
  "https://media.rss.com/dr-m-experienced/feed.xml";
export const MIGRATION_FILENAME =
  "20260807061500_publish_normalized_rss_audio.sql";
export const DEFAULT_ENRICHMENT_PATH = path.join(
  projectRoot,
  "src/data/episodes-enrichment.json"
);
export const DEFAULT_SEED_PATH = path.join(projectRoot, "supabase/seed.sql");
export const DEFAULT_MIGRATION_PATH = path.join(
  projectRoot,
  "supabase/migrations",
  MIGRATION_FILENAME
);

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const RFC3339_WITH_TIMEZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const REMOTE_STATUS =
  "rss_com_remote_replacement_verified_downstream_refresh_unverified";
const EXPECTED_RECEIPT_KEYS = [
  "acceptance",
  "auditType",
  "baseline",
  "canonicalFeedUrl",
  "comparePodcastFeeds",
  "completedAt",
  "currentFeed",
  "episodes",
  "fetch",
  "invariants",
  "nonEnclosureDifferences",
  "schemaVersion",
  "startedAt",
  "status",
  "totals",
];

export class RemoteAudioReceiptIntegrationError extends Error {
  constructor(problems) {
    const list = Array.isArray(problems) ? problems : [String(problems)];
    super(
      `Remote audio receipt integration is blocked:\n${list
        .map((entry) => `- ${entry}`)
        .join("\n")}`
    );
    this.name = "RemoteAudioReceiptIntegrationError";
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

function validSha256(value) {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function positiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function closeEnough(left, right, tolerance = 0.01) {
  return (
    typeof left === "number" &&
    Number.isFinite(left) &&
    typeof right === "number" &&
    Number.isFinite(right) &&
    Math.abs(left - right) <= tolerance
  );
}

function validHttpsUrl(value, hostname) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (!hostname || url.hostname === hostname);
  } catch {
    return false;
  }
}

function sha256Text(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function readStableText(filePath, label) {
  let before;
  try {
    before = await fs.lstat(filePath);
  } catch (error) {
    throw new RemoteAudioReceiptIntegrationError(
      `${label} cannot be inspected (${error.message}): ${filePath}`
    );
  }
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new RemoteAudioReceiptIntegrationError(
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
    throw new RemoteAudioReceiptIntegrationError(
      `${label} changed while it was being read: ${filePath}`
    );
  }
  return { text, sha256: sha256Text(text), stats: before };
}

async function readStableJson(filePath, label) {
  const record = await readStableText(filePath, label);
  let value;
  try {
    value = JSON.parse(record.text);
  } catch (error) {
    throw new RemoteAudioReceiptIntegrationError(
      `${label} is not valid JSON (${error.message}): ${filePath}`
    );
  }
  return { ...record, value };
}

function validateFeedRecord(record, label, problems) {
  if (!exactKeys(record, ["path", "sha256", "bytes"], label, problems)) return;
  problem(
    typeof record.path === "string" && path.isAbsolute(record.path),
    `${label} path must be absolute.`,
    problems
  );
  problem(validSha256(record.sha256), `${label} SHA-256 is invalid.`, problems);
  problem(positiveInteger(record.bytes), `${label} byte count is invalid.`, problems);
}

function validateComparisonReceipt(receipt, problems) {
  const comparison = receipt.comparePodcastFeeds;
  if (
    exactKeys(
      comparison,
      ["ok", "issueCodes", "metadataMismatches", "note"],
      "Receipt feed comparison",
      problems
    )
  ) {
    problem(comparison.ok === false, "Receipt feed comparison must record the known duration drift.", problems);
    problem(
      isDeepStrictEqual(comparison.issueCodes, ["episode_metadata"]),
      "Receipt feed comparison issueCodes must contain only episode_metadata.",
      problems
    );
    problem(
      typeof comparison.note === "string" && comparison.note.includes("duration"),
      "Receipt feed comparison note must explain the duration-only drift.",
      problems
    );
    problem(
      Array.isArray(comparison.metadataMismatches) &&
        comparison.metadataMismatches.length === 2,
      "Receipt feed comparison must contain exactly two duration mismatches.",
      problems
    );
    for (const [index, mismatch] of (comparison.metadataMismatches ?? []).entries()) {
      if (
        exactKeys(
          mismatch,
          ["fingerprint", "title", "fields"],
          `Receipt feed comparison mismatch ${index + 1}`,
          problems
        )
      ) {
        problem(
          typeof mismatch.fingerprint === "string" &&
            /^[a-f0-9]{12}$/.test(mismatch.fingerprint),
          `Receipt feed comparison mismatch ${index + 1} fingerprint is invalid.`,
          problems
        );
        problem(
          isDeepStrictEqual(mismatch.fields, ["duration"]),
          `Receipt feed comparison mismatch ${index + 1} must be duration-only.`,
          problems
        );
      }
    }
    const mismatchTitles = (comparison.metadataMismatches ?? [])
      .map((entry) => entry.title)
      .sort();
    problem(
      isDeepStrictEqual(mismatchTitles, [
        "Concussion - What Happens in the Brain",
        "Energy - Understanding Fatigue and Mitochondrial Health",
      ]),
      "Receipt feed comparison must identify only Episodes 5 and 6.",
      problems
    );
  }
}

function validateNonEnclosureDifferences(receipt, problems) {
  problem(
    Array.isArray(receipt.nonEnclosureDifferences) &&
      receipt.nonEnclosureDifferences.length === 5,
    "Receipt must enumerate exactly five benign non-enclosure differences.",
    problems
  );
  const differences = receipt.nonEnclosureDifferences ?? [];
  problem(
    differences.every((entry) => isPlainObject(entry) && entry.benign === true),
    "Every non-enclosure difference must be explicitly benign.",
    problems
  );
  const channel = differences.filter(
    (entry) => entry.scope === "channel" && entry.type === "lastBuildDate"
  );
  const serialization = differences
    .filter((entry) => entry.type === "html_entity_serialization")
    .map((entry) => entry.episodeNumber)
    .sort((left, right) => left - right);
  const duration = differences
    .filter((entry) => entry.type === "itunes_duration_rounding")
    .map((entry) => [entry.episodeNumber, entry.baselineSeconds, entry.currentSeconds])
    .sort(([left], [right]) => left - right);
  problem(channel.length === 1, "Receipt must contain one lastBuildDate difference.", problems);
  problem(
    isDeepStrictEqual(serialization, [1, 2]),
    "Receipt HTML entity differences must be limited to Episodes 1 and 2.",
    problems
  );
  problem(
    isDeepStrictEqual(duration, [
      [5, 1862, 1861],
      [6, 1203, 1200],
    ]),
    "Receipt duration rounding differences must be the audited Episode 5 and 6 values.",
    problems
  );
}

function validateEpisodeReceipt(entry, catalogEpisode, problems) {
  const label = `Receipt Episode ${entry?.episodeNumber ?? "unknown"}`;
  if (
    !exactKeys(
      entry,
      [
        "episodeNumber",
        "guid",
        "title",
        "enclosure",
        "localFile",
        "feedDurationSeconds",
        "probe",
        "fullDecode",
        "loudness",
        "passed",
      ],
      label,
      problems
    )
  ) {
    return;
  }
  problem(Boolean(catalogEpisode), `${label} is not present in the catalog.`, problems);
  if (catalogEpisode) {
    problem(entry.guid === catalogEpisode.rssGuid, `${label} GUID differs from the catalog.`, problems);
    problem(entry.title === catalogEpisode.title, `${label} title differs from the catalog.`, problems);
  }
  problem(entry.passed === true, `${label} must be marked passed.`, problems);

  if (
    exactKeys(
      entry.enclosure,
      ["baselineUrl", "currentUrl", "urlChanged", "effectiveUrl", "httpStatus", "contentType"],
      `${label} enclosure`,
      problems
    )
  ) {
    problem(
      validHttpsUrl(entry.enclosure.baselineUrl, "content.rss.com"),
      `${label} baseline enclosure must be an RSS.com content URL.`,
      problems
    );
    problem(
      validHttpsUrl(entry.enclosure.currentUrl, "content.rss.com"),
      `${label} current enclosure must be an RSS.com content URL.`,
      problems
    );
    problem(
      entry.enclosure.baselineUrl !== entry.enclosure.currentUrl &&
        entry.enclosure.urlChanged === true,
      `${label} must prove the enclosure URL changed.`,
      problems
    );
    problem(validHttpsUrl(entry.enclosure.effectiveUrl), `${label} effective enclosure URL is invalid.`, problems);
    problem(entry.enclosure.httpStatus === 200, `${label} enclosure HTTP status must be 200.`, problems);
    problem(entry.enclosure.contentType === "audio/mpeg", `${label} enclosure content type must be audio/mpeg.`, problems);
  }

  if (
    exactKeys(
      entry.localFile,
      ["path", "filename", "sha256", "bytes", "mode", "ownerUid", "ownerGid", "stableDuringAudit"],
      `${label} local file`,
      problems
    )
  ) {
    problem(path.isAbsolute(entry.localFile.path), `${label} local file path must be absolute.`, problems);
    problem(path.basename(entry.localFile.path) === entry.localFile.filename, `${label} local filename does not match its path.`, problems);
    problem(validSha256(entry.localFile.sha256), `${label} local SHA-256 is invalid.`, problems);
    problem(positiveInteger(entry.localFile.bytes), `${label} local byte count is invalid.`, problems);
    problem(entry.localFile.mode === "600", `${label} local evidence mode must be 600.`, problems);
    problem(Number.isSafeInteger(entry.localFile.ownerUid) && entry.localFile.ownerUid >= 0, `${label} local owner UID is invalid.`, problems);
    problem(Number.isSafeInteger(entry.localFile.ownerGid) && entry.localFile.ownerGid >= 0, `${label} local owner GID is invalid.`, problems);
    problem(entry.localFile.stableDuringAudit === true, `${label} local evidence must be stable during audit.`, problems);
  }

  if (
    exactKeys(
      entry.feedDurationSeconds,
      ["baseline", "current"],
      `${label} feed duration`,
      problems
    )
  ) {
    problem(positiveInteger(entry.feedDurationSeconds.baseline), `${label} baseline feed duration is invalid.`, problems);
    problem(positiveInteger(entry.feedDurationSeconds.current), `${label} current feed duration is invalid.`, problems);
  }

  if (
    exactKeys(
      entry.probe,
      ["format", "durationSeconds", "bitRate", "audioStreams", "videoStreamCount"],
      `${label} probe`,
      problems
    )
  ) {
    problem(entry.probe.format === "mp3", `${label} probe format must be mp3.`, problems);
    problem(positiveNumber(entry.probe.durationSeconds), `${label} probe duration is invalid.`, problems);
    problem(positiveInteger(entry.probe.bitRate), `${label} probe bitrate is invalid.`, problems);
    problem(entry.probe.videoStreamCount === 0, `${label} must not contain video.`, problems);
    problem(Array.isArray(entry.probe.audioStreams) && entry.probe.audioStreams.length === 1, `${label} must contain exactly one audio stream.`, problems);
    const stream = entry.probe.audioStreams?.[0];
    if (
      exactKeys(
        stream,
        ["type", "codec", "width", "height", "frameRate", "sampleRate", "channels", "durationSeconds"],
        `${label} audio stream`,
        problems
      )
    ) {
      problem(stream.type === "audio" && stream.codec === "mp3", `${label} audio stream must be MP3.`, problems);
      problem(stream.width === null && stream.height === null, `${label} audio stream dimensions must be null.`, problems);
      problem(stream.frameRate === "0/0", `${label} audio frame rate must be 0/0.`, problems);
      problem(stream.sampleRate === 44100 && stream.channels === 2, `${label} audio must be 44.1 kHz stereo.`, problems);
      problem(closeEnough(stream.durationSeconds, entry.probe.durationSeconds, 0.001), `${label} stream and format durations differ.`, problems);
    }
    problem(
      closeEnough(entry.probe.durationSeconds, entry.feedDurationSeconds?.current, 1),
      `${label} probe and feed durations differ by more than one second.`,
      problems
    );
  }

  if (
    exactKeys(entry.fullDecode, ["passed", "stderrBytes"], `${label} full decode`, problems)
  ) {
    problem(entry.fullDecode.passed === true, `${label} full decode did not pass.`, problems);
    problem(entry.fullDecode.stderrBytes === 0, `${label} full decode emitted errors.`, problems);
  }

  if (
    exactKeys(
      entry.loudness,
      [
        "integratedLufs",
        "truePeakDbtp",
        "loudnessRangeLu",
        "thresholdLufs",
        "measuredWith",
        "acceptedIntegratedLufsRange",
        "maximumTruePeakDbtp",
        "passed",
      ],
      `${label} loudness`,
      problems
    )
  ) {
    problem(
      entry.loudness.integratedLufs >= -17 && entry.loudness.integratedLufs <= -15,
      `${label} integrated loudness is outside -17 through -15 LUFS.`,
      problems
    );
    problem(entry.loudness.truePeakDbtp <= -1, `${label} true peak exceeds -1 dBTP.`, problems);
    problem(isDeepStrictEqual(entry.loudness.acceptedIntegratedLufsRange, [-17, -15]), `${label} accepted loudness range is invalid.`, problems);
    problem(entry.loudness.maximumTruePeakDbtp === -1, `${label} maximum true peak gate is invalid.`, problems);
    problem(entry.loudness.measuredWith === "ffmpeg loudnorm full-file analysis", `${label} loudness measurement method is invalid.`, problems);
    problem(entry.loudness.passed === true, `${label} loudness gate did not pass.`, problems);
  }
}

export function validateRemoteAudioReceiptData({ receipt, catalog }) {
  const problems = [];
  if (!exactKeys(receipt, EXPECTED_RECEIPT_KEYS, "Receipt", problems)) {
    throw new RemoteAudioReceiptIntegrationError(problems);
  }
  problem(receipt.schemaVersion === 1, "Receipt schemaVersion must be 1.", problems);
  problem(receipt.auditType === "rss_com_remote_audio_replacement_readback", "Receipt auditType is invalid.", problems);
  problem(receipt.status === "passed", "Receipt status must be passed.", problems);
  problem(receipt.canonicalFeedUrl === CANONICAL_FEED_URL, "Receipt canonical feed URL is invalid.", problems);
  problem(validTimestamp(receipt.startedAt), "Receipt startedAt is invalid.", problems);
  problem(validTimestamp(receipt.completedAt), "Receipt completedAt is invalid.", problems);
  problem(Date.parse(receipt.completedAt) >= Date.parse(receipt.startedAt), "Receipt completedAt precedes startedAt.", problems);
  validateFeedRecord(receipt.baseline, "Receipt baseline feed", problems);
  validateFeedRecord(receipt.currentFeed, "Receipt current feed", problems);
  validateComparisonReceipt(receipt, problems);
  validateNonEnclosureDifferences(receipt, problems);

  if (
    exactKeys(
      receipt.invariants,
      [
        "baselineEpisodeCount",
        "currentEpisodeCount",
        "uniqueCurrentGuidCount",
        "guidSetExact",
        "allSevenGuidsRetained",
        "allSevenEnclosureUrlsChanged",
        "showMetadataUnchanged",
        "noMissingRequiredMetadata",
        "noUnexpectedEpisodeMetadataDifferences",
        "nonEnclosureDifferencesAllBenign",
      ],
      "Receipt invariants",
      problems
    )
  ) {
    for (const key of ["baselineEpisodeCount", "currentEpisodeCount", "uniqueCurrentGuidCount"]) {
      problem(receipt.invariants[key] === EXPECTED_EPISODE_COUNT, `Receipt invariant ${key} must be 7.`, problems);
    }
    for (const key of [
      "guidSetExact",
      "allSevenGuidsRetained",
      "allSevenEnclosureUrlsChanged",
      "showMetadataUnchanged",
      "noMissingRequiredMetadata",
      "noUnexpectedEpisodeMetadataDifferences",
      "nonEnclosureDifferencesAllBenign",
    ]) {
      problem(receipt.invariants[key] === true, `Receipt invariant ${key} must be true.`, problems);
    }
  }

  if (
    exactKeys(
      receipt.acceptance,
      ["integratedLufsMinimum", "integratedLufsMaximum", "truePeakDbtpMaximum", "fullDecodeRequired"],
      "Receipt acceptance",
      problems
    )
  ) {
    problem(receipt.acceptance.integratedLufsMinimum === -17, "Receipt minimum LUFS gate must be -17.", problems);
    problem(receipt.acceptance.integratedLufsMaximum === -15, "Receipt maximum LUFS gate must be -15.", problems);
    problem(receipt.acceptance.truePeakDbtpMaximum === -1, "Receipt true-peak gate must be -1 dBTP.", problems);
    problem(receipt.acceptance.fullDecodeRequired === true, "Receipt must require full decode.", problems);
  }

  if (
    exactKeys(
      receipt.totals,
      ["episodes", "downloadsPassed", "fullDecodesPassed", "loudnessGatesPassed", "overallPassed"],
      "Receipt totals",
      problems
    )
  ) {
    for (const key of ["episodes", "downloadsPassed", "fullDecodesPassed", "loudnessGatesPassed"]) {
      problem(receipt.totals[key] === EXPECTED_EPISODE_COUNT, `Receipt total ${key} must be 7.`, problems);
    }
    problem(receipt.totals.overallPassed === true, "Receipt overall result must pass.", problems);
  }

  if (
    exactKeys(
      receipt.fetch,
      ["cacheBusted", "requestHeaders", "snapshotPath", "responseHeadersPath"],
      "Receipt fetch",
      problems
    )
  ) {
    problem(receipt.fetch.cacheBusted === true, "Receipt feed fetch must be cache-busted.", problems);
    problem(
      isDeepStrictEqual(receipt.fetch.requestHeaders, ["Cache-Control: no-cache, no-store", "Pragma: no-cache"]),
      "Receipt feed fetch headers are incomplete.",
      problems
    );
    problem(receipt.fetch.snapshotPath === receipt.currentFeed.path, "Receipt snapshot path differs from currentFeed.path.", problems);
    problem(path.isAbsolute(receipt.fetch.responseHeadersPath), "Receipt response header path must be absolute.", problems);
  }

  problem(Array.isArray(receipt.episodes) && receipt.episodes.length === EXPECTED_EPISODE_COUNT, "Receipt must contain exactly seven episodes.", problems);
  const receiptNumbers = (receipt.episodes ?? []).map((entry) => entry.episodeNumber).sort((a, b) => a - b);
  problem(isDeepStrictEqual(receiptNumbers, [1, 2, 3, 4, 5, 6, 7]), "Receipt episode numbers must be exactly 1 through 7.", problems);
  const catalogByNumber = new Map(catalog.episodes.map((entry) => [entry.number, entry]));
  for (const entry of receipt.episodes ?? []) {
    validateEpisodeReceipt(entry, catalogByNumber.get(entry.episodeNumber), problems);
  }
  const currentUrls = (receipt.episodes ?? []).map((entry) => entry.enclosure?.currentUrl);
  problem(new Set(currentUrls).size === EXPECTED_EPISODE_COUNT, "Receipt current enclosure URLs must be unique.", problems);

  if (problems.length > 0) throw new RemoteAudioReceiptIntegrationError(problems);
}

function comparisonMismatchNumbers(comparison, catalog) {
  const byTitle = new Map(catalog.episodes.map((episode) => [episode.title, episode.number]));
  return comparison.metadataMismatches
    .map((entry) => [byTitle.get(entry.title), entry.fields])
    .sort(([left], [right]) => left - right);
}

export function validateReceiptFeeds({ receipt, catalog, baselineXml, currentXml }) {
  const problems = [];
  let baseline;
  let current;
  try {
    baseline = parsePodcastFeed(baselineXml);
    current = parsePodcastFeed(currentXml);
  } catch (error) {
    throw new RemoteAudioReceiptIntegrationError(`Receipt feed snapshot is invalid XML (${error.message}).`);
  }
  const catalogBinding = comparePublishedCatalogFeed(catalog, current);
  problem(catalogBinding.ok, "Current feed identities or catalog metadata do not match the master catalog.", problems);

  const comparison = comparePodcastFeeds(baseline, current);
  problem(comparison.ok === false, "Baseline/current comparison must retain the known duration-only differences.", problems);
  problem(
    isDeepStrictEqual(comparison.issues.map((entry) => entry.code), ["episode_metadata"]),
    "Baseline/current feed comparison contains an unexpected issue.",
    problems
  );
  problem(
    isDeepStrictEqual(comparisonMismatchNumbers(comparison, catalog), [
      [5, ["duration"]],
      [6, ["duration"]],
    ]),
    "Baseline/current feed comparison differs beyond the audited Episode 5 and 6 duration rounding.",
    problems
  );

  const baselineByGuid = new Map(baseline.episodes.map((entry) => [entry.guid, entry]));
  const currentByGuid = new Map(current.episodes.map((entry) => [entry.guid, entry]));
  for (const entry of receipt.episodes) {
    const baselineEpisode = baselineByGuid.get(entry.guid);
    const currentEpisode = currentByGuid.get(entry.guid);
    problem(Boolean(baselineEpisode) && Boolean(currentEpisode), `Episode ${entry.episodeNumber} is missing from a feed snapshot.`, problems);
    if (!baselineEpisode || !currentEpisode) continue;
    problem(baselineEpisode.enclosureUrl === entry.enclosure.baselineUrl, `Episode ${entry.episodeNumber} baseline enclosure differs from its snapshot.`, problems);
    problem(currentEpisode.enclosureUrl === entry.enclosure.currentUrl, `Episode ${entry.episodeNumber} current enclosure differs from its snapshot.`, problems);
    problem(Number(baselineEpisode.duration) === entry.feedDurationSeconds.baseline, `Episode ${entry.episodeNumber} baseline duration differs from its snapshot.`, problems);
    problem(Number(currentEpisode.duration) === entry.feedDurationSeconds.current, `Episode ${entry.episodeNumber} current duration differs from its snapshot.`, problems);
  }
  if (problems.length > 0) throw new RemoteAudioReceiptIntegrationError(problems);
  return { baseline, current, catalogBinding, comparison };
}

async function stableHashMatches(entry, receiptDirectory) {
  const label = `Episode ${entry.episodeNumber} remote enclosure evidence`;
  const resolvedPath = path.resolve(entry.localFile.path);
  if (path.dirname(resolvedPath) !== receiptDirectory) {
    throw new RemoteAudioReceiptIntegrationError(`${label} must be stored beside the receipt.`);
  }
  const before = await fs.lstat(resolvedPath);
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new RemoteAudioReceiptIntegrationError(`${label} must be a regular, non-symlink file.`);
  }
  const actualMode = (before.mode & 0o777).toString(8).padStart(3, "0");
  if (
    before.size !== entry.localFile.bytes ||
    actualMode !== entry.localFile.mode ||
    before.uid !== entry.localFile.ownerUid ||
    before.gid !== entry.localFile.ownerGid
  ) {
    throw new RemoteAudioReceiptIntegrationError(`${label} file facts differ from the receipt.`);
  }
  const actualHash = await hashFile(resolvedPath);
  const after = await fs.lstat(resolvedPath);
  if (
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.size !== after.size ||
    before.mtimeMs !== after.mtimeMs
  ) {
    throw new RemoteAudioReceiptIntegrationError(`${label} changed while it was hashed.`);
  }
  if (actualHash !== entry.localFile.sha256) {
    throw new RemoteAudioReceiptIntegrationError(`${label} SHA-256 differs from the receipt.`);
  }
  return resolvedPath;
}

export async function verifyMediaSemantics(filePath, entry) {
  const [probe, loudness, decode] = await Promise.all([
    probeFile(filePath),
    measureLoudness(filePath),
    decodeAudioFile(filePath, { edgeDecodeTimeoutMs: 15 * 60 * 1000 }),
  ]);
  const problems = [];
  problem(probe.format?.split(",").includes("mp3"), `Episode ${entry.episodeNumber} live probe is not MP3.`, problems);
  problem(closeEnough(probe.durationSeconds, entry.probe.durationSeconds, 0.001), `Episode ${entry.episodeNumber} live probe duration differs from the receipt.`, problems);
  problem(probe.bitRate === entry.probe.bitRate, `Episode ${entry.episodeNumber} live probe bitrate differs from the receipt.`, problems);
  const audioStreams = probe.streams.filter((stream) => stream.type === "audio");
  const videoStreams = probe.streams.filter((stream) => stream.type === "video");
  problem(audioStreams.length === 1 && videoStreams.length === 0, `Episode ${entry.episodeNumber} live probe stream count is invalid.`, problems);
  const audio = audioStreams[0];
  if (audio) {
    problem(audio.codec === "mp3" && audio.sampleRate === 44100 && audio.channels === 2, `Episode ${entry.episodeNumber} live probe audio format differs from the receipt.`, problems);
  }
  problem(decode.ok === true, `Episode ${entry.episodeNumber} full decode failed.`, problems);
  problem(closeEnough(loudness.integratedLufs, entry.loudness.integratedLufs, 0.01), `Episode ${entry.episodeNumber} live integrated loudness differs from the receipt.`, problems);
  problem(closeEnough(loudness.truePeakDbtp, entry.loudness.truePeakDbtp, 0.01), `Episode ${entry.episodeNumber} live true peak differs from the receipt.`, problems);
  problem(loudness.integratedLufs >= -17 && loudness.integratedLufs <= -15, `Episode ${entry.episodeNumber} live integrated loudness is outside the release gate.`, problems);
  problem(loudness.truePeakDbtp <= -1, `Episode ${entry.episodeNumber} live true peak exceeds the release gate.`, problems);
  if (problems.length > 0) throw new RemoteAudioReceiptIntegrationError(problems);
}

export async function verifyReceiptEvidenceFiles({ receipt, receiptPath, mediaVerifier = verifyMediaSemantics }) {
  const receiptDirectory = path.dirname(path.resolve(receiptPath));
  const baselineRecord = await readStableText(path.resolve(receipt.baseline.path), "Receipt baseline feed snapshot");
  const currentRecord = await readStableText(path.resolve(receipt.currentFeed.path), "Receipt current feed snapshot");
  for (const [label, record, expected] of [
    ["baseline", baselineRecord, receipt.baseline],
    ["current", currentRecord, receipt.currentFeed],
  ]) {
    if (record.sha256 !== expected.sha256 || record.stats.size !== expected.bytes) {
      throw new RemoteAudioReceiptIntegrationError(`Receipt ${label} feed snapshot hash or byte count differs.`);
    }
  }
  for (const entry of receipt.episodes) {
    const filePath = await stableHashMatches(entry, receiptDirectory);
    await mediaVerifier(filePath, entry);
  }
  return { baselineXml: baselineRecord.text, currentXml: currentRecord.text };
}

function remoteVerification(entry, receiptSha256, verifiedAt) {
  return {
    verifiedAt,
    receiptSha256,
    priorUrl: entry.enclosure.baselineUrl,
    currentUrl: entry.enclosure.currentUrl,
    urlChanged: true,
    sha256: entry.localFile.sha256,
    sizeBytes: entry.localFile.bytes,
    mediaType: entry.enclosure.contentType,
    durationSeconds: entry.probe.durationSeconds,
    bitRate: entry.probe.bitRate,
    integratedLufs: entry.loudness.integratedLufs,
    truePeakDbtp: entry.loudness.truePeakDbtp,
    fullDecodePassed: true,
  };
}

function replaceSeedUrl(seed, oldUrl, newUrl, label) {
  const oldCount = seed.split(oldUrl).length - 1;
  const newCount = seed.split(newUrl).length - 1;
  if (oldCount === 1 && newCount === 0) return seed.replace(oldUrl, newUrl);
  if (oldCount === 0 && newCount === 1) return seed;
  throw new RemoteAudioReceiptIntegrationError(
    `${label} seed projection must contain exactly one prior or current enclosure URL.`
  );
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function renderSupabaseMigration(catalog, receipt) {
  const byNumber = new Map(receipt.episodes.map((entry) => [entry.episodeNumber, entry]));
  const rows = catalog.episodes.map((episode) => {
    const entry = byNumber.get(episode.number);
    return `      (${sqlLiteral(episode.slug)}, ${sqlLiteral(entry.enclosure.baselineUrl)}, ${sqlLiteral(entry.enclosure.currentUrl)})`;
  });
  const values = rows.join(",\n");
  return `-- Project the seven verified RSS.com normalized-audio enclosure URLs.\n+-- This migration does not claim downstream Apple or Spotify refresh.\n+begin;\n+\n+do $$\n+declare\n+  missing_slugs text;\n+  unexpected_urls text;\n+begin\n+  if exists (select 1 from public.episodes) then\n+    with expected(slug, previous_url, approved_url) as (\n+      values\n+${values}\n+    )\n+    select string_agg(expected.slug, ', ' order by expected.slug)\n+      into missing_slugs\n+      from expected\n+      left join public.episodes on episodes.slug = expected.slug\n+     where episodes.slug is null;\n+\n+    if missing_slugs is not null then\n+      raise exception 'Cannot publish normalized RSS audio; missing episode rows: %', missing_slugs;\n+    end if;\n+\n+    with expected(slug, previous_url, approved_url) as (\n+      values\n+${values}\n+    )\n+    select string_agg(format('%s (%s)', episodes.slug, coalesce(episodes.audio_url, 'NULL')), ', ' order by episodes.slug)\n+      into unexpected_urls\n+      from expected\n+      join public.episodes on episodes.slug = expected.slug\n+     where episodes.audio_url is distinct from expected.previous_url\n+       and episodes.audio_url is distinct from expected.approved_url;\n+\n+    if unexpected_urls is not null then\n+      raise exception 'Refusing to overwrite unexpected episode audio URLs: %', unexpected_urls;\n+    end if;\n+  end if;\n+end\n+$$;\n+\n+with expected(slug, previous_url, approved_url) as (\n+  values\n+${values}\n+)\n+update public.episodes\n+   set audio_url = expected.approved_url,\n+       updated_at = now()\n+  from expected\n+ where episodes.slug = expected.slug\n+   and episodes.audio_url = expected.previous_url;\n+\n+do $$\n+declare\n+  mismatched text;\n+begin\n+  if exists (select 1 from public.episodes) then\n+    with expected(slug, previous_url, approved_url) as (\n+      values\n+${values}\n+    )\n+    select string_agg(format('%s (%s)', expected.slug, coalesce(episodes.audio_url, 'MISSING')), ', ' order by expected.slug)\n+      into mismatched\n+      from expected\n+      left join public.episodes on episodes.slug = expected.slug\n+     where episodes.slug is null\n+        or episodes.audio_url is distinct from expected.approved_url;\n+\n+    if mismatched is not null then\n+      raise exception 'Normalized RSS audio URL postcondition failed: %', mismatched;\n+    end if;\n+  end if;\n+end\n+$$;\n+\n+commit;\n+`;
}

export function buildRemoteAudioIntegration({ catalog, audit, enrichment, seed, receipt, receiptSha256 }) {
  const catalogValidation = validateCatalog(catalog);
  if (!catalogValidation.valid) {
    throw new RemoteAudioReceiptIntegrationError(
      catalogValidation.errors.map((entry) => `Current catalog: ${entry}`)
    );
  }
  const auditValidation = validateIntegratedAudioAudit(audit);
  if (!auditValidation.valid) {
    throw new RemoteAudioReceiptIntegrationError(
      auditValidation.errors.map((entry) => `Current audio audit: ${entry}`)
    );
  }
  const alreadyIntegrated =
    catalog.revision === NEXT_CATALOG_REVISION &&
    audit.remoteReplacement?.receiptSha256 === receiptSha256;
  if (!alreadyIntegrated && catalog.revision !== BASE_CATALOG_REVISION) {
    throw new RemoteAudioReceiptIntegrationError(
      `Catalog revision must be ${BASE_CATALOG_REVISION}, or ${NEXT_CATALOG_REVISION} with the same integrated receipt.`
    );
  }

  const nextCatalog = structuredClone(catalog);
  const nextAudit = structuredClone(audit);
  const nextEnrichment = structuredClone(enrichment);
  let nextSeed = seed;
  const receiptByNumber = new Map(receipt.episodes.map((entry) => [entry.episodeNumber, entry]));
  const auditByNumber = new Map(nextAudit.episodes.map((entry) => [entry.number, entry]));

  for (const episode of nextCatalog.episodes) {
    const entry = receiptByNumber.get(episode.number);
    const audioAsset = nextCatalog.assetRegistry[episode.assetRefs.podcastAudio];
    if (!entry || !audioAsset) {
      throw new RemoteAudioReceiptIntegrationError(`Episode ${episode.number} catalog binding is incomplete.`);
    }
    if (![entry.enclosure.baselineUrl, entry.enclosure.currentUrl].includes(audioAsset.publishedUrl)) {
      throw new RemoteAudioReceiptIntegrationError(`Episode ${episode.number} catalog enclosure is neither the audited prior nor current URL.`);
    }
    audioAsset.publishedUrl = entry.enclosure.currentUrl;

    const auditEpisode = auditByNumber.get(episode.number);
    const rssTargets = auditEpisode?.remoteReplacementTargets?.filter(
      (target) => target.platform === "rssCom"
    );
    if (rssTargets?.length !== 1 || rssTargets[0].existingId !== episode.rssGuid) {
      throw new RemoteAudioReceiptIntegrationError(`Episode ${episode.number} RSS.com target binding is invalid.`);
    }
    const rssTarget = rssTargets[0];
    if (![entry.enclosure.baselineUrl, entry.enclosure.currentUrl].includes(rssTarget.existingUrl)) {
      throw new RemoteAudioReceiptIntegrationError(`Episode ${episode.number} RSS.com target URL is unexpected.`);
    }
    const desiredVerification = remoteVerification(entry, receiptSha256, receipt.completedAt);
    if (
      rssTarget.status === "verified_remote_replacement" &&
      !isDeepStrictEqual(rssTarget.verification, desiredVerification)
    ) {
      throw new RemoteAudioReceiptIntegrationError(`Episode ${episode.number} has conflicting remote verification evidence.`);
    }
    rssTarget.status = "verified_remote_replacement";
    rssTarget.existingUrl = entry.enclosure.currentUrl;
    rssTarget.verification = desiredVerification;

    const vimeoId = episode.destinations.vimeo?.id;
    if (!vimeoId || !isPlainObject(nextEnrichment[vimeoId])) {
      throw new RemoteAudioReceiptIntegrationError(`Episode ${episode.number} website enrichment binding is missing.`);
    }
    if (![entry.enclosure.baselineUrl, entry.enclosure.currentUrl].includes(nextEnrichment[vimeoId].audioUrl)) {
      throw new RemoteAudioReceiptIntegrationError(`Episode ${episode.number} website audio URL is unexpected.`);
    }
    nextEnrichment[vimeoId].audioUrl = entry.enclosure.currentUrl;
    nextSeed = replaceSeedUrl(
      nextSeed,
      entry.enclosure.baselineUrl,
      entry.enclosure.currentUrl,
      `Episode ${episode.number}`
    );
  }

  nextCatalog.revision = NEXT_CATALOG_REVISION;
  nextCatalog.updatedAt = receipt.completedAt;
  nextAudit.updatedAt = receipt.completedAt;
  nextAudit.status = REMOTE_STATUS;
  nextAudit.remoteReplacement = {
    provider: "rss.com",
    status: "verified_remote_replacement",
    verifiedAt: receipt.completedAt,
    receiptSha256,
    baselineFeedSha256: receipt.baseline.sha256,
    currentFeedSha256: receipt.currentFeed.sha256,
    allSevenGuidsRetained: true,
    allSevenEnclosureUrlsChanged: true,
    downloadsPassed: 7,
    fullDecodesPassed: 7,
    loudnessGatesPassed: 7,
    downstreamRefreshVerified: false,
  };
  nextAudit.platformNotes.rssCom =
    "All seven existing RSS.com episodes now reference verified normalized enclosures. GUIDs and catalog identity were preserved; downstream directory refresh remains unverified.";

  const nextCatalogValidation = validateCatalog(nextCatalog);
  const nextAuditValidation = validateIntegratedAudioAudit(nextAudit);
  if (!nextCatalogValidation.valid || !nextAuditValidation.valid) {
    throw new RemoteAudioReceiptIntegrationError([
      ...nextCatalogValidation.errors.map((entry) => `Generated catalog: ${entry}`),
      ...nextAuditValidation.errors.map((entry) => `Generated audio audit: ${entry}`),
    ]);
  }
  return {
    catalog: nextCatalog,
    audit: nextAudit,
    enrichment: nextEnrichment,
    seed: nextSeed,
    migration: renderSupabaseMigration(nextCatalog, receipt),
  };
}

async function writeAtomic(filePath, text) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
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

async function applyIntegration({ records, outputPaths, next }) {
  const lockPath = path.join(path.dirname(outputPaths.catalog), ".remote-audio-receipt-integration.lock");
  let lock;
  try {
    lock = await fs.open(lockPath, "wx", 0o600);
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new RemoteAudioReceiptIntegrationError(`Integration lock already exists: ${lockPath}`);
    }
    throw error;
  }
  const desired = new Map([
    [outputPaths.catalog, `${JSON.stringify(next.catalog, null, 2)}\n`],
    [outputPaths.audit, `${JSON.stringify(next.audit, null, 2)}\n`],
    [outputPaths.enrichment, `${JSON.stringify(next.enrichment, null, 2)}\n`],
    [outputPaths.seed, next.seed],
    [outputPaths.migration, next.migration],
  ]);
  const originals = new Map([
    [outputPaths.catalog, records.catalog.text],
    [outputPaths.audit, records.audit.text],
    [outputPaths.enrichment, records.enrichment.text],
    [outputPaths.seed, records.seed.text],
    [outputPaths.migration, records.migration?.text],
  ]);
  try {
    for (const [filePath, original] of originals) {
      const current = await fs.readFile(filePath, "utf8").catch((error) => {
        if (error.code === "ENOENT") return undefined;
        throw error;
      });
      if (current !== original) {
        throw new RemoteAudioReceiptIntegrationError(`${filePath} changed after preflight.`);
      }
    }
    try {
      for (const [filePath, text] of desired) {
        if (originals.get(filePath) !== text) await writeAtomic(filePath, text);
      }
    } catch (error) {
      for (const [filePath, text] of originals) {
        if (text === undefined) await fs.rm(filePath, { force: true });
        else await writeAtomic(filePath, text);
      }
      throw error;
    }
    const writtenCatalog = JSON.parse(await fs.readFile(outputPaths.catalog, "utf8"));
    const writtenAudit = JSON.parse(await fs.readFile(outputPaths.audit, "utf8"));
    if (!validateCatalog(writtenCatalog).valid || !validateIntegratedAudioAudit(writtenAudit).valid) {
      throw new RemoteAudioReceiptIntegrationError("Post-write catalog or audit validation failed.");
    }
  } finally {
    await lock?.close();
    await fs.rm(lockPath, { force: true });
  }
}

export async function integrateRemoteAudioReceipt({
  receiptPath,
  expectedReceiptSha256,
  catalogPath = DEFAULT_CATALOG_PATH,
  auditPath = DEFAULT_AUDIT_PATH,
  enrichmentPath = DEFAULT_ENRICHMENT_PATH,
  seedPath = DEFAULT_SEED_PATH,
  migrationPath = DEFAULT_MIGRATION_PATH,
  apply = false,
  mediaVerifier = verifyMediaSemantics,
}) {
  const resolvedReceiptPath = path.resolve(receiptPath);
  const outputPaths = {
    catalog: path.resolve(catalogPath),
    audit: path.resolve(auditPath),
    enrichment: path.resolve(enrichmentPath),
    seed: path.resolve(seedPath),
    migration: path.resolve(migrationPath),
  };
  const [receiptRecord, catalogRecord, auditRecord, enrichmentRecord, seedRecord, migrationRecord] =
    await Promise.all([
      readStableJson(resolvedReceiptPath, "Remote audio replacement receipt"),
      readStableJson(outputPaths.catalog, "Master catalog"),
      readStableJson(outputPaths.audit, "Audio replacement audit"),
      readStableJson(outputPaths.enrichment, "Website episode enrichment"),
      readStableText(outputPaths.seed, "Supabase seed"),
      readStableText(outputPaths.migration, "Supabase migration").catch((error) => {
        if (error.cause?.code === "ENOENT" || error.message.includes("ENOENT")) return null;
        throw error;
      }),
    ]);
  if (!validSha256(expectedReceiptSha256) || receiptRecord.sha256 !== expectedReceiptSha256) {
    throw new RemoteAudioReceiptIntegrationError("Receipt SHA-256 does not match the approved value.");
  }
  validateRemoteAudioReceiptData({ receipt: receiptRecord.value, catalog: catalogRecord.value });
  const feedEvidence = await verifyReceiptEvidenceFiles({
    receipt: receiptRecord.value,
    receiptPath: resolvedReceiptPath,
    mediaVerifier,
  });
  validateReceiptFeeds({
    receipt: receiptRecord.value,
    catalog: catalogRecord.value,
    ...feedEvidence,
  });
  const next = buildRemoteAudioIntegration({
    catalog: catalogRecord.value,
    audit: auditRecord.value,
    enrichment: enrichmentRecord.value,
    seed: seedRecord.text,
    receipt: receiptRecord.value,
    receiptSha256: receiptRecord.sha256,
  });
  if (migrationRecord && migrationRecord.text !== next.migration) {
    throw new RemoteAudioReceiptIntegrationError(
      `Existing migration ${outputPaths.migration} does not match this receipt.`
    );
  }
  const records = {
    catalog: catalogRecord,
    audit: auditRecord,
    enrichment: enrichmentRecord,
    seed: seedRecord,
    migration: migrationRecord,
  };
  if (apply) await applyIntegration({ records, outputPaths, next });
  return {
    applied: apply,
    receiptSha256: receiptRecord.sha256,
    catalogRevisionBefore: catalogRecord.value.revision,
    catalogRevisionAfter: next.catalog.revision,
    episodeCount: receiptRecord.value.episodes.length,
    downstreamRefreshVerified: false,
    migrationPath: outputPaths.migration,
  };
}

function usage() {
  return [
    "Usage:",
    "  node scripts/publish/integrate-remote-audio-receipt.mjs \\",
    "    --receipt <remote-audio-replacement-receipt.json> \\",
    "    --receipt-sha256 <approved-sha256> [--apply]",
    "",
    "The command validates feed identity, every downloaded enclosure, full decode, and loudness before writing.",
    "It updates local projections only; it does not touch Supabase or claim downstream directory refresh.",
  ].join("\n");
}

function parseArguments(argv) {
  const options = { apply: false };
  const nextValue = (index, argument) => {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new RemoteAudioReceiptIntegrationError(`${argument} requires a value.`);
    }
    return value;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") options.apply = true;
    else if (argument === "--receipt") options.receiptPath = nextValue(index++, argument);
    else if (argument === "--receipt-sha256") options.expectedReceiptSha256 = nextValue(index++, argument);
    else if (argument === "--catalog") options.catalogPath = nextValue(index++, argument);
    else if (argument === "--audit") options.auditPath = nextValue(index++, argument);
    else if (argument === "--enrichment") options.enrichmentPath = nextValue(index++, argument);
    else if (argument === "--seed") options.seedPath = nextValue(index++, argument);
    else if (argument === "--migration") options.migrationPath = nextValue(index++, argument);
    else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new RemoteAudioReceiptIntegrationError(`Unknown argument: ${argument}`);
  }
  if (!options.help && !options.receiptPath) throw new RemoteAudioReceiptIntegrationError("--receipt is required.");
  if (!options.help && !options.expectedReceiptSha256) throw new RemoteAudioReceiptIntegrationError("--receipt-sha256 is required.");
  return options;
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) process.stdout.write(`${usage()}\n`);
    else {
      const result = await integrateRemoteAudioReceipt(options);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
