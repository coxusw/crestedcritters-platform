create extension if not exists pgcrypto;

create table if not exists public.isopedia_guides (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  body text not null,
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'published' check (status in ('published', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.isopedia_guide_images (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references public.isopedia_guides(id) on delete cascade,
  position integer not null check (position between 1 and 10),
  image_url text not null,
  storage_path text,
  caption text,
  created_at timestamptz not null default now(),
  unique (guide_id, position)
);

create table if not exists public.isopedia_guide_likes (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references public.isopedia_guides(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (guide_id, user_id)
);

create index if not exists isopedia_guides_status_likes_created_idx
  on public.isopedia_guides(status, created_at desc);

create index if not exists isopedia_guides_author_idx
  on public.isopedia_guides(author_user_id);

create index if not exists isopedia_guide_images_guide_idx
  on public.isopedia_guide_images(guide_id, position);

create index if not exists isopedia_guide_likes_guide_idx
  on public.isopedia_guide_likes(guide_id);

create index if not exists isopedia_guide_likes_user_idx
  on public.isopedia_guide_likes(user_id);

alter table public.isopedia_guides enable row level security;
alter table public.isopedia_guide_images enable row level security;
alter table public.isopedia_guide_likes enable row level security;

drop policy if exists "Public can read published guides" on public.isopedia_guides;
create policy "Public can read published guides"
  on public.isopedia_guides for select
  using (status = 'published' or public.is_current_user_isopedia_admin());

drop policy if exists "Users can create own guides" on public.isopedia_guides;
create policy "Users can create own guides"
  on public.isopedia_guides for insert
  with check (auth.uid() = author_user_id and status = 'published');

drop policy if exists "Authors can update own published guides" on public.isopedia_guides;
create policy "Authors can update own published guides"
  on public.isopedia_guides for update
  using (auth.uid() = author_user_id or public.is_current_user_isopedia_admin())
  with check (auth.uid() = author_user_id or public.is_current_user_isopedia_admin());

drop policy if exists "Public can read guide images" on public.isopedia_guide_images;
create policy "Public can read guide images"
  on public.isopedia_guide_images for select
  using (
    exists (
      select 1
      from public.isopedia_guides g
      where g.id = guide_id
        and (g.status = 'published' or public.is_current_user_isopedia_admin())
    )
  );

drop policy if exists "Guide authors can add guide images" on public.isopedia_guide_images;
create policy "Guide authors can add guide images"
  on public.isopedia_guide_images for insert
  with check (
    exists (
      select 1
      from public.isopedia_guides g
      where g.id = guide_id
        and g.author_user_id = auth.uid()
    )
  );

drop policy if exists "Public can read guide likes" on public.isopedia_guide_likes;
create policy "Public can read guide likes"
  on public.isopedia_guide_likes for select
  using (true);

drop policy if exists "Users can like guides" on public.isopedia_guide_likes;
create policy "Users can like guides"
  on public.isopedia_guide_likes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.isopedia_guides g
      where g.id = guide_id
        and g.status = 'published'
        and g.author_user_id <> auth.uid()
    )
  );

drop policy if exists "Users can unlike guides" on public.isopedia_guide_likes;
create policy "Users can unlike guides"
  on public.isopedia_guide_likes for delete
  using (auth.uid() = user_id);

drop policy if exists "Users upload own guide images" on storage.objects;
create policy "Users upload own guide images"
  on storage.objects for insert
  with check (
    bucket_id = 'isopedia-images'
    and (storage.foldername(name))[1] = 'guides'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "Public reads guide images" on storage.objects;
create policy "Public reads guide images"
  on storage.objects for select
  using (
    bucket_id = 'isopedia-images'
    and (storage.foldername(name))[1] = 'guides'
  );
