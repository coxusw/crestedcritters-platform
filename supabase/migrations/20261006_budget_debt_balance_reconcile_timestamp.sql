alter table public.budget_debts
  add column if not exists tracking_start_at timestamptz;

update public.budget_debts
set tracking_start_at = coalesce(
  tracking_start_at,
  (coalesce(tracking_start_date,date '2026-10-06')::timestamp at time zone 'America/Chicago')
);

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
      and (
        a.spent_date > v_last_date
        or (
          a.spent_date = v_last_date
          and a.created_at > coalesce(v_debt.tracking_start_at,'-infinity'::timestamptz)
        )
      )
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

revoke execute on function public.recalculate_budget_debt_balance(uuid) from public, anon;
grant execute on function public.recalculate_budget_debt_balance(uuid) to authenticated;
