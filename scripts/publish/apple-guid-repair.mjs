import fs from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

export const APPLE_GUID_REPAIR_PATH = new URL(
  "../../publishing/apple-guid-repair.json",
  import.meta.url,
);
export const APPLE_GUID_REPAIR_SCHEMA_PATH = new URL(
  "../../publishing/apple-guid-repair.schema.json",
  import.meta.url,
);

export const APPLE_GUID_REPAIR_PENDING_STATUS =
  "apple_overlay_active_catalog_availability_escalation_pending";
const APPLE_PENDING_ISSUE_CODE =
  "apple_episode_publication_pending_after_guid_overlay";

export const APPLE_GUID_REPAIR_CROSSWALK = Object.freeze([
  Object.freeze({
    episodeNumber: 1,
    slug: "brain-fog-part-1",
    title: "Brain Fog, Part 1 - Is Your Brain in a Fog?",
    rssComEpisodeId: "3050766",
    appleEpisodeId: "1000746628307",
    spotifyEpisodeId: "7cAdb8GE4khC9EYKAjmYuc",
    currentFeedGuid: "c9b853b6-a828-4012-9998-217919ff9163",
    appleHistoricalGuid: "59063e08-e4a6-4e56-b7ec-d2a66d69beb8",
  }),
  Object.freeze({
    episodeNumber: 2,
    slug: "brain-fog-part-2",
    title: "Brain Fog, Part 2 - Testing and Basic Solutions",
    rssComEpisodeId: "3050765",
    appleEpisodeId: "1000746628422",
    spotifyEpisodeId: "19Pct0ClX3j1EOwJ3ySVd7",
    currentFeedGuid: "1e40e02b-b217-477c-9cc3-4271cb304c23",
    appleHistoricalGuid: "26896da2-76cf-4865-93f8-f94ddfb24568",
  }),
]);

const schema = JSON.parse(await fs.readFile(APPLE_GUID_REPAIR_SCHEMA_PATH, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv, { mode: "full" });
const validateSchema = ajv.compile(schema);

const BLOCKED_FALSE_GATES = [
  "exactRemoteChangeApproved",
  "remoteWritePerformed",
  "feedVerified",
  "appleIdentityPreserved",
  "spotifyIdentityPreserved",
];

const GATE_PREREQUISITES = Object.freeze({
  exactRemoteChangeApproved: [
    "appleSupportCrosswalkRecorded",
    "appleTitleMappingIndependentlyVerified",
    "rssComInPlaceEditConfirmed",
    "spotifyImpactReviewed",
    "spotifyIdentityPreservationConfirmed",
  ],
  beforeSnapshotCaptured: ["exactRemoteChangeApproved"],
  remoteWritePerformed: ["exactRemoteChangeApproved", "beforeSnapshotCaptured"],
  feedVerified: ["remoteWritePerformed"],
  appleIdentityPreserved: ["remoteWritePerformed", "feedVerified"],
  spotifyIdentityPreserved: [
    "spotifyIdentityPreservationConfirmed",
    "remoteWritePerformed",
    "feedVerified",
  ],
});

const IDENTITY_FIELDS = [
  "episodeNumber",
  "slug",
  "rssComEpisodeId",
  "appleEpisodeId",
  "spotifyEpisodeId",
  "currentFeedGuid",
  "appleHistoricalGuid",
];

function schemaPath(error) {
  const parts = error.instancePath
    .split("/")
    .filter(Boolean)
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
  if (error.keyword === "required") parts.push(error.params.missingProperty);
  if (error.keyword === "additionalProperties") {
    parts.push(error.params.additionalProperty);
  }
  return parts.join(".") || "record";
}

function timestamp(value) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

function dateStart(value) {
  return timestamp(`${value}T00:00:00Z`);
}

function duplicateValues(entries, field) {
  const seen = new Set();
  const duplicates = new Set();
  for (const entry of entries) {
    const value = entry?.[field];
    if (value === null || value === undefined) continue;
    if (seen.has(value)) duplicates.add(String(value));
    seen.add(value);
  }
  return [...duplicates];
}

function dayStartFromTimestamp(value) {
  const parsed = timestamp(value);
  if (parsed === null) return null;
  const date = new Date(parsed);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function requireChronology(errors, earlier, earlierPath, later, laterPath) {
  if (earlier !== null && later !== null && earlier > later) {
    errors.push(`${earlierPath} must not be later than ${laterPath}.`);
  }
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function requireAuthorityEqual(errors, actual, expected, path) {
  if (!sameValue(actual, expected)) {
    errors.push(`${path} must match the Apple repair receipt.`);
  }
}

function sortedUniqueNumbers(values) {
  if (!Array.isArray(values)) return null;
  return [...new Set(values)].sort((left, right) => left - right);
}

function validateConnectProjection(errors, label, projection) {
  const { available, draft, total, draftEpisodes, playable } = projection;
  for (const [name, value] of Object.entries({ available, draft, total })) {
    if (!Number.isInteger(value) || value < 0) {
      errors.push(`${label}.${name} must be a non-negative integer.`);
    }
  }
  if (
    Number.isInteger(available) &&
    Number.isInteger(draft) &&
    Number.isInteger(total) &&
    available + draft !== total
  ) {
    errors.push(`${label} available + draft must equal total.`);
  }
  if (!sameValue(sortedUniqueNumbers(draftEpisodes), [1, 2])) {
    errors.push(`${label}.draftEpisodes must be exactly [1,2].`);
  }
  if (Array.isArray(draftEpisodes) && draftEpisodes.length !== draft) {
    errors.push(`${label}.draftEpisodes length must equal draft count.`);
  }
  if (playable !== true) {
    errors.push(`${label}.playable must be true.`);
  }
}

function validatePublicProjection(errors, label, projection) {
  const { visible, expected, visibleEpisodes, missingEpisodes } = projection;
  for (const [name, value] of Object.entries({ visible, expected })) {
    if (!Number.isInteger(value) || value < 0) {
      errors.push(`${label}.${name} must be a non-negative integer.`);
    }
  }
  const visibleSet = sortedUniqueNumbers(visibleEpisodes);
  const missingSet = sortedUniqueNumbers(missingEpisodes);
  if (!sameValue(visibleSet, [3, 4, 5, 6, 7, 8])) {
    errors.push(`${label}.visibleEpisodes must be exactly [3,4,5,6,7,8].`);
  }
  if (!sameValue(missingSet, [1, 2])) {
    errors.push(`${label}.missingEpisodes must be exactly [1,2].`);
  }
  if (Array.isArray(visibleEpisodes) && visibleEpisodes.length !== visible) {
    errors.push(`${label}.visibleEpisodes length must equal visible count.`);
  }
  if (
    Array.isArray(visibleEpisodes) &&
    Array.isArray(missingEpisodes) &&
    visibleEpisodes.length + missingEpisodes.length !== expected
  ) {
    errors.push(`${label} visible + missing episode sets must equal expected count.`);
  }
}

export function appleGuidRepairSemanticErrors(record) {
  const errors = [];
  const episodes = Array.isArray(record?.episodes) ? record.episodes : [];

  if (episodes.length === APPLE_GUID_REPAIR_CROSSWALK.length) {
    for (const expected of APPLE_GUID_REPAIR_CROSSWALK) {
      const matches = episodes.filter(
        (episode) => episode?.episodeNumber === expected.episodeNumber,
      );
      if (matches.length !== 1) {
        errors.push(
          `episodes must contain exactly one Episode ${expected.episodeNumber} crosswalk entry.`,
        );
        continue;
      }
      for (const [field, expectedValue] of Object.entries(expected)) {
        if (matches[0][field] !== expectedValue) {
          errors.push(
            `Episode ${expected.episodeNumber} ${field} must remain ${JSON.stringify(expectedValue)}.`,
          );
        }
      }
    }

    for (const field of IDENTITY_FIELDS) {
      const duplicates = duplicateValues(episodes, field);
      if (duplicates.length > 0) {
        errors.push(`episodes contains duplicate ${field}: ${duplicates.join(", ")}.`);
      }
    }

    const currentGuids = new Set(episodes.map((episode) => episode?.currentFeedGuid));
    for (const episode of episodes) {
      if (currentGuids.has(episode?.appleHistoricalGuid)) {
        errors.push(
          `Episode ${episode?.episodeNumber ?? "unknown"} historical GUID must not equal any current feed GUID.`,
        );
      }
    }
  }

  const discoveredAt = dateStart(record?.discoveredAt);
  const lastVerifiedAt = dateStart(record?.lastVerifiedAt);
  if (
    discoveredAt !== null &&
    lastVerifiedAt !== null &&
    lastVerifiedAt < discoveredAt
  ) {
    errors.push("lastVerifiedAt must be on or after discoveredAt.");
  }

  const verificationWindowEnd =
    lastVerifiedAt === null ? null : lastVerifiedAt + 24 * 60 * 60 * 1000;
  for (const [provider, submittedField] of [
    ["rssCom", "submittedAt"],
    ["spotify", "submittedAt"],
  ]) {
    const submittedAt = timestamp(
      record?.supportOutreach?.[provider]?.[submittedField],
    );
    if (
      submittedAt !== null &&
      discoveredAt !== null &&
      submittedAt < discoveredAt
    ) {
      errors.push(
        `supportOutreach.${provider}.${submittedField} predates discovery.`,
      );
    }
    if (
      submittedAt !== null &&
      verificationWindowEnd !== null &&
      submittedAt >= verificationWindowEnd
    ) {
      errors.push(
        `supportOutreach.${provider}.${submittedField} is newer than lastVerifiedAt.`,
      );
    }
  }

  const spotifySubmittedAt = timestamp(record?.supportOutreach?.spotify?.submittedAt);
  const spotifyFollowedUpAt = timestamp(
    record?.supportOutreach?.spotify?.lastFollowedUpAt,
  );
  const spotifyResponseAt = timestamp(
    record?.supportOutreach?.spotify?.lastResponseAt,
  );
  if (
    spotifySubmittedAt !== null &&
    spotifyFollowedUpAt !== null &&
    spotifyFollowedUpAt < spotifySubmittedAt
  ) {
    errors.push("supportOutreach.spotify.lastFollowedUpAt precedes submittedAt.");
  }
  if (
    spotifyFollowedUpAt !== null &&
    verificationWindowEnd !== null &&
    spotifyFollowedUpAt >= verificationWindowEnd
  ) {
    errors.push(
      "supportOutreach.spotify.lastFollowedUpAt is newer than lastVerifiedAt.",
    );
  }
  if (
    spotifyFollowedUpAt !== null &&
    spotifyResponseAt !== null &&
    spotifyResponseAt < spotifyFollowedUpAt
  ) {
    errors.push("supportOutreach.spotify.lastResponseAt precedes lastFollowedUpAt.");
  }
  if (
    spotifyResponseAt !== null &&
    verificationWindowEnd !== null &&
    spotifyResponseAt >= verificationWindowEnd
  ) {
    errors.push(
      "supportOutreach.spotify.lastResponseAt is newer than lastVerifiedAt.",
    );
  }

  if (
    record?.appleCaseNumber !== undefined &&
    record?.supportOutreach?.apple?.caseNumber !== undefined &&
    record.appleCaseNumber !== record.supportOutreach.apple.caseNumber
  ) {
    errors.push("supportOutreach.apple.caseNumber must match appleCaseNumber.");
  }

  const appleSupport = record?.supportOutreach?.apple;
  for (const [path, caseReference] of [
    [
      "supportOutreach.apple.historicalGuidCrosswalkReply.caseReference",
      appleSupport?.historicalGuidCrosswalkReply?.caseReference,
    ],
    [
      "supportOutreach.apple.latestEscalation.caseReference",
      appleSupport?.latestEscalation?.caseReference,
    ],
  ]) {
    if (
      record?.appleCaseNumber !== undefined &&
      caseReference !== undefined &&
      caseReference !== record.appleCaseNumber
    ) {
      errors.push(`${path} must match appleCaseNumber.`);
    }
  }

  const initialRequestDay = dateStart(
    appleSupport?.initialReprocessingRequest?.submittedOn,
  );
  const crosswalkReplyDay = dateStart(
    appleSupport?.historicalGuidCrosswalkReply?.receivedOn,
  );
  const remapFollowUpAt = timestamp(
    appleSupport?.serverSideRemapFollowUp?.submittedAt,
  );
  const remapFollowUpDay = dayStartFromTimestamp(
    appleSupport?.serverSideRemapFollowUp?.submittedAt,
  );
  const latestEscalationDay = dateStart(
    appleSupport?.latestEscalation?.submittedOn,
  );
  const latestEscalationSubmittedAfter = timestamp(
    appleSupport?.latestEscalation?.submittedAfter,
  );
  const latestEscalationSubmittedBefore = timestamp(
    appleSupport?.latestEscalation?.submittedBefore,
  );
  requireChronology(
    errors,
    initialRequestDay,
    "supportOutreach.apple.initialReprocessingRequest.submittedOn",
    crosswalkReplyDay,
    "supportOutreach.apple.historicalGuidCrosswalkReply.receivedOn",
  );
  requireChronology(
    errors,
    crosswalkReplyDay,
    "supportOutreach.apple.historicalGuidCrosswalkReply.receivedOn",
    remapFollowUpDay,
    "supportOutreach.apple.serverSideRemapFollowUp.submittedAt",
  );
  requireChronology(
    errors,
    remapFollowUpDay,
    "supportOutreach.apple.serverSideRemapFollowUp.submittedAt",
    latestEscalationDay,
    "supportOutreach.apple.latestEscalation.submittedOn",
  );

  const overlay = record?.appleOnlyOverlay;
  const deploymentVerifiedAt = timestamp(
    overlay?.deployment?.deploymentVerifiedAt,
  );
  const deploymentCompletedAt = timestamp(overlay?.deployment?.completedAt);
  const appleFeedSwitchAt = timestamp(
    overlay?.appleConnectReadback?.appleFeedSwitchObservedAt,
  );
  const refreshCompleteAt = timestamp(
    overlay?.appleConnectReadback?.feedRefreshObservedCompleteAt,
  );
  const publicCatalogReadbackAt = timestamp(
    overlay?.publicCatalogReadback?.verifiedAt,
  );
  const independentPublicFeedReadbackAt = timestamp(
    overlay?.deployment?.latestIndependentPublicFeedReadbackAt,
  );
  const independentPublicFeedReadbackDay = dayStartFromTimestamp(
    overlay?.deployment?.latestIndependentPublicFeedReadbackAt,
  );
  for (const [earlier, earlierPath, later, laterPath] of [
    [
      remapFollowUpAt,
      "supportOutreach.apple.serverSideRemapFollowUp.submittedAt",
      deploymentVerifiedAt,
      "appleOnlyOverlay.deployment.deploymentVerifiedAt",
    ],
    [
      deploymentVerifiedAt,
      "appleOnlyOverlay.deployment.deploymentVerifiedAt",
      deploymentCompletedAt,
      "appleOnlyOverlay.deployment.completedAt",
    ],
    [
      deploymentCompletedAt,
      "appleOnlyOverlay.deployment.completedAt",
      appleFeedSwitchAt,
      "appleOnlyOverlay.appleConnectReadback.appleFeedSwitchObservedAt",
    ],
    [
      appleFeedSwitchAt,
      "appleOnlyOverlay.appleConnectReadback.appleFeedSwitchObservedAt",
      refreshCompleteAt,
      "appleOnlyOverlay.appleConnectReadback.feedRefreshObservedCompleteAt",
    ],
    [
      refreshCompleteAt,
      "appleOnlyOverlay.appleConnectReadback.feedRefreshObservedCompleteAt",
      publicCatalogReadbackAt,
      "appleOnlyOverlay.publicCatalogReadback.verifiedAt",
    ],
    [
      publicCatalogReadbackAt,
      "appleOnlyOverlay.publicCatalogReadback.verifiedAt",
      independentPublicFeedReadbackAt,
      "appleOnlyOverlay.deployment.latestIndependentPublicFeedReadbackAt",
    ],
  ]) {
    requireChronology(errors, earlier, earlierPath, later, laterPath);
  }

  requireChronology(
    errors,
    independentPublicFeedReadbackDay,
    "appleOnlyOverlay.deployment.latestIndependentPublicFeedReadbackAt",
    latestEscalationDay,
    "supportOutreach.apple.latestEscalation.submittedOn (date precision)",
  );
  requireChronology(
    errors,
    independentPublicFeedReadbackAt,
    "appleOnlyOverlay.deployment.latestIndependentPublicFeedReadbackAt",
    latestEscalationSubmittedAfter,
    "supportOutreach.apple.latestEscalation.submittedAfter",
  );
  requireChronology(
    errors,
    latestEscalationSubmittedAfter,
    "supportOutreach.apple.latestEscalation.submittedAfter",
    latestEscalationSubmittedBefore,
    "supportOutreach.apple.latestEscalation.submittedBefore",
  );

  for (const [path, value] of [
    ["supportOutreach.apple.serverSideRemapFollowUp.submittedAt", remapFollowUpAt],
    ["appleOnlyOverlay.deployment.deploymentVerifiedAt", deploymentVerifiedAt],
    ["appleOnlyOverlay.deployment.completedAt", deploymentCompletedAt],
    ["appleOnlyOverlay.appleConnectReadback.appleFeedSwitchObservedAt", appleFeedSwitchAt],
    ["appleOnlyOverlay.appleConnectReadback.feedRefreshObservedCompleteAt", refreshCompleteAt],
    ["appleOnlyOverlay.publicCatalogReadback.verifiedAt", publicCatalogReadbackAt],
    [
      "appleOnlyOverlay.deployment.latestIndependentPublicFeedReadbackAt",
      independentPublicFeedReadbackAt,
    ],
    [
      "supportOutreach.apple.latestEscalation.submittedAfter",
      latestEscalationSubmittedAfter,
    ],
    [
      "supportOutreach.apple.latestEscalation.submittedBefore",
      latestEscalationSubmittedBefore,
    ],
  ]) {
    if (
      value !== null &&
      verificationWindowEnd !== null &&
      value >= verificationWindowEnd
    ) {
      errors.push(`${path} is newer than lastVerifiedAt.`);
    }
  }

  const gates = record?.gates;
  if (gates && typeof gates === "object") {
    if (
      record?.canonicalMutationFallbackStatus === "blocked_not_in_use" &&
      record?.gateScope === "canonical_rss_com_guid_mutation_fallback_only"
    ) {
      for (const gate of BLOCKED_FALSE_GATES) {
        if (gates[gate] !== false) {
          errors.push(
            `blocked canonical mutation fallback requires gates.${gate}=false.`,
          );
        }
      }
    }

    for (const [gate, prerequisites] of Object.entries(GATE_PREREQUISITES)) {
      if (gates[gate] !== true) continue;
      for (const prerequisite of prerequisites) {
        if (gates[prerequisite] !== true) {
          errors.push(`gates.${gate}=true requires gates.${prerequisite}=true.`);
        }
      }
    }
  }

  return [...new Set(errors)];
}

export function appleGuidRepairAuthorityErrors({
  repair,
  hostingMigration,
  platforms,
}) {
  const errors = [];
  const overlay = repair?.appleOnlyOverlay;
  const deployment = overlay?.deployment;
  const connect = overlay?.appleConnectReadback;
  const publicReadback = overlay?.publicCatalogReadback;
  const escalation = repair?.supportOutreach?.apple?.latestEscalation;
  const supportHistory = repair?.supportOutreach?.apple;
  const hosting = hostingMigration?.existingListings?.apple;
  const hostingOverlay = hosting?.appleOnlyOverlay;
  const hostingIssues = hostingMigration?.downstreamPropagation?.issues?.filter(
    (issue) =>
      issue?.showId === repair?.appleShowId ||
      issue?.code === APPLE_PENDING_ISSUE_CODE,
  ) ?? [];
  if (hostingIssues.length !== 1) {
    errors.push(
      "hosting migration must contain exactly one Apple pending issue candidate by code or show ID.",
    );
  }
  const hostingIssue = hostingIssues[0];
  const platform = platforms?.platforms?.apple;
  const platformIssues = platforms?.downstreamPropagation?.issues?.filter(
    (issue) =>
      issue?.showId === repair?.appleShowId ||
      issue?.code === APPLE_PENDING_ISSUE_CODE,
  ) ?? [];
  if (platformIssues.length !== 1) {
    errors.push(
      "platform registry must contain exactly one Apple pending issue candidate by code or show ID.",
    );
  }
  const platformIssue = platformIssues[0];
  const historicalDirectRoute = hosting?.historicalDirectRssComRoute;

  requireAuthorityEqual(
    errors,
    historicalDirectRoute?.feedUrl,
    repair?.feedUrl,
    "historical direct RSS.com route URL",
  );
  requireAuthorityEqual(
    errors,
    historicalDirectRoute?.directFeedChangeTimeApproximate,
    true,
    "historical direct RSS.com route time precision",
  );
  requireAuthorityEqual(
    errors,
    historicalDirectRoute?.supersededByAppleOnlyOverlay,
    true,
    "historical direct RSS.com route supersession state",
  );
  const historicalRedirectAt = timestamp(
    historicalDirectRoute?.effectiveViaRedirectAt,
  );
  const historicalDirectChangeAt = timestamp(
    historicalDirectRoute?.directFeedChangedAt,
  );
  const deploymentVerifiedAt = timestamp(deployment?.deploymentVerifiedAt);
  if (historicalRedirectAt === null) {
    errors.push(
      "hosting historicalDirectRssComRoute.effectiveViaRedirectAt must be a valid timestamp.",
    );
  }
  if (historicalDirectChangeAt === null) {
    errors.push(
      "hosting historicalDirectRssComRoute.directFeedChangedAt must be a valid timestamp.",
    );
  }
  requireChronology(
    errors,
    historicalRedirectAt,
    "hosting historicalDirectRssComRoute.effectiveViaRedirectAt",
    historicalDirectChangeAt,
    "hosting historicalDirectRssComRoute.directFeedChangedAt",
  );
  requireChronology(
    errors,
    historicalDirectChangeAt,
    "hosting historicalDirectRssComRoute.directFeedChangedAt",
    deploymentVerifiedAt,
    "appleOnlyOverlay.deployment.deploymentVerifiedAt",
  );

  for (const [actual, expected, path] of [
    [hosting?.showId, repair?.appleShowId, "hosting Apple show ID"],
    [platform?.destinationIds?.containerId, repair?.appleShowId, "platform Apple show ID"],
    [hostingIssue?.code, APPLE_PENDING_ISSUE_CODE, "hosting Apple issue code"],
    [hostingIssue?.showId, repair?.appleShowId, "hosting Apple issue show ID"],
    [platformIssue?.code, APPLE_PENDING_ISSUE_CODE, "platform Apple issue code"],
    [platformIssue?.showId, repair?.appleShowId, "platform Apple issue show ID"],
    [hosting?.currentFeedUrl, overlay?.publicFeedUrl, "hosting Apple current feed URL"],
    [platform?.currentFeedUrl, overlay?.publicFeedUrl, "platform Apple current feed URL"],
    [hostingOverlay?.publicFeedUrl, overlay?.publicFeedUrl, "hosting overlay feed URL"],
    [platformIssue?.appleOnlyOverlayFeedUrl, overlay?.publicFeedUrl, "platform issue overlay feed URL"],
    [hosting?.canonicalSourceFeedUrl, repair?.feedUrl, "hosting canonical source feed URL"],
    [platform?.canonicalSourceFeedUrl, repair?.feedUrl, "platform canonical source feed URL"],
    [hostingOverlay?.routingStatus, overlay?.routingStatus, "hosting overlay routing status"],
    [hostingIssue?.appleOnlyOverlayRoutingStatus, overlay?.routingStatus, "hosting issue routing status"],
    [platform?.appleOnlyOverlayRoutingStatus, overlay?.routingStatus, "platform overlay routing status"],
    [platformIssue?.appleOnlyOverlayRoutingStatus, overlay?.routingStatus, "platform issue routing status"],
    [hostingOverlay?.canonicalRssComFeedMutated, deployment?.canonicalRssComFeedMutated, "hosting canonical feed mutation state"],
    [platformIssue?.canonicalRssComFeedMutated, deployment?.canonicalRssComFeedMutated, "platform canonical feed mutation state"],
    [hostingOverlay?.historicalGuidsRestoredForEpisodeNumbers, overlay?.guidState?.episodeNumbers, "hosting historical GUID episode set"],
    [hostingIssue?.appleOnlyOverlayHistoricalGuidEpisodeNumbers, overlay?.guidState?.episodeNumbers, "hosting issue historical GUID episode set"],
    [platform?.appleOnlyOverlayHistoricalGuidEpisodeNumbers, overlay?.guidState?.episodeNumbers, "platform historical GUID episode set"],
    [hostingOverlay?.deploymentCommit, deployment?.commit, "hosting overlay deployment commit"],
    [hostingOverlay?.deploymentWorkflowRunId, deployment?.workflowRunId, "hosting overlay workflow run"],
    [hostingOverlay?.publicFeedSha256, deployment?.publicFeedSha256, "hosting overlay feed hash"],
    [hostingOverlay?.deploymentVerifiedAt, deployment?.deploymentVerifiedAt, "hosting deployment verification time"],
    [hostingOverlay?.deploymentCompletedAt, deployment?.completedAt, "hosting deployment completion time"],
    [hostingOverlay?.latestIndependentPublicFeedReadbackAt, deployment?.latestIndependentPublicFeedReadbackAt, "hosting independent feed readback time"],
    [platform?.appleOnlyOverlayDeployment?.commit, deployment?.commit, "platform overlay deployment commit"],
    [platform?.appleOnlyOverlayDeployment?.workflowRunId, deployment?.workflowRunId, "platform overlay workflow run"],
    [platform?.appleOnlyOverlayDeployment?.publicFeedSha256, deployment?.publicFeedSha256, "platform overlay feed hash"],
    [platform?.appleOnlyOverlayDeployment?.deploymentVerifiedAt, deployment?.deploymentVerifiedAt, "platform deployment verification time"],
    [platform?.appleOnlyOverlayDeployment?.completedAt, deployment?.completedAt, "platform deployment completion time"],
    [platform?.appleOnlyOverlayDeployment?.latestIndependentPublicFeedReadbackAt, deployment?.latestIndependentPublicFeedReadbackAt, "platform independent feed readback time"],
    [platformIssue?.appleOnlyOverlayDeploymentCommit, deployment?.commit, "platform issue deployment commit"],
    [platformIssue?.appleOnlyOverlayDeploymentWorkflowRunId, deployment?.workflowRunId, "platform issue workflow run"],
    [platformIssue?.appleOnlyOverlayPublicFeedSha256, deployment?.publicFeedSha256, "platform issue feed hash"],
    [platformIssue?.appleOnlyOverlayDeploymentVerifiedAt, deployment?.deploymentVerifiedAt, "platform issue deployment verification time"],
    [platformIssue?.appleOnlyOverlayDeploymentCompletedAt, deployment?.completedAt, "platform issue deployment completion time"],
    [platformIssue?.appleOnlyOverlayLatestIndependentPublicFeedReadbackAt, deployment?.latestIndependentPublicFeedReadbackAt, "platform issue independent feed readback time"],
    [hosting?.appleFeedSwitchObservedAt, connect?.appleFeedSwitchObservedAt, "hosting Apple feed switch time"],
    [hostingOverlay?.appleFeedSwitchObservedAt, connect?.appleFeedSwitchObservedAt, "hosting overlay feed switch time"],
    [platform?.appleFeedSwitchObservedAt, connect?.appleFeedSwitchObservedAt, "platform Apple feed switch time"],
    [platformIssue?.appleFeedSwitchObservedAt, connect?.appleFeedSwitchObservedAt, "platform issue feed switch time"],
    [hosting?.appleFeedSwitchObservedAtApproximateToMinute, connect?.appleFeedSwitchObservedAtApproximateToMinute, "hosting feed switch precision"],
    [hostingOverlay?.appleFeedSwitchObservedAtApproximateToMinute, connect?.appleFeedSwitchObservedAtApproximateToMinute, "hosting overlay feed switch precision"],
    [platform?.appleFeedSwitchObservedAtApproximateToMinute, connect?.appleFeedSwitchObservedAtApproximateToMinute, "platform feed switch precision"],
    [platformIssue?.appleFeedSwitchObservedAtApproximateToMinute, connect?.appleFeedSwitchObservedAtApproximateToMinute, "platform issue feed switch precision"],
    [hosting?.dashboardLastUpdateAt, connect?.dashboardLastUpdateAt, "hosting dashboard last-update time"],
    [hostingOverlay?.dashboardLastUpdateAt, connect?.dashboardLastUpdateAt, "hosting overlay dashboard last-update time"],
    [platform?.dashboardLastUpdateAt, connect?.dashboardLastUpdateAt, "platform dashboard last-update time"],
    [platformIssue?.dashboardLastUpdateAt, connect?.dashboardLastUpdateAt, "platform issue dashboard last-update time"],
    [hostingOverlay?.feedRefreshObservedCompleteAt, connect?.feedRefreshObservedCompleteAt, "hosting refresh completion time"],
    [platform?.feedRefreshObservedCompleteAt, connect?.feedRefreshObservedCompleteAt, "platform refresh completion time"],
    [platformIssue?.feedRefreshObservedCompleteAt, connect?.feedRefreshObservedCompleteAt, "platform issue refresh completion time"],
    [hostingOverlay?.feedRefreshObservedCompleteAtApproximateToMinute, connect?.feedRefreshObservedCompleteAtApproximateToMinute, "hosting refresh precision"],
    [platform?.feedRefreshObservedCompleteAtApproximateToMinute, connect?.feedRefreshObservedCompleteAtApproximateToMinute, "platform refresh precision"],
    [platformIssue?.feedRefreshObservedCompleteAtApproximateToMinute, connect?.feedRefreshObservedCompleteAtApproximateToMinute, "platform issue refresh precision"],
    [hostingOverlay?.latestAppleConnectReadbackOn, connect?.verifiedOn, "hosting Connect readback date"],
    [platform?.latestConnectReadback?.verifiedOn, connect?.verifiedOn, "platform Connect readback date"],
    [hostingOverlay?.latestAppleConnectReadbackAuthenticated, connect?.authenticated, "hosting Connect authentication state"],
    [platform?.latestConnectReadback?.authenticated, connect?.authenticated, "platform Connect authentication state"],
    [hostingOverlay?.publicCatalogReadbackAt, publicReadback?.verifiedAt, "hosting public catalog readback time"],
    [hostingIssue?.publicCatalogReadbackAt, publicReadback?.verifiedAt, "hosting issue public catalog readback time"],
    [platform?.latestPublicReadback?.verifiedAt, publicReadback?.verifiedAt, "platform public catalog readback time"],
    [platformIssue?.publicCatalogReadbackAt, publicReadback?.verifiedAt, "platform issue public catalog readback time"],
    [hostingOverlay?.publicationOutcome, overlay?.publicationOutcome, "hosting publication outcome"],
    [hostingIssue?.publicationOutcome, overlay?.publicationOutcome, "hosting issue publication outcome"],
    [platform?.catalogPublicationOutcome, overlay?.publicationOutcome, "platform publication outcome"],
    [platformIssue?.supportRequestOutcome, overlay?.publicationOutcome, "platform issue publication outcome"],
    [hosting?.draftDeletionAuthorized, false, "hosting draft deletion authorization"],
    [hostingIssue?.deletionAuthorized, false, "hosting issue deletion authorization"],
    [platformIssue?.deletionAuthorized, false, "platform issue deletion authorization"],
    [hostingIssue?.canonicalFeedMutationBlocked, true, "hosting issue canonical mutation block"],
    [platformIssue?.canonicalFeedMutationBlocked, true, "platform issue canonical mutation block"],
    [hosting?.remainingDraftDiagnosis?.supportEscalationRequired, true, "hosting diagnosis support escalation requirement"],
    [hostingIssue?.supportEscalationRequired, true, "hosting issue support escalation requirement"],
    [platformIssue?.supportEscalationRequired, true, "platform issue support escalation requirement"],
    [hosting?.remainingDraftDiagnosis?.supportRequestSubmitted, true, "hosting diagnosis support request submission"],
    [hostingIssue?.supportRequestSubmitted, true, "hosting issue support request submission"],
    [platformIssue?.supportRequestSubmitted, true, "platform issue support request submission"],
  ]) {
    requireAuthorityEqual(errors, actual, expected, path);
  }

  const expectedDownstreamStatus =
    overlay?.publicationOutcome === "pending_apple_catalog_availability"
      ? "issues_pending"
      : null;
  if (expectedDownstreamStatus === null) {
    errors.push(
      "Apple publication outcome has no authorized downstream status projection.",
    );
  }
  requireAuthorityEqual(
    errors,
    hostingMigration?.downstreamPropagation?.status,
    expectedDownstreamStatus,
    "hosting downstream propagation status",
  );
  requireAuthorityEqual(
    errors,
    platforms?.downstreamPropagation?.status,
    expectedDownstreamStatus,
    "platform downstream propagation status",
  );

  for (const projection of [
    {
      label: "receipt Connect readback",
      available: connect?.availableEpisodeCount,
      draft: connect?.draftEpisodeCount,
      total: connect?.totalEpisodeCount,
      draftEpisodes: connect?.draftEpisodeNumbers,
      playable: connect?.draftEpisodesHavePlayableRssAudio,
    },
    {
      label: "hosting Apple listing",
      available: hosting?.availableEpisodeCount,
      draft: hosting?.draftEpisodeCount,
      total: hosting?.dashboardAllEpisodesCount,
      draftEpisodes: hosting?.dashboardDrafts?.map((episode) => episode.episodeNumber),
      playable:
        hosting?.dashboardDrafts?.length > 0 &&
        hosting.dashboardDrafts.every((episode) => episode.playableRssAudio === true),
    },
    {
      label: "hosting overlay receipt",
      available: hostingOverlay?.dashboardAvailableEpisodeCount,
      draft: hostingOverlay?.dashboardDraftEpisodeCount,
      total: hostingOverlay?.dashboardTotalEpisodeCount,
      draftEpisodes: hostingOverlay?.draftEpisodeNumbers,
      playable: hostingOverlay?.draftEpisodesHavePlayableRssAudio,
    },
    {
      label: "hosting downstream issue",
      available: hostingIssue?.dashboardAvailableEpisodeCount,
      draft: hostingIssue?.dashboardDraftEpisodeCount,
      total: hostingIssue?.dashboardAllEpisodesCount,
      draftEpisodes: hostingIssue?.draftEpisodeNumbers,
      playable: hostingIssue?.draftEpisodesHavePlayableRssAudio,
    },
    {
      label: "platform downstream issue",
      available: platformIssue?.availableEpisodeCount,
      draft: platformIssue?.draftEpisodeCount,
      total: platformIssue?.dashboardEpisodeCount,
      draftEpisodes: platformIssue?.draftEpisodeNumbers,
      playable: platformIssue?.draftEpisodesHavePlayableRssAudio,
    },
    {
      label: "platform Connect readback",
      available: platform?.latestConnectReadback?.availableEpisodeCount,
      draft: platform?.latestConnectReadback?.draftEpisodeCount,
      total: platform?.latestConnectReadback?.totalEpisodeCount,
      draftEpisodes: platform?.latestConnectReadback?.draftEpisodeNumbers,
      playable: platform?.latestConnectReadback?.draftEpisodesHavePlayableRssAudio,
    },
  ]) {
    validateConnectProjection(errors, projection.label, projection);
    requireAuthorityEqual(
      errors,
      [projection.available, projection.draft, projection.total],
      [connect?.availableEpisodeCount, connect?.draftEpisodeCount, connect?.totalEpisodeCount],
      `${projection.label} counts`,
    );
  }

  for (const projection of [
    {
      label: "receipt public readback",
      visible: publicReadback?.visibleEpisodeCount,
      expected: publicReadback?.expectedEpisodeCount,
      visibleEpisodes: publicReadback?.visibleEpisodeNumbers,
      missingEpisodes: publicReadback?.missingEpisodeNumbers,
    },
    {
      label: "hosting overlay public readback",
      visible: hostingOverlay?.publicEpisodeCount,
      expected: hostingOverlay?.expectedPublicEpisodeCount,
      visibleEpisodes: hostingOverlay?.publicVisibleEpisodeNumbers,
      missingEpisodes: hostingOverlay?.publicMissingEpisodeNumbers,
    },
    {
      label: "hosting issue public readback",
      visible: hostingIssue?.publicLookupTrackCount,
      expected: hostingIssue?.expectedPublicTrackCount,
      visibleEpisodes: hostingIssue?.publicVisibleEpisodeNumbers,
      missingEpisodes: hostingIssue?.publicMissingEpisodeNumbers,
    },
    {
      label: "platform issue public readback",
      visible: platformIssue?.publicLookupTrackCount,
      expected: platformIssue?.expectedPublicTrackCount,
      visibleEpisodes: platformIssue?.publicVisibleEpisodeNumbers,
      missingEpisodes: platformIssue?.publicMissingEpisodeNumbers,
    },
    {
      label: "platform public readback",
      visible: platform?.latestPublicReadback?.visibleEpisodeCount,
      expected: platform?.latestPublicReadback?.expectedEpisodeCount,
      visibleEpisodes: platform?.latestPublicReadback?.visibleEpisodeNumbers,
      missingEpisodes: platform?.latestPublicReadback?.missingEpisodeNumbers,
    },
  ]) {
    validatePublicProjection(errors, projection.label, projection);
    requireAuthorityEqual(
      errors,
      [projection.visible, projection.expected],
      [publicReadback?.visibleEpisodeCount, publicReadback?.expectedEpisodeCount],
      `${projection.label} counts`,
    );
  }
  requireAuthorityEqual(
    errors,
    hosting?.publicLookupTrackCount,
    publicReadback?.visibleEpisodeCount,
    "hosting Apple public lookup count",
  );

  const supportComparisons = [
    [hostingOverlay?.initialReprocessingRequestSubmittedOn, supportHistory?.initialReprocessingRequest?.submittedOn, "hosting initial reprocessing date"],
    [hosting?.remainingDraftDiagnosis?.initialReprocessingRequestSubmittedOn, supportHistory?.initialReprocessingRequest?.submittedOn, "hosting diagnosis initial reprocessing date"],
    [hostingIssue?.initialReprocessingRequestSubmittedOn, supportHistory?.initialReprocessingRequest?.submittedOn, "hosting issue initial reprocessing date"],
    [platform?.supportHistory?.initialReprocessingRequestSubmittedOn, supportHistory?.initialReprocessingRequest?.submittedOn, "platform initial reprocessing date"],
    [platformIssue?.initialReprocessingRequestSubmittedOn, supportHistory?.initialReprocessingRequest?.submittedOn, "platform issue initial reprocessing date"],
    [hostingOverlay?.historicalGuidCrosswalkReplyReceivedOn, supportHistory?.historicalGuidCrosswalkReply?.receivedOn, "hosting crosswalk reply date"],
    [platform?.supportHistory?.historicalGuidCrosswalkReplyReceivedOn, supportHistory?.historicalGuidCrosswalkReply?.receivedOn, "platform crosswalk reply date"],
    [hostingOverlay?.serverSideRemapFollowUpSubmittedAt, supportHistory?.serverSideRemapFollowUp?.submittedAt, "hosting remap follow-up time"],
    [platform?.supportHistory?.serverSideRemapFollowUpSubmittedAt, supportHistory?.serverSideRemapFollowUp?.submittedAt, "platform remap follow-up time"],
    [hostingOverlay?.supportEscalationStatus, escalation?.status, "hosting latest escalation status"],
    [hosting?.remainingDraftDiagnosis?.latestSupportEscalationStatus, escalation?.status, "hosting diagnosis latest escalation status"],
    [hostingIssue?.latestSupportEscalationStatus, escalation?.status, "hosting issue latest escalation status"],
    [platform?.latestSupportEscalation?.status, escalation?.status, "platform latest escalation status"],
    [platformIssue?.latestSupportEscalationStatus, escalation?.status, "platform issue latest escalation status"],
    [hostingOverlay?.supportEscalationSubmittedOn, escalation?.submittedOn, "hosting latest escalation date"],
    [hosting?.remainingDraftDiagnosis?.latestSupportEscalationSubmittedOn, escalation?.submittedOn, "hosting diagnosis latest escalation date"],
    [hostingIssue?.latestSupportEscalationSubmittedOn, escalation?.submittedOn, "hosting issue latest escalation date"],
    [platform?.latestSupportEscalation?.submittedOn, escalation?.submittedOn, "platform latest escalation date"],
    [platformIssue?.latestSupportEscalationSubmittedOn, escalation?.submittedOn, "platform issue latest escalation date"],
    [hostingOverlay?.supportEscalationSubmittedOnPrecision, escalation?.submittedOnPrecision, "hosting latest escalation date precision"],
    [hosting?.remainingDraftDiagnosis?.latestSupportEscalationSubmittedOnPrecision, escalation?.submittedOnPrecision, "hosting diagnosis latest escalation date precision"],
    [hostingIssue?.latestSupportEscalationSubmittedOnPrecision, escalation?.submittedOnPrecision, "hosting issue latest escalation date precision"],
    [platform?.latestSupportEscalation?.submittedOnPrecision, escalation?.submittedOnPrecision, "platform latest escalation date precision"],
    [platformIssue?.latestSupportEscalationSubmittedOnPrecision, escalation?.submittedOnPrecision, "platform issue latest escalation date precision"],
    [hostingOverlay?.supportEscalationSubmittedAfter, escalation?.submittedAfter, "hosting latest escalation lower bound"],
    [hosting?.remainingDraftDiagnosis?.latestSupportEscalationSubmittedAfter, escalation?.submittedAfter, "hosting diagnosis latest escalation lower bound"],
    [hostingIssue?.latestSupportEscalationSubmittedAfter, escalation?.submittedAfter, "hosting issue latest escalation lower bound"],
    [platform?.latestSupportEscalation?.submittedAfter, escalation?.submittedAfter, "platform latest escalation lower bound"],
    [platformIssue?.latestSupportEscalationSubmittedAfter, escalation?.submittedAfter, "platform issue latest escalation lower bound"],
    [hostingOverlay?.supportEscalationSubmittedBefore, escalation?.submittedBefore, "hosting latest escalation upper bound"],
    [hosting?.remainingDraftDiagnosis?.latestSupportEscalationSubmittedBefore, escalation?.submittedBefore, "hosting diagnosis latest escalation upper bound"],
    [hostingIssue?.latestSupportEscalationSubmittedBefore, escalation?.submittedBefore, "hosting issue latest escalation upper bound"],
    [platform?.latestSupportEscalation?.submittedBefore, escalation?.submittedBefore, "platform latest escalation upper bound"],
    [platformIssue?.latestSupportEscalationSubmittedBefore, escalation?.submittedBefore, "platform issue latest escalation upper bound"],
    [hostingOverlay?.supportEscalationAuthenticated, escalation?.authenticated, "hosting latest escalation authentication"],
    [hosting?.remainingDraftDiagnosis?.latestSupportEscalationAuthenticated, escalation?.authenticated, "hosting diagnosis latest escalation authentication"],
    [hostingIssue?.latestSupportEscalationAuthenticated, escalation?.authenticated, "hosting issue latest escalation authentication"],
    [platform?.latestSupportEscalation?.authenticated, escalation?.authenticated, "platform latest escalation authentication"],
    [platformIssue?.latestSupportEscalationAuthenticated, escalation?.authenticated, "platform issue latest escalation authentication"],
    [hostingOverlay?.supportEscalationCategory, escalation?.category, "hosting latest escalation category"],
    [hosting?.remainingDraftDiagnosis?.latestSupportEscalationCategory, escalation?.category, "hosting diagnosis latest escalation category"],
    [hostingIssue?.latestSupportEscalationCategory, escalation?.category, "hosting issue latest escalation category"],
    [platform?.latestSupportEscalation?.category, escalation?.category, "platform latest escalation category"],
    [platformIssue?.supportRequestCategory, escalation?.category, "platform issue latest escalation category"],
    [hostingOverlay?.supportCaseReference, escalation?.caseReference, "hosting latest escalation case"],
    [hosting?.remainingDraftDiagnosis?.supportCaseNumber, escalation?.caseReference, "hosting diagnosis latest escalation case"],
    [hostingIssue?.supportCaseNumber, escalation?.caseReference, "hosting issue latest escalation case"],
    [platform?.latestSupportEscalation?.caseReference, escalation?.caseReference, "platform latest escalation case"],
    [platformIssue?.supportCaseReference, escalation?.caseReference, "platform issue latest escalation case"],
    [hostingOverlay?.supportEscalationRequestedOutcome, escalation?.request, "hosting latest escalation requested outcome"],
    [hosting?.remainingDraftDiagnosis?.latestSupportEscalationRequestedOutcome, escalation?.request, "hosting diagnosis latest escalation requested outcome"],
    [hostingIssue?.latestSupportEscalationRequestedOutcome, escalation?.request, "hosting issue latest escalation requested outcome"],
    [platform?.latestSupportEscalation?.requestedOutcome, escalation?.request, "platform latest escalation requested outcome"],
    [platformIssue?.supportRequestedOutcome, escalation?.request, "platform issue latest escalation requested outcome"],
  ];
  for (const [actual, expected, path] of supportComparisons) {
    requireAuthorityEqual(errors, actual, expected, path);
  }

  return [...new Set(errors)];
}

export function validateAppleGuidRepairAuthorities(authorities) {
  const errors = appleGuidRepairAuthorityErrors(authorities);
  return { valid: errors.length === 0, errors };
}

export function validateAppleGuidRepair(record) {
  const schemaValid = validateSchema(record);
  const errors = schemaValid
    ? []
    : validateSchema.errors.map(
        (error) => `${schemaPath(error)} ${error.message}`,
      );
  errors.push(...appleGuidRepairSemanticErrors(record));
  const uniqueErrors = [...new Set(errors)];
  return { valid: uniqueErrors.length === 0, errors: uniqueErrors };
}

export async function loadAppleGuidRepair(
  repairPath = APPLE_GUID_REPAIR_PATH,
) {
  const record = JSON.parse(await fs.readFile(repairPath, "utf8"));
  const result = validateAppleGuidRepair(record);
  if (!result.valid) {
    throw new Error(
      `Apple GUID repair record is invalid:\n${result.errors
        .map((error) => `- ${error}`)
        .join("\n")}`,
    );
  }
  return record;
}
