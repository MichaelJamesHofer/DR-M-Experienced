import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAppleRepublishCanaryAuthorities } from "./apple-republish-canary-prototype.mjs";
import { fetchPublishedAppleFeed } from "./verify-apple-feed-deployment.mjs";
import { verifyDirectAppleCanaryMedia } from "./verify-apple-republish-canary-deployment.mjs";

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_ATTEMPTS = 61;
const DEFAULT_POLL_INTERVAL_MS = 10_000;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function selectedFeed(authorities) {
  const { deploymentState, sealedFeeds } = authorities;
  const name = deploymentState.feedSnapshotByPhase[deploymentState.phase];
  const xml = sealedFeeds[name];
  if (!name || typeof xml !== "string") {
    throw new Error(`Apple ${deploymentState.phase} phase has no sealed feed projection.`);
  }
  return { name, xml, sha256: sha256(xml) };
}

export async function verifyAppleAuthorizedSubtreeDeployment({
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  sleepImpl = sleep,
  authorities = null,
  expectedFeedSha256 = process.env.EXPECTED_APPLE_FEED_SHA256 ?? null,
  cacheBust = process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT ?? "1"}`
    : `${Date.now()}`,
} = {}) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 120) {
    throw new TypeError("Deployment maxAttempts must be an integer from 1 through 120.");
  }
  if (
    !Number.isInteger(pollIntervalMs) ||
    pollIntervalMs < 0 ||
    pollIntervalMs > 60_000
  ) {
    throw new TypeError("Deployment pollIntervalMs must be an integer from 0 through 60000.");
  }
  if (typeof sleepImpl !== "function") {
    throw new TypeError("Deployment sleepImpl must be a function.");
  }
  if (!/^[a-f0-9]{64}$/.test(expectedFeedSha256 ?? "")) {
    throw new TypeError("expectedFeedSha256 must be a lowercase SHA-256.");
  }

  const loaded = authorities ?? (await loadAppleRepublishCanaryAuthorities());
  const expected = selectedFeed(loaded);
  if (expected.sha256 !== expectedFeedSha256) {
    throw new Error(
      `Deployment artifact SHA-256 ${expectedFeedSha256} is not the sealed ${loaded.deploymentState.phase} phase feed ${expected.sha256}.`,
    );
  }

  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const cacheBusted = await fetchPublishedAppleFeed(
        loaded.activeConfig.publicFeedUrl,
        {
          fetchImpl,
          timeoutMs,
          cacheBust: `${cacheBust}-${attempt}`,
        },
      );
      const bare = await fetchPublishedAppleFeed(
        loaded.activeConfig.publicFeedUrl,
        { fetchImpl, timeoutMs, cacheBust: null },
      );
      for (const [label, xml] of [
        ["cache-busted", cacheBusted.xml],
        ["bare", bare.xml],
      ]) {
        if (xml !== expected.xml || sha256(xml) !== expected.sha256) {
          throw new Error(
            `Published ${label} Apple feed is not the exact sealed ${loaded.deploymentState.phase} projection.`,
          );
        }
      }

      const media =
        loaded.deploymentState.phase === "closed"
          ? null
          : await verifyDirectAppleCanaryMedia(loaded.config, {
              fetchImpl,
              timeoutMs,
            });
      return {
        verifiedAt: new Date().toISOString(),
        attempts: attempt,
        phase: loaded.deploymentState.phase,
        appleShowId: loaded.config.appleShowId,
        publicFeedUrl: loaded.activeConfig.publicFeedUrl,
        feedSnapshot: expected.name,
        publicFeedSha256: expected.sha256,
        exactSealedFeed: true,
        bareUrlVerified: true,
        candidateMediaRequired: loaded.deploymentState.phase !== "closed",
        media,
      };
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts && pollIntervalMs > 0) {
        await sleepImpl(pollIntervalMs);
      }
    }
  }
  throw new Error(
    `Apple ${loaded.deploymentState.phase} phase did not verify after ${maxAttempts} attempts: ${lastError?.message ?? "unknown error"}`,
    { cause: lastError },
  );
}

const invokedPath = process.argv[1];
if (invokedPath && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  try {
    const report = await verifyAppleAuthorizedSubtreeDeployment();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`apple-authorized-subtree-verifier: ${error.message}\n`);
    process.exitCode = 1;
  }
}
