-- A spend entered against a sinking fund (rather than its individual line)
-- should match the line when exactly one eligible item exists in the same
-- paycheck cycle. Leave multi-line funds unassigned rather than guessing.
CREATE OR REPLACE FUNCTION public.enrich_budget_actual_expense_links()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_future uuid;
  v_debt uuid;
  v_only_plan uuid;
BEGIN
  IF NEW.planned_expense_id IS NULL
     AND NEW.future_expense_id IS NOT NULL
     AND NEW.assigned_paycheck IS NOT NULL THEN
    SELECT CASE WHEN count(*) = 1 THEN min(e.id) ELSE NULL END
      INTO v_only_plan
      FROM public.budget_expenses e
     WHERE e.future_expense_id = NEW.future_expense_id
       AND e.assigned_paycheck = NEW.assigned_paycheck
       AND coalesce(e.status, '') NOT IN ('Cancelled', 'Deferred')
       AND coalesce(e.forecast_suppressed, false) = false
       AND lower(coalesce(e.expense_type, '')) <> 'sinking fund';

    IF v_only_plan IS NOT NULL THEN
      NEW.planned_expense_id := v_only_plan;
    END IF;
  END IF;

  IF NEW.planned_expense_id IS NOT NULL THEN
    SELECT e.future_expense_id, rb.linked_debt_id
      INTO v_future, v_debt
      FROM public.budget_expenses e
      LEFT JOIN public.budget_recurring_bills rb
        ON rb.id = e.generated_recurring_id
     WHERE e.id = NEW.planned_expense_id;

    IF NEW.future_expense_id IS NULL THEN
      NEW.future_expense_id := v_future;
    END IF;
    IF NEW.debt_id IS NULL THEN
      NEW.debt_id := v_debt;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;