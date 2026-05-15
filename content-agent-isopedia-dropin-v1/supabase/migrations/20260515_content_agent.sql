create extension if not exists pgcrypto;

create table if not exists public.content_agent_pages (
  id uuid primary key default gen_random_uuid(),
  page_key text not null unique,
  page_name text not null,
  active boolean not null default true,
  auto_publish_enabled boolean not null default false,
  auto_approve_generated boolean not null default false,
  meta_page_id text,
  token_env_key text,
  target_buffer_days int not null default 14,
  schedule_slots jsonb not null default '[]'::jsonb,
  content_cycle jsonb not null default '[]'::jsonb,
  default_hashtags text,
  brand_rules text,
  text_style text,
  meme_style text,
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_agent_topics (
  id uuid primary key default gen_random_uuid(),
  page_key text not null references public.content_agent_pages(page_key) on delete cascade,
  topic text not null,
  post_type text not null,
  notes text,
  active boolean not null default true,
  last_used_at timestamptz,
  use_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(page_key, topic, post_type)
);

create table if not exists public.content_agent_posts (
  id uuid primary key default gen_random_uuid(),
  page_key text not null references public.content_agent_pages(page_key) on delete cascade,
  scheduled_at timestamptz not null,
  post_type text not null,
  topic_id uuid references public.content_agent_topics(id) on delete set null,
  topic text,
  caption text,
  hashtags text,
  meme_top_text text,
  meme_bottom_text text,
  image_prompt text,
  image_url text,
  image_storage_path text,
  status text not null default 'Draft'
    check (status in ('Draft','Needs Edit','Approved','Rejected','Posted','Error')),
  approval_notes text,
  posted_at timestamptz,
  facebook_post_id text,
  facebook_post_url text,
  error text,
  source_type text not null default 'scheduled_topic',
  source_ref_id text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_agent_posts_page_status_idx
  on public.content_agent_posts(page_key, status, scheduled_at);

create table if not exists public.content_agent_media_assets (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.content_agent_posts(id) on delete cascade,
  page_key text,
  storage_bucket text not null default 'content-agent-media',
  storage_path text,
  public_url text,
  provider text not null default 'openai',
  model text,
  prompt text,
  status text not null default 'Ready',
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.content_agent_settings (
  key text primary key,
  value text,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.content_agent_cost_examples (
  id uuid primary key default gen_random_uuid(),
  category text,
  item text not null,
  cost numeric,
  frequency text,
  monthly_math text,
  yearly_math text,
  notes text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.content_agent_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  action text not null,
  entity_type text,
  entity_id text,
  result text,
  details text
);

create table if not exists public.content_agent_prompt_history (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  action text,
  prompt text,
  raw_response text
);

create table if not exists public.content_agent_comment_queue (
  id uuid primary key default gen_random_uuid(),
  page_key text not null references public.content_agent_pages(page_key) on delete cascade,
  content_post_id uuid references public.content_agent_posts(id) on delete set null,
  facebook_post_id text,
  facebook_comment_id text,
  commenter_name text,
  comment_text text,
  suggested_reply text,
  status text not null default 'Draft'
    check (status in ('Draft','Approved','Rejected','Posted','Error')),
  posted_at timestamptz,
  facebook_reply_id text,
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.content_agent_performance_logs (
  id uuid primary key default gen_random_uuid(),
  content_post_id uuid references public.content_agent_posts(id) on delete cascade,
  page_key text,
  facebook_post_id text,
  reactions int,
  comments int,
  shares int,
  reach int,
  engagement_score int,
  recycle boolean not null default false,
  notes text,
  checked_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('content-agent-media', 'content-agent-media', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'content_agent_media_public_read'
  ) then
    create policy content_agent_media_public_read
      on storage.objects for select
      using (bucket_id = 'content-agent-media');
  end if;
end $$;

insert into public.content_agent_pages
(page_key,page_name,active,auto_publish_enabled,auto_approve_generated,meta_page_id,token_env_key,target_buffer_days,schedule_slots,content_cycle,default_hashtags,brand_rules,text_style,meme_style,website_url)
values
('crested','Crested Critters',true,false,false,null,'META_PAGE_TOKEN_CRESTED',30,'[{"time":"08:00","postType":"Educational"},{"time":"15:00","postType":"Meme"},{"time":"19:00","postType":"Educational"}]'::jsonb,'[]'::jsonb,'#isopods #bioactive #terrarium #vivarium #CrestedCritters','Friendly, educational, beginner-friendly, hobbyist/community focused.','Short helpful educational Facebook posts.','Prefer realistic terrarium/isopod meme scenes.','https://www.crestedcritters.com'),
('tapdeck','Tap-Deck',true,false,false,null,'META_PAGE_TOKEN_TAPDECK',30,'[{"time":"10:00","postType":"Informational"},{"time":"18:00","postType":"Networking Tip"},{"time":"20:30","postType":"Informational"}]'::jsonb,'[]'::jsonb,'#TapDeck #DigitalBusinessCard #NFC #QRCode #Networking','Text-only posts for Tap-Deck.','Clear useful text-only posts.','Tap-Deck is text-only by default.','https://www.tap-deck.com'),
('povertyfinance','Poverty Finance',true,false,false,null,'META_PAGE_TOKEN_POVERTYFINANCE',30,'[{"time":"09:00","postType":"Real Finance Tip"},{"time":"14:00","postType":"Satire Humor"},{"time":"20:00","postType":"Satire Humor"}]'::jsonb,'["Real Finance Tip","Satire Humor","Real Finance Tip","Satire Humor","Satire Humor","Broke Meme","Real Finance Tip","Satire Humor","Real Finance Tip","Satire Humor"]'::jsonb,'#PovertyFinance #Budgeting #MoneyTips #LowIncomeFinance #MiddleClassMoney','Practical budgeting tips mixed with family-friendly dark humor. Satire must include #satire.','Real tips should include simple math examples when useful.','Funny relatable broke-life images.',''),
('isopedia','Isopedia',true,false,false,null,'META_PAGE_TOKEN_ISOPEDIA',30,'[{"time":"11:00","postType":"Species Spotlight"},{"time":"18:30","postType":"Community Stats"}]'::jsonb,'["Species Spotlight","Database Tip","Community Stats","Needs Verification Push","Contributor Thank You","Recently Updated Entry"]'::jsonb,'#Isopedia #Isopods #Bioactive #InvertKeeping #CommunityDatabase','Community-driven bioactive database posts. Highlight verified species, contributors, care info, expos, and progress.','Helpful, community-focused, and inviting.','Use uploaded species photos when available.','https://www.crestedcritters.com/isopedia')
on conflict (page_key) do update set page_name=excluded.page_name, token_env_key=excluded.token_env_key, updated_at=now();

insert into public.content_agent_topics (page_key, topic, post_type, notes)
values
('crested','Moisture gradients','Educational','Explain why one side moist and one side drier helps isopods self-regulate.'),
('crested','Leaf litter importance','Educational','Why leaf litter is food, shelter, and humidity support.'),
('crested','Springtails as cleanup crew','Educational','How springtails help with mold and leftover organics.'),
('crested','Meme: one more bin','Meme','Joke about always making room for one more bin.'),
('tapdeck','What Tap-Deck is','Informational','Explain Tap-Deck as one clean profile link.'),
('tapdeck','Expo booth tap sign','Networking Tip','Explain using an NFC/QR sign at an expo booth.'),
('povertyfinance','Subscription cleanup','Real Finance Tip','Tip about cutting silent monthly leaks with simple math.'),
('povertyfinance','Bank app horror movie','Satire Humor','Dark relatable humor about opening the bank app. Must include #satire.'),
('povertyfinance','Empty wallet meme','Broke Meme','Meme about wallet/bank account being empty after bills.'),
('isopedia','New verified species announcement','Verified Species Announcement','Announce a newly verified Isopedia species using its photo and contributor when available.'),
('isopedia','Species spotlight','Species Spotlight','Highlight one verified species and invite people to view/contribute to the entry.'),
('isopedia','Weekly expo roundup','Weekly Expo Roundup','Share upcoming expos from the Isopedia expo calendar.'),
('isopedia','Community database stats','Community Stats','Share current counts for verified species, pending submissions, contributors, and recent growth.')
on conflict (page_key, topic, post_type) do nothing;
