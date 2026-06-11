alter table public.isopedia_notification_preferences
  add column if not exists notify_messages boolean not null default true;

alter table public.isopedia_profile_messages
  add column if not exists user_reply text,
  add column if not exists user_replied_at timestamptz;

create table if not exists public.isopedia_message_threads (
  id uuid primary key default gen_random_uuid(),
  subject text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table if not exists public.isopedia_message_thread_participants (
  thread_id uuid not null references public.isopedia_message_threads(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (thread_id, profile_id)
);

create table if not exists public.isopedia_message_thread_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.isopedia_message_threads(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  body text not null,
  source_profile_message_id uuid references public.isopedia_profile_messages(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.isopedia_profile_messages
  add column if not exists thread_id uuid references public.isopedia_message_threads(id) on delete set null;

create unique index if not exists isopedia_message_thread_messages_source_idx
  on public.isopedia_message_thread_messages(source_profile_message_id)
  where source_profile_message_id is not null;

create index if not exists isopedia_message_thread_participants_profile_idx
  on public.isopedia_message_thread_participants(profile_id, archived_at);

create index if not exists isopedia_message_thread_messages_thread_idx
  on public.isopedia_message_thread_messages(thread_id, created_at);

alter table public.isopedia_message_threads enable row level security;
alter table public.isopedia_message_thread_participants enable row level security;
alter table public.isopedia_message_thread_messages enable row level security;

create or replace function public.is_current_user_isopedia_thread_participant(target_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.isopedia_message_thread_participants p
    where p.thread_id = target_thread_id
      and p.profile_id = auth.uid()
  );
$$;

drop policy if exists "Participants can read own Isopedia message threads" on public.isopedia_message_threads;
create policy "Participants can read own Isopedia message threads"
  on public.isopedia_message_threads
  for select
  using (
    public.is_current_user_isopedia_admin()
    or public.is_current_user_isopedia_thread_participant(id)
  );

drop policy if exists "Admins can manage Isopedia message threads" on public.isopedia_message_threads;
create policy "Admins can manage Isopedia message threads"
  on public.isopedia_message_threads
  for all
  using (public.is_current_user_isopedia_admin())
  with check (public.is_current_user_isopedia_admin());

drop policy if exists "Participants can read own Isopedia message participants" on public.isopedia_message_thread_participants;
create policy "Participants can read own Isopedia message participants"
  on public.isopedia_message_thread_participants
  for select
  using (
    public.is_current_user_isopedia_admin()
    or public.is_current_user_isopedia_thread_participant(thread_id)
  );

drop policy if exists "Admins can manage Isopedia message participants" on public.isopedia_message_thread_participants;
create policy "Admins can manage Isopedia message participants"
  on public.isopedia_message_thread_participants
  for all
  using (public.is_current_user_isopedia_admin())
  with check (public.is_current_user_isopedia_admin());

drop policy if exists "Participants can read own Isopedia thread messages" on public.isopedia_message_thread_messages;
create policy "Participants can read own Isopedia thread messages"
  on public.isopedia_message_thread_messages
  for select
  using (
    public.is_current_user_isopedia_admin()
    or public.is_current_user_isopedia_thread_participant(thread_id)
  );

drop policy if exists "Admins can manage Isopedia thread messages" on public.isopedia_message_thread_messages;
create policy "Admins can manage Isopedia thread messages"
  on public.isopedia_message_thread_messages
  for all
  using (public.is_current_user_isopedia_admin())
  with check (public.is_current_user_isopedia_admin());

do $$
declare
  message_record record;
  new_thread_id uuid;
begin
  for message_record in
    select *
    from public.isopedia_profile_messages
    where thread_id is null
  loop
    new_thread_id := gen_random_uuid();

    insert into public.isopedia_message_threads (
      id,
      subject,
      created_by,
      created_at,
      updated_at,
      last_message_at
    )
    values (
      new_thread_id,
      message_record.subject,
      message_record.sent_by,
      message_record.created_at,
      coalesce(message_record.updated_at, message_record.created_at),
      greatest(
        message_record.created_at,
        coalesce(message_record.user_replied_at, message_record.created_at)
      )
    );

    update public.isopedia_profile_messages
    set thread_id = new_thread_id
    where id = message_record.id;

    insert into public.isopedia_message_thread_participants (
      thread_id,
      profile_id,
      last_read_at,
      created_at
    )
    values (
      new_thread_id,
      message_record.recipient_id,
      message_record.read_at,
      message_record.created_at
    )
    on conflict do nothing;

    if message_record.sent_by is not null then
      insert into public.isopedia_message_thread_participants (
        thread_id,
        profile_id,
        last_read_at,
        created_at
      )
      values (
        new_thread_id,
        message_record.sent_by,
        message_record.created_at,
        message_record.created_at
      )
      on conflict do nothing;
    end if;

    insert into public.isopedia_message_thread_messages (
      thread_id,
      sender_id,
      body,
      source_profile_message_id,
      created_at
    )
    values (
      new_thread_id,
      message_record.sent_by,
      message_record.body,
      message_record.id,
      message_record.created_at
    )
    on conflict do nothing;

    if message_record.user_reply is not null then
      insert into public.isopedia_message_thread_messages (
        thread_id,
        sender_id,
        body,
        created_at
      )
      values (
        new_thread_id,
        message_record.recipient_id,
        message_record.user_reply,
        coalesce(message_record.user_replied_at, message_record.updated_at, now())
      );
    end if;
  end loop;
end;
$$;

create or replace function public.send_isopedia_thread_message(
  target_thread_id uuid,
  message_body text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid := auth.uid();
  cleaned_body text := nullif(trim(message_body), '');
  message_time timestamptz := now();
begin
  if current_profile_id is null then
    raise exception 'Not authenticated';
  end if;

  if cleaned_body is null then
    raise exception 'Message is required';
  end if;

  if not exists (
    select 1
    from public.isopedia_message_thread_participants p
    where p.thread_id = target_thread_id
      and p.profile_id = current_profile_id
  ) and not public.is_current_user_isopedia_admin() then
    raise exception 'Thread not found';
  end if;

  insert into public.isopedia_message_thread_messages (
    thread_id,
    sender_id,
    body,
    created_at
  )
  values (
    target_thread_id,
    current_profile_id,
    left(cleaned_body, 4000),
    message_time
  );

  insert into public.isopedia_message_thread_participants (
    thread_id,
    profile_id,
    last_read_at,
    created_at
  )
  values (
    target_thread_id,
    current_profile_id,
    message_time,
    message_time
  )
  on conflict (thread_id, profile_id)
  do update set last_read_at = excluded.last_read_at;

  update public.isopedia_message_threads
  set last_message_at = message_time,
      updated_at = message_time
  where id = target_thread_id;
end;
$$;

create or replace function public.mark_isopedia_thread_read(target_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid := auth.uid();
begin
  if current_profile_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.isopedia_message_thread_participants
  set last_read_at = now()
  where thread_id = target_thread_id
    and profile_id = current_profile_id;
end;
$$;

create or replace function public.own_isopedia_unread_message_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct m.thread_id)::integer
  from public.isopedia_message_thread_participants p
  join public.isopedia_message_thread_messages m
    on m.thread_id = p.thread_id
  where p.profile_id = auth.uid()
    and m.sender_id is distinct from auth.uid()
    and m.created_at > coalesce(p.last_read_at, 'epoch'::timestamptz);
$$;

grant execute on function public.send_isopedia_thread_message(uuid, text) to authenticated;
grant execute on function public.mark_isopedia_thread_read(uuid) to authenticated;
grant execute on function public.own_isopedia_unread_message_count() to authenticated;
grant execute on function public.is_current_user_isopedia_thread_participant(uuid) to authenticated;
