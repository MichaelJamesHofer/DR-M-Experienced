import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scriptPath = fileURLToPath(
  new URL("./verify-production-env.mjs", import.meta.url),
);

function runGuard(value) {
  const env = { ...process.env };
  delete env.NEXT_PUBLIC_POSTHOG_API_KEY;
  if (value !== undefined) env.NEXT_PUBLIC_POSTHOG_API_KEY = value;

  return spawnSync(process.execPath, [scriptPath], {
    encoding: "utf8",
    env,
  });
}

test("fails when the PostHog project key is absent", () => {
  const result = runGuard(undefined);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing NEXT_PUBLIC_POSTHOG_API_KEY/);
});

test("fails when the PostHog project key is blank", () => {
  const result = runGuard("   ");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing NEXT_PUBLIC_POSTHOG_API_KEY/);
});

test("passes without printing the configured value", () => {
  const configuredValue = "phc_test_value_not_a_secret";
  const result = runGuard(configuredValue);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Production environment check passed/);
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(configuredValue));
});
