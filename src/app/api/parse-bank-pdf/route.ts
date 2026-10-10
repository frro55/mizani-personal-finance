import { NextResponse } from "next/server";
import pdf from "pdf-parse";

export const runtime = "nodejs";

function parseAmount(value: string) {
  return Number(value.replace(/,/g, ""));
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "ارفع ملف كشف حساب بصيغة PDF." }, { status: 400 });
    }
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "حجم الملف يتجاوز 15 ميجابايت." }, { status: 413 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await pdf(buffer);
    const text = parsed.text.replace(/\u00a0/g, " ");
    const dateRegex = /\b(20\d{2})\/(\d{2})\/(\d{2})\b/g;
    const dates = [...text.matchAll(dateRegex)];
    const rows: { date: string; description: string; amount: number; type: "income" | "expense" }[] = [];
    for (let i = 0; i < dates.length; i++) {
      const match = dates[i];
      const previous = i > 0 ? dates[i - 1] : null;\n      const start = previous ? (previous.index ?? 0) + previous[0].length : Math.max(0, (match.index ?? 0) - 800);
      const end = (match.index ?? 0) + match[0].length;
      const chunk = text.slice(start, end);
      const amounts = [...chunk.matchAll(/(\d{1,3}(?:,\d{3})*|\d+)\.\d{2}\s*(?:SAR)?/g)]
        .map(m => parseAmount(m[1] + "." + m[0].split(".")[1].slice(0,2)));
      if (amounts.length < 3) continue;
      const balance = amounts[amounts.length - 3];
      const credit = amounts[amounts.length - 2];
      const debit = amounts[amounts.length - 1];
      const amount = credit > 0 ? credit : debit;
      if (!(amount > 0) || !Number.isFinite(amount)) continue;
      const date = `${match[1]}-${match[2]}-${match[3]}`;
      const dateIndex = match.index ?? 0;
      const descriptionText = chunk;
      const lines = descriptionText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      const description = lines.slice(-5).join(" ").replace(/\d{1,3}(?:,\d{3})*\.\d{2}\s*(?:SAR)?/g, " ").replace(/Ref\. No.*$/i, "").replace(/\s+/g, " ").trim().slice(-240) || "عملية من كشف البنك";
      const type = credit > 0 ? "income" : "expense";
      rows.push({ date, description, amount, type });
    }
    const unique = rows.filter((row, index) => rows.findIndex(other => other.date === row.date && other.amount === row.amount && other.type === row.type && other.description === row.description) === index);
    if (!unique.length) return NextResponse.json({ error: "لم أستطع استخراج العمليات من هذا الملف. تأكد أنه كشف حساب PDF نصي صادر من البنك." }, { status: 422 });
    return NextResponse.json({ rows: unique, pages: parsed.numpages });
  } catch {
    return NextResponse.json({ error: "تعذر قراءة ملف PDF. جرّب تنزيل الكشف من البنك مباشرة بصيغة PDF ثم أعد المحاولة." }, { status: 400 });
  }
}
