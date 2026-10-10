-- Refunds remain expense transactions but use a negative amount to offset spending.
alter table public.transactions drop constraint if exists transactions_amount_minor_check;
alter table public.transactions add constraint transactions_amount_minor_check
  check ((type = 'income' and amount_minor > 0) or (type = 'expense' and amount_minor <> 0));
