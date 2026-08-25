# Cartographic Hero V2

- Status: `review`
- Role: full-bleed homepage hero background with art-directed mobile crop
- Generation method: OpenAI built-in image generation, followed by local WebP
export at quality 88 with metadata stripped

## Exports

| Role | Website path | Dimensions | SHA-256 |
|---|---|---:|---|
| Panoramic | `public/images/brand/hero-brand-cartography-v2.webp` | 1881 x 836 | `ca944a75585bb7f77fa126d4e4d320d359ddac39506992bb9ffb9813205791b5` |
| Mobile | `public/images/brand/hero-brand-cartography-v2-mobile.webp` | 971 x 1619 | `8052c4d87d8b1a51a0aa8077632eecdcea71e11a3b9e3dde750157463b464f36` |

These are review assets, not approved cross-platform masters. The website uses
them so the owner can judge the real centered composition, responsive crops,
and background-only parallax before approval.

## Direction

- High-key Mountain West terrain is interpreted through scientific cartography
  rather than stock scenery or a literal medical illustration.
- Midnight outer terrain supplies authority; pale slate mountains and Cloud
  paper keep the hero inviting.
- Signal Cyan contours and sparse measurement nodes express evidence and
  connected systems.
- One restrained Warm Amber route and waypoint express experienced progress.
- The copy field stays calm and low contrast while the outer and lower edges
  carry the stronger visual information.
- No portrait, text, brain, medical icon, logo, microphone, or fake scan appears
  in either asset.

## Prompt Record

The panoramic prompt requested a cohesive ultra-wide Mountain West dawn in a
premium editorial printmaking and cartographic style. It specified strong
terrain in the lower and outer thirds, a broad central reading field, exact
Midnight/Cyan/Amber/Cloud anchors, continuous parallax bleed, and no embedded
copy, portrait, medical cliché, stock-photo treatment, gradient, glow, or dark
overall exposure.

The mobile prompt used the panoramic output as a style reference and requested
a new vertical companion rather than a crop. It retained the paper, contour,
node, terrain, route, and waypoint language; placed light ridges across the
upper field and dark terrain only at the lower corners; and preserved the
middle for the two-line title, actions, and platform rail.

## Implementation Contract

1. Use the mobile export at widths below 640 CSS pixels and the panoramic export
   at 640 pixels and above.
2. Treat both images as decorative. The live page supplies the accessible name
   and all text.
3. Apply motion only to the overscanned background layer. Copy and controls must
   never transform.
4. Keep combined pointer and scroll travel at or below 16 CSS pixels.
5. Disable parallax for reduced motion, coarse pointers, and hoverless devices.
6. Use one uniform readability wash across the full hero, never a copy card or
   split text/media layout.
7. Verify the first viewport at 320, 375, 390, 768, 1024, 1280, and 1440 CSS
   pixels in both site themes before promotion.

## Approval Checks

1. Confirm the scene reads as Dr. M Experienced rather than a tourism or outdoor
   equipment brand.
2. Confirm the centered content remains readable without hiding the artwork.
3. Confirm the vertical companion feels like the same system as the panorama.
4. Confirm the parallax is perceptible but does not compete with the content.
5. If approved, promote both hashes into `asset-manifest.json` and derive the
   matching Open Graph, channel-banner, and presentation backgrounds.
