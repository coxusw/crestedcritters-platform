-- Manually confirmed bank-vault transfers: paycheck receipt does not move savings.
-- No assumed/backfilled transfers. All historical vault money must be confirmed.
create table if not exists public.budget_vault_transfers (
  id uuid primary key default gen_random_uuid(),
  future_expense_id uuid not null references public.budget_future_expenses(id) on delete restrict,
  assigned_paycheck date not null references public.budget_paychecks(paycheck_date) on delete restrict,
  transferred_on date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index if not exists budget_vault_transfers_fund_date_idx on public.budget_vault_transfers (future_expense_id,transferred_on);
create index if not exists budget_vault_transfers_paycheck_idx on public.budget_vault_transfers (assigned_paycheck);
alter table public.budget_vault_transfers enable row level security;
create policy "active admins manage budget_vault_transfers" on public.budget_vault_transfers
  for all to authenticated
  using (exists(select 1 from public.admin_profiles ap where ap.id = (select auth.uid()) and ap.is_active))
  with check (exists(select 1 from public.admin_profiles ap where ap.id = (select auth.uid()) and ap.is_active));
revoke all on public.budget_vault_transfers from anon, public;
grant select, insert, update, delete on public.budget_vault_transfers to authenticated;

-- Extra savings only counts once someone confirms the money was moved into its vault.
create or replace function public.budget_emergency_fund_available(p_fund_id uuid)
 returns numeric
 language sql
 stable
 set search_path to 'public'
as $function$
 select (
    coalesce((select sum(t.amount) from public.budget_vault_transfers t where t.future_expense_id = p_fund_id),0)
  + coalesce((select sum(coalesce(src.closeout_amount,0)) from public.budget_future_expenses src
      where src.closeout_destination_fund_id = p_fund_id and src.closeout_destination='next_fund'
      and lower(coalesce(src.status,'')) in ('closed','removed')),0)
  - coalesce((select sum(a.amount) from public.budget_actual_expenses a where a.future_expense_id=p_fund_id),0)
 )::numeric(12,2);
$function$;

CREATE OR REPLACE FUNCTION public.refresh_budget_auto_fund_plans(p_reference_date date DEFAULT CURRENT_DATE)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_goal record;
  v_first_unfunded date;
  v_schedule_start date;
  v_deadline date;
  v_funded numeric(14,2);
  v_incoming numeric(14,2);
  v_remaining numeric(14,2);
  v_total_periods integer;
  v_total_cents bigint;
  v_base_cents bigint;
  v_remainder integer;
  v_period_index integer;
  v_pay date;
  v_amount numeric(14,2);
begin
  perform pg_advisory_xact_lock(hashtext('budget_auto_fund_plans'));

  select min(paycheck_date)
    into v_first_unfunded
  from public.budget_paychecks
  where rolling_generated = true
    and paycheck_date >= p_reference_date
    and not (
      coalesce(actual_check,0) > 0
      or lower(coalesce(period_status,'')) in
        ('funded','received','finalized','completed','closed','paid','settled')
    );

  if v_first_unfunded is null then
    return;
  end if;

  for v_goal in
    select *
    from public.budget_future_expenses
    where coalesce(auto_fund,false) = true
      and lower(coalesce(status,'')) not in ('completed','cancelled','closed','removed')
      and coalesce(target_budget,0) > 0
      and funding_start_paycheck is not null
      and coalesce(funding_deadline,due_date) is not null
  loop
    select coalesce(sum(t.amount),0)::numeric(14,2)
      into v_funded
    from public.budget_vault_transfers t
    where t.future_expense_id = v_goal.id;

    select coalesce(sum(coalesce(src.closeout_amount,0)),0)::numeric(14,2)
      into v_incoming
    from public.budget_future_expenses src
    where src.closeout_destination_fund_id = v_goal.id
      and src.closeout_destination = 'next_fund'
      and lower(coalesce(src.status,'')) in ('closed','removed');

    v_remaining := greatest(
      0,
      round(coalesce(v_goal.target_budget,0) - v_funded - v_incoming,2)
    );

    delete from public.budget_expenses e
    where e.future_expense_id = v_goal.id
      and coalesce(e.status,'Planned') = 'Planned'
      and not exists (
        select 1
        from public.budget_paychecks p
        where p.paycheck_date = e.assigned_paycheck
          and (
            coalesce(p.actual_check,0) > 0
            or lower(coalesce(p.period_status,'')) in
              ('funded','received','finalized','completed','closed','paid','settled')
          )
      );

    v_schedule_start := greatest(
      v_goal.funding_start_paycheck,
      v_first_unfunded
    );
    v_deadline := coalesce(v_goal.funding_deadline,v_goal.due_date);

    if v_remaining <= 0.005 or v_deadline < v_schedule_start then
      continue;
    end if;

    v_total_periods :=
      floor((v_deadline - v_schedule_start)::numeric / 14.0)::integer + 1;

    if v_total_periods < 1 then
      continue;
    end if;

    v_total_cents := round(v_remaining * 100)::bigint;
    v_base_cents :=
      floor(v_total_cents::numeric / v_total_periods)::bigint;
    v_remainder :=
      (v_total_cents - (v_base_cents * v_total_periods))::integer;

    for v_pay in
      select p.paycheck_date
      from public.budget_paychecks p
      where p.rolling_generated = true
        and p.paycheck_date between v_schedule_start and v_deadline
        and not (
          coalesce(p.actual_check,0) > 0
          or lower(coalesce(p.period_status,'')) in
            ('funded','received','finalized','completed','closed','paid','settled')
        )
      order by p.paycheck_date
    loop
      v_period_index :=
        floor((v_pay - v_schedule_start)::numeric / 14.0)::integer;

      v_amount := (
        v_base_cents
        + case when v_period_index < v_remainder then 1 else 0 end
      )::numeric / 100;

      if v_amount > 0 then
        insert into public.budget_expenses(
          due_date, assigned_paycheck, category, line_item, expense_type,
          frequency, planned_amount, status, notes, event_fund,
          future_expense_id
        )
        values(
          v_pay,
          v_pay,
          'Sinking Fund',
          coalesce(v_goal.event_fund,'Future goal') || ' sinking fund',
          'Sinking Fund',
          'Biweekly',
          v_amount,
          'Planned',
          coalesce(
            v_goal.notes,
            'Automatically planned from the sinking-fund target and deadline.'
          ),
          v_goal.event_fund,
          v_goal.id
        );
      end if;
    end loop;
  end loop;

  perform public.recalculate_budget_future_buckets();
  perform public.recalculate_budget_paychecks();
end;
$function$;

CREATE OR REPLACE FUNCTION public.close_budget_sinking_fund(p_fund_id uuid, p_destination text, p_assigned_paycheck date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_fund record;
  v_funded numeric(12,2) := 0;
  v_spent numeric(12,2) := 0;
  v_leftover numeric(12,2) := 0;
  v_target record;
  v_remaining numeric(12,2) := 0;
  v_row record;
  v_new_amount numeric(12,2);
begin
  if coalesce(p_destination, 'none') not in ('none','buffer','next_fund') then
    raise exception 'Unsupported sinking fund closeout destination';
  end if;

  perform pg_advisory_xact_lock(hashtext('budget_sinking_closeout_' || p_fund_id::text));

  select *
    into v_fund
  from public.budget_future_expenses
  where id = p_fund_id
  for update;

  if not found then
    raise exception 'Sinking fund not found';
  end if;

  if lower(coalesce(v_fund.status, '')) in ('closed','completed','cancelled','removed') then
    raise exception 'Sinking fund is already closed';
  end if;

  select coalesce(sum(t.amount),0)::numeric(12,2)
    into v_funded
  from public.budget_vault_transfers t
  where t.future_expense_id = p_fund_id;

  select coalesce(sum(a.amount),0)::numeric(12,2)
    into v_spent
  from public.budget_actual_expenses a
  where a.future_expense_id = p_fund_id;

  v_leftover := greatest(v_funded - v_spent, 0);

  -- Cancel only contributions/allocations that never became funded.
  update public.budget_expenses e
  set status = 'Cancelled',
      notes = concat_ws(' ', e.notes, 'Cancelled when sinking fund was closed.'),
      updated_at = now()
  where e.future_expense_id = p_fund_id
    and coalesce(e.status,'') not in ('Cancelled','Deferred')
    and not (
      lower(coalesce(e.status,'')) in ('funded','received','finalized','completed','closed','paid','settled')
      or exists (
        select 1
        from public.budget_paychecks p
        where p.paycheck_date = e.assigned_paycheck
          and (
            coalesce(p.actual_check,0) > 0
            or lower(coalesce(p.period_status,'')) in ('funded','received','finalized','completed','closed','paid','settled')
          )
      )
    );

  if v_leftover > 0 and p_destination = 'next_fund' then
    select f.id, f.event_fund, f.due_date, f.funding_deadline
      into v_target
    from public.budget_future_expenses f
    where f.id <> p_fund_id
      and lower(coalesce(f.status,'')) not in ('closed','completed','cancelled','removed')
      and coalesce(f.funding_deadline,f.due_date,date '9999-12-31') >= p_assigned_paycheck
    order by coalesce(f.funding_deadline,f.due_date,date '9999-12-31'), f.event_fund
    limit 1;

    if v_target.id is null then
      raise exception 'No open sinking fund is available for the transfer';
    end if;

    -- The transferred money is already funded. Reduce future unfunded
    -- contributions to the destination so the target is not overfunded.
    v_remaining := v_leftover;

    for v_row in
      select e.id, e.planned_amount
      from public.budget_expenses e
      left join public.budget_paychecks p
        on p.paycheck_date = e.assigned_paycheck
      where e.future_expense_id = v_target.id
        and coalesce(e.status,'') = 'Planned'
        and not (
          coalesce(p.actual_check,0) > 0
          or lower(coalesce(p.period_status,'')) in ('funded','received','finalized','completed','closed','paid','settled')
        )
      order by e.assigned_paycheck desc nulls last, e.due_date desc nulls last
    loop
      exit when v_remaining <= 0;

      if coalesce(v_row.planned_amount,0) <= v_remaining then
        v_remaining := v_remaining - coalesce(v_row.planned_amount,0);
        update public.budget_expenses
        set status = 'Cancelled',
            notes = concat_ws(' ', notes, 'Replaced by funded sinking-fund closeout transfer.'),
            updated_at = now()
        where id = v_row.id;
      else
        v_new_amount := coalesce(v_row.planned_amount,0) - v_remaining;
        v_remaining := 0;
        update public.budget_expenses
        set planned_amount = v_new_amount,
            notes = concat_ws(' ', notes, 'Reduced by funded sinking-fund closeout transfer.'),
            updated_at = now()
        where id = v_row.id;
      end if;
    end loop;
  end if;

  update public.budget_future_expenses
  set status = 'Closed',
      closed_at = now(),
      closeout_amount = v_leftover,
      closeout_destination = case when v_leftover > 0 then p_destination else 'none' end,
      closeout_destination_fund_id = case
        when v_leftover > 0 and p_destination = 'next_fund' then v_target.id
        else null
      end,
      closeout_assigned_paycheck = p_assigned_paycheck,
      updated_at = now()
  where id = p_fund_id;

  perform public.recalculate_budget_future_buckets();
  perform public.recalculate_budget_paychecks();

  return jsonb_build_object(
    'fund_id', p_fund_id,
    'fund_name', v_fund.event_fund,
    'funded', v_funded,
    'spent', v_spent,
    'leftover', v_leftover,
    'destination', case when v_leftover > 0 then p_destination else 'none' end,
    'destination_fund_id', case
      when v_leftover > 0 and p_destination = 'next_fund' then v_target.id
      else null
    end,
    'destination_fund_name', case
      when v_leftover > 0 and p_destination = 'next_fund' then v_target.event_fund
      else null
    end
  );
end;
$function$;
