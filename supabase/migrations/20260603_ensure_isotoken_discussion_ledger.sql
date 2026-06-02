create extension if not exists pgcrypto;

create table if not exists public.isotoken_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  reason text not null,
  reason_key text not null unique,
  description text not null,
  entity_type text,
  entity_id text,
  created_at timestamptz not null default now()
);

create index if not exists isotoken_ledger_profile_created_idx
  on public.isotoken_ledger(profile_id, created_at desc);

create index if not exists isotoken_ledger_reason_idx
  on public.isotoken_ledger(reason);

alter table public.isotoken_ledger enable row level security;

drop policy if exists "Users can read own IsoToken ledger" on public.isotoken_ledger;
create policy "Users can read own IsoToken ledger"
  on public.isotoken_ledger
  for select
  using (
    auth.uid() = profile_id
    or public.is_current_user_isopedia_admin()
  );

drop policy if exists "Service role can manage IsoToken ledger" on public.isotoken_ledger;
create policy "Service role can manage IsoToken ledger"
  on public.isotoken_ledger
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

insert into public.isotoken_ledger (
  profile_id,
  amount,
  reason,
  reason_key,
  description,
  entity_type,
  entity_id
)
select
  discussion.user_id,
  1,
  'discussion_post',
  'discussion_post:' || discussion.id::text,
  'Posted in an Isopedia discussion.',
  'discussion',
  discussion.id::text
from public.isopedia_discussions discussion
where discussion.status = 'active'
on conflict (reason_key) do nothing;

insert into public.isotoken_ledger (
  profile_id,
  amount,
  reason,
  reason_key,
  description,
  entity_type,
  entity_id
)
select
  discussion.user_id,
  1,
  'discussion_like_received',
  'discussion_like_received:' || discussion_like.id::text,
  'Discussion post received a like.',
  'discussion',
  discussion_like.comment_id::text
from public.isopedia_discussion_likes discussion_like
join public.isopedia_discussions discussion
  on discussion.id = discussion_like.comment_id
where discussion.user_id <> discussion_like.user_id
on conflict (reason_key) do nothing;
