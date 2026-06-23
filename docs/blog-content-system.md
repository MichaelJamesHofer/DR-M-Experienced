# Blog Content System

Blogs are designed as a database-owned content type, not as hardcoded page content.

## Tables

Run `supabase/migrations/20260623190000_add_blog_content_tables.sql` before publishing blog rows from Supabase:

- `public.blog_posts`
- `public.blog_post_topics`
- `public.blog_post_sections`
- `public.blog_post_section_paragraphs`
- `public.blog_post_references`
- `public.blog_post_related_episodes`
- `public.blog_post_related_affiliate_products`

The site treats blog tables as optional until migrated. Production builds should not fail just because there are no blog posts yet.

Because the site is statically exported, `/blogs/coming-soon/` is generated as an unlinked, noindex placeholder while there are zero published posts. Once Supabase returns at least one published blog post, the real post slugs replace that placeholder in `generateStaticParams`.

## Minimum Published Post

A published blog post should have:

- one row in `public.blog_posts` with `status = 'published'`
- at least one `public.blog_post_topics` row
- at least one `public.blog_post_sections` row
- at least one paragraph row for each section

Related episode and affiliate rows are optional, but useful for site comprehension.

## Suggested Editorial Shape

Use blogs for material that needs more room than an episode card:

- episode expansions
- practical topic explainers
- order-of-operations frameworks
- references and resource roundups

Keep the `excerpt` short enough to work in cards. Put the real article body in ordered sections and paragraphs so the detail page can render cleanly without markdown parsing.

## Verification

After adding or changing blog content:

```bash
npm run verify:catalog
CONTENT_CATALOG_STRICT=true npm run build
```

Then review:

- `/blogs/`
- `/blogs/[post-slug]/`
- related links from any connected episode page
