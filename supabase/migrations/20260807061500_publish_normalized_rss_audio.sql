-- Project the seven verified RSS.com normalized-audio enclosure URLs.
-- This migration does not claim downstream Apple or Spotify refresh.
begin;

do $$
declare
  missing_slugs text;
  unexpected_urls text;
begin
  if exists (select 1 from public.episodes) then
    with expected(slug, previous_url, approved_url) as (
      values
      ('brain-fog-part-1', 'https://content.rss.com/episodes/397420/3050766/dr-m-experienced/2026_08_06_08_58_14_5ecd30b1-aef2-4666-ad49-f8c0f210fea2.mp3', 'https://content.rss.com/episodes/397420/3050766/dr-m-experienced/2026_08_07_05_37_14_57d1a0c9-5f80-4880-bc5d-57f7eeef7cb5.mp3'),
      ('brain-fog-part-2', 'https://content.rss.com/episodes/397420/3050765/dr-m-experienced/2026_08_06_08_58_12_56d5c865-9d3e-4c15-943c-095c535ffe7b.mp3', 'https://content.rss.com/episodes/397420/3050765/dr-m-experienced/2026_08_07_05_41_20_c5dc584a-9799-404f-96e5-66fd2958ad94.mp3'),
      ('episode-3-insomnia', 'https://content.rss.com/episodes/397420/3050764/dr-m-experienced/2026_08_06_08_58_10_29cdf885-f097-4016-91fa-79229beaffe2.mp3', 'https://content.rss.com/episodes/397420/3050764/dr-m-experienced/2026_08_07_05_42_30_c6bd9b48-095f-4ee9-9eda-ebb0d7956d09.mp3'),
      ('episode-4-emf', 'https://content.rss.com/episodes/397420/3050763/dr-m-experienced/2026_08_06_08_58_08_299310cb-53c0-4de1-88ca-684a25901bc5.mp3', 'https://content.rss.com/episodes/397420/3050763/dr-m-experienced/2026_08_07_05_43_51_32e2ccc6-04c8-4592-9e50-aa8d48eb9cb8.mp3'),
      ('episode-5-energy', 'https://content.rss.com/episodes/397420/3050762/dr-m-experienced/2026_08_06_08_58_06_7cc0ba78-000a-4bfe-9360-e2526cf972ab.mp3', 'https://content.rss.com/episodes/397420/3050762/dr-m-experienced/2026_08_07_05_46_23_1de2f4f3-aeab-457a-a02d-2bf61108132d.mp3'),
      ('episode-6-concussion-and-pathophysiology', 'https://content.rss.com/episodes/397420/3050761/dr-m-experienced/2026_08_06_08_58_03_e31f1115-3f5b-4192-a929-58eada8d76e1.mp3', 'https://content.rss.com/episodes/397420/3050761/dr-m-experienced/2026_08_07_05_55_46_4806f336-163e-4ffb-b446-e4e03bb81013.mp3'),
      ('episode-7-the-brain-on-fire', 'https://content.rss.com/episodes/397420/3050760/dr-m-experienced/2026_08_06_08_58_01_2d87eb57-8e98-435a-a59b-509643963942.mp3', 'https://content.rss.com/episodes/397420/3050760/dr-m-experienced/2026_08_07_05_56_36_52e27ebd-6648-4ff7-adf3-f9f7731c1b86.mp3')
    )
    select string_agg(expected.slug, ', ' order by expected.slug)
      into missing_slugs
      from expected
      left join public.episodes on episodes.slug = expected.slug
     where episodes.slug is null;

    if missing_slugs is not null then
      raise exception 'Cannot publish normalized RSS audio; missing episode rows: %', missing_slugs;
    end if;

    with expected(slug, previous_url, approved_url) as (
      values
      ('brain-fog-part-1', 'https://content.rss.com/episodes/397420/3050766/dr-m-experienced/2026_08_06_08_58_14_5ecd30b1-aef2-4666-ad49-f8c0f210fea2.mp3', 'https://content.rss.com/episodes/397420/3050766/dr-m-experienced/2026_08_07_05_37_14_57d1a0c9-5f80-4880-bc5d-57f7eeef7cb5.mp3'),
      ('brain-fog-part-2', 'https://content.rss.com/episodes/397420/3050765/dr-m-experienced/2026_08_06_08_58_12_56d5c865-9d3e-4c15-943c-095c535ffe7b.mp3', 'https://content.rss.com/episodes/397420/3050765/dr-m-experienced/2026_08_07_05_41_20_c5dc584a-9799-404f-96e5-66fd2958ad94.mp3'),
      ('episode-3-insomnia', 'https://content.rss.com/episodes/397420/3050764/dr-m-experienced/2026_08_06_08_58_10_29cdf885-f097-4016-91fa-79229beaffe2.mp3', 'https://content.rss.com/episodes/397420/3050764/dr-m-experienced/2026_08_07_05_42_30_c6bd9b48-095f-4ee9-9eda-ebb0d7956d09.mp3'),
      ('episode-4-emf', 'https://content.rss.com/episodes/397420/3050763/dr-m-experienced/2026_08_06_08_58_08_299310cb-53c0-4de1-88ca-684a25901bc5.mp3', 'https://content.rss.com/episodes/397420/3050763/dr-m-experienced/2026_08_07_05_43_51_32e2ccc6-04c8-4592-9e50-aa8d48eb9cb8.mp3'),
      ('episode-5-energy', 'https://content.rss.com/episodes/397420/3050762/dr-m-experienced/2026_08_06_08_58_06_7cc0ba78-000a-4bfe-9360-e2526cf972ab.mp3', 'https://content.rss.com/episodes/397420/3050762/dr-m-experienced/2026_08_07_05_46_23_1de2f4f3-aeab-457a-a02d-2bf61108132d.mp3'),
      ('episode-6-concussion-and-pathophysiology', 'https://content.rss.com/episodes/397420/3050761/dr-m-experienced/2026_08_06_08_58_03_e31f1115-3f5b-4192-a929-58eada8d76e1.mp3', 'https://content.rss.com/episodes/397420/3050761/dr-m-experienced/2026_08_07_05_55_46_4806f336-163e-4ffb-b446-e4e03bb81013.mp3'),
      ('episode-7-the-brain-on-fire', 'https://content.rss.com/episodes/397420/3050760/dr-m-experienced/2026_08_06_08_58_01_2d87eb57-8e98-435a-a59b-509643963942.mp3', 'https://content.rss.com/episodes/397420/3050760/dr-m-experienced/2026_08_07_05_56_36_52e27ebd-6648-4ff7-adf3-f9f7731c1b86.mp3')
    )
    select string_agg(format('%s (%s)', episodes.slug, coalesce(episodes.audio_url, 'NULL')), ', ' order by episodes.slug)
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

with expected(slug, previous_url, approved_url) as (
  values
      ('brain-fog-part-1', 'https://content.rss.com/episodes/397420/3050766/dr-m-experienced/2026_08_06_08_58_14_5ecd30b1-aef2-4666-ad49-f8c0f210fea2.mp3', 'https://content.rss.com/episodes/397420/3050766/dr-m-experienced/2026_08_07_05_37_14_57d1a0c9-5f80-4880-bc5d-57f7eeef7cb5.mp3'),
      ('brain-fog-part-2', 'https://content.rss.com/episodes/397420/3050765/dr-m-experienced/2026_08_06_08_58_12_56d5c865-9d3e-4c15-943c-095c535ffe7b.mp3', 'https://content.rss.com/episodes/397420/3050765/dr-m-experienced/2026_08_07_05_41_20_c5dc584a-9799-404f-96e5-66fd2958ad94.mp3'),
      ('episode-3-insomnia', 'https://content.rss.com/episodes/397420/3050764/dr-m-experienced/2026_08_06_08_58_10_29cdf885-f097-4016-91fa-79229beaffe2.mp3', 'https://content.rss.com/episodes/397420/3050764/dr-m-experienced/2026_08_07_05_42_30_c6bd9b48-095f-4ee9-9eda-ebb0d7956d09.mp3'),
      ('episode-4-emf', 'https://content.rss.com/episodes/397420/3050763/dr-m-experienced/2026_08_06_08_58_08_299310cb-53c0-4de1-88ca-684a25901bc5.mp3', 'https://content.rss.com/episodes/397420/3050763/dr-m-experienced/2026_08_07_05_43_51_32e2ccc6-04c8-4592-9e50-aa8d48eb9cb8.mp3'),
      ('episode-5-energy', 'https://content.rss.com/episodes/397420/3050762/dr-m-experienced/2026_08_06_08_58_06_7cc0ba78-000a-4bfe-9360-e2526cf972ab.mp3', 'https://content.rss.com/episodes/397420/3050762/dr-m-experienced/2026_08_07_05_46_23_1de2f4f3-aeab-457a-a02d-2bf61108132d.mp3'),
      ('episode-6-concussion-and-pathophysiology', 'https://content.rss.com/episodes/397420/3050761/dr-m-experienced/2026_08_06_08_58_03_e31f1115-3f5b-4192-a929-58eada8d76e1.mp3', 'https://content.rss.com/episodes/397420/3050761/dr-m-experienced/2026_08_07_05_55_46_4806f336-163e-4ffb-b446-e4e03bb81013.mp3'),
      ('episode-7-the-brain-on-fire', 'https://content.rss.com/episodes/397420/3050760/dr-m-experienced/2026_08_06_08_58_01_2d87eb57-8e98-435a-a59b-509643963942.mp3', 'https://content.rss.com/episodes/397420/3050760/dr-m-experienced/2026_08_07_05_56_36_52e27ebd-6648-4ff7-adf3-f9f7731c1b86.mp3')
)
update public.episodes
   set audio_url = expected.approved_url,
       updated_at = now()
  from expected
 where episodes.slug = expected.slug
   and episodes.audio_url = expected.previous_url;

do $$
declare
  mismatched text;
begin
  if exists (select 1 from public.episodes) then
    with expected(slug, previous_url, approved_url) as (
      values
      ('brain-fog-part-1', 'https://content.rss.com/episodes/397420/3050766/dr-m-experienced/2026_08_06_08_58_14_5ecd30b1-aef2-4666-ad49-f8c0f210fea2.mp3', 'https://content.rss.com/episodes/397420/3050766/dr-m-experienced/2026_08_07_05_37_14_57d1a0c9-5f80-4880-bc5d-57f7eeef7cb5.mp3'),
      ('brain-fog-part-2', 'https://content.rss.com/episodes/397420/3050765/dr-m-experienced/2026_08_06_08_58_12_56d5c865-9d3e-4c15-943c-095c535ffe7b.mp3', 'https://content.rss.com/episodes/397420/3050765/dr-m-experienced/2026_08_07_05_41_20_c5dc584a-9799-404f-96e5-66fd2958ad94.mp3'),
      ('episode-3-insomnia', 'https://content.rss.com/episodes/397420/3050764/dr-m-experienced/2026_08_06_08_58_10_29cdf885-f097-4016-91fa-79229beaffe2.mp3', 'https://content.rss.com/episodes/397420/3050764/dr-m-experienced/2026_08_07_05_42_30_c6bd9b48-095f-4ee9-9eda-ebb0d7956d09.mp3'),
      ('episode-4-emf', 'https://content.rss.com/episodes/397420/3050763/dr-m-experienced/2026_08_06_08_58_08_299310cb-53c0-4de1-88ca-684a25901bc5.mp3', 'https://content.rss.com/episodes/397420/3050763/dr-m-experienced/2026_08_07_05_43_51_32e2ccc6-04c8-4592-9e50-aa8d48eb9cb8.mp3'),
      ('episode-5-energy', 'https://content.rss.com/episodes/397420/3050762/dr-m-experienced/2026_08_06_08_58_06_7cc0ba78-000a-4bfe-9360-e2526cf972ab.mp3', 'https://content.rss.com/episodes/397420/3050762/dr-m-experienced/2026_08_07_05_46_23_1de2f4f3-aeab-457a-a02d-2bf61108132d.mp3'),
      ('episode-6-concussion-and-pathophysiology', 'https://content.rss.com/episodes/397420/3050761/dr-m-experienced/2026_08_06_08_58_03_e31f1115-3f5b-4192-a929-58eada8d76e1.mp3', 'https://content.rss.com/episodes/397420/3050761/dr-m-experienced/2026_08_07_05_55_46_4806f336-163e-4ffb-b446-e4e03bb81013.mp3'),
      ('episode-7-the-brain-on-fire', 'https://content.rss.com/episodes/397420/3050760/dr-m-experienced/2026_08_06_08_58_01_2d87eb57-8e98-435a-a59b-509643963942.mp3', 'https://content.rss.com/episodes/397420/3050760/dr-m-experienced/2026_08_07_05_56_36_52e27ebd-6648-4ff7-adf3-f9f7731c1b86.mp3')
    )
    select string_agg(format('%s (%s)', expected.slug, coalesce(episodes.audio_url, 'MISSING')), ', ' order by expected.slug)
      into mismatched
      from expected
      left join public.episodes on episodes.slug = expected.slug
     where episodes.slug is null
        or episodes.audio_url is distinct from expected.approved_url;

    if mismatched is not null then
      raise exception 'Normalized RSS audio URL postcondition failed: %', mismatched;
    end if;
  end if;
end
$$;

commit;
