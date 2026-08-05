# Publishing platform setup

Last verified: August 5, 2026.

The local publisher uses official upload interfaces where they exist, RSS fan-out for podcast directories, and explicit browser handoffs where a supported public creator-upload API is unavailable. Credentials stay outside the repository under `~/.config/drm-publisher/` with owner-only permissions.

## Current inventory

| Destination | Delivery path | Current setup state |
|---|---|---|
| RSS.com | Pending supported host import | Ownership token is public and the support reply was sent; awaiting the imported show; empty manually-created show remains untouched and is not canonical |
| Spotify for Creators | Current audio host plus separate video upload after migration | Existing show `7GGLljxmO0G3FLjPy8vfcw` has seven episodes; its Anchor feed carries the new title and description plus `RSSVERIFY`; no redirect authorized |
| Apple Podcasts | Episode audio from Spotify's canonical RSS | Claimed show `1870433419` points to the correct Anchor feed; five episodes are Available, three internal episode records are Draft, and separate no-feed Draft show `1896845422` also exists |
| Amazon Music and Audible | Future episode audio from the imported RSS.com feed | Signed-in dashboard has zero claimed shows and no defensible public listing was found; add or claim only after the imported feed is ready |
| YouTube | OAuth 2 plus resumable Data API upload | Channel `UCFA1nVv4lKMBlx81gjMAOFQ` exists; upload OAuth and API audit required |
| Vimeo | Vimeo API tus upload | User `253415660` exists; app upload access and token required |
| Instagram | Professional-account API with resumable local upload | Profile exists; account type, app, permissions, and an authenticated publishing ID remain required |
| Rumble | Local browser handoff | Channel `7820170` exists; no supported public VOD upload API confirmed |

## Remote rebrand status

The canonical short profile description is `Dr. M Experienced, with Dr. David Musnick. Practical insights from decades in sports, regenerative, internal, and functional medicine.` Platform-specific long biographies may add detail after this exact opening.

| Profile | Current public name state |
|---|---|
| Spotify and Apple | The Anchor source now carries the canonical title and description plus the temporary `RSSVERIFY` token. Apple still presents the old title publicly and only five episodes; preserve its existing show and use refresh/support rather than creating a replacement |
| Amazon | No claimed show exists in the signed-in account; defer enrollment until the imported RSS.com feed exists |
| YouTube | Canonical description is published; display name remains `Dr. M Experienced` because the manager-role name save did not persist |
| Instagram | Display name is exact and the bio is the canonical description; handle `@drmexperienced` is unchanged |
| Vimeo | Display name is `Dr. M Experienced, David Musnick`, the closest form allowed by Vimeo's 32-character limit; the short bio is canonical, the long About begins with it, and slug `drmexperienced` is unchanged |
| Rumble | Channel title is exact and About uses the canonical description; channel name and account username remain `drmexperienced` |

Run `drm-publish doctor` for the current local readiness report. It checks tools, RSS metadata, credential-file presence, and stable destination IDs without printing credential values.

Public profile URLs are navigation aids, not routing authority. Record each verified immutable account and show, playlist, or channel ID in `publishing/platforms.json`. Unknown IDs stay `null`; the publisher blocks preparation from being attested until every required identity is verified.

## Release-plan values

The manifest stores platform-facing values so later adapters do not guess. YouTube uses `private`, `unlisted`, or `public` visibility and the official `youtube` or `creativeCommon` license codes. Vimeo uses its API visibility values such as `nobody`, `unlisted`, and `anybody`, plus its documented Creative Commons codes or `none`. Rumble uses `unlisted` or `public` and one of the four normalized choices `exclusive_video_management`, `video_management_excluding_youtube`, `rumble_player`, or `personal_use`. Spotify and Instagram use `not_applicable` for per-episode licensing. Leave any undecided field as `not_selected`; that value blocks local review attestation.

Format validation is not account verification. Before a future API adapter can upload, it must query the authenticated account, compare the returned immutable ID with `publishing/platforms.json`, and stop on any mismatch.

The pinned local Chrome bridge uses an isolated data directory at `~/.local/share/drm-publisher/chrome-profile`, never the normal Chrome profile. For initial sign-in, run `drm-browser login`; this opens all eight publishing dashboards without a debugging endpoint. Close that window normally after sign-in. For an attended automation session, run `drm-browser open`, then connect to one named platform such as `drm-browser connect rss`. The bridge blocks Gmail and every other publishing origin for that connection. Disconnect before switching platforms and always finish with `drm-browser close`, which verifies that Chrome and the loopback endpoint are gone. Do not copy cookies or other authentication data between profiles, and keep Gmail and unrelated sites out of the isolated profile.

## Rebrand sequence

The source code now uses `Dr. M Experienced, with Dr. David Musnick`, but the remote podcast feed and platform profiles are separate systems.

The audio host migration must preserve the existing show identity. Follow `docs/rss-com-migration.md`: import into RSS.com, verify episode and GUID parity, obtain explicit redirect approval, and confirm the existing directory IDs. The source feed already carries the new title. After convergence, RSS.com becomes the metadata source and the temporary ownership token can be removed after RSS.com confirms verification.

1. Complete and validate the supported RSS.com import without redirecting the live feed.
2. Redirect only after every migration gate passes and the exact redirect has fresh explicit approval.
3. Confirm the imported RSS.com feed has the canonical title and description, then wait for Apple Podcasts and Spotify to refresh the same existing listings. Add or claim Amazon with that imported feed because the signed-in Amazon account currently has no show.
4. Rename the YouTube, Vimeo, Instagram, and Rumble display names separately.
5. Update title-bearing channel artwork separately. Do not rename stable handles or IDs merely to match display text.
6. Verify every public profile and the website before announcing the new name.

Apple requires special handling during this sequence. Podcasts Connect currently lists Available show `1870433419` and a no-feed Draft show `1896845422` with the same title. The Available show contains five Available episodes plus Draft records for episodes 1, 2, and a duplicate episode 4. A feed refresh was requested on August 5, 2026. Do not delete, reset, or replace the public show. Inspect but do not archive the Draft records until the public show has seven episodes and RSS.com or Apple support confirms which records should survive.

## Instagram media delivery

Use Meta's resumable upload flow to send the integrity-checked Reel directly from the local file. Meta documents this local-file route for apps using Facebook Login for Business. This keeps the normal path local until an authorized upload begins and avoids maintaining a public media object.

If resumable upload is unavailable for the configured account or API flow, stage only the approved Reel at a short-lived public URL, wait for Meta to finish processing the container, and delete the staged object. Public staging is a fallback, not a prerequisite or default.

## Official references

- Apple Podcasts RSS requirements: <https://podcasters.apple.com/support/823-podcast-requirements>
- Apple Podcasts metadata updates: <https://podcasters.apple.com/support/832-podcast-metadata>
- Spotify show claiming: <https://support.spotify.com/us/creators/article/claiming-your-podcast-on-spotify-for-creators/>
- Spotify platform update timing: <https://support.spotify.com/us/creators/article/new-episodes-or-podcast-updates-not-appearing-on-listening-platforms/>
- Amazon podcast RSS submission: <https://podcasters.amazon.com/submit-rss>
- Amazon podcaster FAQ: <https://podcasters.amazon.com/frequently-asked-questions>
- YouTube video upload endpoint: <https://developers.google.com/youtube/v3/docs/videos/insert>
- YouTube authentication: <https://developers.google.com/youtube/v3/guides/authentication>
- YouTube API audit process: <https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits>
- Instagram content publishing: <https://developers.facebook.com/documentation/instagram-platform/content-publishing>
- Vimeo video uploads: <https://developer.vimeo.com/api/upload/videos>
- Vimeo authentication: <https://developer.vimeo.com/api/authentication>
- Rumble upload and editing: <https://rumble.support/help/upload-and-edit-content>
- Rumble licensing choices: <https://rumble.support/help/a-simple-explanation-of-the-differences-between-licensing-options>

## Safety boundary

No timer or background service may execute external publication. Automation may ingest, transcode, validate, fingerprint, and prepare a review packet. The local `--by` value is self-reported attribution; it is not identity authentication and must never be consumed as authorization for an external side effect. Future live adapters require a separate user-presence-backed authorization and must use the exact integrity-checked packet. Any changed file, title, description, schedule, disclosure flag, destination, monetization choice, or license choice invalidates prior review.

Browser automation may update already-approved profile text and may prepare drafts/private uploads. It must stop for MFA, CAPTCHA, reauthentication, account agreements, content-rights declarations, AI/synthetic-media disclosures, audience settings, paid promotion, monetization, licensing, public visibility, scheduling, and the final publish action unless those exact values received fresh explicit approval.
