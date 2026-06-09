create table if not exists public.isopedia_legal_acceptances (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  legal_version text not null,
  content_license_acknowledged boolean not null default false,
  acknowledgment_text text not null,
  accepted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.isopedia_legal_acceptances enable row level security;

drop policy if exists "Users can read own legal acceptance" on public.isopedia_legal_acceptances;
create policy "Users can read own legal acceptance"
  on public.isopedia_legal_acceptances for select
  using (auth.uid() = profile_id or public.is_current_user_isopedia_admin());

drop policy if exists "Users can accept current legal documents" on public.isopedia_legal_acceptances;
create policy "Users can accept current legal documents"
  on public.isopedia_legal_acceptances for insert
  with check (auth.uid() = profile_id);

drop policy if exists "Users can update own legal acceptance" on public.isopedia_legal_acceptances;
create policy "Users can update own legal acceptance"
  on public.isopedia_legal_acceptances for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "Service role can manage legal acceptances" on public.isopedia_legal_acceptances;
create policy "Service role can manage legal acceptances"
  on public.isopedia_legal_acceptances for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists public.isopedia_legal_documents (
  document_key text primary key,
  title text not null,
  legal_version text not null,
  body text not null,
  updated_at timestamptz not null default now()
);

alter table public.isopedia_legal_documents enable row level security;

drop policy if exists "Public can read Isopedia legal documents" on public.isopedia_legal_documents;
create policy "Public can read Isopedia legal documents"
  on public.isopedia_legal_documents for select
  using (true);

drop policy if exists "Service role can manage Isopedia legal documents" on public.isopedia_legal_documents;
create policy "Service role can manage Isopedia legal documents"
  on public.isopedia_legal_documents for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

insert into public.isopedia_legal_documents (document_key, title, legal_version, body, updated_at)
values
  (
    'terms',
    'Terms of Service',
    '2026-06-08-content-license',
    'Any user-submitted content, including but not limited to guides, articles, species information, suggested edits, discussions, comments, collection data, expo submissions, profile content, usernames, display names, images, photographs, and uploaded media, may be used by Isopedia and Crested Critters LLC to operate, maintain, improve, advertise, promote, document, and grow Isopedia. Users retain ownership of submitted content. By submitting content, users grant Crested Critters LLC and Isopedia a perpetual, worldwide, non-exclusive, transferable, sublicensable, royalty-free license to use, host, store, reproduce, modify, adapt, publish, translate, distribute, publicly display, publicly perform, archive, create excerpts, create thumbnails, create screenshots, create promotional graphics, and create derivative works from that content. This license allows Isopedia and Crested Critters LLC to display submitted content on Isopedia; feature submitted content on homepages, landing pages, profiles, guides, species pages, collection pages, newsletters, emails, and promotional materials; share submitted content on social media; use submitted content in ads and marketing campaigns; use screenshots, previews, excerpts, thumbnails, and images for promotion; resize, crop, compress, reformat, or otherwise modify content for technical, display, moderation, or promotional purposes; preserve content in backups, archives, search results, historical records, and community resources; and continue displaying or using submitted content after account deactivation, account deletion, username changes, transfer of ownership, merger, acquisition, or sale of Isopedia-related assets.',
    now()
  ),
  (
    'privacy',
    'Privacy Policy',
    '2026-06-08-content-license',
    'Isopedia uses account information, profile information, submitted content, site activity, email addresses, and technical information to operate accounts, profiles, submissions, notifications, moderation, analytics, and community features. Public profile details and submitted public content may be visible to visitors, indexed by search engines, shared in promotional materials, or preserved as part of community records as described in the User Generated Content Policy.',
    now()
  ),
  (
    'community-guidelines',
    'Community Guidelines',
    '2026-06-08-content-license',
    'Submit information, images, edits, discussions, and reviews with the normal intent of helping the Isopedia community. Do not spam, harass, impersonate others, manipulate IsoTokens, submit knowingly false information, upload content you do not have permission to use, or use the site in a way that harms other users or the project. Abuse of contribution rewards, verification systems, raffles, or account features may result in removal of IsoTokens, removal of content, loss of access, or an account ban.',
    now()
  ),
  (
    'user-generated-content',
    'User Generated Content Policy',
    '2026-06-08-content-license',
    'User-submitted content includes guides, articles, species information, suggested edits, discussions, comments, collection data, expo submissions, profile content, usernames, display names, images, photographs, uploaded media, and any other material submitted to Isopedia. Any user-submitted content may be used by Isopedia and Crested Critters LLC to operate, maintain, improve, advertise, promote, document, and grow Isopedia. Users retain ownership of submitted content. By submitting content, users grant Crested Critters LLC and Isopedia a perpetual, worldwide, non-exclusive, transferable, sublicensable, royalty-free license to use, host, store, reproduce, modify, adapt, publish, translate, distribute, publicly display, publicly perform, archive, create excerpts, create thumbnails, create screenshots, create promotional graphics, and create derivative works from that content. This license includes continued display or use after account deactivation, account deletion, username changes, transfer of ownership, merger, acquisition, or sale of Isopedia-related assets.',
    now()
  )
on conflict (document_key) do update
set title = excluded.title,
    legal_version = excluded.legal_version,
    body = excluded.body,
    updated_at = excluded.updated_at;

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
  for row_record in select id, suggested_by, status, verified_by from public.isopedia_suggested_edits loop
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
