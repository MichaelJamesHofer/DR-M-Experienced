import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type FormType = "contact" | "newsletter";

type SubmitPayload = {
  type?: FormType;
  website?: string;
  page_url?: string | null;
  user_agent?: string | null;
  email?: string;
  source?: string;
  name?: string;
  subject?: string;
  message?: string;
  consent?: boolean;
};

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "https://tdbsuzciwotleualdcjf.supabase.co";
const ALLOWED_ORIGINS = new Set([
  "https://drmexperienced.com",
  "https://www.drmexperienced.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);
const SUBJECTS = new Set(["podcast", "business", "press", "other"]);
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
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
const RATE_LIMIT_SECRET =
  Deno.env.get("FORM_RATE_LIMIT_SECRET") || SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin");
  const allowedOrigin =
    origin && ALLOWED_ORIGINS.has(origin)
      ? origin
      : "https://drmexperienced.com";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

function json(
  request: Request,
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(request),
  });
}

function sanitizeText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function nullableText(value: unknown, maxLength: number): string | null {
  const sanitized = sanitizeText(value, maxLength);
  return sanitized || null;
}

function normalizeEmail(value: unknown): string {
  return sanitizeText(value, 255).toLowerCase();
}

function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email) && email.length <= 255;
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
  action: FormType,
  email: string,
): Promise<boolean> {
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || "unknown";
  const ipKey = ip === "unknown" ? `ua:${userAgent.slice(0, 120)}` : `ip:${ip}`;
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  if (action === "contact") {
    const ipCount = await incrementRateLimit("contact-ip-hour", [ipKey], hour);
    const emailCount = await incrementRateLimit("contact-email-hour", [email], hour);
    const dayCount = await incrementRateLimit("contact-ip-day", [ipKey], day);
    return ipCount <= 10 && emailCount <= 3 && dayCount <= 50;
  }

  const ipCount = await incrementRateLimit("newsletter-ip-hour", [ipKey], hour);
  const emailCount = await incrementRateLimit("newsletter-email-day", [email], day);
  return ipCount <= 30 && emailCount <= 5;
}

async function readPayload(request: Request): Promise<SubmitPayload> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    throw new Error("Request body too large");
  }

  return JSON.parse(text) as SubmitPayload;
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

  if (!SUPABASE_SERVICE_KEY || !RATE_LIMIT_SECRET) {
    console.error("Missing Supabase service credentials");
    return json(request, { error: "Form service unavailable" }, 503);
  }

  let payload: SubmitPayload;
  try {
    payload = await readPayload(request);
  } catch {
    return json(request, { error: "Invalid request" }, 400);
  }

  if (sanitizeText(payload.website, 200)) {
    return json(request, { ok: true });
  }

  const type = payload.type;
  const email = normalizeEmail(payload.email);
  if ((type !== "contact" && type !== "newsletter") || !isValidEmail(email)) {
    return json(request, { error: "Invalid request" }, 400);
  }

  try {
    const allowed = await enforceRateLimit(request, type, email);
    if (!allowed) {
      return json(
        request,
        { error: "Too many submissions. Please try again later." },
        429,
      );
    }

    if (type === "newsletter") {
      const { error } = await supabase.from("newsletter_subscriptions").insert({
        email,
        source: sanitizeText(payload.source, 50) || "unknown",
        page_url: nullableText(payload.page_url, 1000),
        user_agent: nullableText(payload.user_agent, 500),
      });

      if (error && error.code !== "23505") {
        throw error;
      }

      return json(request, { ok: true });
    }

    const name = sanitizeText(payload.name, 200);
    const subject = sanitizeText(payload.subject, 200);
    const message = sanitizeText(payload.message, 5000);

    if (
      !payload.consent ||
      !name ||
      !message ||
      !SUBJECTS.has(subject)
    ) {
      return json(request, { error: "Invalid request" }, 400);
    }

    const { error } = await supabase.from("contact_messages").insert({
      name,
      email,
      subject,
      message,
      page_url: nullableText(payload.page_url, 1000),
      user_agent: nullableText(payload.user_agent, 500),
    });

    if (error) throw error;

    return json(request, { ok: true });
  } catch (error) {
    console.error("Form submission failed", error);
    return json(request, { error: "Form submission failed" }, 500);
  }
});
