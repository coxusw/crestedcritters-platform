create table if not exists public.shop_email_subscribers (
  email text primary key,
  marketing_opt_in boolean not null default false,
  source text not null default 'checkout_order',
  last_order_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shop_email_subscribers enable row level security;
