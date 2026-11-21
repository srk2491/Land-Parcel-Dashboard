-- Run after the OLH Supabase media setup. This creates a separate media
-- library for the 79-parcel dashboard and reuses its uploader allowlist.
create extension if not exists pgcrypto;

create table if not exists public.land_parcel_media (
  id uuid primary key default gen_random_uuid(),
  parcel_id integer not null check (parcel_id between 1 and 79),
  media_type text not null check (media_type in ('image', 'video')),
  object_path text not null unique,
  file_name text not null check (char_length(file_name) <= 180),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 94371840),
  uploader_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint land_parcel_media_path_matches_parcel check (
    split_part(object_path, '/', 1) = 'parcel-' || lpad(parcel_id::text, 3, '0')
  )
);

create index if not exists land_parcel_media_parcel_created
  on public.land_parcel_media(parcel_id, created_at desc);

alter table public.land_parcel_media enable row level security;
drop policy if exists "Public can read land parcel media" on public.land_parcel_media;
drop policy if exists "Approved officials can add land parcel media" on public.land_parcel_media;
drop policy if exists "Approved officials can edit land parcel media" on public.land_parcel_media;
drop policy if exists "Approved officials can delete land parcel media" on public.land_parcel_media;

create policy "Public can read land parcel media" on public.land_parcel_media
  for select to anon, authenticated using (true);
create policy "Approved officials can add land parcel media" on public.land_parcel_media
  for insert to authenticated with check (
    uploader_id = auth.uid() and public.is_olh_media_uploader()
  );
create policy "Approved officials can edit land parcel media" on public.land_parcel_media
  for update to authenticated using (public.is_olh_media_uploader())
  with check (public.is_olh_media_uploader());
create policy "Approved officials can delete land parcel media" on public.land_parcel_media
  for delete to authenticated using (public.is_olh_media_uploader());

grant select on public.land_parcel_media to anon, authenticated;
grant insert, update, delete on public.land_parcel_media to authenticated;

-- Keep the upload cap consistent with the OLH media service: 90 MiB per file.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'land-parcel-media',
  'land-parcel-media',
  true,
  94371840,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Approved officials upload land parcel media files" on storage.objects;
drop policy if exists "Approved officials delete land parcel media files" on storage.objects;
create policy "Approved officials upload land parcel media files" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'land-parcel-media'
    and public.is_olh_media_uploader()
    and (storage.foldername(name))[1] ~ '^parcel-0(0[1-9]|[1-7][0-9])$'
  );
create policy "Approved officials delete land parcel media files" on storage.objects
  for delete to authenticated using (
    bucket_id = 'land-parcel-media' and public.is_olh_media_uploader()
  );
