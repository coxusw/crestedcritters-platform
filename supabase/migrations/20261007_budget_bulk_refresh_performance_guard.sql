-- Prevent budget bulk-generation jobs from repeatedly running expensive
-- statement-level recalculation triggers for each INSERT/UPDATE/DELETE.
-- The public RPC wrappers enable a transaction-local guard while the
-- implementation functions perform their batch work, then the implementations
-- perform their normal final recalculations once.

create or replace function public.refresh_budget_future_buckets_trigger()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if coalesce(current_setting('app.budget_bulk_refresh', true), '') = 'on' then
    return null;
  end if;

  perform public.recalculate_budget_future_buckets();
  return null;
end;
$function$;

create or replace function public.refresh_budget_paycheck_totals_trigger()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if coalesce(current_setting('app.budget_bulk_refresh', true), '') = 'on' then
    return null;
  end if;

  perform public.recalculate_budget_paychecks();
  return null;
end;
$function$;

alter function public.refresh_budget_rolling_horizon(date)
  rename to refresh_budget_rolling_horizon_impl;

create function public.refresh_budget_rolling_horizon(
  p_reference_date date default current_date
)
returns void
language plpgsql
set search_path = public
as $function$
declare
  v_previous text := coalesce(current_setting('app.budget_bulk_refresh', true), '');
begin
  perform set_config('app.budget_bulk_refresh', 'on', true);
  perform public.refresh_budget_rolling_horizon_impl(p_reference_date);
  perform set_config('app.budget_bulk_refresh', v_previous, true);
exception when others then
  perform set_config('app.budget_bulk_refresh', v_previous, true);
  raise;
end;
$function$;

alter function public.refresh_budget_forecast_surplus_allocations(date)
  rename to refresh_budget_forecast_surplus_allocations_impl;

create function public.refresh_budget_forecast_surplus_allocations(
  p_reference_date date default current_date
)
returns void
language plpgsql
set search_path = public
as $function$
declare
  v_previous text := coalesce(current_setting('app.budget_bulk_refresh', true), '');
begin
  perform set_config('app.budget_bulk_refresh', 'on', true);
  perform public.refresh_budget_forecast_surplus_allocations_impl(p_reference_date);
  perform set_config('app.budget_bulk_refresh', v_previous, true);
exception when others then
  perform set_config('app.budget_bulk_refresh', v_previous, true);
  raise;
end;
$function$;

alter function public.refresh_budget_debt_schedule(uuid, date)
  rename to refresh_budget_debt_schedule_impl;

create function public.refresh_budget_debt_schedule(
  p_debt_id uuid,
  p_reference_date date default current_date
)
returns void
language plpgsql
set search_path = public
as $function$
declare
  v_previous text := coalesce(current_setting('app.budget_bulk_refresh', true), '');
begin
  perform set_config('app.budget_bulk_refresh', 'on', true);
  perform public.refresh_budget_debt_schedule_impl(p_debt_id, p_reference_date);
  perform set_config('app.budget_bulk_refresh', v_previous, true);
exception when others then
  perform set_config('app.budget_bulk_refresh', v_previous, true);
  raise;
end;
$function$;

grant execute on function public.refresh_budget_rolling_horizon(date) to authenticated;
grant execute on function public.refresh_budget_forecast_surplus_allocations(date) to authenticated;
grant execute on function public.refresh_budget_debt_schedule(uuid, date) to authenticated;

create index if not exists budget_expenses_assigned_paycheck_idx
  on public.budget_expenses(assigned_paycheck);

create index if not exists budget_expenses_due_date_idx
  on public.budget_expenses(due_date);

create index if not exists budget_paychecks_rolling_date_idx
  on public.budget_paychecks(paycheck_date)
  where rolling_generated = true;

notify pgrst, 'reload schema';
