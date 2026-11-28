// Job work out: a depot sends its own blocks to an outside job worker, who cuts them into slabs.
// The block stays ours. Slabs come back in one or more trips; each trip becomes a depot lot.
// The cost of those lots is the block's cost plus everything the job cost (cutting charge, freight both
// ways, resin, polish, netting, loading), spread over the good sq ft received.
import { blockCost, uid } from "./calc";
import { slabArea, slabNo, syncLot } from "./slabs";
import { firmOf } from "./firms";
import type { Block, BlockJobWork, JwBasis, JwInward, Slab, SlabLot, StoneDB } from "./types";

export { jwOutOn } from "./modules";

export const BASIS_LABEL: Record<JwBasis, string> = { sqft: "per sq ft", tonne: "per tonne", lump: "lump sum" };
export const COST_PRESETS = ["Resin / epoxy", "Polishing", "Netting", "Edge cutting", "Freight back", "Loading / unloading", "Other"];

export const atWorker = (b: Block) => !!b.jw && !b.jw.closedOn && b.status === "processing";
export const jwDone = (b: Block) => !!b.jw?.closedOn;

export const goodSqft = (jw: BlockJobWork) => jw.inwards.reduce((a, x) => a + x.sqft, 0);
export const goodSlabs = (jw: BlockJobWork) => jw.inwards.reduce((a, x) => a + x.slabs, 0);
export const brokenPcs = (jw: BlockJobWork) => jw.inwards.reduce((a, x) => a + x.broken, 0);

/** The job worker's cutting charge so far: per sq ft of good slabs received, per tonne of block, or the lump sum. */
export function cuttingCharge(b: Block, jw: BlockJobWork = b.jw!) {
  if (!jw) return 0;
  if (jw.basis === "sqft") return jw.rate * goodSqft(jw);
  if (jw.basis === "tonne") return jw.rate * (b.tonnes || b.billedTonnes || 0);
  return jw.rate;
}

export const otherCosts = (jw: BlockJobWork) => jw.costs.reduce((a, c) => a + (c.amount || 0), 0);

/** Everything the job cost on top of the block: cutting, freight out, and the other costs. */
export const jobTotal = (b: Block, jw: BlockJobWork = b.jw!) => (jw ? cuttingCharge(b, jw) + jw.freightOut + otherCosts(jw) : 0);

/** Cost per sq ft of the slabs that came back (block + job), over good sq ft received so far. */
export function slabCostPerSqft(b: Block) {
  const sq = b.jw ? goodSqft(b.jw) : 0;
  return sq > 0 ? (blockCost(b) + jobTotal(b)) / sq : 0;
}

export const daysOut = (jw: BlockJobWork, on = new Date().toISOString().slice(0, 10)) =>
  Math.max(0, Math.round((Date.parse(jw.closedOn || on) - Date.parse(jw.sentOn)) / 86400000));

/** Spreads block cost + job cost over the lots of this job by good sq ft. Call after any change. */
export function spreadJobCost(d: StoneDB, blockId: string) {
  const b = d.blocks.find((x) => x.id === blockId);
  if (!b?.jw) return;
  const ids = new Set(b.jw.inwards.map((x) => x.lotId));
  const lots = d.lots.filter((l) => ids.has(l.id));
  const all = lots.reduce((a, l) => a + l.sqft, 0);
  const total = blockCost(b) + jobTotal(b);
  for (const l of lots) l.cost = Math.round(all ? (total * l.sqft) / all : 0);
}

export type InwardDraft = Omit<JwInward, "id" | "lotId"> & { lotNo: string; slabL: number; slabW: number; location: string; listRate: number };

/** Sq ft of a trip: from the average slab size when given, else as typed. */
export const tripSqft = (x: Pick<InwardDraft, "slabs" | "slabL" | "slabW" | "sqft">) => (x.slabL && x.slabW ? Math.round(slabArea(x.slabL, x.slabW) * x.slabs * 100) / 100 : x.sqft);

/** Records one trip of slabs back: makes its lot in the depot and re-spreads the cost. */
export function addInward(d: StoneDB, blockId: string, x: InwardDraft) {
  const b = d.blocks.find((y) => y.id === blockId);
  if (!b?.jw) return null;
  const sqft = tripSqft(x);
  const each = x.slabs > 0 ? Math.round((sqft / x.slabs) * 100) / 100 : 0;
  // Slab numbers carry on from any slabs this block already has.
  let n = d.lots.filter((l) => l.blockId === b.id).flatMap((l) => l.slabs ?? []).reduce((m, s) => Math.max(m, Number(/\/(\d+)$/.exec(s.no)?.[1] ?? 0)), 0);
  const slabs: Slab[] = [];
  for (let i = 0; i < x.slabs; i++) slabs.push({ id: uid(), no: slabNo(b.no, ++n), blockId: b.id, l: x.slabL || 0, w: x.slabW || 0, sqft: x.slabL && x.slabW ? slabArea(x.slabL, x.slabW) : each, grade: x.grade, status: "stock" });
  const lot: SlabLot = {
    id: uid(), lotNo: x.lotNo.trim(), blockId: b.id, shipmentId: "", variety: b.variety, stoneType: b.stoneType, thicknessMm: x.thicknessMm, finish: x.finish, grade: x.grade,
    pieces: 0, sqft: 0, available: 0, cost: 0, listRate: x.listRate || 0, site: "depot", location: x.location, createdAt: x.date, source: "own", slabs, firmId: firmOf(b, d.settings),
    note: `Cut by job worker${x.note ? ` · ${x.note}` : ""}`,
  };
  syncLot(lot);
  d.lots.push(lot);
  const trip: JwInward = { id: uid(), date: x.date, slabs: x.slabs, sqft: lot.sqft, thicknessMm: x.thicknessMm, finish: x.finish, grade: x.grade, broken: x.broken, vehicleNo: x.vehicleNo, lotId: lot.id, note: x.note };
  b.jw.inwards.push(trip);
  spreadJobCost(d, b.id);
  return lot;
}

/** A trip can be undone only while none of its slabs has been sold, reserved or moved. */
export function tripLocked(d: StoneDB, lotId: string) {
  const l = d.lots.find((x) => x.id === lotId);
  if (!l) return false;
  return (l.slabs ?? []).some((s) => s.status !== "stock") || (l.reserves ?? []).length > 0 || d.sales.some((s) => s.lines.some((x) => x.lotId === lotId));
}

export function removeInward(d: StoneDB, blockId: string, tripId: string) {
  const b = d.blocks.find((y) => y.id === blockId);
  const t = b?.jw?.inwards.find((x) => x.id === tripId);
  if (!b?.jw || !t || tripLocked(d, t.lotId)) return false;
  d.lots = d.lots.filter((l) => l.id !== t.lotId);
  b.jw.inwards = b.jw.inwards.filter((x) => x.id !== tripId);
  if (b.jw.closedOn && !b.jw.inwards.length) { b.jw.closedOn = undefined; b.status = "processing"; }
  spreadJobCost(d, b.id);
  return true;
}
