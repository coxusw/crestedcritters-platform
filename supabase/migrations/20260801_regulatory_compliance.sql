create extension if not exists pgcrypto;

create or replace function public.is_regulatory_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles ap
    where ap.id = check_user_id
  );
$$;

alter table public.shop_products
  add column if not exists is_live boolean not null default false,
  add column if not exists live_category text
    check (live_category is null or live_category in ('isopod', 'springtail', 'gecko', 'plant', 'other')),
  add column if not exists regulated_taxon_id uuid,
  add column if not exists taxon_mapping_status text not null default 'unmapped'
    check (taxon_mapping_status in ('verified', 'provisional', 'unmapped', 'disputed')),
  add column if not exists local_pickup_possible boolean not null default false,
  add column if not exists requires_live_shipping_method boolean not null default false,
  add column if not exists compliance_exempt boolean not null default false,
  add column if not exists compliance_exempt_reason text;

create table if not exists public.regulatory_applications (
  id uuid primary key default gen_random_uuid(),
  application_number text not null unique,
  application_type text not null check (application_type in ('single_state', 'multi_state', 'federal', 'state', 'other')),
  submitted_at date,
  issued_at date,
  expires_at date,
  overall_status text not null default 'needs_review'
    check (overall_status in ('pending', 'partial_approval', 'approved', 'denied', 'expired', 'revoked', 'superseded', 'needs_review')),
  issuing_authority text,
  permit_number text,
  applicant_name text,
  organization_name text,
  origin_state text,
  internal_summary text,
  unresolved_conflict boolean not null default false,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.regulatory_destinations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.regulatory_applications(id) on delete cascade,
  state_code text not null,
  state_name text not null,
  included boolean not null default true,
  destination_status text not null default 'needs_review',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(application_id, state_code)
);

create table if not exists public.regulatory_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.regulatory_applications(id) on delete set null,
  document_type text not null
    check (document_type in ('permit', 'denial', 'amendment', 'state_comment', 'correspondence', 'environmental_awareness_letter', 'identification_report', 'other')),
  title text not null,
  storage_path text not null,
  original_filename text,
  mime_type text,
  issued_at date,
  effective_at date,
  expires_at date,
  version_number integer not null default 1,
  supersedes_document_id uuid references public.regulatory_documents(id) on delete set null,
  is_current boolean not null default true,
  checksum text,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  private boolean not null default true,
  extracted_text text,
  extraction_status text not null default 'not_started',
  notes text
);

create table if not exists public.regulated_taxa (
  id uuid primary key default gen_random_uuid(),
  canonical_scientific_name text not null unique,
  genus text not null,
  species text not null,
  subspecies text,
  authority text,
  common_name text,
  taxonomic_status text not null default 'provisional'
    check (taxonomic_status in ('confirmed', 'provisional', 'unidentified', 'disputed')),
  internal_notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shop_products_regulated_taxon_fk'
  ) then
    alter table public.shop_products
      add constraint shop_products_regulated_taxon_fk
      foreign key (regulated_taxon_id) references public.regulated_taxa(id)
      on delete set null;
  end if;
end $$;

create table if not exists public.product_taxon_mappings (
  id uuid primary key default gen_random_uuid(),
  product_id bigint not null references public.shop_products(id) on delete cascade,
  regulated_taxon_id uuid references public.regulated_taxa(id) on delete set null,
  customer_display_name text not null,
  morph_or_trade_name text,
  mapping_status text not null default 'unmapped'
    check (mapping_status in ('verified', 'provisional', 'unmapped', 'disputed')),
  verification_source text,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists product_taxon_mappings_active_product_idx
  on public.product_taxon_mappings(product_id)
  where active = true;

create table if not exists public.regulatory_decisions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.regulatory_applications(id) on delete cascade,
  destination_id uuid not null references public.regulatory_destinations(id) on delete cascade,
  regulated_taxon_id uuid not null references public.regulated_taxa(id) on delete cascade,
  decision text not null default 'pending'
    check (decision in ('authorized', 'denied', 'conditional', 'pending_clarification', 'pending', 'not_requested', 'not_listed', 'expired', 'revoked')),
  controlling_document_id uuid references public.regulatory_documents(id) on delete set null,
  effective_at date,
  expires_at date,
  exact_state_comment text,
  summarized_reason text,
  condition_text text,
  condition_satisfied boolean not null default false,
  condition_satisfied_at timestamptz,
  condition_evidence_document_id uuid references public.regulatory_documents(id) on delete set null,
  manually_verified boolean not null default false,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(application_id, destination_id, regulated_taxon_id)
);

create table if not exists public.regulatory_overrides (
  id uuid primary key default gen_random_uuid(),
  state_code text not null,
  regulated_taxon_id uuid not null references public.regulated_taxa(id) on delete cascade,
  product_id bigint references public.shop_products(id) on delete cascade,
  override_status text not null check (override_status in ('authorized', 'blocked', 'manual_review')),
  reason text not null,
  supporting_document_id uuid not null references public.regulatory_documents(id) on delete restrict,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  approved_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.customer_state_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  anonymous_session_id text,
  selected_state_code text not null,
  selected_at timestamptz not null default now(),
  expires_at timestamptz,
  source text not null default 'shop_prompt'
    check (source in ('shop_prompt', 'account', 'checkout_address', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or anonymous_session_id is not null)
);

create table if not exists public.live_order_records (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique references public.shop_orders(id) on delete restrict,
  is_live_order boolean not null default true,
  shipment_date date,
  destination_name text,
  destination_business text,
  destination_address_line_1 text,
  destination_address_line_2 text,
  destination_city text,
  destination_state text,
  destination_postal_code text,
  destination_country text not null default 'US',
  customer_email text,
  customer_phone text,
  carrier text,
  service_level text,
  tracking_number text,
  permit_application_id uuid references public.regulatory_applications(id) on delete set null,
  permit_number_snapshot text,
  compliance_checked_at timestamptz,
  compliance_checked_by uuid references auth.users(id) on delete set null,
  compliance_result text not null default 'manual_review'
    check (compliance_result in ('cleared', 'blocked', 'manual_review')),
  shipped_by uuid references auth.users(id) on delete set null,
  shipped_at timestamptz,
  delivery_status text,
  retention_until date,
  immutable_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.live_order_items (
  id uuid primary key default gen_random_uuid(),
  live_order_record_id uuid not null references public.live_order_records(id) on delete cascade,
  order_item_id text,
  product_id bigint references public.shop_products(id) on delete set null,
  product_name_snapshot text not null,
  morph_name_snapshot text,
  scientific_name_snapshot text,
  regulated_taxon_id uuid references public.regulated_taxa(id) on delete set null,
  quantity integer not null default 1 check (quantity > 0),
  life_stage text,
  compliance_decision_id uuid references public.regulatory_decisions(id) on delete set null,
  decision_snapshot jsonb not null default '{}'::jsonb,
  permit_number_snapshot text,
  destination_state_snapshot text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.shipment_documents (
  id uuid primary key default gen_random_uuid(),
  live_order_record_id uuid not null references public.live_order_records(id) on delete cascade,
  document_type text not null
    check (document_type in ('permit_copy', 'permit_number_label', 'environmental_awareness_letter', 'packing_list', 'shipping_label', 'compliance_report', 'delivery_confirmation', 'other')),
  storage_path text,
  generated_at timestamptz not null default now(),
  included_with_shipment boolean not null default false,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  notes text
);

create table if not exists public.regulatory_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz not null default now(),
  ip_address text,
  user_agent text
);

create index if not exists regulatory_destinations_state_idx on public.regulatory_destinations(state_code);
create index if not exists regulatory_decisions_lookup_idx on public.regulatory_decisions(regulated_taxon_id, decision, effective_at, expires_at);
create index if not exists regulatory_documents_checksum_idx on public.regulatory_documents(checksum) where checksum is not null;
create index if not exists customer_state_preferences_user_idx on public.customer_state_preferences(user_id, updated_at desc);
create index if not exists customer_state_preferences_session_idx on public.customer_state_preferences(anonymous_session_id, updated_at desc);
create index if not exists live_order_records_state_ship_idx on public.live_order_records(destination_state, shipment_date);
create index if not exists live_order_records_retention_idx on public.live_order_records(retention_until);
create index if not exists live_order_items_taxon_idx on public.live_order_items(regulated_taxon_id);

alter table public.regulatory_applications enable row level security;
alter table public.regulatory_destinations enable row level security;
alter table public.regulatory_documents enable row level security;
alter table public.regulated_taxa enable row level security;
alter table public.product_taxon_mappings enable row level security;
alter table public.regulatory_decisions enable row level security;
alter table public.regulatory_overrides enable row level security;
alter table public.customer_state_preferences enable row level security;
alter table public.live_order_records enable row level security;
alter table public.live_order_items enable row level security;
alter table public.shipment_documents enable row level security;
alter table public.regulatory_audit_log enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'regulatory_applications',
    'regulatory_destinations',
    'regulatory_documents',
    'regulated_taxa',
    'product_taxon_mappings',
    'regulatory_decisions',
    'regulatory_overrides',
    'live_order_records',
    'live_order_items',
    'shipment_documents',
    'regulatory_audit_log'
  ]
  loop
    execute format('drop policy if exists "Regulatory admins can manage %I" on public.%I', table_name, table_name);
    execute format(
      'create policy "Regulatory admins can manage %I" on public.%I for all to authenticated using (public.is_regulatory_admin(auth.uid())) with check (public.is_regulatory_admin(auth.uid()))',
      table_name,
      table_name
    );
  end loop;
end $$;

drop policy if exists "Users can read own state preferences" on public.customer_state_preferences;
create policy "Users can read own state preferences"
  on public.customer_state_preferences
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_regulatory_admin(auth.uid()));

drop policy if exists "Users can manage own state preferences" on public.customer_state_preferences;
create policy "Users can manage own state preferences"
  on public.customer_state_preferences
  for all
  to authenticated
  using (user_id = auth.uid() or public.is_regulatory_admin(auth.uid()))
  with check (user_id = auth.uid() or public.is_regulatory_admin(auth.uid()));

insert into storage.buckets (id, name, public)
values ('regulatory-documents', 'regulatory-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "Regulatory admins manage private documents" on storage.objects;
create policy "Regulatory admins manage private documents"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'regulatory-documents' and public.is_regulatory_admin(auth.uid()))
  with check (bucket_id = 'regulatory-documents' and public.is_regulatory_admin(auth.uid()));

insert into public.regulated_taxa
  (canonical_scientific_name, genus, species, taxonomic_status, internal_notes)
values
  ('Armadillidium gestroi', 'Armadillidium', 'gestroi', 'confirmed', 'Seeded as a permit-listed taxon. No destination authorization is implied.'),
  ('Armadillidium maculatum', 'Armadillidium', 'maculatum', 'confirmed', 'Seeded as a permit-listed taxon. No destination authorization is implied.'),
  ('Cubaris murina', 'Cubaris', 'murina', 'confirmed', 'Seeded as a permit-listed taxon. Do not map other Cubaris trade names without verification.'),
  ('Porcellio laevis', 'Porcellio', 'laevis', 'confirmed', 'Seeded as a permit-listed taxon. No destination authorization is implied.'),
  ('Porcellionides pruinosus', 'Porcellionides', 'pruinosus', 'confirmed', 'Seeded as a permit-listed taxon. No destination authorization is implied.')
on conflict (canonical_scientific_name) do update set
  genus = excluded.genus,
  species = excluded.species,
  taxonomic_status = excluded.taxonomic_status,
  updated_at = now();

update public.shop_products
set
  is_live = true,
  live_category = case
    when lower(category) like '%springtail%' or lower(category) like '%spring tail%' then 'springtail'
    when lower(category) like '%isopod%' then 'isopod'
    else live_category
  end,
  requires_live_shipping_method = true,
  local_pickup_possible = true,
  taxon_mapping_status = 'unmapped',
  updated_at = now()
where lower(category) like '%isopod%'
   or lower(category) like '%springtail%'
   or lower(category) like '%spring tail%';

update public.shop_products
set
  is_live = false,
  requires_live_shipping_method = false,
  live_category = null,
  compliance_exempt = true,
  compliance_exempt_reason = 'Non-live shop product.',
  updated_at = now()
where not (
  lower(category) like '%isopod%'
  or lower(category) like '%springtail%'
  or lower(category) like '%spring tail%'
);
