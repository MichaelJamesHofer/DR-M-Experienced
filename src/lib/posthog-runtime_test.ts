import {
  buildPathOnlyPageviewUrl,
  POSTHOG_PRIVACY_OPTIONS,
  resolvePostHogRuntimeConfig,
} from "./posthog-runtime.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("analytics stays disabled until a project token is configured", () => {
  assert(resolvePostHogRuntimeConfig({}) === null, "empty configuration enabled analytics");
  assert(
    resolvePostHogRuntimeConfig({ NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "   " }) === null,
    "blank project token enabled analytics",
  );
});

Deno.test("runtime configuration prefers the project token and uses a bounded host default", () => {
  const current = resolvePostHogRuntimeConfig({
    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "project-token",
    NEXT_PUBLIC_POSTHOG_API_KEY: "legacy-token",
  });
  assert(current?.projectToken === "project-token", "legacy token took precedence");
  assert(current.apiHost === "https://us.i.posthog.com", "default host changed");

  const legacy = resolvePostHogRuntimeConfig({
    NEXT_PUBLIC_POSTHOG_API_KEY: "legacy-token",
    NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
  });
  assert(legacy?.projectToken === "legacy-token", "legacy fallback was not retained");
  assert(legacy.apiHost === "https://eu.i.posthog.com", "configured host was ignored");
});

Deno.test("privacy-sensitive PostHog collection remains explicitly disabled", () => {
  assert(POSTHOG_PRIVACY_OPTIONS.autocapture === false, "autocapture was enabled");
  assert(POSTHOG_PRIVACY_OPTIONS.capture_pageview === false, "automatic pageviews were enabled");
  assert(POSTHOG_PRIVACY_OPTIONS.capture_performance === false, "performance capture was enabled");
  assert(POSTHOG_PRIVACY_OPTIONS.disable_session_recording, "session recording was enabled");
  assert(POSTHOG_PRIVACY_OPTIONS.disable_surveys, "surveys were enabled");
  assert(POSTHOG_PRIVACY_OPTIONS.disable_web_experiments, "web experiments were enabled");
  assert(
    POSTHOG_PRIVACY_OPTIONS.disable_external_dependency_loading,
    "external dependency loading was enabled",
  );
  assert(POSTHOG_PRIVACY_OPTIONS.person_profiles === "never", "person profiles were enabled");
  assert(POSTHOG_PRIVACY_OPTIONS.persistence === "memory", "persistent storage was enabled");
  assert(POSTHOG_PRIVACY_OPTIONS.respect_dnt, "Do Not Track support was disabled");
});

Deno.test("manual pageview URLs retain only the site origin and path", () => {
  assert(
    buildPathOnlyPageviewUrl(
      "https://drmexperienced.com",
      "/episodes/example/?email=private#notes",
    ) === "https://drmexperienced.com/episodes/example/",
    "query or fragment was retained",
  );
  assert(
    buildPathOnlyPageviewUrl(
      "https://drmexperienced.com",
      "https://outside.example/private?token=secret",
    ) === "https://drmexperienced.com/private",
    "pageview escaped the site origin",
  );
});
