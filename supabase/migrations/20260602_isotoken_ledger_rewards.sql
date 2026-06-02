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

create or replace function public.award_isotokens_species_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.award_isotokens(
    new.submitted_by,
    10,
    'species_submission',
    'species_submission:' || new.id::text,
    'Submitted a new species for review.',
    'species_submission',
    new.id::text
  );
  return new;
end;
$$;

drop trigger if exists isotokens_species_submission_insert on public.isopedia_submissions;
create trigger isotokens_species_submission_insert
  after insert on public.isopedia_submissions
  for each row
  execute function public.award_isotokens_species_submission();

create or replace function public.award_isotokens_species_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'verified' and new.submitted_by is not null then
    perform public.award_isotokens(
      new.submitted_by,
      15,
      'species_verified',
      'species_verified_submitter:' || new.id::text,
      'Submitted species was verified and published.',
      'species_submission',
      new.id::text
    );
  end if;

  if new.status = 'verified' and new.verified_by is not null and new.verified_by <> new.submitted_by then
    perform public.award_isotokens(
      new.verified_by,
      5,
      'species_verifier',
      'species_verified_reviewer:' || new.id::text,
      'Verified a community species submission.',
      'species_submission',
      new.id::text
    );
  end if;

  return new;
end;
$$;

drop trigger if exists isotokens_species_verified_update on public.isopedia_submissions;
create trigger isotokens_species_verified_update
  after update of status, verified_by on public.isopedia_submissions
  for each row
  when (
    new.status = 'verified'
    and (
      old.status is distinct from new.status
      or old.verified_by is distinct from new.verified_by
    )
  )
  execute function public.award_isotokens_species_verified();

create or replace function public.award_isotokens_gallery_image_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.award_isotokens(
    new.credit_user_id,
    2,
    'gallery_photo_submission',
    'gallery_photo_submission:' || new.id::text,
    'Submitted a species gallery photo.',
    'species_image',
    new.id::text
  );
  return new;
end;
$$;

drop trigger if exists isotokens_gallery_image_insert on public.isopedia_species_images;
create trigger isotokens_gallery_image_insert
  after insert on public.isopedia_species_images
  for each row
  execute function public.award_isotokens_gallery_image_insert();

create or replace function public.award_isotokens_gallery_image_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.award_isotokens(
    new.credit_user_id,
    3,
    'gallery_photo_verified',
    'gallery_photo_verified:' || new.id::text,
    'Submitted gallery photo was verified.',
    'species_image',
    new.id::text
  );
  return new;
end;
$$;

drop trigger if exists isotokens_gallery_image_verified_update on public.isopedia_species_images;
create trigger isotokens_gallery_image_verified_update
  after update of status on public.isopedia_species_images
  for each row
  when (new.status = 'verified' and old.status is distinct from new.status)
  execute function public.award_isotokens_gallery_image_verified();

create or replace function public.award_isotokens_guide_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.award_isotokens(
    new.author_user_id,
    5,
    'guide_submission',
    'guide_submission:' || new.id::text,
    'Published a community guide.',
    'guide',
    new.id::text
  );
  return new;
end;
$$;

drop trigger if exists isotokens_guide_insert on public.isopedia_guides;
create trigger isotokens_guide_insert
  after insert on public.isopedia_guides
  for each row
  when (new.status = 'published')
  execute function public.award_isotokens_guide_insert();

create or replace function public.award_isotokens_guide_like_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  guide_author uuid;
begin
  select author_user_id into guide_author
  from public.isopedia_guides
  where id = new.guide_id;

  if guide_author is not null and guide_author <> new.user_id then
    perform public.award_isotokens(
      guide_author,
      1,
      'guide_like_received',
      'guide_like_received:' || new.id::text,
      'Guide received a like.',
      'guide',
      new.guide_id::text
    );
  end if;

  return new;
end;
$$;

drop trigger if exists isotokens_guide_like_insert on public.isopedia_guide_likes;
create trigger isotokens_guide_like_insert
  after insert on public.isopedia_guide_likes
  for each row
  execute function public.award_isotokens_guide_like_insert();

create or replace function public.award_isotokens_guide_like_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  guide_author uuid;
begin
  select author_user_id into guide_author
  from public.isopedia_guides
  where id = old.guide_id;

  if guide_author is not null and guide_author <> old.user_id then
    perform public.award_isotokens(
      guide_author,
      -1,
      'guide_like_removed',
      'guide_like_removed:' || old.id::text,
      'Guide like was removed.',
      'guide',
      old.guide_id::text
    );
  end if;

  return old;
end;
$$;

drop trigger if exists isotokens_guide_like_delete on public.isopedia_guide_likes;
create trigger isotokens_guide_like_delete
  after delete on public.isopedia_guide_likes
  for each row
  execute function public.award_isotokens_guide_like_delete();

create or replace function public.award_isotokens_discussion_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.award_isotokens(
    new.user_id,
    1,
    'discussion_post',
    'discussion_post:' || new.id::text,
    'Posted in an Isopedia discussion.',
    'discussion',
    new.id::text
  );
  return new;
end;
$$;

drop trigger if exists isotokens_discussion_insert on public.isopedia_discussions;
create trigger isotokens_discussion_insert
  after insert on public.isopedia_discussions
  for each row
  when (new.status = 'active')
  execute function public.award_isotokens_discussion_insert();

create or replace function public.award_isotokens_discussion_like_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  comment_author uuid;
begin
  select user_id into comment_author
  from public.isopedia_discussions
  where id = new.comment_id;

  if comment_author is not null and comment_author <> new.user_id then
    perform public.award_isotokens(
      comment_author,
      1,
      'discussion_like_received',
      'discussion_like_received:' || new.id::text,
      'Discussion post received a like.',
      'discussion',
      new.comment_id::text
    );
  end if;

  return new;
end;
$$;

drop trigger if exists isotokens_discussion_like_insert on public.isopedia_discussion_likes;
create trigger isotokens_discussion_like_insert
  after insert on public.isopedia_discussion_likes
  for each row
  execute function public.award_isotokens_discussion_like_insert();

create or replace function public.award_isotokens_discussion_like_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  comment_author uuid;
begin
  select user_id into comment_author
  from public.isopedia_discussions
  where id = old.comment_id;

  if comment_author is not null and comment_author <> old.user_id then
    perform public.award_isotokens(
      comment_author,
      -1,
      'discussion_like_removed',
      'discussion_like_removed:' || old.id::text,
      'Discussion like was removed.',
      'discussion',
      old.comment_id::text
    );
  end if;

  return old;
end;
$$;

drop trigger if exists isotokens_discussion_like_delete on public.isopedia_discussion_likes;
create trigger isotokens_discussion_like_delete
  after delete on public.isopedia_discussion_likes
  for each row
  execute function public.award_isotokens_discussion_like_delete();

do $$
declare
  row_record record;
begin
  for row_record in select id, submitted_by, status, verified_by from public.isopedia_submissions loop
    perform public.award_isotokens(
      row_record.submitted_by,
      10,
      'species_submission',
      'species_submission:' || row_record.id::text,
      'Submitted a new species for review.',
      'species_submission',
      row_record.id::text
    );

    if row_record.status = 'verified' then
      perform public.award_isotokens(
        row_record.submitted_by,
        15,
        'species_verified',
        'species_verified_submitter:' || row_record.id::text,
        'Submitted species was verified and published.',
        'species_submission',
        row_record.id::text
      );

      if row_record.verified_by is not null and row_record.verified_by <> row_record.submitted_by then
        perform public.award_isotokens(
          row_record.verified_by,
          5,
          'species_verifier',
          'species_verified_reviewer:' || row_record.id::text,
          'Verified a community species submission.',
          'species_submission',
          row_record.id::text
        );
      end if;
    end if;
  end loop;

  for row_record in select id, credit_user_id, status from public.isopedia_species_images loop
    perform public.award_isotokens(
      row_record.credit_user_id,
      2,
      'gallery_photo_submission',
      'gallery_photo_submission:' || row_record.id::text,
      'Submitted a species gallery photo.',
      'species_image',
      row_record.id::text
    );

    if row_record.status = 'verified' then
      perform public.award_isotokens(
        row_record.credit_user_id,
        3,
        'gallery_photo_verified',
        'gallery_photo_verified:' || row_record.id::text,
        'Submitted gallery photo was verified.',
        'species_image',
        row_record.id::text
      );
    end if;
  end loop;

  for row_record in select id, author_user_id, status from public.isopedia_guides loop
    if row_record.status = 'published' then
      perform public.award_isotokens(
        row_record.author_user_id,
        5,
        'guide_submission',
        'guide_submission:' || row_record.id::text,
        'Published a community guide.',
        'guide',
        row_record.id::text
      );
    end if;
  end loop;

  for row_record in
    select l.id, l.user_id, l.guide_id, g.author_user_id
    from public.isopedia_guide_likes l
    join public.isopedia_guides g on g.id = l.guide_id
  loop
    if row_record.author_user_id <> row_record.user_id then
      perform public.award_isotokens(
        row_record.author_user_id,
        1,
        'guide_like_received',
        'guide_like_received:' || row_record.id::text,
        'Guide received a like.',
        'guide',
        row_record.guide_id::text
      );
    end if;
  end loop;

  for row_record in select id, user_id, status from public.isopedia_discussions loop
    if row_record.status = 'active' then
      perform public.award_isotokens(
        row_record.user_id,
        1,
        'discussion_post',
        'discussion_post:' || row_record.id::text,
        'Posted in an Isopedia discussion.',
        'discussion',
        row_record.id::text
      );
    end if;
  end loop;

  for row_record in
    select l.id, l.user_id, l.comment_id, d.user_id as comment_author
    from public.isopedia_discussion_likes l
    join public.isopedia_discussions d on d.id = l.comment_id
  loop
    if row_record.comment_author <> row_record.user_id then
      perform public.award_isotokens(
        row_record.comment_author,
        1,
        'discussion_like_received',
        'discussion_like_received:' || row_record.id::text,
        'Discussion post received a like.',
        'discussion',
        row_record.comment_id::text
      );
    end if;
  end loop;
end $$;
