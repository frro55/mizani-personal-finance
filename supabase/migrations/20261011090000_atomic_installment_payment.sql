create or replace function public.pay_debt_installment(p_installment_id uuid, p_account_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_installment public.debt_installments%rowtype;
  v_debt public.debts%rowtype;
  v_category_id uuid;
  v_transaction_id uuid;
begin
  if v_user_id is null then raise exception 'يجب تسجيل الدخول.'; end if;

  select * into v_installment
  from public.debt_installments
  where id = p_installment_id and user_id = v_user_id
  for update;
  if not found then raise exception 'القسط غير موجود.'; end if;
  if v_installment.paid_at is not null then raise exception 'تم سداد هذا القسط مسبقًا.'; end if;

  select * into v_debt
  from public.debts
  where id = v_installment.debt_id and user_id = v_user_id
  for update;
  if not found then raise exception 'الالتزام المرتبط بالقسط غير موجود.'; end if;

  if not exists (select 1 from public.accounts where id = p_account_id and user_id = v_user_id) then
    raise exception 'الحساب المالي غير صالح.';
  end if;

  select id into v_category_id
  from public.categories
  where user_id = v_user_id and name = 'الأقساط والديون'
  limit 1;
  if v_category_id is null then
    insert into public.categories(user_id, name, applies_to, parent_id)
    values (v_user_id, 'الأقساط والديون', 'expense', null)
    returning id into v_category_id;
  end if;

  update public.debt_installments
  set paid_at = now()
  where id = v_installment.id and user_id = v_user_id and paid_at is null;
  if not found then raise exception 'تعذر اعتماد السداد؛ حدّث الصفحة وحاول مجددًا.'; end if;

  insert into public.transactions(user_id, account_id, category_id, type, amount_minor, description, installment_id, occurred_at)
  values (v_user_id, p_account_id, v_category_id, 'expense', v_installment.amount_minor,
          'سداد قسط ' || v_debt.name, v_installment.id,
          (v_installment.due_date::timestamp + interval '12 hours') at time zone 'Asia/Riyadh')
  returning id into v_transaction_id;

  update public.debts
  set current_balance_minor = greatest(0, current_balance_minor - v_installment.amount_minor),
      next_due_date = (
        select min(due_date) from public.debt_installments
        where debt_id = v_debt.id and user_id = v_user_id and paid_at is null
      )
  where id = v_debt.id and user_id = v_user_id;

  return jsonb_build_object('transaction_id', v_transaction_id, 'installment_id', v_installment.id);
end;
$$;
