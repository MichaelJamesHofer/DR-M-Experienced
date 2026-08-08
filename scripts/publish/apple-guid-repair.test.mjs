import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  APPLE_GUID_REPAIR_BLOCKED_STATUS,
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

test("Apple GUID repair record is valid and remains fail-closed", () => {
  const result = validateAppleGuidRepair(baseline);

  assert.deepEqual(result.errors, []);
  assert.equal(baseline.status, APPLE_GUID_REPAIR_BLOCKED_STATUS);
  assert.equal(baseline.lastVerifiedAt, "2026-08-08");
  assert.equal(baseline.supportOutreach.apple.status, "submitted_pending_response");
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
      label: "submission predates discovery",
      change(repair) {
        repair.supportOutreach.apple.submittedAt = "2026-08-06T23:59:59Z";
      },
      pattern: /supportOutreach\.apple\.submittedAt predates discovery/,
    },
    {
      label: "submission is newer than verification",
      change(repair) {
        repair.supportOutreach.rssCom.submittedAt = "2026-08-09T00:00:00Z";
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
        repair.supportOutreach.spotify.lastFollowedUpAt = "2026-08-09T00:00:00Z";
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
        repair.supportOutreach.spotify.lastResponseAt = "2026-08-09T00:00:00Z";
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

test("blocked state rejects approval, writes, and post-write verification claims", async (t) => {
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
        new RegExp(`blocked incident status requires gates\\.${gate}=false`),
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
