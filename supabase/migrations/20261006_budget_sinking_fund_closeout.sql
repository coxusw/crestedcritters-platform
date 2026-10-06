alter table public.budget_future_expenses
  add column if not exists closed_at timestamptz,
  add column if not exists closeout_amount numeric(12,2),
  add column if not exists closeout_destination text,
  add column if not exists closeout_destination_fund_id uuid references public.budget_future_expenses(id) on delete set null,
  add column if not exists closeout_assigned_paycheck date;

create or replace function public.close_budget_sinking_fund(
  p_fund_id uuid,
  p_destination text,
  p_assigned_paycheck date
)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
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

  select coalesce(sum(coalesce(e.planned_amount,0)),0)::numeric(12,2)
    into v_funded
  from public.budget_expenses e
  left join public.budget_paychecks p
    on p.paycheck_date = e.assigned_paycheck
  where e.future_expense_id = p_fund_id
    and coalesce(e.status,'') not in ('Cancelled','Deferred')
    and (
      lower(coalesce(e.status,'')) in ('funded','received','finalized','completed','closed','paid','settled')
      or coalesce(p.actual_check,0) > 0
      or lower(coalesce(p.period_status,'')) in ('funded','received','finalized','completed','closed','paid','settled')
    );

  select coalesce(sum(a.amount),0)::numeric(12,2)
    into v_spent
  from public.budget_actual_expenses a
  where a.future_expense_id = p_fund_id;

  v_leftover := greatest(v_funded - v_spent, 0);

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

create or replace function public.recalculate_budget_future_buckets()
returns void
language plpgsql
set search_path to 'public'
as $function$
begin
  with planned as (
    select
      f.id,
      (
        coalesce(sum(
          case
            when e.status is null or e.status not in ('Cancelled','Deferred')
            then coalesce(e.planned_amount,0)
            else 0
          end
        ),0)
        +
        coalesce((
          select sum(coalesce(src.closeout_amount,0))
          from public.budget_future_expenses src
          where src.closeout_destination_fund_id = f.id
            and src.closeout_destination = 'next_fund'
            and lower(coalesce(src.status,'')) in ('closed','removed')
        ),0)
      )::numeric(12,2) as planned_total
    from public.budget_future_expenses f
    left join public.budget_expenses e
      on e.future_expense_id = f.id
    group by f.id
  ),
  spent as (
    select
      f.id,
      coalesce(sum(a.amount),0)::numeric(12,2) as spent_total
    from public.budget_future_expenses f
    left join public.budget_actual_expenses a
      on a.future_expense_id = f.id
    group by f.id
  )
  update public.budget_future_expenses f
  set planned_funding = p.planned_total,
      actual_funding_spend = s.spent_total,
      remaining_to_plan = coalesce(f.target_budget,0) - p.planned_total,
      remaining_actual = coalesce(f.target_budget,0) - s.spent_total,
      updated_at = now()
  from planned p
  join spent s on s.id = p.id
  where f.id = p.id;
end;
$function$;
