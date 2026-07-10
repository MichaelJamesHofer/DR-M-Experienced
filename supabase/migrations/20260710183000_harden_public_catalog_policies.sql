-- Keep public child-row visibility aligned with the publication state of the
-- owning episode or affiliate product.

drop policy if exists "Allow public episode topic reads" on public.episode_topics;
create policy "Allow public episode topic reads"
  on public.episode_topics for select to anon, authenticated using (
    exists (
      select 1 from public.episodes
      where episodes.slug = episode_topics.episode_slug
        and episodes.status = 'published'
    )
  );

drop policy if exists "Allow public episode reference reads" on public.episode_references;
create policy "Allow public episode reference reads"
  on public.episode_references for select to anon, authenticated using (
    exists (
      select 1 from public.episodes
      where episodes.slug = episode_references.episode_slug
        and episodes.status = 'published'
    )
  );

drop policy if exists "Allow public episode key takeaway reads" on public.episode_key_takeaways;
create policy "Allow public episode key takeaway reads"
  on public.episode_key_takeaways for select to anon, authenticated using (
    exists (
      select 1 from public.episodes
      where episodes.slug = episode_key_takeaways.episode_slug
        and episodes.status = 'published'
    )
  );

drop policy if exists "Allow public episode checklist reads" on public.episode_checklist_items;
create policy "Allow public episode checklist reads"
  on public.episode_checklist_items for select to anon, authenticated using (
    exists (
      select 1 from public.episodes
      where episodes.slug = episode_checklist_items.episode_slug
        and episodes.status = 'published'
    )
  );

drop policy if exists "Allow public episode section reads" on public.episode_sections;
create policy "Allow public episode section reads"
  on public.episode_sections for select to anon, authenticated using (
    exists (
      select 1 from public.episodes
      where episodes.slug = episode_sections.episode_slug
        and episodes.status = 'published'
    )
  );

drop policy if exists "Allow public episode section paragraph reads" on public.episode_section_paragraphs;
create policy "Allow public episode section paragraph reads"
  on public.episode_section_paragraphs for select to anon, authenticated using (
    exists (
      select 1 from public.episodes
      where episodes.slug = episode_section_paragraphs.episode_slug
        and episodes.status = 'published'
    )
  );

drop policy if exists "Allow public affiliate reason reads" on public.affiliate_product_reasons;
create policy "Allow public affiliate reason reads"
  on public.affiliate_product_reasons for select to anon, authenticated using (
    exists (
      select 1 from public.affiliate_products
      where affiliate_products.slug = affiliate_product_reasons.product_slug
        and affiliate_products.status = 'published'
    )
  );

drop policy if exists "Allow public affiliate use-case reads" on public.affiliate_product_use_cases;
create policy "Allow public affiliate use-case reads"
  on public.affiliate_product_use_cases for select to anon, authenticated using (
    exists (
      select 1 from public.affiliate_products
      where affiliate_products.slug = affiliate_product_use_cases.product_slug
        and affiliate_products.status = 'published'
    )
  );

drop policy if exists "Allow public affiliate featured item reads" on public.affiliate_product_featured_items;
create policy "Allow public affiliate featured item reads"
  on public.affiliate_product_featured_items for select to anon, authenticated using (
    exists (
      select 1 from public.affiliate_products
      where affiliate_products.slug = affiliate_product_featured_items.product_slug
        and affiliate_products.status = 'published'
    )
  );

drop policy if exists "Allow public affiliate tag reads" on public.affiliate_product_tags;
create policy "Allow public affiliate tag reads"
  on public.affiliate_product_tags for select to anon, authenticated using (
    exists (
      select 1 from public.affiliate_products
      where affiliate_products.slug = affiliate_product_tags.product_slug
        and affiliate_products.status = 'published'
    )
  );

drop policy if exists "Allow public affiliate episode-link reads" on public.affiliate_product_episode_links;
create policy "Allow public affiliate episode-link reads"
  on public.affiliate_product_episode_links for select to anon, authenticated using (
    exists (
      select 1 from public.affiliate_products
      where affiliate_products.slug = affiliate_product_episode_links.product_slug
        and affiliate_products.status = 'published'
    )
    and exists (
      select 1 from public.episodes
      where episodes.slug = affiliate_product_episode_links.episode_slug
        and episodes.status = 'published'
    )
  );

drop policy if exists "Allow public affiliate auto-topic reads" on public.affiliate_product_auto_topics;
create policy "Allow public affiliate auto-topic reads"
  on public.affiliate_product_auto_topics for select to anon, authenticated using (
    exists (
      select 1 from public.affiliate_products
      where affiliate_products.slug = affiliate_product_auto_topics.product_slug
        and affiliate_products.status = 'published'
    )
  );

drop policy if exists "Allow public blog related episode reads" on public.blog_post_related_episodes;
create policy "Allow public blog related episode reads"
  on public.blog_post_related_episodes for select to anon, authenticated using (
    exists (
      select 1 from public.blog_posts
      where blog_posts.slug = blog_post_related_episodes.blog_slug
        and blog_posts.status = 'published'
    )
    and exists (
      select 1 from public.episodes
      where episodes.slug = blog_post_related_episodes.episode_slug
        and episodes.status = 'published'
    )
  );

drop policy if exists "Allow public blog related product reads" on public.blog_post_related_affiliate_products;
create policy "Allow public blog related product reads"
  on public.blog_post_related_affiliate_products for select to anon, authenticated using (
    exists (
      select 1 from public.blog_posts
      where blog_posts.slug = blog_post_related_affiliate_products.blog_slug
        and blog_posts.status = 'published'
    )
    and exists (
      select 1 from public.affiliate_products
      where affiliate_products.slug = blog_post_related_affiliate_products.product_slug
        and affiliate_products.status = 'published'
    )
  );

alter view public.affiliate_product_episode_matches set (security_invoker = true);
revoke all on table public.affiliate_product_episode_matches from public, anon, authenticated;
grant select on table public.affiliate_product_episode_matches to service_role;
