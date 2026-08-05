import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { htmlDescriptionToPlainText, youtubeDescriptionFromHtml } from "./catalog.mjs";

const execFileAsync = promisify(execFile);

export const PLATFORM_IDS = [
  "spotify",
  "apple",
  "amazon",
  "youtube",
  "vimeo",
  "instagram",
  "rumble",
];

const ASSET_KEYS = ["fullVideo", "podcastAudio", "instagramReel", "thumbnail", "captions"];
const VIDEO_TARGETS = new Set(["youtube", "vimeo", "rumble"]);
const PLAIN_DESCRIPTION_TARGETS = new Set(["youtube", "vimeo", "rumble"]);
const DIRECT_COPY_KEYS = new Set(["instagram", "rumble", "youtube", "vimeo"]);
const DIRECT_RELEASE_TARGETS = new Set(["spotify", "youtube", "vimeo", "instagram", "rumble"]);
const RELEASE_CHOICE_KEYS = [
  "initialVisibility",
  "finalVisibility",
  "license",
  "monetization",
  "notifications",
];
const PLATFORM_RELEASE_RULES = {
  spotify: {
    visibility: new Set(["draft", "public", "not_selected"]),
    license: new Set(["not_applicable", "not_selected"]),
  },
  youtube: {
    visibility: new Set(["private", "unlisted", "public", "not_selected"]),
    license: new Set(["youtube", "creativeCommon", "not_selected"]),
  },
  vimeo: {
    visibility: new Set(["anybody", "disable", "nobody", "password", "team", "unlisted", "not_selected"]),
    license: new Set(["none", "by", "by-nc", "by-nc-nd", "by-nc-sa", "by-nd", "by-sa", "cc0", "not_selected"]),
  },
  instagram: {
    visibility: new Set(["not_applicable", "public", "not_selected"]),
    license: new Set(["not_applicable", "not_selected"]),
  },
  rumble: {
    visibility: new Set(["unlisted", "public", "not_selected"]),
    license: new Set([
      "exclusive_video_management",
      "video_management_excluding_youtube",
      "rumble_player",
      "personal_use",
      "not_selected",
    ]),
  },
};
const DESTINATION_ID_PATTERNS = {
  spotify: { containerId: /^[A-Za-z0-9]{22}$/ },
  apple: { containerId: /^\d+$/ },
  youtube: {
    accountId: /^UC[A-Za-z0-9_-]{22}$/,
    containerId: /^(?:PL|UU|OLAK5uy_)[A-Za-z0-9_-]+$/,
  },
  vimeo: { accountId: /^\d+$/ },
  instagram: { accountId: /^\d+$/ },
};
const episodeSchema = JSON.parse(
  await fs.readFile(new URL("../../publishing/episode.schema.json", import.meta.url), "utf8")
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv, { mode: "full" });
const validateEpisodeSchema = ajv.compile(episodeSchema);

export function publisherHome(env = process.env) {
  if (env.DRM_PUBLISH_HOME) return path.resolve(env.DRM_PUBLISH_HOME);
  const stateRoot = env.XDG_STATE_HOME || path.join(os.homedir(), ".local", "state");
  return path.join(stateRoot, "drm-publisher");
}

export function configHome(env = process.env) {
  const configRoot = env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(configRoot, "drm-publisher");
}

export function hostingMigrationIsActive(migration, pendingMigration) {
  return Boolean(migration) && migration.decision?.active !== false && pendingMigration?.active !== false;
}

function sortedValue(value) {
  if (Array.isArray(value)) return value.map(sortedValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortedValue(item)])
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(sortedValue(value));
}

export function hashSnapshot(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function hashText(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export async function hashFile(filePath) {
  const hash = createHash("sha256");
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unresolvedReleaseChoices(releasePlan) {
  if (!isPlainObject(releasePlan)) return RELEASE_CHOICE_KEYS;
  return RELEASE_CHOICE_KEYS.filter((key) => releasePlan[key] === "not_selected");
}

export function missingDestinationIds(platform) {
  const destinationIds = isPlainObject(platform.destinationIds) ? platform.destinationIds : {};
  const required = Array.isArray(platform.requiredDestinationIds) ? platform.requiredDestinationIds : [];
  return required.filter((key) => typeof destinationIds[key] !== "string" || !destinationIds[key].trim());
}

export function invalidDestinationIds(platformId, platform) {
  const destinationIds = isPlainObject(platform.destinationIds) ? platform.destinationIds : {};
  const patterns = DESTINATION_ID_PATTERNS[platformId] || {};
  return Object.entries(patterns)
    .filter(([key, pattern]) => destinationIds[key] != null && !pattern.test(destinationIds[key]))
    .map(([key]) => key);
}

function schemaPath(error) {
  const segments = error.instancePath
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
  if (error.keyword === "required") segments.push(error.params.missingProperty);
  if (error.keyword === "additionalProperties") segments.push(error.params.additionalProperty);
  return segments.join(".") || "manifest";
}

function schemaErrorMessage(error) {
  return `${schemaPath(error)} ${error.message}.`;
}

const RFC3339_WITH_TIMEZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const LEGACY_EPISODE_TITLE_PREFIX = /^(?:Episode|Ep\.?)\s*#?\s*\d+\b/i;

export function validateManifest(manifest) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(manifest)) {
    return { errors: ["Manifest must be a JSON object."], warnings };
  }

  if (!validateEpisodeSchema(manifest)) {
    errors.push(...validateEpisodeSchema.errors.map(schemaErrorMessage));
  }

  if (typeof manifest.title === "string" && LEGACY_EPISODE_TITLE_PREFIX.test(manifest.title.trimStart())) {
    errors.push("title must omit the leading episode number; use episodeNumber for structured ordering.");
  }

  if (
    manifest.publishAt != null &&
    (typeof manifest.publishAt !== "string" ||
      !RFC3339_WITH_TIMEZONE.test(manifest.publishAt) ||
      Number.isNaN(Date.parse(manifest.publishAt)))
  ) {
    errors.push("publishAt must be null or an RFC 3339 date-time with an explicit timezone.");
  }
  if (manifest.publishAt == null) {
    warnings.push("No publishAt value is set; every destination will remain unscheduled until release approval.");
  }

  if (Array.isArray(manifest.targets)) {
    const invalidTargets = manifest.targets.filter((target) => !PLATFORM_IDS.includes(target));
    if (invalidTargets.length) errors.push(`Unknown target(s): ${invalidTargets.join(", ")}.`);

    const selectedTargets = new Set(manifest.targets);
    for (const target of manifest.targets.filter((target) => DIRECT_RELEASE_TARGETS.has(target))) {
      if (!isPlainObject(manifest.releasePlan?.[target])) {
        errors.push(`releasePlan.${target} is required for the selected direct destination.`);
      }
    }
    if (isPlainObject(manifest.releasePlan)) {
      for (const [target, releasePlan] of Object.entries(manifest.releasePlan)) {
        if (!selectedTargets.has(target)) {
          errors.push(`releasePlan.${target} is present but ${target} is not selected in targets.`);
        }
        if (!DIRECT_RELEASE_TARGETS.has(target)) {
          errors.push(`releasePlan.${target} is not a direct publishing destination.`);
        }
        if (releasePlan?.releaseMode === "scheduled" && manifest.publishAt == null) {
          errors.push(`releasePlan.${target}.releaseMode is scheduled but publishAt is not set.`);
        }
        if (releasePlan?.releaseMode === "publish_now" && manifest.publishAt != null) {
          errors.push(`releasePlan.${target}.releaseMode is publish_now but publishAt is also set.`);
        }
        const rules = PLATFORM_RELEASE_RULES[target];
        for (const key of ["initialVisibility", "finalVisibility"]) {
          if (typeof releasePlan?.[key] === "string" && !rules?.visibility.has(releasePlan[key])) {
            errors.push(`releasePlan.${target}.${key} is not a supported ${target} visibility value.`);
          }
        }
        if (typeof releasePlan?.license === "string" && !rules?.license.has(releasePlan.license)) {
          errors.push(`releasePlan.${target}.license is not a supported ${target} license value.`);
        }
        const unresolved = unresolvedReleaseChoices(releasePlan);
        if (unresolved.length) {
          warnings.push(`${target} release choices still need selection: ${unresolved.join(", ")}.`);
        }
      }
    }
  }

  if (isPlainObject(manifest.assets) && Array.isArray(manifest.targets)) {
    const targets = new Set(manifest.targets);
    if ([...VIDEO_TARGETS].some((target) => targets.has(target)) && !manifest.assets.fullVideo) {
      errors.push("assets.fullVideo is required for YouTube, Vimeo, or Rumble.");
    }
    if (targets.has("spotify") && !manifest.assets.fullVideo && !manifest.assets.podcastAudio) {
      errors.push("Spotify requires assets.fullVideo or assets.podcastAudio.");
    }
    for (const directory of ["apple", "amazon"]) {
      if (targets.has(directory) && !targets.has("spotify")) {
        errors.push(`${directory} requires spotify in targets because this show distributes through the canonical RSS feed.`);
      }
    }
    if (targets.has("instagram") && !manifest.assets.instagramReel) {
      warnings.push("Instagram is selected but assets.instagramReel is missing.");
    }
  }

  if (isPlainObject(manifest.copy)) {
    for (const key of Object.keys(manifest.copy)) {
      if (!DIRECT_COPY_KEYS.has(key)) errors.push(`copy.${key} is not a supported destination override.`);
    }
  }
  if (Array.isArray(manifest.targets) && manifest.targets.includes("instagram") && typeof manifest.copy?.instagram !== "string") {
    warnings.push("Instagram is selected but copy.instagram is not supplied; no caption will be generated automatically.");
  }

  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

export function normalizeManifest(manifest) {
  const validation = validateManifest(manifest);
  if (validation.errors.length) {
    throw new Error(`Manifest validation failed:\n- ${validation.errors.join("\n- ")}`);
  }
  const normalized = structuredClone(manifest);
  if (typeof normalized.publishAt === "string") {
    normalized.publishAt = new Date(normalized.publishAt).toISOString();
  }
  return normalized;
}

export function resolveAssetPaths(manifest, manifestPath) {
  const baseDir = path.dirname(path.resolve(manifestPath));
  const assets = {};
  for (const key of ASSET_KEYS) {
    const value = manifest.assets?.[key];
    assets[key] = value ? path.resolve(baseDir, value) : null;
  }
  return assets;
}

function summarizeProbe(probe) {
  const streams = (probe.streams || []).map((stream) => ({
    type: stream.codec_type || null,
    codec: stream.codec_name || null,
    width: stream.width ?? null,
    height: stream.height ?? null,
    frameRate: stream.avg_frame_rate || stream.r_frame_rate || null,
    sampleRate: stream.sample_rate ? Number(stream.sample_rate) : null,
    channels: stream.channels ?? null,
    durationSeconds: stream.duration == null ? null : Number(stream.duration),
  }));
  return {
    format: probe.format?.format_name || null,
    durationSeconds: probe.format?.duration == null ? null : Number(probe.format.duration),
    bitRate: probe.format?.bit_rate == null ? null : Number(probe.format.bit_rate),
    streams,
  };
}

export async function probeFile(filePath) {
  const { stdout } = await execFileAsync(
    "ffprobe",
    ["-v", "error", "-show_streams", "-show_format", "-of", "json", filePath],
    { maxBuffer: 16 * 1024 * 1024 }
  );
  return summarizeProbe(JSON.parse(stdout));
}

export async function inspectAsset(filePath, key) {
  const stats = await fs.stat(filePath);
  if (!stats.isFile()) throw new Error(`${key} is not a regular file: ${filePath}`);
  const shouldProbe = key !== "captions";
  return {
    key,
    path: filePath,
    sizeBytes: stats.size,
    modifiedMs: Math.trunc(stats.mtimeMs),
    sha256: await hashFile(filePath),
    media: shouldProbe ? await probeFile(filePath) : null,
  };
}

export async function derivePodcastAudio(videoPath, outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true, mode: 0o700 });
  await execFileAsync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-y",
      "-i",
      videoPath,
      "-map",
      "0:a:0",
      "-vn",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "192k",
      "-ar",
      "44100",
      "-ac",
      "2",
      "-map_metadata",
      "-1",
      outputPath,
    ],
    { maxBuffer: 4 * 1024 * 1024 }
  );
  await fs.chmod(outputPath, 0o600);
}

function videoStream(asset) {
  return asset?.media?.streams?.find((stream) => stream.type === "video") || null;
}

function audioStream(asset) {
  return asset?.media?.streams?.find((stream) => stream.type === "audio") || null;
}

export function validateMediaAssets(assetRecords, manifest) {
  const warnings = [];
  const targetErrors = Object.fromEntries(PLATFORM_IDS.map((id) => [id, []]));
  const selected = new Set(manifest.targets);
  const fullVideo = assetRecords.fullVideo;
  const podcastAudio = assetRecords.podcastAudio;
  const reel = assetRecords.instagramReel;

  const block = (target, message) => {
    targetErrors[target].push(message);
    warnings.push(`${target}: ${message}`);
  };

  if (fullVideo) {
    const video = videoStream(fullVideo);
    const audio = audioStream(fullVideo);
    for (const target of ["spotify", "youtube", "vimeo", "rumble"]) {
      if (selected.has(target) && !video) block(target, "fullVideo has no video stream.");
    }
    if (selected.has("spotify") && !audio) block("spotify", "fullVideo has no audio stream.");

    if (selected.has("youtube")) {
      if (fullVideo.sizeBytes > 256 * 1024 ** 3) block("youtube", "fullVideo exceeds YouTube's 256 GB limit.");
      if ((fullVideo.media?.durationSeconds || 0) > 12 * 60 * 60) {
        block("youtube", "fullVideo exceeds YouTube's 12-hour limit.");
      }
    }

    if (selected.has("vimeo")) {
      if (fullVideo.sizeBytes > 300 * 1024 ** 3) block("vimeo", "fullVideo exceeds Vimeo's 300 GB limit.");
      if ((fullVideo.media?.durationSeconds || 0) > 24 * 60 * 60) {
        block("vimeo", "fullVideo exceeds Vimeo's 24-hour limit.");
      }
    }

    if (selected.has("spotify")) {
      if (fullVideo.sizeBytes > 60 * 1024 ** 3) block("spotify", "fullVideo exceeds Spotify's documented 60 GB compatibility limit.");
      else if (fullVideo.sizeBytes > 10 * 1024 ** 3) warnings.push("spotify: fullVideo is above Spotify's recommended 10 GB size.");
      if ((fullVideo.media?.durationSeconds || 0) > 12 * 60 * 60) {
        block("spotify", "fullVideo exceeds Spotify's documented 12-hour compatibility limit.");
      } else if ((fullVideo.media?.durationSeconds || 0) > 4 * 60 * 60) {
        warnings.push("spotify: fullVideo is longer than Spotify's recommended four-hour duration.");
      }
    }
  }

  if (selected.has("spotify") && !fullVideo && podcastAudio && !audioStream(podcastAudio)) {
    block("spotify", "podcastAudio has no audio stream.");
  }

  if (selected.has("instagram")) {
    if (!reel) {
      warnings.push("Instagram cannot be prepared until an instagramReel file is supplied.");
    } else {
      const video = videoStream(reel);
      const audio = audioStream(reel);
      const duration = reel.media?.durationSeconds || 0;
      if (!video) block("instagram", "instagramReel has no video stream.");
      if (!audio) block("instagram", "instagramReel has no audio stream.");
      if (duration < 3 || duration > 15 * 60) block("instagram", "instagramReel must be between 3 seconds and 15 minutes.");
      if (reel.sizeBytes > 300 * 1024 ** 2) block("instagram", "instagramReel exceeds Meta's 300 MB API limit.");
      if (video && !["h264", "hevc"].includes(video.codec)) block("instagram", "instagramReel must use H.264 or HEVC video.");
      if (audio && audio.codec !== "aac") block("instagram", "instagramReel must use AAC audio.");
      if (audio?.sampleRate && audio.sampleRate > 48000) block("instagram", "instagramReel audio must not exceed 48 kHz.");
      if (audio?.channels && ![1, 2].includes(audio.channels)) block("instagram", "instagramReel audio must have one or two channels.");
      if (video?.width && video?.height) {
        const ratio = video.width / video.height;
        if (ratio < 0.01 || ratio > 10) block("instagram", "instagramReel aspect ratio is outside Meta's 0.01:1 to 10:1 range.");
        else if (Math.abs(ratio - 9 / 16) > 0.03) warnings.push("instagram: instagramReel is not close to the recommended 9:16 aspect ratio.");
        if (video.width > 1920) block("instagram", "instagramReel exceeds Meta's 1,920 horizontal-pixel limit.");
      }
    }
  }

  const audioDuration = podcastAudio?.media?.durationSeconds;
  const videoDuration = fullVideo?.media?.durationSeconds;
  if (audioDuration && videoDuration && Math.abs(audioDuration - videoDuration) > 2) {
    warnings.push("podcastAudio and fullVideo durations differ by more than two seconds; confirm the edit versions intentionally differ.");
  }

  if (!assetRecords.thumbnail && ["youtube", "vimeo", "rumble"].some((target) => selected.has(target))) {
    warnings.push("No approved thumbnail is supplied; video platforms will use an automatic frame unless one is added.");
  }
  return {
    warnings: [...new Set(warnings)],
    targetErrors: Object.fromEntries(
      Object.entries(targetErrors).map(([target, errors]) => [target, [...new Set(errors)]])
    ),
  };
}

export function mediaWarnings(assetRecords, manifest) {
  return validateMediaAssets(assetRecords, manifest).warnings;
}

export function resolveDestinationCopy(manifest, platformId) {
  const override = manifest.copy?.[platformId];
  if (typeof override === "string") {
    return { approvedCopy: override, copySource: `copy.${platformId}` };
  }
  if (platformId === "youtube") {
    return {
      approvedCopy: youtubeDescriptionFromHtml(manifest.description),
      copySource: "description (deterministic YouTube-safe plain-text projection)",
    };
  }
  if (PLAIN_DESCRIPTION_TARGETS.has(platformId)) {
    return {
      approvedCopy: htmlDescriptionToPlainText(manifest.description),
      copySource: "description (deterministic plain-text projection)",
    };
  }
  if (platformId === "instagram") {
    return { approvedCopy: null, copySource: "not provided" };
  }
  return { approvedCopy: manifest.description, copySource: "description" };
}

export function buildTargetPlan(platformConfig, manifest, assetRecords, targetErrors = {}) {
  return manifest.targets.map((platformId) => {
    const platform = platformConfig.platforms[platformId];
    const destinationIds = isPlainObject(platform.destinationIds) ? structuredClone(platform.destinationIds) : {};
    const requiredDestinationIds = Array.isArray(platform.requiredDestinationIds)
      ? [...platform.requiredDestinationIds]
      : [];
    const missingIds = missingDestinationIds(platform);
    const invalidIds = invalidDestinationIds(platformId, platform);
    const releasePlan = manifest.releasePlan?.[platformId] || null;
    const unresolvedChoices = releasePlan ? unresolvedReleaseChoices(releasePlan) : [];
    const preferredAsset = platform.asset || null;
    const assetKey =
      preferredAsset && assetRecords[preferredAsset]
        ? preferredAsset
        : platform.fallbackAsset && assetRecords[platform.fallbackAsset]
          ? platform.fallbackAsset
          : preferredAsset;
    const asset = assetKey ? assetRecords[assetKey] || null : null;
    const validationIssues = targetErrors[platformId] || [];
    const destinationCopy = resolveDestinationCopy(manifest, platformId);
    let readiness = "ready_for_account_setup";

    if (platform.source === "rss" || platform.mode === "rss_fanout") {
      if (platform.dependsOn && !manifest.targets.includes(platform.dependsOn)) {
        readiness = "host_publish_dependency_missing";
      } else if (missingIds.length) {
        readiness = "destination_id_required";
      } else if (invalidIds.length) {
        readiness = "destination_id_invalid";
      } else if (platformId === "amazon" && !platform.channelUrl) {
        readiness = "directory_setup_required";
      } else {
        readiness = "waiting_for_host_publish";
      }
    } else if (!asset) readiness = "asset_required";
    else if (validationIssues.length) readiness = "asset_invalid";
    else if (missingIds.length) readiness = "destination_id_required";
    else if (invalidIds.length) readiness = "destination_id_invalid";
    else if (!releasePlan || unresolvedChoices.length) readiness = "release_choices_required";
    else if (platformId === "spotify") readiness = "manual_upload_required";
    else if (platformId === "rumble") readiness = "manual_browser_required";
    else if (platformId === "youtube") readiness = "oauth_and_audit_required";
    else if (platformId === "vimeo") readiness = "api_auth_required";
    else if (platformId === "instagram") readiness = "api_auth_required";

    return {
      id: platformId,
      label: platform.label,
      mode: platform.mode,
      readiness,
      asset: platform.source === "rss" ? "rss_feed" : assetKey,
      assetSha256: asset?.sha256 || null,
      dependsOn: platform.dependsOn || null,
      destinationIds,
      requiredDestinationIds,
      missingDestinationIds: missingIds,
      invalidDestinationIds: invalidIds,
      releasePlan,
      unresolvedReleaseChoices: unresolvedChoices,
      validationIssues,
      ...destinationCopy,
      channelUrl: platform.channelUrl,
      notes: platform.notes,
    };
  });
}

export function buildApprovalSnapshot({ platformConfig, manifest, assets, targets, warnings, catalogBinding }) {
  if (!isPlainObject(catalogBinding)) {
    throw new TypeError("A master catalog binding is required for every approval snapshot.");
  }
  return {
    schemaVersion: 4,
    brand: platformConfig.brand,
    rssFeed: platformConfig.rssFeed,
    catalogBinding,
    manifest,
    assets,
    targets,
    warnings,
  };
}

function displayBytes(bytes) {
  if (bytes == null) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function displayDuration(seconds) {
  if (!Number.isFinite(seconds)) return "-";
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function escapeTableCell(value) {
  return String(value ?? "-")
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replaceAll("\r", " ")
    .replaceAll("\n", " ");
}

function fencedText(value, language = "text") {
  const text = String(value);
  const longestRun = Math.max(0, ...[...text.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = "`".repeat(Math.max(3, longestRun + 1));
  return `${fence}${language}\n${text}\n${fence}`;
}

export function renderApprovalPacket(packet) {
  const manifest = packet.snapshot.manifest;
  const catalogBinding = packet.snapshot.catalogBinding;
  const catalogLines = catalogBinding
    ? [
        `- Revision: ${catalogBinding.revision}`,
        `- Catalog SHA-256: \`${catalogBinding.catalogHash}\``,
        `- Episode: ${catalogBinding.episodeNumber}`,
        `- Episode SHA-256: \`${catalogBinding.episodeHash}\``,
        "",
      ]
    : [];
  const assetLines = ASSET_KEYS
    .filter((key) => packet.snapshot.assets[key])
    .map((key) => {
      const asset = packet.snapshot.assets[key];
      return `| ${escapeTableCell(key)} | ${displayBytes(asset.sizeBytes)} | ${displayDuration(asset.media?.durationSeconds)} | ${escapeTableCell(asset.sha256)} | ${escapeTableCell(asset.path)} |`;
    });
  const targetLines = packet.snapshot.targets.map(
    (target) =>
      `| ${escapeTableCell(target.label)} | ${escapeTableCell(target.readiness)} | ${escapeTableCell(target.asset)} | ${escapeTableCell(target.copySource)} | ${escapeTableCell(target.validationIssues?.join("; ") || "-")} |`
  );
  const identityLines = packet.snapshot.targets.map(
    (target) =>
      `| ${escapeTableCell(target.label)} | ${escapeTableCell(target.destinationIds?.accountId)} | ${escapeTableCell(target.destinationIds?.containerId)} | ${escapeTableCell(target.missingDestinationIds?.join(", ") || "-")} | ${escapeTableCell(target.invalidDestinationIds?.join(", ") || "-")} |`
  );
  const releaseLines = packet.snapshot.targets
    .filter((target) => target.releasePlan)
    .map((target) => {
      const release = target.releasePlan;
      return `| ${escapeTableCell(target.label)} | ${escapeTableCell(release.releaseMode)} | ${escapeTableCell(release.initialVisibility)} | ${escapeTableCell(release.finalVisibility)} | ${escapeTableCell(release.license)} | ${escapeTableCell(release.monetization)} | ${escapeTableCell(release.notifications)} |`;
    });
  const flags = [
    `Explicit: ${manifest.explicit}`,
    `Made for kids: ${manifest.madeForKids}`,
    `Synthetic media: ${manifest.containsSyntheticMedia}`,
    `Paid promotion: ${manifest.paidPromotion}`,
  ].join(" | ");
  const warningLines = packet.snapshot.warnings.length
    ? packet.snapshot.warnings.map((warning) => fencedText(warning))
    : ["- None."];
  const copyBlocks = packet.snapshot.targets.map((target) => {
    const copy = target.approvedCopy == null ? "No destination copy supplied." : target.approvedCopy;
    return `### ${target.label}\n\n${fencedText(copy)}`;
  });
  const confirmation = `approve ${packet.id} ${packet.approvalHash}`;

  return [
    "# Publishing approval",
    "",
    "Local preparation only. No destination has been contacted and nothing has been uploaded.",
    "",
    `- Job: \`${packet.id}\``,
    `- Approval hash: \`${packet.approvalHash}\``,
    `- Episode number: ${manifest.episodeNumber ?? "not set"}`,
    `- Slug: ${manifest.slug}`,
    `- Category: ${manifest.category ?? "not set"}`,
    `- Publish time: ${manifest.publishAt || "not scheduled"}`,
    `- ${flags}`,
    `- Canonical RSS: ${packet.snapshot.rssFeed || "not set"}`,
    "",
    ...(catalogLines.length ? ["## Master catalog binding", "", ...catalogLines] : []),
    "## Assets",
    "",
    "| Role | Size | Duration | SHA-256 | Path |",
    "|---|---:|---:|---|---|",
    ...assetLines,
    "",
    "## Destinations",
    "",
    "| Destination | Readiness | Asset | Copy | Validation issues |",
    "|---|---|---|---|---|",
    ...targetLines,
    "",
    "## Destination identities",
    "",
    "| Destination | Account ID | Container ID | Missing required IDs | Invalid IDs |",
    "|---|---|---|---|---|",
    ...identityLines,
    "",
    "## Release controls",
    "",
    "| Destination | Mode | Initial visibility | Final visibility | License | Monetization | Notifications |",
    "|---|---|---|---|---|---|---|",
    ...releaseLines,
    "",
    "## Approved title",
    "",
    fencedText(manifest.title),
    "",
    "## Destination copy",
    "",
    ...copyBlocks.flatMap((block) => [block, ""]),
    "## Tags",
    "",
    fencedText(manifest.tags.join("\n") || "None"),
    "",
    "## Exact normalized manifest",
    "",
    fencedText(JSON.stringify(sortedValue(manifest), null, 2), "json"),
    "",
    "## Exact destination plan",
    "",
    fencedText(JSON.stringify(sortedValue(packet.snapshot.targets), null, 2), "json"),
    "",
    "## Warnings",
    "",
    ...warningLines,
    "",
    "## Record approval",
    "",
    "After reviewing the exact files, title, copy, flags, schedule, destination identities, release controls, and targets above, type the displayed confirmation phrase into this local command:",
    "",
    "```bash",
    `drm-publish approve ${packet.id} --hash ${packet.approvalHash} --by "Otto" --confirm "${confirmation}"`,
    "```",
    "",
    "This creates a self-reported local review attestation. It does not authenticate the reviewer and never authorizes upload or release.",
    "",
  ].join("\n");
}

export function packetIntegrityProblems(packet, expectedJobId) {
  const problems = [];
  if (!isPlainObject(packet)) return ["Stored packet must be a JSON object."];
  if (packet.id !== expectedJobId) problems.push("Stored packet job id does not match its directory.");
  if (!isPlainObject(packet.snapshot)) problems.push("Stored packet snapshot is missing or invalid.");
  if (isPlainObject(packet.snapshot) && packet.snapshot.schemaVersion !== 4) {
    problems.push("Stored packet snapshot schema version is unsupported.");
  }
  if (isPlainObject(packet.snapshot)) {
    const binding = packet.snapshot.catalogBinding;
    if (!isPlainObject(binding)) {
      problems.push("Stored packet master catalog binding is missing or invalid.");
    } else {
      if (!Number.isInteger(binding.revision) || binding.revision < 1) {
        problems.push("Stored packet master catalog revision is invalid.");
      }
      if (typeof binding.catalogHash !== "string" || !/^[a-f0-9]{64}$/.test(binding.catalogHash)) {
        problems.push("Stored packet master catalog hash is invalid.");
      }
      if (typeof binding.episodeHash !== "string" || !/^[a-f0-9]{64}$/.test(binding.episodeHash)) {
        problems.push("Stored packet master episode hash is invalid.");
      }
      if (
        !Number.isInteger(binding.episodeNumber) ||
        binding.episodeNumber < 1 ||
        binding.episodeNumber !== packet.snapshot.manifest?.episodeNumber
      ) {
        problems.push("Stored packet master episode number is invalid or does not match the manifest.");
      }
    }
  }
  if (typeof packet.approvalHash !== "string" || !/^[a-f0-9]{64}$/.test(packet.approvalHash)) {
    problems.push("Stored packet approval hash is missing or invalid.");
  }
  if (isPlainObject(packet.snapshot) && typeof packet.approvalHash === "string") {
    try {
      if (hashSnapshot(packet.snapshot) !== packet.approvalHash) {
        problems.push("Stored packet snapshot does not match its approval hash.");
      }
    } catch (error) {
      problems.push(`Stored packet snapshot cannot be hashed (${error.message}).`);
    }
  }
  return problems;
}

export function reviewDocumentProblems(packet, reviewDocument) {
  if (typeof reviewDocument !== "string") return ["Stored review document is missing or invalid."];
  const expected = renderApprovalPacket(packet);
  return reviewDocument === expected
    ? []
    : ["Stored review document does not match the integrity-checked packet."];
}

export function approvalRecordProblems(packet, approval, reviewDocument) {
  const problems = [];
  if (!isPlainObject(approval)) return ["Approval record must be a JSON object."];
  if (approval.schemaVersion !== 2) problems.push("Approval record schema version is invalid.");
  if (approval.jobId !== packet.id) problems.push("Approval record job id does not match the packet.");
  if (approval.approvalHash !== packet.approvalHash) problems.push("Approval record hash does not match the packet.");
  if (approval.reviewDocumentSha256 !== hashText(reviewDocument)) {
    problems.push("Approval record does not match the reviewed document.");
  }
  if (approval.attestationType !== "self-reported-local-review") {
    problems.push("Approval record attestation type is invalid.");
  }
  if (approval.authorizesUpload !== false || approval.authorizesRelease !== false) {
    problems.push("Approval record must not authorize upload or release.");
  }
  if (typeof approval.approvedBy !== "string" || !approval.approvedBy.trim()) {
    problems.push("Approval record reviewer attribution is missing.");
  }
  if (
    typeof approval.approvedAt !== "string" ||
    !RFC3339_WITH_TIMEZONE.test(approval.approvedAt) ||
    Number.isNaN(Date.parse(approval.approvedAt))
  ) {
    problems.push("Approval record timestamp is invalid.");
  }
  return problems;
}

async function writePrivateFile(filePath, value, { exclusive = false } = {}) {
  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
  await fs.writeFile(temporary, value, { mode: 0o600, flag: "wx" });
  try {
    if (exclusive) {
      await fs.link(temporary, filePath);
      await fs.rm(temporary);
    } else {
      await fs.rename(temporary, filePath);
    }
    await fs.chmod(filePath, 0o600);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    if (exclusive && error.code === "EEXIST") {
      throw new Error(`Refusing to overwrite existing file: ${filePath}`);
    }
    throw error;
  }
}

export async function writePrivateJson(filePath, value, { exclusive = false } = {}) {
  await writePrivateFile(filePath, `${JSON.stringify(value, null, 2)}\n`, { exclusive });
}

export async function writePrivateText(filePath, value, { exclusive = false } = {}) {
  await writePrivateFile(filePath, value, { exclusive });
}

export async function verifySnapshotAssets(snapshot) {
  const problems = [];
  for (const asset of Object.values(snapshot.assets)) {
    if (!asset) continue;
    try {
      const stats = await fs.stat(asset.path);
      if (stats.size !== asset.sizeBytes) {
        problems.push(`${asset.key} size changed: ${asset.path}`);
        continue;
      }
      const currentHash = await hashFile(asset.path);
      if (currentHash !== asset.sha256) problems.push(`${asset.key} SHA-256 changed: ${asset.path}`);
    } catch (error) {
      problems.push(`${asset.key} cannot be verified (${error.message}): ${asset.path}`);
    }
  }
  return problems;
}
