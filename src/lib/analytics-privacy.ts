export type AnalyticsProperties = Record<string, unknown>;

const QUERY_DERIVED_PROPERTIES = new Set([
  "_kx",
  "dclid",
  "epik",
  "fbclid",
  "gad_source",
  "gbraid",
  "gclid",
  "gclsrc",
  "igshid",
  "irclid",
  "li_fat_id",
  "mc_cid",
  "mc_eid",
  "msclkid",
  "ph_keyword",
  "qclid",
  "rdt_cid",
  "sccid",
  "ttclid",
  "twclid",
  "wbraid",
]);
const SENSITIVE_VALUE_PROPERTIES = new Set([
  "address",
  "body",
  "date_of_birth",
  "dob",
  "email",
  "email_address",
  "first_name",
  "full_name",
  "last_name",
  "message",
  "name",
  "phone",
  "phone_number",
  "query",
  "search_query",
  "search_term",
]);
const REFERRER_PROPERTIES = new Set([
  "referrer",
  "referring_domain",
]);
const URL_PROPERTY = /url|^(?:href|src|srcset)$/i;
const KNOWN_REFERRERS = new Set([
  "google.com",
  "bing.com",
  "duckduckgo.com",
  "search.yahoo.com",
  "youtube.com",
  "youtu.be",
  "instagram.com",
  "l.instagram.com",
  "facebook.com",
  "l.facebook.com",
  "lm.facebook.com",
  "m.facebook.com",
  "tiktok.com",
  "t.co",
  "x.com",
  "twitter.com",
  "vimeo.com",
  "open.spotify.com",
  "podcasts.apple.com",
  "rumble.com",
  "drmexperienced.com",
]);
const SAFE_CAMPAIGNS: Record<string, Set<string>> = {
  utm_source: new Set([
    "google",
    "bing",
    "youtube",
    "instagram",
    "facebook",
    "tiktok",
    "spotify",
    "apple",
    "vimeo",
    "rumble",
    "newsletter",
    "email",
    "x",
    "twitter",
  ]),
  utm_medium: new Set([
    "organic",
    "social",
    "paid_social",
    "email",
    "referral",
    "video",
    "cpc",
    "paid",
  ]),
};

function safeAttribution(key: string, value: unknown): string | undefined {
  if (typeof value !== "string") return;
  const normalized = normalizedPropertyKey(key);
  if (SAFE_CAMPAIGNS[normalized]) {
    const label = value.toLowerCase();
    return SAFE_CAMPAIGNS[normalized].has(label) ? label : undefined;
  }
  if (!isReferrerProperty(key)) return;
  if (value === "$direct") return value;
  try {
    const url = new URL(
      normalized === "referring_domain" ? `https://${value}` : value,
    );
    if (
      !/^https?:$/.test(url.protocol) ||
      !KNOWN_REFERRERS.has(url.hostname.replace(/^www\./, ""))
    ) return;
    return normalized === "referring_domain" ? url.hostname : `${url.origin}/`;
  } catch {
    return;
  }
}

function normalizedPropertyKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/^\$/, "")
    .replace(/^(?:(?:initial|session_entry)_)+/, "");
}

function isQueryDerivedProperty(key: string): boolean {
  const normalized = normalizedPropertyKey(key);
  return normalized.startsWith("utm_") ||
    QUERY_DERIVED_PROPERTIES.has(normalized);
}

function isSensitiveValueProperty(key: string): boolean {
  return SENSITIVE_VALUE_PROPERTIES.has(normalizedPropertyKey(key));
}

function isReferrerProperty(key: string): boolean {
  return REFERRER_PROPERTIES.has(normalizedPropertyKey(key));
}

function isRecord(value: unknown): value is AnalyticsProperties {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sanitizeAnalyticsValue(value: unknown, key: string): unknown {
  if (typeof value === "string") {
    return URL_PROPERTY.test(key) ? value.replace(/[?#].*$/, "") : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAnalyticsValue(item, key));
  }
  return isRecord(value) ? sanitizeAnalyticsProperties(value) : value;
}

export function sanitizeAnalyticsProperties(
  properties: AnalyticsProperties,
): AnalyticsProperties {
  const sanitized: AnalyticsProperties = {};

  for (const [key, value] of Object.entries(properties)) {
    if (isReferrerProperty(key) || isQueryDerivedProperty(key)) {
      const attribution = safeAttribution(key, value);
      if (attribution !== undefined) sanitized[key] = attribution;
      continue;
    }
    if (isSensitiveValueProperty(key)) continue;
    sanitized[key] = key === "$snapshot_data"
      ? sanitizeReplaySnapshot(value)
      : sanitizeAnalyticsValue(value, key);
  }

  return sanitized;
}

// rrweb snapshots need their own guard: DOM URL attributes do not use SDK property names.
export function sanitizeReplaySnapshot(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeReplaySnapshot);
  if (!isRecord(value)) return value;
  const result: AnalyticsProperties = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === "attributes" && isRecord(item)) {
      const attributes: AnalyticsProperties = {};
      for (const [attribute, content] of Object.entries(item)) {
        if (
          /^(?:value|placeholder|title|alt|aria-label|aria-valuetext|data-)/i
            .test(attribute)
        ) continue;
        if (
          /^(?:href|xlink:href|src|srcset|action|formaction)$/i.test(
            attribute,
          ) &&
          typeof content === "string"
        ) {
          if (/^(?:mailto|tel|data|javascript):/i.test(content)) continue;
          attributes[attribute] = content.replace(/[?#].*$/, "");
        } else attributes[attribute] = content;
      }
      result[key] = attributes;
    } else if (key === "href" && typeof item === "string") {
      result[key] = item.replace(/[?#].*$/, "");
    } else result[key] = sanitizeReplaySnapshot(item);
  }
  return result;
}
