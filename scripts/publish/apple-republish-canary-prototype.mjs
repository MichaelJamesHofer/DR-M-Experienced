import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import {
  buildAppleFeedOverlay,
  fetchAppleFeedSource,
  loadAppleFeedOverlayConfig,
  verifyAppleFeedEnclosures,
} from "./apple-feed-overlay.mjs";

export const APPLE_REPUBLISH_CANARY_CONFIG_PATH = new URL(
  "../../publishing/apple-republish-canary-prototype.json",
  import.meta.url,
);
export const APPLE_REPUBLISH_CANARY_SCHEMA_PATH = new URL(
  "../../publishing/apple-republish-canary-prototype.schema.json",
  import.meta.url,
);
export const APPLE_CANARY_DEPLOYMENT_STATE_PATH = new URL(
  "../../publishing/apple-canary-deployment-state.json",
  import.meta.url,
);
export const APPLE_CANARY_DEPLOYMENT_STATE_SCHEMA_PATH = new URL(
  "../../publishing/apple-canary-deployment-state.schema.json",
  import.meta.url,
);

export const APPLE_REPUBLISH_CANARY_PHASES = Object.freeze([
  "closed",
  "media_staged",
  "active",
  "contained",
]);

const REPOSITORY_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const DEFAULT_TIMEOUT_MS = 60_000;
const RANGE_HEADER = "bytes=0-4095";
const MAX_MEDIA_BYTES = 64 * 1024 * 1024;

const schema = JSON.parse(
  await fs.readFile(APPLE_REPUBLISH_CANARY_SCHEMA_PATH, "utf8"),
);
const stateSchema = JSON.parse(
  await fs.readFile(APPLE_CANARY_DEPLOYMENT_STATE_SCHEMA_PATH, "utf8"),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv, { mode: "full" });
const validateSchema = ajv.compile(schema);
const validateStateSchema = ajv.compile(stateSchema);

function schemaPath(error) {
  const parts = error.instancePath
    .split("/")
    .filter(Boolean)
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
  if (error.keyword === "required") parts.push(error.params.missingProperty);
  if (error.keyword === "additionalProperties") {
    parts.push(error.params.additionalProperty);
  }
  return parts.join(".") || "config";
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function uuidBytes(value) {
  const compact = value.replaceAll("-", "");
  if (!/^[0-9a-f]{32}$/.test(compact)) {
    throw new Error(`Invalid UUID: ${value}`);
  }
  return Buffer.from(compact, "hex");
}

export function uuidV5(namespace, name) {
  const digest = createHash("sha1")
    .update(uuidBytes(namespace))
    .update(name, "utf8")
    .digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function countOccurrences(value, needle) {
  if (!needle) return 0;
  let count = 0;
  let offset = 0;
  while (true) {
    const index = value.indexOf(needle, offset);
    if (index === -1) return count;
    count += 1;
    offset = index + needle.length;
  }
}

function replaceExactlyOnce(value, before, after, label) {
  const count = countOccurrences(value, before);
  if (count !== 1) {
    throw new Error(`${label} must occur exactly once; found ${count}.`);
  }
  return value.replace(before, after);
}

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function scalar(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "object") return scalar(value["#text"]);
  return String(value).trim();
}

export function parseAppleRepublishFeed(xml, label = "Apple canary feed") {
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    const detail = validation?.err?.msg ? `: ${validation.err.msg}` : "";
    throw new Error(`${label} is not valid XML${detail}`);
  }
  const document = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    processEntities: false,
    trimValues: true,
    isArray: (_name, jpath) => jpath === "rss.channel.item",
  }).parse(xml);
  const channel = document?.rss?.channel;
  if (!channel || typeof channel !== "object") {
    throw new Error(`${label} must contain one RSS channel.`);
  }
  const selfUrls = asArray(channel["atom:link"])
    .filter((entry) => entry?.["@_rel"] === "self")
    .map((entry) => scalar(entry?.["@_href"]));
  const episodes = asArray(channel.item).map((item) => ({
    episodeNumber: Number(scalar(item?.["itunes:episode"])),
    title: scalar(item?.title),
    link: scalar(item?.link),
    guid: scalar(item?.guid),
    enclosure: {
      url: scalar(item?.enclosure?.["@_url"]),
      length: Number(scalar(item?.enclosure?.["@_length"])),
      type: scalar(item?.enclosure?.["@_type"]),
    },
    itunesBlock: scalar(item?.["itunes:block"]),
  }));
  return { selfUrls, episodes };
}

function semanticErrors(config) {
  const errors = [];
  const canary = config?.canary;
  if (!canary) return errors;

  const computedGuid = uuidV5(
    canary.candidateGuid.namespace,
    canary.candidateGuid.name,
  );
  if (computedGuid !== canary.candidateGuid.value) {
    errors.push("canary.candidateGuid.value must match its recorded UUIDv5 derivation");
  }
  const occupiedGuids = new Set([
    canary.canonicalGuid,
    canary.activeAppleGuid,
  ]);
  if (occupiedGuids.has(canary.candidateGuid.value)) {
    errors.push("canary candidate GUID must be distinct from canonical and active Apple GUIDs");
  }
  if (canary.sourceEnclosure.url === canary.candidateEnclosure.url) {
    errors.push("canary candidate enclosure URL must differ from the source enclosure URL");
  }
  if (
    canary.sourceEnclosure.length !== canary.candidateEnclosure.length ||
    canary.sourceEnclosure.mediaType !== canary.candidateEnclosure.mediaType ||
    canary.sourceEnclosure.sha256 !== canary.candidateEnclosure.sha256
  ) {
    errors.push("canary source and candidate enclosure bytes must have identical pinned identity");
  }

  const candidateUrl = new URL(canary.candidateEnclosure.url);
  const expectedRelativePath = candidateUrl.pathname.replace(/^\//, "");
  if (expectedRelativePath !== config.artifactLayout.mediaRelativePath) {
    errors.push("candidate enclosure URL path must match artifactLayout.mediaRelativePath");
  }
  if (
    candidateUrl.origin !== "https://drmexperienced.com" ||
    candidateUrl.search !== "" ||
    candidateUrl.hash !== ""
  ) {
    errors.push("candidate enclosure must be a query-free HTTPS drmexperienced.com URL");
  }
  const hashPrefix = canary.sourceEnclosure.sha256.slice(0, 16);
  if (!path.basename(candidateUrl.pathname).includes(hashPrefix)) {
    errors.push("candidate enclosure filename must include the pinned content hash prefix");
  }
  if (
    config.validationEvidence.sourceFullDownloadByteCount !==
      canary.sourceEnclosure.length ||
    config.validationEvidence.sourceFullDownloadSha256 !==
      canary.sourceEnclosure.sha256
  ) {
    errors.push("validation evidence must match the pinned source enclosure identity");
  }
  if (
    config.reversalGates.preActivation.restoreGuid !== canary.activeAppleGuid ||
    config.reversalGates.preActivation.restoreEnclosureUrl !== canary.sourceEnclosure.url
  ) {
    errors.push("reversal gates must restore the active Apple GUID and source enclosure");
  }
  return errors;
}

export function validateAppleRepublishCanaryConfig(config) {
  const valid = validateSchema(config);
  const errors = valid
    ? []
    : validateSchema.errors.map(
        (error) => `${schemaPath(error)} ${error.message}`,
      );
  if (valid) errors.push(...semanticErrors(config));
  return { valid: errors.length === 0, errors };
}

async function readPinnedJson(relativePath, expectedSha256, label) {
  const resolved = path.resolve(REPOSITORY_ROOT, relativePath);
  const relative = path.relative(REPOSITORY_ROOT, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} path escaped the repository.`);
  }
  const source = await fs.readFile(resolved, "utf8");
  const observedSha256 = sha256(source);
  if (observedSha256 !== expectedSha256) {
    throw new Error(
      `${label} SHA-256 drifted; expected ${expectedSha256}, found ${observedSha256}.`,
    );
  }
  return { path: resolved, source, value: JSON.parse(source) };
}

async function readPinnedText(relativePath, expectedSha256, label) {
  const resolved = path.resolve(REPOSITORY_ROOT, relativePath);
  const relative = path.relative(REPOSITORY_ROOT, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} path escaped the repository.`);
  }
  const stat = await fs.lstat(resolved).catch(() => null);
  if (!stat?.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file.`);
  }
  const source = await fs.readFile(resolved, "utf8");
  const observedSha256 = sha256(source);
  if (observedSha256 !== expectedSha256) {
    throw new Error(
      `${label} SHA-256 drifted; expected ${expectedSha256}, found ${observedSha256}.`,
    );
  }
  return { path: resolved, source };
}

function assertAuthorityBindings(config, activeConfig) {
  if (
    config.sourceFeedUrl !== activeConfig.sourceFeedUrl ||
    config.catalogRevision !== activeConfig.catalogRevision ||
    config.appleShowId !== activeConfig.appleShowId ||
    config.appleContentProviderId !== activeConfig.appleContentProviderId
  ) {
    throw new Error("Canary config drifted from the active Apple overlay authority.");
  }
  const activeMapping = activeConfig.guidMappings.filter(
    (mapping) => mapping.episodeNumber === config.canary.episodeNumber,
  );
  if (
    activeMapping.length !== 1 ||
    activeMapping[0].sourceGuid !== config.canary.canonicalGuid ||
    activeMapping[0].appleGuid !== config.canary.activeAppleGuid
  ) {
    throw new Error("Active Apple overlay no longer has the expected Episode 1 mapping.");
  }
  const allActiveGuids = new Set([
    ...activeConfig.guidMappings.flatMap((mapping) => [
      mapping.sourceGuid,
      mapping.appleGuid,
    ]),
    ...activeConfig.preservedGuidAssertions.map((entry) => entry.guid),
  ]);
  if (allActiveGuids.has(config.canary.candidateGuid.value)) {
    throw new Error("Canary GUID collides with an active Apple overlay identity.");
  }
  if (
    activeConfig.outputPath.replace(/^out\//, "") !==
    config.artifactLayout.feedRelativePath
  ) {
    throw new Error("Canary feed artifact path drifted from the active overlay path.");
  }
}

function canonicalSourceFromActiveOverlay(activeXml, activeConfig) {
  let source = replaceExactlyOnce(
    activeXml,
    activeConfig.publicFeedUrl,
    activeConfig.sourceSelfUrl,
    "Sealed Apple overlay self URL",
  );
  for (const mapping of activeConfig.guidMappings) {
    source = replaceExactlyOnce(
      source,
      mapping.appleGuid,
      mapping.sourceGuid,
      `Sealed Episode ${mapping.episodeNumber} Apple GUID`,
    );
  }
  return source;
}

function addEpisodeOneContainment(candidateXml, config) {
  const itemPattern = /<item(?:\s[^>]*)?>[\s\S]*?<\/item>/g;
  const matches = [...candidateXml.matchAll(itemPattern)].filter((match) =>
    match[0].includes(config.canary.candidateGuid.value),
  );
  if (matches.length !== 1) {
    throw new Error(`Candidate feed must contain exactly one Episode 1 item; found ${matches.length}.`);
  }
  const before = matches[0][0];
  if (/<itunes:block(?:\s[^>]*)?>/i.test(before)) {
    throw new Error("Candidate Episode 1 already contains an iTunes block element.");
  }
  const after = replaceExactlyOnce(
    before,
    "</item>",
    "<itunes:block>yes</itunes:block></item>",
    "Candidate Episode 1 closing item tag",
  );
  return (
    candidateXml.slice(0, matches[0].index) +
    after +
    candidateXml.slice(matches[0].index + before.length)
  );
}

async function loadSealedFeedSnapshots(deploymentState, config, activeConfig) {
  const records = deploymentState.sealedFeedSnapshots;
  if (
    records.storageEncoding !==
    "utf8_with_one_terminal_lf_removed_before_publish"
  ) {
    throw new Error("Unsupported sealed Apple feed snapshot storage encoding.");
  }
  const sealedFeeds = {};
  for (const name of ["historical", "active", "contained"]) {
    const record = records[name];
    const stored = await readPinnedText(
      record.path,
      record.storedSha256,
      `Sealed Apple ${name} feed snapshot`,
    );
    if (!stored.source.endsWith("\n") || stored.source.endsWith("\n\n")) {
      throw new Error(`Sealed Apple ${name} feed snapshot must contain exactly one storage LF.`);
    }
    const xml = stored.source.slice(0, -1);
    if (sha256(xml) !== record.publishedSha256) {
      throw new Error(`Sealed Apple ${name} published SHA-256 drifted.`);
    }
    parseAppleRepublishFeed(xml, `Sealed Apple ${name} feed snapshot`);
    sealedFeeds[name] = xml;
  }

  const canonicalSource = canonicalSourceFromActiveOverlay(
    sealedFeeds.historical,
    activeConfig,
  );
  const expectedActive = buildAppleRepublishCanaryOverlay(
    canonicalSource,
    activeConfig,
    config,
  );
  if (expectedActive.activeOverlayXml !== sealedFeeds.historical) {
    throw new Error("Sealed historical feed is not the byte-exact active Apple overlay.");
  }
  if (expectedActive.xml !== sealedFeeds.active) {
    throw new Error("Sealed active feed is not the exact two-field Episode 1 transition.");
  }
  if (addEpisodeOneContainment(sealedFeeds.active, config) !== sealedFeeds.contained) {
    throw new Error("Sealed contained feed is not the exact Episode 1 containment transition.");
  }
  return sealedFeeds;
}

export async function loadAppleRepublishCanaryAuthorities(
  configPath = APPLE_REPUBLISH_CANARY_CONFIG_PATH,
  deploymentStatePath = APPLE_CANARY_DEPLOYMENT_STATE_PATH,
) {
  const config = JSON.parse(await fs.readFile(configPath, "utf8"));
  const result = validateAppleRepublishCanaryConfig(config);
  if (!result.valid) {
    throw new Error(
      `Apple republish canary config is invalid:\n${result.errors
        .map((error) => `- ${error}`)
        .join("\n")}`,
    );
  }
  const deploymentState = JSON.parse(
    await fs.readFile(deploymentStatePath, "utf8"),
  );
  const validState = validateStateSchema(deploymentState);
  if (!validState) {
    throw new Error(
      `Apple canary deployment state is invalid:\n${validateStateSchema.errors
        .map((error) => `- ${schemaPath(error)} ${error.message}`)
        .join("\n")}`,
    );
  }
  if (
    JSON.stringify(deploymentState.orderedPhases) !==
      JSON.stringify(APPLE_REPUBLISH_CANARY_PHASES) ||
    !APPLE_REPUBLISH_CANARY_PHASES.includes(deploymentState.phase)
  ) {
    throw new Error("Apple deployment state must use the fail-closed four-phase order.");
  }
  if (deploymentState.transitionAuthorization.approvedTargetPhase !== deploymentState.phase) {
    throw new Error("Apple deployment phase lacks matching transition authorization.");
  }
  if (deploymentState.phase === "closed") {
    if (deploymentState.sealedMediaAsset.path !== null) {
      throw new Error("Closed Apple deployment state must not register a sealed media asset.");
    }
  } else if (
    deploymentState.sealedMediaAsset.path === null ||
    !deploymentState.transitionAuthorization.recordedAt ||
    !deploymentState.transitionAuthorization.authorizedBy
  ) {
    throw new Error("Open Apple canary phases require a sealed media asset and attended authorization record.");
  }
  const activeSource = await readPinnedJson(
    config.activeOverlayConfigPath,
    config.activeOverlayConfigSha256,
    "Active Apple overlay config",
  );
  const activeConfig = await loadAppleFeedOverlayConfig(activeSource.path);
  assertAuthorityBindings(config, activeConfig);
  const sealedFeeds = await loadSealedFeedSnapshots(
    deploymentState,
    config,
    activeConfig,
  );
  return {
    config,
    activeConfig,
    deploymentState,
    sealedFeeds,
  };
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

export function buildAppleRepublishCanaryOverlay(
  sourceXml,
  activeConfig,
  config,
) {
  const validation = validateAppleRepublishCanaryConfig(config);
  if (!validation.valid) {
    throw new Error(
      `Apple republish canary config is invalid:\n${validation.errors
        .map((error) => `- ${error}`)
        .join("\n")}`,
    );
  }
  const active = buildAppleFeedOverlay(sourceXml, activeConfig);
  const activeFeed = parseAppleRepublishFeed(active.xml, "Active Apple overlay");
  const activeCanaries = activeFeed.episodes.filter(
    (episode) => episode.episodeNumber === config.canary.episodeNumber,
  );
  if (activeCanaries.length !== 1) {
    throw new Error("Active Apple overlay must contain exactly one Episode 1 item.");
  }
  const activeCanary = activeCanaries[0];
  for (const [label, actual, expected] of [
    ["title", activeCanary.title, config.canary.title],
    ["link", activeCanary.link, config.canary.link],
    ["GUID", activeCanary.guid, config.canary.activeAppleGuid],
    ["enclosure URL", activeCanary.enclosure.url, config.canary.sourceEnclosure.url],
    ["enclosure length", activeCanary.enclosure.length, config.canary.sourceEnclosure.length],
    ["enclosure type", activeCanary.enclosure.type, config.canary.sourceEnclosure.mediaType],
  ]) {
    if (actual !== expected) {
      throw new Error(`Active Episode 1 ${label} drifted from the canary authority.`);
    }
  }
  if (countOccurrences(active.xml, config.canary.candidateGuid.value) !== 0) {
    throw new Error("Canary GUID already occurs in the active Apple overlay.");
  }
  if (countOccurrences(active.xml, config.canary.candidateEnclosure.url) !== 0) {
    throw new Error("Canary enclosure URL already occurs in the active Apple overlay.");
  }

  let xml = replaceExactlyOnce(
    active.xml,
    config.canary.activeAppleGuid,
    config.canary.candidateGuid.value,
    "Active Episode 1 Apple GUID",
  );
  xml = replaceExactlyOnce(
    xml,
    config.canary.sourceEnclosure.url,
    config.canary.candidateEnclosure.url,
    "Active Episode 1 enclosure URL",
  );

  let restored = replaceExactlyOnce(
    xml,
    config.canary.candidateEnclosure.url,
    config.reversalGates.preActivation.restoreEnclosureUrl,
    "Canary Episode 1 enclosure URL",
  );
  restored = replaceExactlyOnce(
    restored,
    config.canary.candidateGuid.value,
    config.reversalGates.preActivation.restoreGuid,
    "Canary Episode 1 GUID",
  );
  if (restored !== active.xml) {
    throw new Error("Canary reversal did not restore the active Apple overlay byte-for-byte.");
  }

  const output = parseAppleRepublishFeed(xml, "Apple republish canary overlay");
  if (
    output.selfUrls.length !== 1 ||
    output.selfUrls[0] !== activeConfig.publicFeedUrl
  ) {
    throw new Error("Canary overlay changed the active Apple feed self URL.");
  }
  if (output.episodes.length !== activeFeed.episodes.length) {
    throw new Error("Canary overlay changed the Apple feed episode count.");
  }
  const outputCanary = output.episodes.find(
    (episode) => episode.episodeNumber === config.canary.episodeNumber,
  );
  if (
    outputCanary?.guid !== config.canary.candidateGuid.value ||
    outputCanary?.enclosure.url !== config.canary.candidateEnclosure.url
  ) {
    throw new Error("Canary overlay did not project the exact Episode 1 candidate identity.");
  }
  for (let index = 0; index < output.episodes.length; index += 1) {
    const before = activeFeed.episodes[index];
    const after = output.episodes[index];
    if (before.episodeNumber !== after.episodeNumber) {
      throw new Error("Canary overlay changed episode order.");
    }
    if (after.episodeNumber === config.canary.episodeNumber) continue;
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      throw new Error(`Canary overlay changed Episode ${after.episodeNumber}.`);
    }
  }
  if (duplicateValues(output.episodes.map((episode) => episode.guid)).length) {
    throw new Error("Canary overlay contains duplicate GUIDs.");
  }
  if (
    duplicateValues(output.episodes.map((episode) => episode.enclosure.url)).length
  ) {
    throw new Error("Canary overlay contains duplicate enclosure URLs.");
  }

  return {
    xml,
    episodes: output.episodes,
    activeOverlayXml: active.xml,
    report: {
      sourceSha256: active.report.sourceSha256,
      activeOverlaySha256: sha256(active.xml),
      candidateOverlaySha256: sha256(xml),
      episodeCount: output.episodes.length,
      canaryEpisodeNumber: config.canary.episodeNumber,
      canaryGuid: config.canary.candidateGuid.value,
      canaryEnclosureUrl: config.canary.candidateEnclosure.url,
      changedEpisodeCount: 1,
      changedFieldCount: 2,
      activeOverlayRestoredByteExactly: true,
      canonicalSourceMutated: false,
    },
  };
}

export function buildAppleRepublishCanaryPhaseOverlay(
  sourceXml,
  activeConfig,
  config,
  phase = "active",
) {
  if (!APPLE_REPUBLISH_CANARY_PHASES.includes(phase)) {
    throw new Error(`Unknown Apple republish canary phase: ${phase}`);
  }
  if (phase === "closed" || phase === "media_staged") {
    const active = buildAppleFeedOverlay(sourceXml, activeConfig);
    const parsed = parseAppleRepublishFeed(active.xml, `Apple ${phase} feed`);
    const canaries = parsed.episodes.filter(
      (episode) => episode.episodeNumber === config.canary.episodeNumber,
    );
    if (
      canaries.length !== 1 ||
      canaries[0].guid !== config.canary.activeAppleGuid ||
      canaries[0].enclosure.url !== config.canary.sourceEnclosure.url ||
      canaries[0].itunesBlock !== null
    ) {
      throw new Error(`Apple ${phase} phase must retain the exact historical Episode 1 identity.`);
    }
    if (
      active.xml.includes(config.canary.candidateGuid.value) ||
      active.xml.includes(config.canary.candidateEnclosure.url)
    ) {
      throw new Error(`Apple ${phase} phase leaked the candidate Episode 1 identity.`);
    }
    return {
      xml: active.xml,
      episodes: parsed.episodes,
      activeOverlayXml: active.xml,
      report: {
        sourceSha256: active.report.sourceSha256,
        activeOverlaySha256: active.report.outputSha256,
        candidateOverlaySha256: null,
        outputSha256: active.report.outputSha256,
        episodeCount: parsed.episodes.length,
        canaryEpisodeNumber: config.canary.episodeNumber,
        canaryGuid: config.canary.activeAppleGuid,
        canaryEnclosureUrl: config.canary.sourceEnclosure.url,
        phase,
        changedEpisodeCount: 0,
        changedFieldCount: 0,
        canonicalSourceMutated: false,
      },
    };
  }

  const active = buildAppleRepublishCanaryOverlay(
    sourceXml,
    activeConfig,
    config,
  );
  if (phase === "active") {
    return {
      ...active,
      report: {
        ...active.report,
        outputSha256: active.report.candidateOverlaySha256,
        phase,
      },
    };
  }

  const xml = addEpisodeOneContainment(active.xml, config);
  const output = parseAppleRepublishFeed(xml, "Apple contained canary overlay");
  const beforeByNumber = new Map(
    active.episodes.map((episode) => [episode.episodeNumber, episode]),
  );
  for (const episode of output.episodes) {
    const before = beforeByNumber.get(episode.episodeNumber);
    if (!before) throw new Error("Contained overlay changed the episode set.");
    if (episode.episodeNumber === config.canary.episodeNumber) {
      if (
        episode.guid !== before.guid ||
        JSON.stringify(episode.enclosure) !== JSON.stringify(before.enclosure) ||
        before.itunesBlock !== null ||
        episode.itunesBlock !== "yes"
      ) {
        throw new Error("Contained overlay changed Episode 1 outside iTunes block state.");
      }
    } else if (JSON.stringify(episode) !== JSON.stringify(before)) {
      throw new Error(`Contained overlay changed Episode ${episode.episodeNumber}.`);
    }
  }
  const uncontained = replaceExactlyOnce(
    xml,
    "<itunes:block>yes</itunes:block>",
    "",
    "Contained Episode 1 iTunes block",
  );
  if (uncontained !== active.xml) {
    throw new Error("Contained overlay does not reverse byte-exactly to the active canary feed.");
  }
  return {
    ...active,
    xml,
    episodes: output.episodes,
    report: {
      ...active.report,
      candidateOverlaySha256: sha256(xml),
      outputSha256: sha256(xml),
      phase,
      changedEpisodeCount: 1,
      changedFieldCount: 3,
      transitionChangedEpisodeCount: 1,
      transitionChangedFieldCount: 1,
      activeCanaryRestoredByteExactly: true,
    },
  };
}

function assertExpectedSourceMediaFinalUrl(response, sourceUrl) {
  if (!response.url) {
    throw new Error("Episode 1 source media response did not expose its final URL.");
  }
  const source = new URL(sourceUrl);
  const final = new URL(response.url);
  const expectedPath = source.pathname.replace(
    /^\/episodes\/397420\/3050766/,
    "",
  );
  if (
    final.protocol !== "https:" ||
    final.hostname !== "rsscom.pdn.tritondigital.com" ||
    final.pathname !== expectedPath ||
    final.searchParams.get("episode_id") !== "3050766" ||
    final.searchParams.get("show_id") !== "397420"
  ) {
    throw new Error("Episode 1 source media redirected outside its pinned RSS.com delivery identity.");
  }
}

function assertMediaHeaders(response, enclosure, { range = false } = {}) {
  const contentType = response.headers.get("content-type")?.split(";")[0];
  if (contentType !== enclosure.mediaType) {
    throw new Error(`Episode 1 source media returned ${contentType || "no content type"}.`);
  }
  if (range) {
    const expectedRange = `bytes 0-4095/${enclosure.length}`;
    if (response.status !== 206 || response.headers.get("content-range") !== expectedRange) {
      throw new Error("Episode 1 source media did not honor the exact range probe.");
    }
  } else {
    if (response.status !== 200) {
      throw new Error(`Episode 1 source media returned HTTP ${response.status}.`);
    }
    if (response.headers.get("content-length") !== String(enclosure.length)) {
      throw new Error("Episode 1 source media content length drifted.");
    }
  }
}

export async function verifyEpisodeOneSourceRange(
  config,
  { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {},
) {
  const enclosure = config.canary.sourceEnclosure;
  const response = await fetchImpl(enclosure.url, {
    redirect: "follow",
    headers: {
      Accept: enclosure.mediaType,
      "Accept-Encoding": "identity",
      Range: RANGE_HEADER,
      "User-Agent": "DrMAppleRepublishCanaryPrototype/1.0",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  assertExpectedSourceMediaFinalUrl(response, enclosure.url);
  assertMediaHeaders(response, enclosure, { range: true });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (
    bytes.length !== config.validationEvidence.rangeProbeByteCount ||
    sha256(bytes) !== config.validationEvidence.rangeProbeSha256
  ) {
    throw new Error("Episode 1 source range bytes drifted from validation evidence.");
  }
  return {
    status: response.status,
    bytes: bytes.length,
    sha256: sha256(bytes),
    finalUrl: response.url,
  };
}

async function hashRegularFile(filePath) {
  const stat = await fs.lstat(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`Expected a regular file at ${filePath}.`);
  }
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
    bytes += chunk.length;
  }
  return { bytes, sha256: hash.digest("hex") };
}

async function exactExistingMedia(filePath, enclosure) {
  try {
    const identity = await hashRegularFile(filePath);
    if (
      identity.bytes !== enclosure.length ||
      identity.sha256 !== enclosure.sha256
    ) {
      throw new Error("Existing immutable canary media has different bytes; refusing overwrite.");
    }
    return identity;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export async function writeAll(handle, buffer) {
  let offset = 0;
  while (offset < buffer.length) {
    const { bytesWritten } = await handle.write(
      buffer,
      offset,
      buffer.length - offset,
      null,
    );
    if (!Number.isInteger(bytesWritten) || bytesWritten < 1) {
      throw new Error("Episode 1 media staging made no filesystem write progress.");
    }
    offset += bytesWritten;
  }
}

async function removeInstalledLinkIfOwned(destinationPath, temporaryPath) {
  const [destination, temporary] = await Promise.all([
    fs.lstat(destinationPath).catch(() => null),
    fs.lstat(temporaryPath).catch(() => null),
  ]);
  if (
    destination?.isFile() &&
    temporary?.isFile() &&
    destination.dev === temporary.dev &&
    destination.ino === temporary.ino
  ) {
    await fs.rm(destinationPath, { force: true }).catch(() => undefined);
  }
}

export async function stageEpisodeOneCanaryMedia(
  config,
  destinationPath,
  { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {},
) {
  const source = config.canary.sourceEnclosure;
  const candidate = config.canary.candidateEnclosure;
  const existing = await exactExistingMedia(destinationPath, candidate);
  if (existing) return { ...existing, reused: true };

  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  const lockPath = `${destinationPath}.lock`;
  const temporaryPath = `${destinationPath}.${process.pid}.${randomUUID()}.tmp`;
  let lock = null;
  let output = null;
  let installedByThisRun = false;
  let installedAndVerified = false;
  try {
    lock = await fs.open(lockPath, "wx", 0o600);
    const raced = await exactExistingMedia(destinationPath, candidate);
    if (raced) return { ...raced, reused: true };

    const response = await fetchImpl(source.url, {
      redirect: "follow",
      headers: {
        Accept: source.mediaType,
        "Accept-Encoding": "identity",
        "User-Agent": "DrMAppleRepublishCanaryPrototype/1.0",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    assertExpectedSourceMediaFinalUrl(response, source.url);
    assertMediaHeaders(response, source);
    if (!response.body) throw new Error("Episode 1 source media returned no body.");

    output = await fs.open(temporaryPath, "wx", 0o644);
    const hash = createHash("sha256");
    let bytes = 0;
    for await (const chunk of response.body) {
      const buffer = Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > MAX_MEDIA_BYTES || bytes > source.length) {
        throw new Error("Episode 1 source media exceeded its pinned byte length.");
      }
      hash.update(buffer);
      await writeAll(output, buffer);
    }
    const digest = hash.digest("hex");
    if (bytes !== source.length || digest !== source.sha256) {
      throw new Error(
        `Episode 1 source media identity mismatch; expected ${source.length}/${source.sha256}, found ${bytes}/${digest}.`,
      );
    }
    await output.sync();
    await output.close();
    output = null;
    if (await exactExistingMedia(destinationPath, candidate)) {
      throw new Error("Immutable canary media appeared during staging; refusing replacement.");
    }
    await fs.link(temporaryPath, destinationPath);
    installedByThisRun = true;
    const installed = await hashRegularFile(destinationPath);
    if (installed.bytes !== candidate.length || installed.sha256 !== candidate.sha256) {
      throw new Error("Installed canary media failed its post-link identity check.");
    }
    installedAndVerified = true;
    return { ...installed, reused: false };
  } finally {
    await output?.close().catch(() => undefined);
    if (installedByThisRun && !installedAndVerified) {
      await removeInstalledLinkIfOwned(destinationPath, temporaryPath);
    }
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    if (lock) {
      await lock.close().catch(() => undefined);
      await fs.rm(lockPath, { force: true }).catch(() => undefined);
    }
  }
}

async function assertBuiltArtifactRoot(rootPath, config) {
  const resolved = path.resolve(rootPath);
  const productionRoot = path.resolve(
    REPOSITORY_ROOT,
    config.artifactLayout.productionArtifactRoot,
  );
  if (
    config.remoteActionGates.prototypeArtifactMayDeploy === false &&
    (resolved === productionRoot || resolved.startsWith(`${productionRoot}${path.sep}`))
  ) {
    throw new Error("Prototype gate forbids writing the repository production artifact.");
  }
  const canonicalRoot = await fs.realpath(resolved).catch(() => null);
  if (!canonicalRoot || canonicalRoot !== resolved) {
    throw new Error(
      "Prototype artifact root must be an existing symlink-free canonical directory.",
    );
  }
  const canonicalProductionRoot =
    (await fs.realpath(productionRoot).catch(() => null)) ?? productionRoot;
  if (
    config.remoteActionGates.prototypeArtifactMayDeploy === false &&
    (canonicalRoot === canonicalProductionRoot ||
      canonicalRoot.startsWith(`${canonicalProductionRoot}${path.sep}`))
  ) {
    throw new Error("Prototype gate forbids writing the repository production artifact.");
  }
  for (const sentinel of config.artifactLayout.requiredBuiltSiteSentinels) {
    const sentinelPath = path.join(resolved, sentinel);
    const stat = await fs.lstat(sentinelPath).catch(() => null);
    if (!stat?.isFile() || stat.isSymbolicLink()) {
      throw new Error(`Prototype artifact root is missing regular build sentinel ${sentinel}.`);
    }
  }
  const pending = [canonicalRoot];
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) {
        throw new Error("Prototype artifact root must not contain symlinks.");
      }
      if (entry.isDirectory()) pending.push(path.join(directory, entry.name));
    }
  }
  return canonicalRoot;
}

async function writeAtomicText(filePath, contents) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, contents, { encoding: "utf8", mode: 0o644 });
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function generateAppleRepublishCanaryPrototype({
  artifactRoot,
  allowLocalPrototype = false,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  cacheBust = `${Date.now()}`,
} = {}) {
  if (!allowLocalPrototype) {
    throw new Error("Canary generation requires explicit local-prototype acknowledgment.");
  }
  if (!artifactRoot) {
    throw new Error("Canary generation requires an explicit built-site artifact root.");
  }
  const authorities = await loadAppleRepublishCanaryAuthorities();
  const { config, activeConfig } = authorities;
  const root = await assertBuiltArtifactRoot(artifactRoot, config);
  const source = await fetchAppleFeedSource(config.sourceFeedUrl, {
    fetchImpl,
    timeoutMs,
    cacheBust,
  });
  const overlay = buildAppleRepublishCanaryOverlay(
    source.xml,
    activeConfig,
    config,
  );
  await verifyEpisodeOneSourceRange(config, { fetchImpl, timeoutMs });

  const mediaPath = path.resolve(root, config.artifactLayout.mediaRelativePath);
  const feedPath = path.resolve(root, config.artifactLayout.feedRelativePath);
  for (const target of [mediaPath, feedPath]) {
    const relative = path.relative(root, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Canary artifact path escaped the built-site root.");
    }
  }
  const media = await stageEpisodeOneCanaryMedia(config, mediaPath, {
    fetchImpl,
    timeoutMs,
  });
  await verifyAppleFeedEnclosures(overlay.episodes, {
    fetchImpl: async (url, options) => {
      if (String(url) === config.canary.candidateEnclosure.url) {
        const bytes = await fs.readFile(mediaPath);
        const requestedRange = options?.headers?.Range;
        if (requestedRange !== "bytes=0-0") {
          return new Response("unsupported range", { status: 416 });
        }
        return new Response(bytes.subarray(0, 1), {
          status: 206,
          headers: {
            "content-length": "1",
            "content-range": `bytes 0-0/${bytes.length}`,
            "content-type": config.canary.candidateEnclosure.mediaType,
          },
        });
      }
      return fetchImpl(url, options);
    },
    timeoutMs,
    maxAttempts: activeConfig.mediaVerification.maxAttempts,
    retryDelayMs: activeConfig.mediaVerification.retryDelayMs,
  });
  await writeAtomicText(feedPath, overlay.xml);

  return {
    ...overlay.report,
    sourceHttpStatus: source.response.status,
    mediaBytes: media.bytes,
    mediaSha256: media.sha256,
    mediaReused: media.reused,
    artifactRoot: root,
    feedPath,
    mediaPath,
    prototypeOnly: true,
    deploymentAuthorized: false,
  };
}

function cliArgument(name) {
  const prefix = `${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(
    prefix.length,
  );
}

const invokedPath = process.argv[1];
if (invokedPath && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  const artifactRoot = cliArgument("--artifact-root");
  const acknowledged = process.argv.includes("--local-prototype-only");
  try {
    const report = await generateAppleRepublishCanaryPrototype({
      artifactRoot,
      allowLocalPrototype: acknowledged,
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`apple-republish-canary-prototype: ${error.message}\n`);
    process.exitCode = 1;
  }
}
