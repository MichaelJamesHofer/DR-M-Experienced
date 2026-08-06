# Dr. M Experienced Ecosystem Operations Manual

Last verified: August 5, 2026.

This is the first-stop instruction manual for the website, podcast host,
directories, video channels, social publishing, workstation tooling, and brand
assets for **Dr. M Experienced, with Dr. David Musnick**. It is written for Otto,
future assistants, and any operator taking over after a failure.

The manual describes both the intended system and the verified current state.
When a status here conflicts with machine-readable state, inspect the live
system and then update both documents. Never guess around a conflict.

## 1. Five-Minute Orientation

Read and check in this order:

```bash
cd /home/otto/DR-M-Experienced
git status --short --branch
sed -n '1,240p' publishing/hosting-migration.json
sed -n '1,260p' publishing/platforms.json
/home/otto/.local/bin/drm-publish doctor
/home/otto/.local/bin/drm-browser status
```

For GitHub, run as the desktop user, not merely with Otto's `HOME` on a root
process:

```bash
runuser -u otto -- env \
  HOME=/home/otto USER=otto LOGNAME=otto \
  XDG_RUNTIME_DIR=/run/user/1002 \
  DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1002/bus \
  PATH=/home/otto/.local/bin:/usr/local/bin:/usr/bin:/bin \
  gh auth status
```

Interpretation on August 5, 2026:

- Anchor source: HTTP 200, exact new show title, seven episodes, seven original
  GUIDs, structured episode numbers 1-7, all seven approved public titles, and
  seven unique 3000 x 3000 item-art URLs. The show description is not currently
  exact because `RSSVERIFY` has been appended again; Episodes 4-7 also contain
  retired show-name variants in their descriptions. The source was independently
  verified at `2026-08-06T03:32:22Z`.
- Spotify for Creators/Anchor remains canonical during migration.
- RSS.com migration: active pre-cutover. The supported self-service import was
  requested at `2026-08-05T21:17:39Z` and awaits project-email confirmation.
  The empty old-slug show has exact branding but remains noncanonical. Do not
  populate it manually, distribute it, or redirect Anchor.
- Apple public show: preserve ID `1870433419`; Episodes 3-7 are Available,
  Episodes 1-2 remain Draft, and one separate manual Episode 4 Draft remains.
  Podcasts Connect accepted one refresh after the episode-art feed update on
  August 5, 2026; artwork and episode-state propagation remain unverified.
- YouTube, Vimeo, and Rumble: all seven public titles, descriptions, and approved
  episode thumbnails were reconciled and independently read back on August 5,
  2026. Spotify also has all seven 16:9 video thumbnails and all seven square
  episode-art images. Vimeo represents catalog lists as rich-text bullets;
  YouTube replaces forbidden angle brackets with equivalent comparison words.
- Local publishing browser: normally stopped when not in active use.
- GitHub connector: authenticated with admin/push access to this repository.
  Otto's local `gh` credential currently needs attended reauthentication; use
  the connector in the meantime and do not trigger repeated keyring prompts.
- API upload credentials and a live receipt ledger are not implemented yet.

## 2. Sources Of Truth

| Subject | Authority |
|---|---|
| Operating rules | `AGENTS.md` |
| Active host-migration evidence and Apple discrepancy | `publishing/hosting-migration.json` |
| Shared show and episode distribution metadata | `publishing/master-catalog.json` |
| Stable account/show/channel IDs and current routing | `publishing/platforms.json` |
| Approved seven-episode title-transition evidence | `publishing/episode-title-migration.json` |
| Approved episode-art assets and remote rollout receipt | `publishing/brand/asset-manifest.json` and `publishing/episode-thumbnail-rollout.json` |
| Episode approval schema | `publishing/episode.schema.json` |
| Visual briefs and templates | `publishing/brand/` |
| Binary masters | Project-scoped Dropbox folder mapped by `~/.config/drm-publisher/sources.json` |
| Production website-only editorial content | Supabase project `tdbsuzciwotleualdcjf` |
| Website source and deployment | This repository and GitHub Actions |
| Private jobs and feed evidence | `~/.local/state/drm-publisher/` |
| Credentials | `~/.config/drm-publisher/` and platform-managed browser storage |
| Current remote truth | Authenticated dashboard plus an independent public check |

No token, password, recovery code, cookie, or service-role key belongs in this
repository or in an episode manifest.

### Master Catalog And Dropbox Boundary

`publishing/master-catalog.json`, validated by
`publishing/master-catalog.schema.json`, is the master for metadata shared across
destinations. It owns canonical show names and profile copy, the current feed
binding, artwork references, episode numbers/slugs/titles/descriptions/durations, content
flags, logical asset references, RSS identities, aliases, and verified
episode-level remote IDs and URLs. The title-migration file and generated
website recovery files are evidence/projections, not parallel authorities.
The small website brand projection at `src/data/site-brand.generated.json` is
regenerated from the master before `dev` and `build`; catalog tests reject drift.

Supabase remains authoritative for website-only editorial fields such as topics,
references, takeaways, checklists, long-form sections, affiliate/blog
relationships, and website publication state. Where Supabase repeats an episode
number, slug, title, or destination ID, it is a verified projection of the
master catalog and must not drift.

Dropbox holds binary masters only. Configure the direct path to this project's
synced folder in the local, ignored file below; do not map the user's whole
Dropbox or commit the machine-specific path:

```json
{
  "schemaVersion": 1,
  "roots": {
    "dropbox": "/absolute/path/to/the/synced/Dr-M-project-folder"
  }
}
```

The default path is `~/.config/drm-publisher/sources.json`; a controlled test or
recovery session may override it with `DRM_PUBLISH_SOURCES_CONFIG`. Catalog
entries use project-relative logical references such as
`dropbox:episodes/008-topic/master-video.mp4`. Absolute references, `..`, and
symlink escapes outside the configured root are invalid.

An asset is not verified merely because a Dropbox entry or local placeholder
exists. It must be fully local and readable, and the catalog must contain its
measured SHA-256 and byte size before `status` becomes `verified`. Changing the
binary invalidates the fingerprint and every approval packet based on it. On
this workstation, leave the root unconfigured and assets `unmounted` until the
project folder is actually synced and its direct path is confirmed.

## 3. Brand Contract

Canonical show name:

> Dr. M Experienced, with Dr. David Musnick

Canonical short description and mandatory opening for longer profiles:

> Dr. M Experienced, with Dr. David Musnick. Practical insights from decades in sports, regenerative, internal, and functional medicine.

Short display name when a platform length limit prevents the full form:

> Dr. M Experienced

Do not use the retired name, `Dr. M's Experienced Functional and Sports
Medicine`, in newly published copy or artwork. Do not change stable handles or
IDs merely to match display text.

### Episode Title Policy

The target public title format omits a visible episode-number prefix:

> Primary topic - practical tagline

Keep `episodeNumber` as structured data for internal order, the website, the
approval manifest, and RSS `<itunes:episode>`. The number may appear as a small
visual indexing element on artwork, but not as `Episode N:` in the public title.

The seven replacement titles and maintenance window are approved. The local
publisher and website must accept unnumbered public titles while continuing to
require `episodeNumber`. Apply the Spotify/Anchor titles and structured episode
numbers first, then let Apple and Amazon ingest the clean feed and reconcile the
direct video/social destinations in the same maintenance campaign. Preserve
every GUID and remote content ID. The exact identity, issue, and approved-title
crosswalk is `publishing/episode-title-migration.json`.

## 4. Ecosystem Map

The intended flow is:

```text
DaVinci Resolve exports
  -> project-scoped Dropbox binary folder
  -> repository master catalog
  -> catalog-bound episode manifest and integrity packet
  -> attended draft/private uploads
      -> current: Spotify for Creators/Anchor -> canonical RSS -> Apple
      -> after gated cutover: RSS.com -> Spotify audio, Apple, Amazon
      -> Spotify video through Spotify for Creators
      -> YouTube full video
      -> Vimeo full video
      -> Rumble full video
      -> Instagram Reel
  -> verified remote IDs and URLs
  -> Supabase episode/catalog rows
  -> strict GitHub Pages build
  -> drmexperienced.com
```

Spotify for Creators/Anchor remains canonical until the supported RSS.com import
preserves all source GUIDs and media and an exact redirect receives separate
approval. After cutover, RSS.com owns podcast audio distribution; Spotify video
remains a separate creator upload.

The current publisher prepares and fingerprints files, validates decisions, and
creates a review packet. It does not yet provide unattended uploads, remote
reconciliation, or immutable publish receipts. Browser help is direct but
attended. Do not describe this as fully automated until those parts exist and
have been tested against draft/private items.

## 5. Account And Destination Inventory

| Destination | Stable identity | Current delivery and state |
|---|---|---|
| Website | `https://drmexperienced.com` | Static Next.js export from Supabase through GitHub Pages |
| GitHub | `MichaelJamesHofer/DR-M-Experienced` | Public repo; `main` deploys production |
| Supabase | project `tdbsuzciwotleualdcjf` | Production content catalog and form receiver |
| RSS.com | approved target slug `dr-m-experienced` | Supported import confirmation pending; empty old-slug show has corrected branding but is noncanonical |
| Spotify | show `7GGLljxmO0G3FLjPy8vfcw` | Current Anchor source/canonical feed plus Spotify video; preserve through cutover |
| Apple | public show `1870433419` | Existing claimed show; preserve it; currently five public episodes |
| Apple Connect | `cfab5caf-554e-4ebe-a28c-2e4748147b82` | Internal identity of the public show |
| Apple duplicate Draft | public-style ID `1896845422`, internal `949adc0b-c62f-410c-962d-17563cf3b07a` | Nonpublic, no feed; inspect and archive only if reversible and no unique setup exists |
| Amazon | no ID yet | Signed-in account has zero claimed shows; hold until cutover, then submit the final canonical RSS.com feed once |
| YouTube | channel `UCFA1nVv4lKMBlx81gjMAOFQ`, uploads playlist `UUFA1nVv4lKMBlx81gjMAOFQ` | Seven titles/descriptions verified; API auth/audit incomplete |
| Vimeo | user `253415660` | Seven titles/descriptions verified; upload token incomplete |
| Instagram | `@drmexperienced` | Reel destination; stable publishing account ID/API auth incomplete |
| Rumble | account `282015440`, channel `7820170` | Seven titles/descriptions verified; attended browser upload remains required |

Mutable profile URLs are stored in `publishing/platforms.json`; they are not a
substitute for stable IDs. Unknown IDs remain `null` until authenticated evidence
confirms them.

## 6. Management Contract

The assistant is expected to help operate the ecosystem, not merely explain it.
For an approved task, it should:

1. Inspect the authoritative state and the exact destination account.
2. Prepare copy, media, manifests, thumbnails, and platform-specific variants.
3. Use the isolated browser or an official API to enter exact approved profile
   metadata and prepare draft/private uploads.
4. Stop at decisions involving public release, schedule, licensing,
   monetization, audience, disclosure, terms, payment, MFA, or CAPTCHA.
5. After exact approval, perform the named action once, capture its returned ID
   and URL, and reconcile the remote state before moving to another destination.
6. Update Supabase and the site only after all required platform references are
   verified.
7. Update the state files and runbooks so a later session starts with the same
   context.

A logged-in tab is permission to inspect and assist within the user's request.
It is not permission to publish broadly, delete, subscribe, spend money, accept
terms, or reuse credentials elsewhere.

## 7. Workstation Tooling

### Publisher

```bash
/home/otto/.local/bin/drm-publish doctor
/home/otto/.local/bin/drm-publish prepare /absolute/path/to/episode.json
/home/otto/.local/bin/drm-publish show <job-id>
/home/otto/.local/bin/drm-publish approve <job-id> \
  --hash <approval-hash> --by "Otto" \
  --confirm "approve <job-id> <approval-hash>"
/home/otto/.local/bin/drm-publish status <job-id>
```

Use `migration-check [--verify-media] [--snapshot]` after the active supported
import produces a candidate feed; it is not part of routine episode publishing,
and a failed gate blocks cutover.

Jobs live under `~/.local/state/drm-publisher/jobs/`. `prepare` is local-only.
The approval hash covers normalized copy, decisions, file paths, media metadata,
SHA-256 fingerprints, and the selected master-catalog revision/binding. Any
changed input or catalog/manifest drift invalidates approval.

### Isolated Browser

```bash
# Human sign-in only; no automation endpoint
/home/otto/.local/bin/drm-browser login

# Attended work, one platform at a time
/home/otto/.local/bin/drm-browser open
/home/otto/.local/bin/drm-browser connect apple
/home/otto/.local/bin/drm-browser status
/home/otto/.local/bin/drm-browser disconnect
/home/otto/.local/bin/drm-browser close
```

Profile: `~/.local/share/drm-publisher/chrome-profile`

State and log: `~/.local/state/drm-publisher/browser/`

Loopback endpoint: port `9223`, only while `open` is active

Allowed scopes: `rss`, `spotify`, `apple`, `amazon`, `youtube`, `vimeo`,
`instagram`, `rumble`

`login` and `open` are different modes. Close the sign-in window before using
`open`. `connect` closes unrelated pages and blocks every other platform plus
Gmail. Always close the browser after an automation session. Never attach to
Otto's regular Chrome profile.

### GNOME Keyring And GitHub

This workstation uses automatic desktop login. Because no password is entered
at boot, GNOME Keyring cannot securely unlock itself through PAM. The safe
behavior is one interactive unlock after a reboot. Do not store the desktop
password in a script, make the login keyring password blank, or expose it in a
shell argument.

If prompts repeat during the same session:

1. Stop repeated credential commands.
2. Confirm the user session and collections:

   ```bash
   loginctl show-user otto -p State -p Sessions
   runuser -u otto -- env \
     XDG_RUNTIME_DIR=/run/user/1002 \
     DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1002/bus \
     busctl --user tree org.freedesktop.secrets
   ```

3. Unlock through the visible desktop prompt once. Never relay the password
   through logs or save it.
4. Run `gh auth status` as Otto with the environment shown in Section 1.
5. If the keyring is unlocked but GitHub says the token is invalid, the problem
   is GitHub authentication, not the keyring. Run an attended `gh auth login`,
   approve the device request in GitHub, and verify the account and scopes.

## 8. New Episode Workflow

### Editorial Handoff

Otto edits in DaVinci Resolve and provides, as applicable:

- full-resolution long-form video
- podcast audio master
- vertical Reel export
- captions/transcript
- approved headshot/topic image or thumbnail source
- title, practical tagline, summary, tags, and show notes
- explicit-content, made-for-kids, synthetic-media, and paid-promotion facts
- desired release date/time and destination decisions

Keep these files outside the repository in the project-scoped Dropbox tree until
approved derivatives are created. Register them with portable `dropbox:` asset
references in `publishing/master-catalog.json`; absolute local paths belong only
in the private resolved job data, never in the catalog.

### Preparation And Review

1. Check `gates.publishingFreezeActive` in
   `publishing/hosting-migration.json`. Stop if true.
2. Add the next contiguous episode and its logical assets to
   `publishing/master-catalog.json` with `publicationState: "draft"`. Leave
   unassigned RSS dates/GUID and destination identities null; do not invent
   them. A draft's episode number is never reused.
3. Fully sync each upload asset, record its SHA-256 and byte size, and mark it
   verified only after those values match the local file.
4. Increment the catalog revision/date, then run `drm-publish doctor` and the
   publisher tests.
5. Create the private manifest from `publishing/episode.example.json`. Copy
   catalog-owned values exactly and add all target-specific release choices.
6. Run `prepare`, then `show`; stop and correct any catalog/manifest drift.
   When the Dropbox root is configured, preparation also enforces logical path
   resolution and any verified catalog SHA-256/size. Otherwise it emits a
   visible path-verification warning.
7. Review copy, fingerprints, visibility, schedule, licensing, monetization,
   audience, disclosure, and warnings.
8. Record local approval only with the displayed hash and exact phrase.
9. Obtain separate approval to upload the exact packet to each destination.

### Upload And Release

1. Work one destination at a time.
2. Query or inspect the authenticated account and compare its stable ID.
3. Create a draft/private item where supported.
4. Record remote ID, URL, processing state, time, and uncertainty.
5. If a request times out after creation may have begun, search the remote
   account before retrying. Never create blindly.
6. Preview the processed asset and copy.
7. Obtain fresh approval for exact public/scheduled settings.
8. Release once, verify publicly, and record the result.

Detailed checklist: `docs/new-episode-process.md`.

### Website Publication

After Spotify, Vimeo, YouTube, and Rumble references are verified:

1. Create/update `public.episodes` in Supabase as `draft`.
2. Add topics, references, takeaways, checklists, sections, and paragraphs.
3. Review affiliate and blog relationships.
4. Mirror durable recovery data into `supabase/seed.sql` and fallback data.
5. Run the full local verification suite.
6. Set the episode to `published` in Supabase.
7. Deploy a verified branch through GitHub and confirm the live episode page.

## 9. Platform Procedures

### RSS.com

- Complete only the supported import flow; do not manually recreate episodes.
- Keep the empty old-slug show noncanonical while import confirmation is pending.
- Claim `dr-m-experienced` if the supported flow offers the approved slug.
- Run structural and media parity checks before requesting redirect approval.
- Free-plan directory convenience does not replace the repository master catalog
  or provide a supported publishing API.

### Spotify

- Spotify for Creators/Anchor remains canonical until gated cutover.
- Its canonical short description, seven approved public titles, and structured
  episode numbers 1-7 are published and verified in the RSS feed.
- Before cutover, upload approved podcast audio here. After cutover, audio comes
  from RSS.com; continue Spotify video through the existing creator account.
- Preserve show ID `7GGLljxmO0G3FLjPy8vfcw`.

### Apple Podcasts

- Never upload normal RSS episodes separately.
- Preserve public show `1870433419` and its existing listing URL.
- Preserve the existing show and refresh it against Anchor while import is in
  progress. After cutover, update the same show to the final RSS.com feed.
- Inspect and archive only nonpublic/manual Draft records that contain no unique
  content or subscription configuration and have a reversible archive control.
- Never fix missing episodes by creating new GUIDs or a replacement show.

### Amazon Music And Audible

- There is no current claimed show. Hold submission until cutover, then submit
  the final canonical RSS.com feed once, complete ownership verification, record
  the stable ID/public URL, and verify the oldest/newest episodes.

### YouTube

- Direct full-video upload. Preserve channel
  `UCFA1nVv4lKMBlx81gjMAOFQ`.
- API upload needs an OAuth client/token and compliance audit; new unaudited API
  projects may be restricted to private uploads.
- Until configured, use the attended creator dashboard. Review made-for-kids,
  altered/synthetic content, paid promotion, notifications, schedule, license,
  and visibility before release.
- Current seven titles and descriptions are verified. The deterministic
  YouTube projection writes comparison operators as words because Studio rejects
  angle brackets in descriptions.

### Vimeo

- Direct full-video upload to user `253415660`.
- An official API token with upload/edit scopes is still needed for automation.
- Current Vimeo display name is shortened to fit the platform limit.
- Current seven titles and descriptions are verified. Vimeo may render catalog
  hyphen lists as native rich-text bullets; compare persisted editor structure
  and normalized public text rather than raw oEmbed punctuation.

### Instagram

- Publish an approved vertical Reel to `@drmexperienced`.
- Prefer Meta's resumable local upload after the professional account and stable
  publishing ID are verified. Temporary public media staging is fallback-only
  and must be removed after processing.
- Instagram has no durable private publishing draft, so the final creation call
  requires exact release approval.

### Rumble

- Direct full-video upload through the attended local browser.
- Preserve channel `7820170`.
- Treat license, monetization, distribution rights, and public/unlisted state as
  explicit release decisions. No supported public creator VOD API is confirmed.
- Current seven titles and descriptions are verified; the existing episode 5
  URL slug remains misleading but must be preserved with the same video ID.

## 10. Active RSS.com Migration

`docs/rss-com-migration.md` is the focused migration runbook. The supported
self-service import request is active and awaiting confirmation through the
project email. Until that confirmation produces an imported candidate feed:

1. Keep the clean Anchor feed active and canonical.
2. Leave the corrected but empty old-slug RSS.com show noncanonical; do not
   recreate the seven episodes manually or distribute that empty feed.
3. Do not redirect Anchor, update Apple to RSS.com, or submit Amazon.
4. Claim the approved `dr-m-experienced` slug only if the supported import flow
   offers it.
5. After a candidate exists, run structural and media parity checks against all
   seven source GUIDs, metadata, and playable enclosures.
6. Request separate approval for the exact permanent feed URL and redirect only
   after every gate passes. There is no clean rollback after a 301 is widely
   cached.

## 11. Apple Recovery Runbook

### Decision

Do **not** delete, reset, archive, or recreate public Apple show `1870433419`.
The existing listing is the identity to repair, even if Apple is not currently
being promoted or used. A new show would risk losing history and creating a
duplicate.

### Current Defect

- Anchor has seven valid, unique GUIDs and playable enclosures.
- Apple publicly exposes Episodes 3-7 only.
- Episodes 1-2 are missing publicly.
- Podcasts Connect contains three internal Draft episode records.
- Separate Draft show `1896845422` is nonpublic and has no RSS feed.

### Self-Service Repair

1. Leave `1870433419` Published and Anchor active.
2. Clean the Anchor description, seven titles, and structured episode numbers;
   verify seven unique original GUIDs and working enclosures in the public feed.
3. Record Apple status, RSS URL, Last Refresh, analytics, and public episode
   count before changing anything.
4. In Podcasts Connect, open existing `1870433419`. Confirm it uses
   `https://anchor.fm/s/10e1b0328/podcast/rss`; update and save that field only if
   it differs.
5. Request one Refresh Feed and allow normal propagation time. Do not submit the
   URL as a new show.
6. Confirm the same Apple ID shows the canonical name/description, seven
   episodes, and working oldest/newest playback. The two historically missing
   GUIDs are:

   - `1e40e02b-b217-477c-9cc3-4271cb304c23`
   - `c9b853b6-a828-4012-9998-217919ff9163`
7. Inspect the three manual Draft episode records and separate Draft show
   `1896845422` for unique audio, channel, subscription, or analytics setup.
8. After `1870433419` is healthy, archive only nonpublic records that are proven
   redundant and only when Apple presents a reversible archive control. If an
   episode has no archive option, leave it rather than deleting it.

### Failure Branches

- Still five episodes after refresh: recheck the public Anchor feed, the RSS URL,
  Availability, Last Refresh, and Draft conflicts. Leave Apple unused while
  diagnosing; do not resubmit or create a replacement.
- Duplicate public episodes: stop and compare GUIDs and Draft records. Repair the
  existing listing without republishing episodes under new GUIDs.
- Show disappears: check Availability/status and restore the existing show; do
  not submit a new one.
- Feed URL is wrong: edit the RSS URL on the existing show to the exact Anchor
  feed, save, refresh once, and verify the same show ID.

Official references are listed at the end of this manual.

## 12. Coordinated Episode Title Transition

The source and long-form video portions of this transition are complete.
Continue directory, Instagram, and artwork convergence without changing GUIDs
or remote content IDs.

1. Export a crosswalk containing episode number, GUID, current title, approved
   new title, and every remote content ID.
2. Use the seven approved titles in `publishing/episode-title-migration.json`.
3. In Spotify for Creators, set structured episode numbers 1-7. Completed and
   verified in the canonical feed on August 5, 2026.
4. Update publisher schema/tests to allow public titles without the prefix while
   retaining required `episodeNumber`.
5. Update the Anchor-hosted public titles without changing GUID, enclosure,
   publication date, or structured episode-number metadata.
6. Update Supabase and checked-in recovery data in the same maintenance window.
   Change `episodeDisplayTitle` so the website does not re-add the prefix.
7. Update direct video titles and descriptions on YouTube, Vimeo, and Rumble.
   Completed on August 5, 2026: YouTube and Vimeo public readback and Rumble's
   authenticated post-save readback match the catalog. Existing video IDs, URLs,
   visibility, licensing, and monetization settings were preserved.
8. Update Instagram captions only where the old numbered title is presented as
   the primary title; do not erase engagement history merely for cosmetic copy.
9. Completed on August 5, 2026: replace all seven existing thumbnails on
   YouTube, Vimeo, Rumble, and Spotify video; upload all seven square episode-art
   images to Spotify; verify seven unique item images in the canonical RSS; and
   request one refresh on existing Apple show `1870433419`. Preserve existing
   Instagram posts because their covers cannot be replaced through the
   documented post-publication workflow.
10. After RSS.com cutover, update existing Apple show `1870433419`, then submit
    the final feed once to Amazon and verify Apple/Spotify/Amazon propagation.
11. Run a cross-platform audit and keep the crosswalk as evidence.

Do not try to make the internet change atomically. Make the source changes in a
controlled window, preserve identity, and verify convergence platform by
platform.

## 13. Visual Identity And Media Package

Use one visual system with purpose-built compositions. Do not build a website
splash gate or one universal splash image.

### Required Asset Family

| Asset | Master/output | Use |
|---|---|---|
| Master logo | Vector plus transparent PNG | Wordmark, stacked lockup, standalone mark |
| Social avatar | 1200 x 1200 master | Real approved headshot, circle-safe |
| Podcast show cover | 3000 x 3000 JPG, RGB | Spotify/Anchor, Apple, Amazon |
| Long-video thumbnail | 3840 x 2160 master; 1920 x 1080 derivative | YouTube, Vimeo, Rumble, website |
| Reel cover | 1080 x 1920 master with center-safe focal area | Instagram |
| Website share image | 1200 x 630 | Open Graph/social links |
| YouTube banner | 2560 x 1440 with center-safe copy | Channel branding |
| Long-video sting | 0.75-1.5 seconds | After the cold open only |
| Long-video end screen | 5-8 seconds | Subscribe/next episode slots |
| Vertical close | 0-1 second | Optional; no Reel intro slate |

### Direction

- Use `DR. M EXPERIENCED` prominently and `with Dr. David Musnick` as the host
  line. Retire `DRM`, which reads as an unrelated acronym.
- Prefer an approved high-resolution real head-and-shoulders photograph for
  medical credibility. The existing sketch is acceptable only as an interim
  asset.
- A simplified `M`/mountain-path mark may retain the current motif, but the name
  and host should carry the identity.
- Use a restrained charcoal, white, cyan, and amber palette with strong contrast.
- Thumbnail copy should be four to seven words focused on the topic/outcome, not
  the full show name. Keep the small episode number only as an index if desired.
- Start long-form videos with the useful hook, then a very short sting. Reels
  begin with content, not a splash screen.

### Current Gaps

- Podcast art still uses the retired `DRM EXPERIENCED` design.
- YouTube uses a generic `D`; Vimeo/Instagram use the sketch; Rumble lacks a
  verified channel image.
- Completed for episode artwork: YouTube, Vimeo, Rumble, Spotify video, Spotify
  episode art, and the canonical RSS all use the seven approved topic images.
  Apple received a refresh request, but its directory propagation remains to be
  verified. Existing Instagram Reel covers remain unchanged.
- Website header/footer use a mountain emoji while favicon SVGs use a different
  mountain treatment.
- The website has no default Open Graph image.
- Completed for the website: all seven episodes use checked-in 1600 x 900 WebP
  artwork registered in the master catalog, fallback data, and Supabase
  projection. The catalog-owned URLs prevent platform sync from restoring
  remote Vimeo fallback art.

Store approved binary masters in the project-scoped Dropbox tree, register them
in `publishing/master-catalog.json`, and verify their hashes before remote
replacement. Keep only briefs, templates, and small intentional repository
assets under `publishing/brand/`. Use a new podcast-cover filename/URL at the
canonical host so Apple notices the artwork update. Either provide unique 3000 x
3000 episode art or omit it; do not blindly repeat the show cover for every
episode.

## 14. Website, Supabase, And Deployment

### Local Verification

```bash
npm ci
npm run lint
npm run typecheck
npm run test:publisher
npm audit --audit-level=high
npm run verify:catalog
npm run test:database-security
npx --yes deno@2.9.2 check --config supabase/functions/deno.json \
  --lock supabase/functions/deno.lock supabase/functions/form-submit/index.ts
npx --yes deno@2.9.2 lint --config supabase/functions/deno.json \
  supabase/functions/form-submit src/lib/analytics-privacy.ts \
  src/lib/analytics-privacy_test.ts
npx --yes deno@2.9.2 test --config supabase/functions/deno.json \
  --lock supabase/functions/deno.lock supabase/functions/form-submit \
  src/lib/analytics-privacy_test.ts
CONTENT_CATALOG_STRICT=true npm run build
```

Production catalog checks need ignored local Supabase read credentials or the
configured GitHub Actions secrets. Never expose a service-role key to the browser
or a `NEXT_PUBLIC_*` variable.

### Change And Deploy

1. Fetch without discarding local changes.
2. Create a focused branch from current `main`.
3. Make and verify the change locally.
4. Open a draft pull request.
5. Require all Actions checks to pass.
6. Review the diff and preview, then mark ready and merge.
7. Monitor the `Deploy to GitHub Pages` workflow on `main`.
8. Verify title, content, links, mobile layout, and expected 404s on the live site.
9. Record the deployed commit and update relevant state/runbooks.

The forms post to `supabase/functions/form-submit`. Anonymous clients must never
receive direct write access to contact/newsletter tables.

## 15. Break/Fix Index

### Universal First Response

1. Stop retries, publishing, redirect work, and destructive actions.
2. Record the UTC/local time, exact destination, visible message, last successful
   step, expected stable ID, and whether remote creation may have occurred.
3. Preserve files, fingerprints, feed snapshots, browser logs, and CI URLs.
4. Run read-only health checks and compare authoritative JSON with remote state.
5. Classify: local tool, authentication, platform, RSS, catalog, deployment, or
   artwork/cache problem.
6. Repair the smallest reversible layer and verify independently.
7. Update this manual/state before resuming.

### RSS.com Contacts Or Provisions A Feed

- Keep Anchor canonical; do not redirect or publish into the RSS.com show.
- Record the confirmation/reply and candidate feed in
  `publishing/hosting-migration.json` without changing directory settings.
- Continue the active import runbook: verify HTTP status, exact GUID set,
  enclosures, metadata, byte ranges, oldest/newest playback, and the proposed
  redirect chain before requesting cutover approval.

### Apple Missing Or Duplicate Episodes

- Preserve public show ID and GUIDs.
- Verify the clean Anchor feed and exact RSS URL, then refresh the existing show
  once and allow normal propagation time.
- Compare feed GUIDs before touching Draft records.
- Inspect and archive only safe, redundant nonpublic/manual Drafts using a
  reversible control. Do not submit a new show, delete the live show, or
  republish with new GUIDs.

### Spotify/Apple/Amazon Metadata Is Stale

- Verify the canonical feed first.
- Record feed value, directory value, and Last Refresh/check time.
- Allow documented propagation time, then refresh the existing listing.
- Do not hand-edit downstream copy into a second source of truth when RSS owns it.

### Upload Times Out Or Looks Duplicated

- Do not retry creation.
- Search drafts/content by fingerprint, title, duration, creation time, and remote
  processing state.
- Resume/edit the existing item if found. Retry only after proving no remote item
  exists and record a new operation attempt.

### Wrong Visibility Or Accidental Publication

- Make the item private/unlisted or remove availability using the least
  destructive reversible control.
- Capture the remote ID and what was publicly visible.
- Do not delete unless required and explicitly approved.
- Reconcile notifications, RSS ingestion, and downstream caches before re-release.

### Browser Will Not Start Or Port 9223 Is Busy

```bash
/home/otto/.local/bin/drm-browser status
ss -H -ltnp 'sport = :9223'
tail -n 100 ~/.local/state/drm-publisher/browser/chrome.log
/home/otto/.local/bin/drm-browser close
```

Confirm any listener belongs to the isolated profile before stopping it. If a
human login window is open, close it normally before `open`. Do not kill normal
Chrome.

### Logged Out, MFA, CAPTCHA, Or Keyring Prompt

- Switch to `drm-browser login`; automation must be disabled during sign-in.
- The user completes password, MFA, CAPTCHA, agreements, and identity checks.
- Close the login window, then reopen and connect to one platform.
- For keyring, follow Section 7; never save the desktop password.

### Wrong Account Or Stable-ID Mismatch

- Stop before upload or edit.
- Record the authenticated immutable ID and expected ID.
- Sign out/in through login mode or correct the state only after ownership is
  confirmed. Never “fix” a mismatch by changing the expected ID casually.

### API Credential Expired

- Confirm which scope/token failed without printing it.
- Reauthorize the minimum official scopes in an attended flow.
- Store credentials owner-only outside the repository.
- Query the authenticated account ID, perform a draft/private smoke test, and
  revoke the old credential when safe.

### Supabase Catalog Or Form Failure

- Run `npm run verify:catalog` and database security tests.
- Check parent row status, required child rows, RLS, Edge Function deployment,
  secrets, and origin/rate-limit logs.
- Keep broken/incomplete episodes as `draft`.
- Never weaken RLS or expose service credentials to make a build pass.

### CI Or GitHub Pages Failure

- Read the failing job/log first; reproduce the exact command locally.
- Check Actions secrets only for presence/permissions, never print values.
- Fix on the branch, require green CI, merge, and verify the live commit.
- A successful local fallback build is not proof of a successful strict catalog
  build.

### Website Is Stale Or 404

- Confirm DNS and the latest Pages deployment commit.
- Inspect build/deploy status and generated route list.
- Verify Supabase row is `published` and has required child/reference data.
- Hard-refresh only after proving the deployed artifact is correct.

### Artwork Is Stale

- Verify dimensions, RGB/JPG requirements, filename/URL, and feed `<itunes:image>`.
- Use a new filename/URL for show-cover replacement.
- Check circular and 64-pixel previews plus 16:9/9:16 safe areas.
- Wait for platform cache propagation, then use the supported refresh control.
- Change sync precedence before updating website art so fallback URLs cannot undo it.

### Compromised Account Or Credential

- Stop automation and disconnect the browser bridge.
- Preserve security/audit evidence.
- Use the platform's security page to revoke sessions/tokens and rotate credentials.
- Verify recovery email, MFA, owners/managers, API apps, payout details, and recent
  publications.
- Do not delete content during triage. Notify affected platforms and update the
  incident record.

### New Machine Or Successor Setup

1. Install Ubuntu/user tooling and clone this repository.
2. Read `AGENTS.md`, this manual, and both publishing JSON files.
3. Install Node, ffmpeg/ffprobe, Chrome, GitHub CLI, Deno, and local wrappers.
4. Recreate owner-only publisher config/state directories; do not copy browser
   cookies. Restore only approved non-secret evidence and reauthorize accounts.
5. Run publisher tests, doctor, feed preflight, site checks, and a draft/private
   browser smoke test.
6. Verify every stable ID before enabling uploads.
7. Keep live release disabled until receipts/reconciliation are proven.

The current `drm-browser` and `drm-publish` wrappers live under
`/home/otto/.local/bin`; the browser wrapper is a workstation dependency and is
not yet reproducibly installed from this repository. Versioning and testing its
installer is a priority before machine replacement.

## 16. Routine Maintenance

Every episode:

- run doctor and verify account IDs
- register shared metadata and logical assets in the master catalog before
  `prepare`
- verify each exact binary by SHA-256 and byte size
- prepare/fingerprint exact assets
- reconcile every remote upload before release
- verify public playback/copy/thumbnail on every destination
- update Supabase, recovery mirrors, and the site

Weekly during directory cleanup:

- verify the canonical Anchor title, description, item count, GUIDs, and
  structured episode numbers
- compare Apple public episode count and Last Refresh
- verify Amazon claim/submission state until its stable ID is recorded
- check browser/keyring session health without exposing secrets

Monthly:

- audit names, bios, links, avatars, banners, and stable IDs
- review platform owners/managers, MFA, recovery paths, and API scopes
- run dependency/security checks and inspect GitHub Actions warnings
- test contact/newsletter forms and Supabase RLS
- confirm private state/config permissions are owner-only

Quarterly:

- export allowed analytics and account inventories
- verify backups and successor instructions
- review whether official APIs justify replacing attended browser steps
- audit asset masters, rights, and template consistency

## 17. Current Limitations And Roadmap

1. Complete the supported RSS.com import, parity checks, approved slug, and
   separately approved redirect without changing GUIDs.
2. Recover Apple's missing Episodes 1-2 in existing show `1870433419`, then
   update that same show during cutover.
3. Submit the final canonical RSS.com feed once to Amazon and record its stable
   ID/URL.
4. Reconcile Instagram captions that use old numbered titles and apply approved
   covers to future Reels; preserve existing posts and engagement. The Anchor,
   website, YouTube, Vimeo, Rumble, and Spotify episode-art batch is complete.
5. Produce and approve the logo, show cover, avatar, Reel, banner, OG, sting,
   and end-screen system. Website and direct-platform episode art is complete.
6. Completed for episode art: master-catalog ownership prevents website sync
   scripts from overwriting approved custom thumbnails, and the rollout receipt
   records every direct-platform ID and RSS artwork URL.
7. Separate affiliate-page workstream: redesign it as a compact, mobile-first
   product directory with useful links visible above the fold; replace generic
   company links with verified direct links to the products Dr. David Musnick
   specifically recommends, retain clear affiliate disclosures, and use the
   Supabase affiliate relationships to show each product on relevant episode
   pages. Validate mobile tap targets and every outbound product URL before
   release. This is a separate workstream from the completed episode-thumbnail
   rollout.
8. Complete YouTube, Vimeo, and Instagram official API authorization.
9. Add a durable upload receipt ledger, deterministic operation IDs, and remote
   reconciliation before calling the workflow unattended.
10. Version and test workstation-wrapper installation/recovery.
11. Build a small authenticated Supabase editorial/import tool after the release
    workflow is stable.
12. Configure the project-scoped Dropbox root, replace unmounted placeholder
    asset records with measured hashes/sizes, and complete independent path
    binding for production episode jobs.

## 18. Official References

- Apple host migration: <https://podcasters.apple.com/support/3965-how-to-change-hosting-providers>
- Apple change feed URL: <https://podcasters.apple.com/support/837-change-the-rss-feed-url>
- Apple refresh feed: <https://podcasters.apple.com/support/838-refresh-a-podcast>
- Apple archive/restore consequences: <https://podcasters.apple.com/support/901-archive-or-restore-a-channel-podcast-or-episode>
- Apple podcast requirements: <https://podcasters.apple.com/support/823-podcast-requirements>
- Apple metadata: <https://podcasters.apple.com/support/832-podcast-metadata>
- Apple show-cover template: <https://podcasters.apple.com/support/5514-show-cover-template>
- Apple episode-art template: <https://podcasters.apple.com/support/5516-episode-art-template>
- RSS.com import: <https://help.rss.com/en/support/solutions/articles/44002261804-how-do-i-import-my-podcast-from-a-different-hosting-provider->
- RSS.com imported directory links: <https://help.rss.com/en/support/solutions/articles/44002727331-updating-directory-links-for-imported-podcasts>
- RSS.com Spotify redirect: <https://help.rss.com/en/support/solutions/articles/44002264641-how-do-i-redirect-my-podcast-from-spotify-for-creators-formerly-anchor->
- Spotify redirect: <https://support.spotify.com/us/creators/article/switching-away-from-spotify-for-creators-with-a-301-redirect/>
- Amazon RSS submission: <https://podcasters.amazon.com/submit-rss>
- YouTube upload API: <https://developers.google.com/youtube/v3/docs/videos/insert>
- YouTube channel branding: <https://support.google.com/youtube/answer/10456525>
- YouTube video thumbnails: <https://support.google.com/youtube/answer/72431>
- Instagram publishing: <https://developers.facebook.com/documentation/instagram-platform/content-publishing>
- Instagram Reel covers: <https://www.facebook.com/help/instagram/1038071743007909>
- Vimeo upload API: <https://developer.vimeo.com/api/upload/videos>
- Vimeo video thumbnails: <https://help.vimeo.com/hc/en-us/articles/12426471350289-How-to-change-the-thumbnail-image-for-my-video>
- Rumble upload/edit: <https://rumble.support/help/upload-and-edit-content>
- Rumble video thumbnails: <https://rumble.support/help/changing-a-thumbnail>
- Spotify video thumbnails: <https://support.spotify.com/us/creators/article/thumbnails/>
- Spotify episode cover art: <https://support.spotify.com/us/creators/article/uploading-cover-art/>

## 19. Change Log

- August 5, 2026: published seven approved topic thumbnails to YouTube, Vimeo,
  Rumble, Spotify video, and Spotify episode art; verified seven unique square
  images in the canonical RSS; requested one Apple feed refresh; and recorded
  the separate compact, mobile-first affiliate product-directory workstream.
- August 5, 2026: temporarily parked RSS.com and made Spotify/Anchor canonical,
  approved removal of `RSSVERIFY` and the seven-title batch, and changed
  Apple/Amazon procedures to preserve the existing listings.
- August 5, 2026: owner reconfirmed the RSS.com migration; corrected the empty
  show's name/description and submitted a fresh supported self-service import.
  Anchor stays canonical and Amazon stays empty until the import/cutover gates
  pass.
- August 5, 2026: created the ecosystem manual; recorded current migration,
  account, Apple recovery, direct-management, browser/keyring, title-transition,
  visual-system, website, and incident procedures; corrected private migration
  evidence ownership and permissions.
