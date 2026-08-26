import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { catalogHash, normalizeDescriptionForComparison } from "./catalog.mjs";

const root = new URL("../../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

test("Episode 7 historical correction receipt preserves its copy evidence and current identities", async () => {
  const [receipt, catalog] = await Promise.all([
    readJson("publishing/episode-description-correction.json"),
    readJson("publishing/master-catalog.json"),
  ]);
  const episode = catalog.episodes.find((candidate) => candidate.number === 7);
  assert.ok(episode);

  assert.equal(receipt.catalog.revision, 11);
  assert.ok(receipt.catalog.revision < catalog.revision);
  assert.match(receipt.catalog.publisherHash, /^[a-f0-9]{64}$/);
  assert.equal(receipt.episode.slug, episode.slug);
  assert.equal(receipt.episode.title, episode.title);
  assert.equal(receipt.episode.rssGuid, episode.rssGuid);
  assert.equal(receipt.episode.rssGuidPreserved, true);
  assert.equal(receipt.description.previousCatalogRevision, 10);
  assert.equal(receipt.description.previousNormalizedSha256, "ae583e210f4388721f5ae4b3093218f50a6932845a7aefdecf2e2eb324b42fec");
  assert.equal(receipt.description.currentNormalizedLength, 1181);
  assert.equal(receipt.description.currentNormalizedSha256, "380e4a70a27d02ea1ff76792a872482de893c10aa699b72f94921096c171c30a");
  assert.notEqual(
    receipt.description.previousNormalizedSha256,
    receipt.description.currentNormalizedSha256
  );

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

test("revision 16 description standardization receipt binds the prepared artifacts without authorizing release", async () => {
  const [receipt, catalog, catalogBytes, migrationBytes] = await Promise.all([
    readJson("publishing/episode-description-standardization.json"),
    readJson("publishing/master-catalog.json"),
    readFile(new URL("publishing/master-catalog.json", root)),
    readFile(
      new URL(
        "supabase/migrations/20260826004500_backfill_episode_affiliate_references.sql",
        root
      )
    ),
  ]);

  assert.equal(catalog.revision, 16);
  assert.equal(receipt.catalog.targetRevision, catalog.revision);
  assert.equal(
    receipt.catalog.fileSha256,
    createHash("sha256").update(catalogBytes).digest("hex")
  );
  assert.equal(receipt.catalog.publisherHash, catalogHash(catalog));
  assert.equal(
    receipt.siteMigration.migrationArtifactSha256,
    createHash("sha256").update(migrationBytes).digest("hex")
  );

  assert.equal(receipt.authorization.remoteWritesAuthorizedByThisReceipt, false);
  assert.equal(receipt.authorization.productionDeploymentAuthorizedByThisReceipt, false);
  assert.equal(receipt.siteMigration.productionApplied, false);
  assert.equal(receipt.siteMigration.websiteDeployed, false);

  assert.deepEqual(
    receipt.episodes.map((episode) => episode.number),
    catalog.episodes.map((episode) => episode.number)
  );

  for (const target of receipt.episodes) {
    const episode = catalog.episodes.find((candidate) => candidate.number === target.number);
    assert.ok(episode);
    const normalized = normalizeDescriptionForComparison(episode.description.full);

    assert.equal(target.slug, episode.slug);
    assert.equal(target.rssGuid, episode.rssGuid);
    assert.equal(target.targetDescriptionNormalizedLength, normalized.length);
    assert.equal(
      target.targetDescriptionNormalizedSha256,
      createHash("sha256").update(normalized).digest("hex")
    );

    for (const platform of ["spotify", "youtube", "vimeo", "rumble"]) {
      assert.equal(target.stableDestinationIds[platform], episode.destinations[platform]?.id ?? null);
    }
  }
});
