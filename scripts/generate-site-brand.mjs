#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "./publish/catalog.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_SITE_BRAND_PATH = path.resolve(
  scriptDirectory,
  "../src/data/site-brand.generated.json"
);

export function buildSiteBrandProjection(catalog) {
  return {
    name: catalog.show.names.full,
    shortName: catalog.show.names.short,
    hostLine: catalog.show.names.hostLine,
    description: catalog.show.profileCopy.short,
  };
}

export function renderSiteBrandProjection(catalog) {
  return `${JSON.stringify(buildSiteBrandProjection(catalog), null, 2)}\n`;
}

export async function generateSiteBrand(outputPath = DEFAULT_SITE_BRAND_PATH) {
  const catalog = await loadCatalog();
  const next = renderSiteBrandProjection(catalog);
  let current = null;
  try {
    current = await fs.readFile(outputPath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (current === next) return false;
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, next);
  return true;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  generateSiteBrand()
    .then((changed) => process.stdout.write(`Site brand projection ${changed ? "updated" : "current"}.\n`))
    .catch((error) => {
      process.stderr.write(`generate-site-brand: ${error.message}\n`);
      process.exitCode = 1;
    });
}
