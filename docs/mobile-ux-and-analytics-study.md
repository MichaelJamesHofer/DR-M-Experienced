# Mobile UX And Analytics Study

Last reviewed: August 8, 2026

## Scope And Method

This is the operating UX baseline for the Dr. M website. The review covered the
homepage, episodes, blogs, media, about, contact, affiliates, and privacy routes
through code inspection and rendered top-viewport checks at 320 x 844 and
390 x 844. Both widths were also checked for document overflow and interactive
target dimensions.

The current branch had no document-level horizontal overflow on any reviewed
route at either width. Header controls and primary buttons meet the 44 x 44 CSS
pixel target baseline. Inline prose links are intentionally exempt; their
surrounding line height and focus treatment remain important.

## Executive Decisions

- Keep the flatter editorial information architecture. Do not rebuild nested
  cards around every section.
- Restore high-value homepage affordances as unframed modules: a centered
  platform rail and a visually explicit latest-episode video/thumbnail.
- Center mobile identity, short headings, platform rails, and primary actions
  where it improves scanning and reach. Keep paragraphs, legal copy, show notes,
  references, and form labels left-aligned for reading speed.
- Use analytics to validate sequence and conversion decisions. Do not use
  analytics to justify uncontrolled visual churn.

## Prioritized Findings

### P0: Blocking

No blocking horizontal overflow, clipped primary control, or inaccessible main
route was confirmed in the reviewed mobile widths.

### P1: High Impact

1. **The homepage lost two proven orientation cues.** Platform destinations and
   the latest playable episode should be visible near the hero without returning
   to a card-inside-card layout.
2. **The brand and theme hierarchy is not yet a stable system.** The explicit
   dark homepage treatment and route surfaces need to follow the approved brand
   palette and asset rules. Route-level exceptions should be documented, not
   improvised.
3. **The contact form begins below the first mobile viewport.** At 390 px wide,
   three intent explanations occupy most of the first screen and the form starts
   around the fold. Test a compact intent selector or form-first mobile order;
   keep the fuller explanations below the form.
4. **Conversion instrumentation was incomplete.** Page views alone cannot show
   whether an episode, platform, newsletter, affiliate, or contact journey is
   working. The first three safe conversion events are now implemented; outbound
   and content-discovery events remain in the typed event contract.
5. **Unbounded taxonomies become visual debris.** Topic/tag collections should
   use one horizontal line with overflow scrolling on mobile. Never allow long
   tag sets to become a multi-row block above the content.

### P2: Important Refinement

1. **The about page is a long single scroll.** It is roughly 8,900 px at the
   reviewed 390 px width. Add a compact section index and collapse deep CV-style
   detail behind native disclosure controls while leaving core credentials open.
2. **Catalog controls consume substantial first-screen space.** Episodes and
   blogs remain usable, but search/filter/sort controls should reveal a first
   result by about the first viewport and keep selected filters obvious.
3. **Footer density is high on narrow screens.** Center the brand/platform group
   and primary newsletter action on mobile, but retain left-aligned legal text.
4. **Motion needs an explicit purpose.** Affiliate parallax may provide brand
   separation, but movement must be subtle, must not affect text position, and
   must be disabled under `prefers-reduced-motion`.

## Mobile Layout Rules

1. Use a 16 px minimum page gutter at 320-479 px and keep content within the
   viewport without relying on page-level horizontal scrolling.
2. Make primary controls at least 44 x 44 px. Make the highest-value mobile CTA
   full-width or centered when its label remains short; keep destructive or
   unrelated actions visually separate.
3. Center logos, hero identity, short section headings, platform rails, and
   compact CTA groups on mobile. Switch to left alignment from the first layout
   where the content clearly participates in a desktop grid.
4. Keep body prose, medical/legal copy, form labels, lists, references, and
   multi-sentence descriptions left-aligned with a readable measure.
5. Do not equate center alignment with thumb reach. Thumb reach comes from large
   targets, adequate spacing, predictable order, and placing frequent actions
   away from fragile screen edges.
6. Use a single-line horizontal scroller only for compact taxonomies such as
   tags. Preserve keyboard access, visible focus, and at least 12 px end padding.
7. Do not add persistent bottom navigation until analytics shows repeated mobile
   navigation failure; it would compete with browser chrome and media controls.
8. Keep media aspect ratios stable before images/iframes load so page content
   does not shift under a tap.

## Responsive QA Matrix

| Viewport | Purpose | Required checks |
| --- | --- | --- |
| 320 x 568 | Narrow phone / worst case | No overflow; longest label fits; menus and filters usable |
| 375 x 667 | Small iPhone | Hero CTA order; first useful content; form keyboard flow |
| 390 x 844 | Current iPhone baseline | Centering rules; one-hand CTA placement; media framing |
| 412 x 915 | Current Android baseline | Card/list density; tag rail; footer wrapping |
| 768 x 1024 | Tablet portrait | Grid transition; line length; no oversized headings |
| 1024 x 768 | Tablet landscape | Header breakpoint; media grids; filter toolbar |
| 1280 x 800 | Laptop | Main navigation; content measure; first-viewport hierarchy |
| 1440 x 900 | Desktop | Max-width framing; balance; next-section visibility |

Run each critical journey in light and dark themes, with reduced motion enabled,
keyboard-only navigation, and at 200% browser zoom. For every viewport, assert:

- `document.documentElement.scrollWidth === window.innerWidth`
- no text or controls overlap
- all primary controls have visible focus and a minimum 44 px target
- dynamic content does not change toolbar or media dimensions
- images have useful crops and alternatives; embeds load only after intent
- no route mixes light/dark surfaces unintentionally during theme hydration

Critical journeys are: homepage to latest episode, homepage to each platform,
episode search/filter to episode detail, episode to relevant affiliate, affiliate
to merchant, newsletter completion, contact completion, and mobile menu traversal.

## Analytics Event Plan

Event properties are deliberately low-cardinality and non-personal. Never emit
form values, search text, health terms, emails, names, messages, full outbound
URLs, external referrers, query strings, fragments, or campaign IDs.

| Event | Status | Trigger | Safe properties |
| --- | --- | --- | --- |
| `$pageview` | Implemented | Route change | sanitized current path |
| `$pageleave` | Implemented | PostHog page lifecycle | sanitized path-only URL properties |
| `newsletter subscribed` | Implemented | Backend accepts form | `placement` |
| `contact form submitted` | Implemented | Backend accepts form | fixed `subject` enum |
| `episode player opened` | Implemented | Poster activated and Vimeo iframe requested | `video_id` |
| `episode opened` | Planned | Episode detail navigation | `episode_slug`, `placement` |
| `platform outbound clicked` | Planned | Platform link activation | `platform`, `placement` |
| `affiliate product clicked` | Planned | Merchant link activation | product/brand slugs, `placement` |
| `media item opened` | Planned | External media activation | `media_type`, `platform` |
| `content search used` | Planned | Debounced search commitment | content type, `has_results` only |
| `content filter applied` | Planned | Filter state committed | content type, facet count only |

Do not emit an event per keystroke or scroll tick. Search/filter events should be
debounced or emitted when a result is opened so event volume represents intent.
`episode player opened` measures intent to load the player; it does not prove
that Vimeo playback started or reached any duration threshold.

## Funnels And Dashboard

Build these PostHog insights after production ingestion is verified:

1. **Episode discovery:** homepage page view -> episode opened -> episode player
   opened or platform outbound clicked.
2. **Newsletter:** eligible page view -> newsletter subscribed, broken down by
   placement.
3. **Affiliate:** episode or affiliate page view -> affiliate product clicked,
   broken down by product and placement. Purchase confirmation belongs to the
   affiliate network, not the website event stream.
4. **Contact:** contact page view -> contact form submitted, broken down by the
   fixed subject enum.
5. **Content findability:** library page view -> search/filter used -> episode or
   blog opened.

Dashboard tiles should show weekly page-view counts, episode opens, player opens,
platform outbound clicks, newsletter conversion, contact conversion by subject,
and affiliate click-through by product. Compare mobile and desktop viewport
classes only after the property is intentionally added and documented.

The current memory-only PostHog identity does not support reliable unique-user,
returning-visitor, cross-session retention, or campaign-attribution reporting.
Use event counts and within-session funnels. Any persistence or attribution
change requires owner approval and a privacy-notice update.

## Configuration Gates

Before calling analytics operational:

1. Confirm at least one supported token is present in GitHub Actions secrets:
   preferred `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` or legacy
   `NEXT_PUBLIC_POSTHOG_API_KEY`.
2. Confirm `NEXT_PUBLIC_POSTHOG_HOST` matches the actual PostHog region.
3. Deploy, then verify sanitized events in Live events using a controlled test.
4. Confirm project-level client IP capture is set to discard.
5. Confirm autocapture, session replay, person profiles, surveys, and experiments
   remain disabled in code and are not relied on by a dashboard.
6. Record dashboard links and the last verification date in this document or the
   operations manual without recording tokens.

Official implementation references:

- <https://posthog.com/docs/libraries/next-js>
- <https://posthog.com/docs/libraries/js/usage>
- <https://posthog.com/docs/privacy/data-collection>
