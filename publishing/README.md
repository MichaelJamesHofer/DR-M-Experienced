# Local publishing workflow

This workspace turns one approved episode manifest into a repeatable seven-destination publishing plan. Preparing a job is local-only: it reads media, runs `ffprobe`, calculates SHA-256 fingerprints, and writes an integrity-checked review packet. It never logs in or uploads.

Start with `docs/operations-manual.md` for the complete ecosystem and recovery procedures. See `docs/publishing-platform-setup.md` for the account inventory. `docs/rss-com-migration.md` tracks the active pre-cutover RSS.com import and its hard validation and redirect gates.

The approved cross-platform removal of visible `Episode N:` title prefixes is
recorded in `publishing/episode-title-migration.json`. The Anchor, website,
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

Use `drm-publish migration-check [--verify-media] [--snapshot]` only after the
supported import produces a candidate feed; a failed gate blocks cutover.

After registering the episode in `publishing/master-catalog.json`, start from
`publishing/episode.example.json`. `episodeNumber` is required structured data;
the public `title` does not include an `Episode N:` prefix. Keep the real episode
manifest beside the edited media or in another private working directory. Do
not place credentials in the manifest or repository.

Every direct destination needs a `releasePlan` entry. The example deliberately uses `hold` with `not_selected` values so it cannot be mistaken for release approval. Fill in the exact initial and final visibility, platform license, monetization, and notification choices before review. Apple and Amazon inherit the podcast-audio release through the canonical RSS feed and do not get separate release entries.

`prepare` creates a job under `~/.local/state/drm-publisher/jobs/`. Spotify prefers `fullVideo` and can fall back to a supplied `podcastAudio` file for an audio-only episode. The approval hash covers the normalized manifest, platform plan, media paths, media metadata, and media SHA-256 values. `approve` rejects a hash mismatch, a changed review document, any changed source asset, or a missing exact confirmation phrase.

When the Dropbox project root is configured, `prepare` also requires each media
path to resolve to the episode's catalog asset. A catalog asset marked
`verified` must match the inspected SHA-256 and byte size. On this workstation
the root is currently unconfigured and catalog assets are `unmounted`, so
`prepare` records a visible warning and binds metadata/fingerprints without
claiming independent Dropbox path verification.

## Distribution model

- Spotify for Creators/Anchor remains canonical during the active RSS.com import. Preserve show `7GGLljxmO0G3FLjPy8vfcw` and every existing episode GUID.
- RSS.com is the intended host after a verified supported import and separately approved redirect. Never populate the empty show manually or treat it as canonical before parity checks pass.
- Preserve Apple show `1870433419` and update it in place after cutover. Hold Amazon, then submit the final canonical RSS.com feed once; never create duplicate directory listings.
- YouTube, Vimeo, and Instagram have official API routes, but each needs account authorization and platform-specific setup.
- Instagram should use resumable upload from the approved local Reel. A short-lived public staging URL is fallback-only and must be removed after Meta finishes processing.
- Rumble VOD and the current Spotify creator upload remain manual browser steps because no supported public creator-upload API is available for those flows.

The live phase must always begin from an unchanged, integrity-checked job. The current local review record is self-reported attribution, not identity authentication, and explicitly grants neither upload nor release authority. Future upload adapters must require a separate user-presence-backed authorization, create private or draft content where supported, record returned IDs and URLs, and require another explicit confirmation before public release.

`publishing/platforms.json` stores stable account and show/channel/container IDs separately from mutable profile URLs. Missing required IDs produce `destination_id_required`; unresolved release choices produce `release_choices_required`. Both states block local review attestation as well as later automation.

## Browser bridge

The workstation has a pinned local Chrome DevTools bridge for Spotify, Rumble, and account settings that do not expose a suitable API. It uses an isolated profile at `~/.local/share/drm-publisher/chrome-profile`; it never attaches to Otto's normal Chrome data or copies cookies from it.

```bash
# One time: sign in to the seven project dashboards in the isolated window,
# then close that window normally.
drm-browser login

# During an attended publishing session, select exactly one platform:
drm-browser open
drm-browser connect spotify
drm-browser status
drm-browser disconnect
drm-browser close
```

The `login` command does not expose a debugging endpoint. The `open` command exposes one only on loopback and only for the isolated profile. `connect` requires one of `rss`, `spotify`, `apple`, `amazon`, `youtube`, `vimeo`, `instagram`, or `rumble`; the command-line bridge blocks Gmail and every other publishing origin for that session. It also redacts sensitive network headers, disables usage statistics and external update/CrUX lookups, and omits network, performance, and extension tooling. Disconnect before switching platforms. Keep email and unrelated tabs out of this profile. `drm-browser close` is the security boundary: it closes Chrome and verifies that the debugging endpoint is gone.

Browser access is not a release authorization. Default automation behavior is to inspect, fill, and save a draft/private item where the platform supports one. Instagram has no durable private publishing draft, and Rumble's best documented review state is unlisted; both require an explicit final-action confirmation.

## One-time account work

1. Spotify source cleanup is complete: exact description, no `RSSVERIFY`, seven approved titles, structured numbers 1-7, and unchanged GUIDs.
2. YouTube and Vimeo public readback, plus authenticated Rumble persistence,
   confirms all seven titles and descriptions match deterministic catalog
   projections as of August 5, 2026.
3. Complete and validate the supported RSS.com import. Keep Anchor canonical until the exact redirect receives separate approval.
4. Repair existing Apple show `1870433419` in place, then update that same listing
   during cutover. Leave the separate nonpublic Draft untouched until its content
   and subscription settings have been inspected.
5. Hold Amazon until cutover, then submit the final canonical RSS.com feed once and record the stable show ID and URL.
6. Create a Google OAuth desktop client, enable YouTube Data API v3, and complete YouTube's upload compliance audit before public API uploads.
7. Create or confirm a Vimeo API app with upload access and an own-account token carrying `upload` and `edit` scopes.
8. Confirm Instagram is a professional account, create the Meta app, authorize content-publishing permissions, and configure resumable local upload. Configure temporary public staging only as a fallback.
9. Keep Rumble and Spotify browser sessions local. Do not export cookies or passwords into this repository.
