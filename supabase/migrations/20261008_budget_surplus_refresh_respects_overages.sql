-- Include uncovered actual spending overages in future surplus waterfall calculations.
-- Buffer-covered spending is already in the planned budget and must not be counted twice.
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
  v_cash_overage numeric(14,2) := 0;
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

    -- The original payment is counted once; reduce cash only by the
    -- incremental over-plan amount not already assigned to the buffer.
    select coalesce(sum(greatest(0,
      coalesce(a.overage_amount,0) - coalesce(a.buffer_coverage_amount,0)
    )),0)::numeric(14,2)
    into v_cash_overage
    from public.budget_actual_expenses a
    where a.assigned_paycheck = v_pay.paycheck_date;

    if v_pay.reconciled_checking_balance is not null then
      v_pool := round(
        coalesce(v_pay.reconciled_checking_balance,0) - v_planned - v_cash_overage,
        2
      );
    else
      v_pool := round(v_pool + v_income - v_planned - v_cash_overage,2);
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
          - coalesce((
              select sum(greatest(0,
                coalesce(a.overage_amount,0) - coalesce(a.buffer_coverage_amount,0)
              ))
              from public.budget_actual_expenses a
              where a.assigned_paycheck = p.paycheck_date
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
