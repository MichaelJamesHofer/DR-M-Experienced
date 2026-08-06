begin;

do $$
declare
  missing_slugs text;
  unexpected_urls text;
begin
  if exists (select 1 from public.episodes) then
    with expected(slug) as (
      values
        ('brain-fog-part-1'),
        ('brain-fog-part-2'),
        ('episode-3-insomnia'),
        ('episode-4-emf'),
        ('episode-5-energy'),
        ('episode-6-concussion-and-pathophysiology'),
        ('episode-7-the-brain-on-fire')
    )
    select string_agg(expected.slug, ', ' order by expected.slug)
      into missing_slugs
      from expected
      left join public.episodes on episodes.slug = expected.slug
     where episodes.slug is null;

    if missing_slugs is not null then
      raise exception 'Cannot publish episode thumbnails; missing episode rows: %', missing_slugs;
    end if;

    with expected(slug, previous_url, approved_url) as (
      values
        ('brain-fog-part-1', 'https://vumbnail.com/1156414707.jpg', 'https://drmexperienced.com/images/episodes/brain-fog-part-1.webp'),
        ('brain-fog-part-2', 'https://vumbnail.com/1159441883.jpg', 'https://drmexperienced.com/images/episodes/brain-fog-part-2.webp'),
        ('episode-3-insomnia', 'https://vumbnail.com/1179740758.jpg', 'https://drmexperienced.com/images/episodes/insomnia.webp'),
        ('episode-4-emf', 'https://vumbnail.com/1179956166.jpg', 'https://drmexperienced.com/images/episodes/emf.webp'),
        ('episode-5-energy', 'https://vumbnail.com/1204939658.jpg', 'https://drmexperienced.com/images/episodes/energy-mitochondria.webp'),
        ('episode-6-concussion-and-pathophysiology', 'https://vumbnail.com/1204939692.jpg', 'https://drmexperienced.com/images/episodes/concussion-mechanics.webp'),
        ('episode-7-the-brain-on-fire', 'https://vumbnail.com/1205004739.jpg', 'https://drmexperienced.com/images/episodes/brain-neuroinflammation.webp')
    )
    select string_agg(
             format('%s (%s)', episodes.slug, coalesce(episodes.thumbnail_url, 'NULL')),
             ', ' order by episodes.slug
           )
      into unexpected_urls
      from expected
      join public.episodes on episodes.slug = expected.slug
     where episodes.thumbnail_url is distinct from expected.previous_url
       and episodes.thumbnail_url is distinct from expected.approved_url;

    if unexpected_urls is not null then
      raise exception 'Refusing to overwrite unexpected episode thumbnail URLs: %', unexpected_urls;
    end if;
  end if;
end
$$;

with expected(slug, approved_url) as (
  values
    ('brain-fog-part-1', 'https://drmexperienced.com/images/episodes/brain-fog-part-1.webp'),
    ('brain-fog-part-2', 'https://drmexperienced.com/images/episodes/brain-fog-part-2.webp'),
    ('episode-3-insomnia', 'https://drmexperienced.com/images/episodes/insomnia.webp'),
    ('episode-4-emf', 'https://drmexperienced.com/images/episodes/emf.webp'),
    ('episode-5-energy', 'https://drmexperienced.com/images/episodes/energy-mitochondria.webp'),
    ('episode-6-concussion-and-pathophysiology', 'https://drmexperienced.com/images/episodes/concussion-mechanics.webp'),
    ('episode-7-the-brain-on-fire', 'https://drmexperienced.com/images/episodes/brain-neuroinflammation.webp')
)
update public.episodes
   set thumbnail_url = expected.approved_url,
       updated_at = now()
  from expected
 where episodes.slug = expected.slug
   and episodes.thumbnail_url is distinct from expected.approved_url;

commit;
