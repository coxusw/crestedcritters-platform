insert into public.community_categories (
  name,
  slug,
  description,
  icon,
  color,
  display_order,
  is_active,
  requires_approval,
  marketplace_rules,
  species_tagging_enabled,
  images_enabled,
  staff_only_posting,
  posting_guidelines
)
values (
  'Archive',
  'archive',
  'Older recurring community prompts and retired discussion threads kept for reference.',
  'Archive',
  'slate',
  110,
  true,
  false,
  false,
  true,
  true,
  true,
  'Archived discussions are read-only reference material. Only staff and automated community tools can place discussions here.'
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  color = excluded.color,
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  requires_approval = excluded.requires_approval,
  marketplace_rules = excluded.marketplace_rules,
  species_tagging_enabled = excluded.species_tagging_enabled,
  images_enabled = excluded.images_enabled,
  staff_only_posting = excluded.staff_only_posting,
  posting_guidelines = excluded.posting_guidelines,
  updated_at = now();

with latest_showoff as (
  select id
  from public.community_discussions
  where author_id is null
    and content_type = 'prompt'
    and deleted_at is null
    and slug like 'show-off-saturday-%'
  order by created_at desc
  limit 1
)
update public.community_discussions d
set
  status = 'removed',
  moderation_status = 'actioned',
  deleted_at = coalesce(d.deleted_at, now()),
  pinned = false,
  pinned_until = null,
  updated_at = now()
where d.author_id is null
  and d.content_type = 'prompt'
  and d.deleted_at is null
  and d.status in ('published', 'expired')
  and (
    d.slug like 'bin-check-friday-%'
    or d.slug like 'show-off-saturday-%'
    or d.slug like 'tank-tuesday-%'
  )
  and not (
    d.slug like 'show-off-saturday-%'
    and d.id = (select id from latest_showoff)
  )
  and not exists (
    select 1
    from public.community_replies r
    where r.discussion_id = d.id
      and r.deleted_at is null
      and r.status = 'published'
  );

with latest_showoff as (
  select id
  from public.community_discussions
  where author_id is null
    and content_type = 'prompt'
    and deleted_at is null
    and slug like 'show-off-saturday-%'
  order by created_at desc
  limit 1
),
archive_category as (
  select id
  from public.community_categories
  where slug = 'archive'
  limit 1
)
update public.community_discussions d
set
  category_id = archive_category.id,
  status = 'archived',
  pinned = false,
  pinned_until = null,
  locked = true,
  updated_at = now()
from archive_category
where d.author_id is null
  and d.content_type = 'prompt'
  and d.deleted_at is null
  and d.status in ('published', 'expired')
  and (
    d.slug like 'bin-check-friday-%'
    or d.slug like 'show-off-saturday-%'
    or d.slug like 'tank-tuesday-%'
  )
  and not (
    d.slug like 'show-off-saturday-%'
    and d.id = (select id from latest_showoff)
  )
  and exists (
    select 1
    from public.community_replies r
    where r.discussion_id = d.id
      and r.deleted_at is null
      and r.status = 'published'
  );

with latest_showoff as (
  select id
  from public.community_discussions
  where author_id is null
    and content_type = 'prompt'
    and deleted_at is null
    and slug like 'show-off-saturday-%'
  order by created_at desc
  limit 1
),
showoff_category as (
  select id
  from public.community_categories
  where slug = 'show-off-your-collection'
  limit 1
)
update public.community_discussions d
set
  category_id = showoff_category.id,
  updated_at = now()
from showoff_category
where d.id = (select id from latest_showoff)
  and d.status in ('published', 'expired');

drop policy if exists "Public can read published community discussions"
  on public.community_discussions;

create policy "Public can read published community discussions"
  on public.community_discussions
  for select
  to anon, authenticated
  using (
    status in ('published', 'expired', 'archived')
    or public.is_current_user_isopedia_admin()
    or author_id = (select auth.uid())
  );
