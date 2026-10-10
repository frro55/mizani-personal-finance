-- Add a stable link from an installment to the expense created when it is paid.
-- Existing rows are preserved; old payments can be linked safely on first undo if unambiguous.
alter table public.transactions
  add column if not exists installment_id uuid
  references public.debt_installments(id) on delete set null;

create unique index if not exists transactions_installment_id_unique
  on public.transactions(installment_id)
  where installment_id is not null;
