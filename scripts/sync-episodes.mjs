#!/usr/bin/env node
/**
 * Fetches episodes from Vimeo, Spotify, and YouTube, merges by title/date,
 * sorts by publish date (oldest first), and writes episodes-from-platforms.json.
 * Run before build so the site uses the latest episodes in posting order.
 *
 * Env:
 *   VIMEO_ACCESS_TOKEN   - Vimeo API token (developer.vimeo.com/apps)
 *   SPOTIFY_CLIENT_ID   - Spotify app client ID
 *   SPOTIFY_CLIENT_SECRET - Spotify app client secret
 *   SPOTIFY_SHOW_ID     - Spotify show ID (from show URL; default: Dr. M show)
 *   YOUTUBE_API_KEY     - YouTube Data API v3 key
 *   YOUTUBE_CHANNEL_USERNAME - Channel handle e.g. drmexperienced (optional; used to find uploads)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "src", "data");
const OUT_PATH = path.join(DATA_DIR, "episodes-from-platforms.json");
const FALLBACK_PATH = path.join(DATA_DIR, "episodes-from-vimeo.json");

const SPOTIFY_SHOW_ID = process.env.SPOTIFY_SHOW_ID || "7GGLljxmO0G3FLjPy8vfcw";
const YOUTUBE_CHANNEL = process.env.YOUTUBE_CHANNEL_USERNAME || "drmexperienced";

function slugFromTitle(title) {
  return (title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "episode";
}

function normalizeTitle(s) {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function episodeNumberFromTitle(title) {
  const match = (title || "").match(/^(?:Episode|Ep\.)\s*#?(\d+)\b/i);
  return match ? Number(match[1]) : null;
}

// ---------- Vimeo ----------
async function fetchVimeo() {
  const token = process.env.VIMEO_ACCESS_TOKEN;
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

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn("Vimeo API error", res.status, await res.text());
      return out;
    }
    const data = await res.json();
    const list = data.data || [];
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
async function getSpotifyToken() {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(id + ":" + secret).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token || null;
}

async function fetchSpotify() {
  const token = await getSpotifyToken();
  if (!token) return [];

  const out = [];
  let offset = 0;
  const limit = 50;

  while (true) {
    const url = `https://api.spotify.com/v1/shows/${SPOTIFY_SHOW_ID}/episodes?limit=${limit}&offset=${offset}&market=US`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn("Spotify API error", res.status, await res.text());
      return out;
    }
    const data = await res.json();
    const items = data.items || [];
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
async function getYouTubeUploadsPlaylistId(apiKey) {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "contentDetails");
  url.searchParams.set("forUsername", YOUTUBE_CHANNEL);
  url.searchParams.set("key", apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await res.json();
  const channel = data.items?.[0];
  return channel?.contentDetails?.relatedPlaylists?.uploads || null;
}

async function fetchYouTube() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

  const playlistId = await getYouTubeUploadsPlaylistId(apiKey);
  if (!playlistId) {
    console.warn("YouTube: could not get uploads playlist for", YOUTUBE_CHANNEL);
    return [];
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

    const res = await fetch(url.toString());
    if (!res.ok) {
      console.warn("YouTube API error", res.status, await res.text());
      return out;
    }
    const data = await res.json();
    const items = data.items || [];
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

// ---------- Merge: same episode can appear on multiple platforms; dedupe by title + date ----------
function mergeAndSort(vimeoList, spotifyList, youtubeList) {
  const byKey = new Map(); // key = normalizedTitle + "|" + publishDate (or title-only for fuzzy)

  function add(candidate, platform) {
    const title = candidate.title || "Untitled";
    const date = (candidate.publishDate || "").slice(0, 10);
    const key = normalizeTitle(title) + "|" + date;
    let existing = byKey.get(key);
    if (!existing) {
      existing = {
        title,
        publishDate: date,
        durationMinutes: candidate.durationMinutes,
        summary: candidate.summary || title,
        slug: slugFromTitle(title),
        vimeoId: null,
        spotifyId: null,
        spotifyUrl: null,
        youtubeId: null,
        thumbnailUrl: candidate.thumbnailUrl,
      };
      byKey.set(key, existing);
    }
    if (platform === "vimeo" && candidate.vimeoId) {
      existing.vimeoId = candidate.vimeoId;
      if (candidate.thumbnailUrl) existing.thumbnailUrl = candidate.thumbnailUrl;
      if (candidate.durationMinutes != null) existing.durationMinutes = candidate.durationMinutes;
      if (candidate.summary) existing.summary = candidate.summary;
    }
    if (platform === "spotify" && candidate.spotifyId) {
      existing.spotifyId = candidate.spotifyId;
      existing.spotifyUrl = candidate.spotifyUrl;
      if (!existing.thumbnailUrl && candidate.thumbnailUrl) existing.thumbnailUrl = candidate.thumbnailUrl;
      if (candidate.durationMinutes != null) existing.durationMinutes = candidate.durationMinutes;
      if (candidate.summary) existing.summary = existing.summary || candidate.summary;
    }
    if (platform === "youtube" && candidate.youtubeId) {
      existing.youtubeId = candidate.youtubeId;
      if (!existing.thumbnailUrl && candidate.thumbnailUrl) existing.thumbnailUrl = candidate.thumbnailUrl;
      if (candidate.durationMinutes != null) existing.durationMinutes = candidate.durationMinutes;
      if (candidate.summary) existing.summary = existing.summary || candidate.summary;
    }
  }

  for (const e of vimeoList) add(e, "vimeo");
  for (const e of spotifyList) add(e, "spotify");
  for (const e of youtubeList) add(e, "youtube");

  const list = Array.from(byKey.values());
  list.sort((a, b) => {
    const dA = a.publishDate || "0000-00-00";
    const dB = b.publishDate || "0000-00-00";
    if (dA !== dB) return dA.localeCompare(dB);

    const nA = episodeNumberFromTitle(a.title);
    const nB = episodeNumberFromTitle(b.title);
    if (nA != null && nB != null && nA !== nB) return nA - nB;
    if (nA != null && nB == null) return -1;
    if (nA == null && nB != null) return 1;

    return a.title.localeCompare(b.title);
  });

  return list.map((e, i) => ({
    ...e,
    number: episodeNumberFromTitle(e.title) ?? i + 1,
    slug: slugFromTitle(e.title),
  }));
}

async function main() {
  const hasVimeo = !!process.env.VIMEO_ACCESS_TOKEN;
  const hasSpotify = !!process.env.SPOTIFY_CLIENT_ID && !!process.env.SPOTIFY_CLIENT_SECRET;
  const hasYouTube = !!process.env.YOUTUBE_API_KEY;

  if (!hasVimeo && !hasSpotify && !hasYouTube) {
    console.warn("No platform tokens set. Using existing episodes-from-platforms.json or fallback.");
    const existing = path.join(DATA_DIR, "episodes-from-platforms.json");
    if (!fs.existsSync(existing)) {
      const fallback = path.join(DATA_DIR, "episodes-from-vimeo.json");
      if (fs.existsSync(fallback)) {
        fs.copyFileSync(fallback, existing);
        console.warn("Copied episodes-from-vimeo.json to episodes-from-platforms.json.");
      } else {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(OUT_PATH, JSON.stringify([], null, 2), "utf8");
      }
    }
    process.exit(0);
    return;
  }

  const [vimeoList, spotifyList, youtubeList] = await Promise.all([
    fetchVimeo(),
    fetchSpotify(),
    fetchYouTube(),
  ]);

  if (vimeoList.length) console.log("Vimeo:", vimeoList.length);
  if (spotifyList.length) console.log("Spotify:", spotifyList.length);
  if (youtubeList.length) console.log("YouTube:", youtubeList.length);

  const merged = mergeAndSort(vimeoList, spotifyList, youtubeList);

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(merged, null, 2), "utf8");
  console.log(`Synced ${merged.length} episode(s) to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
