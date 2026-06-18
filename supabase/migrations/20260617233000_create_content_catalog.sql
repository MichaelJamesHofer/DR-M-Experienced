-- Normalized public content catalog for episodes and affiliate resources.
-- Static export can continue reading the checked-in mirror, while this schema
-- gives Supabase Studio and future build-time sync jobs a proper source model.

create table if not exists public.content_topics (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  label text not null check (char_length(label) between 1 and 120),
  created_at timestamptz not null default now()
);

create table if not exists public.episodes (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  episode_number integer not null unique check (episode_number > 0),
  title text not null check (char_length(title) between 1 and 300),
  publish_date date not null,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  summary text not null check (char_length(summary) between 1 and 2000),
  audio_url text check (audio_url is null or audio_url ~* '^https?://'),
  vimeo_id text,
  spotify_id text,
  youtube_id text,
  thumbnail_url text check (thumbnail_url is null or thumbnail_url ~* '^https?://'),
  transcript_url text check (transcript_url is null or transcript_url ~* '^https?://'),
  status text not null default 'published' check (status in ('draft', 'scheduled', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists episodes_publish_date_idx
  on public.episodes (publish_date desc, episode_number desc);

create table if not exists public.episode_topics (
  episode_slug text not null references public.episodes(slug) on delete cascade,
  topic_slug text not null references public.content_topics(slug) on delete restrict,
  primary key (episode_slug, topic_slug)
);

create index if not exists episode_topics_topic_slug_idx
  on public.episode_topics (topic_slug);

create table if not exists public.episode_references (
  id bigint generated always as identity primary key,
  episode_slug text not null references public.episodes(slug) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  url text not null check (url ~* '^https?://'),
  coming_soon boolean not null default false,
  display_order integer not null default 100,
  unique (episode_slug, url)
);

create table if not exists public.affiliate_categories (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  label text not null check (char_length(label) between 1 and 120),
  description text not null check (char_length(description) between 1 and 1000),
  display_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.affiliate_products (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category_slug text not null references public.affiliate_categories(slug) on delete restrict,
  brand text check (brand is null or char_length(brand) between 1 and 160),
  name text not null check (char_length(name) between 1 and 240),
  summary text not null check (char_length(summary) between 1 and 2000),
  drm_thoughts text not null check (char_length(drm_thoughts) between 1 and 3000),
  purchase_note text check (purchase_note is null or char_length(purchase_note) <= 1000),
  caution_note text check (caution_note is null or char_length(caution_note) <= 1500),
  affiliate_url text check (affiliate_url is null or affiliate_url ~* '^https?://'),
  direct_url text check (direct_url is null or direct_url ~* '^https?://'),
  image_url text check (image_url is null or image_url ~* '^https?://'),
  coupon_code text check (coupon_code is null or char_length(coupon_code) <= 80),
  discount_note text check (discount_note is null or char_length(discount_note) <= 500),
  sort_order integer not null default 100,
  date_added date not null default current_date,
  last_reviewed date not null default current_date,
  source_note text not null check (char_length(source_note) between 1 and 1000),
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (affiliate_url is not null or direct_url is not null)
);

create index if not exists affiliate_products_category_sort_idx
  on public.affiliate_products (category_slug, sort_order);

create table if not exists public.affiliate_product_reasons (
  product_slug text not null references public.affiliate_products(slug) on delete cascade,
  display_order integer not null,
  body text not null check (char_length(body) between 1 and 1000),
  primary key (product_slug, display_order)
);

create table if not exists public.affiliate_product_use_cases (
  product_slug text not null references public.affiliate_products(slug) on delete cascade,
  display_order integer not null,
  body text not null check (char_length(body) between 1 and 1000),
  primary key (product_slug, display_order)
);

create table if not exists public.affiliate_product_featured_items (
  product_slug text not null references public.affiliate_products(slug) on delete cascade,
  display_order integer not null,
  label text not null check (char_length(label) between 1 and 180),
  primary key (product_slug, display_order)
);

create table if not exists public.affiliate_product_tags (
  product_slug text not null references public.affiliate_products(slug) on delete cascade,
  tag_slug text not null check (tag_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  primary key (product_slug, tag_slug)
);

create table if not exists public.affiliate_product_episode_links (
  product_slug text not null references public.affiliate_products(slug) on delete cascade,
  episode_slug text not null references public.episodes(slug) on delete cascade,
  link_reason text not null default 'manual' check (char_length(link_reason) between 1 and 200),
  primary key (product_slug, episode_slug)
);

create table if not exists public.affiliate_product_auto_topics (
  product_slug text not null references public.affiliate_products(slug) on delete cascade,
  topic_slug text not null references public.content_topics(slug) on delete restrict,
  primary key (product_slug, topic_slug)
);

create or replace view public.affiliate_product_episode_matches as
with raw_matches as (
  select
    product_slug,
    episode_slug,
    'manual'::text as match_source
  from public.affiliate_product_episode_links
  union all
  select
    auto.product_slug,
    episode_topics.episode_slug,
    'topic'::text as match_source
  from public.affiliate_product_auto_topics auto
  join public.episode_topics
    on episode_topics.topic_slug = auto.topic_slug
)
select
  product_slug,
  episode_slug,
  string_agg(distinct match_source, '+' order by match_source) as match_source
from raw_matches
group by product_slug, episode_slug;

alter table public.content_topics enable row level security;
alter table public.episodes enable row level security;
alter table public.episode_topics enable row level security;
alter table public.episode_references enable row level security;
alter table public.affiliate_categories enable row level security;
alter table public.affiliate_products enable row level security;
alter table public.affiliate_product_reasons enable row level security;
alter table public.affiliate_product_use_cases enable row level security;
alter table public.affiliate_product_featured_items enable row level security;
alter table public.affiliate_product_tags enable row level security;
alter table public.affiliate_product_episode_links enable row level security;
alter table public.affiliate_product_auto_topics enable row level security;

drop policy if exists "Allow public content topic reads" on public.content_topics;
create policy "Allow public content topic reads"
  on public.content_topics for select to anon, authenticated using (true);

drop policy if exists "Allow public episode reads" on public.episodes;
create policy "Allow public episode reads"
  on public.episodes for select to anon, authenticated using (status = 'published');

drop policy if exists "Allow public episode topic reads" on public.episode_topics;
create policy "Allow public episode topic reads"
  on public.episode_topics for select to anon, authenticated using (true);

drop policy if exists "Allow public episode reference reads" on public.episode_references;
create policy "Allow public episode reference reads"
  on public.episode_references for select to anon, authenticated using (true);

drop policy if exists "Allow public affiliate category reads" on public.affiliate_categories;
create policy "Allow public affiliate category reads"
  on public.affiliate_categories for select to anon, authenticated using (true);

drop policy if exists "Allow public affiliate product reads" on public.affiliate_products;
create policy "Allow public affiliate product reads"
  on public.affiliate_products for select to anon, authenticated using (status = 'published');

drop policy if exists "Allow public affiliate reason reads" on public.affiliate_product_reasons;
create policy "Allow public affiliate reason reads"
  on public.affiliate_product_reasons for select to anon, authenticated using (true);

drop policy if exists "Allow public affiliate use-case reads" on public.affiliate_product_use_cases;
create policy "Allow public affiliate use-case reads"
  on public.affiliate_product_use_cases for select to anon, authenticated using (true);

drop policy if exists "Allow public affiliate featured item reads" on public.affiliate_product_featured_items;
create policy "Allow public affiliate featured item reads"
  on public.affiliate_product_featured_items for select to anon, authenticated using (true);

drop policy if exists "Allow public affiliate tag reads" on public.affiliate_product_tags;
create policy "Allow public affiliate tag reads"
  on public.affiliate_product_tags for select to anon, authenticated using (true);

drop policy if exists "Allow public affiliate episode-link reads" on public.affiliate_product_episode_links;
create policy "Allow public affiliate episode-link reads"
  on public.affiliate_product_episode_links for select to anon, authenticated using (true);

drop policy if exists "Allow public affiliate auto-topic reads" on public.affiliate_product_auto_topics;
create policy "Allow public affiliate auto-topic reads"
  on public.affiliate_product_auto_topics for select to anon, authenticated using (true);
