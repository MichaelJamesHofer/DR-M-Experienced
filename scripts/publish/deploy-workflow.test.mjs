import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(
  new URL("../../.github/workflows/deploy.yml", import.meta.url),
  "utf8",
);

function jobSection(name, nextName) {
  const start = workflow.indexOf(`\n  ${name}:`);
  assert.notEqual(start, -1, `missing ${name} job`);
  const end = nextName
    ? workflow.indexOf(`\n  ${nextName}:`, start + 1)
    : workflow.length;
  assert.notEqual(end, -1, `missing ${nextName} job after ${name}`);
  return workflow.slice(start, end);
}

test("production builds fail closed unless Pages is workflow managed", () => {
  const pagesMode = jobSection("pages_mode", "build");
  const build = jobSection("build", "deploy");

  assert.match(pagesMode, /if: github\.event_name != 'pull_request'/);
  assert.match(pagesMode, /permissions:\n\s+pages: read/);
  assert.match(pagesMode, /set -euo pipefail/);
  assert.doesNotMatch(pagesMode, /set -x/);
  assert.match(pagesMode, /curl --silent --show-error --fail/);
  assert.match(pagesMode, /--retry 3 --retry-all-errors/);
  assert.match(pagesMode, /Authorization: Bearer \$\{GITHUB_TOKEN\}/);
  assert.match(
    pagesMode,
    /\$\{GITHUB_API_URL\}\/repos\/\$\{GITHUB_REPOSITORY\}\/pages/,
  );
  assert.match(pagesMode, /jq -er '\.build_type \/\/ empty'/);
  assert.match(pagesMode, /test "\$build_type" = "workflow"/);
  assert.doesNotMatch(pagesMode, /echo .*GITHUB_TOKEN/);

  assert.match(build, /needs: pages_mode/);
  assert.match(
    build,
    /if: \$\{\{ always\(\) && \(github\.event_name == 'pull_request' \|\| needs\.pages_mode\.result == 'success'\) \}\}/,
  );
});

test("successful deployment is followed by exact public feed verification", () => {
  const build = jobSection("build", "deploy");
  const deploy = jobSection("deploy", "verify-apple-feed");
  const verification = jobSection("verify-apple-feed");

  assert.match(
    build,
    /outputs:\n\s+apple_feed_sha256: \$\{\{ steps\.apple_feed_evidence\.outputs\.sha256 \}\}/,
  );
  assert.match(build, /id: apple_feed_evidence/);
  assert.match(build, /sha256sum out\/apple-podcasts\/feed\.xml/);
  assert.match(build, /echo "sha256=\$sha256" >> "\$GITHUB_OUTPUT"/);
  assert.match(deploy, /needs: build/);
  assert.match(verification, /needs:\n\s+- build\n\s+- deploy/);
  assert.match(verification, /if: github\.event_name != 'pull_request'/);
  assert.match(verification, /timeout-minutes: 15/);
  assert.match(verification, /permissions:\n\s+contents: read/);
  assert.match(verification, /persist-credentials: false/);
  assert.match(
    verification,
    /EXPECTED_APPLE_FEED_SHA256: \$\{\{ needs\.build\.outputs\.apple_feed_sha256 \}\}/,
  );
  assert.match(
    verification,
    /run: npm run verify:apple-feed-deployment/,
  );
});
