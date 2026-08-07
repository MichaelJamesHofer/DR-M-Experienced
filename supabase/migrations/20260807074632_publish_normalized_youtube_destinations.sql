-- Project the seven verified normalized YouTube replacements without deleting the prior unlisted uploads.
begin;

do $$
declare
  missing_slugs text;
  unexpected_ids text;
  unexpected_references text;
begin
  if exists (select 1 from public.episodes) then
    with expected(slug, previous_id, current_id, previous_url, current_url) as (
      values
        ('brain-fog-part-1', 'LXASEw-WFq8', '5IMYaqnQsFY', 'https://www.youtube.com/watch?v=LXASEw-WFq8', 'https://www.youtube.com/watch?v=5IMYaqnQsFY'),
        ('brain-fog-part-2', 's740_XVTaAY', 'DJe0fPmTf8k', 'https://www.youtube.com/watch?v=s740_XVTaAY', 'https://www.youtube.com/watch?v=DJe0fPmTf8k'),
        ('episode-3-insomnia', '59r5XFynaDo', 'r5JYtE8Vm9I', 'https://www.youtube.com/watch?v=59r5XFynaDo', 'https://www.youtube.com/watch?v=r5JYtE8Vm9I'),
        ('episode-4-emf', 'X8WChChyh9c', 'binbLcb3f_s', 'https://www.youtube.com/watch?v=X8WChChyh9c', 'https://www.youtube.com/watch?v=binbLcb3f_s'),
        ('episode-5-energy', 'JyBK6KtOo_k', 'N_F0hhHkIQ4', 'https://www.youtube.com/watch?v=JyBK6KtOo_k', 'https://www.youtube.com/watch?v=N_F0hhHkIQ4'),
        ('episode-6-concussion-and-pathophysiology', 'odNrtPEuong', '8u1Ps_mCpO4', 'https://www.youtube.com/watch?v=odNrtPEuong', 'https://www.youtube.com/watch?v=8u1Ps_mCpO4'),
        ('episode-7-the-brain-on-fire', '3IVDJqwT2yY', '5UOEvs59hBA', 'https://www.youtube.com/watch?v=3IVDJqwT2yY', 'https://www.youtube.com/watch?v=5UOEvs59hBA')
    )
    select string_agg(expected.slug, ', ' order by expected.slug)
      into missing_slugs
      from expected
      left join public.episodes on episodes.slug = expected.slug
     where episodes.slug is null;

    if missing_slugs is not null then
      raise exception 'Cannot publish normalized YouTube destinations; missing episode rows: %', missing_slugs;
    end if;

    with expected(slug, previous_id, current_id, previous_url, current_url) as (
      values
        ('brain-fog-part-1', 'LXASEw-WFq8', '5IMYaqnQsFY', 'https://www.youtube.com/watch?v=LXASEw-WFq8', 'https://www.youtube.com/watch?v=5IMYaqnQsFY'),
        ('brain-fog-part-2', 's740_XVTaAY', 'DJe0fPmTf8k', 'https://www.youtube.com/watch?v=s740_XVTaAY', 'https://www.youtube.com/watch?v=DJe0fPmTf8k'),
        ('episode-3-insomnia', '59r5XFynaDo', 'r5JYtE8Vm9I', 'https://www.youtube.com/watch?v=59r5XFynaDo', 'https://www.youtube.com/watch?v=r5JYtE8Vm9I'),
        ('episode-4-emf', 'X8WChChyh9c', 'binbLcb3f_s', 'https://www.youtube.com/watch?v=X8WChChyh9c', 'https://www.youtube.com/watch?v=binbLcb3f_s'),
        ('episode-5-energy', 'JyBK6KtOo_k', 'N_F0hhHkIQ4', 'https://www.youtube.com/watch?v=JyBK6KtOo_k', 'https://www.youtube.com/watch?v=N_F0hhHkIQ4'),
        ('episode-6-concussion-and-pathophysiology', 'odNrtPEuong', '8u1Ps_mCpO4', 'https://www.youtube.com/watch?v=odNrtPEuong', 'https://www.youtube.com/watch?v=8u1Ps_mCpO4'),
        ('episode-7-the-brain-on-fire', '3IVDJqwT2yY', '5UOEvs59hBA', 'https://www.youtube.com/watch?v=3IVDJqwT2yY', 'https://www.youtube.com/watch?v=5UOEvs59hBA')
    )
    select string_agg(format('%s (%s)', episodes.slug, coalesce(episodes.youtube_id, 'NULL')), ', ' order by episodes.slug)
      into unexpected_ids
      from expected
      join public.episodes on episodes.slug = expected.slug
     where episodes.youtube_id is distinct from expected.previous_id
       and episodes.youtube_id is distinct from expected.current_id;

    if unexpected_ids is not null then
      raise exception 'Refusing to overwrite unexpected YouTube IDs: %', unexpected_ids;
    end if;

    with expected(slug, previous_id, current_id, previous_url, current_url) as (
      values
        ('brain-fog-part-1', 'LXASEw-WFq8', '5IMYaqnQsFY', 'https://www.youtube.com/watch?v=LXASEw-WFq8', 'https://www.youtube.com/watch?v=5IMYaqnQsFY'),
        ('brain-fog-part-2', 's740_XVTaAY', 'DJe0fPmTf8k', 'https://www.youtube.com/watch?v=s740_XVTaAY', 'https://www.youtube.com/watch?v=DJe0fPmTf8k'),
        ('episode-3-insomnia', '59r5XFynaDo', 'r5JYtE8Vm9I', 'https://www.youtube.com/watch?v=59r5XFynaDo', 'https://www.youtube.com/watch?v=r5JYtE8Vm9I'),
        ('episode-4-emf', 'X8WChChyh9c', 'binbLcb3f_s', 'https://www.youtube.com/watch?v=X8WChChyh9c', 'https://www.youtube.com/watch?v=binbLcb3f_s'),
        ('episode-5-energy', 'JyBK6KtOo_k', 'N_F0hhHkIQ4', 'https://www.youtube.com/watch?v=JyBK6KtOo_k', 'https://www.youtube.com/watch?v=N_F0hhHkIQ4'),
        ('episode-6-concussion-and-pathophysiology', 'odNrtPEuong', '8u1Ps_mCpO4', 'https://www.youtube.com/watch?v=odNrtPEuong', 'https://www.youtube.com/watch?v=8u1Ps_mCpO4'),
        ('episode-7-the-brain-on-fire', '3IVDJqwT2yY', '5UOEvs59hBA', 'https://www.youtube.com/watch?v=3IVDJqwT2yY', 'https://www.youtube.com/watch?v=5UOEvs59hBA')
    )
    select string_agg(expected.slug, ', ' order by expected.slug)
      into unexpected_references
      from expected
     where exists (
       select 1
         from public.episode_references
        where episode_references.episode_slug = expected.slug
          and episode_references.label = 'Watch on YouTube'
          and episode_references.url not in (expected.previous_url, expected.current_url)
     );

    if unexpected_references is not null then
      raise exception 'Refusing to overwrite unexpected YouTube references: %', unexpected_references;
    end if;
  end if;
end
$$;

with expected(slug, previous_id, current_id) as (
  values
    ('brain-fog-part-1', 'LXASEw-WFq8', '5IMYaqnQsFY'),
    ('brain-fog-part-2', 's740_XVTaAY', 'DJe0fPmTf8k'),
    ('episode-3-insomnia', '59r5XFynaDo', 'r5JYtE8Vm9I'),
    ('episode-4-emf', 'X8WChChyh9c', 'binbLcb3f_s'),
    ('episode-5-energy', 'JyBK6KtOo_k', 'N_F0hhHkIQ4'),
    ('episode-6-concussion-and-pathophysiology', 'odNrtPEuong', '8u1Ps_mCpO4'),
    ('episode-7-the-brain-on-fire', '3IVDJqwT2yY', '5UOEvs59hBA')
)
update public.episodes
   set youtube_id = expected.current_id,
       updated_at = now()
  from expected
 where episodes.slug = expected.slug
   and episodes.youtube_id = expected.previous_id;

with expected(slug, previous_url, current_url) as (
  values
    ('brain-fog-part-1', 'https://www.youtube.com/watch?v=LXASEw-WFq8', 'https://www.youtube.com/watch?v=5IMYaqnQsFY'),
    ('brain-fog-part-2', 'https://www.youtube.com/watch?v=s740_XVTaAY', 'https://www.youtube.com/watch?v=DJe0fPmTf8k'),
    ('episode-3-insomnia', 'https://www.youtube.com/watch?v=59r5XFynaDo', 'https://www.youtube.com/watch?v=r5JYtE8Vm9I'),
    ('episode-4-emf', 'https://www.youtube.com/watch?v=X8WChChyh9c', 'https://www.youtube.com/watch?v=binbLcb3f_s'),
    ('episode-5-energy', 'https://www.youtube.com/watch?v=JyBK6KtOo_k', 'https://www.youtube.com/watch?v=N_F0hhHkIQ4'),
    ('episode-6-concussion-and-pathophysiology', 'https://www.youtube.com/watch?v=odNrtPEuong', 'https://www.youtube.com/watch?v=8u1Ps_mCpO4'),
    ('episode-7-the-brain-on-fire', 'https://www.youtube.com/watch?v=3IVDJqwT2yY', 'https://www.youtube.com/watch?v=5UOEvs59hBA')
)
delete from public.episode_references old_reference
using expected
where old_reference.episode_slug = expected.slug
  and old_reference.label = 'Watch on YouTube'
  and old_reference.url = expected.previous_url
  and exists (
    select 1
      from public.episode_references current_reference
     where current_reference.episode_slug = expected.slug
       and current_reference.label = 'Watch on YouTube'
       and current_reference.url = expected.current_url
  );

with expected(slug, previous_url, current_url) as (
  values
    ('brain-fog-part-1', 'https://www.youtube.com/watch?v=LXASEw-WFq8', 'https://www.youtube.com/watch?v=5IMYaqnQsFY'),
    ('brain-fog-part-2', 'https://www.youtube.com/watch?v=s740_XVTaAY', 'https://www.youtube.com/watch?v=DJe0fPmTf8k'),
    ('episode-3-insomnia', 'https://www.youtube.com/watch?v=59r5XFynaDo', 'https://www.youtube.com/watch?v=r5JYtE8Vm9I'),
    ('episode-4-emf', 'https://www.youtube.com/watch?v=X8WChChyh9c', 'https://www.youtube.com/watch?v=binbLcb3f_s'),
    ('episode-5-energy', 'https://www.youtube.com/watch?v=JyBK6KtOo_k', 'https://www.youtube.com/watch?v=N_F0hhHkIQ4'),
    ('episode-6-concussion-and-pathophysiology', 'https://www.youtube.com/watch?v=odNrtPEuong', 'https://www.youtube.com/watch?v=8u1Ps_mCpO4'),
    ('episode-7-the-brain-on-fire', 'https://www.youtube.com/watch?v=3IVDJqwT2yY', 'https://www.youtube.com/watch?v=5UOEvs59hBA')
)
update public.episode_references
   set url = expected.current_url
  from expected
 where episode_references.episode_slug = expected.slug
   and episode_references.label = 'Watch on YouTube'
   and episode_references.url = expected.previous_url;

with expected(slug, current_url) as (
  values
    ('brain-fog-part-1', 'https://www.youtube.com/watch?v=5IMYaqnQsFY'),
    ('brain-fog-part-2', 'https://www.youtube.com/watch?v=DJe0fPmTf8k'),
    ('episode-3-insomnia', 'https://www.youtube.com/watch?v=r5JYtE8Vm9I'),
    ('episode-4-emf', 'https://www.youtube.com/watch?v=binbLcb3f_s'),
    ('episode-5-energy', 'https://www.youtube.com/watch?v=N_F0hhHkIQ4'),
    ('episode-6-concussion-and-pathophysiology', 'https://www.youtube.com/watch?v=8u1Ps_mCpO4'),
    ('episode-7-the-brain-on-fire', 'https://www.youtube.com/watch?v=5UOEvs59hBA')
)
insert into public.episode_references (episode_slug, label, url, display_order)
select expected.slug, 'Watch on YouTube', expected.current_url, 30
  from expected
  join public.episodes on episodes.slug = expected.slug
 where not exists (
   select 1
     from public.episode_references
    where episode_references.episode_slug = expected.slug
      and episode_references.label = 'Watch on YouTube'
 );

do $$
declare
  mismatched text;
begin
  if exists (select 1 from public.episodes) then
    with expected(slug, current_id, current_url) as (
      values
        ('brain-fog-part-1', '5IMYaqnQsFY', 'https://www.youtube.com/watch?v=5IMYaqnQsFY'),
        ('brain-fog-part-2', 'DJe0fPmTf8k', 'https://www.youtube.com/watch?v=DJe0fPmTf8k'),
        ('episode-3-insomnia', 'r5JYtE8Vm9I', 'https://www.youtube.com/watch?v=r5JYtE8Vm9I'),
        ('episode-4-emf', 'binbLcb3f_s', 'https://www.youtube.com/watch?v=binbLcb3f_s'),
        ('episode-5-energy', 'N_F0hhHkIQ4', 'https://www.youtube.com/watch?v=N_F0hhHkIQ4'),
        ('episode-6-concussion-and-pathophysiology', '8u1Ps_mCpO4', 'https://www.youtube.com/watch?v=8u1Ps_mCpO4'),
        ('episode-7-the-brain-on-fire', '5UOEvs59hBA', 'https://www.youtube.com/watch?v=5UOEvs59hBA')
    )
    select string_agg(expected.slug, ', ' order by expected.slug)
      into mismatched
      from expected
      left join public.episodes on episodes.slug = expected.slug
     where episodes.youtube_id is distinct from expected.current_id
        or (
          select count(*)
            from public.episode_references
           where episode_references.episode_slug = expected.slug
             and episode_references.label = 'Watch on YouTube'
             and episode_references.url = expected.current_url
        ) <> 1;

    if mismatched is not null then
      raise exception 'Normalized YouTube projection postcondition failed: %', mismatched;
    end if;
  end if;
end
$$;

commit;
