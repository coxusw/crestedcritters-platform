alter table public.shop_products
  add column if not exists option_name text,
  add column if not exists options jsonb not null default '[]'::jsonb;

update public.shop_products
set
  option_name = 'Size',
  options = '[
    {"id":"small","label":"Small","price_cents":null,"inventory":null,"active":true},
    {"id":"medium","label":"Medium","price_cents":null,"inventory":null,"active":true},
    {"id":"large","label":"Large","price_cents":null,"inventory":null,"active":true},
    {"id":"xl","label":"XL","price_cents":null,"inventory":null,"active":true},
    {"id":"2xl","label":"2XL","price_cents":null,"inventory":null,"active":true},
    {"id":"3xl","label":"3XL","price_cents":null,"inventory":null,"active":true}
  ]'::jsonb,
  updated_at = now()
where slug in (
  'duck-around',
  'id-rather-be-chillin-with-my-isopods',
  'moooove-im-on-a-roll-dairy-cow-shirt',
  'panda-king-isopod-shirt',
  'yes-i-really-need-all-these-isopods-shirt'
);

update public.shop_products
set
  option_name = 'Size',
  options = '[
    {"id":"6-inch","label":"6 inch","price_cents":4000,"inventory":null,"active":true}
  ]'::jsonb,
  updated_at = now()
where slug = 'rubber-ducky-crochet-isopod';
