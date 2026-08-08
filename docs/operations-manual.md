# Dr. M Experienced Ecosystem Operations Manual

Last verified: August 22, 2026.

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
cd /home/otto/DR-M-Experienced-ops
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

Interpretation on August 8, 2026:

- RSS.com is canonical at
  `https://media.rss.com/dr-m-experienced/feed.xml`. It has the seven GUIDs
  captured in the retained August 5 source-feed baseline,
  structured episode numbers 1-7, exact approved copy, no `RSSVERIFY`, no season
  tags, seven remotely decoded and loudness-verified normalized audio enclosures
  with those captured GUIDs, and seven unique 3000 x 3000 item-art images. The
  separate RSS.com public landing-page metadata still emits
  a cached `RSSVERIFY` token even though the dashboard field and XML feed are
  exact; monitor or escalate that cache without editing the clean feed copy.
- The legacy Anchor feed returns one direct HTTP 301 hop to that exact RSS.com
  URL, which returns HTTP 200. Preserve the Spotify account and redirect while
  directories and caches converge.
- Apple public show `1870433419` was configured directly to the RSS.com feed at
  approximately 18:29 UTC. Its authenticated title and description are exact
  and token-free. Episodes 3-7 are Available; RSS Episodes 1-2 remain Draft, so
  the public episode count is still five. The duplicate Draft show and stale
  manual Episode 4 Draft were archived after inspection. Apple still reports the
  two valid RSS items as `DRAFTING` and `HIDDEN`. On August 7, Apple Support case
  `20000130526608` confirmed that Apple's existing Episode 1-2 records use older
  historical GUIDs that differ from the current feed. The fail-closed crosswalk
  and repair gates are recorded in `publishing/apple-guid-repair.json`; no live
  GUID change is approved. Follow-up requests are now submitted to Apple for a
  server-side remap, RSS.com for in-place GUID-only capability, and Spotify for
  preservation of episode IDs, attached videos, and analytics. Apple and
  RSS.com are pending; Spotify has acknowledged the request and its advisor is
  checking the ingestion behavior internally. No provider has been asked to
  perform a live GUID change.
- Both guarded Supabase migrations were applied in production after exact SQL
  file-hash verification. Seven-row readback matches catalog revision 10 for
  current RSS.com audio URLs, YouTube IDs, and `Watch on YouTube` references.
- YouTube: six normalized replacements remain public with exact titles,
  descriptions, and approved thumbnails; Episode 5 preserves public ID
  `N_F0hhHkIQ4` after a same-ID emergency trim removed the contaminated interval,
  and YouTube Studio reports 29:45. Vimeo's seven corrected videos are verified
  in place on their stable IDs. Spotify preserves all seven episode IDs and the
  corrected Episode 5 RSS audio, but Episode 5 is currently audio-only after
  three video attempts reverted; the other six video attachments remain public.
  A Spotify Creator Support request is staged for owner review. Rumble's exact seven
  corrected videos and thumbnails remain locally verified and unsubmitted. The
  August 8 cache reset invalidated their staged forms, so the batch is blocked
  on manual restaging, release-control verification, and third-party asset-rights
  review. The user explicitly accepted the July 21, 2026 Terms provisions on
  August 8.
  Vimeo represents catalog lists as rich-text bullets;
  YouTube replaces forbidden angle brackets with equivalent comparison words.
- Catalog revision 11 corrects Episode 7's description, which had duplicated
  Episode 6 copy. RSS.com, Spotify fanout, YouTube video `5UOEvs59hBA`, and
  Vimeo video `1205004739` now match the corrected description. Production
  Supabase also passed the guarded migration and independent editorial readback.
  The website correction was deployed through merge `a291990`, its deployment
  receipt was merged as `0934f3a`, and the public page passed exact-copy plus
  320/390-pixel no-overflow readback. Apple cache convergence and Rumble's manual
  reupload remain pending in
  `publishing/episode-description-correction.json`; do not report global parity
  until that receipt is complete.
- All three cataloged Instagram shorts now have verified Vimeo recovery copies:
  `1216695521`, `1216695522`, and `1204939542`. Their canonical titles,
  descriptions, and posters match the short-form catalog. All three website
  short routes are deployed and verified against those exact Vimeo IDs.
- Catalog revision 13 records the corrected Episode 5 master, podcast audio,
  Spotify derivative, RSS enclosure, and 30-minute runtime while retaining the
  exact portrait-free Show Brand Package `1.0.0-rc1` binaries in Dropbox for
  local verification. The package remains
  `review_owner_approval_required`; no website or platform received these
  show-level assets, and the existing podcast-cover `publishedUrl` was not
  changed.
- Local publishing browser: normally stopped when not in active use.
- GitHub connector: authenticated with admin/push access to this repository.
  Otto's local `gh` credential is also authenticated through the Otto Chrome
  profile and stored outside the repository; use `HOME=/home/otto` for CLI work.
- The publisher now has separate immutable review and release-authorization
  records, content-addressed private asset staging, a durable node:sqlite queue,
  official Vimeo/YouTube/RSS.com adapters, provider write intent and hashed
  checkpoints, exact-resource reconciliation, and automatic immutable receipt
  writes. All authorized targets enqueue atomically or none do. At the August 22
  pre-reconciliation snapshot, the installed publisher was immutable build
  `84f606ca8d899d1c8ac9a6890ecbb073cfd11b8f`. Read `current/release.json` for the
  authoritative installed commit. The two-minute offline intake timer is enabled and active; the one-minute
  controller timer is disabled and inactive. Machine control generation 1 is
  still `running` with only Vimeo allowlisted, and the queue is empty. The last
  observed intake run succeeded with no ready deliveries. This state created no
  job and authorized no release. Do not enable the controller merely to stage an
  episode; reconcile the clean pinned publisher first and open the exact release
  gates only for an approved immutable job.
- Vimeo app `540274`, account `253415660`, its owner-only upload/edit token, and
  upload quota are verified. The user accepted Vimeo's Developer Addendum and
  Terms for the Dr. M Experienced Publisher app on August 8, 2026. RSS.com
  podcast ID `397420` is bound, but the v4 adapter needs a Max entitlement and
  API key; free/manual hosting continues. Google Cloud project
  `dr-m-experienced-publisher`, YouTube Data API v3, and the production desktop
  OAuth client are configured, and the user approved Google Cloud terms on
  August 8. The separate production channel-owner OAuth token is absent and
  public/unlisted API upload remains gated on the applicable compliance audit.
- Publisher preparation performs a full-file `ffmpeg loudnorm` scan and blocks
  RSS podcast audio and Spotify replacement video outside `-17` through `-15`
  LUFS or above `-1 dBTP`.

## 2. Sources Of Truth

| Subject | Authority |
|---|---|
| Operating rules | `AGENTS.md` |
| Completed host-migration evidence and downstream directory state | `publishing/hosting-migration.json` |
| Shared show and episode distribution metadata | `publishing/master-catalog.json` |
| Short-form metadata, local-master fingerprints, and Instagram/Vimeo mappings | `publishing/short-form-catalog.json` |
| Stable account/show/channel IDs and current routing | `publishing/platforms.json` |
| Tracked global/per-platform automation gates and policy revisions | `publishing/platforms.json` |
| Apple Episodes 1-2 GUID incident, crosswalk, and repair gates | `publishing/apple-guid-repair.json` |
| Approved seven-episode title-transition evidence | `publishing/episode-title-migration.json` |
| Approved episode-art assets and remote rollout receipt | `publishing/brand/asset-manifest.json` and `publishing/episode-thumbnail-rollout.json` |
| Episode approval schema | `publishing/episode.schema.json` |
| Visual identity and media production standard | `publishing/brand/media-design-guide.md` |
| Visual briefs, templates, and asset rollout status | `publishing/brand/` |
| Website mobile UX and analytics measurement baseline | `docs/mobile-ux-and-analytics-study.md` |
| Binary masters | Project-scoped Dropbox folder mapped by `~/.config/drm-publisher/sources.json` |
| Production website-only editorial content | Supabase project `tdbsuzciwotleualdcjf` |
| Website source and deployment | This repository and GitHub Actions |
| Private jobs, approvals, queue/checkpoints, staged assets, receipts, and feed evidence | `~/.local/state/drm-publisher/` |
| Machine-local running/paused state and exact platform allowlist | Mode-0600 `~/.local/state/drm-publisher/automation-control.json` |
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

`publishing/short-form-catalog.json` is the separate authority for Reels,
recipe clips, and episode excerpts. It assigns platform-neutral IDs, binds the
fingerprinted local master and website poster, and records Instagram, Vimeo, and
website destinations. These items never receive podcast episode numbers or RSS
GUIDs. Follow `docs/short-form-content-system.md` for the verified inventory and
recovery steps.

Supabase remains authoritative for website-only editorial fields such as topics,
references, takeaways, checklists, long-form sections, affiliate/blog
relationships, and website publication state. Where Supabase repeats an episode
number, slug, title, audio URL, or destination ID, it is a verified projection
of the master catalog and must not drift. The production seven-row RSS.com audio
migrations and exact seven-row catalog readback passed on August 7, 2026 for
current RSS audio URLs, YouTube IDs, and `Watch on YouTube` references.

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
this workstation, the direct project root is configured at
`/home/otto/Dropbox/Dr M Experienced`; the seven approved thumbnail records are
verified. Corrected video and derived podcast audio stay `unmounted` until their
full-file checks and exact catalog bindings pass.

An adapter never streams the mutable Dropbox path directly through a release.
After local and account preflight, it copies the approved regular file to
`~/.local/state/drm-publisher/assets/sha256/<prefix>/<sha256>` through a private
temporary file, checks that the source identity did not change while copying,
verifies the digest, and atomically installs a mode-0600 staged object. Reuse
requires a fresh size and SHA-256 check. Symlinks and changed sources fail before
provider upload.

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

The seven replacement titles are live in the canonical RSS.com feed. The local
publisher and website accept unnumbered public titles while continuing to
require `episodeNumber`. Apple and Spotify ingest the titles from RSS.com;
Amazon will do so after its one-time claim. Preserve every remote content ID and
do not change a GUID except through the blocked, support-coordinated Apple
incident in `publishing/apple-guid-repair.json`. The exact identity, issue, and
approved-title crosswalk is
`publishing/episode-title-migration.json`.

## 4. Ecosystem Map

The intended flow is:

```text
DaVinci Resolve exports
  -> project-scoped Dropbox binary folder
  -> repository master catalog
  -> catalog-bound episode manifest and integrity packet
  -> immutable review plus exact release authorization
  -> atomic durable operation graph
  -> tracked policy gates plus mode-0600 local host allowlist
  -> immutable content-addressed staging
  -> pinned Node 22 controller, write intent, and provider checkpoint
      -> RSS.com podcast audio API after Max/key -> canonical RSS -> Spotify, Apple, Amazon
      -> Vimeo full video API (credential-ready)
      -> YouTube full video API after owner OAuth/audit gates
      -> Spotify video through an attended Spotify for Creators handoff
      -> Instagram Reel after Meta app/Page/publishing-ID setup
      -> Rumble direct-human handoff only
  -> verified remote IDs and URLs
  -> Supabase episode/catalog rows
  -> strict GitHub Pages build
  -> drmexperienced.com
```

The supported RSS.com import copied all GUIDs and media present in the retained
August 5 source-feed baseline, and the
legacy Anchor URL now redirects to RSS.com. RSS.com owns podcast audio
distribution. Spotify receives that RSS audio; for an approved video episode,
the operator may replace the already-ingested episode's audio with video in
Spotify for Creators.

The publisher prepares and fingerprints files, validates decisions, creates a
review packet, records a separate exact release authorization, atomically queues
deterministic operations, stages exact bytes, and can run supported official
adapters with durable provider checkpoints, authenticated readback, and
automatic receipts. A receipt remains evidence, not authorization. The tracked
global/per-platform gates and policy revision cannot be overridden by the
separate local running/paused allowlist. The intake timer is enabled and active;
the controller timer is disabled and inactive. Local control generation 1 is
running with Vimeo as its only allowed platform, and the queue is empty. This
state created no release. Spotify video remains attended; Instagram still needs
Meta prerequisites; Rumble remains excluded.

## 5. Account And Destination Inventory

| Destination | Stable identity | Current delivery and state |
|---|---|---|
| Website | `https://drmexperienced.com` | The apex returns HTTP 200 and `www` redirects to it. Episode 5 exposes the corrected 29:45 audio/Vimeo/YouTube references and clearly separates its video and audio regions by 40 pixels at 320px with no horizontal overflow. The corrected Episode 7 page and all three short-form routes are also deployed. Production PostHog ingestion and all three tracked event checks are verified. Dashboard `1086989` has six verified growth views |
| GitHub | `MichaelJamesHofer/DR-M-Experienced` | Public repo; `main` deploys production |
| Supabase | project `tdbsuzciwotleualdcjf` | Production content catalog and form receiver; Episode 5 now projects the corrected RSS enclosure and 30-minute duration, and the August 8 Episode 7 editorial correction retains its independent summary, takeaway, section, paragraph, and topic readback |
| RSS.com | podcast `397420`, slug `dr-m-experienced`, feed `https://media.rss.com/dr-m-experienced/feed.xml` | Canonical XML/dashboard copy is exact and token-free; all seven normalized enclosures retain their GUIDs. Episode 5 preserved episode ID `3050762` and GUID `e9f7596f-0333-49ca-8946-bc11e96b2091` while moving to the corrected 29:45 enclosure on August 22. The official v4 adapter is implemented, but API access requires Max and no entitlement/key is configured, so free/manual hosting continues. The public landing-page cache still exposes `RSSVERIFY` |
| Spotify | show `7GGLljxmO0G3FLjPy8vfcw` | All seven episode IDs are preserved. Six corrected video attachments remain public; Episode 5 is currently audio-only with the corrected RSS audio after three same-ID video attempts reverted. A Creator Support request is staged for owner review; never create a duplicate episode |
| Apple | public show `1870433419` | Configured directly to RSS.com with exact canonical metadata. Episode 5 preserved Apple episode ID `1000774398633`, exposes the corrected 29:45 enclosure, and has its generated transcript set to Not Displayed. Five Available and two RSS Draft records remain because Episodes 1-2 use historical GUIDs; case `20000130526608` and `publishing/apple-guid-repair.json` govern that separate blocked repair |
| Apple Connect | `cfab5caf-554e-4ebe-a28c-2e4748147b82` | Internal identity of the public show |
| Apple duplicate Draft | public-style ID `1896845422`, internal `949adc0b-c62f-410c-962d-17563cf3b07a` | Inspected nonpublic no-feed show; archived August 6, 2026; public lookup returned 404 on August 7 |
| Apple stale Episode 4 Draft | Apple episode `1000759096366`, internal `fc3cdd48-13c5-4122-b464-b62376765410` | Inspected manual subscriber episode; archived August 6, 2026 |
| Amazon | no ID yet | Signed-in account has zero claimed shows; submit the canonical RSS.com feed once, verify ownership, and record its stable identity |
| YouTube | channel `UCFA1nVv4lKMBlx81gjMAOFQ`, uploads playlist `UUFA1nVv4lKMBlx81gjMAOFQ` | Six normalized replacements remain public. Episode 5 preserves ID `N_F0hhHkIQ4` after its approved same-ID emergency trim; YouTube Studio reports 29:45. Project `dr-m-experienced-publisher`, Data API v3, desktop client, and production OAuth app are ready. Owner `michaeljameshofer@gmail.com` must grant OAuth once; the DRM account is only a Manager. Public/unlisted API uploads also remain blocked pending the applicable compliance audit |
| Vimeo | user `253415660`, app `540274` | Seven corrected episode videos remain verified on their stable IDs; Episode 5 was corrected in place again on August 22 while preserving `1204939658`. The three Instagram shorts are verified as `1216695521`, `1216695522`, and `1204939542` with canonical metadata and posters. The private app, exact account, owner-only upload/edit token, and upload quota are verified; the adapter is credential-ready for a separately authorized release |
| Instagram | `@drmexperienced`, public profile ID `80068141150` | Public state confirms the exact name/bio and Creator professional classification, with `is_business_account` false. The website, affiliate guide, and contact links are live; the profile reports four posts, and all three cataloged Reels map to verified local masters and Vimeo IDs. Meta API setup still needs the authenticated publishing ID and token; Business conversion is neither required nor desired |
| Rumble | account `282015440`, channel `7820170` | The exact seven corrected videos and thumbnails are locally verified, but the August 8 cache reset invalidated the staged forms. Existing Episode 7 video `v7bvtu4` is not in revision-11 description parity. The batch is blocked until a human restages it with the current copy, Option C, Unlisted, all syndication off, and Premium off; reviews third-party asset rights; completes the on-site rights/Terms controls; and submits |

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

Rumble is an exception to the normal browser-assistance workflow. Its Terms last
modified July 21, 2026 prohibit automated software access or interaction absent
Rumble's prior written permission. The assistant may prepare local assets,
metadata, and a manual checklist, but must not connect browser automation to
Rumble, inspect or edit its forms through scripts, check attestations, or submit.

## 7. Workstation Tooling

### Publisher

```bash
/home/otto/.local/bin/drm-publish doctor
/home/otto/.local/bin/drm-publish prepare /absolute/path/to/episode.json
/home/otto/.local/bin/drm-publish show <job-id>
/home/otto/.local/bin/drm-publish approve <job-id> \
  --hash <approval-hash> --by "Otto" \
  --confirm "approve <job-id> <approval-hash>"
/home/otto/.local/bin/drm-publish authorize <job-id> \
  --hash <approval-hash> --by "Otto" --targets <comma-list> \
  --confirm "authorize-release <job-id> <approval-hash> <comma-list>"
/home/otto/.local/bin/drm-publish dispatch <job-id>
/home/otto/.local/bin/drm-publish queue <job-id>
/home/otto/.local/bin/drm-publish host status
/home/otto/.local/bin/drm-publish host pause --confirm "pause-publisher"
/home/otto/.local/bin/drm-publish host run \
  --platforms <comma-list> --confirm "run-publisher <comma-list>"
/home/otto/.local/bin/drm-publish controller --once
/home/otto/.local/bin/drm-publish reconcile <operation-id> \
  --reason <text> --confirm "reconcile-operation <operation-id>"
/home/otto/.local/bin/drm-publish supersede <operation-id> \
  --reason <text> --evidence <text> \
  --confirm "supersede-no-remote-write <operation-id>"
/home/otto/.local/bin/drm-publish auth youtube
/home/otto/.local/bin/drm-publish receipt <job-id> \
  --platform <platform-id> --operation-id <operation-id> \
  --status <accepted|processing|published|verified|failed|superseded> \
  --by <recorder> [--remote-id <id>] [--remote-url <https-url>] \
  [--evidence <kind=value>] \
  --confirm "record-receipt <job-id> <platform-id> <approval-hash> <operation-id>"
/home/otto/.local/bin/drm-publish receipts <job-id>
/home/otto/.local/bin/drm-publish status <job-id>
```

Use
`migration-check [--verify-media] [--verify-artwork] [--decode-edge-audio] [--snapshot]`
to audit the completed migration evidence or investigate feed drift. It is not
part of routine episode publishing.

Jobs live under `~/.local/state/drm-publisher/jobs/`. `prepare` is local-only.
The approval hash covers normalized copy, decisions, file paths, media metadata,
SHA-256 fingerprints, and the selected master-catalog revision/binding. Any
changed input or catalog/manifest drift invalidates approval.

`authorize` is distinct from `approve`: it creates an owner-only immutable
record bound to the approval hash, exact destinations, assets, copy, release
plan, timing, visibility, disclosures, and approver. `dispatch` validates that
record and writes deterministic operations to
`~/.local/state/drm-publisher/control/publisher.sqlite3`; it contacts no
platform. A multi-target dispatch is one transaction: dependencies and create
slots either all enqueue or the entire dispatch rolls back. The controller then
requires all four barriers: the immutable authorization, tracked global and
per-platform gates with unchanged policy revision, a secure running local host
control that allowlists the exact platform, and the adapter's account/capability
preflight. Missing or insecure `automation-control.json` means paused. The
controller reloads that local control immediately before every mutating step.
Live machine control is generation 1, `running`, and allowlists only Vimeo. The
offline intake timer is enabled and active; the controller timer is disabled and
inactive. The controller queue is empty and the last offline intake run succeeded
with no ready delivery. A timer cannot
prepare its own authorization or enqueue work; every live write still requires
the exact reviewed release and all tracked gates.

Every adapter copies the approved files to private content-addressed staging
before upload. Before each provider mutation the controller records write
intent and the pinned build SHA. It then saves each provider session/resource as
a hashed, sequenced private checkpoint. `reconcile` may resume only that exact
checkpoint. `retry` is limited to a definite pre-write failure. `supersede`
releases a blocked/failed create slot only when reason and evidence are supplied
and no provider write intent, checkpoint, acceptance, remote ID, or URL exists.

`receipt` writes a new immutable JSON file under the private job's `receipts/`
directory and binds it to the job, approval hash, catalog, destination plan,
asset, approved copy, release plan, platform, and deterministic operation ID.
Use the same operation ID as one request advances from `accepted` through
`processing`, `published`, and `verified`; `failed` and `superseded` are
terminal. Every nonterminal state blocks a second operation for that platform
until the first is failed or superseded. `published` and `verified` require a
remote ID or HTTPS URL, and `verified` also requires meaningful typed readback
evidence. The command validates platform URL origins and stable-ID bindings,
rejects remote identity drift and duplicate or regressive states, serializes
writes with a per-job lock, and revalidates the entire ledger on every read.
If a process dies while holding that lock, recovery waits at least 15 minutes
and removes it only when the recorded PID is invalid or no longer alive.
`receipts` lists the ledger; `status` shows the latest receipt per destination.
The self-reported `--by` value and confirmation phrase are evidence controls,
not identity or release authorization. The Vimeo, YouTube, and RSS.com adapters
perform authenticated account preflight and readback and write lifecycle
receipts automatically. An ambiguous prior attempt blocks replay so the
controller cannot blindly create a duplicate.

Do not confuse a historical `superseded` receipt with the `drm-publish
supersede` queue command. The command releases only a blocked or failed create
slot proven never to have reached a provider; it cannot supersede an accepted,
published, verified, checkpointed, or ambiguous remote operation.

`ops/install-publisher-host.sh` deploys only a clean Git commit. It archives that
commit under `~/.local/share/drm-publisher/releases/<git-sha>/`, installs
production dependencies with Node `22.22.0`, atomically switches the `current`
symlink, and pins the systemd service to both that release and build SHA. The
default installation keeps both timers disabled unless `--enable` is supplied.
At the August 22 pre-reconciliation snapshot, build
`84f606ca8d899d1c8ac9a6890ecbb073cfd11b8f` was installed, intake was
enabled/active, and the controller was disabled/inactive. Read
`current/release.json` for the authoritative installed commit. Deploy a
replacement only from a reviewed merged commit; service enablement is a
separate, intentional choice.

### Isolated Browser

```bash
# Human sign-in only; no automation endpoint
/home/otto/.local/bin/drm-browser login

# Attended work: use a narrow scope for account maintenance
/home/otto/.local/bin/drm-browser open
/home/otto/.local/bin/drm-browser identities
/home/otto/.local/bin/drm-browser reauth rss
/home/otto/.local/bin/drm-browser connect apple
/home/otto/.local/bin/drm-browser connect supabase

# Approved cross-platform release/reconciliation run; Rumble and Gmail blocked
/home/otto/.local/bin/drm-browser connect publishing
/home/otto/.local/bin/drm-browser status
/home/otto/.local/bin/drm-browser disconnect
/home/otto/.local/bin/drm-browser close
```

Chrome data directory: `~/.local/share/drm-publisher/chrome-profile`

Identity mapping:

- `Default`: `drmexperienced@gmail.com`; RSS.com, Spotify, Apple, Amazon,
  YouTube, Vimeo, Instagram, and Rumble.
- `Profile 1`: `ottotheautonomous@gmail.com`; GitHub and Supabase.

Do not sign out `drmexperienced@gmail.com`, move publishing sessions into the
Otto profile, or copy cookies or passwords between profiles.

State and log: `~/.local/state/drm-publisher/browser/`

Loopback endpoint: port `9223`, only while `open` is active

Wrapper-recognized scopes: `rss`, `spotify`, `apple`, `amazon`, `youtube`, `vimeo`,
`instagram`, `rumble`, `supabase`, `email`, `publishing`

The wrapper recognizes the `rumble` name only to reject `connect rumble` and
`reauth rumble`; future wrapper launches do not open Rumble automatically. Keep
an existing or manually opened Rumble tab in the DRM profile for direct human
use and leave the bridge disconnected.

`login` and `open` are different modes; both open the assigned dashboards in
both isolated profiles. Close the sign-in-only browser before using `open`.
`connect` stops the previous CLI bridge, activates or opens the requested
dashboard in its assigned profile, and normally restricts the new bridge to that
scope. `connect publishing` is the deliberate exception for an approved release
or reconciliation run: it exposes the non-Rumble publishing dashboards across
the DRM profile while keeping Gmail and Rumble blocked. It must preserve
unrelated tabs and authenticated sessions in both profiles. The bridge starts
with unrestricted local-path access because the CLI does not negotiate MCP
filesystem roots and approved media is supplied from the delegated Dropbox tree.
Use the wider scope only for an approved cross-platform job on the attended
local machine, then disconnect it when account work finishes.
Always disconnect the bridge when unattended and close the isolated browser
when the account-work session is finished. Never attach to Otto's regular Chrome
data directory.

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
9. Obtain separate approval to upload the exact packet to each destination, then
   use `authorize` to bind those exact targets and release values. Dispatch only
   the supported direct target set after its tracked gates pass. Current machine
   control permits Vimeo only; RSS.com and YouTube automation remain disabled at
   their separate account/policy gates.

### Upload And Release

1. Confirm `host status` still reports generation 1, `running`, and Vimeo-only
   before dispatching an approved Vimeo release. Use `host pause` as the immediate
   kill switch if the queue or release is not exact.
2. For every controlled API path, confirm the global tracked gate, the target's
   tracked enabled gate/policy revision, and the exact local host allowlist
   before any write. An active timer does not override a closed target gate.
3. Query or inspect the authenticated account and compare its stable ID. Stage
   and rehash the exact approved asset; never stream a changing Dropbox file.
4. Create a draft/private item where supported. The controller records provider
   write intent first and then checkpoints the returned session/resource before
   continuing.
5. Record the returned operation ID and its `accepted` or `processing` state in
   the immutable job receipt ledger, including remote ID/URL and evidence when
   available.
6. If a request times out after creation may have begun, use `reconcile` only
   with the durable provider checkpoint. Never repeat a create request. If no
   safe identity checkpoint exists, stop for review.
7. Preview the processed asset and copy.
8. Obtain fresh approval for exact public/scheduled settings.
9. Release once, verify publicly, and append `published` then `verified`
   receipts for the same operation. On a terminal error, record `failed`; before
   replacing an active operation, record `superseded`. Then run `receipts` and
   `status` to validate the job ledger. Implemented API adapters perform these
   receipt writes after authenticated readback; Spotify video and other attended
   paths continue to use the manual evidence workflow.

RSS.com additionally checkpoints each presigned audio/artwork upload session,
whether its bytes completed, episode-write intent, and the accepted episode
ID/GUID. If a new-episode POST has an ambiguous response before the episode ID
can be checkpointed, the adapter refuses a second POST; provider/support
reconciliation is required.

Detailed checklist: `docs/new-episode-process.md`.

### Website Publication

After every non-null master-catalog destination has an exact verified website reference:

1. Create/update `public.episodes` in Supabase as `draft`.
2. Add topics, references, takeaways, checklists, sections, and paragraphs.
3. Review affiliate and blog relationships.
4. Mirror durable recovery data into `supabase/seed.sql` and fallback data.
5. Run the full local verification suite.
6. Set the episode to `published` in Supabase.
7. Deploy a verified branch through GitHub and confirm the live episode page.

## 9. Platform Procedures

### RSS.com

- Preserve the supported import and the `dr-m-experienced` slug; do not recreate
  episodes or change their GUIDs. The only pending exception is the blocked
  Apple identity incident in `publishing/apple-guid-repair.json`; it requires
  provider confirmation and every recorded gate before any remote write.
- Publish all future canonical podcast audio here.
- Verify exact copy, no verification token or stray season metadata, the GUID,
  enclosure, artwork, and publication date after every episode publication.
- Free-plan directory convenience does not replace the repository master catalog
  or provide a supported publishing API.

### Spotify

- Preserve the existing account, show, analytics, and verified Anchor 301 to
  RSS.com. Do not delete the account or reverse the redirect during propagation.
- Podcast audio arrives from RSS.com. Wait for that episode to appear in Spotify.
- There is no account-wide video-enable switch. For an approved video episode,
  use the existing episode's menu in Spotify for Creators, choose `Upload video`,
  upload the approved `fullVideo`, preview, and publish against that exact RSS
  episode. For an audio-only episode, make no separate Spotify upload.
- Six corrected video attachments remain public. Episode 5 preserves episode ID
  `6fQAClcR4AAuueHjBNlrJC` and corrected RSS audio but is currently audio-only
  after three video attempts reached processing and reverted. The strict MOV met
  Spotify's published media specifications; the Creator Support request is
  staged for owner review. Never create a duplicate episode or upload fallback
  `podcastAudio` directly.
- Episode 5's verified master preserves its high-bitrate source video; do not
  send that file to Spotify. Its separately validated 3.90 Mbps muxed derivative
  is `episode-005-spotify-video` in catalog revision 13. Use only an approved
  derivative for the existing Episode 5 Spotify identity.
- Preserve show ID `7GGLljxmO0G3FLjPy8vfcw`.

### Corrected Audio Replacement

- The historical August 7 full-file loudness audit is
  `publishing/audio-replacement-audit.json`. The seven prior RSS enclosures
  measured between `-30.99` and `-28.42` LUFS. The seven August 7 delivery
  videos and MP3s were fingerprint-verified in catalog revision 7; catalog
  revision 8 additionally registered Episode 5's validated Spotify derivative.
  That batch measured between `-16.47` and `-16.05` LUFS with true peak at or
  below `-1.29` dBTP. Catalog revision 13 supersedes Episode 5 with its August 22
  audio binary while preserving the existing GUID. Audit every replacement
  against its own current binary rather than reusing the historical batch range.
- Hash, fully decode, probe, and measure every supplied audio file and every
  affected video soundtrack before any platform write. Confirm duration and A/V
  sync against the existing release.
- In RSS.com, replace audio on the existing episode. Preserve title, GUID,
  episode number, publication date, and artwork. Never delete or recreate it.
- If RSS.com changes the enclosure URL, update the matching Supabase `audio_url`
  and verify the canonical feed still has the same seven GUIDs.
- Spotify video needs a corrected `fullVideo` whose embedded soundtrack is the
  approved normalized audio. Updating RSS.com alone does not change that media.
- Vimeo's seven corrected videos were replaced in place on their stable IDs;
  prefer that version workflow for future corrections. YouTube cannot replace
  an uploaded media file while preserving its ID; the approved YouTube cutover
  therefore published seven new normalized IDs and moved the prior seven to
  Unlisted without deleting them. Rumble's exact seven corrected videos and
  thumbnails remain locally verified, but the cache reset invalidated the
  staged forms. They remain blocked on the manual restaging and release
  checklist in the Rumble section below.

### Apple Podcasts

- Never upload normal RSS episodes separately.
- Preserve public show `1870433419` and its existing listing URL.
- The existing show was configured directly to the exact RSS.com feed at
  approximately 18:29 UTC on August 6, 2026. Its authenticated metadata is exact
  and token-free; verify propagation without changing the show ID.
- Five episodes are Available. RSS Episodes 1-2 remain `DRAFTING` and `HIDDEN`;
  their source feed items are active, their audio is valid, no administrator
  block is present, and Apple offers no manual Publish action.
- The inspected duplicate Draft show and stale manual Episode 4 Draft were
  archived with Apple's reversible Archive controls on August 6, 2026.
- One feed refresh was requested after cleanup. Apple Support replied on August
  7 in case `20000130526608`: its existing Episode 1-2 records use historical
  GUIDs that differ from the current feed values. The exact crosswalk and repair
  gates are in `publishing/apple-guid-repair.json`.
- On August 8, follow-up requests were submitted to Apple for a server-side
  remap, RSS.com for in-place GUID-only capability, and Spotify for preservation
  of the existing episode IDs, attached videos, and analytics. All responses are
  pending. No provider was authorized to change a live GUID.
- Do not change either live GUID, delete/recreate either RSS.com item, or create,
  upload, or publish replacements. Await the three written responses and keep
  the incident blocked before considering one attended, exactly approved canary.

### Amazon Music And Audible

- There is no current claimed show. Submit the canonical RSS.com feed once,
  complete ownership verification, record
  the stable ID/public URL, and verify the oldest/newest episodes.

### YouTube

- Direct full-video upload. Preserve channel
  `UCFA1nVv4lKMBlx81gjMAOFQ`.
- The current public normalized IDs for Episodes 1-7 are `5IMYaqnQsFY`,
  `DJe0fPmTf8k`, `r5JYtE8Vm9I`, `binbLcb3f_s`, `N_F0hhHkIQ4`,
  `8u1Ps_mCpO4`, and `5UOEvs59hBA`.
- The prior seven IDs are recorded under each catalog episode's
  `destinationArchives`. They remain Unlisted and directly playable, and each
  description begins with the link to its normalized replacement. Do not delete
  them; they are the rollback path and preserve historical URLs.
- The August 7 public readback found exactly the seven replacement IDs in the
  channel feed, exact titles and deterministic YouTube-safe descriptions, no
  retired branding or `RSSVERIFY`, and approved max-resolution thumbnails.
- Google Cloud project `dr-m-experienced-publisher`, YouTube Data API v3, the
  desktop client, and the production OAuth app are configured, and the user
  approved Google Cloud terms on August 8, 2026. That approval is separate from
  channel authorization. Run
  `drm-publish auth youtube` once as channel owner
  `michaeljameshofer@gmail.com`; the `drmexperienced@gmail.com` Manager grant
  cannot authorize API uploads for the owner's channel.
- The resumable adapter is implemented, but public or unlisted API upload stays
  blocked until the applicable compliance audit is recorded as verified. Until
  both gates clear, use the attended creator dashboard. Review made-for-kids,
  altered/synthetic content, paid promotion, notifications, schedule, license,
  and visibility before release.
- Current seven titles and descriptions are verified. The deterministic
  YouTube projection writes comparison operators as words because Studio rejects
  angle brackets in descriptions.

### Vimeo

- Direct full-video upload to user `253415660`.
- Private first-party app `540274`, exact account `253415660`, its owner-only
  upload/edit token, and current upload quota are verified. The user explicitly
  accepted Vimeo's Developer Addendum and Terms for the Dr. M Experienced
  Publisher app on August 8, 2026. The official adapter is credential-ready,
  but no approved new release has exercised it.
- Completed August 7: all seven corrected videos were replaced in place and
  verified on the existing stable Vimeo IDs.
- All three Instagram-mapped shorts now have Vimeo recovery copies with
  canonical titles, descriptions, and posters: Brain Fog Part 1 is `1216695521`,
  Brain Fog Part 2 is `1216695522`, and the pesto recipe is `1204939542`.
  Preserve these stable IDs. Their website routes are deployed and verified.
- Current Vimeo display name is shortened to fit the platform limit.
- Current seven episode titles and descriptions are verified. Vimeo may render catalog
  hyphen lists as native rich-text bullets; compare persisted editor structure
  and normalized public text rather than raw oEmbed punctuation.

### Instagram

- Publish an approved vertical Reel to `@drmexperienced`.
- Add `https://drmexperienced.com` as the public external link through the
  Instagram mobile app; the current desktop editor exposes link management as
  mobile-only. Do not use the raw XML feed as the profile link.
- Public profile state independently confirms this is a Creator professional
  account and not a Business account, the correct type for Dr. Musnick's creator
  presence. Do not convert it or require brick-and-mortar contact details.
- Keep the public profile ID separate from the authenticated Graph API publishing
  ID. The former is recorded; the latter remains unknown until an authorized API
  readback confirms it.
- All three public Reels have distinct captions and are mapped to verified local
  masters plus Vimeo IDs `1216695521`, `1216695522`, and `1204939542` in
  `publishing/short-form-catalog.json`. Their website routes are deployed.
- Prefer Meta's resumable local upload after the stable publishing ID is
  verified. Meta developer setup is currently waiting for the owner's Facebook
  developer login. Meta limits this local-file route to Facebook Login for Business,
  which requires linking the Creator account to a Facebook Page but does not
  convert the Instagram account to Business. The alternative Instagram Login
  flow requires a public media URL; any temporary staging object must be removed
  after processing.
- Instagram has no durable private publishing draft, so the final creation call
  requires exact release approval.

### Rumble

- Direct human full-video upload only. Do not use browser automation, CDP, or a
  script against Rumble without Rumble's prior written permission.
- Preserve channel `7820170`.
- Rumble's [Terms](https://rumble.com/s/terms), last modified July 21, 2026,
  prohibit automated software access or interaction absent prior written
  permission. This applies to inspection and form preparation as well as
  checkbox attestation and submission.
- On August 8, 2026, an owner-authorized request for a supervised upload and
  submission workflow was sent from `drmexperienced@gmail.com` to
  `support@rumble.com`. Its status is `sent_pending_response` in
  `publishing/platforms.json`. Leave Rumble untouched until its written reply
  permits automation or identifies a supported VOD integration.
- The only permitted license is Option C, `Rumble Only (non-exclusive, similar
  to YouTube)` (`rumble_only_option_c`). Rumble's official [licensing
  explanation](https://rumble.support/help/a-simple-explanation-of-the-differences-between-licensing-options)
  describes it as non-exclusive. Never use Option A `Video Management` or Option
  B `Video Management (excluding YouTube)`; both are exclusive agency choices.
  `Personal Use` is not a permitted project release mode.
- Initial visibility must be Unlisted. Premium/exclusive placement must be off.
  YouTube, Vimeo, Facebook, and every other additional-syndication control must
  be off. The user manually verifies those values on every upload.
- Option C remains subject to the Terms' separate General License, including
  AI/ML training and third-party AI sublicensing provisions. The user explicitly
  accepted those provisions on August 8, 2026. The Terms' third-party-material
  requirements separately require a human review of all incorporated music,
  footage, graphics, and other assets; Terms acceptance is not rights clearance.
- Current blocker: the August 7 audit found 7/7 corrected uploads staged
  Unlisted with Option C, Vimeo/Facebook syndication off, hidden YouTube
  syndication on, and Premium unverified. The August 8 cache reset invalidated
  those forms. Each upload now requires direct-human restaging, all syndication
  off, Option C and Unlisted reverified, Premium off, asset-rights review, and
  the on-site rights and Terms controls. Record the resulting ID and URL without
  an automated signed-in readback.
- The August 5 revision-10 title/description readback remains historical
  evidence. Current Rumble description parity is false: existing Episode 7
  video `v7bvtu4` still needs the revision-11 description during its manual
  reupload. Track it in `publishing/episode-description-correction.json`. The
  existing episode 5 URL slug remains misleading and is preserved as historical
  identity evidence until its replacement is submitted.

## 10. Completed RSS.com Migration And Monitoring

`docs/rss-com-migration.md` records the completed migration evidence. RSS.com is
canonical, canonical copy is clean, and the legacy Anchor URL returns one direct
301 hop to the exact RSS.com feed. Continue with these post-cutover tasks:

1. Keep the old-host redirect and Spotify account active for at least 90 days.
2. Verify the canonical feed and redirect periodically while caches converge.
3. Six corrected Spotify video attachments remain public. Episode 5 preserves
   its existing identity and corrected RSS audio but is audio-only pending the
   staged Creator Support request. For future video episodes, retain the
   existing-episode attachment procedure; intentionally audio-only episodes need
   no direct Spotify upload.
4. Resolve Apple Support case `20000130526608` under the fail-closed gates in
   `publishing/apple-guid-repair.json`: request Apple server-side remapping
   first, confirm whether RSS.com can make an in-place GUID-only correction,
   and obtain Spotify confirmation that the two existing episode IDs and their
   attached videos will survive either proposed substitution. Do not change a
   live GUID until an exact one-episode canary is approved and its before-state
   and rollback path are captured.
5. Submit the canonical RSS.com feed to Amazon exactly once, complete ownership
   verification, and record the stable ID and public URL.
6. Monitor Podcast Index records `7982906` and `7799755` until the redirect crawl
   converges on the RSS.com record.

## 11. Apple Recovery Runbook

### Decision

Do **not** delete, reset, archive, or recreate public Apple show `1870433419`.
The existing listing is the identity to repair, even if Apple is not currently
being promoted or used. A new show would risk losing history and creating a
duplicate.

### Current Defect And Confirmed Crosswalk

- RSS.com has seven valid, unique GUIDs and playable enclosures.
- Apple publicly exposes Episodes 3-7 only.
- RSS Episodes 1-2 are active with valid audio, but Apple reports them as
  `DRAFTING` and `HIDDEN`; they remain missing publicly.
- No administrator block or manual Publish action is present for Episodes 1-2.
- The stale manual Episode 4 Draft and separate no-feed Draft show `1896845422`
  were archived on August 6, 2026. The active view now contains one show and
  seven episode records: five Available and the two RSS Drafts.
- Apple Support replied under case `20000130526608` that its two existing
  episode records use historical GUIDs that do not match the current RSS.com
  feed:

| Episode | Apple episode ID | Current feed GUID | Apple historical GUID |
|---|---|---|---|
| 1 | `1000746628307` | `c9b853b6-a828-4012-9998-217919ff9163` | `59063e08-e4a6-4e56-b7ec-d2a66d69beb8` |
| 2 | `1000746628422` | `1e40e02b-b217-477c-9cc3-4271cb304c23` | `26896da2-76cf-4865-93f8-f94ddfb24568` |

The earliest retained local Anchor snapshot is from August 5 and already has
the current feed GUIDs. It proves the migration baseline, not the GUIDs Apple
first ingested. Treat Apple's case evidence as the historical crosswalk and
`publishing/apple-guid-repair.json` as the incident authority.

### Support-Coordinated Repair

1. Leave `1870433419` Published and keep the RSS.com feed and Anchor redirect
   active.
2. Verify the RSS.com description, seven titles, structured episode numbers,
   seven unique current GUIDs, and working enclosures in the public feed. Save
   the XML, enclosure hashes, RSS.com episode IDs, Apple episode IDs, Spotify
   episode IDs, attached-video state, artwork, dates, and public URLs as the
   before-state.
3. Completed August 6, 2026: recorded Apple status, RSS URL, Last Refresh,
   analytics, public episode count, and the episode source/catalog states.
4. In Podcasts Connect, open existing `1870433419`. Confirm it uses
   `https://media.rss.com/dr-m-experienced/feed.xml`; update and save that field
   only if it differs.
5. Completed August 6, 2026: requested one Refresh Feed after duplicate cleanup.
   Do not submit the URL as a new show or request repeated refreshes.
6. Submitted August 8: asked Apple Support to remap its two existing episode
   records to the current feed GUIDs server-side while preserving Apple episode
   IDs `1000746628307` and `1000746628422`. The response is pending. This remains
   the preferred repair because it does not mutate the feed consumed by every
   directory.
7. Submitted August 8: asked RSS.com support/import engineering whether it can
   perform a GUID-only, in-place correction on existing RSS.com items `3050766`
   and `3050765` without deletion, recreation, unpublishing, new URLs, or changes
   to media, dates, copy, artwork, analytics, or any other identity field. The
   response is pending; the request did not authorize a change.
8. Submitted August 8: asked Spotify whether existing episode IDs
   `7cAdb8GE4khC9EYKAjmYuc` and `19Pct0ClX3j1EOwJ3ySVd7`, including their attached
   corrected videos and analytics, can be pinned across either proposed GUID
   substitution. The technical response is pending. A general propagation
   answer is insufficient; identity and video preservation must be explicit.
9. Keep the incident blocked until the title-to-episode mapping is independently
   verified, RSS.com capability and Spotify preservation are confirmed, an
   exact remote change is approved, and the complete before-state plus a
   provider-supported rollback path are captured in
   `publishing/apple-guid-repair.json`.
10. If a live feed mutation remains necessary after all gates pass, change only
    one attended episode as a canary. Re-fetch the feed, Apple show, and Spotify
    show; verify the same RSS.com, Apple, and Spotify episode IDs, enclosure,
    playback, artwork, copy, date, analytics where exposed, and attached Spotify
    video. Confirm no duplicate record exists before considering Episode 2.
11. Hold the second episode until the canary has survived the agreed directory
    ingestion window. If any ID changes, duplicate appears, video detaches,
    media fails, or metadata drifts, stop. Do not toggle the GUID repeatedly;
    use only the captured provider-supported rollback plan, otherwise freeze the
    feed and escalate with the before/after evidence.
12. Completed August 6, 2026: archived the inspected, redundant no-feed Draft show
   `1896845422` (internal `949adc0b-c62f-410c-962d-17563cf3b07a`) and stale
   manual subscriber Episode 4 Draft `1000759096366` (internal
   `fc3cdd48-13c5-4122-b464-b62376765410`).
13. After support acts, confirm the same Apple show ID exposes seven episodes and
   verify oldest/newest playback. Do not restore archived duplicates merely to
   change the count.

### Failure Branches

- Still five episodes while the repair is blocked: this is the current state.
  Continue the three-provider support sequence with the recorded crosswalk;
  do not resubmit, refresh repeatedly, mutate the feed, or create a replacement.
- Duplicate public episodes: stop and compare GUIDs and Draft records. Repair the
  existing listing without delete/recreate. If this follows a canary, block the
  second episode and use only the pre-approved provider-supported rollback plan.
- Show disappears: check Availability/status and restore the existing show; do
  not submit a new one.
- Feed URL is wrong: edit the RSS URL on the existing show to the exact RSS.com
  feed, save, refresh once, and verify the same show ID.

Official references are listed at the end of this manual.

## 12. Coordinated Episode Title Transition

The source and long-form video portions of this transition are complete.
Continue directory, Instagram, and artwork convergence without changing GUIDs
or remote content IDs.

1. Export a crosswalk containing episode number, GUID, current title, approved
   new title, and every remote content ID.
2. Use the seven approved titles in `publishing/episode-title-migration.json`.
3. Completed: structured episode numbers 1-7 are preserved in RSS.com.
4. Update publisher schema/tests to allow public titles without the prefix while
   retaining required `episodeNumber`.
5. Completed: the RSS.com public titles are exact without changing GUID,
   enclosure, publication date, or structured episode-number metadata.
6. Completed: production Supabase and checked-in recovery data use the catalog
   titles, current RSS.com audio URLs, YouTube IDs, and `Watch on YouTube`
   references; exact seven-row readback matches catalog revision 10.
7. Update direct video titles and descriptions on YouTube, Vimeo, and Rumble.
   Completed on August 5, 2026: YouTube and Vimeo public readback and Rumble's
   authenticated post-save readback match the catalog. Existing video IDs, URLs,
   visibility, licensing, and monetization settings were preserved. This is
   revision-10 historical evidence; the revision-11 Episode 7 correction is
   current on YouTube and Vimeo and pending manual Rumble reupload, as recorded
   in `publishing/episode-description-correction.json`.
8. Update Instagram captions only where the old numbered title is presented as
   the primary title; do not erase engagement history merely for cosmetic copy.
9. Completed on August 5, 2026: replace all seven existing thumbnails on
   YouTube, Vimeo, Rumble, and Spotify video; upload all seven square episode-art
   images to Spotify; verify seven unique item images in the canonical RSS; and
   request one refresh on existing Apple show `1870433419`. Preserve existing
   Instagram posts because their covers cannot be replaced through the
   documented post-publication workflow.
10. Completed for routing: Apple show `1870433419` points directly to RSS.com.
    Pending: repair its Draft/Available and structured-cache discrepancy, submit
    the feed once to Amazon, and verify Apple/Amazon propagation. Spotify audio
    reaches all seven stable episode IDs; video is present on six, with Episode 5
    audio-only pending Creator Support.
11. Run a cross-platform audit and keep the crosswalk as evidence.

Do not try to make the internet change atomically. Make the source changes in a
controlled window, preserve identity, and verify convergence platform by
platform.

## 13. Visual Identity And Media Package

`publishing/brand/media-design-guide.md` is the authoritative visual standard
for palette, typography, logo use, photography, layout, accessibility, motion,
and export specifications. This section is the operational summary and current
rollout state.

Use one visual system with purpose-built compositions. Do not build a website
splash gate or one universal splash image.

The authoritative visual and verbal standard is
`publishing/brand/media-design-guide.md`. The current show-level review package
is `publishing/brand/show-package/1.0.0-rc1/`.

### Required Asset Family

| Asset | Master/output | Use |
|---|---|---|
| Master logo | Vector plus transparent PNG | Wordmark, stacked lockup, standalone mark |
| Social avatar | 1200 x 1200 master | Standalone identity mark, circle-safe |
| Podcast show cover | 3000 x 3000 JPG, RGB | RSS.com, Spotify, Apple, Amazon |
| Long-video thumbnail | 3840 x 2160 master; 1920 x 1080 derivative | YouTube, Vimeo, Rumble, website |
| Reel cover | 1080 x 1920 master with center-safe focal area | Instagram |
| Website share image | 1200 x 630 | Open Graph/social links |
| YouTube banner | 2560 x 1440 with center-safe copy | Channel branding |
| Long-video sting | 0.75-1.5 seconds | After the cold open only |
| Long-video end screen | 5-8 seconds | Subscribe/next episode slots |
| Vertical close | 0-1 second | Optional; no Reel intro slate |

### Direction

- Use `DR. M EXPERIENCED,` prominently and `with Dr. David Musnick` as the host
  line. Retire `DRM`, which reads as an unrelated acronym.
- Use portraits only when Dr. Musnick is the subject, such as the homepage host
  section or press biography. Do not make his face the show identity.
- The Cutline `M`/mountain-path mark is the production candidate, but remains
  unapproved until the owner approves its exact package hashes.
- Use Midnight `#0A0F1A`, Signal Cyan `#22D3EE`, Warm Amber `#F59E0B`, Cloud
  `#F1F5F9`, and the documented supporting slate values.
- Thumbnail copy should be four to seven words focused on the topic/outcome, not
  the full show name. Keep the small episode number only as an index if desired.
- Start long-form videos with the useful hook, then a very short sting. Reels
  begin with content, not a splash screen.

### Current Gaps

- Live podcast art still uses the retired `DRM EXPERIENCED` design. The
  portrait-free `1.0.0-rc1` replacement is hash-verified but not owner-approved.
- YouTube still uses a generic `D`; Vimeo/Instagram use the sketch; Rumble lacks
  a verified channel image. The candidate avatar/banner package is local only.
- Completed for episode artwork: YouTube, Vimeo, Spotify video, Spotify episode
  art, and the canonical RSS all use the seven approved topic images. Rumble's
  exact files remain verified locally but unsubmitted. Apple now points directly
  to RSS.com, but its episode art and five-to-seven episode convergence remain
  to be verified. Existing Instagram Reel covers remain unchanged.
- Website header/footer use a mountain emoji while favicon SVGs use a different
  mountain treatment.
- The website has no deployed default Open Graph image; the package now contains
  a 1200 x 630 candidate.
- Completed for the website: all seven episodes use checked-in 1600 x 900 WebP
  artwork registered in the master catalog, fallback data, and Supabase
  projection. Production Supabase matches catalog revision 10 for all seven
  current RSS audio URLs, YouTube IDs, and `Watch on YouTube` references.
  The catalog-owned URLs prevent platform sync from restoring remote Vimeo
  fallback art.

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
npm run test:production-env
npm run test:publisher
npm audit --audit-level=high
npm run verify:catalog
npm run test:database-security
npx --yes deno@2.9.2 check --config supabase/functions/deno.json \
  --lock supabase/functions/deno.lock supabase/functions/form-submit/index.ts
npx --yes deno@2.9.2 lint --config supabase/functions/deno.json \
  supabase/functions/form-submit src/lib/analytics-privacy.ts \
  src/lib/analytics-privacy_test.ts src/lib/posthog-runtime.ts \
  src/lib/posthog-runtime_test.ts
npx --yes deno@2.9.2 test --config supabase/functions/deno.json \
  --lock supabase/functions/deno.lock supabase/functions/form-submit \
  src/lib/analytics-privacy_test.ts src/lib/posthog-runtime_test.ts
CONTENT_CATALOG_STRICT=true npm run build
```

For rev2 review, also run the responsive QA matrix in
`docs/mobile-ux-and-analytics-study.md`. Check the critical journeys in light and
dark themes, with reduced motion, keyboard-only navigation, 200% zoom, and the
document-overflow and 44-pixel target assertions recorded there.

Production catalog checks need ignored local Supabase read credentials or the
configured GitHub Actions secrets. Never expose a service-role key to the browser
or a `NEXT_PUBLIC_*` variable.

### PostHog Production Verification

The site sends privacy-sanitized `$pageview` events from its route tracker and
explicitly enables `$pageleave`; autocapture, session recording, persistent
identity, person profiles, and query-string collection remain disabled. The
non-pull-request deployment runs `npm run verify:production-env` and fails before
the production build when both `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and legacy
`NEXT_PUBLIC_POSTHOG_API_KEY` are absent or blank. Local and pull-request builds
may remain keyless.

The approved low-cardinality conversion events are `newsletter subscribed`,
`contact form submitted`, and `episode player opened`. Form events are emitted
only after the backend accepts the submission. `episode player opened` means the
visitor activated the poster and the lazy Vimeo iframe was requested; it is not
evidence that video playback started. Event properties must remain within the
privacy contract in `POSTHOG_SETUP.md` and the event plan in
`docs/mobile-ux-and-analytics-study.md`.

The authenticated Installation Health check on August 6, 2026 initially
reported no events, an incomplete `$pageview` check, and no authorized URLs.
The Actions project key was then configured and the apex plus `www` origins were
authorized. Authenticated readback on August 7 confirmed the US project region
and enabled `Discard client IP data`; cookieless server hash mode stays disabled
because the client already uses memory-only identity. The deployed production
probe sent a POST to `https://us.i.posthog.com/e/` and received HTTP 200. The
refreshed Installation Health view now passes Event tracking 3/3: `$pageview`,
`$pageleave`, and scroll depth. Authorized URLs also pass. Reverse proxy remains
the only explicit configuration recommendation and is not configured. Production
ingestion is verified. Authenticated readback also confirms dashboard `1086989`
is named `Dr. M Growth Dashboard`, has its privacy-safe description, and contains
DAU, WAU, growth accounting, retention, referring-domain, and pageview-funnel
tiles.

1. Confirm the Actions secret still exists without displaying its value.
2. Confirm `https://drmexperienced.com` and `https://www.drmexperienced.com`
   remain authorized in the PostHog project.
3. Confirm a current production probe still returns HTTP 200 from the US
   ingestion host and Installation Health remains green for all three events.
4. Confirm the IP-discard setting remains enabled.
5. Decide separately whether to implement the reverse proxy; do not mark it
   configured until its production path is deployed and verified.
6. Confirm dashboard `1086989` retains its six verified tiles and privacy-safe
   description after future analytics changes.

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

### RSS.com Feed Or Import State Changes

- Do not switch back to Anchor. Freeze publication, snapshot both
  endpoints, and verify the RSS.com feed, redirect chain, exact GUID set,
  enclosures, metadata, artwork, and oldest/newest playback.
- Record the incident and evidence in `publishing/hosting-migration.json` before
  changing any directory setting.

### Apple Missing Or Duplicate Episodes

- Preserve public show ID `1870433419`, the existing Apple and Spotify episode
  IDs, and the current feed GUIDs while the incident is blocked.
- Verify the clean RSS.com feed and exact RSS URL. One refresh has already been
  requested for the current incident; do not repeat it.
- Compare feed GUIDs before touching Draft records.
- The known duplicate show and manual Episode 4 Draft are already archived.
  Apple case `20000130526608` confirms a historical GUID mismatch for Episodes
  1-2. Follow `publishing/apple-guid-repair.json`: request an Apple-side remap,
  confirm RSS.com in-place capability and Spotify ID/video preservation, then
  require a captured baseline, rollback path, exact approval, and one attended
  canary before any live mutation. Do not submit a new show, delete/recreate an
  episode, or change both GUIDs at once.

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

- During an attended automation run, use `drm-browser reauth <platform>` so the
  bridge stops while the same isolated browser process and saved keychain remain
  available. For initial multi-account setup, use `drm-browser login` instead.
- The user completes password, MFA, CAPTCHA, agreements, and identity checks.
- After the authenticated dashboard is visible, connect to that platform; do
  not restart the browser merely to restore the automation bridge. For Rumble,
  do not reconnect the bridge; the user continues manually in the open tab.
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
- If `verify:production-env` fails, add or repair either the preferred
  `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` Actions secret or the legacy
  `NEXT_PUBLIC_POSTHOG_API_KEY`; do not bypass the guard or place the token in
  git.
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

These are fail-closed bootstrap defaults for a replacement host, not the current
live Otto-host state.

1. Install Ubuntu/user tooling and clone this repository.
2. Read `AGENTS.md`, this manual, and both publishing JSON files.
3. Install Node, ffmpeg/ffprobe, Chrome, GitHub CLI, Deno, and local wrappers.
4. Recreate owner-only publisher config/state directories; do not copy browser
   cookies. Restore only approved non-secret evidence and reauthorize accounts.
5. Run publisher tests, doctor, feed preflight, site checks, and a draft/private
   browser smoke test.
6. Verify every stable ID before enabling uploads.
7. From a clean reviewed commit, run `ops/install-publisher-host.sh` without
   `--enable`. Verify the commit-addressed release, pinned build SHA, Node 22,
   mode-0600 control database, and both replacement-host timers
   disabled/inactive by default.
8. Leave `automation-control.json` absent or explicitly paused until asset
   staging, atomic enqueue, tracked gates, local allowlist, write intent,
   checkpoints, reconciliation, stale-lock recovery, and one controlled release
   are proven. Then enable only the reviewed platform set.

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

- verify the canonical RSS.com title, description, item count, GUIDs, and
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

1. Completed: imported seven episodes to RSS.com, verified parity with the
   retained August 5 source baseline and canonical copy, retained that baseline's
   GUIDs, and activated the approved one-hop Anchor 301.
2. Resolve Apple case `20000130526608` for RSS Episodes 1-2 in existing show
   `1870433419` under `publishing/apple-guid-repair.json`. The Apple remap,
   RSS.com in-place-capability, and Spotify identity/video-preservation requests
   are submitted and pending. Keep remote changes blocked until the responses,
   baseline, supported rollback, exact approval, and one-episode attended canary
   gates pass.
3. Completed August 7: seven corrected video/MP3 delivery pairs passed the local
   gates, and all seven existing RSS.com enclosures were replaced with normalized
   audio while preserving GUIDs. Remote downloads, full decodes, and loudness
   gates passed for 7/7.
4. Historical August 7 baseline: corrected video was attached to all seven
   existing Spotify episode IDs with approved art/copy. Current August 22 state:
   six video attachments remain; Episode 5 preserves its identity and corrected
   RSS audio but is audio-only pending the staged Creator Support request.
5. Submit the canonical RSS.com feed once to Amazon and record its stable
   ID/URL.
6. Reconcile Instagram captions that use old numbered titles and apply approved
   covers to future Reels; preserve existing posts and engagement. The website,
   affiliate, and contact profile links are now live. The RSS.com,
   website, YouTube, Vimeo, and Spotify episode-art batch is complete. Rumble
   remains excluded until its permission and human-rights-review gates are
   resolved.
7. Review and approve or revise Show Brand Package `1.0.0-rc1`, then perform a
   separately authorized coordinated rollout of its logo, cover, avatar,
   banner, OG, sting, and end-screen system. Website and direct-platform episode
   art is complete.
8. Completed for episode art: master-catalog ownership prevents website sync
   scripts from overwriting approved custom thumbnails, and the rollout receipt
   records every direct-platform ID and RSS artwork URL.
9. Separate affiliate-page workstream: redesign it as a compact, mobile-first
   product directory with useful links visible above the fold; replace generic
   company links with verified direct links to the products Dr. David Musnick
   specifically recommends, retain clear affiliate disclosures, and use the
   Supabase affiliate relationships to show each product on relevant episode
   pages. Validate mobile tap targets and every outbound product URL before
   release. This is a separate workstream from the completed episode-thumbnail
   rollout.
10. Complete the one-time YouTube OAuth grant as the production channel owner
    and the applicable audit for public/unlisted API uploads. Vimeo app `540274`,
    account `253415660`, token, and quota are complete. For Instagram, have the
    owner complete Facebook developer login and confirm the linked Page,
    publishing ID, permissions, and token before Meta adapter work.
11. Completed in the worktree: immutable review/release authorization,
    content-addressed private staging, atomic deterministic operation graphs,
    tracked global/per-platform gates and policy revisions, mode-0600 local host
    control, provider write intent/checkpoints, exact-resource reconciliation,
    Vimeo/YouTube/RSS.com adapters, stale receipt-lock recovery, authenticated
    readback, automatic lifecycle receipts, and clean-commit pinned Node 22 host
    deployment. At the August 22 pre-reconciliation snapshot, the installed
    publisher pointed to immutable build `84f606ca8d899d1c8ac9a6890ecbb073cfd11b8f`;
    read `current/release.json` for the authoritative installed commit. The intake timer is enabled and
    active, the controller timer is disabled and inactive, generation 1 host
    control is running for Vimeo only, and the queue is empty. The last intake
    run succeeded with no ready delivery.
    RSS.com automation still needs Max/API-key access, and YouTube still needs
    owner OAuth plus the applicable audit; activation itself created no release.
12. Version and test workstation-wrapper installation/recovery.
13. Build a small authenticated Supabase editorial/import tool after the release
    workflow is stable.
14. Completed locally: configure the project-scoped Dropbox root, organize 21
    approved episode-art derivatives, bind all seven corrected full-video and
    podcast-audio assets after full-file validation, and register Episode 5's
    separately validated Spotify derivative. RSS.com normalized audio,
    YouTube's normalized-video cutover, and Vimeo's in-place replacements are
    complete. Six Spotify video attachments remain; Episode 5 is audio-only
    pending the staged Creator Support request. Rumble is excluded from the
    current release target set.

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
- RSS.com replace episode audio: <https://help.rss.com/en/support/solutions/articles/44002246497>
- RSS.com API access and Max requirement: <https://help.rss.com/en/support/solutions/articles/44002648949-api-access>
- Spotify redirect: <https://support.spotify.com/us/creators/article/switching-away-from-spotify-for-creators-with-a-301-redirect/>
- Spotify video for externally hosted shows: <https://support.spotify.com/us/creators/article/video-episodes-for-shows-not-hosted-with-spotify/>
- Spotify video specifications: <https://support.spotify.com/us/creators/article/video-specs/>
- Amazon RSS submission: <https://podcasters.amazon.com/submit-rss>
- YouTube upload API: <https://developers.google.com/youtube/v3/docs/videos/insert>
- YouTube API compliance audits: <https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits>
- YouTube channel-permission API limitation: <https://support.google.com/youtube/answer/9367690>
- YouTube channel branding: <https://support.google.com/youtube/answer/10456525>
- YouTube video thumbnails: <https://support.google.com/youtube/answer/72431>
- Instagram publishing: <https://developers.facebook.com/documentation/instagram-platform/content-publishing>
- Instagram Reel covers: <https://www.facebook.com/help/instagram/1038071743007909>
- Vimeo upload API: <https://developer.vimeo.com/api/upload/videos>
- Vimeo video thumbnails: <https://help.vimeo.com/hc/en-us/articles/12426471350289-How-to-change-the-thumbnail-image-for-my-video>
- Vimeo video versions: <https://help.vimeo.com/hc/en-us/articles/12426058338961-How-to-manage-video-versions-and-access-history>
- YouTube replace/delete limits: <https://support.google.com/youtube/answer/55770>
- Rumble upload/edit: <https://rumble.support/help/upload-and-edit-content>
- Rumble video thumbnails: <https://rumble.support/help/changing-a-thumbnail>
- Rumble licensing choices: <https://rumble.support/help/a-simple-explanation-of-the-differences-between-licensing-options>
- Rumble licensing comparison: <https://rumble.com/s/licensing-comparison.html>
- Rumble Terms, last modified July 21, 2026: <https://rumble.com/s/terms>
- Spotify video thumbnails: <https://support.spotify.com/us/creators/article/thumbnails/>
- Spotify episode cover art: <https://support.spotify.com/us/creators/article/uploading-cover-art/>

## 19. Change Log

- August 8, 2026: implemented the guarded workstation publishing control plane:
  separate immutable review/release authorization, content-addressed private
  staging, atomic deterministic node:sqlite operation graphs, tracked global and
  per-platform policy gates, mode-0600 local host control, provider write
  intent/checkpoints, exact-resource reconciliation, stale receipt-lock
  recovery, Vimeo/YouTube/RSS.com adapters, authenticated readback, and automatic
  lifecycle receipts. RSS.com checkpoints upload sessions and episode identity
  and blocks a second create POST after an ambiguous response. Added clean-commit
  Git-SHA deployment pinned to Node 22. Verified Vimeo app
  `540274`, account `253415660`, token, and quota; configured Google project
  `dr-m-experienced-publisher` and its desktop OAuth client; and bound RSS.com
  podcast `397420`. Later the same day, installed immutable build
  `69f059ce22267f02dc5918492b10066ff9ad704c`, enabled both publisher timers, and
  verified them active. Machine control generation 1 runs Vimeo-only, the queue
  is empty, and intake completed successfully with no ready delivery. The user
  accepted Vimeo's Developer Addendum and Terms for app `540274` and approved
  Google Cloud terms. YouTube owner OAuth/audit and RSS.com Max/API key remain
  separate closed gates; host activation queued and published nothing.
- August 8, 2026: verified production PostHog ingestion with an HTTP 200 response
  from `https://us.i.posthog.com/e/`. Refreshed Installation Health passes
  `$pageview`, `$pageleave`, scroll depth, and authorized URLs. Reverse proxy is
  still only a recommendation and is not configured. Renamed dashboard `1086989`
  to `Dr. M Growth Dashboard`, added its privacy-safe description, and verified
  its DAU, WAU, growth accounting, retention, referring-domain, and pageview-
  funnel tiles.
- August 8, 2026: deployed the corrected Episode 7 website page through merge
  `a291990` and recorded public/mobile verification in merge `0934f3a`. The page
  returned HTTP 200 with current copy, prior duplicate copy absent, and no
  horizontal overflow at 320 or 390 pixels.
- August 8, 2026: added the initial hash-bound immutable per-job release-receipt
  ledger with `receipt`, `receipts`, and receipt-aware `status` commands. The
  later control-plane entry above records its adapter integration.
- August 8, 2026: verified all three Instagram-mapped shorts on Vimeo as
  `1216695521`, `1216695522`, and `1204939542` with canonical metadata and
  posters. Deployed their three website routes and verified HTTP 200, sitemap
  inclusion, checked-in posters, exact Vimeo playback IDs, and no horizontal
  overflow at 320, 390, or 1440 pixels. Prepared the private Vimeo API app that
  was later authenticated as recorded above, and recorded that Instagram link
  editing requires mobile while Meta setup awaits Facebook developer login.
- August 8, 2026: submitted support follow-ups to Apple, RSS.com, and Spotify for
  the Episodes 1-2 GUID incident. All three responses remain pending and no live
  GUID was changed or authorized for change.
- August 7, 2026: audited all seven staged Rumble replacements. Each is
  Unlisted and uses non-exclusive Option C, with Vimeo/Facebook syndication off,
  but the hidden YouTube syndication switch is on for all seven. Premium state
  was not verified and remains an open manual gate.
  No upload was submitted. Recorded a manual-only, fail-closed policy because
  the July 21 Terms prohibit automated software interaction without prior
  written permission and include General License AI/ML and third-party AI
  sublicensing provisions. At that audit, human third-party asset review and
  specific Terms acknowledgment remained open; no acknowledgment was inferred.
- August 8, 2026: the user explicitly accepted the Rumble Terms last modified
  July 21, including the General License AI/ML training and third-party AI
  sublicensing provision, for the exact seven corrected videos. This did not
  clear third-party asset rights or provide Rumble's written automation
  permission. The browser cache reset invalidated the staged forms; all seven
  source videos and thumbnails remain hash-verified locally.
- August 8, 2026: sent Rumble Support the owner-authorized written-permission
  request for local, supervised upload automation. The request covers exact
  preapproved files and metadata, non-exclusive Option C, Unlisted visibility,
  Premium off, all syndication off, owner-confirmed rights and Terms, and an
  audit trail. Rumble remains untouched while the response is pending.
- August 7, 2026: Apple Support case `20000130526608` confirmed that the
  existing Apple records for Episodes 1-2 use historical GUIDs different from
  the current feed. Recorded the exact Apple episode ID/current GUID/historical
  GUID crosswalk in `publishing/apple-guid-repair.json` and blocked live changes
  pending Apple-side remap review, RSS.com in-place capability, Spotify
  episode-ID/video preservation, a captured baseline and rollback path, exact
  approval, and a one-episode attended canary.
- August 7, 2026: completed all seven normalized RSS.com audio replacements with
  the August 5 captured feed GUIDs unchanged and 7/7 remote download,
  full-decode, and loudness
  gates passed. At that time, corrected video was attached to all seven existing
  Spotify episode IDs. On August 22, Episode 5's RSS enclosure was corrected in
  place while its GUID and downstream IDs were preserved; Spotify Episode 5 is
  now audio-only pending support, while the other six video attachments remain.
  Replaced all seven Vimeo videos in place on their stable IDs. Staged seven
  corrected Rumble uploads Unlisted without submitting them. The later release
  audit above identified the hidden YouTube-syndication blocker and the remaining
  human-only rights/Terms gates.
- August 7, 2026: applied the guarded RSS-audio and YouTube-destination SQL files
  in production Supabase after verifying each exact file hash. Seven-row readback
  matches catalog revision 10 for all current RSS audio URLs, YouTube IDs, and
  `Watch on YouTube` references.
- August 7, 2026: completed the seven-video YouTube normalized-media cutover.
  The replacement IDs are public with exact catalog titles/descriptions and
  approved thumbnails. The previous IDs remain Unlisted, directly playable,
  absent from the public channel feed, and linked to the replacements; no video
  was deleted. Catalog revision 10 records both the active IDs and rollback
  archives, and the website/Supabase projections now target the replacements.
- August 6, 2026: registered the validated Episode 5 Spotify derivative as
  `episode-005-spotify-video` in catalog revision 8. Its immutable receipt,
  binary/evidence hashes, H.264 High 1080p60 profile, 3.92 Mbps muxed bitrate,
  `-16.08` LUFS audio, `-1.35` dBTP peak, CFR/GOP checks, and edit-list absence
  passed independently. No upload was authorized or performed.
- August 6, 2026: submitted the Apple reprocessing request for RSS Episodes 1-2.
  Confirmed the duplicate show and manual Episode 4 Draft remain archived.
  Audited all seven canonical audio files at `-30.99` to `-28.42` LUFS and opened
  a protected replacement workstream. Confirmed all seven Spotify episodes are
  currently audio-only, recorded per-episode video restoration, detected the
  RSS.com landing-page cache token, and queued a retry for the GitHub Pages 404.
- August 6, 2026: completed the RSS.com host cutover. Canonical copy and season
  metadata are clean; the legacy Anchor feed returns one direct 301 to RSS.com.
  Configured existing Apple show `1870433419` directly to RSS.com with exact
  token-free metadata. Archived the redundant Draft show `1896845422` and stale
  manual Episode 4 Draft, then requested one feed refresh. Apple still exposes
  five episodes; RSS Episodes 1-2 remain `DRAFTING`/`HIDDEN` without a manual
  Publish action, so support escalation is required.
  Production Supabase passed the exact seven-row RSS.com audio migration and
  catalog readback. Amazon's one-time claim and post-cutover Spotify video
  verification remain pending.
- August 6, 2026: RSS.com confirmed the supported seven-episode import. Exact
  GUID, metadata, byte-identical audio/artwork, byte-range, and full oldest/newest
  decode checks passed before the later redirect.
- August 5, 2026: established `publishing/brand/media-design-guide.md` as the
  cross-channel visual authority, restored the original deep-slate, vivid-cyan,
  and warm-amber system as the brand core, documented production and
  accessibility rules, and kept unfinished logo and portrait assets behind an
  explicit approval gate.
- August 5, 2026: documented the mobile UX QA baseline and privacy-minimized
  analytics event contract, including backend-accepted form conversions and the
  conservative `episode player opened` interaction that does not claim playback.
- August 5, 2026: published seven approved topic thumbnails to YouTube, Vimeo,
  Rumble, Spotify video, and Spotify episode art; verified seven unique square
  images in the canonical RSS; requested one Apple feed refresh; and recorded
  the separate compact, mobile-first affiliate product-directory workstream.
- August 5, 2026: temporarily parked RSS.com and made Spotify/Anchor canonical,
  approved removal of `RSSVERIFY` and the seven-title batch, and changed
  Apple/Amazon procedures to preserve the existing listings.
- August 5, 2026: owner reconfirmed the RSS.com migration; corrected the empty
  show's name/description and submitted a fresh supported self-service import.
  At that time, Anchor was to remain canonical and Amazon empty until the
  import/cutover gates passed.
- August 5, 2026: created the ecosystem manual; recorded current migration,
  account, Apple recovery, direct-management, browser/keyring, title-transition,
  visual-system, website, and incident procedures; corrected private migration
  evidence ownership and permissions.
