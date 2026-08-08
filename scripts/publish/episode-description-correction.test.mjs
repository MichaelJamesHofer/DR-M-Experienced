import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizeDescriptionForComparison } from "./catalog.mjs";

const root = new URL("../../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

test("Episode 7 historical correction receipt matches current catalog identities and copy", async () => {
  const [receipt, catalog] = await Promise.all([
    readJson("publishing/episode-description-correction.json"),
    readJson("publishing/master-catalog.json"),
  ]);
  const episode = catalog.episodes.find((candidate) => candidate.number === 7);
  assert.ok(episode);

  const normalized = normalizeDescriptionForComparison(episode.description.full);
  const normalizedSha256 = createHash("sha256").update(normalized).digest("hex");

  assert.equal(receipt.catalog.revision, 11);
  assert.ok(receipt.catalog.revision < catalog.revision);
  assert.match(receipt.catalog.publisherHash, /^[a-f0-9]{64}$/);
  assert.equal(receipt.episode.slug, episode.slug);
  assert.equal(receipt.episode.title, episode.title);
  assert.equal(receipt.episode.rssGuid, episode.rssGuid);
  assert.equal(receipt.episode.rssGuidPreserved, true);
  assert.equal(receipt.description.currentNormalizedLength, normalized.length);
  assert.equal(receipt.description.currentNormalizedSha256, normalizedSha256);

  for (const platform of ["spotify", "youtube", "vimeo"]) {
    assert.equal(receipt.episode.stableDestinationIdsPreserved[platform], episode.destinations[platform].id);
  }
  assert.equal(receipt.targets.rumble.existingPublicVideoId, episode.destinations.rumble.id);
});

test("current platform state points to a fail-closed partial propagation receipt", async () => {
  const [receipt, platformState] = await Promise.all([
    readJson("publishing/episode-description-correction.json"),
    readJson("publishing/platforms.json"),
  ]);

  assert.equal(receipt.status, "remote_propagation_partial");
  assert.deepEqual(receipt.completion.verifiedComplete, ["rss.com", "spotify", "youtube", "vimeo", "supabase", "website"]);
  assert.deepEqual(receipt.completion.pending, ["rumble", "apple"]);
  assert.equal(receipt.targets.rumble.status, "pending_manual_reupload");
  assert.equal(receipt.targets.rumble.currentCatalogParity, false);
  assert.equal(receipt.targets.rumble.automationRequiresPriorWrittenPermission, true);
  assert.equal(receipt.targets.rumble.replacementVideoId, null);
  assert.equal(receipt.targets.apple.status, "pending_cache_convergence_verification");
  assert.equal(receipt.targets.website.status, "complete_verified");
  assert.equal(receipt.targets.website.deployedCommit, "a291990cd2256a8f67f4a6853d5aedc5b1788776");
  assert.equal(receipt.targets.website.deploymentRunId, 31276520368);
  assert.equal(receipt.targets.website.httpStatus, 200);
  assert.equal(receipt.targets.website.liveReadback.currentSummaryPresent, true);
  assert.equal(receipt.targets.website.liveReadback.previousSummaryPresent, false);
  assert.equal(receipt.targets.website.liveReadback.currentSectionsPresent, true);
  assert.equal(receipt.targets.website.liveReadback.previousSectionsPresent, false);
  assert.deepEqual(receipt.targets.website.mobileReadback.viewportWidthsPx, [320, 390]);
  assert.equal(receipt.targets.website.mobileReadback.horizontalOverflow, false);
  assert.equal(receipt.targets.supabase.status, "complete_verified");
  assert.equal(receipt.targets.supabase.readback.takeawayCount, 5);
  assert.equal(receipt.targets.supabase.readback.paragraphCount, 8);
  assert.equal(receipt.targets.supabase.readback.brainAutoimmunityTopicPresent, false);

  assert.equal(platformState.episodeDescriptionCorrection.stateFile, "publishing/episode-description-correction.json");
  assert.equal(platformState.episodeDescriptionCorrection.status, receipt.status);
  assert.deepEqual(platformState.episodeDescriptionCorrection.verifiedComplete, receipt.completion.verifiedComplete);
  assert.deepEqual(platformState.episodeDescriptionCorrection.pending, receipt.completion.pending);
  assert.equal(platformState.platforms.rumble.currentCatalogDescriptionParity, false);
  assert.deepEqual(platformState.platforms.rumble.pendingDescriptionCorrectionEpisodeNumbers, [7]);
});
