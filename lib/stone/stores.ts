import { daysSince } from "./calc";
import type { StoreCat, StoreItem, StoreMove, Stores, StoneDB } from "./types";

export const STORE_CATS: { key: StoreCat; label: string; unit: string }[] = [
  { key: "epoxy", label: "Epoxy and hardener", unit: "kg" },
  { key: "resin", label: "Polyester resin and filler", unit: "kg" },
  { key: "polish", label: "Polishing powder and wax", unit: "kg" },
  { key: "abrasive", label: "Abrasives and lux bricks", unit: "pcs" },
  { key: "blades", label: "Blades, segments and wire", unit: "pcs" },
  { key: "netting", label: "Fibre netting and mesh", unit: "sq m" },
  { key: "chemicals", label: "Chemicals and sealers", unit: "L" },
  { key: "fuel", label: "Diesel, oil and grease", unit: "L" },
  { key: "spares", label: "Machine spares", unit: "pcs" },
  { key: "packing", label: "Packing: crates, strapping", unit: "pcs" },
  { key: "other", label: "Other", unit: "pcs" },
];
export const catLabel = (c: StoreCat) => STORE_CATS.find((x) => x.key === c)?.label ?? "Other";

export const storesOf = (db: StoneDB): Stores => db.stores ?? { items: [], moves: [] };

const signed = (m: StoreMove) => (m.kind === "in" ? m.qty : m.kind === "out" ? -m.qty : m.qty);

export function onHand(s: Stores, id: string) {
  return s.moves.filter((m) => m.itemId === id).reduce((a, m) => a + signed(m), 0);
}

/** Weighted average purchase rate, falling back to the item's last rate. */
export function avgRate(s: Stores, item: StoreItem) {
  const ins = s.moves.filter((m) => m.itemId === item.id && m.kind === "in" && m.rate > 0);
  const q = ins.reduce((a, m) => a + m.qty, 0);
  return q ? ins.reduce((a, m) => a + m.qty * m.rate, 0) / q : item.rate;
}

export function used(s: Stores, id: string | null, days: number) {
  return s.moves.filter((m) => m.kind === "out" && (!id || m.itemId === id) && daysSince(m.date) < days);
}

/** Days the current stock lasts at the last 30 days' pace. */
export function daysLeft(s: Stores, item: StoreItem) {
  const out30 = used(s, item.id, 30).reduce((a, m) => a + m.qty, 0);
  return out30 > 0 ? (onHand(s, item.id) / out30) * 30 : Infinity;
}
