alter table public.isopedia_submissions
  add column if not exists source_info text;

alter table public.isopedia_species
  add column if not exists source_info text;

comment on column public.isopedia_submissions.source_info
  is 'Optional footnotes, source links, citations, or observation notes submitted with a species.';

comment on column public.isopedia_species.source_info
  is 'Optional public footnotes, source links, citations, or observation notes for the species page.';

create or replace function public.sync_isopedia_submission_source_info(submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  submission_record record;
  target_species_id bigint;
begin
  select
    id,
    organism_type,
    genus,
    species,
    morph,
    common_name,
    scientific_name,
    image_url,
    source_info
  into submission_record
  from public.isopedia_submissions
  where id = submission_id;

  if not found or nullif(btrim(coalesce(submission_record.source_info, '')), '') is null then
    return;
  end if;

  select published.id
  into target_species_id
  from public.isopedia_species published
  where btrim(lower(coalesce(published.common_name, ''))) = btrim(lower(coalesce(submission_record.common_name, '')))
    and btrim(lower(coalesce(published.scientific_name, ''))) = btrim(lower(coalesce(submission_record.scientific_name, '')))
    and btrim(lower(coalesce(published.organism_type, ''))) = btrim(lower(coalesce(submission_record.organism_type, '')))
    and btrim(lower(coalesce(published.genus, ''))) = btrim(lower(coalesce(submission_record.genus, '')))
    and btrim(lower(coalesce(published.species, ''))) = btrim(lower(coalesce(submission_record.species, '')))
    and btrim(lower(coalesce(published.morph, ''))) = btrim(lower(coalesce(submission_record.morph, '')))
  order by published.created_at desc nulls last, published.id desc
  limit 1;

  if target_species_id is not null then
    update public.isopedia_species
    set
      source_info = submission_record.source_info,
      updated_at = now()
    where id = target_species_id;
  end if;
end;
$$;

create or replace function public.verify_isopedia_source_info_suggested_edit(edit_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  edit_record record;
begin
  select
    id,
    species_id,
    field_name,
    proposed_value,
    status
  into edit_record
  from public.isopedia_suggested_edits
  where id = edit_id;

  if not found then
    raise exception 'Suggested edit not found.';
  end if;

  if edit_record.status <> 'unverified' then
    raise exception 'Suggested edit has already been reviewed.';
  end if;

  if edit_record.field_name <> 'source_info' then
    raise exception 'Suggested edit is not a source info edit.';
  end if;

  update public.isopedia_species
  set
    source_info = nullif(btrim(coalesce(edit_record.proposed_value, '')), ''),
    updated_at = now()
  where id = edit_record.species_id;

  update public.isopedia_suggested_edits
  set
    status = 'verified',
    updated_at = now()
  where id = edit_record.id;
end;
$$;
