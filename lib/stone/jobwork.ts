// Job work: a customer's own block is cut into slabs here, the slabs go back, and only the cutting is billed.
import { daysSince, r2, saleTotals } from "./calc";
import type { JobBill, JobBillLine, JobBlock, JobBlockStatus, JobOrder, JobSettings, Party, StoneDB, StoneSettings } from "./types";

export const JOB_DEFAULT: JobSettings = { rate: 0, gstRate: 5, sac: "9988", freeDays: 30, rentPerDay: 0, extras: [] };
export const jobSettings = (s: StoneSettings): JobSettings => ({ ...JOB_DEFAULT, ...(s.jobwork ?? {}) });
export const jobsOf = (db: StoneDB): JobOrder[] => db.jobwork ?? [];

export const JOB_STATUS: Record<JobBlockStatus, string> = { expected: "Not arrived", in_yard: "In yard", on_saw: "On the saw", cut: "Cut", returned: "Sent back" };
export const EXTRA_LABELS = ["Resin / epoxy", "Polishing", "Netting", "Edge cutting", "Calibration", "Loading", "Unloading", "Crane / hydra"];
export const FINISHES = ["As cut", "Polished", "Honed", "Leather", "Flamed", "Brushed"];

/** Next running number after a prefix, e.g. SSM/26-27/JW-0007. */
export function nextNo(prefix: string, used: string[]) {
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}(\\d+)$`);
  const n = used.reduce((m, u) => Math.max(m, Number(re.exec(u)?.[1] ?? 0)), 0);
  return `${prefix}${String(n + 1).padStart(4, "0")}`;
}
export const nextOrderNo = (root: StoneDB) => nextNo("JO-", jobsOf(root).map((o) => o.no));
export const nextBillNo = (root: StoneDB, s: StoneSettings) => nextNo(`${s.invoicePrefix}JW-`, jobsOf(root).flatMap((o) => o.bills.map((b) => b.invoiceNo)));
export const nextChallanNo = (root: StoneDB, s: StoneSettings) => nextNo(`${s.invoicePrefix}JC-`, jobsOf(root).flatMap((o) => o.dispatches.map((d) => d.no)));

/** Good slabs, sq ft and broken pieces already sent back for a block. */
export function sentOf(o: JobOrder, blockId: string) {
  let slabs = 0, sqft = 0, broken = 0;
  for (const d of o.dispatches) for (const l of d.lines) if (l.blockId === blockId) { slabs += l.slabs; sqft += l.sqft; broken += l.broken; }
  return { slabs, sqft: r2(sqft), broken };
}

/** What of a cut block is still to go back. Broken pieces count only when off-cuts go back to the customer. */
export function leftOf(o: JobOrder, b: JobBlock) {
  if (!b.cut) return { slabs: 0, sqft: 0, broken: 0 };
  const s = sentOf(o, b.id);
  return { slabs: Math.max(0, b.cut.slabs - s.slabs), sqft: r2(Math.max(0, b.cut.sqft - s.sqft)), broken: o.waste === "keep" ? 0 : Math.max(0, b.cut.brokenSlabs - s.broken) };
}

export const billedIds = (o: JobOrder) => new Set(o.bills.flatMap((b) => b.blockIds));
export const isCut = (b: JobBlock) => b.status === "cut" || b.status === "returned";
export const unbilled = (o: JobOrder) => { const done = billedIds(o); return o.blocks.filter((b) => isCut(b) && !done.has(b.id)); };

/** Days a block has been with us: from arrival to the last vehicle that took its slabs, or to `upto`. */
export function heldDays(o: JobOrder, b: JobBlock, upto: string) {
  if (!b.receivedOn) return 0;
  const sent = o.dispatches.filter((d) => d.lines.some((l) => l.blockId === b.id)).map((d) => d.date).sort();
  const end = b.status === "returned" && sent.length ? sent[sent.length - 1] : upto;
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(b.receivedOn).getTime()) / 86400000));
}
export const rentDays = (o: JobOrder, b: JobBlock, upto: string) => Math.max(0, heldDays(o, b, upto) - o.freeDays);

/** Lines a bill starts with: cutting on good slabs, the agreed extras, and yard rent past the free days. */
export function autoLines(o: JobOrder, blocks: JobBlock[], date: string): JobBillLine[] {
  if (!blocks.length) return [];
  const sqft = r2(blocks.reduce((a, b) => a + (b.cut?.sqft ?? 0), 0));
  const slabs = blocks.reduce((a, b) => a + (b.cut?.slabs ?? 0), 0);
  const thk = [...new Set(blocks.map((b) => b.cut?.thicknessMm || o.thicknessMm))].join("/");
  const out: JobBillLine[] = [{ kind: "cut", label: `Cutting of ${thk} mm slabs, block${blocks.length > 1 ? "s" : ""} ${blocks.map((b) => b.no).join(", ")}`, qty: sqft, unit: "sq ft", rate: o.rate }];
  for (const x of o.extras) {
    if (!x.label.trim()) continue;
    if (x.basis === "sqft") out.push({ kind: "extra", label: x.label, qty: sqft, unit: "sq ft", rate: x.rate });
    else if (x.basis === "slab") out.push({ kind: "extra", label: x.label, qty: slabs, unit: "slabs", rate: x.rate });
    else out.push({ kind: "extra", label: x.label, qty: 1, unit: "lump sum", rate: x.rate });
  }
  const days = blocks.reduce((a, b) => a + rentDays(o, b, date), 0);
  if (o.rentPerDay > 0 && days > 0) out.push({ kind: "rent", label: `Yard rent after ${o.freeDays} free days`, qty: days, unit: "block-days", rate: o.rentPerDay });
  return out;
}

export const lineAmount = (l: JobBillLine) => r2(l.qty * l.rate);
export const billTaxable = (b: JobBill) => r2(b.lines.reduce((a, l) => a + lineAmount(l), 0));
export function billTotals(b: JobBill, sellerState: string, buyerState: string) {
  const taxable = billTaxable(b);
  const tax = r2((taxable * b.gstRate) / 100);
  const inter = sellerState !== buyerState;
  return { taxable, tax, cgst: inter ? 0 : r2(tax / 2), sgst: inter ? 0 : r2(tax / 2), igst: inter ? tax : 0, total: Math.round(taxable + tax), inter };
}

/** What a customer owes us, from job work bills and slab sales, and how much of it is past their credit days. */
export function duesOf(root: StoneDB, p: Party) {
  const S = root.settings;
  const days = p.creditDays || 0;
  let total = 0, overdue = 0;
  for (const o of jobsOf(root)) {
    if (o.customerId !== p.id) continue;
    for (const b of o.bills) {
      if (b.paid) continue;
      const t = billTotals(b, S.state, p.state || S.state).total;
      total += t;
      if (daysSince(b.date) > days) overdue += t;
    }
  }
  for (const s of root.sales) {
    if (s.customerId !== p.id || s.paid) continue;
    const t = saleTotals(s, S.state, p.state || S.state).total;
    total += t;
    if (daysSince(s.date) > days) overdue += t;
  }
  return { total: Math.round(total), overdue: Math.round(overdue) };
}

/** Why slabs should not leave yet, or null when the customer is clear. */
export function holdReason(root: StoneDB, p: Party | undefined) {
  if (!p) return null;
  const d = duesOf(root, p);
  const why: string[] = [];
  if (d.overdue > 0) why.push(`₹${d.overdue.toLocaleString("en-IN")} unpaid past ${p.creditDays || 0} credit days`);
  if (p.creditLimit > 0 && d.total > p.creditLimit) why.push(`₹${d.total.toLocaleString("en-IN")} due, over the ₹${p.creditLimit.toLocaleString("en-IN")} credit limit`);
  return why.length ? { text: why.join("; "), dues: d.total } : null;
}

/** Done when every block has gone back and every cut block is billed. */
export const orderDone = (o: JobOrder) => o.closed || (o.blocks.length > 0 && o.blocks.every((b) => b.status === "returned") && unbilled(o).length === 0);

export function emptyJobBlock(): JobBlock {
  return { id: "", no: "", variety: "", stoneType: "marble", l: 0, w: 0, h: 0, tonnes: 0, receivedOn: "", vehicleNo: "", challanNo: "", ewayBill: "", condition: "", photos: [], status: "expected" };
}
