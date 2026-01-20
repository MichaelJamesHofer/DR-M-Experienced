'use client';

import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';

function PostHogTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Track pageviews on route changes
    if (pathname && typeof window !== 'undefined') {
      // Check if PostHog is initialized
      try {
        let url = window.origin + pathname;
        if (searchParams && searchParams.toString()) {
          url = url + '?' + searchParams.toString();
        }
        posthog.capture('$pageview', {
          $current_url: url,
        });
      } catch (error) {
        // PostHog not initialized yet, skip
      }
    }
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {

  useEffect(() => {
    // Initialize PostHog
    // Note: For client-side use, must be NEXT_PUBLIC_POSTHOG_API_KEY
    // POSTHOG_API_KEY is checked for reference but won't work in browser
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_API_KEY;
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

    if (!posthogKey) {
      console.warn('PostHog API key not configured. Analytics will not work.');
      return;
    }

    if (typeof window !== 'undefined') {
      posthog.init(posthogKey, {
        api_host: posthogHost,
        loaded: (posthog) => {
          if (process.env.NODE_ENV === 'development') {
            posthog.debug();
          }
        },
        // Disable autocapture for privacy (you can enable if needed)
        autocapture: false,
        // Capture pageviews manually
        capture_pageview: false,
      });
    }

    // No cleanup needed - PostHog persists across route changes
  }, []);

  return (
    <>
      {children}
      <Suspense fallback={null}>
        <PostHogTracker />
      </Suspense>
    </>
  );
}

