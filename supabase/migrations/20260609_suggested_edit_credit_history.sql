create extension if not exists pgcrypto;

create table if not exists public.isotoken_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  reason text not null,
  reason_key text not null unique,
  description text not null,
  entity_type text,
  entity_id text,
  created_at timestamptz not null default now()
);

create index if not exists isotoken_ledger_profile_created_idx
  on public.isotoken_ledger(profile_id, created_at desc);

create index if not exists isotoken_ledger_reason_idx
  on public.isotoken_ledger(reason);

alter table public.isotoken_ledger enable row level security;

drop policy if exists "Users can read own IsoToken ledger" on public.isotoken_ledger;
create policy "Users can read own IsoToken ledger"
  on public.isotoken_ledger
  for select
  using (
    auth.uid() = profile_id
    or public.is_current_user_isopedia_admin()
  );

drop policy if exists "Service role can manage IsoToken ledger" on public.isotoken_ledger;
create policy "Service role can manage IsoToken ledger"
  on public.isotoken_ledger
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function public.award_isotokens(
  target_profile_id uuid,
  token_amount integer,
  award_reason text,
  award_reason_key text,
  award_description text,
  award_entity_type text default null,
  award_entity_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_profile_id is null or token_amount = 0 or award_reason_key is null or award_reason_key = '' then
    return;
  end if;

  insert into public.isotoken_ledger (
    profile_id,
    amount,
    reason,
    reason_key,
    description,
    entity_type,
    entity_id
  )
  values (
    target_profile_id,
    token_amount,
    award_reason,
    award_reason_key,
    award_description,
    award_entity_type,
    award_entity_id
  )
  on conflict (reason_key) do nothing;
end;
$$;

update public.isopedia_legal_documents
set legal_version = '2026-06-08-content-license-v2',
    updated_at = now()
where document_key in (
  'terms',
  'privacy',
  'community-guidelines',
  'user-generated-content'
);

create or replace function public.award_isotokens_suggested_edit_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.award_isotokens(
    new.suggested_by,
    3,
    'suggested_edit_submission',
    'suggested_edit_submission:' || new.id::text,
    'Submitted a suggested edit for review.',
    'suggested_edit',
    new.id::text
  );

  return new;
end;
$$;

drop trigger if exists isotokens_suggested_edit_insert on public.isopedia_suggested_edits;
create trigger isotokens_suggested_edit_insert
  after insert on public.isopedia_suggested_edits
  for each row
  execute function public.award_isotokens_suggested_edit_insert();

create or replace function public.award_isotokens_suggested_edit_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'verified' and new.suggested_by is not null then
    perform public.award_isotokens(
      new.suggested_by,
      2,
      'suggested_edit_verified',
      'suggested_edit_verified:' || new.id::text,
      'Suggested edit was verified and applied.',
      'suggested_edit',
      new.id::text
    );
  end if;

  if new.status = 'verified' and new.verified_by is not null and new.verified_by <> new.suggested_by then
    perform public.award_isotokens(
      new.verified_by,
      5,
      'suggested_edit_verifier',
      'suggested_edit_verified_reviewer:' || new.id::text,
      'Verified a community suggested edit.',
      'suggested_edit',
      new.id::text
    );
  end if;

  return new;
end;
$$;

drop trigger if exists isotokens_suggested_edit_verified_update on public.isopedia_suggested_edits;
create trigger isotokens_suggested_edit_verified_update
  after update of status, verified_by on public.isopedia_suggested_edits
  for each row
  when (
    new.status = 'verified'
    and (
      old.status is distinct from new.status
      or old.verified_by is distinct from new.verified_by
    )
  )
  execute function public.award_isotokens_suggested_edit_verified();

do $$
declare
  row_record record;
begin
  for row_record in
    select id, suggested_by, status, verified_by
    from public.isopedia_suggested_edits
  loop
    perform public.award_isotokens(
      row_record.suggested_by,
      3,
      'suggested_edit_submission',
      'suggested_edit_submission:' || row_record.id::text,
      'Submitted a suggested edit for review.',
      'suggested_edit',
      row_record.id::text
    );

    if row_record.status = 'verified' then
      perform public.award_isotokens(
        row_record.suggested_by,
        2,
        'suggested_edit_verified',
        'suggested_edit_verified:' || row_record.id::text,
        'Suggested edit was verified and applied.',
        'suggested_edit',
        row_record.id::text
      );

      if row_record.verified_by is not null and row_record.verified_by <> row_record.suggested_by then
        perform public.award_isotokens(
          row_record.verified_by,
          5,
          'suggested_edit_verifier',
          'suggested_edit_verified_reviewer:' || row_record.id::text,
          'Verified a community suggested edit.',
          'suggested_edit',
          row_record.id::text
        );
      end if;
    end if;
  end loop;
end $$;
