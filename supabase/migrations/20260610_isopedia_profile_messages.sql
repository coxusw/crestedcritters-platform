create extension if not exists pgcrypto;

alter table public.isopedia_contact_messages
  add column if not exists user_read_at timestamptz;

create index if not exists isopedia_contact_messages_unread_user_idx
  on public.isopedia_contact_messages(submitted_by, user_read_at)
  where admin_response is not null;

drop policy if exists "Users can mark own Isopedia contact messages read" on public.isopedia_contact_messages;

create table if not exists public.isopedia_profile_messages (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  sent_by uuid references public.profiles(id) on delete set null,
  audience text not null default 'individual'
    check (audience in ('individual', 'all')),
  subject text,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists isopedia_profile_messages_recipient_created_idx
  on public.isopedia_profile_messages(recipient_id, created_at desc);

create index if not exists isopedia_profile_messages_unread_idx
  on public.isopedia_profile_messages(recipient_id, read_at)
  where read_at is null;

alter table public.isopedia_profile_messages enable row level security;

drop policy if exists "Users can read own Isopedia profile messages" on public.isopedia_profile_messages;
create policy "Users can read own Isopedia profile messages"
  on public.isopedia_profile_messages
  for select
  using (auth.uid() = recipient_id);

drop policy if exists "Users can mark own Isopedia profile messages read" on public.isopedia_profile_messages;

drop policy if exists "Isopedia admins can manage profile messages" on public.isopedia_profile_messages;
create policy "Isopedia admins can manage profile messages"
  on public.isopedia_profile_messages
  for all
  using (public.is_current_user_isopedia_admin())
  with check (public.is_current_user_isopedia_admin());

create or replace function public.mark_own_isopedia_messages_read()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid := auth.uid();
  read_time timestamptz := now();
begin
  if current_profile_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.isopedia_contact_messages
  set user_read_at = read_time,
      updated_at = read_time
  where submitted_by = current_profile_id
    and admin_response is not null
    and user_read_at is null;

  update public.isopedia_profile_messages
  set read_at = read_time,
      updated_at = read_time
  where recipient_id = current_profile_id
    and read_at is null;
end;
$$;

grant execute on function public.mark_own_isopedia_messages_read() to authenticated;
