alter table public.notes
  add column if not exists source_type text not null default 'manual',
  add column if not exists external_id text,
  add column if not exists source_url text,
  add column if not exists raw_source jsonb;

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
