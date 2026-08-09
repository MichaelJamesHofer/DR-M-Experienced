import {
  approvalRecordProblems,
  hashSnapshot,
  hashText,
  reviewDocumentProblems,
} from "./lib.mjs";

const RFC3339_WITH_TIMEZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const SHA256 = /^[a-f0-9]{64}$/;
export const DEFAULT_RELEASE_AUTHORIZATION_TTL_MS = 60 * 60 * 1000;
export const MAX_RELEASE_AUTHORIZATION_TTL_MS = 24 * 60 * 60 * 1000;
const AUTHORIZATION_KEYS = new Set([
  "schemaVersion",
  "authorizationType",
  "jobId",
  "approvalHash",
  "reviewDocumentSha256",
  "targets",
  "targetBindings",
  "approver",
  "issuedAt",
  "expiresAt",
  "authorizesUpload",
  "authorizesRelease",
  "authorizationHash",
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validTimestamp(value) {
  return (
    typeof value === "string" &&
    RFC3339_WITH_TIMEZONE.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function authorizationContent(authorization) {
  const { authorizationHash: _authorizationHash, ...content } = authorization;
  return content;
}

function targetFor(packet, platformId) {
  if (!packet?.snapshot?.manifest?.targets?.includes(platformId)) return null;
  return packet?.snapshot?.targets?.find((target) => target?.id === platformId) || null;
}

export function releaseTargetBinding(packet, platformId) {
  const target = targetFor(packet, platformId);
  if (!target) {
    throw new Error(`${platformId} is not a selected destination in job ${packet?.id || "unknown"}.`);
  }
  const releasePlan = target.releasePlan || null;
  return {
    targetSha256: hashSnapshot(target),
    assetSha256: target.assetSha256 || null,
    approvedCopySha256: target.approvedCopy == null ? null : hashText(target.approvedCopy),
    releasePlanSha256: releasePlan == null ? null : hashSnapshot(releasePlan),
    schedule: {
      publishAt: packet.snapshot.manifest?.publishAt || null,
      releaseMode: releasePlan?.releaseMode || null,
      initialVisibility: releasePlan?.initialVisibility || null,
      finalVisibility: releasePlan?.finalVisibility || null,
    },
  };
}

export function releaseAuthorizationExpired(authorization, now = new Date()) {
  if (!validTimestamp(authorization?.expiresAt)) return true;
  return Date.parse(authorization.expiresAt) <= new Date(now).getTime();
}

export function buildReleaseAuthorization({
  packet,
  approval,
  reviewDocument,
  targets,
  approver,
  issuedAt = new Date().toISOString(),
  expiresAt,
}) {
  const resolvedExpiresAt =
    expiresAt ??
    (validTimestamp(issuedAt)
      ? new Date(Date.parse(issuedAt) + DEFAULT_RELEASE_AUTHORIZATION_TTL_MS).toISOString()
      : null);
  const normalizedTargets = Array.isArray(targets)
    ? targets.map((target) => (typeof target === "string" ? target.trim() : target))
    : targets;
  const authorization = {
    schemaVersion: 1,
    authorizationType: "explicit-local-release",
    jobId: packet?.id,
    approvalHash: packet?.approvalHash,
    reviewDocumentSha256: typeof reviewDocument === "string" ? hashText(reviewDocument) : null,
    targets: normalizedTargets,
    targetBindings: Object.fromEntries(
      Array.isArray(normalizedTargets)
        ? normalizedTargets.map((platformId) => [platformId, releaseTargetBinding(packet, platformId)])
        : [],
    ),
    approver: typeof approver === "string" ? approver.trim() : approver,
    issuedAt,
    expiresAt: resolvedExpiresAt,
    authorizesUpload: true,
    authorizesRelease: true,
  };
  authorization.authorizationHash = hashSnapshot(authorization);

  const problems = releaseAuthorizationProblems(packet, approval, reviewDocument, authorization, {
    now: issuedAt,
  });
  if (problems.length) {
    throw new Error(`Release authorization is invalid:\n- ${problems.join("\n- ")}`);
  }
  return authorization;
}

export function releaseAuthorizationProblems(
  packet,
  approval,
  reviewDocument,
  authorization,
  { now = new Date(), allowExpired = false } = {},
) {
  const problems = [];
  if (!isPlainObject(authorization)) return ["Release authorization must be a JSON object."];

  const unexpectedKeys = Object.keys(authorization).filter((key) => !AUTHORIZATION_KEYS.has(key));
  if (unexpectedKeys.length) {
    problems.push(`Release authorization contains unsupported field(s): ${unexpectedKeys.join(", ")}.`);
  }
  if (authorization.schemaVersion !== 1) problems.push("Release authorization schema version is invalid.");
  if (authorization.authorizationType !== "explicit-local-release") {
    problems.push("Release authorization type is invalid.");
  }
  if (authorization.jobId !== packet?.id) {
    problems.push("Release authorization job id does not match the packet.");
  }
  if (authorization.approvalHash !== packet?.approvalHash) {
    problems.push("Release authorization approval hash does not match the packet.");
  }

  if (typeof reviewDocument !== "string") {
    problems.push("Release authorization requires the exact reviewed document.");
  } else {
    problems.push(...reviewDocumentProblems(packet, reviewDocument));
    if (authorization.reviewDocumentSha256 !== hashText(reviewDocument)) {
      problems.push("Release authorization does not match the reviewed document.");
    }
    if (!isPlainObject(approval)) {
      problems.push("Release authorization requires a valid local review attestation.");
    } else {
      problems.push(...approvalRecordProblems(packet, approval, reviewDocument));
    }
  }

  const packetTargetIds = new Set(
    Array.isArray(packet?.snapshot?.manifest?.targets) ? packet.snapshot.manifest.targets : [],
  );
  if (!Array.isArray(authorization.targets) || authorization.targets.length === 0) {
    problems.push("Release authorization must select at least one target.");
  } else {
    const invalidTargets = authorization.targets.filter(
      (target) => typeof target !== "string" || !target.trim() || !packetTargetIds.has(target),
    );
    if (invalidTargets.length) {
      problems.push("Release authorization contains a target outside the reviewed packet.");
    }
    if (new Set(authorization.targets).size !== authorization.targets.length) {
      problems.push("Release authorization targets must be unique.");
    }
  }

  if (!isPlainObject(authorization.targetBindings)) {
    problems.push("Release authorization target bindings are missing or invalid.");
  } else if (Array.isArray(authorization.targets)) {
    const bindingIds = Object.keys(authorization.targetBindings);
    const targetIds = authorization.targets.filter((target) => typeof target === "string");
    const missingBindings = targetIds.filter((target) => !bindingIds.includes(target));
    const extraBindings = bindingIds.filter((target) => !targetIds.includes(target));
    if (missingBindings.length || extraBindings.length) {
      problems.push("Release authorization target bindings do not exactly match its selected targets.");
    }
    for (const platformId of targetIds.filter((target) => packetTargetIds.has(target))) {
      try {
        const expected = releaseTargetBinding(packet, platformId);
        if (hashSnapshot(authorization.targetBindings[platformId]) !== hashSnapshot(expected)) {
          problems.push(`Release authorization binding for ${platformId} does not match the reviewed target.`);
        }
      } catch {
        problems.push(`Release authorization target ${platformId} has no reviewed destination plan.`);
      }
    }
  }

  if (typeof authorization.approver !== "string" || !authorization.approver.trim()) {
    problems.push("Release authorization approver attribution is missing.");
  }
  if (!validTimestamp(authorization.issuedAt)) {
    problems.push("Release authorization issuedAt timestamp is invalid.");
  } else if (validTimestamp(approval?.approvedAt) && Date.parse(authorization.issuedAt) < Date.parse(approval.approvedAt)) {
    problems.push("Release authorization predates the local review attestation.");
  }
  if (!validTimestamp(authorization.expiresAt)) {
    problems.push("Release authorization expiresAt timestamp is required and must be valid.");
  } else {
    if (validTimestamp(authorization.issuedAt)) {
      const authorizationTtlMs =
        Date.parse(authorization.expiresAt) - Date.parse(authorization.issuedAt);
      if (authorizationTtlMs <= 0) {
        problems.push("Release authorization expiry must be later than issuedAt.");
      } else if (authorizationTtlMs > MAX_RELEASE_AUTHORIZATION_TTL_MS) {
        problems.push("Release authorization expiry must be no more than 24 hours after issuedAt.");
      }
    }
    if (!allowExpired && releaseAuthorizationExpired(authorization, now)) {
      problems.push("Release authorization has expired.");
    }
  }
  if (authorization.authorizesUpload !== true || authorization.authorizesRelease !== true) {
    problems.push("Release authorization must explicitly authorize upload and release.");
  }

  if (typeof authorization.authorizationHash !== "string" || !SHA256.test(authorization.authorizationHash)) {
    problems.push("Release authorization hash is missing or invalid.");
  } else if (hashSnapshot(authorizationContent(authorization)) !== authorization.authorizationHash) {
    problems.push("Release authorization content does not match its hash.");
  }
  return [...new Set(problems)];
}
