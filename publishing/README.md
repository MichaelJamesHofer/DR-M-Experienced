# Local publishing workflow

This workspace turns one approved episode manifest into a repeatable seven-destination publishing plan. Preparing a job is local-only: it reads media, runs `ffprobe`, calculates SHA-256 fingerprints, and writes an integrity-checked review packet. It never logs in or uploads.

Start with `docs/operations-manual.md` for the complete ecosystem and recovery procedures. See `docs/publishing-platform-setup.md` for the account inventory and `docs/rss-com-migration.md` for the guarded audio-host migration.

The planned cross-platform removal of visible `Episode N:` title prefixes is
recorded in `publishing/episode-title-migration.json`. Do not apply it piecemeal;
the RSS.com cutover, Apple recovery, structured episode numbers 1-7, and all
title approvals must be complete first.

## Commands

```bash
drm-publish doctor
drm-publish migration-check [--verify-media] [--snapshot]
drm-publish prepare /absolute/path/to/episode.json
drm-publish show <job-id>
drm-publish approve <job-id> --hash <approval-hash> --by "Otto" --confirm "approve <job-id> <approval-hash>"
drm-publish status <job-id>
```

Start from `publishing/episode.example.json`. `episodeNumber` is required, and `title` must begin with the matching `Episode N:` prefix. Keep the real episode manifest beside the edited media or in another private working directory. Do not place credentials in the manifest or repository.

Every direct destination needs a `releasePlan` entry. The example deliberately uses `hold` with `not_selected` values so it cannot be mistaken for release approval. Fill in the exact initial and final visibility, platform license, monetization, and notification choices before review. Apple and Amazon inherit the podcast-audio release through the canonical RSS feed and do not get separate release entries.

`prepare` creates a job under `~/.local/state/drm-publisher/jobs/`. Spotify prefers `fullVideo` and can fall back to a supplied `podcastAudio` file for an audio-only episode. The approval hash covers the normalized manifest, platform plan, media paths, media metadata, and media SHA-256 values. `approve` rejects a hash mismatch, a changed review document, any changed source asset, or a missing exact confirmation phrase.

## Distribution model

- Spotify for Creators remains the current podcast host until the RSS.com import is complete, feed parity is proven, and the redirect receives fresh explicit approval. `publishing/hosting-migration.json` records that transition; a candidate RSS.com feed must never replace the live feed merely because it exists.
- After a verified cutover, RSS.com will host podcast audio for Apple, Spotify, and Amazon. Spotify video remains a separate upload because changing the audio host does not replace the Spotify video workflow.
- Apple Podcasts and Amazon Music/Audible ingest episode audio from the canonical RSS feed: Anchor before cutover and RSS.com after the verified cutover. Do not create separate episode uploads there.
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

1. Follow `docs/rss-com-migration.md` to import and validate the existing show. Do not redirect, delete the empty RSS.com show, or create new directory listings during preparation.
2. Confirm the existing Apple Podcasts listing is claimed in Apple Podcasts Connect and resolve the preexisting episode-count discrepancy.
3. After the imported feed is validated, add or claim it once in Amazon and record the new stable show ID and URL. The signed-in Amazon account currently has no claimed show and no defensible existing public listing.
4. Create a Google OAuth desktop client, enable YouTube Data API v3, and complete YouTube's upload compliance audit before public API uploads.
5. Create or confirm a Vimeo API app with upload access and an own-account token carrying `upload` and `edit` scopes.
6. Confirm Instagram is a professional account, create the Meta app, authorize content-publishing permissions, and configure resumable local upload. Configure temporary public staging only as a fallback.
7. Keep Rumble and Spotify browser sessions local. Do not export cookies or passwords into this repository.
