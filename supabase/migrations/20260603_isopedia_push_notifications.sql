create table if not exists public.isopedia_notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  push_enabled boolean not null default false,
  notify_guides boolean not null default true,
  notify_discussions boolean not null default true,
  notify_expos boolean not null default true,
  notify_isotokens boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.isopedia_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  subscription jsonb not null,
  user_agent text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, endpoint)
);

create index if not exists isopedia_push_subscriptions_profile_idx
  on public.isopedia_push_subscriptions(profile_id, active);

alter table public.isopedia_notification_preferences enable row level security;
alter table public.isopedia_push_subscriptions enable row level security;

drop policy if exists "Users read own Isopedia notification preferences" on public.isopedia_notification_preferences;
create policy "Users read own Isopedia notification preferences"
  on public.isopedia_notification_preferences for select
  using (auth.uid() = profile_id);

drop policy if exists "Users insert own Isopedia notification preferences" on public.isopedia_notification_preferences;
create policy "Users insert own Isopedia notification preferences"
  on public.isopedia_notification_preferences for insert
  with check (auth.uid() = profile_id);

drop policy if exists "Users update own Isopedia notification preferences" on public.isopedia_notification_preferences;
create policy "Users update own Isopedia notification preferences"
  on public.isopedia_notification_preferences for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "Users read own Isopedia push subscriptions" on public.isopedia_push_subscriptions;
create policy "Users read own Isopedia push subscriptions"
  on public.isopedia_push_subscriptions for select
  using (auth.uid() = profile_id);

drop policy if exists "Users insert own Isopedia push subscriptions" on public.isopedia_push_subscriptions;
create policy "Users insert own Isopedia push subscriptions"
  on public.isopedia_push_subscriptions for insert
  with check (auth.uid() = profile_id);

drop policy if exists "Users update own Isopedia push subscriptions" on public.isopedia_push_subscriptions;
create policy "Users update own Isopedia push subscriptions"
  on public.isopedia_push_subscriptions for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);
