import fs from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const schema = JSON.parse(
  await fs.readFile(new URL("../../publishing/rumble-release-policy.schema.json", import.meta.url), "utf8")
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv, { mode: "full" });
const validateSchema = ajv.compile(schema);

function schemaPath(error) {
  const path = error.instancePath || "/";
  return `${path} ${error.message}`;
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function canonicalRumbleUrl(value) {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/$/, "") || "/";
    return url.href;
  } catch {
    return value;
  }
}

export function validateRumbleReleasePolicy(policy) {
  const errors = [];
  if (!validateSchema(policy)) {
    errors.push(...validateSchema.errors.map(schemaPath));
  }

  const results = policy?.submissionReceipt?.episodeResults;
  if (Array.isArray(results)) {
    const duplicateIds = duplicateValues(results.map((result) => result?.remoteId));
    if (duplicateIds.length) errors.push("submissionReceipt.episodeResults contains duplicate remote IDs.");

    const duplicateUrls = duplicateValues(
      results.map((result) => canonicalRumbleUrl(result?.remoteUrl))
    );
    if (duplicateUrls.length) errors.push("submissionReceipt.episodeResults contains duplicate remote URLs.");
  }

  return [...new Set(errors)];
}

export async function loadRumbleReleasePolicy() {
  return JSON.parse(
    await fs.readFile(new URL("../../publishing/rumble-release-policy.json", import.meta.url), "utf8")
  );
}
