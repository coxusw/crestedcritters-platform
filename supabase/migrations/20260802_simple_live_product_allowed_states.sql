create table if not exists public.live_product_allowed_states (
  id uuid primary key default gen_random_uuid(),
  product_id bigint not null references public.shop_products(id) on delete cascade,
  state_code text not null,
  allowed boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(product_id, state_code)
);

create index if not exists live_product_allowed_states_lookup_idx
  on public.live_product_allowed_states(product_id, state_code, allowed);

alter table public.live_product_allowed_states enable row level security;

drop policy if exists "Admins manage live product allowed states" on public.live_product_allowed_states;
create policy "Admins manage live product allowed states"
  on public.live_product_allowed_states
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
