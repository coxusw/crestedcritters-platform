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
    and p.archived_at is null
    and m.sender_id is distinct from auth.uid()
    and m.created_at > greatest(
      coalesce(p.last_read_at, 'epoch'::timestamptz),
      coalesce((
        select max(own_messages.created_at)
        from public.isopedia_message_thread_messages own_messages
        where own_messages.thread_id = p.thread_id
          and own_messages.sender_id = auth.uid()
      ), 'epoch'::timestamptz)
    );
$$;

grant execute on function public.own_isopedia_unread_message_count() to authenticated;
