#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

loadEnvFile(path.join(ROOT, ".env"));
loadEnvFile(path.join(ROOT, ".env.local"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  fail([
    "Missing Supabase catalog env vars.",
    "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then rerun npm run verify:catalog.",
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

const problems = [];
const counts = new Map();

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

counts.set("episodes[published]", publishedEpisodes.length);
counts.set("affiliate_products[published]", publishedProducts.length);

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

if (publishedEpisodes.length === 0) problems.push("No published episodes returned.");
if (publishedProducts.length === 0) problems.push("No published affiliate products returned.");
if (tables.affiliate_categories.length === 0) problems.push("No affiliate categories returned.");

for (const episode of publishedEpisodes) {
  const slug = episode.slug;
  const topics = topicSlugsByEpisode.get(slug) ?? [];
  const references = referencesByEpisode.get(slug) ?? [];
  const takeaways = takeawaysByEpisode.get(slug) ?? [];
  const sections = sectionsByEpisode.get(slug) ?? [];

  if (topics.length === 0) problems.push(`${slug}: missing episode_topics rows.`);
  if (references.length === 0) problems.push(`${slug}: missing episode_references rows.`);
  if (takeaways.length === 0) problems.push(`${slug}: missing episode_key_takeaways rows.`);
  if (sections.length === 0) problems.push(`${slug}: missing episode_sections rows.`);

  for (const section of sections) {
    const paragraphs = paragraphsBySection.get(`${slug}:${section.display_order}`) ?? [];
    if (paragraphs.length === 0) {
      problems.push(`${slug}: section "${section.title}" has no paragraph rows.`);
    }
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

console.log("Catalog table counts:");
for (const [table, count] of counts.entries()) {
  console.log(`- ${table}: ${count}`);
}

if (problems.length > 0) {
  fail(["Catalog verification failed:", ...problems.map((problem) => `- ${problem}`)]);
}

console.log("Catalog verification passed.");

async function fetchRows(table, params) {
  const url = new URL(`/rest/v1/${table}`, supabaseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`returned ${response.status}`);
  }

  return response.json();
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
