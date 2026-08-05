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
/home/otto/.local/bin/drm-publish migration-check
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
  GUIDs, description still ends in `RSSVERIFY`.
- Intended RSS.com feed at the approved `dr-m-experienced` slug: not provisioned
  yet.
- Manually created old-slug RSS.com feed: HTTP 200 but empty and old-branded.
- Migration check: expected to fail. Do not redirect.
- Apple public show: preserve ID `1870433419`; Episodes 3-7 are public, Episodes
  1-2 are missing from the public catalog.
- Local publishing browser: normally stopped when not in active use.
- GitHub connector: authenticated with admin/push access to this repository.
  Otto's local `gh` credential currently needs attended reauthentication; use
  the connector in the meantime and do not trigger repeated keyring prompts.
- API upload credentials and a live receipt ledger are not implemented yet.

## 2. Sources Of Truth

| Subject | Authority |
|---|---|
| Operating rules | `AGENTS.md` |
| Host migration gates and Apple discrepancy | `publishing/hosting-migration.json` |
| Stable destination IDs and current routing | `publishing/platforms.json` |
| Planned seven-episode title batch | `publishing/episode-title-migration.json` |
| Episode approval schema | `publishing/episode.schema.json` |
| Visual asset brief and manifest | `publishing/brand/` |
| Production website content | Supabase project `tdbsuzciwotleualdcjf` |
| Website source and deployment | This repository and GitHub Actions |
| Private jobs and feed evidence | `~/.local/state/drm-publisher/` |
| Credentials | `~/.config/drm-publisher/` and platform-managed browser storage |
| Current remote truth | Authenticated dashboard plus an independent public check |

No token, password, recovery code, cookie, or service-role key belongs in this
repository or in an episode manifest.

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

This transition is approved in principle but not yet implemented. The current
schema and publisher require titles to begin with `Episode N:`. Change the
schema, tests, seven Supabase titles, fallback data, RSS.com episode titles, and
the direct video/social destinations in one controlled batch after RSS.com is
stable. Apple, Spotify audio, and Amazon should inherit the same titles from the
feed. Preserve every GUID and remote content ID. The exact seven-row identity,
issue, and proposed-title crosswalk is `publishing/episode-title-migration.json`.

## 4. Ecosystem Map

The intended flow is:

```text
DaVinci Resolve exports
  -> local episode manifest and integrity packet
  -> attended draft/private uploads
      -> RSS.com audio feed -> Spotify audio, Apple, Amazon
      -> Spotify video (separate creator upload)
      -> YouTube full video
      -> Vimeo full video
      -> Rumble full video
      -> Instagram Reel
  -> verified remote IDs and URLs
  -> Supabase episode/catalog rows
  -> strict GitHub Pages build
  -> drmexperienced.com
```

Until cutover, Spotify for Creators/Anchor remains the podcast host and its feed
fans out to Apple. Amazon has not yet been claimed. After cutover, RSS.com owns
audio; Spotify video remains a separate upload.

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
| RSS.com | approved slug `dr-m-experienced` | Import verification completed; support reply sent; awaiting imported feed |
| Spotify | show `7GGLljxmO0G3FLjPy8vfcw` | Current Anchor host; audio RSS plus separate video upload |
| Apple | public show `1870433419` | Existing claimed show; preserve it; currently five public episodes |
| Apple Connect | `cfab5caf-554e-4ebe-a28c-2e4748147b82` | Internal identity of the public show |
| Apple duplicate Draft | public-style ID `1896845422`, internal `949adc0b-c62f-410c-962d-17563cf3b07a` | Nonpublic, no feed; inspect, then archive only after recovery |
| Amazon | no ID yet | Signed-in account has zero claimed shows; add after feed validation |
| YouTube | channel `UCFA1nVv4lKMBlx81gjMAOFQ`, uploads playlist `UUFA1nVv4lKMBlx81gjMAOFQ` | Direct full-video destination; API auth/audit incomplete |
| Vimeo | user `253415660` | Direct full-video destination; upload token incomplete |
| Instagram | `@drmexperienced` | Reel destination; stable publishing account ID/API auth incomplete |
| Rumble | account `282015440`, channel `7820170` | Attended browser upload; no supported creator VOD API confirmed |

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
/home/otto/.local/bin/drm-publish migration-check [--verify-media] [--snapshot]
/home/otto/.local/bin/drm-publish prepare /absolute/path/to/episode.json
/home/otto/.local/bin/drm-publish show <job-id>
/home/otto/.local/bin/drm-publish approve <job-id> \
  --hash <approval-hash> --by "Otto" \
  --confirm "approve <job-id> <approval-hash>"
/home/otto/.local/bin/drm-publish status <job-id>
```

Jobs live under `~/.local/state/drm-publisher/jobs/`. `prepare` is local-only.
The approval hash covers normalized copy, decisions, file paths, media metadata,
and SHA-256 fingerprints. Any changed input invalidates approval.

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

Keep these files outside the repository until approved derivatives are created.
Start from `publishing/episode.example.json` and use absolute paths.

### Preparation And Review

1. Check `gates.publishingFreezeActive` in
   `publishing/hosting-migration.json`. Stop if true.
2. Run `drm-publish doctor`.
3. Create the manifest with all target-specific release choices.
4. Run `prepare`, then `show`.
5. Review copy, fingerprints, visibility, schedule, licensing, monetization,
   audience, disclosure, and warnings.
6. Record local approval only with the displayed hash and exact phrase.
7. Obtain separate approval to upload the exact packet to each destination.

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

- Before cutover: use only the supported import. Leave the empty old-slug show
  untouched unless support gives an exact instruction.
- After cutover: upload podcast audio and canonical show/episode metadata here.
- Do not assume the Free plan provides a supported publishing API. Use attended
  browser uploads until an official API entitlement is deliberately adopted.
- Do not remove `RSSVERIFY` until RSS.com confirms ownership verification and
  the imported feed exists. After removal, verify the feed and downstream copy.

### Spotify

- Before cutover: Spotify for Creators/Anchor is the audio host.
- Cutover: use Spotify's redirect control only after the exact RSS.com feed
  passes every gate and the redirect has fresh approval.
- After cutover: audio arrives from RSS.com; upload Spotify video separately.
- Preserve show ID `7GGLljxmO0G3FLjPy8vfcw`.

### Apple Podcasts

- Never upload normal RSS episodes separately.
- Preserve public show `1870433419` and its existing listing URL.
- Use Refresh Feed after a validated redirect. Change the feed URL on the
  existing show only if the redirect is unavailable or Apple support directs it.
- Never fix missing episodes by creating new GUIDs or a replacement show.

### Amazon Music And Audible

- There is no current claimed show. After RSS.com is healthy, submit/claim the
  exact imported feed once, complete ownership verification, record the stable
  ID and public URL, and verify the oldest/newest episodes.

### YouTube

- Direct full-video upload. Preserve channel
  `UCFA1nVv4lKMBlx81gjMAOFQ`.
- API upload needs an OAuth client/token and compliance audit; new unaudited API
  projects may be restricted to private uploads.
- Until configured, use the attended creator dashboard. Review made-for-kids,
  altered/synthetic content, paid promotion, notifications, schedule, license,
  and visibility before release.

### Vimeo

- Direct full-video upload to user `253415660`.
- An official API token with upload/edit scopes is still needed for automation.
- Current Vimeo display name is shortened to fit the platform limit.

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

## 10. RSS.com Migration Runbook

The detailed gate is `docs/rss-com-migration.md`. The safe sequence is:

1. Keep Anchor active and canonical.
2. Wait for RSS.com to provision the approved `dr-m-experienced` feed.
3. Freeze episode publishing when import work begins.
4. Run structural validation, then media validation with a private snapshot:

   ```bash
   /home/otto/.local/bin/drm-publish migration-check
   /home/otto/.local/bin/drm-publish migration-check --verify-media --snapshot
   ```

5. Require exactly seven items, the exact seven original GUIDs, unique playable
   enclosures, matching dates/durations/numbers/flags, and corrected show copy.
6. Enter the existing Spotify and Apple listing URLs in RSS.com Distribution.
   Do not auto-submit an imported show as a new directory listing.
7. Back up media and analytics; verify Apple's Add Show by URL preview.
8. Obtain fresh approval for the exact permanent redirect.
9. Redirect Anchor through Spotify for Creators and verify one HTTP 301 hop with
   no loop.
10. Confirm the same Spotify and Apple IDs; refresh the existing Apple feed.
11. Claim Amazon once using the new feed.
12. Keep the old Spotify account and redirect active for at least 90 days.
13. Update `publishing/platforms.json`, website RSS metadata/footer, and publisher
   code. The current publisher still models Spotify as the canonical host and
   hardwires Apple/Amazon to depend on it; cutover is not complete until that
   config/schema/test transition ships.

There is no clean rollback after a permanent 301 is widely cached. A failed gate
means do not redirect, not “redirect and see what happens.”

## 11. Apple Recovery Runbook

### Decision

Do **not** delete, reset, archive, or recreate public Apple show `1870433419`.
Apple's supported host migration preserves followers, play state, analytics,
ratings, and the stable listing when the feed and GUIDs are preserved. A new
show would risk losing those assets and creating a duplicate.

### Current Defect

- Anchor has seven valid, unique GUIDs and playable enclosures.
- Apple publicly exposes Episodes 3-7 only.
- Episodes 1-2 are missing publicly.
- Podcasts Connect contains three internal Draft episode records.
- Separate Draft show `1896845422` is nonpublic and has no RSS feed.

### Before RSS.com Cutover

1. Leave `1870433419` Published and Anchor active.
2. Leave `RSSVERIFY` until RSS.com confirms verification.
3. Do not use RSS.com's Apple auto-submit action.
4. Record Apple status, Last Refresh, analytics, and public episode count.
5. Inspect the three Draft episode records and duplicate Draft show for unique
   audio, channel, or subscription configuration. Do not archive yet.
6. If more than 24 hours have passed after Refresh Feed and Episodes 1-2 remain
   absent, contact Apple Support and request a recrawl of the existing show and
   source feed. Include these missing GUIDs:

   - `1e40e02b-b217-477c-9cc3-4271cb304c23`
   - `c9b853b6-a828-4012-9998-217919ff9163`

### Cutover And Verification

1. Validate RSS.com parity and record the existing Apple listing in RSS.com.
2. Redirect the old feed; verify the HTTP chain.
3. Open existing `1870433419` in Podcasts Connect and choose Refresh Feed.
4. Confirm the same Apple ID now shows seven episodes, new title/description/art,
   and working playback.
5. Remove `RSSVERIFY` only after RSS.com confirmation, then refresh and verify.
6. Only after the public show is healthy, archive the duplicate Draft show if its
   inspection found no unique content or subscription setup. Archive is
   reversible; deletion is not the recovery plan.

### Failure Branches

- Still five episodes after 24 hours: Apple Support recrawl, not resubmission.
- Duplicate public episodes: stop publishing and compare GUIDs; make RSS.com
  restore the originals.
- Show disappears: check Availability/status and restore the existing show; do
  not submit a new one.
- Redirect fails: keep the old feed live and repair the redirect before posting
  at RSS.com.
- Old feed accidentally removed: edit the RSS URL on the existing Apple show if
  available and contact Spotify and Apple Support immediately.

Official references are listed at the end of this manual.

## 12. Coordinated Episode Title Transition

Do this only after host migration and seven-episode directory parity are stable.

1. Export a crosswalk containing episode number, GUID, current title, approved
   new title, and every remote content ID.
2. Review `publishing/episode-title-migration.json` and approve all seven new
   public titles before changing any platform.
3. Ensure RSS.com has structured episode numbers 1-7. The current Anchor feed
   carries this field only for Episodes 1-3, so visible numbers cannot be removed
   safely until Episodes 4-7 receive their structured numbers.
4. Update publisher schema/tests to allow public titles without the prefix while
   retaining required `episodeNumber`.
5. Update RSS.com titles without changing GUID, enclosure, date, or episode
   number metadata.
6. Update Supabase and checked-in recovery data in the same maintenance window.
   Change `episodeDisplayTitle` so the website does not re-add the prefix.
7. Update direct video titles on Spotify video, YouTube, Vimeo, and Rumble.
8. Update Instagram captions only where the old numbered title is presented as
   the primary title; do not erase engagement history merely for cosmetic copy.
9. Replace title-bearing thumbnails using the new asset templates.
10. Refresh Apple and verify Apple/Spotify/Amazon propagation.
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
| Podcast show cover | 3000 x 3000 JPG, RGB | RSS.com, Apple, Spotify, Amazon |
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
- All seven long-video thumbnails contain the retired title.
- Website header/footer use a mountain emoji while favicon SVGs use a different
  mountain treatment.
- The website has no default Open Graph image.
- Episode thumbnails come from remote Vimeo fallback URLs. Sync scripts and
  Supabase recovery data must be changed so approved local art is not overwritten.

Store approved masters and an asset manifest under `publishing/brand/` before
remote replacement. Use a new podcast-cover filename after migration so Apple
notices the artwork update. Either provide unique 3000 x 3000 episode art or
omit it; do not blindly repeat the show cover for every episode.

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

### RSS Import Or Feed Parity Fails

- Keep Anchor canonical; do not redirect.
- Check HTTP status, item count, exact GUID set, duplicate GUIDs, enclosures,
  metadata, byte ranges, oldest/newest playback, and redirect chain.
- If the old-slug RSS.com feed is still empty, wait for supported import/support.
- Send RSS.com the comparison evidence; never populate the empty show manually.

### Apple Missing Or Duplicate Episodes

- Preserve public show ID and GUIDs.
- Refresh once, wait up to 24 hours, then ask Apple Support to recrawl.
- Compare feed GUIDs before touching Draft records.
- Do not submit a new show, delete the live show, or republish with new GUIDs.

### Spotify/Apple/Amazon Metadata Is Stale

- Verify the canonical feed first.
- Record feed value, directory value, and Last Refresh/check time.
- Allow documented propagation time, then refresh/support the existing listing.
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
- Wait for platform cache propagation, then use supported refresh/support.
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
- prepare/fingerprint exact assets
- reconcile every remote upload before release
- verify public playback/copy/thumbnail on every destination
- update Supabase, recovery mirrors, and the site

Weekly while migrating:

- run migration preflight
- check RSS.com support and feed availability
- compare Apple public episode count and Last Refresh
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

1. Finish supported RSS.com import and guarded cutover.
2. Recover Apple's missing Episodes 1-2 without replacing the show.
3. Update publisher configuration/schema/tests for RSS.com as audio host.
4. Implement the coordinated no-number title batch.
5. Produce and approve the logo, show cover, avatar, thumbnail, Reel, banner, OG,
   sting, and end-screen system.
6. Prevent sync scripts from overwriting approved custom artwork.
7. Complete YouTube, Vimeo, and Instagram official API authorization.
8. Add a durable upload receipt ledger, deterministic operation IDs, and remote
   reconciliation before calling the workflow unattended.
9. Version and test workstation-wrapper installation/recovery.
10. Build a small authenticated Supabase editorial/import tool after the release
    workflow is stable.

## 18. Official References

- Apple host migration: <https://podcasters.apple.com/support/3965-how-to-change-hosting-providers>
- Apple change feed URL: <https://podcasters.apple.com/support/837-change-the-rss-feed-url>
- Apple refresh feed: <https://podcasters.apple.com/support/838-refresh-a-podcast>
- Apple archive/restore consequences: <https://podcasters.apple.com/support/901-archive-or-restore-a-channel-podcast-or-episode>
- Apple podcast requirements: <https://podcasters.apple.com/support/823-podcast-requirements>
- Apple metadata: <https://podcasters.apple.com/support/832-podcast-metadata>
- Apple show-cover template: <https://podcasters.apple.com/support/5514-show-cover-template>
- RSS.com import: <https://help.rss.com/en/support/solutions/articles/44002261804-how-do-i-import-my-podcast-from-a-different-hosting-provider->
- RSS.com imported directory links: <https://help.rss.com/en/support/solutions/articles/44002727331-updating-directory-links-for-imported-podcasts>
- RSS.com Spotify redirect: <https://help.rss.com/en/support/solutions/articles/44002264641-how-do-i-redirect-my-podcast-from-spotify-for-creators-formerly-anchor->
- Spotify redirect: <https://support.spotify.com/us/creators/article/switching-away-from-spotify-for-creators-with-a-301-redirect/>
- Amazon RSS submission: <https://podcasters.amazon.com/submit-rss>
- YouTube upload API: <https://developers.google.com/youtube/v3/docs/videos/insert>
- YouTube channel branding: <https://support.google.com/youtube/answer/10456525>
- Instagram publishing: <https://developers.facebook.com/documentation/instagram-platform/content-publishing>
- Vimeo upload API: <https://developer.vimeo.com/api/upload/videos>
- Rumble upload/edit: <https://rumble.support/help/upload-and-edit-content>

## 19. Change Log

- August 5, 2026: created the ecosystem manual; recorded current migration,
  account, Apple recovery, direct-management, browser/keyring, title-transition,
  visual-system, website, and incident procedures; corrected private migration
  evidence ownership and permissions.
