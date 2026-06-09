alter table public.isopedia_suggested_edits
  add column if not exists edit_reason text,
  add column if not exists source_info text;

comment on column public.isopedia_suggested_edits.edit_reason
  is 'Optional contributor explanation for why a suggested edit was submitted.';

comment on column public.isopedia_suggested_edits.source_info
  is 'Optional source, reference, link, or observation note for a suggested edit.';
