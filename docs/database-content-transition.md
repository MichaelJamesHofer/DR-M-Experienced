# Database Content Transition

Supabase is the production source of truth for public episode and affiliate catalog content. The checked-in TypeScript and JSON data remains as an emergency/local fallback, not the normal production publishing path.

## Production Source Model

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

## Build-Time Contract

The site reads Supabase during `next build` when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are configured.

Production deploys set `CONTENT_CATALOG_STRICT=true`. In strict mode, the build fails if Supabase is unavailable or if required catalog rows are missing:

- at least one published episode, category, and product
- topic, reference, key-takeaway, and section rows for every episode
- paragraph rows for every section
- category, summary, Dr. M thoughts, reason, use-case, and URL data for every product

Local builds without Supabase env vars still use the checked-in fallback catalog.

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

1. Sync platform metadata with `npm run sync-episodes`.
2. Add or update episode rows in Supabase.
3. Add episode topics, references, takeaways, checklist items, sections, and section paragraphs.
4. Add or update affiliate rows and product-to-episode links.
5. Run `npm run lint`, `npx tsc --noEmit`, and `npm run build`.
6. Push to `main` and verify the GitHub Pages deploy.

## Near-Term Admin Approach

Use Supabase Studio for editorial updates now. It is structured enough for hand editing and less risky than continuing to hardcode content in the repository.

The next durable improvement is a small authenticated admin/import tool that can:

- ingest synced platform metadata
- show missing required Supabase rows
- preview affected episode and affiliate pages
- write ordered show-note rows without hand-entering display orders

## When To Remove The Fallback

Keep the fallback mirror until the content workflow is stable through several episode and affiliate updates. After that, replace the checked-in arrays with generated snapshots or remove them entirely, but only after local preview and production deploys both have a reliable database-backed path.
