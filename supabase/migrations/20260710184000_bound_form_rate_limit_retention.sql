-- Rate-limit windows are at most one day. Keep a short operational history
-- while preventing counters from growing forever.

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

  -- Each submission has one IP-hour counter, so this runs once per request.
  if p_action in ('contact-ip-hour', 'newsletter-ip-hour') then
    delete from public.form_submission_rate_limits
    where updated_at < now() - interval '8 days';
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
