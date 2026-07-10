begin;

create or replace function public.audit_assert(condition boolean, message text)
returns void
language plpgsql
as $$
begin
  if not condition then
    raise exception 'security regression: %', message;
  end if;
end;
$$;

grant execute on function public.audit_assert(boolean, text) to anon;
grant usage on schema public to anon;
grant select on public.episodes,
  public.episode_topics,
  public.episode_references,
  public.episode_key_takeaways,
  public.episode_checklist_items,
  public.episode_sections,
  public.episode_section_paragraphs,
  public.affiliate_products,
  public.affiliate_product_reasons,
  public.affiliate_product_use_cases,
  public.affiliate_product_featured_items,
  public.affiliate_product_tags,
  public.affiliate_product_episode_links,
  public.affiliate_product_auto_topics,
  public.blog_posts,
  public.blog_post_topics,
  public.blog_post_sections,
  public.blog_post_section_paragraphs,
  public.blog_post_references,
  public.blog_post_related_episodes,
  public.blog_post_related_affiliate_products
to anon;

insert into public.content_topics (slug, label)
values ('audit-rls-topic', 'Audit RLS topic');

insert into public.episodes (
  slug,
  episode_number,
  title,
  publish_date,
  summary,
  status
)
values
  (
    'audit-rls-published-episode',
    2000000000,
    'Published audit episode',
    current_date,
    'Published audit fixture',
    'published'
  ),
  (
    'audit-rls-draft-episode',
    2000000001,
    'Draft audit episode',
    current_date,
    'Draft audit fixture',
    'draft'
  );

insert into public.episode_topics (episode_slug, topic_slug)
values
  ('audit-rls-published-episode', 'audit-rls-topic'),
  ('audit-rls-draft-episode', 'audit-rls-topic');

insert into public.episode_references (episode_slug, label, url)
values
  ('audit-rls-published-episode', 'Published reference', 'https://example.test/published'),
  ('audit-rls-draft-episode', 'Draft reference', 'https://example.test/draft');

insert into public.episode_key_takeaways (episode_slug, display_order, body)
values
  ('audit-rls-published-episode', 10, 'Published takeaway'),
  ('audit-rls-draft-episode', 10, 'Draft takeaway');

insert into public.episode_checklist_items (episode_slug, display_order, body)
values
  ('audit-rls-published-episode', 10, 'Published checklist item'),
  ('audit-rls-draft-episode', 10, 'Draft checklist item');

insert into public.episode_sections (episode_slug, display_order, title)
values
  ('audit-rls-published-episode', 10, 'Published section'),
  ('audit-rls-draft-episode', 10, 'Draft section');

insert into public.episode_section_paragraphs (
  episode_slug,
  section_display_order,
  display_order,
  body
)
values
  ('audit-rls-published-episode', 10, 10, 'Published paragraph'),
  ('audit-rls-draft-episode', 10, 10, 'Draft paragraph');

insert into public.affiliate_categories (slug, label, description)
values ('audit-rls-category', 'Audit RLS category', 'Audit category fixture');

insert into public.affiliate_products (
  slug,
  category_slug,
  name,
  summary,
  drm_thoughts,
  direct_url,
  source_note,
  status
)
values
  (
    'audit-rls-published-product',
    'audit-rls-category',
    'Published audit product',
    'Published product fixture',
    'Published product thoughts',
    'https://example.test/published-product',
    'Audit fixture',
    'published'
  ),
  (
    'audit-rls-draft-product',
    'audit-rls-category',
    'Draft audit product',
    'Draft product fixture',
    'Draft product thoughts',
    'https://example.test/draft-product',
    'Audit fixture',
    'draft'
  );

insert into public.affiliate_product_reasons (product_slug, display_order, body)
values
  ('audit-rls-published-product', 10, 'Published reason'),
  ('audit-rls-draft-product', 10, 'Draft reason');

insert into public.affiliate_product_use_cases (product_slug, display_order, body)
values
  ('audit-rls-published-product', 10, 'Published use case'),
  ('audit-rls-draft-product', 10, 'Draft use case');

insert into public.affiliate_product_featured_items (product_slug, display_order, label)
values
  ('audit-rls-published-product', 10, 'Published item'),
  ('audit-rls-draft-product', 10, 'Draft item');

insert into public.affiliate_product_tags (product_slug, tag_slug)
values
  ('audit-rls-published-product', 'published-tag'),
  ('audit-rls-draft-product', 'draft-tag');

insert into public.affiliate_product_auto_topics (product_slug, topic_slug)
values
  ('audit-rls-published-product', 'audit-rls-topic'),
  ('audit-rls-draft-product', 'audit-rls-topic');

insert into public.affiliate_product_episode_links (product_slug, episode_slug)
values
  ('audit-rls-published-product', 'audit-rls-published-episode'),
  ('audit-rls-published-product', 'audit-rls-draft-episode'),
  ('audit-rls-draft-product', 'audit-rls-published-episode');

insert into public.blog_posts (slug, title, excerpt, publish_date, status)
values
  (
    'audit-rls-published-blog',
    'Published audit blog',
    'Published blog fixture',
    current_date,
    'published'
  ),
  (
    'audit-rls-draft-blog',
    'Draft audit blog',
    'Draft blog fixture',
    current_date,
    'draft'
  );

insert into public.blog_post_topics (blog_slug, topic_slug)
values
  ('audit-rls-published-blog', 'audit-rls-topic'),
  ('audit-rls-draft-blog', 'audit-rls-topic');

insert into public.blog_post_sections (blog_slug, display_order, title)
values
  ('audit-rls-published-blog', 10, 'Published section'),
  ('audit-rls-draft-blog', 10, 'Draft section');

insert into public.blog_post_section_paragraphs (
  blog_slug,
  section_display_order,
  display_order,
  body
)
values
  ('audit-rls-published-blog', 10, 10, 'Published paragraph'),
  ('audit-rls-draft-blog', 10, 10, 'Draft paragraph');

insert into public.blog_post_references (blog_slug, label, url)
values
  ('audit-rls-published-blog', 'Published reference', 'https://example.test/blog-published'),
  ('audit-rls-draft-blog', 'Draft reference', 'https://example.test/blog-draft');

insert into public.blog_post_related_episodes (blog_slug, episode_slug)
values
  ('audit-rls-published-blog', 'audit-rls-published-episode'),
  ('audit-rls-published-blog', 'audit-rls-draft-episode'),
  ('audit-rls-draft-blog', 'audit-rls-published-episode');

insert into public.blog_post_related_affiliate_products (blog_slug, product_slug)
values
  ('audit-rls-published-blog', 'audit-rls-published-product'),
  ('audit-rls-published-blog', 'audit-rls-draft-product'),
  ('audit-rls-draft-blog', 'audit-rls-published-product');

select public.audit_assert(
  not has_table_privilege('anon', 'public.contact_messages', 'SELECT,INSERT,UPDATE,DELETE')
    and not has_table_privilege(
      'authenticated',
      'public.contact_messages',
      'SELECT,INSERT,UPDATE,DELETE'
    ),
  'public form-table access must remain disabled'
);
select public.audit_assert(
  not has_table_privilege('anon', 'public.newsletter_subscriptions', 'SELECT,INSERT,UPDATE,DELETE')
    and not has_table_privilege(
      'authenticated',
      'public.newsletter_subscriptions',
      'SELECT,INSERT,UPDATE,DELETE'
    ),
  'public newsletter-table access must remain disabled'
);
select public.audit_assert(
  not has_function_privilege(
    'anon',
    'public.increment_form_rate_limit(text,text,timestamptz)',
    'EXECUTE'
  )
    and not has_function_privilege(
      'authenticated',
      'public.increment_form_rate_limit(text,text,timestamptz)',
      'EXECUTE'
    ),
  'public rate-limit RPC access must remain disabled'
);
select public.audit_assert(
  not has_table_privilege('anon', 'public.affiliate_product_episode_matches', 'SELECT')
    and not has_table_privilege(
      'authenticated',
      'public.affiliate_product_episode_matches',
      'SELECT'
    ),
  'the editorial match view must not be public'
);

set local role anon;

select public.audit_assert(
  (select count(*) from public.episodes where slug like 'audit-rls-%') = 1,
  'episode policy must expose only published parents'
);
select public.audit_assert(
  (select count(*) from public.episode_topics where episode_slug like 'audit-rls-%') = 1,
  'episode topic policy must expose only published parents'
);
select public.audit_assert(
  (select count(*) from public.episode_references where episode_slug like 'audit-rls-%') = 1,
  'episode reference policy must expose only published parents'
);
select public.audit_assert(
  (select count(*) from public.episode_key_takeaways where episode_slug like 'audit-rls-%') = 1,
  'episode takeaway policy must expose only published parents'
);
select public.audit_assert(
  (select count(*) from public.episode_checklist_items where episode_slug like 'audit-rls-%') = 1,
  'episode checklist policy must expose only published parents'
);
select public.audit_assert(
  (select count(*) from public.episode_sections where episode_slug like 'audit-rls-%') = 1,
  'episode section policy must expose only published parents'
);
select public.audit_assert(
  (
    select count(*) from public.episode_section_paragraphs
    where episode_slug like 'audit-rls-%'
  ) = 1,
  'episode paragraph policy must expose only published parents'
);

select public.audit_assert(
  (select count(*) from public.affiliate_products where slug like 'audit-rls-%') = 1,
  'product policy must expose only published parents'
);
select public.audit_assert(
  (select count(*) from public.affiliate_product_reasons where product_slug like 'audit-rls-%') = 1,
  'product reason policy must expose only published parents'
);
select public.audit_assert(
  (select count(*) from public.affiliate_product_use_cases where product_slug like 'audit-rls-%') = 1,
  'product use-case policy must expose only published parents'
);
select public.audit_assert(
  (
    select count(*) from public.affiliate_product_featured_items
    where product_slug like 'audit-rls-%'
  ) = 1,
  'product featured-item policy must expose only published parents'
);
select public.audit_assert(
  (select count(*) from public.affiliate_product_tags where product_slug like 'audit-rls-%') = 1,
  'product tag policy must expose only published parents'
);
select public.audit_assert(
  (
    select count(*) from public.affiliate_product_auto_topics
    where product_slug like 'audit-rls-%'
  ) = 1,
  'product auto-topic policy must expose only published parents'
);
select public.audit_assert(
  (
    select count(*) from public.affiliate_product_episode_links
    where product_slug like 'audit-rls-%'
  ) = 1,
  'product episode links must require both sides to be published'
);

select public.audit_assert(
  (select count(*) from public.blog_posts where slug like 'audit-rls-%') = 1,
  'blog policy must expose only published parents'
);
select public.audit_assert(
  (select count(*) from public.blog_post_topics where blog_slug like 'audit-rls-%') = 1,
  'blog topic policy must expose only published parents'
);
select public.audit_assert(
  (select count(*) from public.blog_post_sections where blog_slug like 'audit-rls-%') = 1,
  'blog section policy must expose only published parents'
);
select public.audit_assert(
  (
    select count(*) from public.blog_post_section_paragraphs
    where blog_slug like 'audit-rls-%'
  ) = 1,
  'blog paragraph policy must expose only published parents'
);
select public.audit_assert(
  (select count(*) from public.blog_post_references where blog_slug like 'audit-rls-%') = 1,
  'blog reference policy must expose only published parents'
);
select public.audit_assert(
  (
    select count(*) from public.blog_post_related_episodes
    where blog_slug like 'audit-rls-%'
  ) = 1,
  'blog episode links must require both sides to be published'
);
select public.audit_assert(
  (
    select count(*) from public.blog_post_related_affiliate_products
    where blog_slug like 'audit-rls-%'
  ) = 1,
  'blog product links must require both sides to be published'
);

reset role;

insert into public.form_submission_rate_limits (
  action,
  key_hash,
  bucket_start,
  count,
  updated_at
)
values (
  'stale-audit-row',
  repeat('a', 64),
  now() - interval '30 days',
  1,
  now() - interval '30 days'
);

set local role service_role;
select public.increment_form_rate_limit(
  'contact-ip-hour',
  repeat('b', 64),
  date_trunc('hour', now())
);
reset role;

select public.audit_assert(
  not exists (
    select 1 from public.form_submission_rate_limits
    where action = 'stale-audit-row'
  ),
  'stale rate-limit rows were not pruned'
);

rollback;
