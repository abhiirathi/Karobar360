"use client";
import { useEffect, useMemo, useState } from "react";
import { Download, KeyRound, MonitorDown, RefreshCw } from "lucide-react";
import { ChartBody } from "@/components/Charts";
import { lakh, rs, today } from "@/lib/stone/calc";
import { tallyOf } from "@/lib/stone/modules";
import { TALLY_METRICS, mastersXml, purchasesOf, purchasesXml, salesXml } from "@/lib/stone/tally";
import type { TallyData, TallySettings } from "@/lib/stone/types";
import type { ChartSpec } from "@/lib/types";
import type { Ctx } from "./StoneApp";
import { F, Grid, Note, NumIn, Section, Seg, Stat, TextIn } from "./ui";

type Tab = "figures" | "export" | "connect";

const monthLabel = (m: string) => { const [y, mo] = m.split("-").map(Number); return new Date(y, mo - 1, 1).toLocaleString("en-IN", { month: "short", year: "2-digit" }); };

export function tallyFigure(t: TallyData, key: string): { label: string; value: string; sub?: string } | null {
  const last = t.months[t.months.length - 1];
  const prev = t.months[t.months.length - 2];
  const fyStart = (() => { const d = new Date(); return `${d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1}-04`; })();
  const fy = t.months.filter((m) => m.m >= fyStart);
  switch (key) {
    case "salesMonth": return last ? { label: "Sales this month", value: lakh(last.sales), sub: prev ? `${lakh(prev.sales)} last month` : undefined } : null;
    case "salesFy": return { label: "Sales this financial year", value: lakh(fy.reduce((a, m) => a + m.sales, 0)), sub: `${fy.length} months` };
    case "purchasesMonth": return last ? { label: "Purchases this month", value: lakh(last.purchases), sub: prev ? `${lakh(prev.purchases)} last month` : undefined } : null;
    case "expensesMonth": return last ? { label: "Indirect expenses this month", value: lakh(last.expenses) } : null;
    case "receivables": return { label: "Receivables", value: lakh(t.receivables), sub: "Sundry debtors in Tally" };
    case "payables": return { label: "Payables", value: lakh(t.payables), sub: "Sundry creditors in Tally" };
    case "cashBank": return { label: "Cash and bank", value: lakh(t.cashBank), sub: "Cash-in-hand + bank accounts" };
    case "gstPayable": return { label: "Duties and taxes", value: lakh(t.gstPayable), sub: "Balance in Tally" };
    default: return null;
  }
}

export function TallyPanel({ t, show }: { t: TallyData; show: string[] }) {
  const figs = show.map((k) => tallyFigure(t, k)).filter(Boolean) as { label: string; value: string; sub?: string }[];
  const chart: ChartSpec = {
    id: "tally", title: "Sales and purchases in Tally", kind: "bar", unit: "inr", xKey: "m",
    data: t.months.map((m) => ({ m: monthLabel(m.m), sales: m.sales, purchases: m.purchases })),
    series: [{ key: "sales", label: "Sales", tone: "accent" }, { key: "purchases", label: "Purchases", tone: "faint" }],
  };
  return (
    <div className="space-y-4">
      {!!figs.length && <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{figs.map((f) => <Stat key={f.label} label={f.label} value={f.value} sub={f.sub} />)}</div>}
      {(show.includes("salesTrend") || show.includes("topDebtors")) && (
        <div className="grid gap-4 lg:grid-cols-3">
          {show.includes("salesTrend") && <div className={`rounded-2xl bg-surface p-5 ${show.includes("topDebtors") ? "lg:col-span-2" : "lg:col-span-3"}`}><h3 className="mb-3 font-medium">Sales and purchases, from Tally</h3><ChartBody spec={chart} height={240} /></div>}
          {show.includes("topDebtors") && (
            <div className="rounded-2xl bg-surface p-5">
              <h3 className="font-medium">Who owes the most</h3>
              <ul className="mt-3 divide-y divide-surface-2 text-[0.9rem]">
                {t.topDebtors.map((d) => <li key={d.name} className="flex justify-between gap-3 py-2"><span className="truncate">{d.name}</span><span className="num font-medium">{rs(d.amount)}</span></li>)}
                {!t.topDebtors.length && <li className="py-3 text-ink-3">No customer balances in Tally.</li>}
              </ul>
            </div>
          )}
        </div>
      )}
      <div className="text-[0.8rem] text-ink-3">From Tally{t.company ? ` · ${t.company}` : ""} · updated {new Date(t.syncedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
    </div>
  );
}

export default function TallyView({ ctx }: { ctx: Ctx }) {
  const { db, update } = ctx;
  const T = tallyOf(db);
  const editable = ctx.edit("tally");
  const [tab, setTab] = useState<Tab>((ctx.sub as Tab) || (db.tally ? "figures" : editable ? "connect" : "figures"));
  const tabs = ([{ key: "figures", label: "Figures from Tally" }, { key: "export", label: "Export to Tally" }, { key: "connect", label: "Connect Tally" }] as { key: Tab; label: string }[]).filter((x) => editable || x.key === "figures");
  const setCfg = (patch: Partial<TallySettings>) => update((d) => { d.tallyCfg = { ...tallyOf(d), ...patch }; });

  return (
    <div className="max-w-[1100px]">
      {tabs.length > 1 && <Seg value={tab} onChange={setTab} tabs={tabs} />}
      <div className="mt-5">
        {tab === "figures" && <Figures ctx={ctx} T={T} setCfg={setCfg} editable={editable} />}
        {tab === "export" && editable && <Export ctx={ctx} T={T} setCfg={setCfg} />}
        {tab === "connect" && editable && <Connect ctx={ctx} />}
      </div>
    </div>
  );
}

function Figures({ ctx, T, setCfg, editable }: { ctx: Ctx; T: TallySettings; setCfg: (p: Partial<TallySettings>) => void; editable: boolean }) {
  const t = ctx.db.tally;
  if (!t) {
    return <Note>{editable ? "No figures from Tally yet. Set up the connector on the Tally computer from “Connect Tally”. Figures appear here within 15 minutes of the first run." : "No figures from Tally yet. Your owner or accountant can connect Tally."}</Note>;
  }
  const toggle = (k: string) => setCfg({ show: T.show.includes(k) ? T.show.filter((x) => x !== k) : [...T.show, k] });
  return (
    <div className="space-y-8">
      <TallyPanel t={t} show={TALLY_METRICS.map((m) => m.key)} />
      {editable && (
        <Section title="Show on the dashboard">
          <p className="-mt-1 mb-3 text-[0.9rem] text-ink-2">Pick the Tally figures that appear on the Overview. Only people with access to Tally see them.</p>
          <div className="flex flex-wrap gap-1.5">
            {TALLY_METRICS.map((m) => <button key={m.key} className="chip" data-on={T.show.includes(m.key)} onClick={() => toggle(m.key)}>{m.label}</button>)}
          </div>
        </Section>
      )}
    </div>
  );
}

function download(name: string, text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/xml" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function Export({ ctx, T, setCfg }: { ctx: Ctx; T: TallySettings; setCfg: (p: Partial<TallySettings>) => void }) {
  const { db } = ctx;
  const d = new Date();
  const first = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(today());
  const r = { from, to };
  const nSales = db.sales.filter((s) => s.date >= from && s.date <= to).length;
  const nPurch = useMemo(() => purchasesOf(db, r).length, [db, from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  const tag = `${from}_to_${to}`;
  const parties = db.parties.filter((p) => p.kind !== "transporter");
  const [names, setNames] = useState<Record<string, string>>(T.partyNames);
  useEffect(() => setNames(T.partyNames), [T.partyNames]);

  return (
    <div className="space-y-8">
      <Section title="Period">
        <Grid cols={3}>
          <F label="From"><TextIn type="date" value={from} onChange={setFrom} /></F>
          <F label="To"><TextIn type="date" value={to} onChange={setTo} /></F>
        </Grid>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <button className="btn btn-quiet justify-center" onClick={() => download(`karobar360_ledgers_${tag}.xml`, mastersXml(db, r).xml)}><Download size={15} />1. Ledgers</button>
          <button className="btn btn-primary justify-center" disabled={!nSales} onClick={() => download(`karobar360_sales_${tag}.xml`, salesXml(db, r).xml)}><Download size={15} />2. Sales · {nSales}</button>
          <button className="btn btn-primary justify-center" disabled={!nPurch} onClick={() => download(`karobar360_purchases_${tag}.xml`, purchasesXml(db, r).xml)}><Download size={15} />3. Purchases · {nPurch}</button>
        </div>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-[0.9rem] text-ink-2">
          <li>In TallyPrime open the company, then Gateway of Tally → Import → Masters, and pick the ledgers file. Choose “Ignore duplicates” so existing ledgers are kept.</li>
          <li>Then Import → Transactions (Vouchers) and pick the sales file, then the purchases file.</li>
          <li>Each invoice comes in as an accounting voucher with the party, sales or purchase ledger, CGST and SGST or IGST, freight and round-off. Bill-wise details use the invoice number.</li>
        </ol>
        <div className="mt-3"><Note>Import one week first and compare a few vouchers in the Day Book before bringing in a full month.</Note></div>
      </Section>

      <Section title="Ledger names in your Tally">
        <Grid cols={3}>
          <F label="Company name in Tally" hint="Leave empty to use the open company"><TextIn value={T.company} onChange={(v) => setCfg({ company: v })} /></F>
          <F label="Slab sales ledger"><TextIn value={T.salesLedger} onChange={(v) => setCfg({ salesLedger: v })} /></F>
          <F label="Block sales ledger"><TextIn value={T.blockSalesLedger} onChange={(v) => setCfg({ blockSalesLedger: v })} /></F>
          <F label="Purchase ledger"><TextIn value={T.purchaseLedger} onChange={(v) => setCfg({ purchaseLedger: v })} /></F>
          <F label="Stores purchase ledger"><TextIn value={T.storesLedger} onChange={(v) => setCfg({ storesLedger: v })} /></F>
          <F label="Freight ledger"><TextIn value={T.freightLedger} onChange={(v) => setCfg({ freightLedger: v })} /></F>
          <F label="GST on blocks bought"><NumIn value={T.blockGst} onChange={(v) => setCfg({ blockGst: v })} suffix="%" /></F>
          <F label="Output CGST"><TextIn value={T.cgstOut} onChange={(v) => setCfg({ cgstOut: v })} /></F>
          <F label="Output SGST"><TextIn value={T.sgstOut} onChange={(v) => setCfg({ sgstOut: v })} /></F>
          <F label="Output IGST"><TextIn value={T.igstOut} onChange={(v) => setCfg({ igstOut: v })} /></F>
          <F label="Input CGST"><TextIn value={T.cgstIn} onChange={(v) => setCfg({ cgstIn: v })} /></F>
          <F label="Input SGST"><TextIn value={T.sgstIn} onChange={(v) => setCfg({ sgstIn: v })} /></F>
          <F label="Input IGST"><TextIn value={T.igstIn} onChange={(v) => setCfg({ igstIn: v })} /></F>
        </Grid>
      </Section>

      <Section title="Party names in Tally" aside={<button className="btn btn-quiet btn-sm" onClick={() => setCfg({ partyNames: Object.fromEntries(Object.entries(names).filter(([, v]) => v.trim())) })}>Save names</button>}>
        <p className="-mt-1 mb-3 text-[0.9rem] text-ink-2">Fill only where the ledger in Tally is spelt differently, so vouchers land on the right party.</p>
        <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
          {parties.map((p) => (
            <label key={p.id} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-[0.9rem]">{p.company}<span className="block text-[0.76rem] text-ink-3">{p.kind === "customer" ? "Customer" : "Supplier"} · {p.city}</span></span>
              <input className="field !w-[48%]" placeholder="Same as here" value={names[p.id] ?? ""} onChange={(e) => setNames({ ...names, [p.id]: e.target.value })} />
            </label>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Connect({ ctx }: { ctx: Ctx }) {
  const [rotated, setRotated] = useState(false);
  if (ctx.mode === "demo") return <Note>Connecting Tally needs a company account. In the demo, use “Export to Tally” to see the files.</Note>;
  const rotate = async () => {
    const r = await fetch("/api/stone/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rotate: "tally" }) });
    if (r.ok) { setRotated(true); ctx.say("Old connector switched off. Download the new one.", "good"); }
  };
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-surface p-5">
        <div className="flex items-start gap-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><MonitorDown size={18} /></div>
          <div>
            <h3 className="font-semibold">Send figures from Tally every 15 minutes</h3>
            <p className="mt-1 max-w-[70ch] text-[0.92rem] text-ink-2">A small script runs on the computer where Tally is open. It asks Tally for monthly sales, purchases, expenses, debtors, creditors and cash and bank balances, and sends only those totals here. Vouchers stay in Tally.</p>
            <a href="/api/tally/script" className="btn btn-primary btn-sm mt-4"><Download size={14} />Download the connector</a>
          </div>
        </div>
      </div>
      <ol className="list-decimal space-y-2 pl-5 text-[0.92rem] text-ink-2">
        <li>In TallyPrime press F1 (Help) → Settings → Connectivity → Client/Server configuration. Set “TallyPrime acts as” to <b>Both</b>, port <b>9000</b>. In Tally.ERP 9 this is F12 → Advanced Configuration.</li>
        <li>Make a folder <code className="rounded bg-surface-2 px-1">C:\Karobar360</code> and save the downloaded <code className="rounded bg-surface-2 px-1">karobar360-tally.ps1</code> in it.</li>
        <li>Test it once: open Command Prompt and run<br /><code className="mt-1 block overflow-x-auto rounded-lg bg-surface-2 px-3 py-2 text-[0.82rem]">powershell -ExecutionPolicy Bypass -File C:\Karobar360\karobar360-tally.ps1</code>It should say “Tally figures updated”. Refresh this page to see them.</li>
        <li>Make it run every 15 minutes:<br /><code className="mt-1 block overflow-x-auto rounded-lg bg-surface-2 px-3 py-2 text-[0.82rem]">schtasks /create /sc minute /mo 15 /tn &quot;Karobar360 Tally&quot; /tr &quot;powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File C:\Karobar360\karobar360-tally.ps1&quot;</code></li>
      </ol>
      <Note>The connector carries a private key for your company. If a computer is lost or a staff member leaves, reset the key and set up the new file.</Note>
      <button className="btn btn-quiet btn-sm" onClick={rotate}>{rotated ? <RefreshCw size={14} /> : <KeyRound size={14} />}{rotated ? "Key reset" : "Reset connector key"}</button>
    </div>
  );
}
