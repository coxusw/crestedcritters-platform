-- Track who verified an Isopedia submission so content-agent posts can credit them.

alter table public.isopedia_submissions
  add column if not exists verified_by uuid;

alter table public.isopedia_submissions
  add column if not exists verified_at timestamptz;

create index if not exists isopedia_submissions_status_idx
  on public.isopedia_submissions(status);

create index if not exists isopedia_submissions_verified_at_idx
  on public.isopedia_submissions(verified_at desc);

create index if not exists isopedia_submissions_verified_by_idx
  on public.isopedia_submissions(verified_by);

-- Do not force old data to have a verifier because we cannot know who verified older rows.
-- Future verifications are filled by app/isopedia/verify/page.tsx.
