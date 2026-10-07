-- Retire per-person discretionary spending and move that $400/paycheck into the unplanned buffer.

delete from public.budget_expenses
where lower(trim(coalesce(line_item,''))) in (
  'chris discretionary spending',
  'jen discretionary spending',
  'jennifer discretionary spending'
);

delete from public.budget_recurring_bills
where lower(trim(coalesce(item,''))) in (
  'chris discretionary spending',
  'jen discretionary spending',
  'jennifer discretionary spending'
);

update public.budget_people
set default_discretionary = 0,
    active = false,
    updated_at = now()
where lower(name) in ('chris','jen','jennifer');

update public.budget_recurring_bills
set amount = 700,
    monthly_equivalent = round(700 * 26.0 / 12.0, 2),
    notes = 'Biweekly flexible cushion for forgotten or unplanned household expenses.',
    updated_at = now()
where lower(trim(item)) = 'forgotten / unplanned expense buffer';

update public.budget_expenses
set planned_amount = 700,
    notes = replace(
      coalesce(notes,''),
      'Buffer raised to $700 after removing personal discretionary allowances.',
      'Flexible household cushion is $700 per paycheck.'
    ),
    updated_at = now()
where lower(trim(coalesce(line_item,''))) = 'forgotten / unplanned expense buffer';

update public.budget_actual_expenses
set category = 'Forgotten / unplanned expense buffer',
    note = concat_ws(' ', note, 'Reclassified into the household unplanned-expense buffer.')
where lower(trim(coalesce(category,''))) in (
  'chris spending',
  'jen spending',
  'jennifer spending',
  'discretionary spending'
);

do $do$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid)
    into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public'
    and p.proname='close_budget_sinking_fund'
    and pg_get_function_identity_arguments(p.oid)='p_fund_id uuid, p_destination text, p_assigned_paycheck date';

  if v_def is not null
     and v_def not ilike '%Unsupported sinking fund closeout destination%' then
    v_def := replace(
      v_def,
      E'begin\n  perform pg_advisory_xact_lock',
      E'begin\n  if coalesce(p_destination, ''none'') not in (''none'',''buffer'',''next_fund'') then\n    raise exception ''Unsupported sinking fund closeout destination'';\n  end if;\n\n  perform pg_advisory_xact_lock'
    );
    execute v_def;
  end if;
end
$do$;

alter function public.close_budget_sinking_fund(uuid,text,date)
  set search_path to public;
revoke execute on function public.close_budget_sinking_fund(uuid,text,date) from public, anon;
grant execute on function public.close_budget_sinking_fund(uuid,text,date) to authenticated;

update public.budget_reference_tabs r
set rows = (
  select jsonb_agg(
    case
      when e.value->>0 = 'Living envelope / paycheck'
        then jsonb_build_array('Living envelope / paycheck','$1,600.00','Per paycheck','Groceries/household + normal vehicle fuel + $700 forgotten/unplanned buffer')
      when e.value->>0 = 'Forgotten/unplanned buffer'
        then jsonb_build_array('Forgotten/unplanned buffer','$700.00','Per paycheck','Flexible cushion for surprise, forgotten, or unplanned expenses')
      when e.value->>0 = 'Reserve basis – current essential monthly spend'
        then jsonb_build_array('Reserve basis – current essential monthly spend','$9,059.67','Calculated','Current reserve basis after the household spending-buffer change')
      when e.value->>0 = '1-month reserve target'
        then jsonb_build_array('1-month reserve target','$9,059.67','Target','First major cash-reserve milestone')
      when e.value->>0 = '3-month reserve target'
        then jsonb_build_array('3-month reserve target','$27,179.01','Target','Recalculate after debts are removed because baseline should fall')
      when e.value->>0 = '6-month reserve target'
        then jsonb_build_array('6-month reserve target','$54,358.02','Target','Recalculate after debts are removed because baseline should fall')
      when e.value->>0 = '12-month reserve target'
        then jsonb_build_array('12-month reserve target','$108,716.04','Target','Long-term reserve milestone before mortgage attack')
      else e.value
    end
    order by e.ordinality
  )
  from jsonb_array_elements(r.rows) with ordinality as e(value, ordinality)
)
where r.tab_name='Assumptions';

select public.recalculate_budget_paychecks();
