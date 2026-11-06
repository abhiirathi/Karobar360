import { r2, uid } from "./calc";
import { firmOf } from "./firms";
import type { Grade, Slab, SlabLot, StoneDB } from "./types";

export const SQCM_PER_SQFT = 929.03;
export const slabArea = (l: number, w: number) => r2((l * w) / SQCM_PER_SQFT);
export const slabNo = (prefix: string, i: number) => `${prefix}/${String(i).padStart(2, "0")}`;

export const SLAB_STATUS: Record<Slab["status"], string> = { stock: "In stock", sold: "Sold", broken: "Broken" };

/** Slabs still in stock in a lot (or its piece count when slabs are not tracked one by one). */
export const slabCount = (l: SlabLot) => (l.slabs?.length ? l.slabs.filter((x) => x.status === "stock").length : l.available > 0 ? l.pieces : 0);

export type SlabRow = Slab & { lot: SlabLot };

/** Every tracked slab with the lot it sits in, in block and slab order. */
export function allSlabs(db: StoneDB): SlabRow[] {
  const out: SlabRow[] = [];
  for (const lot of db.lots) for (const s of lot.slabs ?? []) out.push({ ...s, lot });
  return out.sort((a, b) => a.no.localeCompare(b.no, "en", { numeric: true }));
}

/** Keeps a lot's sq ft, stock and piece count in line with its slabs. Cost is left alone. */
export function syncLot(lot: SlabLot) {
  if (!lot.slabs?.length) return;
  const good = lot.slabs.filter((s) => s.status !== "broken");
  lot.pieces = good.length;
  lot.sqft = r2(good.reduce((a, s) => a + s.sqft, 0));
  lot.available = r2(lot.slabs.filter((s) => s.status === "stock").reduce((a, s) => a + s.sqft, 0));
}

/** Next free lot number, following the numbering just used (L-108 → L-109, 007 → 008). */
export function nextLotNo(db: StoneDB, skip: string[] = []) {
  const taken = new Set([...db.lots.map((l) => l.lotNo), ...skip]);
  const last = [...skip].reverse().find((x) => /\d+$/.test(x)) ?? [...db.lots].reverse().find((l) => /\d+$/.test(l.lotNo))?.lotNo ?? "L-100";
  const m = /^(.*?)(\d+)$/.exec(last)!;
  let n = Number(m[2]);
  let no = "";
  do { n += 1; no = `${m[1]}${String(n).padStart(m[2].length, "0")}`; } while (taken.has(no));
  return no;
}

/**
 * Moves slabs into the lot with this number, creating it if needed. Cost travels with each slab
 * at its old lot's cost per sq ft. Lots left with no slabs and no invoice are removed.
 */
export function moveSlabs(db: StoneDB, ids: string[], toLotNo: string) {
  const no = toLotNo.trim();
  if (!no || !ids.length) return;
  const want = new Set(ids);
  const moving: { s: Slab; from: SlabLot }[] = [];
  for (const lot of db.lots) for (const s of lot.slabs ?? []) if (want.has(s.id) && lot.lotNo !== no) moving.push({ s, from: lot });
  if (!moving.length) return;
  // Lot numbers are per firm: look for the lot in the firm the slabs are in.
  const firm = firmOf(moving[0].from, db.settings);
  let to = db.lots.find((l) => l.lotNo === no && firmOf(l, db.settings) === firm);
  if (!to) {
    const f = moving[0].from;
    to = { ...f, id: uid(), lotNo: no, slabs: [], reserves: [], cost: 0, sqft: 0, available: 0, pieces: 0, photos: [], catalogue: false, createdAt: f.createdAt };
    db.lots.push(to);
  }
  for (const { s, from } of moving) {
    const rate = from.sqft > 0 ? from.cost / from.sqft : 0;
    const share = s.status === "broken" ? 0 : Math.round(rate * s.sqft);
    from.slabs = (from.slabs ?? []).filter((x) => x.id !== s.id);
    from.cost = Math.max(0, from.cost - share);
    to.slabs = [...(to.slabs ?? []), s];
    to.cost += share;
    // A reserved slab stays reserved for the same customer in its new lot.
    const res = from.reserves?.find((r) => r.slabIds.includes(s.id));
    if (res) {
      res.slabIds = res.slabIds.filter((id) => id !== s.id);
      from.reserves = from.reserves!.filter((r) => r.slabIds.length);
      const there = (to.reserves ?? []).find((r) => r.customerId === res.customerId);
      if (there) there.slabIds.push(s.id);
      else to.reserves = [...(to.reserves ?? []), { ...res, id: uid(), slabIds: [s.id] }];
    }
  }
  const touched = new Set([to, ...moving.map((m) => m.from)]);
  for (const l of touched) syncLot(l);
  const billed = new Set(db.sales.flatMap((x) => x.lines.map((ln) => ln.lotId)));
  db.lots = db.lots.filter((l) => !(touched.has(l) && l.slabs && !l.slabs.length && !billed.has(l.id)));
}

/** Gives a lot that was stocked before slab tracking one record per slab, sharing its stock evenly. */
export function splitLot(lot: SlabLot, prefix: string, grade: Grade = lot.grade) {
  const n = Math.max(1, lot.pieces || 1);
  const each = r2(lot.available / n);
  lot.slabs = Array.from({ length: n }, (_, i) => ({ id: uid(), no: slabNo(prefix, i + 1), blockId: lot.blockId, l: 0, w: 0, sqft: each, grade, status: "stock" as const }));
  lot.sqft = r2(Math.max(lot.sqft, each * n));
  syncLot(lot);
}

/** "BL-001/01–06, BL-001/09" for invoices and messages. */
export function slabRange(nos: string[]) {
  const sorted = [...nos].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const parts: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    const m = /^(.*\/)(\d+)$/.exec(sorted[i]);
    let j = i;
    if (m) while (j + 1 < sorted.length && sorted[j + 1] === `${m[1]}${String(Number(m[2]) + (j + 1 - i)).padStart(m[2].length, "0")}`) j++;
    parts.push(j > i ? `${sorted[i]}–${/(\d+)$/.exec(sorted[j])![1]}` : sorted[i]);
    i = j + 1;
  }
  return parts.join(", ");
}
