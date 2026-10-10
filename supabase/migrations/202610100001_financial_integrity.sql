-- Additive migration: safe to run against databases that already contain these fields.
alter table public.profiles
  add column if not exists financial_month_start_day integer not null default 1;
alter table public.profiles
  drop constraint if exists profiles_financial_month_start_day_check;
alter table public.profiles
  add constraint profiles_financial_month_start_day_check
  check (financial_month_start_day between 1 and 28);

alter table public.categories
  add column if not exists parent_id uuid references public.categories(id) on delete cascade;

alter table public.debts
  add column if not exists debt_type text not null default 'fixed',
  add column if not exists provider text not null default '',
  add column if not exists monthly_due_day integer,
  add column if not exists total_installments integer;

alter table public.debts
  drop constraint if exists debts_debt_type_check;
alter table public.debts
  add constraint debts_debt_type_check check (debt_type in ('fixed', 'variable'));

create table if not exists public.debt_installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debt_id uuid not null references public.debts(id) on delete cascade,
  installment_number integer not null check (installment_number > 0),
  due_date date not null,
  amount_minor bigint not null check (amount_minor > 0),
  paid_at timestamptz,
  payment_note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists debt_installments_user_due_idx
  on public.debt_installments(user_id, due_date);
create index if not exists debt_installments_debt_due_idx
  on public.debt_installments(debt_id, due_date);

alter table public.debt_installments enable row level security;
drop policy if exists "debt installments owner" on public.debt_installments;
create policy "debt installments owner" on public.debt_installments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.transactions
  add column if not exists installment_id uuid references public.debt_installments(id) on delete set null;

create unique index if not exists transactions_installment_id_unique
  on public.transactions(installment_id)
  where installment_id is not null;

-- A category can only point to a parent category, not itself.
create index if not exists categories_user_parent_idx
  on public.categories(user_id, parent_id);
