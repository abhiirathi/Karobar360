import type { Block, DamageEvent, MineCost, Sale, SawJob, Shipment, SlabLot, StoneDB } from "./types";

export const SQFT_PER_SQM = 10.7639;
export const uid = () => Math.random().toString(36).slice(2, 10);
export const today = () => new Date().toISOString().slice(0, 10);
export const r2 = (n: number) => Math.round(n * 100) / 100;

export const cbm = (b: Pick<Block, "l" | "w" | "h">) => (b.l * b.w * b.h) / 1e6;

/** Purchase value of a block on its billing basis. Costing follows the weight received; the billed weight stands in until then. */
export function purchaseValue(b: Block) {
  const qty = b.rateBasis === "cbm" ? cbm(b) : b.tonnes || b.billedTonnes;
  return b.rate * qty;
}

/** Everything paid to get the block to our yard, before any damage spread. */
export function baseCost(b: Block) {
  return purchaseValue(b) + b.royalty + b.dmft + b.freight + b.loading + b.otherCost + b.importCost;
}

export function blockCost(b: Block) {
  return baseCost(b) + b.damageAlloc;
}

export const perTonne = (b: Block) => (b.tonnes > 0 ? blockCost(b) / b.tonnes : 0);

/** Billed vs weighed at our gate. Positive = supplier billed more than we received. */
export function weightGap(b: Block) {
  if (!b.billedTonnes || !b.tonnes) return 0;
  return (b.billedTonnes - b.tonnes) / b.tonnes;
}

/** How far the gate weight may differ from the supplier's quoted weight before the block is flagged. */
export const WEIGHT_TOLERANCE = 0.05;

export type WeightCheck = { diff: number; pct: number; flag: "short" | "over" | null };

/**
 * The weight received at the gate against the weight the supplier quoted (bill / rawanna).
 * diff is in tonnes (negative = received less); pct is against the supplier's weight.
 * Flagged when it is more than ±5% off. Null until both weights are known.
 */
export function weightCheck(b: Pick<Block, "tonnes" | "billedTonnes">): WeightCheck | null {
  if (!b.billedTonnes || !b.tonnes) return null;
  const diff = b.tonnes - b.billedTonnes;
  const pct = diff / b.billedTonnes;
  return { diff, pct, flag: Math.abs(pct) > WEIGHT_TOLERANCE + 1e-9 ? (diff < 0 ? "short" : "over") : null };
}

/** Net weight in tonnes from the loaded (A) and empty (B) truck weights in kg; 0 until both make sense. */
export function netFromTruck(gross?: number, tare?: number) {
  if (!gross || tare === undefined || tare <= 0 || gross <= tare) return 0;
  return Math.round(gross - tare) / 1000;
}

export function jobCost(j: SawJob) {
  return j.power + j.blades + j.resin + j.netting + j.polishing + j.labour + j.other;
}

export const lotRate = (l: SlabLot) => (l.sqft > 0 ? l.cost / l.sqft : 0);

/** Sq ft yielded per tonne of block. */
export function yieldPerTonne(j: SawJob, b?: Block) {
  if (!b || !b.tonnes) return 0;
  return j.sqft / b.tonnes;
}

/** Theoretical slab count for a block on a gang saw: height ÷ (slab + blade kerf). */
export function theoreticalSlabs(hCm: number, thicknessMm: number, kerfMm = 5) {
  return Math.floor((hCm * 10) / (thicknessMm + kerfMm));
}

// ─── Mines ───

export const monthKey = (d: string) => d.slice(0, 7);

/** Value of what the store issued to the quarry (to one mine, or to any own mine), at average purchase rate. */
export function mineStoresIssued(db: StoneDB, mine: string | null, when: (d: string) => boolean) {
  const st = db.stores;
  if (!st) return 0;
  const mines = new Set((mine ? [mine] : [...db.parties.filter((p) => p.kind === "mine").map((p) => p.company), ...(db.settings.ownMines ?? [])]).map((m) => m.toLowerCase()));
  const avg = (id: string) => {
    const ins = st.moves.filter((m) => m.itemId === id && m.kind === "in" && m.rate > 0);
    const q = ins.reduce((a, m) => a + m.qty, 0);
    return q ? ins.reduce((a, m) => a + m.qty * m.rate, 0) / q : st.items.find((x) => x.id === id)?.rate ?? 0;
  };
  return st.moves.filter((m) => m.kind === "out" && mines.has((m.usedFor ?? "").toLowerCase()) && when(m.date)).reduce((a, m) => a + m.qty * avg(m.itemId), 0);
}

/** Quarry cost and output for the dates `when` accepts: cost entries plus store issues to the quarry. */
function mineSpan(db: StoneDB, mine: string | null, when: (d: string) => boolean) {
  const costs = db.mineCosts.filter((c) => when(c.date) && (!mine || c.mine === mine));
  const blocks = db.blocks.filter((b) => b.source === "own_mine" && when(b.date) && (!mine || b.mine === mine));
  const stores = mineStoresIssued(db, mine, when);
  const total = costs.reduce((a, c) => a + c.amount, 0) + stores;
  const tonnes = blocks.reduce((a, b) => a + b.tonnes, 0);
  const vol = blocks.reduce((a, b) => a + cbm(b), 0);
  const byCat: Record<string, number> = {};
  for (const c of costs) byCat[c.cat] = (byCat[c.cat] ?? 0) + c.amount;
  if (stores) byCat.stores = (byCat.stores ?? 0) + stores;
  const qty = (cat: string) => costs.filter((c) => c.cat === cat).reduce((a, c) => a + c.qty, 0);
  return { costs, blocks, total, tonnes, vol, perTonne: tonnes ? total / tonnes : 0, perCbm: vol ? total / vol : 0, byCat, qty };
}

export function mineMonth(db: StoneDB, mine: string | null, month: string) {
  return mineSpan(db, mine, (d) => monthKey(d) === month);
}

/** Rolling window ending today: costs and own-quarry blocks in the last N days. */
export function mineWindow(db: StoneDB, days: number, offset = 0) {
  const now = Date.now();
  return mineSpan(db, null, (d) => { const a = (now - new Date(d).getTime()) / 86400000; return a >= offset && a < offset + days; });
}

export function months(db: StoneDB) {
  const s = new Set<string>();
  db.mineCosts.forEach((c) => s.add(monthKey(c.date)));
  db.blocks.filter((b) => b.source === "own_mine").forEach((b) => s.add(monthKey(b.date)));
  return [...s].sort();
}

// ─── Damage spread ───

export function damageNet(e: Pick<DamageEvent, "lines" | "extra" | "recovery">) {
  return e.lines.reduce((a, l) => a + l.loss, 0) + e.extra - e.recovery;
}

/** Splits the net loss over the surviving blocks by tonne, CBM or value. */
export function spreadDamage(blocks: Block[], e: Pick<DamageEvent, "lines" | "extra" | "recovery" | "basis" | "spreadIds">) {
  const net = Math.max(0, damageNet(e));
  const targets = blocks.filter((b) => e.spreadIds.includes(b.id));
  const w = (b: Block) => (e.basis === "tonne" ? b.tonnes : e.basis === "cbm" ? cbm(b) : baseCost(b));
  const total = targets.reduce((a, b) => a + w(b), 0);
  const alloc: Record<string, number> = {};
  if (!total) return alloc;
  for (const b of targets) alloc[b.id] = r2((net * w(b)) / total);
  return alloc;
}

// ─── Import / export ───

export function landed(s: Shipment) {
  return s.cifUsd * s.fx + s.duty + s.cha + s.port + s.inland;
}

/** DGFT floor: blocks free to import at CIF ≥ US$200/MT; slabs ≤20 mm at CIF ≥ US$40/m². */
export function mipCheck(s: Shipment): { ok: boolean; value: number; floor: number; unit: string } | null {
  if (s.dir !== "import" || s.stoneType !== "marble") return null;
  if (s.kind === "blocks") {
    if (!s.tonnes) return null;
    const v = s.cifUsd / s.tonnes;
    return { ok: v >= 200, value: v, floor: 200, unit: "US$/MT" };
  }
  if (!s.sqm) return null;
  const v = s.cifUsd / s.sqm;
  return { ok: v >= 40, value: v, floor: 40, unit: "US$/m²" };
}

export function freeDaysLeft(s: Shipment, now = new Date()) {
  if (!s.arrived || s.status === "received" || s.status === "cleared") return null;
  const end = new Date(s.arrived);
  end.setDate(end.getDate() + s.freeDays);
  return Math.ceil((end.getTime() - now.getTime()) / 86400000);
}

// ─── Sales ───

export function saleTaxable(s: Sale) {
  return s.lines.reduce((a, l) => a + l.sqft * l.rate, 0) + s.freight;
}

export function saleTotals(s: Sale, sellerState: string, buyerState: string) {
  const taxable = saleTaxable(s);
  const tax = (taxable * s.gstRate) / 100;
  const inter = sellerState !== buyerState;
  return { taxable, tax, cgst: inter ? 0 : tax / 2, sgst: inter ? 0 : tax / 2, igst: inter ? tax : 0, total: taxable + tax, inter };
}

/** Cost of what an invoice sold. `rate` gives a lot's cost per sq ft; by default the lot's own cost. */
export function saleCost(s: Sale, lots: SlabLot[], blocks: Block[] = [], rate: (l: SlabLot) => number = lotRate) {
  return s.lines.reduce((a, l) => {
    if (l.blockId) {
      const b = blocks.find((x) => x.id === l.blockId);
      return a + (b ? blockCost(b) : 0);
    }
    const lot = lots.find((x) => x.id === l.lotId);
    return a + (lot ? rate(lot) * l.sqft : 0);
  }, 0);
}

export function daysSince(d: string, now = new Date()) {
  return Math.floor((now.getTime() - new Date(d).getTime()) / 86400000);
}

// ─── Mine-level aggregates for the overview ───

export function mineCostTotal(costs: MineCost[]) {
  return costs.reduce((a, c) => a + c.amount, 0);
}

// ─── Optional clean-up of settled data ───

export const PURGE_DEFAULT = { enabled: false, after: "days" as const, days: 90, stock: false };

/** What the clean-up rule would remove right now. */
export function purgePlan(db: StoneDB, rule = db.settings.purge ?? PURGE_DEFAULT) {
  // "paid" clears an invoice as soon as it is marked received; the sales screen asks before marking it.
  const sales = db.sales.filter((s) => s.paid && (rule.after === "paid" || daysSince(s.paidOn || s.date) >= rule.days));
  const goneSales = new Set(sales.map((s) => s.id));
  const stillBilled = new Set(db.sales.filter((s) => !goneSales.has(s.id)).flatMap((s) => s.lines.map((l) => l.lotId)));
  const lots = rule.stock ? db.lots.filter((l) => l.available <= 0 && !stillBilled.has(l.id)) : [];
  const goneLots = new Set(lots.map((l) => l.id));
  // A block cut into several lots keeps its sawing record until the last of those lots goes.
  const keptLotBlocks = new Set(db.lots.filter((l) => !goneLots.has(l.id)).map((l) => l.blockId));
  const jobs = db.jobs.filter((j) => goneLots.has(j.lotId) && !keptLotBlocks.has(j.blockId));
  const blocks = db.blocks.filter((b) => b.status === "sawn" && jobs.some((j) => j.blockId === b.id) && !keptLotBlocks.has(b.id));
  return { sales, lots, jobs, blocks };
}

/** Applies the clean-up in place. Returns true when anything was removed. */
export function applyPurge(db: StoneDB) {
  const rule = db.settings.purge;
  if (!rule?.enabled) return false;
  const p = purgePlan(db, rule);
  if (!p.sales.length && !p.lots.length) return false;
  const ids = (xs: { id: string }[]) => new Set(xs.map((x) => x.id));
  const s = ids(p.sales), l = ids(p.lots), j = ids(p.jobs), b = ids(p.blocks);
  db.sales = db.sales.filter((x) => !s.has(x.id));
  db.lots = db.lots.filter((x) => !l.has(x.id));
  db.jobs = db.jobs.filter((x) => !j.has(x.id));
  db.blocks = db.blocks.filter((x) => !b.has(x.id));
  db.damages = db.damages.filter((e) => e.lines.some((ln) => db.blocks.some((x) => x.id === ln.blockId)) || e.spreadIds.some((id) => db.blocks.some((x) => x.id === id)));
  return true;
}

// ─── GSTIN ───

const B36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function gstinCheckChar(first14: string) {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = B36.indexOf(first14[i]);
    const p = v * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return B36[(36 - (sum % 36)) % 36];
}

export function checkGstin(g: string): { ok: boolean; msg: string; state?: string; pan?: string } {
  const s = g.trim().toUpperCase();
  if (!s) return { ok: false, msg: "" };
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(s)) return { ok: false, msg: "Format should look like 08ABCDE1234F1Z5" };
  if (!STATES[s.slice(0, 2)]) return { ok: false, msg: "First two digits are not a state code" };
  if (gstinCheckChar(s.slice(0, 14)) !== s[14]) return { ok: false, msg: "Last character doesn't match. Check for a typo" };
  return { ok: true, msg: `${STATES[s.slice(0, 2)]} · PAN ${s.slice(2, 12)}`, state: s.slice(0, 2), pan: s.slice(2, 12) };
}

export const STATES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
  "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
  "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "26": "Dadra & Nagar Haveli and Daman & Diu", "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep",
  "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman & Nicobar", "36": "Telangana", "37": "Andhra Pradesh",
  "38": "Ladakh", "97": "Other territory",
};

// ─── Amount in words (Indian system) ───

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function two(n: number) {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`;
}
function three(n: number) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", r ? two(r) : ""].filter(Boolean).join(" ");
}
export function inWords(amount: number) {
  let n = Math.round(amount);
  if (n === 0) return "Rupees Zero Only";
  const parts: string[] = [];
  const cr = Math.floor(n / 1e7); n %= 1e7;
  const lk = Math.floor(n / 1e5); n %= 1e5;
  const th = Math.floor(n / 1e3); n %= 1e3;
  if (cr) parts.push(`${cr >= 100 ? three(cr) : two(cr)} Crore`);
  if (lk) parts.push(`${two(lk)} Lakh`);
  if (th) parts.push(`${two(th)} Thousand`);
  if (n) parts.push(three(n));
  return `Rupees ${parts.join(" ")} Only`;
}

export const rs = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
export const rs2 = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const n0 = (n: number) => Math.round(n).toLocaleString("en-IN");
export const n2 = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
export function lakh(n: number) {
  const a = Math.abs(n);
  if (a >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return rs(n);
}
export function dmy(d: string) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
}
