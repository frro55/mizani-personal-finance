-- Ensure recurring income sources can be saved and generated once per financial period.
create table if not exists public.income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category_id uuid references public.categories(id) on delete set null,
  amount_minor bigint not null check (amount_minor > 0),
  starts_on date not null,
  ends_on date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint income_sources_dates_check check (ends_on is null or ends_on >= starts_on)
);

alter table public.transactions
  add column if not exists income_source_id uuid references public.income_sources(id) on delete set null,
  add column if not exists income_period_key date;

create index if not exists income_sources_user_active_idx
  on public.income_sources(user_id, active, starts_on);

create unique index if not exists transactions_income_source_period_unique
  on public.transactions(income_source_id, income_period_key)
  where income_source_id is not null and income_period_key is not null;

alter table public.income_sources enable row level security;
drop policy if exists "income sources owner" on public.income_sources;
create policy "income sources owner" on public.income_sources
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
