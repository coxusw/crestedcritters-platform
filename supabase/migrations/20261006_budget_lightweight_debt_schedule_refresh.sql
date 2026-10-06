create or replace function public.refresh_budget_debt_schedule(
  p_debt_id uuid,
  p_reference_date date default current_date
)
returns void
language plpgsql
set search_path to 'public'
as $function$
declare
  v_grace integer;
begin
  select greatest(coalesce(d.payment_grace_days, 0), 0)
    into v_grace
  from public.budget_debts d
  where d.id = p_debt_id;

  if not found then
    return;
  end if;

  update public.budget_expenses e
  set assigned_paycheck = coalesce(
        (
          select max(p.paycheck_date)
          from public.budget_paychecks p
          where p.rolling_generated = true
            and p.paycheck_date <= (e.due_date + v_grace)
        ),
        e.assigned_paycheck
      ),
      updated_at = now()
  where coalesce(e.status, '') = 'Planned'
    and e.due_date >= p_reference_date
    and e.generated_recurring_id in (
      select rb.id
      from public.budget_recurring_bills rb
      where rb.linked_debt_id = p_debt_id
        and rb.generation_enabled = true
    );

  perform public.recalculate_budget_paychecks();
end;
$function$;

comment on function public.refresh_budget_debt_schedule(uuid,date)
is 'Lightweight forecast refresh for one debt after changing its planning grace period. Avoids rebuilding the entire rolling horizon on every debt edit.';
