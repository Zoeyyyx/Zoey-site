create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.admin_users (
  user_id uuid primary key,
  email text unique not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  publish_date timestamptz not null default timezone('utc', now()),
  title text,
  content text not null default '',
  tags text[] not null default '{}',
  mood text,
  is_published boolean not null default false,
  order_index integer,
  source_type text not null default 'manual',
  external_id text,
  source_url text,
  raw_source jsonb
);

alter table public.notes
  add column if not exists source_type text not null default 'manual',
  add column if not exists external_id text,
  add column if not exists source_url text,
  add column if not exists raw_source jsonb;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  publish_date timestamptz not null default timezone('utc', now()),
  title text not null,
  summary text not null default '',
  category text not null default 'essay',
  cover_image_url text,
  content_html text not null default '',
  is_published boolean not null default false,
  featured boolean not null default false
);

create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  publish_date timestamptz not null default timezone('utc', now()),
  title text not null,
  category text not null default 'misc',
  image_url text not null default '',
  thumbnail_url text,
  description text not null default '',
  is_published boolean not null default false,
  sort_order integer
);

create table if not exists public.music_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  publish_date timestamptz not null default timezone('utc', now()),
  title text not null,
  artist text not null default '',
  cover_image_url text,
  audio_url text not null default '',
  description text not null default '',
  lyrics_or_notes text not null default '',
  is_published boolean not null default false,
  sort_order integer
);

create table if not exists public.music_reviews (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  artist text,
  album text,
  song_name text,
  netease_song_id text,
  netease_playlist_id text,
  netease_url text,
  external_music_url text,
  preview_url text,
  cover_url text,
  rating numeric,
  review_short text,
  review_body text,
  tags text[] not null default '{}',
  mood text,
  metadata_source text,
  metadata_raw jsonb,
  alternate_title text,
  featured_artists text[] not null default '{}',
  player_type text not null default 'netease_song',
  is_playable boolean not null default true,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.site_settings (
  setting_key text primary key,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

drop trigger if exists set_notes_updated_at on public.notes;
create trigger set_notes_updated_at
before update on public.notes
for each row execute function public.set_updated_at();

drop trigger if exists set_posts_updated_at on public.posts;
create trigger set_posts_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

drop trigger if exists set_gallery_items_updated_at on public.gallery_items;
create trigger set_gallery_items_updated_at
before update on public.gallery_items
for each row execute function public.set_updated_at();

drop trigger if exists set_music_items_updated_at on public.music_items;
create trigger set_music_items_updated_at
before update on public.music_items
for each row execute function public.set_updated_at();

drop trigger if exists set_music_reviews_updated_at on public.music_reviews;
create trigger set_music_reviews_updated_at
before update on public.music_reviews
for each row execute function public.set_updated_at();

drop trigger if exists set_site_settings_updated_at on public.site_settings;
create trigger set_site_settings_updated_at
before update on public.site_settings
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('images', 'images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('covers', 'covers', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('audio', 'audio', true, 52428800, array['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/aac', 'audio/ogg'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create index if not exists notes_publish_date_idx on public.notes (publish_date desc);
create index if not exists notes_published_idx on public.notes (is_published);
create index if not exists notes_source_type_idx on public.notes (source_type);
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notes_source_external_id_key'
      and conrelid = 'public.notes'::regclass
  ) then
    alter table public.notes
      add constraint notes_source_external_id_key unique (source_type, external_id);
  end if;
end;
$$;
create index if not exists posts_publish_date_idx on public.posts (publish_date desc);
create index if not exists posts_slug_idx on public.posts (slug);
create index if not exists posts_published_idx on public.posts (is_published);
create index if not exists gallery_publish_date_idx on public.gallery_items (publish_date desc);
create index if not exists gallery_sort_order_idx on public.gallery_items (sort_order);
create index if not exists music_publish_date_idx on public.music_items (publish_date desc);
create index if not exists music_sort_order_idx on public.music_items (sort_order);
create index if not exists music_reviews_published_at_idx on public.music_reviews (published_at desc);
create index if not exists music_reviews_slug_idx on public.music_reviews (slug);
create index if not exists music_reviews_published_idx on public.music_reviews (is_published);
