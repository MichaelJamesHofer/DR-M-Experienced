'use client';

import { useEffect, Suspense, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';

function PostHogTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Track pageviews on route changes
    // This component only renders after PostHog is initialized
    if (pathname && typeof window !== 'undefined') {
      try {
        let url = window.origin + pathname;
        if (searchParams && searchParams.toString()) {
          url = url + '?' + searchParams.toString();
        }
        posthog.capture('$pageview', {
          $current_url: url,
        });
      } catch (error) {
        console.error('PostHog capture error:', error);
      }
    }
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize PostHog
    // Note: For client-side use, must be NEXT_PUBLIC_POSTHOG_API_KEY
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_API_KEY;
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

    if (!posthogKey) {
      console.warn('PostHog API key not configured. Analytics will not work.');
      return;
    }

    if (typeof window !== 'undefined') {
      // Check if PostHog is already initialized
      const isAlreadyLoaded = (posthog as any).__loaded || typeof (posthog as any).capture === 'function';
      
      if (isAlreadyLoaded) {
        setIsInitialized(true);
        return;
      }

      try {
        posthog.init(posthogKey, {
          api_host: posthogHost,
          loaded: (posthog) => {
            setIsInitialized(true);
            // Capture initial pageview
            if (typeof window !== 'undefined') {
              posthog.capture('$pageview', {
                $current_url: window.location.href,
              });
            }
            if (process.env.NODE_ENV === 'development') {
              posthog.debug();
              console.log('PostHog initialized successfully');
            }
          },
          // Disable autocapture for privacy (you can enable if needed)
          autocapture: false,
          // Capture pageviews manually
          capture_pageview: false,
        });
      } catch (error) {
        console.error('PostHog initialization error:', error);
        setIsInitialized(false);
      }
    }

    // No cleanup needed - PostHog persists across route changes
  }, []);

  return (
    <>
      {children}
      {isInitialized && (
        <Suspense fallback={null}>
          <PostHogTracker />
        </Suspense>
      )}
    </>
  );
}

