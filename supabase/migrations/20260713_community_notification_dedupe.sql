with ranked_notifications as (
  select
    id,
    row_number() over (
      partition by recipient_id, type, discussion_id, reply_id
      order by created_at asc, id asc
    ) as row_number
  from public.notifications
  where discussion_id is not null
)
delete from public.notifications notification
using ranked_notifications ranked
where notification.id = ranked.id
  and ranked.row_number > 1;

create unique index if not exists notifications_unique_community_event_idx
on public.notifications (
  recipient_id,
  type,
  discussion_id,
  coalesce(reply_id, '00000000-0000-0000-0000-000000000000'::uuid)
)
where discussion_id is not null;
