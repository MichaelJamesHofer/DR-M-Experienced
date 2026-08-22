-- Correct Episode 5 in place after the verified RSS.com media replacement.
-- Preserve the existing site slug and all destination IDs.
begin;

do $$
declare
  episode_count integer;
  current_audio_url text;
  current_duration_minutes integer;
begin
  select count(*), min(audio_url), min(duration_minutes)
    into episode_count, current_audio_url, current_duration_minutes
    from public.episodes
   where slug = 'episode-5-energy';

  if episode_count <> 1 then
    raise exception 'Expected exactly one episode-5-energy row, found %', episode_count;
  end if;

  if current_audio_url not in (
    'https://content.rss.com/episodes/397420/3050762/dr-m-experienced/2026_08_07_05_46_23_1de2f4f3-aeab-457a-a02d-2bf61108132d.mp3',
    'https://content.rss.com/episodes/397420/3050762/dr-m-experienced/2026_08_22_21_31_50_62730fc1-465f-4df9-9c8a-d721be928586.mp3'
  ) then
    raise exception 'Refusing to overwrite unexpected Episode 5 audio URL: %', current_audio_url;
  end if;

  if current_duration_minutes not in (30, 31) then
    raise exception 'Refusing to overwrite unexpected Episode 5 duration: %', current_duration_minutes;
  end if;
end
$$;

update public.episodes
   set audio_url = 'https://content.rss.com/episodes/397420/3050762/dr-m-experienced/2026_08_22_21_31_50_62730fc1-465f-4df9-9c8a-d721be928586.mp3',
       duration_minutes = 30,
       updated_at = now()
 where slug = 'episode-5-energy';

do $$
begin
  if not exists (
    select 1
      from public.episodes
     where slug = 'episode-5-energy'
       and audio_url = 'https://content.rss.com/episodes/397420/3050762/dr-m-experienced/2026_08_22_21_31_50_62730fc1-465f-4df9-9c8a-d721be928586.mp3'
       and duration_minutes = 30
  ) then
    raise exception 'Episode 5 correction postcondition failed';
  end if;
end
$$;

commit;
