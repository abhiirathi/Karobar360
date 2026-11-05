import { cbm, monthKey, r2 } from "./calc";
import { avgRate, storesOf } from "./stores";
import type { Block, Party, SlabLot, StoneDB } from "./types";

/** Own quarries: the ones in Masters, plus any typed in Settings before Masters had them. */
export function ownMines(db: StoneDB): string[] {
  return [...new Set([...db.parties.filter((p) => p.kind === "mine").map((p) => p.company), ...(db.settings.ownMines ?? [])].filter(Boolean))];
}

/** Stone qualities from Masters, then any variety already on a block or lot. */
export function qualities(db: StoneDB): string[] {
  const m = db.parties.filter((p) => p.kind === "quality").map((p) => p.company);
  return [...new Set([...m, ...db.blocks.map((b) => b.variety), ...db.lots.map((l) => l.variety)].filter(Boolean))];
}

export const qualityOf = (db: StoneDB, name: string): Party | undefined => db.parties.find((p) => p.kind === "quality" && p.company.toLowerCase() === name.trim().toLowerCase());

/** Next block no. for a quality: its initials and a running number, e.g. Makrana Albeta → MA-007. */
export function nextBlockNo(db: StoneDB, quality: string, taken: string[] = []) {
  const prefix = (quality.match(/[A-Za-z0-9]+/g) ?? ["BL"]).slice(0, 3).map((w) => w[0]).join("").toUpperCase() || "BL";
  const used = new Set([...db.blocks.map((b) => b.no.toUpperCase()), ...taken.map((t) => t.toUpperCase())]);
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  let n = [...used].reduce((m, no) => Math.max(m, Number(re.exec(no)?.[1] ?? 0)), 0);
  let no = "";
  do { n += 1; no = `${prefix}-${String(n).padStart(3, "0")}`; } while (used.has(no));
  return no;
}

/** Weight that carries a block's share of a bill: received, else billed, else volume. */
export const shareWeight = (b: Pick<Block, "tonnes" | "billedTonnes" | "l" | "w" | "h">) => b.tonnes || b.billedTonnes || cbm(b);

/** Splits an amount over items by weight, in whole rupees, with the rounding left on the last one. */
export function split(total: number, weights: number[]) {
  const sum = weights.reduce((a, w) => a + w, 0);
  const out = weights.map((w) => (sum ? Math.round((total * w) / sum) : Math.round(total / Math.max(1, weights.length))));
  if (out.length) out[out.length - 1] += Math.round(total) - out.reduce((a, x) => a + x, 0);
  return out;
}

// ─── Stores cost on slabs ───
// Each month, everything issued from stores (except to the quarry) is spread over the sq ft that came off the saws that month.

type Alloc = { rate: Record<string, number>; issued: Record<string, number>; sawn: Record<string, number> };
const cache = new WeakMap<StoneDB, Alloc>();

export function storesAlloc(root: StoneDB): Alloc {
  const hit = cache.get(root);
  if (hit) return hit;
  const S = storesOf(root);
  const mines = new Set(ownMines(root).map((m) => m.toLowerCase()));
  const issued: Record<string, number> = {};
  for (const m of S.moves) {
    if (m.kind !== "out" || mines.has((m.usedFor ?? "").toLowerCase())) continue;
    const it = S.items.find((x) => x.id === m.itemId);
    if (!it) continue;
    issued[monthKey(m.date)] = (issued[monthKey(m.date)] ?? 0) + m.qty * avgRate(S, it);
  }
  const sawn: Record<string, number> = {};
  for (const j of root.jobs) if (j.finishedOn) sawn[monthKey(j.finishedOn)] = (sawn[monthKey(j.finishedOn)] ?? 0) + Math.max(0, j.sqft - j.rejectSqft);
  const rate: Record<string, number> = {};
  for (const k of Object.keys(issued)) if (sawn[k]) rate[k] = issued[k] / sawn[k];
  const a = { rate, issued, sawn };
  cache.set(root, a);
  return a;
}

/** Month whose stores rate a lot carries: the month its block came off the saw. */
function lotMonth(root: StoneDB, lot: SlabLot) {
  const j = root.jobs.find((x) => x.blockId === lot.blockId);
  return j?.finishedOn ? monthKey(j.finishedOn) : lot.createdAt ? monthKey(lot.createdAt) : "";
}

/** Stores cost a lot carries, by its sq ft. Only slabs cut on our own saws carry it. */
export function storesShare(root: StoneDB, lot: SlabLot) {
  if (!lot.blockId || !root.jobs.some((j) => j.blockId === lot.blockId)) return 0;
  return r2((storesAlloc(root).rate[lotMonth(root, lot)] ?? 0) * lot.sqft);
}

export const storesPerSqft = (root: StoneDB, lot: SlabLot) => (lot.blockId && root.jobs.some((j) => j.blockId === lot.blockId) ? storesAlloc(root).rate[lotMonth(root, lot)] ?? 0 : 0);

/** All a lot has cost so far: block, sawing, transfers and its share of stores. */
export const lotCost = (root: StoneDB, lot: SlabLot) => lot.cost + storesShare(root, lot);
export const lotUnit = (root: StoneDB, lot: SlabLot) => (lot.sqft > 0 ? lotCost(root, lot) / lot.sqft : 0);
