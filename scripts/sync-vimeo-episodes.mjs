#!/usr/bin/env node
/**
 * Fetches videos from Vimeo (GET /me/videos) and writes episodes-from-vimeo.json.
 * Run before build so the site uses the latest Vimeo uploads.
 * Requires VIMEO_ACCESS_TOKEN in the environment (create at https://developer.vimeo.com/apps).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const token = process.env.VIMEO_ACCESS_TOKEN;
const outPath = path.join(__dirname, "..", "src", "data", "episodes-from-vimeo.json");

function slugFromTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function fetchAllVideos() {
  const videos = [];
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
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Vimeo API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    const list = data.data || [];
    videos.push(...list);

    const total = data.total ?? 0;
    hasMore = videos.length < total && list.length === 100;
    page += 1;
  }

  return videos;
}

function buildEpisodeList(videos) {
  return videos.map((v, index) => {
    const uri = v.uri || "";
    const vimeoId = uri.replace(/^\/videos\//, "") || null;
    const name = v.name || "Untitled";
    const description = (v.description || "").trim();
    const duration = v.duration != null ? Math.round(Number(v.duration) / 60) : undefined;
    const created = v.created_time || null;
    const slug = slugFromTitle(name);

    return {
      vimeoId,
      slug,
      number: index + 1,
      title: name,
      publishDate: created ? created.slice(0, 10) : "",
      durationMinutes: duration || undefined,
      summary: description || name,
      thumbnailUrl: vimeoId ? `https://vumbnail.com/${vimeoId}.jpg` : undefined,
    };
  });
}

async function main() {
  if (!token) {
    console.warn("VIMEO_ACCESS_TOKEN not set. Skipping Vimeo sync; using existing episodes-from-vimeo.json if present.");
    const existing = path.join(__dirname, "..", "src", "data", "episodes-from-vimeo.json");
    if (!fs.existsSync(existing)) {
      // Write a minimal fallback so build doesn't break (empty or placeholder)
      fs.writeFileSync(outPath, JSON.stringify([], null, 2), "utf8");
      console.warn("No existing file; wrote empty episodes list. Set VIMEO_ACCESS_TOKEN and run again.");
    }
    process.exit(0);
    return;
  }

  const videos = await fetchAllVideos();
  const episodes = buildEpisodeList(videos);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(episodes, null, 2), "utf8");
  console.log(`Synced ${episodes.length} episode(s) from Vimeo to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
