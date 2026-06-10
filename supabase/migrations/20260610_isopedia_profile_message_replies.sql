alter table public.isopedia_profile_messages
  add column if not exists user_reply text,
  add column if not exists user_replied_at timestamptz;

create index if not exists isopedia_profile_messages_user_replied_idx
  on public.isopedia_profile_messages(user_replied_at desc)
  where user_reply is not null;

create or replace function public.reply_to_own_isopedia_profile_message(
  message_id uuid,
  reply_body text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid := auth.uid();
  cleaned_reply text := nullif(trim(reply_body), '');
  reply_time timestamptz := now();
begin
  if current_profile_id is null then
    raise exception 'Not authenticated';
  end if;

  if cleaned_reply is null then
    raise exception 'Reply is required';
  end if;

  update public.isopedia_profile_messages
  set user_reply = left(cleaned_reply, 4000),
      user_replied_at = reply_time,
      read_at = coalesce(read_at, reply_time),
      updated_at = reply_time
  where id = message_id
    and recipient_id = current_profile_id;

  if not found then
    raise exception 'Message not found';
  end if;
end;
$$;

grant execute on function public.reply_to_own_isopedia_profile_message(uuid, text)
  to authenticated;
