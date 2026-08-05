create table if not exists public.community_reply_likes (
  reply_id uuid not null references public.community_replies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reply_id, profile_id)
);

create index if not exists community_reply_likes_profile_idx
  on public.community_reply_likes(profile_id, created_at desc);

alter table public.community_reply_likes enable row level security;

drop policy if exists "Public can read community reply likes" on public.community_reply_likes;
create policy "Public can read community reply likes"
  on public.community_reply_likes
  for select
  using (true);

drop policy if exists "Users can like community replies" on public.community_reply_likes;
create policy "Users can like community replies"
  on public.community_reply_likes
  for insert
  with check (
    auth.uid() = profile_id
    and exists (
      select 1
      from public.community_replies reply
      join public.community_discussions discussion
        on discussion.id = reply.discussion_id
      where reply.id = reply_id
        and reply.status = 'published'
        and discussion.status = 'published'
        and reply.author_id is distinct from auth.uid()
    )
  );

drop policy if exists "Users can unlike own community reply likes" on public.community_reply_likes;
create policy "Users can unlike own community reply likes"
  on public.community_reply_likes
  for delete
  using (auth.uid() = profile_id);

create or replace function public.community_recount_reply_likes(target_reply_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.community_replies reply
  set helpful_count = (
    select count(*)::integer
    from public.community_reply_likes reply_like
    where reply_like.reply_id = target_reply_id
  )
  where reply.id = target_reply_id;
end;
$$;

create or replace function public.community_reply_likes_sync_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_reply_id uuid;
begin
  target_reply_id := case
    when tg_op = 'DELETE' then old.reply_id
    else new.reply_id
  end;

  perform public.community_recount_reply_likes(target_reply_id);

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists community_reply_likes_sync_count_insert on public.community_reply_likes;
create trigger community_reply_likes_sync_count_insert
  after insert on public.community_reply_likes
  for each row
  execute function public.community_reply_likes_sync_count();

drop trigger if exists community_reply_likes_sync_count_delete on public.community_reply_likes;
create trigger community_reply_likes_sync_count_delete
  after delete on public.community_reply_likes
  for each row
  execute function public.community_reply_likes_sync_count();

create or replace function public.award_isotokens_community_discussion_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  award_reason text;
  award_description text;
begin
  if new.author_id is null then
    return new;
  end if;

  if new.content_type = 'guide' then
    award_reason := 'guide_submission';
    award_description := 'Published a community guide.';
  else
    award_reason := 'community_discussion_created';
    award_description := 'Created a community discussion.';
  end if;

  perform public.award_isotokens(
    new.author_id,
    5,
    award_reason,
    award_reason || ':' || new.id::text,
    award_description,
    'community_discussion',
    new.id::text
  );

  return new;
end;
$$;

drop trigger if exists isotokens_community_discussion_insert on public.community_discussions;
create trigger isotokens_community_discussion_insert
  after insert on public.community_discussions
  for each row
  execute function public.award_isotokens_community_discussion_insert();

create or replace function public.award_isotokens_community_reply_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.author_id is null then
    return new;
  end if;

  perform public.award_isotokens(
    new.author_id,
    2,
    'community_reply_created',
    'community_reply_created:' || new.id::text,
    'Created a community reply.',
    'community_reply',
    new.id::text
  );

  return new;
end;
$$;

drop trigger if exists isotokens_community_reply_insert on public.community_replies;
create trigger isotokens_community_reply_insert
  after insert on public.community_replies
  for each row
  execute function public.award_isotokens_community_reply_insert();

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
  discussion.author_id,
  5,
  case
    when discussion.content_type = 'guide' then 'guide_submission'
    else 'community_discussion_created'
  end,
  case
    when discussion.content_type = 'guide' then 'guide_submission:'
    else 'community_discussion_created:'
  end || discussion.id::text,
  case
    when discussion.content_type = 'guide' then 'Published a community guide.'
    else 'Created a community discussion.'
  end,
  'community_discussion',
  discussion.id::text
from public.community_discussions discussion
where discussion.author_id is not null
  and discussion.deleted_at is null
  and discussion.status not in ('draft', 'removed', 'rejected')
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
  reply.author_id,
  2,
  'community_reply_created',
  'community_reply_created:' || reply.id::text,
  'Created a community reply.',
  'community_reply',
  reply.id::text
from public.community_replies reply
where reply.author_id is not null
  and reply.deleted_at is null
  and reply.status = 'published'
on conflict (reason_key) do nothing;

update public.community_replies reply
set helpful_count = coalesce(reply_counts.like_count, 0)
from (
  select
    reply.id,
    count(reply_like.reply_id)::integer as like_count
  from public.community_replies reply
  left join public.community_reply_likes reply_like
    on reply_like.reply_id = reply.id
  group by reply.id
) reply_counts
where reply_counts.id = reply.id;
