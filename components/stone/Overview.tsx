"use client";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowRight, ArrowUp, ChevronRight, SlidersHorizontal } from "lucide-react";
import { blockCost, cbm, checkGstin, daysSince, freeDaysLeft, lakh, lotRate, mineWindow, mipCheck, n0, n2, purchaseValue, rs, rs2, saleCost, saleTaxable, saleTotals, weightGap } from "@/lib/stone/calc";
import { DASH_WIDGETS, hasBlocks, tallyOf } from "@/lib/stone/modules";
import { onHand, storesOf } from "@/lib/stone/stores";
import { slabCount } from "@/lib/stone/slabs";
import { firmOf, kindLabel } from "@/lib/stone/firms";
import type { AreaKey } from "@/lib/stone/perm";
import { TallyPanel } from "./TallyView";
import { Drawer } from "./ui";
import { navFor, type Ctx, type View } from "./StoneApp";
import { Panel, KpiCard } from "@/components/Panels";
import { ChartBody } from "@/components/Charts";
import { fullDate } from "@/lib/format";
import type { ChartSpec, KPI } from "@/lib/types";

type Alert = { tone: "neg" | "warn"; text: ReactNode; go: [View, string?] };

export default function Overview({ ctx }: { ctx: Ctx }) {
  const { db, go } = ctx;
  const S = db.settings;
  const [custom, setCustom] = useState(false);
  const b = db.blocks;
  const sum = (xs: typeof b) => xs.reduce((a, x) => a + (x.tonnes || x.billedTonnes), 0);
  const atMine = b.filter((x) => x.status === "at_mine");
  const transit = b.filter((x) => x.status === "in_transit");
  const yard = b.filter((x) => x.status === "in_yard");
  const onSaw = b.filter((x) => x.status === "on_saw");
  const unitLots = db.lots.filter((l) => l.site === "unit" && l.available > 0);
  const depotLots = db.lots.filter((l) => l.site === "depot" && l.available > 0);
  const soldMonth = db.sales.filter((s) => daysSince(s.date) <= 30).reduce((a, s) => a + s.lines.reduce((x, l) => x + l.sqft, 0), 0);
  const party = (id: string) => db.parties.find((p) => p.id === id);

  const blockVal = [...transit, ...yard, ...onSaw].reduce((a, x) => a + blockCost(x), 0);
  const slabVal = db.lots.reduce((a, l) => a + l.available * lotRate(l), 0);
  const mm = mineWindow(db, 30);
  const recv = db.sales.filter((s) => !s.paid).reduce((a, s) => a + saleTotals(s, S.state, party(s.customerId)?.state ?? S.state).total, 0);
  const recent = db.lots.filter((l) => daysSince(l.createdAt) <= 60 && l.blockId);
  const avgCost = recent.reduce((a, l) => a + l.cost, 0) / Math.max(1, recent.reduce((a, l) => a + l.sqft, 0));

  const alerts = useMemo(() => {
    const out: Alert[] = [];
    for (const x of b) {
      if (x.source !== "import" && !x.eRawanna && ["in_transit", "in_yard", "on_saw"].includes(x.status)) {
        out.push({ tone: "neg", text: <>Block <b>{x.no}</b> has no e-Rawanna on record. Get the copy from {party(x.supplierId)?.company ?? "the quarry"} before the stone is cut or sold.</>, go: ["unit", "yard"] });
      }
      const g = weightGap(x);
      if (g > 0.02 && x.status !== "rejected") {
        out.push({ tone: "warn", text: <><b>{x.no}</b> weighed {n2(x.tonnes)} t against {n2(x.billedTonnes)} t billed ({(g * 100).toFixed(1)}% short). Debit note to {party(x.supplierId)?.company ?? "supplier"}{ctx.costs ? `: about ${rs((x.billedTonnes - x.tonnes) * x.rate)}` : ""}.</>, go: ["mines", "bought"] });
      }
      if (x.status === "in_yard" && x.receivedOn && daysSince(x.receivedOn) > 45) {
        out.push({ tone: "warn", text: <><b>{x.no}</b> ({x.variety}) has waited {daysSince(x.receivedOn)} days in the yard.{ctx.costs ? ` ${lakh(blockCost(x))} is tied up in it.` : ""}</>, go: ["unit", "yard"] });
      }
    }
    for (const s of db.shipments) {
      const f = freeDaysLeft(s);
      if (f !== null && f <= 5) out.push({ tone: f <= 2 ? "neg" : "warn", text: <>{s.variety} from {s.country} ({s.containers.length} containers, BL {s.blNo}): {f < 0 ? `${-f} days into demurrage` : `${f} free days left at ${s.pod.split(",")[0]}`}. Push the CHA to clear.</>, go: ["trade", "import"] });
      const m = mipCheck(s);
      if (m && !m.ok) out.push({ tone: "neg", text: <>BL {s.blNo} declares ${n0(m.value)} per {m.unit.split("/")[1]}, below the {m.floor} {m.unit} floor for marble. Customs can hold it.</>, go: ["trade", "import"] });
    }
    for (const s of db.sales) {
      const p = party(s.customerId);
      if (!s.paid && p && daysSince(s.date) > p.creditDays) out.push({ tone: "warn", text: <>{p.company}: invoice {s.invoiceNo} is {daysSince(s.date) - p.creditDays} days past its {p.creditDays}-day credit. {rs(saleTotals(s, S.state, p.state).total)} due.</>, go: ["sales"] });
      for (const l of s.lines) {
        const lot = db.lots.find((x) => x.id === l.lotId);
        if (lot && l.rate < lotRate(lot)) out.push({ tone: "warn", text: <>Invoice {s.invoiceNo} sold {lot.variety} at {rs(l.rate)}/sq ft, below its cost of {rs2(lotRate(lot))}.</>, go: ["sales"] });
      }
    }
    for (const l of db.lots) if (l.available > 0 && daysSince(l.createdAt) > 90) out.push({ tone: "warn", text: <>Lot {l.lotNo} ({l.variety}, {n0(l.available)} sq ft) is {daysSince(l.createdAt)} days old. Offer it to dealers before it chips in the rack.</>, go: ["depot", "stock"] });
    const st = storesOf(db);
    const lowItems = st.items.filter((i) => i.minQty > 0 && onHand(st, i.id) <= i.minQty);
    if (lowItems.length) out.push({ tone: "warn", text: <>{lowItems.length === 1 ? <><b>{lowItems[0].name}</b> is</> : <><b>{lowItems.length} store items</b> are</>} at or below the reorder level{lowItems.length > 1 ? `: ${lowItems.slice(0, 3).map((x) => x.name).join(", ")}` : ""}.</>, go: ["stores"] });
    for (const p of db.parties) if (p.gstin && !checkGstin(p.gstin).ok) out.push({ tone: "warn", text: <>{p.company}’s GSTIN fails the check digit. Correct it before filing GSTR-1.</>, go: ["parties", p.kind] });
    return out.sort((a, c) => (a.tone === c.tone ? 0 : a.tone === "neg" ? -1 : 1));
  }, [db]); // eslint-disable-line react-hooks/exhaustive-deps

  // Weekly series for the sparklines and the main chart (last 12 weeks, oldest first).
  const W = 12;
  const wk = (d: string) => Math.floor(daysSince(d) / 7);
  const weeks = Array.from({ length: W }, (_, i) => W - 1 - i);
  const weekLabel = (w: number) => { const d = new Date(); d.setDate(d.getDate() - w * 7 - 6); return `${d.getDate()} ${d.toLocaleString("en-IN", { month: "short" })}`; };
  const salesWk = weeks.map((w) => db.sales.filter((s) => wk(s.date) === w).reduce((a, s) => a + saleTaxable(s), 0));
  const tonWk = weeks.map((w) => b.filter((x) => x.source === "own_mine" && wk(x.date) === w).reduce((a, x) => a + x.tonnes, 0));
  const costWk = weeks.map((w) => db.mineCosts.filter((c) => wk(c.date) === w).reduce((a, c) => a + c.amount, 0));
  const buyWk = weeks.map((w) => b.filter((x) => x.source === "purchase" && wk(x.date) === w).reduce((a, x) => a + purchaseValue(x), 0) + db.lots.filter((l) => l.source === "purchase" && wk(l.createdAt) === w).reduce((a, l) => a + (l.buyValue ?? l.cost), 0));
  const sqftWk = weeks.map((w) => db.jobs.filter((j) => j.finishedOn && wk(j.finishedOn) === w).reduce((a, j) => a + j.sqft - j.rejectSqft, 0));

  const win = (days: number, off: number) => db.sales.filter((s) => { const a = daysSince(s.date); return a >= off && a < off + days; });
  const s30 = win(30, 0), sPrev = win(30, 30);
  const sales30 = s30.reduce((a, s) => a + saleTaxable(s), 0);
  const salesPrev = sPrev.reduce((a, s) => a + saleTaxable(s), 0);
  const margin30 = sales30 ? (sales30 - s30.reduce((a, s) => a + s.freight + saleCost(s, db.lots, db.blocks), 0)) / (sales30 - s30.reduce((a, s) => a + s.freight, 0) || 1) : 0;
  const mPrev = mineWindow(db, 30, 30);
  const ch = (a: number, p: number) => { const d = p ? (a - p) / p : undefined; return d !== undefined && Math.abs(d) <= 2 ? d : undefined; };

  const C = ctx.costs;
  const M = ctx.mods;
  const see = (a: AreaKey) => ctx.can(a) !== "none";
  const nav = navFor(M, ctx.can, ctx.perms).filter((n) => n.show).map((n) => n.key);
  const stockSqft = db.lots.reduce((a, l) => a + l.available, 0);
  const kpiAll: (KPI & { key: string; ok: boolean })[] = [
    { key: "sales", ok: see("sales"), label: "Sales, last 30 days", value: sales30, unit: "inr", delta: ch(sales30, salesPrev), goodWhen: "up", hint: ch(sales30, salesPrev) === undefined ? `${s30.length} invoices` : undefined, spark: salesWk },
    { key: "export", ok: see("sales") && db.parties.some((p) => p.intl), label: "Export sales, last 30 days", value: s30.filter((x) => party(x.customerId)?.intl).reduce((a, x) => a + saleTaxable(x), 0), unit: "inr", hint: `${s30.filter((x) => party(x.customerId)?.intl).length} export invoices` },
    { key: "margin", ok: see("sales") && C, label: "Gross margin", value: margin30, unit: "pct", hint: `${s30.length} invoices` },
    { key: "recv", ok: see("sales"), label: "To collect from customers", value: recv, unit: "inr", hint: `${db.sales.filter((s) => !s.paid).length} invoices open` },
    { key: "stockval", ok: C && (see("stock") || see("blocks")), label: "Stock value at cost", value: blockVal + slabVal, unit: "inr", hint: `Blocks ${lakh(blockVal)} · slabs ${lakh(slabVal)}` },
    { key: "stocksqft", ok: !C && see("stock"), label: "Slab stock", value: stockSqft, unit: "num", hint: "sq ft in stock" },
    { key: "yard", ok: !C && see("blocks") && hasBlocks(M), label: "Blocks in yard", value: yard.length, unit: "num", hint: `${n0(sum(yard))} t · ${transit.length} on the road` },
    { key: "slabcost", ok: C && M.processing, label: "Slab cost per sq ft", value: avgCost, unit: "inr", hint: "Block to polished, all-in", spark: sqftWk },
    { key: "quarry", ok: C && M.quarry && see("quarry"), label: "Quarry cost per tonne", value: mm.perTonne, unit: "inr", delta: ch(mm.perTonne, mPrev.perTonne), goodWhen: "down", spark: tonWk.map((t, i) => (t ? costWk[i] / t : 0)) },
    { key: "buying", ok: C && (M.trading || M.buyBlocks), label: "Stock bought, 30 days", value: buyWk.slice(-4).reduce((a, x) => a + x, 0), unit: "inr", hint: "Blocks and slabs on supplier bills", spark: buyWk },
  ];
  const kpiPick = S.dashboard?.kpis;
  const kpis = kpiAll.filter((k) => k.ok && (!kpiPick || kpiPick.includes(k.key))).slice(0, 6);

  const spendWk = weeks.map((_, i) => costWk[i] + buyWk[i]);
  const chart: ChartSpec = {
    id: "weekly", title: C ? "Sales and stock buying, last 12 weeks" : "Sales, last 12 weeks", kind: "bar", unit: "inr", xKey: "w",
    finding: [M.quarry && `${n0(tonWk.reduce((a, x) => a + x, 0))} t came out of the quarry`, M.processing && `${n0(sqftWk.reduce((a, x) => a + x, 0))} sq ft of slab came off the saws`, `${lakh(salesWk.reduce((a, x) => a + x, 0))} invoiced`].filter(Boolean).join(", ") + " in this period.",
    data: weeks.map((w, i) => ({ w: weekLabel(w), sales: Math.round(salesWk[i]), ...(C ? { spend: Math.round(spendWk[i]) } : {}) })),
    series: [{ key: "sales", label: "Sales invoiced", tone: "accent" }, ...(C ? [{ key: "spend", label: M.quarry ? "Quarry and buying" : "Buying", tone: "faint" as const }] : [])],
  };

  // Health: simple, explainable checks an owner would ask about.
  const active = b.filter((x) => x.source !== "import" && ["in_transit", "in_yard", "on_saw"].includes(x.status));
  const open = db.sales.filter((s) => !s.paid);
  const lines = db.sales.flatMap((s) => s.lines);
  const port = db.shipments.filter((s) => freeDaysLeft(s) !== null);
  const share = (n: number, d: number) => (d ? n / d : 1);
  const parts = [
    hasBlocks(M) && { name: "Royalty papers in order", value: share(active.filter((x) => x.eRawanna).length, active.length) },
    { name: "Invoices within credit days", value: share(open.filter((s) => daysSince(s.date) <= (party(s.customerId)?.creditDays ?? 30)).length, open.length) },
    hasBlocks(M) && { name: "Yard blocks under 45 days", value: share(yard.filter((x) => !x.receivedOn || daysSince(x.receivedOn) <= 45).length, yard.length) },
    { name: "Sold above cost", value: share(lines.filter((l) => { const lot = db.lots.find((x) => x.id === l.lotId); return !lot || l.rate >= lotRate(lot); }).length, lines.length) },
    (M.trading || M.depot) && { name: "Slab lots under 90 days old", value: share(db.lots.filter((l) => l.available > 0 && daysSince(l.createdAt) <= 90).length, db.lots.filter((l) => l.available > 0).length) },
    M.imports && { name: "Containers clear of demurrage", value: share(port.filter((s) => (freeDaysLeft(s) ?? 99) > 5).length, port.length) },
  ].filter(Boolean) as { name: string; value: number }[];
  const score = Math.round((parts.reduce((a, p) => a + p.value, 0) / Math.max(1, parts.length)) * 100);

  const flow = ([
    M.quarry && see("quarry") && { label: "At quarry", main: `${atMine.length}`, sub: `${n0(sum(atMine))} t`, go: ["mines", "quarry"] },
    hasBlocks(M) && see("blocks") && { label: "On the road", main: `${transit.length}`, sub: `${n0(sum(transit))} t`, go: [M.processing ? "unit" : "mines", M.processing ? "yard" : "bought"] },
    hasBlocks(M) && (see("blocks") || see("processing")) && { label: "Block yard", main: `${yard.length}`, sub: `${n0(sum(yard))} t · ${n2(yard.reduce((a, x) => a + cbm(x), 0))} CBM`, go: M.processing ? ["unit", "yard"] : ["mines", M.quarry && !M.buyBlocks ? "quarry" : "bought"] },
    M.processing && see("processing") && { label: "On saw", main: `${onSaw.length}`, sub: `${n0(sum(onSaw))} t`, go: ["unit", "yard"] },
    M.processing && see("processing") && { label: "Slabs at unit", main: n0(unitLots.reduce((a, l) => a + slabCount(l), 0)), sub: `${n0(unitLots.reduce((a, l) => a + l.available, 0))} sq ft`, go: ["unit", "slabs"] },
    (M.depot || M.trading) && see("stock") && { label: "Depot", main: n0(depotLots.reduce((a, l) => a + l.available, 0)), sub: "sq ft", go: ["depot", "stock"] },
    see("sales") && { label: "Sold, 30 days", main: M.depot || M.trading || M.processing ? n0(soldMonth) : `${db.sales.filter((s) => daysSince(s.date) <= 30).length}`, sub: M.depot || M.trading || M.processing ? "sq ft" : "invoices", go: ["sales"] },
  ].filter(Boolean)) as { label: string; main: string; sub: string; go: [View, string?] }[];

  const sailing = db.shipments.filter((s) => s.dir === "import" && s.status !== "received").length;
  const h = new Date().getHours();
  const hello = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const myAlerts = alerts.filter((a) => nav.includes(a.go[0]));
  const summary = [
    hasBlocks(M) && see("blocks") && `${yard.length} block${yard.length === 1 ? "" : "s"} in the yard${M.processing && see("processing") ? `, ${onSaw.length} on the saws` : ""}`,
    (M.depot || M.trading) && see("stock") && `${n0(stockSqft)} sq ft of slab in stock`,
    M.imports && see("trade") && `${sailing} import${sailing === 1 ? "" : "s"} on the way`,
    see("sales") && `${lakh(recv)} due from customers`,
  ].filter(Boolean).join(", ");
  const T = tallyOf(db);

  const shortcuts = ([
    M.buyBlocks && ctx.edit("blocks") && ["Register a block", "mines", "bought"],
    M.quarry && ctx.edit("quarry") && ["Log quarry cost", "mines", "costs"],
    M.processing && ctx.edit("blocks") && ["Receive at unit", "unit", "yard"],
    M.trading && ctx.edit("stock") && ["Slabs bought", "depot", "stock"],
    ctx.edit("sales") && ["New invoice", "sales", ""],
    M.imports && ctx.edit("trade") && ["Upload a BL", "trade", "import"],
    M.stores && ctx.edit("stores") && ["Issue from store", "stores", ""],
  ].filter(Boolean)) as [string, View, string][];

  const empty = !db.blocks.length && !db.lots.length && !db.sales.length && !db.parties.length;
  const W_: Record<string, ReactNode> = {
    greeting: (
      <Panel className="enter flex flex-col">
        <div className="text-sm text-ink-3">{fullDate(new Date())} · {S.company}</div>
        <h2 className="mt-1 text-[1.65rem] font-semibold leading-tight tracking-tight">{hello}{ctx.me ? `, ${ctx.me.name.split(" ")[0]}` : ""}</h2>
        {empty ? (
          <p className="mt-3 max-w-[65ch] text-ink-2">Your workspace is empty. Start by adding {see("parties") ? "your customers and suppliers" : "your first entries"}, or load the sample company from Settings to look around.</p>
        ) : (
          <p className="mt-3 max-w-[65ch] text-ink-2">{summary ? `${summary}.` : ""} {myAlerts.length ? `${myAlerts.length} things need you today.` : "Nothing needs you today."}</p>
        )}
        {!!shortcuts.length && (
          <div className="mt-auto flex flex-wrap gap-2 pt-6">
            {shortcuts.map(([l, v, t]) => <button key={l} onClick={() => go(v, t)} className="btn btn-quiet btn-sm">{l}</button>)}
          </div>
        )}
      </Panel>
    ),
    health: C && see("sales") && parts.length ? (
      <Panel className="enter">
        <div className="flex items-baseline justify-between">
          <h3 className="font-medium">Business health</h3>
          <span className="num text-3xl font-semibold tracking-tight">{score}<span className="text-base font-normal text-ink-3">/100</span></span>
        </div>
        <ul className="mt-4 space-y-3 text-sm">
          {parts.map((p) => (
            <li key={p.name}>
              <div className="mb-1 flex justify-between text-ink-2"><span>{p.name}</span><span className="num">{Math.round(p.value * 100)}</span></div>
              <div className="h-1.5 rounded-full bg-surface-2"><div className={`h-1.5 rounded-full ${p.value < 0.6 ? "bg-warn" : "bg-accent"}`} style={{ width: `${Math.round(p.value * 100)}%` }} /></div>
            </li>
          ))}
        </ul>
      </Panel>
    ) : null,
    kpis: kpis.length ? <div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-6">{kpis.map((k, i) => <KpiCard key={k.key} k={k} lang="en" i={i} />)}</div> : null,
    tally: see("tally") && db.tally && T.show.length ? <div><h3 className="mb-3 font-medium">From Tally</h3><TallyPanel t={db.tally} show={T.show} /></div> : null,
    flow: flow.length > 1 ? (
      <div className="scroll-thin -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ol className="flex items-stretch gap-1.5" style={{ minWidth: flow.length * 124 }}>
          {flow.map((f, i) => (
            <li key={f.label} className="flex flex-1 items-stretch gap-1.5">
              <button onClick={() => go(...f.go)} className="focusable group flex-1 rounded-2xl bg-surface px-3.5 py-3 text-left transition-transform hover:-translate-y-0.5">
                <div className="text-[0.78rem] text-ink-3">{f.label}</div>
                <div className="num mt-1 text-[1.5rem] font-semibold leading-none tracking-tight">{f.main}</div>
                <div className="mt-1 text-[0.78rem] text-ink-2">{f.sub}</div>
              </button>
              {i < flow.length - 1 && <ChevronRight size={16} className="shrink-0 self-center text-ink-3" aria-hidden="true" />}
            </li>
          ))}
        </ol>
      </div>
    ) : null,
    chart: see("sales") ? (
      <Panel className="enter">
        <div className="mb-1 flex items-baseline justify-between gap-4">
          <h3 className="font-medium">{chart.title}</h3>
          <div className="flex shrink-0 gap-3 text-xs text-ink-3">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent" />Sales</span>
            {C && <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "var(--data-3)" }} />{chart.series[1]?.label}</span>}
          </div>
        </div>
        <p className="mb-4 text-sm text-ink-2">{chart.finding}</p>
        <ChartBody spec={chart} height={340} />
      </Panel>
    ) : null,
    attention: (
      <Panel className="enter">
        <h3 className="font-medium">Needs attention <span className="num ml-1 text-ink-3">{myAlerts.length}</span></h3>
        <ul className="mt-3 divide-y divide-surface-2">
          {myAlerts.slice(0, 6).map((a, i) => (
            <li key={i}>
              <button onClick={() => go(...a.go)} className="focusable group flex w-full items-start gap-3 py-2.5 text-left text-[0.88rem]">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.tone === "neg" ? "bg-neg" : "bg-warn"}`} />
                <span className="flex-1 text-ink-2 group-hover:text-ink [&_b]:font-semibold [&_b]:text-ink">{a.text}</span>
                <ArrowRight size={14} className="mt-1 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
              </button>
            </li>
          ))}
          {!myAlerts.length && <li className="py-6 text-center text-ink-3">Nothing needs you right now.</li>}
        </ul>
        {myAlerts.length > 6 && <p className="mt-2 text-xs text-ink-3">{myAlerts.length - 6} more in the sections.</p>}
      </Panel>
    ),
    costbuild: C && M.processing && db.jobs.length ? (
      <Panel className="enter">
        <h3 className="font-medium">Where a sq ft of slab gets its cost</h3>
        <CostBuild ctx={ctx} />
      </Panel>
    ) : null,
  };

  const order = [...(S.dashboard?.order ?? []), ...DASH_WIDGETS.map((w) => w.key)].filter((k, i, a) => a.indexOf(k) === i && k in W_);
  const hidden = new Set(S.dashboard?.hidden ?? []);
  const visible = order.filter((k) => !hidden.has(k) && W_[k]);
  // Pair a few widgets side by side the way an owner reads them: summary with health, chart with alerts.
  const PAIRS: [string, string][] = [["greeting", "health"], ["chart", "attention"]];
  const rows: ReactNode[] = [];
  for (let i = 0; i < visible.length; i++) {
    const k = visible[i], nxt = visible[i + 1];
    const pair = PAIRS.find(([a, b2]) => (a === k && b2 === nxt) || (b2 === k && a === nxt));
    if (pair) { rows.push(<div key={k} className="grid gap-4 lg:grid-cols-3"><div className="lg:col-span-2 [&>section]:h-full">{W_[k === pair[0] ? k : nxt]}</div><div className="[&>section]:h-full">{W_[k === pair[0] ? nxt : k]}</div></div>); i++; }
    else rows.push(<div key={k}>{W_[k]}</div>);
  }

  return (
    <div className="space-y-4">
      {ctx.edit("settings") && (
        <div className="no-print flex justify-end">
          <button className="btn btn-quiet btn-sm" onClick={() => setCustom(true)}><SlidersHorizontal size={14} />Customise dashboard</button>
        </div>
      )}
      {rows[0]}
      {ctx.firms.length > 1 && !ctx.firm && <FirmTable ctx={ctx} />}
      {rows.slice(1)}
      {custom && <Customise ctx={ctx} available={Object.keys(W_).filter((k) => W_[k] !== null)} kpis={kpiAll.filter((k) => k.ok)} onClose={() => setCustom(false)} />}
    </div>
  );
}

/** Group view: the same numbers, one row per firm. */
function FirmTable({ ctx }: { ctx: Ctx }) {
  const R = ctx.root;
  const S = R.settings;
  const party = (id: string) => R.parties.find((p) => p.id === id);
  const rows = ctx.firms.map((f) => {
    const of = (x: { firmId?: string }) => firmOf(x, S) === f.id;
    const blocks = R.blocks.filter((b) => of(b) && ["at_mine", "in_transit", "in_yard", "on_saw"].includes(b.status));
    const lots = R.lots.filter((l) => of(l) && l.available > 0);
    const sales = R.sales.filter(of);
    const s30 = sales.filter((x) => daysSince(x.date) <= 30);
    const due = sales.filter((x) => !x.paid).reduce((a, x) => a + saleTotals(x, f.state, party(x.customerId)?.state ?? f.state).total, 0);
    const out = [...R.blocks, ...R.lots].flatMap((x) => (x.trail ?? []).filter((t) => t.from === f.id && daysSince(t.date) <= 30));
    return { f, blocks, lots, s30, due, out };
  });
  return (
    <Panel className="enter">
      <h3 className="font-medium">By firm</h3>
      <div className="scroll-thin mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] text-[0.9rem]">
          <thead><tr className="text-left text-[0.78rem] text-ink-3"><th className="py-2 font-medium">Firm</th><th className="py-2 text-right font-medium">Blocks held</th><th className="py-2 text-right font-medium">Slab stock</th><th className="py-2 text-right font-medium">Sales, 30 days</th><th className="py-2 text-right font-medium">To collect</th><th className="py-2 text-right font-medium">Sent to other firms, 30 days</th></tr></thead>
          <tbody className="num">
            {rows.map((r) => (
              <tr key={r.f.id} className="cursor-pointer border-t border-surface-2 hover:bg-surface-2/50" onClick={() => ctx.setFirm(r.f.id)}>
                <td className="py-2.5 font-sans"><div className="font-medium">{r.f.name}</div><div className="text-[0.78rem] text-ink-3">{kindLabel(r.f.kind)}</div></td>
                <td className="py-2.5 text-right">{r.blocks.length ? `${r.blocks.length} · ${n0(r.blocks.reduce((a, b) => a + (b.tonnes || b.billedTonnes), 0))} t` : "—"}</td>
                <td className="py-2.5 text-right">{r.lots.length ? `${n0(r.lots.reduce((a, l) => a + l.available, 0))} sq ft` : "—"}</td>
                <td className="py-2.5 text-right">{r.s30.length ? lakh(r.s30.reduce((a, x) => a + saleTaxable(x), 0)) : "—"}</td>
                <td className="py-2.5 text-right">{r.due ? lakh(r.due) : "—"}</td>
                <td className="py-2.5 text-right">{r.out.length ? `${r.out.length} · ${ctx.costs ? lakh(r.out.reduce((a, t) => a + t.value, 0)) : ""}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[0.8rem] text-ink-3">Click a firm to work in it. Stock moves between firms are counted once, in the firm that holds it now.</p>
    </Panel>
  );
}

function Customise({ ctx, available, kpis, onClose }: { ctx: Ctx; available: string[]; kpis: { key: string; label: string }[]; onClose: () => void }) {
  const S = ctx.db.settings;
  const [order, setOrder] = useState<string[]>(() => [...(S.dashboard?.order ?? []), ...DASH_WIDGETS.map((w) => w.key)].filter((k, i, a) => a.indexOf(k) === i));
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(S.dashboard?.hidden ?? []));
  const [pick, setPick] = useState<Set<string>>(() => new Set(S.dashboard?.kpis ?? kpis.map((k) => k.key)));
  const move = (i: number, d: -1 | 1) => setOrder((o) => { const n = [...o]; const j = i + d; if (j < 0 || j >= n.length) return o; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const save = () => {
    ctx.update((db) => { db.settings.dashboard = { order, hidden: [...hidden], kpis: pick.size === kpis.length ? undefined : [...pick] }; });
    ctx.say("Dashboard saved for everyone in your company", "good");
    onClose();
  };
  return (
    <Drawer open title="Customise dashboard" sub="Choose what appears on the Overview and in what order. Each person still sees only what their access allows." onClose={onClose}
      footer={<><button className="btn btn-primary" onClick={save}>Save</button><button className="btn btn-quiet" onClick={onClose}>Cancel</button><button className="btn btn-quiet btn-sm ml-auto" onClick={() => { setOrder(DASH_WIDGETS.map((w) => w.key)); setHidden(new Set()); setPick(new Set(kpis.map((k) => k.key))); }}>Reset</button></>}>
      <ul className="divide-y divide-surface-2 rounded-2xl bg-surface">
        {order.map((k, i) => {
          const w = DASH_WIDGETS.find((x) => x.key === k);
          if (!w) return null;
          const na = !available.includes(k);
          return (
            <li key={k} className="flex items-center gap-3 px-4 py-2.5">
              <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={!hidden.has(k)} onChange={(e) => setHidden((h) => { const n = new Set(h); if (e.target.checked) n.delete(k); else n.add(k); return n; })} aria-label={`Show ${w.label}`} />
              <span className="flex-1">{w.label}{na && <span className="block text-[0.78rem] text-ink-3">No data for this yet</span>}</span>
              <button className="btn btn-quiet btn-sm !px-2" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={14} /></button>
              <button className="btn btn-quiet btn-sm !px-2" aria-label="Move down" onClick={() => move(i, 1)} disabled={i === order.length - 1}><ArrowDown size={14} /></button>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 text-sm font-medium">Key numbers to show <span className="font-normal text-ink-3">(up to 6)</span></div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {kpis.map((k) => <button key={k.key} className="chip" data-on={pick.has(k.key)} onClick={() => setPick((p) => { const n = new Set(p); if (n.has(k.key)) n.delete(k.key); else if (n.size < 6) n.add(k.key); return n; })}>{k.label}</button>)}
      </div>
      <p className="mt-6 text-[0.84rem] text-ink-2">Figures from Tally are chosen on the Tally page.</p>
    </Drawer>
  );
}

function CostBuild({ ctx }: { ctx: Ctx }) {
  const { db } = ctx;
  const rows = useMemo(() => {
    const m: Record<string, { sqft: number; stone: number; royalty: number; freight: number; damage: number; proc: number }> = {};
    for (const j of db.jobs) {
      const b = db.blocks.find((x) => x.id === j.blockId);
      if (!b) continue;
      const r = (m[b.variety] ??= { sqft: 0, stone: 0, royalty: 0, freight: 0, damage: 0, proc: 0 });
      const good = Math.max(1, j.sqft - j.rejectSqft);
      r.sqft += good;
      r.stone += (b.source === "import" ? b.importCost : b.rate * (b.rateBasis === "cbm" ? cbm(b) : b.billedTonnes || b.tonnes));
      r.royalty += b.royalty + b.dmft;
      r.freight += b.freight + b.loading + b.otherCost;
      r.damage += b.damageAlloc;
      r.proc += j.power + j.blades + j.resin + j.netting + j.polishing + j.labour + j.other;
    }
    return Object.entries(m).map(([v, r]) => ({ v, ...r, total: (r.stone + r.royalty + r.freight + r.damage + r.proc) / r.sqft })).sort((a, b) => b.sqft - a.sqft);
  }, [db]);
  const parts = [
    { k: "stone", l: "Stone", c: "var(--ink)" },
    { k: "royalty", l: "Royalty", c: "var(--warn)" },
    { k: "freight", l: "Freight", c: "var(--data-2)" },
    { k: "damage", l: "Damage", c: "var(--neg)" },
    { k: "proc", l: "Sawing & polish", c: "var(--accent)" },
  ] as const;
  return (
    <div className="mt-3">
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.78rem] text-ink-2">
        {parts.map((p) => <span key={p.k} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: p.c }} />{p.l}</span>)}
      </div>
      <ul className="space-y-3.5">
        {rows.map((r) => (
          <li key={r.v}>
            <div className="flex items-baseline justify-between text-[0.9rem]"><span className="font-medium">{r.v}</span><span className="num">{rs2(r.total)}/sq ft</span></div>
            <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${r.v} cost split`}>
              {parts.map((p) => { const v = (r as unknown as Record<string, number>)[p.k] / r.sqft; return v > 0 ? <span key={p.k} style={{ width: `${(v / r.total) * 100}%`, background: p.c }} title={`${p.l} ${rs2(v)}/sq ft`} /> : null; })}
            </div>
            <div className="num mt-1 text-[0.76rem] text-ink-3">{n0(r.sqft)} sq ft cut{r.damage > 0 ? ` · damage adds ${rs2(r.damage / r.sqft)}/sq ft` : ""}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
