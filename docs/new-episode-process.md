# New Episode Publishing Process

Use this checklist from approved media through website publication. Preparing or approving a local job never uploads or releases content.

If `publishing/hosting-migration.json` has `gates.publishingFreezeActive` set to `true`, stop. Do not publish a new episode until the host cutover validation is complete and the freeze is cleared.

## 1. Prepare The Approval Packet

Create an episode manifest from `publishing/episode.example.json`, then run:

```bash
drm-publish doctor
drm-publish prepare /absolute/path/to/episode.json
drm-publish show <job-id>
```

Review the exact title, descriptions, media fingerprints, audience and disclosure flags, schedule, targets, and warnings in the packet. Record the local review attestation with the exact hash and confirmation phrase shown in that packet. The `--by` value is attribution, not identity authentication; it grants neither upload nor release authority.

## 2. Obtain Separate Attended Authorizations

The local review attestation created in step 1 authorizes neither upload nor release. No live adapter or durable receipt ledger is implemented yet. Stop here unless the user gives a fresh attended authorization for one exact destination and one exact external action.

For each destination, keep upload and release as separate decisions:

- first obtain authorization to upload the exact integrity-checked asset and copy to one named account; this does not authorize public visibility
- perform only that one attended upload, creating a private or draft item where the platform supports it
- record the returned ID, URL, processing state, timestamp, and any uncertainty before attempting another destination
- if a request times out after remote creation may have begun, reconcile the remote account manually and never retry creation blindly
- after the private/draft item is verified, obtain a separate fresh authorization for its exact visibility, schedule, license, monetization, notification, audience, and disclosure values

Once those two authorizations exist, use the unchanged assets in this order:

- before the RSS.com cutover, use the local Spotify for Creators browser session to upload the approved episode so Spotify can expose its audio through the current canonical feed
- after the verified RSS.com cutover, publish podcast audio through RSS.com and verify that the existing Spotify, Apple Podcasts, and Amazon Music/Audible listings ingest that feed; handle Spotify video as a separate upload
- upload the full video to YouTube and Vimeo through their approved API connections when configured
- publish the approved vertical Reel through Instagram's resumable upload from the local file when configured; use short-lived public staging only as a fallback and delete the staged object after processing
- complete Rumble VOD through its local browser session, stopping for any license, monetization, visibility, or final-release decision not frozen in the approval packet

Do not regenerate or edit copy after review; create a new packet if anything changes. Automated live posting remains disabled until the publisher has immutable receipts, deterministic operation IDs, per-target state, and remote reconciliation.

## 3. Confirm Platform Metadata

Collect and verify:

- episode number, title, publication date, duration, summary, and thumbnail
- Vimeo ID and URL
- Spotify ID and URL
- YouTube ID and URL
- Rumble URL

`npm run sync-episodes` can be used as a metadata aid, but it does not update Supabase or publish the website.

## 4. Add The Episode To Supabase

Create or update the parent row in `public.episodes`, then add its related rows:

- `public.episode_topics`
- `public.episode_references`
- `public.episode_key_takeaways`
- `public.episode_checklist_items`, when an ordered checklist is useful
- `public.episode_sections`
- `public.episode_section_paragraphs`

Keep the episode in `draft` until all four platform references and the editorial sections are complete. Public RLS policies hide both draft parent rows and their child content.

## 5. Verify Related Products And Blogs

Affiliate resources can be linked manually through `public.affiliate_product_episode_links` or by topic through `public.affiliate_product_auto_topics`. Review the resulting product cards on the episode page and remove broad or inaccurate matches.

Add blog relationships only when the episode is genuinely relevant to the post.

## 6. Maintain Recovery Data

When the editorial change is final, mirror durable content into `supabase/seed.sql` and the checked-in fallback data. These mirrors support local recovery; Supabase remains the production source of truth.

## 7. Verify Locally

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

## 8. Publish The Website

Set the Supabase episode status to `published`, rerun the local checks, then deploy the verified commit through `main`. Confirm the GitHub Pages workflow and live episode URL before announcing the episode.
