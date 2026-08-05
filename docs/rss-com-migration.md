# RSS.com Hosting Migration

Status: supported self-service import resumed on August 5, 2026. Email
confirmation is pending. No redirect or directory submission is authorized.

Spotify for Creators/Anchor remains canonical during import. Its clean live feed
is `https://anchor.fm/s/10e1b0328/podcast/rss`. The RSS.com account's empty show
now has the exact name and description, but it must not be populated manually or
distributed. Complete the supported import and validate parity first.

The machine-readable record is `publishing/hosting-migration.json`. Private raw
feed snapshots belong under `~/.local/state/drm-publisher/migrations/`, never in
the repository.

## Current Decision

- Keep Spotify show `7GGLljxmO0G3FLjPy8vfcw` and Anchor canonical until cutover.
- Complete the supported self-service import requested at
  `2026-08-05T21:17:39Z` after the project-email confirmation.
- Claim the approved `dr-m-experienced` slug if the import flow offers it. Slug
  approval does not approve a feed cutover or redirect, and changing the display
  title does not change the current old-slug URL.
- Validate the imported feed against all seven source GUIDs and enclosures.
- Preserve Apple show `1870433419`; update it in place after cutover.
- Hold Amazon until cutover, then submit the final canonical feed once.
- No 301 redirect is authorized.

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
- The intended `dr-m-experienced` feed was never provisioned.
- The RSS.com account contains a manually-created, empty, old-slug show. It is
  not canonical and must not be populated, distributed, or treated as an
  imported copy.
- The proposed permanent slug `dr-m-experienced` was approved for the abandoned
  attempt. That approval does not authorize a future feed or redirect.
- Apple public show `1870433419` already pointed at the Anchor feed. A separate
  no-feed Draft show `1896845422` and manual Draft episode records were also
  present.
- The signed-in Amazon dashboard had zero claimed shows and the public audit
  found no defensible existing Amazon listing.

The exact baseline hash, GUID set, candidate URL, internal Apple IDs, and gate
state remain in `publishing/hosting-migration.json` so a future operator can
audit what happened without mistaking it for active work.

## Active Import Requirements

Before changing any live feed or directory, document:

1. The concrete operational benefit over Anchor, including the supported upload
   or automation capability that solves a current problem.
2. Current price, plan limits, payment implications, ownership, and credential
   storage.
3. Current Spotify, Apple, and Amazon stable IDs and their exact feed state.
4. A fresh source snapshot containing item count, GUIDs, enclosure URLs,
   metadata, and playback evidence.
5. A rollback and communication plan that acknowledges a widely cached 301 is
   not cleanly reversible.

An email confirmation, a provisioned empty feed, or continued availability of
the approved slug is not redirect approval.

## Import Gate

Use RSS.com's supported import rather than manually rebuilding episodes. Do not
redirect unless every check passes:

```bash
drm-publish migration-check
drm-publish migration-check --verify-media --snapshot
```

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

Any count, GUID, media, metadata, or directory-identity mismatch is a hard stop.
Keep Anchor live and canonical while repairing the imported copy.

## Redirect Gate

A future Spotify redirect is a permanent external action and needs explicit
approval after the validation evidence is reviewed.

1. Freeze publication and capture a final Anchor snapshot.
2. Confirm the exact destination feed URL.
3. Set the redirect once in Spotify for Creators.
4. Verify one direct HTTP 301 hop, destination HTTP 200, and no loop.
5. Confirm the same Spotify show ID and every episode GUID.
6. Keep the old Spotify account and redirect active for at least 90 days.
7. Update the existing Apple listing to follow the new canonical feed, then
   submit and claim that final feed once in Amazon without creating duplicates.

## Official References

- RSS.com import procedure: <https://help.rss.com/en/support/solutions/articles/44002261804-how-do-i-import-my-podcast-from-a-different-hosting-provider->
- RSS.com pre-redirect checklist: <https://help.rss.com/en/support/solutions/articles/44002321566-important-steps-to-do-before-redirecting-a-podcast-to-rss-com>
- RSS.com Spotify redirect: <https://help.rss.com/en/support/solutions/articles/44002264641-how-do-i-redirect-my-podcast-from-spotify-for-creators-formerly-anchor->
- RSS.com API access: <https://help.rss.com/en/support/solutions/articles/44002648949-api-access>
- Apple change feed URL: <https://podcasters.apple.com/support/837-change-the-rss-feed-url>
- Spotify 301 migration: <https://support.spotify.com/us/creators/article/switching-away-from-spotify-for-creators-with-a-301-redirect/>
- Amazon RSS submission: <https://podcasters.amazon.com/submit-rss>
