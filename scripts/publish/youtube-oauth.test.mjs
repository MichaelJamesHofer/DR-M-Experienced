import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  YOUTUBE_OAUTH_SCOPES,
  YouTubeOAuthError,
  createYouTubeAuthorizationRequest,
  exchangeAndVerifyYouTubeGrant,
} from "./youtube-oauth.mjs";

const EXPECTED_CHANNEL = "UCFA1nVv4lKMBlx81gjMAOFQ";
const OTHER_CHANNEL = `UC${"B".repeat(22)}`;
const ACCESS_TOKEN = "test-access-token-never-log";
const REFRESH_TOKEN = "test-refresh-token-never-log";
const CLIENT_SECRET = "test-client-secret-never-log";
const FIXED_NOW = Date.parse("2026-08-08T20:00:00.000Z");

function jsonResponse(document, status = 200) {
  return new Response(JSON.stringify(document), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function emptyResponse(status = 200) {
  return new Response(null, { status });
}

function requestDetails(url, init = {}) {
  return {
    url: String(url),
    method: init.method ?? "GET",
    headers: Object.fromEntries(new Headers(init.headers ?? {}).entries()),
    body: init.body,
  };
}

function scriptedFetch(steps) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const call = requestDetails(url, init);
    calls.push(call);
    const step = steps.shift();
    assert.ok(step, `Unexpected fetch: ${call.method} ${call.url}`);
    await step.assert?.(call);
    return step.response;
  };
  fetch.calls = calls;
  fetch.assertComplete = () => assert.equal(steps.length, 0, `${steps.length} expected fetch calls did not occur`);
  return fetch;
}

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "youtube-oauth-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return { directory, tokenPath: path.join(directory, "credentials", "token.json") };
}

function client() {
  return {
    clientId: "test-client.apps.googleusercontent.com",
    clientSecret: CLIENT_SECRET,
    tokenUri: "https://oauth2.googleapis.com/token",
  };
}

function tokenDocument(overrides = {}) {
  return {
    access_token: ACCESS_TOKEN,
    refresh_token: REFRESH_TOKEN,
    expires_in: 3600,
    token_type: "Bearer",
    scope: YOUTUBE_OAUTH_SCOPES.join(" "),
    ...overrides,
  };
}

function exchangeOptions(tokenPath, fetch) {
  return {
    code: "one-time-code",
    codeVerifier: "v".repeat(64),
    redirectUri: "http://127.0.0.1:49221/oauth2/callback",
    client: client(),
    expectedChannelId: EXPECTED_CHANNEL,
    tokenPath,
    fetch,
    now: () => FIXED_NOW,
    randomUUID: () => "fixed-temp-id",
  };
}

test("authorization request uses loopback PKCE, offline consent, and exact required scopes", () => {
  const request = createYouTubeAuthorizationRequest({
    clientId: "test-client.apps.googleusercontent.com",
    redirectUri: "http://127.0.0.1:49221/oauth2/callback",
    state: "fixed-state",
    codeVerifier: "v".repeat(64),
  });
  const url = new URL(request.authorizationUrl);
  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(url.searchParams.get("redirect_uri"), "http://127.0.0.1:49221/oauth2/callback");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.equal(url.searchParams.get("state"), "fixed-state");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.match(url.searchParams.get("code_challenge"), /^[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(url.searchParams.get("scope").split(" "), [...YOUTUBE_OAUTH_SCOPES]);
  assert.equal(url.searchParams.has("client_secret"), false);
});

test("exact production channel stores the offline grant atomically with mode 0600", async (t) => {
  const { tokenPath } = await fixture(t);
  const fetch = scriptedFetch([
    {
      assert(call) {
        assert.equal(call.url, "https://oauth2.googleapis.com/token");
        assert.equal(call.method, "POST");
        assert.equal(call.body.get("code_verifier"), "v".repeat(64));
        assert.equal(call.body.get("client_secret"), CLIENT_SECRET);
      },
      response: jsonResponse(tokenDocument()),
    },
    {
      assert(call) {
        const url = new URL(call.url);
        assert.equal(url.origin + url.pathname, "https://www.googleapis.com/youtube/v3/channels");
        assert.equal(url.searchParams.get("mine"), "true");
        assert.equal(call.headers.authorization, `Bearer ${ACCESS_TOKEN}`);
      },
      response: jsonResponse({ items: [{ id: EXPECTED_CHANNEL, snippet: { title: "Dr. M Experienced" } }] }),
    },
  ]);

  const result = await exchangeAndVerifyYouTubeGrant(exchangeOptions(tokenPath, fetch));

  assert.equal(result.channelId, EXPECTED_CHANNEL);
  const stored = JSON.parse(await fs.readFile(tokenPath, "utf8"));
  assert.equal(stored.access_token, ACCESS_TOKEN);
  assert.equal(stored.refresh_token, REFRESH_TOKEN);
  assert.equal(stored.verified_channel_id, EXPECTED_CHANNEL);
  assert.equal(stored.expiry_date, FIXED_NOW + 3_600_000);
  assert.equal((await fs.stat(tokenPath)).mode & 0o777, 0o600);
  assert.equal((await fs.stat(path.dirname(tokenPath))).mode & 0o777, 0o700);
  fetch.assertComplete();
});

test("wrong account revokes the new grant and preserves any prior verified token", async (t) => {
  const { tokenPath } = await fixture(t);
  await fs.mkdir(path.dirname(tokenPath), { recursive: true });
  await fs.writeFile(tokenPath, JSON.stringify({ stale: true }));
  const fetch = scriptedFetch([
    { response: jsonResponse(tokenDocument()) },
    { response: jsonResponse({ items: [{ id: OTHER_CHANNEL, snippet: { title: "Wrong channel" } }] }) },
    {
      assert(call) {
        assert.equal(call.url, "https://oauth2.googleapis.com/revoke");
        assert.equal(call.method, "POST");
        assert.equal(call.body.get("token"), REFRESH_TOKEN);
      },
      response: emptyResponse(),
    },
  ]);

  await assert.rejects(exchangeAndVerifyYouTubeGrant(exchangeOptions(tokenPath, fetch)), (error) => {
    assert.ok(error instanceof YouTubeOAuthError);
    assert.equal(error.code, "channel_mismatch");
    assert.deepEqual(error.evidence.observedChannelIds, [OTHER_CHANNEL]);
    assert.doesNotMatch(error.message, new RegExp(`${ACCESS_TOKEN}|${REFRESH_TOKEN}|${CLIENT_SECRET}`));
    return true;
  });
  assert.deepEqual(JSON.parse(await fs.readFile(tokenPath, "utf8")), { stale: true });
  fetch.assertComplete();
});

test("missing offline refresh access is revoked and never persisted", async (t) => {
  const { tokenPath } = await fixture(t);
  const fetch = scriptedFetch([
    { response: jsonResponse(tokenDocument({ refresh_token: undefined })) },
    {
      assert(call) {
        assert.equal(call.url, "https://oauth2.googleapis.com/revoke");
        assert.equal(call.body.get("token"), ACCESS_TOKEN);
      },
      response: emptyResponse(),
    },
  ]);

  await assert.rejects(
    exchangeAndVerifyYouTubeGrant(exchangeOptions(tokenPath, fetch)),
    (error) => error instanceof YouTubeOAuthError && error.code === "offline_access_missing",
  );
  await assert.rejects(fs.access(tokenPath), { code: "ENOENT" });
  fetch.assertComplete();
});

test("missing force-ssl scope is revoked before channel verification", async (t) => {
  const { tokenPath } = await fixture(t);
  const fetch = scriptedFetch([
    {
      response: jsonResponse(
        tokenDocument({ scope: "https://www.googleapis.com/auth/youtube.upload" }),
      ),
    },
    { response: emptyResponse() },
  ]);

  await assert.rejects(
    exchangeAndVerifyYouTubeGrant(exchangeOptions(tokenPath, fetch)),
    (error) => error instanceof YouTubeOAuthError && error.code === "oauth_scope_missing",
  );
  assert.equal(fetch.calls.length, 2);
  assert.equal(fetch.calls[1].url, "https://oauth2.googleapis.com/revoke");
  await assert.rejects(fs.access(tokenPath), { code: "ENOENT" });
  fetch.assertComplete();
});

test("CLI exposes the attended YouTube auth bootstrap without running it from help", () => {
  const cliPath = path.join(path.dirname(new URL(import.meta.url).pathname), "cli.mjs");
  const result = spawnSync(process.execPath, [cliPath, "--help"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /drm-publish auth youtube \[--timeout-seconds <seconds>\]/);
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(`${ACCESS_TOKEN}|${REFRESH_TOKEN}|${CLIENT_SECRET}`));
});
