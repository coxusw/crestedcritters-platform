-- Adds rollout modes for Feature Controls:
-- disabled, enabled for everyone, or unlocked through IsoToken Shop purchase.

alter table public.isopedia_feature_flags
  add column if not exists availability_mode text;

update public.isopedia_feature_flags
set availability_mode = case
  when enabled then 'enabled_all'
  else 'disabled'
end
where availability_mode is null;

alter table public.isopedia_feature_flags
  alter column availability_mode set default 'disabled',
  alter column availability_mode set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'isopedia_feature_flags_availability_mode_check'
  ) then
    alter table public.isopedia_feature_flags
      add constraint isopedia_feature_flags_availability_mode_check
      check (availability_mode in ('disabled', 'enabled_all', 'isotoken_shop'));
  end if;
end $$;

update public.isopedia_feature_flags
set
  enabled = availability_mode <> 'disabled',
  updated_at = now();
