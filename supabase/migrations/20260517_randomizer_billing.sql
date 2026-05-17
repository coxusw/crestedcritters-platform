create table if not exists public.randomizer_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  credits integer not null default 0 check (credits >= 0),
  access_expires_at timestamptz,
  lifetime_access boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.randomizer_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  package_key text not null,
  package_name text not null,
  amount_cents integer not null,
  currency text not null default 'USD',
  credits integer not null default 0,
  access_days integer,
  lifetime_access boolean not null default false,
  status text not null default 'pending',
  square_order_id text unique,
  square_payment_link_id text,
  square_payment_id text unique,
  square_checkout_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists randomizer_orders_user_idx
  on public.randomizer_orders(user_id, created_at desc);

create index if not exists randomizer_orders_square_order_idx
  on public.randomizer_orders(square_order_id);

alter table public.randomizer_accounts enable row level security;
alter table public.randomizer_orders enable row level security;

drop policy if exists "Users can read their randomizer account" on public.randomizer_accounts;
create policy "Users can read their randomizer account"
  on public.randomizer_accounts
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can read their randomizer orders" on public.randomizer_orders;
create policy "Users can read their randomizer orders"
  on public.randomizer_orders
  for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.consume_randomizer_credit_if_needed()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.randomizer_accounts;
  requester uuid := auth.uid();
begin
  if requester is null then
    return jsonb_build_object('allowed', false, 'reason', 'not_authenticated');
  end if;

  insert into public.randomizer_accounts (user_id)
  values (requester)
  on conflict (user_id) do nothing;

  select *
    into account_row
    from public.randomizer_accounts
    where user_id = requester
    for update;

  if account_row.lifetime_access
     or (account_row.access_expires_at is not null and account_row.access_expires_at > now()) then
    return jsonb_build_object(
      'allowed', true,
      'used_credit', false,
      'credits', account_row.credits,
      'access_expires_at', account_row.access_expires_at,
      'lifetime_access', account_row.lifetime_access
    );
  end if;

  if account_row.credits > 0 then
    update public.randomizer_accounts
      set credits = credits - 1,
          updated_at = now()
      where user_id = requester
      returning * into account_row;

    return jsonb_build_object(
      'allowed', true,
      'used_credit', true,
      'credits', account_row.credits,
      'access_expires_at', account_row.access_expires_at,
      'lifetime_access', account_row.lifetime_access
    );
  end if;

  return jsonb_build_object(
    'allowed', false,
    'reason', 'payment_required',
    'credits', account_row.credits,
    'access_expires_at', account_row.access_expires_at,
    'lifetime_access', account_row.lifetime_access
  );
end;
$$;

grant execute on function public.consume_randomizer_credit_if_needed() to authenticated;
