# Show Brand Package 1.0.0-rc1

- Status: `review_owner_approval_required`
- Direction: `02 - Cutline`
- Canonical title: `Dr. M Experienced, with Dr. David Musnick`
- Remote publishing authorized: **no**

This is the first complete production candidate for the show-level identity. It
uses the portrait-free Layered Cartographic Hero V3 art, the established
Midnight/Signal Cyan/Warm Amber palette, and an outlined Cutline lockup. It does
not replace any live website or platform asset until the owner approves the
exact exports and their intended destinations.

## Contents

- `source/`: editable SVG masters for the horizontal and stacked lockups, mark,
  cover, banner, Open Graph image, letterhead, lower third, intro frame, and end
  screen
- `exports/`: raster, PDF, and silent MP4 review exports
- `package-manifest.json`: dimensions, SHA-256 values, source-art provenance,
  approval state, and the seven catalog-mounted Dropbox aliases
- `motion-spec.json`: timing, placement, and end-screen overlay regions

The exact Dropbox review package is preserved at
`brand/masters/1.0.0-rc1/`. Stable aliases in `brand/masters/` exist for catalog
resolution only. They are not evidence of owner approval or public rollout.

## Approval Gate

The owner must explicitly decide all four points before any remote change:

1. approve or reject the Cutline mark
2. approve or revise the exact portrait-free podcast cover
3. approve the small Warm Amber waypoint as the copper accent
4. approve the outlined Inter Display identity exception while Geist remains
   the product and editorial typeface

Approval applies to exact hashes and named destinations. A general preference
for the design direction is not a release authorization.

## Production Notes

- The 16, 24, 32, 48, 180, and 512 pixel mark exports are dedicated small-size
  review files. The avatar is circle-safe.
- The YouTube banner keeps essential identity content inside the centered
  1544 x 423 safe area.
- The intro is 1.2 seconds and the end screen is 7 seconds, H.264, 1920 x 1080,
  30 fps, and silent. Add sound only in a later revision using an explicitly
  approved, rights-cleared master.
- The letterhead SVG is the editable source. The PDF is a one-page visual proof,
  not a tagged accessible document template.
- Any visual or wording change requires a new package version and new hashes.

## Rebuild

From the repository root, with the local Dropbox source configuration present:

```bash
HOME=/home/otto node scripts/brand/build-show-brand-package.mjs
```

The build is deterministic for the checked-in source art, fonts, generator,
and fixed release metadata. Review `package-manifest.json` after every rebuild.
