create table if not exists public.randomizer_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  title text not null default '',
  description text not null default '',
  rules text not null default '',
  logo_data_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists randomizer_templates_user_idx
  on public.randomizer_templates(user_id, updated_at desc);

alter table public.randomizer_templates enable row level security;

drop policy if exists "Users can manage their randomizer templates" on public.randomizer_templates;
create policy "Users can manage their randomizer templates"
  on public.randomizer_templates
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
