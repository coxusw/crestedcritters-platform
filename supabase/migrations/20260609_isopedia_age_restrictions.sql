alter table public.profiles
  add column if not exists birth_date date,
  add column if not exists birth_date_recorded_at timestamptz;

create index if not exists profiles_birth_date_idx
  on public.profiles(birth_date);

update public.isopedia_legal_documents
set legal_version = '2026-06-09-age-restrictions',
    updated_at = now()
where document_key in (
  'terms',
  'privacy',
  'community-guidelines',
  'user-generated-content'
);

update public.isopedia_legal_documents
set body = body || ' Users must provide an accurate birth date for age-based account settings. Users under the age of 13 may use Isopedia with restrictions, including disabled discussion posting, until their account birth date shows they are at least 13.'
where document_key = 'terms'
  and body not like '%Users must provide an accurate birth date%';

update public.isopedia_legal_documents
set body = body || ' Isopedia collects and stores birth date information internally to determine whether age-based account restrictions apply. Birth dates are not displayed on public profiles.'
where document_key = 'privacy'
  and body not like '%Birth dates are not displayed on public profiles%';

update public.isopedia_legal_documents
set body = body || ' Users under the age of 13 have discussion posting disabled. These restrictions are based on the birth date stored on the account and automatically stop applying when the account reaches age 13.'
where document_key = 'community-guidelines'
  and body not like '%Users under the age of 13 have discussion posting disabled%';

update public.isopedia_legal_documents
set body = body || ' Age-based restrictions may limit some types of user-submitted content. Users under 13 cannot submit discussion posts while the restriction applies, although other permitted contribution features may remain available unless Isopedia adds additional limits for safety, moderation, legal compliance, or site operation.'
where document_key = 'user-generated-content'
  and body not like '%Users under 13 cannot submit discussion posts%';
