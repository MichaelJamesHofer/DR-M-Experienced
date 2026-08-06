# Local publishing workflow

This workspace turns one approved episode manifest into a repeatable seven-destination publishing plan. Preparing a job is local-only: it reads media, runs `ffprobe`, calculates SHA-256 fingerprints, and writes an integrity-checked review packet. It never logs in or uploads.

Start with `docs/operations-manual.md` for the complete ecosystem and recovery procedures. See `docs/publishing-platform-setup.md` for the account inventory. `docs/rss-com-migration.md` records the completed RSS.com cutover, its validation evidence, and post-cutover monitoring.

The approved cross-platform removal of visible `Episode N:` title prefixes is
recorded in `publishing/episode-title-migration.json`. The RSS.com, website,
YouTube, Vimeo, and Rumble batch is complete. Keep `episodeNumber` required in
the manifest and RSS metadata, preserve every GUID and remote content ID, and
use the evidence file to finish Apple, Instagram, Amazon, and artwork propagation.

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

Every direct destination needs a `releasePlan` entry. The example deliberately uses `hold` with `not_selected` values so it cannot be mistaken for release approval. Fill in the exact initial and final visibility, platform license, monetization, and notification choices before review. Spotify, Apple, and Amazon inherit podcast audio through the canonical RSS feed and do not get separate audio-release entries; an optional Spotify `fullVideo` replacement still needs its exact release decisions.

`prepare` creates a job under `~/.local/state/drm-publisher/jobs/`. RSS.com receives `podcastAudio`. After that episode appears in Spotify through RSS, an approved `fullVideo` may replace its audio on Spotify only; audio-only episodes need no direct Spotify upload. The approval hash covers the normalized manifest, platform plan, media paths, media metadata, and media SHA-256 values. `approve` rejects a hash mismatch, a changed review document, any changed source asset, or a missing exact confirmation phrase.

When the Dropbox project root is configured, `prepare` also requires each media
path to resolve to the episode's catalog asset. A catalog asset marked
`verified` must match the inspected SHA-256 and byte size. On this workstation
the root is currently unconfigured and catalog assets are `unmounted`, so
`prepare` records a visible warning and binds metadata/fingerprints without
claiming independent Dropbox path verification.

## Distribution model

- The supported RSS.com import is complete at `https://media.rss.com/dr-m-experienced/feed.xml`; all seven GUIDs, media files, and artwork assets passed parity. Preserve every imported identity.
- The legacy Anchor URL now returns one HTTP 301 hop to RSS.com. Preserve that redirect and Spotify show `7GGLljxmO0G3FLjPy8vfcw` for RSS audio ingestion, optional video replacement, analytics, and continuity.
- Apple show `1870433419` is configured directly to RSS.com with exact metadata, but still exposes five Available episodes and has three Draft records to inspect. Submit the RSS.com feed once to Amazon and never create duplicate directory listings.
- Production Supabase has the exact seven catalog-projected RSS.com audio URLs; the guarded migration and catalog readback passed.
- YouTube, Vimeo, and Instagram have official API routes, but each needs account authorization and platform-specific setup.
- Instagram should use resumable upload from the approved local Reel. A short-lived public staging URL is fallback-only and must be removed after Meta finishes processing.
- Rumble VOD and Spotify's optional replace-with-video action remain manual browser steps because no supported public creator-upload API is available for those flows.

The live phase must always begin from an unchanged, integrity-checked job. The current local review record is self-reported attribution, not identity authentication, and explicitly grants neither upload nor release authority. Future upload adapters must require a separate user-presence-backed authorization, create private or draft content where supported, record returned IDs and URLs, and require another explicit confirmation before public release.

`publishing/platforms.json` stores stable account and show/channel/container IDs separately from mutable profile URLs. Missing required IDs produce `destination_id_required`; unresolved release choices produce `release_choices_required`. Both states block local review attestation as well as later automation.

## Browser bridge

The workstation has a pinned local Chrome DevTools bridge for Spotify, Rumble, and account settings that do not expose a suitable API. It uses the isolated Chrome data directory `~/.local/share/drm-publisher/chrome-profile`; it never attaches to Otto's normal Chrome data. Inside that directory, `Default` is `drmexperienced@gmail.com` for every publishing platform and `Profile 1` is `ottotheautonomous@gmail.com` for GitHub and Supabase. Never sign out the DRM identity or copy authentication material between profiles.

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

The `login` command does not expose a debugging endpoint. The `open` command exposes one only on loopback for this isolated data directory. `identities` validates the exact account-to-profile mapping. `connect` accepts `rss`, `spotify`, `apple`, `amazon`, `youtube`, `vimeo`, `instagram`, `rumble`, or `supabase`; it stops the previous bridge, preserves tabs and sessions in both profiles, activates the requested dashboard in its assigned profile, and restricts the new bridge to that scope. The bridge also redacts sensitive network headers, disables usage statistics and external update/CrUX lookups, and omits network, performance, and extension tooling. Disconnect when unattended. `drm-browser close` closes both isolated-profile windows and verifies that the debugging endpoint is gone without signing either account out.

Browser access is not a release authorization. Default automation behavior is to inspect, fill, and save a draft/private item where the platform supports one. Instagram has no durable private publishing draft, and Rumble's best documented review state is unlisted; both require an explicit final-action confirmation.

## One-time account work

1. Completed: removed `RSSVERIFY`, cleared Episode 3's stray Season 1 value, aligned Episodes 4-7 with the catalog, and verified one Anchor 301 hop to RSS.com.
2. YouTube and Vimeo public readback, plus authenticated Rumble persistence,
   confirms all seven titles and descriptions match deterministic catalog
   projections as of August 5, 2026.
3. Completed: the supported RSS.com import passed exact GUID, metadata, media, artwork, and edge-audio validation, and the Anchor redirect returns the expected 301.
4. Apple show `1870433419` is configured directly to RSS.com. Repair its five-Available/three-Draft discrepancy in place; do not replace the show or delete uninspected drafts.
5. Submit the canonical RSS.com feed once to Amazon and record the stable show ID and URL.
6. Create a Google OAuth desktop client, enable YouTube Data API v3, and complete YouTube's upload compliance audit before public API uploads.
7. Create or confirm a Vimeo API app with upload access and an own-account token carrying `upload` and `edit` scopes.
8. Confirm Instagram is a professional account, create the Meta app, authorize content-publishing permissions, and configure resumable local upload. Configure temporary public staging only as a fallback.
9. Keep Rumble and Spotify browser sessions local. Do not export cookies or passwords into this repository.
