# Publishing platform setup

Last verified: August 7, 2026.

The local publisher uses official upload interfaces where they exist, RSS fan-out for podcast directories, and explicit browser handoffs where a supported public creator-upload API is unavailable. Credentials stay outside the repository under `~/.config/drm-publisher/` with owner-only permissions.

## Current inventory

| Destination | Delivery path | Current setup state |
|---|---|---|
| RSS.com | Canonical podcast host | Feed `https://media.rss.com/dr-m-experienced/feed.xml` has seven normalized, remotely decoded and loudness-verified enclosures with the GUIDs captured from Anchor on August 5, exact XML metadata, no XML `RSSVERIFY`, and no stray season value. Apple case `20000130526608` later supplied older historical GUIDs for Episodes 1-2; no live GUID change is approved. The separate public landing-page metadata still exposes a cached `RSSVERIFY` token |
| Spotify for Creators | RSS audio consumer plus per-episode Spotify video replacement | Existing show `7GGLljxmO0G3FLjPy8vfcw` preserves all seven episode identities; corrected video is attached to 7/7 and public readback verifies video, approved artwork, and approved copy |
| Apple Podcasts | Episode audio and art directly from RSS.com | Existing show `1870433419` uses the exact RSS.com feed and has exact token-free canonical metadata; the duplicate show now returns 404 and the stale Episode 4 Draft was archived. Only five episodes are Available. Under case `20000130526608`, Apple confirmed that its existing Episode 1-2 records use historical GUIDs different from the current feed. Repair remains blocked while Apple-side remapping, RSS.com in-place capability, and Spotify identity preservation are reviewed. Public JSON-LD/search caches retain legacy wording for Episodes 4-7 |
| Amazon Music and Audible | Episode audio from RSS.com after one-time claim | Signed-in dashboard has zero claimed shows; submit the canonical RSS.com feed once, complete ownership verification, and record the stable listing ID/URL |
| Podcast Index | Automatic RSS indexing | New RSS.com record `7982906` and old Anchor record `7799755` are both live; verify convergence after the 301 is crawled |
| Production Supabase projection | Guarded SQL migrations plus exact readback | Both August 7 guarded migrations were applied after exact file-hash verification; all seven current RSS audio URLs, YouTube IDs, and `Watch on YouTube` references match catalog revision 10 |
| YouTube | Direct full-video upload; OAuth 2 plus resumable Data API for future automation | Seven normalized replacements are public and verified. The prior seven uploads remain Unlisted with replacement links and are retained as rollback records; future API automation still needs OAuth and the applicable compliance audit |
| Vimeo | Vimeo API tus upload or attended in-place version replacement | All seven corrected videos were replaced in place and verified on their stable existing IDs. App upload access and an upload/edit-scoped token are still required for future API automation |
| Instagram | Creator professional-account API with resumable local upload | Public profile state independently confirms `@drmexperienced` is a Creator professional account and not a Business account. Name/bio are exact, but the external website link, authenticated Graph API publishing ID, Meta app permissions, and token remain incomplete; no Business-account conversion is required |
| Rumble | Direct human browser use only | Seven corrected uploads are staged Unlisted with Option C selected but not submitted. The hidden YouTube syndication switch is on for all seven, so submission is blocked on manually disabling it, rechecking every release control, human third-party asset-rights review, and specific acknowledgment of the July 21, 2026 Terms provisions. Automated site interaction is prohibited absent Rumble's prior written permission |

## Remote rebrand status

The canonical short profile description is `Dr. M Experienced, with Dr. David Musnick. Practical insights from decades in sports, regenerative, internal, and functional medicine.` Platform-specific long biographies may add detail after this exact opening.

| Profile | Current public name state |
|---|---|
| Spotify and Apple | RSS.com's XML and the authenticated Apple configuration use exact title/description copy with no feed `RSSVERIFY`. Spotify preserves all seven episode identities and now has corrected video with approved art/copy on 7/7. Apple exposes only five Available episodes and has two RSS Draft records; case `20000130526608` confirmed a historical GUID mismatch for Episodes 1-2. Preserve both show identities and follow the blocked repair gates in `publishing/apple-guid-repair.json` rather than creating replacements or changing live GUIDs. Public JSON-LD/search caches retain legacy wording for Episodes 4-7 |
| Amazon | No claimed show exists in the signed-in account; submit the canonical RSS.com feed once and record the resulting stable identity |
| YouTube | Canonical episode copy is published on the seven normalized replacement IDs; display name remains `Dr. M Experienced` because the manager-role name save did not persist. Prior episode uploads remain Unlisted and link to the replacements |
| Instagram | Display name and bio are exact; handle `@drmexperienced` is unchanged and public state confirms Creator professional with Business false. Add the website listening hub and complete authenticated Graph API authorization; do not use the public profile ID as the publishing ID or convert the account to Business |
| Vimeo | Display name is `Dr. M Experienced, David Musnick`, the closest form allowed by Vimeo's 32-character limit; the bio begins with canonical copy. Seven catalog episodes plus off-catalog public video `Pesto v2` are visible; review that extra video before changing it |
| Rumble | Channel title is exact and About uses the canonical description; channel name and account username remain `drmexperienced` |

YouTube's seven normalized public replacements, Vimeo's seven in-place corrected
videos, Spotify's seven corrected video attachments, and the existing Rumble
videos use approved topic thumbnails. Rumble's seven new corrected uploads are
staged Unlisted with Option C selected and not submitted; hidden YouTube
syndication is currently on for all seven. The canonical RSS exposes seven unique
3000 x 3000 item images.
YouTube uses a safe plain-text projection that spells out comparison
operators because Studio rejects angle brackets. Vimeo stores list items as
native rich-text bullets, so its public oEmbed text is compared semantically
rather than byte for byte. Exact assets, remote IDs, and verification state are
recorded in `publishing/episode-thumbnail-rollout.json`.

Run `drm-publish doctor` for the current local readiness report. It checks tools, RSS metadata, credential-file presence, and stable destination IDs without printing credential values.

Public profile URLs are navigation aids, not routing authority. Record each verified immutable account and show, playlist, or channel ID in `publishing/platforms.json`. Unknown IDs stay `null`; the publisher blocks preparation from being attested until every required identity is verified.

## Release-plan values

The manifest stores platform-facing values so later adapters do not guess. YouTube uses `private`, `unlisted`, or `public` visibility and the official `youtube` or `creativeCommon` license codes. Vimeo uses its API visibility values such as `nobody`, `unlisted`, and `anybody`, plus its documented Creative Commons codes or `none`. Rumble project policy allows only initial `unlisted` visibility and `rumble_only_option_c`, which maps to Option C `Rumble Only (non-exclusive, similar to YouTube)`. The exclusive `exclusive_video_management` and `video_management_excluding_youtube` choices are prohibited; `personal_use` is not a permitted project release mode. Rumble also requires explicit disabled values for every syndication target and Premium/exclusive placement. Spotify and Instagram use `not_applicable` for per-episode licensing. Leave any undecided field as `not_selected`; that value blocks local review attestation.

### Rumble release policy

Rumble's [Terms](https://rumble.com/s/terms), last modified July 21, 2026,
prohibit automated software access or interaction without Rumble's prior written
permission. Do not use `drm-browser connect rumble`, CDP, scripts, or another
automation tool to inspect or change forms, check attestations, or submit. The
saved authenticated tabs remain available for direct human use.

Option C is the project's only permitted Rumble license. Rumble's official
[licensing explanation](https://rumble.support/help/a-simple-explanation-of-the-differences-between-licensing-options)
describes it as non-exclusive. Never use Option A `Video Management` or Option B
`Video Management (excluding YouTube)`; both are exclusive agency choices. Keep
Premium/exclusive placement off and disable YouTube, Vimeo, Facebook, and every
other additional-syndication control. Initial visibility is always Unlisted.

Option C remains subject to the Terms' General License, including AI/ML training
and third-party AI sublicensing provisions. The Terms' third-party-material
requirements also need a human review of all music, footage, graphics, and other
incorporated assets. The user has not yet acknowledged these newly surfaced
provisions in the current record, so do not infer acceptance or rights clearance.

The August 7 form audit found 7/7 corrected uploads staged Unlisted with Option
C and Vimeo/Facebook syndication off, but hidden YouTube syndication on. Premium
state was not verified and remains an open manual gate. All seven remain
unsubmitted. For each tab, the user must manually expand Additional Syndication,
turn YouTube off, reverify Option C and Unlisted, verify Premium is off, review
asset rights and the July 21 Terms, check the rights and Terms boxes, and submit.
Record the returned video ID and URL after
the human action; do not automate a readback from the signed-in site.

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

Rumble is excluded from attended automation under the current Terms. Leave its
logged-in tabs open for the user, but do not connect a bridge to them without
Rumble's prior written permission.

## Rebrand And Directory Sequence

The source code, RSS.com feed, and authenticated Apple configuration now use
`Dr. M Experienced, with Dr. David Musnick`. The supported RSS.com import,
metadata cleanup, media/artwork parity audit, and exact one-hop Anchor 301 are
complete.

1. Completed: RSS.com's XML has exact show and episode metadata, no `RSSVERIFY`,
   no stray season value, the seven GUIDs captured from Anchor on August 5, and
   seven approved unnumbered titles. That retained snapshot cannot prove the
   GUIDs used when Episodes 1-2 were first published; Apple later supplied older
   historical values. The separate public landing-page metadata still has a
   cached token.
2. Completed: all seven normalized RSS.com enclosures left the captured August
   5 GUID set unchanged and pass remote download, full-decode, and loudness
   gates; artwork parity remains verified. The Apple identity repair is a
   separate, blocked incident.
3. Completed: Apple show `1870433419` was configured directly to the RSS.com
   feed at approximately 18:29 UTC on August 6, 2026. Its authenticated metadata
   is exact and token-free.
4. Support response received; remote repair blocked: Apple still has five
   Available episodes. The inspected no-feed Draft show `1896845422` and stale
   manual Episode 4 Draft were archived on August 6, 2026, and one feed refresh
   was requested. Apple case `20000130526608` confirmed that its existing
   Episode 1-2 records use historical GUIDs different from the current feed.
   Follow `publishing/apple-guid-repair.json`; do not change either live GUID
   while the support-first preservation checks remain open.
5. Pending: submit the RSS.com feed once to Amazon, complete ownership
   verification, and record the stable show ID and public URL.
6. Completed August 7, 2026: all seven corrected Spotify videos are attached to
   the existing episode IDs and public readback verifies video, approved art, and
   approved copy for 7/7. There is no account-wide video switch; retain the
   existing-episode `Upload video` procedure for future video episodes and leave
   intentionally audio-only episodes as RSS audio only.
7. YouTube, Vimeo, Spotify video/art, existing Rumble video art, and canonical
   RSS episode-art updates are complete. Seven corrected Rumble uploads are
   staged Unlisted with Option C selected but not submitted because hidden
   YouTube syndication is on for all seven. The user must manually clear that
   switch and complete the rights/Terms review described above.
   Reconcile Instagram captions where needed
   and use approved covers for future Reels; preserve existing posts because the
   documented post-publication flow does not replace Reel covers. Do not rename
   stable handles or IDs merely to match display text.
8. Verify Podcast Index convergence, every public profile, and the website
   before announcing full directory convergence.

Apple's exact support crosswalk is:

| Episode | Apple Episode ID | Current feed GUID | Apple historical GUID |
|---|---|---|---|
| 1 | `1000746628307` | `c9b853b6-a828-4012-9998-217919ff9163` | `59063e08-e4a6-4e56-b7ec-d2a66d69beb8` |
| 2 | `1000746628422` | `1e40e02b-b217-477c-9cc3-4271cb304c23` | `26896da2-76cf-4865-93f8-f94ddfb24568` |

This is a catalog identity incident, not a reason to recreate the show or either
episode. Ask Apple first whether it can remap the two existing episode records
to the current feed GUIDs server-side. In parallel, ask RSS.com whether import
engineering can make an in-place GUID-only correction without recreating an
episode, and ask Spotify whether it can preserve the existing episode IDs and
attached videos across either substitution. Make no live GUID change, deletion,
recreation, or two-episode batch while those answers and exact user approval are
missing. If a feed change remains necessary, capture complete Apple, Spotify,
RSS, and feed snapshots and use one attended episode as a canary. Independently
verify its Apple and Spotify identities before considering the second episode.

## Instagram media delivery

Use Meta's resumable upload flow to send the integrity-checked Reel directly from the local file. Meta documents this local-file route for apps using Facebook Login for Business. This keeps the normal path local until an authorized upload begins and avoids maintaining a public media object.

If resumable upload is unavailable for the configured account or API flow, stage only the approved Reel at a short-lived public URL, wait for Meta to finish processing the container, and delete the staged object. Public staging is a fallback, not a prerequisite or default.

## Official references

- Apple Podcasts RSS requirements: <https://podcasters.apple.com/support/823-podcast-requirements>
- Apple Podcasts metadata updates: <https://podcasters.apple.com/support/832-podcast-metadata>
- Apple Podcasts episode art: <https://podcasters.apple.com/support/5516-episode-art-template>
- RSS.com support ticket: <https://help.rss.com/en/support/tickets/new>
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
- Rumble licensing comparison: <https://rumble.com/s/licensing-comparison.html>
- Rumble Terms, last modified July 21, 2026: <https://rumble.com/s/terms>

## Safety boundary

No timer or background service may execute external publication. Automation may ingest, transcode, validate, fingerprint, and prepare a review packet. The local `--by` value is self-reported attribution; it is not identity authentication and must never be consumed as authorization for an external side effect. Future live adapters require a separate user-presence-backed authorization and must use the exact integrity-checked packet. Any changed file, title, description, schedule, disclosure flag, destination, monetization choice, or license choice invalidates prior review.

Browser automation may update already-approved profile text and may prepare drafts/private uploads where the platform permits automated access. It must stop for MFA, CAPTCHA, reauthentication, account agreements, content-rights declarations, AI/synthetic-media disclosures, audience settings, paid promotion, monetization, licensing, public visibility, scheduling, and the final publish action unless those exact values received fresh explicit approval. Rumble is stricter: no automated site access or interaction is permitted without Rumble's prior written permission, even for inspection or draft preparation.
