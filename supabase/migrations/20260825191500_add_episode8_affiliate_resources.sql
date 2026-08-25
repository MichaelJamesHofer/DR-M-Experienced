-- Add the official product resources named in Episode 8. These are direct
-- product links, not affiliate URLs. Episode associations are inserted only
-- when the canonical Episode 8 row already exists; the later publication
-- migration must insert the same associations after creating that row.
begin;

do $$
declare
  mismatched text;
begin
  if exists (
    select 1
      from public.affiliate_categories
     where slug = 'food-and-nutrition'
       and label <> 'Food & Nutrition'
  ) then
    raise exception 'Refusing to overwrite unexpected food-and-nutrition category.';
  end if;

  with expected(slug, category_slug, brand, name, direct_url) as (
    values
      (
        'humann-turmeric-chews',
        'supplements',
        'HumanN',
        'Turmeric Chews',
        'https://humann.com/products/turmeric-chews'
      ),
      (
        'fgo-turmeric-ginger-tea',
        'food-and-nutrition',
        'FGO / From Great Origins',
        'Turmeric Ginger Tea',
        'https://fromgreatorigins.com/products/turmeric-ginger-tea-bags'
      ),
      (
        'purity-coffee',
        'food-and-nutrition',
        'Purity Coffee',
        'Organic Whole Bean Coffee',
        'https://puritycoffee.com/collections/whole-bean-coffee'
      )
  )
  select string_agg(expected.slug, ', ' order by expected.slug)
    into mismatched
    from expected
    join public.affiliate_products on affiliate_products.slug = expected.slug
   where affiliate_products.category_slug <> expected.category_slug
      or affiliate_products.brand is distinct from expected.brand
      or affiliate_products.name <> expected.name
      or affiliate_products.direct_url is distinct from expected.direct_url
      or affiliate_products.affiliate_url is not null;

  if mismatched is not null then
    raise exception 'Refusing to overwrite unexpected Episode 8 product rows: %', mismatched;
  end if;
end
$$;

insert into public.content_topics (slug, label) values
  ('nutrition', 'nutrition'),
  ('nrf2', 'nrf2')
on conflict (slug) do update set label = excluded.label;

-- Fresh migration stacks do not load seed data until after every migration, so
-- ensure the existing product category is available before adding HumanN.
insert into public.affiliate_categories (slug, label, description, display_order)
values (
  'supplements',
  'Supplements',
  'Supplement dispensaries and product lines connected to functional-medicine and episode follow-up topics.',
  50
)
on conflict (slug) do nothing;

insert into public.affiliate_categories (slug, label, description, display_order)
values (
  'food-and-nutrition',
  'Food & Nutrition',
  $$Food and beverage resources connected to Dr. M's nutrition and brain-health discussions.$$,
  60
)
on conflict (slug) do update set
  label = excluded.label,
  description = excluded.description,
  display_order = excluded.display_order;

insert into public.affiliate_products (
  slug,
  category_slug,
  brand,
  name,
  summary,
  drm_thoughts,
  purchase_note,
  caution_note,
  affiliate_url,
  direct_url,
  coupon_code,
  discount_note,
  sort_order,
  date_added,
  last_reviewed,
  source_note
) values
  (
    'humann-turmeric-chews',
    'supplements',
    'HumanN',
    'Turmeric Chews',
    $$The turmeric and curcumin chew Dr. M names in Episode 8 as one convenient way to include turmeric.$$,
    $$Dr. M mentions HumanN Turmeric Chews while discussing practical ways to include turmeric in a brain-focused food plan. This official product page is provided for listeners who want to research the exact item named in the episode.$$,
    $$Direct official product link; no Dr. M affiliate URL is currently recorded.$$,
    $$Supplement choices are not one-size-fits-all and should be reviewed with an appropriate clinician when relevant.$$,
    null,
    'https://humann.com/products/turmeric-chews',
    null,
    null,
    80,
    '2026-08-25',
    '2026-08-25',
    'Named by Dr. M in Episode 8; official HumanN product page verified 2026-08-25.'
  ),
  (
    'fgo-turmeric-ginger-tea',
    'food-and-nutrition',
    'FGO / From Great Origins',
    'Turmeric Ginger Tea',
    $$The turmeric, ginger, and cinnamon tea Dr. M names in Episode 8 as a food-and-beverage option for turmeric.$$,
    $$Dr. M mentions FGO Turmeric Ginger Tea as a practical alternative to using turmeric only as a spice or supplement. This official product page is provided for listeners who want to research the exact tea named in the episode.$$,
    $$Direct official product link; no Dr. M affiliate URL is currently recorded.$$,
    $$Food, beverage, and supplement choices should be individualized for allergies, medications, and other health considerations.$$,
    null,
    'https://fromgreatorigins.com/products/turmeric-ginger-tea-bags',
    null,
    null,
    90,
    '2026-08-25',
    '2026-08-25',
    'Named by Dr. M in Episode 8; official From Great Origins product page verified 2026-08-25.'
  ),
  (
    'purity-coffee',
    'food-and-nutrition',
    'Purity Coffee',
    'Organic Whole Bean Coffee',
    $$The organic whole-bean coffee brand Dr. M names in Episode 8 while discussing coffee, acrylamide, mold, and product testing.$$,
    $$Dr. M points listeners to Purity Coffee while explaining why he pays attention to how coffee is sourced and tested. The brand also publishes laboratory-testing information for listeners who want to review it.$$,
    $$Direct official product-category link; no Dr. M affiliate URL is currently recorded. Purity's laboratory information is linked in the Episode 8 show notes.$$,
    $$Coffee and caffeine tolerance vary; consider individual sleep, medication, pregnancy, and medical context.$$,
    null,
    'https://puritycoffee.com/collections/whole-bean-coffee',
    null,
    null,
    100,
    '2026-08-25',
    '2026-08-25',
    'Named by Dr. M in Episode 8; official Purity Coffee product and laboratory-information pages verified 2026-08-25.'
  )
on conflict (slug) do update set
  category_slug = excluded.category_slug,
  brand = excluded.brand,
  name = excluded.name,
  summary = excluded.summary,
  drm_thoughts = excluded.drm_thoughts,
  purchase_note = excluded.purchase_note,
  caution_note = excluded.caution_note,
  affiliate_url = excluded.affiliate_url,
  direct_url = excluded.direct_url,
  coupon_code = excluded.coupon_code,
  discount_note = excluded.discount_note,
  sort_order = excluded.sort_order,
  last_reviewed = excluded.last_reviewed,
  source_note = excluded.source_note,
  updated_at = now();

insert into public.affiliate_product_reasons (product_slug, display_order, body) values
  ('humann-turmeric-chews', 10, $$Provides the exact branded turmeric chew named in Episode 8.$$),
  ('humann-turmeric-chews', 20, $$The direct link goes to HumanN's official product page.$$),
  ('humann-turmeric-chews', 30, $$A chew format gives listeners another option to compare with turmeric used as a spice or tea.$$),
  ('fgo-turmeric-ginger-tea', 10, $$Provides the exact branded turmeric tea named in Episode 8.$$),
  ('fgo-turmeric-ginger-tea', 20, $$The direct link goes to From Great Origins' official product page.$$),
  ('fgo-turmeric-ginger-tea', 30, $$A tea format gives listeners another way to compare turmeric options.$$),
  ('purity-coffee', 10, $$Provides the exact coffee brand named in Episode 8.$$),
  ('purity-coffee', 20, $$The direct link goes to Purity Coffee's official whole-bean collection.$$),
  ('purity-coffee', 30, $$Purity publishes a separate laboratory-information page for listeners evaluating its testing claims.$$)
on conflict (product_slug, display_order) do update set body = excluded.body;

insert into public.affiliate_product_use_cases (product_slug, display_order, body) values
  ('humann-turmeric-chews', 10, $$Researching the turmeric chew mentioned in Episode 8$$),
  ('humann-turmeric-chews', 20, $$Comparing turmeric and curcumin formats$$),
  ('humann-turmeric-chews', 30, $$Following the episode's discussion of Nrf2-supportive foods$$),
  ('fgo-turmeric-ginger-tea', 10, $$Researching the turmeric tea mentioned in Episode 8$$),
  ('fgo-turmeric-ginger-tea', 20, $$Comparing food, beverage, and supplement forms of turmeric$$),
  ('fgo-turmeric-ginger-tea', 30, $$Following the episode's brain-health nutrition discussion$$),
  ('purity-coffee', 10, $$Researching the coffee brand mentioned in Episode 8$$),
  ('purity-coffee', 20, $$Comparing organic whole-bean coffee options$$),
  ('purity-coffee', 30, $$Reviewing a brand's published coffee-testing information$$)
on conflict (product_slug, display_order) do update set body = excluded.body;

insert into public.affiliate_product_tags (product_slug, tag_slug) values
  ('humann-turmeric-chews', 'brain-health'),
  ('humann-turmeric-chews', 'nutrition'),
  ('humann-turmeric-chews', 'turmeric'),
  ('humann-turmeric-chews', 'curcumin'),
  ('humann-turmeric-chews', 'supplements'),
  ('fgo-turmeric-ginger-tea', 'brain-health'),
  ('fgo-turmeric-ginger-tea', 'nutrition'),
  ('fgo-turmeric-ginger-tea', 'turmeric'),
  ('fgo-turmeric-ginger-tea', 'ginger'),
  ('fgo-turmeric-ginger-tea', 'tea'),
  ('purity-coffee', 'brain-health'),
  ('purity-coffee', 'nutrition'),
  ('purity-coffee', 'coffee'),
  ('purity-coffee', 'organic'),
  ('purity-coffee', 'food-quality')
on conflict (product_slug, tag_slug) do nothing;

insert into public.affiliate_product_auto_topics (product_slug, topic_slug) values
  ('humann-turmeric-chews', 'nrf2'),
  ('fgo-turmeric-ginger-tea', 'nrf2'),
  ('purity-coffee', 'nutrition')
on conflict (product_slug, topic_slug) do nothing;

insert into public.affiliate_product_episode_links (product_slug, episode_slug, link_reason)
select links.product_slug, links.episode_slug, links.link_reason
  from (values
    ('doctors-supplement-store', 'episode-8-food-and-the-brain', 'brain-health nutrition resources'),
    ('humann-turmeric-chews', 'episode-8-food-and-the-brain', 'turmeric product named in Episode 8'),
    ('fgo-turmeric-ginger-tea', 'episode-8-food-and-the-brain', 'turmeric tea named in Episode 8'),
    ('purity-coffee', 'episode-8-food-and-the-brain', 'coffee brand named in Episode 8')
  ) as links(product_slug, episode_slug, link_reason)
 where exists (
   select 1 from public.episodes where slug = links.episode_slug
 )
   and exists (
     select 1 from public.affiliate_products where slug = links.product_slug
   )
on conflict (product_slug, episode_slug) do update set link_reason = excluded.link_reason;

do $$
declare
  product_count integer;
  reason_count integer;
  use_case_count integer;
  tag_count integer;
  auto_topic_count integer;
  link_count integer;
begin
  select count(*) into product_count
    from public.affiliate_products
   where (slug = 'humann-turmeric-chews'
          and direct_url = 'https://humann.com/products/turmeric-chews'
          and affiliate_url is null)
      or (slug = 'fgo-turmeric-ginger-tea'
          and direct_url = 'https://fromgreatorigins.com/products/turmeric-ginger-tea-bags'
          and affiliate_url is null)
      or (slug = 'purity-coffee'
          and direct_url = 'https://puritycoffee.com/collections/whole-bean-coffee'
          and affiliate_url is null);

  if product_count <> 3 then
    raise exception 'Episode 8 affiliate resource postcondition failed.';
  end if;

  select count(*) into reason_count
    from public.affiliate_product_reasons
   where product_slug in ('humann-turmeric-chews', 'fgo-turmeric-ginger-tea', 'purity-coffee');
  select count(*) into use_case_count
    from public.affiliate_product_use_cases
   where product_slug in ('humann-turmeric-chews', 'fgo-turmeric-ginger-tea', 'purity-coffee');
  select count(*) into tag_count
    from public.affiliate_product_tags
   where product_slug in ('humann-turmeric-chews', 'fgo-turmeric-ginger-tea', 'purity-coffee');
  select count(*) into auto_topic_count
    from public.affiliate_product_auto_topics
   where product_slug in ('humann-turmeric-chews', 'fgo-turmeric-ginger-tea', 'purity-coffee');

  if reason_count <> 9
     or use_case_count <> 9
     or tag_count <> 15
     or auto_topic_count <> 3 then
    raise exception 'Episode 8 affiliate child-row postcondition failed.';
  end if;

  if exists (select 1 from public.episodes where slug = 'episode-8-food-and-the-brain') then
    select count(*) into link_count
      from public.affiliate_product_episode_links
     where episode_slug = 'episode-8-food-and-the-brain'
       and product_slug in (
         'doctors-supplement-store',
         'humann-turmeric-chews',
         'fgo-turmeric-ginger-tea',
         'purity-coffee'
       );

    if link_count <> 4 then
      raise exception 'Episode 8 affiliate relationship postcondition failed.';
    end if;
  end if;
end
$$;

commit;
