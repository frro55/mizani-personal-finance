create extension if not exists pgcrypto;
create type public.transaction_type as enum ('income','expense','transfer');
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, display_name text not null default '', created_at timestamptz not null default now());
create table public.accounts (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text not null, currency text not null default 'SAR', opening_balance_minor bigint not null default 0, created_at timestamptz not null default now(), unique(id,user_id));
create table public.categories (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, name text not null, applies_to text not null check(applies_to in ('income','expense','both')), is_system boolean not null default false, created_at timestamptz not null default now());
create table public.transactions (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, account_id uuid not null references public.accounts(id) on delete cascade, category_id uuid references public.categories(id) on delete set null, type public.transaction_type not null check(type in ('income','expense')), amount_minor bigint not null check(amount_minor > 0), occurred_at timestamptz not null default now(), description text not null default '', created_at timestamptz not null default now());
create table public.debts (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text not null, original_amount_minor bigint not null check(original_amount_minor>0), current_balance_minor bigint not null check(current_balance_minor>=0), installment_minor bigint not null default 0 check(installment_minor>=0), next_due_date date, created_at timestamptz not null default now());
create table public.budgets (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, category_id uuid references public.categories(id) on delete set null, name text not null, amount_minor bigint not null check(amount_minor>0), period text not null check(period in ('weekly','monthly','yearly')), starts_on date not null, ends_on date, created_at timestamptz not null default now());
create table public.debt_payments (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, debt_id uuid not null references public.debts(id) on delete cascade, amount_minor bigint not null check(amount_minor>0), paid_at timestamptz not null default now());
create index transactions_user_date_idx on public.transactions(user_id, occurred_at desc);
create index debts_user_idx on public.debts(user_id);
alter table public.profiles enable row level security; alter table public.accounts enable row level security; alter table public.categories enable row level security; alter table public.transactions enable row level security; alter table public.debts enable row level security; alter table public.budgets enable row level security; alter table public.debt_payments enable row level security;
create policy "profile owner" on public.profiles for all using(auth.uid()=id) with check(auth.uid()=id);
create policy "accounts owner" on public.accounts for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "categories owner or system read" on public.categories for select using(user_id is null or auth.uid()=user_id);
create policy "user categories manage" on public.categories for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "transactions owner" on public.transactions for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "debts owner" on public.debts for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "budgets owner" on public.budgets for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "debt payments owner" on public.debt_payments for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name','')); return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();


-- Current application schema additions (kept in sync with migrations).
alter table public.profiles
  add column if not exists financial_month_start_day integer not null default 1;
alter table public.profiles
  drop constraint if exists profiles_financial_month_start_day_check;
alter table public.profiles
  add constraint profiles_financial_month_start_day_check
  check (financial_month_start_day between 1 and 28);

alter table public.categories
  add column if not exists parent_id uuid references public.categories(id) on delete set null;

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
create index if not exists debt_installments_user_due_idx on public.debt_installments(user_id, due_date);
create index if not exists debt_installments_debt_due_idx on public.debt_installments(debt_id, due_date);
alter table public.debt_installments enable row level security;
drop policy if exists "debt installments owner" on public.debt_installments;
create policy "debt installments owner" on public.debt_installments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.transactions
  add column if not exists installment_id uuid references public.debt_installments(id) on delete set null;
create unique index if not exists transactions_installment_id_unique
  on public.transactions(installment_id) where installment_id is not null;
create index if not exists categories_user_parent_idx on public.categories(user_id, parent_id);
