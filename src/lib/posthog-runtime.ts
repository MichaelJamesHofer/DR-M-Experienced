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
  disable_session_recording: true,
  disable_surveys: true,
  disable_web_experiments: true,
  disable_external_dependency_loading: true,
  person_profiles: "never",
  persistence: "memory",
  respect_dnt: true,
  advanced_disable_flags: true,
} as const;

export function resolvePostHogRuntimeConfig(env: PostHogPublicEnvironment) {
  const projectToken =
    env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() ||
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
