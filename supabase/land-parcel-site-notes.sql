-- Shared, append-only notes for each parcel in the public dashboard.
-- Anyone can read notes; only approved OLH media editors can add them.
begin;

create table if not exists public.land_parcel_site_notes (
  id uuid primary key default gen_random_uuid(),
  parcel_id integer not null check (parcel_id between 1 and 79),
  note text not null check (char_length(btrim(note)) between 1 and 5000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists land_parcel_site_notes_parcel_created_idx
  on public.land_parcel_site_notes (parcel_id, created_at desc);

alter table public.land_parcel_site_notes enable row level security;

revoke all on table public.land_parcel_site_notes from anon, authenticated;
grant select (id, parcel_id, note, created_at) on public.land_parcel_site_notes to anon, authenticated;
grant insert (parcel_id, note, created_by) on public.land_parcel_site_notes to authenticated;

drop policy if exists "Anyone can read parcel site notes" on public.land_parcel_site_notes;
create policy "Anyone can read parcel site notes"
  on public.land_parcel_site_notes
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Approved editors can add parcel site notes" on public.land_parcel_site_notes;
create policy "Approved editors can add parcel site notes"
  on public.land_parcel_site_notes
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and public.is_olh_media_uploader()
  );

commit;
