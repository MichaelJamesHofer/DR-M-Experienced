# Short-form content system

Last verified: August 8, 2026.

This runbook covers Instagram Reels, recipe clips, educational excerpts, their
local masters, Vimeo hosting, and website projection. Short-form items are not
podcast episodes and must never be assigned an RSS GUID or episode number.

## Authority and flow

The machine-readable authority is `publishing/short-form-catalog.json`, validated
by `publishing/short-form-catalog.schema.json`. Each item has a stable,
platform-neutral ID and slug, canonical website copy, exact destination copy,
fingerprinted local master, checked-in poster, and verified remote IDs.

```text
DaVinci or camera sources
  -> project-scoped Dropbox master with SHA-256 and byte size
  -> publishing/short-form-catalog.json
  -> Vimeo distribution/recovery copy where available
  -> Instagram Reel
  -> /shorts/<slug>/ on drmexperienced.com
```

Dropbox is the binary authority. Vimeo is the preferred playback host and a
remote recovery copy; it is not a co-master. Instagram and the website are
destinations. RSS.com remains exclusively responsible for podcast audio and has
no role in short-form distribution.

Validate metadata and checked-in posters:

```bash
node scripts/publish/short-form-catalog.mjs
node --test scripts/publish/short-form-catalog.test.mjs
```

On the configured workstation, rehash the Dropbox masters and sources too:

```bash
HOME=/home/otto USER=otto npm run verify:shorts
```

Any changed master byte invalidates the catalog fingerprint and requires a new
review before a replacement or new upload.

## Verified public inventory

| Stable content ID | Canonical title | Instagram | Vimeo | Website | Local master |
|---|---|---|---|---|---|
| `short-brain-fog-what-it-feels-like` | What Brain Fog Really Feels Like | media `3818274203859121888`, Reel `DT9PCiID3bg` | video `1216695521` | `/shorts/what-brain-fog-feels-like/` | `dropbox:Dr.M Podcast/Episode 1 - Brain Fog - Part 1/Insta/Dr. M - EP1 - Brain Fog Part 1 - Rev. 1.mov` |
| `short-brain-fog-testing-and-basic-solutions` | Brain Fog: Testing and Foundational Support | media `3818276316521641998`, Reel `DT9PhRsjzgO` | video `1216695522` | `/shorts/brain-fog-testing-and-basic-solutions/` | `dropbox:Dr.M Podcast/Episode 1 - Brain Fog - Part 2/Insta/Dr. M - EP1 - Brain Fog Part 2 - Insta - Rev. 1.mov` |
| `short-cilantro-basil-pesto` | Cilantro-Basil Pesto with Broccoli Sprouts | media `3928186163131134659`, Reel `DaDuIDBCTLD` | video `1204939542` | `/shorts/cilantro-basil-pesto-with-broccoli-sprouts/` | `dropbox:Insta Shorts/renamed/recipes/Pesto/Pesto v2.mp4` |

The three public Instagram durations match their local masters within normal
platform-transcode tolerance. Their captions are distinct; no duplicate caption
was found. The Pesto Reel and Vimeo video are the same 143.936-second vertical
edit. `Pesto.mp4` is a different prior render and is not the bound master.

All three Vimeo copies now match the catalog's canonical title, description, and
selected poster. The checked-in posters were captured from the three public
Instagram posts so the website does not depend on expiring CDN URLs. All three
website routes were deployed and independently verified on August 8, 2026.

## Website behavior

Every catalog item receives a static route at `/shorts/<slug>/` and a card in
the Media page. The content ID and website route do not change when a destination
is added or removed. A Vimeo-bound item embeds Vimeo with a privacy-enhanced,
click-to-load player. An item without a Vimeo short displays its poster and links
to the existing Instagram Reel until its Vimeo ID is recorded.

When a missing Vimeo short is uploaded, update only that item's
`destinations.vimeo` object and increment the catalog revision. The website then
switches from the poster/link state to Vimeo playback without changing its URL.

## Authenticated actions still required

Vimeo reconciliation and website deployment are complete. The remaining setup
work is for future publishing automation:

1. In Instagram Edit Profile, add `https://drmexperienced.com/` as the external
   website. Leave the account as a Creator professional account.
2. Configure one official Meta API flow. For direct local-file resumable uploads,
   use Facebook Login for Business, link the Creator account to a minimal
   Facebook Page, and grant `instagram_basic`, `instagram_content_publish`, and
   `pages_read_engagement`. Linking a Page does not convert the Instagram account
   to Business.
3. Read the publishing account ID from the authenticated Graph response and
   store it with the Page token under `~/.config/drm-publisher/`; do not assume
   public profile ID `80068141150` is the publishing ID and do not commit tokens.
4. Confirm read-only access first. Instagram has no durable private publishing
   draft, so do not call `media_publish` until the exact asset, caption, and
   public release are approved.
5. In Vimeo's developer portal, the owner must accept the Developer Addendum and
   Terms before creating the prepared private app. Then create an own-account
   upload/edit token under `~/.config/drm-publisher/`; never commit the token.

The alternative Meta flow, Instagram API with Instagram Login, does not require
a linked Facebook Page. It uses an Instagram User token and the
`instagram_business_basic` and `instagram_business_content_publish` permissions,
but Meta requires the media to be available at a public URL for that flow. Use a
short-lived staging object and remove it after processing if this route is chosen.
Meta's current documentation reserves local resumable upload for Facebook Login
for Business.

## Recovery

If a short is missing from a platform:

1. Locate it by stable catalog ID, never by filename alone.
2. Run `npm run verify:shorts` before any upload.
3. Compare the current public media ID, duration, caption, and poster with the
   catalog. Do not create a replacement when an in-place edit is sufficient.
4. If the remote item was deleted, upload the fingerprinted master, record the
   new remote ID, and keep the catalog ID and website slug unchanged.
5. Verify the public result independently and update the catalog timestamp.

If the local file hash differs, stop. Determine whether it is an intentional new
render, fingerprint it as a new revision, and obtain approval before replacing a
published item.

## Official references

- Meta content publishing: <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing/>
- Meta Instagram Login setup: <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/get-started/>
- Vimeo video upload API: <https://developer.vimeo.com/api/upload/videos>
- Vimeo authentication: <https://developer.vimeo.com/api/authentication>
- Vimeo thumbnail management: <https://help.vimeo.com/hc/en-us/articles/12426471350289-How-to-change-the-thumbnail-image-for-my-video>
