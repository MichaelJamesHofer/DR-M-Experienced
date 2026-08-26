# Local publishing workflow

This workspace turns one approved episode manifest into a repeatable seven-destination publishing plan. Preparing a job is local-only: it reads media, runs `ffprobe`, calculates SHA-256 fingerprints, and writes an integrity-checked review packet. It never logs in or uploads.

Start with `docs/operations-manual.md` for the complete ecosystem and recovery procedures. See `docs/publishing-platform-setup.md` for the account inventory. `docs/rss-com-migration.md` records the completed RSS.com cutover, its validation evidence, and post-cutover monitoring.

The approved cross-platform removal of visible `Episode N:` title prefixes is
recorded in `publishing/episode-title-migration.json`; that file remains the
dated revision-10 transition evidence. The later Episode 7 description
correction is tracked separately in
`publishing/episode-description-correction.json`. Revision 11 remains the dated
historical Episode 7 correction: RSS.com, Spotify fanout, YouTube, Vimeo, and the
production Supabase editorial readback were verified for that correction. The
corrected website page was also deployed and verified on desktop plus
320/390-pixel mobile views; Apple cache convergence and Rumble's manual reupload
remain pending in that historical receipt.

The current all-episode description standardization is tracked separately in
`publishing/episode-description-standardization.json` for catalog revision 16.
The website-data backfill is applied and read back in production Supabase; the
initial website launch from PR 28 is deployed and publicly verified. RSS.com,
Spotify, Apple, YouTube, and Vimeo have not received or read back the revision-16
descriptions. Rumble is excluded from the automated rollout and remains a
future human-only restaging task; Episode 8 is not onboarded there.
Paid-promotion review remains pending for Episodes 1-7. The receipt records
evidence only; it does not itself authorize distributor writes, new episodes,
GUID changes, or remote-ID changes.

Catalog revision 12 mounted the exact Show Brand Package `1.0.0-rc1` hashes for
local review without granting remote publishing approval. Keep `episodeNumber`
required in the manifest and RSS metadata, and preserve every GUID and remote
content ID.

## Master catalog and binary assets

`publishing/master-catalog.json` is the repository authority for shared show and
episode metadata. It owns the canonical show names and profile copy, canonical
feed binding, artwork references, episode number/slug/title/descriptions/duration,
content flags, asset references, RSS identity, aliases, and verified
episode-level destination IDs and URLs. Validate it against
`publishing/master-catalog.schema.json`; do not independently edit overlapping
values in a job manifest, generated recovery data, Supabase, or a platform
dashboard and leave the catalog stale.

The other stores have narrower roles:

- `publishing/platforms.json` owns account/show/channel routing and stable
  container IDs.
- A private episode manifest owns release-specific choices such as targets,
  schedule, visibility, licensing, monetization, and notifications. It must
  match the selected master-catalog episode before `prepare`.
- Destination-specific `copy.*` values are explicit, review-local exceptions;
  they do not replace the canonical catalog description.
- Supabase owns website-only editorial content and publication state. Its
  overlapping episode identity fields are a checked projection of the catalog.
- `publishing/episode-title-migration.json` is transition evidence, not the live
  metadata authority.
- `publishing/episode-description-correction.json` is immutable historical
  evidence for the revision-11 Episode 7 correction and its partial
  per-destination propagation. Do not rewrite it to represent later copy.
- `publishing/episode-description-standardization.json` is the current
  preparation and propagation-state receipt for the revision-16 all-episode
  description standardization. A prepared or pending target is not verified
  production parity.

The fingerprinted Dropbox file is the binary master for each video, audio file,
and artwork asset. Vimeo is a direct-video destination and useful remote recovery
copy, but it is not a co-master and must never overwrite the local asset binding.
RSS.com is the canonical published-audio host and feed fanout source. Amazon
and Spotify inherit each canonical RSS item and GUID. Apple alone consumes the
active overlay generated from RSS.com; that overlay substitutes Apple's
historical Episode 1-2 GUIDs while preserving every other item field. The
fingerprinted local MP3 remains the canonical audio binary.

Short-form media has a separate authority at
`publishing/short-form-catalog.json`. It assigns platform-neutral IDs to Reels,
recipe clips, and episode excerpts; fingerprints their local masters; records
Instagram and Vimeo identities; and projects them to stable website routes.
Short-form items are never added to the episode catalog or RSS feed. Follow
`docs/short-form-content-system.md` for reconciliation, API setup, and recovery.
All three current Instagram shorts now have verified Vimeo IDs: `1216695521`,
`1216695522`, and `1204939542`. Vimeo title, description, and poster state match
the canonical catalog; all three website routes are deployed and verified.

Dropbox stores large binaries; it is not a metadata database. Map only the
synced Dr. M project folder, never an entire personal Dropbox, in the ignored
workstation file `~/.config/drm-publisher/sources.json`:

```json
{
  "schemaVersion": 1,
  "roots": {
    "dropbox": "/absolute/path/to/the/synced/Dr-M-project-folder"
  }
}
```

Catalog paths remain portable logical references such as
`dropbox:brand/masters/podcast-cover-3000x3000.jpg` and
`dropbox:episodes/008-topic/master-video.mp4`. Do not commit the local absolute
root or media files. A placeholder, online-only file, or matching filename is
not verified. Before an asset can have `status: "verified"`, it must be locally
readable and its exact `sha256` and `sizeBytes` must be recorded in the catalog.
Any binary change requires new fingerprints and a new approval packet.

For every new episode, update the master catalog before running `prepare`:

1. Add its project-relative binary references to `assetRegistry`; leave each
   asset unverified until its hash and byte size are measured from the local
   synced file.
2. Add the next contiguous episode record with approved shared copy, identity,
   content flags, and asset references. Start with `publicationState: "draft"`
   and null externally assigned RSS/destination identities. Never invent an RSS
   GUID, feed timestamp, or platform ID; record it when verified, and change the
   state to `published` only when GUID, publish date, and feed timestamp exist.
   An abandoned draft remains as evidence and its episode number is never reused.
3. Increment `revision`, update `updatedAt`, and run `drm-publish doctor` and the
   publisher tests.
4. Create the private episode manifest with the exact catalog-owned values plus
   target-specific release choices, then run `prepare`.

Catalog/manifest drift is a preparation error. Correct the authoritative
catalog or create a new packet; do not work around the mismatch in a dashboard.
The website's small `src/data/site-brand.generated.json` projection is rebuilt
from the catalog before `dev` and `build`, and its exact content is covered by
the catalog tests.

## Commands

```bash
drm-publish doctor
drm-publish prepare /absolute/path/to/episode.json
drm-publish show <job-id>
drm-publish approve <job-id> --hash <approval-hash> --by "Otto" --confirm "approve <job-id> <approval-hash>"
drm-publish receipt <job-id> --platform <platform-id> \
  --operation-id <operation-id> \
  --status <accepted|processing|published|verified|failed|superseded> \
  --by <recorder> [--remote-id <id>] [--remote-url <https-url>] \
  [--evidence <kind=value>] \
  --confirm "record-receipt <job-id> <platform-id> <approval-hash> <operation-id>"
drm-publish receipts <job-id>
drm-publish status <job-id>
```

Use `drm-publish migration-check [--verify-media] [--verify-artwork]
[--decode-edge-audio] [--snapshot]` to audit migration evidence or investigate
feed drift. It is not part of routine episode publishing.

After registering the episode in `publishing/master-catalog.json`, start from
`publishing/episode.example.json`. `episodeNumber` is required structured data;
the public `title` does not include an `Episode N:` prefix. Keep the real episode
manifest beside the edited media or in another private working directory. Do
not place credentials in the manifest or repository.

Every direct destination needs a `releasePlan` entry. The example deliberately uses `hold` with `not_selected` values so it cannot be mistaken for release approval. Fill in the exact initial and final visibility, platform license, monetization, and notification choices before review. Spotify and Amazon inherit podcast audio through the canonical RSS feed; Apple inherits the same audio through its generated Apple-only overlay. None gets a separate audio-release entry; an optional Spotify `fullVideo` replacement still needs its exact release decisions.

`prepare` creates a job under `~/.local/state/drm-publisher/jobs/`. RSS.com receives `podcastAudio`. After that episode appears in Spotify through RSS, an approved `fullVideo` may replace its audio on Spotify only; audio-only episodes need no direct Spotify upload. The approval hash covers the normalized manifest, platform plan, media paths, media metadata, and media SHA-256 values. `approve` rejects a hash mismatch, a changed review document, any changed source asset, or a missing exact confirmation phrase.

`receipt` appends a private, immutable, hash-bound result for one approved job,
platform, and deterministic operation ID. Use the same operation ID as a request
moves from `accepted` through `processing`, `published`, and `verified`;
`failed` and `superseded` are terminal. Every nonterminal state blocks a second
operation for that platform. `published` and `verified` require a remote ID or
HTTPS URL, while `verified` also requires meaningful typed readback evidence.
The command rejects stale bindings, invalid platform URLs, remote identity
drift, duplicate or regressive states, and concurrent duplicate writes. It
revalidates the entire ledger on every read. `receipts` lists the ledger, while
`status` shows its latest per-destination state. These commands record evidence
only: they do not grant upload/release authority, call platform APIs, or perform
remote reconciliation. Live adapters and automatic reconciliation remain
incomplete.

The baseline and completed remote loudness audit is recorded in
`publishing/audio-replacement-audit.json`. The prior seven RSS enclosures were
under level; all seven normalized replacements now preserve their GUIDs and pass
remote download, full-decode, and loudness gates. `prepare` continues to perform
a full-file `ffmpeg loudnorm` measurement and blocks RSS.com podcast audio or
Spotify replacement video outside `-17` through `-15` LUFS or above `-1 dBTP`.
For every future correction, compare duration/sync, replace audio on the existing
RSS.com episode without changing identity fields, and update catalog/Supabase
enclosure projections only after public feed readback. Corrected Spotify video
must contain the corrected audio.

When the Dropbox project root is configured, `prepare` also requires each media
path to resolve to the episode's catalog asset. A catalog asset marked
`verified` must match the inspected SHA-256 and byte size. On this workstation,
the project root is configured as `/home/otto/Dropbox/Dr M Experienced`. The 21
approved artwork derivatives are organized under `dropbox:episodes` and the
seven catalog thumbnail records are independently fingerprinted. The seven
corrected videos and seven derived podcast-audio MP3s passed full decode,
loudness, duration/sync, video-packet, SHA-256, and catalog-binding checks and
were `verified` in catalog revision 7. Catalog revision 13 records Episode 5's
corrected master, podcast audio, Spotify derivative, RSS enclosure, and
30-minute runtime. RSS.com's seven stable GUIDs, Episode 5's corrected 29:45
enclosure, YouTube's six normalized replacements plus Episode 5 same-ID trim,
and Vimeo's seven stable in-place identities are verified. Spotify preserves all
seven episode IDs and corrected RSS audio, but Episode 5 is audio-only pending
Creator Support while the other six video attachments remain. Rumble's seven corrected uploads require manual
restaging after the browser cache reset. Their exact source videos and
thumbnails remain locally verified. They remain unsubmitted and blocked on
release-control correction, third-party asset-rights review, and on-site human
controls. The user explicitly accepted the July 21, 2026 Terms provisions on
August 8.

## Distribution model

- The supported RSS.com import is complete at `https://media.rss.com/dr-m-experienced/feed.xml`; all seven GUIDs, media files, and artwork assets passed parity. Preserve every imported identity.
- The legacy Anchor URL now returns one HTTP 301 hop to RSS.com. Preserve that redirect and Spotify show `7GGLljxmO0G3FLjPy8vfcw` for RSS audio ingestion, video replacement, analytics, and continuity. Six corrected video attachments remain public; Episode 5 preserves its existing ID and corrected RSS audio but is audio-only pending the staged Creator Support request. There is no account-wide video switch; for future video episodes, use the RSS-ingested episode's `Upload video` action after its corrected master is approved, while leaving intentionally audio-only episodes alone.
- Apple show `1870433419` alone consumes the active Apple-only overlay at `https://drmexperienced.com/apple-podcasts/feed.xml`; RSS.com remains the unchanged canonical source. The overlay restores only Apple's historical Episode 1-2 GUIDs and leaves Spotify identities unchanged. Apple displayed the feed update at 1:04 PM MDT on August 26; a separate refresh was observed complete around 1:06 PM. Authenticated Connect showed six Available and two Draft RSS records with playable audio, while public Apple remained six of eight. The authenticated Missing Podcast(s) escalation referencing case `20000130526608` requests in-place publication with the existing Apple IDs preserved. Outcome is pending. Keep the overlay active; do not point Apple directly at RSS.com, refresh again, mutate either feed, or create replacements. Submit the RSS.com feed once to Amazon and never create duplicate directory listings.
- Both guarded Supabase migrations were applied in production on August 7 after exact SQL-file hash verification. Seven-row readback matches catalog revision 10 for current RSS.com audio URLs, YouTube IDs, and `Watch on YouTube` references.
- The guarded August 8 Episode 7 editorial migration and independent production
  readback match catalog revision 11. GitHub Pages deployment `31276520368` and
  the public-page desktop/mobile readback are verified in
  `publishing/episode-description-correction.json`; that receipt remains
  historical evidence rather than current all-episode parity.
- Catalog revision 16 prepares a uniform description structure for Episodes
  1-8. The corresponding website-data backfill is applied and independently
  read back in production Supabase. PR 28, guarded workflow `32932213291`, and
  deployment `6097420330` record the initial website launch; the apex, eight
  core routes, migrated Episode 3/4 content, affiliate assets, and 320/390-pixel
  layouts were publicly verified. On August 26, the existing RSS.com,
  YouTube, and Vimeo records received the standardized descriptions in place;
  public readback passed 8/8 for RSS.com, Spotify fanout, YouTube, and Vimeo
  without changing any GUID or destination ID. Apple exposes six public
  episodes: Episode 8 has converged, Episodes 3-7 remain cached, and Episodes
  1-2 remain hidden under the known GUID incident. Rumble is excluded from
  automation and deferred to a future manual restaging. Paid-promotion review
  remains pending for Episodes 1-7. Track this rollout only in
  `publishing/episode-description-standardization.json`.
- The three short-form website routes are deployed, sitemap-indexed, and verified
  at 320, 390, and 1440 pixels with exact Vimeo playback bindings.
- Production PostHog ingestion is verified: a POST to `https://us.i.posthog.com/e/` returned 200, and refreshed Installation Health passes `$pageview`, `$pageleave`, scroll depth, and authorized URLs. Dashboard `1086989`, `Dr. M Growth Dashboard`, has a privacy-safe description and verified DAU, WAU, growth-accounting, retention, referring-domain, and pageview-funnel tiles. Reverse proxy remains the only explicit configuration recommendation and is not configured.
- YouTube's seven normalized replacements are public and cataloged; the prior seven uploads remain Unlisted with replacement links and explicit rollback records. Vimeo's seven corrected episode videos are verified in place, and all three short recovery copies are verified as `1216695521`, `1216695522`, and `1204939542` with canonical metadata/posters. On August 8, 2026, the owner explicitly accepted Vimeo's Developer Addendum and Terms for private app `540274`; its owner-only upload/edit token, account binding, and upload quota are verified.
- Instagram should use resumable upload from the approved local Reel. Its website-link editor is mobile-only, and Meta API setup currently waits for the owner's Facebook developer login. A short-lived public staging URL is fallback-only and must be removed after Meta finishes processing.
- Spotify's optional replace-with-video action remains a manual browser step because no supported public creator-upload API is available for that flow. Rumble is human-operated only under the current Terms: the exact seven corrected asset pairs remain locally verified and unsubmitted, but require manual restaging after the cache reset.

## Rumble manual nonexclusive guard

Rumble's [Terms](https://rumble.com/s/terms), last modified July 21, 2026,
prohibit automated software access or interaction without Rumble's prior written
permission. Do not connect the Chrome DevTools bridge to Rumble, drive the site
with scripts, or automate inspection, editing, checkbox attestations, or
submission. A logged-in Rumble tab is for direct human use only unless Rumble
provides written permission.

Generate the private, offline manual handoff before restaging:

```bash
npm run publish:rumble-manual-packet
```

The command rehashes every catalog-bound Episode 1-7 video and thumbnail and
writes a mode-0600 packet under
`~/.local/state/drm-publisher/rumble/manual-release-episodes-1-7.md`. It stops
without output if any byte size or SHA-256 differs. The packet contains exact
copy and paths plus the human-only release checklist; it never opens Rumble or
authorizes a release.

This project's only permitted Rumble license is Option C, `Rumble Only
(non-exclusive, similar to YouTube)`, represented in manifests as
`rumble_only_option_c`. Rumble's official [licensing
explanation](https://rumble.support/help/a-simple-explanation-of-the-differences-between-licensing-options)
describes that option as non-exclusive. Never select Option A `Video Management`
or Option B `Video Management (excluding YouTube)`; both grant exclusive agency
rights. `Personal Use` is also outside this project's release policy. Keep the
initial visibility Unlisted, Premium/exclusive placement off, and YouTube,
Vimeo, Facebook, and every other additional-syndication control off.

Option C does not remove the Terms' separate General License. The July 21 Terms
include AI/ML training rights and third-party AI sublicensing rights, which the
user explicitly accepted on August 8, 2026. Their third-party-material
provisions separately require a human review of every music, footage, graphic,
and other incorporated asset; Terms acceptance does not clear those rights.

The August 7 audit found 7/7 corrected uploads staged Unlisted with Option C,
Vimeo/Facebook syndication off, hidden YouTube syndication on, and Premium
unverified. The August 8 cache reset invalidated those forms. Before each manual
submission, the user must restage the exact verified assets, disable all
syndication, reverify Option C and Unlisted, verify Premium is off, complete the
rights review, directly check the rights and July 21 Terms controls, and click
submit. Record the resulting ID/URL afterward without reopening Rumble through
automation.

The live phase must always begin from an unchanged, integrity-checked job. The current local review record is self-reported attribution, not identity authentication, and explicitly grants neither upload nor release authority. The immutable receipt ledger records observed remote lifecycle evidence but does not authorize or perform an external action. Future upload adapters must require a separate user-presence-backed authorization, create private or draft content where supported, write the returned IDs and URLs into the ledger, reconcile remote state, and require another explicit confirmation before public release.

`publishing/platforms.json` stores stable account and show/channel/container IDs separately from mutable profile URLs. Missing required IDs produce `destination_id_required`; unresolved release choices produce `release_choices_required`. Both states block local review attestation as well as later automation.

## Browser bridge

The workstation has a pinned local Chrome DevTools bridge for Spotify and other
account settings that permit this access. It uses the isolated Chrome data
directory `~/.local/share/drm-publisher/chrome-profile`; it never attaches to
Otto's normal Chrome data. Inside that directory, `Default` is
`drmexperienced@gmail.com` for every publishing platform and `Profile 1` is
`ottotheautonomous@gmail.com` for GitHub and Supabase. Never sign out the DRM
identity or copy authentication material between profiles. Rumble is an explicit
exception: keep its tabs in the DRM profile but do not connect the automation
bridge without Rumble's prior written permission.

```bash
# One time: sign in to the assigned project dashboards in both isolated
# profiles, then close that browser normally.
drm-browser login

# During an attended publishing session, select exactly one platform:
drm-browser open
drm-browser identities
drm-browser connect spotify
drm-browser connect supabase
drm-browser status
drm-browser disconnect
drm-browser close
```

The `login` command does not expose a debugging endpoint. The `open` command exposes one only on loopback for this isolated data directory. `identities` validates the exact account-to-profile mapping. For permitted platforms, `connect` stops the previous bridge, preserves tabs and sessions in both profiles, activates the requested dashboard in its assigned profile, and restricts the new bridge to that scope. The wrapper rejects both `connect rumble` and `reauth rumble`, and future wrapper launches do not open Rumble automatically; use an already-open or manually opened tab directly. The bridge also redacts sensitive network headers, disables usage statistics and external update/CrUX lookups, and omits network, performance, and extension tooling. Disconnect when unattended. `drm-browser close` closes both isolated-profile windows and verifies that the debugging endpoint is gone without signing either account out.

Browser access is not a release authorization. Default automation behavior is to inspect, fill, and save a draft/private item where the platform permits it. Instagram has no durable private publishing draft and requires an explicit final-action confirmation. Rumble is manual-only under the July 21 Terms; the user performs its site interactions, factual attestations, Terms acceptance, and submission directly.

## One-time account work

1. Completed: removed `RSSVERIFY` from the dashboard/XML copy, cleared Episode 3's stray Season 1 value, aligned Episodes 4-7 with the catalog, and verified one Anchor 301 hop to RSS.com. RSS.com's separate public landing-page cache still exposes the token and remains a follow-up item.
2. YouTube and Vimeo public readback, plus authenticated Rumble persistence,
   confirmed the then-current seven titles and descriptions as of August 5,
   2026. That is revision-10 historical evidence. The revision-11 Episode 7
   correction is separately preserved in
   `publishing/episode-description-correction.json`. The revision-16
   all-episode standardization is now applied to Supabase, the website,
   RSS.com, YouTube, and Vimeo; Spotify's RSS fanout also passed public readback.
   Apple cache convergence remains pending as recorded in
   `publishing/episode-description-standardization.json`. Every stable GUID and
   destination ID was preserved.
3. Completed: the supported RSS.com import passed exact GUID, metadata, media, artwork, and edge-audio validation, and the Anchor redirect returns the expected 301.
4. Apple show `1870433419` consumes the active Apple-only overlay derived from the unchanged RSS.com feed. The overlay restores Apple's historical Episode 1-2 GUIDs only. Authenticated Connect is six Available/two Draft with playable RSS audio; public Apple is six of eight. Await the authenticated Missing Podcast(s) escalation under case `20000130526608`. Keep routing on the overlay and do not refresh again, mutate either feed, replace the show, or recreate episodes.
5. Submit the canonical RSS.com feed once to Amazon and record the stable show ID and URL.
6. Google Cloud project `dr-m-experienced-publisher`, YouTube Data API v3, and the production desktop OAuth client are configured, and the owner approved Google Cloud's terms on August 8, 2026. Complete the one-time OAuth grant as production channel owner `michaeljameshofer@gmail.com`, then record the applicable YouTube upload compliance audit before public or Unlisted API uploads.
7. Completed August 8, 2026: the owner accepted Vimeo's Developer Addendum and Terms for private app `540274`; its own-account `upload`/`edit` token, exact account `253415660`, and current upload quota are verified. Each future remote write still requires an exact expiring release authorization.
8. Instagram is confirmed as a Creator professional account. Add the website link through its mobile-only editor, then have the owner complete Facebook developer login before Meta app authorization and resumable-upload setup. Configure temporary public staging only as a fallback. All three current Reels have verified Vimeo recovery IDs, canonical posters, and deployed website routes.
9. Keep Rumble and Spotify browser sessions local. Do not export cookies or
   passwords into this repository. Do not attach automation to Rumble absent
   written permission; use the manual nonexclusive checklist above.
10. Completed August 7, 2026: replaced the seven quiet RSS audio masters while
    preserving GUIDs, then restored corrected video to the seven existing Spotify
    episode identities without duplicates. Keep this identity-preserving sequence
    as the procedure for future corrections.
