alter table public.randomizer_results
  add column if not exists shuffle_history jsonb not null default '[]'::jsonb;
