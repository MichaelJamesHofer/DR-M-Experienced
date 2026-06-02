-- Static-site form capture for contact messages and newsletter subscriptions.
-- Public anon clients may insert, but may not read, update, or delete rows.

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 200),
  email text not null check (
    char_length(email) <= 255
    and email = lower(email)
    and email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  ),
  subject text not null check (subject in ('podcast', 'business', 'press', 'other')),
  message text not null check (char_length(message) between 1 and 5000),
  page_url text check (page_url is null or char_length(page_url) <= 1000),
  user_agent text check (user_agent is null or char_length(user_agent) <= 500)
);

create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

alter table public.contact_messages enable row level security;

drop policy if exists "Allow anonymous contact inserts" on public.contact_messages;
create policy "Allow anonymous contact inserts"
  on public.contact_messages
  for insert
  to anon, authenticated
  with check (true);

create table if not exists public.newsletter_subscriptions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null unique check (
    char_length(email) <= 255
    and email = lower(email)
    and email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  ),
  source text not null default 'unknown' check (char_length(source) between 1 and 50),
  page_url text check (page_url is null or char_length(page_url) <= 1000),
  user_agent text check (user_agent is null or char_length(user_agent) <= 500)
);

create index if not exists newsletter_subscriptions_created_at_idx
  on public.newsletter_subscriptions (created_at desc);

alter table public.newsletter_subscriptions enable row level security;

drop policy if exists "Allow anonymous newsletter inserts" on public.newsletter_subscriptions;
create policy "Allow anonymous newsletter inserts"
  on public.newsletter_subscriptions
  for insert
  to anon, authenticated
  with check (true);
