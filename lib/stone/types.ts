// Natural Stones workspace — data model.
// Units follow how Kishangarh trades: blocks by tonne (domestic) or CBM (imported), slabs by sq ft.

export type StoneType = "marble" | "granite" | "sandstone" | "quartzite" | "onyx" | "other";
export type Site = "mine" | "unit" | "depot";
export type BlockSource = "own_mine" | "purchase" | "import";
export type BlockStatus = "at_mine" | "in_transit" | "in_yard" | "on_saw" | "sawn" | "sold" | "rejected";
export type Grade = "A" | "B" | "C" | "Commercial";
export type RateBasis = "tonne" | "cbm";

export interface Party {
  id: string;
  kind: "customer" | "supplier" | "transporter";
  name: string; // person / proprietor
  company: string;
  gstin: string;
  pan: string;
  phone: string;
  whatsapp: string;
  email: string;
  billing: string; // street / area
  city: string;
  state: string; // state code, e.g. "08"; "96" for a customer outside India
  pincode: string;
  intl?: boolean; // customer or supplier outside India (export sales)
  country?: string;
  shipping: string;
  contact: string;
  creditDays: number;
  creditLimit: number;
  bank: string;
  notes: string;
  createdAt: string;
}

export interface Block {
  id: string;
  no: string; // block number as marked at the quarry
  variety: string;
  stoneType: StoneType;
  source: BlockSource;
  supplierId: string;
  mine: string; // quarry / mine name
  leaseNo: string;
  date: string; // dispatch or purchase date
  l: number; // cm
  w: number;
  h: number;
  tonnes: number; // weighbridge net at our gate
  billedTonnes: number; // as per supplier bill / rawanna
  weighSlip: string;
  rate: number; // ₹ per tonne or per CBM
  rateBasis: RateBasis;
  royalty: number; // ₹
  dmft: number; // ₹
  eRawanna: string;
  ewayBill: string;
  invoiceNo: string;
  vehicleNo: string;
  driver: string;
  driverPhone: string;
  transporterId: string;
  freight: number; // ₹ share for this block
  loading: number; // crane / hydra / loading-unloading ₹
  otherCost: number;
  importCost: number; // landed import cost when it came on a shipment
  shipmentId: string;
  grade: Grade;
  defects: string;
  photos: string[];
  status: BlockStatus;
  receivedOn: string;
  damageAlloc: number; // ₹ added by damage spreads
  notes: string;
  firmId?: string; // firm holding the block now; empty = the first firm
  trail?: Transfer[]; // moves between the group's firms, oldest first
}

/** A move of a block or lot from one firm of the group to another. */
export interface Transfer {
  date: string;
  from: string; // firm id
  to: string;
  doc: string; // delivery challan or invoice no.
  value: number; // ₹ transfer value, 0 if not billed
  note: string;
}

export type FirmKind = "mine" | "processing" | "distribution" | "trade" | "other";

/** One company of the group: its own GSTIN, invoices and sections. */
export interface Firm {
  id: string;
  name: string;
  kind: FirmKind;
  gstin: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  invoicePrefix: string;
  modules: Modules;
}

export type MineCostCat = "diesel" | "power" | "wire" | "labour" | "tools" | "maintenance" | "royalty" | "rent" | "other";

export interface MineCost {
  id: string;
  date: string;
  mine: string;
  cat: MineCostCat;
  machine: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
  note: string;
  firmId?: string;
}

export interface SawJob {
  id: string;
  blockId: string;
  machine: string;
  startedOn: string;
  finishedOn: string;
  thicknessMm: number;
  slabs: number;
  slabL: number; // cm average
  slabW: number;
  sqft: number;
  rejectSqft: number;
  hours: number;
  power: number;
  blades: number;
  resin: number;
  netting: number;
  polishing: number;
  labour: number;
  other: number;
  finish: string;
  grade: Grade;
  lotId: string;
  firmId?: string;
}

export interface SlabLot {
  id: string;
  lotNo: string;
  blockId: string;
  shipmentId: string;
  variety: string;
  stoneType: StoneType;
  thicknessMm: number;
  finish: string;
  grade: Grade;
  pieces: number;
  sqft: number; // produced / received
  available: number; // sq ft in stock
  cost: number; // total ₹ cost of the lot (block + processing + transfers)
  listRate: number; // ₹ per sq ft
  site: Site;
  location: string; // rack / A-frame
  createdAt: string;
  // Bought as slabs from a domestic supplier (traders and distributors)
  source?: "own" | "purchase" | "import";
  supplierId?: string;
  invoiceNo?: string;
  gstRate?: number;
  buyValue?: number; // slab value on the supplier's bill, before freight
  photos?: string[];
  catalogue?: boolean; // show in the dealer catalogue
  note?: string;
  slabs?: Slab[]; // every slab in the lot, when tracked one by one
  firmId?: string;
  trail?: Transfer[];
}

export type SlabStatus = "stock" | "sold" | "broken";

/** One physical slab cut from a block. Its lot is the SlabLot that holds it. */
export interface Slab {
  id: string;
  no: string; // block no / running number, e.g. BL-001/07
  blockId: string;
  l: number; // cm
  w: number; // cm
  sqft: number;
  grade: Grade;
  status: SlabStatus;
  saleId?: string;
  note?: string;
}

export interface DamageLine {
  blockId: string;
  loss: number;
  writeOff: boolean;
}

export interface DamageEvent {
  id: string;
  date: string;
  vehicleNo: string;
  cause: string;
  lines: DamageLine[];
  extra: number; // crane, re-loading, repair
  recovery: number; // from transporter / insurance
  basis: "tonne" | "cbm" | "value";
  spreadIds: string[];
  alloc: Record<string, number>;
  firmId?: string;
}

export interface Container {
  no: string;
  seal: string;
  size: string;
  grossKg: number;
}

export type ShipStatus = "booked" | "sailing" | "at_port" | "customs" | "cleared" | "received";

export interface Shipment {
  id: string;
  dir: "import" | "export";
  kind: "blocks" | "slabs";
  partyName: string; // overseas supplier or buyer
  country: string;
  variety: string;
  stoneType: StoneType;
  blNo: string;
  blDate: string;
  line: string; // shipping line
  vessel: string;
  voyage: string;
  pol: string;
  pod: string;
  containers: Container[];
  pieces: number; // blocks or slabs/bundles
  tonnes: number;
  cbm: number;
  sqm: number;
  thicknessMm: number;
  cifUsd: number;
  fx: number;
  beNo: string; // bill of entry / shipping bill
  beDate: string;
  duty: number; // customs duty paid ₹ (not creditable)
  igst: number; // creditable
  cha: number;
  port: number;
  inland: number;
  eta: string;
  arrived: string;
  freeDays: number;
  status: ShipStatus;
  // Trade terms. On FOB imports (and CIF exports) we book the ship ourselves, so freight and insurance are ours.
  terms?: "FOB" | "CIF";
  fobUsd?: number;
  freightUsd?: number; // ocean freight paid to the line or forwarder
  insuranceUsd?: number;
  forwarder?: string; // freight forwarder or shipping line we booked with
  bookingNo?: string;
  blFile: { name: string; data: string } | null;
  notes: string;
  receivedIds: string[];
  firmId?: string;
}

export interface SaleLine {
  lotId: string; // slab lot, or "" when a block is sold
  blockId?: string; // rough block sold as it is (quarries and traders)
  sqft: number; // quantity: sq ft for slabs, tonnes for blocks
  rate: number;
  slabIds?: string[]; // the exact slabs sold from the lot
}

export interface Sale {
  id: string;
  invoiceNo: string;
  date: string;
  customerId: string;
  lines: SaleLine[];
  freight: number;
  vehicleNo: string;
  ewayBill: string;
  gstRate: number;
  hsn: string;
  paid: boolean;
  paidOn?: string; // date full payment was received
  notes: string;
  irn?: string; // e-invoice reference number from the IRP
  ackNo?: string;
  ackDate?: string;
  distanceKm?: number; // for the e-way bill
  transporterId?: string;
  lut?: boolean; // export under LUT / bond, without paying IGST
  port?: string; // port of loading, for exports
  sbNo?: string; // shipping bill no., for exports
  firmId?: string; // firm that billed the sale
}

export type StoreCat = "epoxy" | "resin" | "polish" | "abrasive" | "blades" | "netting" | "chemicals" | "fuel" | "spares" | "packing" | "other";

/** Consumables and stores: epoxy, resin, polishing powder, abrasives, blades, wire, spares, packing, diesel. */
export interface StoreItem {
  id: string;
  name: string;
  cat: StoreCat;
  unit: string; // kg, L, pcs, m, sq m, set
  minQty: number; // reorder level
  rate: number; // last purchase rate, ₹ per unit
  location: string;
  notes: string;
}

export interface StoreMove {
  id: string;
  itemId: string;
  date: string;
  kind: "in" | "out" | "adjust";
  qty: number; // in/out are positive; adjust is + or −
  rate: number; // ₹ per unit on the bill (in)
  supplierId?: string;
  billNo?: string;
  gstRate?: number;
  usedFor?: string; // machine, line or job
  note: string;
}

export interface Stores {
  items: StoreItem[];
  moves: StoreMove[];
}

export interface Modules {
  stores: boolean; // consumables and stores
  quarry: boolean; // own or leased quarry
  buyBlocks: boolean; // buys blocks from quarries and traders
  processing: boolean; // gang saw / cutter / resin line
  imports: boolean;
  exports: boolean;
  trading: boolean; // buys slabs and resells
  depot: boolean; // sells slabs from a depot or showroom
}

export interface TallySettings {
  company: string; // company name exactly as in Tally
  salesLedger: string;
  blockSalesLedger: string;
  purchaseLedger: string;
  freightLedger: string;
  cgstOut: string; sgstOut: string; igstOut: string;
  cgstIn: string; sgstIn: string; igstIn: string;
  blockGst: number; // GST on rough blocks bought
  storesLedger: string; // purchase ledger for consumables
  show: string[]; // Tally figures to show on the dashboard
  partyNames: Record<string, string>; // our party id → ledger name in Tally, when it differs
}

export interface StoneSettings {
  company: string;
  gstin: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  invoicePrefix: string;
  royaltyPerTonne: number;
  dmftPct: number;
  density: number; // t per m³
  powerRate: number; // ₹/kWh
  sawKw: number; // gang saw connected load
  bladePerSqft: number;
  resinPerSqft: number;
  nettingPerSqft: number;
  polishPerSqft: number;
  labourPerSqft: number;
  ownMines: string[];
  machines: string[];
  pincode?: string;
  modules?: Modules;
  firms?: Firm[]; // the companies of the group; the first one holds records with no firm set
  dashboard?: { hidden: string[]; order: string[]; kpis?: string[] };
  catalogue?: { enabled: boolean; showRates: boolean; whatsapp: string; note: string };
  /** Optional clean-up of settled data. Off unless the owner switches it on. */
  purge?: {
    enabled: boolean;
    after: "paid" | "days"; // right after full payment, or N days after it
    days: number;
    stock: boolean; // also remove sold-out slab lots and the block records behind them
  };
}

export interface StoneDB {
  v: 1;
  settings: StoneSettings;
  parties: Party[];
  blocks: Block[];
  mineCosts: MineCost[];
  jobs: SawJob[];
  lots: SlabLot[];
  tally?: TallyData;
  tallyCfg?: TallySettings;
  stores?: Stores;
  damages: DamageEvent[];
  shipments: Shipment[];
  sales: Sale[];
}

/** Figures pulled from the company's Tally by the connector. */
export interface TallyData {
  syncedAt: string;
  company: string;
  months: { m: string; sales: number; purchases: number; expenses: number }[];
  receivables: number;
  payables: number;
  cashBank: number;
  gstPayable: number;
  topDebtors: { name: string; amount: number }[];
  topCreditors: { name: string; amount: number }[];
}
