export type PostHogPublicEnvironment = {
  NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?: string;
  NEXT_PUBLIC_POSTHOG_API_KEY?: string;
  NEXT_PUBLIC_POSTHOG_HOST?: string;
};

export const POSTHOG_PRIVACY_OPTIONS = {
  autocapture: false,
  capture_pageview: false,
  capture_pageleave: true,
  capture_performance: false,
  disable_session_recording: false,
  disable_surveys: true,
  disable_product_tours: true,
  disable_conversations: true,
  disable_web_experiments: true,
  disable_external_dependency_loading: true,
  person_profiles: "never",
  persistence: "sessionStorage",
  respect_dnt: true,
  advanced_disable_flags: false,
  advanced_disable_feature_flags: true,
  enable_recording_console_log: false,
  capture_exceptions: false,
  capture_heatmaps: false,
  capture_dead_clicks: false,
  session_recording: {
    maskAllInputs: true,
    maskTextSelector: "*",
    blockSelector:
      "form, input, textarea, select, iframe, img, video, canvas, [contenteditable], [data-private]",
    recordCrossOriginIframes: false,
    recordHeaders: false,
    recordBody: false,
    captureCanvas: { recordCanvas: false },
    // Keep snapshots inspectable by the outbound privacy guard before request compression.
    compress_events: false,
    slimDOMOptions: "all",
    maskCapturedNetworkRequestFn: <Request extends { name: string }>(
      request: Request,
    ): Request | null => {
      // The recorder also uses this hook for its path-only page metadata.
      if (Object.keys(request).some((key) => key !== "name")) return null;
      return { ...request, name: request.name.replace(/[?#].*$/, "") };
    },
  },
} as const;

export function resolvePostHogRuntimeConfig(env: PostHogPublicEnvironment) {
  const projectToken = env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() ||
    env.NEXT_PUBLIC_POSTHOG_API_KEY?.trim();

  if (!projectToken) return null;

  return {
    projectToken,
    apiHost: env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com",
  };
}

export function buildPathOnlyPageviewUrl(origin: string, pathname: string) {
  const siteOrigin = new URL(origin).origin;
  const resolvedPath = new URL(pathname, `${siteOrigin}/`).pathname;
  return `${siteOrigin}${resolvedPath}`;
}
