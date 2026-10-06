-- Restore the two Oct 8 obligations that are intentionally paid from the Oct 9
-- paycheck. They predate the first generated paycheck window, so there is no
-- generated occurrence replacing them.
update public.budget_expenses
set status = 'Planned',
    notes = replace(
      notes,
      ' Superseded by the canonical recurring schedule to prevent duplicate forecast rows.',
      ''
    ),
    updated_at = now()
where id in (
  'c7f73d9c-99f4-4002-b97e-530a03c83cca',
  '1d485160-8593-4741-a67d-d38a8a061b0f'
);

-- The generated Soccer.com final installment is canonical.
update public.budget_expenses
set status = 'Cancelled',
    notes = concat_ws(' ', notes, 'Duplicate of the finite generated Soccer.com Affirm installment.'),
    updated_at = now()
where line_item = 'Soccer.com Affirm final'
  and due_date = date '2026-11-30'
  and coalesce(status,'') = 'Planned';

-- Old "reserve" rows for XbotGo are the same monthly installment already
-- generated from the finite debt schedule.
update public.budget_expenses
set status = 'Cancelled',
    notes = concat_ws(' ', notes, 'Duplicate reserve row; the finite XbotGo debt schedule is canonical.'),
    updated_at = now()
where line_item ilike 'Reserve XbotGo for%'
  and coalesce(status,'') = 'Planned';

-- Preserve the manually staged van catch-up through January, then let the
-- canonical recurring loan schedule take over beginning with February 2027.
update public.budget_recurring_bills
set generation_anchor_date = date '2027-02-11',
    updated_at = now()
where item = 'Pacifica payment'
  and generation_enabled = true;

update public.budget_expenses
set status = 'Cancelled',
    notes = concat_ws(' ', notes, 'Paused while the manual Pacifica catch-up schedule is in effect through January 2027.'),
    updated_at = now()
where generated_recurring_id = '3d836aa9-e6aa-47c0-ac97-99ce1d296c3e'
  and generated_occurrence_date < date '2027-02-11'
  and coalesce(status,'') = 'Planned';

update public.budget_expenses
set status = 'Cancelled',
    notes = concat_ws(' ', notes, 'Duplicate reserve row; the canonical Pacifica payment schedule takes over in February 2027.'),
    updated_at = now()
where line_item ilike 'Reserve % Pacifica'
  and coalesce(status,'') = 'Planned';

select public.refresh_budget_rolling_horizon(date '2026-10-06');
