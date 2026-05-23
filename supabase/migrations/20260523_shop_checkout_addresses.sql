alter table public.shop_orders
  add column if not exists shipping_address jsonb,
  add column if not exists marketing_opt_in boolean not null default false;

alter table public.shop_email_subscribers
  add column if not exists name text,
  add column if not exists phone text,
  add column if not exists shipping_address jsonb;

create index if not exists shop_orders_shipping_state_idx
  on public.shop_orders ((shipping_address->>'state'));

create index if not exists shop_email_subscribers_marketing_idx
  on public.shop_email_subscribers (marketing_opt_in, updated_at desc);
