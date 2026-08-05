# New Episode Publishing Process

Use this checklist from approved media through website publication. Preparing or approving a local job never uploads or releases content.

If `publishing/hosting-migration.json` has `gates.publishingFreezeActive` set to `true`, stop. Do not publish a new episode until the host cutover validation is complete and the freeze is cleared.

The RSS.com self-service import currently awaits project-email confirmation.
Anchor remains the canonical feed until the imported feed passes parity checks
and the exact cutover/redirect receives separate approval.

## 1. Register The Episode In The Master Catalog

Before creating an approval packet, update `publishing/master-catalog.json`. It
is the authority for shared show and episode identity, copy, content flags,
logical asset references, RSS identity, and verified remote IDs/URLs. A private
episode manifest adds release decisions; it is not a second metadata master.

1. Confirm the next immutable, contiguous episode number.
2. Put the finished binaries under the synced Dr. M project folder, not in git.
3. Add project-relative entries such as
   `dropbox:episodes/008-topic/master-video.mp4` to `assetRegistry`, then connect
   them from the episode's `assetRefs`.
4. Add the approved unnumbered title, slug, descriptions, website summary,
   content flags, aliases, and all known stable identities. Start the record
   with `publicationState: "draft"`; `rssGuid`, `publishDate`,
   `feedPublishedAt`, and not-yet-created destination identities may be null.
   Never invent an assigned value. After host publication, record the verified
   GUID/date/timestamp and change the state to `published`. Never reuse the
   immutable number of an abandoned draft.
5. Fully download/sync every asset needed for this release. Record the measured
   `sha256` and `sizeBytes`, then change its status to `verified`. A Dropbox
   placeholder or filename match is not sufficient.
6. Increment the catalog `revision`, update `updatedAt`, and validate with
   `drm-publish doctor` and `npm run test:publisher`.

The logical source root is configured outside git at
`~/.config/drm-publisher/sources.json` and must point directly to the Dr. M
project folder:

```json
{
  "schemaVersion": 1,
  "roots": {
    "dropbox": "/absolute/path/to/the/synced/Dr-M-project-folder"
  }
}
```

Do not map the whole personal Dropbox, commit this local path, or mark an asset
verified without both fingerprints.

## 2. Prepare The Approval Packet

Create a private episode manifest from `publishing/episode.example.json`. Its
catalog-owned values must exactly match the registered episode; add the exact
target-specific schedule, visibility, licensing, monetization, notification,
audience, and disclosure choices. Destination-specific `copy.*` is an explicit
approval-local exception and does not change canonical catalog copy. Then run:

```bash
drm-publish doctor
drm-publish prepare /absolute/path/to/episode.json
drm-publish show <job-id>
```

Review the exact title, descriptions, media fingerprints, audience and disclosure flags, schedule, targets, and warnings in the packet. Record the local review attestation with the exact hash and confirmation phrase shown in that packet. The `--by` value is attribution, not identity authentication; it grants neither upload nor release authority.

If `prepare` reports catalog/manifest drift, correct the catalog or manifest and
create a new packet. Do not bypass the catalog by editing only a remote
dashboard.

With a configured Dropbox project root, `prepare` verifies that supplied media
resolves to the registered logical asset; a `verified` catalog asset must also
match SHA-256 and byte size. Until that root is configured, the packet warns
that path binding is unverified while still fingerprinting the exact supplied
media.

## 3. Obtain Separate Attended Authorizations

The local review attestation created in step 2 authorizes neither upload nor release. No live adapter or durable receipt ledger is implemented yet. Stop here unless the user gives a fresh attended authorization for one exact destination and one exact external action.

For each destination, keep upload and release as separate decisions:

- first obtain authorization to upload the exact integrity-checked asset and copy to one named account; this does not authorize public visibility
- perform only that one attended upload, creating a private or draft item where the platform supports it
- record the returned ID, URL, processing state, timestamp, and any uncertainty before attempting another destination
- if a request times out after remote creation may have begun, reconcile the remote account manually and never retry creation blindly
- after the private/draft item is verified, obtain a separate fresh authorization for its exact visibility, schedule, license, monetization, notification, audience, and disclosure values

Once those two authorizations exist, use the unchanged assets in this order:

- before cutover, use Spotify for Creators for canonical podcast audio; after cutover, publish podcast audio through RSS.com while continuing Spotify video in the creator workflow
- before cutover, verify existing Apple show `1870433419` ingests the episode
  from Anchor and keep Amazon on hold; after cutover, verify Apple and the one
  newly claimed Amazon listing ingest the RSS.com feed without separate episode
  uploads
- upload the full video to YouTube and Vimeo through their approved API connections when configured
- publish the approved vertical Reel through Instagram's resumable upload from the local file when configured; use short-lived public staging only as a fallback and delete the staged object after processing
- complete Rumble VOD through its local browser session, stopping for any license, monetization, visibility, or final-release decision not frozen in the approval packet

Do not regenerate or edit copy after review; create a new packet if anything changes. Automated live posting remains disabled until the publisher has immutable receipts, deterministic operation IDs, per-target state, and remote reconciliation.

## 4. Reconcile Platform Metadata Into The Catalog

Collect and verify:

- structured episode number, unnumbered public title, publication date, duration,
  summary, and thumbnail
- the same GUID in the current canonical feed and every RSS directory
- Vimeo ID and URL
- Spotify ID and URL
- YouTube ID and URL
- Rumble URL

Write each verified GUID, ID, and URL back to the same episode in
`publishing/master-catalog.json`, then increment its revision/date and validate
again. `npm run sync-episodes` can be used as a metadata aid, but generated
mirrors, Supabase, and remote responses must not overwrite approved catalog copy.
The sync command does not update Supabase or publish the website.

## 5. Add The Episode To Supabase

Create or update the parent row in `public.episodes`, then add its related rows:

- `public.episode_topics`
- `public.episode_references`
- `public.episode_key_takeaways`
- `public.episode_checklist_items`, when an ordered checklist is useful
- `public.episode_sections`
- `public.episode_section_paragraphs`

Keep the episode in `draft` until all four platform references and the editorial sections are complete. Public RLS policies hide both draft parent rows and their child content. Copy overlapping number, slug, title, and destination identities from the master catalog; Supabase is authoritative only for the website-specific editorial fields and publication state.

## 6. Verify Related Products And Blogs

Affiliate resources can be linked manually through `public.affiliate_product_episode_links` or by topic through `public.affiliate_product_auto_topics`. Review the resulting product cards on the episode page and remove broad or inaccurate matches.

Add blog relationships only when the episode is genuinely relevant to the post.

## 7. Maintain Recovery Data

When the editorial change is final, mirror durable website content into
`supabase/seed.sql` and the checked-in fallback data. These mirrors support local
recovery; Supabase remains the production source for website-only editorial
content, while shared episode metadata remains mastered in
`publishing/master-catalog.json`.

## 8. Verify Locally

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

Review the homepage, episode detail page, episodes library, related products, related blogs, previous/next navigation, and mobile layout. Confirm all four platform links open the intended episode.

## 9. Publish The Website

Set the Supabase episode status to `published`, rerun the local checks, then deploy the verified commit through `main`. Confirm the GitHub Pages workflow and live episode URL before announcing the episode.
