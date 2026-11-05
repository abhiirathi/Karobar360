// Reads the XML that TallyPrime returns for the connector's Group and Ledger collections.
// Tally writes debit balances as negative numbers and credit balances as positive.
import type { TallyData } from "@/lib/stone/types";

const dec = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#13;|&#10;/g, " ").trim();
const tag = (block: string, t: string) => { const m = new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, "i").exec(block); return m ? dec(m[1]) : ""; };
const num = (s: string) => { const v = parseFloat(String(s).replace(/[^0-9.\-]/g, "")); return isFinite(v) ? v : 0; };

type Row = { name: string; parent: string; closing: number };

export function rows(xml: string, kind: "GROUP" | "LEDGER"): Row[] {
  const out: Row[] = [];
  const re = new RegExp(`<${kind}\\b([^>]*)>([\\s\\S]*?)</${kind}>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const attr = /NAME="([^"]*)"/i.exec(m[1]);
    const name = attr ? dec(attr[1]) : tag(m[2], "NAME");
    if (!name) continue;
    out.push({ name, parent: tag(m[2], "PARENT"), closing: num(tag(m[2], "CLOSINGBALANCE")) });
  }
  return out;
}

const SALES = "sales accounts", PURCHASE = "purchase accounts", INDIRECT = "indirect expenses", DEBTORS = "sundry debtors",
  CREDITORS = "sundry creditors", CASH = "cash-in-hand", BANK = "bank accounts", TAXES = "duties & taxes";

export function compute(input: { company?: string; months: { m: string; to: string; xml: string }[]; ledgers: string; groups: string }): TallyData {
  const parentOf = new Map<string, string>();
  for (const g of rows(input.groups, "GROUP")) parentOf.set(g.name.toLowerCase(), g.parent.toLowerCase());
  const under = (group: string, top: string) => {
    let g = group.toLowerCase();
    for (let i = 0; i < 20 && g; i++) { if (g === top) return true; g = parentOf.get(g) ?? ""; }
    return false;
  };

  const ms = [...input.months].sort((a, b) => a.m.localeCompare(b.m));
  const gval = (xml: string, name: string) => rows(xml, "GROUP").find((g) => g.name.toLowerCase() === name)?.closing ?? 0;
  const fy = (m: string) => { const [y, mo] = m.split("-").map(Number); return mo >= 4 ? y : y - 1; };
  const months: TallyData["months"] = [];
  for (let i = 0; i < ms.length; i++) {
    const cur = ms[i], prev = ms[i - 1];
    const same = prev && fy(prev.m) === fy(cur.m);
    const s = gval(cur.xml, SALES), p = -gval(cur.xml, PURCHASE), e = -gval(cur.xml, INDIRECT);
    const s0 = same ? gval(prev.xml, SALES) : 0, p0 = same ? -gval(prev.xml, PURCHASE) : 0, e0 = same ? -gval(prev.xml, INDIRECT) : 0;
    if (i === 0 && ms.length > 1) continue; // first month is only the baseline
    months.push({ m: cur.m, sales: Math.round(s - s0), purchases: Math.round(p - p0), expenses: Math.round(e - e0) });
  }

  const latest = ms[ms.length - 1]?.xml ?? "";
  const led = rows(input.ledgers, "LEDGER");
  const debtors = led.filter((l) => under(l.parent, DEBTORS)).map((l) => ({ name: l.name, amount: -l.closing }));
  const creditors = led.filter((l) => under(l.parent, CREDITORS)).map((l) => ({ name: l.name, amount: l.closing }));
  return {
    syncedAt: new Date().toISOString(),
    company: input.company ?? "",
    months,
    receivables: Math.round(-gval(latest, DEBTORS)),
    payables: Math.round(gval(latest, CREDITORS)),
    cashBank: Math.round(-(gval(latest, CASH) + gval(latest, BANK))),
    gstPayable: Math.round(gval(latest, TAXES)),
    topDebtors: debtors.filter((d) => d.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 5).map((d) => ({ ...d, amount: Math.round(d.amount) })),
    topCreditors: creditors.filter((d) => d.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 5).map((d) => ({ ...d, amount: Math.round(d.amount) })),
  };
}
