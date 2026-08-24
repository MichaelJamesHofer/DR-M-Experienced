export const HOST_MIGRATION_IDENTITIES = Object.freeze({
  sourceFeedUrl: "https://anchor.fm/s/10e1b0328/podcast/rss",
  targetFeedUrl: "https://media.rss.com/dr-m-experienced/feed.xml",
  targetProvider: "rss.com",
  targetChannelUrl: "https://rss.com/podcasts/dr-m-experienced/",
  spotifyShowId: "7GGLljxmO0G3FLjPy8vfcw",
  spotifyChannelUrl: "https://open.spotify.com/show/7GGLljxmO0G3FLjPy8vfcw",
  appleShowId: "1870433419",
  appleConnectShowId: "cfab5caf-554e-4ebe-a28c-2e4748147b82",
  appleChannelUrl:
    "https://podcasts.apple.com/us/podcast/dr-m-experienced-with-dr-david-musnick/id1870433419",
  appleOverlayFeedUrl: "https://drmexperienced.com/apple-podcasts/feed.xml",
  appleOverlayConfigPath: "publishing/apple-feed-overlay.json",
});

const READY_GATES = [
  "rssComImportComplete",
  "episodeCountMatches",
  "guidSetMatches",
  "episodeMetadataMatches",
  "mediaVerified",
  "artworkVerified",
  "existingDirectoryLinksRecorded",
  "monetizationAndSubscriptionsReviewed",
  "redirectAuthorized",
];

const COMPLETED_VALIDATION_CLAIMS = [
  "structuralParityPassed",
  "canonicalTargetMetadataPassed",
  "candidateMediaRangeChecksPassed",
  "candidateEpisodeArtworkChecksPassed",
  "oldestAndNewestAudioFullyDecoded",
  "allAudioPairsByteIdentical",
  "allArtworkPairsByteIdentical",
];

function terminalStatus(status) {
  if (typeof status !== "string" || !status.trim()) return "invalid";
  const normalized = status.toLowerCase();
  if (/(?:^|_)(?:completed|complete)(?:$|_)/.test(normalized)) return "completed";
  if (/(?:^|_)(?:parked|paused|cancelled|canceled|abandoned)(?:$|_)/.test(normalized)) {
    return "parked";
  }
  return "active";
}

export function hostingMigrationPhase(migration, pendingMigration) {
  if (!migration || !pendingMigration) return "missing";
  const migrationActive = migration.decision?.active;
  const pendingActive = pendingMigration.active;
  if (typeof migrationActive !== "boolean" || typeof pendingActive !== "boolean") return "invalid";
  if (migrationActive !== pendingActive) return "invalid";

  const migrationStatus = terminalStatus(migration.status);
  const pendingStatus = terminalStatus(pendingMigration.status);
  if (migrationStatus === "invalid" || pendingStatus === "invalid") return "invalid";

  if (migrationActive) {
    if (migrationStatus !== "active" || pendingStatus !== "active") return "invalid";
    return migration.gates?.redirectVerified ? "post_redirect_validation" : "pre_redirect";
  }

  if (migrationStatus === "completed" && pendingStatus === "completed") return "completed";
  if (migrationStatus === "parked" && pendingStatus === "parked") return "parked";
  return "invalid";
}

export function hostingMigrationIsActive(migration, pendingMigration) {
  return ["pre_redirect", "post_redirect_validation"].includes(
    hostingMigrationPhase(migration, pendingMigration)
  );
}

function validTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function timestampPrecedes(left, right) {
  return validTimestamp(left) && validTimestamp(right) && Date.parse(left) < Date.parse(right);
}

function requireEqual(errors, actual, expected, field) {
  if (actual !== expected) errors.push(`${field} must be ${JSON.stringify(expected)}.`);
}

function requireTrue(errors, object, keys, prefix) {
  for (const key of keys) {
    if (object?.[key] !== true) errors.push(`${prefix}.${key} must be true.`);
  }
}

function snapshotProblems(migration) {
  const errors = [];
  const validation = migration.destination?.validation;
  if (!validation) return ["destination.validation is required."];
  const evidenceClaimed = ["fullPreflightPassed", ...COMPLETED_VALIDATION_CLAIMS].some(
    (key) => validation[key] === true
  );
  const sourceSnapshot = validation.sourceSnapshot;
  const candidateSnapshot = validation.candidateSnapshot;

  if (typeof validation.fullPreflightPassed !== "boolean") {
    errors.push("destination.validation.fullPreflightPassed must be boolean.");
  }
  if (evidenceClaimed && !validTimestamp(validation.verifiedAt)) {
    errors.push("destination.validation.verifiedAt is required for validation evidence.");
  }
  if (evidenceClaimed && (!sourceSnapshot || !candidateSnapshot)) {
    errors.push("destination.validation must record both sourceSnapshot and candidateSnapshot.");
  }
  if (sourceSnapshot && sourceSnapshot === candidateSnapshot) {
    errors.push("destination.validation sourceSnapshot and candidateSnapshot must be distinct files.");
  }
  for (const [field, snapshot] of [
    ["sourceSnapshot", sourceSnapshot],
    ["candidateSnapshot", candidateSnapshot],
  ]) {
    if (snapshot && !snapshot.includes(`/migrations/${migration.migrationId}/`)) {
      errors.push(`destination.validation.${field} must belong to migration ${migration.migrationId}.`);
    }
  }

  if (validation.fullPreflightPassed === true) {
    requireTrue(errors, validation, COMPLETED_VALIDATION_CLAIMS, "destination.validation");
    if (validation.blockingMismatch != null) {
      errors.push("destination.validation.blockingMismatch must be null after a full preflight pass.");
    }
    for (const field of [
      "canonicalMetadataCleanedAt",
      "episodeMetadataCleanedAt",
      "candidateMetadataVerifiedAt",
    ]) {
      if (timestampPrecedes(validation.verifiedAt, migration.destination?.[field])) {
        errors.push(`destination.validation.verifiedAt predates destination.${field}.`);
      }
    }
  } else if (typeof validation.blockingMismatch !== "string" || !validation.blockingMismatch.trim()) {
    errors.push("destination.validation.blockingMismatch must explain why fullPreflightPassed is false.");
  }

  if (
    validation.canonicalTargetMetadataPassed === true &&
    timestampPrecedes(validation.verifiedAt, migration.destination?.canonicalMetadataCleanedAt)
  ) {
    errors.push(
      "destination.validation.canonicalTargetMetadataPassed is stale because the snapshot predates canonicalMetadataCleanedAt."
    );
  }
  return errors;
}

export function validatePublishingMigrationState({
  migration,
  platforms,
  canonicalFeedUrl,
  expectedTitle,
  expectedDescription,
}) {
  const errors = [];
  const identities = HOST_MIGRATION_IDENTITIES;
  const pending = platforms?.pendingHostingMigration;
  const phase = hostingMigrationPhase(migration, pending);
  if (phase === "missing") return { phase, errors: ["Both hosting migration state records are required."] };
  if (phase === "invalid") {
    errors.push(
      "Migration status and active flags are inconsistent; use matching active, parked/cancelled, or completed records."
    );
  }

  requireEqual(errors, pending?.target, identities.targetProvider, "pendingHostingMigration.target");
  requireEqual(
    errors,
    pending?.stateFile,
    "publishing/hosting-migration.json",
    "pendingHostingMigration.stateFile"
  );
  requireEqual(errors, migration?.source?.provider, "spotify_for_creators", "source.provider");
  requireEqual(errors, migration?.source?.feedUrl, identities.sourceFeedUrl, "source.feedUrl");
  requireEqual(errors, migration?.destination?.provider, identities.targetProvider, "destination.provider");
  requireEqual(
    errors,
    migration?.destination?.candidateFeedUrl,
    identities.targetFeedUrl,
    "destination.candidateFeedUrl"
  );
  requireEqual(
    errors,
    migration?.destination?.proposedPermanentFeedUrl,
    identities.targetFeedUrl,
    "destination.proposedPermanentFeedUrl"
  );
  requireEqual(
    errors,
    platforms?.platforms?.["rss.com"]?.channelUrl,
    identities.targetChannelUrl,
    "platforms.rss.com.channelUrl"
  );
  requireEqual(
    errors,
    platforms?.platforms?.["rss.com"]?.destinationIds?.containerId,
    "dr-m-experienced",
    "platforms.rss.com.destinationIds.containerId"
  );

  requireEqual(
    errors,
    migration?.existingListings?.spotify?.showId,
    identities.spotifyShowId,
    "existingListings.spotify.showId"
  );
  requireEqual(
    errors,
    platforms?.platforms?.spotify?.destinationIds?.containerId,
    identities.spotifyShowId,
    "platforms.spotify.destinationIds.containerId"
  );
  requireEqual(
    errors,
    platforms?.platforms?.spotify?.channelUrl,
    identities.spotifyChannelUrl,
    "platforms.spotify.channelUrl"
  );
  requireEqual(
    errors,
    migration?.existingListings?.apple?.showId,
    identities.appleShowId,
    "existingListings.apple.showId"
  );
  requireEqual(
    errors,
    migration?.existingListings?.apple?.podcastsConnectShowId,
    identities.appleConnectShowId,
    "existingListings.apple.podcastsConnectShowId"
  );
  requireEqual(
    errors,
    platforms?.platforms?.apple?.destinationIds?.containerId,
    identities.appleShowId,
    "platforms.apple.destinationIds.containerId"
  );
  requireEqual(
    errors,
    platforms?.platforms?.apple?.channelUrl,
    identities.appleChannelUrl,
    "platforms.apple.channelUrl"
  );

  if (expectedTitle !== undefined) {
    requireEqual(errors, migration?.targetMetadata?.title, expectedTitle, "targetMetadata.title");
  }
  if (expectedDescription !== undefined) {
    requireEqual(
      errors,
      migration?.targetMetadata?.description,
      expectedDescription,
      "targetMetadata.description"
    );
  }

  const canonicalHost = platforms?.podcastDistribution?.canonicalHost;
  const expectedCanonicalHost = phase === "parked" ? "spotify" : identities.targetProvider;
  requireEqual(errors, canonicalHost, expectedCanonicalHost, "podcastDistribution.canonicalHost");
  if (canonicalFeedUrl !== undefined) {
    const expectedFeed = phase === "parked" ? identities.sourceFeedUrl : identities.targetFeedUrl;
    requireEqual(errors, canonicalFeedUrl, expectedFeed, "master catalog canonical feed URL");
  }

  const expectedRssRole = phase === "parked" ? "migration_candidate" : "canonical_host";
  const expectedSpotifyRole = phase === "parked" ? "canonical_host" : "direct_media_destination";
  requireEqual(errors, platforms?.platforms?.["rss.com"]?.rssRole, expectedRssRole, "platforms.rss.com.rssRole");
  requireEqual(errors, platforms?.platforms?.spotify?.rssRole, expectedSpotifyRole, "platforms.spotify.rssRole");
  for (const directory of ["apple", "amazon"]) {
    requireEqual(
      errors,
      platforms?.platforms?.[directory]?.dependsOn,
      expectedCanonicalHost,
      `platforms.${directory}.dependsOn`
    );
  }

  const gates = migration?.gates ?? {};
  const ready = READY_GATES.every((gate) => gates[gate] === true);
  if (pending?.cutoverReady !== ready && phase !== "parked") {
    errors.push(`pendingHostingMigration.cutoverReady must equal the pre-redirect gate result (${ready}).`);
  }

  if (phase === "pre_redirect") {
    requireEqual(errors, gates.redirectVerified, false, "gates.redirectVerified");
    requireEqual(errors, gates.publishingFreezeActive, true, "gates.publishingFreezeActive");
    requireEqual(
      errors,
      migration?.existingListings?.spotify?.currentFeedUrl,
      identities.sourceFeedUrl,
      "existingListings.spotify.currentFeedUrl"
    );
    requireEqual(
      errors,
      migration?.existingListings?.apple?.currentFeedUrl,
      identities.sourceFeedUrl,
      "existingListings.apple.currentFeedUrl"
    );
  } else if (phase === "post_redirect_validation") {
    requireEqual(errors, pending?.cutoverReady, true, "pendingHostingMigration.cutoverReady");
    requireEqual(errors, gates.redirectVerified, true, "gates.redirectVerified");
    requireEqual(errors, gates.publishingFreezeActive, true, "gates.publishingFreezeActive");
    for (const listing of ["spotify", "apple"]) {
      requireEqual(
        errors,
        migration?.existingListings?.[listing]?.currentFeedUrl,
        identities.targetFeedUrl,
        `existingListings.${listing}.currentFeedUrl`
      );
    }
  } else if (phase === "completed") {
    const appleRouting = platforms?.platforms?.apple?.feedRouting;
    const appleRouteStatus = appleRouting?.status;
    const appleRouteStatuses = [
      "apple_only_overlay_approved_pending_deployment",
      "feed_deployed_pending_apple_switch",
      "apple_processing",
      "verified_complete",
    ];
    if (!appleRouteStatuses.includes(appleRouteStatus)) {
      errors.push("platforms.apple.feedRouting.status is not a supported Apple overlay state.");
    }
    const appleRouteActive = ["apple_processing", "verified_complete"].includes(
      appleRouteStatus,
    );
    const expectedAppleFeedUrl = appleRouteActive
      ? identities.appleOverlayFeedUrl
      : identities.targetFeedUrl;
    const platformAppleIssue = platforms?.downstreamPropagation?.issues?.find(
      (issue) => issue?.code === "apple_episode_convergence_pending",
    );
    const migrationAppleIssue = migration?.downstreamPropagation?.issues?.find(
      (issue) => issue?.code === "apple_episode_historical_guid_mismatch_confirmed",
    );
    requireEqual(
      errors,
      platforms?.podcastDistribution?.appleFeedOverlay?.status,
      appleRouteStatus,
      "podcastDistribution.appleFeedOverlay.status",
    );
    requireEqual(
      errors,
      platformAppleIssue?.repairStatus,
      appleRouteStatus,
      "downstreamPropagation.apple_episode_convergence_pending.repairStatus",
    );
    requireEqual(
      errors,
      migrationAppleIssue?.repairStatus,
      appleRouteStatus,
      "hostingMigration.downstreamPropagation.apple_episode_historical_guid_mismatch_confirmed.repairStatus",
    );
    requireEqual(
      errors,
      appleRouting?.upstreamFeedUrl,
      identities.targetFeedUrl,
      "platforms.apple.feedRouting.upstreamFeedUrl",
    );
    requireEqual(
      errors,
      appleRouting?.approvedFeedUrl,
      identities.appleOverlayFeedUrl,
      "platforms.apple.feedRouting.approvedFeedUrl",
    );
    requireEqual(
      errors,
      appleRouting?.configPath,
      identities.appleOverlayConfigPath,
      "platforms.apple.feedRouting.configPath",
    );
    requireEqual(
      errors,
      appleRouting?.currentFeedUrl,
      expectedAppleFeedUrl,
      "platforms.apple.feedRouting.currentFeedUrl",
    );
    requireEqual(
      errors,
      migration?.existingListings?.apple?.appleFeedRoutingStatus,
      appleRouteStatus,
      "existingListings.apple.appleFeedRoutingStatus",
    );
    requireEqual(
      errors,
      migration?.existingListings?.apple?.approvedAppleFeedUrl,
      identities.appleOverlayFeedUrl,
      "existingListings.apple.approvedAppleFeedUrl",
    );
    requireEqual(
      errors,
      migration?.existingListings?.apple?.appleFeedOverlayConfig,
      identities.appleOverlayConfigPath,
      "existingListings.apple.appleFeedOverlayConfig",
    );
    requireEqual(errors, pending?.cutoverReady, true, "pendingHostingMigration.cutoverReady");
    requireEqual(errors, gates.redirectVerified, true, "gates.redirectVerified");
    requireEqual(errors, gates.publishingFreezeActive, false, "gates.publishingFreezeActive");
    requireTrue(errors, gates, READY_GATES, "gates");
    requireEqual(
      errors,
      migration?.existingListings?.spotify?.currentFeedUrl,
      identities.targetFeedUrl,
      "existingListings.spotify.currentFeedUrl"
    );
    requireEqual(
      errors,
      migration?.existingListings?.apple?.currentFeedUrl,
      expectedAppleFeedUrl,
      "existingListings.apple.currentFeedUrl"
    );
    requireEqual(
      errors,
      migration?.existingListings?.spotify?.verifiedAfterCutover,
      true,
      "existingListings.spotify.verifiedAfterCutover"
    );
    requireEqual(
      errors,
      migration?.existingListings?.apple?.verifiedAfterCutover,
      true,
      "existingListings.apple.verifiedAfterCutover"
    );
    requireEqual(
      errors,
      migration?.destination?.validation?.fullPreflightPassed,
      true,
      "destination.validation.fullPreflightPassed"
    );
    requireEqual(
      errors,
      migration?.destination?.candidateMetadataVerified?.titleMatches,
      true,
      "destination.candidateMetadataVerified.titleMatches"
    );
    requireEqual(
      errors,
      migration?.destination?.candidateMetadataVerified?.descriptionMatchesTarget,
      true,
      "destination.candidateMetadataVerified.descriptionMatchesTarget"
    );
    requireEqual(
      errors,
      migration?.destination?.candidateMetadataVerified?.verificationTokenPresent,
      false,
      "destination.candidateMetadataVerified.verificationTokenPresent"
    );
    requireEqual(
      errors,
      migration?.destination?.candidateMetadataVerified?.seasonMetadataPresent,
      false,
      "destination.candidateMetadataVerified.seasonMetadataPresent"
    );
  } else if (phase === "parked") {
    requireEqual(errors, pending?.cutoverReady, false, "pendingHostingMigration.cutoverReady");
    requireEqual(errors, gates.redirectVerified, false, "gates.redirectVerified");
    requireEqual(errors, gates.publishingFreezeActive, false, "gates.publishingFreezeActive");
    requireEqual(
      errors,
      pending?.resumeRequiresExplicitApproval,
      true,
      "pendingHostingMigration.resumeRequiresExplicitApproval"
    );
    requireEqual(
      errors,
      migration?.decision?.resumeRequiresExplicitApproval,
      true,
      "decision.resumeRequiresExplicitApproval"
    );
    for (const listing of ["spotify", "apple"]) {
      requireEqual(
        errors,
        migration?.existingListings?.[listing]?.currentFeedUrl,
        identities.sourceFeedUrl,
        `existingListings.${listing}.currentFeedUrl`
      );
      requireEqual(
        errors,
        migration?.existingListings?.[listing]?.verifiedAfterCutover,
        false,
        `existingListings.${listing}.verifiedAfterCutover`
      );
    }
  }

  if (gates.episodeCountMatches === true) {
    requireEqual(
      errors,
      migration?.destination?.candidateMetadataVerified?.episodeCount,
      migration?.source?.expectedEpisodeCount,
      "destination.candidateMetadataVerified.episodeCount"
    );
  }
  if (gates.guidSetMatches === true) {
    requireEqual(
      errors,
      migration?.destination?.candidateMetadataVerified?.guidSetMatches,
      true,
      "destination.candidateMetadataVerified.guidSetMatches"
    );
  }
  if (gates.episodeMetadataMatches === true) {
    requireEqual(
      errors,
      migration?.destination?.candidateMetadataVerified?.episodeMetadataMatchesSource,
      true,
      "destination.candidateMetadataVerified.episodeMetadataMatchesSource"
    );
    requireEqual(
      errors,
      migration?.destination?.candidateMetadataVerified?.episodeDescriptionsMatchCatalog,
      true,
      "destination.candidateMetadataVerified.episodeDescriptionsMatchCatalog"
    );
  }
  if (gates.mediaVerified === true) {
    requireTrue(
      errors,
      migration?.destination?.validation,
      ["candidateMediaRangeChecksPassed", "oldestAndNewestAudioFullyDecoded", "allAudioPairsByteIdentical"],
      "destination.validation"
    );
  }
  if (gates.artworkVerified === true) {
    requireTrue(
      errors,
      migration?.destination?.validation,
      ["candidateEpisodeArtworkChecksPassed", "allArtworkPairsByteIdentical"],
      "destination.validation"
    );
    requireEqual(
      errors,
      migration?.destination?.candidateMetadataVerified?.episodeArtworkByteIdentical,
      true,
      "destination.candidateMetadataVerified.episodeArtworkByteIdentical"
    );
    requireEqual(
      errors,
      migration?.destination?.candidateMetadataVerified?.showArtworkByteIdentical,
      true,
      "destination.candidateMetadataVerified.showArtworkByteIdentical"
    );
  }
  if (gates.existingDirectoryLinksRecorded === true) {
    requireEqual(
      errors,
      migration?.destination?.directoryLinks?.spotify?.url,
      identities.spotifyChannelUrl,
      "destination.directoryLinks.spotify.url"
    );
    requireEqual(
      errors,
      migration?.destination?.directoryLinks?.spotify?.status,
      "active",
      "destination.directoryLinks.spotify.status"
    );
    requireEqual(
      errors,
      migration?.destination?.directoryLinks?.apple?.url,
      identities.appleChannelUrl,
      "destination.directoryLinks.apple.url"
    );
    requireEqual(
      errors,
      migration?.destination?.directoryLinks?.apple?.status,
      "active",
      "destination.directoryLinks.apple.status"
    );
  }

  errors.push(...snapshotProblems(migration));
  return { phase, errors };
}

export function migrationCheckMode(phase) {
  if (phase === "parked") return "skip_parked";
  if (phase === "completed") return "post_cutover_read_only";
  if (phase === "post_redirect_validation") return "post_redirect_validation";
  if (phase === "pre_redirect") return "pre_redirect";
  return "invalid";
}

export function migrationDoctorAdvice({ phase, migration, pendingMigration, rssHealthy }) {
  if (phase === "invalid" || phase === "missing") {
    return "Repair the contradictory migration records before any host or directory action.";
  }
  if (phase === "parked") {
    return "The migration is parked; keep the recorded source feed canonical and obtain explicit approval before resuming.";
  }
  if (phase === "completed") {
    return rssHealthy
      ? "Cutover is complete; migration-check remains available for read-only post-cutover validation."
      : "Cutover is recorded complete, but the RSS.com canonical feed is unhealthy; repair it before publishing.";
  }
  if (phase === "post_redirect_validation") {
    return "Keep publishing frozen while the verified redirect and downstream listings receive final read-only validation.";
  }
  if (!pendingMigration?.cutoverReady) {
    return "Finish the remaining pre-redirect cleanup gates and rerun migration-check; do not redirect yet.";
  }
  if (migration?.gates?.redirectAuthorized !== true) {
    return "Obtain explicit redirect approval before changing the legacy host.";
  }
  return "Execute the approved redirect, verify the exact HTTP redirect chain, and keep publishing frozen during downstream validation.";
}
