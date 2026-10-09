-- Protect the cumulative confirmed savings transfer while assigning
-- already-paid purchases to the correct planned subcategory.
-- Never reduce combined contributions below the amount actually transferred.
-- Preserve the original trip budget and offset the correct expense line.
-- A pre-vault purchase tied to a planned item first reduces that item's
-- remaining vault contribution. Unassigned purchases prefer an "other" line.
create or replace function public.refresh_budget_vault_prefund_offsets()
returns void language plpgsql set search_path to 'public' as $function$
declare
 v_fund record;
 v_row record;
 v_early numeric(14,2);
 v_unassigned numeric(14,2);
 v_linked numeric(14,2);
 v_base numeric(14,2);
 v_cycle_room numeric(14,2);
 v_cut numeric(14,2);
 v_extra numeric(14,2);
 v_last_paycheck date;
begin
 perform pg_advisory_xact_lock(hashtext('budget_vault_prefund_offsets'));
 for v_fund in select id from public.budget_future_expenses loop
   select coalesce(sum(a.amount),0)::numeric(14,2)
     into v_early from public.budget_actual_expenses a
    where a.future_expense_id=v_fund.id
      and a.paid_before_vault_funded = true;

   update public.budget_future_expenses f set pre_vault_spending = v_early
    where f.id=v_fund.id
      and abs(coalesce(f.pre_vault_spending,0)-v_early)>0.004;

   -- Always restore the original contribution before recalculating offsets.
   -- Running this again cannot repeatedly shrink the planned amounts.
   update public.budget_expenses e
      set planned_amount = greatest(0,coalesce(e.planned_amount,0)+coalesce(e.vault_prefund_offset,0)),
          vault_prefund_offset = 0, updated_at = now()
    where e.future_expense_id=v_fund.id
      and abs(coalesce(e.vault_prefund_offset,0)) > 0.004
      and coalesce(e.status,'') not in ('Cancelled','Deferred')
      and coalesce(e.forecast_suppressed,false)=false;

   select coalesce(sum(a.amount),0)::numeric(14,2)
     into v_unassigned from public.budget_actual_expenses a
    where a.future_expense_id=v_fund.id and a.paid_before_vault_funded=true
      and not exists (
         select 1 from public.budget_expenses e
         where e.id=a.planned_expense_id and e.future_expense_id=v_fund.id
           and coalesce(e.status,'') not in ('Cancelled','Deferred')
           and coalesce(e.forecast_suppressed,false)=false
      );

   v_last_paycheck := null;

   -- Phase 1: attribute named purchases to the selected planned line.
   -- Spend with no linked line is applied to an "other" line if available.
   for v_row in
     select e.id,e.assigned_paycheck,e.line_item,e.planned_amount
       from public.budget_expenses e
      where e.future_expense_id=v_fund.id
        and coalesce(e.status,'') not in ('Cancelled','Deferred')
        and coalesce(e.forecast_suppressed,false)=false
      order by e.assigned_paycheck nulls last,e.id
   loop
     if v_row.assigned_paycheck is distinct from v_last_paycheck then
       -- Protect the total already moved to this paycheck's vault, NOT a
       -- randomly chosen line item. Food spending may reduce food's planned
       -- transfer while confirmed vault money remains fully protected.
       select greatest(0,
           coalesce((select sum(e.planned_amount) from public.budget_expenses e
             where e.future_expense_id=v_fund.id
               and e.assigned_paycheck is not distinct from v_row.assigned_paycheck
               and coalesce(e.status,'') not in ('Cancelled','Deferred')
               and coalesce(e.forecast_suppressed,false)=false),0)
           -coalesce((select sum(t.amount) from public.budget_vault_transfers t
             where t.future_expense_id=v_fund.id
               and t.assigned_paycheck is not distinct from v_row.assigned_paycheck),0))
       into v_cycle_room;
       v_last_paycheck := v_row.assigned_paycheck;
     end if;
     v_base := greatest(0,coalesce(v_row.planned_amount,0));
     select coalesce(sum(a.amount),0)::numeric(14,2) into v_linked
       from public.budget_actual_expenses a
      where a.future_expense_id=v_fund.id and a.planned_expense_id=v_row.id
        and a.paid_before_vault_funded=true;
     v_cut := least(v_linked,v_base,v_cycle_room);
     v_cycle_room := greatest(0,v_cycle_room-v_cut);
     v_unassigned := v_unassigned + greatest(0,v_linked-v_cut);
     if coalesce(v_row.line_item,'') ~* '(food|other|misc)' then
       v_extra := least(v_unassigned,greatest(0,v_base-v_cut),v_cycle_room);
       v_cut := v_cut+v_extra;
       v_cycle_room := greatest(0,v_cycle_room-v_extra);
       v_unassigned := greatest(0,v_unassigned-v_extra);
     end if;
     if v_cut>0.004 then
       update public.budget_expenses
          set planned_amount=round(v_base-v_cut,2),
              vault_prefund_offset=round(v_cut,2),updated_at=now()
        where id=v_row.id;
     end if;
   end loop;

   -- Phase 2: only if there was no suitable linked/other line, carry the
   -- remainder into other contributions while protecting confirmed transfers.
   if v_unassigned>0.004 then
     v_last_paycheck := null;
     for v_row in
       select e.id,e.assigned_paycheck,e.planned_amount,e.vault_prefund_offset
         from public.budget_expenses e
        where e.future_expense_id=v_fund.id
          and coalesce(e.status,'') not in ('Cancelled','Deferred')
          and coalesce(e.forecast_suppressed,false)=false
        order by e.assigned_paycheck nulls last,e.id
     loop
       exit when v_unassigned<=0.004;
       if v_row.assigned_paycheck is distinct from v_last_paycheck then
         select greatest(0,
           coalesce((select sum(e.planned_amount) from public.budget_expenses e
             where e.future_expense_id=v_fund.id
               and e.assigned_paycheck is not distinct from v_row.assigned_paycheck
               and coalesce(e.status,'') not in ('Cancelled','Deferred')
               and coalesce(e.forecast_suppressed,false)=false),0)
           -coalesce((select sum(t.amount) from public.budget_vault_transfers t
             where t.future_expense_id=v_fund.id
               and t.assigned_paycheck is not distinct from v_row.assigned_paycheck),0))
         into v_cycle_room;
         v_last_paycheck := v_row.assigned_paycheck;
       end if;
       v_cut := least(v_unassigned,greatest(0,coalesce(v_row.planned_amount,0)),v_cycle_room);
       v_cycle_room := greatest(0,v_cycle_room-v_cut);
       if v_cut>0.004 then
         update public.budget_expenses
            set planned_amount=round(greatest(0,planned_amount-v_cut),2),
                vault_prefund_offset=round(coalesce(vault_prefund_offset,0)+v_cut,2),
                updated_at=now()
          where id=v_row.id;
         v_unassigned := greatest(0,v_unassigned-v_cut);
       end if;
     end loop;
   end if;
 end loop;
end;
$function$;
select public.refresh_budget_vault_prefund_offsets();
