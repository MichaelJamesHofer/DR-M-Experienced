# New Episode Publishing Process

Use this checklist after an episode is posted and its platform URLs are known.

## 1. Confirm Platform Metadata

Collect and verify:

- episode number, title, publication date, duration, summary, and thumbnail
- Vimeo ID and URL
- Spotify ID and URL
- YouTube ID and URL
- Rumble URL

`npm run sync-episodes` can be used as a metadata aid, but it does not update Supabase or publish the website.

## 2. Add The Episode To Supabase

Create or update the parent row in `public.episodes`, then add its related rows:

- `public.episode_topics`
- `public.episode_references`
- `public.episode_key_takeaways`
- `public.episode_checklist_items`, when an ordered checklist is useful
- `public.episode_sections`
- `public.episode_section_paragraphs`

Keep the episode in `draft` until all four platform references and the editorial sections are complete. Public RLS policies hide both draft parent rows and their child content.

## 3. Verify Related Products And Blogs

Affiliate resources can be linked manually through `public.affiliate_product_episode_links` or by topic through `public.affiliate_product_auto_topics`. Review the resulting product cards on the episode page and remove broad or inaccurate matches.

Add blog relationships only when the episode is genuinely relevant to the post.

## 4. Maintain Recovery Data

When the editorial change is final, mirror durable content into `supabase/seed.sql` and the checked-in fallback data. These mirrors support local recovery; Supabase remains the production source of truth.

## 5. Verify Locally

Run:

```bash
npm run lint
npm run typecheck
npm audit --audit-level=high
npm run verify:catalog
npm run test:database-security
CONTENT_CATALOG_STRICT=true npm run build
```

Review the homepage, episode detail page, episodes library, related products, related blogs, previous/next navigation, and mobile layout. Confirm all four platform links open the intended episode.

## 6. Publish

Set the Supabase episode status to `published`, rerun the local checks, then deploy the verified commit through `main`. Confirm the GitHub Pages workflow and live episode URL before announcing the episode.
