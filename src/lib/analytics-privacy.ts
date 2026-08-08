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
const URL_PROPERTY = /(?:url|referrer)/i;

function normalizedPropertyKey(key: string): string {
  return key.toLowerCase().replace(/^\$/, "").replace(/^initial_/, "");
}

function isQueryDerivedProperty(key: string): boolean {
  const normalized = normalizedPropertyKey(key);
  return normalized.startsWith("utm_") ||
    QUERY_DERIVED_PROPERTIES.has(normalized);
}

function isSensitiveValueProperty(key: string): boolean {
  return SENSITIVE_VALUE_PROPERTIES.has(normalizedPropertyKey(key));
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
    if (isQueryDerivedProperty(key) || isSensitiveValueProperty(key)) continue;
    sanitized[key] = sanitizeAnalyticsValue(value, key);
  }

  return sanitized;
}
