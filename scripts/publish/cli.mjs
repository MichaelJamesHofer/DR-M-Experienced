#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parsePodcastFeed, runPreflight } from "./feed-preflight.mjs";
import {
  catalogAssetBindingProblems,
  catalogHash,
  comparePublishedCatalogFeed,
  episodeHash,
  findEpisode,
  loadCatalog,
  manifestCatalogProblems,
  resolveCatalogAsset,
  sourcesConfigPath,
} from "./catalog.mjs";
import {
  approvalRecordProblems,
  buildApprovalSnapshot,
  buildTargetPlan,
  configHome,
  hashText,
  hashSnapshot,
  hostingMigrationIsActive,
  inspectAsset,
  invalidDestinationIds,
  missingDestinationIds,
  normalizeManifest,
  packetIntegrityProblems,
  publisherHome,
  renderApprovalPacket,
  resolveAssetPaths,
  reviewDocumentProblems,
  validateManifest,
  validateMediaAssets,
  verifySnapshotAssets,
  writePrivateJson,
  writePrivateText,
} from "./lib.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..", "..");
const platformConfigPath = path.join(projectRoot, "publishing", "platforms.json");
const hostingMigrationPath = path.join(projectRoot, "publishing", "hosting-migration.json");

function usage() {
  return `Usage:
  drm-publish doctor
  drm-publish migration-check [--verify-media] [--snapshot]
  drm-publish prepare <episode.json>
  drm-publish show <job-id>
  drm-publish approve <job-id> --hash <sha256> --by <name> --confirm "approve <job-id> <sha256>"
  drm-publish status <job-id>
  drm-publish list`;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function loadPlatformConfig(catalog = null) {
  const master = catalog ?? (await loadCatalog());
  const routing = await readJson(platformConfigPath);
  return {
    ...routing,
    brand: master.show.names.full,
    brandDescription: master.show.profileCopy.short,
    rssFeed: master.show.canonicalPodcastFeed.url,
  };
}

function timestampId() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").toLowerCase();
}

function safeJobId(jobId) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(jobId)) throw new Error(`Invalid job id: ${jobId}`);
  return jobId;
}

function jobDirectory(jobId) {
  return path.join(publisherHome(), "jobs", safeJobId(jobId));
}

async function createUniqueJobDirectory(slug) {
  const jobsRoot = path.join(publisherHome(), "jobs");
  await fs.mkdir(jobsRoot, { recursive: true, mode: 0o700 });
  await fs.chmod(publisherHome(), 0o700);
  await fs.chmod(jobsRoot, 0o700);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt ? `-${attempt}` : "";
    const id = `${slug}-${timestampId()}${suffix}`;
    const directory = path.join(jobsRoot, id);
    try {
      await fs.mkdir(directory, { mode: 0o700 });
      return { id, directory };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  throw new Error("Could not allocate a unique publishing job directory.");
}

async function prepare(manifestArgument) {
  if (!manifestArgument) throw new Error("prepare requires an episode manifest path.");
  const manifestPath = path.resolve(manifestArgument);
  const sourceManifest = await readJson(manifestPath);
  const initialValidation = validateManifest(sourceManifest);
  if (initialValidation.errors.length) {
    throw new Error(`Manifest validation failed:\n- ${initialValidation.errors.join("\n- ")}`);
  }

  const catalog = await loadCatalog();
  const catalogEpisode = findEpisode(catalog, sourceManifest.episodeNumber);
  if (!catalogEpisode) {
    throw new Error(
      `Episode ${sourceManifest.episodeNumber} is not in publishing/master-catalog.json. Add its approved metadata there before preparing a publishing job.`
    );
  }
  const catalogProblems = manifestCatalogProblems(sourceManifest, catalogEpisode);
  if (catalogProblems.length) {
    throw new Error(`Manifest differs from the master catalog:\n- ${catalogProblems.join("\n- ")}`);
  }
  const catalogBinding = {
    revision: catalog.revision,
    catalogHash: catalogHash(catalog),
    episodeNumber: catalogEpisode.number,
    episodeHash: episodeHash(catalogEpisode),
  };

  const platformConfig = await loadPlatformConfig(catalog);
  const { id, directory } = await createUniqueJobDirectory(sourceManifest.slug);
  let completed = false;
  try {
    const normalizedManifest = normalizeManifest(sourceManifest);
    normalizedManifest.assets = resolveAssetPaths(sourceManifest, manifestPath);

    const assets = {};
    for (const [key, filePath] of Object.entries(normalizedManifest.assets)) {
      if (!filePath) {
        assets[key] = null;
        continue;
      }
      process.stdout.write(`Inspecting ${key}...\n`);
      assets[key] = await inspectAsset(filePath, key);
    }

    const catalogAssetValidation = catalogAssetBindingProblems(catalog, catalogEpisode, assets);
    if (catalogAssetValidation.errors.length) {
      throw new Error(`Media differs from the master catalog:\n- ${catalogAssetValidation.errors.join("\n- ")}`);
    }

    const catalogPathWarnings = [];
    const sourceConfig = sourcesConfigPath();
    if (await exists(sourceConfig)) {
      const pathProblems = [];
      for (const [role, inspected] of Object.entries(assets)) {
        if (!inspected) continue;
        const assetId = catalogEpisode.assetRefs?.[role];
        if (!assetId) continue;
        const [expectedPath, actualPath] = await Promise.all([
          resolveCatalogAsset(catalog, assetId, { configPath: sourceConfig }),
          fs.realpath(inspected.path),
        ]);
        if (expectedPath !== actualPath) {
          pathProblems.push(`${role} path does not resolve to master catalog asset ${assetId}.`);
        }
      }
      if (pathProblems.length) {
        throw new Error(`Media paths differ from the master catalog:\n- ${pathProblems.join("\n- ")}`);
      }
    } else if (Object.values(assets).some(Boolean)) {
      catalogPathWarnings.push(
        `Dropbox project root is not configured at ${sourceConfig}; catalog asset paths cannot be independently resolved on this workstation.`
      );
    }

    const mediaValidation = validateMediaAssets(assets, normalizedManifest);
    const warnings = [
      ...new Set([
        ...initialValidation.warnings,
        ...catalogAssetValidation.warnings,
        ...catalogPathWarnings,
        ...mediaValidation.warnings,
      ]),
    ];
    const targets = buildTargetPlan(platformConfig, normalizedManifest, assets, mediaValidation.targetErrors);
    const snapshot = buildApprovalSnapshot({
      platformConfig,
      manifest: normalizedManifest,
      assets,
      targets,
      warnings,
      catalogBinding,
    });
    const packet = {
      id,
      status: "prepared",
      createdAt: new Date().toISOString(),
      sourceManifestPath: manifestPath,
      approvalHash: hashSnapshot(snapshot),
      snapshot,
    };
    const approvalText = renderApprovalPacket(packet);

    await writePrivateJson(path.join(directory, "packet.json"), packet, { exclusive: true });
    await writePrivateText(path.join(directory, "approval.md"), approvalText, { exclusive: true });
    completed = true;
    process.stdout.write(`\nPrepared job: ${id}\nApproval hash: ${packet.approvalHash}\nPacket: ${path.join(directory, "approval.md")}\n`);
    if (warnings.length) process.stdout.write(`Warnings: ${warnings.length} (review the approval packet)\n`);
  } finally {
    if (!completed) await fs.rm(directory, { recursive: true, force: true });
  }
}

async function loadVerifiedJob(jobId) {
  const directory = jobDirectory(jobId);
  const packet = await readJson(path.join(directory, "packet.json"));
  const integrityProblems = packetIntegrityProblems(packet, safeJobId(jobId));
  if (integrityProblems.length) {
    throw new Error(`Stored packet integrity check failed:\n- ${integrityProblems.join("\n- ")}`);
  }

  const storedReview = await fs.readFile(path.join(directory, "approval.md"), "utf8");
  const reviewProblems = reviewDocumentProblems(packet, storedReview);
  if (reviewProblems.length) {
    throw new Error(`Stored review integrity check failed:\n- ${reviewProblems.join("\n- ")}`);
  }

  const catalog = await loadCatalog();
  const binding = packet.snapshot.catalogBinding;
  const catalogProblems = [];
  if (binding.revision !== catalog.revision) {
    catalogProblems.push(`catalog revision changed from ${binding.revision} to ${catalog.revision}`);
  }
  if (binding.catalogHash !== catalogHash(catalog)) {
    catalogProblems.push("catalog SHA-256 no longer matches");
  }
  const catalogEpisode = findEpisode(catalog, binding.episodeNumber);
  if (!catalogEpisode) {
    catalogProblems.push(`episode ${binding.episodeNumber} is no longer present`);
  } else {
    if (binding.episodeHash !== episodeHash(catalogEpisode)) {
      catalogProblems.push(`episode ${binding.episodeNumber} SHA-256 no longer matches`);
    }
    catalogProblems.push(...manifestCatalogProblems(packet.snapshot.manifest, catalogEpisode));
  }
  if (catalogProblems.length) {
    throw new Error(
      `Stored packet master catalog binding is stale; prepare a new job:\n- ${[
        ...new Set(catalogProblems),
      ].join("\n- ")}`
    );
  }

  return {
    directory,
    packet,
    reviewDocument: renderApprovalPacket(packet),
  };
}

async function show(jobId) {
  if (!jobId) throw new Error("show requires a job id.");
  const { reviewDocument } = await loadVerifiedJob(jobId);
  process.stdout.write(reviewDocument);
}

function flagValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

async function approve(jobId, args) {
  if (!jobId) throw new Error("approve requires a job id.");
  const expectedHash = flagValue(args, "--hash");
  const approvedBy = flagValue(args, "--by");
  const confirmation = flagValue(args, "--confirm");
  if (!expectedHash) throw new Error("approve requires --hash with the exact approval hash.");
  if (!approvedBy?.trim()) throw new Error("approve requires --by with the approving person's name.");

  const { directory, packet, reviewDocument } = await loadVerifiedJob(jobId);
  if (expectedHash !== packet.approvalHash) throw new Error("Approval hash does not match this job.");
  const expectedConfirmation = `approve ${packet.id} ${packet.approvalHash}`;
  if (confirmation !== expectedConfirmation) {
    throw new Error("Confirmation phrase does not exactly match the one in the reviewed packet.");
  }

  const contentBlockers = packet.snapshot.targets.filter((target) =>
    [
      "asset_required",
      "asset_invalid",
      "destination_id_required",
      "destination_id_invalid",
      "release_choices_required",
      "host_publish_dependency_missing",
    ].includes(target.readiness)
  );
  if (contentBlockers.length) {
    throw new Error(
      `Review cannot be attested while content blockers remain:\n- ${contentBlockers
        .map((target) => `${target.label}: ${target.readiness}`)
        .join("\n- ")}`
    );
  }

  const assetProblems = await verifySnapshotAssets(packet.snapshot);
  if (assetProblems.length) throw new Error(`Asset verification failed:\n- ${assetProblems.join("\n- ")}`);

  const approval = {
    schemaVersion: 2,
    jobId,
    approvalHash: packet.approvalHash,
    reviewDocumentSha256: hashText(reviewDocument),
    approvedAt: new Date().toISOString(),
    approvedBy: approvedBy.trim(),
    attestationType: "self-reported-local-review",
    authorizesUpload: false,
    authorizesRelease: false,
    scope: "Attests review of the immutable local packet only. This record is not identity authentication and cannot authorize upload or release.",
  };
  await writePrivateJson(path.join(directory, "approval.json"), approval, { exclusive: true });
  process.stdout.write(`Local review attestation recorded for ${jobId}. No content was uploaded or released.\n`);
}

async function status(jobId) {
  if (!jobId) throw new Error("status requires a job id.");
  const { directory, packet, reviewDocument } = await loadVerifiedJob(jobId);
  const assetProblems = await verifySnapshotAssets(packet.snapshot);
  if (assetProblems.length) throw new Error(`Asset verification failed:\n- ${assetProblems.join("\n- ")}`);
  let approval = null;
  try {
    approval = await readJson(path.join(directory, "approval.json"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  if (approval) {
    const problems = approvalRecordProblems(packet, approval, reviewDocument);
    if (problems.length) throw new Error(`Approval record integrity check failed:\n- ${problems.join("\n- ")}`);
  }

  process.stdout.write(`Job: ${packet.id}\n`);
  process.stdout.write(`Title: ${packet.snapshot.manifest.title}\n`);
  process.stdout.write(`Hash: ${packet.approvalHash}\n`);
  process.stdout.write(
    `Local review: ${approval ? `self-reported by ${approval.approvedBy} at ${approval.approvedAt}` : "pending"}\n`
  );
  process.stdout.write("Upload/release authorization: not granted\n");
  for (const target of packet.snapshot.targets) {
    process.stdout.write(`- ${target.label}: ${target.readiness}\n`);
  }
}

async function listJobs() {
  const jobsRoot = path.join(publisherHome(), "jobs");
  let entries = [];
  try {
    entries = await fs.readdir(jobsRoot, { withFileTypes: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const ids = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse();
  if (!ids.length) process.stdout.write("No publishing jobs found.\n");
  else process.stdout.write(`${ids.join("\n")}\n`);
}

function executableStatus(command, args = ["-version"]) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 10000 });
  return result.status === 0;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function migrationCheck(args) {
  const allowed = new Set(["--verify-media", "--snapshot"]);
  const unknown = args.filter((argument) => !allowed.has(argument));
  if (unknown.length) throw new Error(`Unknown migration-check option: ${unknown[0]}`);

  const migration = await readJson(hostingMigrationPath);
  const platformConfig = await loadPlatformConfig();
  if (!hostingMigrationIsActive(migration, platformConfig.pendingHostingMigration)) {
    process.stdout.write(
      `Hosting migration is parked. Anchor remains canonical at ${platformConfig.rssFeed}.\n` +
        `No feed preflight was run; resuming the migration requires explicit approval.\n`
    );
    return;
  }
  const source = migration.source?.feedUrl;
  const candidate = migration.destination?.candidateFeedUrl;
  if (!source || !candidate) throw new Error("Hosting migration source and candidate feed URLs are required.");

  const snapshotDirectory = args.includes("--snapshot")
    ? path.join(publisherHome(), "migrations", migration.migrationId)
    : undefined;
  const result = await runPreflight({
    source,
    candidate,
    expectedSource: {
      expectedEpisodeCount: migration.source.expectedEpisodeCount,
      expectedGuids: migration.source.expectedGuids,
    },
    verifyMedia: args.includes("--verify-media"),
    snapshotDirectory,
    timeoutMs: 30_000,
  });
  process.stdout.write(result.report);
  if (!result.ok) process.exitCode = 2;
}

async function doctor() {
  const catalog = await loadCatalog();
  const platformConfig = await loadPlatformConfig(catalog);
  let hostingMigration = null;
  try {
    hostingMigration = await readJson(hostingMigrationPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const credentials = configHome();
  const state = publisherHome();
  const core = {
    node: executableStatus(process.execPath, ["--version"]),
    ffmpeg: executableStatus("ffmpeg"),
    ffprobe: executableStatus("ffprobe"),
  };
  let catalogStatus = {
    valid: false,
    revision: null,
    episodeCount: 0,
    hash: null,
    verifiedAssetCount: 0,
    assetCount: 0,
    sourcesConfigured: await exists(sourcesConfigPath()),
    error: null,
  };
  try {
    const assets = Object.values(catalog.assetRegistry || {});
    catalogStatus = {
      ...catalogStatus,
      valid: true,
      revision: catalog.revision,
      episodeCount: catalog.episodes.length,
      hash: catalogHash(catalog),
      verifiedAssetCount: assets.filter((asset) => asset.status === "verified").length,
      assetCount: assets.length,
    };
  } catch (error) {
    catalogStatus.error = error.message;
  }
  const setup = {
    youtubeClient: await exists(path.join(credentials, "youtube", "client_secret.json")),
    youtubeToken: await exists(path.join(credentials, "youtube", "token.json")),
    vimeoToken: Boolean(process.env.VIMEO_ACCESS_TOKEN) || (await exists(path.join(credentials, "vimeo", "token"))),
    instagramToken: Boolean(process.env.INSTAGRAM_ACCESS_TOKEN) || (await exists(path.join(credentials, "instagram", "token"))),
    instagramAccount: await exists(path.join(credentials, "instagram", "account.json")),
    amazonDirectoryUrl: Boolean(platformConfig.platforms.amazon.channelUrl),
  };
  const missingIdentities = Object.fromEntries(
    Object.entries(platformConfig.platforms).map(([id, platform]) => [id, missingDestinationIds(platform)])
  );
  const invalidIdentities = Object.fromEntries(
    Object.entries(platformConfig.platforms).map(([id, platform]) => [id, invalidDestinationIds(id, platform)])
  );
  const hostingMigrationActive = hostingMigrationIsActive(
    hostingMigration,
    platformConfig.pendingHostingMigration
  );

  let rss = {
    reachable: false,
    title: null,
    descriptionMatches: false,
    verificationTokenPresent: false,
    episodeCount: 0,
    uniqueGuidCount: 0,
    structuredEpisodeNumbers: [],
    legacyTitleCount: 0,
    expectedEpisodeCount: catalog.episodes.filter((episode) => episode.publicationState === "published").length,
    catalogGuidSetMatches: false,
    catalogTitlesMatch: false,
    catalogEpisodeNumbersMatch: false,
    catalogMatches: false,
  };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(platformConfig.rssFeed, { signal: controller.signal });
    clearTimeout(timeout);
    const body = await response.text();
    const feed = parsePodcastFeed(body);
    const catalogComparison = comparePublishedCatalogFeed(catalog, feed);
    const guidCount = new Set(feed.episodes.map((episode) => episode.guid).filter(Boolean)).size;
    const structuredEpisodeNumbers = feed.episodes
      .map((episode) => (episode.episodeNumber == null ? null : Number(episode.episodeNumber)))
      .filter((episodeNumber) => Number.isInteger(episodeNumber) && episodeNumber > 0)
      .sort((left, right) => left - right);
    rss = {
      reachable: response.ok,
      title: feed.title,
      descriptionMatches: feed.description === platformConfig.brandDescription,
      verificationTokenPresent: feed.description?.includes("RSSVERIFY") ?? false,
      episodeCount: feed.episodes.length,
      uniqueGuidCount: guidCount,
      structuredEpisodeNumbers,
      legacyTitleCount: feed.episodes.filter((episode) =>
        /^(?:Episode|Ep\.?)\s*#?\s*\d+\b/i.test(episode.title ?? "")
      ).length,
      expectedEpisodeCount: catalogComparison.expectedEpisodeCount,
      catalogGuidSetMatches: catalogComparison.guidSetMatches && catalogComparison.uniqueGuids,
      catalogTitlesMatch: catalogComparison.titleMatches,
      catalogEpisodeNumbersMatch: catalogComparison.structuredNumbersMatch,
      catalogMatches: catalogComparison.ok,
    };
  } catch {
    rss.reachable = false;
  }

  process.stdout.write(`Dr. M publisher doctor\n`);
  process.stdout.write(`State: ${state}\n`);
  process.stdout.write(`Credentials: ${credentials} (values are never displayed)\n\n`);
  process.stdout.write(`Core tools\n`);
  for (const [name, ready] of Object.entries(core)) process.stdout.write(`- ${name}: ${ready ? "ready" : "missing"}\n`);
  process.stdout.write(
    `\nMaster catalog\n` +
      `- valid: ${catalogStatus.valid ? "yes" : "no"}\n` +
      `- revision / episodes: ${catalogStatus.revision ?? "unavailable"} / ${catalogStatus.episodeCount}\n` +
      `- hash: ${catalogStatus.hash || "unavailable"}\n` +
      `- verified assets: ${catalogStatus.verifiedAssetCount} / ${catalogStatus.assetCount}\n` +
      `- Dropbox project root configured: ${catalogStatus.sourcesConfigured ? "yes" : "no"}\n`
  );
  if (catalogStatus.error) process.stdout.write(`- catalog error: ${catalogStatus.error}\n`);
  process.stdout.write(
    `\nCanonical RSS\n` +
      `- reachable: ${rss.reachable ? "yes" : "no"}\n` +
      `- current title: ${rss.title || "unavailable"}\n` +
      `- desired title: ${platformConfig.brand}\n` +
      `- canonical description: ${rss.descriptionMatches ? "yes" : "no"}\n` +
      `- RSSVERIFY present: ${rss.verificationTokenPresent ? "yes" : "no"}\n` +
      `- expected published episodes: ${rss.expectedEpisodeCount}\n` +
      `- episodes / unique GUIDs: ${rss.episodeCount} / ${rss.uniqueGuidCount}\n` +
      `- structured episode numbers: ${rss.structuredEpisodeNumbers.join(", ") || "none"}\n` +
      `- legacy numbered titles: ${rss.legacyTitleCount}\n` +
      `- catalog GUID set: ${rss.catalogGuidSetMatches ? "exact" : "mismatch"}\n` +
      `- catalog titles: ${rss.catalogTitlesMatch ? "exact" : "mismatch"}\n` +
      `- catalog episode numbers: ${rss.catalogEpisodeNumbersMatch ? "exact" : "mismatch"}\n`
  );
  if (hostingMigration) {
    process.stdout.write(`\nHosting migration\n`);
    process.stdout.write(`- active: ${hostingMigrationActive ? "yes" : "no"}\n`);
    process.stdout.write(`- target: ${hostingMigration.destination.provider}\n`);
    process.stdout.write(`- status: ${hostingMigration.status}\n`);
    process.stdout.write(`- candidate: ${hostingMigration.destination.candidateStatus}\n`);
    process.stdout.write(`- redirect authorized: ${hostingMigration.gates.redirectAuthorized ? "yes" : "no"}\n`);
  }
  process.stdout.write(`\nAccount setup\n`);
  process.stdout.write(`- YouTube OAuth client: ${setup.youtubeClient ? "configured" : "needed"}\n`);
  process.stdout.write(`- YouTube OAuth token: ${setup.youtubeToken ? "configured" : "needed"}\n`);
  process.stdout.write(`- Vimeo upload token: ${setup.vimeoToken ? "configured" : "needed"}\n`);
  process.stdout.write(`- Instagram token: ${setup.instagramToken ? "configured" : "needed"}\n`);
  process.stdout.write(`- Instagram account mapping: ${setup.instagramAccount ? "configured" : "needed"}\n`);
  process.stdout.write(`- Amazon directory URL: ${setup.amazonDirectoryUrl ? "configured" : "needed"}\n`);
  for (const [id, missingIds] of Object.entries(missingIdentities)) {
    const invalidIds = invalidIdentities[id];
    const identityStatus = missingIds.length
      ? `needed (${missingIds.join(", ")})`
      : invalidIds.length
        ? `invalid (${invalidIds.join(", ")})`
        : "configured";
    process.stdout.write(`- ${id} stable destination IDs: ${identityStatus}\n`);
  }
  process.stdout.write(`- Spotify creator upload: manual browser step\n- Rumble VOD upload: manual browser step\n`);

  if (hostingMigrationActive && !platformConfig.pendingHostingMigration?.cutoverReady) {
    process.stdout.write(
      `\nAction: complete and validate the supported RSS.com import. Keep the Anchor feed canonical and do not redirect or rename the remote show yet.\n`
    );
  } else if (rss.title && rss.title !== platformConfig.brand) {
    process.stdout.write(`\nAction: rename the show at the verified canonical host so the title can fan out to podcast directories.\n`);
  } else if (
    !rss.descriptionMatches ||
    rss.verificationTokenPresent ||
    !rss.catalogMatches
  ) {
    process.stdout.write(
      `\nAction: finish the approved Spotify metadata batch, then rerun doctor before refreshing Apple or submitting Amazon.\n`
    );
  }
  const rssHealthy =
    rss.reachable &&
    rss.title === platformConfig.brand &&
    rss.descriptionMatches &&
    !rss.verificationTokenPresent &&
    rss.catalogMatches;
  if (Object.values(core).some((ready) => !ready) || !rssHealthy) process.exitCode = 2;
}

async function main() {
  const [command, first, ...rest] = process.argv.slice(2);
  if (!command || ["-h", "--help", "help"].includes(command)) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (command === "doctor") return doctor();
  if (command === "migration-check") return migrationCheck([first, ...rest].filter(Boolean));
  if (command === "prepare") return prepare(first);
  if (command === "show") return show(first);
  if (command === "approve") return approve(first, rest);
  if (command === "status") return status(first);
  if (command === "list") return listJobs();
  throw new Error(`Unknown command: ${command}\n\n${usage()}`);
}

main().catch((error) => {
  process.stderr.write(`drm-publish: ${error.message}\n`);
  process.exitCode = 1;
});
