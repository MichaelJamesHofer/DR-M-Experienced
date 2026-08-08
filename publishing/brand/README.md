# Brand Asset Production Brief

The authoritative cross-channel identity and production standard is
[`media-design-guide.md`](media-design-guide.md). This file remains the concise
asset-production brief and current rollout status; where visual rules conflict,
the media design guide controls.

Status: the seven episode-specific website thumbnails, 16:9 direct-video
exports, and 3000 x 3000 podcast episode-art exports are approved. The corrected
direct-video set is live and verified on YouTube, Vimeo, and Spotify. Rumble's
replacement uploads expired before submission and the existing Episode 7 copy
does not match catalog revision 11; Rumble remains untouched while its written
automation-permission request is pending. The square set is verified in the
canonical RSS.com feed and on Spotify. Apple propagation remains pending on the
directly configured RSS.com listing. Show Brand Package `1.0.0-rc1` now contains
the logo, portrait-free show cover, avatar, YouTube banner, Open Graph image,
letterhead, lower third, silent sting, and silent end screen as hash-recorded
review candidates. None is approved or published.

This directory will hold versioned masters, export settings, and a non-secret
asset manifest for the Dr. M Experienced visual system. Do not commit licensed
source photography unless repository publication rights are confirmed. Private
photo masters may remain in an owner-only working directory while approved
exports are committed or hosted deliberately.

## Identity

- Primary: `DR. M EXPERIENCED,`
- Host line: `with Dr. David Musnick`
- Standalone mark: a simple `M`/mountain-path symbol
- Do not use `DRM` as the primary name
- Palette direction: deep slate, white, vivid cyan, and warm amber with strong contrast
- Primary show signal: approved wordmark plus `M`/mountain-path system
- Preferred host portrait: an approved high-resolution real head-and-shoulders
  photo, used selectively on host-specific surfaces
- Interim host portrait: the existing sketch only after its usage rights are
  confirmed; do not repeat it across the identity system

## Deliverables

| Key | Master | Required exports |
|---|---|---|
| `logoHorizontal` | Vector | SVG, transparent PNG |
| `logoStacked` | Vector | SVG, transparent PNG |
| `logoMark` | Vector | SVG, PNG at 512 and 180 |
| `avatar` | 1200 x 1200 | Circle-safe JPG/PNG, Vimeo 600 x 600 |
| `podcastCover` | 3000 x 3000 RGB | High-quality JPG under host limits |
| `thumbnail16x9` | 3840 x 2160 | JPG at 3840 x 2160 and 1920 x 1080 |
| `reelCover` | 1080 x 1920 | JPG with center-safe text/face composition |
| `youtubeBanner` | 2560 x 1440 | JPG/PNG with centered safe-area content |
| `openGraph` | 1200 x 630 | JPG/PNG |
| `introSting` | 0.75-1.5 seconds | Video with and without audio |
| `endScreen` | 5-8 seconds | 16:9 video/template |
| `verticalClose` | 0-1 second | Optional 9:16 video/template |

## Composition Rules

- Podcast cover: large show name, smaller host line, and approved mark or
  mountain/path system; a portrait is optional, not the identity by itself.
- Website episode thumbnail: inspectable topic image without embedded copy; the
  responsive site supplies the title, number, duration, and state overlays.
- Direct-video thumbnail: prefer the approved inspectable, text-free topic
  image. Add short copy or a small brand mark only when a measured platform test
  demonstrates a clear benefit and a separately approved export is available.
- Reel cover: hook/topic only; keep face and copy inside the center-safe crop.
- Long-form video: cold open first, then the short sting.
- Reels: start with content. Do not add an opening splash slate.
- Website: no splash gate. Lead with art-directed desktop/tablet/mobile brand
  scenes behind the first-viewport identity, use independently authored depth
  planes for desktop parallax, reserve portraits for intentional host surfaces
  such as `Your host`, and use a dedicated Open Graph image for shared links.

## Approval And Release

1. Confirm portrait/sketch/logo rights.
2. Produce two or three directions.
3. Review each at full size, 64 pixels, circular crop, grayscale, light mode,
   and dark mode.
4. Approve one direction and freeze its colors, type, clear space, and mark.
5. Record each master/export path and SHA-256 in `asset-manifest.json`.
6. Replace website icons/OG image and direct-channel avatars/banners.
7. Publish the approved podcast cover through RSS.com under a new filename/URL,
   then verify RSS.com, Spotify, and Apple propagation. Verify Amazon after its
   one-time RSS.com-feed submission.
8. Completed for the website build assets, YouTube, Vimeo, Spotify, and the
   canonical RSS feed: seven clean episode-specific images and seven unique
   3000 x 3000 item images. Rumble is excluded until its automation-permission
   issue is resolved. Apple points directly to RSS.com, but its episode-art and
   five-to-seven episode convergence remain pending. Existing Instagram Reel
   covers cannot be replaced through the documented post-publication workflow
   and must not be deleted/reposted merely for cosmetic convergence.

The website catalog, fallback data, and Supabase projection now use the approved
local artwork. The master catalog remains authoritative, so remote
`vumbnail.com` URLs cannot overwrite these derivatives during sync or recovery.

The show-level candidate package is documented in
[`show-package/1.0.0-rc1/README.md`](show-package/1.0.0-rc1/README.md). Its stable
Dropbox aliases are mounted for integrity checking only; a mount does not grant
release approval.

Exact website and platform export paths, dimensions, SHA-256 values, generation
method, and subject concepts are recorded in `asset-manifest.json`. Remote IDs
and rollout verification are recorded in
`publishing/episode-thumbnail-rollout.json`.

See `docs/operations-manual.md`, Sections 12-13, for the cross-platform sequence.
