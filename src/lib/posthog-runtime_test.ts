import {
  buildPathOnlyPageviewUrl,
  POSTHOG_PRIVACY_OPTIONS,
  resolvePostHogRuntimeConfig,
} from "./posthog-runtime.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("analytics stays disabled until a project token is configured", () => {
  assert(
    resolvePostHogRuntimeConfig({}) === null,
    "empty configuration enabled analytics",
  );
  assert(
    resolvePostHogRuntimeConfig({
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "   ",
    }) === null,
    "blank project token enabled analytics",
  );
});

Deno.test("runtime configuration prefers the project token and uses a bounded host default", () => {
  const current = resolvePostHogRuntimeConfig({
    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "project-token",
    NEXT_PUBLIC_POSTHOG_API_KEY: "legacy-token",
  });
  assert(
    current?.projectToken === "project-token",
    "legacy token took precedence",
  );
  assert(
    current.apiHost === "https://us.i.posthog.com",
    "default host changed",
  );

  const legacy = resolvePostHogRuntimeConfig({
    NEXT_PUBLIC_POSTHOG_API_KEY: "legacy-token",
    NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
  });
  assert(
    legacy?.projectToken === "legacy-token",
    "legacy fallback was not retained",
  );
  assert(
    legacy.apiHost === "https://eu.i.posthog.com",
    "configured host was ignored",
  );
});

Deno.test("masked replay keeps unrelated collection disabled", () => {
  assert(
    POSTHOG_PRIVACY_OPTIONS.autocapture === false,
    "autocapture was enabled",
  );
  assert(
    POSTHOG_PRIVACY_OPTIONS.capture_pageview === false,
    "automatic pageviews were enabled",
  );
  assert(
    POSTHOG_PRIVACY_OPTIONS.capture_pageleave,
    "pageleave capture was disabled",
  );
  assert(
    POSTHOG_PRIVACY_OPTIONS.capture_performance === false,
    "performance capture was enabled",
  );
  assert(
    !POSTHOG_PRIVACY_OPTIONS.disable_session_recording,
    "session recording stayed disabled",
  );
  assert(POSTHOG_PRIVACY_OPTIONS.disable_surveys, "surveys were enabled");
  assert(
    POSTHOG_PRIVACY_OPTIONS.disable_web_experiments,
    "web experiments were enabled",
  );
  assert(
    POSTHOG_PRIVACY_OPTIONS.disable_external_dependency_loading,
    "external dependency loading was enabled",
  );
  assert(
    POSTHOG_PRIVACY_OPTIONS.person_profiles === "never",
    "person profiles were enabled",
  );
  assert(
    POSTHOG_PRIVACY_OPTIONS.persistence === "sessionStorage",
    "tab-scoped storage changed",
  );
  assert(
    !POSTHOG_PRIVACY_OPTIONS.advanced_disable_flags,
    "replay remote config was blocked",
  );
  assert(
    POSTHOG_PRIVACY_OPTIONS.advanced_disable_feature_flags,
    "feature flag evaluation was enabled",
  );
  const recording = POSTHOG_PRIVACY_OPTIONS.session_recording;
  assert(
    recording.maskAllInputs && recording.maskTextSelector === "*",
    "replay masking was weakened",
  );
  assert(
    recording.blockSelector.includes("form") &&
      recording.blockSelector.includes("iframe"),
    "private surfaces are not blocked",
  );
  assert(
    recording.maskCapturedNetworkRequestFn({
      name: "https://drmexperienced.com/?private=secret#notes",
    })?.name === "https://drmexperienced.com/",
    "replay URL leaked query data",
  );
  assert(
    recording.maskCapturedNetworkRequestFn({
      name: "https://example.com/",
      requestBody: "private",
    }) === null,
    "network payload was recorded",
  );
  assert(
    POSTHOG_PRIVACY_OPTIONS.respect_dnt,
    "Do Not Track support was disabled",
  );
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
