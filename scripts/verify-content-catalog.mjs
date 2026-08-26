#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "./publish/catalog.mjs";
import { requiredEpisodeReferencePlatforms } from "./publish/catalog-platform-policy.mjs";
import {
  validateEpisodeAffiliatePostconditions,
  validateProductionSupabaseUrl,
} from "./content-catalog-postconditions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const POSTGREST_PAGE_SIZE = 1000;

loadEnvFile(path.join(ROOT, ".env"));
loadEnvFile(path.join(ROOT, ".env.local"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseCatalogKey =
  process.env.SUPABASE_CATALOG_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseCatalogKey) {
  fail([
    "Missing Supabase catalog env vars.",
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_CATALOG_KEY in .env.local, then rerun npm run verify:catalog.",
  ]);
}

const supabaseConfigurationProblems = validateProductionSupabaseUrl(supabaseUrl);
if (supabaseConfigurationProblems.length > 0) {
  fail([
    "Supabase catalog configuration failed:",
    ...supabaseConfigurationProblems.map((problem) => `- ${problem}`),
  ]);
}

const requiredTables = [
  "episodes",
  "episode_topics",
  "episode_references",
  "episode_key_takeaways",
  "episode_checklist_items",
  "episode_sections",
  "episode_section_paragraphs",
  "affiliate_categories",
  "affiliate_products",
  "affiliate_product_reasons",
  "affiliate_product_use_cases",
  "affiliate_product_featured_items",
  "affiliate_product_episode_links",
  "affiliate_product_auto_topics",
  "affiliate_product_tags",
];

const optionalTables = [
  "blog_posts",
  "blog_post_topics",
  "blog_post_sections",
  "blog_post_section_paragraphs",
  "blog_post_references",
  "blog_post_related_episodes",
  "blog_post_related_affiliate_products",
];

const problems = [];
const counts = new Map();
const masterCatalog = await loadCatalog().catch((error) => {
  fail([`Master catalog validation failed: ${error.message}`]);
});
const masterEpisodesBySlug = new Map(masterCatalog.episodes.map((episode) => [episode.slug, episode]));

const tables = Object.fromEntries(
  await Promise.all(
    requiredTables.map(async (table) => {
      const rows = await fetchRows(table, { select: "*", limit: "10000" }).catch((error) => {
        problems.push(`${table}: ${error.message}`);
        return [];
      });
      counts.set(table, rows.length);
      return [table, rows];
    })
  )
);

for (const table of optionalTables) {
  const rows = await fetchOptionalRows(table, { select: "*", limit: "10000" }).catch((error) => {
    problems.push(`${table}: ${error.message}`);
    return [];
  });

  if (rows === null) {
    counts.set(`${table}[optional]`, "not migrated");
    tables[table] = [];
  } else {
    counts.set(table, rows.length);
    tables[table] = rows;
  }
}

const publishedEpisodes = await fetchRows("episodes", {
  select: "*",
  status: "eq.published",
  limit: "10000",
}).catch((error) => {
  problems.push(`episodes published query: ${error.message}`);
  return [];
});

const publishedProducts = await fetchRows("affiliate_products", {
  select: "*",
  status: "eq.published",
  limit: "10000",
}).catch((error) => {
  problems.push(`affiliate_products published query: ${error.message}`);
  return [];
});

const publishedBlogPosts =
  counts.get("blog_posts[optional]") === "not migrated"
    ? []
    : await fetchOptionalRows("blog_posts", {
        select: "*",
        status: "eq.published",
        limit: "10000",
      }).catch((error) => {
        problems.push(`blog_posts published query: ${error.message}`);
        return [];
      });

counts.set("episodes[published]", publishedEpisodes.length);
counts.set("affiliate_products[published]", publishedProducts.length);
if (counts.get("blog_posts[optional]") !== "not migrated") {
  counts.set("blog_posts[published]", publishedBlogPosts?.length ?? 0);
}

const topicSlugsByEpisode = groupValues(tables.episode_topics, "episode_slug", "topic_slug");
const referencesByEpisode = groupRows(tables.episode_references, "episode_slug");
const takeawaysByEpisode = groupRows(tables.episode_key_takeaways, "episode_slug");
const sectionsByEpisode = groupRows(tables.episode_sections, "episode_slug");
const paragraphsBySection = groupRows(
  tables.episode_section_paragraphs,
  (row) => `${row.episode_slug}:${row.section_display_order}`
);

const categorySlugs = new Set(tables.affiliate_categories.map((category) => category.slug));
const reasonsByProduct = groupRows(tables.affiliate_product_reasons, "product_slug");
const useCasesByProduct = groupRows(tables.affiliate_product_use_cases, "product_slug");
const blogTopicsByPost = groupValues(tables.blog_post_topics, "blog_slug", "topic_slug");
const blogSectionsByPost = groupRows(tables.blog_post_sections, "blog_slug");
const blogParagraphsBySection = groupRows(
  tables.blog_post_section_paragraphs,
  (row) => `${row.blog_slug}:${row.section_display_order}`
);
const relatedEpisodesByPost = groupValues(
  tables.blog_post_related_episodes,
  "blog_slug",
  "episode_slug"
);
const relatedProductsByPost = groupValues(
  tables.blog_post_related_affiliate_products,
  "blog_slug",
  "product_slug"
);
const episodeSlugs = new Set(publishedEpisodes.map((episode) => episode.slug));
const productSlugs = new Set(publishedProducts.map((product) => product.slug));

if (publishedEpisodes.length === 0) problems.push("No published episodes returned.");
if (publishedProducts.length === 0) problems.push("No published affiliate products returned.");
if (tables.affiliate_categories.length === 0) problems.push("No affiliate categories returned.");

problems.push(...validateEpisodeAffiliatePostconditions(tables));

for (const episode of publishedEpisodes) {
  const slug = episode.slug;
  const masterEpisode = masterEpisodesBySlug.get(slug);
  const topics = topicSlugsByEpisode.get(slug) ?? [];
  const references = referencesByEpisode.get(slug) ?? [];
  const takeaways = takeawaysByEpisode.get(slug) ?? [];
  const sections = sectionsByEpisode.get(slug) ?? [];

  if (!masterEpisode) {
    problems.push(`${slug}: published Supabase episode is missing from the master catalog.`);
  } else {
    if (masterEpisode.publicationState !== "published") {
      problems.push(`${slug}: published Supabase episode is not marked published in the master catalog.`);
    }
    for (const [field, actual, expected] of [
      ["episode_number", episode.episode_number, masterEpisode.number],
      ["title", episode.title, masterEpisode.title],
      ["publish_date", episode.publish_date, masterEpisode.publishDate],
      ["summary", episode.summary, masterEpisode.websiteSummary],
      ["vimeo_id", episode.vimeo_id, masterEpisode.destinations.vimeo?.id ?? null],
      ["spotify_id", episode.spotify_id, masterEpisode.destinations.spotify?.id ?? null],
      ["youtube_id", episode.youtube_id, masterEpisode.destinations.youtube?.id ?? null],
    ]) {
      if (actual !== expected) {
        problems.push(`${slug}: Supabase ${field} does not match the master catalog.`);
      }
    }
    const thumbnail = masterCatalog.assetRegistry[masterEpisode.assetRefs.thumbnail];
    if (thumbnail?.publishedUrl && episode.thumbnail_url !== thumbnail.publishedUrl) {
      problems.push(`${slug}: Supabase thumbnail_url does not match the master catalog asset.`);
    }
    const podcastAudio = masterCatalog.assetRegistry[masterEpisode.assetRefs.podcastAudio];
    if (podcastAudio?.publishedUrl && episode.audio_url !== podcastAudio.publishedUrl) {
      problems.push(`${slug}: Supabase audio_url does not match the master catalog asset.`);
    }
  }

  if (topics.length === 0) problems.push(`${slug}: missing episode_topics rows.`);
  if (references.length === 0) problems.push(`${slug}: missing episode_references rows.`);
  if (takeaways.length === 0) problems.push(`${slug}: missing episode_key_takeaways rows.`);
  if (sections.length === 0) problems.push(`${slug}: missing episode_sections rows.`);

  const availablePlatforms = new Set(
    references
      .filter((reference) => !reference.coming_soon)
      .map((reference) => episodePlatformForUrl(reference.url))
      .filter(Boolean)
  );
  for (const platform of requiredEpisodeReferencePlatforms(masterEpisode)) {
    if (!availablePlatforms.has(platform)) {
      problems.push(`${slug}: missing published ${platform} reference.`);
    }
  }

  if (masterEpisode) {
    for (const [platform, destination] of Object.entries(masterEpisode.destinations)) {
      if (!destination) continue;
      const matchingReference = references.find(
        (reference) => !reference.coming_soon && episodePlatformForUrl(reference.url)?.toLowerCase() === platform
      );
      if (matchingReference && matchingReference.url !== destination.url) {
        problems.push(`${slug}: published ${platform} reference does not match the master catalog URL.`);
      }
    }
  }

  for (const section of sections) {
    const paragraphs = paragraphsBySection.get(`${slug}:${section.display_order}`) ?? [];
    if (paragraphs.length === 0) {
      problems.push(`${slug}: section "${section.title}" has no paragraph rows.`);
    }
  }
}

const publishedEpisodeSlugs = new Set(publishedEpisodes.map((episode) => episode.slug));
for (const episode of masterCatalog.episodes) {
  if (episode.publicationState === "published" && !publishedEpisodeSlugs.has(episode.slug)) {
    problems.push(`${episode.slug}: published master-catalog episode is missing from published Supabase rows.`);
  }
}

for (const product of publishedProducts) {
  const slug = product.slug;
  if (!categorySlugs.has(product.category_slug)) {
    problems.push(`${slug}: missing affiliate category ${product.category_slug}.`);
  }
  if (!String(product.summary ?? "").trim()) problems.push(`${slug}: missing summary.`);
  if (!String(product.drm_thoughts ?? "").trim()) problems.push(`${slug}: missing drm_thoughts.`);
  if (!product.affiliate_url && !product.direct_url) problems.push(`${slug}: missing affiliate_url/direct_url.`);
  if ((reasonsByProduct.get(slug) ?? []).length === 0) {
    problems.push(`${slug}: missing affiliate_product_reasons rows.`);
  }
  if ((useCasesByProduct.get(slug) ?? []).length === 0) {
    problems.push(`${slug}: missing affiliate_product_use_cases rows.`);
  }
}

for (const post of publishedBlogPosts ?? []) {
  const slug = post.slug;
  const topics = blogTopicsByPost.get(slug) ?? [];
  const sections = blogSectionsByPost.get(slug) ?? [];
  const relatedEpisodes = relatedEpisodesByPost.get(slug) ?? [];
  const relatedProducts = relatedProductsByPost.get(slug) ?? [];

  if (!String(post.excerpt ?? "").trim()) problems.push(`${slug}: missing excerpt.`);
  if (topics.length === 0) problems.push(`${slug}: missing blog_post_topics rows.`);
  if (sections.length === 0) problems.push(`${slug}: missing blog_post_sections rows.`);

  for (const section of sections) {
    const paragraphs = blogParagraphsBySection.get(`${slug}:${section.display_order}`) ?? [];
    if (paragraphs.length === 0) {
      problems.push(`${slug}: blog section "${section.title}" has no paragraph rows.`);
    }
  }

  for (const episodeSlug of relatedEpisodes) {
    if (!episodeSlugs.has(episodeSlug)) {
      problems.push(`${slug}: related episode ${episodeSlug} is missing or not published.`);
    }
  }

  for (const productSlug of relatedProducts) {
    if (!productSlugs.has(productSlug)) {
      problems.push(`${slug}: related product ${productSlug} is missing or not published.`);
    }
  }
}

console.log("Catalog table counts:");
for (const [table, count] of counts.entries()) {
  console.log(`- ${table}: ${count}`);
}

if (problems.length > 0) {
  fail(["Catalog verification failed:", ...problems.map((problem) => `- ${problem}`)]);
}

console.log("Catalog verification passed.");

async function fetchRows(table, params) {
  return fetchPaginatedRows(table, params, false);
}

async function fetchOptionalRows(table, params) {
  return fetchPaginatedRows(table, params, true);
}

async function fetchPaginatedRows(table, params, optional) {
  const requestedLimit = Math.max(1, Number(params.limit ?? 10_000));
  const url = new URL(`/rest/v1/${table}`, supabaseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (key !== "limit") url.searchParams.set(key, value);
  }

  const rows = [];
  while (rows.length < requestedLimit) {
    const pageSize = Math.min(POSTGREST_PAGE_SIZE, requestedLimit - rows.length);
    const response = await fetchWithTransientRetry(url, {
      headers: {
        apikey: supabaseCatalogKey,
        Authorization: `Bearer ${supabaseCatalogKey}`,
        Range: `${rows.length}-${rows.length + pageSize - 1}`,
        "Range-Unit": "items",
      },
    });

    if (optional && response.status === 404) return null;
    if (!response.ok) throw new Error(`returned ${response.status}`);

    const page = await response.json();
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

async function fetchWithTransientRetry(url, options) {
  const transientStatuses = new Set([401, 408, 425, 429, 500, 502, 503, 504]);
  let response;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(url, options);
    if (!transientStatuses.has(response.status) || attempt === 2) return response;

    await response.arrayBuffer().catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
  }

  return response;
}

function episodePlatformForUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    if (hostname === "vimeo.com" || hostname.endsWith(".vimeo.com")) return "Vimeo";
    if (hostname === "open.spotify.com") return "Spotify";
    if (
      hostname === "youtu.be" ||
      hostname === "youtube.com" ||
      hostname.endsWith(".youtube.com")
    ) {
      return "YouTube";
    }
    if (hostname === "rumble.com" || hostname.endsWith(".rumble.com")) return "Rumble";
  } catch {
    return null;
  }

  return null;
}

function groupRows(rows, key) {
  const groups = new Map();
  for (const row of rows ?? []) {
    const groupKey = typeof key === "function" ? key(row) : row[key];
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), row]);
  }
  return groups;
}

function groupValues(rows, groupKey, valueKey) {
  const groups = new Map();
  for (const row of rows ?? []) {
    const key = row[groupKey];
    groups.set(key, [...(groups.get(key) ?? []), row[valueKey]]);
  }
  return groups;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] != null) continue;

    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

function fail(lines) {
  console.error(lines.join("\n"));
  process.exit(1);
}
