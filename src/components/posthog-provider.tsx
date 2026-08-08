'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { CaptureResult, PostHog } from 'posthog-js';
import {
  sanitizeAnalyticsProperties,
  type AnalyticsProperties,
} from '@/lib/analytics-privacy';
import type { CaptureAnalyticsEvent } from '@/lib/analytics-events';
import {
  buildPathOnlyPageviewUrl,
  POSTHOG_PRIVACY_OPTIONS,
  resolvePostHogRuntimeConfig,
} from '@/lib/posthog-runtime';

type PostHogClient = Pick<PostHog, 'capture'>;

type AnalyticsContextValue = {
  capture: CaptureAnalyticsEvent;
  enabled: boolean;
};

const AnalyticsContext = createContext<AnalyticsContextValue>({
  capture: () => undefined,
  enabled: false,
});

function sanitizePostHogProperties(properties: AnalyticsProperties): AnalyticsProperties {
  const sanitized = sanitizeAnalyticsProperties(properties);

  return Object.fromEntries(
    Object.entries(sanitized).filter(([key]) => {
      // PostHog prefixes session attribution after parsing it from the URL.
      const unscopedKey = key
        .toLowerCase()
        .replace(/^\$/, '')
        .replace(/^(?:(?:initial|session_entry)_)+/, '');
      const policyProbe = sanitizeAnalyticsProperties({ [unscopedKey]: true });

      return unscopedKey !== 'ph_keyword' && unscopedKey in policyProbe;
    }),
  );
}

function sanitizeAnalyticsEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event) return null;

  return {
    ...event,
    properties: sanitizePostHogProperties(event.properties),
    $set: event.$set ? sanitizePostHogProperties(event.$set) : undefined,
    $set_once: event.$set_once
      ? sanitizePostHogProperties(event.$set_once)
      : undefined,
  };
}

function PostHogTracker({ client }: { client: PostHogClient }) {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname && typeof window !== 'undefined') {
      try {
        client.capture('$pageview', {
          $current_url: buildPathOnlyPageviewUrl(window.origin, pathname),
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
    const runtimeConfig = resolvePostHogRuntimeConfig({
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN,
      NEXT_PUBLIC_POSTHOG_API_KEY: process.env.NEXT_PUBLIC_POSTHOG_API_KEY,
      NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    });
    if (!runtimeConfig || typeof window === 'undefined') return;

    let active = true;
    void import('posthog-js')
      .then(({ default: posthog }) => {
        if (!active) return;
        if (posthog.__loaded) {
          setClient(posthog);
          return;
        }

        posthog.init(runtimeConfig.projectToken, {
          ...POSTHOG_PRIVACY_OPTIONS,
          api_host: runtimeConfig.apiHost,
          loaded: (initializedClient) => {
            if (active) setClient(initializedClient);
          },
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

  const capture = useCallback<CaptureAnalyticsEvent>((eventName, properties) => {
    if (!client) return;

    try {
      client.capture(eventName, sanitizePostHogProperties(properties));
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('PostHog capture error:', error);
      }
    }
  }, [client]);

  const contextValue = useMemo<AnalyticsContextValue>(() => ({
    capture,
    enabled: client !== null,
  }), [capture, client]);

  return (
    <AnalyticsContext.Provider value={contextValue}>
      {children}
      {client && <PostHogTracker client={client} />}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  return useContext(AnalyticsContext);
}
