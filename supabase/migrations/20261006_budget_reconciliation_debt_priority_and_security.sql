-- Budget reconciliation, debt tracking, security hardening, and data cleanup.

alter table public.budget_paychecks
  add column if not exists reconciled_checking_balance numeric(12,2);

update public.budget_paychecks
set reconciled_checking_balance = checking_before_paycheck
where reconciled_checking_balance is null
  and checking_before_paycheck is not null;

alter table public.budget_expenses
  add column if not exists reconciliation_status text not null default 'Unpaid';

update public.budget_expenses
set reconciliation_status = case
  when status = 'Cancelled' then 'Canceled'
  when status = 'Deferred' then 'Moved'
  when coalesce(actual_amount,0) > 0 and coalesce(actual_amount,0) + 0.005 < coalesce(planned_amount,0) then 'Partial'
  when coalesce(actual_amount,0) > 0 then 'Paid'
  else 'Unpaid'
end;

alter table public.budget_actual_expenses
  add column if not exists debt_id uuid references public.budget_debts(id) on delete set null;

alter table public.budget_debts
  add column if not exists priority_rank integer,
  add column if not exists tracking_start_balance numeric(12,2),
  add column if not exists tracking_start_date date,
  add column if not exists balance_estimated boolean not null default false;

update public.budget_debts
set tracking_start_balance = coalesce(tracking_start_balance,current_balance),
    tracking_start_date = coalesce(tracking_start_date,date '2026-10-06');

with ranked as (
  select id,
         row_number() over (
           order by
             case name
               when 'Capital One' then 1
               when 'Soccer.com' then 2
               when 'Newegg Affirm' then 3
               when 'XBotGo Affirm' then 4
               when 'Van' then 5
               when 'Jeep' then 6
               when 'Credit One collection/resurgent' then 7
               when 'Discover Collection/WLTMN' then 8
               when 'First Financial collection/Williams & Fudge' then 9
               when 'One Main/ Spring Oaks' then 10
               when 'Mortgage' then 999
               else 500
             end,
             name
         ) as rn
  from public.budget_debts
  where active = true
)
update public.budget_debts d
set priority_rank = ranked.rn
from ranked
where d.id = ranked.id
  and d.priority_rank is null;

create index if not exists budget_actual_expenses_planned_expense_id_idx
  on public.budget_actual_expenses(planned_expense_id);
create index if not exists budget_actual_expenses_debt_id_idx
  on public.budget_actual_expenses(debt_id);
create index if not exists budget_future_expenses_closeout_destination_fund_id_idx
  on public.budget_future_expenses(closeout_destination_fund_id);
create index if not exists budget_recurring_bills_linked_debt_id_idx
  on public.budget_recurring_bills(linked_debt_id);
create index if not exists budget_debts_priority_rank_idx
  on public.budget_debts(priority_rank);

create table if not exists public.budget_debt_payments (
  id uuid primary key default gen_random_uuid(),
  actual_expense_id uuid not null unique references public.budget_actual_expenses(id) on delete cascade,
  debt_id uuid not null references public.budget_debts(id) on delete cascade,
  payment_date date not null,
  payment_amount numeric(12,2) not null check (payment_amount >= 0),
  estimated_interest numeric(12,2) not null default 0,
  principal_applied numeric(12,2) not null default 0,
  balance_before numeric(12,2) not null default 0,
  balance_after numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.budget_debt_payments enable row level security;
grant select, insert, update, delete on public.budget_debt_payments to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='budget_debt_payments'
      and policyname='active admins manage budget_debt_payments'
  ) then
    create policy "active admins manage budget_debt_payments"
      on public.budget_debt_payments
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.admin_profiles ap
          where ap.id = (select auth.uid())
            and ap.is_active
        )
      )
      with check (
        exists (
          select 1
          from public.admin_profiles ap
          where ap.id = (select auth.uid())
            and ap.is_active
        )
      );
  end if;
end $$;

create or replace function public.recalculate_budget_planned_expense(p_expense_id uuid)
returns void
language plpgsql
set search_path to 'public'
as $$
declare
  v_total numeric(12,2);
  v_plan numeric(12,2);
  v_status text;
begin
  if p_expense_id is null then
    return;
  end if;

  select coalesce(planned_amount,0), coalesce(status,'Planned')
    into v_plan, v_status
  from public.budget_expenses
  where id = p_expense_id;

  if not found then
    return;
  end if;

  select coalesce(sum(amount),0)::numeric(12,2)
    into v_total
  from public.budget_actual_expenses
  where planned_expense_id = p_expense_id;

  update public.budget_expenses
  set actual_amount = v_total,
      reconciliation_status = case
        when v_status = 'Cancelled' then 'Canceled'
        when v_status = 'Deferred' then 'Moved'
        when v_total <= 0 then 'Unpaid'
        when v_total + 0.005 < v_plan then 'Partial'
        else 'Paid'
      end,
      updated_at = now()
  where id = p_expense_id;
end;
$$;

create or replace function public.enrich_budget_actual_expense_links()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_future uuid;
  v_debt uuid;
begin
  if new.planned_expense_id is not null then
    select e.future_expense_id, rb.linked_debt_id
      into v_future, v_debt
    from public.budget_expenses e
    left join public.budget_recurring_bills rb
      on rb.id = e.generated_recurring_id
    where e.id = new.planned_expense_id;

    if new.future_expense_id is null then
      new.future_expense_id := v_future;
    end if;
    if new.debt_id is null then
      new.debt_id := v_debt;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists budget_actual_expenses_enrich_links on public.budget_actual_expenses;
create trigger budget_actual_expenses_enrich_links
before insert or update on public.budget_actual_expenses
for each row execute function public.enrich_budget_actual_expense_links();

create or replace function public.sync_budget_planned_expense_trigger()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if tg_op in ('UPDATE','DELETE') then
    perform public.recalculate_budget_planned_expense(old.planned_expense_id);
  end if;
  if tg_op in ('INSERT','UPDATE') then
    if tg_op <> 'UPDATE' or new.planned_expense_id is distinct from old.planned_expense_id then
      perform public.recalculate_budget_planned_expense(new.planned_expense_id);
    elsif new.planned_expense_id is not null then
      perform public.recalculate_budget_planned_expense(new.planned_expense_id);
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists budget_actual_expenses_sync_planned on public.budget_actual_expenses;
create trigger budget_actual_expenses_sync_planned
after insert or update or delete on public.budget_actual_expenses
for each row execute function public.sync_budget_planned_expense_trigger();

create or replace function public.recalculate_budget_debt_balance(p_debt_id uuid)
returns void
language plpgsql
set search_path to 'public'
as $$
declare
  v_debt record;
  v_payment record;
  v_balance numeric(12,2);
  v_before numeric(12,2);
  v_interest numeric(12,2);
  v_principal numeric(12,2);
  v_after numeric(12,2);
  v_last_date date;
  v_days integer;
  v_count integer := 0;
begin
  if p_debt_id is null then
    return;
  end if;

  select *
    into v_debt
  from public.budget_debts
  where id = p_debt_id
  for update;

  if not found then
    return;
  end if;

  v_balance := coalesce(v_debt.tracking_start_balance, v_debt.current_balance, 0);
  v_last_date := coalesce(v_debt.tracking_start_date, date '2026-10-06');

  delete from public.budget_debt_payments
  where debt_id = p_debt_id;

  for v_payment in
    select a.id, a.spent_date, a.amount, a.created_at
    from public.budget_actual_expenses a
    where a.debt_id = p_debt_id
      and a.spent_date >= v_last_date
    order by a.spent_date, a.created_at, a.id
  loop
    v_days := greatest(v_payment.spent_date - v_last_date, 0);
    v_interest := case
      when coalesce(v_debt.apr,0) <= 0 then 0
      else round(v_balance * (v_debt.apr / 100.0) * (v_days / 365.0), 2)
    end;
    v_before := round(v_balance + v_interest, 2);
    v_after := greatest(round(v_before - v_payment.amount, 2), 0);
    v_principal := greatest(round(v_balance - v_after, 2), 0);

    insert into public.budget_debt_payments(
      actual_expense_id, debt_id, payment_date, payment_amount,
      estimated_interest, principal_applied, balance_before, balance_after
    )
    values(
      v_payment.id, p_debt_id, v_payment.spent_date, v_payment.amount,
      v_interest, v_principal, v_before, v_after
    );

    v_balance := v_after;
    v_last_date := v_payment.spent_date;
    v_count := v_count + 1;
  end loop;

  update public.budget_debts
  set current_balance = v_balance,
      balance_estimated = (coalesce(apr,0) > 0 and v_count > 0),
      payoff_status = case
        when v_balance <= 0.005 and v_count > 0 then 'Paid off - awaiting confirmation'
        else payoff_status
      end,
      paid_off_at = case
        when v_balance <= 0.005 and v_count > 0 then coalesce(paid_off_at,v_last_date)
        else paid_off_at
      end,
      updated_at = now()
  where id = p_debt_id;
end;
$$;

create or replace function public.sync_budget_debt_balance_trigger()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if tg_op in ('UPDATE','DELETE') and old.debt_id is not null then
    perform public.recalculate_budget_debt_balance(old.debt_id);
  end if;
  if tg_op in ('INSERT','UPDATE')
     and new.debt_id is not null
     and (tg_op <> 'UPDATE' or new.debt_id is distinct from old.debt_id or new.amount is distinct from old.amount or new.spent_date is distinct from old.spent_date) then
    perform public.recalculate_budget_debt_balance(new.debt_id);
  end if;
  return null;
end;
$$;

drop trigger if exists budget_actual_expenses_sync_debt on public.budget_actual_expenses;
create trigger budget_actual_expenses_sync_debt
after insert or update or delete on public.budget_actual_expenses
for each row execute function public.sync_budget_debt_balance_trigger();

create or replace function public.set_budget_debt_priority(p_debt_ids uuid[])
returns void
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
  if not exists (
    select 1 from public.admin_profiles ap
    where ap.id = (select auth.uid())
      and ap.is_active
  ) then
    raise exception 'Not authorized';
  end if;

  update public.budget_debts d
  set priority_rank = x.ord::integer,
      updated_at = now()
  from unnest(p_debt_ids) with ordinality as x(id, ord)
  where d.id = x.id
    and d.active = true;
end;
$$;

delete from public.budget_expenses
where lower(coalesce(line_item,'')) like '%federal student%'
   or lower(coalesce(notes,'')) like '%federal student%';

delete from public.budget_recurring_bills
where lower(coalesce(item,'')) like '%federal student%'
   or lower(coalesce(notes,'')) like '%federal student%';

delete from public.budget_debts
where lower(coalesce(name,'')) like '%federal student%'
   or lower(coalesce(notes,'')) like '%federal student%';

update public.budget_reference_tabs r
set rows = coalesce((
  select jsonb_agg(e.value order by e.ordinality)
  from jsonb_array_elements(r.rows) with ordinality as e(value, ordinality)
  where e.value::text not ilike '%student loan%'
    and e.value::text not ilike '%student-loan%'
    and e.value::text not ilike '%federal student%'
),'[]'::jsonb)
where r.rows::text ilike '%student%';

insert into public.budget_recurring_bills(
  category,item,amount,frequency,monthly_equivalent,due_timing,
  payment_grace_days,active,notes,source_basis,
  generation_enabled,generation_anchor_date,generation_line_item,generation_expense_type
)
select
  'Kids','Riley oboe',75,'Monthly',75,'25th of each month',
  0,true,'Monthly oboe payment. Total remaining balance/term still TBD; link to a debt once confirmed.',
  'User confirmation Oct. 6, 2026',
  true,date '2026-10-25','Riley oboe','Required'
where not exists (
  select 1 from public.budget_recurring_bills
  where lower(trim(item)) = 'riley oboe'
);

update public.budget_future_expenses
set due_date = date '2026-10-09',
    funding_deadline = date '2026-10-09',
    updated_at = now()
where event_fund = 'Cincinnati Soccer Trip';

update public.budget_debts
set term_end_date = date '2026-12-30',
    tracking_start_balance = current_balance,
    tracking_start_date = date '2026-10-06',
    notes = 'Finite 0% Affirm debt. The recorded $95.33 balance is the source of truth. At a $47.12 required payment, the forecast uses two $47.12 payments and a $1.09 final payment.',
    updated_at = now()
where name = 'Soccer.com';

update public.budget_recurring_bills rb
set amount = 47.12,
    frequency = 'Monthly',
    due_timing = '30th of every month',
    generation_enabled = true,
    generation_anchor_date = date '2026-10-30',
    generation_end_date = date '2026-12-30',
    final_payment_amount = 1.09,
    generation_line_item = 'Soccer.com Affirm',
    generation_expense_type = 'Required',
    payment_grace_days = 10,
    updated_at = now()
where rb.linked_debt_id = (
  select id from public.budget_debts where name='Soccer.com' limit 1
);

delete from public.budget_expenses
where lower(coalesce(line_item,'')) like 'soccer.com affirm%';

delete from public.budget_expenses
where assigned_paycheck > date '2027-10-08'
  and (
    generated_recurring_id is not null
    or future_expense_id is not null
    or lower(coalesce(notes,'')) like '%rolling%'
    or lower(coalesce(notes,'')) like '%generated automatically%'
  );

delete from public.budget_paychecks
where paycheck_date > date '2027-10-08'
  and actual_check is null;

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and (p.proname like 'budget_%' or p.proname like '%_budget_%' or p.proname like '%budget%')
  loop
    execute format('alter function %s set search_path to public', f.sig);
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;

select public.refresh_budget_rolling_horizon(date '2026-10-06');
select public.recalculate_budget_future_buckets();
select public.recalculate_budget_paychecks();
