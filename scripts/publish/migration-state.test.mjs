import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import {
  HOST_MIGRATION_IDENTITIES,
  hostingMigrationIsActive,
  hostingMigrationPhase,
  migrationCheckMode,
  migrationDoctorAdvice,
  validatePublishingMigrationState,
} from "./migration-state.mjs";

const migrationFile = new URL("../../publishing/hosting-migration.json", import.meta.url);
const platformsFile = new URL("../../publishing/platforms.json", import.meta.url);
const catalogFile = new URL("../../publishing/master-catalog.json", import.meta.url);

const baselineMigration = JSON.parse(await fs.readFile(migrationFile, "utf8"));
const baselinePlatforms = JSON.parse(await fs.readFile(platformsFile, "utf8"));
const catalog = JSON.parse(await fs.readFile(catalogFile, "utf8"));

function clone(value) {
  return structuredClone(value);
}

function validate(migration, platforms, canonicalFeedUrl = catalog.show.canonicalPodcastFeed.url) {
  return validatePublishingMigrationState({
    migration,
    platforms,
    canonicalFeedUrl,
    expectedTitle: catalog.show.names.full,
    expectedDescription: catalog.show.profileCopy.short,
  });
}

function activeFixture() {
  const migration = clone(baselineMigration);
  const platforms = clone(baselinePlatforms);
  migration.status = "destination_clean_source_cleanup_in_progress";
  migration.decision.active = true;
  migration.decision.resumeRequiresExplicitApproval = false;
  Object.assign(migration.gates, {
    publishingFreezeActive: true,
    rssComImportComplete: true,
    episodeCountMatches: true,
    guidSetMatches: true,
    episodeMetadataMatches: false,
    mediaVerified: true,
    artworkVerified: true,
    existingDirectoryLinksRecorded: true,
    monetizationAndSubscriptionsReviewed: true,
    redirectAuthorized: true,
    redirectVerified: false,
  });
  migration.destination.candidateMetadataVerified.episodeMetadataMatchesSource = false;
  migration.destination.canonicalMetadataCleanedAt = "2026-08-06T17:25:00Z";
  migration.destination.episodeMetadataCleanedAt = "2026-08-06T17:35:00Z";
  migration.destination.candidateMetadataVerifiedAt = "2026-08-06T17:36:00Z";
  Object.assign(migration.destination.validation, {
    verifiedAt: "2026-08-06T17:02:27Z",
    fullPreflightPassed: false,
    canonicalTargetMetadataPassed: false,
    blockingMismatch: "Validation snapshot predates RSS.com metadata cleanup; Anchor source cleanup pending",
  });
  for (const listing of ["spotify", "apple"]) {
    migration.existingListings[listing].currentFeedUrl = HOST_MIGRATION_IDENTITIES.sourceFeedUrl;
    migration.existingListings[listing].verifiedAfterCutover = false;
  }
  platforms.pendingHostingMigration.active = true;
  platforms.pendingHostingMigration.status = "import_validated_pre_redirect_cleanup";
  platforms.pendingHostingMigration.cutoverReady = false;
  platforms.pendingHostingMigration.resumeRequiresExplicitApproval = false;
  platforms.podcastDistribution.canonicalHost = "rss.com";
  platforms.platforms["rss.com"].rssRole = "canonical_host";
  platforms.platforms.spotify.rssRole = "direct_media_destination";
  platforms.platforms.apple.dependsOn = "rss.com";
  platforms.platforms.amazon.dependsOn = "rss.com";
  return { migration, platforms };
}

function parkedFixture() {
  const { migration, platforms } = activeFixture();
  migration.status = "parked";
  migration.decision.active = false;
  migration.decision.resumeRequiresExplicitApproval = true;
  migration.gates.publishingFreezeActive = false;
  migration.gates.redirectAuthorized = false;
  platforms.pendingHostingMigration.active = false;
  platforms.pendingHostingMigration.status = "parked";
  platforms.pendingHostingMigration.cutoverReady = false;
  platforms.pendingHostingMigration.resumeRequiresExplicitApproval = true;
  platforms.podcastDistribution.canonicalHost = "spotify";
  platforms.platforms["rss.com"].rssRole = "migration_candidate";
  platforms.platforms.spotify.rssRole = "canonical_host";
  platforms.platforms.apple.dependsOn = "spotify";
  platforms.platforms.amazon.dependsOn = "spotify";
  return { migration, platforms };
}

function completedFixture() {
  const { migration, platforms } = activeFixture();
  migration.status = "cutover_completed";
  migration.decision.active = false;
  migration.gates = Object.fromEntries(
    Object.keys(migration.gates).map((key) => [key, key === "publishingFreezeActive" ? false : true])
  );
  migration.destination.candidateMetadataVerified.episodeMetadataMatchesSource = true;
  Object.assign(migration.destination.validation, {
    verifiedAt: "2026-08-06T18:30:00Z",
    fullPreflightPassed: true,
    canonicalTargetMetadataPassed: true,
    blockingMismatch: null,
  });
  for (const listing of ["spotify", "apple"]) {
    migration.existingListings[listing].currentFeedUrl = HOST_MIGRATION_IDENTITIES.targetFeedUrl;
    migration.existingListings[listing].verifiedAfterCutover = true;
  }
  platforms.pendingHostingMigration.active = false;
  platforms.pendingHostingMigration.status = "cutover_completed";
  platforms.pendingHostingMigration.cutoverReady = true;
  return { migration, platforms };
}

test("checked-in migration records are semantically consistent", () => {
  const result = validate(baselineMigration, baselinePlatforms);
  assert.deepEqual(result.errors, []);
  assert.notEqual(result.phase, "invalid");
  assert.notEqual(result.phase, "missing");
});

test("active pre-redirect state remains distinct and runnable", () => {
  const { migration, platforms } = activeFixture();
  const result = validate(migration, platforms);
  assert.equal(result.phase, "pre_redirect");
  assert.deepEqual(result.errors, []);
  assert.equal(hostingMigrationIsActive(migration, platforms.pendingHostingMigration), true);
  assert.equal(migrationCheckMode(result.phase), "pre_redirect");
});

test("parked migration is distinct from completion and skips feed preflight", () => {
  const { migration, platforms } = parkedFixture();
  const result = validate(migration, platforms, HOST_MIGRATION_IDENTITIES.sourceFeedUrl);
  assert.equal(result.phase, "parked");
  assert.deepEqual(result.errors, []);
  assert.equal(hostingMigrationIsActive(migration, platforms.pendingHostingMigration), false);
  assert.equal(migrationCheckMode(result.phase), "skip_parked");
  assert.match(
    migrationDoctorAdvice({ phase: result.phase, migration, pendingMigration: platforms.pendingHostingMigration }),
    /source feed canonical/
  );
});

test("completed cutover retains read-only post-cutover validation", () => {
  const { migration, platforms } = completedFixture();
  const result = validate(migration, platforms);
  assert.equal(result.phase, "completed");
  assert.deepEqual(result.errors, []);
  assert.equal(hostingMigrationIsActive(migration, platforms.pendingHostingMigration), false);
  assert.equal(migrationCheckMode(result.phase), "post_cutover_read_only");
  const advice = migrationDoctorAdvice({
    phase: result.phase,
    migration,
    pendingMigration: platforms.pendingHostingMigration,
    rssHealthy: true,
  });
  assert.match(advice, /Cutover is complete/);
  assert.match(advice, /read-only post-cutover validation/);
  assert.doesNotMatch(advice, /Anchor remains canonical/i);
});

test("completed host migration supports the approved Apple-only feed lifecycle", () => {
  const migration = clone(baselineMigration);
  const platforms = clone(baselinePlatforms);
  migration.existingListings.apple.currentFeedUrl =
    HOST_MIGRATION_IDENTITIES.appleOverlayFeedUrl;
  migration.existingListings.apple.appleFeedRoutingStatus = "apple_processing";
  migration.downstreamPropagation.issues.find(
    (issue) => issue.code === "apple_episode_historical_guid_mismatch_confirmed",
  ).repairStatus = "apple_processing";
  platforms.podcastDistribution.appleFeedOverlay.status = "apple_processing";
  platforms.downstreamPropagation.issues.find(
    (issue) => issue.code === "apple_episode_convergence_pending",
  ).repairStatus = "apple_processing";
  platforms.platforms.apple.feedRouting.status = "apple_processing";
  platforms.platforms.apple.feedRouting.currentFeedUrl =
    HOST_MIGRATION_IDENTITIES.appleOverlayFeedUrl;

  const result = validate(migration, platforms);
  assert.equal(result.phase, "completed");
  assert.deepEqual(result.errors, []);
  assert.equal(platforms.podcastDistribution.canonicalHost, "rss.com");
  assert.equal(platforms.platforms.apple.dependsOn, "rss.com");
});

test("Apple overlay lifecycle status projections cannot drift", () => {
  const cases = [
    {
      label: "podcast distribution overlay",
      change(_migration, platforms) {
        platforms.podcastDistribution.appleFeedOverlay.status = "apple_processing";
      },
      pattern: /podcastDistribution\.appleFeedOverlay\.status/,
    },
    {
      label: "platform downstream issue",
      change(_migration, platforms) {
        platforms.downstreamPropagation.issues.find(
          (issue) => issue.code === "apple_episode_convergence_pending",
        ).repairStatus = "apple_processing";
      },
      pattern: /apple_episode_convergence_pending\.repairStatus/,
    },
    {
      label: "hosting downstream issue",
      change(migration) {
        migration.downstreamPropagation.issues.find(
          (issue) => issue.code === "apple_episode_historical_guid_mismatch_confirmed",
        ).repairStatus = "apple_processing";
      },
      pattern: /apple_episode_historical_guid_mismatch_confirmed\.repairStatus/,
    },
  ];

  for (const fixture of cases) {
    const migration = clone(baselineMigration);
    const platforms = clone(baselinePlatforms);
    fixture.change(migration, platforms);
    const result = validate(migration, platforms);
    assert.ok(
      result.errors.some((error) => fixture.pattern.test(error)),
      `${fixture.label}: ${result.errors.join("\n")}`,
    );
  }
});

test("Apple overlay routing rejects an unapproved feed URL", () => {
  const migration = clone(baselineMigration);
  const platforms = clone(baselinePlatforms);
  platforms.platforms.apple.feedRouting.approvedFeedUrl =
    "https://example.test/feed.xml";
  const result = validate(migration, platforms);
  assert.ok(
    result.errors.some((error) =>
      /platforms\.apple\.feedRouting\.approvedFeedUrl/.test(error),
    ),
  );
});

test("post-redirect active state remains frozen until completion", () => {
  const { migration, platforms } = completedFixture();
  migration.status = "redirect_verified_downstream_validation";
  migration.decision.active = true;
  migration.gates.publishingFreezeActive = true;
  platforms.pendingHostingMigration.active = true;
  platforms.pendingHostingMigration.status = "redirect_verified_downstream_validation";
  const result = validate(migration, platforms);
  assert.equal(result.phase, "post_redirect_validation");
  assert.deepEqual(result.errors, []);
  assert.equal(migrationCheckMode(result.phase), "post_redirect_validation");
});

test("semantic validation rejects contradictory routing, phase, feed, gate, and identity records", () => {
  const cases = [
    {
      label: "mismatched active flags",
      change(migration) {
        migration.decision.active = false;
      },
      pattern: /status and active flags are inconsistent/,
    },
    {
      label: "premature cutover readiness",
      change(_migration, platforms) {
        platforms.pendingHostingMigration.cutoverReady = true;
      },
      pattern: /cutoverReady must equal/,
    },
    {
      label: "wrong canonical host",
      change(_migration, platforms) {
        platforms.podcastDistribution.canonicalHost = "spotify";
      },
      pattern: /podcastDistribution\.canonicalHost/,
    },
    {
      label: "premature current feed",
      change(migration) {
        migration.existingListings.spotify.currentFeedUrl = HOST_MIGRATION_IDENTITIES.targetFeedUrl;
      },
      pattern: /existingListings\.spotify\.currentFeedUrl/,
    },
    {
      label: "wrong target URL",
      change(migration) {
        migration.destination.proposedPermanentFeedUrl = "https://example.test/wrong.xml";
      },
      pattern: /destination\.proposedPermanentFeedUrl/,
    },
    {
      label: "changed stable Spotify ID",
      change(_migration, platforms) {
        platforms.platforms.spotify.destinationIds.containerId = "wrong";
      },
      pattern: /platforms\.spotify\.destinationIds\.containerId/,
    },
    {
      label: "changed stable Apple ID",
      change(migration) {
        migration.existingListings.apple.showId = "123";
      },
      pattern: /existingListings\.apple\.showId/,
    },
  ];

  for (const fixture of cases) {
    const { migration, platforms } = activeFixture();
    fixture.change(migration, platforms);
    const result = validate(migration, platforms);
    assert.ok(result.errors.some((error) => fixture.pattern.test(error)), `${fixture.label}: ${result.errors.join("\n")}`);
  }
});

test("snapshot evidence cannot claim checks performed before metadata cleanup", () => {
  const { migration, platforms } = activeFixture();
  migration.destination.validation.verifiedAt = "2026-08-06T17:02:27Z";
  migration.destination.canonicalMetadataCleanedAt = "2026-08-06T17:25:00Z";
  migration.destination.validation.canonicalTargetMetadataPassed = true;
  const result = validate(migration, platforms);
  assert.ok(result.errors.some((error) => /canonicalTargetMetadataPassed is stale/.test(error)));
});

test("a completed status cannot pass with stale pre-cutover gates or feeds", () => {
  const { migration, platforms } = completedFixture();
  migration.gates.episodeMetadataMatches = false;
  migration.existingListings.apple.currentFeedUrl = HOST_MIGRATION_IDENTITIES.sourceFeedUrl;
  migration.destination.validation.fullPreflightPassed = false;
  migration.destination.validation.blockingMismatch = "stale evidence";
  const result = validate(migration, platforms);
  assert.equal(hostingMigrationPhase(migration, platforms.pendingHostingMigration), "completed");
  assert.ok(result.errors.some((error) => /cutoverReady must equal/.test(error)));
  assert.ok(result.errors.some((error) => /existingListings\.apple\.currentFeedUrl/.test(error)));
  assert.ok(result.errors.some((error) => /fullPreflightPassed/.test(error)));
});
