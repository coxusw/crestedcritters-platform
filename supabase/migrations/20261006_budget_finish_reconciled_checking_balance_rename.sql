do $$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid)
    into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'refresh_budget_rolling_horizon'
    and pg_get_function_identity_arguments(p.oid) = 'p_reference_date date';

  if v_def is null then
    raise exception 'refresh_budget_rolling_horizon(date) was not found';
  end if;

  v_def := replace(v_def, 'checking_before_paycheck', 'reconciled_checking_balance');
  execute v_def;
end $$;

alter table public.budget_paychecks
  drop column if exists checking_before_paycheck;

alter function public.refresh_budget_rolling_horizon(date)
  set search_path to public;
revoke execute on function public.refresh_budget_rolling_horizon(date)
  from public, anon;
grant execute on function public.refresh_budget_rolling_horizon(date)
  to authenticated;
