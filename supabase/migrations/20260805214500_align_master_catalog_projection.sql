-- Keep the website projection aligned with the checked-in publishing master.
begin;

do $$
declare
  mismatched text;
begin
  with expected(slug, previous_summary, approved_summary) as (
    values
      (
        'episode-3-insomnia',
        'Dr. M breaks down insomnia and sleep: difficulty falling or staying asleep, types of insomnia, and why 7+ hours of quality sleep matters for reducing inflammation in your brain and body-plus practical tools for wind-down, caffeine timing, natural supports, and more.',
        'Dr. M breaks down insomnia and sleep: difficulty falling or staying asleep, types of insomnia, and why 7+ hours of quality sleep matters for reducing inflammation in your brain and body—plus practical tools for wind-down, caffeine timing, natural supports, and more.'
      ),
      (
        'episode-4-emf',
        'Dr. Musnick explains how RF, EMF, and electrical fields affect the brain and blood-brain barrier-and practical steps to reduce exposure from phones, WiFi, Bluetooth, vehicles, and smart meters.',
        'Dr. Musnick explains how RF, EMF, and electrical fields affect the brain and blood-brain barrier—and practical steps to reduce exposure from phones, WiFi, Bluetooth, vehicles, and smart meters.'
      )
  )
  select string_agg(expected.slug, ', ' order by expected.slug)
  into mismatched
  from expected
  join public.episodes on episodes.slug = expected.slug
  where episodes.summary not in (expected.previous_summary, expected.approved_summary);

  if mismatched is not null then
    raise exception 'Unexpected episode summary state for: %', mismatched;
  end if;
end
$$;

with expected(slug, approved_summary) as (
  values
    (
      'episode-3-insomnia',
      'Dr. M breaks down insomnia and sleep: difficulty falling or staying asleep, types of insomnia, and why 7+ hours of quality sleep matters for reducing inflammation in your brain and body—plus practical tools for wind-down, caffeine timing, natural supports, and more.'
    ),
    (
      'episode-4-emf',
      'Dr. Musnick explains how RF, EMF, and electrical fields affect the brain and blood-brain barrier—and practical steps to reduce exposure from phones, WiFi, Bluetooth, vehicles, and smart meters.'
    )
)
update public.episodes
set summary = expected.approved_summary,
    updated_at = now()
from expected
where episodes.slug = expected.slug
  and episodes.summary is distinct from expected.approved_summary;

do $$
declare
  mismatched text;
begin
  with expected(episode_slug, label, previous_url, approved_url) as (
    values
      ('brain-fog-part-1', 'Listen on Spotify', 'https://open.spotify.com/episode/7cAdb8GE4khC9EYKAjmYuc?si=WaXbSZb9RMOijYCs68s1nQ', 'https://open.spotify.com/episode/7cAdb8GE4khC9EYKAjmYuc'),
      ('brain-fog-part-2', 'Listen on Spotify', 'https://open.spotify.com/episode/19Pct0ClX3j1EOwJ3ySVd7?si=M-QzbWkcSpq7ykUaqQY7UA', 'https://open.spotify.com/episode/19Pct0ClX3j1EOwJ3ySVd7'),
      ('brain-fog-part-2', 'Watch on YouTube', 'https://youtu.be/s740_XVTaAY', 'https://www.youtube.com/watch?v=s740_XVTaAY'),
      ('episode-3-insomnia', 'Listen on Spotify', 'https://open.spotify.com/episode/07OHz4sfbefOORcNi9xaUK?si=LsWv5o7LR0mccsYnO8HFRQ', 'https://open.spotify.com/episode/07OHz4sfbefOORcNi9xaUK'),
      ('episode-4-emf', 'Listen on Spotify', 'https://open.spotify.com/episode/0aDVuIwrRlDKxEylMj2dyw?si=TH13bzEJTqWQ6LJUkIm9Cw', 'https://open.spotify.com/episode/0aDVuIwrRlDKxEylMj2dyw'),
      ('episode-4-emf', 'Watch on YouTube', 'https://youtu.be/X8WChChyh9c', 'https://www.youtube.com/watch?v=X8WChChyh9c')
  )
  select string_agg(expected.episode_slug || ':' || expected.label, ', ' order by expected.episode_slug, expected.label)
  into mismatched
  from expected
  where exists (
    select 1
    from public.episode_references
    where episode_references.episode_slug = expected.episode_slug
      and episode_references.label = expected.label
  )
  and not exists (
    select 1
    from public.episode_references
    where episode_references.episode_slug = expected.episode_slug
      and episode_references.label = expected.label
      and episode_references.url in (expected.previous_url, expected.approved_url)
  );

  if mismatched is not null then
    raise exception 'Unexpected episode reference state for: %', mismatched;
  end if;
end
$$;

with expected(episode_slug, label, previous_url, approved_url) as (
  values
    ('brain-fog-part-1', 'Listen on Spotify', 'https://open.spotify.com/episode/7cAdb8GE4khC9EYKAjmYuc?si=WaXbSZb9RMOijYCs68s1nQ', 'https://open.spotify.com/episode/7cAdb8GE4khC9EYKAjmYuc'),
    ('brain-fog-part-2', 'Listen on Spotify', 'https://open.spotify.com/episode/19Pct0ClX3j1EOwJ3ySVd7?si=M-QzbWkcSpq7ykUaqQY7UA', 'https://open.spotify.com/episode/19Pct0ClX3j1EOwJ3ySVd7'),
    ('brain-fog-part-2', 'Watch on YouTube', 'https://youtu.be/s740_XVTaAY', 'https://www.youtube.com/watch?v=s740_XVTaAY'),
    ('episode-3-insomnia', 'Listen on Spotify', 'https://open.spotify.com/episode/07OHz4sfbefOORcNi9xaUK?si=LsWv5o7LR0mccsYnO8HFRQ', 'https://open.spotify.com/episode/07OHz4sfbefOORcNi9xaUK'),
    ('episode-4-emf', 'Listen on Spotify', 'https://open.spotify.com/episode/0aDVuIwrRlDKxEylMj2dyw?si=TH13bzEJTqWQ6LJUkIm9Cw', 'https://open.spotify.com/episode/0aDVuIwrRlDKxEylMj2dyw'),
    ('episode-4-emf', 'Watch on YouTube', 'https://youtu.be/X8WChChyh9c', 'https://www.youtube.com/watch?v=X8WChChyh9c')
)
delete from public.episode_references old_reference
using expected
where old_reference.episode_slug = expected.episode_slug
  and old_reference.label = expected.label
  and old_reference.url = expected.previous_url
  and exists (
    select 1
    from public.episode_references approved_reference
    where approved_reference.episode_slug = expected.episode_slug
      and approved_reference.label = expected.label
      and approved_reference.url = expected.approved_url
  );

with expected(episode_slug, label, previous_url, approved_url) as (
  values
    ('brain-fog-part-1', 'Listen on Spotify', 'https://open.spotify.com/episode/7cAdb8GE4khC9EYKAjmYuc?si=WaXbSZb9RMOijYCs68s1nQ', 'https://open.spotify.com/episode/7cAdb8GE4khC9EYKAjmYuc'),
    ('brain-fog-part-2', 'Listen on Spotify', 'https://open.spotify.com/episode/19Pct0ClX3j1EOwJ3ySVd7?si=M-QzbWkcSpq7ykUaqQY7UA', 'https://open.spotify.com/episode/19Pct0ClX3j1EOwJ3ySVd7'),
    ('brain-fog-part-2', 'Watch on YouTube', 'https://youtu.be/s740_XVTaAY', 'https://www.youtube.com/watch?v=s740_XVTaAY'),
    ('episode-3-insomnia', 'Listen on Spotify', 'https://open.spotify.com/episode/07OHz4sfbefOORcNi9xaUK?si=LsWv5o7LR0mccsYnO8HFRQ', 'https://open.spotify.com/episode/07OHz4sfbefOORcNi9xaUK'),
    ('episode-4-emf', 'Listen on Spotify', 'https://open.spotify.com/episode/0aDVuIwrRlDKxEylMj2dyw?si=TH13bzEJTqWQ6LJUkIm9Cw', 'https://open.spotify.com/episode/0aDVuIwrRlDKxEylMj2dyw'),
    ('episode-4-emf', 'Watch on YouTube', 'https://youtu.be/X8WChChyh9c', 'https://www.youtube.com/watch?v=X8WChChyh9c')
)
update public.episode_references
set url = expected.approved_url
from expected
where episode_references.episode_slug = expected.episode_slug
  and episode_references.label = expected.label
  and episode_references.url = expected.previous_url;

commit;
