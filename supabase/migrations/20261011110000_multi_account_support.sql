-- Multi-account support for Mizani.
alter table public.budgets add column if not exists account_id uuid references public.accounts(id) on delete set null;
alter table public.income_sources add column if not exists account_id uuid references public.accounts(id) on delete set null;

create table if not exists public.account_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_account_id uuid not null references public.accounts(id) on delete restrict,
  to_account_id uuid not null references public.accounts(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  description text not null default '',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (from_account_id <> to_account_id)
);
alter table public.account_transfers enable row level security;
drop policy if exists "account transfers owner" on public.account_transfers;
create policy "account transfers owner" on public.account_transfers for all using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and exists (select 1 from public.accounts a where a.id = from_account_id and a.user_id = auth.uid())
  and exists (select 1 from public.accounts a where a.id = to_account_id and a.user_id = auth.uid())
);

create or replace function public.transfer_between_accounts(
  p_from_account_id uuid, p_to_account_id uuid, p_amount_minor bigint, p_description text default ''
) returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance_minor bigint;
  v_transfer public.account_transfers%rowtype;
begin
  if v_user_id is null then raise exception 'يجب تسجيل الدخول.'; end if;
  if p_amount_minor is null or p_amount_minor <= 0 then raise exception 'أدخل مبلغًا صحيحًا.'; end if;
  if p_from_account_id = p_to_account_id then raise exception 'اختر حسابين مختلفين.'; end if;
  perform 1 from public.accounts where id in (p_from_account_id,p_to_account_id) and user_id=v_user_id order by id for update;
  if (select count(*) from public.accounts where id in (p_from_account_id,p_to_account_id) and user_id=v_user_id) <> 2 then
    raise exception 'أحد الحسابات غير صالح.';
  end if;
  select a.opening_balance_minor
    + coalesce((select sum(case when t.type='income' then t.amount_minor else -t.amount_minor end) from public.transactions t where t.user_id=v_user_id and t.account_id=a.id),0)
    + coalesce((select sum(case when x.to_account_id=a.id then x.amount_minor else -x.amount_minor end) from public.account_transfers x where x.user_id=v_user_id and (x.to_account_id=a.id or x.from_account_id=a.id)),0)
  into v_balance_minor from public.accounts a where a.id=p_from_account_id and a.user_id=v_user_id;
  if v_balance_minor < p_amount_minor then raise exception 'الرصيد غير كافٍ في الحساب المحوّل منه.'; end if;
  insert into public.account_transfers(user_id,from_account_id,to_account_id,amount_minor,description)
  values(v_user_id,p_from_account_id,p_to_account_id,p_amount_minor,coalesce(p_description,'')) returning * into v_transfer;
  return jsonb_build_object('id',v_transfer.id,'amount_minor',v_transfer.amount_minor);
end;
$$;
