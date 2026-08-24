import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  APPLE_GUID_REPAIR_APPROVED_STATUS,
  APPLE_GUID_REPAIR_COMPLETE_STATUS,
  APPLE_GUID_REPAIR_DEPLOYED_STATUS,
  APPLE_GUID_REPAIR_PROCESSING_STATUS,
  validateAppleGuidRepair,
} from "./apple-guid-repair.mjs";

const root = new URL("../../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

const baseline = await readJson("publishing/apple-guid-repair.json");

function cloneBaseline() {
  return structuredClone(baseline);
}

function assertInvalidMutation(change, pattern) {
  const repair = cloneBaseline();
  change(repair);
  const result = validateAppleGuidRepair(repair);
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((error) => pattern.test(error)),
    `expected ${pattern}; got:\n${result.errors.join("\n")}`,
  );
}

test("Apple GUID repair is approved locally and remains pre-deployment", () => {
  const result = validateAppleGuidRepair(baseline);

  assert.deepEqual(result.errors, []);
  assert.equal(baseline.status, APPLE_GUID_REPAIR_APPROVED_STATUS);
  assert.equal(baseline.lastVerifiedAt, "2026-08-24");
  assert.equal(
    baseline.supportOutreach.apple.status,
    "engineering_escalation_pending_response",
  );
  assert.equal(
    baseline.supportOutreach.rssCom.status,
    "responded_no_supported_in_place_guid_edit",
  );
  assert.equal(
    baseline.supportOutreach.spotify.status,
    "advisor_investigating_pending_technical_response",
  );
  assert.equal(baseline.gates.appleTitleMappingIndependentlyVerified, true);
  assert.equal(baseline.gates.rssComInPlaceEditAvailable, false);
  assert.equal(baseline.gates.overlayLocallyValidated, true);
  assert.equal(baseline.gates.exactRemoteChangeApproved, true);
  assert.equal(baseline.gates.beforeSnapshotCaptured, true);
  assert.equal(baseline.gates.githubPagesWorkflowModeVerified, false);
  assert.equal(baseline.gates.remoteWritePerformed, false);
  assert.equal(baseline.gates.overlayPublished, false);
  assert.equal(baseline.gates.feedVerified, false);
  assert.equal(baseline.gates.appleFeedUrlChanged, false);
  assert.equal(baseline.gates.applePublicSevenEpisodesVerified, false);
});

test("approved mechanism and before-state evidence are exact and tracked", async () => {
  const evidence = await readJson(baseline.beforeState.manifestPath);
  assert.equal(
    baseline.repairMechanism.publicFeedUrl,
    "https://drmexperienced.com/apple-podcasts/feed.xml",
  );
  assert.equal(baseline.repairMechanism.configPath, "publishing/apple-feed-overlay.json");
  assert.equal(baseline.repairMechanism.approval.approvedAt, "2026-08-24T19:44:40Z");
  assert.equal(evidence.capturedAt, baseline.beforeState.capturedAt);
  assert.equal(evidence.sourceFeed.sha256, baseline.beforeState.sourceFeedSha256);
  assert.equal(evidence.sourceFeed.sizeBytes, baseline.beforeState.sourceFeedSizeBytes);
  assert.equal(evidence.sourceFeed.items.length, 7);
  assert.equal(evidence.applePublic.sha256, baseline.beforeState.applePublicSha256);
  assert.equal(evidence.applePublic.episodeIds.length, 5);
});

test("exact Episode 1-2 crosswalk is order independent", () => {
  const repair = cloneBaseline();
  repair.episodes.reverse();
  assert.deepEqual(validateAppleGuidRepair(repair), { valid: true, errors: [] });
});

test("pending Apple repair crosswalk matches current catalog identities", async () => {
  const catalog = await readJson("publishing/master-catalog.json");
  const currentGuids = new Set();
  const historicalGuids = new Set();

  for (const entry of baseline.episodes) {
    const episode = catalog.episodes.find(
      (candidate) => candidate.number === entry.episodeNumber,
    );
    assert.ok(episode, `missing catalog episode ${entry.episodeNumber}`);
    assert.equal(episode.slug, entry.slug);
    assert.equal(episode.title, entry.title);
    assert.equal(episode.rssGuid, entry.currentFeedGuid);
    assert.equal(episode.destinations.spotify.id, entry.spotifyEpisodeId);
    assert.notEqual(entry.currentFeedGuid, entry.appleHistoricalGuid);
    currentGuids.add(entry.currentFeedGuid);
    historicalGuids.add(entry.appleHistoricalGuid);
  }

  assert.equal(currentGuids.size, 2);
  assert.equal(historicalGuids.size, 2);
  assert.equal(
    catalog.episodes.some((episode) => historicalGuids.has(episode.rssGuid)),
    false,
    "Apple historical GUIDs must remain isolated from the canonical RSS catalog",
  );
});

test("crosswalk mutations cannot swap, duplicate, or collide identities", async (t) => {
  const cases = [
    {
      label: "duplicate Episode 1 entry",
      change(repair) {
        repair.episodes[1] = structuredClone(repair.episodes[0]);
      },
      pattern: /exactly one Episode 2|duplicate episodeNumber/,
    },
    {
      label: "swap RSS.com episode IDs",
      change(repair) {
        [repair.episodes[0].rssComEpisodeId, repair.episodes[1].rssComEpisodeId] = [
          repair.episodes[1].rssComEpisodeId,
          repair.episodes[0].rssComEpisodeId,
        ];
      },
      pattern: /Episode 1 rssComEpisodeId must remain/,
    },
    {
      label: "duplicate Spotify episode ID",
      change(repair) {
        repair.episodes[1].spotifyEpisodeId = repair.episodes[0].spotifyEpisodeId;
      },
      pattern: /duplicate spotifyEpisodeId/,
    },
    {
      label: "reuse a current GUID as a historical GUID",
      change(repair) {
        repair.episodes[1].appleHistoricalGuid = repair.episodes[0].currentFeedGuid;
      },
      pattern: /historical GUID must not equal any current feed GUID/,
    },
    {
      label: "replace Episode 2 with an unknown episode number",
      change(repair) {
        repair.episodes[1].episodeNumber = 3;
      },
      pattern: /exactly one Episode 2 crosswalk entry/,
    },
  ];

  for (const fixture of cases) {
    await t.test(fixture.label, () => {
      assertInvalidMutation(fixture.change, fixture.pattern);
    });
  }
});

test("support outreach timestamps cannot predate discovery or outrun verification", async (t) => {
  const cases = [
    {
      label: "last verification predates discovery",
      change(repair) {
        repair.lastVerifiedAt = "2026-08-06";
      },
      pattern: /lastVerifiedAt must be on or after discoveredAt/,
    },
    {
      label: "submission predates discovery",
      change(repair) {
        repair.supportOutreach.apple.submittedAt = "2026-08-06T23:59:59Z";
      },
      pattern: /supportOutreach\.apple\.submittedAt predates discovery/,
    },
    {
      label: "submission is newer than verification",
      change(repair) {
        repair.supportOutreach.rssCom.submittedAt = "2026-08-25T00:00:00Z";
      },
      pattern: /supportOutreach\.rssCom\.submittedAt is newer than lastVerifiedAt/,
    },
    {
      label: "follow-up predates submission",
      change(repair) {
        repair.supportOutreach.spotify.lastFollowedUpAt = "2026-08-08T20:07:59Z";
      },
      pattern: /lastFollowedUpAt precedes submittedAt/,
    },
    {
      label: "follow-up is newer than verification",
      change(repair) {
        repair.supportOutreach.spotify.lastFollowedUpAt = "2026-08-25T00:00:00Z";
      },
      pattern: /lastFollowedUpAt is newer than lastVerifiedAt/,
    },
    {
      label: "advisor response predates follow-up",
      change(repair) {
        repair.supportOutreach.spotify.lastResponseAt = "2026-08-08T20:59:59Z";
      },
      pattern: /lastResponseAt precedes lastFollowedUpAt/,
    },
    {
      label: "advisor response is newer than verification",
      change(repair) {
        repair.supportOutreach.spotify.lastResponseAt = "2026-08-25T00:00:00Z";
      },
      pattern: /lastResponseAt is newer than lastVerifiedAt/,
    },
    {
      label: "Apple outreach uses a different case",
      change(repair) {
        repair.supportOutreach.apple.caseNumber = "20000130526609";
      },
      pattern: /caseNumber must match appleCaseNumber/,
    },
  ];

  for (const fixture of cases) {
    await t.test(fixture.label, () => {
      assertInvalidMutation(fixture.change, fixture.pattern);
    });
  }
});

test("approved pre-deployment state rejects premature remote claims", async (t) => {
  for (const gate of [
    "githubPagesWorkflowModeVerified",
    "remoteWritePerformed",
    "overlayPublished",
    "feedVerified",
    "sourceFeedUnchangedAfterDeploymentVerified",
    "appleFeedUrlChanged",
    "appleRefreshRequested",
    "appleExistingShowPreserved",
    "applePublicSevenEpisodesVerified",
    "applePlaybackVerified",
  ]) {
    await t.test(gate, () => {
      assertInvalidMutation(
        (repair) => {
          repair.gates[gate] = true;
        },
        new RegExp(
          `${APPLE_GUID_REPAIR_APPROVED_STATUS} requires gates\\.${gate}=false|must be equal to constant`,
        ),
      );
    });
  }
});

test("every Apple repair lifecycle status requires coherent gates", () => {
  const deployed = cloneBaseline();
  deployed.status = APPLE_GUID_REPAIR_DEPLOYED_STATUS;
  assert.equal(validateAppleGuidRepair(deployed).valid, false);
  for (const gate of [
    "githubPagesWorkflowModeVerified",
    "remoteWritePerformed",
    "overlayPublished",
    "feedVerified",
    "sourceFeedUnchangedAfterDeploymentVerified",
  ]) {
    deployed.gates[gate] = true;
  }
  assert.deepEqual(validateAppleGuidRepair(deployed), { valid: true, errors: [] });

  const processing = structuredClone(deployed);
  processing.status = APPLE_GUID_REPAIR_PROCESSING_STATUS;
  assert.equal(validateAppleGuidRepair(processing).valid, false);
  processing.gates.appleFeedUrlChanged = true;
  processing.gates.appleExistingShowPreserved = true;
  assert.deepEqual(validateAppleGuidRepair(processing), {
    valid: true,
    errors: [],
  });

  const complete = structuredClone(processing);
  complete.status = APPLE_GUID_REPAIR_COMPLETE_STATUS;
  assert.equal(validateAppleGuidRepair(complete).valid, false);
  complete.gates.applePublicSevenEpisodesVerified = true;
  complete.gates.applePlaybackVerified = true;
  assert.deepEqual(validateAppleGuidRepair(complete), { valid: true, errors: [] });
});

test("Apple repair lifecycle status matches platform and migration records", async () => {
  const platforms = await readJson("publishing/platforms.json");
  const migration = await readJson("publishing/hosting-migration.json");
  assert.equal(platforms.platforms.apple.feedRouting.status, baseline.status);
  assert.equal(
    platforms.podcastDistribution.appleFeedOverlay.status,
    baseline.status,
  );
  assert.equal(
    migration.existingListings.apple.appleFeedRoutingStatus,
    baseline.status,
  );
  const platformDownstream = platforms.downstreamPropagation.issues.find(
    (issue) => issue.code === "apple_episode_convergence_pending",
  );
  assert.equal(platformDownstream?.repairStatus, baseline.status);
  const migrationDownstream = migration.downstreamPropagation.issues.find(
    (issue) => issue.code === "apple_episode_historical_guid_mismatch_confirmed",
  );
  assert.equal(migrationDownstream?.repairStatus, baseline.status);
});

test("downstream true gates require every prerequisite", async (t) => {
  const cases = [
    {
      label: "approval requires local overlay validation",
      gate: "exactRemoteChangeApproved",
      prerequisite: "overlayLocallyValidated",
    },
    {
      label: "operation snapshot requires exact approval",
      gate: "beforeSnapshotCaptured",
      prerequisite: "exactRemoteChangeApproved",
    },
    {
      label: "Pages mode requires exact approval",
      gate: "githubPagesWorkflowModeVerified",
      prerequisite: "exactRemoteChangeApproved",
    },
    {
      label: "write requires verified Pages workflow mode",
      gate: "remoteWritePerformed",
      prerequisite: "githubPagesWorkflowModeVerified",
    },
    {
      label: "write requires a before snapshot",
      gate: "remoteWritePerformed",
      prerequisite: "beforeSnapshotCaptured",
    },
    {
      label: "feed verification requires a published overlay",
      gate: "feedVerified",
      prerequisite: "overlayPublished",
    },
    {
      label: "Apple URL change requires unchanged source verification",
      gate: "appleFeedUrlChanged",
      prerequisite: "sourceFeedUnchangedAfterDeploymentVerified",
    },
    {
      label: "public seven verification requires existing-show preservation",
      gate: "applePublicSevenEpisodesVerified",
      prerequisite: "appleExistingShowPreserved",
    },
  ];

  for (const fixture of cases) {
    await t.test(fixture.label, () => {
      assertInvalidMutation(
        (repair) => {
          repair.gates[fixture.gate] = true;
          repair.gates[fixture.prerequisite] = false;
        },
        new RegExp(
          `gates\\.${fixture.gate}=true requires gates\\.${fixture.prerequisite}=true`,
        ),
      );
    });
  }
});
