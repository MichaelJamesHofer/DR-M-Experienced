import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  APPLE_GUID_REPAIR_PENDING_STATUS,
  appleGuidRepairSemanticErrors,
  validateAppleGuidRepair,
  validateAppleGuidRepairAuthorities,
} from "./apple-guid-repair.mjs";

const root = new URL("../../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

const baseline = await readJson("publishing/apple-guid-repair.json");
const hostingMigration = await readJson("publishing/hosting-migration.json");
const platforms = await readJson("publishing/platforms.json");

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

function assertInvalidAuthorityMutation(change, pattern) {
  const authorities = {
    repair: structuredClone(baseline),
    hostingMigration: structuredClone(hostingMigration),
    platforms: structuredClone(platforms),
  };
  change(authorities);
  const result = validateAppleGuidRepairAuthorities(authorities);
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((error) => pattern.test(error)),
    `expected ${pattern}; got:\n${result.errors.join("\n")}`,
  );
}

test("Apple GUID repair record is valid and remains fail-closed", () => {
  const result = validateAppleGuidRepair(baseline);

  assert.deepEqual(result.errors, []);
  assert.equal(baseline.schemaVersion, 3);
  assert.equal(baseline.status, APPLE_GUID_REPAIR_PENDING_STATUS);
  assert.equal(baseline.lastVerifiedAt, "2026-08-26");
  assert.equal(
    baseline.supportOutreach.apple.status,
    "missing_podcasts_escalation_submitted_pending_response",
  );
  assert.equal(
    baseline.supportOutreach.apple.initialReprocessingRequest.submittedOn,
    "2026-08-06",
  );
  assert.equal(
    baseline.supportOutreach.apple.historicalGuidCrosswalkReply.receivedOn,
    "2026-08-07",
  );
  assert.equal(
    baseline.supportOutreach.apple.serverSideRemapFollowUp.submittedAt,
    "2026-08-08T20:18:00Z",
  );
  assert.deepEqual(baseline.supportOutreach.apple.latestEscalation, {
    status: "submitted_pending_response",
    submittedOn: "2026-08-26",
    submittedOnPrecision: "date",
    submittedAfter: "2026-08-26T19:17:38Z",
    submittedBefore: "2026-08-26T19:19:01Z",
    authenticated: true,
    channel: "Apple Podcasts Connect Contact Us",
    category: "Missing Podcast(s)",
    caseReference: "20000130526608",
    request:
      "Publish the two existing RSS-sourced Episode 1-2 records in place on show 1870433419 while preserving Apple episode IDs 1000746628307 and 1000746628422; do not create replacement records.",
  });
  assert.equal(baseline.supportOutreach.rssCom.status, "sent_pending_response");
  assert.equal(
    baseline.supportOutreach.spotify.status,
    "advisor_investigating_pending_technical_response",
  );
  assert.equal(baseline.gates.appleTitleMappingIndependentlyVerified, true);
  assert.equal(baseline.gates.rssComInPlaceEditConfirmed, false);
  assert.equal(baseline.gates.spotifyIdentityPreservationConfirmed, false);
  assert.equal(baseline.gates.exactRemoteChangeApproved, false);
  assert.equal(baseline.gates.remoteWritePerformed, false);
  assert.equal(baseline.gates.feedVerified, false);
  assert.equal(baseline.gates.appleIdentityPreserved, false);
  assert.equal(baseline.gates.spotifyIdentityPreserved, false);
});

test("deployed Apple-only overlay receipt records a pending, identity-preserving result", () => {
  const overlay = baseline.appleOnlyOverlay;
  assert.deepEqual(
    {
      routingStatus: overlay.routingStatus,
      guidEpisodes: overlay.guidState.episodeNumbers,
      deploymentVerifiedAt: overlay.deployment.deploymentVerifiedAt,
      deploymentCompletedAt: overlay.deployment.completedAt,
      feedSwitchObservedAt:
        overlay.appleConnectReadback.appleFeedSwitchObservedAt,
      dashboardLastUpdateAt: overlay.appleConnectReadback.dashboardLastUpdateAt,
      refreshObservedAt: overlay.appleConnectReadback.feedRefreshObservedCompleteAt,
      available: overlay.appleConnectReadback.availableEpisodeCount,
      draft: overlay.appleConnectReadback.draftEpisodeCount,
      public: overlay.publicCatalogReadback.visibleEpisodeCount,
      fallback: overlay.canonicalMutationFallbackStatus,
      publicationOutcome: overlay.publicationOutcome,
    },
    {
      routingStatus: "active",
      guidEpisodes: [1, 2],
      deploymentVerifiedAt: "2026-08-26T17:26:24.245Z",
      deploymentCompletedAt: "2026-08-26T17:26:27Z",
      feedSwitchObservedAt: "2026-08-26T19:04:00Z",
      dashboardLastUpdateAt: "2026-08-26T19:04:00Z",
      refreshObservedAt: "2026-08-26T19:06:00Z",
      available: 6,
      draft: 2,
      public: 6,
      fallback: "blocked_not_in_use",
      publicationOutcome: "pending_apple_catalog_availability",
    },
  );
});

test("Apple receipt, host migration, and platform registry agree", () => {
  assert.deepEqual(
    validateAppleGuidRepairAuthorities({
      repair: baseline,
      hostingMigration,
      platforms,
    }),
    { valid: true, errors: [] },
  );
});

test("Apple receipt chronology rejects reordered lifecycle evidence", async (t) => {
  const cases = [
    {
      label: "initial request after Apple reply",
      change(repair) {
        repair.supportOutreach.apple.initialReprocessingRequest.submittedOn =
          "2026-08-08";
      },
      pattern:
        /initialReprocessingRequest\.submittedOn must not be later than supportOutreach\.apple\.historicalGuidCrosswalkReply\.receivedOn/,
    },
    {
      label: "latest escalation before remap follow-up",
      change(repair) {
        repair.supportOutreach.apple.latestEscalation.submittedOn = "2026-08-07";
      },
      pattern:
        /serverSideRemapFollowUp\.submittedAt must not be later than supportOutreach\.apple\.latestEscalation\.submittedOn/,
    },
    {
      label: "deployment verification after completion",
      change(repair) {
        repair.appleOnlyOverlay.deployment.deploymentVerifiedAt =
          "2026-08-26T17:26:28Z";
      },
      pattern:
        /deploymentVerifiedAt must not be later than appleOnlyOverlay\.deployment\.completedAt/,
    },
    {
      label: "feed switch before deployment",
      change(repair) {
        repair.appleOnlyOverlay.appleConnectReadback.appleFeedSwitchObservedAt =
          "2026-08-26T17:26:26Z";
      },
      pattern:
        /deployment\.completedAt must not be later than appleOnlyOverlay\.appleConnectReadback\.appleFeedSwitchObservedAt/,
    },
    {
      label: "refresh before feed switch",
      change(repair) {
        repair.appleOnlyOverlay.appleConnectReadback.feedRefreshObservedCompleteAt =
          "2026-08-26T19:03:00Z";
      },
      pattern:
        /appleFeedSwitchObservedAt must not be later than appleOnlyOverlay\.appleConnectReadback\.feedRefreshObservedCompleteAt/,
    },
    {
      label: "public catalog readback before refresh",
      change(repair) {
        repair.appleOnlyOverlay.publicCatalogReadback.verifiedAt =
          "2026-08-26T19:05:00Z";
      },
      pattern:
        /feedRefreshObservedCompleteAt must not be later than appleOnlyOverlay\.publicCatalogReadback\.verifiedAt/,
    },
    {
      label: "independent feed readback before public catalog readback",
      change(repair) {
        repair.appleOnlyOverlay.deployment.latestIndependentPublicFeedReadbackAt =
          "2026-08-26T19:13:00Z";
      },
      pattern:
        /publicCatalogReadback\.verifiedAt must not be later than appleOnlyOverlay\.deployment\.latestIndependentPublicFeedReadbackAt/,
    },
    {
      label: "escalation lower bound before independent feed readback",
      change(repair) {
        repair.supportOutreach.apple.latestEscalation.submittedAfter =
          "2026-08-26T19:17:37Z";
      },
      pattern:
        /latestIndependentPublicFeedReadbackAt must not be later than supportOutreach\.apple\.latestEscalation\.submittedAfter/,
    },
    {
      label: "escalation upper bound before lower bound",
      change(repair) {
        repair.supportOutreach.apple.latestEscalation.submittedBefore =
          "2026-08-26T19:17:37Z";
      },
      pattern:
        /latestEscalation\.submittedAfter must not be later than supportOutreach\.apple\.latestEscalation\.submittedBefore/,
    },
  ];

  for (const fixture of cases) {
    await t.test(fixture.label, () => {
      const repair = cloneBaseline();
      fixture.change(repair);
      const errors = appleGuidRepairSemanticErrors(repair);
      assert.ok(
        errors.some((error) => fixture.pattern.test(error)),
        `expected ${fixture.pattern}; got:\n${errors.join("\n")}`,
      );
    });
  }
});

test("cross-authority validation rejects count, identity, evidence, and support drift", async (t) => {
  const cases = [
    {
      label: "count arithmetic drift",
      change({ hostingMigration: migration }) {
        migration.existingListings.apple.appleOnlyOverlay.dashboardAvailableEpisodeCount =
          7;
      },
      pattern: /hosting overlay receipt available \+ draft must equal total/,
    },
    {
      label: "draft episode set drift",
      change({ platforms: registry }) {
        registry.downstreamPropagation.issues[0].draftEpisodeNumbers = [1, 3];
      },
      pattern: /platform downstream issue\.draftEpisodes must be exactly \[1,2\]/,
    },
    {
      label: "public episode partition drift",
      change({ platforms: registry }) {
        registry.platforms.apple.latestPublicReadback.missingEpisodeNumbers = [1];
      },
      pattern: /platform public readback\.missingEpisodes must be exactly \[1,2\]/,
    },
    {
      label: "deployment commit drift",
      change({ hostingMigration: migration }) {
        migration.existingListings.apple.appleOnlyOverlay.deploymentCommit =
          "0000000000000000000000000000000000000000";
      },
      pattern: /hosting overlay deployment commit must match/,
    },
    {
      label: "public feed hash drift",
      change({ platforms: registry }) {
        registry.platforms.apple.appleOnlyOverlayDeployment.publicFeedSha256 =
          "0".repeat(64);
      },
      pattern: /platform overlay feed hash must match/,
    },
    {
      label: "feed switch timestamp drift",
      change({ platforms: registry }) {
        registry.platforms.apple.appleFeedSwitchObservedAt =
          "2026-08-26T19:05:00Z";
      },
      pattern: /platform Apple feed switch time must match/,
    },
    {
      label: "support status drift",
      change({ hostingMigration: migration }) {
        migration.existingListings.apple.appleOnlyOverlay.supportEscalationStatus =
          "resolved";
      },
      pattern: /hosting latest escalation status must match/,
    },
    {
      label: "support date drift",
      change({ platforms: registry }) {
        registry.downstreamPropagation.issues[0].latestSupportEscalationSubmittedOn =
          "2026-08-25";
      },
      pattern: /platform issue latest escalation date must match/,
    },
    {
      label: "duplicate hosting Apple issue",
      change({ hostingMigration: migration }) {
        const issue = migration.downstreamPropagation.issues.find(
          (candidate) => candidate.showId === baseline.appleShowId,
        );
        migration.downstreamPropagation.issues.push(structuredClone(issue));
      },
      pattern: /hosting migration must contain exactly one Apple pending issue candidate/,
    },
    {
      label: "duplicate platform Apple issue",
      change({ platforms: registry }) {
        const issue = registry.downstreamPropagation.issues.find(
          (candidate) => candidate.showId === baseline.appleShowId,
        );
        registry.downstreamPropagation.issues.push(structuredClone(issue));
      },
      pattern: /platform registry must contain exactly one Apple pending issue candidate/,
    },
    {
      label: "hosting Apple issue code drift",
      change({ hostingMigration: migration }) {
        migration.downstreamPropagation.issues.find(
          (issue) => issue.showId === baseline.appleShowId,
        ).code = "wrong_apple_issue_code";
      },
      pattern: /hosting Apple issue code must match/,
    },
    {
      label: "platform Apple issue code drift",
      change({ platforms: registry }) {
        registry.downstreamPropagation.issues.find(
          (issue) => issue.showId === baseline.appleShowId,
        ).code = "wrong_apple_issue_code";
      },
      pattern: /platform Apple issue code must match/,
    },
    {
      label: "hosting expected-code partial duplicate without show ID",
      change({ hostingMigration: migration }) {
        const issue = structuredClone(
          migration.downstreamPropagation.issues.find(
            (candidate) => candidate.showId === baseline.appleShowId,
          ),
        );
        delete issue.showId;
        migration.downstreamPropagation.issues.push(issue);
      },
      pattern: /hosting migration must contain exactly one Apple pending issue candidate/,
    },
    {
      label: "platform same-show partial duplicate with wrong code",
      change({ platforms: registry }) {
        const issue = structuredClone(
          registry.downstreamPropagation.issues.find(
            (candidate) => candidate.showId === baseline.appleShowId,
          ),
        );
        issue.code = "wrong_apple_issue_code";
        registry.downstreamPropagation.issues.push(issue);
      },
      pattern: /platform registry must contain exactly one Apple pending issue candidate/,
    },
    {
      label: "hosting downstream status cannot claim completion",
      change({ hostingMigration: migration }) {
        migration.downstreamPropagation.status = "complete";
      },
      pattern: /hosting downstream propagation status must match/,
    },
    {
      label: "platform downstream status cannot claim resolution",
      change({ platforms: registry }) {
        registry.downstreamPropagation.status = "resolved";
      },
      pattern: /platform downstream propagation status must match/,
    },
    {
      label: "historical route URL drift",
      change({ hostingMigration: migration }) {
        migration.existingListings.apple.historicalDirectRssComRoute.feedUrl =
          "https://example.com/feed.xml";
      },
      pattern: /historical direct RSS\.com route URL must match/,
    },
    {
      label: "historical redirect timestamp moved to 2099",
      change({ hostingMigration: migration }) {
        migration.existingListings.apple.historicalDirectRssComRoute.effectiveViaRedirectAt =
          "2099-01-01T00:00:00Z";
      },
      pattern: /effectiveViaRedirectAt must not be later than/,
    },
    {
      label: "historical direct-route timestamp moved to 2099",
      change({ hostingMigration: migration }) {
        migration.existingListings.apple.historicalDirectRssComRoute.directFeedChangedAt =
          "2099-01-01T00:00:00Z";
      },
      pattern: /directFeedChangedAt must not be later than/,
    },
    {
      label: "hosting draft deletion authorized",
      change({ hostingMigration: migration }) {
        migration.existingListings.apple.draftDeletionAuthorized = true;
      },
      pattern: /hosting draft deletion authorization must match/,
    },
    {
      label: "hosting issue deletion authorized",
      change({ hostingMigration: migration }) {
        migration.downstreamPropagation.issues.find(
          (issue) => issue.showId === baseline.appleShowId,
        ).deletionAuthorized = true;
      },
      pattern: /hosting issue deletion authorization must match/,
    },
    {
      label: "platform issue deletion authorized",
      change({ platforms: registry }) {
        registry.downstreamPropagation.issues.find(
          (issue) => issue.showId === baseline.appleShowId,
        ).deletionAuthorized = true;
      },
      pattern: /platform issue deletion authorization must match/,
    },
    {
      label: "hosting issue canonical mutation unblocked",
      change({ hostingMigration: migration }) {
        migration.downstreamPropagation.issues.find(
          (issue) => issue.showId === baseline.appleShowId,
        ).canonicalFeedMutationBlocked = false;
      },
      pattern: /hosting issue canonical mutation block must match/,
    },
    {
      label: "platform issue canonical mutation unblocked",
      change({ platforms: registry }) {
        registry.downstreamPropagation.issues.find(
          (issue) => issue.showId === baseline.appleShowId,
        ).canonicalFeedMutationBlocked = false;
      },
      pattern: /platform issue canonical mutation block must match/,
    },
    {
      label: "hosting issue support request not submitted",
      change({ hostingMigration: migration }) {
        migration.downstreamPropagation.issues.find(
          (issue) => issue.showId === baseline.appleShowId,
        ).supportRequestSubmitted = false;
      },
      pattern: /hosting issue support request submission must match/,
    },
    {
      label: "platform issue support request not submitted",
      change({ platforms: registry }) {
        registry.downstreamPropagation.issues.find(
          (issue) => issue.showId === baseline.appleShowId,
        ).supportRequestSubmitted = false;
      },
      pattern: /platform issue support request submission must match/,
    },
    {
      label: "hosting diagnosis no longer requires escalation",
      change({ hostingMigration: migration }) {
        migration.existingListings.apple.remainingDraftDiagnosis.supportEscalationRequired =
          false;
      },
      pattern: /hosting diagnosis support escalation requirement must match/,
    },
    {
      label: "platform latest escalation authentication drift",
      change({ platforms: registry }) {
        registry.platforms.apple.latestSupportEscalation.authenticated = false;
      },
      pattern: /platform latest escalation authentication must match/,
    },
    {
      label: "hosting latest escalation authentication drift",
      change({ hostingMigration: migration }) {
        migration.existingListings.apple.appleOnlyOverlay.supportEscalationAuthenticated =
          false;
      },
      pattern: /hosting latest escalation authentication must match/,
    },
    {
      label: "platform requested outcome drift",
      change({ platforms: registry }) {
        registry.platforms.apple.latestSupportEscalation.requestedOutcome =
          "Create replacements.";
      },
      pattern: /platform latest escalation requested outcome must match/,
    },
    {
      label: "hosting requested outcome drift",
      change({ hostingMigration: migration }) {
        migration.existingListings.apple.appleOnlyOverlay.supportEscalationRequestedOutcome =
          "Create replacements.";
      },
      pattern: /hosting latest escalation requested outcome must match/,
    },
    {
      label: "platform escalation window drift",
      change({ platforms: registry }) {
        registry.platforms.apple.latestSupportEscalation.submittedBefore =
          "2026-08-26T19:20:00Z";
      },
      pattern: /platform latest escalation upper bound must match/,
    },
  ];

  for (const fixture of cases) {
    await t.test(fixture.label, () => {
      assertInvalidAuthorityMutation(fixture.change, fixture.pattern);
    });
  }
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
    "blocked historical GUIDs must not become canonical before remote verification",
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
      label: "submission is newer than verification",
      change(repair) {
        repair.supportOutreach.rssCom.submittedAt = "2026-08-27T00:00:00Z";
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
        repair.supportOutreach.spotify.lastFollowedUpAt = "2026-08-27T00:00:00Z";
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
        repair.supportOutreach.spotify.lastResponseAt = "2026-08-27T00:00:00Z";
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

test("blocked canonical mutation fallback rejects approval and write claims", async (t) => {
  for (const gate of [
    "exactRemoteChangeApproved",
    "remoteWritePerformed",
    "feedVerified",
    "appleIdentityPreserved",
    "spotifyIdentityPreserved",
  ]) {
    await t.test(gate, () => {
      assertInvalidMutation(
        (repair) => {
          repair.gates[gate] = true;
        },
        new RegExp(
          `blocked canonical mutation fallback requires gates\\.${gate}=false`,
        ),
      );
    });
  }
});

test("downstream true gates require every prerequisite", async (t) => {
  const cases = [
    {
      label: "approval requires provider identity guarantees",
      gate: "exactRemoteChangeApproved",
      prerequisite: "rssComInPlaceEditConfirmed",
    },
    {
      label: "operation snapshot requires exact approval",
      gate: "beforeSnapshotCaptured",
      prerequisite: "exactRemoteChangeApproved",
    },
    {
      label: "write requires exact approval",
      gate: "remoteWritePerformed",
      prerequisite: "exactRemoteChangeApproved",
    },
    {
      label: "write requires a before snapshot",
      gate: "remoteWritePerformed",
      prerequisite: "beforeSnapshotCaptured",
    },
    {
      label: "feed verification requires a write",
      gate: "feedVerified",
      prerequisite: "remoteWritePerformed",
    },
    {
      label: "Apple preservation requires feed verification",
      gate: "appleIdentityPreserved",
      prerequisite: "feedVerified",
    },
    {
      label: "Spotify preservation requires prior provider confirmation",
      gate: "spotifyIdentityPreserved",
      prerequisite: "spotifyIdentityPreservationConfirmed",
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
