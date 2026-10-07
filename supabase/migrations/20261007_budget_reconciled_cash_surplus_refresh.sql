-- Make reconciled bank cash the source of truth for the forecast carryover.
-- A reconciled paycheck resets the running pool to real cash after the current
-- period plan; later forecast periods roll forward from that real balance.

begin;

CREATE OR REPLACE FUNCTION public.recalculate_budget_paychecks()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  with planned as (
    select
      p.paycheck_date,
      coalesce(sum(
        case
          when (e.status is null or e.status not in ('Cancelled','Deferred'))
           and coalesce(e.forecast_suppressed,false) = false
          then coalesce(e.planned_amount,0)
          else 0
        end
      ),0)::numeric(12,2) as planned_total
    from public.budget_paychecks p
    left join public.budget_expenses e
      on e.assigned_paycheck = p.paycheck_date
    group by p.paycheck_date
  ),
  actual as (
    select
      p.paycheck_date,
      coalesce(sum(a.amount),0)::numeric(12,2) as actual_total
    from public.budget_paychecks p
    left join public.budget_actual_expenses a
      on a.assigned_paycheck = p.paycheck_date
    group by p.paycheck_date
  ),
  extra_income as (
    select
      p.paycheck_date,
      coalesce(sum(i.amount),0)::numeric(12,2) as extra_total
    from public.budget_paychecks p
    left join public.budget_income_entries i
      on i.assigned_paycheck = p.paycheck_date
    group by p.paycheck_date
  )
  update public.budget_paychecks p
  set
    planned_spending = pl.planned_total,
    actual_spending = ac.actual_total,
    income_used = coalesce(p.actual_check,p.projected_check,0) + inc.extra_total,
    spending_used = case
      when coalesce(p.period_status,'Open') in ('Closed','Complete','Completed')
        then ac.actual_total
      else pl.planned_total
    end,
    reserve_change =
      coalesce(p.actual_check,p.projected_check,0)
      + inc.extra_total
      - case
          when coalesce(p.period_status,'Open') in ('Closed','Complete','Completed')
            then ac.actual_total
          else pl.planned_total
        end,
    updated_at = now()
  from planned pl
  join actual ac on ac.paycheck_date = pl.paycheck_date
  join extra_income inc on inc.paycheck_date = pl.paycheck_date
  where p.paycheck_date = pl.paycheck_date;

  with recursive ordered as (
    select
      p.paycheck_date,
      p.reconciled_checking_balance,
      coalesce(p.spending_used,0)::numeric(12,2) as spending_used,
      coalesce(p.reserve_change,0)::numeric(12,2) as reserve_change,
      row_number() over (order by p.paycheck_date) as rn
    from public.budget_paychecks p
  ),
  running as (
    select
      o.paycheck_date,
      o.rn,
      case
        when o.reconciled_checking_balance is not null
          then round(o.reconciled_checking_balance - o.spending_used,2)
        else o.reserve_change
      end::numeric(12,2) as running_total
    from ordered o
    where o.rn = 1

    union all

    select
      o.paycheck_date,
      o.rn,
      case
        when o.reconciled_checking_balance is not null
          then round(o.reconciled_checking_balance - o.spending_used,2)
        else round(r.running_total + o.reserve_change,2)
      end::numeric(12,2) as running_total
    from ordered o
    join running r on o.rn = r.rn + 1
  )
  update public.budget_paychecks p
  set running_cash_goal_pool = r.running_total,
      updated_at = now()
  from running r
  where p.paycheck_date = r.paycheck_date;
end;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_budget_forecast_surplus_allocations_impl(p_reference_date date DEFAULT CURRENT_DATE)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_first date;
  v_last date;
  v_pool numeric(14,2) := 0;
  v_keep numeric(14,2) := 500;
  v_future_hold numeric(14,2) := 0;
  v_excess numeric(14,2) := 0;
  v_amount numeric(14,2) := 0;
  v_income numeric(14,2) := 0;
  v_planned numeric(14,2) := 0;
  v_minimum numeric(14,2) := 0;
  v_interest numeric(14,2) := 0;
  v_balance numeric(14,2) := 0;
  v_reserve_balance numeric(14,2) := 0;
  v_current_fund_target numeric(14,2) := 1000;
  v_one_month_target numeric(14,2) := 1000;
  v_three_month_target numeric(14,2) := 1000;
  v_six_month_target numeric(14,2) := 1000;
  v_balances jsonb := '{}'::jsonb;
  v_emergency_id uuid;
  v_emergency_name text := 'Emergency Fund';
  v_stage text;
  v_debt record;
  v_pay record;
  v_debt_id uuid;
  v_debt_name text;
  v_debt_type text;
  v_debt_priority integer;
  v_found_target boolean;
begin
  perform pg_advisory_xact_lock(hashtext('budget_forecast_surplus_allocations'));

  perform public.sync_budget_emergency_fund_target();

  select min(paycheck_date), max(paycheck_date)
    into v_first, v_last
  from public.budget_paychecks
  where rolling_generated = true
    and paycheck_date >= p_reference_date;

  if v_first is null or v_last is null then
    return;
  end if;

  update public.budget_expenses
  set forecast_suppressed = false,
      updated_at = now()
  where assigned_paycheck >= v_first
    and forecast_suppressed = true;

  delete from public.budget_expenses
  where forecast_generated = true
    and assigned_paycheck >= v_first
    and coalesce(status,'Planned') = 'Planned'
    and coalesce(reconciliation_status,'Unpaid') = 'Unpaid'
    and coalesce(actual_amount,0) = 0;

  perform public.recalculate_budget_paychecks();

  select coalesce((
    select p.running_cash_goal_pool
    from public.budget_paychecks p
    where p.paycheck_date < v_first
    order by p.paycheck_date desc
    limit 1
  ),0)::numeric(14,2)
    into v_pool;

  select id, event_fund, target_budget
    into v_emergency_id, v_emergency_name, v_current_fund_target
  from public.budget_future_expenses
  where lower(coalesce(event_fund,'')) like '%emergency fund%'
  order by case when lower(coalesce(event_fund,'')) = 'emergency fund' then 0 else 1 end, id
  limit 1;

  if v_emergency_id is not null then
    v_reserve_balance := greatest(0, public.budget_emergency_fund_available(v_emergency_id));
    v_current_fund_target := greatest(1000, coalesce(v_current_fund_target,1000));
  else
    v_reserve_balance := 0;
    v_current_fund_target := 1000;
  end if;

  v_one_month_target := greatest(1000, public.budget_reserve_monthly_basis('one_month'));
  v_three_month_target := greatest(1000, 3 * public.budget_reserve_monthly_basis('after_jeep'));
  v_six_month_target := greatest(1000, 6 * public.budget_reserve_monthly_basis('after_van'));

  for v_debt in
    select id, name, debt_type, current_balance, apr, linked_budget_line_item, priority_rank
    from public.budget_debts
    where active = true
      and payoff_status = 'Active'
      and coalesce(current_balance,0) > 0.005
  loop
    v_balances := jsonb_set(
      v_balances,
      array[v_debt.id::text],
      to_jsonb(round(coalesce(v_debt.current_balance,0)::numeric,2)),
      true
    );
  end loop;

  for v_pay in
    select p.*
    from public.budget_paychecks p
    where p.rolling_generated = true
      and p.paycheck_date between v_first and v_last
    order by p.paycheck_date
  loop
    for v_debt in
      select id, name, debt_type, current_balance, apr, linked_budget_line_item, priority_rank
      from public.budget_debts
      where active = true
        and payoff_status = 'Active'
        and coalesce(current_balance,0) > 0.005
      order by priority_rank nulls last, name
    loop
      v_balance := coalesce((v_balances ->> v_debt.id::text)::numeric,0);
      if v_balance <= 0.005 then
        continue;
      end if;

      v_interest := case
        when coalesce(v_debt.apr,0) > 0
          then round(v_balance * (v_debt.apr / 100.0) * 14.0 / 365.0, 2)
        else 0
      end;

      select coalesce(sum(e.planned_amount),0)::numeric(14,2)
        into v_minimum
      from public.budget_expenses e
      left join public.budget_recurring_bills rb
        on rb.id = e.generated_recurring_id
      where e.assigned_paycheck = v_pay.paycheck_date
        and coalesce(e.status,'') not in ('Cancelled','Deferred')
        and coalesce(e.forecast_generated,false) = false
        and coalesce(e.forecast_suppressed,false) = false
        and (
          rb.linked_debt_id = v_debt.id
          or (
            nullif(trim(coalesce(v_debt.linked_budget_line_item,'')),'') is not null
            and lower(trim(coalesce(e.line_item,''))) =
                lower(trim(v_debt.linked_budget_line_item))
          )
        );

      v_balance := greatest(0, round(v_balance + v_interest - v_minimum,2));
      v_balances := jsonb_set(
        v_balances,
        array[v_debt.id::text],
        to_jsonb(v_balance),
        true
      );

      if v_balance <= 0.005 then
        update public.budget_expenses e
        set forecast_suppressed = true,
            updated_at = now()
        from public.budget_recurring_bills rb
        where e.generated_recurring_id = rb.id
          and e.assigned_paycheck > v_pay.paycheck_date
          and coalesce(e.status,'') = 'Planned'
          and coalesce(e.forecast_generated,false) = false
          and (
            rb.linked_debt_id = v_debt.id
            or (
              nullif(trim(coalesce(v_debt.linked_budget_line_item,'')),'') is not null
              and lower(trim(coalesce(e.line_item,''))) =
                  lower(trim(v_debt.linked_budget_line_item))
            )
          );

        update public.budget_expenses e
        set forecast_suppressed = true,
            updated_at = now()
        where e.generated_recurring_id is null
          and e.assigned_paycheck > v_pay.paycheck_date
          and coalesce(e.status,'') = 'Planned'
          and coalesce(e.forecast_generated,false) = false
          and nullif(trim(coalesce(v_debt.linked_budget_line_item,'')),'') is not null
          and lower(trim(coalesce(e.line_item,''))) =
              lower(trim(v_debt.linked_budget_line_item));
      end if;
    end loop;

    select
      coalesce(v_pay.actual_check,v_pay.projected_check,0)
      + coalesce((
          select sum(i.amount)
          from public.budget_income_entries i
          where i.assigned_paycheck = v_pay.paycheck_date
        ),0)
      into v_income;

    select coalesce(sum(e.planned_amount),0)::numeric(14,2)
      into v_planned
    from public.budget_expenses e
    where e.assigned_paycheck = v_pay.paycheck_date
      and coalesce(e.status,'') not in ('Cancelled','Deferred')
      and coalesce(e.forecast_suppressed,false) = false;

    if v_pay.reconciled_checking_balance is not null then
      v_pool := round(
        coalesce(v_pay.reconciled_checking_balance,0) - v_planned,
        2
      );
    else
      v_pool := round(v_pool + v_income - v_planned,2);
    end if;

    with future_delta as (
      select
        p.paycheck_date,
        (
          coalesce(p.actual_check,p.projected_check,0)
          + coalesce((
              select sum(i.amount)
              from public.budget_income_entries i
              where i.assigned_paycheck = p.paycheck_date
            ),0)
          - coalesce((
              select sum(e.planned_amount)
              from public.budget_expenses e
              where e.assigned_paycheck = p.paycheck_date
                and coalesce(e.status,'') not in ('Cancelled','Deferred')
                and coalesce(e.forecast_suppressed,false) = false
                and coalesce(e.forecast_generated,false) = false
            ),0)
        )::numeric(14,2) as delta
      from public.budget_paychecks p
      where p.rolling_generated = true
        and p.paycheck_date > v_pay.paycheck_date
        and p.paycheck_date <= v_last
    ),
    future_running as (
      select sum(delta) over(order by paycheck_date) as running_delta
      from future_delta
    )
    select greatest(0, -least(0, coalesce(min(running_delta),0)))::numeric(14,2)
      into v_future_hold
    from future_running;

    v_keep := greatest(500, coalesce(v_future_hold,0));
    v_excess := greatest(0, round(v_pool - v_keep,2));

    while v_excess > 0.005 loop
      v_amount := 0;
      v_stage := null;
      v_debt_id := null;
      v_debt_name := null;
      v_debt_type := null;
      v_debt_priority := null;
      v_found_target := false;

      if v_reserve_balance < 1000 - 0.005 then
        v_stage := 'initial';
        v_amount := least(v_excess, 1000 - v_reserve_balance);
        v_found_target := true;
      else
        select d.id, d.name, d.debt_type, d.priority_rank
          into v_debt_id, v_debt_name, v_debt_type, v_debt_priority
        from public.budget_debts d
        where d.active = true
          and d.payoff_status = 'Active'
          and lower(coalesce(d.debt_type,'')) not in ('auto loan','mortgage')
          and coalesce((v_balances ->> d.id::text)::numeric,0) > 0.005
        order by d.priority_rank nulls last, d.name
        limit 1;

        if v_debt_id is not null then
          v_balance := coalesce((v_balances ->> v_debt_id::text)::numeric,0);
          v_amount := least(v_excess, v_balance);
          v_stage := 'debt';
          v_found_target := true;
        elsif v_reserve_balance < v_one_month_target - 0.005 then
          v_stage := 'one_month';
          v_amount := least(v_excess, v_one_month_target - v_reserve_balance);
          v_found_target := true;
        else
          select d.id, d.name, d.debt_type, d.priority_rank
            into v_debt_id, v_debt_name, v_debt_type, v_debt_priority
          from public.budget_debts d
          where d.active = true
            and d.payoff_status = 'Active'
            and lower(coalesce(d.debt_type,'')) = 'auto loan'
            and lower(coalesce(d.name,'')) like '%jeep%'
            and coalesce((v_balances ->> d.id::text)::numeric,0) > 0.005
          order by d.priority_rank nulls last, d.name
          limit 1;

          if v_debt_id is not null then
            v_balance := coalesce((v_balances ->> v_debt_id::text)::numeric,0);
            v_amount := least(v_excess, v_balance);
            v_stage := 'debt';
            v_found_target := true;
          elsif v_reserve_balance < v_three_month_target - 0.005 then
            v_stage := 'three_month';
            v_amount := least(v_excess, v_three_month_target - v_reserve_balance);
            v_found_target := true;
          else
            select d.id, d.name, d.debt_type, d.priority_rank
              into v_debt_id, v_debt_name, v_debt_type, v_debt_priority
            from public.budget_debts d
            where d.active = true
              and d.payoff_status = 'Active'
              and lower(coalesce(d.debt_type,'')) = 'auto loan'
              and (
                lower(coalesce(d.name,'')) like '%van%'
                or lower(coalesce(d.name,'')) like '%pacifica%'
              )
              and coalesce((v_balances ->> d.id::text)::numeric,0) > 0.005
            order by d.priority_rank nulls last, d.name
            limit 1;

            if v_debt_id is not null then
              v_balance := coalesce((v_balances ->> v_debt_id::text)::numeric,0);
              v_amount := least(v_excess, v_balance);
              v_stage := 'debt';
              v_found_target := true;
            elsif v_reserve_balance < v_six_month_target - 0.005 then
              v_stage := 'six_month';
              v_amount := least(v_excess, v_six_month_target - v_reserve_balance);
              v_found_target := true;
            end if;
          end if;
        end if;
      end if;

      exit when not v_found_target or v_amount <= 0.005;

      v_amount := round(v_amount,2);

      if v_stage = 'debt' and v_debt_id is not null then
        insert into public.budget_expenses(
          due_date, assigned_paycheck, category, line_item, expense_type,
          frequency, planned_amount, status, notes,
          forecast_generated, forecast_debt_id, forecast_suppressed
        )
        values(
          v_pay.paycheck_date,
          v_pay.paycheck_date,
          'Debt',
          'Extra debt payment — ' || v_debt_name,
          'Forecast Debt',
          'One-time',
          v_amount,
          'Planned',
          'Automatically assigned forecast surplus. This remains planned until the paycheck is received and the payment is actually logged.',
          true,
          v_debt_id,
          false
        );

        v_balance := greatest(
          0,
          round(coalesce((v_balances ->> v_debt_id::text)::numeric,0) - v_amount,2)
        );
        v_balances := jsonb_set(
          v_balances,
          array[v_debt_id::text],
          to_jsonb(v_balance),
          true
        );

        if v_balance <= 0.005 then
          update public.budget_expenses e
          set forecast_suppressed = true,
              updated_at = now()
          from public.budget_recurring_bills rb
          where e.generated_recurring_id = rb.id
            and e.assigned_paycheck > v_pay.paycheck_date
            and coalesce(e.status,'') = 'Planned'
            and coalesce(e.forecast_generated,false) = false
            and (
              rb.linked_debt_id = v_debt_id
              or exists (
                select 1
                from public.budget_debts d
                where d.id = v_debt_id
                  and nullif(trim(coalesce(d.linked_budget_line_item,'')),'') is not null
                  and lower(trim(coalesce(e.line_item,''))) =
                      lower(trim(d.linked_budget_line_item))
              )
            );

          update public.budget_expenses e
          set forecast_suppressed = true,
              updated_at = now()
          where e.generated_recurring_id is null
            and e.assigned_paycheck > v_pay.paycheck_date
            and coalesce(e.status,'') = 'Planned'
            and coalesce(e.forecast_generated,false) = false
            and exists (
              select 1
              from public.budget_debts d
              where d.id = v_debt_id
                and nullif(trim(coalesce(d.linked_budget_line_item,'')),'') is not null
                and lower(trim(coalesce(e.line_item,''))) =
                    lower(trim(d.linked_budget_line_item))
            );
        end if;
      else
        insert into public.budget_expenses(
          due_date, assigned_paycheck, category, line_item, expense_type,
          frequency, planned_amount, status, notes, event_fund,
          future_expense_id, forecast_generated, forecast_suppressed
        )
        values(
          v_pay.paycheck_date,
          v_pay.paycheck_date,
          'Sinking Fund',
          case v_stage
            when 'initial' then 'Emergency Fund — initial $1,000'
            when 'one_month' then 'Emergency Fund — 1-month milestone'
            when 'three_month' then 'Emergency Fund — 3-month milestone'
            when 'six_month' then 'Emergency Fund — 6-month milestone'
            else 'Emergency Fund'
          end,
          'Sinking Fund',
          'One-time',
          v_amount,
          'Planned',
          'Automatically assigned forecast surplus. Future money stays planned until the paycheck is received and finalized.',
          v_emergency_name,
          case
            when v_emergency_id is not null
             and (
               (v_stage = 'initial' and v_current_fund_target >= 1000)
               or (v_stage = 'one_month' and v_current_fund_target >= v_one_month_target)
               or (v_stage = 'three_month' and v_current_fund_target >= v_three_month_target)
               or (v_stage = 'six_month' and v_current_fund_target >= v_six_month_target)
             )
            then v_emergency_id
            else null
          end,
          true,
          false
        );

        v_reserve_balance := round(v_reserve_balance + v_amount,2);
      end if;

      v_pool := round(v_pool - v_amount,2);
      v_excess := round(v_excess - v_amount,2);
    end loop;
  end loop;

  perform public.recalculate_budget_future_buckets();
  perform public.recalculate_budget_paychecks();
end;
$function$;

revoke execute on function public.refresh_budget_forecast_surplus_allocations_impl(date)
  from public, anon;
grant execute on function public.refresh_budget_forecast_surplus_allocations_impl(date)
  to authenticated;

commit;
