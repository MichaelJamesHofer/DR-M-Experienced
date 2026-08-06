# Publishing platform setup

Last verified: August 6, 2026.

The local publisher uses official upload interfaces where they exist, RSS fan-out for podcast directories, and explicit browser handoffs where a supported public creator-upload API is unavailable. Credentials stay outside the repository under `~/.config/drm-publisher/` with owner-only permissions.

## Current inventory

| Destination | Delivery path | Current setup state |
|---|---|---|
| RSS.com | Canonical podcast host | Feed `https://media.rss.com/dr-m-experienced/feed.xml` has seven parity-verified episodes, exact metadata, no `RSSVERIFY`, and no stray season value |
| Spotify for Creators | RSS audio consumer plus optional Spotify-only video replacement | Existing show `7GGLljxmO0G3FLjPy8vfcw` receives RSS.com audio through the verified Anchor 301; preserve the account, redirect, seven episode identities, analytics, and existing video surfaces |
| Apple Podcasts | Episode audio and art directly from RSS.com | Existing show `1870433419` was configured to the exact RSS.com feed at approximately 18:29 UTC on August 6; metadata is exact and token-free, but only five episodes are Available and Draft Episodes 1-2 plus a stale duplicate Episode 4 remain |
| Amazon Music and Audible | Episode audio from RSS.com after one-time claim | Signed-in dashboard has zero claimed shows; submit the canonical RSS.com feed once, complete ownership verification, and record the stable listing ID/URL |
| Podcast Index | Automatic RSS indexing | New RSS.com record `7982906` and old Anchor record `7799755` are both live; verify convergence after the 301 is crawled |
| YouTube | OAuth 2 plus resumable Data API upload | Channel `UCFA1nVv4lKMBlx81gjMAOFQ` exists; upload OAuth and API audit required |
| Vimeo | Vimeo API tus upload | User `253415660` exists; app upload access and token required |
| Instagram | Professional-account API with resumable local upload | Public profile ID `80068141150` has exact name/bio, but no external link and currently reports non-business; professional conversion, app permissions, and a publishing ID remain required |
| Rumble | Local browser handoff | Channel `7820170` exists; no supported public VOD upload API confirmed |

## Remote rebrand status

The canonical short profile description is `Dr. M Experienced, with Dr. David Musnick. Practical insights from decades in sports, regenerative, internal, and functional medicine.` Platform-specific long biographies may add detail after this exact opening.

| Profile | Current public name state |
|---|---|
| Spotify and Apple | RSS.com and the authenticated Apple configuration use exact title/description copy with no `RSSVERIFY`. Spotify preserves all seven episode identities; Apple still exposes only five Available episodes and has three Draft episode records. Preserve Apple show `1870433419` and repair it rather than creating a replacement |
| Amazon | No claimed show exists in the signed-in account; submit the canonical RSS.com feed once and record the resulting stable identity |
| YouTube | Canonical description is published; display name remains `Dr. M Experienced` because the manager-role name save did not persist |
| Instagram | Display name and bio are exact; handle `@drmexperienced` is unchanged. Add the website listening hub as the missing external link and complete professional-account setup |
| Vimeo | Display name is `Dr. M Experienced, David Musnick`, the closest form allowed by Vimeo's 32-character limit; the bio begins with canonical copy. Seven catalog episodes plus off-catalog public video `Pesto v2` are visible; review that extra video before changing it |
| Rumble | Channel title is exact and About uses the canonical description; channel name and account username remain `drmexperienced` |

The seven existing YouTube, Vimeo, and Rumble videos use the catalog's approved
unnumbered titles, deterministic descriptions, and approved topic thumbnails as
of August 5, 2026. Spotify video and Spotify episode art also use the seven
approved images, and the canonical RSS exposes seven unique 3000 x 3000 item
images. YouTube uses a safe plain-text projection that spells out comparison
operators because Studio rejects angle brackets. Vimeo stores list items as
native rich-text bullets, so its public oEmbed text is compared semantically
rather than byte for byte. Exact assets, remote IDs, and verification state are
recorded in `publishing/episode-thumbnail-rollout.json`.

Run `drm-publish doctor` for the current local readiness report. It checks tools, RSS metadata, credential-file presence, and stable destination IDs without printing credential values.

Public profile URLs are navigation aids, not routing authority. Record each verified immutable account and show, playlist, or channel ID in `publishing/platforms.json`. Unknown IDs stay `null`; the publisher blocks preparation from being attested until every required identity is verified.

## Release-plan values

The manifest stores platform-facing values so later adapters do not guess. YouTube uses `private`, `unlisted`, or `public` visibility and the official `youtube` or `creativeCommon` license codes. Vimeo uses its API visibility values such as `nobody`, `unlisted`, and `anybody`, plus its documented Creative Commons codes or `none`. Rumble uses `unlisted` or `public` and one of the four normalized choices `exclusive_video_management`, `video_management_excluding_youtube`, `rumble_player`, or `personal_use`. Spotify and Instagram use `not_applicable` for per-episode licensing. Leave any undecided field as `not_selected`; that value blocks local review attestation.

Format validation is not account verification. Before a future API adapter can upload, it must query the authenticated account, compare the returned immutable ID with `publishing/platforms.json`, and stop on any mismatch.

The pinned local Chrome bridge uses the isolated data directory
`~/.local/share/drm-publisher/chrome-profile`, never Otto's normal Chrome data.
That directory contains two deliberate identities: `Default` is
`drmexperienced@gmail.com` for every publishing platform, while `Profile 1` is
`ottotheautonomous@gmail.com` for GitHub and Supabase. Never sign out the DRM
identity or copy authentication data between profiles. Run
`drm-browser identities` to validate this mapping.

For initial sign-in, run `drm-browser login`; it opens publishing dashboards in
the DRM profile and operator dashboards in the Otto profile without a debugging
endpoint. Close that browser normally after sign-in. For attended automation,
run `drm-browser open`, then connect to one named scope such as
`drm-browser connect rss` or `drm-browser connect supabase`. `connect` stops the
previous bridge but preserves the tabs and sessions in both profiles, then
restricts the new bridge to the requested origin. If a session expires,
`drm-browser reauth <platform>` opens that dashboard in its assigned profile for
human OAuth/keychain use. Disconnect the bridge when unattended and finish the
account-work session with `drm-browser close`.

## Rebrand And Directory Sequence

The source code, RSS.com feed, and authenticated Apple configuration now use
`Dr. M Experienced, with Dr. David Musnick`. The supported RSS.com import,
metadata cleanup, media/artwork parity audit, and exact one-hop Anchor 301 are
complete.

1. Completed: RSS.com has exact show and episode metadata, no `RSSVERIFY`, no
   stray season value, seven original GUIDs, and seven approved unnumbered titles.
2. Completed: all seven RSS.com audio and artwork assets match the validated
   source; the oldest and newest audio files fully decode.
3. Completed: Apple show `1870433419` was configured directly to the RSS.com
   feed at approximately 18:29 UTC on August 6, 2026. Its authenticated metadata
   is exact and token-free.
4. Pending: Apple still has five Available episodes. Inspect Draft Episodes 1-2,
   the stale duplicate Episode 4, and separate no-feed Draft show `1896845422`.
   Archive only records with no unique content, channel, subscription, or
   analytics setup and only where Apple offers a reversible archive control.
5. Pending: submit the RSS.com feed once to Amazon, complete ownership
   verification, and record the stable show ID and public URL.
6. Pending: verify that all seven existing Spotify video episodes persisted
   after cutover. For future video, wait for RSS ingestion and replace that
   existing episode's audio with the approved video; never create a duplicate.
7. YouTube, Vimeo, Rumble, Spotify video, Spotify episode art, and canonical RSS
   episode-art updates are complete. Reconcile Instagram captions where needed
   and use approved covers for future Reels; preserve existing posts because the
   documented post-publication flow does not replace Reel covers. Do not rename
   stable handles or IDs merely to match display text.
8. Verify Podcast Index convergence, every public profile, and the website
   before announcing full directory convergence.

Apple's current discrepancy is cleanup work, not a reason to recreate the show.
Podcasts Connect lists public show `1870433419`, a separate no-feed Draft show
`1896845422`, and manual Draft episode records. Preserve the public listing and
its followers/history. If self-service refresh does not converge, leave Apple
unused and the public identity intact while the source feed and draft state are
re-audited; do not create a second public listing.

## Instagram media delivery

Use Meta's resumable upload flow to send the integrity-checked Reel directly from the local file. Meta documents this local-file route for apps using Facebook Login for Business. This keeps the normal path local until an authorized upload begins and avoids maintaining a public media object.

If resumable upload is unavailable for the configured account or API flow, stage only the approved Reel at a short-lived public URL, wait for Meta to finish processing the container, and delete the staged object. Public staging is a fallback, not a prerequisite or default.

## Official references

- Apple Podcasts RSS requirements: <https://podcasters.apple.com/support/823-podcast-requirements>
- Apple Podcasts metadata updates: <https://podcasters.apple.com/support/832-podcast-metadata>
- Apple Podcasts episode art: <https://podcasters.apple.com/support/5516-episode-art-template>
- Spotify show claiming: <https://support.spotify.com/us/creators/article/claiming-your-podcast-on-spotify-for-creators/>
- Spotify video for externally hosted shows: <https://support.spotify.com/us/creators/article/video-episodes-for-shows-not-hosted-with-spotify/>
- Spotify platform update timing: <https://support.spotify.com/us/creators/article/new-episodes-or-podcast-updates-not-appearing-on-listening-platforms/>
- Spotify episode cover art: <https://support.spotify.com/us/creators/article/uploading-cover-art/>
- Spotify video thumbnails: <https://support.spotify.com/us/creators/article/thumbnails/>
- Amazon podcast RSS submission: <https://podcasters.amazon.com/submit-rss>
- Amazon podcaster FAQ: <https://podcasters.amazon.com/frequently-asked-questions>
- YouTube video upload endpoint: <https://developers.google.com/youtube/v3/docs/videos/insert>
- YouTube authentication: <https://developers.google.com/youtube/v3/guides/authentication>
- YouTube API audit process: <https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits>
- YouTube video thumbnails: <https://support.google.com/youtube/answer/72431>
- Instagram content publishing: <https://developers.facebook.com/documentation/instagram-platform/content-publishing>
- Instagram Reel covers: <https://www.facebook.com/help/instagram/1038071743007909>
- Vimeo video uploads: <https://developer.vimeo.com/api/upload/videos>
- Vimeo authentication: <https://developer.vimeo.com/api/authentication>
- Vimeo video thumbnails: <https://help.vimeo.com/hc/en-us/articles/12426471350289-How-to-change-the-thumbnail-image-for-my-video>
- Rumble upload and editing: <https://rumble.support/help/upload-and-edit-content>
- Rumble video thumbnails: <https://rumble.support/help/changing-a-thumbnail>
- Rumble licensing choices: <https://rumble.support/help/a-simple-explanation-of-the-differences-between-licensing-options>

## Safety boundary

No timer or background service may execute external publication. Automation may ingest, transcode, validate, fingerprint, and prepare a review packet. The local `--by` value is self-reported attribution; it is not identity authentication and must never be consumed as authorization for an external side effect. Future live adapters require a separate user-presence-backed authorization and must use the exact integrity-checked packet. Any changed file, title, description, schedule, disclosure flag, destination, monetization choice, or license choice invalidates prior review.

Browser automation may update already-approved profile text and may prepare drafts/private uploads. It must stop for MFA, CAPTCHA, reauthentication, account agreements, content-rights declarations, AI/synthetic-media disclosures, audience settings, paid promotion, monetization, licensing, public visibility, scheduling, and the final publish action unless those exact values received fresh explicit approval.
