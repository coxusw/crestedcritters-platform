-- Each spending entry may assign its incremental overage to this paycheck's
-- forgotten/unplanned buffer, rather than to the unassigned paycheck surplus.
-- This is virtual coverage: actual spending remains exactly one transaction.
alter table public.budget_actual_expenses
  add column if not exists overage_source text,
  add column if not exists buffer_coverage_amount numeric(12,2) not null default 0;

alter table public.budget_actual_expenses
  add constraint budget_actual_overage_source_check
    check (overage_source is null or overage_source in ('buffer', 'carryover')),
  add constraint budget_actual_buffer_coverage_check
    check (buffer_coverage_amount >= 0
      and buffer_coverage_amount <= amount
      and (buffer_coverage_amount = 0 or overage_source = 'buffer'));

comment on column public.budget_actual_expenses.overage_source is
  'User-selected budget source for incremental spending over plan. This does not create an additional cash transaction.';
comment on column public.budget_actual_expenses.buffer_coverage_amount is
  'Portion of an existing expense overage assigned to this paycheck forgotten/unplanned buffer (virtual budget consumption, not an additional expense).';