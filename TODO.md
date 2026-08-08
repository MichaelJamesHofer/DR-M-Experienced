# Dr. M Experienced, with Dr. David Musnick - Complete Site Overhaul

## Design Philosophy
Based on analysis of top-tier health content creators (Huberman Lab, Peter Attia's The Drive, Found My Fitness, Dr. Mark Hyman):

- **Medical credibility meets accessibility** - Professional but not clinical/cold
- **Action-oriented** - Every page should have a clear next step
- **Protocol-driven** - Tangible, downloadable, shareable content
- **Multi-platform hub** - YouTube, Spotify, Apple Podcasts integration
- **Email-first growth** - Newsletter is the primary conversion goal

## Color System (Dark-First)
- Background: Deep slate (`#0a0f1a`)
- Surface: Elevated slate (`#111827`)
- Primary: Cyan/teal (`#22d3ee`)
- Accent: Warm amber (`#f59e0b`)
- Text: Off-white (`#f1f5f9`)
- Muted: Slate gray (`#64748b`)

## Typography
- Headlines: Geist Sans with tighter tracking
- Body: Geist Sans (keep current)
- Mono: Geist Mono for timestamps/codes

---

## Phase 1: Core Infrastructure & Design System ✅
- [x] Commit current state for easy revert
- [x] Update globals.css with new dark-first color system
- [x] Update tailwind.config.ts with extended theme
- [x] Create new typography scale

## Phase 2: Layout Components ✅
- [x] Redesign SiteHeader - minimal, sticky, with platform links
- [x] Redesign SiteFooter - newsletter capture + platform links
- [x] Create PlatformBadges component (YouTube, Spotify, Apple)
- [x] Create NewsletterCapture component (prominent, value-prop driven)

## Phase 3: Home Page Overhaul ✅
- [x] New hero section - video player placeholder + bold tagline
- [x] "Latest Episode" featured card with play button
- [x] Newsletter signup section with clear value prop
- [x] Topic pills for quick navigation
- [x] Credibility strip (credentials, logos, social proof)
- [x] Featured episodes grid (3 max)
- [x] Platform links section

## Phase 4: Episodes System ✅
- [x] Redesign episode list page - search + topic filters
- [x] Redesign episode detail page:
  - [x] Video/audio player hero
  - [x] Key takeaways as skimmable bullets
  - [x] Protocol/checklist section
  - [x] Show notes with expandable sections
  - [x] Related episodes sidebar
  - [x] Episode navigation (prev/next)

## Phase 5: About Page ✅
- [x] Redesign with credibility-first hero
- [x] Credentials grid (board certs, publications, faculty)
- [x] Treatments & modalities section
- [x] Media appearances
- [x] Newsletter CTA

## Phase 6: Contact & Legal ✅
- [x] Simplify contact page
- [x] Update disclaimer page

## Phase 7: Polish & Cleanup ✅
- [x] Remove unused components
- [x] Build passes with no errors
- [x] Dark mode working

---

## Remaining Optional Enhancements
- [x] Add actual YouTube/Spotify/Apple links
- [ ] Approve one Round 01 logo direction (Switchback, Cutline, Waypoint Steps, or none)
- [ ] After logo selection, produce and approve the outlined logo family, podcast cover, avatar, banners, Open Graph image, letterhead, lower third, sting, and end-screen exports
- [ ] Approve the V3 layered desktop/tablet/mobile cartographic hero exports and promote their hashes from review status into the brand asset manifest
- [x] Add explicit PostHog page-leave capture and a tested production deploy guard for a missing project key
- [x] Configure the production PostHog Actions key and authorize the apex/`www` production URLs
- [x] Confirm the PostHog US project region and enable `Discard client IP data`; keep cookieless server hash mode disabled for the memory-only client
- [ ] Deploy the analytics-enabled build, verify live `$pageview`/`$pageleave` receipts, and create the initial growth dashboard
- [ ] Add timestamps to episode data when audio is recorded
- [ ] Add episode video embeds when YouTube channel is set up
- [ ] Performance audit (lighthouse)
- [ ] Add Open Graph images for social sharing
- [x] Validate the seven-episode RSS.com import, including GUIDs, byte-identical audio, artwork, and full oldest/newest decode
- [x] Complete canonical-copy/season cleanup and verify the approved one-hop Anchor 301 to RSS.com
- [x] Apply the guarded normalized-RSS-audio migration in production Supabase and verify all seven current audio URLs against catalog revision 10
- [x] Apply the guarded YouTube-destination migration in production Supabase and verify all seven YouTube IDs and `Watch on YouTube` references against catalog revision 10
- [ ] Verify Podcast Index duplicate convergence after the Anchor redirect is crawled
- [x] Record Apple case `20000130526608` and the exact historical/current GUID crosswalk for missing Episodes 1-2 in `publishing/apple-guid-repair.json`
- [ ] Ask Apple for server-side remapping, RSS.com for an in-place GUID-only correction, and Spotify for identity protection before changing either live GUID
- [ ] If a feed repair remains necessary, capture a baseline and use one attended episode as a canary; preserve Apple/Spotify episode IDs, video, analytics, and the other six feed items
- [x] Replace all seven under-level RSS.com enclosures with normalized MP3s, preserve every GUID, and verify all seven remote downloads, full decodes, and loudness gates
- [x] Attach corrected video to all seven existing Spotify episode IDs and verify public video, approved artwork, and approved copy for 7/7 without creating duplicates
- [x] Validate and register Episode 5's sub-25 Mbps Spotify derivative without changing its catalog master binding or claiming a remote upload
- [x] Publish and verify all seven normalized YouTube replacements, move the prior uploads to Unlisted with replacement links, and retain both ID sets for rollback
- [x] Replace all seven Vimeo videos in place and verify the corrected media on the stable existing IDs
- [x] Audit the seven staged Rumble replacements: 7/7 are Unlisted with non-exclusive Option C and Vimeo/Facebook syndication off, but hidden YouTube syndication on; none was submitted and Premium state remains unverified
- [ ] User-only Rumble completion: review every episode's third-party asset rights and the July 21, 2026 General License AI/ML training and third-party AI sublicensing provisions; then manually turn YouTube syndication off in all seven tabs, reverify Option C/Unlisted/Premium off, check the rights and Terms boxes, submit, and record each ID/URL. Do not automate Rumble absent its prior written permission
- [x] Confirm GitHub Pages recovery after the provider outage: the apex returns HTTP 200 and `www` redirects to the apex
- [ ] Clear or escalate RSS.com's cached `RSSVERIFY` token on the public landing page without changing the exact dashboard/feed description
- [ ] Claim the show once in Amazon Music/Audible using `https://media.rss.com/dr-m-experienced/feed.xml`, then record its stable ID and URL
- [x] Independently verify Instagram is a Creator professional account, not a Business account, with exact public name and bio
- [ ] Add `https://drmexperienced.com` as Instagram's external link and complete authenticated Graph API publishing-ID/token authorization; do not use the public profile ID as the publishing ID or convert the account to Business
- [ ] Review the off-catalog public Vimeo video `Pesto v2`; archive or catalog it only after content ownership and intent are confirmed
- [ ] Replace company-level affiliate destinations with verified links to the exact products Dr. Musnick recommends, then validate every link and its related-episode placement before publishing

## Current Status: HOST CUTOVER COMPLETE; PLATFORM REMEDIATION ACTIVE
RSS.com is canonical, the legacy Anchor feed redirects, Apple is configured
directly to RSS.com, and production Supabase matches catalog revision 10 for all
seven current RSS audio URLs, YouTube IDs, and `Watch on YouTube` references.
The website apex has recovered to HTTP 200 and `www` redirects to it.
Apple support, Podcast Index convergence, Amazon onboarding, RSS.com's cached
landing-page token, Instagram's missing website link, Rumble's manual rights/Terms
review and syndication correction,
and remaining profile corrections are tracked in the publishing runbooks.
