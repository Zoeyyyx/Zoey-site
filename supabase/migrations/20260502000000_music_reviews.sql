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
  cover_url text,
  rating numeric,
  review_short text,
  review_body text,
  tags text[] not null default '{}',
  mood text,
  player_type text not null default 'netease_song',
  is_playable boolean not null default true,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_music_reviews_updated_at on public.music_reviews;
create trigger set_music_reviews_updated_at
before update on public.music_reviews
for each row execute function public.set_updated_at();

create index if not exists music_reviews_published_at_idx on public.music_reviews (published_at desc);
create index if not exists music_reviews_slug_idx on public.music_reviews (slug);
create index if not exists music_reviews_published_idx on public.music_reviews (is_published);

alter table public.music_reviews enable row level security;

drop policy if exists "Public can read published music reviews" on public.music_reviews;
create policy "Public can read published music reviews"
on public.music_reviews
for select
to anon, authenticated
using (is_published = true);

drop policy if exists "Admins can read all music reviews" on public.music_reviews;
create policy "Admins can read all music reviews"
on public.music_reviews
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert music reviews" on public.music_reviews;
create policy "Admins can insert music reviews"
on public.music_reviews
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update music reviews" on public.music_reviews;
create policy "Admins can update music reviews"
on public.music_reviews
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete music reviews" on public.music_reviews;
create policy "Admins can delete music reviews"
on public.music_reviews
for delete
to authenticated
using (public.is_admin());
