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

export const APPLE_GUID_REPAIR_APPROVED_STATUS =
  "apple_only_overlay_approved_pending_deployment";
export const APPLE_GUID_REPAIR_DEPLOYED_STATUS =
  "feed_deployed_pending_apple_switch";
export const APPLE_GUID_REPAIR_PROCESSING_STATUS = "apple_processing";
export const APPLE_GUID_REPAIR_COMPLETE_STATUS = "verified_complete";

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

const REMOTE_GATES = [
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
];

const GATE_PREREQUISITES = Object.freeze({
  exactRemoteChangeApproved: [
    "appleSupportCrosswalkRecorded",
    "appleTitleMappingIndependentlyVerified",
    "spotifyImpactReviewed",
    "userAcceptedAppleIdentityRisk",
    "overlayLocallyValidated",
  ],
  beforeSnapshotCaptured: ["exactRemoteChangeApproved"],
  githubPagesWorkflowModeVerified: [
    "exactRemoteChangeApproved",
    "beforeSnapshotCaptured",
  ],
  remoteWritePerformed: [
    "exactRemoteChangeApproved",
    "beforeSnapshotCaptured",
    "githubPagesWorkflowModeVerified",
  ],
  overlayPublished: ["remoteWritePerformed", "githubPagesWorkflowModeVerified"],
  feedVerified: ["overlayPublished"],
  sourceFeedUnchangedAfterDeploymentVerified: ["feedVerified"],
  appleFeedUrlChanged: [
    "feedVerified",
    "sourceFeedUnchangedAfterDeploymentVerified",
  ],
  appleRefreshRequested: ["appleFeedUrlChanged"],
  appleExistingShowPreserved: ["appleFeedUrlChanged"],
  applePublicSevenEpisodesVerified: [
    "appleFeedUrlChanged",
    "appleExistingShowPreserved",
  ],
  applePlaybackVerified: [
    "applePublicSevenEpisodesVerified",
    "appleExistingShowPreserved",
  ],
});

const REPAIR_MECHANISM = Object.freeze({
  type: "apple_only_guid_overlay",
  configPath: "publishing/apple-feed-overlay.json",
  sourceFeedUrl: "https://media.rss.com/dr-m-experienced/feed.xml",
  publicFeedUrl: "https://drmexperienced.com/apple-podcasts/feed.xml",
  appleShowId: "1870433419",
  appleContentProviderId: "128469457",
  githubPagesRequiredBuildType: "workflow",
});

const APPROVED_TRUE_GATES = [
  "appleSupportCrosswalkRecorded",
  "appleTitleMappingIndependentlyVerified",
  "spotifyImpactReviewed",
  "userAcceptedAppleIdentityRisk",
  "overlayLocallyValidated",
  "exactRemoteChangeApproved",
  "beforeSnapshotCaptured",
];

const DEPLOYED_TRUE_GATES = [
  "githubPagesWorkflowModeVerified",
  "remoteWritePerformed",
  "overlayPublished",
  "feedVerified",
  "sourceFeedUnchangedAfterDeploymentVerified",
];

const APPLE_CUTOVER_TRUE_GATES = [
  "appleFeedUrlChanged",
  "appleExistingShowPreserved",
];

const COMPLETION_TRUE_GATES = [
  "applePublicSevenEpisodesVerified",
  "applePlaybackVerified",
];

const STATUS_GATE_PROFILES = Object.freeze({
  [APPLE_GUID_REPAIR_APPROVED_STATUS]: Object.freeze({
    true: APPROVED_TRUE_GATES,
    false: REMOTE_GATES,
  }),
  [APPLE_GUID_REPAIR_DEPLOYED_STATUS]: Object.freeze({
    true: [...APPROVED_TRUE_GATES, ...DEPLOYED_TRUE_GATES],
    false: [...APPLE_CUTOVER_TRUE_GATES, ...COMPLETION_TRUE_GATES],
  }),
  [APPLE_GUID_REPAIR_PROCESSING_STATUS]: Object.freeze({
    true: [
      ...APPROVED_TRUE_GATES,
      ...DEPLOYED_TRUE_GATES,
      ...APPLE_CUTOVER_TRUE_GATES,
    ],
    false: COMPLETION_TRUE_GATES,
  }),
  [APPLE_GUID_REPAIR_COMPLETE_STATUS]: Object.freeze({
    true: [
      ...APPROVED_TRUE_GATES,
      ...DEPLOYED_TRUE_GATES,
      ...APPLE_CUTOVER_TRUE_GATES,
      ...COMPLETION_TRUE_GATES,
    ],
    false: [],
  }),
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
  for (const provider of ["apple", "rssCom", "spotify"]) {
    const submittedAt = timestamp(record?.supportOutreach?.[provider]?.submittedAt);
    if (
      submittedAt !== null &&
      discoveredAt !== null &&
      submittedAt < discoveredAt
    ) {
      errors.push(`supportOutreach.${provider}.submittedAt predates discovery.`);
    }
    if (
      submittedAt !== null &&
      verificationWindowEnd !== null &&
      submittedAt >= verificationWindowEnd
    ) {
      errors.push(`supportOutreach.${provider}.submittedAt is newer than lastVerifiedAt.`);
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

  if (
    JSON.stringify(record?.relatedAppleCaseNumbers) !==
    JSON.stringify(record?.supportOutreach?.apple?.relatedCaseNumbers)
  ) {
    errors.push(
      "supportOutreach.apple.relatedCaseNumbers must match relatedAppleCaseNumbers.",
    );
  }

  for (const [field, expected] of Object.entries(REPAIR_MECHANISM)) {
    if (record?.repairMechanism?.[field] !== expected) {
      errors.push(
        `repairMechanism.${field} must remain ${JSON.stringify(expected)}.`,
      );
    }
  }
  if (record?.repairMechanism?.sourceFeedUrl !== record?.feedUrl) {
    errors.push("repairMechanism.sourceFeedUrl must match feedUrl.");
  }
  if (record?.repairMechanism?.appleShowId !== record?.appleShowId) {
    errors.push("repairMechanism.appleShowId must match appleShowId.");
  }
  if (
    record?.repairMechanism?.appleContentProviderId !==
    record?.appleContentProviderId
  ) {
    errors.push(
      "repairMechanism.appleContentProviderId must match appleContentProviderId.",
    );
  }

  const approvalAt = timestamp(record?.repairMechanism?.approval?.approvedAt);
  const beforeCapturedAt = timestamp(record?.beforeState?.capturedAt);
  if (
    approvalAt !== null &&
    verificationWindowEnd !== null &&
    approvalAt >= verificationWindowEnd
  ) {
    errors.push("repairMechanism.approval.approvedAt is newer than lastVerifiedAt.");
  }
  if (
    beforeCapturedAt !== null &&
    verificationWindowEnd !== null &&
    beforeCapturedAt >= verificationWindowEnd
  ) {
    errors.push("beforeState.capturedAt is newer than lastVerifiedAt.");
  }

  const gates = record?.gates;
  if (gates && typeof gates === "object") {
    const profile = STATUS_GATE_PROFILES[record?.status];
    if (profile) {
      for (const gate of profile.true) {
        if (gates[gate] !== true) {
          errors.push(`${record.status} requires gates.${gate}=true.`);
        }
      }
      for (const gate of profile.false) {
        if (gates[gate] !== false) {
          errors.push(`${record.status} requires gates.${gate}=false.`);
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
