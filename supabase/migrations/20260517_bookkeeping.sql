create table if not exists public.bookkeeping_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type text not null check (type in ('income', 'expense', 'equity', 'tax', 'mileage')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.bookkeeping_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_date date,
  type text not null check (type in ('income', 'expense', 'equity', 'tax', 'mileage', 'transfer')),
  classification text not null default 'business' check (
    classification in ('business', 'owner_contribution', 'owner_draw', 'sales_tax', 'ignore')
  ),
  category text,
  description text,
  amount numeric(12,2) not null default 0,
  payment_method text,
  source text not null default 'manual',
  source_key text unique,
  imported_from text,
  customer_name text,
  product_name text,
  gross_amount numeric(12,2),
  net_amount numeric(12,2),
  square_fee numeric(12,2),
  sales_tax_collected numeric(12,2),
  sales_tax_expected numeric(12,2),
  money_destination text,
  state text,
  should_collect_sales_tax boolean,
  mileage numeric(10,2),
  mileage_deduction numeric(12,2),
  receipt_status text,
  receipt_location text,
  notes text,
  raw_payload jsonb not null default '{}'::jsonb,
  reviewed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bookkeeping_transactions_date_idx
  on public.bookkeeping_transactions(transaction_date desc);

create index if not exists bookkeeping_transactions_type_idx
  on public.bookkeeping_transactions(type);

create index if not exists bookkeeping_transactions_classification_idx
  on public.bookkeeping_transactions(classification);

create index if not exists bookkeeping_transactions_reviewed_idx
  on public.bookkeeping_transactions(reviewed);

insert into public.bookkeeping_categories (name, type)
values
  ('Sales', 'income'),
  ('Office Supplies', 'expense'),
  ('Advertising/Marketing', 'expense'),
  ('Website/Hosting', 'expense'),
  ('Travel & Meals', 'expense'),
  ('Permits & Fees', 'expense'),
  ('Professional Services', 'expense'),
  ('Owner Contribution to business account', 'equity'),
  ('Owner Draw / Personal', 'equity'),
  ('Sales Tax', 'tax'),
  ('Mileage Deduction', 'mileage')
on conflict (name) do nothing;
