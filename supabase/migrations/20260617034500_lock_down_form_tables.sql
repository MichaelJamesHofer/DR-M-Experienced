-- Once the Supabase Edge Function is live, public clients should not write
-- directly to captured form tables. The function is the receive-only path.

drop policy if exists "Allow anonymous contact inserts" on public.contact_messages;
drop policy if exists "Allow anonymous newsletter inserts" on public.newsletter_subscriptions;

revoke all on table public.contact_messages from anon, authenticated;
revoke all on table public.newsletter_subscriptions from anon, authenticated;

grant insert on table public.contact_messages to service_role;
grant insert, select on table public.newsletter_subscriptions to service_role;
