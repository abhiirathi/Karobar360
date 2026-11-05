import type { Alert, Blueprint, ChartSpec, KPI, ModuleData, ModuleKey, Row, TableSpec } from "./types";
import { Rand, hashStr } from "./rng";
import { getIndustry, TRANSPORTERS, type Industry } from "./industries";
import { TURNOVER_BANDS } from "./catalog";
import { dateLabel, fmt, fullDate, inr, monthLabel } from "./format";

const NAMES = [
  "Ramesh Kumawat", "Pooja Sharma", "Mahendra Singh", "Kailash Meena", "Sunita Devi", "Dinesh Prajapat", "Rakesh Choudhary",
  "Anita Saini", "Vikram Rathore", "Mohan Lal", "Manoj Gurjar", "Kavita Joshi", "Lalit Agarwal", "Shankar Lal", "Priya Mathur",
  "Govind Vaishnav", "Bhanwar Lal", "Seema Kanwar", "Arjun Bishnoi", "Neha Khandelwal", "Imran Khan", "Sanjay Purohit",
];

const DEFECTS: Record<string, string[]> = {
  marble: ["Hairline cracks", "Shade variation", "Thickness out of spec", "Edge chipping", "Polish dullness"],
  textile: ["Weaving faults", "Shade variation", "GSM variation", "Oil stains", "Width shortfall"],
  handicrafts: ["Finish defects", "Joint gaps", "Moisture content high", "Transit damage", "Dimension mismatch"],
  gems: ["Stone fall-out", "Weight variance", "Hallmark mismatch", "Polish defects", "Clasp failure"],
  food: ["Moisture above limit", "Foreign matter", "Seal leakage", "Under-weight packs", "Colour variation"],
  auto: ["Dimensional NG", "Burr", "Surface rust", "Thread damage", "Coating peel-off"],
  blockprint: ["Print misregistration", "Colour bleeding", "Wash fastness", "Stitching defects", "Fabric holes"],
};

export interface Ctx {
  bp: Blueprint;
  ind: Industry;
  annual: number;
  months: Date[];
  now: Date;
  share: number;
  site: string | null;
  employees: number;
}

export function makeCtx(bp: Blueprint, siteIdx: number | null = null, now = new Date()): Ctx {
  const ind = getIndustry(bp.intake.industry);
  const band = TURNOVER_BANDS.find((b) => b.key === bp.intake.turnoverBand) ?? TURNOVER_BANDS[1];
  const r = new Rand(bp.seed);
  const annualFull = band.annual * r.range(0.85, 1.2);
  const sites = bp.intake.sites.length ? bp.intake.sites : [{ type: "factory" as const, name: "Main unit", city: bp.intake.city }];
  const w = new Rand(bp.seed + 7).weights(sites.length, 1.2);
  const share = siteIdx === null ? 1 : w[siteIdx] ?? 1;
  const months: Date[] = [];
  for (let i = 12; i >= 1; i--) months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  return {
    bp,
    ind,
    annual: annualFull * share,
    months,
    now,
    share,
    site: siteIdx === null ? null : sites[siteIdx]?.name ?? null,
    employees: Math.max(3, Math.round(bp.intake.employees * share)),
  };
}

function rng(ctx: Ctx, salt: string) {
  return new Rand(ctx.bp.seed ^ hashStr(salt));
}

function sites(ctx: Ctx) {
  const s = ctx.bp.intake.sites.length ? ctx.bp.intake.sites : [{ type: "factory" as const, name: "Main unit", city: ctx.bp.intake.city }];
  return ctx.site ? s.filter((x) => x.name === ctx.site) : s;
}

function daysAgo(ctx: Ctx, d: number) {
  return new Date(ctx.now.getTime() - d * 86400000);
}

// ——— shared series ———
export function revenueSeries(ctx: Ctx): number[] {
  const r = rng(ctx, "rev");
  const base = ctx.annual / 12;
  return ctx.months.map((m, i) => Math.round(base * ctx.ind.season[m.getMonth()] * (0.93 + i * 0.012) * r.range(0.95, 1.05)));
}

function receivablesInfo(ctx: Ctx) {
  const r = rng(ctx, "ar");
  const dso = Math.round(r.range(48, 84) * (ctx.bp.intake.channels.includes("dealers") ? 1.12 : 0.95));
  const total = (ctx.annual / 365) * dso;
  const shares = [0.34, 0.18, 0.15, 0.14, 0.19].map((x) => x * r.range(0.8, 1.2));
  const s = shares.reduce((a, b) => a + b, 0);
  const buckets = ["0–30", "31–45", "46–60", "61–90", "90+"].map((b, i) => ({ bucket: b, amount: Math.round((total * shares[i]) / s) }));
  return { dso, total: buckets.reduce((a, b) => a + b.amount, 0), buckets };
}

function payablesInfo(ctx: Ctx) {
  const r = rng(ctx, "ap");
  const dpo = Math.round(r.range(38, 70));
  const total = ((ctx.annual * (1 - ctx.ind.margin)) / 365) * dpo;
  const msmeLate = Math.round(total * r.range(0.08, 0.2));
  return { dpo, total: Math.round(total), msmeLate };
}

function spark(series: number[]) {
  return series.slice(-8);
}

function chg(a: number, b: number) {
  return b === 0 ? 0 : (a - b) / b;
}

// ——— modules ———
function sales(ctx: Ctx): ModuleData {
  const r = rng(ctx, "sales");
  const rev = revenueSeries(ctx);
  const last = rev[rev.length - 1];
  const prev = rev[rev.length - 2];
  const fyStartIdx = ctx.months.findIndex((m) => m.getMonth() === 3);
  const fytd = rev.slice(fyStartIdx >= 0 ? fyStartIdx : 0).reduce((a, b) => a + b, 0);
  const aov = Math.max(ctx.ind.avgUnitPrice * r.range(40, 160), ctx.annual / 12 / r.range(70, 160), 8000);
  const orders = Math.max(4, Math.round(last / aov));
  const ar = receivablesInfo(ctx);
  const target = rev.map((v, i) => Math.round((rev.reduce((a, b) => a + b, 0) / 12) * ctx.ind.season[ctx.months[i].getMonth()] * 1.04));
  const products = ctx.bp.vocab.products.slice(0, 6);
  const pw = r.weights(products.length);
  const q3 = rev.slice(-3).reduce((a, b) => a + b, 0);
  const chLabels: Record<string, string> = { dealers: "Dealers", b2b: "Direct B2B", retail: "Retail", export: "Export", ecommerce: "Online", government: "Govt / GeM", jobwork: "Job-work" };
  const ch = (ctx.bp.intake.channels.length ? ctx.bp.intake.channels : ["dealers", "b2b"]).map((c) => chLabels[c] ?? c);
  const cw = r.weights(ch.length, 1.2);
  const statuses = ["Delivered", "Dispatched", "In production", "Awaiting payment", "Confirmed"];
  const rows: Row[] = Array.from({ length: 12 }, (_, i) => {
    const p = r.pick(products);
    const amt = Math.round(r.jitter(aov, 0.6) / 100) * 100;
    const qty = Math.max(1, Math.round(amt / ctx.ind.avgUnitPrice));
    return {
      order: `SO-${String(ctx.now.getFullYear()).slice(2)}${String(ctx.now.getMonth() + 1).padStart(2, "0")}-${String(214 - i * 3).padStart(4, "0")}`,
      date: dateLabel(daysAgo(ctx, i * r.range(0.6, 1.6))),
      customer: r.pick(ctx.bp.vocab.customers),
      product: p,
      qty: `${qty.toLocaleString("en-IN")} ${ctx.bp.vocab.unit}`,
      amount: amt,
      status: i < 2 ? "Confirmed" : r.pick(statuses),
    };
  });
  const topCust = ctx.bp.vocab.customers.slice(0, 6);
  const tw = r.weights(topCust.length);
  const custRows: Row[] = topCust.map((c, i) => {
    const sales12 = Math.round(rev.reduce((a, b) => a + b, 0) * tw[i] * 0.7);
    const due = Math.round(ar.total * tw[i] * r.range(0.6, 1.1));
    return { customer: c, sales: sales12, outstanding: due, days: Math.round(r.range(20, 110)), status: "" };
  }).map((x) => ({ ...x, status: (x.days as number) > 90 ? "Hold supply" : (x.days as number) > 60 ? "Follow up" : "Healthy" }));
  const kpis: KPI[] = [
    { label: `Revenue · ${monthLabel(ctx.months[11])}`, value: last, unit: "inr", delta: chg(last, prev), goodWhen: "up", spark: spark(rev) },
    { label: "Revenue, FY to date", value: fytd, unit: "inr", delta: r.range(0.06, 0.19), goodWhen: "up", hint: "vs same period last year" },
    { label: "Orders last month", value: orders, unit: "num", delta: r.range(-0.08, 0.14), goodWhen: "up" },
    { label: "Receivables outstanding", value: ar.total, unit: "inr", delta: r.range(-0.04, 0.12), goodWhen: "down" },
    { label: "Days sales outstanding", value: ar.dso, unit: "days", delta: r.range(-0.05, 0.1), goodWhen: "down" },
  ];
  const above = rev.filter((v, i) => v >= target[i]).length;
  const charts: ChartSpec[] = [
    {
      id: "rev", title: "Monthly revenue vs target", kind: "bar", unit: "inr", wide: true, xKey: "m",
      finding: `${above} of the last 12 months met target; ${monthLabel(ctx.months[11])} closed at ${inr(last)}.`,
      data: rev.map((v, i) => ({ m: monthLabel(ctx.months[i]), revenue: v, target: target[i] })),
      series: [{ key: "revenue", label: "Revenue", tone: "accent" }, { key: "target", label: "Target", tone: "faint" }],
    },
    {
      id: "prod", title: "Sales by product, last 3 months", kind: "hbar", unit: "inr", xKey: "name",
      finding: `${products[0]} brings in ${Math.round(pw[0] * 100)}% of sales.`,
      data: products.map((p, i) => ({ name: p, value: Math.round(q3 * pw[i]) })),
      series: [{ key: "value", label: "Sales", tone: "accent" }],
    },
    {
      id: "chan", title: "Channel mix", kind: "donut", unit: "inr", xKey: "name",
      finding: `${ch[0]} is the largest channel at ${Math.round(cw[0] * 100)}%.`,
      data: ch.map((c, i) => ({ name: c, value: Math.round(q3 * cw[i]) })),
      series: [{ key: "value", label: "Sales", tone: "accent" }],
    },
  ];
  const tables: TableSpec[] = [
    { title: "Recent orders", columns: [
      { key: "order", label: "Order", type: "text" }, { key: "date", label: "Date", type: "date" }, { key: "customer", label: "Customer", type: "text" },
      { key: "product", label: "Product", type: "text" }, { key: "qty", label: "Qty", type: "text" }, { key: "amount", label: "Amount", type: "inr" }, { key: "status", label: "Status", type: "status" },
    ], rows },
    { title: "Customer credit", columns: [
      { key: "customer", label: "Customer", type: "text" }, { key: "sales", label: "Sales, 12 months", type: "inr" }, { key: "outstanding", label: "Outstanding", type: "inr" },
      { key: "days", label: "Oldest bill (days)", type: "number" }, { key: "status", label: "Action", type: "status" },
    ], rows: custRows },
  ];
  const hold = custRows.filter((c) => c.status === "Hold supply");
  const alerts: Alert[] = [];
  if (hold.length) alerts.push({ level: "critical", module: "sales", text: `${hold.length} customer${hold.length > 1 ? "s have" : " has"} bills older than 90 days — ${inr(hold.reduce((a, b) => a + (b.outstanding as number), 0))} at risk.` });
  alerts.push({ level: "info", module: "sales", text: `${rows.filter((x) => x.status === "Awaiting payment").length} orders are ready but waiting for advance payment.` });
  return { key: "sales", kpis, charts, tables, alerts, insights: [] };
}

function finance(ctx: Ctx): ModuleData {
  const r = rng(ctx, "fin");
  const rev = revenueSeries(ctx);
  const last = rev[11];
  const margin = ctx.ind.margin * r.range(0.92, 1.06);
  const opex = r.range(0.1, 0.15);
  const ebitda = last * (margin - opex);
  const cash = Math.round((ctx.annual / 12) * r.range(0.25, 0.55));
  const ar = receivablesInfo(ctx);
  const ap = payablesInfo(ctx);
  const cost = last * (1 - margin) + last * opex;
  const parts = [
    ["Raw material", 1 - margin - 0.12], ["Wages & salaries", 0.075], ["Power & fuel", 0.03], ["Freight", 0.025], ["Rent, admin & other", opex - 0.03],
  ] as [string, number][];
  const ps = parts.reduce((a, b) => a + Math.max(0.01, b[1]), 0);
  const cf = ctx.months.slice(-6).map((m, i) => {
    const inflow = rev[6 + i] * r.range(0.88, 1.04);
    const outflow = rev[6 + i] * r.range(0.86, 1.0);
    return { m: monthLabel(m), inflow: Math.round(inflow), outflow: Math.round(outflow) };
  });
  const net6 = cf.reduce((a, b) => a + b.inflow - b.outflow, 0);
  const invRows: Row[] = Array.from({ length: 10 }, (_, i) => {
    const overdue = Math.round(r.range(5, 120));
    return {
      invoice: `INV/${ctx.now.getFullYear() - (ctx.now.getMonth() < 3 ? 1 : 0)}-${String((ctx.now.getFullYear() + 1) % 100)}/${String(1840 - i * 17)}`,
      party: r.pick(ctx.bp.vocab.customers),
      amount: Math.round(r.range(0.4, 2.2) * (ar.total / 18) / 100) * 100,
      due: dateLabel(daysAgo(ctx, overdue)),
      overdue,
      status: overdue > 90 ? "Escalate" : overdue > 45 ? "Reminder sent" : "Due",
    };
  }).sort((a, b) => (b.overdue as number) - (a.overdue as number));
  const kpis: KPI[] = [
    { label: "Cash & bank balance", value: cash, unit: "inr", delta: r.range(-0.12, 0.1), goodWhen: "up" },
    { label: "Gross margin", value: margin, unit: "pct", delta: r.range(-0.04, 0.04), goodWhen: "up" },
    { label: `EBITDA · ${monthLabel(ctx.months[11])}`, value: Math.round(ebitda), unit: "inr", delta: r.range(-0.1, 0.15), goodWhen: "up" },
    { label: "Payables due", value: ap.total, unit: "inr", delta: r.range(-0.05, 0.08), goodWhen: "down" },
    { label: "MSME supplier dues past 45 days", value: ap.msmeLate, unit: "inr", goodWhen: "down", hint: "Disallowed as expense if unpaid at year end (45-day rule)" },
  ];
  const charts: ChartSpec[] = [
    { id: "cf", title: "Cash in vs cash out", kind: "bar", unit: "inr", wide: true, xKey: "m",
      finding: `Net cash ${net6 >= 0 ? "added" : "burned"} over 6 months: ${inr(Math.abs(net6))}.`,
      data: cf, series: [{ key: "inflow", label: "Collections", tone: "accent" }, { key: "outflow", label: "Payments", tone: "muted" }] },
    { id: "age", title: "Receivables ageing (days)", kind: "bar", unit: "inr", xKey: "bucket",
      finding: `${inr(ar.buckets.slice(3).reduce((a, b) => a + b.amount, 0))} is older than 60 days.`,
      data: ar.buckets.map((b) => ({ bucket: b.bucket, amount: b.amount })), series: [{ key: "amount", label: "Outstanding", tone: "accent" }] },
    { id: "exp", title: `Where the money went · ${monthLabel(ctx.months[11])}`, kind: "donut", unit: "inr", xKey: "name",
      finding: `Raw material is ${Math.round((Math.max(0.01, parts[0][1]) / ps) * 100)}% of spend.`,
      data: parts.map(([n, v]) => ({ name: n, value: Math.round((cost * Math.max(0.01, v)) / ps) })), series: [{ key: "value", label: "Spend", tone: "accent" }] },
  ];
  const tables: TableSpec[] = [{ title: "Overdue invoices", columns: [
    { key: "invoice", label: "Invoice", type: "text" }, { key: "party", label: "Party", type: "text" }, { key: "amount", label: "Amount", type: "inr" },
    { key: "due", label: "Due date", type: "date" }, { key: "overdue", label: "Days overdue", type: "number" }, { key: "status", label: "Status", type: "status" },
  ], rows: invRows }];
  const alerts: Alert[] = [
    { level: "warn", module: "finance", text: `${inr(ap.msmeLate)} owed to MSME suppliers is past 45 days — pay before 31 March to keep it tax-deductible.` },
  ];
  if (cash < ap.total * 0.35) alerts.push({ level: "critical", module: "finance", text: `Cash covers only ${Math.round((cash / ap.total) * 100)}% of payables due. Consider invoice discounting.` });
  return { key: "finance", kpis, charts, tables, alerts, insights: [] };
}

function inventory(ctx: Ctx): ModuleData {
  const r = rng(ctx, "inv");
  const dio = Math.round(r.range(38, 95));
  const stockValue = ((ctx.annual * (1 - ctx.ind.margin)) / 365) * dio;
  const items = [
    ...ctx.bp.vocab.products.slice(0, 6).map((n) => ({ n, cat: "Finished goods", unit: ctx.bp.vocab.unit })),
    ...ctx.bp.vocab.rawMaterials.slice(0, 5).map((n) => ({ n, cat: "Raw material", unit: /diesel|fuel|oil/i.test(n) ? "L" : /resin|dye|chemical|lacquer|colour|powder|lubric/i.test(n) ? "kg" : ctx.bp.vocab.unit === "sq ft" ? "tonnes" : "kg" })),
  ];
  const w = r.weights(items.length, 0.9);
  const ss = sites(ctx);
  let below = 0;
  const rows: Row[] = items.map((it, i) => {
    const value = Math.round(stockValue * w[i]);
    const rate = it.cat === "Finished goods" ? ctx.ind.avgUnitPrice * (1 - ctx.ind.margin) : r.range(40, 900);
    const onHand = Math.max(1, Math.round(value / rate));
    const reorder = Math.round(onHand * r.range(0.4, 1.4));
    const status = onHand < reorder * 0.6 ? "Critical" : onHand < reorder ? "Low" : "OK";
    if (status !== "OK") below++;
    return {
      sku: `${it.cat === "Finished goods" ? "FG" : "RM"}-${String(101 + i * 7)}`,
      item: it.n, category: it.cat, site: r.pick(ss).name,
      onhand: `${onHand.toLocaleString("en-IN")} ${it.unit}`, reorder: `${reorder.toLocaleString("en-IN")} ${it.unit}`,
      value, status,
    };
  });
  const total = rows.reduce((a, b) => a + (b.value as number), 0);
  const ageShares = [0.46, 0.3, 0.14, 0.1].map((x) => x * r.range(0.8, 1.2));
  const as = ageShares.reduce((a, b) => a + b, 0);
  const aging = ["0–30 days", "31–90 days", "91–180 days", "180+ days"].map((b, i) => ({ bucket: b, value: Math.round((total * ageShares[i]) / as) }));
  const kpis: KPI[] = [
    { label: "Stock value", value: total, unit: "inr", delta: r.range(-0.06, 0.1), goodWhen: "down" },
    { label: "Items at or below reorder level", value: below, unit: "num", goodWhen: "down" },
    { label: "Days of inventory", value: dio, unit: "days", delta: r.range(-0.08, 0.06), goodWhen: "down" },
    { label: "Dead stock (180+ days)", value: aging[3].value, unit: "inr", delta: r.range(-0.1, 0.12), goodWhen: "down" },
  ];
  const fg = rows.filter((x) => x.category === "Finished goods").reduce((a, b) => a + (b.value as number), 0);
  const charts: ChartSpec[] = [
    { id: "val", title: "Stock value by item", kind: "hbar", unit: "inr", xKey: "name", wide: true,
      finding: `Finished goods hold ${Math.round((fg / total) * 100)}% of stock value.`,
      data: rows.map((x) => ({ name: x.item, value: x.value })).sort((a, b) => (b.value as number) - (a.value as number)).slice(0, 8),
      series: [{ key: "value", label: "Value", tone: "accent" }] },
    { id: "age", title: "Stock ageing", kind: "bar", unit: "inr", xKey: "bucket",
      finding: `${inr(aging[3].value)} has not moved in six months.`,
      data: aging, series: [{ key: "value", label: "Value", tone: "accent" }] },
  ];
  const tables: TableSpec[] = [{ title: "Stock register", columns: [
    { key: "sku", label: "SKU", type: "text" }, { key: "item", label: "Item", type: "text" }, { key: "category", label: "Type", type: "text" },
    { key: "site", label: "Location", type: "text" }, { key: "onhand", label: "On hand", type: "text" }, { key: "reorder", label: "Reorder at", type: "text" },
    { key: "value", label: "Value", type: "inr" }, { key: "status", label: "Status", type: "status" },
  ], rows }];
  const crit = rows.filter((x) => x.status === "Critical");
  const alerts: Alert[] = crit.map((c) => ({ level: "critical" as const, module: "inventory", text: `${c.item} at ${c.site} is critically low (${c.onhand}).` })).slice(0, 2);
  return { key: "inventory", kpis, charts, tables, alerts, insights: [] };
}

function supply(ctx: Ctx): ModuleData {
  const r = rng(ctx, "sup");
  const spend = (ctx.annual / 12) * (1 - ctx.ind.margin) * r.range(0.65, 0.85);
  const mats = ctx.bp.vocab.rawMaterials.slice(0, 6);
  const mw = r.weights(mats.length);
  const sups = ctx.bp.vocab.suppliers.slice(0, 5);
  const otd = sups.map(() => r.range(0.62, 0.98));
  const rows: Row[] = Array.from({ length: 10 }, (_, i) => {
    const late = r.next() < 0.25;
    return {
      po: `PO-${String(560 - i * 4)}`, supplier: r.pick(sups), material: r.pick(mats),
      value: Math.round((spend / 8) * r.range(0.3, 1.6) / 100) * 100,
      expected: dateLabel(new Date(ctx.now.getTime() + (late ? -r.int(1, 6) : r.int(1, 14)) * 86400000)),
      status: late ? "Delayed" : i < 3 ? "Approved" : r.pick(["In transit", "Approved", "Partially received"]),
    };
  });
  const kpis: KPI[] = [
    { label: "Purchases last month", value: Math.round(spend), unit: "inr", delta: r.range(-0.08, 0.12), goodWhen: "down" },
    { label: "Open purchase orders", value: rows.filter((x) => x.status !== "Received").length + r.int(4, 12), unit: "num" },
    { label: "Vendor on-time delivery", value: otd.reduce((a, b) => a + b, 0) / otd.length, unit: "pct", delta: r.range(-0.05, 0.05), goodWhen: "up" },
    { label: "Average lead time", value: r.range(6, 21), unit: "days", delta: r.range(-0.1, 0.1), goodWhen: "down" },
  ];
  const worst = sups[otd.indexOf(Math.min(...otd))];
  const charts: ChartSpec[] = [
    { id: "spend", title: "Spend by material, last 3 months", kind: "hbar", unit: "inr", xKey: "name",
      finding: `${mats[0]} is ${Math.round(mw[0] * 100)}% of purchases.`,
      data: mats.map((m, i) => ({ name: m, value: Math.round(spend * 3 * mw[i]) })), series: [{ key: "value", label: "Spend", tone: "accent" }] },
    { id: "otd", title: "On-time delivery by vendor", kind: "bar", unit: "pct", xKey: "name",
      finding: `${worst} is the least reliable at ${Math.round(Math.min(...otd) * 100)}% on time.`,
      data: sups.map((s, i) => ({ name: s.length > 18 ? s.slice(0, 17) + "…" : s, value: Number(otd[i].toFixed(3)) })), series: [{ key: "value", label: "On time", tone: "accent" }] },
  ];
  const tables: TableSpec[] = [{ title: "Purchase orders", columns: [
    { key: "po", label: "PO", type: "text" }, { key: "supplier", label: "Supplier", type: "text" }, { key: "material", label: "Material", type: "text" },
    { key: "value", label: "Value", type: "inr" }, { key: "expected", label: "Expected", type: "date" }, { key: "status", label: "Status", type: "status" },
  ], rows }];
  const delayed = rows.filter((x) => x.status === "Delayed");
  const alerts: Alert[] = delayed.length ? [{ level: "warn", module: "supply", text: `${delayed.length} purchase orders are past their expected date — production of ${ctx.bp.vocab.products[0]} may slip.` }] : [];
  return { key: "supply", kpis, charts, tables, alerts, insights: [] };
}

function production(ctx: Ctx): ModuleData {
  const r = rng(ctx, "prod");
  const dailyPlan = ctx.annual / 12 / ctx.ind.avgUnitPrice / 26;
  const days = Array.from({ length: 30 }, (_, i) => daysAgo(ctx, 30 - i));
  const out = days.map((d) => (d.getDay() === 0 ? 0 : Math.round(dailyPlan * r.range(0.72, 1.08))));
  const plan = days.map((d) => (d.getDay() === 0 ? 0 : Math.round(dailyPlan)));
  const totalOut = out.reduce((a, b) => a + b, 0);
  const totalPlan = plan.reduce((a, b) => a + b, 0);
  const oee = r.range(0.56, 0.78);
  const rej = r.range(0.015, 0.045);
  const reasons = ["Power cuts", "Machine breakdown", "Changeover / setup", "Material shortage", "Operator absent"];
  const rw = r.weights(reasons.length, 1);
  const downtime = Math.round(r.range(40, 140) * Math.max(1, sites(ctx).length * 0.6));
  const lines = ctx.bp.intake.industry === "marble" ? ["Gang saw 1", "Gang saw 2", "Polishing line", "Cutter 3"] : ctx.bp.intake.industry === "textile" ? ["Loom shed A", "Loom shed B", "Jet dyeing", "Stenter"] : ["Line 1", "Line 2", "Line 3", "Assembly"];
  const rows: Row[] = Array.from({ length: 9 }, (_, i) => {
    const qty = Math.round(dailyPlan * r.range(2, 9));
    const pct = i < 2 ? 0 : Math.min(1, r.range(0.15, 1.05));
    return {
      wo: `WO-${String(3310 - i * 6)}`, product: r.pick(ctx.bp.vocab.products), line: r.pick(lines),
      planned: `${qty.toLocaleString("en-IN")} ${ctx.bp.vocab.unit}`, progress: Number(pct.toFixed(2)),
      due: dateLabel(new Date(ctx.now.getTime() + r.int(-2, 10) * 86400000)),
      status: pct >= 1 ? "Completed" : pct === 0 ? "Not started" : pct < 0.4 && i % 3 === 0 ? "Behind plan" : "Running",
    };
  });
  const kpis: KPI[] = [
    { label: "Output, last 30 days", value: totalOut, unit: "qty", delta: chg(totalOut, totalPlan), goodWhen: "up", hint: `${ctx.bp.vocab.unit} vs plan`, spark: out.slice(-8) },
    { label: "Overall equipment effectiveness", value: oee, unit: "pct", delta: r.range(-0.05, 0.05), goodWhen: "up" },
    { label: "Rejection rate", value: rej, unit: "pct", delta: r.range(-0.15, 0.15), goodWhen: "down" },
    { label: "Machine downtime", value: downtime, unit: "hrs", delta: r.range(-0.2, 0.2), goodWhen: "down" },
  ];
  const charts: ChartSpec[] = [
    { id: "out", title: "Daily output vs plan", kind: "line", unit: "qty", xKey: "d", wide: true,
      finding: `Output reached ${Math.round((totalOut / totalPlan) * 100)}% of plan over 30 days.`,
      data: days.map((d, i) => ({ d: dateLabel(d), output: out[i], plan: plan[i] })),
      series: [{ key: "output", label: "Output", tone: "accent" }, { key: "plan", label: "Plan", tone: "faint" }] },
    { id: "down", title: "Downtime by reason", kind: "hbar", unit: "hrs", xKey: "name",
      finding: `${reasons[0]} cost ${Math.round(downtime * rw[0])} hours this month.`,
      data: reasons.map((x, i) => ({ name: x, value: Math.round(downtime * rw[i]) })), series: [{ key: "value", label: "Hours", tone: "accent" }] },
  ];
  const tables: TableSpec[] = [{ title: "Work orders", columns: [
    { key: "wo", label: "Work order", type: "text" }, { key: "product", label: "Product", type: "text" }, { key: "line", label: "Line / machine", type: "text" },
    { key: "planned", label: "Planned", type: "text" }, { key: "progress", label: "Progress", type: "pct" }, { key: "due", label: "Due", type: "date" }, { key: "status", label: "Status", type: "status" },
  ], rows }];
  const behind = rows.filter((x) => x.status === "Behind plan");
  const alerts: Alert[] = behind.length ? [{ level: "warn", module: "production", text: `${behind.length} work order${behind.length > 1 ? "s are" : " is"} behind plan on ${behind[0].line}.` }] : [];
  return { key: "production", kpis, charts, tables, alerts, insights: [] };
}

function logistics(ctx: Ctx): ModuleData {
  const r = rng(ctx, "log");
  const rev = revenueSeries(ctx);
  const disp = Math.max(6, Math.round(rev[11] / (ctx.ind.avgUnitPrice * r.range(60, 220))));
  const otif = r.range(0.78, 0.95);
  const freightPct = r.range(0.022, 0.058);
  const cities = ctx.bp.vocab.cities.slice(0, 6);
  const cw = r.weights(cities.length);
  const rows: Row[] = Array.from({ length: 10 }, (_, i) => {
    const status = i < 2 ? "Loading" : r.pick(["In transit", "In transit", "Delivered", "Delivered", "Delayed"]);
    return {
      lr: `LR ${String(48210 - i * 13)}`, destination: r.pick(cities), transporter: r.pick(TRANSPORTERS),
      vehicle: `RJ-${String(r.int(1, 52)).padStart(2, "0")}-G${String.fromCharCode(65 + r.int(0, 25))}-${r.int(1000, 9999)}`,
      ewb: `${r.int(1000, 9999)} ${r.int(1000, 9999)} ${r.int(1000, 9999)}`,
      value: Math.round(r.range(0.6, 3) * (rev[11] / disp) / 100) * 100,
      eta: dateLabel(new Date(ctx.now.getTime() + r.int(-1, 5) * 86400000)),
      status,
    };
  });
  const expiring = rows.filter((x) => x.status === "In transit").length > 2 ? 2 : 1;
  const kpis: KPI[] = [
    { label: "Dispatches last month", value: disp, unit: "num", delta: r.range(-0.08, 0.12), goodWhen: "up" },
    { label: "On time, in full", value: otif, unit: "pct", delta: r.range(-0.04, 0.04), goodWhen: "up" },
    { label: "Freight as % of sales", value: freightPct, unit: "pct", delta: r.range(-0.08, 0.1), goodWhen: "down" },
    { label: "E-way bills expiring in 24h", value: expiring, unit: "num", goodWhen: "down" },
  ];
  const charts: ChartSpec[] = [
    { id: "dest", title: "Dispatches by destination", kind: "hbar", unit: "num", xKey: "name",
      finding: `${cities[0]} takes ${Math.round(cw[0] * 100)}% of loads.`,
      data: cities.map((c, i) => ({ name: c, value: Math.max(1, Math.round(disp * cw[i])) })), series: [{ key: "value", label: "Dispatches", tone: "accent" }] },
    { id: "frt", title: "Freight cost by month", kind: "area", unit: "inr", xKey: "m",
      finding: `Freight is running at ${(freightPct * 100).toFixed(1)}% of sales.`,
      data: rev.map((v, i) => ({ m: monthLabel(ctx.months[i]), value: Math.round(v * freightPct * r.range(0.9, 1.1)) })), series: [{ key: "value", label: "Freight", tone: "accent" }] },
  ];
  const tables: TableSpec[] = [{ title: "Shipments", columns: [
    { key: "lr", label: "LR / docket", type: "text" }, { key: "destination", label: "To", type: "text" }, { key: "transporter", label: "Transporter", type: "text" },
    { key: "vehicle", label: "Vehicle", type: "text" }, { key: "ewb", label: "E-way bill", type: "text" }, { key: "value", label: "Invoice value", type: "inr" },
    { key: "eta", label: "ETA", type: "date" }, { key: "status", label: "Status", type: "status" },
  ], rows }];
  const alerts: Alert[] = [{ level: "warn", module: "logistics", text: `${expiring} e-way bill${expiring > 1 ? "s" : ""} expire in the next 24 hours — extend before the vehicle is stopped.` }];
  return { key: "logistics", kpis, charts, tables, alerts, insights: [] };
}

function staffRoster(ctx: Ctx) {
  const r = rng(ctx, "staff");
  const depts = ctx.bp.vocab.departments;
  const dw = r.weights(depts.length, 0.8);
  const counts = depts.map((_, i) => Math.max(1, Math.round(ctx.employees * dw[i])));
  const diff = ctx.employees - counts.reduce((a, b) => a + b, 0);
  counts[0] = Math.max(1, counts[0] + diff);
  return { depts, counts };
}

function avgGross(ctx: Ctx) {
  const monthly = ctx.annual / 12;
  return Math.min(32000, Math.max(12500, (monthly * 0.1) / ctx.employees));
}

function staff(ctx: Ctx): ModuleData {
  const r = rng(ctx, "staff2");
  const { depts, counts } = staffRoster(ctx);
  const ss = sites(ctx);
  const att = Array.from({ length: 14 }, (_, i) => daysAgo(ctx, 14 - i)).map((d) => ({ d: dateLabel(d), value: d.getDay() === 0 ? 0 : Number(r.range(0.82, 0.96).toFixed(3)) }));
  const today = att.filter((a) => a.value > 0).slice(-1)[0]?.value ?? 0.9;
  const rows: Row[] = NAMES.slice(0, 12).map((n, i) => ({
    id: `EMP-${String(1020 + i * 3)}`, name: n, dept: depts[i % depts.length], site: ss[i % ss.length].name,
    shift: r.pick(["General", "A (6–2)", "B (2–10)", "C (10–6)"]),
    status: r.next() < today ? (r.next() < 0.08 ? "Late" : "Present") : r.pick(["Absent", "On leave"]),
    since: String(r.int(2012, 2026)),
  }));
  const contract = r.range(0.25, 0.55);
  const kpis: KPI[] = [
    { label: "Headcount", value: ctx.employees, unit: "num", delta: r.range(-0.03, 0.06), goodWhen: "up" },
    { label: "Present today", value: today, unit: "pct", delta: r.range(-0.03, 0.03), goodWhen: "up" },
    { label: "Overtime this month", value: Math.round(ctx.employees * r.range(3, 9)), unit: "hrs", delta: r.range(-0.15, 0.2), goodWhen: "down" },
    { label: "Attrition, annualised", value: r.range(0.12, 0.32), unit: "pct", delta: r.range(-0.1, 0.1), goodWhen: "down" },
    { label: "Contract workers", value: contract, unit: "pct" },
  ];
  const charts: ChartSpec[] = [
    { id: "att", title: "Attendance, last 14 days", kind: "bar", unit: "pct", xKey: "d", wide: true,
      finding: `Average attendance on working days: ${Math.round((att.filter((a) => a.value > 0).reduce((a, b) => a + b.value, 0) / att.filter((a) => a.value > 0).length) * 100)}%.`,
      data: att, series: [{ key: "value", label: "Present", tone: "accent" }] },
    { id: "dept", title: "Headcount by department", kind: "hbar", unit: "num", xKey: "name",
      finding: `${depts[0]} employs ${counts[0]} of ${ctx.employees} people.`,
      data: depts.map((d, i) => ({ name: d, value: counts[i] })), series: [{ key: "value", label: "People", tone: "accent" }] },
  ];
  const tables: TableSpec[] = [{ title: "Today's roster", columns: [
    { key: "id", label: "ID", type: "text" }, { key: "name", label: "Name", type: "text" }, { key: "dept", label: "Department", type: "text" },
    { key: "site", label: "Site", type: "text" }, { key: "shift", label: "Shift", type: "text" }, { key: "status", label: "Today", type: "status" }, { key: "since", label: "Joined", type: "text" },
  ], rows }];
  const absent = Math.round(ctx.employees * (1 - today));
  return { key: "staff", kpis, charts, tables, alerts: absent > 5 ? [{ level: "info", module: "staff", text: `${absent} people absent today; ${depts[0]} is short-staffed on the first shift.` }] : [], insights: [] };
}

function payroll(ctx: Ctx): ModuleData {
  const r = rng(ctx, "pay");
  const { depts, counts } = staffRoster(ctx);
  const g = avgGross(ctx);
  const gross = Math.round(g * ctx.employees);
  const emp = (grossPay: number) => {
    const basic = grossPay * 0.5;
    const pfWage = Math.min(basic, 15000);
    const pfEmp = Math.round(pfWage * 0.12);
    const pfEr = Math.round(pfWage * 0.12);
    const esiEmp = grossPay <= 21000 ? Math.round(grossPay * 0.0075) : 0;
    const esiEr = grossPay <= 21000 ? Math.round(grossPay * 0.0325) : 0;
    return { pfEmp, pfEr, esiEmp, esiEr, net: grossPay - pfEmp - esiEmp };
  };
  const rows: Row[] = NAMES.slice(0, 10).map((n, i) => {
    const gp = Math.round(r.range(0.6, 1.9) * g / 100) * 100;
    const c = emp(gp);
    const adv = r.next() < 0.25 ? Math.round(r.range(1, 5)) * 1000 : 0;
    return { name: n, dept: depts[i % depts.length], gross: gp, pf: c.pfEmp, esi: c.esiEmp, advance: adv, net: c.net - adv, status: i < 7 ? "Approved" : "Pending approval" };
  });
  const avg = emp(g);
  const pfTotal = Math.round((avg.pfEmp + avg.pfEr) * ctx.employees);
  const esiTotal = Math.round((avg.esiEmp + avg.esiEr) * ctx.employees);
  const net = Math.round(avg.net * ctx.employees);
  const trend = ctx.months.map((m, i) => ({ m: monthLabel(m), value: Math.round(gross * (0.9 + i * 0.009) * r.range(0.98, 1.03)) }));
  const kpis: KPI[] = [
    { label: `Gross payroll · ${monthLabel(ctx.now)}`, value: gross, unit: "inr", delta: r.range(0.0, 0.05), goodWhen: "down", spark: trend.map((t) => t.value).slice(-8) },
    { label: "Net salary payout", value: net, unit: "inr" },
    { label: "PF (employee + employer)", value: pfTotal, unit: "inr", hint: "Deposit by the 15th" },
    { label: "ESI (employee + employer)", value: esiTotal, unit: "inr", hint: "For staff earning up to ₹21,000" },
  ];
  const charts: ChartSpec[] = [
    { id: "trend", title: "Payroll cost by month", kind: "area", unit: "inr", xKey: "m", wide: true,
      finding: `Payroll is ${((gross / (ctx.annual / 12)) * 100).toFixed(1)}% of monthly revenue.`,
      data: trend, series: [{ key: "value", label: "Gross payroll", tone: "accent" }] },
    { id: "dept", title: "Payroll by department", kind: "hbar", unit: "inr", xKey: "name",
      finding: `${depts[0]} accounts for ${Math.round((counts[0] / ctx.employees) * 100)}% of salary cost.`,
      data: depts.map((d, i) => ({ name: d, value: Math.round(counts[i] * g) })), series: [{ key: "value", label: "Cost", tone: "accent" }] },
  ];
  const tables: TableSpec[] = [{ title: `Salary register · ${monthLabel(ctx.now)}`, columns: [
    { key: "name", label: "Employee", type: "text" }, { key: "dept", label: "Department", type: "text" }, { key: "gross", label: "Gross", type: "inr" },
    { key: "pf", label: "PF (12%)", type: "inr" }, { key: "esi", label: "ESI (0.75%)", type: "inr" }, { key: "advance", label: "Advance", type: "inr" },
    { key: "net", label: "Net pay", type: "inr" }, { key: "status", label: "Status", type: "status" },
  ], rows }];
  const pfDue = new Date(ctx.now.getFullYear(), ctx.now.getMonth() + (ctx.now.getDate() > 15 ? 1 : 0), 15);
  return { key: "payroll", kpis, charts, tables, alerts: [{ level: "info", module: "payroll", text: `PF and ESI of ${inr(pfTotal + esiTotal)} due on ${fullDate(pfDue)}.` }], insights: [] };
}

function quality(ctx: Ctx): ModuleData {
  const r = rng(ctx, "qa");
  const defects = DEFECTS[ctx.bp.intake.industry] ?? ["Dimensional", "Surface finish", "Packing damage", "Wrong specification", "Contamination"];
  const dw = r.weights(defects.length);
  const monthlyQty = ctx.annual / 12 / ctx.ind.avgUnitPrice;
  const rejRate = r.range(0.015, 0.045);
  const rej = Math.round(monthlyQty * rejRate);
  const weeks = Array.from({ length: 12 }, (_, i) => ({ w: `W${i + 1}`, value: Number((rejRate * r.range(0.7, 1.35)).toFixed(4)) }));
  const rows: Row[] = Array.from({ length: 9 }, (_, i) => ({
    lot: `LOT-${String(9120 - i * 11)}`, product: r.pick(ctx.bp.vocab.products), date: dateLabel(daysAgo(ctx, i)),
    checked: r.int(50, 600), rejected: r.int(0, 18), defect: r.pick(defects), result: "",
  })).map((x) => ({ ...x, result: (x.rejected as number) / (x.checked as number) > 0.04 ? "Rework" : (x.rejected as number) === 0 ? "Passed" : "Passed with remarks" }));
  const kpis: KPI[] = [
    { label: "First-pass yield", value: 1 - rejRate, unit: "pct", delta: r.range(-0.01, 0.01), goodWhen: "up" },
    { label: "Rejected last month", value: rej, unit: "qty", hint: ctx.bp.vocab.unit, delta: r.range(-0.15, 0.15), goodWhen: "down" },
    { label: "Open customer complaints", value: r.int(1, 9), unit: "num", goodWhen: "down" },
    { label: "Cost of poor quality", value: Math.round(rej * ctx.ind.avgUnitPrice * 0.6), unit: "inr", goodWhen: "down" },
  ];
  const charts: ChartSpec[] = [
    { id: "def", title: "Rejections by defect", kind: "hbar", unit: "qty", xKey: "name",
      finding: `${defects[0]} cause ${Math.round(dw[0] * 100)}% of rejections.`,
      data: defects.map((d, i) => ({ name: d, value: Math.round(rej * dw[i]) })), series: [{ key: "value", label: "Rejected", tone: "neg" }] },
    { id: "wk", title: "Weekly rejection rate", kind: "line", unit: "pct", xKey: "w",
      finding: `Best week ${(Math.min(...weeks.map((w) => w.value)) * 100).toFixed(1)}%, worst ${(Math.max(...weeks.map((w) => w.value)) * 100).toFixed(1)}%.`,
      data: weeks, series: [{ key: "value", label: "Rejection", tone: "accent" }] },
  ];
  const tables: TableSpec[] = [{ title: "Inspection log", columns: [
    { key: "lot", label: "Lot", type: "text" }, { key: "product", label: "Product", type: "text" }, { key: "date", label: "Date", type: "date" },
    { key: "checked", label: "Checked", type: "number" }, { key: "rejected", label: "Rejected", type: "number" }, { key: "defect", label: "Main defect", type: "text" }, { key: "result", label: "Result", type: "status" },
  ], rows }];
  return { key: "quality", kpis, charts, tables, alerts: [], insights: [] };
}

export function complianceCalendar(ctx: Ctx) {
  const now = ctx.now;
  const y = now.getFullYear();
  const m = now.getMonth();
  const prevMonth = monthLabel(new Date(y, m - 1, 1));
  const curMonth = monthLabel(new Date(y, m, 1));
  const big = (TURNOVER_BANDS.find((b) => b.key === ctx.bp.intake.turnoverBand)?.annual ?? 0) >= 5e7;
  const items: { name: string; form: string; period: string; due: Date; owner: string }[] = [
    { name: "TDS / TCS deposit", form: "Challan 281", period: prevMonth, due: new Date(y, m, 7), owner: "Accounts" },
    { name: "GST outward supplies", form: "GSTR-1", period: prevMonth, due: new Date(y, m, 11), owner: "Accounts" },
    { name: "PF & ESI contribution", form: "ECR / ESIC challan", period: prevMonth, due: new Date(y, m, 15), owner: "HR" },
    { name: "GST summary return & tax payment", form: "GSTR-3B", period: prevMonth, due: new Date(y, m, 20), owner: "Accounts" },
    { name: "TDS / TCS deposit", form: "Challan 281", period: curMonth, due: new Date(y, m + 1, 7), owner: "Accounts" },
    { name: "GST outward supplies", form: "GSTR-1", period: curMonth, due: new Date(y, m + 1, 11), owner: "Accounts" },
    { name: "PF & ESI contribution", form: "ECR / ESIC challan", period: curMonth, due: new Date(y, m + 1, 15), owner: "HR" },
    { name: "GST summary return & tax payment", form: "GSTR-3B", period: curMonth, due: new Date(y, m + 1, 20), owner: "Accounts" },
    { name: "Advance tax instalment", form: "Challan 280", period: "Q3", due: new Date(y, 11, 15), owner: "CA" },
    { name: "GST annual return", form: "GSTR-9", period: `FY ${y - 2}-${String(y - 1).slice(2)}`, due: new Date(y, 11, 31), owner: "CA" },
  ];
  if (ctx.bp.intake.state.toLowerCase().includes("rajasthan")) {
    items.push({ name: "Consent to Operate renewal (RSPCB)", form: "CTO", period: "Annual", due: new Date(y, m + 2, 5), owner: "Owner" });
  }
  items.push({ name: "Factory licence renewal", form: "Form 2", period: "Annual", due: new Date(y + 1, 0, 31), owner: "Owner" });
  const r = rng(ctx, "comp");
  let lateDone = false;
  const rows = items
    .sort((a, b) => a.due.getTime() - b.due.getTime())
    .map((it) => {
      const days = Math.ceil((it.due.getTime() - now.getTime()) / 86400000);
      let status: string;
      if (days < 0) {
        if (!lateDone && it.form === "GSTR-1" && r.next() < 0.6) { status = "Overdue"; lateDone = true; }
        else status = "Filed";
      } else status = days <= 7 ? `Due in ${days} day${days === 1 ? "" : "s"}` : "Upcoming";
      return { obligation: it.name, form: it.form, period: it.period, due: fullDate(it.due), owner: it.owner, status, _days: days };
    });
  return { rows, big };
}

function compliance(ctx: Ctx): ModuleData {
  const r = rng(ctx, "comp2");
  const { rows, big } = complianceCalendar(ctx);
  const overdue = rows.filter((x) => x.status === "Overdue").length;
  const due15 = rows.filter((x) => x._days >= 0 && x._days <= 15).length;
  const score = Math.max(0.6, 0.97 - overdue * 0.08 - r.range(0, 0.05));
  const hist = ctx.months.slice(-6).map((m) => ({ m: monthLabel(m), value: Math.round(r.range(-3, 6)) }));
  const kpis: KPI[] = [
    { label: "Compliance score", value: score, unit: "pct", goodWhen: "up" },
    { label: "Due in the next 15 days", value: due15, unit: "num" },
    { label: "Overdue filings", value: overdue, unit: "num", goodWhen: "down" },
    big
      ? { label: "Invoices pending e-invoice IRN", value: r.int(0, 6), unit: "num", goodWhen: "down", hint: "E-invoicing applies above ₹5 Cr turnover" }
      : { label: "E-way bills generated (month)", value: r.int(20, 140), unit: "num" },
  ];
  const charts: ChartSpec[] = [
    { id: "hist", title: "GSTR-3B filed: days before due date", kind: "bar", unit: "num", xKey: "m",
      finding: hist.some((h) => h.value < 0) ? `Filed late in ${hist.filter((h) => h.value < 0).length} of the last 6 months.` : "Filed on time every month for six months.",
      data: hist, series: [{ key: "value", label: "Days early", tone: "accent" }] },
  ];
  const tables: TableSpec[] = [{ title: "Compliance calendar", columns: [
    { key: "obligation", label: "Obligation", type: "text" }, { key: "form", label: "Form", type: "text" }, { key: "period", label: "Period", type: "text" },
    { key: "due", label: "Due date", type: "date" }, { key: "owner", label: "Owner", type: "text" }, { key: "status", label: "Status", type: "status" },
  ], rows: rows.map(({ _days, ...rest }) => { void _days; return rest; }) }];
  const alerts: Alert[] = [];
  if (overdue) alerts.push({ level: "critical", module: "compliance", text: `GSTR-1 for ${monthLabel(new Date(ctx.now.getFullYear(), ctx.now.getMonth() - 1, 1))} is overdue — late fee is accruing daily.` });
  const next = rows.find((x) => x._days >= 0);
  if (next) alerts.push({ level: "warn", module: "compliance", text: `${next.form} (${next.obligation}) is due on ${next.due}.` });
  return { key: "compliance", kpis, charts, tables, alerts, insights: [] };
}

export function schemeList(ctx: Ctx) {
  const i = ctx.bp.intake;
  const raj = i.state.toLowerCase().includes("rajasthan");
  const exp = i.channels.includes("export");
  const agro = ctx.bp.intake.industry === "food";
  const list: { scheme: string; by: string; benefit: string; fit: number; next: string }[] = [];
  if (raj) {
    list.push({ scheme: "RIPS 2024 — MSME incentives", by: "Govt of Rajasthan", benefit: "Interest subvention up to 6% on term loans up to ₹5 Cr, or 75% SGST reimbursement for 10 years", fit: 0.92, next: "Apply on the Rajasthan single-window portal before the expansion loan is drawn" });
    list.push({ scheme: "Additional interest subsidy (MSME Policy 2024)", by: "Dept of Industries & Commerce, Rajasthan", benefit: "0.5–2% over RIPS 2024 plus reimbursement of annual credit-guarantee fee", fit: 0.74, next: "Check eligible category (ODOP, women/SC/ST-led, etc.) with DIC" });
    if (agro) list.push({ scheme: "RIPS 2024 capital subsidy — agro & food processing", by: "Govt of Rajasthan", benefit: "50% of capital investment, capped at ₹1.5 Cr", fit: 0.88, next: "Prepare project report for the new grinding/packing line" });
  }
  list.push({ scheme: "CGTMSE credit guarantee", by: "Ministry of MSME / SIDBI", benefit: "Collateral-free working capital and term loans through your bank", fit: 0.81, next: "Ask your bank to cover the next CC limit enhancement under CGTMSE" });
  list.push({ scheme: "TReDS invoice discounting", by: "RBI-licensed platforms", benefit: "Get paid in 48–72 hours on invoices raised to large buyers", fit: i.channels.includes("b2b") || i.channels.includes("dealers") ? 0.77 : 0.5, next: "Onboard on one TReDS platform and list invoices to corporate buyers" });
  list.push({ scheme: "MSME Champions — ZED certification", by: "Ministry of MSME", benefit: "Subsidised quality certification that large buyers and tenders ask for", fit: 0.63, next: "Take the free Bronze-level self-assessment" });
  if (exp) list.push({ scheme: "RoDTEP export duty remission", by: "Ministry of Commerce", benefit: "Scrip on export FOB value for embedded taxes", fit: 0.84, next: "Claim on shipping bills via ICEGATE" });
  if (i.channels.includes("government")) list.push({ scheme: "GeM seller registration & MSE preference", by: "Govt e-Marketplace", benefit: "Purchase preference and EMD exemption for registered MSEs", fit: 0.79, next: "Update Udyam details on the GeM seller profile" });
  return list.sort((a, b) => b.fit - a.fit);
}

function schemes(ctx: Ctx): ModuleData {
  const r = rng(ctx, "sch");
  const list = schemeList(ctx);
  const ar = receivablesInfo(ctx);
  const loan = Math.min(5e7, ctx.annual * r.range(0.12, 0.25));
  const benefit = loan * 0.05 + (ctx.bp.intake.state.toLowerCase().includes("rajasthan") ? loan * 0.01 : 0);
  const kpis: KPI[] = [
    { label: "Schemes you likely qualify for", value: list.filter((x) => x.fit >= 0.7).length, unit: "num" },
    { label: "Estimated yearly interest saving", value: Math.round(benefit), unit: "inr", hint: `On an indicative ${inr(loan)} term loan` },
    { label: "Cash unlockable via TReDS", value: Math.round(ar.total * 0.35), unit: "inr", hint: "Receivables from large buyers" },
  ];
  const tables: TableSpec[] = [{ title: "Matched schemes (indicative — confirm with DIC or your CA)", columns: [
    { key: "scheme", label: "Scheme", type: "text" }, { key: "by", label: "Run by", type: "text" }, { key: "benefit", label: "Benefit", type: "text" },
    { key: "fit", label: "Fit", type: "pct" }, { key: "next", label: "Next step", type: "text" },
  ], rows: list }];
  return { key: "schemes", kpis, charts: [], tables, alerts: [], insights: [] };
}

const BUILDERS: Record<ModuleKey, (c: Ctx) => ModuleData> = { sales, finance, inventory, supply, production, logistics, staff, payroll, quality, compliance, schemes };

export function moduleData(bp: Blueprint, key: string, siteIdx: number | null = null): ModuleData {
  const ctx = makeCtx(bp, siteIdx);
  const custom = bp.customModules.find((c) => c.key === key);
  if (custom) {
    return {
      key,
      kpis: custom.kpis.map((k) => ({ ...k, value: k.unit === "pct" || k.unit === "days" ? k.value : k.value * ctx.share })),
      charts: [{
        id: "c1", title: custom.chart.title, kind: custom.chart.kind, unit: custom.chart.unit, xKey: "x", wide: true,
        data: custom.chart.labels.map((l, i) => ({ x: l, value: custom.chart.values[i] ?? 0 })),
        series: [{ key: "value", label: custom.chart.title, tone: "accent" }],
      }],
      tables: [{ title: custom.title, columns: custom.columns, rows: custom.rows }],
      alerts: [],
      insights: custom.insights,
    };
  }
  const b = BUILDERS[key as ModuleKey];
  if (!b) return { key, kpis: [], charts: [], tables: [], alerts: [], insights: [] };
  const d = b(ctx);
  const cfg = bp.modules.find((m) => m.key === key);
  if (cfg) {
    d.insights = cfg.insights ?? [];
    if (cfg.extraKpis?.length) d.kpis = [...d.kpis, ...cfg.extraKpis.map((k) => ({ ...k, value: k.unit === "inr" || k.unit === "qty" || k.unit === "num" ? k.value * ctx.share : k.value }))].slice(0, 6);
  }
  return d;
}

export function overview(bp: Blueprint, siteIdx: number | null = null) {
  const ctx = makeCtx(bp, siteIdx);
  const keys = bp.modules.map((m) => m.key);
  const all = keys.map((k) => moduleData(bp, k, siteIdx));
  const get = (k: string) => all.find((a) => a.key === k);
  const rev = revenueSeries(ctx);
  const kpis: KPI[] = [];
  const pickK = (k: string, idx: number) => { const d = get(k); if (d && d.kpis[idx]) kpis.push(d.kpis[idx]); };
  pickK("sales", 0); pickK("finance", 0); pickK("sales", 3); pickK("inventory", 0); pickK("production", 1); pickK("staff", 1); pickK("compliance", 0);
  if (!get("sales")) kpis.unshift({ label: `Revenue · ${monthLabel(ctx.months[11])}`, value: rev[11], unit: "inr", delta: chg(rev[11], rev[10]), goodWhen: "up", spark: spark(rev) });
  const alerts = all.flatMap((a) => a.alerts).sort((a, b) => ["critical", "warn", "info"].indexOf(a.level) - ["critical", "warn", "info"].indexOf(b.level));
  const ar = receivablesInfo(ctx);
  const comp = get("compliance")?.kpis[0]?.value ?? 0.9;
  const scoreParts = [
    { name: "Cash & collections", value: Math.max(0.35, Math.min(0.95, 1 - (ar.dso - 30) / 120)) },
    { name: "Growth", value: Math.max(0.4, Math.min(0.95, 0.65 + chg(rev.slice(-3).reduce((a, b) => a + b, 0), rev.slice(0, 3).reduce((a, b) => a + b, 0)))) },
    { name: "Operations", value: (get("production")?.kpis[1]?.value as number) ?? 0.72 },
    { name: "Compliance", value: comp as number },
  ];
  const score = Math.round((scoreParts.reduce((a, b) => a + b.value, 0) / scoreParts.length) * 100);
  const chart: ChartSpec = {
    id: "ov", title: "Revenue, last 12 months", kind: "area", unit: "inr", xKey: "m", wide: true,
    finding: `Trailing 12-month revenue: ${inr(rev.reduce((a, b) => a + b, 0))}.`,
    data: rev.map((v, i) => ({ m: monthLabel(ctx.months[i]), value: v })), series: [{ key: "value", label: "Revenue", tone: "accent" }],
  };
  return { kpis: kpis.slice(0, 6), alerts, score, scoreParts, chart, ctx, fmtScore: fmt(score / 100, "pct") };
}
