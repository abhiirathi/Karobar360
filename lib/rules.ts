import type { Automation, Blueprint, Column, CustomModule, Intake, ModuleConfig, ModuleKey, Recommendation, Row, Vocab } from "./types";
import { getIndustry } from "./industries";
import { MODULES, TURNOVER_BANDS } from "./catalog";
import { Rand, hashStr } from "./rng";
import { slug, uid } from "./format";

export function vocabFor(intake: Intake): Vocab {
  const ind = getIndustry(intake.industry);
  return {
    products: ind.products,
    rawMaterials: ind.rawMaterials,
    customers: ind.customers,
    suppliers: ind.suppliers,
    cities: ind.cities,
    departments: ind.departments,
    unit: ind.unit,
    transporters: [],
  };
}

function insightsFor(key: ModuleKey, intake: Intake, v: Vocab): string[] {
  const c0 = v.customers[0];
  const p0 = v.products[0];
  const p1 = v.products[1] ?? p0;
  const r0 = v.rawMaterials[0];
  const s0 = intake.sites[0]?.name ?? "the main unit";
  const m: Record<ModuleKey, string[]> = {
    sales: [
      `${p0} drives the most revenue, but ${p1} carries the better margin — push it in the next dealer scheme.`,
      `${c0} is your largest account and also among the slowest payers. Tie the next order to clearing bills older than 60 days.`,
      `Orders bunch up in the last week of the month. A mid-month dealer target would smooth production and cash.`,
    ],
    finance: [
      `Receivables older than 60 days are the single biggest drag on cash. Automated WhatsApp reminders typically pull a third of these in within a month.`,
      `Some MSME supplier bills are past 45 days. Clearing them before 31 March keeps that spend tax-deductible.`,
      `Power & fuel is creeping up as a share of cost — compare against a rooftop solar quote for ${s0}.`,
    ],
    inventory: [
      `Dead stock older than 180 days is locking up working capital. A clearance price list for dealers would release it.`,
      `${r0} hits reorder level roughly every three weeks; a standing PO with two suppliers would remove the stock-outs.`,
      `Stock at ${s0} and other sites is counted separately in Excel today. One register removes the month-end mismatch.`,
    ],
    supply: [
      `One vendor is behind on most deliveries. Splitting ${r0} between two suppliers cuts the risk to production.`,
      `Lead times on ${r0} vary widely; ordering on a fixed weekly cycle keeps safety stock lower.`,
      `Prices paid for the same material vary across POs. A rate contract for the top three items locks savings.`,
    ],
    production: [
      `Changeovers eat into capacity. Grouping orders of ${p0} into longer runs raises output without new machines.`,
      `Power cuts are a top downtime reason — log them by hour to make the case for a DG set or solar backup.`,
      `OEE below 70% means roughly a third of available machine time is lost. Track it daily per line, not monthly.`,
    ],
    logistics: [
      `A few e-way bills expire before delivery every month. An alert 12 hours before expiry avoids penalties on the road.`,
      `Freight per load to the farthest destinations is well above average — consolidate loads with nearby dealers.`,
      `Share live dispatch status with dealers on WhatsApp to cut "where is my maal" calls.`,
    ],
    staff: [
      `Absence spikes the day after payday and festivals. Plan contract labour in advance for those days.`,
      `Overtime is concentrated in one department — a second shift helper may cost less than the overtime bill.`,
      `Attrition is highest in the first 90 days. A short onboarding check-in at day 30 helps retain new workers.`,
    ],
    payroll: [
      `PF and ESI are calculated automatically for every worker; deposit before the 15th to avoid interest and damages.`,
      `Advances are tracked against salary so recoveries never get missed at month end.`,
      `Payroll cost as a share of revenue is visible monthly — useful when negotiating the next wage revision.`,
    ],
    quality: [
      `The top defect accounts for a large share of rejections — a single fixture or process check would cut it.`,
      `Rejections rise in the night shift. Add a supervisor sign-off on the first piece of each shift.`,
      `Linking complaints to lot numbers lets you trace any return back to the raw material batch.`,
    ],
    compliance: [
      `Every GST, TDS, PF and ESI date is tracked with an owner — reminders go out three days before each deadline.`,
      `Your CA gets a read-only login, so return data is shared without emailing Excel files.`,
      intake.state.toLowerCase().includes("rajasthan") ? `RSPCB consent-to-operate and factory licence renewals are on the calendar, so no lapse halts the unit.` : `State licence renewals are on the calendar, so no lapse halts the unit.`,
    ],
    schemes: [
      `Interest subvention schemes can cut the effective rate on your next machinery loan significantly — apply before drawing the loan.`,
      `Receivables from large buyers can be discounted on TReDS to get paid within days, without collateral.`,
      `A ZED certificate strengthens tenders and large-buyer vendor registrations.`,
    ],
  };
  return m[key];
}

interface Tpl {
  test: RegExp;
  build: (name: string, r: Rand, v: Vocab, intake: Intake) => Omit<CustomModule, "key">;
}

const st = (r: Rand, opts: string[]) => r.pick(opts);
const sites = (i: Intake) => (i.sites.length ? i.sites.map((s) => s.name) : ["Main unit"]);

const TEMPLATES: Tpl[] = [
  {
    test: /batch|lot|trace|dye|fssai|recall/i,
    build: (name, r, v) => ({
      title: name || "Batch traceability", icon: "Layers", description: "Every batch from raw-material lot to dispatch, searchable in seconds.",
      kpis: [{ label: "Batches in process", value: r.int(6, 24), unit: "num" }, { label: "Avg batch cycle time", value: r.range(1.5, 6), unit: "days", goodWhen: "down" }, { label: "Batches on hold", value: r.int(0, 4), unit: "num", goodWhen: "down" }],
      columns: [c("batch", "Batch"), c("product", "Product"), c("lot", "Raw-material lot"), c("qty", "Quantity", "number"), c("stage", "Stage"), c("status", "Status", "status")],
      rows: rows(8, (i) => ({ batch: `B-${2400 + i * 3}`, product: r.pick(v.products), lot: `${r.pick(v.rawMaterials).split(" ")[0].toUpperCase()}-${r.int(100, 999)}`, qty: r.int(200, 4000), stage: st(r, ["Mixing", "Processing", "QC", "Packing", "Dispatched"]), status: st(r, ["On track", "On track", "QC hold", "Completed"]) })),
      chart: { title: "Batches completed per week", kind: "bar", labels: ["W1", "W2", "W3", "W4", "W5", "W6"], values: Array.from({ length: 6 }, () => r.int(8, 22)), unit: "num" },
      insights: ["Trace any customer complaint back to the raw-material lot in one search.", "Batches waiting at QC for more than a day are flagged to the supervisor."],
    }),
  },
  {
    test: /machine|maintenance|breakdown|service|spares|preventive/i,
    build: (name, r, _v, intake) => ({
      title: name || "Machine maintenance", icon: "Wrench", description: "Preventive maintenance schedule, breakdowns and spares for every machine.",
      kpis: [{ label: "Machines due for service", value: r.int(2, 7), unit: "num", goodWhen: "down" }, { label: "Breakdowns this month", value: r.int(1, 9), unit: "num", goodWhen: "down" }, { label: "Mean time to repair", value: r.range(2, 9), unit: "hrs", goodWhen: "down" }],
      columns: [c("machine", "Machine"), c("site", "Site"), c("last", "Last service", "date"), c("next", "Next due", "date"), c("hours", "Hours run", "number"), c("status", "Status", "status")],
      rows: rows(8, (i) => ({ machine: `${st(r, ["Gang saw", "CNC", "Loom", "Press", "Compressor", "Boiler", "Cutter", "DG set"])} ${i + 1}`, site: r.pick(sites(intake)), last: `${r.int(1, 28)} Oct`, next: `${r.int(1, 30)} Nov`, hours: r.int(300, 4200), status: st(r, ["OK", "OK", "Due soon", "Overdue", "Under repair"]) })),
      chart: { title: "Breakdown hours by month", kind: "line", labels: ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"], values: Array.from({ length: 6 }, () => r.int(8, 46)), unit: "hrs" },
      insights: ["Overdue services are escalated to the plant head on WhatsApp.", "Spares consumption is linked to each machine so you know the true running cost."],
    }),
  },
  {
    test: /block|quarry|slab|yard/i,
    build: (name, r, _v, intake) => ({
      title: name || "Block & slab yard", icon: "Mountain", description: "Each raw block from quarry to slabs, with yield and yard location.",
      kpis: [{ label: "Blocks in yard", value: r.int(30, 140), unit: "num" }, { label: "Average slab yield", value: r.range(0.58, 0.74), unit: "pct", goodWhen: "up" }, { label: "Slabs ready for sale", value: r.int(400, 2600), unit: "num" }],
      columns: [c("block", "Block no."), c("quarry", "Quarry"), c("size", "Size (cu m)", "number"), c("slabs", "Slabs cut", "number"), c("yield", "Yield", "pct"), c("location", "Yard row"), c("status", "Status", "status")],
      rows: rows(8, (i) => ({ block: `BLK-${7810 + i * 9}`, quarry: st(r, ["Makrana", "Rajsamand", "Jalore", "Banswara"]), size: Number(r.range(4, 14).toFixed(1)), slabs: r.int(0, 180), yield: Number(r.range(0.52, 0.78).toFixed(2)), location: `${r.pick(sites(intake))} · Row ${r.int(1, 12)}`, status: st(r, ["In yard", "On gang saw", "Polishing", "Ready"]) })),
      chart: { title: "Slab yield by quarry", kind: "bar", labels: ["Makrana", "Rajsamand", "Jalore", "Banswara"], values: [0.71, 0.64, 0.68, 0.6].map((x) => Number((x * r.range(0.95, 1.05)).toFixed(2))), unit: "pct" },
      insights: ["Yield by quarry shows which supplier's blocks are worth the premium.", "Every slab carries its block number, so customers can match shade across an order."],
    }),
  },
  {
    test: /export|container|shipment|buyer|lc|letter of credit|fob/i,
    build: (name, r, v) => ({
      title: name || "Export orders", icon: "Ship", description: "Export POs from sampling to container stuffing, with payment status.",
      kpis: [{ label: "Open export orders", value: r.int(4, 18), unit: "num" }, { label: "Containers this month", value: r.int(1, 9), unit: "num" }, { label: "Export receivables", value: r.range(1.5e6, 2.4e7), unit: "inr", goodWhen: "down" }],
      columns: [c("po", "Buyer PO"), c("buyer", "Buyer"), c("etd", "ETD", "date"), c("value", "Value (₹)", "inr"), c("stage", "Stage"), c("status", "Payment", "status")],
      rows: rows(8, (i) => ({ po: `EXP-${560 + i}`, buyer: r.pick(v.customers), etd: `${r.int(1, 30)} ${st(r, ["Nov", "Dec", "Jan"])}`, value: Math.round(r.range(4e5, 4e6)), stage: st(r, ["Sampling", "Production", "Inspection", "Stuffing", "Shipped"]), status: st(r, ["Advance received", "LC opened", "Awaiting", "Paid"]) })),
      chart: { title: "Export value by month (₹)", kind: "bar", labels: ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"], values: Array.from({ length: 6 }, () => Math.round(r.range(2e6, 1.2e7))), unit: "inr" },
      insights: ["Orders slipping their ETD are flagged two weeks ahead so you can book the next vessel.", "RoDTEP claims are tracked per shipping bill."],
    }),
  },
  {
    test: /dealer|scheme|claim|distributor|retailer|beat/i,
    build: (name, r, v) => ({
      title: name || "Dealer schemes & claims", icon: "Handshake", description: "Dealer targets, scheme payouts and claim settlement in one place.",
      kpis: [{ label: "Active dealers", value: r.int(25, 180), unit: "num" }, { label: "Scheme payouts due", value: r.range(1e5, 1.8e6), unit: "inr" }, { label: "Dealers on target", value: r.range(0.35, 0.7), unit: "pct", goodWhen: "up" }],
      columns: [c("dealer", "Dealer"), c("city", "City"), c("target", "Target", "inr"), c("achieved", "Achieved", "pct"), c("payout", "Scheme payout", "inr"), c("status", "Status", "status")],
      rows: rows(8, () => ({ dealer: r.pick(v.customers), city: r.pick(v.cities), target: Math.round(r.range(3e5, 3e6)), achieved: Number(r.range(0.4, 1.2).toFixed(2)), payout: Math.round(r.range(5e3, 9e4)), status: st(r, ["On track", "Behind", "Qualified", "Paid"]) })),
      chart: { title: "Target achievement by week", kind: "line", labels: ["W1", "W2", "W3", "W4"], values: [0.22, 0.47, 0.71, 0.93].map((x) => Number((x * r.range(0.9, 1.08)).toFixed(2))), unit: "pct" },
      insights: ["Dealers close to the next slab get an automatic WhatsApp nudge.", "Claims are settled against credit notes, so there is no double payout."],
    }),
  },
  {
    test: /power|electric|solar|energy|diesel|dg set|fuel/i,
    build: (name, r, _v, intake) => ({
      title: name || "Energy monitor", icon: "Zap", description: "Grid units, DG diesel and solar generation per site, against output.",
      kpis: [{ label: "Power bill last month", value: r.range(1.5e5, 2.5e6), unit: "inr", goodWhen: "down" }, { label: "Units per output unit", value: r.range(0.8, 4), unit: "num", goodWhen: "down" }, { label: "DG hours", value: r.int(20, 160), unit: "hrs", goodWhen: "down" }],
      columns: [c("site", "Site"), c("grid", "Grid units", "number"), c("dg", "DG diesel (L)", "number"), c("solar", "Solar units", "number"), c("cost", "Cost", "inr"), c("status", "Status", "status")],
      rows: rows(Math.max(3, sites(intake).length), (i) => ({ site: sites(intake)[i % sites(intake).length] + (i >= sites(intake).length ? ` · meter ${i}` : ""), grid: r.int(4000, 60000), dg: r.int(100, 2400), solar: r.int(0, 18000), cost: Math.round(r.range(6e4, 9e5)), status: st(r, ["Normal", "High usage", "Normal"]) })),
      chart: { title: "Power cost by month (₹)", kind: "bar", labels: ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"], values: Array.from({ length: 6 }, () => Math.round(r.range(2e5, 1.4e6))), unit: "inr" },
      insights: ["Energy per unit of output shows which line wastes power.", "DG hours are matched to grid outage logs to catch diesel leakage."],
    }),
  },
  {
    test: /karigar|piece|job ?-?work|contractor|artisan|outwork/i,
    build: (name, r, v) => ({
      title: name || "Karigar & job-work", icon: "Hammer", description: "Material issued to karigars or job-workers, pieces returned, and piece-rate payments.",
      kpis: [{ label: "Material out with job-workers", value: r.range(3e5, 6e6), unit: "inr", goodWhen: "down" }, { label: "Pieces pending return", value: r.int(120, 4200), unit: "num", goodWhen: "down" }, { label: "Piece-rate payable", value: r.range(5e4, 1.2e6), unit: "inr" }],
      columns: [c("worker", "Karigar / job-worker"), c("item", "Item"), c("issued", "Issued", "number"), c("returned", "Returned", "number"), c("days", "Days out", "number"), c("status", "Status", "status")],
      rows: rows(8, () => { const iss = r.int(50, 900); return { worker: st(r, ["Ramesh ji", "Salim bhai", "Bagru unit 4", "Sanganer printer", "Ganpat Lal", "Mohan workshop"]), item: r.pick(v.products), issued: iss, returned: Math.round(iss * r.range(0.2, 1)), days: r.int(2, 40), status: st(r, ["In progress", "Overdue", "Returned", "In progress"]) }; }),
      chart: { title: "Pieces returned per week", kind: "bar", labels: ["W1", "W2", "W3", "W4", "W5", "W6"], values: Array.from({ length: 6 }, () => r.int(300, 2200)), unit: "num" },
      insights: ["Material out for more than 21 days is flagged before it goes missing.", "Piece-rate payments are calculated from returned quantity, not estimates."],
    }),
  },
  {
    test: /gold|silver|metal|bullion|weight|karat|carat/i,
    build: (name, r) => ({
      title: name || "Metal issue & receipt", icon: "Scale", description: "Gold and silver issued to karigars and received back, with loss tracking.",
      kpis: [{ label: "Metal out with karigars (g)", value: r.int(800, 12000), unit: "num" }, { label: "Process loss", value: r.range(0.006, 0.025), unit: "pct", goodWhen: "down" }, { label: "Pending receipts", value: r.int(3, 20), unit: "num", goodWhen: "down" }],
      columns: [c("karigar", "Karigar"), c("metal", "Metal"), c("issued", "Issued (g)", "number"), c("received", "Received (g)", "number"), c("loss", "Loss", "pct"), c("status", "Status", "status")],
      rows: rows(8, () => { const iss = Number(r.range(40, 900).toFixed(1)); const loss = r.range(0.004, 0.03); return { karigar: st(r, ["Bengali karigar team", "Setting unit 2", "Meenakari workshop", "Polishing desk", "Casting unit"]), metal: st(r, ["Gold 22K", "Silver 925", "Gold 18K"]), issued: iss, received: Number((iss * (1 - loss)).toFixed(1)), loss: Number(loss.toFixed(3)), status: loss > 0.02 ? "Check loss" : "Reconciled" }; }),
      chart: { title: "Process loss by week", kind: "line", labels: ["W1", "W2", "W3", "W4", "W5", "W6"], values: Array.from({ length: 6 }, () => Number(r.range(0.006, 0.024).toFixed(3))), unit: "pct" },
      insights: ["Any karigar above the agreed loss percentage is flagged the same day.", "Daily metal reconciliation replaces the paper register."],
    }),
  },
  {
    test: /lead|enquir|inquir|crm|sample|quotation|quote/i,
    build: (name, r, v) => ({
      title: name || "Enquiries & quotations", icon: "Inbox", description: "Every enquiry from IndiaMART, WhatsApp, trade fairs and calls, through to order.",
      kpis: [{ label: "New enquiries this month", value: r.int(20, 160), unit: "num" }, { label: "Quote-to-order rate", value: r.range(0.12, 0.34), unit: "pct", goodWhen: "up" }, { label: "Pipeline value", value: r.range(2e6, 6e7), unit: "inr" }],
      columns: [c("lead", "Enquiry"), c("source", "Source"), c("product", "Product"), c("value", "Value", "inr"), c("owner", "Owner"), c("status", "Stage", "status")],
      rows: rows(8, (i) => ({ lead: r.pick(v.customers), source: st(r, ["IndiaMART", "WhatsApp", "Trade fair", "Referral", "Website"]), product: r.pick(v.products), value: Math.round(r.range(5e4, 2e6)), owner: st(r, ["Rahul", "Neha", "Owner"]), status: st(r, ["New", "Quoted", "Negotiation", "Won", "Lost"]) + (i < 0 ? "" : "") })),
      chart: { title: "Enquiries by source", kind: "bar", labels: ["IndiaMART", "WhatsApp", "Trade fair", "Referral", "Website"], values: Array.from({ length: 5 }, () => r.int(4, 60)), unit: "num" },
      insights: ["Quotes not followed up within 48 hours are reassigned automatically.", "Win rate by source shows where marketing spend actually pays off."],
    }),
  },
  {
    test: /vehicle|fleet|van|truck|route|delivery boy/i,
    build: (name, r, v) => ({
      title: name || "Fleet & delivery routes", icon: "Car", description: "Own vehicles, daily routes, fuel and collections by driver.",
      kpis: [{ label: "Vehicles on road today", value: r.int(2, 14), unit: "num" }, { label: "Fuel cost per drop", value: r.range(60, 420), unit: "inr", goodWhen: "down" }, { label: "Cash collected on route", value: r.range(5e4, 1.2e6), unit: "inr" }],
      columns: [c("vehicle", "Vehicle"), c("driver", "Driver"), c("route", "Route"), c("drops", "Drops", "number"), c("collected", "Collected", "inr"), c("status", "Status", "status")],
      rows: rows(8, () => ({ vehicle: `RJ-${r.int(1, 52)}-GB-${r.int(1000, 9999)}`, driver: st(r, ["Sohan", "Raju", "Bablu", "Kishan", "Nathu"]), route: `${r.pick(v.cities)} – ${r.pick(v.cities)}`, drops: r.int(6, 40), collected: Math.round(r.range(8e3, 1.6e5)), status: st(r, ["On route", "Returned", "Loading"]) })),
      chart: { title: "Drops per day", kind: "bar", labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], values: Array.from({ length: 6 }, () => r.int(30, 140)), unit: "num" },
      insights: ["Cash collected is matched to invoices the same evening.", "Routes with low drops per trip are merged to save fuel."],
    }),
  },
];

function c(key: string, label: string, type: Column["type"] = "text"): Column {
  return { key, label, type };
}
function rows(n: number, f: (i: number) => Row): Row[] {
  return Array.from({ length: n }, (_, i) => f(i));
}

export function customModulesFrom(text: string, intake: Intake, v: Vocab, seed: number): CustomModule[] {
  const parts = text.split(/\n|;|\.(?=\s)|,(?=\s*(?:and\s+)?(?:a|an|track|we|need|want|also)\b)/i).map((p) => p.trim()).filter((p) => p.length > 6);
  const out: CustomModule[] = [];
  const used = new Set<number>();
  for (const p of parts) {
    const idx = TEMPLATES.findIndex((t) => t.test.test(p));
    if (idx >= 0 && used.has(idx)) continue;
    const r = new Rand(seed ^ hashStr(p));
    let mod: Omit<CustomModule, "key">;
    if (idx >= 0) {
      used.add(idx);
      mod = TEMPLATES[idx].build("", r, v, intake);
    } else {
      const title = titleFrom(p);
      mod = {
        title, icon: "LayoutGrid", description: `Custom tracker built from your request: “${p.slice(0, 120)}”`,
        kpis: [{ label: "Open items", value: r.int(5, 40), unit: "num" }, { label: "Closed this month", value: r.int(10, 80), unit: "num", goodWhen: "up" }, { label: "Overdue", value: r.int(0, 8), unit: "num", goodWhen: "down" }],
        columns: [c("ref", "Ref"), c("item", "Item"), c("site", "Site"), c("owner", "Owner"), c("due", "Due", "date"), c("status", "Status", "status")],
        rows: rows(8, (i) => ({ ref: `${title.slice(0, 3).toUpperCase()}-${100 + i}`, item: r.pick([...v.products, ...v.rawMaterials]), site: r.pick(sites(intake)), owner: st(r, ["Supervisor", "Manager", "Owner", "Accounts"]), due: `${r.int(1, 30)} Nov`, status: st(r, ["Open", "In progress", "Done", "Overdue"]) })),
        chart: { title: "Items closed per week", kind: "bar", labels: ["W1", "W2", "W3", "W4", "W5", "W6"], values: Array.from({ length: 6 }, () => r.int(3, 24)), unit: "num" },
        insights: ["Fields, statuses and owners can be renamed to match how your team works.", "Overdue items are pushed to the owner on WhatsApp every morning."],
      };
    }
    out.push({ key: `x-${slug(mod.title)}`, ...mod });
    if (out.length >= 4) break;
  }
  return out;
}

function titleFrom(p: string) {
  const cleaned = p.replace(/^(we|i)\s+(also\s+)?(want|need|would like)\s+(to\s+)?(track|manage|see|have|a|an)?\s*/i, "").replace(/^(track|manage|a|an|the)\s+/i, "");
  const words = cleaned.split(/\s+/).slice(0, 4).join(" ");
  return (words.charAt(0).toUpperCase() + words.slice(1)).replace(/[.,;:]$/, "") || "Custom tracker";
}

function recommendationsFor(intake: Intake): Recommendation[] {
  const pain = `${intake.painPoints} ${intake.customRequests}`.toLowerCase();
  const recs: Recommendation[] = [];
  if (/payment|credit|outstanding|receivabl|udhaar|collection|paisa/.test(pain) || intake.channels.includes("dealers"))
    recs.push({ title: "Automate collections on WhatsApp", detail: "Send statement-of-account and payment links to every dealer with bills older than 30 days, every Monday.", impact: "Typically cuts DSO by 10–20 days", module: "finance" });
  if (/stock|inventory|godown|shortage|excess/.test(pain) || intake.modules.includes("inventory"))
    recs.push({ title: "One stock register for every site", detail: "Replace site-wise Excel sheets with a shared register and reorder alerts.", impact: "Fewer stock-outs and less dead stock", module: "inventory" });
  if (/gst|tax|compliance|filing|ca /.test(pain) || intake.modules.includes("compliance"))
    recs.push({ title: "Give your CA a read-only login", detail: "Monthly GST and TDS data is shared from the system instead of emailed spreadsheets.", impact: "Saves 2–3 days of accounts work each month", module: "compliance" });
  if (/labour|labor|attendance|salary|wage|pf|esi/.test(pain) || intake.modules.includes("payroll"))
    recs.push({ title: "Biometric attendance straight into payroll", detail: "Attendance, overtime and advances flow into the salary register with PF/ESI computed.", impact: "Payroll closes in hours, not days", module: "payroll" });
  if (/machine|downtime|breakdown|power|light/.test(pain) || intake.modules.includes("production"))
    recs.push({ title: "Log downtime by reason, per shift", detail: "Supervisors tap a reason on the phone when a machine stops. The pattern shows within two weeks.", impact: "5–10% more output from the same machines", module: "production" });
  if (intake.state.toLowerCase().includes("rajasthan"))
    recs.push({ title: "Claim RIPS 2024 benefits on your next loan", detail: "Interest subvention and state tax reimbursement can be applied for when you expand or modernise.", impact: "Lower effective interest on term loans", module: "schemes" });
  recs.push({ title: "Daily owner briefing at 8 am", detail: "Yesterday's sales, collections, dispatches, attendance and anything overdue — in one WhatsApp message, in Hindi or English.", impact: "Owner sees the business without opening a laptop", module: "overview" });
  return recs.slice(0, 5);
}

function automationsFor(intake: Intake): Automation[] {
  const has = (k: ModuleKey) => intake.modules.includes(k);
  const a: Automation[] = [
    { trigger: "Every day at 8:00 am", action: "Send the owner a summary of sales, cash, dispatches and alerts", channel: "WhatsApp", enabled: true },
  ];
  if (has("sales") || has("finance")) a.push({ trigger: "Bill crosses 30 days unpaid", action: "Send the customer a polite reminder with a UPI payment link", channel: "WhatsApp", enabled: true });
  if (has("inventory")) a.push({ trigger: "Item falls below reorder level", action: "Notify the store-keeper and draft a purchase order", channel: "WhatsApp", enabled: true });
  if (has("logistics")) a.push({ trigger: "E-way bill expires within 12 hours", action: "Alert the dispatch manager to extend validity", channel: "SMS", enabled: true });
  if (has("compliance")) a.push({ trigger: "3 days before any GST / TDS / PF due date", action: "Remind accounts and the CA", channel: "Email", enabled: true });
  if (has("payroll")) a.push({ trigger: "Salary approved", action: "Send each worker a payslip in Hindi", channel: "WhatsApp", enabled: false });
  if (has("finance")) a.push({ trigger: "MSME supplier bill reaches day 40", action: "Add it to this week's payment run (45-day rule)", channel: "In-app", enabled: true });
  return a;
}

export function rulesBlueprint(intake: Intake): Blueprint {
  const ind = getIndustry(intake.industry);
  const seed = hashStr(`${intake.companyName}|${intake.industry}|${intake.city}`);
  const vocab = vocabFor(intake);
  const ordered = MODULES.map((m) => m.key).filter((k) => intake.modules.includes(k));
  const modules: ModuleConfig[] = ordered.map((key) => ({ key, insights: insightsFor(key, intake, vocab) }));
  const band = TURNOVER_BANDS.find((b) => b.key === intake.turnoverBand);
  const siteText = intake.sites.length > 1 ? `${intake.sites.length} sites` : intake.sites[0]?.name ?? "a single unit";
  return {
    id: `${slug(intake.companyName || "company")}-${uid()}`,
    createdAt: Date.now(),
    source: "rules",
    intake,
    headline: `${intake.companyName || "Your company"} — operations at a glance`,
    summary: `A ${intake.category} ${ind.name.toLowerCase()} business in ${intake.city || intake.state} with ${intake.employees} people across ${siteText}${band ? `, turnover ${band.label}` : ""}. The dashboard puts ${ordered.slice(0, 4).map((k) => MODULES.find((m) => m.key === k)?.name.toLowerCase()).join(", ")} on one screen, with alerts for what needs attention today.`,
    vocab,
    modules,
    customModules: customModulesFrom(intake.customRequests, intake, vocab, seed),
    recommendations: recommendationsFor(intake),
    automations: automationsFor(intake),
    seed,
  };
}
