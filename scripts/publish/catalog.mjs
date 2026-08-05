import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { XMLParser } from "fast-xml-parser";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CATALOG_PATH = path.resolve(moduleDirectory, "../../publishing/master-catalog.json");
export const DEFAULT_SCHEMA_PATH = path.resolve(moduleDirectory, "../../publishing/master-catalog.schema.json");
const DESTINATIONS = ["spotify", "youtube", "vimeo", "rumble"];
const HTML_VOID_TAGS = [
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
];
const HTML_BLOCK_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "caption",
  "details",
  "dialog",
  "div",
  "dl",
  "dt",
  "dd",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "main",
  "nav",
  "p",
  "pre",
  "section",
  "summary",
  "table",
  "tbody",
  "tfoot",
  "thead",
]);
const HTML_NON_CONTENT_TAGS = new Set(["head", "noscript", "script", "style", "template"]);
const htmlFragmentParser = new XMLParser({
  cdataPropName: "#cdata",
  commentPropName: "#comment",
  htmlEntities: true,
  ignoreAttributes: true,
  maxNestedTags: 200,
  parseTagValue: false,
  preserveOrder: true,
  processEntities: {
    enabled: true,
    maxEntityCount: 1_000,
    maxEntitySize: 1_000,
    maxExpandedLength: 100_000,
    maxExpansionDepth: 8,
    maxTotalExpansions: 1_000,
  },
  transformTagName: (name) => name.toLowerCase(),
  trimValues: false,
  unpairedTags: HTML_VOID_TAGS,
});

const schema = JSON.parse(await fs.readFile(DEFAULT_SCHEMA_PATH, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv, { mode: "full" });
const validateSchema = ajv.compile(schema);

export class CatalogValidationError extends Error {
  constructor(errors) {
    super(`Master catalog is invalid:\n${errors.map((error) => `- ${error}`).join("\n")}`);
    this.name = "CatalogValidationError";
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

export function catalogHash(catalog) {
  return createHash("sha256").update(JSON.stringify(canonicalValue(catalog))).digest("hex");
}

export function episodeHash(episode) {
  return createHash("sha256").update(JSON.stringify(canonicalValue(episode))).digest("hex");
}

function stripNonContentHtml(html) {
  let stripped = html;
  for (const tag of HTML_NON_CONTENT_TAGS) {
    stripped = stripped.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), "");
  }
  return stripped;
}

function renderHtmlList(nodes, ordered) {
  let index = 0;
  let text = "\n";
  for (const node of nodes) {
    if (!node || typeof node !== "object" || !("li" in node)) {
      text += renderHtmlNodes([node]);
      continue;
    }
    index += 1;
    const prefix = ordered ? `${index}. ` : "- ";
    text += `${prefix}${renderHtmlNodes(node.li).trim()}\n`;
  }
  return `${text}\n`;
}

function renderHtmlNodes(nodes) {
  let text = "";
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (!node || typeof node !== "object") continue;
    const tag = Object.keys(node).find((key) => key !== ":@");
    if (!tag || tag === "#comment") continue;
    if (tag === "#text") {
      text += String(node[tag] ?? "");
      continue;
    }
    if (tag === "#cdata") {
      text += renderHtmlNodes(node[tag]);
      continue;
    }
    if (HTML_NON_CONTENT_TAGS.has(tag)) continue;
    if (tag === "br") {
      text += "\n";
      continue;
    }
    if (tag === "hr") {
      text += "\n\n";
      continue;
    }
    if (tag === "ul" || tag === "ol") {
      text += renderHtmlList(node[tag], tag === "ol");
      continue;
    }
    if (tag === "li") {
      text += `\n- ${renderHtmlNodes(node[tag]).trim()}\n`;
      continue;
    }
    if (tag === "tr") {
      text += `\n${renderHtmlNodes(node[tag]).trim()}\n`;
      continue;
    }
    if (tag === "td" || tag === "th") {
      text += `${renderHtmlNodes(node[tag]).trim()} | `;
      continue;
    }
    const content = renderHtmlNodes(node[tag]);
    text += HTML_BLOCK_TAGS.has(tag) ? `\n\n${content}\n\n` : content;
  }
  return text;
}

/**
 * Converts the catalog's trusted HTML description fragment into stable copy for
 * destinations that accept plain text. The projection intentionally preserves
 * visible Unicode while normalizing markup-only spacing and block boundaries.
 */
export function htmlDescriptionToPlainText(html) {
  if (typeof html !== "string") throw new TypeError("HTML description must be a string.");
  if (!html) return "";

  const fragment = stripNonContentHtml(html).replace(
    /<(?!(?:\/?[A-Za-z][A-Za-z0-9:-]*(?=[\s/>])|!--|!\[CDATA\[|!DOCTYPE(?=[\s>])|\?))/g,
    "&lt;"
  );
  const document = htmlFragmentParser.parse(`<drm-description>${fragment}</drm-description>`);
  const root = document.find((node) => node && typeof node === "object" && "drm-description" in node);
  if (!root) throw new Error("HTML description could not be parsed as a fragment.");

  return renderHtmlNodes(root["drm-description"])
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Produces YouTube-safe text without angle brackets, which Studio rejects in
 * video descriptions even when they are intended as comparison operators.
 */
export function youtubeDescriptionFromHtml(html) {
  return htmlDescriptionToPlainText(html)
    .replace(/>\s*/g, "greater than ")
    .replace(/<\s*/g, "less than ");
}

function duplicateValues(items, select) {
  const firstIndex = new Map();
  const duplicates = [];
  items.forEach((item, index) => {
    const value = select(item);
    if (value == null) return;
    if (firstIndex.has(value)) duplicates.push({ value, first: firstIndex.get(value), duplicate: index });
    else firstIndex.set(value, index);
  });
  return duplicates;
}

function parseLogicalRef(ref) {
  if (typeof ref !== "string" || !ref) throw new Error("Asset reference must be a non-empty string.");
  if (path.isAbsolute(ref) || /^[A-Za-z]:[\\/]/.test(ref)) {
    throw new Error(`Absolute asset references are not allowed: ${ref}`);
  }
  const separator = ref.indexOf(":");
  if (separator <= 0) throw new Error(`Asset reference must use a named source such as dropbox:path: ${ref}`);
  const source = ref.slice(0, separator);
  const relative = ref.slice(separator + 1);
  if (!/^[a-z][a-z0-9+.-]*$/.test(source)) throw new Error(`Invalid asset source name: ${source}`);
  if (!relative || relative.startsWith("/") || relative.startsWith("\\") || relative.includes("\\")) {
    throw new Error(`Asset reference path must be portable and relative: ${ref}`);
  }
  const segments = relative.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("\0"))) {
    throw new Error(`Asset reference contains an unsafe path segment: ${ref}`);
  }
  return { source, relative, segments };
}

function identityUrlMatches(platform, identity) {
  let url;
  try {
    url = new URL(identity.url);
  } catch {
    return false;
  }
  if (platform === "spotify") {
    return url.hostname === "open.spotify.com" && url.pathname === `/episode/${identity.id}`;
  }
  if (platform === "youtube") {
    return (
      (url.hostname === "www.youtube.com" && url.pathname === "/watch" && url.searchParams.get("v") === identity.id) ||
      (url.hostname === "youtu.be" && url.pathname === `/${identity.id}`)
    );
  }
  if (platform === "vimeo") {
    return url.hostname === "vimeo.com" && url.pathname === `/${identity.id}`;
  }
  if (platform === "rumble") {
    const page = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return url.hostname === "rumble.com" && (page === `${identity.id}.html` || page.startsWith(`${identity.id}-`));
  }
  return false;
}

function semanticErrors(catalog) {
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) return [];
  const errors = [];
  const episodes = Array.isArray(catalog.episodes) ? catalog.episodes : [];

  for (const [label, select] of [
    ["episode number", (episode) => episode.number],
    ["episode slug", (episode) => episode.slug],
    ["RSS GUID", (episode) => episode.rssGuid],
  ]) {
    for (const duplicate of duplicateValues(episodes, select)) {
      errors.push(`Duplicate ${label} ${JSON.stringify(duplicate.value)} at episodes ${duplicate.first} and ${duplicate.duplicate}.`);
    }
  }

  const numbers = episodes.map((episode) => episode.number).sort((left, right) => left - right);
  if (numbers.some((number, index) => number !== index + 1)) {
    errors.push(`Episode numbers must be the complete immutable sequence 1 through ${numbers.length}.`);
  }

  const destinationIds = new Map();
  for (const [episodeIndex, episode] of episodes.entries()) {
    for (const platform of DESTINATIONS) {
      const identity = episode.destinations?.[platform];
      if (!identity || typeof identity.id !== "string") continue;
      const key = `${platform}:${identity.id}`;
      if (destinationIds.has(key)) {
        errors.push(`Duplicate destination ID ${key} at episodes ${destinationIds.get(key)} and ${episodeIndex}.`);
      } else {
        destinationIds.set(key, episodeIndex);
      }
      if (!identityUrlMatches(platform, identity)) {
        errors.push(`episodes.${episodeIndex}.destinations.${platform}.url does not match stable ID ${identity.id}.`);
      }
    }
  }

  const assetRegistry = catalog.assetRegistry && typeof catalog.assetRegistry === "object" ? catalog.assetRegistry : {};
  const assetUris = new Map();
  for (const [assetId, asset] of Object.entries(assetRegistry)) {
    try {
      parseLogicalRef(asset?.uri);
    } catch (error) {
      errors.push(`assetRegistry.${assetId}.uri: ${error.message}`);
    }
    if (typeof asset?.uri === "string") {
      if (assetUris.has(asset.uri)) errors.push(`Duplicate asset URI ${asset.uri} for ${assetUris.get(asset.uri)} and ${assetId}.`);
      else assetUris.set(asset.uri, assetId);
    }
    if (asset?.status === "verified" && (asset.sha256 == null || asset.sizeBytes == null)) {
      errors.push(`assetRegistry.${assetId} cannot be verified without sha256 and sizeBytes.`);
    }
  }

  const artworkRoles = catalog.show?.artworkRefs ?? {};
  for (const [role, assetId] of Object.entries(artworkRoles)) {
    const asset = assetRegistry[assetId];
    if (!asset) errors.push(`show.artworkRefs.${role} references missing asset ${assetId}.`);
    else if (asset.kind !== "image" || asset.role !== role) {
      errors.push(`show.artworkRefs.${role} must reference an image with role ${role}.`);
    }
  }

  for (const [episodeIndex, episode] of episodes.entries()) {
    for (const [role, assetId] of Object.entries(episode.assetRefs ?? {})) {
      if (assetId == null) continue;
      const asset = assetRegistry[assetId];
      if (!asset) errors.push(`episodes.${episodeIndex}.assetRefs.${role} references missing asset ${assetId}.`);
      else if (asset.role !== role) errors.push(`episodes.${episodeIndex}.assetRefs.${role} references an asset with role ${asset.role}.`);
    }
  }

  const shortCopy = catalog.show?.profileCopy?.short;
  const longCopy = catalog.show?.profileCopy?.long;
  if (typeof shortCopy === "string" && typeof longCopy === "string" && !longCopy.startsWith(shortCopy)) {
    errors.push("show.profileCopy.long must begin with the exact canonical short copy.");
  }

  const retiredNames = /The Dr\. M Experience|Dr\. M[’']s (?:Functional Medicine &amp; Sports|Experienced, Functional &amp; Sports Medicine) Podcast/i;
  for (const [episodeIndex, episode] of episodes.entries()) {
    if (typeof episode.description?.full === "string" && retiredNames.test(episode.description.full)) {
      errors.push(`episodes.${episodeIndex}.description.full contains a retired show name.`);
    }
  }
  return errors;
}

export function validateCatalog(catalog) {
  const validSchema = validateSchema(catalog);
  const errors = validSchema
    ? []
    : (validateSchema.errors ?? []).map((error) => `${schemaPath(error)} ${error.message}.`);
  errors.push(...semanticErrors(catalog));
  return { valid: errors.length === 0, errors };
}

export async function loadCatalog(catalogPath = DEFAULT_CATALOG_PATH) {
  const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
  const result = validateCatalog(catalog);
  if (!result.valid) throw new CatalogValidationError(result.errors);
  return catalog;
}

export function findEpisode(catalog, selector) {
  if (typeof selector === "number") {
    return catalog.episodes.find((episode) => episode.number === selector) ?? null;
  }
  if (typeof selector === "string") {
    return (
      catalog.episodes.find(
        (episode) =>
          episode.slug === selector ||
          episode.rssGuid === selector ||
          DESTINATIONS.some((platform) => episode.destinations[platform]?.id === selector)
      ) ?? null
    );
  }
  if (selector && typeof selector === "object" && DESTINATIONS.includes(selector.platform)) {
    if (typeof selector.id !== "string" || !selector.id.trim()) {
      throw new TypeError("Destination episode selector id must be a non-empty string.");
    }
    return (
      catalog.episodes.find((episode) => episode.destinations[selector.platform]?.id === selector.id) ?? null
    );
  }
  throw new TypeError("Episode selector must be a number, identity string, or { platform, id } object.");
}

function feedGuid(value) {
  if (typeof value !== "string") return null;
  const guid = value.trim();
  return guid || null;
}

function feedEpisodeNumber(value) {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

/**
 * Compares a parsed podcast feed with the published portion of the master
 * catalog. Feed item order is irrelevant; GUIDs bind titles and structured
 * episode numbers to their catalog episodes.
 */
export function comparePublishedCatalogFeed(catalog, feed) {
  if (!catalog || !Array.isArray(catalog.episodes)) {
    throw new TypeError("Master catalog must contain an episodes array.");
  }
  if (!feed || !Array.isArray(feed.episodes)) {
    throw new TypeError("Parsed podcast feed must contain an episodes array.");
  }

  const publishedEpisodes = catalog.episodes.filter(
    (episode) => episode?.publicationState === "published"
  );
  const feedEpisodes = feed.episodes;
  const expectedByGuid = new Map(
    publishedEpisodes.map((episode) => [episode.rssGuid, episode])
  );
  const feedByGuid = new Map();
  const missingGuidIndexes = [];

  for (const [index, episode] of feedEpisodes.entries()) {
    const guid = feedGuid(episode?.guid);
    if (!guid) {
      missingGuidIndexes.push(index);
      continue;
    }
    const matches = feedByGuid.get(guid) ?? [];
    matches.push(episode);
    feedByGuid.set(guid, matches);
  }

  const expectedGuids = [...expectedByGuid.keys()];
  const actualGuids = [...feedByGuid.keys()];
  const missingGuids = expectedGuids.filter((guid) => !feedByGuid.has(guid));
  const extraGuids = actualGuids.filter((guid) => !expectedByGuid.has(guid));
  const duplicateGuids = [...feedByGuid.entries()]
    .filter(([, episodes]) => episodes.length > 1)
    .map(([guid, episodes]) => ({ guid, count: episodes.length }));

  const titleMismatches = [];
  const episodeNumberMismatches = [];
  for (const [guid, expected] of expectedByGuid) {
    const matches = feedByGuid.get(guid) ?? [];
    const actualTitles = matches.map((episode) => episode?.title ?? null);
    if (matches.length !== 1 || actualTitles[0] !== expected.title) {
      titleMismatches.push({ guid, expected: expected.title, actual: actualTitles });
    }

    const actualNumbers = matches.map((episode) => feedEpisodeNumber(episode?.episodeNumber));
    if (matches.length !== 1 || actualNumbers[0] !== expected.number) {
      episodeNumberMismatches.push({ guid, expected: expected.number, actual: actualNumbers });
    }
  }

  const legacyTitleEpisodes = feedEpisodes
    .map((episode, index) => ({ index, guid: feedGuid(episode?.guid), title: episode?.title ?? null }))
    .filter(
      (episode) =>
        typeof episode.title === "string" &&
        /^(?:Episode|Ep\.?)\s*#?\s*\d+\b/i.test(episode.title)
    );
  const expectedStructuredEpisodeNumbers = publishedEpisodes
    .map((episode) => episode.number)
    .sort((left, right) => left - right);
  const actualStructuredEpisodeNumbers = feedEpisodes
    .map((episode) => feedEpisodeNumber(episode?.episodeNumber))
    .filter((number) => number != null)
    .sort((left, right) => left - right);

  const episodeCountMatches = feedEpisodes.length === publishedEpisodes.length;
  const guidSetMatches = missingGuids.length === 0 && extraGuids.length === 0;
  const uniqueGuids = missingGuidIndexes.length === 0 && duplicateGuids.length === 0;
  const titleMatches = titleMismatches.length === 0;
  const structuredNumbersMatch = episodeNumberMismatches.length === 0;
  const noLegacyTitlePrefixes = legacyTitleEpisodes.length === 0;

  return {
    ok:
      episodeCountMatches &&
      guidSetMatches &&
      uniqueGuids &&
      titleMatches &&
      structuredNumbersMatch &&
      noLegacyTitlePrefixes,
    expectedEpisodeCount: publishedEpisodes.length,
    actualEpisodeCount: feedEpisodes.length,
    episodeCountMatches,
    guidSetMatches,
    uniqueGuids,
    titleMatches,
    structuredNumbersMatch,
    noLegacyTitlePrefixes,
    expectedStructuredEpisodeNumbers,
    actualStructuredEpisodeNumbers,
    missingGuids,
    extraGuids,
    duplicateGuids,
    missingGuidIndexes,
    titleMismatches,
    episodeNumberMismatches,
    legacyTitleEpisodes,
  };
}

export function manifestCatalogProblems(manifest, episode) {
  if (!episode || typeof episode !== "object") return ["Master catalog episode is missing or invalid."];
  const problems = [];
  const expectedFields = [
    ["episodeNumber", episode.number],
    ["slug", episode.slug],
    ["title", episode.title],
  ];

  for (const [field, expected] of expectedFields) {
    if (manifest?.[field] !== expected) {
      problems.push(`${field} does not match the master catalog (expected ${JSON.stringify(expected)}).`);
    }
  }
  if (manifest?.description !== episode.description?.full) {
    problems.push("description does not match the master catalog description.full.");
  }

  for (const field of ["explicit", "madeForKids", "containsSyntheticMedia", "paidPromotion"]) {
    const expected = episode.contentFlags?.[field];
    if (expected != null && manifest?.[field] !== expected) {
      problems.push(`${field} does not match the master catalog (expected ${expected}).`);
    }
  }
  return problems;
}

export function catalogAssetBindingProblems(catalog, episode, inspectedAssets) {
  const errors = [];
  const warnings = [];
  for (const [role, inspected] of Object.entries(inspectedAssets ?? {})) {
    if (!inspected) continue;
    const assetId = episode.assetRefs?.[role];
    if (!assetId) {
      errors.push(`${role} is supplied by the manifest but the master catalog episode has no asset reference.`);
      continue;
    }
    const registered = catalog.assetRegistry?.[assetId];
    if (!registered) {
      errors.push(`${role} references missing master catalog asset ${assetId}.`);
      continue;
    }
    if (registered.status !== "verified") {
      warnings.push(`${role}: master catalog asset ${assetId} is not fingerprint-verified.`);
      continue;
    }
    if (inspected.sha256 !== registered.sha256) {
      errors.push(`${role} SHA-256 does not match verified master catalog asset ${assetId}.`);
    }
    if (inspected.sizeBytes !== registered.sizeBytes) {
      errors.push(`${role} byte size does not match verified master catalog asset ${assetId}.`);
    }
  }
  return { errors, warnings };
}

export function sourcesConfigPath(env = process.env) {
  if (env.DRM_PUBLISH_SOURCES_CONFIG) return path.resolve(env.DRM_PUBLISH_SOURCES_CONFIG);
  const configRoot = env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(configRoot, "drm-publisher", "sources.json");
}

async function readSourcesConfig(configPath) {
  const config = JSON.parse(await fs.readFile(configPath, "utf8"));
  if (!config || typeof config !== "object" || Array.isArray(config) || !config.roots || typeof config.roots !== "object") {
    throw new Error(`Sources config must contain a roots object: ${configPath}`);
  }
  return config;
}

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

async function deepestExistingPath(candidate, root) {
  let current = candidate;
  for (;;) {
    try {
      await fs.lstat(current);
      return current;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (current === root) return root;
    const parent = path.dirname(current);
    if (parent === current || !isWithin(root, parent)) return root;
    current = parent;
  }
}

export async function resolveSourceRef(ref, options = {}) {
  const { source, segments } = parseLogicalRef(ref);
  const configPath = options.configPath ?? sourcesConfigPath(options.env);
  const config = await readSourcesConfig(configPath);
  const configuredRoot = config.roots[source];
  if (typeof configuredRoot !== "string" || !path.isAbsolute(configuredRoot)) {
    throw new Error(`Source ${source} must have an absolute local root in ${configPath}.`);
  }
  const root = await fs.realpath(configuredRoot);
  const candidate = path.resolve(root, ...segments);
  if (!isWithin(root, candidate)) throw new Error(`Asset reference escapes configured source root: ${ref}`);

  const existing = await deepestExistingPath(candidate, root);
  const existingReal = await fs.realpath(existing);
  if (!isWithin(root, existingReal)) throw new Error(`Asset reference escapes configured source root through a symlink: ${ref}`);

  try {
    const targetReal = await fs.realpath(candidate);
    if (!isWithin(root, targetReal)) throw new Error(`Asset reference escapes configured source root through a symlink: ${ref}`);
    return targetReal;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return candidate;
  }
}

export async function resolveCatalogAsset(catalog, assetId, options = {}) {
  const asset = catalog.assetRegistry?.[assetId];
  if (!asset) throw new Error(`Unknown catalog asset: ${assetId}`);
  return resolveSourceRef(asset.uri, options);
}
