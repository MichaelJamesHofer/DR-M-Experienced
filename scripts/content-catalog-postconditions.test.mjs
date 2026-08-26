import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  EPISODE_AFFILIATE_REFERENCE_POSTCONDITIONS,
  EPISODE_PRODUCT_RELATIONSHIP_POSTCONDITION,
  EPISODE_RESOURCE_PARAGRAPH_POSTCONDITIONS,
  PRODUCTION_SUPABASE_PROJECT_REF,
  validateEpisodeAffiliatePostconditions,
  validateProductionSupabaseUrl,
} from "./content-catalog-postconditions.mjs";

function completeTables() {
  return {
    episode_references: structuredClone(EPISODE_AFFILIATE_REFERENCE_POSTCONDITIONS),
    affiliate_product_episode_links: [
      structuredClone(EPISODE_PRODUCT_RELATIONSHIP_POSTCONDITION),
    ],
    episode_section_paragraphs: structuredClone(
      EPISODE_RESOURCE_PARAGRAPH_POSTCONDITIONS
    ),
  };
}

test("production Supabase configuration is bound to the expected project without echoing values", () => {
  assert.deepEqual(
    validateProductionSupabaseUrl(
      `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`
    ),
    []
  );

  const configuredValue = "https://wrong-project.supabase.co/path?apikey=do-not-print";
  const problems = validateProductionSupabaseUrl(configuredValue);
  assert.equal(problems.length, 1);
  assert.match(problems[0], new RegExp(PRODUCTION_SUPABASE_PROJECT_REF));
  assert.doesNotMatch(problems.join("\n"), /wrong-project|do-not-print/);
  assert.equal(validateProductionSupabaseUrl("not a url").length, 1);
  assert.equal(
    validateProductionSupabaseUrl(
      `http://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`
    ).length,
    1
  );
});

test("affiliate backfill gate encodes all 17 exact references across Episodes 1-7", () => {
  assert.equal(EPISODE_AFFILIATE_REFERENCE_POSTCONDITIONS.length, 17);
  assert.deepEqual(
    new Set(
      EPISODE_AFFILIATE_REFERENCE_POSTCONDITIONS.map((row) => row.episode_slug)
    ),
    new Set([
      "brain-fog-part-1",
      "brain-fog-part-2",
      "episode-3-insomnia",
      "episode-4-emf",
      "episode-5-energy",
      "episode-6-concussion-and-pathophysiology",
      "episode-7-the-brain-on-fire",
    ])
  );
  assert.deepEqual(validateEpisodeAffiliatePostconditions(completeTables()), []);
});

test("affiliate backfill gate fails when any exact reference is absent or drifted", () => {
  const missing = completeTables();
  missing.episode_references.pop();
  assert.match(
    validateEpisodeAffiliatePostconditions(missing).join("\n"),
    /episode-7-the-brain-on-fire: required affiliate reference/
  );

  const drifted = completeTables();
  drifted.episode_references[0].coming_soon = true;
  assert.match(
    validateEpisodeAffiliatePostconditions(drifted).join("\n"),
    /brain-fog-part-1: required affiliate reference/
  );
});

test("affiliate backfill gate fails on the DesBio relationship and corrected paragraphs", () => {
  const missingRelationship = completeTables();
  missingRelationship.affiliate_product_episode_links[0].link_reason = "drifted";
  assert.match(
    validateEpisodeAffiliatePostconditions(missingRelationship).join("\n"),
    /required DesBio affiliate relationship/
  );

  for (const expected of EPISODE_RESOURCE_PARAGRAPH_POSTCONDITIONS) {
    const drifted = completeTables();
    const paragraph = drifted.episode_section_paragraphs.find(
      (row) => row.episode_slug === expected.episode_slug
    );
    paragraph.body = "drifted";
    assert.match(
      validateEpisodeAffiliatePostconditions(drifted).join("\n"),
      new RegExp(`${expected.episode_slug}: corrected resource paragraph`)
    );
  }
});

test("verifier postconditions stay represented in the production migration", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260826004500_backfill_episode_affiliate_references.sql",
      import.meta.url
    ),
    "utf8"
  );

  for (const expected of EPISODE_AFFILIATE_REFERENCE_POSTCONDITIONS) {
    const tuple = `('${expected.episode_slug}', '${expected.label}', '${expected.url}', ${expected.display_order})`;
    assert.match(migration, new RegExp(escapeRegExp(tuple)));
  }

  for (const expected of [
    EPISODE_PRODUCT_RELATIONSHIP_POSTCONDITION,
    ...EPISODE_RESOURCE_PARAGRAPH_POSTCONDITIONS,
  ]) {
    for (const value of Object.values(expected)) {
      assert.match(migration, new RegExp(escapeRegExp(String(value))));
    }
  }
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
