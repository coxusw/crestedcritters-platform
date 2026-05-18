alter table public.bookkeeping_transactions
  drop constraint if exists bookkeeping_transactions_classification_check;

alter table public.bookkeeping_transactions
  add constraint bookkeeping_transactions_classification_check
  check (
    classification in (
      'business',
      'owner_contribution',
      'owner_draw',
      'cash_deposit',
      'sales_tax',
      'ignore'
    )
  );
