import { ALL_MODULES, presetModules } from "./modules";
import type { Block, Firm, FirmKind, Modules, SlabLot, StoneDB, StoneSettings, Transfer } from "./types";

export const FIRM_KINDS: { key: FirmKind; label: string; hint: string; m: Partial<Modules> }[] = [
  { key: "mine", label: "Mine / quarry", hint: "Extracts blocks, rawanna, diesel and wire per tonne", m: { quarry: true, stores: true } },
  { key: "processing", label: "Processing unit", hint: "Block yard, gang saws, slabs and lots", m: { buyBlocks: true, processing: true, stores: true } },
  { key: "distribution", label: "Distribution / depot", hint: "Slab stock, warehouse, sales and dealers", m: { trading: true, depot: true } },
  { key: "trade", label: "Import and export", hint: "Shipments, BLs, landed cost, exports", m: { imports: true, exports: true, trading: true, depot: true } },
  { key: "other", label: "Other", hint: "Pick the sections yourself", m: { depot: true } },
];
export const kindLabel = (k: FirmKind) => FIRM_KINDS.find((x) => x.key === k)?.label ?? k;
export const kindModules = (k: FirmKind) => presetModules(FIRM_KINDS.find((x) => x.key === k)?.m ?? {});

export const firmsOf = (s: StoneSettings | undefined): Firm[] => s?.firms ?? [];
export const multiFirm = (s: StoneSettings | undefined) => firmsOf(s).length > 1;
/** Records made before firms were set up belong to the first firm. */
export const firmOf = (x: { firmId?: string }, s: StoneSettings) => x.firmId || firmsOf(s)[0]?.id || "";
export const firmName = (s: StoneSettings, id: string) => firmsOf(s).find((f) => f.id === id)?.name ?? "—";

const SCOPED = ["blocks", "lots", "sales", "mineCosts", "jobs", "shipments", "damages"] as const;

/** What one firm sees: its own records, and its own name, GSTIN and sections on every screen and invoice. */
export function scope(db: StoneDB, firmId: string | null): StoneDB {
  const firms = firmsOf(db.settings);
  if (firms.length < 2) return db;
  if (!firmId) {
    const keys = Object.keys(ALL_MODULES) as (keyof Modules)[];
    const m = presetModules({});
    for (const f of firms) for (const k of keys) m[k] = m[k] || !!f.modules[k];
    return { ...db, settings: { ...db.settings, modules: m } };
  }
  const f = firms.find((x) => x.id === firmId);
  if (!f) return db;
  const out = { ...db } as StoneDB;
  for (const k of SCOPED) (out as unknown as Record<string, { firmId?: string }[]>)[k] = (db[k] as { firmId?: string }[]).filter((x) => firmOf(x, db.settings) === f.id);
  out.settings = { ...db.settings, company: f.name, gstin: f.gstin, address: f.address, city: f.city, state: f.state, pincode: f.pincode, phone: f.phone || db.settings.phone, invoicePrefix: f.invoicePrefix, modules: f.modules };
  return out;
}

/** Stamps records created while a firm is selected with that firm. */
export function tagNew(before: StoneDB, after: StoneDB, firmId: string) {
  for (const k of SCOPED) {
    const old = new Set((before[k] as { id: string }[]).map((x) => x.id));
    for (const x of after[k] as { id: string; firmId?: string }[]) if (!old.has(x.id) && !x.firmId) x.firmId = firmId;
  }
}

/** Moves a block or lot to another firm and records the move. */
export function transfer(item: Block | SlabLot, s: StoneSettings, t: Omit<Transfer, "from">) {
  const from = firmOf(item, s);
  item.trail = [...(item.trail ?? []), { ...t, from }];
  item.firmId = t.to;
}

// ─── Trace: the journey of a block, lot or slab across the group ───

export type Step = { date: string; firm: string; title: string; detail: string; tone?: "move" | "sale" | "cut" };

export function journey(db: StoneDB, q: string) {
  const s = db.settings;
  const k = q.trim().toLowerCase();
  if (!k) return null;
  const slabHit = db.lots.flatMap((l) => (l.slabs ?? []).map((x) => ({ x, l }))).find(({ x }) => x.no.toLowerCase() === k);
  const lot = slabHit?.l ?? db.lots.find((l) => l.lotNo.toLowerCase() === k);
  const block = db.blocks.find((b) => b.no.toLowerCase() === k) ?? (lot?.blockId ? db.blocks.find((b) => b.id === lot.blockId) : undefined);
  if (!block && !lot) return null;
  const steps: Step[] = [];
  const firmAt = (trail: Transfer[] | undefined, now: string) => trail?.[0]?.from ?? now;
  if (block) {
    const sup = db.parties.find((p) => p.id === block.supplierId)?.company;
    const origin = firmAt(block.trail, firmOf(block, s));
    steps.push({ date: block.date, firm: origin, title: block.source === "own_mine" ? `Block ${block.no} extracted` : block.source === "import" ? `Block ${block.no} imported` : `Block ${block.no} bought`, detail: [block.variety, block.source === "own_mine" ? block.mine : sup ?? block.mine, block.tonnes ? `${block.tonnes} t` : "", block.eRawanna ? `rawanna ${block.eRawanna}` : "", block.vehicleNo].filter(Boolean).join(" · ") });
    for (const t of block.trail ?? []) steps.push({ date: t.date, firm: t.to, tone: "move", title: `Moved to ${firmName(s, t.to)}`, detail: [`from ${firmName(s, t.from)}`, t.doc && `doc ${t.doc}`, t.value ? `₹${Math.round(t.value).toLocaleString("en-IN")}` : "", t.note].filter(Boolean).join(" · ") });
    const job = db.jobs.find((j) => j.blockId === block.id);
    const lots = db.lots.filter((l) => l.blockId === block.id || l.slabs?.some((x) => x.blockId === block.id));
    if (job || lots.length) {
      const n = lots.reduce((a, l) => a + (l.slabs?.filter((x) => x.blockId === block.id).length || l.pieces), 0);
      steps.push({ date: job?.finishedOn ?? lots[0]?.createdAt ?? "", firm: job ? firmOf(job, s) : firmAt(lots[0]?.trail, firmOf(lots[0], s)), tone: "cut", title: `Cut into ${n} slabs`, detail: `Lots ${lots.map((l) => l.lotNo).join(", ")}${job ? ` · ${job.machine}` : ""}` });
    }
    if (block.status === "sold") {
      const sale = db.sales.find((x) => x.lines.some((l) => l.blockId === block.id));
      if (sale) steps.push({ date: sale.date, firm: firmOf(sale, s), tone: "sale", title: `Sold as a block on ${sale.invoiceNo}`, detail: db.parties.find((p) => p.id === sale.customerId)?.company ?? "" });
    }
  }
  const lots = lot ? [lot] : block ? db.lots.filter((l) => l.blockId === block.id || l.slabs?.some((x) => x.blockId === block.id)) : [];
  for (const l of lots) {
    for (const t of l.trail ?? []) steps.push({ date: t.date, firm: t.to, tone: "move", title: `Lot ${l.lotNo} moved to ${firmName(s, t.to)}`, detail: [`from ${firmName(s, t.from)}`, t.doc && `doc ${t.doc}`, t.value ? `₹${Math.round(t.value).toLocaleString("en-IN")}` : "", t.note].filter(Boolean).join(" · ") });
    for (const sale of db.sales.filter((x) => x.lines.some((ln) => ln.lotId === l.id))) {
      const ln = sale.lines.find((x) => x.lotId === l.id)!;
      const mine = (ln.slabIds ?? []).filter((id) => l.slabs?.find((x) => x.id === id && (!slabHit || x.id === slabHit.x.id)));
      if (slabHit && !mine.length) continue;
      steps.push({ date: sale.date, firm: firmOf(sale, s), tone: "sale", title: `Sold on ${sale.invoiceNo}`, detail: [db.parties.find((p) => p.id === sale.customerId)?.company, `lot ${l.lotNo}`, ln.slabIds?.length ? `${slabHit ? 1 : ln.slabIds.length} slab${!slabHit && ln.slabIds.length > 1 ? "s" : ""}` : `${Math.round(ln.sqft)} sq ft`].filter(Boolean).join(" · ") });
    }
  }
  steps.sort((a, b) => a.date.localeCompare(b.date));
  const where = slabHit ? { what: `Slab ${slabHit.x.no}`, now: `${slabHit.x.status === "stock" ? "In stock" : slabHit.x.status === "sold" ? "Sold" : "Broken"} · lot ${slabHit.l.lotNo} · ${firmName(s, firmOf(slabHit.l, s))}` }
    : lot && !block ? { what: `Lot ${lot.lotNo}`, now: `${Math.round(lot.available)} sq ft in stock · ${firmName(s, firmOf(lot, s))}` }
    : { what: `Block ${block!.no}`, now: `${block!.status.replace("_", " ")} · ${firmName(s, firmOf(block!, s))}` };
  return { ...where, steps };
}
