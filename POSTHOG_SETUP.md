# PostHog Analytics Setup

PostHog is integrated for analytics tracking. This works with static export and GitHub Pages.

## Environment Variables

### For Local Development

Create or update `.env.local`:

```env
# PostHog Analytics
NEXT_PUBLIC_POSTHOG_API_KEY=your_posthog_api_key_here
# Optional: PostHog host (defaults to https://us.i.posthog.com)
# NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

**Important:** The variable **must** be prefixed with `NEXT_PUBLIC_` because PostHog runs client-side in the browser.

### For GitHub Pages (GitHub Actions)

In your GitHub repository settings:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add a new secret:
   - **Name:** `NEXT_PUBLIC_POSTHOG_API_KEY`
   - **Value:** Your PostHog API key

Production deployments run `npm run verify:production-env` and stop before the
build when this secret is absent or blank. Local and pull-request builds keep
analytics optional.

If you're using `POSTHOG_API_KEY` in your GitHub Actions workflow, you can map it:

```yaml
env:
  NEXT_PUBLIC_POSTHOG_API_KEY: ${{ secrets.POSTHOG_API_KEY }}
```

## How It Works

- **Pageview tracking** on route changes, without query strings
- **Privacy-focused**: autocapture and session recording are disabled
- **Memory-only identity**: analytics does not persist an identifier in cookies or local storage
- **URL minimization**: URL query strings, fragments, and query-derived campaign properties are removed before send
- **Browser preference**: Do Not Track is respected
- **Lazy loading**: the PostHog bundle is not requested when no API key is configured
- **Development mode**: initialization and capture errors are logged only in development
- **Static export compatible**: Works with `output: "export"`

## Custom Events

You can track custom events anywhere in your app:

```typescript
import posthog from 'posthog-js';

// Never include form values, email addresses, or other personal data.
posthog.capture('newsletter_subscribed', {
  source: 'homepage',
});
```

## Configuration

The PostHog provider is configured in `src/components/posthog-provider.tsx`. Current settings:

- `autocapture: false` - Manual events only
- `capture_pageview: false` - Pageviews are sent by the route tracker
- `capture_pageleave: true` - Page-leave events support duration and bounce metrics
- `capture_performance: false` - Performance telemetry is disabled
- `disable_session_recording: true` - Session replay is disabled
- surveys, web experiments, and remote feature-flag configuration are disabled
- `person_profiles: 'never'` - Person profiles are disabled
- `persistence: 'memory'` - No persistent analytics identifier
- `respect_dnt: true` - Browser Do Not Track is honored
- `before_send` - Query strings, fragments, and campaign parameters are removed

Keep any configuration changes consistent with `src/app/legal/privacy/page.tsx`.

## Production Verification

After a deployment, open PostHog Installation Health and verify all of the
following without exposing the project key:

1. `$pageview` is received from the production domain.
2. `$pageleave` and scroll-depth checks pass.
3. `https://drmexperienced.com` and `https://www.drmexperienced.com` are listed
   as authorized URLs.
4. The configured ingestion host and project region match.
5. IP collection/discard behavior matches the approved privacy policy.

The August 6, 2026 authenticated check initially reported no events, an
incomplete `$pageview` check, and no authorized URLs. The Actions project key was
then configured and both production origins were authorized. Page-leave, scroll
depth, reverse proxy, and performance checks passed. The website has recovered
from the provider outage, but configuration is not proof of production
ingestion; repeat this checklist after an analytics-enabled deploy.

On August 7, 2026, authenticated readback confirmed this is the US PostHog
project and `Discard client IP data` was enabled successfully. Cookieless server
hash mode remains disabled; the client uses memory-only identity instead. Live
production event verification remains pending deployment.
