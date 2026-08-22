import fs from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { catalogHash } from "./catalog.mjs";

export const EPISODE_5_CONTENT_CORRECTION_SCHEMA_PATH = new URL(
  "../../publishing/episode-5-content-correction.schema.json",
  import.meta.url,
);

export const EPISODE_5_CONTENT_CORRECTION_ID =
  "episode-5-content-correction-2026-08-22";

export const EPISODE_5_CONTENT_CORRECTION_SOURCE = Object.freeze({
  uri: "dropbox:Dr.M Podcast/Episode 5 - Energy/Dr. M EP5 - Energy.mov",
  sha256: "3bc88051e125e1ba95a925101bc29a80b3c0a2498f50c086acc25be1c20d2073",
  sizeBytes: 8_757_256_750,
  mediaType: "video/quicktime",
  durationSeconds: 1785.685333,
});

export const EPISODE_5_CONTENT_CORRECTION_IDENTITIES = Object.freeze({
  number: 5,
  slug: "episode-5-energy",
  title: "Energy - Understanding Fatigue and Mitochondrial Health",
  rssGuid: "e9f7596f-0333-49ca-8946-bc11e96b2091",
  rssComEpisodeId: "3050762",
  appleEpisodeId: "1000774398633",
  spotifyEpisodeId: "6fQAClcR4AAuueHjBNlrJC",
  vimeoVideoId: "1204939658",
  rumbleVideoId: "v7bvj32",
  contaminatedYouTubeVideoIds: Object.freeze(["N_F0hhHkIQ4", "JyBK6KtOo_k"]),
});

const TARGETS = Object.freeze([
  "rssCom",
  "spotify",
  "youtube",
  "vimeo",
  "rumble",
  "apple",
  "supabase",
  "website",
]);

const schema = JSON.parse(
  await fs.readFile(EPISODE_5_CONTENT_CORRECTION_SCHEMA_PATH, "utf8"),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv, { mode: "full" });
const validateSchema = ajv.compile(schema);

function schemaPath(error) {
  const parts = error.instancePath
    .split("/")
    .filter(Boolean)
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
  if (error.keyword === "required") parts.push(error.params.missingProperty);
  if (error.keyword === "additionalProperties") {
    parts.push(error.params.additionalProperty);
  }
  return parts.join(".") || "receipt";
}

function timestamp(value) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

function identityUrlMatches(platform, id, value) {
  if (typeof id !== "string" || typeof value !== "string") return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (platform === "spotify") {
    return url.hostname === "open.spotify.com" && url.pathname === `/episode/${id}`;
  }
  if (platform === "youtube") {
    return (
      (url.hostname === "www.youtube.com" &&
        url.pathname === "/watch" &&
        url.searchParams.get("v") === id) ||
      (url.hostname === "youtu.be" && url.pathname === `/${id}`)
    );
  }
  if (platform === "vimeo") {
    return url.hostname === "vimeo.com" && url.pathname === `/${id}`;
  }
  if (platform === "rumble") {
    const page = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return (
      url.hostname === "rumble.com" &&
      (page === `${id}.html` || page.startsWith(`${id}-`))
    );
  }
  return true;
}

export function episode5ContentCorrectionCatalogErrors(receipt, catalog) {
  const errors = [];
  const expected = receipt?.episode;
  const episode = catalog?.episodes?.find(
    (candidate) => candidate?.number === EPISODE_5_CONTENT_CORRECTION_IDENTITIES.number,
  );
  if (!episode) return ["Master catalog is missing Episode 5."];

  if (
    receipt?.catalog?.currentRevision != null &&
    receipt.catalog.currentRevision !== catalog?.revision
  ) {
    errors.push("catalog.currentRevision does not match the current master catalog revision.");
  }
  if (
    receipt?.catalog?.publisherHash != null &&
    receipt.catalog.publisherHash !== catalogHash(catalog)
  ) {
    errors.push("catalog.publisherHash does not match the current master catalog.");
  }

  for (const field of ["number", "slug", "title", "rssGuid"]) {
    if (episode[field] !== expected?.[field]) {
      errors.push(`episode.${field} does not match master-catalog Episode 5.`);
    }
  }

  for (const [platform, receiptField] of [
    ["spotify", "spotifyEpisodeId"],
    ["vimeo", "vimeoVideoId"],
  ]) {
    if (episode.destinations?.[platform]?.id !== expected?.[receiptField]) {
      errors.push(
        `episode.${receiptField} does not match the stable master-catalog ${platform} identity.`,
      );
    }
  }

  const allowedRumbleIds = new Set([
    expected?.rumbleVideoId,
    receipt?.targets?.rumble?.replacementId,
  ]);
  if (!allowedRumbleIds.has(episode.destinations?.rumble?.id)) {
    errors.push(
      "Master-catalog Rumble identity must be the recorded pre-correction ID or verified replacement ID.",
    );
  }

  const catalogYouTubeIds = new Set([
    episode.destinations?.youtube?.id,
    ...(episode.destinationArchives ?? [])
      .filter((archive) => archive?.platform === "youtube")
      .map((archive) => archive.id),
  ]);
  for (const id of expected?.contaminatedYouTubeVideoIds ?? []) {
    if (!catalogYouTubeIds.has(id)) {
      errors.push(
        `episode.contaminatedYouTubeVideoIds contains ${id}, which is absent from Episode 5 active/archive identities.`,
      );
    }
  }

  for (const [targetName, assetId] of [
    ["rssCom", "episode-005-podcast-audio"],
    ["spotify", "episode-005-spotify-video"],
    ["youtube", "episode-005-master-video"],
    ["vimeo", "episode-005-master-video"],
    ["rumble", "episode-005-master-video"],
  ]) {
    const target = receipt?.targets?.[targetName];
    const asset = catalog?.assetRegistry?.[assetId];
    if (!asset) {
      errors.push(`Master catalog is missing required ${targetName} source asset ${assetId}.`);
      continue;
    }
    if (target?.source !== assetId) {
      errors.push(`targets.${targetName}.source must remain ${assetId}.`);
    }
    if (target?.sourceSha256 != null && target.sourceSha256 !== asset.sha256) {
      errors.push(`targets.${targetName}.sourceSha256 does not match ${assetId}.`);
    }
    if (target?.sourceSizeBytes != null && target.sourceSizeBytes !== asset.sizeBytes) {
      errors.push(`targets.${targetName}.sourceSizeBytes does not match ${assetId}.`);
    }
  }

  const rssCom = receipt?.targets?.rssCom;
  const apple = receipt?.targets?.apple;
  if (
    apple?.sourceSha256 != null &&
    rssCom?.sourceSha256 != null &&
    apple.sourceSha256 !== rssCom.sourceSha256
  ) {
    errors.push("targets.apple.sourceSha256 must match the RSS.com podcast-audio source.");
  }
  if (
    apple?.sourceSizeBytes != null &&
    rssCom?.sourceSizeBytes != null &&
    apple.sourceSizeBytes !== rssCom.sourceSizeBytes
  ) {
    errors.push("targets.apple.sourceSizeBytes must match the RSS.com podcast-audio source.");
  }

  return errors;
}

export function episode5ContentCorrectionSemanticErrors(receipt) {
  const errors = [];
  const recordedAt = timestamp(receipt?.recordedAt);
  const updatedAt = timestamp(receipt?.updatedAt);
  if (recordedAt !== null && updatedAt !== null && updatedAt < recordedAt) {
    errors.push("updatedAt must be on or after recordedAt.");
  }

  const currentRevision = receipt?.catalog?.currentRevision;
  const publisherHash = receipt?.catalog?.publisherHash;
  if ((currentRevision === null) !== (publisherHash === null)) {
    errors.push("catalog.currentRevision and catalog.publisherHash must be filled together.");
  }

  const declaredComplete = new Set(receipt?.completion?.verifiedComplete ?? []);
  const declaredPending = new Set(receipt?.completion?.pending ?? []);
  for (const targetName of TARGETS) {
    const target = receipt?.targets?.[targetName];
    const complete = target?.status === "complete_verified";
    if (complete !== declaredComplete.has(targetName)) {
      errors.push(
        `completion.verifiedComplete must ${complete ? "include" : "exclude"} ${targetName}.`,
      );
    }
    if (complete === declaredPending.has(targetName)) {
      errors.push(
        `completion.pending must ${complete ? "exclude" : "include"} ${targetName}.`,
      );
    }
  }

  if (receipt?.status === "complete_verified") {
    if (declaredPending.size !== 0) {
      errors.push("complete_verified status requires an empty completion.pending list.");
    }
    if (currentRevision === null || publisherHash === null) {
      errors.push("complete_verified status requires the final catalog revision and hash.");
    }
  } else if (declaredPending.size === 0) {
    errors.push("A non-complete receipt must retain at least one pending target.");
  }
  if (
    receipt?.status === "remote_propagation_partial" &&
    (declaredComplete.size === 0 || declaredPending.size === 0)
  ) {
    errors.push(
      "remote_propagation_partial status requires both verified and pending targets.",
    );
  }

  for (const name of ["rssCom", "spotify", "youtube", "vimeo", "rumble", "apple"]) {
    const target = receipt?.targets?.[name];
    if (target?.status === "complete_verified" && target.replacementId == null) {
      errors.push(`targets.${name}.replacementId is required when complete_verified.`);
    }
  }

  for (const name of ["rssCom", "spotify", "vimeo", "apple", "supabase"]) {
    const target = receipt?.targets?.[name];
    if (
      target?.status === "complete_verified" &&
      target.replacementId !== target.existingId
    ) {
      errors.push(`targets.${name} must preserve its existing stable ID.`);
    }
  }

  const youtube = receipt?.targets?.youtube;
  if (youtube?.replacementId != null) {
    if (
      EPISODE_5_CONTENT_CORRECTION_IDENTITIES.contaminatedYouTubeVideoIds.includes(
        youtube.replacementId,
      )
    ) {
      errors.push("targets.youtube replacementId must not reuse a contaminated upload.");
    }
    if (
      youtube.replacementUrl != null &&
      !identityUrlMatches("youtube", youtube.replacementId, youtube.replacementUrl)
    ) {
      errors.push("targets.youtube replacementUrl does not match replacementId.");
    }
  }

  for (const name of ["spotify", "vimeo", "rumble"]) {
    const target = receipt?.targets?.[name];
    if (
      target?.replacementId != null &&
      target.replacementUrl != null &&
      !identityUrlMatches(name, target.replacementId, target.replacementUrl)
    ) {
      errors.push(`targets.${name}.replacementUrl does not match replacementId.`);
    }
  }

  const vimeo = receipt?.targets?.vimeo;
  if (
    vimeo?.versionReadback != null &&
    vimeo.versionReadback.verifiedReceiptSha256 !== vimeo.evidenceSha256
  ) {
    errors.push(
      "targets.vimeo.versionReadback.verifiedReceiptSha256 must match targets.vimeo.evidenceSha256.",
    );
  }
  for (const name of TARGETS.filter((target) => target !== "vimeo")) {
    if (receipt?.targets?.[name]?.versionReadback != null) {
      errors.push(`targets.${name}.versionReadback is reserved for Vimeo evidence.`);
    }
  }

  const containment = receipt?.operationalEvidence?.websiteContainment;
  const finalProjectionPending = receipt?.targets?.website?.status !== "complete_verified";
  if (
    typeof containment?.finalProjectionPending === "boolean" &&
    containment.finalProjectionPending !== finalProjectionPending
  ) {
    errors.push(
      "operationalEvidence.websiteContainment.finalProjectionPending must match the website target state.",
    );
  }

  return [...new Set(errors)];
}

export function validateEpisode5ContentCorrection(receipt, options = {}) {
  const schemaValid = validateSchema(receipt);
  const errors = schemaValid
    ? []
    : (validateSchema.errors ?? []).map(
        (error) => `${schemaPath(error)} ${error.message}.`,
      );
  errors.push(...episode5ContentCorrectionSemanticErrors(receipt));
  if (options.catalog) {
    errors.push(...episode5ContentCorrectionCatalogErrors(receipt, options.catalog));
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
