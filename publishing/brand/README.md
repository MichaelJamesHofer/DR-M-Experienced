# Brand Asset Production Brief

Status: the seven episode-specific website thumbnails, 16:9 direct-video
exports, and 3000 x 3000 podcast episode-art exports are approved. The direct
video set is live on YouTube, Vimeo, Rumble, and Spotify; the square set is live
on Spotify and in the canonical RSS. Apple propagation is pending after a feed
refresh. The logo, show cover, avatar, Reel covers, banners, Open Graph image,
and motion assets remain planned.

This directory will hold versioned masters, export settings, and a non-secret
asset manifest for the Dr. M Experienced visual system. Do not commit licensed
source photography unless repository publication rights are confirmed. Private
photo masters may remain in an owner-only working directory while approved
exports are committed or hosted deliberately.

## Identity

- Primary: `DR. M EXPERIENCED`
- Host line: `with Dr. David Musnick`
- Standalone mark: a simple `M`/mountain-path symbol
- Do not use `DRM` as the primary name
- Palette direction: charcoal, white, cyan, and amber with strong contrast
- Preferred portrait: an approved high-resolution real head-and-shoulders photo
- Interim portrait: the existing sketch only after its usage rights are confirmed

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

- Podcast cover: real face, large show name, smaller host line, no episode copy.
- Website episode thumbnail: inspectable topic image without embedded copy; the
  responsive site supplies the title, number, duration, and state overlays.
- Direct-video thumbnail: prefer the approved inspectable, text-free topic
  image. Add short copy or a small brand mark only when a measured platform test
  demonstrates a clear benefit and a separately approved export is available.
- Reel cover: hook/topic only; keep face and copy inside the center-safe crop.
- Long-form video: cold open first, then the short sting.
- Reels: start with content. Do not add an opening splash slate.
- Website: no splash gate. Use a real host/recording image in the first viewport
  and a dedicated Open Graph image for shared links.

## Approval And Release

1. Confirm portrait/sketch/logo rights.
2. Produce two or three directions.
3. Review each at full size, 64 pixels, circular crop, grayscale, light mode,
   and dark mode.
4. Approve one direction and freeze its colors, type, clear space, and mark.
5. Record each master/export path and SHA-256 in `asset-manifest.json`.
6. Replace website icons/OG image and direct-channel avatars/banners.
7. Publish the approved podcast cover through the canonical Spotify/Anchor show
   under a new filename/URL, then verify Spotify and Apple propagation. Verify
   Amazon after its one-time Anchor-feed submission.
8. Completed: publish the seven clean episode-specific images to the website,
   YouTube, Vimeo, Rumble, and both Spotify artwork surfaces. The canonical RSS
   now exposes seven unique 3000 x 3000 item images; an Apple feed refresh was
   requested. Existing Instagram Reel covers cannot be replaced through the
   documented post-publication workflow and must not be deleted/reposted merely
   for cosmetic convergence.

The website catalog, fallback data, and Supabase projection now use the approved
local artwork. The master catalog remains authoritative, so remote
`vumbnail.com` URLs cannot overwrite these derivatives during sync or recovery.

Exact website and platform export paths, dimensions, SHA-256 values, generation
method, and subject concepts are recorded in `asset-manifest.json`. Remote IDs
and rollout verification are recorded in
`publishing/episode-thumbnail-rollout.json`.

See `docs/operations-manual.md`, Sections 12-13, for the cross-platform sequence.
