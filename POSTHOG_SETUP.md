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

If you're using `POSTHOG_API_KEY` in your GitHub Actions workflow, you can map it:

```yaml
env:
  NEXT_PUBLIC_POSTHOG_API_KEY: ${{ secrets.POSTHOG_API_KEY }}
```

## How It Works

- **Automatic pageview tracking** on route changes
- **Privacy-focused**: Autocapture is disabled by default
- **Development mode**: Debug logging enabled in development
- **Static export compatible**: Works with `output: "export"`

## Custom Events

You can track custom events anywhere in your app:

```typescript
import posthog from 'posthog-js';

// Track a custom event
posthog.capture('newsletter_subscribed', {
  source: 'homepage',
  email_domain: 'example.com',
});
```

## Configuration

The PostHog provider is configured in `src/components/posthog-provider.tsx`. Current settings:

- `autocapture: false` - Manual event tracking only
- `capture_pageview: false` - Manual pageview tracking
- Debug mode enabled in development

To enable autocapture or change settings, edit `src/components/posthog-provider.tsx`.

