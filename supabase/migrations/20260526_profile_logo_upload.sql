alter table public.profiles
  add column if not exists profile_logo_url text;

create index if not exists profiles_profile_logo_url_idx
  on public.profiles(profile_logo_url)
  where profile_logo_url is not null;

drop policy if exists "Users upload own profile logos" on storage.objects;
create policy "Users upload own profile logos"
  on storage.objects for insert
  with check (
    bucket_id = 'isopedia-images'
    and (storage.foldername(name))[1] = 'profile-logos'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "Users update own profile logos" on storage.objects;
create policy "Users update own profile logos"
  on storage.objects for update
  using (
    bucket_id = 'isopedia-images'
    and (storage.foldername(name))[1] = 'profile-logos'
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'isopedia-images'
    and (storage.foldername(name))[1] = 'profile-logos'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "Users delete own profile logos" on storage.objects;
create policy "Users delete own profile logos"
  on storage.objects for delete
  using (
    bucket_id = 'isopedia-images'
    and (storage.foldername(name))[1] = 'profile-logos'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "Public reads profile logos" on storage.objects;
create policy "Public reads profile logos"
  on storage.objects for select
  using (
    bucket_id = 'isopedia-images'
    and (storage.foldername(name))[1] = 'profile-logos'
  );
