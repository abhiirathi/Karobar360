"use client";
import { useEffect, useMemo, useState } from "react";
import { Download, KeyRound, RefreshCw } from "lucide-react";
import { ChartBody } from "@/components/Charts";
import { lakh, rs, today } from "@/lib/stone/calc";
import { tallyOf } from "@/lib/stone/modules";
import { tallyOfFirm } from "@/lib/stone/firms";
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
    if (ctx.root.tally && ctx.firm) return <Note>None of the companies in Tally is matched to {ctx.firm.name}.{editable ? " Pick its Tally company under “Connect Tally”." : ""}</Note>;
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
  const parties = db.parties.filter((p) => p.kind === "customer" || p.kind === "supplier" || p.kind === "vendor");
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
              <span className="min-w-0 flex-1 truncate text-[0.9rem]">{p.company}<span className="block text-[0.76rem] text-ink-3">{p.kind === "customer" ? "Customer" : p.kind === "vendor" ? "Vendor" : "Supplier"} · {p.city}</span></span>
              <input className="field !w-[48%]" placeholder="Same as here" value={names[p.id] ?? ""} onChange={(e) => setNames({ ...names, [p.id]: e.target.value })} />
            </label>
          ))}
        </div>
      </Section>
    </div>
  );
}

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

function Connect({ ctx }: { ctx: Ctx }) {
  const [rotated, setRotated] = useState(false);
  const [more, setMore] = useState(false);
  const [steps, setSteps] = useState(false);
  if (ctx.mode === "demo") return <Note>Connecting Tally needs a company account. In the demo, use “Export to Tally” to see the files.</Note>;
  const t = ctx.root.tally;
  const fresh = t ? Date.now() - new Date(t.syncedAt).getTime() < 40 * 60000 : false;
  const companies = t ? (t.companies?.length ? t.companies : [t]).map((c) => c.company).filter(Boolean) : [];
  const T = tallyOf(ctx.root);
  const map = T.firmCompany ?? {};
  const setMap = (firmId: string, name: string) => ctx.update((d) => { const c = tallyOf(d); d.tallyCfg = { ...c, firmCompany: { ...(c.firmCompany ?? {}), [firmId]: name } }; });
  const rotate = async () => {
    const r = await fetch("/api/stone/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rotate: "tally" }) });
    if (r.ok) { setRotated(true); ctx.say("Old connector switched off. Download and run the new one.", "good"); }
  };
  return (
    <div className="max-w-[820px] space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface px-5 py-4">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${!t ? "bg-ink-3" : fresh ? "bg-accent" : "bg-warn"}`} aria-hidden />
        <div className="min-w-[220px] flex-1">
          <div className="font-medium">{!t ? "Not connected yet" : fresh ? "Connected" : "Connected, but no update for a while"}</div>
          <div className="text-[0.86rem] text-ink-2">{t ? <>Last update {ago(t.syncedAt)}{t.computer ? ` from ${t.computer}` : ""}{companies.length ? ` · ${companies.join(", ")}` : ""}{!fresh && ". Check that the Tally computer is on and Tally is open."}</> : "Figures appear here a minute after you run the setup below."}</div>
        </div>
        <div className="flex gap-2">{t && !steps && <button className="btn btn-quiet btn-sm" onClick={() => setSteps(true)}>Setup steps</button>}<button className="btn btn-quiet btn-sm" onClick={() => window.location.reload()}><RefreshCw size={14} />Check again</button></div>
      </div>

      {(!t || steps) && <div className="rounded-2xl bg-surface p-5">
        <h3 className="font-semibold">{t ? "Set up on another computer" : "Connect in three steps"}</h3>
        <ol className="mt-4 space-y-4">
          {[
            <>On the computer where Tally runs, open TallyPrime and press <b>F1 (Help) → Settings → Connectivity → Client/Server configuration</b>. Set <b>TallyPrime acts as</b> to <b>Both</b> and <b>Port</b> to <b>9000</b>. Keep your companies open.</>,
            <>On the same computer, download the setup file. If the browser asks, choose <b>Keep</b>.<div className="mt-2"><a href="/api/tally/script" className="btn btn-primary btn-sm"><Download size={14} />Download Tally setup</a></div></>,
            <>Double-click <b>karobar360-tally-setup.cmd</b>. If Windows shows “Windows protected your PC”, click <b>More info → Run anyway</b>. It sends your figures once, then every 15 minutes while the computer is on.</>,
          ].map((x, i) => (
            <li key={i} className="flex gap-3 text-[0.92rem]">
              <span className="num mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-[0.75rem] font-semibold text-accent-ink">{i + 1}</span>
              <div className="leading-relaxed text-ink-2">{x}</div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[0.84rem] text-ink-3">Only totals are sent: monthly sales, purchases and expenses, debtors, creditors, cash, bank and taxes. Vouchers stay in Tally. Every company open in Tally is sent.</p>
      </div>}

      {ctx.firms.length > 1 && companies.length > 0 && (
        <Section title="Which Tally company is which firm">
          <p className="-mt-1 mb-3 text-[0.9rem] text-ink-2">Each firm’s dashboard shows the figures of its own Tally company. Firms with the same name are matched for you.</p>
          <ul className="divide-y divide-surface-2 rounded-2xl bg-surface">
            {ctx.firms.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="min-w-[180px] flex-1 font-medium">{f.name}</span>
                <select className="field !w-auto min-w-[220px]" value={map[f.id] ?? ""} onChange={(e) => setMap(f.id, e.target.value)}>
                  <option value="">{(() => { const g = tallyOfFirm({ ...ctx.root, tallyCfg: { ...T, firmCompany: {} } }, f)?.company; return g ? `Automatic: ${g}` : "Automatic: no match, none shown"; })()}</option>
                  {companies.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div>
        <button className="text-[0.88rem] font-medium text-accent hover:underline" onClick={() => setMore((m) => !m)}>{more ? "Hide" : "Show"} help and other options</button>
        {more && (
          <div className="mt-3 space-y-3 text-[0.9rem] text-ink-2">
            <p><b className="text-ink">Tally.ERP 9:</b> the setting is under F12 → Advanced Configuration. Set “Tally.ERP 9 is acting as” to Both and the port to 9000.</p>
            <p><b className="text-ink">Nothing arrives:</b> open <code className="rounded bg-surface-2 px-1">%LOCALAPPDATA%\Karobar360\karobar360-tally.log</code> on the Tally computer. Each run writes a line saying what happened.</p>
            <p><b className="text-ink">Stop sending:</b> run <code className="rounded bg-surface-2 px-1">schtasks /delete /tn &quot;Karobar360 Tally&quot; /f</code> in Command Prompt, or reset the key below.</p>
            <p><b className="text-ink">IT team prefers a script:</b> <a className="text-accent underline" href="/api/tally/script?file=ps1">download the PowerShell connector</a> and schedule it yourself.</p>
            <div className="pt-1"><Note>The setup file carries a private key for your company. If the computer is lost or someone leaves, reset the key and run the new setup.</Note></div>
            <button className="btn btn-quiet btn-sm" onClick={rotate}>{rotated ? <RefreshCw size={14} /> : <KeyRound size={14} />}{rotated ? "Key reset" : "Reset connector key"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
