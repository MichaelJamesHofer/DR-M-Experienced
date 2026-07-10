'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { CaptureResult, PostHog } from 'posthog-js';
import { sanitizeAnalyticsProperties } from '@/lib/analytics-privacy';

type PostHogClient = Pick<PostHog, 'capture'>;

function sanitizeAnalyticsEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event) return null;

  return {
    ...event,
    properties: sanitizeAnalyticsProperties(event.properties),
    $set: event.$set ? sanitizeAnalyticsProperties(event.$set) : undefined,
    $set_once: event.$set_once
      ? sanitizeAnalyticsProperties(event.$set_once)
      : undefined,
  };
}

function PostHogTracker({ client }: { client: PostHogClient }) {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname && typeof window !== 'undefined') {
      try {
        client.capture('$pageview', {
          $current_url: window.origin + pathname,
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('PostHog capture error:', error);
        }
      }
    }
  }, [client, pathname]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<PostHogClient | null>(null);

  useEffect(() => {
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_API_KEY;
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
    if (!posthogKey || typeof window === 'undefined') return;

    let active = true;
    void import('posthog-js')
      .then(({ default: posthog }) => {
        if (!active) return;
        if (posthog.__loaded) {
          setClient(posthog);
          return;
        }

        posthog.init(posthogKey, {
          api_host: posthogHost,
          loaded: (initializedClient) => {
            if (active) setClient(initializedClient);
          },
          autocapture: false,
          capture_pageview: false,
          capture_performance: false,
          disable_session_recording: true,
          disable_surveys: true,
          disable_web_experiments: true,
          disable_external_dependency_loading: true,
          person_profiles: 'never',
          persistence: 'memory',
          respect_dnt: true,
          advanced_disable_flags: true,
          before_send: sanitizeAnalyticsEvent,
        });
      })
      .catch((error) => {
        if (process.env.NODE_ENV === 'development') {
          console.error('PostHog initialization error:', error);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      {children}
      {client && <PostHogTracker client={client} />}
    </>
  );
}
