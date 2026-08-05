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
- [ ] Add timestamps to episode data when audio is recorded
- [ ] Add episode video embeds when YouTube channel is set up
- [ ] Performance audit (lighthouse)
- [ ] Add Open Graph images for social sharing
- [x] Keep the verified Spotify/Anchor feed canonical during the active RSS.com import

## Current Status: WEBSITE COMPLETE; DISTRIBUTION MIGRATION ACTIVE
The site is functional. RSS.com import, feed parity, directory cutover, Apple
repair, Amazon onboarding, and replacement artwork are tracked in the publishing
runbooks.
