alter table public.profiles
  add column if not exists profile_banner_url text;

create index if not exists profiles_profile_banner_url_idx
  on public.profiles(profile_banner_url)
  where profile_banner_url is not null;
