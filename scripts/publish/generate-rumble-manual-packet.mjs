#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  catalogHash,
  DEFAULT_CATALOG_PATH,
  htmlDescriptionToPlainText,
  loadCatalog,
  resolveCatalogAsset,
  sourcesConfigPath,
} from "./catalog.mjs";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleDirectory, "../..");
const episodeNumbers = Object.freeze([1, 2, 3, 4, 5, 6, 7]);
const sha256Pattern = /^[a-f0-9]{64}$/;

export class RumbleManualPacketError extends Error {
  constructor(message) {
    super(message);
    this.name = "RumbleManualPacketError";
  }
}

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return (
    relative === "" ||
    (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`))
  );
}

export function defaultRumbleManualPacketPath(env = process.env) {
  const stateRoot = env.DRM_PUBLISH_HOME
    ? path.resolve(env.DRM_PUBLISH_HOME)
    : path.join(
        env.XDG_STATE_HOME || path.join(env.HOME || os.homedir(), ".local", "state"),
        "drm-publisher"
      );
  return path.join(stateRoot, "rumble", "manual-release-episodes-1-7.md");
}

function sameFileState(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs &&
    left.ctimeMs === right.ctimeMs
  );
}

async function verifyStableFile(filePath, expected, label) {
  let handle;
  try {
    handle = await fs.open(filePath, "r");
  } catch (error) {
    throw new RumbleManualPacketError(`${label} cannot be opened (${error.message}): ${filePath}`);
  }

  try {
    const before = await handle.stat();
    if (!before.isFile()) {
      throw new RumbleManualPacketError(`${label} is not a regular file: ${filePath}`);
    }
    if (before.size !== expected.sizeBytes) {
      throw new RumbleManualPacketError(
        `${label} byte size differs from the catalog: expected ${expected.sizeBytes}, found ${before.size}.`
      );
    }

    const hash = createHash("sha256");
    const stream = handle.createReadStream({ autoClose: false, start: 0 });
    for await (const chunk of stream) hash.update(chunk);

    const after = await handle.stat();
    const pathAfter = await fs.lstat(filePath);
    if (pathAfter.isSymbolicLink() || !pathAfter.isFile()) {
      throw new RumbleManualPacketError(`${label} path changed type while it was hashed: ${filePath}`);
    }
    if (!sameFileState(before, after) || before.dev !== pathAfter.dev || before.ino !== pathAfter.ino) {
      throw new RumbleManualPacketError(`${label} changed while it was hashed: ${filePath}`);
    }

    const sha256 = hash.digest("hex");
    if (sha256 !== expected.sha256) {
      throw new RumbleManualPacketError(
        `${label} SHA-256 differs from the catalog: expected ${expected.sha256}, found ${sha256}.`
      );
    }
    return { path: filePath, sizeBytes: before.size, sha256 };
  } finally {
    await handle.close();
  }
}

async function verifyEpisodeAsset(catalog, episode, role, configPath) {
  const assetId = episode.assetRefs?.[role];
  const label = `Episode ${episode.number} ${role}`;
  if (typeof assetId !== "string" || !assetId) {
    throw new RumbleManualPacketError(`${label} has no catalog asset binding.`);
  }

  const asset = catalog.assetRegistry?.[assetId];
  if (!asset) throw new RumbleManualPacketError(`${label} references missing asset ${assetId}.`);
  const expectedKind = role === "fullVideo" ? "video" : "image";
  if (asset.role !== role || asset.kind !== expectedKind) {
    throw new RumbleManualPacketError(
      `${label} asset ${assetId} must have role ${role} and kind ${expectedKind}.`
    );
  }
  if (asset.status !== "verified") {
    throw new RumbleManualPacketError(`${label} asset ${assetId} is not catalog-verified.`);
  }
  if (!Number.isSafeInteger(asset.sizeBytes) || asset.sizeBytes < 1) {
    throw new RumbleManualPacketError(`${label} asset ${assetId} has no valid catalog byte size.`);
  }
  if (typeof asset.sha256 !== "string" || !sha256Pattern.test(asset.sha256)) {
    throw new RumbleManualPacketError(`${label} asset ${assetId} has no valid catalog SHA-256.`);
  }

  let resolvedPath;
  try {
    resolvedPath = await resolveCatalogAsset(catalog, assetId, { configPath });
  } catch (error) {
    throw new RumbleManualPacketError(`${label} path cannot be resolved (${error.message}).`);
  }
  if (!path.isAbsolute(resolvedPath)) {
    throw new RumbleManualPacketError(`${label} did not resolve to an absolute path.`);
  }

  const verified = await verifyStableFile(resolvedPath, asset, label);
  return { assetId, ...verified };
}

function markdownCode(value, language = "text") {
  const text = String(value);
  const longestRun = Math.max(0, ...[...text.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = "`".repeat(Math.max(3, longestRun + 1));
  return `${fence}${language}\n${text}\n${fence}`;
}

export function renderRumbleManualPacket(packet) {
  const sections = packet.episodes.map((episode) => `## Episode ${episode.number}

### Title

${markdownCode(episode.title)}

### Rumble/direct description

${markdownCode(episode.description)}

### Exact video

Absolute path:

${markdownCode(episode.fullVideo.path)}

- Byte size: \`${episode.fullVideo.sizeBytes}\`
- SHA-256: \`${episode.fullVideo.sha256}\`
- Catalog asset: \`${episode.fullVideo.assetId}\`

### Exact thumbnail

Absolute path:

${markdownCode(episode.thumbnail.path)}

- Byte size: \`${episode.thumbnail.sizeBytes}\`
- SHA-256: \`${episode.thumbnail.sha256}\`
- Catalog asset: \`${episode.thumbnail.assetId}\`

### Human release checklist

- [ ] Select exactly the video path and thumbnail path above; confirm their displayed filenames.
- [ ] Set visibility to **Unlisted**.
- [ ] Select **Option C: Rumble Only (non-exclusive, similar to YouTube)**.
- [ ] Turn **off every syndication control**, including YouTube, Vimeo, Facebook, and any newly shown destination.
- [ ] Keep **Premium and every exclusive placement option off**.
- [ ] **Human only:** review the episode's original and third-party asset rights, then complete any rights attestation only if accurate.
- [ ] **Human only:** review and accept the **July 21, 2026 Terms** checkbox.
- [ ] **Human only:** submit only after every item above has been rechecked on this episode's form.
`);

  return `# Rumble Manual Release Packet

Generated: ${packet.generatedAt}

- Scope: existing catalog Episodes 1-7 only
- Catalog revision: \`${packet.catalogRevision}\`
- Catalog SHA-256: \`${packet.catalogSha256}\`
- Source catalog: \`${packet.catalogPath}\`
- Source mapping: \`${packet.sourcesConfigPath}\`
- Verified assets: \`${packet.verifiedAssetCount}\` (one full video and one thumbnail per episode)

This is an offline, copy-ready handoff. Generation reads local files only. It does not open Rumble, use a browser, accept Terms, attest rights, change licensing, or submit uploads.

## Automation permission request

**Status: SENT TO support@rumble.com ON AUGUST 8, 2026 - RESPONSE PENDING**

### Subject

${markdownCode("Written permission request for supervised upload automation - account 282015440")}

### Message

${markdownCode(`Hello Rumble Support,

I am the account owner or authorized manager for Dr. M Experienced:
Rumble account: 282015440
Channel: 7820170

I am requesting prior written permission under the "Restrictions on Automated Software" section of Rumble's Terms to use limited, local, owner-supervised browser assistance for our podcast-video publishing workflow.

The proposed software assistance would:
- enter titles, descriptions, tags, and other metadata that the owner approved in advance;
- attach exact owner-approved local video and thumbnail files;
- select the owner's approved visibility and distribution settings;
- submit an exact release only after the owner has approved that release packet and confirmed the applicable content rights and current Terms.

Every upload would use Option C, Rumble Only, so it remains non-exclusive. New uploads would start Unlisted, keep Premium and every exclusive placement option off, and keep all auto-syndication destinations off.

The assistance would not scrape Rumble or other users, collect interaction data, evade access controls, solve CAPTCHA or MFA prompts, generate engagement, post comments, make independent editorial or licensing decisions, or run without an owner-approved release. We can retain an audit trail tying each action to the approved metadata and file hashes.

Please confirm in writing whether Rumble grants prior written permission for this narrowly scoped workflow. If browser assistance is not approved, please identify any supported VOD upload API, partner integration, or bulk-import workflow that would let us publish the same approved releases programmatically.

Thank you,

Michael
Dr. M Experienced
drmexperienced@gmail.com`)}

${sections.join("\n---\n\n")}`;
}

async function buildRumbleManualPacket(options = {}) {
  const env = options.env ?? process.env;
  const catalogPath = path.resolve(options.catalogPath ?? DEFAULT_CATALOG_PATH);
  const configPath = path.resolve(options.sourcesConfigPath ?? sourcesConfigPath(env));
  const catalog = await loadCatalog(catalogPath);
  const episodesByNumber = new Map(catalog.episodes.map((episode) => [episode.number, episode]));
  const missing = episodeNumbers.filter((number) => !episodesByNumber.has(number));
  if (missing.length) {
    throw new RumbleManualPacketError(`Catalog is missing required episode number(s): ${missing.join(", ")}.`);
  }

  const episodes = [];
  for (const number of episodeNumbers) {
    const episode = episodesByNumber.get(number);
    const [fullVideo, thumbnail] = await Promise.all([
      verifyEpisodeAsset(catalog, episode, "fullVideo", configPath),
      verifyEpisodeAsset(catalog, episode, "thumbnail", configPath),
    ]);
    episodes.push({
      number,
      title: episode.title,
      description: htmlDescriptionToPlainText(episode.description.full),
      fullVideo,
      thumbnail,
    });
  }

  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    catalogRevision: catalog.revision,
    catalogSha256: catalogHash(catalog),
    catalogPath,
    sourcesConfigPath: configPath,
    verifiedAssetCount: episodes.length * 2,
    episodes,
  };
}

function validateOutputPath(outputPath) {
  const resolved = path.resolve(outputPath);
  if (path.extname(resolved).toLowerCase() !== ".md") {
    throw new RumbleManualPacketError("Rumble manual packet output must use a .md extension.");
  }
  if (isWithin(projectRoot, resolved)) {
    throw new RumbleManualPacketError("Rumble manual packets must never be written inside the repository.");
  }
  return resolved;
}

async function writePrivatePacket(outputPath, content) {
  const parent = path.dirname(outputPath);
  await fs.mkdir(parent, { recursive: true, mode: 0o700 });

  const [canonicalProjectRoot, canonicalParent] = await Promise.all([
    fs.realpath(projectRoot),
    fs.realpath(parent),
  ]);
  const canonicalOutput = path.join(canonicalParent, path.basename(outputPath));
  if (isWithin(canonicalProjectRoot, canonicalOutput)) {
    throw new RumbleManualPacketError("Rumble manual packets must never be written inside the repository.");
  }

  try {
    const existing = await fs.lstat(canonicalOutput);
    if (existing.isSymbolicLink() || !existing.isFile()) {
      throw new RumbleManualPacketError("Rumble manual packet output must be a regular file or not yet exist.");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const temporary = path.join(
    canonicalParent,
    `.${path.basename(canonicalOutput)}.${process.pid}.${randomUUID()}.tmp`
  );
  try {
    await fs.writeFile(temporary, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await fs.rename(temporary, canonicalOutput);
    await fs.chmod(canonicalOutput, 0o600);
  } finally {
    await fs.rm(temporary, { force: true });
  }
  return canonicalOutput;
}

export async function generateRumbleManualPacket(options = {}) {
  const env = options.env ?? process.env;
  const outputPath = validateOutputPath(
    options.outputPath ?? defaultRumbleManualPacketPath(env)
  );
  const packet = await buildRumbleManualPacket(options);
  const content = renderRumbleManualPacket(packet);
  const writtenPath = await writePrivatePacket(outputPath, content);
  return { outputPath: writtenPath, packet, content };
}

function usage() {
  return `Usage:
  node scripts/publish/generate-rumble-manual-packet.mjs [--output /absolute/path.md]

Default output:
  ${defaultRumbleManualPacketPath()}
`;
}

function parseArguments(argv) {
  let outputPath;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") return { help: true };
    if (argument === "--output") {
      if (outputPath !== undefined) throw new RumbleManualPacketError("--output may be supplied only once.");
      outputPath = argv[index + 1];
      if (!outputPath || outputPath.startsWith("--")) {
        throw new RumbleManualPacketError("--output requires a Markdown file path.");
      }
      index += 1;
      continue;
    }
    throw new RumbleManualPacketError(`Unknown argument: ${argument}`);
  }
  return { help: false, outputPath };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const args = parseArguments(process.argv.slice(2));
    if (args.help) {
      process.stdout.write(usage());
    } else {
      const result = await generateRumbleManualPacket({ outputPath: args.outputPath });
      process.stdout.write(
        `Verified ${result.packet.verifiedAssetCount} local assets for Episodes 1-7.\nPacket: ${result.outputPath}\n`
      );
    }
  } catch (error) {
    process.stderr.write(`${error.name}: ${error.message}\n`);
    process.exitCode = 1;
  }
}
