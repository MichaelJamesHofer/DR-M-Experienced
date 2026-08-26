# Publishing platform setup

Broader platform inventory last verified: August 22, 2026.
Apple routing and publication-state receipt last verified: August 26, 2026.

The local publisher uses official upload interfaces where they exist, RSS fan-out for podcast directories, and explicit browser handoffs where a supported public creator-upload API is unavailable. Credentials stay outside the repository under `~/.config/drm-publisher/` with owner-only permissions.

## Current inventory

| Destination | Delivery path | Current setup state |
|---|---|---|
| RSS.com | Canonical podcast host; official v4 API or attended dashboard | Feed `https://media.rss.com/dr-m-experienced/feed.xml` remains the unchanged canonical source. The retained seven-episode migration baseline has normalized, remotely decoded and loudness-verified enclosures with the GUIDs captured from Anchor on August 5, exact XML metadata, no XML `RSSVERIFY`, and no stray season value. The official v4 adapter is implemented and bound to podcast ID `397420`, but RSS.com limits API access to Max and this account has no configured entitlement/API key. The current free/manual hosting path continues. The separate public landing-page metadata still exposes a cached `RSSVERIFY` token |
| Spotify for Creators | RSS audio consumer plus per-episode Spotify video replacement | Existing show `7GGLljxmO0G3FLjPy8vfcw` preserves all seven episode identities. Six corrected video attachments remain public; Episode 5 is currently audio-only with corrected RSS audio after three same-ID video attempts reverted. A Creator Support request is staged for owner review. Never create a duplicate episode |
| Apple Podcasts | RSS fan-out through the Apple-only overlay | Existing show `1870433419` consumes `https://drmexperienced.com/apple-podcasts/feed.xml`, generated from the unchanged RSS.com source. The overlay restores only Apple's historical Episode 1-2 GUIDs. Authenticated Connect shows six Available and two Draft RSS records with playable audio; public Apple shows six of eight. The authenticated Missing Podcast(s) escalation referencing case `20000130526608` requests in-place publication with existing Apple IDs preserved. Routing stays on the overlay while the outcome is pending |
| Amazon Music and Audible | Episode audio from RSS.com after one-time claim | Signed-in dashboard has zero claimed shows; submit the canonical RSS.com feed once, complete ownership verification, and record the stable listing ID/URL |
| Podcast Index | Automatic RSS indexing | New RSS.com record `7982906` and old Anchor record `7799755` are both live; verify convergence after the 301 is crawled |
| Production Supabase projection | Guarded SQL migrations plus exact readback | Episode 5 projects the corrected RSS enclosure and 30-minute duration. The August 8 Episode 7 editorial correction also retains its exact independent readback |
| Website and PostHog | GitHub Pages plus privacy-sanitized web analytics | Episode 5 exposes the corrected media references and separates its video and audio regions by 40 pixels at 320px with no horizontal overflow. Episode 7's corrected page and all three short-form routes are also deployed. A production POST to `https://us.i.posthog.com/e/` returned 200; refreshed Installation Health passes `$pageview`, `$pageleave`, scroll depth, and authorized URLs. Dashboard `1086989` has the privacy-safe `Dr. M Growth Dashboard` configuration and six verified growth views |
| YouTube | Direct full-video upload through OAuth 2 and the resumable Data API | Six normalized replacements remain public. Episode 5 preserves public ID `N_F0hhHkIQ4` after an approved same-ID trim removed the contaminated interval; YouTube Studio reports 29:45. Google Cloud project `dr-m-experienced-publisher` exists, YouTube Data API v3 is enabled, the desktop client is stored privately, and the external OAuth app is in production. No owner token is stored: `drmexperienced@gmail.com` is a channel Manager, while production owner `michaeljameshofer@gmail.com` must grant the one-time authorization. Public/unlisted API uploads also remain blocked pending the applicable compliance audit |
| Vimeo | Official Vimeo API upload or attended in-place version replacement | All seven corrected episode videos remain verified on their stable IDs; Episode 5 was corrected in place again on August 22 while preserving `1204939658`. The three Instagram-mapped shorts are verified as `1216695521`, `1216695522`, and `1204939542` with canonical titles, descriptions, and posters. Private first-party app `540274`, its owner-only upload/edit token, exact account `253415660`, and upload quota are verified; the adapter is ready for a separately authorized new release |
| Instagram | Creator professional-account API through Facebook Login for Business | Public state confirms `@drmexperienced` is a Creator professional account and not a Business account. The website, affiliate guide, and contact profile links are live; the profile reports four posts, and all three cataloged Reels map to verified local masters and Vimeo recovery IDs. Keep the Creator account type. Direct local-file Reel upload still requires a linked Facebook Page, authenticated Graph publishing ID, Page tasks, permissions, and an owner-only token |
| Rumble | Direct human browser use only | The cache reset invalidated the seven staged browser forms, so they require manual restaging. The exact videos and thumbnails remain locally verified. The user accepted the July 21, 2026 Terms provisions on August 8; submission remains blocked on manual restaging with Option C, all syndication off, Premium off, human third-party asset-rights review, and the on-site controls. Automated site interaction is prohibited absent Rumble's prior written permission |

## Remote rebrand status

The canonical short profile description is `Dr. M Experienced, with Dr. David Musnick. Practical insights from decades in sports, regenerative, internal, and functional medicine.` Platform-specific long biographies may add detail after this exact opening.

| Profile | Current public name state |
|---|---|
| Spotify and Apple | RSS.com remains canonical and Spotify preserves its episode identities. Apple alone consumes the active overlay derived from RSS.com. Apple Connect is six Available/two Draft with playable RSS audio; public Apple is six of eight. Publication remains pending under `publishing/apple-guid-repair.json`; do not revert Apple to the direct RSS.com URL |
| Amazon | No claimed show exists in the signed-in account; submit the canonical RSS.com feed once and record the resulting stable identity |
| YouTube | Canonical episode copy is published on the seven normalized replacement IDs; display name remains `Dr. M Experienced` because the manager-role name save did not persist. Prior episode uploads remain Unlisted and link to the replacements |
| Instagram | Display name and bio are exact; handle `@drmexperienced` is unchanged and public state confirms Creator professional with Business false. The website, affiliate guide, and contact links are live. All three cataloged Reels have unique captions and mappings; the profile reports four posts. Meta API work still waits for the authenticated publishing ID and token. Do not use the public profile ID as the publishing ID or convert the account to Business |
| Vimeo | Display name is `Dr. M Experienced, David Musnick`, the closest form allowed by Vimeo's 32-character limit; the bio begins with canonical copy. Seven catalog episodes and all three short-form recovery copies are visible. Short IDs `1216695521`, `1216695522`, and `1204939542` have canonical metadata/posters and must be preserved |
| Rumble | Channel title is exact and About uses the canonical description; channel name and account username remain `drmexperienced` |

YouTube has six normalized public replacements plus the corrected Episode 5
same-ID trim. Vimeo has seven in-place corrected videos. Spotify has six current
video attachments plus Episode 5's corrected RSS audio-only item. These and the
existing Rumble videos use approved topic thumbnails. Rumble's seven exact corrected video and
thumbnail pairs remain locally verified and unsubmitted; the cache reset
invalidated their staged forms. The canonical RSS exposes seven unique
3000 x 3000 item images.
YouTube uses a safe plain-text projection that spells out comparison
operators because Studio rejects angle brackets. Vimeo stores list items as
native rich-text bullets, so its public oEmbed text is compared semantically
rather than byte for byte. Exact assets, remote IDs, and verification state are
recorded in `publishing/episode-thumbnail-rollout.json`.

Run `drm-publish doctor` for the current local readiness report. It checks tools, RSS metadata, credential-file presence, and stable destination IDs without printing credential values.

## Host publishing control plane

This workstation now contains the guarded execution layer. It does not watch
Dropbox or invent a release. It acts only after the operator prepares and
reviews a packet and creates a second, exact release authorization.

| Component | Current state |
|---|---|
| Release authorization | `drm-publish authorize` writes an owner-only immutable record bound to the review hash, exact targets, assets, copy, release plan, timing, visibility, disclosures, and approver |
| Immutable asset stage | Each adapter copies approved bytes to `~/.local/state/drm-publisher/assets/sha256/<prefix>/<sha256>` using private directories/files, rejects symlinks and source mutation, and verifies a reused staged object before upload |
| Tracked policy | `publishing/platforms.json` contains a global `publishingAutomation.enabled` gate and per-platform `apiAutomation.enabled` plus `policyRevision`; the reviewed packet snapshots each target's current policy |
| Machine host control | Owner-only regular file `~/.local/state/drm-publisher/automation-control.json` must be mode `0600`, `running`, and allow the exact platform. Missing, insecure, invalid, or paused state fails closed. Live readback is generation 1, `running`, with only `vimeo` allowlisted |
| Durable queue | Mode-0600 node:sqlite database at `~/.local/state/drm-publisher/control/publisher.sqlite3` stores deterministic operations, atomic multi-target dependency graphs, leases/heartbeats, provider write intent, hashed checkpoints, create slots, results, and events. The queue is currently empty |
| Controller | `drm-publish controller --once` revalidates authorization, catalog, assets, tracked gates/policy revision, local allowlist, account identity, and pinned build before adapter execution; it reloads the local host control immediately before every mutating step |
| Adapters | Official Vimeo, YouTube, and RSS.com adapters stage exact bytes, record write intent, checkpoint provider sessions/identities, poll processing, reconcile only the checkpointed resource, and perform authenticated readback |
| Receipts | Adapter results append accepted, published, and verified evidence to the existing immutable per-job ledger. A stale receipt lock is recovered only after 15 minutes and only when its recorded owner PID is missing or dead |
| Deployment | `ops/install-publisher-host.sh` refuses a dirty tree, archives one full Git commit under its SHA, installs production dependencies with Node `22.22.0`, atomically switches the `current` symlink, and pins the service build SHA. The August 22 pre-reconciliation snapshot was `84f606ca8d899d1c8ac9a6890ecbb073cfd11b8f`; read `current/release.json` for the authoritative installed commit and reinstall only after merge/review |
| Controller supervision | Per-user `drm-publisher-controller.timer` is installed but currently disabled and inactive. Do not enable it merely to stage an episode; reconcile the clean pinned publisher and exact approved release gates first |
| Offline intake supervision | Per-user `drm-publisher-intake.timer` runs every two minutes with network denied and project Dropbox read-only. Live readback is enabled and active; the last observed run succeeded and found no ready deliveries |

The explicit enabled installation did not authorize a release. No job was
queued or published during host activation, and the queue remains empty.
`dispatch` only enqueues targets already named in a valid authorization and
contacts no remote platform by itself. Active timers cannot create an approval,
authorization, or queue operation.

The installer defaults to disabled when run without `--enable`. The current host
was deliberately installed with its timers enabled; do not confuse that live
state with the safer default used for a new or replacement machine.

The operator sequence is:

```bash
drm-publish prepare /absolute/path/to/episode.json
drm-publish show <job-id>
drm-publish approve <job-id> \
  --hash <approval-hash> --by "Otto" \
  --confirm "approve <job-id> <approval-hash>"
drm-publish authorize <job-id> \
  --hash <approval-hash> --by "Otto" --targets "vimeo" \
  --confirm "authorize-release <job-id> <approval-hash> vimeo"
drm-publish dispatch <job-id>
drm-publish queue <job-id>
drm-publish host status
drm-publish host pause --confirm "pause-publisher"

# Only after an intentional pause or allowlist change; current live state is Vimeo-only.
drm-publish host run \
  --platforms "vimeo" \
  --confirm "run-publisher vimeo"

# Resume a post-write operation only through its exact durable checkpoint.
drm-publish reconcile <operation-id> \
  --reason "resume exact checkpoint after reviewed interruption" \
  --confirm "reconcile-operation <operation-id>"

# Release a blocked create slot only with reviewed proof of no provider write.
drm-publish supersede <operation-id> \
  --reason "replace invalid pre-write job" \
  --evidence "operation events prove no provider write intent" \
  --confirm "supersede-no-remote-write <operation-id>"
drm-publish receipts <job-id>
drm-publish status <job-id>
```

The publisher retains the manual immutable receipt command for independently
observed attended actions:

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
they neither authorize nor perform a remote action. The implemented adapters
write receipts automatically only after authenticated preflight and remote
readback. A valid `release-authorization.json`, not a receipt, is the separate
authority for a controller side effect.

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

Format validation is not account verification. Every implemented adapter queries
the authenticated account, compares its immutable ID with
`publishing/platforms.json`, and stops before a write on any mismatch.

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

## Remaining one-time gates

These are account or product gates, not missing permission for the host to guess
its way forward:

1. **YouTube owner OAuth:** run `drm-publish auth youtube` while signed into
   `michaeljameshofer@gmail.com`, the owner of channel
   `UCFA1nVv4lKMBlx81gjMAOFQ`. The DRM project account is a Manager; YouTube
   channel-permission delegates cannot authorize API uploads for the owned
   channel. The helper rejects and removes a grant for the wrong channel.
2. **YouTube compliance:** complete the applicable YouTube API compliance audit
   before authorizing `unlisted` or `public` API uploads. The controller enforces
   that gate from checked-in non-secret platform state.
3. **RSS.com API access:** either keep the current free plan and use the attended
   dashboard, or separately approve a Max upgrade and configure the private v4
   API key. The adapter is implemented, but this tooling does not purchase or
   upgrade a subscription.
4. **Instagram API:** complete the linked-Page, Facebook Login for Business,
   authenticated publishing-ID, permission, token, cover-delivery, and first
   controlled-release gates in [Instagram media delivery](#instagram-media-delivery).
   Keep the Instagram account as a Creator professional account.
5. **Amazon claim:** submit the canonical RSS.com feed once, complete the owner
   verification, and record the stable listing ID. Future episode audio then
   arrives through RSS fan-out.

Spotify video remains an attended replacement on the RSS-created episode
because Spotify exposes no supported creator upload API for this workflow.
Apple and Amazon podcast audio are RSS fan-out plus readback, not separate
episode uploads. Rumble remains excluded and untouched pending written platform
permission.

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
2. Completed historical baseline: all seven normalized RSS.com enclosures left the captured August
   5 GUID set unchanged and pass remote download, full-decode, and loudness
   gates; artwork parity remains verified. Apple now applies its historical
   Episode 1-2 GUIDs only through the separate overlay.
3. Historical August 6 routing: Apple show `1870433419` was configured directly
   to RSS.com. This was superseded on August 26 by the active Apple-only overlay;
   do not restore the historical feed URL.
4. Publication pending: authenticated Connect shows six Available and two Draft
   RSS records with playable audio; public Apple shows six of eight. Keep show
   `1870433419` on the overlay and await the authenticated Missing Podcast(s)
   escalation referencing case `20000130526608`. Do not refresh again, mutate
   either feed, create replacements, or change stable IDs.
5. Pending: submit the RSS.com feed once to Amazon, complete ownership
   verification, and record the stable show ID and public URL.
6. Historical August 7 baseline: all seven corrected Spotify videos were
   attached to the existing episode IDs. Current August 22 state preserves all
   seven IDs and corrected RSS audio, but Episode 5 is audio-only pending the
   staged Creator Support request; the other six video attachments remain. There
   is no account-wide video switch. Retain the existing-episode `Upload video`
   procedure for future video episodes.
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

This was a catalog identity incident, not a reason to recreate the show or
either episode. The Apple-only overlay now restores the historical Episode 1-2
GUIDs while RSS.com and Spotify remain unchanged. The current action is to await
the authenticated Missing Podcast(s) escalation requesting publication of the
existing Apple records in place. Keep overlay routing active independently of
the pending outcome. Do not point Apple directly at RSS.com, refresh again,
mutate either feed, delete or recreate records, or run the superseded canary
plan.

## Instagram media delivery

Add `https://drmexperienced.com` through the Instagram mobile app because the
current desktop profile editor exposes external-link management as mobile-only.
Meta API configuration is a separate one-time account gate.

### Creator account and login model

Keep `@drmexperienced` as a Creator professional account. Meta supports content
publishing for Creator and Business professional accounts; this workflow does
not require conversion to Business. Use **Instagram API with Facebook Login for
Business** because Meta documents local-file resumable video upload only for
that login model. The alternative Instagram Login model does not require a
Facebook Page, but it is not the documented path for uploading a local video
directly from this workstation. A Meta app uses one login model, not both.

For this single owned and managed account, Meta documents Standard Access with
no App Review when the account is added to the app in the App Dashboard. Serving
accounts that the owner does not own or manage would require Advanced Access and
App Review.

### One-time prerequisites

1. Configure a Meta app with Facebook Login for Business, its basic settings,
   and an exact approved OAuth redirect URI.
2. Link a Facebook Page to the Instagram Creator account. The authenticating
   Facebook user must have the Page's `MANAGE` or `CREATE_CONTENT` task. Complete
   Page Publishing Authorization and Facebook two-factor authentication if Meta
   requires either for that Page.
3. Grant `instagram_basic`, `instagram_content_publish`, and
   `pages_read_engagement`; use `pages_show_list` to discover the Page through
   `/me/accounts`. If the Page role was granted through Business Manager, the
   endpoint reference also requires one of `ads_management` or `ads_read`.
4. Read back and bind the exact Page ID, Page tasks, stable Instagram Graph user
   ID, username, and `Media_Creator` account type. Do not substitute a public
   profile ID for the authenticated publishing ID.
5. Exchange the initial Facebook user token for a long-lived user token, derive
   the long-lived Page token, and store it only in the owner-protected workstation
   credential store. Meta says a long-lived Page token has no time expiration,
   but it can still be invalidated, so every release must revalidate the account
   and permissions before a write.

### Conservative Graph v26 Reel flow

After an exact release packet is reviewed and authorized, the adapter should:

1. Query `GET /v26.0/me/accounts` and the bound Instagram account to verify the
   Page, Page tasks, Instagram Graph ID, username, and Creator account type.
2. Query `GET /v26.0/<IG_ID>/content_publishing_limit?fields=quota_usage,config`
   and stop before the provider-reported quota is exhausted.
3. Create one Reel container with
   `POST /v26.0/<IG_ID>/media`, `media_type=REELS`,
   `upload_type=resumable`, the exact approved caption, and the approved cover
   choice. Durably checkpoint the returned container ID and returned
   `rupload.facebook.com` URI before continuing.
4. Send the immutable staged local video to the returned
   `https://rupload.facebook.com/ig-api-upload/v26.0/<CONTAINER_ID>` URI with
   the documented OAuth authorization, byte offset, and file size headers.
5. Poll `GET /v26.0/<CONTAINER_ID>?fields=status_code,status` no more than once
   per minute for five minutes. Publish only from `FINISHED`; preserve and
   reconcile `IN_PROGRESS`, and stop on `ERROR` or `EXPIRED`.
6. Treat `POST /v26.0/<IG_ID>/media_publish` with the checkpointed
   `creation_id` as the public-release boundary. Instagram exposes no private or
   unlisted Reel through this flow. A lost response is ambiguous: do not repeat
   the publish request or create another container without exact reconciliation.
7. Checkpoint the returned media ID immediately, then read back its owner,
   username, caption, `media_type`, `media_product_type`, permalink, thumbnail,
   and timestamp. Require `VIDEO`, `REELS`, the bound account, and exact approved
   copy before recording a verified receipt.

Containers expire after 24 hours, so scheduled work must create and upload near
the approved release time. Meta's reference documents a single local binary
upload request and an initial offset, but no offset-query recovery endpoint.
After an uncertain upload response, poll and reconcile only the existing
container; never assume that replaying the upload or container creation is safe.

### Covers, limits, and blockers

A custom Reel cover is not part of the local resumable video body. `cover_url`
must point to a publicly retrievable JPEG no larger than 8 MB in sRGB; Meta
recommends 9:16. If both `cover_url` and `thumb_offset` are supplied, the URL
wins. The adapter must either fetch the approved cover URL and verify that its
bytes match a distinct approved `instagramCover` hash before container creation,
or use an explicitly approved `thumb_offset` in milliseconds. Do not reuse a
16:9 episode thumbnail as an implicit Reel cover.

Meta's current documents disagree on the publish quota: the June 30 content
guide says 100 API-published posts per rolling 24 hours, while the publishing
limit and media-publish references document 50 per 86,400 seconds. Query the
live `config.quota_total` and conservatively cap this publisher at 50 until an
authenticated response proves a different current limit. Separately, an account
can create at most 400 containers per rolling 24 hours. The general Reel
parameter table documents `share_to_feed`, but the resumable request syntax
omits it; bind an explicit value and validate it during the first controlled
release before adopting a default.

Current blockers are the unverified Meta app/login configuration, linked Page
and Page tasks, stable Instagram Graph publishing ID, granted scopes, private
token, public cover-delivery mechanism, distinct `instagramCover` asset role,
reviewed `share_to_feed` and cover controls, controller adapter, and per-platform
automation gate. The first end-to-end exercise must be an explicitly approved
real public Reel because this API flow has no unlisted test release.

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
- RSS.com API access and Max requirement: <https://help.rss.com/en/support/solutions/articles/44002648949-api-access>
- RSS.com v4 API documentation: <https://api.rss.com/v4/docs>
- YouTube video upload endpoint: <https://developers.google.com/youtube/v3/docs/videos/insert>
- YouTube authentication: <https://developers.google.com/youtube/v3/guides/authentication>
- YouTube API audit process: <https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits>
- YouTube channel permissions and API limitation: <https://support.google.com/youtube/answer/9367690>
- YouTube video thumbnails: <https://support.google.com/youtube/answer/72431>
- Instagram content publishing: <https://developers.facebook.com/documentation/instagram-platform/content-publishing>
- Instagram media-container and resumable-upload reference: <https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/media>
- Instagram media-publish reference: <https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/media_publish>
- Instagram publishing-limit reference: <https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/content_publishing_limit>
- Instagram published-media readback: <https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media>
- Instagram API with Facebook Login setup: <https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/get-started>
- Instagram App Review and access levels: <https://developers.facebook.com/documentation/instagram-platform/app-review>
- Meta long-lived user and Page tokens: <https://developers.facebook.com/documentation/facebook-login/guides/access-tokens/get-long-lived>
- Meta's official Instagram Postman collection: <https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api>
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

The enabled user timer may execute an external platform action only for a durable
queue operation derived from a current, unexpired
`release-authorization.json`. Live host control generation 1 allows only Vimeo;
the queue is empty. The
authorization record must bind the exact integrity-checked packet, target set,
assets, copy, schedule, visibility, disclosure flags, monetization,
notifications, and license. Any change invalidates review and authorization.
The timer creates no authorization, does not scan Dropbox for implicit intent,
and does not enqueue a job; it runs one guarded controller pass
against already-authorized work.

Authorization alone is insufficient. Every write also requires: the tracked
global gate; the target's tracked `apiAutomation.enabled` gate and unchanged
`policyRevision`; a secure running machine-control file whose allowlist contains
that platform; an account-ID match; and a controller launched from the pinned
Git release under Node 22. All authorized targets enqueue in one transaction or
none do.

A receipt and the local `--by` value remain evidence, not identity
authentication or authority for an external side effect. Before a write, the
controller revalidates the authorization and adapter account. Approved source
bytes are copied into immutable content-addressed private staging before the
upload. Before every provider mutation, the controller records write intent;
provider sessions and identities are then checkpointed durably. After a write,
the adapter reconciles that exact resource before recording `verified`. If a
prior attempt is ambiguous without a safe checkpoint, automatic replay remains
blocked. `supersede` can release a create slot only for a blocked/failed
operation with audited evidence and no write intent, checkpoint, acceptance,
remote ID, or URL.

Browser automation may update already-approved profile text and may prepare drafts/private uploads where the platform permits automated access. It must stop for MFA, CAPTCHA, reauthentication, account agreements, content-rights declarations, AI/synthetic-media disclosures, audience settings, paid promotion, monetization, licensing, public visibility, scheduling, and the final publish action unless those exact values received fresh explicit approval. Rumble is stricter: no automated site access or interaction is permitted without Rumble's prior written permission, even for inspection or draft preparation.
