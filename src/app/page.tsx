"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Wallet, Plus, TrendingUp, TrendingDown, Search, X, Menu, ShieldCheck, CreditCard, ChartNoAxesCombined, LayoutDashboard, ReceiptText, Target, FileUp, LogOut, Settings, ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import { formatSAR } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

type Tx = { id: string; title: string; notes: string; category: string; date: string; amount: number; kind: "income" | "expense" };
type TransactionRow = { id: string; type: "income" | "expense"; amount_minor: number | string; occurred_at: string; description: string | null; categories: { name: string } | { name: string }[] | null };
type Debt = { id:string; name:string; current_balance_minor:number; installment_minor:number; next_due_date:string|null; debt_type:"fixed"|"variable"; provider:string; monthly_due_day:number|null; total_installments:number|null };
type DebtInstallment = { id:string; debt_id:string; installment_number:number; due_date:string; amount_minor:number; paid_at:string|null; payment_note:string };
type VariableRow = {due_date:string;amount:string};
function dateKey(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;}
function riyadhDateKey(value:string|Date){const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(value));const part=(type:string)=>parts.find(p=>p.type===type)?.value??"";return `${part("year")}-${part("month")}-${part("day")}`;}
function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
const nav = [["نظرة عامة",LayoutDashboard],["العمليات المالية",ReceiptText],["الميزانيات",Target],["الديون والأقساط",CreditCard],["التقارير والتحليلات",ChartNoAxesCombined],["استيراد كشف الحساب",FileUp],["الإعدادات",Settings]] as const;
const expenseCategories = ["السكن","الأكل والمطاعم","المواصلات والسيارة","الفواتير والاتصالات","الصحة والعناية","التسوق","الترفيه","الأقساط والديون","الاشتراكات","التعليم","السفر","متفرقات"] as const;
const incomeCategories = ["الراتب","عمل إضافي","دخل استثماري","مكافآت","استرداد مبالغ","دخل آخر"] as const;
function normalizeCategory(value:string|null|undefined) {
  const aliases:Record<string,string> = {
    "طعام ومقاهي":"الأكل والمطاعم","طعام":"الأكل والمطاعم","مطاعم":"الأكل والمطاعم","مطاعم ومقاهي":"الأكل والمطاعم","الأكل":"الأكل والمطاعم",
    "منزل":"السكن","إيجار":"السكن","سكن":"السكن",
    "سيارة":"المواصلات والسيارة","مواصلات":"المواصلات والسيارة","بنزين":"المواصلات والسيارة",
    "فواتير":"الفواتير والاتصالات","اتصالات":"الفواتير والاتصالات",
    "صحة":"الصحة والعناية","ترفيه":"الترفيه","تسوق":"التسوق","أقساط":"الأقساط والديون",
    "راتب":"الراتب","متفرقات":"متفرقات"
  };
  const v=(value||"").trim();
  return aliases[v] || (expenseCategories as readonly string[]).includes(v) || (incomeCategories as readonly string[]).includes(v) ? (aliases[v] || v) : "متفرقات";
}

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const [user,setUser] = useState<User|null>(null);
  const [authReady,setAuthReady] = useState(false);
  const [authMode,setAuthMode] = useState<"signin"|"signup">("signin");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [authMessage,setAuthMessage] = useState("");
  const [busy,setBusy] = useState(false);
  const [tx,setTx] = useState<Tx[]>([]);
  const [accountId,setAccountId] = useState<string|null>(null);
  const [search,setSearch] = useState("");
  const [modal,setModal] = useState(false);
  const [kind,setKind] = useState<"income"|"expense">("expense");
  const [notes,setNotes] = useState("");
  const [amount,setAmount] = useState("");
  const [category,setCategory] = useState("متفرقات");
  const [active,setActive] = useState("نظرة عامة");
  const [activeRestored,setActiveRestored] = useState(false);
  const [monthStartDay,setMonthStartDay] = useState(1);
  const [settingsTab,setSettingsTab] = useState("الحساب الشخصي");
  const [themeMode,setThemeMode] = useState<"light"|"dark"|"system">("system");
  useEffect(()=>{try{const saved=window.localStorage.getItem("mizani-theme");if(saved==="light"||saved==="dark"||saved==="system")setThemeMode(saved);}catch{}},[]);
  useEffect(()=>{try{window.localStorage.setItem("mizani-theme",themeMode);}catch{}const root=document.documentElement;const dark=themeMode==="dark"||(themeMode==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);root.dataset.theme=dark?"dark":"light";if(themeMode!=="system")return;const media=window.matchMedia("(prefers-color-scheme: dark)");const update=()=>{root.dataset.theme=media.matches?"dark":"light";};media.addEventListener("change",update);return()=>media.removeEventListener("change",update);},[themeMode]);
  const [monthOffset,setMonthOffset] = useState(0);
  useEffect(()=>{try{const saved=window.sessionStorage.getItem("mizani-active-page");if(saved&&nav.some(([label])=>label===saved))setActive(saved);}catch{}setActiveRestored(true);},[]);
  useEffect(()=>{if(!activeRestored)return;try{window.sessionStorage.setItem("mizani-active-page",active);}catch{}},[active,activeRestored]);
  const [monthPickerOpen,setMonthPickerOpen] = useState(false);
  const [menu,setMenu] = useState(false);
  const [notice,setNotice] = useState("");
  const [debts,setDebts] = useState<Debt[]>([]);
  const [installments,setInstallments] = useState<DebtInstallment[]>([]);
  const [debtType,setDebtType] = useState<"fixed"|"variable">("fixed");
  const [debtProvider,setDebtProvider] = useState("");
  const [debtTotalCount,setDebtTotalCount] = useState("12");
  const [variableRows,setVariableRows] = useState<VariableRow[]>([{due_date:riyadhDateKey(new Date()),amount:""}]);
  const [budgets,setBudgets] = useState<{id:string;name:string;amount_minor:number;period:string;starts_on:string;ends_on:string|null;category_id:string|null;categories:{name:string}|{name:string}[]|null}[]>([]);
  const [budgetForm,setBudgetForm] = useState(false);
  const [budgetName,setBudgetName] = useState("");
  const [budgetAmount,setBudgetAmount] = useState("");
  const [budgetCategory,setBudgetCategory] = useState("الأكل والمطاعم");
  const [budgetPeriod,setBudgetPeriod] = useState<"weekly"|"monthly"|"yearly">("monthly");
  const [budgetStart,setBudgetStart] = useState(riyadhDateKey(new Date()));
  const [csvRows,setCsvRows] = useState<{date:string;description:string;amount:number;type:"income"|"expense"}[]>([]);
  const [csvName,setCsvName] = useState("");
  const [debtForm,setDebtForm] = useState(false);
  const [debtName,setDebtName] = useState("");
  const [debtBalance,setDebtBalance] = useState("");
  const [debtInstallment,setDebtInstallment] = useState("");
  const [debtDueDate,setDebtDueDate] = useState(riyadhDateKey(new Date()));

  useEffect(() => {
    if(!user)return;
    void supabase.from("profiles").select("financial_month_start_day").eq("id",user.id).maybeSingle().then(({data})=>{if(data?.financial_month_start_day)setMonthStartDay(Number(data.financial_month_start_day));});
  },[user,supabase]);

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => { setUser(data.session?.user ?? null); setAuthReady(true); });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,session) => { setUser(session?.user ?? null); setAuthReady(true); });
    return () => subscription.unsubscribe();
  },[supabase]);

  const loadTransactions = useCallback(async (uid:string) => {
    setBusy(true); setNotice("");
    try {
      const {data:accounts,error:accountError} = await supabase.from("accounts").select("id").eq("user_id",uid).limit(1);
      if (accountError) throw accountError;
      let aid = accounts?.[0]?.id as string|undefined;
      if (!aid) {
        const {data:newAccount,error} = await supabase.from("accounts").insert({user_id:uid,name:"حسابي الرئيسي",currency:"SAR"}).select("id").single();
        if (error) throw error;
        aid = newAccount.id;
      }
      if (!aid) throw new Error("تعذر إنشاء الحساب المالي.");
      setAccountId(aid);
      const {data,error} = await supabase.from("transactions").select("id,type,amount_minor,occurred_at,description,categories(name)").eq("user_id",uid).order("occurred_at",{ascending:false});
      if (error) throw error;
      setTx(((data ?? []) as unknown as TransactionRow[]).map((row) => ({id:row.id,title:normalizeCategory(Array.isArray(row.categories) ? row.categories[0]?.name : row.categories?.name),notes:row.description || "",category:normalizeCategory(Array.isArray(row.categories) ? row.categories[0]?.name : row.categories?.name),date:riyadhDateKey(row.occurred_at),amount:Number(row.amount_minor)/100,kind:row.type})));
    } catch (e:unknown) {
      setNotice(errorMessage(e, "تعذر تحميل البيانات. تحقق من إعدادات Supabase والصلاحيات."));
    } finally { setBusy(false); }
  },[supabase]);

  useEffect(() => { if(user) void loadTransactions(user.id); else {setTx([]);setAccountId(null);} },[user,loadTransactions]);

  async function submitAuth(e:React.FormEvent) {
    e.preventDefault(); setBusy(true); setAuthMessage("");
    try {
      if(authMode==="signup") {
        const {data,error} = await supabase.auth.signUp({email:email.trim(),password});
        if(error) throw error;
        if(!data.session) setAuthMessage("تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيد الحساب ثم سجّل الدخول.");
        else setAuthMessage("تم إنشاء الحساب بنجاح.");
      } else {
        const {error} = await supabase.auth.signInWithPassword({email:email.trim(),password});
        if(error) throw error;
      }
    } catch(e:unknown) { setAuthMessage(errorMessage(e, "تعذر تسجيل الدخول.")); }
    finally {setBusy(false);}
  }

  async function add(e:React.FormEvent) {
    e.preventDefault();
    if(!user || !accountId) {setNotice("لم يتم تجهيز الحساب بعد. حاول مرة أخرى.");return;}
    const n=Number(amount);
    if(!category.trim()||!Number.isFinite(n)||n<=0)return;
    setBusy(true);setNotice("");
    try {
      const {data:cat,error:catError} = await supabase.from("categories").select("id").eq("user_id",user.id).eq("name",category).limit(1);
      if(catError) throw catError;
      let categoryId = cat?.[0]?.id as string|undefined;
      if(!categoryId) {
        const {data:newCat,error} = await supabase.from("categories").insert({user_id:user.id,name:category,applies_to:"both"}).select("id").single();
        if(error) throw error;
        categoryId = newCat.id;
      }
      const {error} = await supabase.from("transactions").insert({user_id:user.id,account_id:accountId,category_id:categoryId,type:kind,amount_minor:Math.round(n*100),description:notes.trim()||null,occurred_at:new Date().toISOString()});
      if(error) throw error;
      await loadTransactions(user.id);
      setNotes("");setAmount("");setCategory(kind==="income"?"الراتب":"متفرقات");setModal(false);setNotice("تم حفظ العملية في قاعدة البيانات.");
    } catch(e:unknown) {setNotice(errorMessage(e, "تعذر حفظ العملية."));}
    finally {setBusy(false);}
  }

  useEffect(() => {
    if (!user) return;
    if (active === "الميزانيات") {
      void supabase.from("budgets").select("id,name,amount_minor,period,starts_on,ends_on,category_id,categories(name)").eq("user_id",user.id).order("starts_on",{ascending:false})
        .then(({data,error}) => { if(error) setNotice(error.message); else setBudgets((data ?? []) as typeof budgets); });
    }
    if (active === "الديون والأقساط") {
      void Promise.all([
        supabase.from("debts").select("id,name,current_balance_minor,installment_minor,next_due_date,debt_type,provider,monthly_due_day,total_installments").eq("user_id",user.id).order("created_at",{ascending:false}),
        supabase.from("debt_installments").select("id,debt_id,installment_number,due_date,amount_minor,paid_at,payment_note").eq("user_id",user.id).order("due_date",{ascending:true})
      ]).then(([dr,ir])=>{if(dr.error)setNotice(dr.error.message);else setDebts((dr.data??[]) as Debt[]);if(ir.error)setNotice(ir.error.message);else setInstallments((ir.data??[]) as DebtInstallment[]);});
    }
  },[active,user,supabase]);

  async function refreshAllData(){
    if(!user)return;
    setBusy(true);setNotice("");
    try{
      await loadTransactions(user.id);
      const results=await Promise.all([
        supabase.from("budgets").select("id,name,amount_minor,period,starts_on,ends_on,category_id,categories(name)").eq("user_id",user.id).order("starts_on",{ascending:false}),
        supabase.from("debts").select("id,name,current_balance_minor,installment_minor,next_due_date,debt_type,provider,monthly_due_day,total_installments").eq("user_id",user.id).order("created_at",{ascending:false}),
        supabase.from("debt_installments").select("id,debt_id,installment_number,due_date,amount_minor,paid_at,payment_note").eq("user_id",user.id).order("due_date",{ascending:true})
      ]);
      const [br,dr,ir]=results;
      if(br.error)throw br.error;if(dr.error)throw dr.error;if(ir.error)throw ir.error;
      setBudgets((br.data??[]) as typeof budgets);setDebts((dr.data??[]) as Debt[]);setInstallments((ir.data??[]) as DebtInstallment[]);
      setNotice("تم تحديث البيانات.");
    }catch(e:unknown){setNotice(errorMessage(e,"تعذر تحديث البيانات. حاول مرة أخرى."));}
    finally{setBusy(false);}
  }

  async function refreshDebts(uid:string) {
    const [dr,ir]=await Promise.all([
      supabase.from("debts").select("id,name,current_balance_minor,installment_minor,next_due_date,debt_type,provider,monthly_due_day,total_installments").eq("user_id",uid).order("created_at",{ascending:false}),
      supabase.from("debt_installments").select("id,debt_id,installment_number,due_date,amount_minor,paid_at,payment_note").eq("user_id",uid).order("due_date",{ascending:true})
    ]);
    if(dr.error) throw dr.error;if(ir.error) throw ir.error;
    setDebts((dr.data??[]) as Debt[]);setInstallments((ir.data??[]) as DebtInstallment[]);
  }

  async function saveBudget(e:React.FormEvent) {
    e.preventDefault(); if(!user)return;
    const amountMinor=Math.round(Number(budgetAmount)*100);
    if(!budgetName.trim()||!budgetCategory.trim()||!Number.isFinite(amountMinor)||amountMinor<=0||!budgetStart){setNotice("أدخل اسم الميزانية والتصنيف والمبلغ والتاريخ بشكل صحيح.");return;}
    const start=new Date(budgetStart+"T12:00:00"); const end=new Date(start);
    if(budgetPeriod==="weekly")end.setDate(end.getDate()+6);
    else if(budgetPeriod==="monthly"){end.setMonth(end.getMonth()+1);end.setDate(end.getDate()-1);}
    else {end.setFullYear(end.getFullYear()+1);end.setDate(end.getDate()-1);}
    setBusy(true);setNotice("");
    try {
      const {data:existing,error:catError}=await supabase.from("categories").select("id").eq("user_id",user.id).eq("name",budgetCategory.trim()).limit(1);
      if(catError)throw catError; let categoryId=existing?.[0]?.id as string|undefined;
      if(!categoryId){const {data:newCat,error}=await supabase.from("categories").insert({user_id:user.id,name:budgetCategory.trim(),applies_to:"expense"}).select("id").single();if(error)throw error;categoryId=newCat.id;}
      const {error}=await supabase.from("budgets").insert({user_id:user.id,category_id:categoryId,name:budgetName.trim(),amount_minor:amountMinor,period:budgetPeriod,starts_on:budgetStart,ends_on:dateKey(end)});
      if(error)throw error;
      const {data,error:loadError}=await supabase.from("budgets").select("id,name,amount_minor,period,starts_on,ends_on,category_id,categories(name)").eq("user_id",user.id).order("starts_on",{ascending:false});
      if(loadError)throw loadError;setBudgets((data??[]) as typeof budgets);setBudgetName("");setBudgetAmount("");setBudgetForm(false);setNotice("تم حفظ الميزانية بنجاح.");
    } catch(e:unknown){setNotice(errorMessage(e,"تعذر حفظ الميزانية."));} finally{setBusy(false);}
  }
  async function deleteBudget(id:string,name:string){
    if(!user||!window.confirm("تأكيد حذف ميزانية "+name+"؟"))return;setBusy(true);setNotice("");
    try{const {error}=await supabase.from("budgets").delete().eq("id",id).eq("user_id",user.id);if(error)throw error;setBudgets(items=>items.filter(item=>item.id!==id));setNotice("تم حذف الميزانية.");}
    catch(e:unknown){setNotice(errorMessage(e,"تعذر حذف الميزانية."));}finally{setBusy(false);}
  }
  function budgetSpent(b:typeof budgets[number]){
    const category=normalizeCategory(Array.isArray(b.categories)?b.categories[0]?.name:b.categories?.name);
    return periodTx.filter(t=>t.kind==="expense"&&t.category===category).reduce((sum,t)=>sum+Math.round(t.amount*100),0);
  }

  function addVariableRow(){setVariableRows(rows=>[...rows,{due_date:rows[rows.length-1]?.due_date||riyadhDateKey(new Date()),amount:""}]);}
  async function saveDebt(e:React.FormEvent) {
    e.preventDefault();if(!user)return;
    if(!debtName.trim()){setNotice("أدخل اسم الالتزام.");return;}
    let rows:{installment_number:number;due_date:string;amount_minor:number}[]=[];
    if(debtType==="fixed"){
      const installment=Math.round(Number(debtInstallment)*100), count=Number(debtTotalCount), balance=installment*count;
      if(!Number.isFinite(balance)||balance<=0||!Number.isFinite(installment)||installment<=0||!Number.isInteger(count)||count<1||count>600||!debtDueDate){setNotice("تحقق من الرصيد والقسط وعدد الأقساط والتاريخ.");return;}
      const first=new Date(debtDueDate+"T12:00:00");let remaining=balance;
      for(let i=0;i<count&&remaining>0;i++){const date=new Date(first.getFullYear(),first.getMonth()+i,1,12);const day=Math.min(first.getDate(),new Date(date.getFullYear(),date.getMonth()+1,0).getDate());date.setDate(day);const amountMinor=Math.min(installment,remaining);rows.push({installment_number:i+1,due_date:dateKey(date),amount_minor:amountMinor});remaining-=amountMinor;}
      if(remaining>0){setNotice("عدد الأقساط لا يغطي الرصيد كاملًا. زِد عدد الأقساط.");return;}
    }else{
      rows=variableRows.map((r,i)=>({installment_number:i+1,due_date:r.due_date,amount_minor:Math.round(Number(r.amount)*100)})).sort((x,y)=>x.due_date.localeCompare(y.due_date)).map((r,i)=>({...r,installment_number:i+1}));
      if(!rows.length||rows.some(r=>!r.due_date||!Number.isFinite(r.amount_minor)||r.amount_minor<=0)){setNotice("أدخل تاريخًا ومبلغًا صحيحًا لكل دفعة.");return;}
    }
    const total=rows.reduce((s,r)=>s+r.amount_minor,0), firstDate=[...rows].sort((x,y)=>x.due_date.localeCompare(y.due_date))[0].due_date;
    setBusy(true);setNotice("");
    try{
      const {data:debt,error}=await supabase.from("debts").insert({user_id:user.id,name:debtName.trim(),provider:debtProvider.trim(),debt_type:debtType,original_amount_minor:total,current_balance_minor:total,installment_minor:debtType==="fixed"?Math.round(Number(debtInstallment)*100):Math.max(...rows.map(r=>r.amount_minor)),next_due_date:firstDate,monthly_due_day:debtType==="fixed"?new Date(debtDueDate+"T12:00:00").getDate():null,total_installments:rows.length,start_date:firstDate}).select("id").single();
      if(error)throw error;
      const {error:ie}=await supabase.from("debt_installments").insert(rows.map(r=>({...r,user_id:user.id,debt_id:debt.id})));
      if(ie){await supabase.from("debts").delete().eq("id",debt.id).eq("user_id",user.id);throw ie;}
      await refreshDebts(user.id);setDebtForm(false);setDebtName("");setDebtBalance("");setDebtInstallment("");setDebtProvider("");setDebtTotalCount("12");setDebtType("fixed");setVariableRows([{due_date:riyadhDateKey(new Date()),amount:""}]);setNotice("تم حفظ الالتزام وإنشاء مواعيد الاستحقاق.");
    }catch(e:unknown){setNotice(errorMessage(e,"تعذر حفظ الالتزام وجدول الأقساط."));}finally{setBusy(false);}
  }
  async function markInstallmentPaid(item:DebtInstallment){
    if(!user||item.paid_at)return;
    if(!accountId){setNotice("تعذر تحديد الحساب المالي. حدّث الصفحة وحاول مجددًا.");return;}
    setBusy(true);setNotice("");
    let markedPaid=false;
    try{
      const debt=debts.find(d=>d.id===item.debt_id);
      if(!debt)throw new Error("تعذر العثور على الالتزام المرتبط بالقسط.");
      const {data:existingCategory,error:categoryError}=await supabase.from("categories").select("id").eq("user_id",user.id).eq("name","الأقساط والديون").limit(1).maybeSingle();
      if(categoryError)throw categoryError;
      let categoryId=existingCategory?.id as string|undefined;
      if(!categoryId){
        const {data:newCategory,error}=await supabase.from("categories").insert({user_id:user.id,name:"الأقساط والديون",applies_to:"expense"}).select("id").single();
        if(error)throw error;
        categoryId=newCategory.id;
      }
      const {error:paidError}=await supabase.from("debt_installments").update({paid_at:new Date().toISOString()}).eq("id",item.id).eq("user_id",user.id).is("paid_at",null);
      if(paidError)throw paidError;
      markedPaid=true;
      const {error:txError}=await supabase.from("transactions").insert({
        user_id:user.id,account_id:accountId,category_id:categoryId,type:"expense",
        amount_minor:Number(item.amount_minor),description:`سداد قسط ${debt.name} [installment:${item.id}]`,
        occurred_at:new Date(item.due_date+"T12:00:00").toISOString()
      });
      if(txError)throw txError;
      const remaining=Math.max(0,Number(debt.current_balance_minor)-Number(item.amount_minor));
      const next=installments.filter(i=>i.debt_id===item.debt_id&&i.id!==item.id&&!i.paid_at).sort((x,y)=>x.due_date.localeCompare(y.due_date))[0];
      const {error:ue}=await supabase.from("debts").update({current_balance_minor:remaining,next_due_date:next?.due_date??null}).eq("id",debt.id).eq("user_id",user.id);
      if(ue)throw ue;
      await loadTransactions(user.id);
      await refreshDebts(user.id);
      setNotice("تم تسجيل سداد القسط وإضافته إلى المصروفات، وتم تحديث الصافي.");
    }catch(e:unknown){
      if(markedPaid)await supabase.from("debt_installments").update({paid_at:null}).eq("id",item.id).eq("user_id",user.id);
      setNotice(errorMessage(e,"تعذر تسجيل سداد القسط. لم يتم اعتماد السداد."));
    }finally{setBusy(false);}
  }
  async function deleteDebt(debt:Debt){
    if(!user||!window.confirm("تأكيد حذف "+debt.name+" وجميع أقساطه؟ لا يمكن التراجع."))return;setBusy(true);setNotice("");
    try{const {error}=await supabase.from("debts").delete().eq("id",debt.id).eq("user_id",user.id);if(error)throw error;await refreshDebts(user.id);setNotice("تم حذف الالتزام وجميع أقساطه.");}
    catch(e:unknown){setNotice(errorMessage(e,"تعذر حذف الالتزام."));}finally{setBusy(false);}
  }
  function installmentStatus(item:DebtInstallment){
    if(item.paid_at)return {label:"مسدد",className:"moneyIn"};
    const today=riyadhDateKey(new Date());
    if(item.due_date<today)return {label:"متأخر",className:"moneyOut"};
    if(item.due_date===today)return {label:"مستحق اليوم",className:"moneyOut"};
    return {label:"قادم",className:""};
  }

  function readCsv(file: File) {
    setCsvName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const lines = String(reader.result ?? "").split(/\\r?\\n/).filter(line => line.trim());
      const parsed = lines.slice(1).map(line => {
        const cells = line.split(",").map(cell => cell.trim().replace(/^["']|["']$/g,""));
        const amountValue = Number((cells[2] ?? "").replace(/[^0-9.-]/g,""));
        const rawType = (cells[3] ?? "").toLowerCase();
        return {date:cells[0] || riyadhDateKey(new Date()),description:cells[1] || "عملية مستوردة",amount:Math.abs(amountValue),type:(rawType==="income" || rawType==="دخل" ? "income" : "expense") as "income"|"expense"};
      }).filter(row => row.amount > 0 && Number.isFinite(row.amount));
      setCsvRows(parsed);
      setNotice(parsed.length ? `تمت قراءة ${parsed.length} عملية. راجع المعاينة قبل الحفظ.` : "لم أجد عمليات صالحة. استخدم أعمدة: التاريخ، الوصف، المبلغ، النوع.");
    };
    reader.readAsText(file,"UTF-8");
  }

  async function importCsv() {
    if (!user || !accountId || csvRows.length === 0) return;
    setBusy(true); setNotice("");
    try {
      const {data:existingCats,error:catsError} = await supabase.from("categories").select("id,name").eq("user_id",user.id).limit(100);
      if(catsError) throw catsError;
      let defaultCategoryId = existingCats?.find(item=>item.name==="متفرقات")?.id;
      if(!defaultCategoryId) {
        const {data:newCategory,error} = await supabase.from("categories").insert({user_id:user.id,name:"متفرقات",applies_to:"both"}).select("id").single();
        if(error) throw error;
        defaultCategoryId = newCategory.id;
      }
      const payload = csvRows.map(row=>({user_id:user.id,account_id:accountId,category_id:defaultCategoryId,type:row.type,amount_minor:Math.round(row.amount*100),description:row.description,occurred_at: new Date(row.date+"T12:00:00").toISOString()}));
      const {error} = await supabase.from("transactions").insert(payload);
      if(error) throw error;
      await loadTransactions(user.id);
      setCsvRows([]);setCsvName("");setNotice("تم استيراد العمليات بنجاح.");
    } catch(e:unknown) {setNotice(errorMessage(e,"تعذر استيراد الملف."));}
    finally {setBusy(false);}
  }

  function getFinancialPeriod(offset:number){
    const now=new Date();
    const base=new Date(now.getFullYear(),now.getMonth(),12);
    if(now.getDate()<monthStartDay)base.setMonth(base.getMonth()-1);
    base.setDate(Math.min(monthStartDay,new Date(base.getFullYear(),base.getMonth()+1,0).getDate()));
    base.setMonth(base.getMonth()+offset);
    const end=new Date(base);end.setMonth(end.getMonth()+1);end.setDate(end.getDate()-1);
    return {start:base.toISOString().slice(0,10),end:dateKey(end),label:end.toLocaleDateString("en-GB-u-ca-gregory-nu-latn",{month:"long",year:"numeric"})};
  }
  const financialPeriod=getFinancialPeriod(monthOffset);
  function monthPicker(){
    return <div style={{position:"relative",display:"flex",justifyContent:"flex-start",marginBottom:16}}>
      <button type="button" className="month" onClick={()=>setMonthPickerOpen(v=>!v)} aria-expanded={monthPickerOpen} style={{cursor:"pointer",border:monthPickerOpen?"2px solid #3b8b70":undefined,background:"var(--card)",color:"var(--ink)",fontWeight:700}}>{financialPeriod.label} ▾</button>
      {monthPickerOpen&&<div style={{position:"absolute",zIndex:20,top:"calc(100% + 8px)",right:0,width:270,maxWidth:"90vw",padding:12,background:"var(--card)",color:"var(--ink)",border:"1px solid var(--line)",borderRadius:14,boxShadow:"0 12px 32px rgba(15,23,42,.14)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:10}}><b>اختر الشهر</b><button type="button" className="outline" onClick={()=>setMonthPickerOpen(false)} aria-label="إغلاق اختيار الشهر"><X size={15}/></button></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:7}}>{Array.from({length:13},(_,i)=>i-6).map(offset=>{const period=getFinancialPeriod(offset);const current=offset===0;const selected=offset===monthOffset;return <button type="button" key={offset} onClick={()=>{setMonthOffset(offset);setMonthPickerOpen(false)}} style={{padding:"9px 4px",borderRadius:9,border:selected?"2px solid #2f8067":"1px solid var(--line)",background:selected?"#d8f0e6":"var(--card)",color:"var(--ink)",fontWeight:selected?700:500}}>{period.label}</button>})}</div>
      </div>}
    </div>;
  }
  const periodTx=useMemo(()=>tx.filter(t=>t.date>=financialPeriod.start&&t.date<=financialPeriod.end),[tx,financialPeriod.start,financialPeriod.end]);
  const income=useMemo(()=>periodTx.filter(t=>t.kind==="income").reduce((sum,t)=>sum+t.amount,0),[periodTx]);
  const expense=useMemo(()=>periodTx.filter(t=>t.kind==="expense").reduce((sum,t)=>sum+t.amount,0),[periodTx]);
  const monthlyInstallments=useMemo(()=>installments.filter(item=>!item.paid_at&&item.due_date>=financialPeriod.start&&item.due_date<=financialPeriod.end).reduce((sum,item)=>sum+Number(item.amount_minor)/100,0),[installments,financialPeriod.start,financialPeriod.end]);
  const monthlyInstallmentCount=useMemo(()=>installments.filter(item=>!item.paid_at&&item.due_date>=financialPeriod.start&&item.due_date<=financialPeriod.end).length,[installments,financialPeriod.start,financialPeriod.end]);
  const todayRiyadh=riyadhDateKey(new Date());
  const upcomingInstallments=useMemo(()=>installments.filter(item=>!item.paid_at&&item.due_date>=todayRiyadh&&item.due_date>=financialPeriod.start&&item.due_date<=financialPeriod.end),[installments,todayRiyadh,financialPeriod.start,financialPeriod.end]);
  const reservedInstallmentAmount=useMemo(()=>upcomingInstallments.reduce((sum,item)=>sum+Number(item.amount_minor)/100,0),[upcomingInstallments]);
  const availableToSpend=income-expense-reservedInstallmentAmount;
  const filtered=periodTx.filter(t=>(t.category+" "+t.notes).toLowerCase().includes(search.toLowerCase()));
  async function deleteTransaction(item:Tx){
    if(!user||!window.confirm(`تأكيد حذف عملية ${item.category} بمبلغ ${formatSAR(item.amount)}؟`))return;
    setBusy(true);setNotice("");
    try{const {error}=await supabase.from("transactions").delete().eq("id",item.id).eq("user_id",user.id);if(error)throw error;setTx(items=>items.filter(t=>t.id!==item.id));setNotice("تم حذف العملية بنجاح.");}
    catch(e:unknown){setNotice(errorMessage(e,"تعذر حذف العملية."));}finally{setBusy(false);}
  }
  async function saveMonthStart(e:React.FormEvent){
    e.preventDefault();if(!user)return;setBusy(true);setNotice("");
    try{const {error}=await supabase.from("profiles").upsert({id:user.id,financial_month_start_day:monthStartDay},{onConflict:"id"});if(error)throw error;setMonthOffset(0);setNotice("تم حفظ بداية الشهر المالي.");}
    catch(e:unknown){setNotice(errorMessage(e,"تعذر حفظ الإعدادات."));}finally{setBusy(false);}
  }
  

  if(!authReady) return <main className="shell" style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24}}>جارٍ الاتصال...</main>;
  if(!user) return <main className="shell" style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,direction:"rtl"}}><section className="panel" style={{width:"100%",maxWidth:440,padding:28}}><div className="brand" style={{marginBottom:24}}><div className="brandIcon"><Wallet/></div><div><b>ميزانيتي</b><small>إدارة أموالك بوضوح</small></div></div><h1 style={{fontSize:24,marginBottom:8}}>{authMode==="signin"?"تسجيل الدخول":"إنشاء حساب جديد"}</h1><p style={{marginBottom:20,color:"var(--muted,#64748b)"}}>سجّل دخولك لحفظ عملياتك المالية بشكل آمن.</p><form onSubmit={submitAuth} style={{display:"grid",gap:14}}><label>البريد الإلكتروني<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" /></label><label>كلمة المرور<input required type="password" minLength={6} autoComplete={authMode==="signin"?"current-password":"new-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="6 أحرف على الأقل" /></label><button className="primary full" disabled={busy} type="submit">{busy?"جارٍ التنفيذ...":authMode==="signin"?"دخول":"إنشاء الحساب"}</button></form>{authMessage&&<p role="status" style={{marginTop:16,overflowWrap:"anywhere"}}>{authMessage}</p>}<button className="outline" style={{width:"100%",marginTop:16}} onClick={()=>{setAuthMode(authMode==="signin"?"signup":"signin");setAuthMessage("");}}>{authMode==="signin"?"ليس لديك حساب؟ أنشئ حسابًا":"لديك حساب؟ سجّل الدخول"}</button></section></main>;

  return <main className="shell"><aside className={menu?"sidebar open":"sidebar"}><div className="brand"><div className="brandIcon"><Wallet/></div><div><b>ميزانيتي</b><small>إدارة أموالك بوضوح</small></div><button className="close mobile" onClick={()=>setMenu(false)}><X/></button></div><p className="muted navTitle">القائمة الرئيسية</p><nav>{nav.map(([label,Icon])=><button key={label} onClick={()=>{setActive(label);setMenu(false)}} className={active===label?"nav active":"nav"}><Icon size={19}/>{label}{label==="استيراد كشف الحساب"&&<span className="csv">CSV</span>}</button>)}</nav><div className="sideBottom"><div className="privacy"><ShieldCheck/><div><b>بياناتك خاصة</b><small>محفوظة في حسابك</small></div></div><p style={{overflowWrap:"anywhere"}}>{user.email}<small>الريال السعودي · SAR</small></p><button className="outline" onClick={()=>void supabase.auth.signOut()}><LogOut size={16}/> تسجيل الخروج</button></div></aside><section className="main"><header className="top"><button className="menuBtn mobile" onClick={()=>setMenu(true)} aria-label="فتح القائمة"><Menu/></button><div className="topTitle"><h1>{active}</h1><p>تابع وضعك المالي واتخذ قرارات أوضح.</p></div><div className="topActions"><button className="refreshBtn" onClick={()=>window.location.reload()} title="إعادة تحميل الصفحة كاملة"><RotateCw size={17}/><span>تحديث الصفحة</span></button>{(active==="نظرة عامة" || active==="العمليات المالية") && <button className="primary" onClick={()=>setModal(true)}><Plus size={18}/> إضافة عملية</button>}</div></header>{notice&&<p role="status" style={{padding:12,margin:"8px 0 18px",borderRadius:10,background:"#eef6ff",overflowWrap:"anywhere"}}>{notice}</p>}
      {active==="نظرة عامة" && <>
        <div className="welcome"><div><span className="eyebrow">ملخصك المالي</span><h2>أهلًا بك في ميزانيتي 👋</h2><p>ملخص العمليات المحفوظة في حسابك.</p></div><div style={{position:"relative"}}><button type="button" className="month" onClick={()=>setMonthPickerOpen(v=>!v)} aria-expanded={monthPickerOpen} style={{cursor:"pointer",border:monthPickerOpen?"2px solid #3b8b70":undefined,background:"#e6f4ee",color:"#28785f",fontWeight:700}}>{financialPeriod.label} ▾</button>{monthPickerOpen&&<div style={{position:"absolute",zIndex:20,top:"calc(100% + 8px)",right:0,width:290,maxWidth:"85vw",padding:14,background:"white",border:"1px solid var(--line)",borderRadius:16,boxShadow:"0 12px 32px rgba(15,23,42,.14)"}}><div style={{fontWeight:700,marginBottom:10}}>اختر الشهر المالي</div><div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:7}}>{Array.from({length:37},(_,i)=>i-24).map(offset=>{const period=getFinancialPeriod(offset);const current=offset===0;const selected=offset===monthOffset;return <button type="button" key={offset} onClick={()=>{setMonthOffset(offset);setMonthPickerOpen(false)}} style={{padding:"10px 4px",borderRadius:9,border:current?"2px solid #2f8067":selected?"2px solid #9acbb9":"1px solid #e2e8f0",background:current?"#d8f0e6":selected?"#edf7f2":"white",color:current?"#17664e":"#273449",fontWeight:current||selected?700:500,fontSize:12}}>{period.label.replace(/ \\d{4}$/,"")}<small style={{display:"block",fontSize:10,marginTop:3}}>{period.label.match(/\\d{4}$/)?.[0]}</small></button>})}</div><button type="button" className="outline" style={{width:"100%",marginTop:10}} onClick={()=>setMonthPickerOpen(false)}>إغلاق</button></div>}</div></div>
        <div className="cards"><article className="stat"><span>إجمالي الدخل</span><div className="statIcon green"><TrendingUp/></div><strong>{formatSAR(income)}</strong><small>من عملياتك المسجلة</small></article><article className="stat"><span>إجمالي المصروفات</span><div className="statIcon red"><TrendingDown/></div><strong>{formatSAR(expense)}</strong><small>من عملياتك المسجلة</small></article><article className="stat"><span>الأقساط المتبقية</span><div className="statIcon blue"><CreditCard/></div><strong>{formatSAR(monthlyInstallments)}</strong><small>{monthlyInstallmentCount} قسط غير مسدد خلال الفترة</small></article><article className="stat"><span>الصافي</span><div className="statIcon blue"><Wallet/></div><strong>{formatSAR(income-expense)}</strong><small>الدخل ناقص المصروفات</small></article><article className="stat"><span>المتاح للصرف</span><div className="statIcon green"><Wallet/></div><strong className={availableToSpend<0?"moneyOut":"moneyIn"}>{formatSAR(availableToSpend)}</strong><small>بعد حجز {formatSAR(reservedInstallmentAmount)} للأقساط غير المسددة المستحقة من اليوم إلى نهاية الفترة</small></article></div>
        <div className="contentGrid"><section className="panel"><div className="panelHead"><div><h3>آخر العمليات</h3><p>{busy?"جارٍ تحديث البيانات...":"العمليات المحفوظة"}</p></div><label className="search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث بالتصنيف أو الملاحظات"/></label></div><div className="tableWrap"><table><thead><tr><th>التصنيف والملاحظات</th><th>التاريخ</th><th>المبلغ</th><th>إجراء</th></tr></thead><tbody>{filtered.slice(0,8).map(t=><tr key={t.id}><td><b>{t.category}</b>{t.notes&&<small style={{display:"block",color:"var(--muted)",marginTop:4}}>{t.notes}</small>}</td><td>{t.date}</td><td className={t.kind==="income"?"moneyIn":"moneyOut"}>{t.kind==="income"?"+":"−"}{formatSAR(t.amount)}</td><td><button className="close" title="حذف العملية" aria-label="حذف العملية" disabled={busy} onClick={()=>void deleteTransaction(t)}><X size={16}/></button></td></tr>)}</tbody></table>{filtered.length===0&&<p className="empty">{busy?"جارٍ تحميل العمليات...":"لا توجد عمليات محفوظة بعد."}</p>}</div></section><aside className="panel sidePanel"><h3>نظرة سريعة</h3><p>المصروفات مقارنة بالدخل</p><div className="bar"><span style={{width:(income?Math.min(100,expense/income*100):0)+"%"}}/></div><div className="barLegend"><span>نسبة المصروفات</span><b>{income?Math.round(expense/income*100):0}%</b></div><div className="note"><ShieldCheck size={20}/><div><b>خصوصيتك مهمة</b><p>كل مستخدم يصل إلى عملياته فقط عبر سياسات قاعدة البيانات.</p></div></div><button className="outline" onClick={()=>setModal(true)}><Plus size={17}/> تسجيل عملية جديدة</button></aside></div>
      </>}
      {active==="العمليات المالية" && <>{monthPicker()}<section className="panel"><div className="panelHead"><div><h3>كل العمليات المالية</h3><p>{filtered.length} عملية مسجلة</p></div><label className="search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث بالتصنيف أو الملاحظات"/></label></div><div className="tableWrap"><table><thead><tr><th>التصنيف والملاحظات</th><th>النوع</th><th>التاريخ</th><th>المبلغ</th><th>إجراء</th></tr></thead><tbody>{filtered.map(t=><tr key={t.id}><td><b>{t.category}</b>{t.notes&&<small style={{display:"block",color:"var(--muted)",marginTop:4}}>{t.notes}</small>}</td><td>{t.kind==="income"?"دخل":"مصروف"}</td><td>{t.date}</td><td className={t.kind==="income"?"moneyIn":"moneyOut"}>{t.kind==="income"?"+":"−"}{formatSAR(t.amount)}</td><td><button className="close" title="حذف العملية" aria-label="حذف العملية" disabled={busy} onClick={()=>void deleteTransaction(t)}><X size={16}/></button></td></tr>)}</tbody></table>{!filtered.length&&<p className="empty">لا توجد عمليات مطابقة للبحث.</p>}</div><button className="primary" style={{marginTop:16}} onClick={()=>setModal(true)}><Plus size={17}/> إضافة عملية</button></section></>}
      {active==="الإعدادات" && <div className="settingsPage">
        <section className="panel settingsNav"><h3>الإعدادات</h3>
          <div className="settingsChoices">
            {["الحساب الشخصي","الراتب والفترة المالية","التنبيهات والتذكيرات","الأهداف والالتزامات","المظهر والتخصيص","التقارير والبيانات"].map(name=><button type="button" key={name} className={settingsTab===name?"settingsChoice selected":"settingsChoice"} onClick={()=>setSettingsTab(name)}>{name}<ChevronLeft size={16}/></button>)}
          </div>
        </section>
        {settingsTab==="الحساب الشخصي" && <section className="panel settingsPanel"><h3>الحساب الشخصي</h3>
          <label className="settingsLabel">البريد الإلكتروني<input value={user.email||""} readOnly aria-label="البريد الإلكتروني"/></label>
          <form onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const data=new FormData(form);const next=String(data.get("newPassword")||"");const confirm=String(data.get("confirmPassword")||"");if(next.length<8){setNotice("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");return;}if(next!==confirm){setNotice("كلمتا المرور غير متطابقتين.");return;}setBusy(true);setNotice("");const {error}=await supabase.auth.updateUser({password:next});setBusy(false);if(error){setNotice(error.message);return;}form.reset();setNotice("تم تغيير كلمة المرور بنجاح.");}} className="settingsPassword">
            <h4>تغيير كلمة المرور</h4><label className="settingsLabel">كلمة المرور الجديدة<input name="newPassword" type="password" minLength={8} autoComplete="new-password" required placeholder="8 أحرف على الأقل"/></label>
            <label className="settingsLabel">تأكيد كلمة المرور<input name="confirmPassword" type="password" minLength={8} autoComplete="new-password" required placeholder="أعد كتابة كلمة المرور"/></label>
            <button className="primary" type="submit" disabled={busy}>{busy?"جارٍ الحفظ...":"تغيير كلمة المرور"}</button>
          </form>
          {notice&&<p className="settingsNotice" role="status">{notice}</p>}
          <button className="outline" onClick={()=>void supabase.auth.signOut()}><LogOut size={16}/> تسجيل الخروج</button>
        </section>}
        {settingsTab==="الراتب والفترة المالية" && <section className="panel settingsPanel"><h3>الراتب والفترة المالية</h3><form onSubmit={saveMonthStart} className="settingsForm"><label className="settingsLabel">بداية الشهر المالي<select value={monthStartDay} onChange={e=>setMonthStartDay(Number(e.target.value))}>{Array.from({length:28},(_,i)=>i+1).map(day=><option key={day} value={day}>يوم {day} من كل شهر</option>)}</select></label><button className="primary" type="submit" disabled={busy}>{busy?"جارٍ الحفظ...":"حفظ"}</button></form></section>}
        {settingsTab==="التنبيهات والتذكيرات" && <section className="panel settingsPanel"><h3>التنبيهات والتذكيرات</h3><p className="settingsMuted">التنبيهات التلقائية غير مفعلة حاليًا.</p></section>}
        {settingsTab==="الأهداف والالتزامات" && <section className="panel settingsPanel"><h3>الأهداف والالتزامات</h3><div className="settingsSummary"><span>الأقساط غير المسددة في الفترة</span><strong>{formatSAR(monthlyInstallments)}</strong><small>{monthlyInstallmentCount} قسط</small></div><button className="outline" onClick={()=>setActive("الديون والأقساط")}>إدارة الأقساط <ChevronLeft size={16}/></button></section>}
        {settingsTab==="المظهر والتخصيص" && <section className="panel settingsPanel"><h3>المظهر</h3><label className="settingsLabel">الثيم<select value={themeMode} onChange={e=>setThemeMode(e.target.value as "light"|"dark"|"system")}><option value="system">حسب إعدادات الهاتف</option><option value="light">فاتح</option><option value="dark">داكن</option></select></label></section>}
        {settingsTab==="التقارير والبيانات" && <section className="panel settingsPanel"><h3>التقارير والبيانات</h3><button className="outline" onClick={()=>setActive("استيراد كشف الحساب")}>استيراد كشف حساب CSV <ChevronLeft size={16}/></button><button className="outline" onClick={()=>setActive("التقارير والتحليلات")}>التقارير والتحليلات <ChevronLeft size={16}/></button></section>}
      </div>}
      {active==="الميزانيات" && <>{monthPicker()}<section className="panel">
        <div className="panelHead"><div><h3>الميزانيات</h3><p>متابعة الصرف في الفترة المالية المحددة</p></div><button className="primary" onClick={()=>setBudgetForm(v=>!v)}><Plus size={17}/>{budgetForm?"إلغاء":"إضافة ميزانية"}</button></div>
        {budgetForm&&<form onSubmit={saveBudget} style={{display:"grid",gap:14,padding:16,background:"var(--card)",borderRadius:12,marginBottom:18}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
            <label style={{display:"grid",gap:6}}>اسم الميزانية<input required value={budgetName} onChange={e=>setBudgetName(e.target.value)} placeholder="ميزانية المطاعم"/></label>
            <label style={{display:"grid",gap:6}}>التصنيف<select required value={budgetCategory} onChange={e=>setBudgetCategory(e.target.value)}>{expenseCategories.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
            <label style={{display:"grid",gap:6}}>الحد المالي (ر.س)<input required type="number" min="0.01" step="0.01" value={budgetAmount} onChange={e=>setBudgetAmount(e.target.value)} placeholder="1000"/></label>
            <label style={{display:"grid",gap:6}}>الفترة<select value={budgetPeriod} onChange={e=>setBudgetPeriod(e.target.value as "weekly"|"monthly"|"yearly")}><option value="weekly">أسبوعية</option><option value="monthly">شهرية</option><option value="yearly">سنوية</option></select></label>
            <label style={{display:"grid",gap:6}}>تاريخ البداية<input required type="date" value={budgetStart} onChange={e=>setBudgetStart(e.target.value)}/></label>
          </div><p style={{margin:0,color:"var(--muted)",fontSize:13}}>يُحسب الصرف من المصروفات المسجلة في نفس التصنيف وضمن فترة الميزانية.</p>
          <button className="primary" type="submit" disabled={busy} style={{justifyContent:"center"}}>{busy?"جارٍ الحفظ...":"حفظ الميزانية"}</button>
        </form>}
        {budgets.length===0?<p className="empty">ما عندك ميزانيات حاليًا. اضغط «إضافة ميزانية» لإنشاء أول ميزانية من هنا.</p>:<div style={{display:"grid",gap:12}}>{budgets.map(b=>{const spent=budgetSpent(b),limit=Number(b.amount_minor),pct=limit?Math.round(spent/limit*100):0;const cat=normalizeCategory(Array.isArray(b.categories)?b.categories[0]?.name:b.categories?.name);return <article key={b.id} style={{border:"1px solid var(--line)",borderRadius:12,padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start",flexWrap:"wrap"}}><div><h3 style={{margin:"0 0 6px"}}>{b.name}</h3><p style={{margin:0,color:"var(--muted)",fontSize:13}}>{cat||"بدون تصنيف"} · {({weekly:"أسبوعية",monthly:"شهرية",yearly:"سنوية"} as Record<string,string>)[b.period]||b.period} · {b.starts_on} إلى {b.ends_on||"مفتوح"}</p></div><button className="close" title="حذف الميزانية" onClick={()=>void deleteBudget(b.id,b.name)}><X size={16}/></button></div>
          <div style={{display:"flex",justifyContent:"space-between",gap:8,marginTop:16,flexWrap:"wrap"}}><span>المصروف: <b>{formatSAR(spent/100)}</b></span><span>الحد: <b>{formatSAR(limit/100)}</b></span><span className={spent>limit?"moneyOut":"moneyIn"}>{spent>limit?"تجاوزت الحد":"المتبقي"}: <b>{formatSAR(Math.abs(limit-spent)/100)}</b></span></div>
          <div className="bar" style={{marginTop:10}}><span style={{width:Math.min(100,pct)+"%",background:spent>limit?"#dc2626":undefined}}/></div><small style={{display:"block",marginTop:6,color:"var(--muted)"}}>{pct}% من الميزانية مستخدم</small>
        </article>})}</div>}
      </section></>}
      {active==="الديون والأقساط" && <>{monthPicker()}<section className="panel">
      <div className="panelHead"><div><h3>الالتزامات والأقساط</h3><p>مواعيد الاستحقاق والمتأخرات والمدفوعات</p></div><button className="primary" onClick={()=>setDebtForm(!debtForm)}><Plus size={17}/>{debtForm?"إلغاء":"إضافة التزام"}</button></div>
      {debtForm&&<form onSubmit={saveDebt} style={{display:"grid",gap:14,padding:16,background:"var(--card)",borderRadius:12,marginBottom:18}}>
        <div className="switch"><button type="button" className={debtType==="fixed"?"selected":""} onClick={()=>setDebtType("fixed")}>قسط ثابت شهري</button><button type="button" className={debtType==="variable"?"selected":""} onClick={()=>setDebtType("variable")}>خطة دفعات متغيرة</button></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}><label style={{display:"grid",gap:6}}>اسم الالتزام<input required value={debtName} onChange={e=>setDebtName(e.target.value)} placeholder="قسط السيارة، تابي، تمارا"/></label><label style={{display:"grid",gap:6}}>الجهة (اختياري)<input value={debtProvider} onChange={e=>setDebtProvider(e.target.value)} placeholder="البنك، تابي، تمارا"/></label></div>
        {debtType==="fixed"?<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}><label style={{display:"grid",gap:6}}>الرصيد المتبقي الإجمالي<input type="text" readOnly value={Number(debtInstallment)>0&&Number(debtTotalCount)>0?formatSAR(Number(debtInstallment)*Number(debtTotalCount)):"—"} style={{background:"#eef7f2",fontWeight:700,color:"#17664e"}}/><small style={{color:"var(--muted)"}}>يُحسب تلقائيًا: القسط الشهري × عدد الأقساط المتبقية</small></label><label style={{display:"grid",gap:6}}>القسط الشهري<input required type="number" min="0.01" step="0.01" value={debtInstallment} onChange={e=>setDebtInstallment(e.target.value)} placeholder="1365"/></label><label style={{display:"grid",gap:6}}>أول تاريخ استحقاق<input required type="date" value={debtDueDate} onChange={e=>setDebtDueDate(e.target.value)}/></label><label style={{display:"grid",gap:6}}>عدد الأقساط المتبقية<input required type="number" min="1" max="600" value={debtTotalCount} onChange={e=>setDebtTotalCount(e.target.value)}/></label></div>:<div style={{display:"grid",gap:10}}><p style={{margin:0,color:"var(--muted)",lineHeight:1.8}}>أدخل دفعات خطة الشراء مرة واحدة فقط.</p>{variableRows.map((row,index)=><div key={index} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr)) auto",gap:10,alignItems:"end"}}><label style={{display:"grid",gap:6}}>موعد الدفعة {index+1}<input required type="date" value={row.due_date} onChange={e=>setVariableRows(rows=>rows.map((r,i)=>i===index?{...r,due_date:e.target.value}:r))}/></label><label style={{display:"grid",gap:6}}>المبلغ<input required type="number" min="0.01" step="0.01" value={row.amount} onChange={e=>setVariableRows(rows=>rows.map((r,i)=>i===index?{...r,amount:e.target.value}:r))}/></label><button type="button" className="outline" onClick={()=>setVariableRows(rows=>rows.filter((_,i)=>i!==index))} disabled={variableRows.length===1} aria-label="حذف الدفعة"><X size={16}/></button></div>)}<button type="button" className="outline" onClick={addVariableRow}><Plus size={16}/> إضافة دفعة للخطة</button></div>}
        <button className="primary" type="submit" disabled={busy} style={{justifyContent:"center"}}>{busy?"جارٍ الحفظ...":"حفظ الالتزام وإنشاء جدول الاستحقاقات"}</button></form>}
      <div className="cards" style={{gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))"}}><article className="stat"><span>إجمالي المتبقي</span><strong>{formatSAR(debts.reduce((s,d)=>s+Number(d.current_balance_minor),0)/100)}</strong></article><article className="stat"><span>أقساط متأخرة</span><strong className="moneyOut">{installments.filter(i=>!i.paid_at&&i.due_date<riyadhDateKey(new Date())).length}</strong></article><article className="stat"><span>استحقاقات قادمة</span><strong>{installments.filter(i=>!i.paid_at&&i.due_date>=riyadhDateKey(new Date())).length}</strong></article></div>
      {debts.length===0?<p className="empty">ما فيه التزامات مسجلة. أضف القسط الثابت أو خطة تابي/تمارا.</p>:<div style={{display:"grid",gap:16}}>{debts.map(debt=>{const items=installments.filter(i=>i.debt_id===debt.id).sort((x,y)=>x.due_date.localeCompare(y.due_date));const overdue=items.filter(i=>!i.paid_at&&i.due_date<riyadhDateKey(new Date()));return <article key={debt.id} style={{border:"1px solid var(--line)",borderRadius:12,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"center"}}><div><h3 style={{margin:"0 0 6px"}}>{debt.name}</h3><p style={{margin:0,color:"var(--muted)",fontSize:12}}>{debt.provider||(debt.debt_type==="fixed"?"قسط ثابت":"دفعات متغيرة")} · {items.length} دفعة · {overdue.length?"متأخر "+overdue.length:"لا توجد متأخرات"}</p></div><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{textAlign:"left"}}><b style={{fontSize:18}}>{formatSAR(Number(debt.current_balance_minor)/100)}</b><small style={{display:"block",color:"var(--muted)"}}>المتبقي</small></div><button className="close" title="حذف الالتزام" onClick={()=>void deleteDebt(debt)}><X size={16}/></button></div></div>
      <div className="tableWrap" style={{marginTop:14}}><table><thead><tr><th>الدفعة</th><th>تاريخ الاستحقاق</th><th>المبلغ</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody>{items.map(item=>{const status=installmentStatus(item);return <tr key={item.id}><td>{item.installment_number}</td><td>{new Date(item.due_date+"T12:00:00").toLocaleDateString("en-GB-u-ca-gregory-nu-latn",{year:"numeric",month:"short",day:"numeric"})}</td><td>{formatSAR(Number(item.amount_minor)/100)}</td><td><span className={status.className}>{status.label}</span></td><td>{item.paid_at?<span>تم السداد {new Date(item.paid_at).toLocaleDateString("en-GB-u-ca-gregory-nu-latn")}</span>:<button className="outline" disabled={busy} onClick={()=>void markInstallmentPaid(item)}>تسجيل السداد</button>}</td></tr>})}</tbody></table></div></article>})}</div>}
    </section></>}{active==="التقارير والتحليلات" && <>{monthPicker()}<div className="cards"><article className="stat"><span>إجمالي الدخل</span><div className="statIcon green"><TrendingUp/></div><strong>{formatSAR(income)}</strong><small>{periodTx.filter(t=>t.kind==="income").length} عملية دخل في هذه الفترة</small></article><article className="stat"><span>إجمالي المصروفات</span><div className="statIcon red"><TrendingDown/></div><strong>{formatSAR(expense)}</strong><small>{periodTx.filter(t=>t.kind==="expense").length} عملية مصروف في هذه الفترة</small></article><article className="stat"><span>صافي التدفق</span><div className="statIcon blue"><Wallet/></div><strong>{formatSAR(income-expense)}</strong><small>حسب الفترة المالية المحددة</small></article><section className="panel" style={{gridColumn:"1 / -1"}}><h3>ملخص حسب التصنيف</h3><div className="tableWrap"><table><thead><tr><th>التصنيف</th><th>عدد العمليات</th><th>الدخل</th><th>المصروفات</th><th>الصافي</th></tr></thead><tbody>{Array.from(new Set(periodTx.map(t=>t.category))).map(cat=>{const rows=periodTx.filter(t=>t.category===cat);const inc=rows.filter(t=>t.kind==="income").reduce((s,t)=>s+t.amount,0);const exp=rows.filter(t=>t.kind==="expense").reduce((s,t)=>s+t.amount,0);return <tr key={cat}><td>{cat}</td><td>{rows.length}</td><td className="moneyIn">{formatSAR(inc)}</td><td className="moneyOut">{formatSAR(exp)}</td><td>{formatSAR(inc-exp)}</td></tr>})}</tbody></table>{periodTx.length===0&&<p className="empty">لا توجد عمليات في هذه الفترة المالية.</p>}</div></section></div></>}
      {active==="استيراد كشف الحساب" && <section className="panel"><h3>استيراد كشف الحساب من CSV</h3><p style={{color:"var(--muted)",margin:"8px 0 18px",lineHeight:1.9}}>ارفع ملف CSV بأربعة أعمدة بالترتيب: التاريخ، الوصف، المبلغ، النوع. النوع يكون income أو expense (أو دخل أو مصروف). الصف الأول للعناوين.</p><label style={{display:"grid",gap:10,maxWidth:520}}>اختيار ملف CSV<input type="file" accept=".csv,text/csv" onChange={e=>{const file=e.target.files?.[0];if(file)readCsv(file);}}/></label>{csvName&&<p style={{marginTop:12}}>الملف: {csvName}</p>}{csvRows.length>0&&<><h3 style={{marginTop:22}}>معاينة قبل الحفظ ({csvRows.length} عملية)</h3><div className="tableWrap"><table><thead><tr><th>التاريخ</th><th>الوصف</th><th>النوع</th><th>المبلغ</th></tr></thead><tbody>{csvRows.slice(0,10).map((row,i)=><tr key={i}><td>{row.date}</td><td>{row.description}</td><td>{row.type==="income"?"دخل":"مصروف"}</td><td>{formatSAR(row.amount)}</td></tr>)}</tbody></table></div><button className="primary" style={{marginTop:16}} disabled={busy} onClick={()=>void importCsv()}>{busy?"جارٍ الاستيراد...":`حفظ ${csvRows.length} عملية في حسابك`}</button></>}</section>}
      <footer>ميزانيتي © ٢٠٢٦ <span>حفظ سحابي عبر Supabase</span></footer></section>{modal&&<div className="overlay" onClick={()=>setModal(false)}><section className="modal" onClick={e=>e.stopPropagation()}><div className="modalHead"><div><h2>إضافة عملية مالية</h2><p>سجّل دخلك أو مصروفك</p></div><button className="close" onClick={()=>setModal(false)}><X/></button></div><form onSubmit={add}><div className="switch"><button type="button" className={kind==="expense"?"selected":""} onClick={()=>{setKind("expense");setCategory("متفرقات");}}>مصروف</button><button type="button" className={kind==="income"?"selected":""} onClick={()=>{setKind("income");setCategory("الراتب");}}>دخل</button></div><label>ملاحظات (اختياري)<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="مثال: فاتورة الكهرباء لشهر أكتوبر" rows={2}/></label><label>المبلغ بالريال<input required type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/></label><label>التصنيف<select value={category} onChange={e=>setCategory(e.target.value)}>{(kind==="income"?incomeCategories:expenseCategories).map(c=><option key={c} value={c}>{c}</option>)}</select></label><button className="primary full" disabled={busy} type="submit">{busy?"جارٍ الحفظ...":"حفظ العملية"}</button></form></section></div>}</main>;
}
