create table if not exists public.permit_species (
  id uuid primary key default gen_random_uuid(),
  shop_product_id bigint references public.shop_products(id) on delete set null,
  shop_slug text,
  common_name text not null,
  scientific_name text,
  category text not null default 'Isopods',
  morph_name text,
  taxonomy_notes text,
  source_notes text,
  intended_use text not null default 'Cleanup crew and pets',
  active boolean not null default true,
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists permit_species_shop_slug_idx
  on public.permit_species(shop_slug)
  where shop_slug is not null;

create index if not exists permit_species_active_priority_idx
  on public.permit_species(active, priority, common_name);

create table if not exists public.permit_state_records (
  id uuid primary key default gen_random_uuid(),
  species_id uuid not null references public.permit_species(id) on delete cascade,
  state_code text not null,
  status text not null default 'not_submitted'
    check (status in ('not_submitted', 'drafting', 'submitted', 'issued', 'denied', 'expired', 'not_allowed')),
  application_submitted_at date,
  permit_issued_at date,
  permit_expires_at date,
  permit_number text,
  application_storage_path text,
  application_file_name text,
  permit_storage_path text,
  permit_file_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (species_id, state_code)
);

create index if not exists permit_state_records_status_idx
  on public.permit_state_records(status, state_code);

create table if not exists public.permit_state_logs (
  id uuid primary key default gen_random_uuid(),
  state_record_id uuid not null references public.permit_state_records(id) on delete cascade,
  log_type text not null default 'note'
    check (log_type in ('note', 'call', 'email', 'submitted', 'issued', 'denied', 'file')),
  note text not null,
  file_storage_path text,
  file_name text,
  created_at timestamptz not null default now()
);

create index if not exists permit_state_logs_record_created_idx
  on public.permit_state_logs(state_record_id, created_at desc);

alter table public.permit_species enable row level security;
alter table public.permit_state_records enable row level security;
alter table public.permit_state_logs enable row level security;

insert into public.permit_species
  (shop_slug, common_name, scientific_name, category, morph_name, taxonomy_notes, source_notes, intended_use, priority)
values
  ('dairy-cows', 'Dairy Cows', 'Porcellio laevis', 'Isopods', 'Dairy Cow', 'Use Porcellio laevis "Dairy Cow" unless APHIS requests a different accepted name.', 'Captive-bred animals purchased from expo vendors; exact original source not documented.', 'Contained vivarium/terrarium cleanup crew and pets; not for environmental release or agricultural release.', 10),
  ('powder-orange', 'Powder Orange', 'Porcellionides pruinosus', 'Isopods', 'Powder Orange', 'Use Porcellionides pruinosus "Powder Orange" / "Orange" unless APHIS requests a different accepted name.', 'Captive-bred animals purchased from expo vendors; exact original source not documented.', 'Contained vivarium/terrarium cleanup crew and pets; not for environmental release or agricultural release.', 20),
  ('gestroi', 'Gestroi', 'Armadillidium gestroi', 'Isopods', null, 'Use Armadillidium gestroi unless APHIS requests a different accepted name.', 'Captive-bred animals purchased from expo vendors; exact original source not documented.', 'Contained vivarium/terrarium cleanup crew and pets; not for environmental release or agricultural release.', 30),
  ('yellow-zebra', 'Yellow Zebra', 'Armadillidium maculatum', 'Isopods', 'Yellow Zebra', 'Commonly treated as an Armadillidium maculatum morph; confirm the exact colony label before filing.', 'Captive-bred animals purchased from expo vendors; exact original source not documented.', 'Contained vivarium/terrarium cleanup crew and pets; not for environmental release or agricultural release.', 40),
  ('orange-cream', 'Orange Cream', 'Porcellionides pruinosus', 'Isopods', 'Orange Cream', 'Commonly treated in the hobby as Porcellionides pruinosus "Orange Cream"; confirm the colony label before filing.', 'Captive-bred animals purchased from expo vendors; exact original source not documented.', 'Contained vivarium/terrarium cleanup crew and pets; not for environmental release or agricultural release.', 50),
  ('oreo-crumble', 'Oreo Crumble', 'Porcellionides pruinosus', 'Isopods', 'Oreo Crumble', 'Commonly treated in the hobby as Porcellionides pruinosus "Oreo Crumble"; confirm the colony label before filing.', 'Captive-bred animals purchased from expo vendors; exact original source not documented.', 'Contained vivarium/terrarium cleanup crew and pets; not for environmental release or agricultural release.', 60),
  ('pineapple-spikey', 'Pineapple Spikey', 'Cristarmadillidium muricatum', 'Isopods', 'Spikey Pineapple', 'Commonly listed as Cristarmadillidium muricatum "Spikey Pineapple" or "Crystal Pineapple"; confirm the colony label before filing.', 'Captive-bred animals purchased from expo vendors; exact original source not documented.', 'Contained vivarium/terrarium cleanup crew and pets; not for environmental release or agricultural release.', 70),
  ('high-white-zebra', 'High White Zebra', 'Armadillidium maculatum', 'Isopods', 'High White Zebra', 'Commonly treated as an Armadillidium maculatum morph; confirm the exact colony label before filing.', 'Captive-bred animals purchased from expo vendors; exact original source not documented.', 'Contained vivarium/terrarium cleanup crew and pets; not for environmental release or agricultural release.', 80),
  ('red-panda', 'Red Panda', 'Cubaris sp.', 'Isopods', 'Red Panda', 'Trade name is commonly listed as Cubaris sp. "Red Panda"; species-level identification appears unresolved, so confirm acceptability before filing.', 'Captive-bred animals purchased from expo vendors; exact original source not documented.', 'Contained vivarium/terrarium cleanup crew and pets; not for environmental release or agricultural release.', 90),
  ('rubber-ducky', 'Rubber Ducky', 'Cubaris sp.', 'Isopods', 'Rubber Ducky', 'Trade name is commonly listed as Cubaris sp. "Rubber Ducky"; species-level identification appears unresolved, so confirm acceptability before filing.', 'Captive-bred animals purchased from expo vendors; exact original source not documented.', 'Contained vivarium/terrarium cleanup crew and pets; not for environmental release or agricultural release.', 100),
  ('temporate-springtails', 'Temperate Springtails', 'Folsomia candida', 'Springtails', 'Temperate culture', 'Common temperate white springtail cultures are often Folsomia candida; confirm the actual culture identity before filing. Product slug keeps existing shop spelling.', 'Captive-bred/cultured animals purchased from expo vendors; exact original source not documented.', 'Contained vivarium/terrarium cleanup crew and pets; not for environmental release or agricultural release.', 110)
on conflict (shop_slug) where shop_slug is not null do update set
  common_name = excluded.common_name,
  scientific_name = excluded.scientific_name,
  category = excluded.category,
  morph_name = excluded.morph_name,
  taxonomy_notes = excluded.taxonomy_notes,
  source_notes = excluded.source_notes,
  intended_use = excluded.intended_use,
  priority = excluded.priority,
  updated_at = now();
