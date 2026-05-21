create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null default 'Isopods',
  description text,
  image_url text,
  price_cents integer not null default 0 check (price_cents >= 0),
  inventory integer not null default 0 check (inventory >= 0),
  sold_out boolean not null default false,
  featured boolean not null default false,
  shipping_mode text not null default 'shipping' check (shipping_mode in ('shipping', 'pickup', 'contact')),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  active boolean not null default true,
  square_catalog_object_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  customer_email text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  currency text not null default 'USD',
  square_order_id text unique,
  square_payment_link_id text,
  square_payment_id text unique,
  square_checkout_url text,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists shop_products_active_category_idx
  on public.shop_products(active, category, name);

create index if not exists shop_products_featured_idx
  on public.shop_products(active, featured, name);

create index if not exists shop_orders_square_order_idx
  on public.shop_orders(square_order_id);

alter table public.shop_products enable row level security;
alter table public.shop_orders enable row level security;

drop policy if exists "Public can read active shop products" on public.shop_products;
create policy "Public can read active shop products"
  on public.shop_products
  for select
  to anon, authenticated
  using (active = true);

insert into public.shop_products
  (slug, name, category, description, image_url, price_cents, inventory, sold_out, featured, shipping_mode)
values
  ('3d-printed-articulated-isopods', '3D Printed articulated isopods', '3D Printed Accessories', '3D printed articulating isopods. Each order comes with five printed isopods.', 'https://crestedcritters.com/assets/images/3d-printed-isopods.png', 500, 100, false, false, 'shipping'),
  ('crested-critters-isopod-soil', 'Crested Critters IsoPod Soil', 'Botanicals', 'Premium 2.5 lb bioactive isopod substrate for colonies, breeding, and growth.', 'https://crestedcritters.com/assets/images/isopod-substrate.jpeg', 1500, 10, false, false, 'shipping'),
  ('3d-printed-vents-2ct', '3D printed Vents 2ct', '3D Printed Accessories', 'Two durable 38mm printed vents with 200 mesh stainless steel screen installed.', 'https://crestedcritters.com/assets/images/3d-printed-vent.png', 500, 100, false, false, 'shipping'),
  ('dairy-cows', 'Dairy Cows', 'Isopods', 'Dairy Cow isopods, 10 count. Live purchases require shipping coordination.', 'https://crestedcritters.com/assets/images/dairy-cow-isopods.jpg', 1500, 0, true, false, 'contact'),
  ('duck-around', 'Duck Around', 'Merch', 'Unisex Gildan soft-style tee provided by TheChalkinWildChild. Made to order.', 'https://crestedcritters.com/assets/images/duck-around-and-find-out-shirt.png', 3000, 100, false, false, 'shipping'),
  ('id-rather-be-chillin-with-my-isopods', 'id Rather Be Chillin With My Isopods', 'Merch', 'Unisex Gildan soft-style tee provided by TheChalkinWildChild. Made to order.', 'https://crestedcritters.com/assets/images/id-rather-be-chillin-with-my-isopods-.png', 3000, 100, false, false, 'shipping'),
  ('powder-orange', 'Powder Orange', 'Isopods', 'Bright, hardy cleanup crew isopods. Live purchases require shipping coordination.', 'https://crestedcritters.com/assets/images/powder-orange.jpeg', 2000, 12, true, true, 'contact'),
  ('gestroi', 'Gestroi', 'Isopods', 'Gestroi isopods, 10 count. Live purchases require shipping coordination.', 'https://crestedcritters.com/assets/images/gestroi-isopod.png', 3500, 0, true, false, 'contact'),
  ('yellow-zebra', 'Yellow Zebra', 'Isopods', 'High Yellow Zebra isopods, 10 count. Live purchases require shipping coordination.', 'https://crestedcritters.com/assets/images/yellow-zebra-isopod.png', 4500, 0, true, false, 'contact'),
  ('isopod-feeding-dish', 'Isopod Feeding Dish', '3D Printed Accessories', 'Five Crested Critters feeding dishes for keeping isopod food clean.', 'https://crestedcritters.com/assets/images/feeding-dish.jpeg', 500, 100, false, false, 'shipping'),
  ('maple-leaf', 'Maple Leaf', 'Botanicals', 'Vacuum sealed bag of clean sanitized maple leaf.', 'https://crestedcritters.com/assets/images/maple-leaf.png', 1000, 5, false, true, 'shipping'),
  ('moooove-im-on-a-roll-dairy-cow-shirt', 'MOOOOVE I''M ON A ROLL Dairy Cow Shirt', 'Merch', 'Unisex Gildan soft-style tee provided by TheChalkinWildChild. Made to order.', 'https://crestedcritters.com/assets/images/moooove-i-m-on-a-roll-diary-cow-shirt.png', 3000, 100, false, false, 'shipping'),
  ('orange-cream', 'Orange Cream', 'Isopods', 'Orange Cream isopods, 10 count. Live purchases require shipping coordination.', 'https://crestedcritters.com/assets/images/orange-cream-isopod.png', 2500, 0, false, false, 'contact'),
  ('oreo-crumble', 'Oreo Crumble', 'Isopods', 'Oreo Crumble isopods, 10 count. Live purchases require shipping coordination.', 'https://crestedcritters.com/assets/images/oreo-crumble-2.jpeg', 2500, 0, true, false, 'contact'),
  ('panda-king-isopod-shirt', 'Panda King IsoPod Shirt', 'Merch', 'Unisex Gildan soft-style tee provided by TheChalkinWildChild. Made to order.', 'https://crestedcritters.com/assets/images/panda-king-isopod-shirt.png', 3000, 100, false, false, 'shipping'),
  ('pineapple-spikey', 'Pineapple Spikey', 'Isopods', 'Pineapple Spikey isopods, 10 count. Live purchases require shipping coordination.', 'https://crestedcritters.com/assets/images/pineapple-spiky-isopod.png', 7500, 0, true, false, 'contact'),
  ('high-white-zebra', 'High White Zebra', 'Isopods', 'High White Zebra isopods, 10 count. Live purchases require shipping coordination.', 'https://crestedcritters.com/assets/images/high-white-zebra-isopod.png', 4500, 0, true, false, 'contact'),
  ('red-panda', 'Red Panda', 'Isopods', 'Red Panda isopods, 10 count. Live purchases require shipping coordination.', 'https://crestedcritters.com/assets/images/red-panda-2.jpeg', 4000, 0, true, false, 'contact'),
  ('rubber-ducky-crochet-isopod', 'Rubber Ducky Crochet Isopod', 'Merch', 'Handmade crochet isopod provided by TheChalkinWildChild. Made to order.', 'https://crestedcritters.com/assets/images/rubber-ducky-crotchet-isopod.png', 4000, 100, false, false, 'shipping'),
  ('rubber-ducky', 'Rubber Ducky', 'Isopods', 'Rubber Ducky isopods. Live purchases require shipping coordination.', 'https://crestedcritters.com/assets/images/rubber-ducky.jpeg', 4000, 0, true, false, 'contact'),
  ('temporate-springtails', 'Temporate Springtails', 'Springtail', '8 oz container of horticulture charcoal with springtails.', 'https://crestedcritters.com/assets/images/springtail-culture.png', 1500, 0, true, false, 'contact'),
  ('yes-i-really-need-all-these-isopods-shirt', 'Yes I Really Need All These Isopods Shirt', 'Merch', 'Unisex Gildan soft-style tee provided by TheChalkinWildChild. Made to order.', 'https://crestedcritters.com/assets/images/yes-i-really-need-all-these-isopods-shirt.png', 3000, 100, false, false, 'shipping')
on conflict (slug) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  image_url = excluded.image_url,
  price_cents = excluded.price_cents,
  inventory = excluded.inventory,
  sold_out = excluded.sold_out,
  featured = excluded.featured,
  shipping_mode = excluded.shipping_mode,
  updated_at = now();
