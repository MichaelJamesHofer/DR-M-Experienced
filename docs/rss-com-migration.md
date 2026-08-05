# RSS.com Hosting Migration

This runbook moves the existing podcast host from Spotify for Creators to RSS.com without creating duplicate Apple or Spotify listings. Amazon has no claimed or defensible public listing and will be added only with the validated imported feed. Until every pre-redirect gate passes, `publishing/platforms.json` and the website must continue using the live Anchor feed.

The machine-readable migration record is `publishing/hosting-migration.json`. It contains only public identifiers and non-secret verification state. Full feed snapshots belong in the owner-only migration directory under `~/.local/state/drm-publisher/migrations/`, never in the repository.

## Current State

- The source Anchor feed is live with seven episodes and seven unique GUIDs.
- An empty show was manually created at RSS.com before the supported import was started. RSS.com explicitly tells importers not to create the show manually. Do not publish into, distribute, rename, or delete that empty show; tell the RSS.com import specialist about it and follow their instructions.
- RSS.com confirmed receipt of the supported import request on August 5, 2026. The migration is waiting for the import specialist's email instructions.
- The claimed Apple listing `1870433419` points to the correct Anchor feed but has a pre-migration catalog discrepancy: five Available episodes and Draft records for episodes 1 and 2 plus a duplicate episode 4. A separate no-feed Draft show has Apple show ID `1896845422`. A feed refresh was requested on August 5, 2026; do not publish or delete drafts while it is processing.
- The signed-in Amazon Music for Podcasters dashboard has zero claimed shows, and the public audit found no defensible existing listing. Treat Amazon as a new claim or submission only after the imported RSS.com feed is ready.
- The permanent slug `dr-m-experienced` was approved on August 5, 2026. RSS.com still needs to confirm or provision the corresponding feed URL; the URL and redirect remain unapproved until then.
- No 301 redirect is authorized.

## Free Plan Decision

RSS.com's Free - Local & Niche plan is sufficient for this one-show migration and the normal audio workflow. It includes one podcast, unlimited episodes and storage, public RSS distribution, scheduling, and uploads up to 2 GB per episode. The tradeoffs are limited recent analytics, fewer collaboration and monetization features, and no supported publishing API. RSS.com requires a payment card for Free-plan verification but states that the card will not be charged; entering payment details remains a manual user step.

Use the Free plan and an attended browser upload for audio. RSS.com will fan that feed out to Spotify, Apple, and Amazon. Continue separate approved video/social publishing for YouTube, Vimeo, Rumble, and Instagram. Revisit a paid plan only if supported API access becomes worth the recurring cost and beta risk.

## Phase 1: Import Without Cutover

1. **Complete:** The source feed was submitted through RSS.com's supported Switch to RSS workflow, and RSS.com confirmed receipt at `2026-08-05T04:32:55Z`.
2. Stop for reCAPTCHA, email verification, plan selection, payment, or terms. The permanent slug is approved, but verify the exact generated feed URL before accepting it or using it for a redirect.
3. Tell the import specialist that the account already contains an empty manually-created show. Do not delete it unless RSS.com support confirms the exact recovery path.
4. If RSS.com requests `RSSVERIFY` in the source description, obtain explicit approval before changing the live show metadata.
5. Freeze new episode publication when RSS.com begins the import. Keep the source show and account active.

### Import specialist handoff

Give the RSS.com specialist these facts when they reply:

- Source feed: `https://anchor.fm/s/10e1b0328/podcast/rss` with seven episodes and seven unique GUIDs.
- The RSS.com account already has an empty manually-created show at the old slug. Ask RSS.com to attach the supported import correctly; do not delete or populate that show without their instructions.
- Approved permanent slug: `dr-m-experienced`. Ask RSS.com to confirm availability and provision it for the supported import; do not infer that the proposed feed URL exists until it returns the imported show.
- Preserve Spotify show ID `7GGLljxmO0G3FLjPy8vfcw` and Apple Available show ID `1870433419`.
- Do not link Apple's separate no-feed Draft show `1896845422`.
- There is no Amazon listing in the signed-in account; submit or claim Amazon only after the imported RSS.com feed passes validation.

## Phase 2: Validate The Imported Feed

Run the structural gate first, then capture private evidence and verify media once RSS.com reports the import complete:

```bash
drm-publish migration-check
drm-publish migration-check --verify-media --snapshot
```

The second command stores raw feed evidence under the owner-only publisher state directory. A nonzero exit or any `FAIL` line blocks cutover.

Do not redirect unless every check passes:

- the imported feed returns HTTP 200 and contains exactly seven episodes
- all seven GUIDs match the source byte-for-byte, with no duplicates
- title, publication date, duration, episode numbering, explicit flag, and description match for each GUID
- every imported enclosure is unique, reachable, has a valid audio content type and length, and supports playback and byte-range requests
- the oldest and newest episodes play successfully
- the existing Spotify and Apple listing URLs are entered in RSS.com instead of submitting duplicate listings
- the Apple catalog discrepancy is resolved or explicitly accepted as a preexisting issue; preserve public show ID `1870433419` and do not promote or delete the duplicate drafts without support evidence
- Amazon is added or claimed only with the imported RSS.com feed; the current signed-in account has no claimed show
- Spotify subscriptions, dynamic ads, analytics prefixes, and video-episode implications have been reviewed

Any count, GUID, metadata, media, or directory identity mismatch is a hard stop. Correct the import with RSS.com before proceeding.

## Phase 3: Redirect

The Spotify redirect is a permanent external action and requires fresh explicit authorization after the validation evidence is reviewed.

1. Activate the publication freeze and take a final source-feed snapshot.
2. Confirm the exact permanent RSS.com feed URL.
3. In Spotify for Creators, set the 301 redirect to that exact URL.
4. Verify that the old feed makes one direct 301 hop to the RSS.com feed, the new feed returns 200, and there is no loop.
5. Confirm that Spotify retains show ID `7GGLljxmO0G3FLjPy8vfcw` and Apple retains show ID `1870433419`.
6. Add or claim Amazon with the exact RSS.com feed, record its new stable identity, and test the oldest and newest episode in every directory.
7. Keep the old Spotify account and redirect active for at least 90 days. Do not delete either show.

## Phase 4: Rebrand And Automate

After directory convergence is stable, set the RSS.com title to `Dr. M Experienced, with Dr. David Musnick` and the description to `Dr. M Experienced, with Dr. David Musnick. Practical insights from decades in sports, regenerative, internal, and functional medicine.` Verify both fields on Apple, Spotify, and Amazon. Keep YouTube, Vimeo, Instagram, and Rumble as separate video destinations.

RSS.com's beta API is not included with the Free plan and is currently documented for Max. Confirm the entitlement and renewal price with RSS.com before choosing or paying for a future plan. Plan selection, payment, API key creation, uploads, and publishing remain separate attended approvals. A dedicated API credential must be stored owner-only outside the repository; browser cookies must never be exported as an API credential.

## Official References

- RSS.com import procedure: <https://help.rss.com/en/support/solutions/articles/44002261804-how-do-i-import-my-podcast-from-a-different-hosting-provider->
- RSS.com Spotify redirect: <https://help.rss.com/en/support/solutions/articles/44002264641-how-do-i-redirect-my-podcast-from-spotify-for-creators-formerly-anchor->
- RSS.com existing directory links: <https://help.rss.com/en/support/solutions/articles/44002727331-updating-directory-links-for-imported-podcasts>
- RSS.com pre-redirect checklist: <https://help.rss.com/en/support/solutions/articles/44002321566-important-steps-to-do-before-redirecting-a-podcast-to-rss-com>
- RSS.com API access: <https://help.rss.com/en/support/solutions/articles/44002648949-api-access>
- RSS.com Free plan: <https://help.rss.com/en/support/solutions/articles/44002697443-free-local-niche-plan>
- RSS.com plan comparison: <https://help.rss.com/en/support/solutions/articles/44002828140-plans-compared-free-plus-pro-and-max>
- RSS.com episode size limit: <https://help.rss.com/en/support/solutions/articles/44000492729-what-is-the-single-podcast-episode-size-limit->
- RSS.com pricing: <https://rss.com/pricing/>
- Apple hosting migration: <https://podcasters.apple.com/support/3965-how-to-change-hosting-providers>
- Spotify 301 migration: <https://support.spotify.com/us/creators/article/switching-away-from-spotify-for-creators-with-a-301-redirect/>
- Amazon podcaster FAQ: <https://podcasters.amazon.com/frequently-asked-questions>
- YouTube RSS delivery: <https://support.google.com/youtube/answer/13525207>
