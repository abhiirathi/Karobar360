import type { Modules, StoneDB, StoneSettings, TallySettings } from "./types";

export const ALL_MODULES: Modules = { stores: true, quarry: true, buyBlocks: true, processing: true, imports: true, exports: true, trading: true, depot: true, jobwork: false };

export const MODULE_INFO: { key: keyof Modules; label: string; hint: string }[] = [
  { key: "quarry", label: "We run our own quarry", hint: "Blocks extracted, dispatch, e-Rawanna, diesel, wire and labour per tonne" },
  { key: "buyBlocks", label: "We buy blocks", hint: "From quarries and block traders: rate, royalty, freight, weighbridge" },
  { key: "processing", label: "We have a manufacturing unit", hint: "Gang saw, cutter or resin line: yield, cost per sq ft, damage" },
  { key: "jobwork", label: "We cut customers' blocks (job work)", hint: "Customer's own block in, slabs back, cutting charged per sq ft" },
  { key: "imports", label: "We import blocks or slabs", hint: "Italy, Turkey, Brazil, Greece, China: BL, landed cost, free days" },
  { key: "exports", label: "We export", hint: "Shipments out, shipping bill, containers" },
  { key: "trading", label: "We buy slabs to resell", hint: "Slab purchases from other units and importers" },
  { key: "depot", label: "We sell from a depot or showroom", hint: "Slab inventory by rack, GST invoices, dealer catalogue" },
  { key: "stores", label: "We keep stores and consumables", hint: "Epoxy, resin, polishing powder, abrasives, blades, wire, spares, packing" },
];

export const BUSINESS_PRESETS: { key: string; label: string; blurb: string; m: Partial<Modules> }[] = [
  { key: "distributor", label: "Distributor / trader", blurb: "Buys slabs, sells from a depot", m: { trading: true, depot: true } },
  { key: "importer", label: "Importer", blurb: "Imports blocks or slabs and sells them", m: { imports: true, trading: true, depot: true } },
  { key: "processor", label: "Manufacturing unit", blurb: "Buys blocks, saws, sells slabs", m: { buyBlocks: true, processing: true, depot: true, stores: true } },
  { key: "jobwork", label: "Job work unit", blurb: "Cuts customers' blocks for a charge", m: { processing: true, jobwork: true, stores: true } },
  { key: "quarry", label: "Quarry owner", blurb: "Extracts and sells blocks", m: { quarry: true, stores: true } },
  { key: "integrated", label: "Quarry + unit + depot", blurb: "Every stage, mine to sale", m: { quarry: true, buyBlocks: true, processing: true, imports: true, depot: true, stores: true } },
];

export function modulesOf(s: StoneSettings | undefined): Modules {
  return { ...ALL_MODULES, ...(s?.modules ?? {}) };
}

export function presetModules(m: Partial<Modules>): Modules {
  return { stores: false, quarry: false, buyBlocks: false, processing: false, imports: false, exports: false, trading: false, depot: false, jobwork: false, ...m };
}

/** A unit that only cuts other people's blocks: no stock of its own to buy, hold or sell. */
export const jobOnly = (m: Modules) => !!m.jobwork && !m.quarry && !m.buyBlocks && !m.imports && !m.trading && !m.depot;

/** Rough blocks exist in the business (own, bought or imported). */
export const hasBlocks = (m: Modules) => m.quarry || m.buyBlocks || m.processing || m.imports;

export const TALLY_DEFAULT: TallySettings = {
  company: "",
  salesLedger: "Sales - Marble Slabs",
  blockSalesLedger: "Sales - Rough Blocks",
  purchaseLedger: "Purchase - Blocks & Slabs",
  freightLedger: "Freight Outward",
  cgstOut: "Output CGST", sgstOut: "Output SGST", igstOut: "Output IGST",
  cgstIn: "Input CGST", sgstIn: "Input SGST", igstIn: "Input IGST",
  blockGst: 5,
  storesLedger: "Purchase - Stores & Consumables",
  show: ["salesMonth", "receivables", "cashBank", "salesTrend"],
  partyNames: {},
};

export const tallyOf = (db: StoneDB): TallySettings => ({ ...TALLY_DEFAULT, ...(db.tallyCfg ?? {}), partyNames: { ...(db.tallyCfg?.partyNames ?? {}) } });

export const DASH_WIDGETS: { key: string; label: string }[] = [
  { key: "greeting", label: "Today’s summary and shortcuts" },
  { key: "health", label: "Business health score" },
  { key: "kpis", label: "Key numbers" },
  { key: "tally", label: "Figures from Tally" },
  { key: "flow", label: "Stock flow, quarry to sale" },
  { key: "chart", label: "Sales and buying, 12 weeks" },
  { key: "attention", label: "Needs attention" },
  { key: "trade", label: "Imports and exports" },
  { key: "costbuild", label: "Cost of a sq ft by variety" },
];
