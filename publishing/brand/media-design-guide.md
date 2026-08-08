# Dr. M Experienced Media Design Guide

- Version: 1.4
- Status: authoritative production standard; unfinished identity assets remain
  subject to the approval gates in this guide
- Last reviewed: August 8, 2026

This guide defines the visual and verbal system for **Dr. M Experienced, with
Dr. David Musnick** across the website, podcast directories, long-form video,
social media, editorial content, affiliate content, presentations, and print.
It is the visual authority for new work. The canonical metadata in
`publishing/master-catalog.json` remains the authority for names and profile
copy, and `publishing/brand/asset-manifest.json` remains the authority for
approved binary exports and their hashes.

The seven episode-art families currently recorded in the asset manifest are
approved. Show Brand Package `1.0.0-rc1` is a complete, hash-recorded production
candidate, but its logo, show cover, avatar, channel banner, Open Graph image,
and motion assets have not passed owner approval and are not authorized for
remote publication. Do not describe a mockup, favicon, header tile, catalog
mount, or review package as a final brand asset.

## 1. Brand Foundation

### Position

Dr. M Experienced makes decades of clinical experience useful without turning
health education into hype. The brand should feel:

- experienced, not institutional
- rigorous, not academic for its own sake
- calm, not sleepy
- human, not lifestyle-influencer polished
- practical, not prescriptive
- premium, not ornamental

The central tension is **medical credibility with an inviting human presence**.
Clinical subject matter supplies the rigor. Dr. Musnick's voice and real-world
experience supply the warmth. His portrait is supporting evidence of the host,
not a substitute for a recognizable show identity.

### Audience Promise

Every artifact should help a viewer do at least one of these quickly:

1. recognize Dr. Musnick and the show
2. understand the topic and why it matters
3. choose a useful next action such as watch, listen, read, or inspect a
   recommendation

Do not add visual complexity that does not improve one of those outcomes.

### Design Principles

1. **One clear subject.** Use one primary image, title, or action per surface.
2. **Evidence before effects.** Inspectable products, topic-relevant imagery,
   and authentic source material outrank decorative treatment. Use a portrait
   only when the person is the subject of the surface.
3. **Warmth within rigor.** Deep slate establishes authority; bright cyan,
   amber, daylight, and human imagery prevent the system from becoming cold.
4. **Flat information hierarchy.** Prefer full-width bands and direct grouping.
   Avoid cards inside cards and repeated borders around related information.
5. **Consistent, not identical.** Preserve the identity frame while allowing
   each episode, article, and affiliate brand to have a distinct subject.
6. **Useful at small sizes.** Test every identity and thumbnail at 64 pixels and
   every mobile interface at 320 CSS pixels wide.

## 2. Canonical Verbal Identity

### Names

| Use | Exact form |
|---|---|
| Full show name | `Dr. M Experienced, with Dr. David Musnick` |
| Short display name | `Dr. M Experienced` |
| Host line | `with Dr. David Musnick` |
| Host name | `Dr. David Musnick` |
| Primary display wordmark | `DR. M EXPERIENCED,` |

Use the full show name in metadata, legal introductions, podcast directories,
the show cover, and first mention. Use the short display name only where space
is constrained or the host line appears immediately beside or beneath it.

Do not use the retired name, `Dr. M's Experienced Functional and Sports
Medicine`, in new copy or artwork. Do not use `DRM` as the primary identity; it
reads as an unrelated acronym.

### Canonical Description

The short description and mandatory opening of a longer profile is:

> Dr. M Experienced, with Dr. David Musnick. Practical insights from decades in
> sports, regenerative, internal, and functional medicine.

Longer descriptions may add the approved profile copy from the master catalog.
Do not independently rewrite overlapping platform bios and leave the catalog
stale.

### Voice

- Lead with the specific topic or practical value, not a generic wellness
  claim.
- Use plain medical language, then define specialized terms when needed.
- Prefer measured verbs such as `explains`, `examines`, and `discusses` over
  `cures`, `reverses`, `guarantees`, or `unlocks`.
- Avoid alarm, false certainty, treatment promises, and diagnosis by content.
- Write concise headings. Put nuance in supporting copy.
- Preserve the educational-content disclaimer where the context could be
  mistaken for individualized care.

### Episode Titles

Public episode titles use:

> Primary topic - practical tagline

Do not prefix a public title with `Episode N:`. Keep the number as structured
internal and RSS metadata. A small number may appear as a visual index only when
it does not compete with the topic.

## 3. Identity Architecture

### Required Logo Family

The finished identity must include:

| Asset | Role |
|---|---|
| Horizontal lockup | Primary website, document, and banner identity |
| Stacked lockup | Square and narrow compositions |
| Standalone mark | Favicon, app icon, watermark, and compact controls |
| One-color set | Embroidery, stamps, constrained print, and overlays |
| Small-size set | Pixel-adjusted 16, 24, 32, 48, and 180 pixel exports |

### Approved Architecture, Production Candidate

The approved architecture is a prominent `DR. M EXPERIENCED,` wordmark with
`with Dr. David Musnick` as a subordinate host line. The standalone mark should
be a custom, simple `M` with a path or mountain logic. It should suggest
experience, forward movement, and the Mountain West without becoming an outdoor
recreation logo.

Identity Round 01 compared Switchback, Cutline, and Waypoint Steps. Show Brand
Package `1.0.0-rc1` advances Cutline as the production candidate because it is
the strongest premium emblem while retaining the mountain-path logic. The
package includes horizontal, stacked, one-color, dark/light, circular-crop, and
16-512 pixel review exports. The exact drawing and binaries remain unapproved
until the owner selects Cutline and approves the package hashes and intended
destinations. The current mountain favicons and website `M` tile remain
provisional references, not final masters.

The candidate wordmark uses outlined Inter Display geometry for the identity
only. Geist remains the product and editorial typeface. This exception is part
of the owner approval gate and must not be inferred from approval of the mark.

Avoid generic medical crosses, caduceus symbols, ECG traces, stock brain
silhouettes, DNA helices, literal podcast microphones, and emoji. Do not depend
on a cyan-to-amber gradient to make the mark recognizable. A full-color mark
should use cyan as its main signal and amber as a small point of emphasis, and
it must remain complete in one color.

### Lockup Relationship

- `DR. M EXPERIENCED` carries recognition.
- The host line is one visual tier smaller and never competes with the name.
- Keep the host line attached to the wordmark in first-touch identity surfaces.
- Do not append taglines inside the core lockup. Taglines belong to the layout.
- Do not typeset a replacement logo ad hoc in a page or thumbnail after the
  final vector master is approved.

### Clear Space

Define `x` as the cap height of the `M` in the final wordmark.

- Horizontal and stacked lockups: keep at least `0.5x` clear on every side.
- Standalone mark: keep at least 25% of the mark width clear on every side.
- Podcast cover and avatar: keep identity elements inside the center 80% of the
  square, in addition to the clear-space rule.

No text, platform badge, photograph edge, crop, or container border may enter
the clear-space area.

### Minimum Size

| Asset | Digital minimum | Print minimum |
|---|---:|---:|
| Horizontal lockup with host line | 180 px wide | 38 mm wide |
| Stacked lockup with host line | 112 px wide | 28 mm wide |
| Wordmark without host line | 120 px wide | 25 mm wide |
| Standalone mark | 24 px | 7 mm |

Below these sizes, use the dedicated small-size mark. Never shrink a detailed
lockup until the host line becomes unreadable.

### Color Variants

1. Full color on Midnight or Cloud.
2. Cloud one-color on dark photography or Midnight.
3. Midnight one-color on light photography, paper, or Cloud.
4. Black one-color only where production requires it.

Do not recolor the mark with affiliate partner colors. Do not add drop shadows,
bevels, outlines, skew, stretch, rotation, or unapproved animation.

## 4. Color System

The core palette is the original deep-slate, vivid-cyan, and warm-amber system.
It supersedes the recent unapproved charcoal and soft-teal substitution.

### Core Palette

| Token | Hex | Role |
|---|---|---|
| Midnight | `#0A0F1A` | Dark canvas, dark ink on bright controls |
| Slate Surface | `#111827` | Primary dark surface |
| Slate Raised | `#1E293B` | Secondary dark surface and separation |
| Signal Cyan | `#22D3EE` | Links, active states, focus, identity signal |
| Cyan Active | `#06B6D4` | Dark-theme hover/pressed cyan |
| Warm Amber | `#F59E0B` | Selective emphasis and primary conversion action |
| Amber Active | `#D97706` | Dark-theme hover/pressed amber |
| Cloud | `#F1F5F9` | Primary dark-theme text and light identity field |
| Slate Muted | `#94A3B8` | Secondary dark-theme text |
| Slate Subtle | `#64748B` | Non-text detail, disabled state, large text only |

### Light Theme Adaptation

Vivid core colors remain available for identity graphics, but interactive text
uses darker variants on a light canvas to preserve contrast.

| Token | Hex | Role |
|---|---|---|
| Light Canvas | `#F8FAFC` | Page background |
| White Surface | `#FFFFFF` | Reading and tool surface |
| Light Raised | `#F1F5F9` | Secondary surface |
| Ink | `#0F172A` | Primary text |
| Light Muted | `#475569` | Secondary text |
| Accessible Cyan | `#0E7490` | Links and controls on white |
| Accessible Amber | `#B45309` | Amber text or outline on white |

### Semantic Use

- Cyan means navigation, information, active state, and focus.
- Amber means deliberate emphasis, a selected recommendation, or one primary
  action. It does not mean every clickable item.
- Green, red, and warning amber are reserved for true status messaging. Never
  use clinical-status colors as decoration.
- Affiliate colors may tint a partner profile at low intensity, but the Dr. M
  frame, type, disclosure, and action hierarchy remain in the core palette.
- Use Cloud or Midnight fields to give bright, human photography breathing
  room. A dark background is a foundation, not a requirement for every band.

Aim for roughly 70% neutral fields, 20% cyan/photographic color, and no more
than 10% amber emphasis in a typical composition. Do not blend cyan and amber
across every background. Their contrast and separation are part of the brand.

### Verified Contrast Pairs

The following pairs meet WCAG AA for normal text:

| Foreground | Background | Contrast |
|---|---|---:|
| Cloud `#F1F5F9` | Midnight `#0A0F1A` | 17.49:1 |
| Slate Muted `#94A3B8` | Midnight `#0A0F1A` | 7.47:1 |
| Signal Cyan `#22D3EE` | Midnight `#0A0F1A` | 10.60:1 |
| Warm Amber `#F59E0B` | Midnight `#0A0F1A` | 8.92:1 |
| Ink `#0F172A` | Light Canvas `#F8FAFC` | 17.06:1 |
| Light Muted `#475569` | White `#FFFFFF` | 7.58:1 |
| Accessible Cyan `#0E7490` | White `#FFFFFF` | 5.36:1 |
| Accessible Amber `#B45309` | White `#FFFFFF` | 5.02:1 |

Slate Subtle on Midnight is 4.03:1 and must not be used for normal-size body
copy. Test image overlays against the actual pixels, not a nominal overlay
value.

## 5. Typography

### Typeface

- Primary: Geist Sans, weights 400, 500, 600, and 700.
- Data and technical identifiers: Geist Mono, used sparingly.
- Fallback: system sans-serif.

Use the checked-in Geist variable fonts for owned digital surfaces. For
third-party tools that cannot embed Geist, use Arial or the platform's default
sans-serif rather than substituting a decorative face.

### Hierarchy

| Level | Desktop guidance | Mobile guidance | Weight |
|---|---:|---:|---:|
| Display | 48-56 px / 1.08-1.14 | 34-42 px / 1.10-1.16 | 650-700 |
| Page heading | 36-44 px / 1.15 | 30-36 px / 1.18 | 650-700 |
| Section heading | 28-32 px / 1.2 | 24-28 px / 1.25 | 600-700 |
| Item heading | 20-24 px / 1.3 | 18-22 px / 1.35 | 600 |
| Body | 16-18 px / 1.6-1.75 | 16-18 px / 1.6-1.75 | 400 |
| Label/caption | 12-14 px / 1.4-1.55 | 12-14 px / 1.4-1.55 | 500-600 |

Letter spacing is `0`. Do not compress type with negative tracking or scale text
directly with viewport width. Use responsive steps and constrain line length to
roughly 45-75 characters for reading text.

Use uppercase only for short labels and the display wordmark. Do not uppercase
paragraphs, long buttons, or metadata. Avoid excessive bolding; use hierarchy,
spacing, and color before adding more weight.

## 6. Image And Art Direction

### Brand Hero And Host Photography

The preferred first-viewport signal is the owned brand: the approved mark or
wordmark, a distinctive mountain/path composition, and the Midnight, Signal
Cyan, Warm Amber, and Cloud palette. The website hero must remain recognizable
as Dr. M Experienced even when Dr. Musnick is not pictured.

- Use the mountain/path language as a precise brand device, not generic outdoor
  scenery. A route, waypoint, contour, or abstract `M` should carry a clear
  visual role.
- Favor high-key Cloud or daylight fields for the primary website hero so the
  experience does not become uniformly dark.
- Keep generous negative space for responsive copy and preserve the focal mark
  or landscape through the documented mobile crop.
- The homepage hero uses separate desktop, tablet, and mobile compositions
  behind centered live copy. Use only a restrained uniform readability wash;
  never separate the art into a top strip or put the copy inside a card.
- Desktop parallax uses independently authored far-terrain, route, and
  foreground planes. Use eased scroll progress, not cursor tracking. Let the far
  plane, route, and near plane lag page scroll by 8, 30, and 64 CSS pixels over
  the first 70 percent of the hero interval. Use only this viewport-lagging
  direction so the 24-pixel authored bleed remains covered as the hero exits.
  Remove motion for reduced motion, hoverless devices, coarse pointers, tablet,
  and mobile.
- Supply density-aware sources up to at least 4096 pixels wide for a desktop
  hero. Do not transform-scale a low-resolution master to create motion bleed.
- Use an approved real portrait selectively on About, host profile, press-kit,
  guest, and occasional campaign surfaces where identifying the person is the
  actual communication goal.
- The homepage `Your host` band may use one approved portrait as host evidence.
  It must remain a static supporting image and must not be repeated in the hero.
- Do not repeat the same portrait or sketch across the hero, avatar, cover,
  banner, thumbnail, and host section. One surface should not become the whole
  identity system.
- The existing sketch is an interim host asset only after usage rights are
  confirmed. Do not synthesize a realistic likeness and present it as
  documentary photography.

Avoid anonymous stock doctors, staged handshakes, fake patient encounters,
dark blurred rooms, bokeh, decorative color clouds, and images that imply a
procedure or outcome not discussed.

### Episode Art

The approved episode family uses premium scientific editorial illustration:
deep slate, a clear cyan structure, and restrained amber emphasis. Each image
must have one inspectable topic subject and remain free of embedded text,
numbers, logos, watermarks, identifiable people, fake clinical scans, gore, and
treatment promises.

Maintain continuity through lighting, palette, and rendering quality, not by
reusing the same brain composition. Introduce topic-specific hues where they
improve recognition, while keeping cyan and amber as the shared anchors.

Website episode art remains text-free because the responsive layout supplies
the title and metadata. A direct-video variant may add a four-to-seven-word
topic hook only after a measured platform test and separate approval.

### Blog And Educational Art

- Prefer editorial photography, accurate diagrams, or a single explanatory
  visual that matches the article.
- Use brighter fields and real-world context more often than episode art so the
  editorial system does not become uniformly dark.
- A diagram must label uncertainty and must not resemble a diagnostic image if
  it is illustrative.
- Do not place long titles inside article hero images; the page owns the title.

### Affiliate And Product Imagery

- Use the partner's official logo and an inspectable image of the exact product
  being recommended, with permission or an allowed product-media source.
- Keep the official logo unmodified and within its own clear-space rules.
- A partner's brand color may tint one background strip, rule, or low-opacity
  field. It must not replace Dr. M cyan or amber in navigation and actions.
- The product name and verified destination must remain readable without the
  logo. Visual recognition supplements, rather than replaces, explicit copy.
- Do not invent an exact product, product image, endorsement, or destination.

## 7. Website And Product Experience

### Information Architecture

- Use full-width bands with a constrained inner column.
- Use cards for repeated items, product profiles, modals, and framed media only.
- Do not put cards inside cards or wrap every section in a floating panel.
- Keep the first viewport focused on the brand, current content, and direct
  watch/listen choices. Host identification belongs in the name/host lockup and
  does not require a portrait in every hero.
- A latest-episode video or thumbnail should be a first-class media module, not
  a small nested preview buried below multiple containers.
- Keep the platform rail visually centered and easy to scan.

### Mobile

- Center identity, page headings, short introductions, primary actions, and
  compact platform controls on small screens when doing so improves balance.
- Keep paragraphs, lists, medical explanations, and dense metadata left-aligned
  for reading.
- Use 44 x 44 CSS pixel minimum touch targets and at least 8 pixels between
  adjacent targets.
- Put common mobile actions in reachable, predictable positions. Do not rely on
  centering body text as a substitute for reachable controls.
- Keep topic and article tag rails to one line with horizontal overflow and a
  visible or familiar scroll affordance. Do not let tag pills build a tall wall.
- Test at 320, 375, 390, and 430 CSS pixels, at 200% zoom, and in both themes.

### Shape And Depth

- Default radius: 6 px. Maximum routine card radius: 8 px.
- Pills are reserved for filters, platform badges, tags, and statuses.
- Use borders and field changes before shadows. Shadows should express real
  layering, not decorate every item.
- Parallax may provide subtle depth to a brand or media profile only when the
  content remains fully usable without it and `prefers-reduced-motion` removes
  the transform.

## 8. Production System By Format

Create one master composition per purpose. Do not stretch one universal image
across incompatible crops.

| Asset | Master | Primary export and safe-area rule |
|---|---|---|
| Horizontal logo | Vector | SVG plus transparent PNG at 2x and 4x |
| Stacked logo | Vector | SVG plus transparent PNG at 2x and 4x |
| Logo mark | Vector | SVG; PNG at 512, 180, 48, 32, 24, and 16 |
| Social avatar | 1200 x 1200 | JPG/PNG; face and mark circle-safe in center 70% |
| Podcast show cover | 3000 x 3000 RGB | High-quality JPG, solid background, no alpha |
| Episode square | 3000 x 3000 RGB | High-quality JPG; one topic subject, no required text |
| Long-video thumbnail | 3840 x 2160 | JPG at 1920 x 1080; critical content inside 90% |
| Website episode art | 1600 x 900 | WebP plus source master; text-free |
| Reel/video canvas | 1080 x 1920 | H.264 MP4; essential content away from UI edges |
| Reel cover | 1080 x 1920 master | JPG; verify current cover and profile-grid previews |
| Square social post | 1080 x 1080 | JPG/PNG; critical content inside center 84% |
| Landscape social/OG | 1200 x 630 | JPG/PNG; 72 px minimum inner margin |
| YouTube banner | 2560 x 1440 | JPG/PNG, <=6 MB; copy/logo inside 1544 x 423 center |
| Lower third | 1920 x 1080 template | Transparent overlay; identity inside title-safe area |
| Title card | 3840 x 2160 master | 1920 x 1080 output; one title plus optional subtitle |
| End screen | 3840 x 2160 template | 5-8 seconds; reserved next/subscribe slots |
| Intro sting | 3840 x 2160 master | 0.75-1.5 seconds, with and without audio |
| Letterhead | US Letter and A4 | PDF/X-ready plus editable source |
| Presentation | 16:9 | 1920 x 1080 layout source and PDF export |

Apple accepts RSS show art from 1400 x 1400 through 3000 x 3000 and prefers the
largest size. The production standard is 3000 x 3000, PNG or JPG, RGB, solid
background, and no alpha. Use a new filename and URL for a replaced podcast
cover so directory caches can detect the change.

Meta accepts multiple Reel ratios, but the production standard is full-screen
9:16 at 1080 x 1920. Cover and profile crops change independently, so verify
the live platform preview instead of relying on one assumed safe-area template.

### Podcast Cover

- Lead with the approved wordmark and standalone mark or mountain/path system.
- A portrait may support the cover only when it improves tested recognition; it
  is not mandatory and must not replace the brand architecture.
- Make `DR. M EXPERIENCED` legible at 64 pixels.
- Keep `with Dr. David Musnick` present but subordinate.
- Use no episode title, platform logo, microphone icon, credentials paragraph,
  URL, or small-print tagline.
- Review against both light and dark directory backgrounds.

### Avatar

The primary show/channel avatar is the approved standalone mark. Use an
approved portrait for Dr. Musnick's personal profile, press biography, or a
campaign where host recognition is the purpose. Test both at 32 pixels in a
circle and never place the full show name inside an avatar.

### Video Thumbnail

- One subject, one focal plane, and at most one short hook.
- Keep faces large enough to identify and products large enough to inspect.
- Use an amber accent for the key idea, not a full amber field.
- Avoid numbered badges unless series order is essential to understanding.
- Do not use shock expressions, fake medical scans, red arrows, excessive
  circles, or copy that promises a result the episode does not support.

### Reel And Short-Form Cover

- Start the video with content; do not add an opening splash slate.
- Use a short topic hook on the cover, never the full show description.
- Keep the face and hook away from top/bottom interface controls and validate
  the selected cover in both the Reel and profile-grid previews.
- Existing published Instagram covers are not to be deleted and reposted only
  for cosmetic consistency.

### Lower Third

- First line: `David Musnick, MD` or the exact approved on-screen form.
- Second line: one relevant role or credential, not a credential inventory.
- Use a Slate Surface field, Cloud type, one Signal Cyan rule, and an optional
  small Warm Amber index.
- Enter in 180-250 ms and exit in 150-220 ms. Hold long enough to read twice.
- Do not cover the speaker's mouth, captions, or platform controls.

### Title Card And Sting

- A title card contains one title and, when needed, one short subtitle.
- Long-form content opens on the useful hook. The sting follows the cold open.
- Animate the mark through a simple reveal or path movement. Do not use lens
  flares, particle fields, rapid flashes, or a long logo animation.
- Supply a silent sting and a version with an owned, rights-cleared sound.

### End Screen

- Reserve two stable content regions for the next episode and subscribe action.
- Use the show lockup once, not in every region.
- Keep the background calm enough that platform overlays remain legible.
- Hold 5-8 seconds and include no health promise or time-sensitive claim.

### Letterhead And Documents

- Use the horizontal lockup at the top with at least 0.75 inch / 19 mm page
  margins.
- Use Midnight text on white paper, a thin cyan rule, and amber only for a small
  index or callout.
- Put contact details and the educational disclaimer in the footer when
  relevant. Do not put private clinical contact information into public media.
- Body text is 10.5-12 pt with 1.35-1.5 line height; headings use Geist Sans.
- Provide accessible tagged PDF exports with a logical reading order.

### Presentation And Media Kit

- Begin with the approved show identity, short display name, host line, and one
  sentence describing the show. Place an approved portrait in the host biography
  section rather than making it the kit's visual identity.
- Include approved bio, topic areas, selected episode links, platform links,
  contact route, and usage terms for supplied images.
- Supply horizontal and vertical portraits with photographer credit and usage
  restrictions in metadata, never only in a separate email.

## 9. Accessibility And Safety

- Meet WCAG 2.2 AA: 4.5:1 contrast for normal text, 3:1 for large text and
  essential graphics, and visible keyboard focus.
- Never encode topic, recommendation, or status by color alone.
- Provide meaningful alt text for informative images and empty alt text for
  decorative repetition.
- Caption all spoken video and provide corrected transcripts for long-form
  episodes. Identify speakers when more than one person is present.
- Avoid flashes above three per second and rapid high-contrast patterns.
- Honor `prefers-reduced-motion`; remove parallax and nonessential transforms.
- Keep touch targets at least 44 x 44 CSS pixels.
- Check responsive text at 200% zoom and reflow at 320 CSS pixels without
  horizontal page overflow.
- Do not use AI-generated or illustrative medical imagery in a way that could
  be mistaken for a patient record, diagnostic scan, real product result, or
  documentary photograph.

## 10. Motion And Audio

- Interaction transitions: 150-220 ms.
- Section reveals: 220-400 ms, once, with no scroll-jacking.
- Parallax: no more than 8-16 CSS pixels of travel over the viewport and never
  on reading text or primary controls.
- Easing: standard ease-out for entry, ease-in for exit.
- Keep hover movement to 2-4 pixels and preserve stable layout dimensions.
- Brand sound: brief, calm, modern, and rights-cleared. Avoid a hospital chime,
  heartbeat alarm, or cinematic impact that overstates the content.
- Loudness and final mix remain governed by the episode production workflow;
  never normalize a published master without a new approved export.

## 11. Do And Do Not

### Do

- show Dr. Musnick early on host-specific surfaces without making his portrait
  the default artwork for the show
- preserve the exact full name and host relationship
- use cyan and amber as separate, purposeful signals
- balance deep slate with daylight, white space, and human imagery
- use topic-specific art and inspectable product imagery
- keep platform choices and primary actions easy to reach on mobile
- verify every crop, link, contrast pair, and export before release
- record rights, dimensions, hashes, and approval in the asset manifest

### Do Not

- substitute a new teal, charcoal, purple, or generic wellness palette
- treat an emoji, plain `M` tile, or generated draft as the finished logo
- hide useful media inside layers of nested cards
- make every section dark, bordered, rounded, or center-aligned
- reuse the same portrait across hero, cover, avatar, banner, and thumbnails
- put long copy, multiple logos, or credential lists into a thumbnail
- use fake scans, anonymous stock doctors, treatment promises, or alarm copy
- recolor partner logos or let affiliate branding replace the Dr. M frame
- publish an asset before its rights, exact destination, and owner approval are
  recorded

## 12. File Naming And Export Control

Use lowercase ASCII, hyphens, explicit role and ratio, and a zero-padded export
revision. Do not use `final`, `final-final`, spaces, or platform names when one
shared export is truly identical.

Examples:

```text
drm-brand-logo-horizontal-fullcolor-v1.svg
drm-brand-logo-mark-cloud-v1.svg
drm-brand-podcast-cover-1x1-v01.jpg
drm-brand-youtube-banner-16x9-v01.png
drm-e008-topic-slug-thumbnail-16x9-v01.jpg
drm-e008-topic-slug-episode-art-1x1-v01.jpg
drm-e008-topic-slug-reel-cover-9x16-v01.jpg
drm-brand-lower-third-16x9-v1.mov
```

- Use semantic versioning for reusable masters and templates.
- Use a zero-padded revision for rendered episode or campaign exports.
- A changed binary gets a new revision, SHA-256, and approval record.
- Preserve source files separately from exports. Do not overwrite the approved
  master in place.
- Strip location and unrelated personal metadata from public exports while
  retaining required creator, rights, and color-profile metadata.
- Export raster files in sRGB unless a documented print workflow requires
  another profile.

## 13. Approval, Governance, And Versioning

### Asset States

| State | Meaning |
|---|---|
| `draft` | Working file; not authorized for public use |
| `review` | Exact export is ready for owner comparison |
| `approved` | Owner approved the exact binary and intended roles |
| `published` | Approved binary was verified at the recorded destination |
| `retired` | Preserved for history but prohibited in new work |

Approval attaches to an exact file, not a concept, prompt, or filename. Record
relative path, role, media type, dimensions or duration, SHA-256, rights status,
approval date, approver, and each published destination in the appropriate
manifest or rollout receipt.

### Logo Approval Gate

The logo family becomes final only after all of these are complete:

1. rights and originality review
2. comparison of two or three vector directions
3. owner selection of one direction
4. small-size, circular-crop, grayscale, light, and dark tests
5. accessibility and reproduction review
6. complete horizontal, stacked, mark, one-color, and small-size exports
7. hashes and explicit owner approval recorded in the asset manifest

Until then, label every logo usage `provisional` in production records.

### Change Control

- Patch version: wording, export clarification, or no-change accessibility
  correction.
- Minor version: new format or template that does not change core identity.
- Major version: name, logo architecture, core palette, typography, or voice.
- A major version requires owner approval and a coordinated platform rollout.
- Do not update platform artwork merely because a local mockup changed.
- For podcast art, use a new filename/URL and verify feed plus directory
  propagation before closing the change.

Review the guide quarterly, after a platform changes its artwork UI, and before
a major campaign or channel launch.

## 14. Current Asset Status And Drift Audit

### Established And Approved

- Canonical full name, short name, host line, short description, and title
  policy are controlled by the master catalog and operations manual.
- The original core palette is Midnight `#0A0F1A`, Signal Cyan `#22D3EE`, Warm
  Amber `#F59E0B`, Cloud `#F1F5F9`, and supporting slate values.
- Geist Sans and Geist Mono are checked into the website and form the type
  system.
- Seven episode-specific 16:9, website WebP, and 3000 x 3000 image families are
  approved and recorded in `asset-manifest.json`.
- The identity architecture calls for a prominent show wordmark, subordinate
  host line, and simple `M`/mountain-path mark.

### Provisional Or Incomplete

- Show Brand Package `1.0.0-rc1` is mounted locally with exact hashes in the
  operations catalog, but remains in `review_owner_approval_required` state.
- The Cutline logo family, portrait-free podcast cover, avatar, YouTube banner,
  Open Graph image, lower third, silent sting, silent end screen, and letterhead
  are review candidates, not approved or published assets.
- The mountain favicons, former mountain emoji, and current website `M` tile do
  not form one approved logo family.
- Host-specific press assets still need a high-resolution portrait and rights
  confirmation. The checked-in 1024 x 1024 sketch is an interim candidate only;
  it is not required for show covers, banners, avatars, or episode art.
- Recent website variables changed the approved deep slate and vivid cyan to
  charcoal `#0B0E0F` and soft teal `#59C4C8`. That change is visual drift and is
  not a new brand decision.

## 15. Official Production References

- Apple Podcasts Show Cover:
  <https://podcasters.apple.com/support/5514-show-cover-template>
- Apple Podcasts artwork policies:
  <https://podcasters.apple.com/5510-artwork-policies>
- Apple Podcasts artwork system guidance:
  <https://podcasters.apple.com/support/1647-podcast-artwork>
- YouTube channel branding dimensions:
  <https://support.google.com/youtube/answer/10456525>
- YouTube channel brand guidance:
  <https://support.google.com/youtube/answer/12950272>
- Instagram Reel ratios and cover guidance:
  <https://www.facebook.com/help/instagram/1038071743007909>

When a platform requirement conflicts with this guide, preserve the brand rules
and create a purpose-built compliant export. Update this guide only after
checking the platform's current official documentation.
