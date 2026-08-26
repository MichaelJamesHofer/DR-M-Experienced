-- Give Episodes 1-7 the same owned affiliate-guide path as Episode 8 without
-- overstating which products were actually named in an episode. This migration
-- is safe on a fresh migration stack, where seed data is loaded afterward, and
-- verifies the complete backfill when the published Episode 1-7 rows exist.
begin;

do $$
declare
  existing_episode_count integer;
begin
  select count(*)
    into existing_episode_count
    from public.episodes
   where slug in (
     'brain-fog-part-1',
     'brain-fog-part-2',
     'episode-3-insomnia',
     'episode-4-emf',
     'episode-5-energy',
     'episode-6-concussion-and-pathophysiology',
     'episode-7-the-brain-on-fire'
   );

  if existing_episode_count not in (0, 7) then
    raise exception
      'Episode affiliate-reference backfill expected either zero or all seven older episodes; found %.',
      existing_episode_count;
  end if;

  if existing_episode_count = 7
     and not exists (
       select 1
         from public.affiliate_products
        where slug = 'desbio-dbscript'
     ) then
    raise exception 'Episode affiliate-reference backfill requires the DesBio / DBscript product row.';
  end if;
end
$$;

insert into public.episode_references (
  episode_slug,
  label,
  url,
  coming_soon,
  display_order
)
select desired.episode_slug,
       desired.label,
       desired.url,
       false,
       desired.display_order
  from (values
    ('brain-fog-part-1', 'Affiliate and product guide', 'https://drmexperienced.com/affiliates/', 120),
    ('brain-fog-part-1', 'Related product guide: DesBio / DBscript', 'https://drmexperienced.com/affiliates/#desbio-dbscript', 130),
    ('brain-fog-part-1', 'Related product guide: Best365Labs', 'https://drmexperienced.com/affiliates/#best365labs', 140),
    ('brain-fog-part-2', 'Affiliate and product guide', 'https://drmexperienced.com/affiliates/', 120),
    ('brain-fog-part-2', 'Related product guide: DesBio / DBscript', 'https://drmexperienced.com/affiliates/#desbio-dbscript', 130),
    ('brain-fog-part-2', 'Related product guide: Best365Labs', 'https://drmexperienced.com/affiliates/#best365labs', 140),
    ('episode-3-insomnia', 'Affiliate and product guide', 'https://drmexperienced.com/affiliates/', 120),
    ('episode-3-insomnia', 'Mentioned product guide: BlockBlueLight', 'https://drmexperienced.com/affiliates/#block-blue-light', 130),
    ('episode-3-insomnia', 'Mentioned product guide: DesBio / DBscript', 'https://drmexperienced.com/affiliates/#desbio-dbscript', 140),
    ('episode-4-emf', 'Affiliate and product guide', 'https://drmexperienced.com/affiliates/', 120),
    ('episode-4-emf', 'Mentioned product guide: Airestech', 'https://drmexperienced.com/affiliates/#airestech', 130),
    ('episode-4-emf', 'Related product guide: BlockBlueLight', 'https://drmexperienced.com/affiliates/#block-blue-light', 140),
    ('episode-4-emf', 'Related product guide: Safe Living Technologies', 'https://drmexperienced.com/affiliates/#safe-living-technologies', 150),
    ('episode-5-energy', 'Affiliate and product guide', 'https://drmexperienced.com/affiliates/', 120),
    ('episode-5-energy', 'Related product guide: Best365Labs', 'https://drmexperienced.com/affiliates/#best365labs', 130),
    ('episode-6-concussion-and-pathophysiology', 'Affiliate and product guide', 'https://drmexperienced.com/affiliates/', 120),
    ('episode-7-the-brain-on-fire', 'Affiliate and product guide', 'https://drmexperienced.com/affiliates/', 120)
  ) as desired(episode_slug, label, url, display_order)
  join public.episodes on episodes.slug = desired.episode_slug
on conflict (episode_slug, url) do update set
  label = excluded.label,
  coming_soon = excluded.coming_soon,
  display_order = excluded.display_order;

update public.episode_section_paragraphs
   set body = case
     when episode_slug = 'episode-3-insomnia' then
       'Discusses blue-light strategies, evening habits, morning light and daytime exercise, and cautious use of melatonin and homeopathic options, with current product-guide links collected in the episode resources.'
     when episode_slug = 'episode-4-emf' then
       'Practical reduction strategies: hardwiring, nighttime WiFi habits, meter-based assessment, smart-meter choices, and current links collected in the episode resources and product guide.'
   end
 where (episode_slug, section_display_order, display_order) in (
   ('episode-3-insomnia', 30, 10),
   ('episode-4-emf', 30, 10)
 );

insert into public.affiliate_product_episode_links (
  product_slug,
  episode_slug,
  link_reason
)
select 'desbio-dbscript',
       'episode-3-insomnia',
       'DesBio sleep-support products named in Episode 3'
 where exists (
   select 1 from public.episodes where slug = 'episode-3-insomnia'
 )
   and exists (
     select 1 from public.affiliate_products where slug = 'desbio-dbscript'
   )
on conflict (product_slug, episode_slug) do update set
  link_reason = excluded.link_reason;

do $$
declare
  existing_episode_count integer;
  missing_reference_count integer;
begin
  select count(*)
    into existing_episode_count
    from public.episodes
   where slug in (
     'brain-fog-part-1',
     'brain-fog-part-2',
     'episode-3-insomnia',
     'episode-4-emf',
     'episode-5-energy',
     'episode-6-concussion-and-pathophysiology',
     'episode-7-the-brain-on-fire'
   );

  if existing_episode_count = 7 then
    with desired(episode_slug, label, url, display_order) as (
      values
        ('brain-fog-part-1', 'Affiliate and product guide', 'https://drmexperienced.com/affiliates/', 120),
        ('brain-fog-part-1', 'Related product guide: DesBio / DBscript', 'https://drmexperienced.com/affiliates/#desbio-dbscript', 130),
        ('brain-fog-part-1', 'Related product guide: Best365Labs', 'https://drmexperienced.com/affiliates/#best365labs', 140),
        ('brain-fog-part-2', 'Affiliate and product guide', 'https://drmexperienced.com/affiliates/', 120),
        ('brain-fog-part-2', 'Related product guide: DesBio / DBscript', 'https://drmexperienced.com/affiliates/#desbio-dbscript', 130),
        ('brain-fog-part-2', 'Related product guide: Best365Labs', 'https://drmexperienced.com/affiliates/#best365labs', 140),
        ('episode-3-insomnia', 'Affiliate and product guide', 'https://drmexperienced.com/affiliates/', 120),
        ('episode-3-insomnia', 'Mentioned product guide: BlockBlueLight', 'https://drmexperienced.com/affiliates/#block-blue-light', 130),
        ('episode-3-insomnia', 'Mentioned product guide: DesBio / DBscript', 'https://drmexperienced.com/affiliates/#desbio-dbscript', 140),
        ('episode-4-emf', 'Affiliate and product guide', 'https://drmexperienced.com/affiliates/', 120),
        ('episode-4-emf', 'Mentioned product guide: Airestech', 'https://drmexperienced.com/affiliates/#airestech', 130),
        ('episode-4-emf', 'Related product guide: BlockBlueLight', 'https://drmexperienced.com/affiliates/#block-blue-light', 140),
        ('episode-4-emf', 'Related product guide: Safe Living Technologies', 'https://drmexperienced.com/affiliates/#safe-living-technologies', 150),
        ('episode-5-energy', 'Affiliate and product guide', 'https://drmexperienced.com/affiliates/', 120),
        ('episode-5-energy', 'Related product guide: Best365Labs', 'https://drmexperienced.com/affiliates/#best365labs', 130),
        ('episode-6-concussion-and-pathophysiology', 'Affiliate and product guide', 'https://drmexperienced.com/affiliates/', 120),
        ('episode-7-the-brain-on-fire', 'Affiliate and product guide', 'https://drmexperienced.com/affiliates/', 120)
    )
    select count(*)
      into missing_reference_count
      from desired
     where not exists (
       select 1
         from public.episode_references
        where episode_references.episode_slug = desired.episode_slug
          and episode_references.label = desired.label
          and episode_references.url = desired.url
          and episode_references.coming_soon = false
          and episode_references.display_order = desired.display_order
     );

    if missing_reference_count <> 0 then
      raise exception
        'Episode affiliate-reference postcondition failed for % expected rows.',
        missing_reference_count;
    end if;

    if not exists (
      select 1
        from public.affiliate_product_episode_links
       where product_slug = 'desbio-dbscript'
         and episode_slug = 'episode-3-insomnia'
         and link_reason = 'DesBio sleep-support products named in Episode 3'
    ) then
      raise exception 'Episode 3 DesBio relationship postcondition failed.';
    end if;

    if not exists (
      select 1
        from public.episode_section_paragraphs
       where episode_slug = 'episode-3-insomnia'
         and section_display_order = 30
         and display_order = 10
         and body = 'Discusses blue-light strategies, evening habits, morning light and daytime exercise, and cautious use of melatonin and homeopathic options, with current product-guide links collected in the episode resources.'
    ) then
      raise exception 'Episode 3 resource-note correction postcondition failed.';
    end if;

    if not exists (
      select 1
        from public.episode_section_paragraphs
       where episode_slug = 'episode-4-emf'
         and section_display_order = 30
         and display_order = 10
         and body = 'Practical reduction strategies: hardwiring, nighttime WiFi habits, meter-based assessment, smart-meter choices, and current links collected in the episode resources and product guide.'
    ) then
      raise exception 'Episode 4 resource-note correction postcondition failed.';
    end if;
  end if;
end
$$;

commit;
