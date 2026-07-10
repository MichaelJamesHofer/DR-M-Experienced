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
    gclid: "tracking-id",
    $initial_fbclid: "tracking-id",
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
  assert(!("gclid" in sanitized), "click identifier was retained");
  assert(
    !("$initial_fbclid" in sanitized),
    "initial click identifier was retained",
  );
  assert(sanitized.$pathname === "/episodes/example/", "safe path was changed");
});

Deno.test("sanitizes nested objects and URL arrays without changing non-plain values", () => {
  const timestamp = new Date("2026-07-10T00:00:00Z");
  const sanitized = sanitizeAnalyticsProperties({
    nested: {
      referrer: "https://search.example/?q=medical",
      utm_medium: "search",
    },
    related_urls: [
      "https://drmexperienced.com/?private=value",
      "https://drmexperienced.com/about/#bio",
    ],
    timestamp,
  });

  const nested = sanitized.nested as Record<string, unknown>;
  assert(
    nested.referrer === "https://search.example/",
    "nested referrer was not sanitized",
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
