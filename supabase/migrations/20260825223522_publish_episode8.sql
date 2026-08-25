-- Publish Episode 8 after RSS.com, Spotify, YouTube, and Vimeo returned
-- verified public identities.
begin;

do $$
begin
  if exists (
    select 1
      from public.episodes
     where episode_number = 8
       and slug <> 'episode-8-food-and-the-brain'
  ) then
    raise exception 'Refusing to publish Episode 8: episode number 8 belongs to another slug.';
  end if;

  if exists (
    select 1
      from public.episodes
     where slug = 'episode-8-food-and-the-brain'
       and episode_number <> 8
  ) then
    raise exception 'Refusing to publish Episode 8: the canonical slug has another episode number.';
  end if;

  if exists (
    select 1
      from public.episodes
     where slug <> 'episode-8-food-and-the-brain'
       and audio_url = 'https://content.rss.com/episodes/397420/3096546/dr-m-experienced/2026_08_25_22_20_41_83110c46-278d-4dc5-96e7-d38abd74172a.mp3'
  ) then
    raise exception 'Refusing to publish Episode 8: its RSS enclosure already belongs to another slug.';
  end if;

  if exists (
    select 1
      from public.episodes
     where slug <> 'episode-8-food-and-the-brain'
       and vimeo_id = '1221293570'
  ) then
    raise exception 'Refusing to publish Episode 8: its Vimeo identity already belongs to another slug.';
  end if;

  if exists (
    select 1
      from public.episodes
     where slug <> 'episode-8-food-and-the-brain'
       and spotify_id = '7oYwjErc5TXpocbRFgzvH0'
  ) then
    raise exception 'Refusing to publish Episode 8: its Spotify identity already belongs to another slug.';
  end if;

  if exists (
    select 1
      from public.episodes
     where slug <> 'episode-8-food-and-the-brain'
       and youtube_id = 'ax5BSELnBbo'
  ) then
    raise exception 'Refusing to publish Episode 8: its YouTube identity already belongs to another slug.';
  end if;

  if exists (
    select 1
      from public.episodes
     where slug = 'episode-8-food-and-the-brain'
       and (
         title <> 'Food and the Brain - Eating for Brain Health and Concussion Recovery'
         or publish_date <> date '2026-08-25'
         or duration_minutes is distinct from 22
         or summary <> 'Dr. Musnick explains how he approaches eating for brain sharpness and concussion recovery, covering apigenin, choline, omega-3s, Nrf2-supportive foods, turmeric, quercetin, rosemary, protein, blood sugar, the microbiome, and selected elimination strategies.'
         or thumbnail_url is distinct from 'https://drmexperienced.com/images/episodes/food-and-the-brain.webp'
         or status not in ('draft', 'published')
       )
  ) then
    raise exception 'Refusing to overwrite unexpected Episode 8 editorial or publication state.';
  end if;

  if exists (
    select 1
      from public.episodes
     where slug = 'episode-8-food-and-the-brain'
       and audio_url is not null
       and audio_url <> 'https://content.rss.com/episodes/397420/3096546/dr-m-experienced/2026_08_25_22_20_41_83110c46-278d-4dc5-96e7-d38abd74172a.mp3'
  ) then
    raise exception 'Refusing to overwrite an unexpected Episode 8 RSS enclosure.';
  end if;

  if exists (
    select 1
      from public.episodes
     where slug = 'episode-8-food-and-the-brain'
       and vimeo_id is not null
       and vimeo_id <> '1221293570'
  ) then
    raise exception 'Refusing to overwrite an unexpected Episode 8 Vimeo identity.';
  end if;

  if exists (
    select 1
      from public.episodes
     where slug = 'episode-8-food-and-the-brain'
       and youtube_id is not null
       and youtube_id <> 'ax5BSELnBbo'
  ) then
    raise exception 'Refusing to overwrite an unexpected Episode 8 YouTube identity.';
  end if;

  if exists (
    select 1
      from public.episodes
     where slug = 'episode-8-food-and-the-brain'
       and spotify_id is not null
       and spotify_id <> '7oYwjErc5TXpocbRFgzvH0'
  ) then
    raise exception 'Refusing to overwrite an unexpected Episode 8 Spotify identity.';
  end if;
end
$$;

insert into public.content_topics (slug, label) values
  ('brain-health', 'brain-health'),
  ('nutrition', 'nutrition'),
  ('food-as-medicine', 'food-as-medicine'),
  ('concussion', 'concussion'),
  ('neuroinflammation', 'neuroinflammation'),
  ('functional-medicine', 'functional-medicine'),
  ('microglia', 'microglia'),
  ('blood-sugar', 'blood-sugar'),
  ('gut-brain-axis', 'gut-brain-axis'),
  ('nrf2', 'nrf2')
on conflict (slug) do update set label = excluded.label;

insert into public.episodes (
  slug,
  episode_number,
  title,
  publish_date,
  duration_minutes,
  summary,
  audio_url,
  vimeo_id,
  spotify_id,
  youtube_id,
  thumbnail_url,
  status
) values (
  'episode-8-food-and-the-brain',
  8,
  'Food and the Brain - Eating for Brain Health and Concussion Recovery',
  '2026-08-25',
  22,
  'Dr. Musnick explains how he approaches eating for brain sharpness and concussion recovery, covering apigenin, choline, omega-3s, Nrf2-supportive foods, turmeric, quercetin, rosemary, protein, blood sugar, the microbiome, and selected elimination strategies.',
  'https://content.rss.com/episodes/397420/3096546/dr-m-experienced/2026_08_25_22_20_41_83110c46-278d-4dc5-96e7-d38abd74172a.mp3',
  '1221293570',
  '7oYwjErc5TXpocbRFgzvH0',
  'ax5BSELnBbo',
  'https://drmexperienced.com/images/episodes/food-and-the-brain.webp',
  'published'
)
on conflict (slug) do update set
  episode_number = excluded.episode_number,
  title = excluded.title,
  publish_date = excluded.publish_date,
  duration_minutes = excluded.duration_minutes,
  summary = excluded.summary,
  audio_url = excluded.audio_url,
  vimeo_id = excluded.vimeo_id,
  spotify_id = excluded.spotify_id,
  youtube_id = excluded.youtube_id,
  thumbnail_url = excluded.thumbnail_url,
  status = excluded.status,
  updated_at = now()
where (
  episodes.episode_number,
  episodes.title,
  episodes.publish_date,
  episodes.duration_minutes,
  episodes.summary,
  episodes.audio_url,
  episodes.vimeo_id,
  episodes.spotify_id,
  episodes.youtube_id,
  episodes.thumbnail_url,
  episodes.status
) is distinct from (
  excluded.episode_number,
  excluded.title,
  excluded.publish_date,
  excluded.duration_minutes,
  excluded.summary,
  excluded.audio_url,
  excluded.vimeo_id,
  excluded.spotify_id,
  excluded.youtube_id,
  excluded.thumbnail_url,
  excluded.status
);

insert into public.episode_topics (episode_slug, topic_slug) values
  ('episode-8-food-and-the-brain', 'brain-health'),
  ('episode-8-food-and-the-brain', 'nutrition'),
  ('episode-8-food-and-the-brain', 'food-as-medicine'),
  ('episode-8-food-and-the-brain', 'concussion'),
  ('episode-8-food-and-the-brain', 'neuroinflammation'),
  ('episode-8-food-and-the-brain', 'functional-medicine'),
  ('episode-8-food-and-the-brain', 'microglia'),
  ('episode-8-food-and-the-brain', 'blood-sugar'),
  ('episode-8-food-and-the-brain', 'gut-brain-axis'),
  ('episode-8-food-and-the-brain', 'nrf2')
on conflict (episode_slug, topic_slug) do nothing;

insert into public.episode_references (episode_slug, label, url, display_order) values
  ('episode-8-food-and-the-brain', 'Watch on Vimeo', 'https://vimeo.com/1221293570', 10),
  ('episode-8-food-and-the-brain', 'Listen on Spotify', 'https://open.spotify.com/episode/7oYwjErc5TXpocbRFgzvH0', 20),
  ('episode-8-food-and-the-brain', 'Watch on YouTube', 'https://youtu.be/ax5BSELnBbo', 30),
  ('episode-8-food-and-the-brain', 'Related: The Brain on Fire', 'https://drmexperienced.com/episodes/episode-7-the-brain-on-fire/', 100),
  ('episode-8-food-and-the-brain', 'Related: Concussion - What Happens in the Brain', 'https://drmexperienced.com/episodes/episode-6-concussion-and-pathophysiology/', 110),
  ('episode-8-food-and-the-brain', 'Affiliate and product guide', 'https://drmexperienced.com/affiliates/', 120),
  ('episode-8-food-and-the-brain', 'Dr. M Experienced Supplement Dispensary', 'https://drmexperienced.com/affiliates/#doctors-supplement-store', 130),
  ('episode-8-food-and-the-brain', 'Request the Healthy Brain Diet handout', 'https://drmexperienced.com/contact/', 140),
  ('episode-8-food-and-the-brain', 'HumanN Turmeric Chews', 'https://drmexperienced.com/affiliates/#humann-turmeric-chews', 150),
  ('episode-8-food-and-the-brain', 'FGO Turmeric Ginger Tea', 'https://drmexperienced.com/affiliates/#fgo-turmeric-ginger-tea', 160),
  ('episode-8-food-and-the-brain', 'Purity Coffee', 'https://drmexperienced.com/affiliates/#purity-coffee', 170),
  ('episode-8-food-and-the-brain', 'Purity laboratory information', 'https://puritycoffee.com/pages/independent-laboratory-tests', 180)
on conflict (episode_slug, url) do update set
  label = excluded.label,
  coming_soon = false,
  display_order = excluded.display_order;

insert into public.episode_key_takeaways (episode_slug, display_order, body) values
  ('episode-8-food-and-the-brain', 10, 'Dr. M organizes brain-focused nutrition around inflammatory balance, neuronal membrane support, steadier blood sugar, and a diverse gut microbiome.'),
  ('episode-8-food-and-the-brain', 20, 'Foods discussed include parsley and apigenin, wild blueberries, choline-rich eggs, lower-mercury seafood, broccoli sprouts, green tea, turmeric, quercetin-rich produce, and rosemary.'),
  ('episode-8-food-and-the-brain', 30, 'Protein quality, vegetable diversity, fiber, and food preparation are recurring practical themes throughout the episode.'),
  ('episode-8-food-and-the-brain', 40, 'The episode discusses limiting heavily browned foods, selected acrylamide and heavy-metal exposures, high-sugar foods, BPA and plastics, MSG, and aspartame.'),
  ('episode-8-food-and-the-brain', 50, 'Elimination diets, ketogenic eating, supplements, and fasting are presented as approaches to individualize with a qualified clinician rather than universal instructions.')
on conflict (episode_slug, display_order) do update set body = excluded.body;

insert into public.episode_checklist_items (episode_slug, display_order, body) values
  ('episode-8-food-and-the-brain', 10, 'Build a parsley and wild-blueberry smoothie with an individually appropriate protein source.'),
  ('episode-8-food-and-the-brain', 20, 'Include varied vegetables and fiber-rich foods to support microbiome diversity.'),
  ('episode-8-food-and-the-brain', 30, 'Review choline sources, protein quality, and lower-mercury seafood choices.'),
  ('episode-8-food-and-the-brain', 40, 'Pay attention to heavily browned or deep-fried foods, added sugar, large predatory fish, and plastic food packaging.'),
  ('episode-8-food-and-the-brain', 50, 'Discuss major elimination, ketogenic, fasting, or supplement changes with an appropriate clinician.')
on conflict (episode_slug, display_order) do update set body = excluded.body;

insert into public.episode_sections (episode_slug, display_order, title) values
  ('episode-8-food-and-the-brain', 10, 'Food, microglia, and neuronal membranes'),
  ('episode-8-food-and-the-brain', 20, 'Phytonutrients and practical recipes'),
  ('episode-8-food-and-the-brain', 30, 'Protein, blood sugar, and the microbiome'),
  ('episode-8-food-and-the-brain', 40, 'When stricter approaches need individual guidance')
on conflict (episode_slug, display_order) do update set title = excluded.title;

insert into public.episode_section_paragraphs (
  episode_slug,
  section_display_order,
  display_order,
  body
) values
  ('episode-8-food-and-the-brain', 10, 10, 'Dr. M connects food choices with inflammatory M1 and repair-oriented M2 microglial activity, beginning with apigenin-rich parsley and a wild-blueberry smoothie.'),
  ('episode-8-food-and-the-brain', 10, 20, 'The discussion then turns to choline, omega-3 DHA, and other dietary building blocks involved in neuronal membranes.'),
  ('episode-8-food-and-the-brain', 20, 10, 'Broccoli sprouts, green tea, turmeric, quercetin-rich capers, red onions and apples, and rosemary appear in the episode''s discussion of Nrf2 signaling and brain-focused eating.'),
  ('episode-8-food-and-the-brain', 20, 20, 'Dr. M shares practical ideas including a parsley smoothie and a cilantro-parsley pesto, and names HumanN Turmeric Chews and FGO Turmeric Ginger Tea as products listeners may want to research.'),
  ('episode-8-food-and-the-brain', 30, 10, 'The episode emphasizes protein quality, lower-mercury fish, vegetable diversity, fiber, steadier blood sugar, and a diverse gut microbiome.'),
  ('episode-8-food-and-the-brain', 30, 20, 'It also examines heavily browned foods, advanced glycation end products, acrylamide, plastics, MSG, aspartame, and the sourcing and testing questions Dr. M considers when discussing coffee.'),
  ('episode-8-food-and-the-brain', 40, 10, 'Dr. M explains why he may consider gluten-free, cow-dairy-free, low-lectin, ketogenic, fasting, or other selected elimination approaches in some neurological and concussion cases.'),
  ('episode-8-food-and-the-brain', 40, 20, 'These approaches are not universal. Major dietary changes, supplements, fasting, and elimination or ketogenic diets should be reviewed with a qualified healthcare professional.')
on conflict (episode_slug, section_display_order, display_order) do update set body = excluded.body;

insert into public.affiliate_product_episode_links (product_slug, episode_slug, link_reason)
select links.product_slug, links.episode_slug, links.link_reason
  from (values
    ('doctors-supplement-store', 'episode-8-food-and-the-brain', 'brain-health nutrition resources'),
    ('humann-turmeric-chews', 'episode-8-food-and-the-brain', 'turmeric product named in Episode 8'),
    ('fgo-turmeric-ginger-tea', 'episode-8-food-and-the-brain', 'turmeric tea named in Episode 8'),
    ('purity-coffee', 'episode-8-food-and-the-brain', 'coffee brand named in Episode 8')
  ) as links(product_slug, episode_slug, link_reason)
 where exists (
   select 1 from public.affiliate_products where slug = links.product_slug
 )
on conflict (product_slug, episode_slug) do update set link_reason = excluded.link_reason;

do $$
declare
  unexpected_reference_count integer;
begin
  if (
    select count(*)
      from public.episodes
     where slug = 'episode-8-food-and-the-brain'
       and episode_number = 8
       and title = 'Food and the Brain - Eating for Brain Health and Concussion Recovery'
       and publish_date = date '2026-08-25'
       and duration_minutes = 22
       and audio_url = 'https://content.rss.com/episodes/397420/3096546/dr-m-experienced/2026_08_25_22_20_41_83110c46-278d-4dc5-96e7-d38abd74172a.mp3'
       and vimeo_id = '1221293570'
       and spotify_id = '7oYwjErc5TXpocbRFgzvH0'
       and youtube_id = 'ax5BSELnBbo'
       and thumbnail_url = 'https://drmexperienced.com/images/episodes/food-and-the-brain.webp'
       and status = 'published'
  ) <> 1 then
    raise exception 'Episode 8 publication postcondition failed.';
  end if;

  if (select count(*) from public.episode_topics where episode_slug = 'episode-8-food-and-the-brain') <> 10
     or (select count(*) from public.episode_references where episode_slug = 'episode-8-food-and-the-brain') <> 12
     or (select count(*) from public.episode_key_takeaways where episode_slug = 'episode-8-food-and-the-brain') <> 5
     or (select count(*) from public.episode_checklist_items where episode_slug = 'episode-8-food-and-the-brain') <> 5
     or (select count(*) from public.episode_sections where episode_slug = 'episode-8-food-and-the-brain') <> 4
     or (select count(*) from public.episode_section_paragraphs where episode_slug = 'episode-8-food-and-the-brain') <> 8 then
    raise exception 'Episode 8 editorial child-row postcondition failed.';
  end if;

  select count(*) into unexpected_reference_count
    from public.episode_references
   where episode_slug = 'episode-8-food-and-the-brain'
     and url not in (
       'https://vimeo.com/1221293570',
       'https://open.spotify.com/episode/7oYwjErc5TXpocbRFgzvH0',
       'https://youtu.be/ax5BSELnBbo',
       'https://drmexperienced.com/episodes/episode-7-the-brain-on-fire/',
       'https://drmexperienced.com/episodes/episode-6-concussion-and-pathophysiology/',
       'https://drmexperienced.com/affiliates/',
       'https://drmexperienced.com/affiliates/#doctors-supplement-store',
       'https://drmexperienced.com/contact/',
       'https://drmexperienced.com/affiliates/#humann-turmeric-chews',
       'https://drmexperienced.com/affiliates/#fgo-turmeric-ginger-tea',
       'https://drmexperienced.com/affiliates/#purity-coffee',
       'https://puritycoffee.com/pages/independent-laboratory-tests'
     );
  if unexpected_reference_count <> 0 then
    raise exception 'Episode 8 has unexpected reference rows.';
  end if;

  if exists (
    select 1
      from (values
        ('doctors-supplement-store'),
        ('humann-turmeric-chews'),
        ('fgo-turmeric-ginger-tea'),
        ('purity-coffee')
      ) as expected(product_slug)
      join public.affiliate_products on affiliate_products.slug = expected.product_slug
 left join public.affiliate_product_episode_links links
        on links.product_slug = expected.product_slug
       and links.episode_slug = 'episode-8-food-and-the-brain'
     where links.product_slug is null
  ) then
    raise exception 'Episode 8 affiliate-product link postcondition failed.';
  end if;
end
$$;

commit;
