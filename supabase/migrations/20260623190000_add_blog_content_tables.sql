-- Blog content tables for long-form notes and episode expansions.
-- Posts are optional for the site build, but once rows are published they can
-- connect back to episodes, affiliate resources, and shared content topics.

create table if not exists public.blog_posts (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 300),
  subtitle text check (subtitle is null or char_length(subtitle) <= 300),
  excerpt text not null check (char_length(excerpt) between 1 and 1200),
  author_name text not null default 'Dr. David Musnick' check (char_length(author_name) between 1 and 160),
  publish_date date not null,
  updated_date date,
  reading_minutes integer check (reading_minutes is null or reading_minutes > 0),
  hero_image_url text check (hero_image_url is null or hero_image_url ~* '^https?://'),
  meta_description text check (meta_description is null or char_length(meta_description) <= 300),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (updated_date is null or updated_date >= publish_date)
);

create index if not exists blog_posts_publish_date_idx
  on public.blog_posts (publish_date desc, slug);

create table if not exists public.blog_post_topics (
  blog_slug text not null references public.blog_posts(slug) on delete cascade,
  topic_slug text not null references public.content_topics(slug) on delete restrict,
  primary key (blog_slug, topic_slug)
);

create index if not exists blog_post_topics_topic_slug_idx
  on public.blog_post_topics (topic_slug);

create table if not exists public.blog_post_sections (
  blog_slug text not null references public.blog_posts(slug) on delete cascade,
  display_order integer not null,
  title text not null check (char_length(title) between 1 and 240),
  primary key (blog_slug, display_order)
);

create index if not exists blog_post_sections_blog_slug_idx
  on public.blog_post_sections (blog_slug);

create table if not exists public.blog_post_section_paragraphs (
  blog_slug text not null,
  section_display_order integer not null,
  display_order integer not null,
  body text not null check (char_length(body) between 1 and 2500),
  primary key (blog_slug, section_display_order, display_order),
  foreign key (blog_slug, section_display_order)
    references public.blog_post_sections(blog_slug, display_order)
    on delete cascade
);

create index if not exists blog_post_section_paragraphs_blog_slug_idx
  on public.blog_post_section_paragraphs (blog_slug);

create table if not exists public.blog_post_references (
  id bigint generated always as identity primary key,
  blog_slug text not null references public.blog_posts(slug) on delete cascade,
  label text not null check (char_length(label) between 1 and 160),
  url text not null check (url ~* '^https?://'),
  display_order integer not null default 100,
  unique (blog_slug, url)
);

create table if not exists public.blog_post_related_episodes (
  blog_slug text not null references public.blog_posts(slug) on delete cascade,
  episode_slug text not null references public.episodes(slug) on delete cascade,
  display_order integer not null default 100,
  primary key (blog_slug, episode_slug)
);

create table if not exists public.blog_post_related_affiliate_products (
  blog_slug text not null references public.blog_posts(slug) on delete cascade,
  product_slug text not null references public.affiliate_products(slug) on delete cascade,
  display_order integer not null default 100,
  primary key (blog_slug, product_slug)
);

alter table public.blog_posts enable row level security;
alter table public.blog_post_topics enable row level security;
alter table public.blog_post_sections enable row level security;
alter table public.blog_post_section_paragraphs enable row level security;
alter table public.blog_post_references enable row level security;
alter table public.blog_post_related_episodes enable row level security;
alter table public.blog_post_related_affiliate_products enable row level security;

drop policy if exists "Allow public blog post reads" on public.blog_posts;
create policy "Allow public blog post reads"
  on public.blog_posts for select to anon, authenticated using (status = 'published');

drop policy if exists "Allow public blog topic reads" on public.blog_post_topics;
create policy "Allow public blog topic reads"
  on public.blog_post_topics for select to anon, authenticated using (
    exists (
      select 1 from public.blog_posts
      where blog_posts.slug = blog_post_topics.blog_slug
        and blog_posts.status = 'published'
    )
  );

drop policy if exists "Allow public blog section reads" on public.blog_post_sections;
create policy "Allow public blog section reads"
  on public.blog_post_sections for select to anon, authenticated using (
    exists (
      select 1 from public.blog_posts
      where blog_posts.slug = blog_post_sections.blog_slug
        and blog_posts.status = 'published'
    )
  );

drop policy if exists "Allow public blog paragraph reads" on public.blog_post_section_paragraphs;
create policy "Allow public blog paragraph reads"
  on public.blog_post_section_paragraphs for select to anon, authenticated using (
    exists (
      select 1 from public.blog_posts
      where blog_posts.slug = blog_post_section_paragraphs.blog_slug
        and blog_posts.status = 'published'
    )
  );

drop policy if exists "Allow public blog reference reads" on public.blog_post_references;
create policy "Allow public blog reference reads"
  on public.blog_post_references for select to anon, authenticated using (
    exists (
      select 1 from public.blog_posts
      where blog_posts.slug = blog_post_references.blog_slug
        and blog_posts.status = 'published'
    )
  );

drop policy if exists "Allow public blog related episode reads" on public.blog_post_related_episodes;
create policy "Allow public blog related episode reads"
  on public.blog_post_related_episodes for select to anon, authenticated using (
    exists (
      select 1 from public.blog_posts
      where blog_posts.slug = blog_post_related_episodes.blog_slug
        and blog_posts.status = 'published'
    )
  );

drop policy if exists "Allow public blog related product reads" on public.blog_post_related_affiliate_products;
create policy "Allow public blog related product reads"
  on public.blog_post_related_affiliate_products for select to anon, authenticated using (
    exists (
      select 1 from public.blog_posts
      where blog_posts.slug = blog_post_related_affiliate_products.blog_slug
        and blog_posts.status = 'published'
    )
  );
