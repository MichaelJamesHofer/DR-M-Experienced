import { sanitizeAnalyticsProperties } from "./analytics-privacy.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("removes URL queries, fragments, and campaign properties", () => {
  const sanitized = sanitizeAnalyticsProperties({
    $current_url:
      "https://drmexperienced.com/episodes/example/?email=test#details",
    $initial_current_url: "https://drmexperienced.com/?utm_source=newsletter",
    $utm_source: "newsletter",
    $initial_utm_campaign: "launch",
    $session_entry_utm_source: "newsletter",
    $initial_session_entry_utm_medium: "email",
    gclid: "tracking-id",
    $initial_fbclid: "tracking-id",
    $session_entry_gclid: "tracking-id",
    $session_entry_ph_keyword: "private search phrase",
    $referrer: "https://health.example/patients/private-path?source=search",
    $initial_referrer: "https://health.example/initial/private-path",
    $session_entry_referrer: "https://health.example/session/private-path",
    $referring_domain: "health.example",
    $initial_referring_domain: "health.example",
    $pathname: "/episodes/example/",
  });

  assert(
    sanitized.$current_url === "https://drmexperienced.com/episodes/example/",
    "current URL details were not removed",
  );
  assert(
    sanitized.$initial_current_url === "https://drmexperienced.com/",
    "initial URL details were not removed",
  );
  assert(!("$utm_source" in sanitized), "UTM property was retained");
  assert(
    !("$initial_utm_campaign" in sanitized),
    "initial UTM property was retained",
  );
  assert(
    !("$session_entry_utm_source" in sanitized),
    "session-entry UTM property was retained",
  );
  assert(
    !("$initial_session_entry_utm_medium" in sanitized),
    "nested attribution prefix was retained",
  );
  assert(!("gclid" in sanitized), "click identifier was retained");
  assert(
    !("$initial_fbclid" in sanitized),
    "initial click identifier was retained",
  );
  assert(
    !("$session_entry_gclid" in sanitized),
    "session-entry click identifier was retained",
  );
  assert(
    !("$session_entry_ph_keyword" in sanitized),
    "PostHog keyword attribution was retained",
  );
  assert(!("$referrer" in sanitized), "referrer path was retained");
  assert(
    !("$initial_referrer" in sanitized),
    "initial referrer path was retained",
  );
  assert(
    !("$session_entry_referrer" in sanitized),
    "session-entry referrer path was retained",
  );
  assert(
    !("$referring_domain" in sanitized),
    "referring domain was retained",
  );
  assert(
    !("$initial_referring_domain" in sanitized),
    "initial referring domain was retained",
  );
  assert(sanitized.$pathname === "/episodes/example/", "safe path was changed");
});

Deno.test("sanitizes nested objects and URL arrays without changing non-plain values", () => {
  const timestamp = new Date("2026-07-10T00:00:00Z");
  const sanitized = sanitizeAnalyticsProperties({
    nested: {
      referrer: "https://search.example/?q=medical",
      preferred_platform: "vimeo",
      utm_medium: "search",
    },
    related_urls: [
      "https://drmexperienced.com/?private=value",
      "https://drmexperienced.com/about/#bio",
    ],
    timestamp,
  });

  const nested = sanitized.nested as Record<string, unknown>;
  assert(!("referrer" in nested), "nested referrer was retained");
  assert(
    nested.preferred_platform === "vimeo",
    "unrelated preferred property was removed",
  );
  assert(!("utm_medium" in nested), "nested campaign property was retained");
  assert(
    JSON.stringify(sanitized.related_urls) ===
      JSON.stringify([
        "https://drmexperienced.com/",
        "https://drmexperienced.com/about/",
      ]),
    "URL array was not sanitized",
  );
  assert(sanitized.timestamp === timestamp, "non-plain object was changed");
});

Deno.test("removes common personal and free-text property values", () => {
  const sanitized = sanitizeAnalyticsProperties({
    email: "listener@example.com",
    $initial_email_address: "listener@example.com",
    full_name: "Example Listener",
    message: "Private health details",
    search_query: "private symptom search",
    nested: {
      phone_number: "555-0100",
      query: "private nested search",
      product_slug: "example-product",
    },
    subject: "podcast",
  });

  assert(!("email" in sanitized), "email was retained");
  assert(!("$initial_email_address" in sanitized), "initial email was retained");
  assert(!("full_name" in sanitized), "full name was retained");
  assert(!("message" in sanitized), "message was retained");
  assert(!("search_query" in sanitized), "search query was retained");

  const nested = sanitized.nested as Record<string, unknown>;
  assert(!("phone_number" in nested), "nested phone number was retained");
  assert(!("query" in nested), "nested query was retained");
  assert(nested.product_slug === "example-product", "safe nested slug was removed");
  assert(sanitized.subject === "podcast", "safe subject enum was removed");
});
