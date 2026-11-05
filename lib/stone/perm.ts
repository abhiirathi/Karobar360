// Who can see and change what. Shared by the browser and the server; the server is the one that enforces it.

export type Level = "none" | "view" | "edit";
export type AreaKey = "quarry" | "blocks" | "processing" | "stores" | "stock" | "sales" | "trade" | "parties" | "tally" | "settings" | "labour";
export type Section = "settings" | "parties" | "blocks" | "mineCosts" | "jobs" | "lots" | "damages" | "shipments" | "sales" | "tally" | "tallyCfg" | "stores" | "labour";

export interface Perms {
  areas: Partial<Record<AreaKey, Level>>;
  costs: boolean; // purchase rates, cost per sq ft, margins
  team: boolean; // add people and set their access
}

export interface Me {
  id: string;
  orgId: string;
  orgName: string;
  name: string;
  login: string;
  role: string;
  perms: Perms;
  isOwner: boolean;
  active: boolean;
  createdAt?: string;
  lastLogin?: string | null;
}

export const AREAS: { key: AreaKey; label: string; hint: string }[] = [
  { key: "quarry", label: "Quarry", hint: "Own quarry blocks and running costs: diesel, wire, labour" },
  { key: "blocks", label: "Blocks and purchases", hint: "Block purchases, gate receiving, weighbridge, photos, QR labels" },
  { key: "processing", label: "Sawing and processing", hint: "Load on saw, slabs out, trolley damage" },
  { key: "stores", label: "Stores", hint: "Epoxy, resin, polish, abrasives, blades, spares: receive and issue" },
  { key: "labour", label: "Labour attendance", hint: "Worker list and daily attendance; wages only with costs" },
  { key: "stock", label: "Slab inventory", hint: "Lots at unit and depot, racks, catalogue photos, slab purchases" },
  { key: "sales", label: "Sales", hint: "Invoices, payments, e-invoice and e-way bill" },
  { key: "trade", label: "Import and export", hint: "Shipments, bill of lading, landed cost" },
  { key: "parties", label: "Masters", hint: "Customers, suppliers, vendors, transporters, qualities, mines" },
  { key: "tally", label: "Tally", hint: "Figures from Tally, and export to Tally" },
  { key: "settings", label: "Company settings", hint: "Rates, royalty, invoice format, catalogue" },
];

export const ALL_SECTIONS: Section[] = ["settings", "parties", "blocks", "mineCosts", "jobs", "lots", "damages", "shipments", "sales", "tally", "tallyCfg", "stores", "labour"];

/** Data each area reads, and the part of it the area may change. */
const AREA_SECTIONS: Record<AreaKey, { rw: Section[]; r: Section[] }> = {
  quarry: { rw: ["blocks", "mineCosts"], r: ["parties"] },
  blocks: { rw: ["blocks"], r: ["parties", "shipments"] },
  processing: { rw: ["blocks", "jobs", "lots", "damages"], r: ["parties", "stores"] },
  stores: { rw: ["stores"], r: ["parties", "jobs"] },
  stock: { rw: ["lots"], r: ["blocks", "jobs"] },
  sales: { rw: ["sales", "lots", "blocks"], r: ["parties", "tallyCfg"] },
  trade: { rw: ["shipments", "blocks", "lots"], r: ["parties"] },
  parties: { rw: ["parties"], r: [] },
  tally: { rw: ["tallyCfg"], r: ["tally", "sales", "parties", "blocks", "lots", "stores"] },
  settings: { rw: ["settings"], r: [] },
  labour: { rw: ["labour"], r: [] },
};

const ALL_EDIT: Perms = { areas: Object.fromEntries(AREAS.map((a) => [a.key, "edit"])) as Perms["areas"], costs: true, team: true };

export const ROLES: { key: string; label: string; blurb: string; perms: Perms }[] = [
  { key: "manager", label: "Manager / partner", blurb: "Everything, including adding people", perms: ALL_EDIT },
  {
    key: "accountant", label: "Accountant / munim", blurb: "Invoices, payments, parties, Tally; sees costs",
    perms: { areas: { sales: "edit", parties: "edit", tally: "edit", stock: "view", blocks: "view", stores: "view", trade: "view", quarry: "view", settings: "view", labour: "view" }, costs: true, team: false },
  },
  {
    key: "sales", label: "Sales", blurb: "Sees slab stock and invoices; makes invoices",
    perms: { areas: { stock: "view", sales: "edit", parties: "edit" }, costs: false, team: false },
  },
  {
    key: "depot", label: "Depot manager", blurb: "Slab stock, racks, catalogue photos and sales",
    perms: { areas: { stock: "edit", sales: "edit", parties: "view" }, costs: false, team: false },
  },
  {
    key: "gate", label: "Gate / unloading", blurb: "Only records blocks that arrive, with photos",
    perms: { areas: { blocks: "edit" }, costs: false, team: false },
  },
  {
    key: "yard", label: "Yard and saw supervisor", blurb: "Block yard, saws, slabs out, damage, stores, labour attendance",
    perms: { areas: { blocks: "edit", processing: "edit", stores: "edit", stock: "view", labour: "edit" }, costs: false, team: false },
  },
  {
    key: "storekeeper", label: "Store keeper", blurb: "Receives and issues epoxy, resin, polish, blades and spares",
    perms: { areas: { stores: "edit", parties: "view" }, costs: false, team: false },
  },
  {
    key: "quarry", label: "Quarry supervisor", blurb: "Own quarry blocks, running costs and labour attendance",
    perms: { areas: { quarry: "edit", stores: "edit", labour: "edit" }, costs: true, team: false },
  },
  {
    key: "imports", label: "Import / CHA desk", blurb: "Shipments, BL, landed cost",
    perms: { areas: { trade: "edit", parties: "view", stock: "view" }, costs: true, team: false },
  },
  { key: "custom", label: "Custom", blurb: "Pick exactly what this person can do", perms: { areas: {}, costs: false, team: false } },
];

export function permsOf(me: Pick<Me, "isOwner" | "perms"> | null | undefined): Perms {
  if (!me) return { areas: {}, costs: false, team: false };
  if (me.isOwner) return ALL_EDIT;
  return { areas: me.perms?.areas ?? {}, costs: !!me.perms?.costs, team: !!me.perms?.team };
}

export function level(p: Perms, a: AreaKey): Level {
  return p.areas[a] ?? "none";
}

export function sectionAccess(p: Perms): { read: Set<Section>; write: Set<Section> } {
  const read = new Set<Section>(["settings", "tallyCfg"]);
  const write = new Set<Section>();
  for (const a of AREAS) {
    const l = level(p, a.key);
    if (l === "none") continue;
    const m = AREA_SECTIONS[a.key];
    for (const s of [...m.rw, ...m.r]) read.add(s);
    if (l === "edit") for (const s of m.rw) write.add(s);
  }
  return { read, write };
}

/** Money fields hidden from people who may not see costs. */
export const COST_FIELDS: Partial<Record<Section, string[]>> = {
  blocks: ["rate", "royalty", "dmft", "freight", "loading", "otherCost", "importCost", "damageAlloc", "imp"],
  lots: ["cost"],
  jobs: ["power", "blades", "resin", "netting", "polishing", "labour", "other"],
  labour: ["rate"],
};

/** A manager can hand out at most what they have. Only the owner can let others manage the team. */
export function clampPerms(actor: Perms, actorIsOwner: boolean, want: Perms): Perms {
  const rank = { none: 0, view: 1, edit: 2 } as const;
  const areas: Perms["areas"] = {};
  for (const a of AREAS) {
    const w = want.areas?.[a.key] ?? "none";
    const mine = level(actor, a.key);
    areas[a.key] = rank[w] <= rank[mine] ? w : mine;
  }
  return { areas, costs: !!want.costs && actor.costs, team: !!want.team && actorIsOwner };
}

export function roleLabel(key: string) {
  if (key === "owner") return "Owner";
  return ROLES.find((r) => r.key === key)?.label ?? "Custom";
}
