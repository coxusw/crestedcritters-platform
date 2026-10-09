-- Pre-funded spending counts toward an event, without draining a vault
-- that has not yet received its savings transfer.
alter table public.budget_actual_expenses
  add column if not exists paid_before_vault_funded boolean not null default false;
alter table public.budget_expenses
  add column if not exists vault_prefund_offset numeric(12,2) not null default 0;
alter table public.budget_future_expenses
  add column if not exists pre_vault_spending numeric(12,2) not null default 0;

-- Backfill only expenses that happened before their vault's first funding.
-- No purchase history or confirmed transfer is removed or changed.
update public.budget_actual_expenses a
set paid_before_vault_funded = true
where a.future_expense_id is not null
  and not exists (
    select 1 from public.budget_vault_transfers t
    where t.future_expense_id = a.future_expense_id
      and (t.transferred_on < a.spent_date
        or (t.transferred_on = a.spent_date and t.created_at <= a.created_at))
  );

create or replace function public.budget_identify_prefund_purchase()
returns trigger language plpgsql set search_path to 'public' as $fn$
begin
  if tg_op = 'INSERT'
     or new.future_expense_id is distinct from old.future_expense_id
     or new.spent_date is distinct from old.spent_date then
    if new.future_expense_id is null then
      new.paid_before_vault_funded := false;
    else
      new.paid_before_vault_funded := not exists (
        select 1 from public.budget_vault_transfers t
        where t.future_expense_id = new.future_expense_id
          and (t.transferred_on < new.spent_date
            or (t.transferred_on = new.spent_date and t.created_at <= now()))
      );
    end if;
  end if;
  return new;
end;
$fn$;

drop trigger if exists zz_budget_identify_prefund_purchase
  on public.budget_actual_expenses;
create trigger zz_budget_identify_prefund_purchase
before insert or update of spent_date, future_expense_id
on public.budget_actual_expenses for each row
execute function public.budget_identify_prefund_purchase();

-- Recomputes deductions from the original scheduled amounts each time.
-- A previously applied offset is restored before calculating the new one.
-- Never reduce a line below its already-confirmed bank-vault transfers.
create or replace function public.refresh_budget_vault_prefund_offsets()
returns void language plpgsql set search_path to 'public' as $fn$
declare
  v_fund record;
  v_row record;
  v_early_remaining numeric(14,2);
  v_base numeric(14,2);
  v_protected numeric(14,2);
  v_cut numeric(14,2);
  v_transfers_on_date numeric(14,2);
  v_last_paycheck date;
begin
  perform pg_advisory_xact_lock(hashtext('budget_vault_prefund_offsets'));
  for v_fund in select id from public.budget_future_expenses loop
    select coalesce(sum(a.amount),0)::numeric(14,2)
      into v_early_remaining
      from public.budget_actual_expenses a
      where a.future_expense_id = v_fund.id
        and a.paid_before_vault_funded = true;

    update public.budget_future_expenses f
      set pre_vault_spending = v_early_remaining
      where f.id = v_fund.id
        and abs(coalesce(f.pre_vault_spending,0)-v_early_remaining)>0.004;

    v_last_paycheck := null;
    v_transfers_on_date := 0;

    for v_row in
      select e.id, e.assigned_paycheck, e.planned_amount,
             e.vault_prefund_offset
      from public.budget_expenses e
      where e.future_expense_id = v_fund.id
        and coalesce(e.status,'') not in ('Cancelled','Deferred')
        and coalesce(e.forecast_suppressed,false) = false
      order by e.assigned_paycheck nulls last, e.id
    loop
      if v_row.assigned_paycheck is distinct from v_last_paycheck then
        select coalesce(sum(t.amount),0)::numeric(14,2)
          into v_transfers_on_date
          from public.budget_vault_transfers t
          where t.future_expense_id = v_fund.id
            and t.assigned_paycheck = v_row.assigned_paycheck;
        v_last_paycheck := v_row.assigned_paycheck;
      end if;

      v_base := greatest(0,coalesce(v_row.planned_amount,0)
                           +coalesce(v_row.vault_prefund_offset,0));
      v_protected := least(v_base,v_transfers_on_date);
      v_transfers_on_date := greatest(0,v_transfers_on_date-v_protected);
      v_cut := least(v_early_remaining,greatest(0,v_base-v_protected));
      v_early_remaining := greatest(0,v_early_remaining-v_cut);

      if abs(coalesce(v_row.planned_amount,0)-(v_base-v_cut))>0.004
         or abs(coalesce(v_row.vault_prefund_offset,0)-v_cut)>0.004 then
        update public.budget_expenses
        set planned_amount = round(v_base-v_cut,2),
            vault_prefund_offset = round(v_cut,2),
            updated_at = now()
        where id = v_row.id;
      end if;
    end loop;
  end loop;
end;
$fn$;

revoke execute on function public.refresh_budget_vault_prefund_offsets()
from public,anon;
grant execute on function public.refresh_budget_vault_prefund_offsets()
to authenticated;

-- An emergency-fund balance must reflect only real vault withdrawals.
create or replace function public.budget_emergency_fund_available(p_fund_id uuid)
returns numeric language sql stable set search_path to 'public' as $fn$
  select (
    coalesce((select sum(t.amount)
      from public.budget_vault_transfers t
      where t.future_expense_id=p_fund_id),0)
    +coalesce((select sum(coalesce(src.closeout_amount,0))
      from public.budget_future_expenses src
      where src.closeout_destination_fund_id=p_fund_id
        and src.closeout_destination='next_fund'
        and lower(coalesce(src.status,'')) in ('closed','removed')),0)
    -coalesce((select sum(a.amount)
      from public.budget_actual_expenses a
      where a.future_expense_id=p_fund_id
        and a.paid_before_vault_funded=false),0)
  )::numeric(12,2);
$fn$;

-- Closing a fund only moves what actually remains in its bank vault.
do $do$
declare d text;
begin
 select pg_get_functiondef('public.close_budget_sinking_fund(uuid,text,date)'::regprocedure)
 into d;
 if position('where a.future_expense_id = p_fund_id;' in d)=0 then
   raise exception 'Unexpected closeout code: migration stopped safely';
 end if;
 d := replace(d,
   'where a.future_expense_id = p_fund_id;',
   'where a.future_expense_id = p_fund_id and coalesce(a.paid_before_vault_funded,false)=false;');
 execute d || ';';
end;
$do$;

select public.refresh_budget_vault_prefund_offsets();
