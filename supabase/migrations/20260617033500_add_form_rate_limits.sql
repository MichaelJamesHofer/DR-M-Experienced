-- Private rate-limit counters used by the Supabase Edge Function.
-- Browser clients must not read or write this table directly.

create table if not exists public.form_submission_rate_limits (
  action text not null check (char_length(action) between 1 and 80),
  key_hash text not null check (char_length(key_hash) = 64),
  bucket_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (action, key_hash, bucket_start)
);

create index if not exists form_submission_rate_limits_updated_at_idx
  on public.form_submission_rate_limits (updated_at desc);

alter table public.form_submission_rate_limits enable row level security;

revoke all on table public.form_submission_rate_limits from anon, authenticated;

create or replace function public.increment_form_rate_limit(
  p_action text,
  p_key_hash text,
  p_bucket_start timestamptz
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  if p_action is null
    or p_key_hash is null
    or p_bucket_start is null
    or char_length(p_action) < 1
    or char_length(p_action) > 80
    or p_key_hash !~ '^[a-f0-9]{64}$'
  then
    raise exception 'invalid rate-limit input';
  end if;

  insert into public.form_submission_rate_limits (
    action,
    key_hash,
    bucket_start,
    count,
    updated_at
  )
  values (
    p_action,
    p_key_hash,
    p_bucket_start,
    1,
    now()
  )
  on conflict (action, key_hash, bucket_start)
  do update set
    count = public.form_submission_rate_limits.count + 1,
    updated_at = now()
  returning count into new_count;

  return new_count;
end;
$$;

revoke all on function public.increment_form_rate_limit(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.increment_form_rate_limit(text, text, timestamptz) to service_role;
