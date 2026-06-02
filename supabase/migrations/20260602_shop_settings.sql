create table if not exists public.shop_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shop_settings enable row level security;

drop policy if exists "Admin service role manages shop settings" on public.shop_settings;

create policy "Admin service role manages shop settings"
  on public.shop_settings
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
