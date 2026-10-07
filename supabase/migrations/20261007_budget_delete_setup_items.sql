create or replace function public.delete_budget_setup_item(
  p_item_type text,
  p_item_id uuid,
  p_reference_date date default current_date
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_type text := lower(trim(coalesce(p_item_type,'')));
  v_label text;
  v_category text;
  v_linked_line text;
  v_deleted_plan integer := 0;
  v_deleted_child integer := 0;
begin
  if p_item_id is null then
    raise exception 'Budget item id is required';
  end if;

  if v_type = 'recurring' then
    select item, category
      into v_label, v_category
    from public.budget_recurring_bills
    where id = p_item_id;

    if not found then
      raise exception 'Recurring bill not found';
    end if;

    delete from public.budget_expenses e
    where e.generated_recurring_id = p_item_id
       or (
         e.assigned_paycheck >= p_reference_date
         and lower(coalesce(e.line_item,'')) = lower(coalesce(v_label,''))
         and lower(coalesce(e.category,'')) = lower(coalesce(v_category,''))
       );
    get diagnostics v_deleted_plan = row_count;

    delete from public.budget_recurring_bills
    where id = p_item_id;
    get diagnostics v_deleted_child = row_count;

  elsif v_type in ('future','sinking','sinking_fund','future_expense') then
    select event_fund
      into v_label
    from public.budget_future_expenses
    where id = p_item_id;

    if not found then
      raise exception 'Sinking fund not found';
    end if;

    delete from public.budget_expenses
    where future_expense_id = p_item_id;
    get diagnostics v_deleted_plan = row_count;

    delete from public.budget_future_expenses
    where id = p_item_id;
    get diagnostics v_deleted_child = row_count;

  elsif v_type = 'debt' then
    select name, linked_budget_line_item
      into v_label, v_linked_line
    from public.budget_debts
    where id = p_item_id;

    if not found then
      raise exception 'Debt not found';
    end if;

    delete from public.budget_expenses e
    where e.forecast_debt_id = p_item_id
       or e.generated_recurring_id in (
         select rb.id
         from public.budget_recurring_bills rb
         where rb.linked_debt_id = p_item_id
       )
       or (
         v_linked_line is not null
         and e.assigned_paycheck >= p_reference_date
         and lower(coalesce(e.line_item,'')) = lower(v_linked_line)
       );
    get diagnostics v_deleted_plan = row_count;

    select count(*)
      into v_deleted_child
    from public.budget_recurring_bills
    where linked_debt_id = p_item_id;

    delete from public.budget_debts
    where id = p_item_id;

  else
    raise exception 'Unsupported budget item type: %', p_item_type;
  end if;

  perform public.refresh_budget_auto_fund_plans(p_reference_date);
  perform public.refresh_budget_forecast_surplus_allocations(p_reference_date);
  perform public.recalculate_budget_paychecks();

  return jsonb_build_object(
    'type', v_type,
    'label', v_label,
    'deleted_plan_rows', v_deleted_plan,
    'deleted_linked_rows', v_deleted_child
  );
end;
$function$;

revoke execute on function public.delete_budget_setup_item(text,uuid,date)
  from public, anon;
grant execute on function public.delete_budget_setup_item(text,uuid,date)
  to authenticated;
