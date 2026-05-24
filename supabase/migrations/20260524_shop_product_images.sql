alter table public.shop_products
  add column if not exists image_urls text[];

update public.shop_products
set image_urls = array[image_url]
where image_urls is null
  and image_url is not null
  and image_url <> '';
