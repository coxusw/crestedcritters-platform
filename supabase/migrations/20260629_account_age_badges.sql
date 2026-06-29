-- Account-age badge automation.
-- Safe to rerun: adds optional metadata columns, seeds badge definitions, and
-- prevents duplicate badge assignments.

alter table public.profile_badges
  add column if not exists badge_key text,
  add column if not exists automation_type text,
  add column if not exists automation_months integer,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

drop index if exists public.profile_badges_badge_key_unique;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profile_badges_badge_key_key'
      and conrelid = 'public.profile_badges'::regclass
  ) then
    alter table public.profile_badges
      add constraint profile_badges_badge_key_key unique (badge_key);
  end if;
end $$;

with ranked_assignments as (
  select
    id,
    row_number() over (
      partition by profile_id, badge_id
      order by assigned_at asc nulls last, id asc
    ) as row_number
  from public.profile_badge_assignments
)
delete from public.profile_badge_assignments assignments
using ranked_assignments ranked
where assignments.id = ranked.id
  and ranked.row_number > 1;

create unique index if not exists profile_badge_assignments_profile_badge_unique
  on public.profile_badge_assignments(profile_id, badge_id);

insert into public.profile_badges (
  badge_key,
  label,
  description,
  color,
  icon,
  is_active,
  automation_type,
  automation_months,
  metadata,
  updated_at
)
values
  (
    'account_age_1_month',
    'Colony Hatchling',
    'Account has been part of Isopedia for at least 1 month.',
    'emerald',
    '1M',
    true,
    'account_age',
    1,
    '{"automatic": true, "milestone_months": 1}'::jsonb,
    now()
  ),
  (
    'account_age_3_months',
    'Settled Colony',
    'Account has been part of Isopedia for at least 3 months.',
    'sky',
    '3M',
    true,
    'account_age',
    3,
    '{"automatic": true, "milestone_months": 3}'::jsonb,
    now()
  ),
  (
    'account_age_6_months',
    'Established Keeper',
    'Account has been part of Isopedia for at least 6 months.',
    'violet',
    '6M',
    true,
    'account_age',
    6,
    '{"automatic": true, "milestone_months": 6}'::jsonb,
    now()
  ),
  (
    'account_age_1_year',
    'Yearling Member',
    'Account has been part of Isopedia for at least 1 year.',
    'amber',
    '1Y',
    true,
    'account_age',
    12,
    '{"automatic": true, "milestone_months": 12}'::jsonb,
    now()
  ),
  (
    'account_age_2_years',
    'Two Year Veteran',
    'Account has been part of Isopedia for at least 2 years.',
    'rose',
    '2Y',
    true,
    'account_age',
    24,
    '{"automatic": true, "milestone_months": 24}'::jsonb,
    now()
  ),
  (
    'account_age_3_years',
    'Three Year Veteran',
    'Account has been part of Isopedia for at least 3 years.',
    'green',
    '3Y',
    true,
    'account_age',
    36,
    '{"automatic": true, "milestone_months": 36}'::jsonb,
    now()
  ),
  (
    'account_age_4_years',
    'Four Year Veteran',
    'Account has been part of Isopedia for at least 4 years.',
    'cyan',
    '4Y',
    true,
    'account_age',
    48,
    '{"automatic": true, "milestone_months": 48}'::jsonb,
    now()
  ),
  (
    'account_age_5_plus_years',
    'Five Year Legacy',
    'Account has been part of Isopedia for at least 5 years.',
    'slate',
    '5Y+',
    true,
    'account_age',
    60,
    '{"automatic": true, "milestone_months": 60}'::jsonb,
    now()
  )
on conflict (badge_key) do update
set
  label = excluded.label,
  description = excluded.description,
  color = excluded.color,
  icon = excluded.icon,
  is_active = true,
  automation_type = excluded.automation_type,
  automation_months = excluded.automation_months,
  metadata = excluded.metadata,
  updated_at = now();
