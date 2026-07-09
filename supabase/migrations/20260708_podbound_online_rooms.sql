create table if not exists public.podbound_rooms (
  room_code text primary key,
  room_state jsonb not null,
  host_token text not null,
  guest_token text,
  revision integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 days')
);

create index if not exists podbound_rooms_expires_at_idx
  on public.podbound_rooms (expires_at);

alter table public.podbound_rooms enable row level security;

drop policy if exists "podbound rooms are readable by room code" on public.podbound_rooms;
create policy "podbound rooms are readable by room code"
  on public.podbound_rooms
  for select
  to anon
  using (expires_at > now());

drop policy if exists "podbound rooms can be created by anon players" on public.podbound_rooms;
create policy "podbound rooms can be created by anon players"
  on public.podbound_rooms
  for insert
  to anon
  with check (expires_at > now());

drop policy if exists "podbound room players can update active rooms" on public.podbound_rooms;
create policy "podbound room players can update active rooms"
  on public.podbound_rooms
  for update
  to anon
  using (expires_at > now())
  with check (expires_at > now());

do $$
begin
  alter publication supabase_realtime add table public.podbound_rooms;
exception
  when duplicate_object then null;
end $$;
