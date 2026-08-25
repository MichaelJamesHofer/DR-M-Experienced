# Layered Cartographic Hero V3

- Status: `review`
- Role: full-bleed homepage hero with true depth parallax and responsive art direction
- Generation method: OpenAI built-in image generation; local chroma-key extraction;
local Real-ESRGAN `realesrgan-x4plus` restoration; downsampled WebP production exports

V3 replaces the flattened V2 panorama. The desktop scene now uses an opaque
distant landscape, a separately transparent foreground ridge, and a vector
amber route. Tablet and mobile use native static compositions because their
aspect ratios and touch interaction do not benefit from the desktop plates.

## Production Exports

| Role | Website path | Dimensions | Bytes | SHA-256 |
|---|---|---:|---:|---|
| Desktop base 1x | `public/images/brand/hero-cartography-v3/desktop-base-1920.webp` | 1920 x 853 | 103,738 | `565552a181bfd9dfe06b696c7564494bde4184663ff462754fcd6d4bc557f279` |
| Desktop base 1.5x | `public/images/brand/hero-cartography-v3/desktop-base-2880.webp` | 2880 x 1280 | 187,698 | `413ea4445b75ecd6c746b6cb47d5748312cb7dc57c00e4f1606b0c8336c51303` |
| Desktop base 4K | `public/images/brand/hero-cartography-v3/desktop-base-4096.webp` | 4096 x 1820 | 301,804 | `20967048b0f4683ac32a4a2935c9153ef2bb5104d5126190efda72b966bf9204` |
| Desktop foreground 1x | `public/images/brand/hero-cartography-v3/desktop-foreground-1920.webp` | 1920 x 853 | 69,850 | `a929d500488cd306e7c9d1755fbbe30b38e4e70d8265d81dbb36dc447ae65338` |
| Desktop foreground 1.5x | `public/images/brand/hero-cartography-v3/desktop-foreground-2880.webp` | 2880 x 1280 | 128,134 | `0e2d88d4261f3dcdfb31857ff74b696c7a2cb787f1663eeb17716826bf430697` |
| Desktop foreground 4K | `public/images/brand/hero-cartography-v3/desktop-foreground-4096.webp` | 4096 x 1820 | 206,788 | `86270431a5ef81f060206a3d1e9731a9d4a0935d3a733e1b6b7952d1ef65df3b` |
| Tablet 1x | `public/images/brand/hero-cartography-v3/tablet-1440.webp` | 1440 x 1080 | 84,684 | `6d8db171438b5631fd47d697294e2205c434cbca968496932618b9c1571d0356` |
| Tablet 1.5x | `public/images/brand/hero-cartography-v3/tablet-2160.webp` | 2160 x 1620 | 151,276 | `7b089f3dc0eafe0551bd3b1a99c5cf326fe28fddab35d312446b1029c0591378` |
| Mobile 1x | `public/images/brand/hero-cartography-v3/mobile-960.webp` | 960 x 1707 | 104,414 | `ed78440351ba531d87243e72e7401681e58fcb7d6ce5989ae83771169fa1bec7` |
| Mobile high density | `public/images/brand/hero-cartography-v3/mobile-1440.webp` | 1440 x 2560 | 188,366 | `dc8c499951a62b79e31460ab0bc28329268e03fa08f26e0a0790f188fad96d69` |

The maximum desktop pair totals 508,592 bytes. Only the responsive base image
receives high fetch priority. The transparent foreground remains a secondary
decorative decode.

## Direction

- Mountain West terrain is rendered as precise alpine architecture rather than
  a tourism photograph or a fuzzy generated painting.
- Pale distant ridges and a mineral-white topographic field carry the live
  centered copy without a card.
- Midnight foreground shoulders with cyan measurements provide brand contrast
  and the near depth plane.
- A code-native amber route and waypoint remain sharp at every density and form
  the middle depth plane.
- Desktop, tablet, and mobile are separate compositions. Do not crop the wide
  master into the narrow layouts.
- No portrait, embedded text, logo, brain, medical icon, microphone, fake scan,
  or stock-health imagery appears in the scene.

## Motion Contract

1. Keep all live copy and controls stationary.
2. At 900 CSS pixels and above, let the far plate, amber route, and foreground
   lag the page scroll downward by 8, 30, and 64 pixels respectively. Complete
   that travel over the first 70 percent of the hero scroll interval so the
   depth change is perceptible while the scene remains on screen.
3. Ease toward one scroll-progress value. Do not track the cursor and do not
   snap any layer back on pointer leave.
4. Keep 24 pixels of authored layout bleed on every desktop layer and use only
   the downward, viewport-lagging direction. The hero's upward page travel must
   clear the leading edge before transformed travel exceeds that bleed. Do not
   use a transform scale that softens the raster.
5. Disable motion for reduced-motion preferences, hoverless devices, coarse
   pointers, tablet, and mobile.
6. Toggle `will-change` only while the hero intersects the viewport.
7. Request one base image per breakpoint and one foreground image only on
   desktop. Do not preload every density.

## Prompt Record

The desktop direction requested a completely redrawn 2.25:1 alpine valley in a
high-end architectural and Swiss editorial-cartography style: sharp etched rock,
calm central reading field, mineral white and pale ice gray, midnight outer
ridges, restrained cyan measurements, and one amber navigation accent. A
second generation removed all foreground and accent information to create the
opaque back plate. A third generation recreated only the aligned midnight ridge
on a removable magenta field for alpha extraction.

The tablet prompt requested a native 4:3 composition with terrain confined to
the lower and outer thirds. The mobile prompt requested a native 9:16 valley
with a calm central column and mountain structure framing rather than covering
the live identity.

## Approval Checks

1. Inspect standard and high-density screens at 390, 768, 1440, 1920, and 3840
   CSS pixels.
2. Confirm the terrain reads as a health-education identity rather than an
   outdoor recreation brand.
3. Confirm the desktop depth is noticeable during scroll without making the
   content appear to move.
4. Confirm tablet and mobile feel like the same scene without hidden brand
   anchors or text collisions.
5. After owner approval, promote the V3 hashes into `asset-manifest.json` and
   derive the matching Open Graph and channel-banner family.
