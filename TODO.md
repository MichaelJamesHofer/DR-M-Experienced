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
- [ ] Configure and verify the production PostHog project token, region, IP-discard setting, live events, and initial growth dashboard
- [ ] Add timestamps to episode data when audio is recorded
- [ ] Add episode video embeds when YouTube channel is set up
- [ ] Performance audit (lighthouse)
- [ ] Add Open Graph images for social sharing
- [x] Validate the seven-episode RSS.com import, including GUIDs, byte-identical audio, artwork, and full oldest/newest decode
- [x] Complete canonical-copy/season cleanup and verify the approved one-hop Anchor 301 to RSS.com
- [x] Migrate all seven production Supabase episode audio URLs to RSS.com and verify exact catalog readback
- [ ] Verify Podcast Index duplicate convergence after the Anchor redirect is crawled
- [ ] Follow up on the submitted Apple support request for RSS Episodes 1-2 on show `1870433419`; both remain `DRAFTING`/`HIDDEN`
- [ ] Replace all seven under-level podcast masters using `publishing/audio-replacement-audit.json`, preserving GUIDs and verifying `-17` to `-15` LUFS with true peak at or below `-1 dBTP`
- [ ] Restore corrected video against all seven existing Spotify episode IDs; the post-cutover public audit found zero video episodes
- [ ] Repair the GitHub Pages production 404 after the current Actions/Pages outage and verify both apex and `www`
- [ ] Clear or escalate RSS.com's cached `RSSVERIFY` token on the public landing page without changing the exact dashboard/feed description
- [ ] Claim the show once in Amazon Music/Audible using `https://media.rss.com/dr-m-experienced/feed.xml`, then record its stable ID and URL
- [ ] Add `https://drmexperienced.com` as Instagram's external link and complete professional-account/API setup
- [ ] Review the off-catalog public Vimeo video `Pesto v2`; archive or catalog it only after content ownership and intent are confirmed
- [ ] Replace company-level affiliate destinations with verified links to the exact products Dr. Musnick recommends, then validate every link and its related-episode placement before publishing

## Current Status: HOST CUTOVER COMPLETE; PLATFORM REMEDIATION ACTIVE
RSS.com is canonical, the legacy Anchor feed redirects, Apple is configured
directly to RSS.com, and production Supabase uses the seven RSS.com audio URLs.
The website currently returns a GitHub Pages 404 during an Actions/Pages outage.
Apple support, seven-file loudness replacement, Spotify video restoration,
Podcast Index convergence, Amazon onboarding, and remaining profile corrections
are tracked in the publishing runbooks.
