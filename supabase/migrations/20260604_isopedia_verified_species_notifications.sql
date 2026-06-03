alter table public.isopedia_notification_preferences
  add column if not exists notify_verified_species boolean not null default true;
