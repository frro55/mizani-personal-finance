"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Wallet, Plus, TrendingUp, TrendingDown, Search, X, Menu, ShieldCheck, CreditCard, ChartNoAxesCombined, LayoutDashboard, ReceiptText, Target, FileUp, LogOut } from "lucide-react";
import { formatSAR } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

type Tx = { id: string; title: string; category: string; date: string; amount: number; kind: "income" | "expense" };
type TransactionRow = { id: string; type: "income" | "expense"; amount_minor: number | string; occurred_at: string; description: string | null; categories: { name: string } | { name: string }[] | null };
function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
const nav = [["نظرة عامة",LayoutDashboard],["العمليات المالية",ReceiptText],["الميزانيات",Target],["الديون والأقساط",CreditCard],["التقارير والتحليلات",ChartNoAxesCombined],["استيراد كشف الحساب",FileUp]] as const;

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
  const [title,setTitle] = useState("");
  const [amount,setAmount] = useState("");
  const [category,setCategory] = useState("متفرقات");
  const [active,setActive] = useState("نظرة عامة");
  const [menu,setMenu] = useState(false);
  const [notice,setNotice] = useState("");

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
      setAccountId(aid);
      const {data,error} = await supabase.from("transactions").select("id,type,amount_minor,occurred_at,description,categories(name)").eq("user_id",uid).order("occurred_at",{ascending:false});
      if (error) throw error;
      setTx(((data ?? []) as unknown as TransactionRow[]).map((row) => ({id:row.id,title:row.description || "عملية مالية",category:Array.isArray(row.categories) ? row.categories[0]?.name || "متفرقات" : row.categories?.name || "متفرقات",date:String(row.occurred_at).slice(0,10),amount:Number(row.amount_minor)/100,kind:row.type})));
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
    if(!title.trim()||!Number.isFinite(n)||n<=0)return;
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
      const {error} = await supabase.from("transactions").insert({user_id:user.id,account_id:accountId,category_id:categoryId,type:kind,amount_minor:Math.round(n*100),description:title.trim(),occurred_at:new Date().toISOString()});
      if(error) throw error;
      await loadTransactions(user.id);
      setTitle("");setAmount("");setCategory("متفرقات");setModal(false);setNotice("تم حفظ العملية في قاعدة البيانات.");
    } catch(e:unknown) {setNotice(errorMessage(e, "تعذر حفظ العملية."));}
    finally {setBusy(false);}
  }

  const income=useMemo(()=>tx.filter(t=>t.kind==="income").reduce((s,t)=>s+t.amount,0),[tx]);
  const expense=useMemo(()=>tx.filter(t=>t.kind==="expense").reduce((s,t)=>s+t.amount,0),[tx]);
  const filtered=tx.filter(t=>(t.title+" "+t.category).includes(search));

  if(!authReady) return <main className="shell" style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24}}>جارٍ الاتصال...</main>;
  if(!user) return <main className="shell" style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,direction:"rtl"}}><section className="panel" style={{width:"100%",maxWidth:440,padding:28}}><div className="brand" style={{marginBottom:24}}><div className="brandIcon"><Wallet/></div><div><b>ميزانيتي</b><small>إدارة أموالك بوضوح</small></div></div><h1 style={{fontSize:24,marginBottom:8}}>{authMode==="signin"?"تسجيل الدخول":"إنشاء حساب جديد"}</h1><p style={{marginBottom:20,color:"var(--muted,#64748b)"}}>سجّل دخولك لحفظ عملياتك المالية بشكل آمن.</p><form onSubmit={submitAuth} style={{display:"grid",gap:14}}><label>البريد الإلكتروني<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" /></label><label>كلمة المرور<input required type="password" minLength={6} autoComplete={authMode==="signin"?"current-password":"new-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="6 أحرف على الأقل" /></label><button className="primary full" disabled={busy} type="submit">{busy?"جارٍ التنفيذ...":authMode==="signin"?"دخول":"إنشاء الحساب"}</button></form>{authMessage&&<p role="status" style={{marginTop:16,overflowWrap:"anywhere"}}>{authMessage}</p>}<button className="outline" style={{width:"100%",marginTop:16}} onClick={()=>{setAuthMode(authMode==="signin"?"signup":"signin");setAuthMessage("");}}>{authMode==="signin"?"ليس لديك حساب؟ أنشئ حسابًا":"لديك حساب؟ سجّل الدخول"}</button></section></main>;

  return <main className="shell"><aside className={menu?"sidebar open":"sidebar"}><div className="brand"><div className="brandIcon"><Wallet/></div><div><b>ميزانيتي</b><small>إدارة أموالك بوضوح</small></div><button className="close mobile" onClick={()=>setMenu(false)}><X/></button></div><p className="muted navTitle">القائمة الرئيسية</p><nav>{nav.map(([label,Icon])=><button key={label} onClick={()=>{setActive(label);setMenu(false)}} className={active===label?"nav active":"nav"}><Icon size={19}/>{label}{label==="استيراد كشف الحساب"&&<span className="csv">CSV</span>}</button>)}</nav><div className="sideBottom"><div className="privacy"><ShieldCheck/><div><b>بياناتك خاصة</b><small>محفوظة في حسابك</small></div></div><p style={{overflowWrap:"anywhere"}}>{user.email}<small>الريال السعودي · SAR</small></p><button className="outline" onClick={()=>void supabase.auth.signOut()}><LogOut size={16}/> تسجيل الخروج</button></div></aside><section className="main"><header className="top"><button className="menuBtn mobile" onClick={()=>setMenu(true)}><Menu/></button><div><h1>{active}</h1><p>تابع وضعك المالي واتخذ قرارات أوضح.</p></div><button className="primary" onClick={()=>setModal(true)}><Plus size={18}/> إضافة عملية</button></header>{notice&&<p role="status" style={{padding:12,margin:"8px 0",borderRadius:10,background:"#eef6ff",overflowWrap:"anywhere"}}>{notice}</p>}<div className="welcome"><div><span className="eyebrow">ملخصك المالي</span><h2>أهلًا بك في ميزانيتي 👋</h2><p>ملخص العمليات المحفوظة في حسابك.</p></div><div className="month">{new Date().toLocaleDateString("ar-SA",{month:"long",year:"numeric"})}</div></div><div className="cards"><article className="stat"><span>إجمالي الدخل</span><div className="statIcon green"><TrendingUp/></div><strong>{formatSAR(income)}</strong><small>من عملياتك المسجلة</small></article><article className="stat"><span>إجمالي المصروفات</span><div className="statIcon red"><TrendingDown/></div><strong>{formatSAR(expense)}</strong><small>من عملياتك المسجلة</small></article><article className="stat"><span>الصافي</span><div className="statIcon blue"><Wallet/></div><strong>{formatSAR(income-expense)}</strong><small>الدخل ناقص المصروفات</small></article></div><div className="contentGrid"><section className="panel"><div className="panelHead"><div><h3>آخر العمليات</h3><p>{busy?"جارٍ تحديث البيانات...":"العمليات المحفوظة"}</p></div><label className="search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث عن عملية"/></label></div><div className="tableWrap"><table><thead><tr><th>العملية</th><th>التصنيف</th><th>التاريخ</th><th>المبلغ</th></tr></thead><tbody>{filtered.map(t=><tr key={t.id}><td><b>{t.title}</b></td><td><span className="tag">{t.category}</span></td><td>{t.date}</td><td className={t.kind==="income"?"moneyIn":"moneyOut"}>{t.kind==="income"?"+":"−"}{formatSAR(t.amount)}</td></tr>)}</tbody></table>{filtered.length===0&&<p className="empty">{busy?"جارٍ تحميل العمليات...":"لا توجد عمليات محفوظة بعد."}</p>}</div></section><aside className="panel sidePanel"><h3>نظرة سريعة</h3><p>المصروفات مقارنة بالدخل</p><div className="bar"><span style={{width:(income?Math.min(100,expense/income*100):0)+"%"}}/></div><div className="barLegend"><span>نسبة المصروفات</span><b>{income?Math.round(expense/income*100):0}%</b></div><div className="note"><ShieldCheck size={20}/><div><b>خصوصيتك مهمة</b><p>كل مستخدم يصل إلى عملياته فقط عبر سياسات قاعدة البيانات.</p></div></div><button className="outline" onClick={()=>setModal(true)}><Plus size={17}/> تسجيل عملية جديدة</button></aside></div><footer>ميزانيتي © ٢٠٢٦ <span>حفظ سحابي عبر Supabase</span></footer></section>{modal&&<div className="overlay" onClick={()=>setModal(false)}><section className="modal" onClick={e=>e.stopPropagation()}><div className="modalHead"><div><h2>إضافة عملية مالية</h2><p>سجّل دخلك أو مصروفك</p></div><button className="close" onClick={()=>setModal(false)}><X/></button></div><form onSubmit={add}><div className="switch"><button type="button" className={kind==="expense"?"selected":""} onClick={()=>setKind("expense")}>مصروف</button><button type="button" className={kind==="income"?"selected":""} onClick={()=>setKind("income")}>دخل</button></div><label>اسم العملية<input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="مثال: فاتورة الكهرباء"/></label><label>المبلغ بالريال<input required type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/></label><label>التصنيف<select value={category} onChange={e=>setCategory(e.target.value)}>{["متفرقات","راتب","منزل","طعام ومقاهي","سيارة","أقساط","فواتير","صحة","ترفيه","تسوق"].map(c=><option key={c}>{c}</option>)}</select></label><button className="primary full" disabled={busy} type="submit">{busy?"جارٍ الحفظ...":"حفظ العملية"}</button></form></section></div>}</main>;
}
