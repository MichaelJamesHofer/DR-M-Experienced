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
      raise exception 'Cannot repoint episode audio; missing episode rows: %', missing_slugs;
    end if;

    with expected(slug, previous_url, approved_url) as (
      values
        ('brain-fog-part-1', 'https://anchor.fm/s/10e1b0328/podcast/play/114269977/https%3A%2F%2Fd3ctxlq1ktw2nl.cloudfront.net%2Fstaging%2F2026-0-20%2F416465462-44100-2-550a8bb9b34f.mp3', 'https://content.rss.com/episodes/397420/3050766/dr-m-experienced/2026_08_06_08_58_14_5ecd30b1-aef2-4666-ad49-f8c0f210fea2.mp3'),
        ('brain-fog-part-2', 'https://anchor.fm/s/10e1b0328/podcast/play/114270231/https%3A%2F%2Fd3ctxlq1ktw2nl.cloudfront.net%2Fstaging%2F2026-0-20%2F416465800-44100-2-7f319cbf0397f.mp3', 'https://content.rss.com/episodes/397420/3050765/dr-m-experienced/2026_08_06_08_58_12_56d5c865-9d3e-4c15-943c-095c535ffe7b.mp3'),
        ('episode-3-insomnia', 'https://anchor.fm/s/10e1b0328/podcast/play/117879952/https%3A%2F%2Fd3ctxlq1ktw2nl.cloudfront.net%2Fstaging%2F2026-3-3%2F421308982-44100-2-82d5d3a22b087.mp3', 'https://content.rss.com/episodes/397420/3050764/dr-m-experienced/2026_08_06_08_58_10_29cdf885-f097-4016-91fa-79229beaffe2.mp3'),
        ('episode-4-emf', 'https://anchor.fm/s/10e1b0328/podcast/play/117921586/https%3A%2F%2Fd3ctxlq1ktw2nl.cloudfront.net%2Fstaging%2F2026-3-3%2F421362576-44100-2-9087d508e502c.mp3', 'https://content.rss.com/episodes/397420/3050763/dr-m-experienced/2026_08_06_08_58_08_299310cb-53c0-4de1-88ca-684a25901bc5.mp3'),
        ('episode-5-energy', 'https://anchor.fm/s/10e1b0328/podcast/play/122043282/https%3A%2F%2Fd3ctxlq1ktw2nl.cloudfront.net%2Fstaging%2F2026-5-26%2F426898712-44100-2-c5449a97f5849.mp3', 'https://content.rss.com/episodes/397420/3050762/dr-m-experienced/2026_08_06_08_58_06_7cc0ba78-000a-4bfe-9360-e2526cf972ab.mp3'),
        ('episode-6-concussion-and-pathophysiology', 'https://anchor.fm/s/10e1b0328/podcast/play/122043520/https%3A%2F%2Fd3ctxlq1ktw2nl.cloudfront.net%2Fstaging%2F2026-5-26%2F426898995-44100-2-cec8a1642ebff.mp3', 'https://content.rss.com/episodes/397420/3050761/dr-m-experienced/2026_08_06_08_58_03_e31f1115-3f5b-4192-a929-58eada8d76e1.mp3'),
        ('episode-7-the-brain-on-fire', 'https://anchor.fm/s/10e1b0328/podcast/play/122048195/https%3A%2F%2Fd3ctxlq1ktw2nl.cloudfront.net%2Fstaging%2F2026-5-27%2F426905640-44100-2-7853f297ffd2e.mp3', 'https://content.rss.com/episodes/397420/3050760/dr-m-experienced/2026_08_06_08_58_01_2d87eb57-8e98-435a-a59b-509643963942.mp3')
    )
    select string_agg(
             format('%s (%s)', episodes.slug, coalesce(episodes.audio_url, 'NULL')),
             ', ' order by episodes.slug
           )
      into unexpected_urls
      from expected
      join public.episodes on episodes.slug = expected.slug
     where episodes.audio_url is distinct from expected.previous_url
       and episodes.audio_url is distinct from expected.approved_url;

    if unexpected_urls is not null then
      raise exception 'Refusing to overwrite unexpected episode audio URLs: %', unexpected_urls;
    end if;
  end if;
end
$$;

with expected(slug, approved_url) as (
  values
    ('brain-fog-part-1', 'https://content.rss.com/episodes/397420/3050766/dr-m-experienced/2026_08_06_08_58_14_5ecd30b1-aef2-4666-ad49-f8c0f210fea2.mp3'),
    ('brain-fog-part-2', 'https://content.rss.com/episodes/397420/3050765/dr-m-experienced/2026_08_06_08_58_12_56d5c865-9d3e-4c15-943c-095c535ffe7b.mp3'),
    ('episode-3-insomnia', 'https://content.rss.com/episodes/397420/3050764/dr-m-experienced/2026_08_06_08_58_10_29cdf885-f097-4016-91fa-79229beaffe2.mp3'),
    ('episode-4-emf', 'https://content.rss.com/episodes/397420/3050763/dr-m-experienced/2026_08_06_08_58_08_299310cb-53c0-4de1-88ca-684a25901bc5.mp3'),
    ('episode-5-energy', 'https://content.rss.com/episodes/397420/3050762/dr-m-experienced/2026_08_06_08_58_06_7cc0ba78-000a-4bfe-9360-e2526cf972ab.mp3'),
    ('episode-6-concussion-and-pathophysiology', 'https://content.rss.com/episodes/397420/3050761/dr-m-experienced/2026_08_06_08_58_03_e31f1115-3f5b-4192-a929-58eada8d76e1.mp3'),
    ('episode-7-the-brain-on-fire', 'https://content.rss.com/episodes/397420/3050760/dr-m-experienced/2026_08_06_08_58_01_2d87eb57-8e98-435a-a59b-509643963942.mp3')
)
update public.episodes
   set audio_url = expected.approved_url,
       updated_at = now()
  from expected
 where episodes.slug = expected.slug
   and episodes.audio_url is distinct from expected.approved_url;

do $$
declare
  mismatched text;
begin
  if exists (select 1 from public.episodes) then
    with expected(slug, approved_url) as (
      values
        ('brain-fog-part-1', 'https://content.rss.com/episodes/397420/3050766/dr-m-experienced/2026_08_06_08_58_14_5ecd30b1-aef2-4666-ad49-f8c0f210fea2.mp3'),
        ('brain-fog-part-2', 'https://content.rss.com/episodes/397420/3050765/dr-m-experienced/2026_08_06_08_58_12_56d5c865-9d3e-4c15-943c-095c535ffe7b.mp3'),
        ('episode-3-insomnia', 'https://content.rss.com/episodes/397420/3050764/dr-m-experienced/2026_08_06_08_58_10_29cdf885-f097-4016-91fa-79229beaffe2.mp3'),
        ('episode-4-emf', 'https://content.rss.com/episodes/397420/3050763/dr-m-experienced/2026_08_06_08_58_08_299310cb-53c0-4de1-88ca-684a25901bc5.mp3'),
        ('episode-5-energy', 'https://content.rss.com/episodes/397420/3050762/dr-m-experienced/2026_08_06_08_58_06_7cc0ba78-000a-4bfe-9360-e2526cf972ab.mp3'),
        ('episode-6-concussion-and-pathophysiology', 'https://content.rss.com/episodes/397420/3050761/dr-m-experienced/2026_08_06_08_58_03_e31f1115-3f5b-4192-a929-58eada8d76e1.mp3'),
        ('episode-7-the-brain-on-fire', 'https://content.rss.com/episodes/397420/3050760/dr-m-experienced/2026_08_06_08_58_01_2d87eb57-8e98-435a-a59b-509643963942.mp3')
    )
    select string_agg(
             format('%s (%s)', expected.slug, coalesce(episodes.audio_url, 'MISSING')),
             ', ' order by expected.slug
           )
      into mismatched
      from expected
      left join public.episodes on episodes.slug = expected.slug
     where episodes.slug is null
        or episodes.audio_url is distinct from expected.approved_url;

    if mismatched is not null then
      raise exception 'Episode audio URL postcondition failed: %', mismatched;
    end if;
  end if;
end
$$;

commit;
