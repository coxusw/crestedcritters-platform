create table if not exists public.isopedia_raffles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  rules text,
  image_url text,
  prize_type text not null default 'physical',
  status text not null default 'draft'
    check (status in ('template', 'draft', 'active', 'closed', 'completed')),
  entry_cost_isotokens integer not null default 10 check (entry_cost_isotokens >= 0),
  donation_cents_per_entry integer not null default 100 check (donation_cents_per_entry >= 100),
  allow_isotoken_entries boolean not null default true,
  allow_donation_entries boolean not null default true,
  allow_multiple_entries boolean not null default true,
  max_entries integer check (max_entries is null or max_entries > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  winner_profile_id uuid references public.profiles(id) on delete set null,
  winner_entry_id uuid,
  results_url text,
  result_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists isopedia_raffles_status_idx
  on public.isopedia_raffles(status, starts_at, ends_at);

create table if not exists public.isopedia_raffle_entries (
  id uuid primary key default gen_random_uuid(),
  raffle_id uuid not null references public.isopedia_raffles(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  entry_source text not null check (entry_source in ('isotokens', 'donation', 'manual')),
  quantity integer not null default 1 check (quantity > 0),
  isotokens_spent integer not null default 0 check (isotokens_spent >= 0),
  donation_cents integer not null default 0 check (donation_cents >= 0),
  status text not null default 'active' check (status in ('pending', 'active', 'cancelled')),
  square_order_id text,
  square_payment_id text,
  square_payment_link_id text,
  square_checkout_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'isopedia_raffles_winner_entry_fk'
  ) then
    alter table public.isopedia_raffles
      add constraint isopedia_raffles_winner_entry_fk
      foreign key (winner_entry_id) references public.isopedia_raffle_entries(id) on delete set null;
  end if;
end $$;

create index if not exists isopedia_raffle_entries_raffle_idx
  on public.isopedia_raffle_entries(raffle_id, status, created_at);

create index if not exists isopedia_raffle_entries_profile_idx
  on public.isopedia_raffle_entries(profile_id, status, created_at);

alter table public.isopedia_raffles enable row level security;
alter table public.isopedia_raffle_entries enable row level security;

drop policy if exists "Public reads visible Isopedia raffles" on public.isopedia_raffles;
create policy "Public reads visible Isopedia raffles"
  on public.isopedia_raffles for select
  using (status in ('active', 'closed', 'completed'));

drop policy if exists "Admins manage Isopedia raffles" on public.isopedia_raffles;
create policy "Admins manage Isopedia raffles"
  on public.isopedia_raffles for all
  using (public.is_current_user_isopedia_admin())
  with check (public.is_current_user_isopedia_admin());

drop policy if exists "Public reads active Isopedia raffle entries" on public.isopedia_raffle_entries;
create policy "Public reads active Isopedia raffle entries"
  on public.isopedia_raffle_entries for select
  using (status = 'active');

drop policy if exists "Users insert own Isopedia raffle entries" on public.isopedia_raffle_entries;
create policy "Users insert own Isopedia raffle entries"
  on public.isopedia_raffle_entries for insert
  with check (auth.uid() = profile_id);

drop policy if exists "Users read own Isopedia raffle entries" on public.isopedia_raffle_entries;
create policy "Users read own Isopedia raffle entries"
  on public.isopedia_raffle_entries for select
  using (auth.uid() = profile_id or status = 'active');

drop policy if exists "Admins manage Isopedia raffle entries" on public.isopedia_raffle_entries;
create policy "Admins manage Isopedia raffle entries"
  on public.isopedia_raffle_entries for all
  using (public.is_current_user_isopedia_admin())
  with check (public.is_current_user_isopedia_admin());
