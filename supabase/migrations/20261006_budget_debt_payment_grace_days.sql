alter table public.budget_debts
  add column if not exists payment_grace_days integer not null default 0
  check (payment_grace_days between 0 and 31);

update public.budget_debts
set payment_grace_days = 10,
    updated_at = now()
where lower(name) = 'mortgage'
  and active = true;

create or replace function public.refresh_budget_rolling_horizon(
  p_reference_date date default current_date
)
returns void
language plpgsql
as $function$
declare
  v_anchor date;
  v_first date;
  v_last date;
  v_due_end date;
  v_offset integer;
  v_source_row integer;
  v_projected numeric;
  v_bill record;
  v_due date;
  v_assign date;
  v_line text;
  v_amount numeric;
  v_i integer;
  v_end date;
  v_goal record;
  v_pay date;
  v_total_periods integer;
  v_period_index integer;
  v_total_cents bigint;
  v_base_cents bigint;
  v_remainder integer;
  v_goal_amount numeric;
begin
  perform pg_advisory_xact_lock(hashtext('budget_rolling_horizon'));

  select min(paycheck_date) into v_anchor
  from public.budget_paychecks;

  if v_anchor is null then
    v_anchor := date '2026-10-09';
  end if;

  if p_reference_date <= v_anchor then
    v_first := v_anchor;
  else
    v_offset := ceil((p_reference_date - v_anchor)::numeric / 14.0)::integer;
    v_first := v_anchor + (v_offset * 14);
  end if;

  v_last := v_first;
  while v_last < (p_reference_date + 365) loop
    v_last := v_last + 14;
  end loop;

  v_due_end := v_last + 13;

  select projected_check
    into v_projected
  from public.budget_paychecks
  where paycheck_date <= v_first
    and projected_check is not null
  order by paycheck_date desc
  limit 1;

  v_projected := coalesce(v_projected, 5500);

  select coalesce(max(source_row), 0) into v_source_row
  from public.budget_paychecks;

  v_pay := v_first;
  while v_pay <= v_last loop
    if not exists (
      select 1
      from public.budget_paychecks
      where paycheck_date = v_pay
    ) then
      v_source_row := v_source_row + 1;

      insert into public.budget_paychecks(
        source_row, paycheck_date, projected_check, actual_check,
        period_status, planned_spending, actual_spending, income_used,
        spending_used, reserve_change, running_cash_goal_pool,
        checking_before_paycheck, notes, forecast_goal, updated_at,
        review_required, review_reason, review_triggered_at,
        rolling_generated, rolling_generated_at
      )
      values (
        v_source_row, v_pay, v_projected, null,
        'Open', 0, 0, v_projected,
        0, 0, 0,
        null,
        'Created automatically by rolling one-year budget generator.',
        null, now(),
        false, null, null,
        true, now()
      );
    else
      update public.budget_paychecks
      set rolling_generated = true,
          rolling_generated_at = coalesce(rolling_generated_at, now()),
          updated_at = now()
      where paycheck_date = v_pay;
    end if;

    v_pay := v_pay + 14;
  end loop;

  update public.budget_paychecks
  set rolling_generated = false
  where paycheck_date > v_last;

  update public.budget_debts
  set payoff_status = 'Paid off - awaiting confirmation',
      paid_off_at = coalesce(paid_off_at, term_end_date),
      updated_at = now()
  where payoff_status = 'Active'
    and term_end_date is not null
    and term_end_date < p_reference_date;

  for v_bill in
    select rb.*,
           d.payoff_status as debt_payoff_status,
           d.term_end_date as debt_term_end,
           d.payment_grace_days as debt_payment_grace_days
    from public.budget_recurring_bills rb
    left join public.budget_debts d
      on d.id = rb.linked_debt_id
    where rb.generation_enabled = true
      and rb.generation_anchor_date is not null
      and rb.amount is not null
      and rb.amount > 0
  loop
    if v_bill.linked_debt_id is not null
       and coalesce(v_bill.debt_payoff_status, 'Active') <> 'Active' then
      continue;
    end if;

    v_end := coalesce(v_bill.debt_term_end, v_bill.generation_end_date);
    v_line := coalesce(nullif(v_bill.generation_line_item, ''), v_bill.item);
    v_i := 0;

    loop
      if v_bill.frequency in ('Monthly', 'Variable Monthly') then
        v_due := public.budget_add_months_preserve_day(
          v_bill.generation_anchor_date,
          v_i
        );
        v_i := v_i + 1;
      elsif v_bill.frequency = 'Annual' then
        v_due := public.budget_add_months_preserve_day(
          v_bill.generation_anchor_date,
          v_i * 12
        );
        v_i := v_i + 1;
      elsif v_bill.frequency = 'Biweekly' then
        v_due := v_bill.generation_anchor_date + (v_i * 14);
        v_i := v_i + 1;
      elsif v_bill.frequency = 'Weekly' then
        v_due := v_bill.generation_anchor_date + (v_i * 7);
        v_i := v_i + 1;
      else
        exit;
      end if;

      exit when v_due > v_due_end;

      if v_end is not null and v_due > v_end then
        exit;
      end if;

      if v_due < v_first then
        continue;
      end if;

      -- Allow a recurring bill to use the next paycheck when it falls inside
      -- its configured planning grace. This is a forecast rule only.
      select max(paycheck_date)
        into v_assign
      from public.budget_paychecks
      where paycheck_date <= (
              v_due + greatest(
                coalesce(
                  v_bill.debt_payment_grace_days,
                  v_bill.payment_grace_days,
                  0
                ),
                0
              )
            )
        and paycheck_date >= v_first
        and paycheck_date <= v_last
        and rolling_generated = true;

      if v_assign is null then
        v_assign := v_first;
      end if;

      v_amount := case
        when v_end is not null
         and v_due = v_end
         and v_bill.final_payment_amount is not null
        then v_bill.final_payment_amount
        else v_bill.amount
      end;

      -- Update the canonical generated occurrence first so repeated refreshes
      -- cannot create a second copy.
      update public.budget_expenses
      set due_date = v_due,
          assigned_paycheck = v_assign,
          category = coalesce(v_bill.category, category),
          line_item = v_line,
          expense_type = coalesce(
            nullif(v_bill.generation_expense_type, ''),
            expense_type,
            'Required'
          ),
          frequency = v_bill.frequency,
          planned_amount = v_amount,
          generated_recurring_id = v_bill.id,
          generated_occurrence_date = v_due,
          updated_at = now()
      where generated_recurring_id = v_bill.id
        and generated_occurrence_date = v_due
        and coalesce(status, '') = 'Planned';

      if not found then
        -- Adopt an exact legacy row when it represents the same occurrence.
        update public.budget_expenses
        set assigned_paycheck = v_assign,
            category = coalesce(v_bill.category, category),
            line_item = v_line,
            expense_type = coalesce(
              nullif(v_bill.generation_expense_type, ''),
              expense_type,
              'Required'
            ),
            frequency = v_bill.frequency,
            planned_amount = v_amount,
            generated_recurring_id = v_bill.id,
            generated_occurrence_date = v_due,
            updated_at = now()
        where generated_recurring_id is null
          and line_item = v_line
          and due_date = v_due
          and coalesce(status, '') = 'Planned';
      end if;

      if not found then
        insert into public.budget_expenses(
          due_date, assigned_paycheck, category, line_item, expense_type,
          frequency, planned_amount, status, notes,
          generated_recurring_id, generated_occurrence_date
        )
        values(
          v_due, v_assign, v_bill.category, v_line,
          coalesce(nullif(v_bill.generation_expense_type, ''), 'Required'),
          v_bill.frequency, v_amount, 'Planned',
          coalesce(
            v_bill.notes,
            'Generated automatically from rolling one-year budget data.'
          ),
          v_bill.id, v_due
        )
        on conflict do nothing;
      end if;
    end loop;
  end loop;

  for v_goal in
    select *
    from public.budget_future_expenses
    where coalesce(auto_fund, false) = true
      and coalesce(status, '') not in ('Completed', 'Cancelled', 'Closed')
      and funding_start_paycheck is not null
      and coalesce(funding_deadline, due_date) is not null
      and target_budget is not null
      and target_budget > 0
  loop
    v_total_periods := floor(
      (
        coalesce(v_goal.funding_deadline, v_goal.due_date)
        - v_goal.funding_start_paycheck
      )::numeric / 14
    )::integer + 1;

    if v_total_periods < 1 then
      v_total_periods := 1;
    end if;

    v_total_cents := round(v_goal.target_budget * 100)::bigint;
    v_base_cents := floor(
      v_total_cents::numeric / v_total_periods
    )::bigint;
    v_remainder := (
      v_total_cents - (v_base_cents * v_total_periods)
    )::integer;

    for v_pay in
      select paycheck_date
      from public.budget_paychecks
      where rolling_generated = true
        and paycheck_date between v_first and v_last
      order by paycheck_date
    loop
      if v_pay < v_goal.funding_start_paycheck
         or v_pay > coalesce(v_goal.funding_deadline, v_goal.due_date) then
        continue;
      end if;

      v_period_index := floor(
        (v_pay - v_goal.funding_start_paycheck)::numeric / 14
      )::integer;

      v_goal_amount := (
        v_base_cents
        + case when v_period_index < v_remainder then 1 else 0 end
      )::numeric / 100;

      if not exists (
        select 1
        from public.budget_expenses e
        where e.future_expense_id = v_goal.id
          and e.assigned_paycheck = v_pay
          and coalesce(e.status, '') <> 'Cancelled'
      ) then
        insert into public.budget_expenses(
          due_date, assigned_paycheck, category, line_item, expense_type,
          frequency, planned_amount, status, notes, event_fund,
          future_expense_id
        )
        values(
          v_pay, v_pay, 'Sinking Fund',
          coalesce(v_goal.event_fund, 'Future goal') || ' sinking fund',
          'Sinking Fund', 'Biweekly', v_goal_amount, 'Planned',
          coalesce(
            v_goal.notes,
            'Generated automatically for the rolling one-year forecast.'
          ),
          v_goal.event_fund, v_goal.id
        );
      end if;
    end loop;
  end loop;

  perform public.recalculate_budget_paychecks();
end;
$function$;

select public.refresh_budget_rolling_horizon(date '2026-10-06');
