// Natural Stones workspace — data model.
// Units follow how Kishangarh trades: blocks by tonne (domestic) or CBM (imported), slabs by sq ft.

export type StoneType = "marble" | "granite" | "sandstone" | "quartzite" | "onyx" | "other";
export type Site = "mine" | "unit" | "depot";
export type BlockSource = "own_mine" | "purchase" | "import";
/** A block sits in a godown, is issued for processing, comes out as lots, or is sold as it is. Quarry blocks stay at the mine until sold. */
export type BlockStatus = "at_mine" | "godown" | "processing" | "processed" | "sold" | "written_off";
export type Grade = "A" | "B" | "C" | "Commercial";
export type RateBasis = "tonne" | "cbm";

export type PartyKind = "customer" | "supplier" | "vendor" | "transporter" | "quality" | "mine" | "godown";

/** A master record: customer, block supplier, vendor, transporter, stone quality or own mine. */
export interface Party {
  id: string;
  kind: PartyKind;
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
  mines?: string[]; // block supplier's quarries
  leaseNo?: string; // own mine
  stoneType?: StoneType; // quality
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
  /** Gross and tare in kg, from the weighbridge connector or typed in. */
  weigh?: { gross?: number; tare?: number; grossAt?: string; tareAt?: string; source: "weighbridge" | "manual"; device?: string };
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
  godown?: string; // which godown it lies in, from Masters → Godowns
  processOn?: string; // date it was issued for processing
  receivedOn: string;
  damageAlloc: number; // ₹ added by damage spreads
  notes: string;
  firmId?: string; // firm holding the block now; empty = the first firm
  trail?: Transfer[]; // moves between the group's firms, oldest first
  purchaseId?: string; // blocks entered together on one purchase bill
  imp?: ImportBill; // import purchase: BL, CIF and charges of the whole bill
}

export interface ImportCharge {
  label: string;
  amount: number; // ₹
  note: string;
}

/** BL, CIF value and extra charges of one import purchase, copied on each of its blocks. */
export interface ImportBill {
  blNo: string;
  blDate: string;
  vessel: string;
  port: string;
  cif: number; // ₹, CIF value of the whole bill
  charges: ImportCharge[];
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

export type FirmKind = "mine" | "processing" | "jobwork" | "distribution" | "trade" | "other";

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

// "stores" is never entered by hand: it is what the store issued to the quarry.
export type MineCostCat = "diesel" | "power" | "wire" | "machine" | "consumables" | "labour" | "tools" | "maintenance" | "loading" | "royalty" | "rent" | "other" | "stores";

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
  vendorId?: string; // machine owner, diesel pump, wire supplier
  billNo?: string;
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
  reserves?: Reservation[]; // slabs kept aside for customers, one entry per customer
}

/** Slabs of a lot a customer has picked and will lift later. Kept for them until billed or released, even after the till date. */
export interface Reservation {
  id: string;
  customerId: string;
  slabIds: string[];
  on: string; // date reserved
  till: string; // reserved till; after it the reservation shows as expired but still holds the slabs
  rate: number; // agreed ₹ per sq ft, filled into the invoice
  advance?: number; // advance taken, ₹ (a note, not a payment entry)
  note?: string;
  by?: string; // who reserved
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
  vendorId?: string; // usual vendor, from Masters
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
  jobwork?: boolean; // cuts customers' own blocks for a charge
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
  firmCompany?: Record<string, string>; // firm id → company name in Tally
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
  jobwork?: JobSettings;
  /** Optional clean-up of settled data. Off unless the owner switches it on. */
  purge?: {
    enabled: boolean;
    after: "paid" | "days"; // right after full payment, or N days after it
    days: number;
    stock?: boolean; // no longer used: the whole trail always goes with the invoices
  };
}

/** Attendance for one day: present, half day, absent. */
export type Mark = "P" | "H" | "A";

/** A worker on the labour list. The wage is hidden from people who may not see costs. */
export interface Worker {
  id: string;
  name: string;
  phone: string;
  trade: string; // gang saw operator, polisher, helper…
  site: string; // where they work: unit, mine, depot
  wageType: "day" | "month";
  rate: number; // ₹ per day, or ₹ per month
  joinedOn: string;
  active: boolean;
  notes: string;
  firmId?: string;
  /** Attendance by date (YYYY-MM-DD). */
  att?: Record<string, Mark>;
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
  /** Labour list with daily attendance. Added Nov 2026; missing in older data. */
  labour?: Worker[];
  jobwork?: JobOrder[];
}

// ─── Job work: cutting a customer's own block into slabs for a charge ───
// The block and its slabs stay the customer's property: they never enter our stock, costs or sales.

export type JobBlockStatus = "expected" | "in_yard" | "on_saw" | "cut" | "returned";

/** What came off the saw for one customer block. */
export interface JobCut {
  machine: string;
  startedOn: string;
  finishedOn: string;
  thicknessMm: number;
  finish: string;
  slabs: number; // good slabs
  sqft: number; // good slabs, sq ft
  slabL: number; // cm, average
  slabW: number;
  brokenSlabs: number; // broke or cracked while cutting
  brokenSqft: number;
  hours: number;
  note: string;
}

export interface JobBlock {
  id: string;
  no: string; // the customer's block mark
  variety: string;
  stoneType: StoneType;
  l: number; // cm
  w: number;
  h: number;
  tonnes: number;
  receivedOn: string;
  vehicleNo: string;
  challanNo: string; // the customer's delivery challan
  ewayBill: string;
  condition: string; // cracks, veins, chips seen on arrival
  photos: string[];
  status: JobBlockStatus;
  cut?: JobCut;
}

/** A charge on top of cutting: resin, polish, netting, edge cutting, loading. */
export interface JobExtra {
  label: string;
  basis: "sqft" | "slab" | "lump"; // per sq ft of good slabs, per good slab, or once per bill
  rate: number;
}

export interface JobDispatchLine {
  blockId: string;
  slabs: number; // good slabs sent
  sqft: number;
  broken: number; // broken pieces sent back
}

/** Delivery challan for slabs going back to the customer, or to whoever they name. */
export interface JobDispatch {
  id: string;
  no: string;
  date: string;
  vehicleNo: string;
  driver: string;
  driverPhone: string;
  transporterId: string;
  ewayBill: string;
  value: number; // value of the goods, for the challan and e-way bill
  shipTo: string; // "" = customer's own address
  offcuts: string; // off-cuts and waste sent back with this vehicle
  lines: JobDispatchLine[];
  /** The owner let it go although the customer had dues past credit. */
  release?: { by: string; reason: string; dues: number };
  notes: string;
}

export interface JobBillLine {
  kind: "cut" | "extra" | "rent" | "broken" | "other";
  label: string;
  qty: number;
  unit: string;
  rate: number;
  note?: string; // why: required for broken slabs and other manual charges
}

export interface JobBill {
  id: string;
  invoiceNo: string;
  date: string;
  blockIds: string[]; // blocks whose cutting this bill covers
  lines: JobBillLine[];
  gstRate: number;
  sac: string;
  paid: boolean;
  paidOn?: string;
  irn?: string;
  notes: string;
}

export interface JobOrder {
  id: string;
  no: string;
  date: string;
  customerId: string;
  thicknessMm: number;
  finish: string;
  instructions: string; // sizes, calibration, edges, anything the saw needs to know
  rate: number; // ₹ per sq ft of good slabs
  extras: JobExtra[];
  waste: "return" | "keep"; // off-cuts and waste go back, or stay with us
  freeDays: number; // days a block may wait at the unit without rent
  rentPerDay: number; // ₹ per block per day after that; 0 = no rent
  blocks: JobBlock[];
  dispatches: JobDispatch[];
  bills: JobBill[];
  closed: boolean;
  notes: string;
  firmId?: string;
}

export interface JobSettings {
  rate: number;
  gstRate: number;
  sac: string;
  freeDays: number;
  rentPerDay: number;
  extras: JobExtra[];
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
  /** Every company that was open in Tally, when the connector sent more than one. */
  companies?: TallyData[];
  /** Windows computer the connector ran on. */
  computer?: string;
}
