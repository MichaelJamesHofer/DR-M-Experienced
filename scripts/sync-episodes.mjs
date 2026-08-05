#!/usr/bin/env node
/**
 * Fetches episodes from Vimeo, Spotify, and YouTube, merges by registered
 * stable identity first, and writes episodes-from-platforms.json.
 * Run before build so the site uses the latest episodes in posting order.
 *
 * Env:
 *   VIMEO_ACCESS_TOKEN   - Vimeo API token (developer.vimeo.com/apps)
 *   SPOTIFY_CLIENT_ID   - Spotify app client ID
 *   SPOTIFY_CLIENT_SECRET - Spotify app client secret
 *   SPOTIFY_SHOW_ID     - Spotify show ID (from show URL; default: Dr. M show)
 *   YOUTUBE_API_KEY     - YouTube Data API v3 key
 *   YOUTUBE_CHANNEL_ID  - Stable YouTube channel ID (optional; defaults to the Dr. M channel)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  finalizeResolvedEpisodes,
  loadEpisodeRegistry,
  resolveEpisodeIdentity,
  slugFromTitle,
  unregisteredEpisodeKey,
} from "./episode-identity.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(__dirname, "..", "src", "data");
const OUT_PATH = path.join(DATA_DIR, "episodes-from-platforms.json");
const MASTER_CATALOG_PATH = path.join(PROJECT_ROOT, "publishing", "master-catalog.json");
const SPOTIFY_SHOW_ID = process.env.SPOTIFY_SHOW_ID || "7GGLljxmO0G3FLjPy8vfcw";
const YOUTUBE_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || "UCFA1nVv4lKMBlx81gjMAOFQ";

function apiError(platform, response) {
  const detail = response.statusText ? ` ${response.statusText}` : "";
  return new Error(`${platform} API error ${response.status}${detail}`);
}

function requireArray(value, platform, field) {
  if (!Array.isArray(value)) {
    throw new Error(`${platform} API returned an invalid ${field} payload.`);
  }
  return value;
}

export function loadPublishedCatalogSeeds({ catalogPath = MASTER_CATALOG_PATH } = {}) {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const assetRegistry = catalog.assetRegistry || {};

  return (catalog.episodes || [])
    .filter((episode) => episode.publicationState === "published")
    .map((episode) => ({
      title: episode.title,
      publishDate: episode.publishDate,
      durationMinutes: episode.durationMinutes,
      summary: episode.websiteSummary,
      slug: episode.slug,
      vimeoId: episode.destinations?.vimeo?.id || null,
      spotifyId: episode.destinations?.spotify?.id || null,
      spotifyUrl: episode.destinations?.spotify?.url || null,
      youtubeId: episode.destinations?.youtube?.id || null,
      thumbnailUrl: assetRegistry[episode.assetRefs?.thumbnail]?.publishedUrl,
    }));
}

// ---------- Vimeo ----------
export async function fetchVimeo({
  token = process.env.VIMEO_ACCESS_TOKEN,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!token) return [];

  const out = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = new URL("https://api.vimeo.com/me/videos");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("sort", "date");
    url.searchParams.set("direction", "desc");
    url.searchParams.set("page", String(page));
    url.searchParams.set("fields", "uri,name,description,duration,created_time,pictures");

    const res = await fetchImpl(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!res.ok) {
      throw apiError("Vimeo", res);
    }
    const data = await res.json();
    const list = requireArray(data.data, "Vimeo", "data");
    for (const v of list) {
      const uri = v.uri || "";
      const vimeoId = uri.replace(/^\/videos\//, "") || null;
      out.push({
        platform: "vimeo",
        title: v.name || "Untitled",
        publishDate: (v.created_time || "").slice(0, 10),
        durationMinutes: v.duration != null ? Math.round(Number(v.duration) / 60) : undefined,
        summary: (v.description || "").trim(),
        vimeoId,
        thumbnailUrl: vimeoId ? `https://vumbnail.com/${vimeoId}.jpg` : undefined,
      });
    }
    hasMore = list.length === 100 && (data.total || 0) > out.length;
    page += 1;
  }
  return out;
}

// ---------- Spotify ----------
async function getSpotifyToken({ id, secret, fetchImpl }) {
  if (!id && !secret) return null;
  if (!id || !secret) {
    throw new Error("Spotify credentials are incomplete; both client ID and secret are required.");
  }
  const res = await fetchImpl("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(id + ":" + secret).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw apiError("Spotify token", res);
  const data = await res.json();
  if (!data.access_token) throw new Error("Spotify token response did not include an access token.");
  return data.access_token;
}

export async function fetchSpotify({
  id = process.env.SPOTIFY_CLIENT_ID,
  secret = process.env.SPOTIFY_CLIENT_SECRET,
  showId = SPOTIFY_SHOW_ID,
  fetchImpl = globalThis.fetch,
} = {}) {
  const token = await getSpotifyToken({ id, secret, fetchImpl });
  if (!token) return [];

  const out = [];
  let offset = 0;
  const limit = 50;

  while (true) {
    const url = `https://api.spotify.com/v1/shows/${showId}/episodes?limit=${limit}&offset=${offset}&market=US`;
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!res.ok) {
      throw apiError("Spotify", res);
    }
    const data = await res.json();
    const items = requireArray(data.items, "Spotify", "items");
    for (const e of items) {
      const spotifyId = e.id;
      const spotifyUrl = e.external_urls?.spotify || `https://open.spotify.com/episode/${spotifyId}`;
      const img = e.images?.[0]?.url;
      out.push({
        platform: "spotify",
        title: e.name || "Untitled",
        publishDate: (e.release_date || "").slice(0, 10),
        durationMinutes: e.duration_ms != null ? Math.round(e.duration_ms / 60000) : undefined,
        summary: (e.description || "").replace(/<[^>]+>/g, "").trim().slice(0, 500),
        spotifyId,
        spotifyUrl,
        thumbnailUrl: img || undefined,
      });
    }
    if (items.length < limit) break;
    offset += limit;
  }
  return out;
}

// ---------- YouTube ----------
async function getYouTubeUploadsPlaylistId({ apiKey, channelId, fetchImpl }) {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "contentDetails");
  url.searchParams.set("id", channelId);
  url.searchParams.set("key", apiKey);
  const res = await fetchImpl(url.toString());
  if (!res.ok) throw apiError("YouTube channels", res);
  const data = await res.json();
  const channel = requireArray(data.items, "YouTube channels", "items")[0];
  return channel?.contentDetails?.relatedPlaylists?.uploads || null;
}

export async function fetchYouTube({
  apiKey = process.env.YOUTUBE_API_KEY,
  channelId = YOUTUBE_CHANNEL_ID,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!apiKey) return [];

  const playlistId = await getYouTubeUploadsPlaylistId({ apiKey, channelId, fetchImpl });
  if (!playlistId) {
    throw new Error(`YouTube could not resolve the uploads playlist for ${channelId}.`);
  }

  const out = [];
  let pageToken = null;

  do {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("key", apiKey);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetchImpl(url.toString());
    if (!res.ok) {
      throw apiError("YouTube playlist", res);
    }
    const data = await res.json();
    const items = requireArray(data.items, "YouTube playlist", "items");
    for (const item of items) {
      const vid = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
      const sn = item.snippet || {};
      const published = (sn.publishedAt || "").slice(0, 10);
      const thumb = sn.thumbnails?.high?.url || sn.thumbnails?.medium?.url || sn.thumbnails?.default?.url;
      out.push({
        platform: "youtube",
        title: sn.title || "Untitled",
        publishDate: published,
        durationMinutes: undefined,
        summary: (sn.description || "").trim().slice(0, 500),
        youtubeId: vid || undefined,
        thumbnailUrl: thumb || (vid ? `https://img.youtube.com/vi/${vid}/hqdefault.jpg` : undefined),
      });
    }
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return out;
}

// ---------- Merge: registered stable IDs first; normalized title/date only for new episodes ----------
export function mergeAndSort(
  vimeoList,
  spotifyList,
  youtubeList,
  registry = loadEpisodeRegistry(),
  catalogSeeds = [],
) {
  const byKey = new Map();

  function add(candidate, platform) {
    const title = candidate.title || "Untitled";
    const date = (candidate.publishDate || "").slice(0, 10);
    const identity = resolveEpisodeIdentity(registry, candidate);
    const key = identity?.key || unregisteredEpisodeKey(candidate);
    let resolved = byKey.get(key);
    if (!resolved) {
      const episode = {
        title: identity?.title || title,
        publishDate: identity?.publishDate || date,
        durationMinutes: identity?.durationMinutes ?? candidate.durationMinutes,
        summary: identity?.summary || candidate.summary || title,
        slug: identity?.slug || slugFromTitle(title),
        vimeoId: identity?.vimeoId || null,
        spotifyId: identity?.spotifyId || null,
        spotifyUrl: identity?.spotifyUrl || null,
        youtubeId: identity?.youtubeId || null,
        thumbnailUrl: identity?.thumbnailUrl || candidate.thumbnailUrl,
      };
      resolved = { episode, identity };
      byKey.set(key, resolved);
    }
    const existing = resolved.episode;
    if (!existing.publishDate && date) existing.publishDate = date;
    if (platform === "vimeo" && candidate.vimeoId) {
      existing.vimeoId = candidate.vimeoId;
      if (!identity?.thumbnailUrl && candidate.thumbnailUrl) existing.thumbnailUrl = candidate.thumbnailUrl;
      if (candidate.durationMinutes != null) existing.durationMinutes = candidate.durationMinutes;
      if (!identity?.summary && candidate.summary) existing.summary = candidate.summary;
    }
    if (platform === "spotify" && candidate.spotifyId) {
      existing.spotifyId = candidate.spotifyId;
      if (candidate.spotifyUrl) existing.spotifyUrl = candidate.spotifyUrl;
      if (!identity?.thumbnailUrl && !existing.thumbnailUrl && candidate.thumbnailUrl) existing.thumbnailUrl = candidate.thumbnailUrl;
      if (candidate.durationMinutes != null) existing.durationMinutes = candidate.durationMinutes;
      if (!identity?.summary && candidate.summary) existing.summary = existing.summary || candidate.summary;
    }
    if (platform === "youtube" && candidate.youtubeId) {
      existing.youtubeId = candidate.youtubeId;
      if (!identity?.thumbnailUrl && !existing.thumbnailUrl && candidate.thumbnailUrl) existing.thumbnailUrl = candidate.thumbnailUrl;
      if (candidate.durationMinutes != null) existing.durationMinutes = candidate.durationMinutes;
      if (!identity?.summary && candidate.summary) existing.summary = existing.summary || candidate.summary;
    }
  }

  for (const e of catalogSeeds) add(e, "catalog");
  for (const e of vimeoList) add(e, "vimeo");
  for (const e of spotifyList) add(e, "spotify");
  for (const e of youtubeList) add(e, "youtube");

  return finalizeResolvedEpisodes(Array.from(byKey.values()), registry);
}

function writeProjectionAtomically(outPath, episodes) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const temporaryPath = `${outPath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, JSON.stringify(episodes, null, 2), "utf8");
    fs.renameSync(temporaryPath, outPath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath);
  }
}

export async function syncEpisodes({
  registry = loadEpisodeRegistry(),
  catalogSeeds = loadPublishedCatalogSeeds(),
  outPath = OUT_PATH,
  fetchVimeoEpisodes = fetchVimeo,
  fetchSpotifyEpisodes = fetchSpotify,
  fetchYouTubeEpisodes = fetchYouTube,
} = {}) {
  // Fetch every configured source before touching the current projection. Any
  // rejected request leaves the last known-good file byte-for-byte intact.
  const [vimeoList, spotifyList, youtubeList] = await Promise.all([
    fetchVimeoEpisodes(),
    fetchSpotifyEpisodes(),
    fetchYouTubeEpisodes(),
  ]);

  const merged = mergeAndSort(
    vimeoList,
    spotifyList,
    youtubeList,
    registry,
    catalogSeeds,
  );
  if (!merged.length) {
    throw new Error("Sync produced no episodes; refusing to replace the current projection.");
  }

  writeProjectionAtomically(outPath, merged);
  return {
    episodes: merged,
    counts: {
      vimeo: vimeoList.length,
      spotify: spotifyList.length,
      youtube: youtubeList.length,
    },
  };
}

async function main() {
  const hasVimeo = !!process.env.VIMEO_ACCESS_TOKEN;
  const hasSpotifyConfig = !!process.env.SPOTIFY_CLIENT_ID || !!process.env.SPOTIFY_CLIENT_SECRET;
  const hasYouTube = !!process.env.YOUTUBE_API_KEY;

  if (!hasVimeo && !hasSpotifyConfig && !hasYouTube) {
    console.warn("No platform tokens set. Using existing episodes-from-platforms.json or master catalog.");
    const existing = path.join(DATA_DIR, "episodes-from-platforms.json");
    if (!fs.existsSync(existing)) {
      const registry = loadEpisodeRegistry();
      const seeded = mergeAndSort([], [], [], registry, loadPublishedCatalogSeeds());
      if (!seeded.length) throw new Error("Master catalog has no published episodes to project.");
      writeProjectionAtomically(existing, seeded);
      console.warn("Created episodes-from-platforms.json from the published master catalog.");
    }
    return;
  }

  const result = await syncEpisodes();
  if (result.counts.vimeo) console.log("Vimeo:", result.counts.vimeo);
  if (result.counts.spotify) console.log("Spotify:", result.counts.spotify);
  if (result.counts.youtube) console.log("YouTube:", result.counts.youtube);
  console.log(`Synced ${result.episodes.length} episode(s) to ${OUT_PATH}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
