"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Wallet, Plus, TrendingUp, TrendingDown, Search, X, Menu, ShieldCheck, CreditCard, ChartNoAxesCombined, LayoutDashboard, ReceiptText, Target, FileUp, LogOut, Settings, ChevronLeft, ChevronRight, RotateCw, Eye, EyeOff, LockKeyhole, Sparkles } from "lucide-react";
import { formatSAR } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

type Tx = { id: string; title: string; notes: string; category: string; categoryId: string | null; date: string; amount: number; kind: "income" | "expense" };
type TransactionRow = { id: string; type: "income" | "expense"; amount_minor: number | string; occurred_at: string; description: string | null; category_id: string | null; categories: { name: string } | { name: string }[] | null };
type Debt = { id:string; name:string; current_balance_minor:number; installment_minor:number; next_due_date:string|null; debt_type:"fixed"|"variable"; provider:string; monthly_due_day:number|null; total_installments:number|null };
type DebtInstallment = { id:string; debt_id:string; installment_number:number; due_date:string; amount_minor:number; paid_at:string|null; payment_note:string };
type VariableRow = {due_date:string;amount:string};
type IncomeSource = {id:string;name:string;category_id:string|null;amount_minor:number;starts_on:string;ends_on:string|null;active:boolean;categories:{name:string}|{name:string}[]|null};
function dateKey(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;}
function riyadhDateKey(value:string|Date){const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(value));const part=(type:string)=>parts.find(p=>p.type===type)?.value??"";return `${part("year")}-${part("month")}-${part("day")}`;}
function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
const nav = [["نظرة عامة",LayoutDashboard],["العمليات المالية",ReceiptText],["الميزانيات",Target],["الديون والأقساط",CreditCard],["التقارير والتحليلات",ChartNoAxesCombined],["استيراد كشف الحساب",FileUp],["الإعدادات",Settings]] as const;
const expenseCategories = ["السكن","الأكل والمطاعم","السيارة والمواصلات","الفواتير","التسوق","الصحة","الالتزامات","متفرقات"] as const;
const incomeCategories = ["الراتب","دخل إضافي","مكافآت","دخل آخر"] as const;
const expenseHierarchy:Record<string,string[]> = {"السكن":["الإيجار","الكهرباء والمياه"],"الأكل والمطاعم":["مطاعم","مقاضي البيت","القهوة"],"السيارة والمواصلات":["البنزين","الصيانة والزيت","غسيل السيارة"],"الفواتير":["الجوال والإنترنت","فواتير أخرى"],"التسوق":["ملابس","مشتريات شخصية"],"الصحة":["أدوية","مواعيد وعلاج"],"الالتزامات":["أقساط","رسوم أخرى"],"متفرقات":["مصروف آخر"]};
function normalizeCategory(value:string|null|undefined) {
  const aliases:Record<string,string> = {
    "طعام ومقاهي":"الأكل والمطاعم","طعام":"الأكل والمطاعم","الأكل":"الأكل والمطاعم",
    "منزل":"السكن","إيجار":"السكن","سكن":"السكن",
    "سيارة":"المواصلات والسيارة","مواصلات":"المواصلات والسيارة","بنزين":"المواصلات والسيارة",
    "فواتير":"الفواتير والاتصالات","اتصالات":"الفواتير والاتصالات",
    "صحة":"الصحة والعناية","ترفيه":"الترفيه","تسوق":"التسوق","أقساط":"الأقساط والديون",
    "راتب":"الراتب","متفرقات":"متفرقات"
  };
  const v=(value||"").trim();
  return aliases[v] || v || "متفرقات";
}

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const [user,setUser] = useState<User|null>(null);
  const [authReady,setAuthReady] = useState(false);
  const [authMode,setAuthMode] = useState<"signin"|"signup">("signin");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [showPassword,setShowPassword] = useState(false);
  const [authMessage,setAuthMessage] = useState("");
  const [busy,setBusy] = useState(false);
  const [tx,setTx] = useState<Tx[]>([]);
  const [accountId,setAccountId] = useState<string|null>(null);
  const [search,setSearch] = useState("");
  const [modal,setModal] = useState(false);
  const [kind,setKind] = useState<"income"|"expense">("expense");
  const [isRefund,setIsRefund] = useState(false);
  const [reportCategoryLevel,setReportCategoryLevel] = useState<"main"|"sub">("main");
  const [incomeSources,setIncomeSources] = useState<IncomeSource[]>([]);
  const [incomeSourceRevision,setIncomeSourceRevision] = useState(0);
  const [incomeSourceForm,setIncomeSourceForm] = useState(false);
  const [incomeSourceName,setIncomeSourceName] = useState("");
  const [incomeSourceCategory,setIncomeSourceCategory] = useState("");
  const [incomeSourceAmount,setIncomeSourceAmount] = useState("");
  const [incomeSourceStart,setIncomeSourceStart] = useState(riyadhDateKey(new Date()));
  const [incomeSourceEnd,setIncomeSourceEnd] = useState("");
  const [notes,setNotes] = useState("");
  const [amount,setAmount] = useState("");
  const [category,setCategory] = useState("مصروف آخر");
  const [mainCategory,setMainCategory] = useState("متفرقات");
  const [personalCategories,setPersonalCategories] = useState<{id:string;name:string;applies_to:string;parent_id:string|null}[]>([]);
  const [newCategoryName,setNewCategoryName] = useState("");
  const [newCategoryKind,setNewCategoryKind] = useState<"expense"|"income">("expense");
  const [newCategoryParent,setNewCategoryParent] = useState("");
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
  const [expandedDebtId,setExpandedDebtId] = useState<string|null>(null);
  const [installments,setInstallments] = useState<DebtInstallment[]>([]);
  const [debtType,setDebtType] = useState<"fixed"|"variable">("fixed");
  const [debtProvider,setDebtProvider] = useState("");
  const [debtTotalCount,setDebtTotalCount] = useState("12");
  const [variableRows,setVariableRows] = useState<VariableRow[]>([{due_date:riyadhDateKey(new Date()),amount:""}]);
  const [budgets,setBudgets] = useState<{id:string;name:string;amount_minor:number;period:string;starts_on:string;ends_on:string|null;category_id:string|null;categories:{name:string}|{name:string}[]|null}[]>([]);
  const [budgetForm,setBudgetForm] = useState(false);
  const [budgetName,setBudgetName] = useState("");
  const [budgetAmount,setBudgetAmount] = useState("");
  const [budgetCategory,setBudgetCategory] = useState("");
  const [budgetPeriod,setBudgetPeriod] = useState<"weekly"|"monthly"|"yearly">("monthly");
  const [budgetStart,setBudgetStart] = useState(riyadhDateKey(new Date()));
  const [csvRows,setCsvRows] = useState<{date:string;description:string;amount:number;type:"income"|"expense"}[]>([]);
  const [csvName,setCsvName] = useState("");
  const [debtForm,setDebtForm] = useState(false);
  const [debtName,setDebtName] = useState("");
  const [debtBalance,setDebtBalance] = useState("");
  const [debtInstallment,setDebtInstallment] = useState("");
  const [debtDueDate,setDebtDueDate] = useState(riyadhDateKey(new Date()));

  useEffect(()=>{
    if(!modal||kind!=="expense")return;
    const parent=personalCategories.find(item=>item.id===mainCategory&&!item.parent_id&&item.applies_to==="expense");
    if(!parent)return;
    const children=personalCategories.filter(item=>item.parent_id===parent.id);
    if(children.length&&!children.some(item=>item.name===category))setCategory(children[0].name);
    else if(!children.length&&category!==parent.name)setCategory(parent.name);
  },[modal,kind,mainCategory,personalCategories,category]);
  useEffect(() => {
    if(!user)return;
    void (async()=>{
      const {data,error}=await supabase.from("categories").select("id,name,applies_to,parent_id").eq("user_id",user.id).order("name");
      if(error){setNotice(error.message);return;}
      const rows=(data??[]) as {id:string;name:string;applies_to:string;parent_id:string|null}[];
      if(rows.length===0){
        for(const parentName of expenseCategories){
          const {data:parent,error:pe}=await supabase.from("categories").insert({user_id:user.id,name:parentName,applies_to:"expense",parent_id:null}).select("id,name,applies_to,parent_id").single();
          if(pe)throw pe;rows.push(parent as {id:string;name:string;applies_to:string;parent_id:string|null});
          for(const childName of (expenseHierarchy[parentName]||[])){
            const {data:child,error:ce}=await supabase.from("categories").insert({user_id:user.id,name:childName,applies_to:"expense",parent_id:parent.id}).select("id,name,applies_to,parent_id").single();
            if(ce)throw ce;rows.push(child as {id:string;name:string;applies_to:string;parent_id:string|null});
          }
        }
      }
      for(const incomeName of incomeCategories){if(!rows.some(x=>!x.parent_id&&x.applies_to==="income"&&x.name===incomeName)){const {data:incomeCat,error:incomeError}=await supabase.from("categories").insert({user_id:user.id,name:incomeName,applies_to:"income",parent_id:null}).select("id,name,applies_to,parent_id").single();if(incomeError)throw incomeError;rows.push(incomeCat as {id:string;name:string;applies_to:string;parent_id:string|null});}}
      setPersonalCategories(rows);
      const firstParent=rows.find(x=>!x.parent_id&&x.applies_to==="expense");
      if(firstParent){setMainCategory(firstParent.id);const firstChild=rows.find(x=>x.parent_id===firstParent.id);setCategory(firstChild?.name||firstParent.name);}
    })().catch(e=>setNotice(errorMessage(e,"تعذر تحميل التصنيفات.")));
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
      const {data,error} = await supabase.from("transactions").select("id,type,amount_minor,occurred_at,description,category_id,categories(name)").eq("user_id",uid).order("occurred_at",{ascending:false});
      if (error) throw error;
      setTx(((data ?? []) as unknown as TransactionRow[]).map((row) => {const categoryName=(Array.isArray(row.categories)?row.categories[0]?.name:row.categories?.name)?.trim()||"بدون تصنيف";return {id:row.id,title:categoryName,notes:row.description||"",category:categoryName,categoryId:row.category_id,date:riyadhDateKey(row.occurred_at),amount:Number(row.amount_minor)/100,kind:row.type};}));
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
      let categoryId:string|undefined;
      if(kind==="expense"){
        const parent=personalCategories.find(c=>c.id===mainCategory&&!c.parent_id&&c.applies_to==="expense");
        if(!parent)throw new Error("اختر تصنيفًا رئيسيًا صالحًا.");
        const child=personalCategories.find(c=>c.parent_id===parent.id&&c.name===category);
        categoryId=child?.id||(!personalCategories.some(c=>c.parent_id===parent.id)&&parent.name===category?parent.id:undefined);
        if(!categoryId)throw new Error("اختر التصنيف الفرعي.");
      }else{
        const {data:cat,error:catError}=await supabase.from("categories").select("id").eq("user_id",user.id).eq("name",category).is("parent_id",null).limit(1);
        if(catError)throw catError;categoryId=cat?.[0]?.id;
        if(!categoryId){const {data:nc,error}=await supabase.from("categories").insert({user_id:user.id,name:category,applies_to:"income",parent_id:null}).select("id").single();if(error)throw error;categoryId=nc.id;}
      }
      const signedAmount=Math.round(n*100)*(kind==="expense"&&isRefund?-1:1);
      const {error} = await supabase.from("transactions").insert({user_id:user.id,account_id:accountId,category_id:categoryId,type:kind,amount_minor:signedAmount,description:notes.trim(),occurred_at:new Date().toISOString()});
      if(error) throw error;
      await loadTransactions(user.id);
      setNotes("");setAmount("");setIsRefund(false);if(kind==="income"){setCategory("الراتب");}else{const defaultParent=personalCategories.find(item=>!item.parent_id&&item.applies_to==="expense"&&item.name==="متفرقات")||personalCategories.find(item=>!item.parent_id&&item.applies_to==="expense");if(defaultParent){setMainCategory(defaultParent.id);const defaultChild=personalCategories.find(item=>item.parent_id===defaultParent.id);setCategory(defaultChild?.name||defaultParent.name);}}setModal(false);setNotice("تم حفظ العملية في قاعدة البيانات.");
    } catch(e:unknown) {setNotice(errorMessage(e, "تعذر حفظ العملية."));}
    finally {setBusy(false);}
  }

  useEffect(() => {
    if (!user) return;
    if (active === "الميزانيات") {
      void supabase.from("budgets").select("id,name,amount_minor,period,starts_on,ends_on,category_id,categories(name)").eq("user_id",user.id).order("starts_on",{ascending:false})
        .then(({data,error}) => { if(error) setNotice(error.message); else setBudgets((data ?? []) as typeof budgets); });
    }
    if (active === "الديون والأقساط" || active === "نظرة عامة") {
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
      const selectedCategory=personalCategories.find(c=>c.id===budgetCategory&&c.applies_to==="expense");
      if(!selectedCategory)throw new Error("اختر تصنيفًا من التصنيفات الموجودة في الإعدادات.");
      const categoryId=selectedCategory.id;
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
    const selected=personalCategories.find(item=>item.id===b.category_id);
    if(!selected)return 0;
    const categoryIds=new Set(selected.parent_id?[selected.id]:[selected.id,...personalCategories.filter(item=>item.parent_id===selected.id).map(item=>item.id)]);
    return periodTx.filter(t=>t.kind==="expense"&&t.categoryId!==null&&categoryIds.has(t.categoryId)).reduce((sum,t)=>sum+Math.round(t.amount*100),0);
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
        amount_minor:Number(item.amount_minor),description:`سداد قسط ${debt.name}`,installment_id:item.id,
        occurred_at:new Date(item.due_date+"T12:00:00").toISOString()
      });
      if(txError)throw txError;
      const remaining=Math.max(0,Number(debt.current_balance_minor)-Number(item.amount_minor));
      const next=installments.filter(i=>i.debt_id===item.debt_id&&i.id!==item.id&&!i.paid_at).sort((x,y)=>x.due_date.localeCompare(y.due_date))[0];
      const {error:ue}=await supabase.from("debts").update({current_balance_minor:remaining,next_due_date:next?.due_date??null}).eq("id",debt.id).eq("user_id",user.id);
      if(ue)throw ue;
      // Database changes are complete; refresh failures must not roll back only part of a successful payment.
      markedPaid=false;
      await loadTransactions(user.id);
      await refreshDebts(user.id);
      setNotice("تم تسجيل سداد القسط وإضافته إلى المصروفات، وتم تحديث الصافي.");
    }catch(e:unknown){
      if(markedPaid){
        await supabase.from("transactions").delete().eq("user_id",user.id).eq("installment_id",item.id);
        await supabase.from("debt_installments").update({paid_at:null}).eq("id",item.id).eq("user_id",user.id);
      }
      setNotice(errorMessage(e,"تعذر تسجيل سداد القسط. لم يتم اعتماد السداد."));
    }finally{setBusy(false);}
  }
  async function undoInstallmentPayment(item:DebtInstallment){
    if(!user||!item.paid_at)return;
    if(!window.confirm("تأكيد إلغاء سداد هذا القسط؟ سيتم إرجاعه إلى الأقساط غير المسددة وحذف عملية المصروف المرتبطة به."))return;
    setBusy(true);setNotice("");
    try{
      const debt=debts.find(d=>d.id===item.debt_id);
      if(!debt)throw new Error("تعذر العثور على الالتزام المرتبط بالقسط.");
      const {data:initialLinkedTransactions,error:findError}=await supabase.from("transactions").select("id").eq("user_id",user.id).eq("installment_id",item.id).limit(2);
      if(findError)throw findError;
      // Keep this mutable: a unique legacy match may be linked below.
      let linkedTransactions=initialLinkedTransactions;
      // Backward compatibility for payments created before installment_id existed.
      if(!linkedTransactions?.length){
        const description=`سداد قسط ${debt.name}`;
        const occurredAt=new Date(item.due_date+"T12:00:00").toISOString();
        const {data:legacyMatches,error:legacyError}=await supabase.from("transactions").select("id").eq("user_id",user.id).eq("description",description).eq("occurred_at",occurredAt).eq("amount_minor",Number(item.amount_minor)).is("installment_id",null).limit(2);
        if(legacyError)throw legacyError;
        if(legacyMatches?.length===1){
          const {error:linkError}=await supabase.from("transactions").update({installment_id:item.id}).eq("id",legacyMatches[0].id).eq("user_id",user.id).is("installment_id",null);
          if(linkError)throw linkError;
          linkedTransactions=legacyMatches;
        }
      }
      if(!linkedTransactions||linkedTransactions.length!==1)throw new Error("لم أجد مصروفًا واحدًا مرتبطًا بهذا القسط بشكل مؤكد. لم يتم إلغاء السداد لتجنب حذف عملية خاطئة.");
      const {error:deleteTxError}=await supabase.from("transactions").delete().eq("id",linkedTransactions[0].id).eq("user_id",user.id).eq("installment_id",item.id);
      if(deleteTxError)throw deleteTxError;
      const {error:unpayError}=await supabase.from("debt_installments").update({paid_at:null}).eq("id",item.id).eq("user_id",user.id);
      if(unpayError)throw unpayError;
      const remaining=Number(debt.current_balance_minor)+Number(item.amount_minor);
      const next=installments.filter(i=>i.debt_id===item.debt_id&&(!i.paid_at||i.id===item.id)).sort((x,y)=>x.due_date.localeCompare(y.due_date))[0];
      const {error:updateDebtError}=await supabase.from("debts").update({current_balance_minor:remaining,next_due_date:next?.due_date??null}).eq("id",debt.id).eq("user_id",user.id);
      if(updateDebtError)throw updateDebtError;
      await loadTransactions(user.id);
      await refreshDebts(user.id);
      setNotice("تم إلغاء سداد القسط وإرجاع المبلغ إلى الرصيد المتبقي.");
    }catch(e:unknown){setNotice(errorMessage(e,"تعذر إلغاء سداد القسط."));}
    finally{setBusy(false);}
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

  async function readBankPdf(file: File) {
    setCsvName(file.name);
    setCsvRows([]);
    setBusy(true);
    setNotice("جارٍ قراءة كشف الحساب واستخراج العمليات...");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/parse-bank-pdf", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر قراءة ملف PDF.");
      const rows = (result.rows || []).map((row: {date:string;description:string;amount:number;type:"income"|"expense"}) => ({
        date: row.date,
        description: row.description || "عملية من كشف البنك",
        amount: Math.abs(Number(row.amount)),
        type: row.type === "income" ? "income" : "expense"
      })).filter((row: {date:string;amount:number}) => /^\\d{4}-\\d{2}-\\d{2}$/.test(row.date) && row.amount > 0 && Number.isFinite(row.amount));
      setCsvRows(rows);
      setNotice(rows.length ? `تم استخراج ${rows.length} عملية من كشف البنك. راجع المعاينة قبل الحفظ؛ راجع نوع كل عملية ووصفها.` : "لم أجد عمليات قابلة للاستيراد في الملف.");
    } catch (e: unknown) {
      setNotice(errorMessage(e, "تعذر قراءة كشف الحساب PDF."));
    } finally {
      setBusy(false);
    }
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
    return {start:dateKey(base),end:dateKey(end),label:end.toLocaleDateString("en-GB-u-ca-gregory-nu-latn",{month:"long",year:"numeric"})};
  }
  const financialPeriod=getFinancialPeriod(monthOffset);
  useEffect(()=>{if(!user||!accountId)return;let cancelled=false;void(async()=>{try{const {data,error}=await supabase.from("income_sources").select("id,name,category_id,amount_minor,starts_on,ends_on,active,categories(name)").eq("user_id",user.id).order("starts_on",{ascending:false});if(error)throw error;const sources=(data??[]) as IncomeSource[];if(cancelled)return;setIncomeSources(sources);for(const source of sources){if(!source.active||source.starts_on>financialPeriod.end||(source.ends_on&&source.ends_on<financialPeriod.start))continue;const periodKey=financialPeriod.start;const {data:existing,error:findError}=await supabase.from("transactions").select("id").eq("user_id",user.id).eq("income_source_id",source.id).eq("income_period_key",periodKey).limit(1);if(findError)throw findError;if(existing?.length)continue;const transactionDate=source.starts_on>financialPeriod.start?source.starts_on:financialPeriod.start;const {error:insertError}=await supabase.from("transactions").insert({user_id:user.id,account_id:accountId,category_id:source.category_id,type:"income",amount_minor:Number(source.amount_minor),description:source.name,income_source_id:source.id,income_period_key:periodKey,occurred_at:new Date(transactionDate+"T12:00:00").toISOString()});if(insertError&&insertError.code!=="23505")throw insertError;}await loadTransactions(user.id);}catch(e:unknown){if(!cancelled)setNotice(errorMessage(e,"تعذر تجهيز الدخل الثابت للفترة المحددة."));}})();return()=>{cancelled=true;};},[user,accountId,supabase,financialPeriod.start,financialPeriod.end,loadTransactions,incomeSourceRevision]);
  function monthPicker(){
    return <div style={{position:"relative",display:"flex",justifyContent:"flex-start",marginBottom:16}}>
      <button type="button" className="month" onClick={()=>setMonthPickerOpen(v=>!v)} aria-expanded={monthPickerOpen} style={{cursor:"pointer",border:monthPickerOpen?"2px solid #3b8b70":undefined,background:"var(--card)",color:"var(--ink)",fontWeight:700}}>{financialPeriod.label} ▾</button>
      {monthPickerOpen&&<div style={{position:"fixed",zIndex:100,top:"50%",left:"50%",transform:"translate(-50%, -50%)",right:"auto",width:"min(340px, calc(100vw - 32px))",maxWidth:"calc(100vw - 32px)",padding:12,background:"var(--card)",color:"var(--ink)",border:"1px solid var(--line)",borderRadius:14,boxShadow:"0 12px 32px rgba(15,23,42,.14)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:10}}><b>اختر الشهر</b><button type="button" className="outline" style={{width:"auto",minWidth:36,padding:"8px",flex:"0 0 auto"}} onClick={()=>setMonthPickerOpen(false)} aria-label="إغلاق اختيار الشهر"><X size={15}/></button></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:7}}>{Array.from({length:13},(_,i)=>i-6).map(offset=>{const period=getFinancialPeriod(offset);const current=offset===0;const selected=offset===monthOffset;return <button type="button" key={offset} onClick={()=>{setMonthOffset(offset);setMonthPickerOpen(false)}} style={{padding:"9px 4px",borderRadius:9,border:selected?"2px solid #2f8067":"1px solid var(--line)",background:selected?"#d8f0e6":"var(--card)",color:selected?"#12382e":"var(--ink)",fontWeight:selected?700:500}}>{period.label}</button>})}</div>
      </div>}
    </div>;
  }
  const periodTx=useMemo(()=>tx.filter(t=>t.date>=financialPeriod.start&&t.date<=financialPeriod.end),[tx,financialPeriod.start,financialPeriod.end]);
  const income=useMemo(()=>periodTx.filter(t=>t.kind==="income").reduce((sum,t)=>sum+t.amount,0),[periodTx]);
  const expense=useMemo(()=>periodTx.filter(t=>t.kind==="expense").reduce((sum,t)=>sum+t.amount,0),[periodTx]);
  const reportExpenseCategories=useMemo(()=>{const totals=new Map<string,number>();periodTx.filter(t=>t.kind==="expense").forEach(t=>{const cat=personalCategories.find(c=>c.id===t.categoryId);const parent=cat?.parent_id?personalCategories.find(c=>c.id===cat.parent_id):cat;const name=reportCategoryLevel==="main"?(parent?.name||t.category):(cat?.parent_id?t.category:(cat&&personalCategories.some(c=>c.parent_id===cat.id)?cat.name+" (رئيسي)":t.category));totals.set(name,(totals.get(name)||0)+t.amount);});return Array.from(totals.entries()).map(([name,value])=>({name,value})).filter(item=>item.value>0).sort((a,b)=>b.value-a.value);},[periodTx,personalCategories,reportCategoryLevel]);
  const reportPieItems=useMemo(()=>{const top=reportExpenseCategories.slice(0,5);const rest=reportExpenseCategories.slice(5).reduce((sum,item)=>sum+item.value,0);return rest>0?[...top,{name:"تصنيفات أخرى",value:rest}]:top;},[reportExpenseCategories]);
  const reportPieGradient=useMemo(()=>{const colors=["#36b68b","#5b8def","#f0b44c","#e87979","#a78bfa","#94a3b8"];const total=reportPieItems.reduce((sum,item)=>sum+item.value,0);if(!total)return "conic-gradient(var(--line) 0deg 360deg)";let cursor=0;return "conic-gradient("+reportPieItems.map((item,index)=>{const start=cursor;cursor+=item.value/total*360;return colors[index%colors.length]+" "+start+"deg "+cursor+"deg";}).join(",")+")";},[reportPieItems]);
  const reportMonthlyTrend=useMemo(()=>{const base=new Date(financialPeriod.start+"T12:00:00");return Array.from({length:6},(_,index)=>{const date=new Date(base.getFullYear(),base.getMonth()-5+index,1,12);const key=date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0");const rows=tx.filter(t=>t.date.startsWith(key));return {key,label:new Intl.DateTimeFormat("en",{month:"short"}).format(date),income:rows.filter(t=>t.kind==="income").reduce((sum,t)=>sum+t.amount,0),expense:rows.filter(t=>t.kind==="expense").reduce((sum,t)=>sum+t.amount,0),selected:key===financialPeriod.start.slice(0,7)};});},[tx,financialPeriod.start]);
  const reportMaxMonth=Math.max(1,...reportMonthlyTrend.flatMap(m=>[m.income,m.expense]));
  const monthlyInstallments=useMemo(()=>installments.filter(item=>!item.paid_at&&item.due_date>=financialPeriod.start&&item.due_date<=financialPeriod.end).reduce((sum,item)=>sum+Number(item.amount_minor)/100,0),[installments,financialPeriod.start,financialPeriod.end]);
  const monthlyInstallmentCount=useMemo(()=>installments.filter(item=>!item.paid_at&&item.due_date>=financialPeriod.start&&item.due_date<=financialPeriod.end).length,[installments,financialPeriod.start,financialPeriod.end]);
  const todayRiyadh=riyadhDateKey(new Date());
  const upcomingInstallments=useMemo(()=>installments.filter(item=>!item.paid_at&&item.due_date>=financialPeriod.start&&item.due_date<=financialPeriod.end),[installments,financialPeriod.start,financialPeriod.end]);
  const reservedInstallmentAmount=useMemo(()=>upcomingInstallments.reduce((sum,item)=>sum+Number(item.amount_minor)/100,0),[upcomingInstallments]);
  const availableToSpend=income-expense-reservedInstallmentAmount;
  const filtered=periodTx.filter(t=>(t.category+" "+t.notes).toLowerCase().includes(search.toLowerCase()));
  async function deleteTransaction(item:Tx){
    if(!user||!window.confirm(`تأكيد حذف عملية ${item.category} بمبلغ ${formatSAR(item.amount)}؟`))return;
    setBusy(true);setNotice("");
    try{const {error}=await supabase.from("transactions").delete().eq("id",item.id).eq("user_id",user.id);if(error)throw error;setTx(items=>items.filter(t=>t.id!==item.id));setNotice("تم حذف العملية بنجاح.");}
    catch(e:unknown){setNotice(errorMessage(e,"تعذر حذف العملية."));}finally{setBusy(false);}
  }
  async function savePersonalCategory(e:React.FormEvent){
    e.preventDefault();if(!user)return;const name=newCategoryName.trim();if(!name){setNotice("اكتب اسم التصنيف.");return;}
    const parentId=newCategoryParent||null;
    if(personalCategories.some(c=>c.name.toLocaleLowerCase()===name.toLocaleLowerCase()&&c.parent_id===parentId)){setNotice("هذا التصنيف موجود بالفعل ضمن هذا التصنيف الرئيسي.");return;}
    setBusy(true);setNotice("");
    try{const {data,error}=await supabase.from("categories").insert({user_id:user.id,name,applies_to:"expense",parent_id:parentId}).select("id,name,applies_to,parent_id").single();if(error)throw error;setPersonalCategories(items=>[...items,data as {id:string;name:string;applies_to:string;parent_id:string|null}]);setNewCategoryName("");setNewCategoryParent("");setNotice(parentId?"تمت إضافة التصنيف الفرعي.":"تمت إضافة التصنيف الرئيسي.");}
    catch(e:unknown){setNotice(errorMessage(e,"تعذر إضافة التصنيف."));}finally{setBusy(false);}
  }
  async function deletePersonalCategory(item:{id:string;name:string;applies_to:string;parent_id:string|null}){
    if(!user)return;const ids=[item.id,...(!item.parent_id?personalCategories.filter(c=>c.parent_id===item.id).map(c=>c.id):[])];
    const {count,error:checkError}=await supabase.from("transactions").select("id",{count:"exact",head:true}).eq("user_id",user.id).in("category_id",ids);
    if(checkError){setNotice(errorMessage(checkError,"تعذر التحقق من ارتباط التصنيف بالعمليات."));return;}
    if((count??0)>0){setNotice("لا يمكن حذف هذا التصنيف لأنه مرتبط بعمليات مالية محفوظة.");return;}
    if(!window.confirm(item.parent_id?"حذف التصنيف الفرعي «"+item.name+"»؟":"حذف التصنيف الرئيسي «"+item.name+"» وفروعه؟"))return;
    setBusy(true);setNotice("");
    try{if(!item.parent_id){const childIds=personalCategories.filter(c=>c.parent_id===item.id).map(c=>c.id);if(childIds.length){const {error:ce}=await supabase.from("categories").delete().eq("user_id",user.id).in("id",childIds);if(ce)throw ce;}}const {error}=await supabase.from("categories").delete().eq("user_id",user.id).eq("id",item.id);if(error)throw error;setPersonalCategories(items=>items.filter(c=>c.id!==item.id&&c.parent_id!==item.id));setNotice("تم حذف التصنيف.");}
    catch(e:unknown){setNotice(errorMessage(e,"تعذر حذف التصنيف."));}finally{setBusy(false);}
  }
  async function saveMonthStart(e:React.FormEvent){
    e.preventDefault();if(!user)return;setBusy(true);setNotice("");
    try{const {error}=await supabase.from("profiles").upsert({id:user.id,financial_month_start_day:monthStartDay},{onConflict:"id"});if(error)throw error;setMonthOffset(0);setNotice("تم حفظ بداية الشهر المالي.");}
    catch(e:unknown){setNotice(errorMessage(e,"تعذر حفظ الإعدادات."));}finally{setBusy(false);}
  }
  

  if(!authReady) return <main className="shell" style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24}}>جارٍ الاتصال...</main>;
  if(!user) return <main className="shell" style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:"clamp(16px,4vw,40px)",direction:"rtl",background:"radial-gradient(ellipse at 15% 10%,rgba(54,182,139,.15),transparent 38%),radial-gradient(ellipse at 90% 90%,rgba(91,141,239,.12),transparent 36%),var(--bg)"}}><section style={{width:"100%",maxWidth:980,minHeight:560,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,320px),1fr))",overflow:"hidden",border:"1px solid var(--line)",borderRadius:28,background:"var(--card)",boxShadow:"0 24px 80px rgba(15,23,42,.10)"}}><div style={{padding:"clamp(28px,5vw,54px)",display:"flex",flexDirection:"column",justifyContent:"space-between",gap:32,background:"linear-gradient(145deg,rgba(54,182,139,.12),rgba(91,141,239,.07))"}}><div><div className="brand" style={{marginBottom:42}}><div className="brandIcon"><Wallet/></div><div><b>ميزانيتي</b><small>إدارة أموالك بوضوح</small></div></div><div style={{width:58,height:58,borderRadius:18,display:"grid",placeItems:"center",background:"var(--card)",color:"var(--accent,#36b68b)",boxShadow:"0 8px 24px rgba(15,23,42,.06)",marginBottom:24}}><Sparkles size={27}/></div><h1 style={{fontSize:"clamp(27px,4vw,38px)",lineHeight:1.45,letterSpacing:"-.6px",margin:"0 0 14px",maxWidth:390}}>{authMode==="signin"?"خلّ فلوسك تحت السيطرة":"ابدأ رحلتك المالية بوضوح"}</h1><p style={{fontSize:15,lineHeight:2,color:"var(--muted)",maxWidth:390,margin:0}}>{authMode==="signin"?"كل دخلك ومصروفاتك والتزاماتك في مكان واحد، بصورة مرتبة وواضحة.":"أنشئ حسابك وتابع دخلك ومصروفاتك والتزاماتك من لوحة واحدة."}</p></div><div style={{display:"flex",gap:10,alignItems:"center",color:"var(--muted)",fontSize:13}}><ShieldCheck size={18}/><span>بياناتك المالية محفوظة بأمان في حسابك</span></div></div><div style={{padding:"clamp(28px,5vw,54px)",display:"flex",flexDirection:"column",justifyContent:"center"}}><div style={{marginBottom:30}}><p style={{fontSize:12,fontWeight:700,color:"var(--accent,#36b68b)",letterSpacing:".5px",margin:"0 0 10px"}}>{authMode==="signin"?"مرحبًا بعودتك":"حساب جديد"}</p><h2 style={{fontSize:27,margin:"0 0 8px"}}>{authMode==="signin"?"تسجيل الدخول":"إنشاء حساب جديد"}</h2><p style={{color:"var(--muted)",margin:0,fontSize:14,lineHeight:1.8}}>أدخل بياناتك للمتابعة إلى ميزانيتي.</p></div><form onSubmit={submitAuth} style={{display:"grid",gap:18}}><label style={{display:"grid",gap:8,fontSize:14,fontWeight:600}}>البريد الإلكتروني<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" style={{height:50,borderRadius:12,padding:"0 14px",fontSize:15}}/></label><label style={{display:"grid",gap:8,fontSize:14,fontWeight:600}}>كلمة المرور<div style={{position:"relative"}}><input required type={showPassword?"text":"password"} minLength={6} autoComplete={authMode==="signin"?"current-password":"new-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="أدخل كلمة المرور" style={{height:50,width:"100%",boxSizing:"border-box",borderRadius:12,padding:"0 48px 0 14px",fontSize:15}}/><button type="button" aria-label={showPassword?"إخفاء كلمة المرور":"إظهار كلمة المرور"} title={showPassword?"إخفاء كلمة المرور":"إظهار كلمة المرور"} onClick={()=>setShowPassword(v=>!v)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",display:"grid",placeItems:"center",width:32,height:32,border:0,background:"transparent",color:"var(--muted)",cursor:"pointer"}}>{showPassword?<EyeOff size={19}/>:<Eye size={19}/>}</button></div><small style={{fontWeight:400,color:"var(--muted)"}}>{authMode==="signin"?"أدخل كلمة المرور الخاصة بحسابك.":"يجب أن تتكون كلمة المرور من 6 أحرف على الأقل."}</small></label><button className="primary full" disabled={busy} type="submit" style={{height:50,borderRadius:12,fontSize:15,fontWeight:700,marginTop:3}}>{busy?"جارٍ التنفيذ...":authMode==="signin"?"تسجيل الدخول":"إنشاء الحساب"}</button></form>{authMessage&&<p role="status" style={{marginTop:16,overflowWrap:"anywhere",padding:12,borderRadius:10,background:"var(--bg)"}}>{authMessage}</p>}<div style={{textAlign:"center",marginTop:22,fontSize:14,color:"var(--muted)"}}>{authMode==="signin"?"ليس لديك حساب؟":"لديك حساب بالفعل؟"} <button type="button" className="outline" style={{border:0,padding:"4px 6px",fontWeight:700,color:"var(--accent,#36b68b)"}} onClick={()=>{setAuthMode(authMode==="signin"?"signup":"signin");setAuthMessage("");setShowPassword(false);}}>{authMode==="signin"?"أنشئ حسابًا جديدًا":"سجّل الدخول"}</button></div></div></section></main>;

  return <main className="shell"><aside className={menu?"sidebar open":"sidebar"}><div className="brand"><div className="brandIcon"><Wallet/></div><div><b>ميزانيتي</b><small>إدارة أموالك بوضوح</small></div><button className="close mobile" onClick={()=>setMenu(false)}><X/></button></div><p className="muted navTitle">القائمة الرئيسية</p><nav>{nav.map(([label,Icon])=><button key={label} onClick={()=>{setActive(label);setMenu(false)}} className={active===label?"nav active":"nav"}><Icon size={19}/>{label}{label==="استيراد كشف الحساب"&&<span className="csv">PDF</span>}</button>)}</nav><div className="sideBottom"><div className="privacy"><ShieldCheck/><div><b>بياناتك خاصة</b><small>محفوظة في حسابك</small></div></div><p style={{overflowWrap:"anywhere"}}>{user.email}<small>الريال السعودي · SAR</small></p><button className="outline" onClick={()=>void supabase.auth.signOut()}><LogOut size={16}/> تسجيل الخروج</button></div></aside><section className="main"><header className="top"><button className="menuBtn mobile" onClick={()=>setMenu(true)} aria-label="فتح القائمة"><Menu/></button><div className="topTitle"><h1>{active}</h1><p>تابع وضعك المالي واتخذ قرارات أوضح.</p></div><div className="topActions"><button className="refreshBtn" onClick={()=>window.location.reload()} title="إعادة تحميل الصفحة كاملة"><RotateCw size={17}/><span>تحديث الصفحة</span></button></div></header>{notice&&<p role="status" className="statusNotice">{notice}</p>}
      {active==="نظرة عامة" && <>
        <div className="welcome"><div><span className="eyebrow">ملخصك المالي</span><h2>أهلًا بك في ميزانيتي 👋</h2><p>ملخص العمليات المحفوظة في حسابك.</p></div><div style={{position:"relative"}}><button type="button" className="month" onClick={()=>setMonthPickerOpen(v=>!v)} aria-expanded={monthPickerOpen} style={{cursor:"pointer",border:monthPickerOpen?"2px solid #3b8b70":undefined,background:"var(--card)",color:"var(--ink)",fontWeight:700}}>{financialPeriod.label} ▾</button>{monthPickerOpen&&<div style={{position:"fixed",zIndex:100,top:"50%",left:"50%",transform:"translate(-50%, -50%)",right:"auto",width:"min(340px, calc(100vw - 32px))",maxWidth:"calc(100vw - 32px)",padding:14,background:"var(--card)",color:"var(--ink)",border:"1px solid var(--line)",borderRadius:16,boxShadow:"0 12px 32px rgba(15,23,42,.14)"}}><div style={{fontWeight:700,marginBottom:10}}>اختر الشهر المالي</div><div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:7}}>{Array.from({length:13},(_,i)=>i-6).map(offset=>{const period=getFinancialPeriod(offset);const current=offset===0;const selected=offset===monthOffset;return <button type="button" key={offset} onClick={()=>{setMonthOffset(offset);setMonthPickerOpen(false)}} style={{padding:"10px 4px",borderRadius:9,border:current?"2px solid #2f8067":selected?"2px solid #9acbb9":"1px solid #e2e8f0",background:selected?"#d8f0e6":"var(--card)",color:selected?"#12382e":"var(--ink)",fontWeight:current||selected?700:500,fontSize:12}}>{period.label.replace(/ \\d{4}$/,"")}<small style={{display:"block",fontSize:10,marginTop:3}}>{period.label.match(/\\d{4}$/)?.[0]}</small></button>})}</div><button type="button" className="outline" style={{width:"100%",marginTop:10}} onClick={()=>setMonthPickerOpen(false)}>إغلاق</button></div>}</div></div>
        <section className="availableCard">
          <div className="cashflowSummary"><span className="eyebrow">المتبقي من الدخل</span><h2 className={(income-expense)<0?"moneyOut":"moneyIn"}>{formatSAR(income-expense)}</h2><p>الدخل المسجل خلال الفترة ناقص المصروفات المسجلة.</p></div>
        </section>
        <section className="availableCard availableOnlyCard">
          <div className="availableMain"><span className="eyebrow">المتاح للصرف</span><h2 className={availableToSpend<0?"moneyOut":"moneyIn"}>{formatSAR(availableToSpend)}</h2><p>المبلغ المتاح بعد حجز {formatSAR(reservedInstallmentAmount)} للأقساط غير المسددة المستحقة خلال الفترة.</p></div>
          <div className="availableIcon"><Wallet size={27}/></div>
        </section>
        <div className="cards homeStats"><article className="stat"><span>الدخل</span><div className="statIcon green"><TrendingUp/></div><strong>{formatSAR(income)}</strong><small>إجمالي الدخل المسجل</small></article><article className="stat"><span>المصروفات</span><div className="statIcon red"><TrendingDown/></div><strong>{formatSAR(expense)}</strong><small>إجمالي المصروفات المسجلة</small></article></div><div className="homeQuickActions homeStatsActions"><button className="homeIncomeAction" onClick={()=>{setKind("income");setCategory("الراتب");setModal(true)}}><Plus size={20}/><span>إضافة دخل</span></button><button className="homeExpenseAction" onClick={()=>{setKind("expense");setCategory("متفرقات");setModal(true)}}><Plus size={20}/><span>إضافة مصروف</span></button></div>
        <div className="contentGrid"><section className="panel"><div className="panelHead"><div><h3>آخر العمليات</h3><p>{busy?"جارٍ تحديث البيانات...":"العمليات المحفوظة"}</p></div><label className="search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث بالتصنيف أو الملاحظات"/></label></div><div className="tableWrap"><table><thead><tr><th>التصنيف والملاحظات</th><th>التاريخ</th><th>المبلغ</th><th>إجراء</th></tr></thead><tbody>{filtered.slice(0,5).map(t=><tr key={t.id}><td><b>{t.category}</b>{t.notes&&<small style={{display:"block",color:"var(--muted)",marginTop:4}}>{t.notes}</small>}</td><td>{t.date}</td><td className={t.kind==="income"?"moneyIn":t.amount<0?"moneyIn":"moneyOut"}>{t.amount<0?"−":t.kind==="income"?"+":"−"}{formatSAR(Math.abs(t.amount))}</td><td><div style={{display:"flex",gap:6,alignItems:"center"}}>{}<button className="close" title="حذف العملية" aria-label="حذف العملية" disabled={busy} onClick={()=>void deleteTransaction(t)}><X size={16}/></button></div></td></tr>)}</tbody></table>{filtered.length===0&&<p className="empty">{busy?"جارٍ تحميل العمليات...":"لا توجد عمليات محفوظة بعد."}</p>}</div><button className="outline homeAllTransactions" onClick={()=>setActive("العمليات المالية")}>عرض كل العمليات <ChevronLeft size={16}/></button></section><aside className="panel sidePanel homeObligations"><div className="panelHead"><div><h3>الالتزامات القادمة</h3><p>الأقساط غير المسددة خلال الفترة</p></div><CreditCard size={20}/></div><strong className="homeObligationAmount">{formatSAR(monthlyInstallments)}</strong><p>{monthlyInstallmentCount} قسط غير مسدد</p><div className="note"><ShieldCheck size={20}/><div><b>بياناتك محفوظة بأمان</b><p>يمكنك مراجعة تفاصيل الأقساط ومواعيدها من صفحة الالتزامات.</p></div></div><button className="outline" onClick={()=>setActive("الديون والأقساط")}>عرض الالتزامات <ChevronLeft size={16}/></button></aside></div>
      </>}
      {active==="العمليات المالية" && <>{monthPicker()}<section className="panel"><div className="panelHead"><div><h3>كل العمليات المالية</h3><p>{filtered.length} عملية مسجلة</p></div><label className="search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث بالتصنيف أو الملاحظات"/></label></div><div className="tableWrap"><table><thead><tr><th>التصنيف والملاحظات</th><th>النوع</th><th>التاريخ</th><th>المبلغ</th><th>إجراء</th></tr></thead><tbody>{filtered.map(t=><tr key={t.id}><td><b>{t.category}</b>{t.notes&&<small style={{display:"block",color:"var(--muted)",marginTop:4}}>{t.notes}</small>}</td><td>{t.kind==="income"?"دخل":"مصروف"}</td><td>{t.date}</td><td className={t.kind==="income"?"moneyIn":"moneyOut"}>{t.kind==="income"?"+":"−"}{formatSAR(t.amount)}</td><td><button className="close" title="حذف العملية" aria-label="حذف العملية" disabled={busy} onClick={()=>void deleteTransaction(t)}><X size={16}/></button></td></tr>)}</tbody></table>{!filtered.length&&<p className="empty">لا توجد عمليات مطابقة للبحث.</p>}</div><button className="primary" style={{marginTop:16}} onClick={()=>setModal(true)}><Plus size={17}/> إضافة عملية</button></section></>}
      {active==="الإعدادات" && <div className="settingsPage">
        <section className="panel settingsNav"><h3>الإعدادات</h3>
          <div className="settingsChoices">
            {["الحساب الشخصي","التصنيفات","الدخل الثابت","الراتب والفترة المالية","التنبيهات والتذكيرات","المظهر والتخصيص"].map(name=><button type="button" key={name} className={settingsTab===name?"settingsChoice selected":"settingsChoice"} onClick={()=>setSettingsTab(name)}>{name}<ChevronLeft size={16}/></button>)}
          </div>
        </section>
        {settingsTab==="التصنيفات" && <section className="panel settingsPanel"><h3>إدارة تصنيفات المصروفات</h3><p className="settingsMuted">أضف تصنيفًا رئيسيًا أو فرعيًا، واحذف ما لا تحتاجه. تصنيفات الدخل تبقى ثابتة.</p><form onSubmit={savePersonalCategory} className="settingsForm"><label className="settingsLabel">اسم التصنيف<input required maxLength={40} value={newCategoryName} onChange={e=>setNewCategoryName(e.target.value)} placeholder="مثال: السيارة أو البنزين"/></label><label className="settingsLabel">التصنيف الرئيسي<select value={newCategoryParent} onChange={e=>setNewCategoryParent(e.target.value)}><option value="">تصنيف رئيسي جديد</option>{personalCategories.filter(x=>!x.parent_id&&x.applies_to==="expense").map(x=><option key={x.id} value={x.id}>{x.name} — إضافة فرعي</option>)}</select></label><button className="primary" type="submit" disabled={busy}><Plus size={16}/>{newCategoryParent?" إضافة تصنيف فرعي":" إضافة تصنيف رئيسي"}</button></form><div style={{display:"grid",gap:10,marginTop:20}}><h4>التصنيفات الرئيسية والفرعية</h4>{personalCategories.filter(x=>!x.parent_id&&x.applies_to==="expense").map(parent=><div key={parent.id} style={{padding:12,border:"1px solid var(--line)",borderRadius:12}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}><b>{parent.name}</b><div style={{display:"flex",gap:6}}><button type="button" className="outline" disabled={busy} onClick={async()=>{const name=window.prompt("الاسم الجديد للتصنيف",parent.name)?.trim();if(!user||!name||name===parent.name)return;setBusy(true);const {error}=await supabase.from("categories").update({name}).eq("id",parent.id).eq("user_id",user.id);setBusy(false);if(error){setNotice(errorMessage(error,"تعذر تعديل التصنيف."));return;}setPersonalCategories(items=>items.map(c=>c.id===parent.id?{...c,name}:c));setNotice("تم تعديل اسم التصنيف.");}}>تعديل الاسم</button><button type="button" className="outline" disabled={busy} onClick={()=>void deletePersonalCategory(parent)}>حذف الرئيسي</button></div></div>{personalCategories.filter(x=>x.parent_id===parent.id).map(child=><div key={child.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"8px 12px",marginTop:7,border:"1px solid var(--line)",borderRadius:8}}><span>{child.name}</span><div style={{display:"flex",gap:6}}><button type="button" className="outline" disabled={busy} onClick={async()=>{const name=window.prompt("الاسم الجديد للتصنيف",child.name)?.trim();if(!user||!name||name===child.name)return;setBusy(true);const {error}=await supabase.from("categories").update({name}).eq("id",child.id).eq("user_id",user.id);setBusy(false);if(error){setNotice(errorMessage(error,"تعذر تعديل التصنيف."));return;}setPersonalCategories(items=>items.map(c=>c.id===child.id?{...c,name}:c));setNotice("تم تعديل اسم التصنيف.");}}>تعديل</button><button type="button" className="close" disabled={busy} title="حذف الفرعي" onClick={()=>void deletePersonalCategory(child)}><X size={15}/></button></div></div>)}</div>)}{personalCategories.every(x=>x.parent_id||x.applies_to!=="expense")&&<p className="settingsMuted">لا توجد تصنيفات رئيسية بعد.</p>}</div></section>}
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
        {settingsTab==="الدخل الثابت" && <section className="panel settingsPanel"><div className="panelHead"><div><h3>الدخل الثابت</h3><p>مصادر دخل شهرية تتولد مرة واحدة لكل فترة مالية.</p></div><button type="button" className="primary" onClick={()=>setIncomeSourceForm(v=>!v)}><Plus size={16}/>{incomeSourceForm?"إلغاء":"إضافة مصدر دخل"}</button></div>{incomeSourceForm&&<form className="settingsForm" onSubmit={async e=>{e.preventDefault();if(!user)return;const minor=Math.round(Number(incomeSourceAmount)*100);if(!incomeSourceName.trim()||!incomeSourceCategory||minor<=0||!Number.isFinite(minor)||!incomeSourceStart||(incomeSourceEnd&&incomeSourceEnd<incomeSourceStart)){setNotice("تحقق من اسم المصدر والتصنيف والمبلغ والتواريخ.");return;}setBusy(true);try{const {error}=await supabase.from("income_sources").insert({user_id:user.id,name:incomeSourceName.trim(),category_id:incomeSourceCategory,amount_minor:minor,starts_on:incomeSourceStart,ends_on:incomeSourceEnd||null,active:true});if(error)throw error;setIncomeSourceName("");setIncomeSourceAmount("");setIncomeSourceEnd("");setIncomeSourceForm(false);setIncomeSourceRevision(v=>v+1);setNotice("تم حفظ مصدر الدخل وسيُنشأ قيده الشهري تلقائيًا.");}catch(e:unknown){setNotice(errorMessage(e,"تعذر حفظ مصدر الدخل."));}finally{setBusy(false);}}}><label className="settingsLabel">اسم المصدر<input required value={incomeSourceName} onChange={e=>setIncomeSourceName(e.target.value)} placeholder="مثال: الراتب"/></label><label className="settingsLabel">التصنيف<select required value={incomeSourceCategory} onChange={e=>setIncomeSourceCategory(e.target.value)}><option value="">اختر تصنيف الدخل</option>{personalCategories.filter(c=>!c.parent_id&&c.applies_to==="income").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="settingsLabel">المبلغ الشهري (ر.س)<input required type="number" min="0.01" step="0.01" value={incomeSourceAmount} onChange={e=>setIncomeSourceAmount(e.target.value)}/></label><label className="settingsLabel">تاريخ البداية<input required type="date" value={incomeSourceStart} onChange={e=>setIncomeSourceStart(e.target.value)}/></label><label className="settingsLabel">تاريخ النهاية (اختياري)<input type="date" min={incomeSourceStart} value={incomeSourceEnd} onChange={e=>setIncomeSourceEnd(e.target.value)}/></label><button className="primary" type="submit" disabled={busy}>حفظ مصدر الدخل</button></form>}{incomeSources.length===0?<p className="empty">لا توجد مصادر دخل ثابتة.</p>:<div style={{display:"grid",gap:10,marginTop:16}}>{incomeSources.map(source=>{const cn=Array.isArray(source.categories)?source.categories[0]?.name:source.categories?.name;return <article key={source.id} style={{border:"1px solid var(--line)",borderRadius:12,padding:14}}><div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}><div><b>{source.name}</b><p style={{margin:"5px 0",color:"var(--muted)",fontSize:13}}>{cn||"بدون تصنيف"} · {source.starts_on} إلى {source.ends_on||"مستمر"} · {source.active?"نشط":"متوقف"}</p></div><strong>{formatSAR(Number(source.amount_minor)/100)} / شهر</strong></div><div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}><button type="button" className="outline" disabled={busy} onClick={async()=>{const name=window.prompt("اسم مصدر الدخل",source.name);if(name===null||!name.trim())return;const val=window.prompt("المبلغ الشهري بالريال",String(Number(source.amount_minor)/100));if(val===null)return;const minor=Math.round(Number(val)*100);if(minor<=0||!Number.isFinite(minor)){setNotice("أدخل مبلغًا صحيحًا.");return;}setBusy(true);const {error}=await supabase.from("income_sources").update({name:name.trim(),amount_minor:minor}).eq("id",source.id).eq("user_id",user.id);setBusy(false);if(error){setNotice(errorMessage(error,"تعذر تعديل المصدر."));return;}setIncomeSources(items=>items.map(x=>x.id===source.id?{...x,name:name.trim(),amount_minor:minor}:x));setNotice("تم تعديل مصدر الدخل.");}}>تعديل</button><button type="button" className="outline" disabled={busy} onClick={async()=>{const active=!source.active;setBusy(true);const {error}=await supabase.from("income_sources").update({active}).eq("id",source.id).eq("user_id",user.id);setBusy(false);if(error){setNotice(errorMessage(error,"تعذر تغيير حالة المصدر."));return;}setIncomeSources(items=>items.map(x=>x.id===source.id?{...x,active}:x));setNotice(active?"تم تفعيل المصدر.":"تم إيقاف المصدر.");}}>{source.active?"إيقاف":"تفعيل"}</button><button type="button" className="outline" disabled={busy} onClick={async()=>{if(!window.confirm("حذف المصدر مع الاحتفاظ بالعمليات الشهرية السابقة؟"))return;setBusy(true);const {error}=await supabase.from("income_sources").delete().eq("id",source.id).eq("user_id",user.id);setBusy(false);if(error){setNotice(errorMessage(error,"تعذر حذف المصدر."));return;}setIncomeSources(items=>items.filter(x=>x.id!==source.id));setNotice("تم حذف المصدر.");}}>حذف</button></div></article>})}</div>}</section>}
        {settingsTab==="الراتب والفترة المالية" && <section className="panel settingsPanel"><h3>الراتب والفترة المالية</h3><form onSubmit={saveMonthStart} className="settingsForm"><label className="settingsLabel">بداية الشهر المالي<select value={monthStartDay} onChange={e=>setMonthStartDay(Number(e.target.value))}>{Array.from({length:28},(_,i)=>i+1).map(day=><option key={day} value={day}>يوم {day} من كل شهر</option>)}</select></label><button className="primary" type="submit" disabled={busy}>{busy?"جارٍ الحفظ...":"حفظ"}</button></form></section>}
        {settingsTab==="التنبيهات والتذكيرات" && <section className="panel settingsPanel"><h3>التنبيهات والتذكيرات</h3><p className="settingsMuted">التنبيهات التلقائية غير مفعلة حاليًا.</p></section>}
        {settingsTab==="المظهر والتخصيص" && <section className="panel settingsPanel"><h3>المظهر</h3><label className="settingsLabel">الثيم<select value={themeMode} onChange={e=>setThemeMode(e.target.value as "light"|"dark"|"system")}><option value="system">حسب إعدادات الهاتف</option><option value="light">فاتح</option><option value="dark">داكن</option></select></label></section>}
      </div>}
      {active==="الميزانيات" && <>{monthPicker()}<section className="panel">
        <div className="panelHead"><div><h3>الميزانيات</h3><p>متابعة الصرف في الفترة المالية المحددة</p></div><button className="primary" onClick={()=>setBudgetForm(v=>!v)}><Plus size={17}/>{budgetForm?"إلغاء":"إضافة ميزانية"}</button></div>
        {budgetForm&&<form onSubmit={saveBudget} style={{display:"grid",gap:14,padding:16,background:"var(--card)",borderRadius:12,marginBottom:18}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
            <label style={{display:"grid",gap:6}}>التصنيف<select required value={budgetCategory} onChange={e=>setBudgetCategory(e.target.value)}><option value="" disabled>اختر تصنيفًا</option>{personalCategories.filter(c=>!c.parent_id&&c.applies_to==="expense").map(parent=><option key={parent.id} value={parent.id}>{parent.name} — التصنيف الرئيسي (يشمل الفروع)</option>)}{personalCategories.filter(c=>c.parent_id&&c.applies_to==="expense").map(child=><option key={child.id} value={child.id}>{personalCategories.find(p=>p.id===child.parent_id)?.name} — {child.name} (تصنيف فرعي)</option>)}</select><small style={{color:"var(--muted)",fontSize:12,lineHeight:1.7}}>اختر تصنيفًا رئيسيًا لاحتساب جميع فروعه، أو تصنيفًا فرعيًا لاحتساب مصروفاته فقط.</small></label>
            <label style={{display:"grid",gap:6}}>اسم الميزانية<input required value={budgetName} onChange={e=>setBudgetName(e.target.value)} placeholder="ميزانية المطاعم"/></label>
            <label style={{display:"grid",gap:6}}>الحد المالي (ر.س)<input required type="number" min="0.01" step="0.01" value={budgetAmount} onChange={e=>setBudgetAmount(e.target.value)} placeholder="1000"/></label>
            <label style={{display:"grid",gap:6}}>الفترة<select value={budgetPeriod} onChange={e=>setBudgetPeriod(e.target.value as "weekly"|"monthly"|"yearly")}><option value="weekly">أسبوعية</option><option value="monthly">شهرية</option><option value="yearly">سنوية</option></select></label>
            <label style={{display:"grid",gap:6}}>تاريخ البداية<input required type="date" value={budgetStart} onChange={e=>setBudgetStart(e.target.value)}/></label>
          </div><p style={{margin:0,color:"var(--muted)",fontSize:13}}>يُحسب الصرف من المصروفات المسجلة في نفس التصنيف وضمن فترة الميزانية.</p>
          <button className="primary" type="submit" disabled={busy} style={{justifyContent:"center"}}>{busy?"جارٍ الحفظ...":"حفظ الميزانية"}</button>
        </form>}
        {budgets.length===0?<p className="empty">ما عندك ميزانيات حاليًا. اضغط «إضافة ميزانية» لإنشاء أول ميزانية من هنا.</p>:<div style={{display:"grid",gap:12}}>{budgets.map(b=>{const spent=budgetSpent(b),limit=Number(b.amount_minor),pct=limit?Math.round(spent/limit*100):0;const rawCat=Array.isArray(b.categories)?b.categories[0]?.name:b.categories?.name;const cat=rawCat||"بدون تصنيف";const selectedBudgetCategory=personalCategories.find(c=>c.id===b.category_id);const isParent=!!selectedBudgetCategory&&!selectedBudgetCategory.parent_id;return <article key={b.id} style={{border:"1px solid var(--line)",borderRadius:12,padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start",flexWrap:"wrap"}}><div><h3 style={{margin:"0 0 6px"}}>{b.name}</h3><p style={{margin:0,color:"var(--muted)",fontSize:13}}>{cat}{isParent?" — يشمل الفروع":""} · {({weekly:"أسبوعية",monthly:"شهرية",yearly:"سنوية"} as Record<string,string>)[b.period]||b.period} · {b.starts_on} إلى {b.ends_on||"مفتوح"}</p></div><button className="close" title="حذف الميزانية" onClick={()=>void deleteBudget(b.id,b.name)}><X size={16}/></button></div>
          <div style={{display:"flex",justifyContent:"space-between",gap:8,marginTop:16,flexWrap:"wrap"}}><span>المصروف: <b>{formatSAR(spent/100)}</b></span><span>الحد: <b>{formatSAR(limit/100)}</b></span><span className={spent>limit?"moneyOut":"moneyIn"}>{spent>limit?"تجاوزت الحد":"المتبقي"}: <b>{formatSAR(Math.abs(limit-spent)/100)}</b></span></div>
          <div className="bar" style={{marginTop:10}}><span style={{width:Math.min(100,pct)+"%",background:spent>limit?"#dc2626":undefined}}/></div><small style={{display:"block",marginTop:6,color:"var(--muted)"}}>{pct}% من الميزانية مستخدم</small>
        </article>})}</div>}
      </section></>}
      {active==="الديون والأقساط" && <>{monthPicker()}<section className="panel">
      <div className="panelHead"><div><h3>الالتزامات والأقساط</h3><p>مواعيد الاستحقاق والمتأخرات والمدفوعات</p></div><button className="primary" onClick={()=>setDebtForm(!debtForm)}><Plus size={17}/>{debtForm?"إلغاء":"إضافة التزام"}</button></div>
      {debtForm&&<form onSubmit={saveDebt} style={{display:"grid",gap:18,padding:20,background:"var(--card)",border:"1px solid var(--line)",borderRadius:16,marginBottom:20}}>
        <div><h3 style={{margin:"0 0 6px"}}>بيانات القسط</h3><p style={{margin:0,color:"var(--muted)",fontSize:13,lineHeight:1.8}}>ينشأ تصنيف تلقائيًا تحت «الأقساط»، ويرتبط به كل سداد لهذا الالتزام.</p></div>
        <div className="switch"><button type="button" className={debtType==="fixed"?"selected":""} onClick={()=>setDebtType("fixed")}>قسط شهري ثابت</button><button type="button" className={debtType==="variable"?"selected":""} onClick={()=>setDebtType("variable")}>دفعات بمواعيد مختلفة</button></div>
        <label style={{display:"grid",gap:6}}>اسم القسط / التصنيف الفرعي<input required value={debtName} onChange={e=>setDebtName(e.target.value)} placeholder="مثال: السيارة، تابي، تمارا"/></label>
        <label style={{display:"grid",gap:6}}>الجهة (اختياري)<input value={debtProvider} onChange={e=>setDebtProvider(e.target.value)} placeholder="مثال: البنك، تابي، تمارا"/></label>
        {debtType==="fixed"?<div style={{display:"grid",gap:14,padding:14,border:"1px solid var(--line)",borderRadius:12}}>
          <label style={{display:"grid",gap:6}}>القسط الشهري (ر.س)<input required type="number" min="0.01" step="0.01" value={debtInstallment} onChange={e=>setDebtInstallment(e.target.value)} placeholder="1365"/></label>
          <label style={{display:"grid",gap:6}}>أول تاريخ استحقاق<input required type="date" value={debtDueDate} onChange={e=>setDebtDueDate(e.target.value)}/></label>
          <label style={{display:"grid",gap:6}}>عدد الأقساط المتبقية<input required type="number" min="1" max="600" value={debtTotalCount} onChange={e=>setDebtTotalCount(e.target.value)}/></label>
          <div style={{padding:14,background:"var(--bg)",border:"1px solid var(--line)",borderRadius:10}}><small style={{display:"block",color:"var(--muted)"}}>إجمالي المبلغ المتبقي</small><strong style={{display:"block",fontSize:24,marginTop:6}}>{Number(debtInstallment)>0&&Number(debtTotalCount)>0?formatSAR(Number(debtInstallment)*Number(debtTotalCount)):"—"}</strong><small style={{color:"var(--muted)"}}>القسط الشهري × عدد الأقساط المتبقية</small></div>
        </div>:<div style={{display:"grid",gap:12,padding:14,border:"1px solid var(--line)",borderRadius:12}}>
          <div><h4 style={{margin:"0 0 5px"}}>جدول الدفعات</h4><p style={{margin:0,color:"var(--muted)",lineHeight:1.8,fontSize:13}}>أضف تاريخ ومبلغ كل دفعة. سيُحسب الإجمالي في نهاية الجدول.</p></div>
          {variableRows.map((row,index)=><div key={index} style={{display:"grid",gap:10,padding:12,border:"1px solid var(--line)",borderRadius:10}}>
            <label style={{display:"grid",gap:6}}>تاريخ الدفعة {index+1}<input required type="date" value={row.due_date} onChange={e=>setVariableRows(rows=>rows.map((r,i)=>i===index?{...r,due_date:e.target.value}:r))}/></label>
            <label style={{display:"grid",gap:6}}>مبلغ الدفعة (ر.س)<input required type="number" min="0.01" step="0.01" value={row.amount} onChange={e=>setVariableRows(rows=>rows.map((r,i)=>i===index?{...r,amount:e.target.value}:r))}/></label>
            <button type="button" className="outline" onClick={()=>setVariableRows(rows=>rows.filter((_,i)=>i!==index))} disabled={variableRows.length===1} aria-label="حذف الدفعة"><X size={16}/> حذف الدفعة</button>
          </div>)}
          <button type="button" className="outline" onClick={addVariableRow}><Plus size={16}/> إضافة دفعة</button>
          <div style={{padding:14,background:"var(--bg)",border:"1px solid var(--line)",borderRadius:10}}><small style={{display:"block",color:"var(--muted)"}}>إجمالي الدفعات</small><strong style={{display:"block",fontSize:24,marginTop:6}}>{formatSAR(variableRows.reduce((sum,row)=>sum+Math.max(0,Number(row.amount)||0),0))}</strong><small style={{color:"var(--muted)"}}>مجموع مبالغ الدفعات أعلاه</small></div>
        </div>}
        <button className="primary" type="submit" disabled={busy} style={{justifyContent:"center"}}>{busy?"جارٍ الحفظ...":"إنشاء القسط وجدول الاستحقاقات"}</button></form>}
      <div className="cards debtStats" style={{gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))"}}><article className="stat debtStatTotal"><span>إجمالي المتبقي</span><strong>{formatSAR(debts.reduce((s,d)=>s+Number(d.current_balance_minor),0)/100)}</strong></article><article className="stat debtStatMonth"><span>إجمالي المتبقي لهذا الشهر</span><strong>{formatSAR(installments.filter(i=>!i.paid_at&&i.due_date>=financialPeriod.start&&i.due_date<=financialPeriod.end).reduce((sum,i)=>sum+Number(i.amount_minor),0)/100)}</strong><small>الأقساط غير المسددة المستحقة خلال الفترة المحددة</small></article><article className="stat debtStatLate"><span>أقساط متأخرة</span><strong className="moneyOut">{installments.filter(i=>!i.paid_at&&i.due_date<riyadhDateKey(new Date())).length}</strong></article><article className="stat debtStatUpcoming"><span>استحقاقات قادمة</span><strong>{installments.filter(i=>!i.paid_at&&i.due_date>=riyadhDateKey(new Date())).length}</strong></article></div>
      {debts.length===0?<p className="empty">ما فيه التزامات مسجلة. أضف القسط الثابت أو خطة تابي/تمارا.</p>:<div style={{display:"grid",gap:16}}>{debts.map(debt=>{const items=installments.filter(i=>i.debt_id===debt.id).sort((x,y)=>x.due_date.localeCompare(y.due_date));const overdue=items.filter(i=>!i.paid_at&&i.due_date<riyadhDateKey(new Date()));const paid=items.filter(i=>!!i.paid_at).length;const open=expandedDebtId===debt.id;return <article key={debt.id} className="debtItem" style={{border:"1px solid var(--line)",borderRadius:14,padding:16,minWidth:0,overflow:"hidden"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",alignItems:"center"}}><div style={{minWidth:0}}><div><h3 style={{margin:"0 0 6px"}}>{debt.name}</h3><button type="button" className="outline" disabled={busy} onClick={async()=>{const name=window.prompt("الاسم الجديد للالتزام",debt.name);if(!user||name===null||!name.trim()||name.trim()===debt.name)return;setBusy(true);const result=await supabase.from("debts").update({name:name.trim()}).eq("id",debt.id).eq("user_id",user.id);setBusy(false);if(result.error){setNotice(errorMessage(result.error,"تعذر تعديل اسم الالتزام."));return;}setDebts(items=>items.map(d=>d.id===debt.id?{...d,name:name.trim()}:d));setNotice("تم تعديل اسم الالتزام دون تغيير الأقساط.");}}>تعديل الاسم</button></div><p style={{margin:0,color:"var(--muted)",fontSize:12,lineHeight:1.8}}>{debt.provider||(debt.debt_type==="fixed"?"قسط ثابت":"دفعات متغيرة")} · {items.length} دفعة · {paid} مسددة · {overdue.length?"متأخر "+overdue.length:"لا توجد متأخرات"}</p></div><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{textAlign:"left"}}><b style={{fontSize:18}}>{formatSAR(Number(debt.current_balance_minor)/100)}</b><small style={{display:"block",color:"var(--muted)"}}>المتبقي</small></div><button className="close" title="حذف الالتزام" onClick={()=>void deleteDebt(debt)}><X size={16}/></button></div></div>
      <button type="button" className="outline" aria-expanded={open} onClick={()=>setExpandedDebtId(open?null:debt.id)} style={{width:"100%",marginTop:12,justifyContent:"space-between",background:"var(--card)",color:"var(--ink)",borderColor:"var(--line)"}}><span>{open?"إخفاء جدول السداد":"عرض جدول السداد"}</span><span>{open?"−":"+"}</span></button>
      {open&&<div className="tableWrap installmentTableWrap" style={{marginTop:12}}><table><thead><tr><th>الدفعة</th><th>تاريخ الاستحقاق</th><th>المبلغ</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody>{items.map(item=>{const status=installmentStatus(item);return <tr key={item.id}><td>{item.installment_number}</td><td>{new Date(item.due_date+"T12:00:00").toLocaleDateString("en-GB-u-ca-gregory-nu-latn",{year:"numeric",month:"short",day:"numeric"})}</td><td>{formatSAR(Number(item.amount_minor)/100)}</td><td><span className={status.className}>{status.label}</span></td><td>{item.paid_at?<div style={{display:"grid",gap:6,justifyItems:"start"}}><span>تم السداد {new Date(item.paid_at).toLocaleDateString("en-GB-u-ca-gregory-nu-latn")}</span><button className="outline" disabled={busy} onClick={()=>void undoInstallmentPayment(item)}>إلغاء السداد</button></div>:<button className="outline" disabled={busy} onClick={()=>void markInstallmentPaid(item)}>تسجيل السداد</button>}</td></tr>})}</tbody></table></div>}</article>})}</div>}
    </section></>}{active==="التقارير والتحليلات" && <>{monthPicker()}<div className="cards reportsStats"><article className="stat reportIncome"><span>إجمالي الدخل</span><div className="statIcon green"><TrendingUp/></div><strong>{formatSAR(income)}</strong><small>{periodTx.filter(t=>t.kind==="income").length} عملية دخل في هذه الفترة</small></article><article className="stat reportExpense"><span>إجمالي المصروفات</span><div className="statIcon red"><TrendingDown/></div><strong>{formatSAR(expense)}</strong><small>{periodTx.filter(t=>t.kind==="expense").length} عملية مصروف في هذه الفترة</small></article><article className="stat reportNet"><span>المتبقي من الدخل</span><div className="statIcon blue"><Wallet/></div><strong>{formatSAR(income-expense)}</strong><small>الدخل ناقص المصروفات</small></article></div>
      <div className="reportsGrid">
        <section className="panel reportCard"><div className="reportTitle"><div><h3>توزيع المصروفات</h3><p>تتغير البيانات حسب مستوى التصنيف والفترة المحددة</p></div><span className="reportPill">حسب التصنيف</span></div><div className="switch" style={{marginBottom:16}}><button type="button" className={reportCategoryLevel==="main"?"selected":""} onClick={()=>setReportCategoryLevel("main")}>التصنيفات الرئيسية</button><button type="button" className={reportCategoryLevel==="sub"?"selected":""} onClick={()=>setReportCategoryLevel("sub")}>التصنيفات الفرعية</button></div>
          {expense>0?<div className="donutLayout"><div className="donutChart" style={{background:reportPieGradient}}><div className="donutHole"><small>إجمالي المصروفات</small><strong>{formatSAR(expense)}</strong></div></div><div className="pieLegend">{reportPieItems.map((item,index)=><div className="pieLegendItem" key={item.name}><span className="legendDot" style={{background:["#36b68b","#5b8def","#f0b44c","#e87979","#a78bfa","#94a3b8"][index%6]}}/><span className="legendName">{item.name}</span><strong>{formatSAR(item.value)}</strong><small>{Math.round(item.value/expense*100)}%</small></div>)}</div></div>:<p className="empty">لا توجد مصروفات مسجلة في هذا الشهر لعرض الرسم.</p>}
        </section>
        <section className="panel reportCard"><div className="reportTitle"><div><h3>الدخل مقابل المصروفات</h3><p>مقارنة آخر 6 أشهر حتى الشهر المحدد</p></div><span className="reportPill">شهري</span></div><div className="barLegend reportLegend"><span><i className="legendDot" style={{background:"#36b68b"}}/> الدخل</span><span><i className="legendDot" style={{background:"#e87979"}}/> المصروفات</span></div><div className="monthlyBars">{reportMonthlyTrend.map(month=><div className={`monthBarGroup ${month.selected?"selected":""}`} key={month.key}><div className="monthBarValues"><span title={`الدخل ${formatSAR(month.income)}`} style={{height:Math.max(month.income>0?3:0,month.income/reportMaxMonth*130),background:"#36b68b"}}/><span title={`المصروفات ${formatSAR(month.expense)}`} style={{height:Math.max(month.expense>0?3:0,month.expense/reportMaxMonth*130),background:"#e87979"}}/></div><small>{month.label}</small></div>)}</div><div className="chartNote">الشهر المحدد محاط بإطار؛ اضغط اختيار الشهر بالأعلى لتغيير التحليل.</div></section>
      </div>
      <section className="panel reportCard reportSummary"><div className="reportTitle"><div><h3>ملخص حسب التصنيف</h3><p>تفاصيل العمليات المسجلة خلال الفترة</p></div></div><div className="tableWrap"><table><thead><tr><th>التصنيف</th><th>عدد العمليات</th><th>الدخل</th><th>المصروفات</th><th>الصافي</th></tr></thead><tbody>{Array.from(new Set(periodTx.map(t=>t.category))).map(cat=>{const rows=periodTx.filter(t=>t.category===cat);const inc=rows.filter(t=>t.kind==="income").reduce((sum,t)=>sum+t.amount,0);const exp=rows.filter(t=>t.kind==="expense").reduce((sum,t)=>sum+t.amount,0);return <tr key={cat}><td>{cat}</td><td>{rows.length}</td><td className="moneyIn">{formatSAR(inc)}</td><td className="moneyOut">{formatSAR(exp)}</td><td>{formatSAR(inc-exp)}</td></tr>})}</tbody></table>{periodTx.length===0&&<p className="empty">لا توجد عمليات في هذه الفترة المالية.</p>}</div></section></>} 
      {active==="استيراد كشف الحساب" && <section className="panel"><h3>استيراد كشف حساب بنكي PDF</h3><p style={{color:"var(--muted)",margin:"8px 0 18px",lineHeight:1.9}}>ارفع كشف الحساب بصيغة PDF مباشرة. سنستخرج العمليات تلقائيًا، وتقدر تراجع المعاينة قبل حفظها في حسابك.</p><label style={{display:"grid",gap:10,maxWidth:520}}>اختيار كشف الحساب PDF<input type="file" accept=".pdf,application/pdf" onChange={e=>{const file=e.target.files?.[0];if(file)void readBankPdf(file);}}/></label>{csvName&&<p style={{marginTop:12}}>الملف: {csvName}</p>}{csvRows.length>0&&<><h3 style={{marginTop:22}}>معاينة قبل الحفظ ({csvRows.length} عملية)</h3><div className="tableWrap"><table><thead><tr><th>التاريخ</th><th>الوصف</th><th>النوع</th><th>المبلغ</th></tr></thead><tbody>{csvRows.slice(0,10).map((row,i)=><tr key={i}><td>{row.date}</td><td>{row.description}</td><td>{row.type==="income"?"دخل":"مصروف"}</td><td>{formatSAR(row.amount)}</td></tr>)}</tbody></table></div><button className="primary" style={{marginTop:16}} disabled={busy} onClick={()=>void importCsv()}>{busy?"جارٍ الاستيراد...":`حفظ ${csvRows.length} عملية في حسابك`}</button></>}</section>}
      <footer>ميزانيتي © ٢٠٢٦ <span>حفظ سحابي عبر Supabase</span></footer></section>{modal&&<div className="overlay" onClick={()=>setModal(false)}><section className="modal" onClick={e=>e.stopPropagation()}><div className="modalHead"><div><h2>{kind==="income"?"إضافة دخل":"إضافة مصروف"}</h2><p>{kind==="income"?"سجّل مصدر دخلك":isRefund?"سجّل استرجاع مصروف":"سجّل مصروفك"}</p></div><button className="close" onClick={()=>setModal(false)}><X/></button></div><form onSubmit={add}><div className="switch" style={{marginBottom:14}}><button type="button" className={kind==="expense"?"selected":""} onClick={()=>{setKind("expense");setIsRefund(false);}}>مصروف</button><button type="button" className={kind==="income"?"selected":""} onClick={()=>{setKind("income");setIsRefund(false);}}>دخل</button></div>{kind==="expense"&&<label style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,padding:12,border:"1px solid var(--line)",borderRadius:10}}><input type="checkbox" checked={isRefund} onChange={e=>setIsRefund(e.target.checked)} style={{width:18,height:18}}/><span><b>عملية استرجاع</b><small style={{display:"block",color:"var(--muted)"}}>ستُسجّل كعملية مصروف بمبلغ سالب.</small></span></label>}{kind==="expense"?<><label>التصنيف الرئيسي<select required value={mainCategory} onChange={e=>{const next=e.target.value;setMainCategory(next);const child=personalCategories.find(c=>c.parent_id===next);setCategory(child?.name||personalCategories.find(c=>c.id===next)?.name||"");}}>{personalCategories.filter(c=>!c.parent_id&&c.applies_to==="expense").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><small style={{display:"block",marginTop:6,color:"var(--muted)",fontSize:12}}>يمكنك إضافة أو حذف تصنيف من صفحة الإعدادات.</small></label>{personalCategories.some(c=>c.parent_id===mainCategory)&&<label>التصنيف الفرعي<select required value={category} onChange={e=>setCategory(e.target.value)}>{personalCategories.filter(c=>c.parent_id===mainCategory).map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label>}</>:<label>التصنيف<select value={category} onChange={e=>setCategory(e.target.value)}>{incomeCategories.map(c=><option key={c} value={c}>{c}</option>)}</select></label>}<label>المبلغ بالريال<input required type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/></label><label>ملاحظات (اختياري)<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="مثال: فاتورة الكهرباء لشهر أكتوبر" rows={2}/></label><button className="primary full" disabled={busy} type="submit">{busy?"جارٍ الحفظ...":"حفظ العملية"}</button></form></section></div>}</main>;
}
