# New Episode Publishing Process

Last verified: 2026-08-22

Use this checklist from the final editor export through public website
verification. The intended steady-state handoff is one sealed Dropbox delivery,
one immutable review packet, and one explicit, expiring release authorization.
Preparing, reviewing, approving, or dispatching a job does not contact a remote
platform.

RSS.com is the canonical podcast-audio host. Spotify, Apple Podcasts, and, after
its one-time claim, Amazon Music/Audible receive audio from that feed. Vimeo,
YouTube, and RSS.com have official controller adapters. Spotify video remains an
attended replacement on the RSS-created episode, and Instagram automation is
not implemented yet. Rumble is optional, human-only, and excluded from the
intake service and automated controller.

If `publishing/hosting-migration.json` has
`gates.publishingFreezeActive: true`, stop. Do not publish until the migration
gate is cleared. The August 22 pre-reconciliation readback showed immutable publisher build
`84f606ca8d899d1c8ac9a6890ecbb073cfd11b8f`: the offline Dropbox-intake timer is
enabled and active, the controller timer is disabled and inactive, machine
control generation 1 is `running` with only `vimeo` allowlisted, and the queue
is empty. Intake completed successfully with no ready deliveries. This state did
not create a job or authorize a release.

## 1. Register The Final Episode

`publishing/master-catalog.json` is the authority for shared show and episode
identity, copy, content flags, logical asset references, RSS identity, and
verified remote IDs and URLs. Supabase owns website-only editorial content; a
private episode manifest owns release decisions. Neither replaces the catalog.

1. Confirm the next immutable, contiguous episode number.
2. Put the finished binaries under the synced Dr. M project folder, not in git.
3. Add project-relative asset entries such as
   `dropbox:episodes/008-topic/master-video.mp4` to `assetRegistry`, and connect
   them from the episode's `assetRefs`.
4. Add the approved unnumbered title, slug, descriptions, website summary,
   content flags, aliases, and known stable identities. Start a new episode with
   `publicationState: "draft"`. Leave unknown values null; never invent a GUID,
   destination ID, URL, or publication timestamp.
5. Fully download every selected asset. Record its measured `sha256` and
   `sizeBytes`, then set its catalog status to `verified`. A Dropbox placeholder
   or matching filename is not verification.
6. Increment the catalog revision, update `updatedAt`, and run:

```bash
drm-publish doctor
npm run test:publisher
```

The private source map at `~/.config/drm-publisher/sources.json` must point only
to the Dr. M project folder:

```json
{
  "schemaVersion": 1,
  "roots": {
    "dropbox": "/home/otto/Dropbox/Dr M Experienced"
  }
}
```

Do not map the whole personal Dropbox or commit the machine-specific path.

## 2. Seal The Offline Dropbox Delivery

Follow [Dropbox Delivery Intake](dropbox-delivery-intake.md). Create one
permanent delivery directory under:

`/home/otto/Dropbox/Dr M Experienced/publisher-inbox`

The bundle contains `episode.json`, every declared asset, `delivery.json`, and a
`READY` marker written last. The manifest is based on
`publishing/episode.example.json` and must match the catalog for all catalog-owned
values. It also records the exact selected targets, each direct target's release
choices, and the episode-level audience and disclosure choices.

Seal the bundle as the `otto` user:

```bash
cd /home/otto/DR-M-Experienced-ops
/home/otto/.nvm/versions/node/v22.22.0/bin/node \
  scripts/publish/dropbox-intake.mjs seal \
  "/home/otto/Dropbox/Dr M Experienced/publisher-inbox/<delivery-id>" \
  --delivery-id <delivery-id>
```

Validate it without creating a job:

```bash
/home/otto/.nvm/versions/node/v22.22.0/bin/node \
  scripts/publish/dropbox-intake.mjs scan --validate-only
```

The scanner has no network access. It validates and rehashes the bundle, then
creates only a prepared review packet. It cannot approve, authorize, dispatch,
upload, schedule, or publish. A binary or metadata change requires a new
delivery ID and directory; never replace bytes in a sealed delivery.

Rumble must not appear in an intake bundle. If the owner separately chooses a
Rumble release, prepare its exact media and copy outside this automated path and
follow the current human-only procedure in `docs/operations-manual.md`.

## 3. Prepare And Review The Immutable Packet

The offline intake returns the existing job ID after `status=prepared`. For a
manual local preparation, run `drm-publish prepare` directly:

```bash
drm-publish doctor
drm-publish prepare /absolute/path/to/episode.json
drm-publish show <job-id>
```

Review the generated `approval.md` for:

- exact title, descriptions, tags, and platform-specific copy
- episode number, slug, catalog revision, and catalog episode hash
- exact media paths, byte counts, and SHA-256 values
- target accounts, channel IDs, and routing modes
- release time, initial/final visibility, license, monetization, notifications,
  audience, and disclosures
- every warning and platform readiness result

If any value changes, prepare a new packet. Do not edit generated job files or
correct only a remote dashboard. With the source map configured, `prepare`
verifies each supplied binary against its registered logical asset and measured
fingerprint.

For podcast audio, select `rss.com` and provide `assets.podcastAudio` plus the
exact `releasePlan["rss.com"]`. Apple and Amazon are RSS fan-out, not direct
audio uploads. Selecting Apple or Amazon requires `rss.com` in the reviewed
manifest, but neither receives a direct controller operation.

## 4. Record Review, Then Release Authorization

The first record is a review attestation only:

```bash
drm-publish approve <job-id> \
  --hash <approval-hash> \
  --by "<reviewer>" \
  --confirm "approve <job-id> <approval-hash>"
```

This command rechecks the assets and unresolved release controls. Its immutable
`approval.json` explicitly authorizes neither upload nor release.

After the owner reviews the unchanged packet and approves the exact remote side
effects, create a separate, expiring authorization. List only direct targets
that this controller will execute: `rss.com`, `youtube`, and/or `vimeo`.

```bash
drm-publish authorize <job-id> \
  --hash <approval-hash> \
  --by "<authorizer>" \
  --targets "vimeo" \
  --expires-at "<RFC3339 timestamp with timezone>" \
  --confirm "authorize-release <job-id> <approval-hash> vimeo"
```

Use the exact same target order in `--targets` and `--confirm`. Authorization is
bound to the review hash, assets, copy, release choices, schedule, and target
routing. It defaults to one hour if `--expires-at` is omitted and may not exceed
24 hours. Prefer an explicit expiry close to the approved release window.

Do not include Spotify, Apple, Amazon, Instagram, or Rumble in an authorization
that will be passed to `dispatch`; the controller rejects unsupported targets.
An attended Spotify or Instagram action needs a separately scoped prepared job
and release authorization if its authorization must be preserved in this
ledger. The dashboard action itself remains attended until an official adapter
is implemented and enabled.

## 5. Dispatch Atomically

Queue the exact authorized direct target set:

```bash
drm-publish dispatch <job-id>
drm-publish queue <job-id>
drm-publish status <job-id>
```

`dispatch` performs no remote I/O. It validates the immutable authorization and
adds deterministic operations to the private SQLite control database in one
transaction. A missing dependency, create-slot conflict, or operation-ID
collision rolls back the whole dispatch instead of leaving a partial target
set. Repeating the exact dispatch returns the existing operations.

The control database is
`~/.local/state/drm-publisher/control/publisher.sqlite3` with owner-only mode
`0600`. Do not edit or delete it to clear an error.

## 6. Open The Exact Machine Gate

Before allowing a controller pass, confirm all four layers are open for each
queued platform:

1. The release authorization is valid and unexpired.
2. `publishing/platforms.json` has the global gate and the platform's exact
   `apiAutomation.enabled` policy revision open.
3. The platform credential, account-identity preflight, and provider-specific
   prerequisites pass.
4. The owner-only machine control permits only the intended platform list.

Current direct-adapter boundaries are:

| Platform | Controller status |
| --- | --- |
| Vimeo | Adapter and credential/account gates are ready; the user accepted Vimeo's Developer Addendum and Terms for app `540274` on August 8, 2026. |
| YouTube | The user approved Google Cloud terms on August 8, 2026, but the separate channel-owner OAuth token and applicable public/unlisted upload compliance gate are still closed. |
| RSS.com | Adapter exists, but API use requires Max entitlement and a private v4 API key; the free plan remains an attended dashboard path. |

Inspect the host without changing it:

```bash
drm-publish host status
```

The current expected machine-control readback is generation 1, mode `running`,
and `allowedPlatforms: ["vimeo"]`. The controller timer itself is disabled and
inactive. If it is later enabled for an exact approved release, it can process a
due Vimeo operation only after that job is dispatched and every other gate
passes. Do not rerun `host run` when machine control is already correct.

Use these commands only for an intentional control change or attended
diagnostic:

```bash
# Immediate local kill switch.
drm-publish host pause \
  --confirm "pause-publisher"

# Restore only the reviewed, tracked-open platform set.
drm-publish host run \
  --platforms "vimeo" \
  --confirm "run-publisher vimeo"

# Optional attended pass; an enabled timer invokes the same guard path.
drm-publish controller --once
```

The machine control at
`~/.local/state/drm-publisher/automation-control.json` must be an owner-owned,
non-symlink regular file with mode `0600`. Missing, invalid, insecure, paused, or
non-allowlisted state fails closed. The controller reloads it immediately before
every provider mutation. Rumble cannot be allowlisted.

Use only the clean, commit-pinned deployment installed by
`ops/install-publisher-host.sh`. The August 22 pre-reconciliation snapshot was
immutable build `84f606ca8d899d1c8ac9a6890ecbb073cfd11b8f`; read
`current/release.json` for the authoritative installed commit. Intake is enabled
and active, while the controller is disabled and inactive. The installer defaults
to leaving timers disabled unless `--enable` is supplied. Do not toggle service
enablement as part of ordinary episode staging or release preparation.

## 7. Verify Direct Adapter Results

For every mutating provider step, the controller first records write intent and
the pinned build SHA. Each adapter stages the exact approved bytes in the private
content-addressed asset store, rechecks their hash and size, rejects symlinks or
source mutation, and checkpoints returned provider sessions and identities.

After provider acceptance and authenticated readback, adapters automatically
append `accepted`, `published`, and `verified` receipts. Inspect both the queue
and immutable receipt ledger:

```bash
drm-publish queue <job-id>
drm-publish receipts <job-id>
drm-publish status <job-id>
```

Platform-specific verification:

- **RSS.com:** verify the returned episode ID and GUID, enclosure URL, title,
  structured episode number, description, artwork, and publication date in the
  canonical feed. The adapter checkpoints presigned audio/artwork sessions,
  upload completion, episode-write intent, and the accepted identity. An
  ambiguous response after episode-write intent blocks a second episode POST.
- **Vimeo:** verify the returned video belongs to account `253415660`, finished
  processing, and matches the approved copy, privacy, and media.
- **YouTube:** verify the returned video belongs to channel
  `UCFA1nVv4lKMBlx81gjMAOFQ` and matches the approved copy, thumbnail,
  made-for-kids state, disclosures, license, schedule, notifications, and
  visibility.

Do not call a provider response alone verified. Completion requires the
adapter's authenticated readback and verified receipt.

## 8. Complete RSS Fan-Out And Attended Platforms

After RSS.com is verified:

1. Confirm the new GUID and enclosure appear in the canonical feed.
2. Verify that same item in the existing Spotify and Apple shows. After Amazon's
   one-time claim, verify it there as well. Do not upload podcast audio separately
   to any directory.
3. For an approved video episode, wait for the RSS-created item in Spotify for
   Creators, then use that exact episode's **Upload video** action with the
   approved `fullVideo`. Never create a duplicate Spotify episode or upload the
   audio as a fallback. Audio-only episodes need no Spotify dashboard action.
4. Instagram is not a controller target yet. Keep `@drmexperienced` as a Creator
   professional account. Until its Meta app, linked Page, publishing ID, scopes,
   token, cover controls, checkpointing, and adapter gates are complete, publish
   only through a separately authorized attended handoff.
5. Rumble is optional and outside automation. If it is not selected, leave its
   catalog destination null and do not create a placeholder website link. If it
   is selected, the owner performs the current manual-only workflow; it must not
   be added to Dropbox intake, `dispatch`, machine control, or browser automation.

For an independently observed attended action, append receipts with
`drm-publish receipt` using one stable operation ID and the exact returned ID,
URL, processing evidence, and verified readback. Follow the receipt lifecycle in
`docs/operations-manual.md`; never jump directly to `verified` without a valid
earlier state and meaningful readback evidence.

## 9. Recover Without Duplicating A Release

Never blindly retry after a timeout or uncertain provider response.

```bash
drm-publish queue <job-id>
drm-publish receipts <job-id>
drm-publish status <job-id>
```

- Use `retry` only for a blocked operation that definitively failed before any
  provider write.
- Use `reconcile` only for a post-write operation with durable write intent and
  a provider checkpoint. It resumes that exact remote session or resource:

```bash
drm-publish reconcile <operation-id> \
  --reason "resume exact checkpoint after reviewed interruption" \
  --confirm "reconcile-operation <operation-id>"
```

- Use `supersede` only when reviewed evidence proves there was no provider write
  intent, checkpoint, acceptance, remote ID, or URL. It releases a blocked
  create slot while preserving the audit trail:

```bash
drm-publish supersede <operation-id> \
  --reason "replace invalid pre-write job" \
  --evidence "reviewed events prove no provider write intent" \
  --confirm "supersede-no-remote-write <operation-id>"
```

If Dropbox intake reports `manual_recovery_required`, inspect its private claim
and the jobs directory. Do not delete the claim until absence of a prepared job
is proven. See [Dropbox Delivery Intake](dropbox-delivery-intake.md) for the exact
intake recovery states.

## 10. Reconcile The Catalog And Website

After remote verification, write every verified identity back to the same
episode in `publishing/master-catalog.json`:

- RSS GUID, publish date, feed timestamp, and hosted audio URL
- each selected destination's exact stable ID and HTTPS URL
- any replaced identity in the appropriate archive rather than deleting history

Increment the catalog revision/date and validate it. Unknown or intentionally
unselected destinations stay null.

Create or update the parent row in `public.episodes` as `draft`, then update its
related website rows:

- `public.episode_topics`
- `public.episode_references`
- `public.episode_key_takeaways`
- `public.episode_checklist_items`, when useful
- `public.episode_sections`
- `public.episode_section_paragraphs`

Website platform requirements follow the catalog, not a fixed list of four
services. Every non-null destination binding in the master catalog must have one
exact, published, non-`coming_soon` Supabase reference. A deliberately
unselected destination remains null and needs no placeholder reference. Do not
publish a null, guessed, stale, or mismatched platform URL merely to fill a slot.

Review related products and blogs for genuine relevance. Mirror durable website
recovery content into `supabase/seed.sql` and the checked-in fallback data after
the editorial change is final; those mirrors do not become the metadata master.

## 11. Verify And Publish The Website

Run:

```bash
npm run lint
npm run typecheck
npm run test:publisher
npm audit --audit-level=high
npm run verify:catalog
npm run test:database-security
CONTENT_CATALOG_STRICT=true npm run build
```

Review the homepage, episode detail page, episodes library, thumbnail, audio and
video links, related products, related blogs, previous/next navigation, and
mobile layout. Confirm every included platform reference opens the exact episode
and that omitted platforms do not render empty controls.

Set the Supabase episode status to `published` only after the selected
destinations and editorial content pass readback. Deploy the reviewed commit
through `main`, then confirm the GitHub Pages workflow and live episode URL
before announcing the release.
