# PostHog Analytics Setup

## Current configuration

Updated: October 19, 2026. The owner requested repair of sparse analytics and missing recordings.
The previous privacy-minimized client explicitly disabled replay, remote configuration and external
recorder loading. The signed-in US project `294319` had recording enabled but no recordings.
Its unfiltered last-seven-days Web Analytics view showed 95 page views, 72 sessions and 71 visitor
identifiers before the repair. Those visitor identifiers used memory persistence and are not a
reliable measure of returning people. Ingestion was active; this was a collection/configuration gap.

The site uses `posthog-js/dist/module.full.no-external`, including the recorder in the deployed
bundle rather than executing a remote recorder script. JSON remote configuration is enabled so
the project can control replay. Feature-flag evaluation, surveys, experiments, broad autocapture,
heatmaps, console recording, exception capture and external dependency loading remain disabled.

## Environment and deployment

The production Actions secret `NEXT_PUBLIC_POSTHOG_API_KEY` remains configured. The preferred
alias `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` is also accepted and takes precedence. The default
host is `https://us.i.posthog.com`. Do not print or commit token values. Production builds run
`npm run verify:production-env`; missing or blank tokens stop deployment. Preview builds may
remain keyless. Changing a public build-time variable requires a new deployment.

Production is a static Next.js export on GitHub Pages. Keep the existing domain, catalog,
Apple-only feed and publishing safeguards intact. A Next.js server rewrite cannot provide a
production reverse proxy for this static host. Use PostHog's managed proxy plus an owner-controlled
DNS record, or a separately deployed edge proxy, if implementing that improvement later.

## Collection and privacy

- Manual path-only page views/leaves, conversions, player intent, and explicitly mapped link events.
- Anonymous `sessionStorage` identity: continuity in one tab across reloads, without a lasting
  cookie/localStorage visitor profile. Do not describe visitor IDs as cross-visit unique people.
- Person profiles remain `never`; Do Not Track remains respected.
- Replay text and inputs are masked. Forms, inputs, images, canvas/video, editable areas, iframes and `[data-private]`
  regions are blocked. Console logs, network payloads, cross-origin iframe and canvas recording
  are disabled. The network masking hook drops actual request entries and permits only sanitized
  page metadata. Uncompressed snapshot objects pass the outbound sanitizer before transport
  compression; URL queries/fragments and descriptive/value/data attributes are removed.
- Only known search/social referrer origins and fixed allowlisted `utm_source`/`utm_medium` values
  are retained. Arbitrary referrers, paths, campaign names, click IDs and URL queries are excluded.
- Never attach names, emails, messages, health/search text or arbitrary outbound URLs to events.
  Keep the public notice in `src/app/legal/privacy/page.tsx` consistent with collection.
- The project must discard client IP data. The browser configuration alone cannot enforce that
  account setting. Recheck it after changing projects.

## Implemented events

| Event | Trigger | Custom properties |
| --- | --- | --- |
| `$pageview` | Client route change | path-only `$current_url` |
| `$pageleave` | Page lifecycle | sanitized SDK properties |
| `episode opened` | An episode-detail link is activated | public `episode_slug`, fixed `placement` |
| `platform outbound clicked` | A link to a recognized media platform is activated | fixed `platform`, `placement` |
| `affiliate product clicked` | A tagged partner button is activated | public catalog partner/product slug, `placement` |
| `episode player opened` | Vimeo poster activated | public `video_id` |
| `media item opened` | Short/media poster activated | `media_type`, `platform` |
| `newsletter subscribed` | Backend accepted form | fixed `placement` |
| `contact form submitted` | Backend accepted form | fixed `subject` category |

No event is emitted per input keystroke. Search/filter events remain planned. Player opens measure
intent to load, not actual video playback or completion. Replay does not record iframe contents.
Old data, attribution and recordings that were never collected cannot be recovered.

Account settings were read back on October 19: replay on, 100% default sampling, no minimum
duration, no triggers or exclusions. Console and network capture were turned off and the
project masking preset set to Total privacy. Replay retention remains 30 days.

## Verification

1. Run typecheck, lint, build and analytics regression tests; require Actions checks before merge.
2. Verify the deployed bundle contains the recorder, enabled replay and remote config, masked
   replay options and `sessionStorage`, with a production token present but never exposed.
3. Use the signed-in Dr. M browser to visit the live website, navigate to an episode, and open
   a player. Do not submit real personal/contact records just for testing.
4. Confirm fresh events in project `294319` Activity and an actual playable recording in Session
   replay. Neither a request attempt nor a successful Pages deployment proves recording ingestion.
5. Inspect the recording for masked text and blocked form/player regions; verify the public privacy
   notice. Record the deployed commit and distinguish code, ingestion and replay verification.
6. Historical dashboard `1086989` includes retention and referral views that the old client could
   not support. Tab-scoped identity still does not provide cross-visit retention; use event and
   session counts, content/player opens, outbound/partner clicks and accepted form conversions.

Official references: [JavaScript SDK](https://posthog.com/docs/libraries/js),
[session replay](https://posthog.com/docs/session-replay),
[reverse proxy](https://posthog.com/docs/advanced/proxy).

## Production verification receipt — October 19, 2026

Repair PR #56 merged as `f39a88b0bd6ac62a97e2ab3d44fe39f4a326faf5`. Production run
`39306905592` passed build, deployment and independent Apple-feed verification. The public
bundle was independently checked for enabled replay/remote config, bundled recording settings,
tab-scoped storage, safe events and the revised privacy notice.

The signed-in project received a fresh pageview and `platform outbound clicked` from the
controlled production visit, and recording `01a15589-2f9c-76f6-b756-b30dcb6eb3c0` appeared
with five clicks and at least 2:10 duration. The first view also had a default greater-than-five
active-seconds filter; short test recordings were inspected using greater-than-zero total duration.
The embedded PostHog player then reported that its frame could not load in this Chrome session.
A standalone request for the public player-frame URL succeeded. Actual replay rendering, masking
of that received recording and raw snapshot export remain unverified; do not claim these passed.
See `publishing/posthog-status.json` for the machine-readable receipt.
