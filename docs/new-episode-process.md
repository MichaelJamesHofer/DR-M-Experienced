# New Episode Publishing Process

Use this checklist after the post-ready episode has been encoded and the platform URLs are known.

## 1. Sync Platform Metadata

1. Run `npm run sync-episodes`.
2. Confirm the new episode appears in `src/data/episodes-from-platforms.json`.
3. Verify the slug, episode number, publish date, duration, Vimeo ID, Spotify ID, YouTube ID, and thumbnail URL.

## 2. Add Editorial Enrichment

Update `src/data/episodes-enrichment.json` with:

- `topics`: use specific topic slugs. Avoid generic tags when a specific tag exists.
- `references`: Vimeo, Spotify, YouTube, Rumble, or other canonical references.
- `audioUrl`: podcast audio URL when available.
- `keyTakeaways`: concise episode takeaways.
- `checklist`: only when the episode has a natural ordered action list.
- `sections`: show-note sections that help a listener scan the episode.

## 3. Check Automatic Affiliate Matching

Affiliate resources are matched to episodes in two ways:

- Manual links: rows in `public.affiliate_product_episode_links`.
- Automatic links: rows in `public.affiliate_product_auto_topics` matching `public.episode_topics`.

Before publishing, open the episode page and verify the "Products referenced in this episode" section. If a product appears only because the topic match is too broad, tighten the episode topic row or the product auto-topic row. If a product is episode-specific, add an explicit manual link row.

## 4. Update Database Seed When Content Changes

The Supabase content catalog is defined in:

- `supabase/migrations/20260617233000_create_content_catalog.sql`
- `supabase/migrations/20260619013000_add_episode_enrichment_tables.sql`
- `supabase/seed.sql`
- `src/data/content-catalog.ts`

When adding an episode, mirror the public content into:

- `public.episodes`
- `public.episode_topics`
- `public.episode_references`
- `public.episode_key_takeaways`
- `public.episode_checklist_items`
- `public.episode_sections`
- `public.episode_section_paragraphs`

When adding or changing an affiliate resource, mirror it into:

- `public.affiliate_categories`
- `public.affiliate_products`
- `public.affiliate_product_reasons`
- `public.affiliate_product_use_cases`
- `public.affiliate_product_featured_items`
- `public.affiliate_product_episode_links`
- `public.affiliate_product_auto_topics`
- `public.affiliate_product_tags`

The database view `public.affiliate_product_episode_matches` should show the final manual and topic-derived product-to-episode matches. The site reads from Supabase at build time when `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are present; otherwise it falls back to the checked-in catalog mirror so local static builds still work.

Production deploys set `CONTENT_CATALOG_STRICT=true`, so a missing Supabase table, missing required episode enrichment, or incomplete affiliate product will fail the build instead of silently publishing stale fallback content.

## 5. Verify Locally

Run:

```bash
npm run lint
npx tsc --noEmit
npm audit --audit-level=moderate
npm run build
```

Then review:

- `/episodes/`
- `/episodes/[new-episode-slug]/`
- `/affiliates/`

Check search, topic filters, category filters, sort controls, product links, affiliate disclosure, and mobile layout.

## 6. Commit Checkpoints

Use small rollback points:

1. `checkpoint: sync episode metadata`
2. `checkpoint: enrich episode notes`
3. `checkpoint: update affiliate links`
4. `checkpoint: verify episode publish`

Keep generated, raw, or email-extraction artifacts on the Desktop unless they are intentionally part of the site source.
