-- Fix recurring income idempotency, carryover support, and per-debt expense categories.
-- Keep only the earliest transaction for a source/financial period before adding the unique guard.
with ranked_income as (
  select id, row_number() over (
    partition by user_id, income_source_id, income_period_key
    order by created_at asc, id asc
  ) as rn
  from public.transactions
  where income_source_id is not null and income_period_key is not null
)
delete from public.transactions t
using ranked_income r
where t.id = r.id and r.rn > 1;

create unique index if not exists transactions_income_source_period_unique
  on public.transactions(user_id, income_source_id, income_period_key)
  where income_source_id is not null and income_period_key is not null;

alter table public.debts
  add column if not exists expense_category_id uuid references public.categories(id) on delete set null;

create index if not exists debts_expense_category_idx
  on public.debts(expense_category_id);
