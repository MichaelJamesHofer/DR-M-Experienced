do $$
declare
  unexpected text;
begin
  with approved(slug, episode_number, previous_title, approved_title) as (
    values
      ('brain-fog-part-1', 1, 'Brain Fog - Part 1 - Is Your Brain in a Fog?', 'Brain Fog, Part 1 - Is Your Brain in a Fog?'),
      ('brain-fog-part-2', 2, 'Brain Fog Part 2 - Testing & Basic Solutions for Brain Fog', 'Brain Fog, Part 2 - Testing and Basic Solutions'),
      ('episode-3-insomnia', 3, 'Insomnia', 'Insomnia - Causes and Practical Sleep Strategies'),
      ('episode-4-emf', 4, 'Electro.Magnetic.Frequencies', 'Electromagnetic Frequencies (EMF) - Practical Ways to Reduce Exposure'),
      ('episode-5-energy', 5, 'Energy', 'Energy - Understanding Fatigue and Mitochondrial Health'),
      ('episode-6-concussion-and-pathophysiology', 6, 'Concussion and Pathophysiology', 'Concussion - What Happens in the Brain'),
      ('episode-7-the-brain-on-fire', 7, 'The Brain on Fire', 'The Brain on Fire - Neuroinflammation After Concussion')
  )
  select string_agg(approved.slug, ', ' order by approved.episode_number)
  into unexpected
  from approved
  join public.episodes on episodes.slug = approved.slug
  where episodes.episode_number <> approved.episode_number
     or episodes.title not in (approved.previous_title, approved.approved_title);

  if unexpected is not null then
    raise exception 'Episode title migration found missing or unexpected rows: %', unexpected;
  end if;

  update public.episodes
  set
    title = approved.approved_title,
    updated_at = now()
  from (
    values
      ('brain-fog-part-1', 1, 'Brain Fog, Part 1 - Is Your Brain in a Fog?'),
      ('brain-fog-part-2', 2, 'Brain Fog, Part 2 - Testing and Basic Solutions'),
      ('episode-3-insomnia', 3, 'Insomnia - Causes and Practical Sleep Strategies'),
      ('episode-4-emf', 4, 'Electromagnetic Frequencies (EMF) - Practical Ways to Reduce Exposure'),
      ('episode-5-energy', 5, 'Energy - Understanding Fatigue and Mitochondrial Health'),
      ('episode-6-concussion-and-pathophysiology', 6, 'Concussion - What Happens in the Brain'),
      ('episode-7-the-brain-on-fire', 7, 'The Brain on Fire - Neuroinflammation After Concussion')
  ) as approved(slug, episode_number, approved_title)
  where episodes.slug = approved.slug
    and episodes.episode_number = approved.episode_number
    and episodes.title is distinct from approved.approved_title;
end
$$;
