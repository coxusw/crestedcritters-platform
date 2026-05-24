alter table public.shop_email_subscribers
  add column if not exists unsubscribed_at timestamptz,
  add column if not exists unsubscribe_reason text;

create index if not exists shop_email_subscribers_unsubscribed_idx
  on public.shop_email_subscribers (unsubscribed_at desc)
  where unsubscribed_at is not null;
