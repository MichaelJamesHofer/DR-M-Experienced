-- Replace Episode 7 website copy that was derived from Episode 6 with
-- transcript-grounded editorial content. Shared distributor copy remains owned
-- by publishing/master-catalog.json and is propagated separately.
begin;

do $$
declare
  current_summary text;
  current_takeaways text[];
  current_sections text[];
  current_paragraphs text[];
  old_takeaways constant text[] := array[
    'The brain-on-fire frame centers on neuroinflammation and the downstream effects of concussion or traumatic brain injury.',
    'Brain injury can involve structural injury, neural shearing, excitotoxicity, oxidative stress, hypoxia, and blood-brain barrier disruption.',
    'Persistent symptoms may be driven by brain autoimmunity, hormone and pituitary effects, vagus nerve dysfunction, mitochondrial dysfunction, and gut-brain changes.',
    'Brain fog, headache, dizziness, emotional instability, fatigue, sleepiness, and brain-based fatigue can continue even when there was no direct head impact.',
    'This episode reinforces the need for personalized evaluation and recovery planning after concussion or head injury.'
  ];
  new_takeaways constant text[] := array[
    'Brain reserve can differ across regions, so symptom improvement does not always mean the brain has fully restored its reserve.',
    'A healing brain needs protection from reinjury even after the most noticeable symptoms begin to improve.',
    'Astrocytes support the blood-brain barrier, oligodendrocytes help form myelin, and microglia respond to injury and inflammation.',
    'Prolonged pro-inflammatory M1 microglial activity can impair neurons and synapses, while repair-oriented M2 activity supports recovery.',
    'Sleep, selected foods and flavonoids, vitamin D, omega-3s, curcumin, and Nrf2 signaling are discussed as research-informed considerations, not a self-treatment protocol.'
  ];
  old_sections constant text[] := array[
    'The inflamed brain',
    'Mechanisms after injury',
    'Symptoms and patterns',
    'Use medical context'
  ];
  new_sections constant text[] := array[
    'Brain reserve and symptom recovery',
    'Protecting a healing brain',
    'Glial cells and microglia',
    'Supporting inflammatory balance'
  ];
  old_paragraphs constant text[] := array[
    'Dr. M frames the post-injury brain as a system that can remain activated and inflamed after concussion or traumatic brain injury.',
    'The episode connects the brain-on-fire idea to neuroinflammation, oxidative stress, and the blood-brain barrier.',
    'Mechanisms discussed include structural injury, neural shearing, excitotoxicity, hypoxia, blood-brain barrier disruption, brain autoimmunity, hormone dysfunction, pituitary involvement, vagus nerve dysfunction, mitochondrial dysfunction, protein folding abnormalities, neurogenesis, synaptogenesis, and gut microbiome changes.',
    'Dr. M connects these pathways to persistent symptoms such as brain fog, headache, dizziness, emotional instability, fatigue, sleepiness, and brain-based fatigue.',
    'He also emphasizes that concussion-like injury can occur without a direct blow to the head.',
    'The episode is educational and should not be used as a stand-alone protocol for diagnosis, treatment, testing, supplements, or return-to-play decisions.',
    'Listeners are directed toward individualized medical evaluation after concussion or head injury.'
  ];
  new_paragraphs constant text[] := array[
    'Dr. M explains that different brain regions can have different amounts of reserve before an injury becomes symptomatic.',
    'Symptoms may improve once function rises above that threshold, even though the brain has not yet returned to its full pre-injury reserve.',
    'The episode emphasizes protecting the brain from another impact while recovery is still underway.',
    'Dr. M briefly revisits excitotoxicity from the preceding pathophysiology episode before focusing on neuroinflammation.',
    'Astrocytes help support the blood-brain barrier, oligodendrocytes help form myelin, and microglia act as immune-support cells within the brain.',
    'Dr. M contrasts prolonged pro-inflammatory M1 microglial activity, which can impair neurons and synapses, with repair-oriented M2 activity.',
    'The discussion covers sleep, luteolin and apigenin, vitamin D, Nrf2 signaling, curcumin, and omega-3 fats as research-informed considerations.',
    'These topics are educational and should be evaluated with an appropriate clinician rather than used as a stand-alone treatment or return-to-play protocol.'
  ];
begin
  select summary into current_summary
    from public.episodes
   where slug = 'episode-7-the-brain-on-fire';

  if not found then
    if exists (select 1 from public.episodes) then
      raise exception 'Cannot correct Episode 7 editorial copy; episode row is missing.';
    end if;
    return;
  end if;

  if current_summary not in (
    'Dr. Musnick continues the brain-injury series with a focused look at the inflamed brain, including concussion, traumatic brain injury, neuroinflammation, oxidative stress, blood-brain barrier disruption, brain autoimmunity, hormone and mitochondrial effects, and persistent symptoms.',
    'Dr. Musnick explains brain reserve and why symptom relief may precede full recovery, then explores glial cells, M1 and M2 microglia, neuroinflammation after concussion, and research-informed recovery factors.'
  ) then
    raise exception 'Refusing to overwrite unexpected Episode 7 summary.';
  end if;

  select array_agg(body order by display_order) into current_takeaways
    from public.episode_key_takeaways
   where episode_slug = 'episode-7-the-brain-on-fire';
  if current_takeaways is distinct from old_takeaways and current_takeaways is distinct from new_takeaways then
    raise exception 'Refusing to overwrite unexpected Episode 7 takeaways.';
  end if;

  select array_agg(title order by display_order) into current_sections
    from public.episode_sections
   where episode_slug = 'episode-7-the-brain-on-fire';
  if current_sections is distinct from old_sections and current_sections is distinct from new_sections then
    raise exception 'Refusing to overwrite unexpected Episode 7 sections.';
  end if;

  select array_agg(body order by section_display_order, display_order) into current_paragraphs
    from public.episode_section_paragraphs
   where episode_slug = 'episode-7-the-brain-on-fire';
  if current_paragraphs is distinct from old_paragraphs and current_paragraphs is distinct from new_paragraphs then
    raise exception 'Refusing to overwrite unexpected Episode 7 section paragraphs.';
  end if;
end
$$;

update public.episodes
   set summary = 'Dr. Musnick explains brain reserve and why symptom relief may precede full recovery, then explores glial cells, M1 and M2 microglia, neuroinflammation after concussion, and research-informed recovery factors.',
       updated_at = now()
 where slug = 'episode-7-the-brain-on-fire';

delete from public.episode_topics
 where episode_slug = 'episode-7-the-brain-on-fire'
   and topic_slug = 'brain-autoimmunity';

insert into public.episode_key_takeaways (episode_slug, display_order, body)
select episodes.slug, copy.display_order, copy.body
  from public.episodes
 cross join (values
    (10, 'Brain reserve can differ across regions, so symptom improvement does not always mean the brain has fully restored its reserve.'),
    (20, 'A healing brain needs protection from reinjury even after the most noticeable symptoms begin to improve.'),
    (30, 'Astrocytes support the blood-brain barrier, oligodendrocytes help form myelin, and microglia respond to injury and inflammation.'),
    (40, 'Prolonged pro-inflammatory M1 microglial activity can impair neurons and synapses, while repair-oriented M2 activity supports recovery.'),
    (50, 'Sleep, selected foods and flavonoids, vitamin D, omega-3s, curcumin, and Nrf2 signaling are discussed as research-informed considerations, not a self-treatment protocol.')
  ) as copy(display_order, body)
 where episodes.slug = 'episode-7-the-brain-on-fire'
on conflict (episode_slug, display_order) do update set body = excluded.body;

insert into public.episode_sections (episode_slug, display_order, title)
select episodes.slug, copy.display_order, copy.title
  from public.episodes
 cross join (values
    (10, 'Brain reserve and symptom recovery'),
    (20, 'Protecting a healing brain'),
    (30, 'Glial cells and microglia'),
    (40, 'Supporting inflammatory balance')
  ) as copy(display_order, title)
 where episodes.slug = 'episode-7-the-brain-on-fire'
on conflict (episode_slug, display_order) do update set title = excluded.title;

insert into public.episode_section_paragraphs (
  episode_slug,
  section_display_order,
  display_order,
  body
)
select episodes.slug, copy.section_display_order, copy.display_order, copy.body
  from public.episodes
 cross join (values
    (10, 10, 'Dr. M explains that different brain regions can have different amounts of reserve before an injury becomes symptomatic.'),
    (10, 20, 'Symptoms may improve once function rises above that threshold, even though the brain has not yet returned to its full pre-injury reserve.'),
    (20, 10, 'The episode emphasizes protecting the brain from another impact while recovery is still underway.'),
    (20, 20, 'Dr. M briefly revisits excitotoxicity from the preceding pathophysiology episode before focusing on neuroinflammation.'),
    (30, 10, 'Astrocytes help support the blood-brain barrier, oligodendrocytes help form myelin, and microglia act as immune-support cells within the brain.'),
    (30, 20, 'Dr. M contrasts prolonged pro-inflammatory M1 microglial activity, which can impair neurons and synapses, with repair-oriented M2 activity.'),
    (40, 10, 'The discussion covers sleep, luteolin and apigenin, vitamin D, Nrf2 signaling, curcumin, and omega-3 fats as research-informed considerations.'),
    (40, 20, 'These topics are educational and should be evaluated with an appropriate clinician rather than used as a stand-alone treatment or return-to-play protocol.')
  ) as copy(section_display_order, display_order, body)
 where episodes.slug = 'episode-7-the-brain-on-fire'
on conflict (episode_slug, section_display_order, display_order) do update set body = excluded.body;

do $$
declare
  mismatches integer;
begin
  if exists (select 1 from public.episodes) then
    select count(*) into mismatches
      from public.episodes
     where slug = 'episode-7-the-brain-on-fire'
       and summary = 'Dr. Musnick explains brain reserve and why symptom relief may precede full recovery, then explores glial cells, M1 and M2 microglia, neuroinflammation after concussion, and research-informed recovery factors.';
    if mismatches <> 1 then
      raise exception 'Episode 7 editorial correction postcondition failed.';
    end if;

    if (select count(*) from public.episode_key_takeaways where episode_slug = 'episode-7-the-brain-on-fire') <> 5
       or (select count(*) from public.episode_sections where episode_slug = 'episode-7-the-brain-on-fire') <> 4
       or (select count(*) from public.episode_section_paragraphs where episode_slug = 'episode-7-the-brain-on-fire') <> 8
       or exists (
         select 1 from public.episode_topics
          where episode_slug = 'episode-7-the-brain-on-fire'
            and topic_slug = 'brain-autoimmunity'
       ) then
      raise exception 'Episode 7 editorial child-row postcondition failed.';
    end if;
  end if;
end
$$;

commit;
