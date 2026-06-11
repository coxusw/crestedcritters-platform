update storage.buckets
set file_size_limit = 26214400,
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif'
    ]
where id = 'isopedia-images';

drop policy if exists "Users upload own species gallery images" on storage.objects;
create policy "Users upload own species gallery images"
  on storage.objects for insert
  with check (
    bucket_id = 'isopedia-images'
    and (storage.foldername(name))[1] = 'species-gallery'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "Public reads species gallery images" on storage.objects;
create policy "Public reads species gallery images"
  on storage.objects for select
  using (
    bucket_id = 'isopedia-images'
    and (storage.foldername(name))[1] = 'species-gallery'
  );
