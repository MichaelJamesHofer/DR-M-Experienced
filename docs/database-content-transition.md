# Database Content Transition

Supabase is the production source of truth for website-only editorial content,
affiliate content, blogs, and website publication state. It is not the authority
for metadata shared with podcast or video distributors. Shared show and episode
identity and copy are owned by `publishing/master-catalog.json`; overlapping
Supabase fields are checked projections of that catalog.

## Authority Boundaries

| Data | Authority |
|---|---|
| Shared show name, profile copy, episode title/description, RSS GUID, asset bindings, and destination identities | `publishing/master-catalog.json` |
| Original video, audio, and artwork bytes | Project-scoped Dropbox, fingerprinted in the master catalog |
| Website topics, references, sections, blogs, affiliates, and website publication state | Supabase |
| Published podcast enclosures and directory feed routing | RSS.com, verified against its public feed |
| Current platform IDs, URLs, and public state | The remote platform, reconciled back into the master catalog and receipts |

Vimeo is a distribution and recovery copy, not a second binary master. The
fingerprinted local file remains canonical even when Vimeo retains an uploaded
source. RSS.com is the canonical published-audio host; the fingerprinted local
MP3 remains the canonical audio binary.

## Supabase Website Model

Episode list and player metadata:

- `public.episodes`
- `public.episode_topics`
- `public.episode_references`

Episode show-note enrichment:

- `public.episode_key_takeaways`
- `public.episode_checklist_items`
- `public.episode_sections`
- `public.episode_section_paragraphs`

Affiliate catalog:

- `public.affiliate_categories`
- `public.affiliate_products`
- `public.affiliate_product_reasons`
- `public.affiliate_product_use_cases`
- `public.affiliate_product_featured_items`
- `public.affiliate_product_episode_links`
- `public.affiliate_product_auto_topics`
- `public.affiliate_product_tags`
- `public.affiliate_product_episode_matches`

Blog catalog:

- `public.blog_posts`
- `public.blog_post_topics`
- `public.blog_post_sections`
- `public.blog_post_section_paragraphs`
- `public.blog_post_references`
- `public.blog_post_related_episodes`
- `public.blog_post_related_affiliate_products`

## Build-Time Contract

The site reads Supabase during `next build` when `NEXT_PUBLIC_SUPABASE_URL` and one of `SUPABASE_CATALOG_KEY`, `SUPABASE_ANON_KEY`, or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are configured. Server-only catalog keys are preferred for trusted local verification and are never included in the static artifact.

Production deploys set `CONTENT_CATALOG_STRICT=true`. In strict mode, the build fails if Supabase is unavailable or if required catalog rows are missing:

- at least one published episode, category, and product
- topic, reference, key-takeaway, and section rows for every episode
- paragraph rows for every section
- category, summary, Dr. M thoughts, reason, use-case, and URL data for every product
- topic and section data for every published blog post

Local builds without Supabase env vars still use the checked-in fallback catalog.

Blog tables are optional until the blog migration is run. If the blog tables do not exist yet, the site renders the blog library empty rather than blocking the existing episode and affiliate catalog.

## Local Verification Against Production Supabase

Before this branch is pushed to `main`, create an ignored `.env.local` with the production catalog read credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://tdbsuzciwotleualdcjf.supabase.co
SUPABASE_CATALOG_KEY=...
```

Then run:

```bash
npm run verify:catalog
CONTENT_CATALOG_STRICT=true npm run build
npm run dev -- -H 0.0.0.0 -p 3000
```

Only push to `main` after the verifier passes, the strict build passes, and the local site has been manually checked against the production database content.

## Publishing Flow

1. Update and validate shared episode metadata in `publishing/master-catalog.json`.
2. Prepare and approve exact media, copy, artwork, and destination choices.
3. Publish audio to the existing RSS.com episode without changing its GUID; let feed directories ingest it.
4. Publish or replace video on direct-video destinations without creating duplicate episode identities.
5. Reconcile platform IDs and URLs into the master catalog and record delivery evidence.
6. Project overlapping catalog fields into Supabase, then edit website-only topics, references, takeaways, checklist items, sections, blogs, affiliates, and publication state there.
7. Run `npm run lint`, `npm run typecheck`, `npm run verify:catalog`, `npm run test:database-security`, and `npm run build`.
8. Push the reviewed website commit to `main`, verify deployment, and independently read back every required destination.

## Near-Term Admin Approach

Use Supabase Studio for website-only editorial updates now. Do not use it to
originate or silently overwrite shared show names, episode titles, descriptions,
GUIDs, asset bindings, or destination identities.

The next durable improvement is a small authenticated admin/import tool that can:

- ingest approved catalog projections and platform delivery receipts
- show missing required Supabase rows
- preview affected episode and affiliate pages
- write ordered show-note rows without hand-entering display orders

That tool should introduce a private publishing-operations schema for approved
shared metadata, asset fingerprints, destination delivery receipts, and remote
verification state. The checked-in catalog can then become a deterministic,
reviewable export of that database. Do not declare that cutover complete until
the importer, exporter, schema validation, revision history, and two-way drift
checks pass together; adding unused tables alone would create a second source of
truth rather than replacing one.

## When To Remove The Fallback

Keep the fallback mirror until the content workflow is stable through several episode and affiliate updates. After that, replace the checked-in arrays with generated snapshots or remove them entirely, but only after local preview and production deploys both have a reliable database-backed path.
