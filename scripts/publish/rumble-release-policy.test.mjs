import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateRumbleReleasePolicy } from "./rumble-release-policy.mjs";

const schema = JSON.parse(
  await fs.readFile(new URL("../../publishing/rumble-release-policy.schema.json", import.meta.url), "utf8")
);
const policy = JSON.parse(
  await fs.readFile(new URL("../../publishing/rumble-release-policy.json", import.meta.url), "utf8")
);
const platforms = JSON.parse(
  await fs.readFile(new URL("../../publishing/platforms.json", import.meta.url), "utf8")
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv, { mode: "full" });
const validate = ajv.compile(schema);

function readyPolicy() {
  const candidate = structuredClone(policy);
  candidate.status = "ready_for_manual_submission";
  Object.assign(candidate.actionGates, {
    optionCSelectedAll: true,
    unlistedAll: true,
    youtubeSyndicationDisabledAll: true,
    vimeoSyndicationDisabledAll: true,
    facebookSyndicationDisabledAll: true,
    premiumExclusiveDisabledAll: true,
    aiMlGeneralLicenseAcknowledged: true,
    thirdPartyAssetRightsReviewed: true,
    allFormsReverified: true,
  });
  Object.assign(candidate.currentAudit, {
    optionCSelectedCount: 7,
    unlistedCount: 7,
    youtubeSyndicationEnabledCount: 0,
    vimeoSyndicationEnabledCount: 0,
    facebookSyndicationEnabledCount: 0,
  });
  return candidate;
}

function completeEpisodeResults() {
  return Array.from({ length: 7 }, (_, index) => ({
    episodeNumber: index + 1,
    remoteId: `rumble-video-${index + 1}`,
    remoteUrl: `https://rumble.com/v${index + 1}`,
  }));
}

function submittedPolicy() {
  const candidate = readyPolicy();
  candidate.status = "submitted_pending_verification";
  candidate.currentAudit.submittedCount = 7;
  Object.assign(candidate.actionGates, {
    humanRightsAttestationCompletedAll: true,
    humanTermsAcceptanceCompletedAll: true,
    submittedAll: true,
  });
  candidate.submissionReceipt = {
    submittedAt: "2026-08-07T12:00:00Z",
    submittedBy: "Otto",
    submissionMethod: "manual_human_only",
    termsLastModified: "2026-07-21",
    accountId: "282015440",
    channelId: "7820170",
    policyRevision: 1,
    episodeResults: completeEpisodeResults(),
  };
  return candidate;
}

test("checked-in Rumble policy is structurally valid and fail-closed", () => {
  assert.equal(validate(policy), true, JSON.stringify(validate.errors, null, 2));
  assert.deepEqual(validateRumbleReleasePolicy(policy), []);
  assert.equal(policy.requiredReleaseConfiguration.license, "rumble_only_option_c");
  assert.equal(policy.requiredReleaseConfiguration.exclusive, false);
  assert.deepEqual(policy.requiredReleaseConfiguration.syndication, {
    youtube: false,
    vimeo: false,
    facebook: false,
  });
  assert.equal(policy.requiredReleaseConfiguration.premiumExclusive, false);
  assert.equal(policy.requiredReleaseConfiguration.submissionMethod, "manual_human_only");
  assert.equal(policy.terms.automatedInteractionAllowed, false);
  assert.equal(policy.status, "blocked_manual_corrections_and_acknowledgment_required");
  assert.equal(policy.currentAudit.youtubeSyndicationEnabledCount, 7);
  assert.equal(policy.actionGates.youtubeSyndicationDisabledAll, false);
  assert.equal(policy.actionGates.aiMlGeneralLicenseAcknowledged, false);
  assert.equal(policy.actionGates.thirdPartyAssetRightsReviewed, false);
  assert.equal(policy.submissionReceipt, null);
});

test("platform registry and Rumble policy cannot drift on release-critical controls", () => {
  const rumble = platforms.platforms.rumble;
  assert.equal(rumble.mode, "manual_human_only");
  assert.equal(rumble.releasePolicy.policyFile, "publishing/rumble-release-policy.json");
  assert.equal(rumble.releasePolicy.requiredLicense, policy.requiredReleaseConfiguration.license);
  assert.equal(rumble.releasePolicy.exclusive, policy.requiredReleaseConfiguration.exclusive);
  assert.equal(rumble.releasePolicy.initialVisibility, policy.requiredReleaseConfiguration.initialVisibility);
  assert.deepEqual(rumble.releasePolicy.syndication, policy.requiredReleaseConfiguration.syndication);
  assert.equal(rumble.releasePolicy.premiumExclusive, policy.requiredReleaseConfiguration.premiumExclusive);
  assert.equal(rumble.releasePolicy.termsLastModified, policy.terms.lastModified);
  assert.equal(rumble.releasePolicy.automationRequiresPriorWrittenPermission, true);
  assert.equal(rumble.releasePolicy.submissionMethod, policy.requiredReleaseConfiguration.submissionMethod);
  assert.equal(rumble.youtubeSyndicationEnabledCount, policy.currentAudit.youtubeSyndicationEnabledCount);
  assert.equal(rumble.submitted, false);
});

test("Rumble policy schema rejects exclusive, syndicated, automated, or prematurely ready state", () => {
  for (const mutation of [
    (value) => { value.requiredReleaseConfiguration.exclusive = true; },
    (value) => { value.requiredReleaseConfiguration.syndication.youtube = true; },
    (value) => { value.requiredReleaseConfiguration.premiumExclusive = true; },
    (value) => { value.terms.automatedInteractionAllowed = true; },
    (value) => { value.status = "ready_for_manual_submission"; },
  ]) {
    const candidate = structuredClone(policy);
    mutation(candidate);
    assert.equal(validate(candidate), false, JSON.stringify(candidate, null, 2));
  }
});

test("ready state requires every explicit user authorization", () => {
  const ready = readyPolicy();
  assert.equal(validate(ready), true, JSON.stringify(validate.errors, null, 2));

  for (const authorization of Object.keys(ready.userAuthorizations)) {
    const candidate = structuredClone(ready);
    candidate.userAuthorizations[authorization] = false;
    assert.equal(validate(candidate), false, `${authorization} was not required`);
  }

  const unsafeAudit = structuredClone(ready);
  unsafeAudit.currentAudit.youtubeSyndicationEnabledCount = 7;
  assert.equal(validate(unsafeAudit), false, "ready state accepted enabled YouTube syndication");
});

test("submitted and verified states require coherent seven-episode evidence", () => {
  const submitted = submittedPolicy();
  assert.equal(validate(submitted), true, JSON.stringify(validate.errors, null, 2));

  const incomplete = structuredClone(submitted);
  incomplete.submissionReceipt.episodeResults.pop();
  assert.equal(validate(incomplete), false, "an incomplete submission receipt was accepted");

  const wrongOrigin = structuredClone(submitted);
  wrongOrigin.submissionReceipt.episodeResults[0].remoteUrl = "file:///tmp/not-rumble";
  assert.equal(validate(wrongOrigin), false, "a non-Rumble receipt URL was accepted");

  const duplicateEpisode = structuredClone(submitted);
  duplicateEpisode.submissionReceipt.episodeResults[6].episodeNumber = 6;
  assert.equal(validate(duplicateEpisode), false, "a duplicate episode receipt was accepted");

  const staleCount = structuredClone(submitted);
  staleCount.currentAudit.submittedCount = 0;
  assert.equal(validate(staleCount), false, "submitted state accepted a zero submitted count");

  const prematurelyVerified = structuredClone(submitted);
  prematurelyVerified.actionGates.remoteResultsVerifiedAll = true;
  assert.equal(validate(prematurelyVerified), false, "pending state accepted verified remote results");

  const duplicateId = structuredClone(submitted);
  duplicateId.submissionReceipt.episodeResults[1].remoteId =
    duplicateId.submissionReceipt.episodeResults[0].remoteId;
  assert.equal(validate(duplicateId), true, JSON.stringify(validate.errors, null, 2));
  assert.ok(validateRumbleReleasePolicy(duplicateId).some((error) => error.includes("duplicate remote IDs")));

  const duplicateUrl = structuredClone(submitted);
  duplicateUrl.submissionReceipt.episodeResults[1].remoteUrl =
    `${duplicateUrl.submissionReceipt.episodeResults[0].remoteUrl}?tracking=duplicate`;
  assert.equal(validate(duplicateUrl), true, JSON.stringify(validate.errors, null, 2));
  assert.ok(validateRumbleReleasePolicy(duplicateUrl).some((error) => error.includes("duplicate remote URLs")));

  const verified = structuredClone(submitted);
  verified.status = "verified";
  verified.actionGates.remoteResultsVerifiedAll = true;
  assert.equal(validate(verified), true, JSON.stringify(validate.errors, null, 2));
  assert.deepEqual(validateRumbleReleasePolicy(verified), []);
});
