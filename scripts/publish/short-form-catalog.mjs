import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_SHORT_FORM_CATALOG_PATH = path.resolve(
  moduleDirectory,
  "../../publishing/short-form-catalog.json"
);
export const DEFAULT_SHORT_FORM_SCHEMA_PATH = path.resolve(
  moduleDirectory,
  "../../publishing/short-form-catalog.schema.json"
);
export const DEFAULT_SOURCES_CONFIG_PATH = path.join(
  os.homedir(),
  ".config/drm-publisher/sources.json"
);
export const DEFAULT_PUBLIC_ROOT = path.resolve(moduleDirectory, "../../public");

const schema = JSON.parse(await fs.readFile(DEFAULT_SHORT_FORM_SCHEMA_PATH, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv, { mode: "full" });
const validateSchema = ajv.compile(schema);

export class ShortFormCatalogValidationError extends Error {
  constructor(errors) {
    super(`Short-form catalog is invalid:\n${errors.map((error) => `- ${error}`).join("\n")}`);
    this.name = "ShortFormCatalogValidationError";
    this.errors = errors;
  }
}

function schemaPath(error) {
  const parts = error.instancePath
    .split("/")
    .filter(Boolean)
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
  if (error.keyword === "required") parts.push(error.params.missingProperty);
  if (error.keyword === "additionalProperties") parts.push(error.params.additionalProperty);
  return parts.join(".") || "catalog";
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalValue(item)])
    );
  }
  return value;
}

function duplicateProblems(items, key, label) {
  const seen = new Set();
  const problems = [];
  for (const item of items) {
    const value = key(item);
    if (value === null || value === undefined) continue;
    if (seen.has(value)) problems.push(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
  return problems;
}

function duplicateCopyProblems(items, key, label) {
  const seen = new Map();
  const problems = [];
  for (const item of items) {
    const normalized = String(key(item) ?? "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    if (!normalized) continue;
    const prior = seen.get(normalized);
    if (prior) problems.push(`Duplicate normalized ${label}: ${prior} and ${item.id}`);
    else seen.set(normalized, item.id);
  }
  return problems;
}

function relativeDurationDifference(left, right) {
  return Math.abs(left - right) / Math.max(left, right);
}

export function shortFormCatalogHash(catalog) {
  return createHash("sha256").update(JSON.stringify(canonicalValue(catalog))).digest("hex");
}

export function validateShortFormCatalog(catalog) {
  const validSchema = validateSchema(catalog);
  const errors = validSchema
    ? []
    : validateSchema.errors.map((error) => `${schemaPath(error)} ${error.message}`);

  if (!catalog || !Array.isArray(catalog.items)) return { valid: false, errors };

  errors.push(...duplicateProblems(catalog.items, (item) => item.id, "short ID"));
  errors.push(...duplicateProblems(catalog.items, (item) => item.slug, "short slug"));
  errors.push(
    ...duplicateProblems(
      catalog.items,
      (item) => item.destinations?.instagram?.mediaId,
      "Instagram media ID"
    )
  );
  errors.push(
    ...duplicateProblems(
      catalog.items,
      (item) => item.destinations?.instagram?.shortcode,
      "Instagram shortcode"
    )
  );
  errors.push(
    ...duplicateProblems(
      catalog.items,
      (item) => item.destinations?.vimeo?.state === "published"
        ? item.destinations.vimeo.id
        : null,
      "Vimeo video ID"
    )
  );
  errors.push(
    ...duplicateCopyProblems(
      catalog.items,
      (item) => item.destinationCopy?.instagramCaption,
      "Instagram caption"
    )
  );
  errors.push(
    ...duplicateCopyProblems(
      catalog.items,
      (item) => item.destinationCopy?.vimeoDescription,
      "Vimeo description"
    )
  );

  for (const item of catalog.items) {
    const prefix = item.id ?? "unknown short";
    const instagram = item.destinations?.instagram;
    const vimeo = item.destinations?.vimeo;
    const website = item.destinations?.website;

    if (website?.path !== `/shorts/${item.slug}/`) {
      errors.push(`${prefix} website path must be /shorts/${item.slug}/`);
    }
    if (instagram?.url !== `https://www.instagram.com/reel/${instagram?.shortcode}/`) {
      errors.push(`${prefix} Instagram URL does not match its shortcode`);
    }
    if (item.poster?.sourceMediaId !== instagram?.mediaId) {
      errors.push(`${prefix} poster source does not match its Instagram media ID`);
    }
    if (item.destinationCopy?.vimeoTitle !== item.title) {
      errors.push(`${prefix} Vimeo target title must match the canonical title`);
    }
    if (
      item.master?.durationSeconds &&
      instagram?.remoteDurationSeconds &&
      relativeDurationDifference(item.master.durationSeconds, instagram.remoteDurationSeconds) > 0.001
    ) {
      errors.push(`${prefix} Instagram duration does not match the verified master`);
    }
    if (vimeo?.state === "published" && (!vimeo.id || !vimeo.url)) {
      errors.push(`${prefix} published Vimeo destination is missing its stable ID or URL`);
    }
    if (
      vimeo?.state === "not_published_as_short" &&
      (vimeo.id !== null || vimeo.url !== null || vimeo.observedTitle !== null || vimeo.observedDescription !== null)
    ) {
      errors.push(`${prefix} unpublished Vimeo destination must not claim remote identity or metadata`);
    }
    if (item.contentType === "recipe" && !(item.ingredients?.length > 0)) {
      errors.push(`${prefix} recipe must include an ingredient list`);
    }
    if (item.provenance?.sourceType === "multi_clip_edit" && !(item.provenance.sourceAssets?.length > 0)) {
      errors.push(`${prefix} multi-clip edit must fingerprint its source assets`);
    }
    if (Object.hasOwn(item.destinations ?? {}, "rumble")) {
      errors.push(`${prefix} short-form catalog must not add an unreviewed Rumble destination`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export async function loadShortFormCatalog(catalogPath = DEFAULT_SHORT_FORM_CATALOG_PATH) {
  const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
  const result = validateShortFormCatalog(catalog);
  if (!result.valid) throw new ShortFormCatalogValidationError(result.errors);
  return catalog;
}

export function resolveLogicalAsset(uri, dropboxRoot) {
  if (typeof uri !== "string" || !uri.startsWith("dropbox:")) {
    throw new Error(`Unsupported logical asset URI: ${uri}`);
  }
  if (!path.isAbsolute(dropboxRoot)) throw new Error("Dropbox source root must be absolute.");

  const relativePath = uri.slice("dropbox:".length);
  if (!relativePath || path.isAbsolute(relativePath)) {
    throw new Error(`Invalid project-relative Dropbox asset URI: ${uri}`);
  }

  const resolvedRoot = path.resolve(dropboxRoot);
  const resolved = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Dropbox asset escapes the configured project root: ${uri}`);
  }
  return resolved;
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function verifyFile(filePath, expected, label, problems) {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      problems.push(`${label} is not a regular file: ${filePath}`);
      return;
    }
    if (stat.size !== expected.sizeBytes) {
      problems.push(`${label} size mismatch: expected ${expected.sizeBytes}, found ${stat.size}`);
      return;
    }
    const hash = await sha256File(filePath);
    if (hash !== expected.sha256) {
      problems.push(`${label} SHA-256 mismatch: expected ${expected.sha256}, found ${hash}`);
    }
  } catch (error) {
    problems.push(`${label} cannot be read: ${error.message}`);
  }
}

export async function verifyShortFormCatalogFiles({
  catalog,
  dropboxRoot,
  publicRoot = DEFAULT_PUBLIC_ROOT,
  verifyDropbox = true,
}) {
  const problems = [];
  for (const item of catalog.items) {
    const posterPath = path.resolve(publicRoot, item.poster.websitePath.replace(/^\//, ""));
    const posterRelative = path.relative(path.resolve(publicRoot), posterPath);
    if (posterRelative.startsWith("..") || path.isAbsolute(posterRelative)) {
      problems.push(`${item.id} poster escapes the public directory`);
    } else {
      await verifyFile(posterPath, item.poster, `${item.id} poster`, problems);
    }

    if (!verifyDropbox) continue;
    await verifyFile(
      resolveLogicalAsset(item.master.uri, dropboxRoot),
      item.master,
      `${item.id} master`,
      problems
    );
    for (const [index, source] of item.provenance.sourceAssets.entries()) {
      await verifyFile(
        resolveLogicalAsset(source.uri, dropboxRoot),
        source,
        `${item.id} source ${index + 1}`,
        problems
      );
    }
  }
  return { valid: problems.length === 0, problems };
}

export async function configuredDropboxRoot(
  configPath = process.env.DRM_PUBLISH_SOURCES_CONFIG || DEFAULT_SOURCES_CONFIG_PATH
) {
  const config = JSON.parse(await fs.readFile(configPath, "utf8"));
  const root = config?.roots?.dropbox;
  if (typeof root !== "string" || !path.isAbsolute(root)) {
    throw new Error(`${configPath} does not contain an absolute roots.dropbox path.`);
  }
  return root;
}

async function main() {
  const verifyFiles = process.argv.includes("--verify-files");
  const catalog = await loadShortFormCatalog();
  const summary = {
    valid: true,
    revision: catalog.revision,
    itemCount: catalog.items.length,
    catalogSha256: shortFormCatalogHash(catalog),
  };

  if (verifyFiles) {
    const dropboxRoot = await configuredDropboxRoot();
    const files = await verifyShortFormCatalogFiles({ catalog, dropboxRoot });
    if (!files.valid) throw new ShortFormCatalogValidationError(files.problems);
    summary.filesVerified = true;
  }

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
