-- The amount of actual spending over a planned line is tracked once.
-- Buffer-covered portions consume the already-planned buffer, while the
-- remainder reduces forecast cash carryover in the current paycheck.
alter table public.budget_actual_expenses
  add column if not exists overage_amount numeric(12,2) not null default 0;
alter table public.budget_actual_expenses
  add constraint budget_actual_overage_amount_check
    check (overage_amount >= 0 and overage_amount <= amount
      and buffer_coverage_amount <= overage_amount);

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
  cash_overages as (
    select
      p.paycheck_date,
      coalesce(sum(greatest(0, coalesce(a.overage_amount,0)
        - coalesce(a.buffer_coverage_amount,0))),0)::numeric(12,2)
        as cash_overage
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
      else pl.planned_total + ov.cash_overage
    end,
    reserve_change =
      coalesce(p.actual_check,p.projected_check,0)
      + inc.extra_total
      - case
          when coalesce(p.period_status,'Open') in ('Closed','Complete','Completed')
            then ac.actual_total
          else pl.planned_total + ov.cash_overage
        end,
    updated_at = now()
  from planned pl
  join actual ac on ac.paycheck_date = pl.paycheck_date
  join extra_income inc on inc.paycheck_date = pl.paycheck_date
  join cash_overages ov on ov.paycheck_date = pl.paycheck_date
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
