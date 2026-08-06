# RSS.com Hosting Migration

Status: completed August 6, 2026. RSS.com is canonical at
`https://media.rss.com/dr-m-experienced/feed.xml`. The legacy Anchor feed
returns one direct HTTP 301 hop to that exact URL, which returns HTTP 200. All
seven GUIDs, metadata records, audio files, and artwork assets passed parity;
the canonical feed has exact copy, no `RSSVERIFY`, and no season tags.

Apple show `1870433419` was configured directly to the RSS.com feed at
approximately 18:29 UTC on August 6. Its authenticated title and description are
exact and token-free. The duplicate Draft show and stale manual Episode 4 Draft
were archived, but only five episodes are Available. RSS Episodes 1-2 remain
`DRAFTING`/`HIDDEN` after one feed refresh. A reprocessing request was submitted
to Apple support on August 6, 2026 and is awaiting response.

The machine-readable record is `publishing/hosting-migration.json`. Private raw
feed snapshots belong under `~/.local/state/drm-publisher/migrations/`, never in
the repository.

## Current Decision

- Keep Spotify show `7GGLljxmO0G3FLjPy8vfcw`, its account, and the verified
  Anchor redirect active. RSS.com remains canonical.
- Preserve the imported `dr-m-experienced` slug and all seven original GUIDs.
- Publish podcast audio to RSS.com. After Spotify ingests an RSS episode, use
  Spotify for Creators only to replace that existing episode with approved video
  when applicable; do not upload duplicate or fallback audio episodes.
- Preserve Apple show `1870433419` while Apple processes the submitted support
  request for its two valid but `DRAFTING`/`HIDDEN` RSS records. Do not submit a
  replacement show.
- Submit the canonical RSS.com feed once to Amazon, complete owner verification,
  and record its stable listing ID and URL.
- Monitor directory caches and Podcast Index convergence without changing the
  canonical host or GUIDs.

RSS.com's free plan provides directory-submission convenience but no supported
publishing API; API access is limited to its paid Network plan. The repository
master catalog and attended publisher remain necessary for direct video/social
destinations regardless of host.

## Historical Evidence

- The source Anchor feed returned seven episodes with seven unique original
  GUIDs when baselined on August 5, 2026.
- A supported Switch to RSS request was submitted at
  `2026-08-05T04:32:55Z`.
- RSS.com requested `RSSVERIFY`; the token was added to the source description,
  observed publicly, and confirmed to support at `2026-08-05T17:22:25Z`.
- During an earlier abandoned attempt, the intended `dr-m-experienced` feed was
  not provisioned and a manually-created empty old-slug show was noncanonical.
  That evidence describes the earlier attempt only; the later supported import
  successfully provisioned the current canonical `dr-m-experienced` feed.
- Apple public show `1870433419` already pointed at the Anchor feed. A separate
  no-feed Draft show `1896845422` and a stale manual Episode 4 Draft were present
  and were archived on August 6, 2026.
- The signed-in Amazon dashboard had zero claimed shows and the public audit
  found no defensible existing Amazon listing.

The exact baseline hash, GUID set, candidate URL, internal Apple IDs, and gate
state remain in `publishing/hosting-migration.json` so a future operator can
audit what happened without mistaking it for active work.

## Completed Import Evidence

The completed migration recorded:

1. The concrete operational benefit over Anchor, including the supported upload
   or automation capability that solves a current problem.
2. Current price, plan limits, payment implications, ownership, and credential
   storage.
3. Current Spotify, Apple, and Amazon stable IDs and their exact feed state.
4. A fresh source snapshot containing item count, GUIDs, enclosure URLs,
   metadata, and playback evidence.
5. A rollback and communication plan that acknowledges a widely cached 301 is
   not cleanly reversible.

These remain the required evidence if a future recovery or migration is ever
considered. An email confirmation or provisioned empty feed alone is not
redirect approval.

## Import Gate

The successful cutover used RSS.com's supported import rather than manually
rebuilding episodes. The following commands and checks are retained as audit and
incident-recovery procedures:

```bash
drm-publish migration-check
drm-publish migration-check --verify-media --verify-artwork --decode-edge-audio --snapshot
```

`migration-check` always requires the candidate title and description to match
`targetMetadata` in `publishing/hosting-migration.json`. `--verify-artwork`
requires a reachable item-level image for every candidate episode.
`--decode-edge-audio` fully downloads the oldest and newest candidate
enclosures to private OS temporary files, decodes both with `ffmpeg`, and
deletes the temporary files before returning.

- the destination feed returns HTTP 200 and has the expected item count
- every source GUID is preserved byte-for-byte and remains unique
- title, publication date, duration, structured episode number, explicit flag,
  and description match for each GUID
- every enclosure is unique, reachable, playable, and supports byte ranges
- the oldest and newest episodes play successfully
- existing Spotify and Apple listing URLs are recorded instead of submitted as
  duplicate shows
- subscriptions, monetization, analytics prefixes, and Spotify video behavior
  have been reviewed
- the exact destination feed URL and permanent redirect receive fresh approval

Any future count, GUID, media, metadata, or directory-identity mismatch is a
hard stop for publication. Keep RSS.com canonical while investigating; do not
reverse the established redirect as a first response.

## Redirect Completion And Monitoring

1. Completed: froze publication and captured final Anchor/RSS.com snapshots.
2. Completed: verified the exact destination URL, one direct HTTP 301 hop,
   destination HTTP 200, no loop, the same Spotify show, and all seven GUIDs.
3. Completed: configured existing Apple show `1870433419` directly to RSS.com.
4. Keep the old Spotify account and redirect active for at least 90 days. A
   cached client may briefly return the old feed body while the 301 propagates;
   verify with no-cache requests before treating that as redirect failure.
5. Pending Apple support response: resolve RSS Episodes 1-2, which remain
   `DRAFTING`/`HIDDEN` after duplicate cleanup and one feed refresh. The public
   listing still has five Available episodes.
6. Pending: submit and claim the RSS.com feed once in Amazon without creating a
   duplicate listing.
7. Pending remediation: the public audit found all seven Spotify episodes
   audio-only. For existing and new video episodes, let RSS own the episode
   identity, then use that episode's `Upload video` action in Spotify for
   Creators. There is no show-wide video toggle and no duplicate should be made.

## Official References

- RSS.com import procedure: <https://help.rss.com/en/support/solutions/articles/44002261804-how-do-i-import-my-podcast-from-a-different-hosting-provider->
- RSS.com pre-redirect checklist: <https://help.rss.com/en/support/solutions/articles/44002321566-important-steps-to-do-before-redirecting-a-podcast-to-rss-com>
- RSS.com Spotify redirect: <https://help.rss.com/en/support/solutions/articles/44002264641-how-do-i-redirect-my-podcast-from-spotify-for-creators-formerly-anchor->
- RSS.com API access: <https://help.rss.com/en/support/solutions/articles/44002648949-api-access>
- Apple change feed URL: <https://podcasters.apple.com/support/837-change-the-rss-feed-url>
- Spotify 301 migration: <https://support.spotify.com/us/creators/article/switching-away-from-spotify-for-creators-with-a-301-redirect/>
- Spotify video for externally hosted shows: <https://support.spotify.com/us/creators/article/video-episodes-for-shows-not-hosted-with-spotify/>
- Amazon RSS submission: <https://podcasters.amazon.com/submit-rss>
