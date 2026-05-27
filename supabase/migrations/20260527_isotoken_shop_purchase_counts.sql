-- Public-safe aggregate counts for limited IsoToken Shop items.
-- Exposes only item_id + completed purchase count, not purchaser details.

create or replace function public.get_isotoken_shop_purchase_counts()
returns table (
  item_id uuid,
  purchase_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    p.item_id,
    count(*)::bigint as purchase_count
  from public.isotoken_purchases p
  where p.status = 'completed'
  group by p.item_id;
$$;

grant execute on function public.get_isotoken_shop_purchase_counts() to anon, authenticated;
