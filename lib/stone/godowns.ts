// Where our own blocks are and what has happened to them.
import type { Block, BlockStatus, StoneDB } from "./types";

export const STATUS_LABEL: Record<BlockStatus, string> = {
  at_mine: "At mine",
  godown: "In godown",
  processing: "Processing",
  processed: "Processed",
  sold: "Sold as block",
  written_off: "Written off",
};

/** Blocks we still hold as blocks: in a godown, or lying at our quarry. */
export const IN_STOCK: BlockStatus[] = ["godown", "at_mine"];
export const inStock = (b: Block) => IN_STOCK.includes(b.status);

/** Godown names from Masters, in the order they were added. */
export const godowns = (db: StoneDB) => db.parties.filter((p) => p.kind === "godown").map((p) => p.company).filter(Boolean);

/** Where a block is, in a few words. */
export const whereIs = (b: Block) => (b.status === "godown" ? b.godown || "Godown" : STATUS_LABEL[b.status] ?? b.status);

// Statuses used before blocks moved to godown → processing → processed.
const OLD: Record<string, BlockStatus> = { in_yard: "godown", in_transit: "godown", on_saw: "processing", sawn: "processed", rejected: "written_off" };

/** Brings blocks saved with the old statuses onto the new ones. Returns true when anything changed. */
export function migrateBlocks(db: StoneDB) {
  const first = godowns(db)[0] ?? "";
  let changed = false;
  for (const b of db.blocks) {
    const s = b.status as string;
    if (!(s in OLD)) continue;
    // A quarry block on its way out of the mine stays the mine's until it is sold or sent on.
    b.status = s === "in_transit" && b.source === "own_mine" ? "at_mine" : OLD[s];
    if (b.status === "godown" && !b.godown) b.godown = first;
    changed = true;
  }
  return changed;
}
