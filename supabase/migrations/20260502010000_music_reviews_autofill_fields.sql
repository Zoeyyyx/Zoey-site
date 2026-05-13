alter table public.music_reviews
  add column if not exists external_music_url text,
  add column if not exists preview_url text,
  add column if not exists metadata_source text,
  add column if not exists metadata_raw jsonb,
  add column if not exists alternate_title text,
  add column if not exists featured_artists text[] not null default '{}';
