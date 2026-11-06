import { r2, today } from "./calc";
import { slabCount, splitLot } from "./slabs";
import type { Reservation, Slab, SlabLot, StoneDB } from "./types";

/** Days a reservation runs unless changed in the form. */
export const RESERVE_DAYS = 10;

export function addDays(d: string, n: number) {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

/** Past its till date. The slabs stay reserved until someone releases or bills them. */
export const expired = (r: Reservation, on = today()) => r.till < on;

/** The slabs a reservation still holds: in this lot and in stock. */
export const liveSlabs = (l: SlabLot, r: Reservation) => {
  const ids = new Set(r.slabIds);
  return (l.slabs ?? []).filter((s) => ids.has(s.id) && s.status === "stock").sort((a, b) => a.no.localeCompare(b.no, "en", { numeric: true }));
};

/** Which reservation holds each slab of a lot. */
export function reservedMap(l: SlabLot) {
  const m = new Map<string, Reservation>();
  for (const r of l.reserves ?? []) for (const s of liveSlabs(l, r)) m.set(s.id, r);
  return m;
}

export const reservedSqft = (l: SlabLot) => r2((l.reserves ?? []).reduce((a, r) => a + liveSlabs(l, r).reduce((b, s) => b + s.sqft, 0), 0));
export const reservedCount = (l: SlabLot) => (l.reserves ?? []).reduce((a, r) => a + liveSlabs(l, r).length, 0);

/** Slabs nobody has reserved, in slab order. */
export function freeSlabs(l: SlabLot) {
  const m = reservedMap(l);
  return (l.slabs ?? []).filter((s) => s.status === "stock" && !m.has(s.id)).sort((a, b) => a.no.localeCompare(b.no, "en", { numeric: true }));
}

/** Sq ft anyone can buy. A lot without slab records cannot hold a reservation, so all of it is free. */
export const freeSqft = (l: SlabLot) => (l.slabs?.length ? r2(freeSlabs(l).reduce((a, s) => a + s.sqft, 0)) : l.available);
export const freeCount = (l: SlabLot) => (l.slabs?.length ? freeSlabs(l).length : slabCount(l));

/** Can this slab go on an invoice for this customer? Free stock, or reserved for this very customer. */
export function sellableTo(l: SlabLot, s: Slab, customerId: string) {
  if (s.status !== "stock") return false;
  const r = reservedMap(l).get(s.id);
  return !r || r.customerId === customerId;
}

/** Sq ft this customer can be billed from a lot: free stock plus what is reserved for them. */
export const sellableSqft = (l: SlabLot, customerId: string) =>
  l.slabs?.length ? r2(l.slabs.filter((s) => sellableTo(l, s, customerId)).reduce((a, s) => a + s.sqft, 0)) : l.available;

export type ResRow = { lot: SlabLot; r: Reservation; slabs: Slab[]; sqft: number };

/** Every reservation still holding slabs, earliest till date first. */
export function reservations(db: StoneDB): ResRow[] {
  const out: ResRow[] = [];
  for (const lot of db.lots) for (const r of lot.reserves ?? []) {
    const slabs = liveSlabs(lot, r);
    if (slabs.length) out.push({ lot, r, slabs, sqft: r2(slabs.reduce((a, s) => a + s.sqft, 0)) });
  }
  return out.sort((a, b) => a.r.till.localeCompare(b.r.till) || a.lot.lotNo.localeCompare(b.lot.lotNo, "en", { numeric: true }));
}

/** Reservations grouped by customer, in order of the earliest till date. */
export function byCustomer(rows: ResRow[]) {
  const m = new Map<string, ResRow[]>();
  for (const x of rows) m.set(x.r.customerId, [...(m.get(x.r.customerId) ?? []), x]);
  return [...m.entries()].map(([customerId, items]) => ({
    customerId, items,
    slabs: items.reduce((a, x) => a + x.slabs.length, 0),
    sqft: r2(items.reduce((a, x) => a + x.sqft, 0)),
    value: Math.round(items.reduce((a, x) => a + x.sqft * x.r.rate, 0)),
    advance: items.reduce((a, x) => a + (x.r.advance ?? 0), 0),
  }));
}

/** This customer's reservation on a lot, if any. */
export const reserveOf = (l: SlabLot, customerId: string) => (l.reserves ?? []).find((r) => r.customerId === customerId && liveSlabs(l, r).length);

/** Lowest-numbered slabs this customer can have: free ones, plus ones already reserved for them. */
export function pickable(l: SlabLot, customerId: string) {
  const m = reservedMap(l);
  return (l.slabs ?? []).filter((s) => s.status === "stock" && (!m.has(s.id) || m.get(s.id)!.customerId === customerId)).sort((a, b) => a.no.localeCompare(b.no, "en", { numeric: true }));
}

/**
 * Saves a customer's reservation on a lot, replacing their earlier one there (one per customer per lot).
 * A lot stocked as sq ft only first gets one record per slab; then `count` picks its lowest-numbered slabs.
 * Slabs not in stock or reserved for someone else are dropped.
 */
export function saveReserve(db: StoneDB, lotId: string, r: Reservation, count?: number) {
  const lot = db.lots.find((l) => l.id === lotId);
  if (!lot) return;
  if (!lot.slabs?.length) splitLot(lot, db.blocks.find((b) => b.id === lot.blockId)?.no || lot.lotNo);
  const ok = pickable(lot, r.customerId);
  const okIds = new Set(ok.map((s) => s.id));
  let ids = r.slabIds.filter((id) => okIds.has(id));
  if (count !== undefined && !r.slabIds.length) ids = ok.slice(0, count).map((s) => s.id);
  const others = (lot.reserves ?? []).filter((x) => x.id !== r.id && x.customerId !== r.customerId);
  lot.reserves = ids.length ? [...others, { ...r, slabIds: ids }] : others;
}

export function releaseReserve(db: StoneDB, lotId: string, id: string) {
  const lot = db.lots.find((l) => l.id === lotId);
  if (lot) lot.reserves = (lot.reserves ?? []).filter((x) => x.id !== id);
}

/** After a sale: sold slabs leave their reservation; a reservation with nothing left goes. */
export function tidyReserves(lot: SlabLot) {
  if (!lot.reserves?.length) return;
  const stock = new Set((lot.slabs ?? []).filter((s) => s.status === "stock").map((s) => s.id));
  lot.reserves = lot.reserves.map((r) => ({ ...r, slabIds: r.slabIds.filter((id) => stock.has(id)) })).filter((r) => r.slabIds.length);
}
