import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import { XMLValidator } from "fast-xml-parser";
import { loadAppleRepublishCanaryAuthorities } from "./apple-republish-canary-prototype.mjs";

const RELEASE_PATH = new URL("../../publishing/apple-show-name-md-v1.json", import.meta.url);
const SCHEMA_PATH = new URL("../../publishing/apple-show-name-md-v1.schema.json", import.meta.url);
const CATALOG_PATH = new URL("../../publishing/master-catalog.json", import.meta.url);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function replaceOnce(value, before, after, label) {
  const start = value.indexOf(before);
  if (start < 0 || value.indexOf(before, start + before.length) >= 0) {
    throw new Error(`Apple show-name ${label} must occur exactly once.`);
  }
  return value.slice(0, start) + after + value.slice(start + before.length);
}

export function projectAppleShowNameMd(baseXml, release, snapshotName, { verifyTargetHash = true } = {}) {
  if (!Object.hasOwn(release.baseFeedSha256BySnapshot, snapshotName)) {
    throw new Error("Apple show-name projection requires a known sealed snapshot.");
  }
  if (sha256(baseXml) !== release.baseFeedSha256BySnapshot[snapshotName]) {
    throw new Error(`Apple show-name ${snapshotName} base feed drifted from its sealed canary snapshot.`);
  }
  const itemStart = baseXml.indexOf("\n    <item>");
  if (itemStart < 0 || baseXml.indexOf("\n    <item>", itemStart + 1) < 0) {
    throw new Error("Apple show-name base feed must contain the existing episode items.");
  }
  const itemTail = baseXml.slice(itemStart);
  let channel = baseXml.slice(0, itemStart);
  channel = replaceOnce(
    channel,
    `<title><![CDATA[${release.sourceShowName}]]></title>`,
    `<title><![CDATA[${release.targetShowName}]]></title>`,
    "channel title",
  );
  channel = replaceOnce(
    channel,
    `<description><![CDATA[<p>${release.sourceDescription}</p>]]></description>`,
    `<description><![CDATA[<p>${release.targetDescription}</p>]]></description>`,
    "channel description",
  );
  channel = replaceOnce(
    channel,
    `<title>${release.sourceShowName}</title>`,
    `<title>${release.targetShowName}</title>`,
    "channel image title",
  );
  const xml = channel + itemTail;
  if (xml.slice(channel.length) !== itemTail) {
    throw new Error("Apple show-name projection changed the episode subtree.");
  }
  if (XMLValidator.validate(xml) !== true) {
    throw new Error("Apple show-name projection is not valid XML.");
  }
  const targetSha256 = sha256(xml);
  if (verifyTargetHash && targetSha256 !== release.targetFeedSha256BySnapshot[snapshotName]) {
    throw new Error("Apple show-name target feed drifted from its pinned SHA-256.");
  }
  return { xml, sha256: targetSha256, itemTailSha256: sha256(itemTail) };
}

export async function loadAppleAuthorizedAuthorities({
  authorities = null,
  releasePath = RELEASE_PATH,
  configPath = undefined,
  deploymentStatePath = undefined,
} = {}) {
  const canary = authorities ?? await loadAppleRepublishCanaryAuthorities(configPath, deploymentStatePath);
  const release = JSON.parse(await fs.readFile(releasePath, "utf8"));
  const schema = JSON.parse(await fs.readFile(SCHEMA_PATH, "utf8"));
  const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
  if (!validate(release)) {
    throw new Error(`Apple show-name release is invalid: ${JSON.stringify(validate.errors)}`);
  }
  if (release.publicFeedUrl !== canary.activeConfig.publicFeedUrl) {
    throw new Error("Apple show-name release changed the Apple feed URL.");
  }
  const catalog = JSON.parse(await fs.readFile(CATALOG_PATH, "utf8"));
  if (
    catalog.show.names.full !== release.targetShowName ||
    catalog.show.profileCopy.short !== release.targetDescription
  ) {
    throw new Error("Apple show-name release drifted from the master catalog.");
  }
  const projections = Object.fromEntries(
    Object.entries(canary.sealedFeeds).map(([name, baseXml]) => [
      name,
      projectAppleShowNameMd(baseXml, release, name),
    ]),
  );
  return { ...canary, showNameMdRelease: { ...release, projections } };
}

export function selectedAppleFeed(authorities, phase = authorities.deploymentState.phase) {
  const { deploymentState, sealedFeeds, showNameMdRelease } = authorities;
  const name = deploymentState.feedSnapshotByPhase[phase];
  const baseXml = sealedFeeds[name];
  if (!name || typeof baseXml !== "string") {
    throw new Error(`Apple ${phase} phase has no sealed feed projection.`);
  }
  if (showNameMdRelease) {
    return {
      name: `${name}+show-name-md-v1`,
      xml: showNameMdRelease.projections[name].xml,
      sha256: showNameMdRelease.projections[name].sha256,
    };
  }
  return { name, xml: baseXml, sha256: sha256(baseXml) };
}
