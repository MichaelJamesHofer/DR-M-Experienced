import { createClient } from "@supabase/supabase-js";
import { readJsonBody } from "./request-body.ts";
import { parseSubmission, type ValidSubmission } from "./validation.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ??
  "https://tdbsuzciwotleualdcjf.supabase.co";
const ALLOWED_ORIGINS = new Set([
  "https://drmexperienced.com",
  "https://www.drmexperienced.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);
const MAX_BODY_BYTES = 12_000;

function getSecretKey(): string {
  const legacyServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacyServiceRoleKey) return legacyServiceRoleKey;

  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!secretKeys) return "";

  try {
    const parsed = JSON.parse(secretKeys);
    return parsed.default ?? "";
  } catch {
    return "";
  }
}

const SUPABASE_SERVICE_KEY = getSecretKey();
const RATE_LIMIT_SECRET = Deno.env.get("FORM_RATE_LIMIT_SECRET") ||
  SUPABASE_SERVICE_KEY;

const supabase = SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
  : null;

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin");
  const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin)
    ? origin
    : "https://drmexperienced.com";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Origin",
  };
}

function json(
  request: Request,
  body: Record<string, unknown>,
  status = 200,
  extraHeaders: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), ...extraHeaders },
  });
}

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function getBucketStart(bucketMs: number): string {
  return new Date(Math.floor(Date.now() / bucketMs) * bucketMs).toISOString();
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${RATE_LIMIT_SECRET}:${value}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function incrementRateLimit(
  action: string,
  keyParts: string[],
  bucketMs: number,
): Promise<number> {
  if (!supabase) throw new Error("Form service unavailable");

  const keyHash = await sha256(`${action}:${keyParts.join(":")}`);
  const { data, error } = await supabase.rpc("increment_form_rate_limit", {
    p_action: action,
    p_key_hash: keyHash,
    p_bucket_start: getBucketStart(bucketMs),
  });

  if (error) {
    console.error("Rate limit increment failed", error);
    throw new Error("Rate limit unavailable");
  }

  return Number(data || 0);
}

async function enforceRateLimit(
  request: Request,
  submission: ValidSubmission,
): Promise<boolean> {
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || "unknown";
  const ipKey = ip === "unknown" ? `ua:${userAgent.slice(0, 120)}` : `ip:${ip}`;
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  if (submission.type === "contact") {
    const ipCount = await incrementRateLimit("contact-ip-hour", [ipKey], hour);
    if (ipCount > 10) return false;

    const dayCount = await incrementRateLimit("contact-ip-day", [ipKey], day);
    if (dayCount > 50) return false;

    const emailIpCount = await incrementRateLimit(
      "contact-email-ip-hour",
      [submission.email, ipKey],
      hour,
    );
    const emailDayCount = await incrementRateLimit(
      "contact-email-day",
      [submission.email],
      day,
    );
    return emailIpCount <= 3 && emailDayCount <= 20;
  }

  const ipCount = await incrementRateLimit("newsletter-ip-hour", [ipKey], hour);
  if (ipCount > 30) return false;

  const emailCount = await incrementRateLimit(
    "newsletter-email-day",
    [submission.email],
    day,
  );
  return emailCount <= 5;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) });
  }

  if (request.method !== "POST") {
    return json(request, { error: "Method not allowed" }, 405);
  }

  const origin = request.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json(request, { error: "Forbidden" }, 403);
  }

  if (!supabase || !RATE_LIMIT_SECRET) {
    console.error("Missing Supabase service credentials");
    return json(request, { error: "Form service unavailable" }, 503);
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const mediaType = contentType.split(";", 1)[0]?.trim();
  if (mediaType !== "application/json") {
    return json(
      request,
      { error: "Content type must be application/json" },
      415,
    );
  }

  let payload: unknown;
  try {
    payload = await readJsonBody(request, MAX_BODY_BYTES);
  } catch {
    return json(request, { error: "Invalid request" }, 400);
  }

  const parsed = parseSubmission(payload);
  if (parsed.kind === "honeypot") {
    return json(request, { ok: true });
  }
  if (parsed.kind === "invalid") {
    return json(request, { error: "Invalid request" }, 400);
  }

  const submission = parsed.submission;

  try {
    const allowed = await enforceRateLimit(request, submission);
    if (!allowed) {
      return json(
        request,
        { error: "Too many submissions. Please try again later." },
        429,
        { "Retry-After": "3600" },
      );
    }

    if (submission.type === "newsletter") {
      const { error } = await supabase.from("newsletter_subscriptions").insert({
        email: submission.email,
        source: submission.source,
        page_url: submission.pageUrl,
        user_agent: submission.userAgent,
      });

      if (error && error.code !== "23505") {
        throw error;
      }

      return json(request, { ok: true });
    }

    const { error } = await supabase.from("contact_messages").insert({
      name: submission.name,
      email: submission.email,
      subject: submission.subject,
      message: submission.message,
      page_url: submission.pageUrl,
      user_agent: submission.userAgent,
    });

    if (error) throw error;

    return json(request, { ok: true });
  } catch (error) {
    console.error("Form submission failed", error);
    return json(request, { error: "Form submission failed" }, 500);
  }
});
