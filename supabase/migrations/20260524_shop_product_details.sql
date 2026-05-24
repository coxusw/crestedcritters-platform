alter table public.shop_products
  add column if not exists card_description text,
  add column if not exists full_description text,
  add column if not exists source_note text;

update public.shop_products
set card_description = description
where card_description is null
  and description is not null;
