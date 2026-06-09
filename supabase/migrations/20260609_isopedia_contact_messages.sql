create extension if not exists pgcrypto;

create table if not exists public.isopedia_contact_messages (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references public.profiles(id) on delete set null,
  name text not null,
  email text not null,
  category text not null default 'issue'
    check (category in ('issue', 'suggestion', 'question', 'other')),
  subject text,
  message text not null,
  status text not null default 'open'
    check (status in ('open', 'reviewed', 'archived')),
  admin_notes text,
  admin_response text,
  responded_by uuid references public.profiles(id) on delete set null,
  responded_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists isopedia_contact_messages_status_created_idx
  on public.isopedia_contact_messages(status, created_at desc);

create index if not exists isopedia_contact_messages_submitted_by_idx
  on public.isopedia_contact_messages(submitted_by, created_at desc);

alter table public.isopedia_contact_messages enable row level security;

drop policy if exists "Anyone can submit Isopedia contact messages" on public.isopedia_contact_messages;
create policy "Anyone can submit Isopedia contact messages"
  on public.isopedia_contact_messages
  for insert
  with check (submitted_by is null or auth.uid() = submitted_by);

drop policy if exists "Isopedia admins can read contact messages" on public.isopedia_contact_messages;
create policy "Isopedia admins can read contact messages"
  on public.isopedia_contact_messages
  for select
  using (public.is_current_user_isopedia_admin());

drop policy if exists "Users can read own Isopedia contact messages" on public.isopedia_contact_messages;
create policy "Users can read own Isopedia contact messages"
  on public.isopedia_contact_messages
  for select
  using (auth.uid() = submitted_by);

drop policy if exists "Isopedia admins can update contact messages" on public.isopedia_contact_messages;
create policy "Isopedia admins can update contact messages"
  on public.isopedia_contact_messages
  for update
  using (public.is_current_user_isopedia_admin())
  with check (public.is_current_user_isopedia_admin());
