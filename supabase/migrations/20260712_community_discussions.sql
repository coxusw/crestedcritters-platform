create extension if not exists pgcrypto;

create table if not exists public.community_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  icon text,
  color text,
  display_order integer not null default 100,
  is_active boolean not null default true,
  requires_approval boolean not null default false,
  marketplace_rules boolean not null default false,
  species_tagging_enabled boolean not null default true,
  images_enabled boolean not null default true,
  staff_only_posting boolean not null default false,
  posting_guidelines text,
  minimum_account_age_days integer not null default 0 check (minimum_account_age_days >= 0),
  minimum_reputation integer not null default 0 check (minimum_reputation >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_discussions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.community_categories(id) on delete restrict,
  author_id uuid references public.profiles(id) on delete set null,
  slug text not null unique,
  title text not null,
  body text not null,
  excerpt text,
  content_type text not null default 'discussion'
    check (content_type in ('discussion', 'guide', 'question', 'marketplace', 'journal', 'prompt')),
  status text not null default 'published'
    check (status in ('draft', 'published', 'pending', 'hidden', 'removed', 'archived', 'rejected', 'expired')),
  moderation_status text not null default 'clear'
    check (moderation_status in ('clear', 'pending', 'flagged', 'actioned')),
  pinned boolean not null default false,
  pinned_until timestamptz,
  featured boolean not null default false,
  locked boolean not null default false,
  answered boolean not null default false,
  accepted_reply_id uuid,
  reply_count integer not null default 0 check (reply_count >= 0),
  view_count integer not null default 0 check (view_count >= 0),
  save_count integer not null default 0 check (save_count >= 0),
  follow_count integer not null default 0 check (follow_count >= 0),
  report_count integer not null default 0 check (report_count >= 0),
  last_activity_at timestamptz not null default now(),
  last_reply_at timestamptz,
  last_reply_author_id uuid references public.profiles(id) on delete set null,
  source_guide_id uuid references public.isopedia_guides(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.community_replies (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references public.community_discussions(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  reply_to_author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  status text not null default 'published'
    check (status in ('published', 'hidden', 'removed')),
  helpful_count integer not null default 0 check (helpful_count >= 0),
  is_accepted_answer boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

alter table public.community_discussions
  add constraint community_discussions_accepted_reply_fk
  foreign key (accepted_reply_id) references public.community_replies(id) on delete set null;

create table if not exists public.community_discussion_species (
  discussion_id uuid not null references public.community_discussions(id) on delete cascade,
  species_id bigint not null references public.isopedia_species(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (discussion_id, species_id)
);

create table if not exists public.community_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.community_discussion_tags (
  discussion_id uuid not null references public.community_discussions(id) on delete cascade,
  tag_id uuid not null references public.community_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (discussion_id, tag_id)
);

create table if not exists public.community_images (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid references public.community_discussions(id) on delete cascade,
  reply_id uuid references public.community_replies(id) on delete cascade,
  owner_id uuid references public.profiles(id) on delete set null,
  image_url text not null,
  storage_path text,
  alt_text text,
  caption text,
  position integer not null default 1,
  status text not null default 'active' check (status in ('active', 'removed')),
  created_at timestamptz not null default now(),
  check (discussion_id is not null or reply_id is not null)
);

create table if not exists public.community_saves (
  discussion_id uuid not null references public.community_discussions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (discussion_id, profile_id)
);

create table if not exists public.community_follows (
  discussion_id uuid not null references public.community_discussions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (discussion_id, profile_id)
);

create table if not exists public.community_views (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references public.community_discussions(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  session_key text,
  viewed_at timestamptz not null default now()
);

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid references public.community_discussions(id) on delete cascade,
  reply_id uuid references public.community_replies(id) on delete cascade,
  reporter_id uuid references public.profiles(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'ignored')),
  moderator_notes text,
  action_taken text,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (discussion_id is not null or reply_id is not null)
);

create table if not exists public.community_moderation_history (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid references public.community_discussions(id) on delete cascade,
  reply_id uuid references public.community_replies(id) on delete cascade,
  moderator_id uuid references public.profiles(id) on delete set null,
  action text not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_listing_details (
  discussion_id uuid primary key references public.community_discussions(id) on delete cascade,
  listing_type text not null default 'available'
    check (listing_type in ('available', 'wanted', 'trade', 'local_pickup', 'expo_availability', 'supplies', 'plants', 'enclosures', 'cultures', 'cleanup_crew', 'other')),
  listing_status text not null default 'available'
    check (listing_status in ('available', 'pending', 'completed', 'expired', 'withdrawn')),
  species_or_product text,
  quantity text,
  price text,
  location text,
  state text,
  shipping_available boolean not null default false,
  local_pickup_available boolean not null default false,
  expo_name text,
  expiration_date date,
  preferred_contact_method text,
  permit_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_recurring_prompts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  weekday integer not null check (weekday between 0 and 6),
  category_id uuid references public.community_categories(id) on delete set null,
  enabled boolean not null default true,
  pin_for_days integer not null default 1 check (pin_for_days >= 0),
  featured_image_url text,
  seasonal_notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_prompt_runs (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.community_recurring_prompts(id) on delete cascade,
  discussion_id uuid references public.community_discussions(id) on delete set null,
  week_start date not null,
  generated_by uuid references public.profiles(id) on delete set null,
  created_by_system boolean not null default false,
  skipped boolean not null default false,
  created_at timestamptz not null default now(),
  unique (prompt_id, week_start)
);

create table if not exists public.species_follows (
  species_id bigint not null references public.isopedia_species(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  notify_discussions boolean not null default true,
  notify_guides boolean not null default true,
  notify_marketplace boolean not null default true,
  notify_photos boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (species_id, profile_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,
  discussion_id uuid references public.community_discussions(id) on delete cascade,
  reply_id uuid references public.community_replies(id) on delete cascade,
  destination_url text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.user_badge_display_settings (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  badge_id uuid not null references public.profile_badges(id) on delete cascade,
  is_visible boolean not null default true,
  show_inline boolean not null default true,
  show_on_profile boolean not null default true,
  display_order integer not null default 100,
  show_earned_date boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, badge_id)
);

alter table public.profile_badges
  add column if not exists rarity text not null default 'standard',
  add column if not exists profile_only boolean not null default false,
  add column if not exists allow_inline_display boolean not null default true,
  add column if not exists visible_by_default boolean not null default true,
  add column if not exists default_priority integer not null default 100,
  add column if not exists user_can_hide boolean not null default true,
  add column if not exists limited_edition boolean not null default false,
  add column if not exists retired_at timestamptz,
  add column if not exists earned_date_public_default boolean not null default false;

create index if not exists community_categories_active_order_idx
  on public.community_categories(is_active, display_order, name);
create index if not exists community_discussions_category_activity_idx
  on public.community_discussions(category_id, status, pinned desc, last_activity_at desc);
create index if not exists community_discussions_author_idx
  on public.community_discussions(author_id, created_at desc);
create index if not exists community_discussions_status_activity_idx
  on public.community_discussions(status, last_activity_at desc);
create index if not exists community_discussions_content_type_idx
  on public.community_discussions(content_type, status, created_at desc);
create index if not exists community_replies_discussion_created_idx
  on public.community_replies(discussion_id, created_at);
create index if not exists community_discussion_species_species_idx
  on public.community_discussion_species(species_id, discussion_id);
create index if not exists community_reports_status_idx
  on public.community_reports(status, created_at desc);
create index if not exists community_views_discussion_viewed_idx
  on public.community_views(discussion_id, viewed_at desc);
create index if not exists marketplace_listing_expiration_idx
  on public.marketplace_listing_details(listing_status, expiration_date);
create index if not exists notifications_recipient_read_idx
  on public.notifications(recipient_id, read_at, created_at desc);

alter table public.community_categories enable row level security;
alter table public.community_discussions enable row level security;
alter table public.community_replies enable row level security;
alter table public.community_discussion_species enable row level security;
alter table public.community_tags enable row level security;
alter table public.community_discussion_tags enable row level security;
alter table public.community_images enable row level security;
alter table public.community_saves enable row level security;
alter table public.community_follows enable row level security;
alter table public.community_views enable row level security;
alter table public.community_reports enable row level security;
alter table public.community_moderation_history enable row level security;
alter table public.marketplace_listing_details enable row level security;
alter table public.community_recurring_prompts enable row level security;
alter table public.community_prompt_runs enable row level security;
alter table public.species_follows enable row level security;
alter table public.notifications enable row level security;
alter table public.user_badge_display_settings enable row level security;

create or replace function public.community_touch_discussion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.community_discussions
    set
      reply_count = reply_count + 1,
      last_reply_at = new.created_at,
      last_reply_author_id = new.author_id,
      last_activity_at = new.created_at,
      updated_at = now()
    where id = new.discussion_id;
    return new;
  elsif tg_op = 'UPDATE' then
    update public.community_discussions
    set updated_at = now()
    where id = new.discussion_id;
    return new;
  end if;
  return new;
end;
$$;

drop trigger if exists community_replies_touch_discussion on public.community_replies;
create trigger community_replies_touch_discussion
  after insert or update on public.community_replies
  for each row
  execute function public.community_touch_discussion();

create or replace function public.community_recount_discussion_stats(target_discussion_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.community_discussions d
  set
    reply_count = (
      select count(*)::integer from public.community_replies r
      where r.discussion_id = target_discussion_id and r.status = 'published'
    ),
    save_count = (
      select count(*)::integer from public.community_saves s
      where s.discussion_id = target_discussion_id
    ),
    follow_count = (
      select count(*)::integer from public.community_follows f
      where f.discussion_id = target_discussion_id
    ),
    report_count = (
      select count(*)::integer from public.community_reports cr
      where cr.discussion_id = target_discussion_id and cr.status in ('open', 'reviewing')
    ),
    view_count = (
      select count(*)::integer from public.community_views v
      where v.discussion_id = target_discussion_id
    )
  where d.id = target_discussion_id;
end;
$$;

create or replace function public.community_week_start(target_date date default current_date)
returns date
language sql
immutable
as $$
  select (target_date - ((extract(dow from target_date)::integer + 6) % 7))::date;
$$;

grant execute on function public.community_recount_discussion_stats(uuid) to authenticated;
grant execute on function public.community_week_start(date) to anon, authenticated;

drop policy if exists "Public can read active community categories" on public.community_categories;
create policy "Public can read active community categories"
  on public.community_categories for select
  using (is_active or public.is_current_user_isopedia_admin());

drop policy if exists "Admins manage community categories" on public.community_categories;
create policy "Admins manage community categories"
  on public.community_categories for all
  using (public.is_current_user_isopedia_admin())
  with check (public.is_current_user_isopedia_admin());

drop policy if exists "Public can read published community discussions" on public.community_discussions;
create policy "Public can read published community discussions"
  on public.community_discussions for select
  using (status in ('published', 'expired') or public.is_current_user_isopedia_admin() or author_id = auth.uid());

drop policy if exists "Users create own community discussions" on public.community_discussions;
create policy "Users create own community discussions"
  on public.community_discussions for insert
  with check (auth.uid() = author_id);

drop policy if exists "Authors update own community discussions" on public.community_discussions;
create policy "Authors update own community discussions"
  on public.community_discussions for update
  using (auth.uid() = author_id or public.is_current_user_isopedia_admin())
  with check (auth.uid() = author_id or public.is_current_user_isopedia_admin());

drop policy if exists "Public can read published community replies" on public.community_replies;
create policy "Public can read published community replies"
  on public.community_replies for select
  using (
    status = 'published'
    or public.is_current_user_isopedia_admin()
    or author_id = auth.uid()
  );

drop policy if exists "Users create own community replies" on public.community_replies;
create policy "Users create own community replies"
  on public.community_replies for insert
  with check (auth.uid() = author_id);

drop policy if exists "Authors update own community replies" on public.community_replies;
create policy "Authors update own community replies"
  on public.community_replies for update
  using (auth.uid() = author_id or public.is_current_user_isopedia_admin())
  with check (auth.uid() = author_id or public.is_current_user_isopedia_admin());

drop policy if exists "Public can read community joins" on public.community_discussion_species;
create policy "Public can read community joins"
  on public.community_discussion_species for select using (true);
drop policy if exists "Users manage own community species joins" on public.community_discussion_species;
create policy "Users manage own community species joins"
  on public.community_discussion_species for all
  using (
    public.is_current_user_isopedia_admin()
    or exists (
      select 1 from public.community_discussions d
      where d.id = discussion_id and d.author_id = auth.uid()
    )
  )
  with check (
    public.is_current_user_isopedia_admin()
    or exists (
      select 1 from public.community_discussions d
      where d.id = discussion_id and d.author_id = auth.uid()
    )
  );

drop policy if exists "Public can read community tags" on public.community_tags;
create policy "Public can read community tags"
  on public.community_tags for select using (true);
drop policy if exists "Authenticated users create community tags" on public.community_tags;
create policy "Authenticated users create community tags"
  on public.community_tags for insert with check (auth.uid() is not null);
drop policy if exists "Public can read community discussion tags" on public.community_discussion_tags;
create policy "Public can read community discussion tags"
  on public.community_discussion_tags for select using (true);
drop policy if exists "Users manage own community discussion tags" on public.community_discussion_tags;
create policy "Users manage own community discussion tags"
  on public.community_discussion_tags for all
  using (
    public.is_current_user_isopedia_admin()
    or exists (
      select 1 from public.community_discussions d
      where d.id = discussion_id and d.author_id = auth.uid()
    )
  )
  with check (
    public.is_current_user_isopedia_admin()
    or exists (
      select 1 from public.community_discussions d
      where d.id = discussion_id and d.author_id = auth.uid()
    )
  );

drop policy if exists "Public can read community images" on public.community_images;
create policy "Public can read community images"
  on public.community_images for select using (status = 'active' or public.is_current_user_isopedia_admin());
drop policy if exists "Users create own community images" on public.community_images;
create policy "Users create own community images"
  on public.community_images for insert with check (auth.uid() = owner_id);
drop policy if exists "Users update own community images" on public.community_images;
create policy "Users update own community images"
  on public.community_images for update
  using (auth.uid() = owner_id or public.is_current_user_isopedia_admin())
  with check (auth.uid() = owner_id or public.is_current_user_isopedia_admin());

drop policy if exists "Users read own community saves" on public.community_saves;
create policy "Users read own community saves"
  on public.community_saves for select using (auth.uid() = profile_id or public.is_current_user_isopedia_admin());
drop policy if exists "Users manage own community saves" on public.community_saves;
create policy "Users manage own community saves"
  on public.community_saves for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "Users read own community follows" on public.community_follows;
create policy "Users read own community follows"
  on public.community_follows for select using (auth.uid() = profile_id or public.is_current_user_isopedia_admin());
drop policy if exists "Users manage own community follows" on public.community_follows;
create policy "Users manage own community follows"
  on public.community_follows for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "Anyone records community views" on public.community_views;
create policy "Anyone records community views"
  on public.community_views for insert with check (true);
drop policy if exists "Admins read community views" on public.community_views;
create policy "Admins read community views"
  on public.community_views for select using (public.is_current_user_isopedia_admin());

drop policy if exists "Users create community reports" on public.community_reports;
create policy "Users create community reports"
  on public.community_reports for insert with check (auth.uid() = reporter_id);
drop policy if exists "Reporters and admins read community reports" on public.community_reports;
create policy "Reporters and admins read community reports"
  on public.community_reports for select
  using (auth.uid() = reporter_id or public.is_current_user_isopedia_admin());
drop policy if exists "Admins manage community reports" on public.community_reports;
create policy "Admins manage community reports"
  on public.community_reports for update
  using (public.is_current_user_isopedia_admin())
  with check (public.is_current_user_isopedia_admin());

drop policy if exists "Admins read community moderation history" on public.community_moderation_history;
create policy "Admins read community moderation history"
  on public.community_moderation_history for select
  using (public.is_current_user_isopedia_admin());
drop policy if exists "Admins create community moderation history" on public.community_moderation_history;
create policy "Admins create community moderation history"
  on public.community_moderation_history for insert
  with check (public.is_current_user_isopedia_admin());

drop policy if exists "Public can read marketplace listing details" on public.marketplace_listing_details;
create policy "Public can read marketplace listing details"
  on public.marketplace_listing_details for select using (true);
drop policy if exists "Users manage own marketplace listing details" on public.marketplace_listing_details;
create policy "Users manage own marketplace listing details"
  on public.marketplace_listing_details for all
  using (
    public.is_current_user_isopedia_admin()
    or exists (
      select 1 from public.community_discussions d
      where d.id = discussion_id and d.author_id = auth.uid()
    )
  )
  with check (
    public.is_current_user_isopedia_admin()
    or exists (
      select 1 from public.community_discussions d
      where d.id = discussion_id and d.author_id = auth.uid()
    )
  );

drop policy if exists "Public read enabled recurring prompts" on public.community_recurring_prompts;
create policy "Public read enabled recurring prompts"
  on public.community_recurring_prompts for select
  using (enabled or public.is_current_user_isopedia_admin());
drop policy if exists "Admins manage recurring prompts" on public.community_recurring_prompts;
create policy "Admins manage recurring prompts"
  on public.community_recurring_prompts for all
  using (public.is_current_user_isopedia_admin())
  with check (public.is_current_user_isopedia_admin());
drop policy if exists "Admins manage prompt runs" on public.community_prompt_runs;
create policy "Admins manage prompt runs"
  on public.community_prompt_runs for all
  using (public.is_current_user_isopedia_admin())
  with check (public.is_current_user_isopedia_admin());

drop policy if exists "Users manage own species follows" on public.species_follows;
create policy "Users manage own species follows"
  on public.species_follows for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications"
  on public.notifications for select using (auth.uid() = recipient_id);
drop policy if exists "Users update own notifications" on public.notifications;
create policy "Users update own notifications"
  on public.notifications for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);
drop policy if exists "Admins create notifications" on public.notifications;
create policy "Admins create notifications"
  on public.notifications for insert
  with check (public.is_current_user_isopedia_admin());
drop policy if exists "Users create actor notifications" on public.notifications;
create policy "Users create actor notifications"
  on public.notifications for insert
  with check (auth.uid() = actor_id and recipient_id <> auth.uid());

drop policy if exists "Users read own badge display settings" on public.user_badge_display_settings;
create policy "Users read own badge display settings"
  on public.user_badge_display_settings for select
  using (auth.uid() = profile_id or public.is_current_user_isopedia_admin());
drop policy if exists "Users manage own badge display settings" on public.user_badge_display_settings;
create policy "Users manage own badge display settings"
  on public.user_badge_display_settings for all
  using (auth.uid() = profile_id)
  with check (
    auth.uid() = profile_id
    and exists (
      select 1 from public.profile_badge_assignments a
      where a.profile_id = auth.uid() and a.badge_id = user_badge_display_settings.badge_id
    )
  );

drop policy if exists "Users upload own community images" on storage.objects;
create policy "Users upload own community images"
  on storage.objects for insert
  with check (
    bucket_id = 'isopedia-images'
    and (storage.foldername(name))[1] = 'community'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "Public reads community images" on storage.objects;
create policy "Public reads community images"
  on storage.objects for select
  using (
    bucket_id = 'isopedia-images'
    and (storage.foldername(name))[1] = 'community'
  );

insert into public.community_categories (
  name,
  slug,
  description,
  icon,
  color,
  display_order,
  requires_approval,
  marketplace_rules,
  species_tagging_enabled,
  images_enabled,
  staff_only_posting,
  posting_guidelines
)
values
  ('General Discussion', 'general-discussion', 'General isopod, springtail, bioactive, enclosure, and hobby conversations.', 'Chat', 'emerald', 10, false, false, true, true, false, null),
  ('Guides', 'guides', 'Detailed care guides, tutorials, enclosure guides, substrate recipes, breeding information, and educational content.', 'Guide', 'sky', 20, false, false, true, true, false, 'Long-form educational posts should be original, practical, and safe for the hobby.'),
  ('Help & Questions', 'help-questions', 'Beginner questions, care problems, troubleshooting, and general requests for help.', 'Help', 'amber', 30, false, false, true, true, false, null),
  ('Species Help', 'species-help', 'Questions related to a specific species, morph, ID, care issue, breeding problem, or colony concern.', 'Species', 'lime', 40, false, false, true, true, false, null),
  ('Colony Journals', 'colony-journals', 'Ongoing journals where users can document colonies over time.', 'Journal', 'violet', 50, false, false, true, true, false, null),
  ('Identification Help', 'identification-help', 'Upload photos and request species, morph, pest, fungus, mite, springtail, or enclosure issue identification.', 'ID', 'cyan', 60, false, false, true, true, false, 'Add clear photos, location/context when useful, and what you have already checked.'),
  ('Show Off Your Stuff', 'show-off-your-collection', 'Photos, colony updates, enclosure showcases, terrarium builds, new pickups, breeding success, rare species, and hobby accomplishments.', 'Photo', 'rose', 70, false, false, true, true, false, null),
  ('Marketplace Connections', 'marketplace-connections', 'A place for users and vendors to announce availability or post wanted listings. Isopedia does not process payments or guarantee transactions.', 'Market', 'yellow', 80, false, true, true, true, false, 'Isopedia only provides a space for community members to connect. Users are responsible for laws, permits, shipping restrictions, and private transaction terms.'),
  ('Expos & Events', 'expos-events', 'Discussions about expos, vendors attending, meetups, event preparation, reviews, and post-event conversations.', 'Expo', 'orange', 90, false, false, true, true, false, null),
  ('Isopedia Suggestions & Feedback', 'isopedia-suggestions-feedback', 'Feature requests, bug reports, site feedback, community ideas, and suggestions for improving Isopedia.', 'Feedback', 'slate', 100, false, false, false, true, false, null)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  color = excluded.color,
  display_order = excluded.display_order,
  marketplace_rules = excluded.marketplace_rules,
  species_tagging_enabled = excluded.species_tagging_enabled,
  images_enabled = excluded.images_enabled,
  posting_guidelines = excluded.posting_guidelines,
  updated_at = now();

insert into public.community_recurring_prompts (
  title,
  slug,
  description,
  weekday,
  category_id,
  enabled,
  pin_for_days
)
select seed.title, seed.slug, seed.description, seed.weekday, c.id, true, 2
from (
  values
    ('Morph Monday', 'morph-monday', 'What morph or species are you most excited about this week? Share a photo and tell us why.', 1, 'show-off-your-collection'),
    ('Maintenance Tuesday', 'maintenance-tuesday', 'What maintenance did your colonies need this week?', 2, 'general-discussion'),
    ('Picture Wednesday', 'picture-wednesday', 'Share your best isopod or enclosure photo from this week.', 3, 'show-off-your-collection'),
    ('Throwback Thursday', 'throwback-thursday', 'Show us where one of your colonies started compared with where it is today.', 4, 'colony-journals'),
    ('Feature Friday', 'feature-friday', 'Highlight a member, breeder, species, guide, enclosure, helpful answer, or useful community contribution.', 5, 'isopedia-suggestions-feedback'),
    ('Showoff Saturday', 'showoff-saturday', 'What colony are you most proud of right now?', 6, 'show-off-your-collection'),
    ('Setup Sunday', 'setup-sunday', 'Share a setup you built, updated, or maintained this weekend.', 0, 'general-discussion')
) as seed(title, slug, description, weekday, category_slug)
join public.community_categories c on c.slug = seed.category_slug
on conflict (slug) do update
set
  title = excluded.title,
  description = excluded.description,
  weekday = excluded.weekday,
  category_id = excluded.category_id,
  updated_at = now();

insert into public.community_discussions (
  id,
  category_id,
  author_id,
  slug,
  title,
  body,
  excerpt,
  content_type,
  status,
  source_guide_id,
  created_at,
  updated_at,
  last_activity_at
)
select
  gen_random_uuid(),
  categories.id,
  guides.author_user_id,
  guides.slug,
  guides.title,
  guides.body,
  left(regexp_replace(guides.body, '\s+', ' ', 'g'), 180),
  'guide',
  case
    when guides.status = 'published' then 'published'
    when guides.status = 'hidden' then 'hidden'
    else 'removed'
  end,
  guides.id,
  guides.created_at,
  guides.updated_at,
  coalesce(guides.updated_at, guides.created_at)
from public.isopedia_guides guides
join public.community_categories categories on categories.slug = 'guides'
where not exists (
  select 1
  from public.community_discussions existing
  where existing.source_guide_id = guides.id
     or existing.slug = guides.slug
)
on conflict (slug) do nothing;

insert into public.community_images (
  discussion_id,
  owner_id,
  image_url,
  storage_path,
  caption,
  position,
  created_at
)
select
  discussions.id,
  discussions.author_id,
  images.image_url,
  images.storage_path,
  images.caption,
  images.position,
  images.created_at
from public.isopedia_guide_images images
join public.community_discussions discussions
  on discussions.source_guide_id = images.guide_id
where not exists (
  select 1
  from public.community_images existing
  where existing.discussion_id = discussions.id
    and existing.image_url = images.image_url
);
