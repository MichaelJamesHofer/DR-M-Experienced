# PostHog Analytics Setup

The site has a privacy-minimized PostHog integration compatible with the static
Next.js export and GitHub Pages. Local and pull-request builds may remain
keyless; the production deployment guard requires the configured project token.

## Current Status

Last verified: August 7, 2026.

- `posthog-js` is installed and initialized by
  `src/components/posthog-provider.tsx`.
- The configured GitHub Actions secret uses `NEXT_PUBLIC_POSTHOG_API_KEY`. Both
  the runtime and `npm run verify:production-env` also accept
  `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` as the preferred alias.
- The apex and `www` production origins are authorized. Authenticated readback
  confirmed the US project region and enabled `Discard client IP data`.
  Cookieless server hashing remains disabled because the client uses memory-only
  identity.
- Privacy-sanitized page views, page leaves, accepted newsletter/contact
  conversions, and episode-player opens are implemented. The remaining event
  taxonomy is defined in `src/lib/analytics-events.ts`.
- Live production event receipts and the initial growth dashboard remain pending
  the analytics-enabled deployment.

## Environment Variables

For an attended local test, add one supported token name to ignored `.env.local`:

```env
NEXT_PUBLIC_POSTHOG_API_KEY=your_posthog_project_token
# Alternatively: NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=your_posthog_project_token
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

PostHog calls this browser-safe value a **project token**. Keep at least one
supported Actions secret configured; when both are present, the preferred
`NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` value wins. Never commit a token or print it
into operational logs.

Production deployments run `npm run verify:production-env` and stop before the
build when both supported token variables are absent or blank. Local and
pull-request builds keep analytics optional. A production build inlines
`NEXT_PUBLIC_` values, so a secret change requires a new deployment.

## Privacy Contract

The client is intentionally configured with:

- manual events only (`autocapture: false`)
- manual path-only page views (`capture_pageview: false`)
- explicit page-leave capture (`capture_pageleave: true`)
- no session recording, surveys, web experiments, or remote dependency loading
- no person profiles or calls to `identify`
- memory-only identity and respect for Do Not Track
- no external referrers, query strings, fragments, campaign IDs, form values,
  contact details, or free-text searches in event properties
- a `before_send` sanitizer as a final outbound guard

Never attach email addresses, names, messages, health terms, search text,
affiliate destination URLs, or full form payloads to an event. Use public
content slugs, platform names, fixed placement names, counts, and booleans.

The August 7 authenticated check confirmed that the live project discards client
IP data. Re-check that remote setting after any project or ingestion change; the
repository configuration cannot enforce it.

## Implemented Events

| Event | Trigger | Allowed custom properties |
| --- | --- | --- |
| `$pageview` | Client route change | Sanitized path-only `$current_url` |
| `$pageleave` | PostHog page lifecycle | Sanitized path-only URL properties |
| `newsletter subscribed` | Backend accepted a real newsletter form | `placement` |
| `contact form submitted` | Backend accepted a real contact form | fixed `subject` enum |
| `episode player opened` | Visitor activates the poster and requests the Vimeo iframe | public `video_id` |

Honeypot submissions do not emit conversion events. Failed or invalid forms do
not emit success events. `episode player opened` records intent to load the
player; it does not prove that video playback started.

## Dashboard Setup

After the analytics-enabled deployment completes:

1. Open the public site in a private browser window with Do Not Track off.
2. Visit two pages, open one episode player, and submit only a controlled test
   newsletter/contact record that can be removed afterward.
3. In PostHog **Live events**, confirm only the five implemented event types and
   approved properties appear. Confirm URLs have no `?` or `#` content.
4. Confirm no email, name, message, search phrase, or form field value appears
   in event properties.
5. Build the dashboards and funnels specified in
   `docs/mobile-ux-and-analytics-study.md`.
6. Re-check the public privacy notice before enabling any additional PostHog
   product or changing identity, persistence, recording, or autocapture.

## Measurement Limits

Memory-only identity is a deliberate privacy tradeoff. It supports aggregate
event counts and most navigation funnels within the current page session, but
it does not provide reliable returning-visitor, cross-session retention, or
unique-audience measurement. Campaign parameters are also discarded. Do not
label those unavailable metrics as confirmed audience growth.

Changing persistence, enabling cookieless identifiers, recording sessions, or
adding campaign attribution requires a separate privacy decision and an update
to `src/app/legal/privacy/page.tsx` before deployment.

## Production Verification

After deployment, open PostHog Installation Health and verify all of the
following without exposing the project token:

1. Fresh `$pageview` and `$pageleave` events arrive from both production origins.
2. The three approved conversion events arrive only after their documented
   triggers and contain only allowed properties.
3. `https://drmexperienced.com` and `https://www.drmexperienced.com` remain
   authorized URLs.
4. Requests use the US ingestion host and `Discard client IP data` remains on.
5. Autocapture, session recording, persistent identity, person profiles, surveys,
   web experiments, and query-string collection remain disabled.

The August 6 authenticated check initially reported no events, an incomplete
`$pageview` check, and no authorized URLs. The Actions project key was then
configured and both production origins were authorized. Page-leave,
scroll-depth, reverse-proxy, and performance checks passed. Authenticated
readback on August 7 confirmed the US region and IP-discard setting. Those
configuration checks are not proof of live ingestion; complete the checklist
above after the analytics-enabled deployment.

## Official References

- PostHog Next.js guide: <https://posthog.com/docs/libraries/next-js>
- PostHog manual event capture and `before_send` redaction:
  <https://posthog.com/docs/libraries/js/usage>
- PostHog data collection and IP controls:
  <https://posthog.com/docs/privacy/data-collection>
