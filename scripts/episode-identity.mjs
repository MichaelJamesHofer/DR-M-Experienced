import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CatalogValidationError, validateCatalog } from "./publish/catalog.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(SCRIPT_DIR, "..");
const REMOTE_ID_FIELDS = ["vimeoId", "spotifyId", "youtubeId"];

export function slugFromTitle(title) {
  return (title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "episode";
}

export function normalizeTitleForMatch(title) {
  return (title || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^\s*(?:episode|ep\.?)\s*(?:#?\s*\d+)?\s*(?::|[.\-\u2013\u2014])?\s*/i, "")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function episodeNumberFromTitle(title) {
  const match = (title || "").match(/^(?:Episode|Ep\.)\s*#?(\d+)\b/i);
  return match ? Number(match[1]) : null;
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function addAlias(entry, title) {
  const alias = normalizeTitleForMatch(title);
  if (alias) entry.aliases.add(alias);
}

function setStableId(entry, field, value) {
  if (!value) return;
  if (entry[field] && entry[field] !== value) {
    throw new Error(`Conflicting ${field} values for episode ${entry.number}.`);
  }
  entry[field] = value;
}

function ensureEntry(byNumber, number) {
  let entry = byNumber.get(number);
  if (!entry) {
    entry = {
      key: `episode:${number}`,
      number,
      title: null,
      slug: null,
      guid: null,
      publishDate: null,
      durationMinutes: undefined,
      summary: null,
      description: null,
      thumbnailUrl: null,
      vimeoId: null,
      spotifyId: null,
      spotifyUrl: null,
      youtubeId: null,
      aliases: new Set(),
    };
    byNumber.set(number, entry);
  }
  return entry;
}

function mergeMirrorEpisode(entry, episode) {
  addAlias(entry, episode.title);
  entry.title ||= episode.title || null;
  entry.slug ||= episode.slug || null;
  entry.publishDate ||= episode.publishDate || null;
  entry.summary ||= episode.summary || null;
  entry.thumbnailUrl ||= episode.thumbnailUrl || null;
  entry.spotifyUrl ||= episode.spotifyUrl || null;
  if (entry.durationMinutes == null && episode.durationMinutes != null) {
    entry.durationMinutes = episode.durationMinutes;
  }
  for (const field of REMOTE_ID_FIELDS) setStableId(entry, field, episode[field]);
}

function mergeMasterEpisode(entry, episode, assetRegistry) {
  addAlias(entry, episode.title);
  for (const alias of episode.aliases?.titles || []) addAlias(entry, alias);

  entry.title = episode.title;
  entry.slug = episode.slug;
  entry.guid = episode.rssGuid;
  entry.publishDate = episode.publishDate;
  entry.durationMinutes = episode.durationMinutes ?? entry.durationMinutes;
  entry.summary = episode.websiteSummary;
  entry.description = episode.description?.full || null;

  const thumbnail = assetRegistry?.[episode.assetRefs?.thumbnail];
  entry.thumbnailUrl = thumbnail?.publishedUrl || entry.thumbnailUrl;

  const destinations = episode.destinations || {};
  setStableId(entry, "spotifyId", destinations.spotify?.id);
  setStableId(entry, "youtubeId", destinations.youtube?.id);
  setStableId(entry, "vimeoId", destinations.vimeo?.id);
  entry.spotifyUrl = destinations.spotify?.url || entry.spotifyUrl;
}

export function createEpisodeRegistry({ master = {}, mirrors = [] } = {}) {
  const byNumber = new Map();

  for (const mirror of mirrors) {
    for (const episode of mirror || []) {
      if (!Number.isInteger(episode.number) || episode.number < 1) continue;
      mergeMirrorEpisode(ensureEntry(byNumber, episode.number), episode);
    }
  }

  const masterNumbers = new Set();
  for (const episode of master.episodes || []) {
    const number = episode.number;
    if (!Number.isInteger(number) || number < 1) {
      throw new Error("Every master-catalog episode must have a positive integer number.");
    }
    if (masterNumbers.has(number)) {
      throw new Error(`Duplicate episode number ${number} in master catalog.`);
    }
    masterNumbers.add(number);

    const entry = ensureEntry(byNumber, number);
    mergeMasterEpisode(entry, episode, master.assetRegistry);
  }

  const entries = Array.from(byNumber.values()).sort((a, b) => a.number - b.number);
  const byStableId = new Map();
  const aliasOwners = new Map();

  for (const entry of entries) {
    entry.title ||= `Episode ${entry.number}`;
    entry.slug ||= slugFromTitle(entry.title);
    addAlias(entry, entry.title);

    for (const field of REMOTE_ID_FIELDS) {
      const value = entry[field];
      if (!value) continue;
      const key = `${field}:${value}`;
      const owner = byStableId.get(key);
      if (owner && owner !== entry) throw new Error(`Duplicate stable ID ${key} in episode registry.`);
      byStableId.set(key, entry);
    }

    for (const alias of entry.aliases) {
      const owners = aliasOwners.get(alias) || new Set();
      owners.add(entry);
      aliasOwners.set(alias, owners);
    }
  }

  const byAlias = new Map();
  for (const [alias, owners] of aliasOwners) {
    if (owners.size === 1) byAlias.set(alias, owners.values().next().value);
  }

  return {
    entries,
    byStableId,
    byAlias,
    maxNumber: entries.reduce((max, entry) => Math.max(max, entry.number), 0),
  };
}

export function loadEpisodeRegistry({ projectRoot = PROJECT_ROOT } = {}) {
  const dataDir = path.join(projectRoot, "src", "data");
  const master = readJson(path.join(projectRoot, "publishing", "master-catalog.json"), {});
  const validation = validateCatalog(master);
  if (!validation.valid) throw new CatalogValidationError(validation.errors);
  return createEpisodeRegistry({
    master,
    mirrors: [
      readJson(path.join(dataDir, "episodes-from-platforms.json"), []),
      readJson(path.join(dataDir, "episodes-from-vimeo.json"), []),
    ],
  });
}

export function resolveEpisodeIdentity(registry, candidate) {
  const stableMatches = new Set();
  let hasStableId = false;

  for (const field of REMOTE_ID_FIELDS) {
    const value = candidate[field];
    if (!value) continue;
    hasStableId = true;
    const match = registry.byStableId.get(`${field}:${value}`);
    if (match) stableMatches.add(match);
  }

  if (stableMatches.size > 1) {
    throw new Error("Episode candidate contains stable IDs belonging to different registered episodes.");
  }
  if (stableMatches.size === 1) return stableMatches.values().next().value;
  if (hasStableId) return null;

  return registry.byAlias.get(normalizeTitleForMatch(candidate.title)) || null;
}

export function unregisteredEpisodeKey(candidate) {
  const date = (candidate.publishDate || "").slice(0, 10);
  const title = normalizeTitleForMatch(candidate.title);
  if (title) return `unregistered:${date}:${title}`;

  for (const field of REMOTE_ID_FIELDS) {
    if (candidate[field]) return `unregistered:${field}:${candidate[field]}`;
  }
  return `unregistered:${date}:untitled`;
}

function stableCandidateKey(episode) {
  for (const field of REMOTE_ID_FIELDS) {
    if (episode[field]) return `${field}:${episode[field]}`;
  }
  return normalizeTitleForMatch(episode.title);
}

function compareUnregistered(a, b) {
  const dateA = a.episode.publishDate || "9999-99-99";
  const dateB = b.episode.publishDate || "9999-99-99";
  if (dateA !== dateB) return dateA.localeCompare(dateB);

  const titleOrder = normalizeTitleForMatch(a.episode.title).localeCompare(
    normalizeTitleForMatch(b.episode.title),
  );
  if (titleOrder !== 0) return titleOrder;
  return stableCandidateKey(a.episode).localeCompare(stableCandidateKey(b.episode));
}

export function finalizeResolvedEpisodes(items, registry) {
  const reservedNumbers = new Set(registry.entries.map((entry) => entry.number));
  const unregistered = [];

  for (const item of items) {
    if (!item.identity) {
      unregistered.push(item);
      continue;
    }
    item.episode.number = item.identity.number;
    item.episode.slug = item.identity.slug;
    item.episode.title = item.identity.title;
    item.episode.publishDate = item.identity.publishDate || item.episode.publishDate;
    item.episode.summary = item.identity.summary || item.episode.summary;
    item.episode.thumbnailUrl = item.identity.thumbnailUrl || item.episode.thumbnailUrl;
  }

  let nextNumber = registry.maxNumber + 1;
  unregistered.sort(compareUnregistered);
  for (const item of unregistered) {
    const hintedNumber = episodeNumberFromTitle(item.episode.title);
    if (hintedNumber && !reservedNumbers.has(hintedNumber)) {
      item.episode.number = hintedNumber;
    } else {
      while (reservedNumbers.has(nextNumber)) nextNumber += 1;
      item.episode.number = nextNumber;
      nextNumber += 1;
    }
    reservedNumbers.add(item.episode.number);
    item.episode.slug ||= slugFromTitle(item.episode.title);
  }

  return items
    .sort((a, b) => {
      if (a.episode.number !== b.episode.number) return a.episode.number - b.episode.number;
      return compareUnregistered(a, b);
    })
    .map((item) => item.episode);
}
