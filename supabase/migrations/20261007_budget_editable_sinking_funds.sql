create or replace function public.refresh_budget_auto_fund_plans(
  p_reference_date date default current_date
)
returns void
language plpgsql
set search_path = public
as $function$
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
    select coalesce(sum(coalesce(e.planned_amount,0)),0)::numeric(14,2)
      into v_funded
    from public.budget_expenses e
    left join public.budget_paychecks p
      on p.paycheck_date = e.assigned_paycheck
    where e.future_expense_id = v_goal.id
      and coalesce(e.status,'') not in ('Cancelled','Deferred')
      and (
        lower(coalesce(e.status,'')) in
          ('funded','received','finalized','completed','closed','paid','settled')
        or coalesce(p.actual_check,0) > 0
        or lower(coalesce(p.period_status,'')) in
          ('funded','received','finalized','completed','closed','paid','settled')
      );

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

alter function public.refresh_budget_auto_fund_plans(date)
  security invoker;

revoke execute on function public.refresh_budget_auto_fund_plans(date)
  from public, anon;
grant execute on function public.refresh_budget_auto_fund_plans(date)
  to authenticated;
