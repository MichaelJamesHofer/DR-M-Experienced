# Publishing platform setup

Last verified: August 5, 2026.

The local publisher uses official upload interfaces where they exist, RSS fan-out for podcast directories, and explicit browser handoffs where a supported public creator-upload API is unavailable. Credentials stay outside the repository under `~/.config/drm-publisher/` with owner-only permissions.

## Current inventory

| Destination | Delivery path | Current setup state |
|---|---|---|
| RSS.com | Intended post-cutover podcast host | Fresh supported self-service import awaits email confirmation. Empty old-slug show has exact branding but remains noncanonical; no redirect is authorized |
| Spotify for Creators | Current canonical source plus Spotify video | Existing show `7GGLljxmO0G3FLjPy8vfcw` has exact metadata, approved titles, structured numbers 1-7, and seven unchanged GUIDs; preserve it through cutover |
| Apple Podcasts | Episode audio from Spotify's canonical RSS | Claimed show `1870433419` points to the correct Anchor feed; five episodes are Available, three internal episode records are Draft, and separate no-feed Draft show `1896845422` also exists |
| Amazon Music and Audible | Episode audio from the final canonical RSS | Signed-in dashboard has zero claimed shows; hold submission until RSS.com cutover, then submit once |
| YouTube | OAuth 2 plus resumable Data API upload | Channel `UCFA1nVv4lKMBlx81gjMAOFQ` exists; upload OAuth and API audit required |
| Vimeo | Vimeo API tus upload | User `253415660` exists; app upload access and token required |
| Instagram | Professional-account API with resumable local upload | Profile exists; account type, app, permissions, and an authenticated publishing ID remain required |
| Rumble | Local browser handoff | Channel `7820170` exists; no supported public VOD upload API confirmed |

## Remote rebrand status

The canonical short profile description is `Dr. M Experienced, with Dr. David Musnick. Practical insights from decades in sports, regenerative, internal, and functional medicine.` Platform-specific long biographies may add detail after this exact opening.

| Profile | Current public name state |
|---|---|
| Spotify and Apple | The Anchor source is clean and verified. Spotify is canonical. Preserve Apple show `1870433419`, point it at the same feed, and refresh it rather than creating a replacement |
| Amazon | No claimed show exists in the signed-in account; hold until cutover and submit the final RSS.com feed once |
| YouTube | Canonical description is published; display name remains `Dr. M Experienced` because the manager-role name save did not persist |
| Instagram | Display name is exact and the bio is the canonical description; handle `@drmexperienced` is unchanged |
| Vimeo | Display name is `Dr. M Experienced, David Musnick`, the closest form allowed by Vimeo's 32-character limit; the short bio is canonical, the long About begins with it, and slug `drmexperienced` is unchanged |
| Rumble | Channel title is exact and About uses the canonical description; channel name and account username remain `drmexperienced` |

The seven existing YouTube, Vimeo, and Rumble videos use the catalog's approved
unnumbered titles and deterministic descriptions as of August 5, 2026. YouTube
uses a safe plain-text projection that spells out comparison operators because
Studio rejects angle brackets. Vimeo stores list items as native rich-text
bullets, so its public oEmbed text is compared semantically rather than byte for
byte.

Run `drm-publish doctor` for the current local readiness report. It checks tools, RSS metadata, credential-file presence, and stable destination IDs without printing credential values.

Public profile URLs are navigation aids, not routing authority. Record each verified immutable account and show, playlist, or channel ID in `publishing/platforms.json`. Unknown IDs stay `null`; the publisher blocks preparation from being attested until every required identity is verified.

## Release-plan values

The manifest stores platform-facing values so later adapters do not guess. YouTube uses `private`, `unlisted`, or `public` visibility and the official `youtube` or `creativeCommon` license codes. Vimeo uses its API visibility values such as `nobody`, `unlisted`, and `anybody`, plus its documented Creative Commons codes or `none`. Rumble uses `unlisted` or `public` and one of the four normalized choices `exclusive_video_management`, `video_management_excluding_youtube`, `rumble_player`, or `personal_use`. Spotify and Instagram use `not_applicable` for per-episode licensing. Leave any undecided field as `not_selected`; that value blocks local review attestation.

Format validation is not account verification. Before a future API adapter can upload, it must query the authenticated account, compare the returned immutable ID with `publishing/platforms.json`, and stop on any mismatch.

The pinned local Chrome bridge uses an isolated data directory at `~/.local/share/drm-publisher/chrome-profile`, never the normal Chrome profile. For initial sign-in, run `drm-browser login`; this opens all eight publishing dashboards without a debugging endpoint. Close that window normally after sign-in. For an attended automation session, run `drm-browser open`, then connect to one named platform such as `drm-browser connect rss`. The bridge blocks Gmail and every other publishing origin for that connection. Disconnect before switching platforms and always finish with `drm-browser close`, which verifies that Chrome and the loopback endpoint are gone. Do not copy cookies or other authentication data between profiles, and keep Gmail and unrelated sites out of the isolated profile.

## Rebrand And Directory Sequence

The source code now uses `Dr. M Experienced, with Dr. David Musnick`, but the
remote feed and profiles are separate systems. Spotify for Creators/Anchor stays
canonical while the supported RSS.com import and parity checks are completed.

1. Completed: Spotify for Creators has the exact title and description with no
   `RSSVERIFY` suffix.
2. Completed: all seven approved unnumbered public titles, structured episode
   numbers 1-7, and original GUIDs are verified in the Anchor feed.
3. Completed: the clean Anchor feed was independently verified before any
   downstream cutover.
4. In Apple Podcasts Connect, open existing show `1870433419`, confirm the exact
   Anchor RSS URL, save if necessary, and request one feed refresh. Do not add a
   replacement show.
5. Inspect the separate no-feed Draft show `1896845422` and the manual Draft
   episode records. Archive only records with no unique content, channel, or
   subscription setup, and only where Apple offers a reversible archive control.
6. After verified cutover, submit the final RSS.com feed once to Amazon, complete
   ownership verification, and record the stable show ID and public URL.
7. YouTube, Vimeo, and Rumble metadata cleanup is complete. Reconcile Instagram
   captions where needed, then update their title-bearing artwork from approved
   platform variants. The website already uses clean episode-specific art. Do
   not rename stable handles or IDs merely to match display text.
8. Verify every public profile and the website before announcing convergence.

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
