-- Episode enrichment tables for Supabase-owned show notes.
-- These move detail-page takeaways, checklists, and ordered show-note sections
-- out of checked-in JSON while keeping each piece editable in Supabase Studio.

create table if not exists public.episode_key_takeaways (
  episode_slug text not null references public.episodes(slug) on delete cascade,
  display_order integer not null,
  body text not null check (char_length(body) between 1 and 1200),
  primary key (episode_slug, display_order)
);

create index if not exists episode_key_takeaways_episode_slug_idx
  on public.episode_key_takeaways (episode_slug);

create table if not exists public.episode_checklist_items (
  episode_slug text not null references public.episodes(slug) on delete cascade,
  display_order integer not null,
  body text not null check (char_length(body) between 1 and 1200),
  primary key (episode_slug, display_order)
);

create index if not exists episode_checklist_items_episode_slug_idx
  on public.episode_checklist_items (episode_slug);

create table if not exists public.episode_sections (
  episode_slug text not null references public.episodes(slug) on delete cascade,
  display_order integer not null,
  title text not null check (char_length(title) between 1 and 240),
  primary key (episode_slug, display_order)
);

create index if not exists episode_sections_episode_slug_idx
  on public.episode_sections (episode_slug);

create table if not exists public.episode_section_paragraphs (
  episode_slug text not null,
  section_display_order integer not null,
  display_order integer not null,
  body text not null check (char_length(body) between 1 and 2000),
  primary key (episode_slug, section_display_order, display_order),
  foreign key (episode_slug, section_display_order)
    references public.episode_sections(episode_slug, display_order)
    on delete cascade
);

create index if not exists episode_section_paragraphs_episode_slug_idx
  on public.episode_section_paragraphs (episode_slug);

alter table public.episode_key_takeaways enable row level security;
alter table public.episode_checklist_items enable row level security;
alter table public.episode_sections enable row level security;
alter table public.episode_section_paragraphs enable row level security;

drop policy if exists "Allow public episode key takeaway reads" on public.episode_key_takeaways;
create policy "Allow public episode key takeaway reads"
  on public.episode_key_takeaways for select to anon, authenticated using (true);

drop policy if exists "Allow public episode checklist reads" on public.episode_checklist_items;
create policy "Allow public episode checklist reads"
  on public.episode_checklist_items for select to anon, authenticated using (true);

drop policy if exists "Allow public episode section reads" on public.episode_sections;
create policy "Allow public episode section reads"
  on public.episode_sections for select to anon, authenticated using (true);

drop policy if exists "Allow public episode section paragraph reads" on public.episode_section_paragraphs;
create policy "Allow public episode section paragraph reads"
  on public.episode_section_paragraphs for select to anon, authenticated using (true);
