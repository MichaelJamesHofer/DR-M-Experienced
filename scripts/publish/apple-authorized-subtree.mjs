import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  APPLE_REPUBLISH_CANARY_PHASES,
  loadAppleRepublishCanaryAuthorities,
  parseAppleRepublishFeed,
} from "./apple-republish-canary-prototype.mjs";
import { fetchPublishedAppleFeed } from "./verify-apple-feed-deployment.mjs";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const DEFAULT_TIMEOUT_MS = 60_000;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function regularFile(pathname, label) {
  const stat = await fs.lstat(pathname).catch(() => null);
  if (!stat?.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file.`);
  }
  return stat;
}

async function hashRegularFile(filePath, label) {
  await regularFile(filePath, label);
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
    bytes += chunk.length;
  }
  return { bytes, sha256: hash.digest("hex") };
}

async function relativeFileInventory(root) {
  const files = [];
  async function visit(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error("Authorized Apple subtree must not contain symlinks.");
      }
      if (entry.isDirectory()) {
        if ((await fs.realpath(target)) !== target) {
          throw new Error("Authorized Apple subtree contains a symlink alias.");
        }
        await visit(target);
      } else if (entry.isFile()) {
        files.push(path.relative(root, target).split(path.sep).join("/"));
      } else {
        throw new Error("Authorized Apple subtree contains a non-regular entry.");
      }
    }
  }
  await visit(root);
  return files.sort();
}

async function resolveSiteRoot(siteRoot) {
  if (!siteRoot) throw new Error("Authorized Apple subtree requires a site root.");
  const root = path.resolve(siteRoot);
  const stat = await fs.lstat(root).catch(() => null);
  if (!stat?.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("Authorized Apple site root must be a real directory, not a symlink.");
  }
  if ((await fs.realpath(root)) !== root) {
    throw new Error("Authorized Apple site root must be a symlink-free canonical path.");
  }
  return root;
}

async function resolveSubtree(root, config, { create = false } = {}) {
  const feedPath = path.resolve(root, config.artifactLayout.feedRelativePath);
  const mediaPath = path.resolve(root, config.artifactLayout.mediaRelativePath);
  const subtreeRoot = path.dirname(feedPath);
  if (
    subtreeRoot !== path.resolve(root, "apple-podcasts") ||
    path.dirname(mediaPath) !== path.resolve(subtreeRoot, "media")
  ) {
    throw new Error("Authorized Apple artifact layout drifted from its fixed subtree.");
  }
  for (const target of [subtreeRoot, feedPath, mediaPath]) {
    const relative = path.relative(root, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Authorized Apple artifact path escaped the site root.");
    }
  }
  let stat = await fs.lstat(subtreeRoot).catch(() => null);
  if (!stat && create) {
    await fs.mkdir(subtreeRoot);
    stat = await fs.lstat(subtreeRoot);
  }
  if (!stat?.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("Authorized Apple subtree root must be a real directory, not a symlink.");
  }
  if ((await fs.realpath(subtreeRoot)) !== subtreeRoot) {
    throw new Error("Authorized Apple subtree root must be a symlink-free canonical path.");
  }
  return { subtreeRoot, feedPath, mediaPath };
}

function phaseUsesCandidateMedia(phase) {
  return phase !== "closed";
}

function assertKnownPhase(deploymentState, config) {
  if (!APPLE_REPUBLISH_CANARY_PHASES.includes(deploymentState.phase)) {
    throw new Error(`Unknown Apple republish canary phase: ${deploymentState.phase}`);
  }
  if (["active", "contained"].includes(deploymentState.phase)) {
    const evidence = deploymentState.mediaStagedPublicEvidence;
    const historical = deploymentState.sealedFeedSnapshots.historical;
    if (
      !evidence ||
      evidence.publicUrl !== config.canary.candidateEnclosure.url ||
      evidence.contentType !== config.canary.candidateEnclosure.mediaType ||
      evidence.contentType !== "audio/mpeg" ||
      evidence.bytes !== config.canary.candidateEnclosure.length ||
      evidence.sha256 !== config.canary.candidateEnclosure.sha256 ||
      evidence.historicalFeedSha256 !== historical.publishedSha256 ||
      evidence.directNoRedirect !== true ||
      evidence.headStatus !== 200 ||
      evidence.acceptRanges !== true ||
      evidence.verifiedRangeCount !== 3 ||
      evidence.fullStatus !== 200
    ) {
      throw new Error(
        `Apple ${deploymentState.phase} phase requires exact public media-staging evidence.`,
      );
    }
  }
  return deploymentState.phase;
}

function expectedInventory(config, phase) {
  const files = [path.basename(config.artifactLayout.feedRelativePath)];
  if (phaseUsesCandidateMedia(phase)) {
    files.push(path.relative("apple-podcasts", config.artifactLayout.mediaRelativePath));
  }
  return files.map((entry) => entry.split(path.sep).join("/")).sort();
}

function sealedProjection(authorities, phase) {
  const snapshotName = authorities.deploymentState.feedSnapshotByPhase[phase];
  const xml = authorities.sealedFeeds[snapshotName];
  if (!snapshotName || typeof xml !== "string") {
    throw new Error(`Apple ${phase} phase has no sealed feed projection.`);
  }
  const episodes = parseAppleRepublishFeed(xml, `Sealed Apple ${phase} feed`).episodes;
  return {
    xml,
    episodes,
    report: {
      phase,
      outputSha256: sha256(xml),
      episodeCount: episodes.length,
      sealedSnapshot: snapshotName,
    },
  };
}

async function phaseProjection(authorities, phase) {
  return sealedProjection(authorities, phase);
}

const BASELINE_PHASES = Object.freeze({
  media_staged: ["media_staged"],
  active: ["media_staged", "active"],
  contained: ["active", "contained"],
});

export function assertPublicApplePhaseBaseline(
  publicXml,
  authorities,
  targetPhase = authorities.deploymentState.phase,
) {
  const allowed = BASELINE_PHASES[targetPhase];
  if (!allowed) {
    throw new Error(`Apple ${targetPhase} phase does not use a sealed public transition baseline.`);
  }
  const matches = allowed.filter(
    (phase) => sealedProjection(authorities, phase).xml === publicXml,
  );
  if (matches.length === 0) {
    throw new Error(
      `Public Apple feed SHA-256 ${sha256(publicXml)} is neither the exact previous nor current ${targetPhase} projection.`,
    );
  }
  const baselinePhase = matches.includes(targetPhase) ? targetPhase : matches[0];
  return {
    baselinePhase,
    pretransitionPublicSha256: sha256(publicXml),
    targetPhase,
    idempotent: baselinePhase === targetPhase,
  };
}

async function publicTransitionBaseline(
  authorities,
  phase,
  { fetchImpl, timeoutMs, cacheBust, publicFeedXml = null },
) {
  if (phase === "closed") return null;
  let xml = publicFeedXml;
  if (xml === null) {
    const cacheBusted = await fetchPublishedAppleFeed(
      authorities.activeConfig.publicFeedUrl,
      { fetchImpl, timeoutMs, cacheBust: `${cacheBust}-transition` },
    );
    const bare = await fetchPublishedAppleFeed(
      authorities.activeConfig.publicFeedUrl,
      { fetchImpl, timeoutMs, cacheBust: null },
    );
    if (cacheBusted.xml !== bare.xml) {
      throw new Error(
        "Bare and cache-busted Apple feeds disagree before the phase transition.",
      );
    }
    xml = bare.xml;
  }
  return assertPublicApplePhaseBaseline(xml, authorities, phase);
}

async function resolveSealedMediaAsset(authorities) {
  const { deploymentState, config } = authorities;
  const record = deploymentState.sealedMediaAsset;
  if (!record.path) {
    throw new Error("Open Apple canary phase requires a repository-contained sealed media asset.");
  }
  const assetPath = authorities.sealedMediaAssetPathOverride
    ? path.resolve(authorities.sealedMediaAssetPathOverride)
    : path.resolve(REPOSITORY_ROOT, record.path);
  if (!authorities.sealedMediaAssetPathOverride) {
    const relative = path.relative(REPOSITORY_ROOT, assetPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Sealed Apple media asset escaped the repository.");
    }
  }
  const identity = await hashRegularFile(assetPath, "Sealed Apple media asset");
  if (
    identity.bytes !== record.length ||
    identity.sha256 !== record.sha256 ||
    identity.bytes !== config.canary.candidateEnclosure.length ||
    identity.sha256 !== config.canary.candidateEnclosure.sha256
  ) {
    throw new Error("Sealed Apple media asset drifted from the immutable canary identity.");
  }
  return { assetPath, ...identity };
}

async function materializeMedia(asset, destinationPath) {
  const existing = await fs.lstat(destinationPath).catch(() => null);
  if (existing) {
    const identity = await hashRegularFile(destinationPath, "Existing canary media");
    if (identity.bytes !== asset.bytes || identity.sha256 !== asset.sha256) {
      throw new Error("Existing immutable canary media has different bytes; refusing overwrite.");
    }
    return { ...identity, reused: true };
  }
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  const temporaryPath = `${destinationPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.copyFile(asset.assetPath, temporaryPath, fs.constants.COPYFILE_EXCL);
    const copied = await hashRegularFile(temporaryPath, "Materialized canary media temporary file");
    if (copied.bytes !== asset.bytes || copied.sha256 !== asset.sha256) {
      throw new Error("Materialized canary media changed during copy.");
    }
    await fs.link(temporaryPath, destinationPath);
    return { ...copied, reused: false };
  } finally {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

async function writeAtomicText(filePath, contents) {
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, contents, { encoding: "utf8", mode: 0o644, flag: "wx" });
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function acquireArtifactLock(root) {
  const lockPath = path.resolve(root, ".apple-authorized-subtree.lock");
  const handle = await fs.open(lockPath, "wx", 0o600);
  return {
    async release() {
      await handle.close().catch(() => undefined);
      await fs.rm(lockPath, { force: true }).catch(() => undefined);
    },
  };
}

async function authoritiesFrom({ authorities, configPath, deploymentStatePath }) {
  return authorities ??
    loadAppleRepublishCanaryAuthorities(configPath, deploymentStatePath);
}

export async function generateAuthorizedAppleSubtree({
  siteRoot,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  cacheBust = `${Date.now()}`,
  authorities = null,
  configPath = undefined,
  deploymentStatePath = undefined,
  publicFeedXml = null,
} = {}) {
  const root = await resolveSiteRoot(siteRoot);
  const loaded = await authoritiesFrom({ authorities, configPath, deploymentStatePath });
  const { config, deploymentState } = loaded;
  const phase = assertKnownPhase(deploymentState, config);

  // Every byte and every transition is validated before the deployment feed is touched.
  const projection = await phaseProjection(loaded, phase);
  const baseline = await publicTransitionBaseline(loaded, phase, {
    fetchImpl,
    timeoutMs,
    cacheBust,
    publicFeedXml,
  });
  const asset = phaseUsesCandidateMedia(phase)
    ? await resolveSealedMediaAsset(loaded)
    : null;
  const paths = await resolveSubtree(root, config, { create: true });
  const allowed = expectedInventory(config, phase);
  const beforeInventory = await relativeFileInventory(paths.subtreeRoot);
  if (beforeInventory.some((entry) => !allowed.includes(entry))) {
    throw new Error(`Apple ${phase} phase found unauthorized subtree files: ${beforeInventory.join(", ")}.`);
  }

  const lock = await acquireArtifactLock(root);
  try {
    let media = null;
    if (asset) {
      media = await materializeMedia(asset, paths.mediaPath);
    } else if (await fs.lstat(paths.mediaPath).catch(() => null)) {
      throw new Error("Closed Apple phase forbids a candidate media artifact.");
    }
    await writeAtomicText(paths.feedPath, projection.xml);
    const actual = await fs.readFile(paths.feedPath, "utf8");
    if (actual !== projection.xml || sha256(actual) !== projection.report.outputSha256) {
      throw new Error("Authorized Apple feed failed its final atomic readback.");
    }
    const inventory = await relativeFileInventory(paths.subtreeRoot);
    if (JSON.stringify(inventory) !== JSON.stringify(allowed)) {
      throw new Error(`Apple ${phase} phase produced an invalid subtree inventory.`);
    }
    return {
      phase,
      siteRoot: root,
      feedPath: paths.feedPath,
      feedSha256: projection.report.outputSha256,
      episodeCount: projection.report.episodeCount,
      inventory,
      candidateMediaIncluded: Boolean(asset),
      media,
      ...baseline,
    };
  } finally {
    await lock.release();
  }
}

export async function verifyAuthorizedAppleSubtree({
  siteRoot,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  cacheBust = `${Date.now()}`,
  authorities = null,
  configPath = undefined,
  deploymentStatePath = undefined,
  publicFeedXml = null,
} = {}) {
  const root = await resolveSiteRoot(siteRoot);
  const loaded = await authoritiesFrom({ authorities, configPath, deploymentStatePath });
  const { config, deploymentState } = loaded;
  const phase = assertKnownPhase(deploymentState, config);
  const projection = await phaseProjection(loaded, phase);
  const baseline = await publicTransitionBaseline(loaded, phase, {
    fetchImpl,
    timeoutMs,
    cacheBust,
    publicFeedXml,
  });
  const paths = await resolveSubtree(root, config);
  const inventory = await relativeFileInventory(paths.subtreeRoot);
  const expected = expectedInventory(config, phase);
  if (JSON.stringify(inventory) !== JSON.stringify(expected)) {
    throw new Error(`Apple ${phase} phase requires exact inventory ${expected.join(", ")}; found ${inventory.join(", ")}.`);
  }
  const actual = await fs.readFile(paths.feedPath, "utf8");
  if (actual !== projection.xml || sha256(actual) !== projection.report.outputSha256) {
    throw new Error(`Authorized Apple feed is not the exact ${phase} phase projection.`);
  }
  let media = null;
  if (phaseUsesCandidateMedia(phase)) {
    media = await hashRegularFile(paths.mediaPath, "Authorized canary media");
    if (
      media.bytes !== config.canary.candidateEnclosure.length ||
      media.sha256 !== config.canary.candidateEnclosure.sha256
    ) {
      throw new Error("Authorized canary media does not match its immutable identity.");
    }
  }
  return {
    phase,
    siteRoot: root,
    inventory,
    feedSha256: projection.report.outputSha256,
    episodeCount: projection.report.episodeCount,
    candidateMediaIncluded: phaseUsesCandidateMedia(phase),
    media,
    exactAuthorizedPhaseProjection: true,
    ...baseline,
  };
}

function cliArgument(name, fallback = null) {
  const prefix = `${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

const invokedPath = process.argv[1];
if (invokedPath && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  const siteRoot = cliArgument("--site-root", path.join(REPOSITORY_ROOT, "out"));
  try {
    const report =
      mode === "generate"
        ? await generateAuthorizedAppleSubtree({ siteRoot })
        : mode === "verify"
          ? await verifyAuthorizedAppleSubtree({ siteRoot })
          : null;
    if (!report) {
      throw new Error("Usage: apple-authorized-subtree.mjs <generate|verify> [--site-root=PATH]");
    }
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`apple-authorized-subtree: ${error.message}\n`);
    process.exitCode = 1;
  }
}
