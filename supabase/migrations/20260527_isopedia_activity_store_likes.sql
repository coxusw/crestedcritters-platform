-- Isopedia activity privacy, discussion likes, IsoToken shop, and analytics foundation.
-- Safe to run on production: creates missing tables/columns and does not delete data.

create extension if not exists pgcrypto;

create table if not exists public.isopedia_feature_flags (
  key text primary key,
  label text not null,
  description text,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_visibility_settings (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  bio_public boolean not null default true,
  website_public boolean not null default true,
  facebook_public boolean not null default true,
  instagram_public boolean not null default true,
  twitter_public boolean not null default true,
  collection_preview_public boolean not null default true,
  recent_discussions_public boolean not null default true,
  expo_status_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profile_visibility_settings
  add column if not exists recent_discussions_public boolean not null default true,
  add column if not exists expo_status_public boolean not null default true,
  add column if not exists collection_preview_public boolean not null default true;

create table if not exists public.isopedia_discussion_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.isopedia_discussions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

create index if not exists isopedia_discussion_likes_comment_idx
  on public.isopedia_discussion_likes(comment_id);

create index if not exists isopedia_discussion_likes_user_idx
  on public.isopedia_discussion_likes(user_id);

create table if not exists public.isotoken_shop_items (
  id uuid primary key default gen_random_uuid(),
  item_key text unique,
  name text not null,
  description text,
  item_type text not null default 'feature'
    check (item_type in ('badge', 'feature', 'profile_banner', 'username_change', 'profile_theme', 'other')),
  price integer not null default 0 check (price >= 0),
  active boolean not null default false,
  limited_quantity integer check (limited_quantity is null or limited_quantity >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.isotoken_purchases (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null references public.isotoken_shop_items(id) on delete restrict,
  price_paid integer not null check (price_paid >= 0),
  status text not null default 'completed'
    check (status in ('completed', 'refunded', 'revoked')),
  created_at timestamptz not null default now()
);

create index if not exists isotoken_purchases_profile_idx
  on public.isotoken_purchases(profile_id);

create index if not exists isotoken_purchases_item_idx
  on public.isotoken_purchases(item_id);

create table if not exists public.isopedia_analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  entity_type text,
  entity_id text,
  path text,
  referrer_domain text,
  traffic_source text,
  metadata jsonb not null default '{}'::jsonb,
  profile_id uuid references public.profiles(id) on delete set null,
  session_key text,
  created_at timestamptz not null default now()
);

create index if not exists isopedia_analytics_events_created_idx
  on public.isopedia_analytics_events(created_at desc);

create index if not exists isopedia_analytics_events_event_type_idx
  on public.isopedia_analytics_events(event_type);

create index if not exists isopedia_analytics_events_entity_idx
  on public.isopedia_analytics_events(entity_type, entity_id);

alter table public.profile_visibility_settings enable row level security;
alter table public.isopedia_feature_flags enable row level security;
alter table public.isopedia_discussion_likes enable row level security;
alter table public.isotoken_shop_items enable row level security;
alter table public.isotoken_purchases enable row level security;
alter table public.isopedia_analytics_events enable row level security;

create or replace function public.is_current_user_isopedia_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.admin_profiles ap
      where ap.id = auth.uid()
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'moderator')
    );
$$;

grant execute on function public.is_current_user_isopedia_admin() to anon, authenticated;

insert into public.isopedia_feature_flags (key, label, description, enabled)
values
  ('profile_image_gallery', 'Profile image gallery', 'Allow users to share setups, colonies, booths, builds, and collection photos on profiles.', false),
  ('profile_themes', 'Profile themes', 'Allow custom public profile themes and colors.', false),
  ('profile_banner_images', 'Profile banner images', 'Allow users to upload profile banner images.', false),
  ('public_profile_analytics_display', 'Public profile analytics display', 'Show selected profile analytics publicly to profile owners or visitors.', false),
  ('premium_profile_button_styling', 'Premium profile button styling', 'Enable highlighted store/social/vendor buttons on profiles.', false),
  ('verified_breeder_vendor_tools', 'Verified breeder/vendor tools', 'Enable future breeder/vendor verification workflows and badges.', false),
  ('expo_status_display_profiles', 'Expo status display on profiles', 'Show public expo attending/vending status cards on profiles.', true),
  ('recent_discussions_profiles', 'Recent discussions on profiles', 'Show recent public discussion activity on profiles.', true),
  ('public_collection_preview_profiles', 'Public collection preview on profiles', 'Show compact public collection previews on profiles.', true),
  ('social_site_buttons_profiles', 'Social/site buttons on profiles', 'Show website and social profile buttons when users make them public.', true)
on conflict (key) do update
set
  label = excluded.label,
  description = excluded.description,
  updated_at = now();

drop policy if exists "Public can read feature flags" on public.isopedia_feature_flags;
create policy "Public can read feature flags"
  on public.isopedia_feature_flags for select
  using (true);

drop policy if exists "Admins can manage feature flags" on public.isopedia_feature_flags;
create policy "Admins can manage feature flags"
  on public.isopedia_feature_flags for all
  using (public.is_current_user_isopedia_admin())
  with check (public.is_current_user_isopedia_admin());

drop policy if exists "Public can read profile visibility" on public.profile_visibility_settings;
create policy "Public can read profile visibility"
  on public.profile_visibility_settings for select
  using (true);

drop policy if exists "Users can insert own profile visibility" on public.profile_visibility_settings;
create policy "Users can insert own profile visibility"
  on public.profile_visibility_settings for insert
  with check (auth.uid() = profile_id);

drop policy if exists "Users can update own profile visibility" on public.profile_visibility_settings;
create policy "Users can update own profile visibility"
  on public.profile_visibility_settings for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "Public can read discussion likes" on public.isopedia_discussion_likes;
create policy "Public can read discussion likes"
  on public.isopedia_discussion_likes for select
  using (true);

drop policy if exists "Users can like discussion comments" on public.isopedia_discussion_likes;
create policy "Users can like discussion comments"
  on public.isopedia_discussion_likes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.isopedia_discussions d
      where d.id = comment_id
        and d.status = 'active'
        and d.user_id <> auth.uid()
    )
  );

drop policy if exists "Users can unlike discussion comments" on public.isopedia_discussion_likes;
create policy "Users can unlike discussion comments"
  on public.isopedia_discussion_likes for delete
  using (auth.uid() = user_id);

drop policy if exists "Public can read active shop items" on public.isotoken_shop_items;
create policy "Public can read active shop items"
  on public.isotoken_shop_items for select
  using (active = true or public.is_current_user_isopedia_admin());

drop policy if exists "Admins can manage shop items" on public.isotoken_shop_items;
create policy "Admins can manage shop items"
  on public.isotoken_shop_items for all
  using (public.is_current_user_isopedia_admin())
  with check (public.is_current_user_isopedia_admin());

drop policy if exists "Users can read own purchases" on public.isotoken_purchases;
create policy "Users can read own purchases"
  on public.isotoken_purchases for select
  using (auth.uid() = profile_id or public.is_current_user_isopedia_admin());

drop policy if exists "Users can create own purchases" on public.isotoken_purchases;
create policy "Users can create own purchases"
  on public.isotoken_purchases for insert
  with check (auth.uid() = profile_id);

drop policy if exists "Admins can manage purchases" on public.isotoken_purchases;
create policy "Admins can manage purchases"
  on public.isotoken_purchases for all
  using (public.is_current_user_isopedia_admin())
  with check (public.is_current_user_isopedia_admin());

drop policy if exists "Anyone can record analytics events" on public.isopedia_analytics_events;
create policy "Anyone can record analytics events"
  on public.isopedia_analytics_events for insert
  with check (true);

drop policy if exists "Admins can read analytics events" on public.isopedia_analytics_events;
create policy "Admins can read analytics events"
  on public.isopedia_analytics_events for select
  using (public.is_current_user_isopedia_admin());
