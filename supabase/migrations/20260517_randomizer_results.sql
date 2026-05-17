create table if not exists public.randomizer_results (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  rules text,
  mode text not null,
  spin_count integer not null default 1,
  prize_interval integer not null default 0,
  winner_count integer not null default 1,
  prize_list jsonb not null default '[]'::jsonb,
  prevent_duplicate_winners boolean not null default true,
  entries jsonb not null,
  spin_history jsonb not null,
  winners jsonb not null,
  logo_data_url text
);

create index if not exists randomizer_results_public_code_idx
  on public.randomizer_results(public_code);

create index if not exists randomizer_results_created_by_idx
  on public.randomizer_results(created_by, created_at desc);

alter table public.randomizer_results enable row level security;

drop policy if exists "Randomizer results are publicly readable" on public.randomizer_results;
create policy "Randomizer results are publicly readable"
  on public.randomizer_results
  for select
  using (true);

drop policy if exists "Authenticated users can create their randomizer results" on public.randomizer_results;
create policy "Authenticated users can create their randomizer results"
  on public.randomizer_results
  for insert
  to authenticated
  with check (created_by = auth.uid());
