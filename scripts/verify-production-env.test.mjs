import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scriptPath = fileURLToPath(
  new URL("./verify-production-env.mjs", import.meta.url),
);

function runGuard({ projectToken, legacyApiKey } = {}) {
  const env = { ...process.env };
  delete env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  delete env.NEXT_PUBLIC_POSTHOG_API_KEY;
  if (projectToken !== undefined) {
    env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = projectToken;
  }
  if (legacyApiKey !== undefined) {
    env.NEXT_PUBLIC_POSTHOG_API_KEY = legacyApiKey;
  }

  return spawnSync(process.execPath, [scriptPath], {
    encoding: "utf8",
    env,
  });
}

test("fails when the PostHog project key is absent", () => {
  const result = runGuard();

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN or NEXT_PUBLIC_POSTHOG_API_KEY/,
  );
});

test("fails when both PostHog project key names are blank", () => {
  const result = runGuard({ projectToken: "   ", legacyApiKey: "\t" });

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN or NEXT_PUBLIC_POSTHOG_API_KEY/,
  );
});

test("passes with the preferred project token without printing it", () => {
  const configuredValue = "phc_preferred_test_value";
  const result = runGuard({ projectToken: configuredValue });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Production environment check passed/);
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(configuredValue));
});

test("passes with the legacy API key without printing it", () => {
  const configuredValue = "phc_legacy_test_value";
  const result = runGuard({ legacyApiKey: configuredValue });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Production environment check passed/);
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(configuredValue));
});

test("uses the legacy API key when the preferred project token is blank", () => {
  const configuredValue = "phc_legacy_fallback_test_value";
  const result = runGuard({
    projectToken: "   ",
    legacyApiKey: configuredValue,
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Production environment check passed/);
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(configuredValue));
});
