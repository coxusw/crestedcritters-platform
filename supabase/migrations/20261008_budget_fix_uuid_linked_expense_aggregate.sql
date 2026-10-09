-- PostgreSQL has no min(uuid). The candidate count is one so any
-- aggregate element is the same UUID; keep linking behavior unchanged.
do $block$
declare d text;
begin
  select pg_get_functiondef('public.enrich_budget_actual_expense_links()'::regprocedure) into d;
  if position('min(e.id)' in d) = 0 then
    raise exception 'Expected spending-link function code not found';
  end if;
  d := replace(d,'min(e.id)','(array_agg(e.id))[1]');
  execute d || ';';
end;
$block$;