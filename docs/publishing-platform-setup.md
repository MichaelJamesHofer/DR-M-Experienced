# Publishing platform setup

Last verified: August 8, 2026.

The local publisher uses official upload interfaces where they exist, RSS fan-out for podcast directories, and explicit browser handoffs where a supported public creator-upload API is unavailable. Credentials stay outside the repository under `~/.config/drm-publisher/` with owner-only permissions.

## Current inventory

| Destination | Delivery path | Current setup state |
|---|---|---|
| RSS.com | Canonical podcast host | Feed `https://media.rss.com/dr-m-experienced/feed.xml` has seven normalized, remotely decoded and loudness-verified enclosures with the GUIDs captured from Anchor on August 5, exact XML metadata, no XML `RSSVERIFY`, and no stray season value. The in-place GUID-only capability request is submitted and pending; no live GUID change was requested or approved. The separate public landing-page metadata still exposes a cached `RSSVERIFY` token |
| Spotify for Creators | RSS audio consumer plus per-episode Spotify video replacement | Existing show `7GGLljxmO0G3FLjPy8vfcw` preserves all seven episode identities; corrected video is attached to 7/7 and public readback verifies video, approved artwork, and approved copy. Authenticated support is reviewing identity, attached-video, and analytics preservation across the proposed GUID substitutions; no live change was made |
| Apple Podcasts | Episode audio and art directly from RSS.com | Existing show `1870433419` uses the exact RSS.com feed and has exact token-free canonical metadata; the duplicate show now returns 404 and the stale Episode 4 Draft was archived. Only five episodes are Available. Under case `20000130526608`, Apple confirmed that its existing Episode 1-2 records use historical GUIDs different from the current feed. The server-side-remap request is submitted and pending; repair remains blocked and no live GUID changed. Public JSON-LD/search caches retain legacy wording for Episodes 4-7 |
| Amazon Music and Audible | Episode audio from RSS.com after one-time claim | Signed-in dashboard has zero claimed shows; submit the canonical RSS.com feed once, complete ownership verification, and record the stable listing ID/URL |
| Podcast Index | Automatic RSS indexing | New RSS.com record `7982906` and old Anchor record `7799755` are both live; verify convergence after the 301 is crawled |
| Production Supabase projection | Guarded SQL migrations plus exact readback | Both August 7 guarded migrations were applied after exact file-hash verification; all seven current RSS audio URLs, YouTube IDs, and `Watch on YouTube` references match catalog revision 10 |
| Website and PostHog | GitHub Pages plus privacy-sanitized web analytics | Episode 7's corrected page and all three short-form routes are deployed. The short routes return HTTP 200, appear in the sitemap, load their checked-in posters, bind the exact Vimeo IDs, and have no document overflow at 320, 390, or 1440 pixels. A production POST to `https://us.i.posthog.com/e/` returned 200; refreshed Installation Health passes `$pageview`, `$pageleave`, scroll depth, and authorized URLs. Dashboard `1086989` has the privacy-safe `Dr. M Growth Dashboard` configuration and six verified growth views. Reverse proxy is the only explicit configuration recommendation and is not configured |
| YouTube | Direct full-video upload; OAuth 2 plus resumable Data API for future automation | Seven normalized replacements are public and verified. The prior seven uploads remain Unlisted with replacement links and are retained as rollback records; future API automation still needs OAuth and the applicable compliance audit |
| Vimeo | Vimeo API tus upload or attended in-place version replacement | All seven corrected episode videos remain verified on their stable IDs. The three Instagram-mapped shorts are verified as `1216695521`, `1216695522`, and `1204939542` with canonical titles, descriptions, and posters. A private API app is prepared; the owner must complete Vimeo's legal-attestation checkbox before creating an upload/edit token |
| Instagram | Creator professional-account API | Public state confirms `@drmexperienced` is a Creator professional account and not a Business account. Its three public Reels map to verified local masters and Vimeo recovery IDs. Name/bio are exact; adding the website link remains a mobile-app-only action. Meta API setup waits for the owner's Facebook developer login, after which the authenticated publishing ID, permissions, and token can be completed without converting the account to Business |
| Rumble | Direct human browser use only | The cache reset invalidated the seven staged browser forms, so they require manual restaging. The exact videos and thumbnails remain locally verified. The user accepted the July 21, 2026 Terms provisions on August 8; submission remains blocked on manual restaging with Option C, all syndication off, Premium off, human third-party asset-rights review, and the on-site controls. Automated site interaction is prohibited absent Rumble's prior written permission |

## Remote rebrand status

The canonical short profile description is `Dr. M Experienced, with Dr. David Musnick. Practical insights from decades in sports, regenerative, internal, and functional medicine.` Platform-specific long biographies may add detail after this exact opening.

| Profile | Current public name state |
|---|---|
| Spotify and Apple | RSS.com's XML and the authenticated Apple configuration use exact title/description copy with no feed `RSSVERIFY`. Spotify preserves all seven episode identities and now has corrected video with approved art/copy on 7/7. Apple exposes only five Available episodes and has two RSS Draft records; case `20000130526608` confirmed a historical GUID mismatch for Episodes 1-2. Preserve both show identities and follow the blocked repair gates in `publishing/apple-guid-repair.json` rather than creating replacements or changing live GUIDs. Public JSON-LD/search caches retain legacy wording for Episodes 4-7 |
| Amazon | No claimed show exists in the signed-in account; submit the canonical RSS.com feed once and record the resulting stable identity |
| YouTube | Canonical episode copy is published on the seven normalized replacement IDs; display name remains `Dr. M Experienced` because the manager-role name save did not persist. Prior episode uploads remain Unlisted and link to the replacements |
| Instagram | Display name and bio are exact; handle `@drmexperienced` is unchanged and public state confirms Creator professional with Business false. All three public posts have unique captions and catalog mappings. Add the website listening hub through Instagram's mobile-only link control; Meta API work then waits for Facebook developer login. Do not use the public profile ID as the publishing ID or convert the account to Business |
| Vimeo | Display name is `Dr. M Experienced, David Musnick`, the closest form allowed by Vimeo's 32-character limit; the bio begins with canonical copy. Seven catalog episodes and all three short-form recovery copies are visible. Short IDs `1216695521`, `1216695522`, and `1204939542` have canonical metadata/posters and must be preserved |
| Rumble | Channel title is exact and About uses the canonical description; channel name and account username remain `drmexperienced` |

YouTube's seven normalized public replacements, Vimeo's seven in-place corrected
videos, Spotify's seven corrected video attachments, and the existing Rumble
videos use approved topic thumbnails. Rumble's seven exact corrected video and
thumbnail pairs remain locally verified and unsubmitted; the cache reset
invalidated their staged forms. The canonical RSS exposes seven unique
3000 x 3000 item images.
YouTube uses a safe plain-text projection that spells out comparison
operators because Studio rejects angle brackets. Vimeo stores list items as
native rich-text bullets, so its public oEmbed text is compared semantically
rather than byte for byte. Exact assets, remote IDs, and verification state are
recorded in `publishing/episode-thumbnail-rollout.json`.

Run `drm-publish doctor` for the current local readiness report. It checks tools, RSS metadata, credential-file presence, and stable destination IDs without printing credential values.

The publisher also has an immutable per-job release-receipt ledger:

```bash
drm-publish receipt <job-id> --platform <platform-id> \
  --operation-id <operation-id> \
  --status <accepted|processing|published|verified|failed|superseded> \
  --by <recorder> [--remote-id <id>] [--remote-url <https-url>] \
  [--evidence <kind=value>] \
  --confirm "record-receipt <job-id> <platform-id> <approval-hash> <operation-id>"
drm-publish receipts <job-id>
drm-publish status <job-id>
```

Receipts are hash-bound evidence for an already-approved packet and operation;
they neither authorize nor perform a remote action. Platform upload adapters,
automatic receipt writes, and remote reconciliation remain incomplete.

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
and third-party AI sublicensing provisions. The user explicitly accepted those
provisions on August 8, 2026. The Terms' third-party-material requirements still
need a human review of all music, footage, graphics, and other incorporated
assets; Terms acceptance is not rights clearance.

The August 7 form audit found 7/7 corrected uploads staged Unlisted with Option
C and Vimeo/Facebook syndication off, but hidden YouTube syndication on. Premium
state was not verified. The August 8 cache reset invalidated those forms, and
all seven remain unsubmitted. Each upload must be manually restaged, all
syndication disabled, Option C and Unlisted reverified, Premium verified off,
asset rights reviewed, and the on-site rights and Terms controls completed.
Record the returned video ID and URL after the human action; do not automate a
readback from the signed-in site.

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
4. Follow-up review pending; remote repair blocked: Apple still has five
   Available episodes. The inspected no-feed Draft show `1896845422` and stale
   manual Episode 4 Draft were archived on August 6, 2026, and one feed refresh
   was requested. Apple case `20000130526608` confirmed that its existing
   Episode 1-2 records use historical GUIDs different from the current feed.
   The Apple remap, RSS.com capability, and Spotify identity-preservation
   requests are submitted and pending. Follow `publishing/apple-guid-repair.json`;
   no live GUID changed, and none is authorized to change while the support-first
   preservation checks remain open.
5. Pending: submit the RSS.com feed once to Amazon, complete ownership
   verification, and record the stable show ID and public URL.
6. Completed August 7, 2026: all seven corrected Spotify videos are attached to
   the existing episode IDs and public readback verifies video, approved art, and
   approved copy for 7/7. There is no account-wide video switch; retain the
   existing-episode `Upload video` procedure for future video episodes and leave
   intentionally audio-only episodes as RSS audio only.
7. YouTube, Vimeo, Spotify video/art, existing Rumble video art, and canonical
   RSS episode-art updates are complete. Seven corrected Rumble asset pairs are
   locally verified but need manual restaging after the cache reset. The user
   must use Option C, disable all syndication and Premium, and complete the
   rights/Terms controls described above.
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
episode. Requests are now submitted to Apple for server-side remapping, RSS.com
for an in-place GUID-only correction, and Spotify for preservation of the
existing episode IDs, attached videos, and analytics. All three responses are
pending. Make no live GUID change, deletion, recreation, or two-episode batch
while those answers and exact user approval are missing. If a feed change
remains necessary, capture complete Apple, Spotify, RSS, and feed snapshots and
use one attended episode as a canary. Independently verify its Apple and Spotify
identities before considering the second episode.

## Instagram media delivery

Add `https://drmexperienced.com` through the Instagram mobile app because the
current desktop profile editor exposes external-link management as mobile-only.
Meta API configuration is separately waiting for the owner's Facebook developer
login.

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

No timer or background service may execute external publication. Automation may ingest, transcode, validate, fingerprint, prepare a review packet, and record immutable per-job receipt evidence. A receipt and the local `--by` value are self-reported records, not identity authentication or authorization for an external side effect. Future live adapters require a separate user-presence-backed authorization, must use the exact integrity-checked packet, and must reconcile remote state. Any changed file, title, description, schedule, disclosure flag, destination, monetization choice, or license choice invalidates prior review.

Browser automation may update already-approved profile text and may prepare drafts/private uploads where the platform permits automated access. It must stop for MFA, CAPTCHA, reauthentication, account agreements, content-rights declarations, AI/synthetic-media disclosures, audience settings, paid promotion, monetization, licensing, public visibility, scheduling, and the final publish action unless those exact values received fresh explicit approval. Rumble is stricter: no automated site access or interaction is permitted without Rumble's prior written permission, even for inspection or draft preparation.
