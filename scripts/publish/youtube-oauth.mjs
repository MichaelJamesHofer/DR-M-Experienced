import { createHash, randomBytes, randomUUID as nodeRandomUUID } from "node:crypto";
import fsPromises from "node:fs/promises";
import http from "node:http";
import path from "node:path";

import { resolveYouTubeCredentialPaths } from "./adapters/youtube.mjs";
import { SecureCredentialError, readSecureCredentialText } from "./secure-credential.mjs";

const DEFAULT_AUTH_URI = "https://accounts.google.com/o/oauth2/v2/auth";
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
const REVOKE_URI = "https://oauth2.googleapis.com/revoke";
const CHANNELS_URI = "https://www.googleapis.com/youtube/v3/channels";
const CALLBACK_PATH = "/oauth2/callback";
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

export const YOUTUBE_OAUTH_SCOPES = Object.freeze([
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.force-ssl",
]);

export class YouTubeOAuthError extends Error {
  constructor(code, message, evidence = null) {
    super(message);
    this.name = "YouTubeOAuthError";
    this.code = code;
    this.evidence = evidence;
  }
}

function cleanString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function base64Url(buffer) {
  return buffer.toString("base64url");
}

function officialHttpsUri(value, fallback, allowedHosts, label) {
  let uri;
  try {
    uri = new URL(cleanString(value) ?? fallback);
  } catch {
    throw new YouTubeOAuthError("oauth_client_invalid", `${label} is invalid.`);
  }
  if (uri.protocol !== "https:" || !allowedHosts.has(uri.hostname)) {
    throw new YouTubeOAuthError("oauth_client_invalid", `${label} must use an official Google HTTPS endpoint.`);
  }
  return uri.toString();
}

async function readDesktopClient(fs, clientSecretPath) {
  let text;
  try {
    text = await readSecureCredentialText(clientSecretPath, { fsImpl: fs });
  } catch (error) {
    if (error instanceof SecureCredentialError && error.code === "credential_missing") {
      throw new YouTubeOAuthError(
        "oauth_client_missing",
        `YouTube desktop OAuth credentials were not found at ${clientSecretPath}.`,
      );
    }
    if (error instanceof SecureCredentialError) {
      throw new YouTubeOAuthError(
        "oauth_client_insecure",
        "The YouTube desktop OAuth credential must be a non-symlink regular file owned by the current user with mode 0600.",
      );
    }
    throw new YouTubeOAuthError("oauth_client_unreadable", "The YouTube desktop OAuth credential file could not be read securely.");
  }
  let document;
  try {
    document = JSON.parse(text);
  } catch {
    throw new YouTubeOAuthError("oauth_client_invalid", "The YouTube desktop OAuth credential file is not valid JSON.");
  }
  const installed = document?.installed;
  const clientId = cleanString(installed?.client_id);
  const clientSecret = cleanString(installed?.client_secret);
  if (!clientId || !clientSecret) {
    throw new YouTubeOAuthError(
      "oauth_client_invalid",
      "The YouTube OAuth credential must be a Desktop app client with installed.client_id and installed.client_secret.",
    );
  }
  return {
    clientId,
    clientSecret,
    authUri: officialHttpsUri(
      installed.auth_uri,
      DEFAULT_AUTH_URI,
      new Set(["accounts.google.com"]),
      "The OAuth authorization URI",
    ),
    tokenUri: officialHttpsUri(
      installed.token_uri,
      DEFAULT_TOKEN_URI,
      new Set(["oauth2.googleapis.com", "www.googleapis.com"]),
      "The OAuth token URI",
    ),
  };
}

async function readTargetChannelId(fs, platformsPath) {
  let platforms;
  try {
    platforms = JSON.parse(await fs.readFile(platformsPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new YouTubeOAuthError("platform_config_missing", `Publishing platform configuration was not found at ${platformsPath}.`);
    }
    throw new YouTubeOAuthError("platform_config_invalid", "Publishing platform configuration is not valid JSON.");
  }
  const channelId = cleanString(platforms?.platforms?.youtube?.destinationIds?.accountId);
  if (!channelId || !/^UC[A-Za-z0-9_-]{20,}$/.test(channelId)) {
    throw new YouTubeOAuthError(
      "target_channel_invalid",
      "publishing/platforms.json does not contain a valid YouTube destination accountId.",
    );
  }
  return channelId;
}

async function responseJson(response, code, message) {
  let document;
  try {
    document = await response.json();
  } catch {
    throw new YouTubeOAuthError(code, message);
  }
  if (!response.ok) throw new YouTubeOAuthError(code, `${message} HTTP ${response.status}.`);
  return document;
}

async function revokeGrant(fetch, token) {
  if (!cleanString(token)) return false;
  try {
    const response = await fetch(REVOKE_URI, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function writePrivateToken(fs, tokenPath, token, randomUUID) {
  const directory = path.dirname(tokenPath);
  const temporaryPath = path.join(directory, `.${path.basename(tokenPath)}.${randomUUID()}.tmp`);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.chmod(directory, 0o700);
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(token, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await fs.chmod(temporaryPath, 0o600);
    await fs.rename(temporaryPath, tokenPath);
    await fs.chmod(tokenPath, 0o600);
  } catch (error) {
    await fs.unlink(temporaryPath).catch(() => {});
    throw new YouTubeOAuthError("oauth_token_persist_failed", "The verified YouTube OAuth token could not be saved securely.");
  }
}

function grantedScopes(tokenDocument) {
  if (Array.isArray(tokenDocument?.scope)) return tokenDocument.scope.filter((scope) => typeof scope === "string");
  return typeof tokenDocument?.scope === "string" ? tokenDocument.scope.split(/\s+/).filter(Boolean) : [];
}

export function createYouTubeAuthorizationRequest({
  clientId,
  authUri = DEFAULT_AUTH_URI,
  redirectUri,
  state = base64Url(randomBytes(32)),
  codeVerifier = base64Url(randomBytes(64)),
} = {}) {
  if (!cleanString(clientId) || !cleanString(redirectUri)) {
    throw new YouTubeOAuthError("oauth_request_invalid", "OAuth client ID and loopback redirect URI are required.");
  }
  if (codeVerifier.length < 43 || codeVerifier.length > 128) {
    throw new YouTubeOAuthError("oauth_request_invalid", "The PKCE verifier must be between 43 and 128 characters.");
  }
  const codeChallenge = base64Url(createHash("sha256").update(codeVerifier).digest());
  const url = new URL(authUri);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: YOUTUBE_OAUTH_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  }).toString();
  return Object.freeze({ authorizationUrl: url.toString(), state, codeVerifier, codeChallenge, redirectUri });
}

export async function exchangeAndVerifyYouTubeGrant({
  code,
  codeVerifier,
  redirectUri,
  client,
  expectedChannelId,
  tokenPath,
  fetch = globalThis.fetch,
  fs = fsPromises,
  now = Date.now,
  randomUUID = nodeRandomUUID,
}) {
  if (!cleanString(code)) throw new YouTubeOAuthError("authorization_code_missing", "Google returned no authorization code.");
  const tokenResponse = await fetch(client.tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: client.clientId,
      client_secret: client.clientSecret,
      code,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  const tokenDocument = await responseJson(tokenResponse, "oauth_exchange_failed", "Google OAuth token exchange failed.");
  const accessToken = cleanString(tokenDocument?.access_token);
  const refreshToken = cleanString(tokenDocument?.refresh_token);
  const revocationToken = refreshToken ?? accessToken;

  try {
    if (!accessToken || !refreshToken) {
      throw new YouTubeOAuthError(
        "offline_access_missing",
        "Google did not return an offline refresh credential. Reauthorize with the owner account and grant consent.",
      );
    }
    const scopes = grantedScopes(tokenDocument);
    const missingScopes = YOUTUBE_OAUTH_SCOPES.filter((scope) => !scopes.includes(scope));
    if (missingScopes.length) {
      throw new YouTubeOAuthError(
        "oauth_scope_missing",
        "The OAuth grant did not include every required YouTube publishing scope.",
      );
    }

    const channelsUrl = new URL(CHANNELS_URI);
    channelsUrl.search = new URLSearchParams({ part: "id,snippet", mine: "true" }).toString();
    const channelResponse = await fetch(channelsUrl, {
      headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
    });
    const channelDocument = await responseJson(
      channelResponse,
      "channel_verification_failed",
      "Authenticated YouTube channel verification failed.",
    );
    const channels = Array.isArray(channelDocument?.items) ? channelDocument.items : [];
    const observedIds = channels.map((channel) => cleanString(channel?.id)).filter(Boolean);
    if (observedIds.length !== 1 || observedIds[0] !== expectedChannelId) {
      throw new YouTubeOAuthError(
        "channel_mismatch",
        `Authenticated channel does not match the configured production channel ${expectedChannelId}. No credential was retained.`,
        { expectedChannelId, observedChannelIds: observedIds },
      );
    }

    const expiresIn = Number(tokenDocument.expires_in);
    const storedToken = {
      ...tokenDocument,
      access_token: accessToken,
      refresh_token: refreshToken,
      scope: scopes.join(" "),
      expiry_date: Number.isFinite(expiresIn) ? now() + expiresIn * 1000 : null,
      verified_channel_id: expectedChannelId,
      verified_channel_title: cleanString(channels[0]?.snippet?.title),
      verified_at: new Date(now()).toISOString(),
    };
    await writePrivateToken(fs, tokenPath, storedToken, randomUUID);
    return Object.freeze({
      channelId: expectedChannelId,
      channelTitle: storedToken.verified_channel_title,
      tokenPath,
      scopes: [...scopes],
    });
  } catch (error) {
    await revokeGrant(fetch, revocationToken);
    throw error;
  }
}

function callbackResult(server, timeoutMs, expectedState) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close();
      reject(new YouTubeOAuthError("oauth_timeout", "Timed out waiting for Google's local OAuth callback."));
    }, timeoutMs);
    timer.unref?.();

    server.on("request", (request, response) => {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      if (requestUrl.pathname !== CALLBACK_PATH) {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("Not found.\n");
        return;
      }
      const state = requestUrl.searchParams.get("state");
      const code = requestUrl.searchParams.get("code");
      const oauthError = requestUrl.searchParams.get("error");
      if (state !== expectedState) {
        response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
        response.end("Authorization state mismatch. Return to the terminal.\n");
        clearTimeout(timer);
        server.close();
        reject(new YouTubeOAuthError("oauth_state_mismatch", "Google OAuth callback state did not match."));
        return;
      }
      if (oauthError || !code) {
        response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
        response.end("Authorization was not completed. Return to the terminal.\n");
        clearTimeout(timer);
        server.close();
        reject(new YouTubeOAuthError("oauth_denied", "Google OAuth authorization was denied or incomplete."));
        return;
      }
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end("Authorization received. Return to the terminal for channel verification.\n");
      clearTimeout(timer);
      server.close();
      resolve(code);
    });
    server.on("error", (error) => {
      clearTimeout(timer);
      reject(new YouTubeOAuthError("loopback_server_failed", `The local OAuth callback server failed: ${error.message}`));
    });
  });
}

export async function authorizeYouTubeOwner({
  platformsPath,
  credentialPaths = resolveYouTubeCredentialPaths(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetch = globalThis.fetch,
  fs = fsPromises,
  createServer = http.createServer,
  output = process.stdout,
  now = Date.now,
  randomUUID = nodeRandomUUID,
} = {}) {
  const [client, expectedChannelId] = await Promise.all([
    readDesktopClient(fs, credentialPaths.clientSecretPath),
    readTargetChannelId(fs, platformsPath),
  ]);
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new YouTubeOAuthError("loopback_server_failed", "The local OAuth callback server did not provide a TCP port.");
  }
  const redirectUri = `http://127.0.0.1:${address.port}${CALLBACK_PATH}`;
  const request = createYouTubeAuthorizationRequest({ clientId: client.clientId, authUri: client.authUri, redirectUri });
  output.write(
    `Authorize YouTube using the Google account that OWNS channel ${expectedChannelId}.\n` +
      `A Manager invitation cannot authorize YouTube API uploads for this channel.\n` +
      `Open this official Google URL in the owner account's browser profile:\n${request.authorizationUrl}\n\n` +
      `Waiting up to ${Math.ceil(timeoutMs / 1000)} seconds for the local callback...\n`,
  );
  const code = await callbackResult(server, timeoutMs, request.state);
  const result = await exchangeAndVerifyYouTubeGrant({
    code,
    codeVerifier: request.codeVerifier,
    redirectUri,
    client,
    expectedChannelId,
    tokenPath: credentialPaths.tokenPath,
    fetch,
    fs,
    now,
    randomUUID,
  });
  output.write(`Verified the configured production channel ${result.channelId}. OAuth token saved privately.\n`);
  return result;
}
