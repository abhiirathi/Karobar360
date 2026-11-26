// Excel template for bringing a company's existing records into Karobar360, and the code that reads
// a filled-in copy back. One sheet per kind of record; rows are matched to existing records by their
// natural key (block no., lot no., invoice no., party name…) so uploading the same file twice updates
// instead of duplicating. Runs in the browser; exceljs is loaded only when needed.
import type ExcelJS from "exceljs";
import { STATES, uid } from "./calc";
import { STORE_CATS } from "./stores";
import type { Block, BlockStatus, Grade, MineCost, MineCostCat, Party, PartyKind, Sale, SaleLine, SlabLot, StoneDB, StoneType, StoreItem, StoreMove, Worker } from "./types";

type Kind = "text" | "num" | "date" | "list";
type ColDef = { h: string; key: string; kind?: Kind; req?: boolean; opts?: [string, string][]; eg: string; w?: number; note?: string };
type SheetDef = { name: string; about: string; cols: ColDef[] };

const STONES: [string, string][] = [["Marble", "marble"], ["Granite", "granite"], ["Sandstone", "sandstone"], ["Quartzite", "quartzite"], ["Onyx", "onyx"], ["Other", "other"]];
const GRADES: [string, string][] = [["A", "A"], ["B", "B"], ["C", "C"], ["Commercial", "Commercial"]];
const YESNO: [string, string][] = [["Yes", "yes"], ["No", "no"]];
const PARTY_KINDS: [string, PartyKind][] = [["Customer", "customer"], ["Supplier", "supplier"], ["Vendor", "vendor"], ["Transporter", "transporter"], ["Quality", "quality"], ["Godown", "godown"], ["Mine", "mine"]];
const BLOCK_STATUS: [string, BlockStatus][] = [["In godown", "godown"], ["At mine", "at_mine"], ["On saw / processing", "processing"], ["Processed", "processed"], ["Sold", "sold"], ["Written off", "written_off"]];
const SOURCES: [string, string][] = [["Purchase", "purchase"], ["Own mine", "own_mine"], ["Import", "import"]];
const MINE_CATS: [string, MineCostCat][] = [["Diesel", "diesel"], ["Power", "power"], ["Wire saw", "wire"], ["Machine hire", "machine"], ["Consumables", "consumables"], ["Labour", "labour"], ["Tools", "tools"], ["Maintenance", "maintenance"], ["Loading", "loading"], ["Royalty", "royalty"], ["Rent", "rent"], ["Other", "other"]];
const STORE_OPTS: [string, string][] = STORE_CATS.map((c) => [c.label, c.key]);

export const SHEETS: SheetDef[] = [
  {
    name: "Masters", about: "Customers, suppliers, vendors and transporters. Also stone qualities, godowns and your own mines (name only).",
    cols: [
      { h: "Type", key: "kind", kind: "list", req: true, opts: PARTY_KINDS, eg: "Customer", w: 14 },
      { h: "Company / firm name", key: "company", req: true, eg: "Shree Shyam Marbles", w: 28 },
      { h: "Contact person", key: "name", eg: "Ramesh Agarwal", w: 20 },
      { h: "Mobile", key: "phone", eg: "9829012345", w: 14 },
      { h: "WhatsApp", key: "whatsapp", eg: "9829012345", w: 14 },
      { h: "Email", key: "email", eg: "ramesh@example.com", w: 24 },
      { h: "GSTIN", key: "gstin", eg: "08ABCDE1234F1Z5", w: 18 },
      { h: "PAN", key: "pan", eg: "ABCDE1234F", w: 13 },
      { h: "Address", key: "billing", eg: "RIICO Phase 2", w: 26 },
      { h: "City", key: "city", eg: "Kishangarh", w: 14 },
      { h: "State", key: "state", kind: "list", opts: Object.entries(STATES).map(([k, v]) => [v, k]), eg: "Rajasthan", w: 16 },
      { h: "Pincode", key: "pincode", eg: "305801", w: 10 },
      { h: "Credit days", key: "creditDays", kind: "num", eg: "30", w: 11 },
      { h: "Credit limit ₹", key: "creditLimit", kind: "num", eg: "500000", w: 14 },
      { h: "Notes", key: "notes", eg: "", w: 24 },
    ],
  },
  {
    name: "Blocks", about: "Every block you hold now, or bought recently. One row per block.",
    cols: [
      { h: "Block no", key: "no", req: true, eg: "MK-101", w: 12 },
      { h: "Variety", key: "variety", req: true, eg: "Makrana White", w: 18 },
      { h: "Stone type", key: "stoneType", kind: "list", opts: STONES, eg: "Marble", w: 12 },
      { h: "Source", key: "source", kind: "list", opts: SOURCES, eg: "Purchase", w: 12 },
      { h: "Supplier", key: "supplier", eg: "Rajasthan Minerals", w: 22, note: "Same name as in Masters. New names are added as suppliers." },
      { h: "Mine / quarry", key: "mine", eg: "Makrana", w: 16 },
      { h: "Date", key: "date", kind: "date", eg: "25/11/2026", w: 12 },
      { h: "Length cm", key: "l", kind: "num", eg: "280", w: 10 },
      { h: "Width cm", key: "w", kind: "num", eg: "160", w: 10 },
      { h: "Height cm", key: "h", kind: "num", eg: "150", w: 10 },
      { h: "Weight tonnes", key: "tonnes", kind: "num", eg: "18.2", w: 12 },
      { h: "Rate ₹", key: "rate", kind: "num", eg: "9500", w: 10 },
      { h: "Rate per", key: "rateBasis", kind: "list", opts: [["Tonne", "tonne"], ["CBM", "cbm"]], eg: "Tonne", w: 10 },
      { h: "Royalty ₹", key: "royalty", kind: "num", eg: "5460", w: 11 },
      { h: "Freight ₹", key: "freight", kind: "num", eg: "6000", w: 11 },
      { h: "Grade", key: "grade", kind: "list", opts: GRADES, eg: "A", w: 10 },
      { h: "Status", key: "status", kind: "list", opts: BLOCK_STATUS, eg: "In godown", w: 16 },
      { h: "Godown", key: "godown", eg: "Main yard", w: 14 },
      { h: "Supplier bill no", key: "invoiceNo", eg: "RM/2026/118", w: 16 },
      { h: "Vehicle no", key: "vehicleNo", eg: "RJ01GA1234", w: 14 },
      { h: "Notes", key: "notes", eg: "", w: 22 },
    ],
  },
  {
    name: "Slab stock", about: "Slab lots in stock at the unit or depot. One row per lot.",
    cols: [
      { h: "Lot no", key: "lotNo", req: true, eg: "L-2026-041", w: 14 },
      { h: "Variety", key: "variety", req: true, eg: "Makrana White", w: 18 },
      { h: "Stone type", key: "stoneType", kind: "list", opts: STONES, eg: "Marble", w: 12 },
      { h: "Thickness mm", key: "thicknessMm", kind: "num", eg: "18", w: 12 },
      { h: "Finish", key: "finish", eg: "Polished", w: 12 },
      { h: "Grade", key: "grade", kind: "list", opts: GRADES, eg: "A", w: 10 },
      { h: "Slabs", key: "pieces", kind: "num", eg: "42", w: 8 },
      { h: "Total sq ft", key: "sqft", kind: "num", req: true, eg: "1850", w: 11 },
      { h: "Sq ft in stock", key: "available", kind: "num", eg: "1850", w: 12, note: "Leave empty if the whole lot is in stock." },
      { h: "Total cost ₹", key: "cost", kind: "num", eg: "185000", w: 13 },
      { h: "Selling rate ₹/sq ft", key: "listRate", kind: "num", eg: "160", w: 16 },
      { h: "Where", key: "site", kind: "list", opts: [["Depot", "depot"], ["Unit", "unit"], ["Mine", "mine"]], eg: "Depot", w: 10 },
      { h: "Rack / location", key: "location", eg: "A-frame 3", w: 14 },
      { h: "From block no", key: "blockNo", eg: "MK-101", w: 13 },
      { h: "Bought from", key: "supplier", eg: "", w: 20, note: "Only for slabs bought ready-made." },
      { h: "Notes", key: "note", eg: "", w: 22 },
    ],
  },
  {
    name: "Sales", about: "Invoices. One row per item; an invoice with three lots has three rows with the same invoice no.",
    cols: [
      { h: "Invoice no", key: "invoiceNo", req: true, eg: "INV/26-27/015", w: 16 },
      { h: "Date", key: "date", kind: "date", req: true, eg: "20/11/2026", w: 12 },
      { h: "Customer", key: "customer", req: true, eg: "Shree Shyam Marbles", w: 24, note: "Same name as in Masters. New names are added as customers." },
      { h: "Lot no or block no", key: "item", req: true, eg: "L-2026-041", w: 18 },
      { h: "Quantity", key: "qty", kind: "num", req: true, eg: "450", w: 10, note: "Sq ft for slabs, tonnes for blocks." },
      { h: "Rate ₹", key: "rate", kind: "num", req: true, eg: "165", w: 10 },
      { h: "GST %", key: "gstRate", kind: "num", eg: "18", w: 8 },
      { h: "HSN", key: "hsn", eg: "6802", w: 8 },
      { h: "Freight ₹", key: "freight", kind: "num", eg: "0", w: 10 },
      { h: "Vehicle no", key: "vehicleNo", eg: "RJ01GB5678", w: 14 },
      { h: "Paid", key: "paid", kind: "list", opts: YESNO, eg: "No", w: 8 },
      { h: "Paid on", key: "paidOn", kind: "date", eg: "", w: 12 },
      { h: "Notes", key: "notes", eg: "", w: 22 },
    ],
  },
  {
    name: "Stores", about: "Consumables and spares: epoxy, resin, blades, diesel. Enter what is in stock today.",
    cols: [
      { h: "Item name", key: "name", req: true, eg: "Epoxy resin (Tenax)", w: 24 },
      { h: "Category", key: "cat", kind: "list", opts: STORE_OPTS, eg: "Epoxy and hardener", w: 22 },
      { h: "Unit", key: "unit", eg: "kg", w: 8 },
      { h: "In stock now", key: "stock", kind: "num", eg: "120", w: 12 },
      { h: "Reorder level", key: "minQty", kind: "num", eg: "40", w: 12 },
      { h: "Rate ₹ per unit", key: "rate", kind: "num", eg: "450", w: 13 },
      { h: "Location", key: "location", eg: "Store room", w: 14 },
      { h: "Usual vendor", key: "vendor", eg: "Kishangarh Chemicals", w: 20 },
      { h: "Notes", key: "notes", eg: "", w: 22 },
    ],
  },
  {
    name: "Labour", about: "Workers on your rolls.",
    cols: [
      { h: "Name", key: "name", req: true, eg: "Mohan Lal", w: 20 },
      { h: "Mobile", key: "phone", eg: "9876543210", w: 14 },
      { h: "Work", key: "trade", eg: "Gang saw operator", w: 20 },
      { h: "Site", key: "site", eg: "Unit", w: 12 },
      { h: "Wage type", key: "wageType", kind: "list", opts: [["Per day", "day"], ["Per month", "month"]], eg: "Per day", w: 12 },
      { h: "Wage ₹", key: "rate", kind: "num", eg: "600", w: 10 },
      { h: "Joined on", key: "joinedOn", kind: "date", eg: "01/04/2024", w: 12 },
      { h: "Working", key: "active", kind: "list", opts: YESNO, eg: "Yes", w: 9 },
    ],
  },
  {
    name: "Quarry costs", about: "Running costs of your own quarry: diesel, wire, machine hire, labour.",
    cols: [
      { h: "Date", key: "date", kind: "date", req: true, eg: "24/11/2026", w: 12 },
      { h: "Mine", key: "mine", req: true, eg: "Makrana", w: 16 },
      { h: "Category", key: "cat", kind: "list", opts: MINE_CATS, eg: "Diesel", w: 14 },
      { h: "Machine", key: "machine", eg: "Excavator", w: 14 },
      { h: "Qty", key: "qty", kind: "num", eg: "200", w: 8 },
      { h: "Unit", key: "unit", eg: "L", w: 7 },
      { h: "Rate ₹", key: "rate", kind: "num", eg: "94", w: 9 },
      { h: "Amount ₹", key: "amount", kind: "num", req: true, eg: "18800", w: 11 },
      { h: "Vendor", key: "vendor", eg: "HP Pump Makrana", w: 18 },
      { h: "Bill no", key: "billNo", eg: "", w: 12 },
      { h: "Note", key: "note", eg: "", w: 20 },
    ],
  },
];

const EG = "e.g. ";
const HEAD = "FF1C1917";

/** Builds the empty template workbook. */
export async function buildTemplate(company: string): Promise<Blob> {
  const { Workbook } = (await import("exceljs")).default ?? (await import("exceljs"));
  const wb: ExcelJS.Workbook = new Workbook();
  wb.creator = "Karobar360";
  const intro = wb.addWorksheet("Read me", { properties: { tabColor: { argb: HEAD } } });
  intro.getColumn(1).width = 26;
  intro.getColumn(2).width = 90;
  const lines: [string, string][] = [
    ["Karobar360 data template", company ? `For ${company}` : ""],
    ["", ""],
    ["How to use", "1. Fill in the sheets you need. Leave the others empty; you can skip any sheet."],
    ["", "2. Start on row 3. Row 2 is an example in grey and is never imported."],
    ["", "3. Columns marked * are needed. Use the drop-down lists where a column has one."],
    ["", "4. Dates as dd/mm/yyyy. Amounts as plain numbers, no ₹ sign needed."],
    ["", "5. In Karobar360 open Settings → Your data (or the Overview banner) → Upload filled template."],
    ["", "6. You see a preview of what will be added or updated before anything is saved."],
    ["", "Uploading the same file again updates the same records; it does not create copies."],
    ["", ""],
    ["Sheets", ""],
    ...SHEETS.map((s) => [s.name, s.about] as [string, string]),
  ];
  lines.forEach(([a, b], i) => {
    const r = intro.getRow(i + 1);
    r.getCell(1).value = a;
    r.getCell(2).value = b;
    if (i === 0) r.font = { bold: true, size: 15 };
    else r.getCell(1).font = { bold: true };
  });

  for (const s of SHEETS) {
    const ws = wb.addWorksheet(s.name, { views: [{ state: "frozen", ySplit: 2 }] });
    ws.columns = s.cols.map((c) => ({ width: c.w ?? 14 }));
    const head = ws.getRow(1);
    const eg = ws.getRow(2);
    s.cols.forEach((c, i) => {
      const h = head.getCell(i + 1);
      h.value = c.req ? `${c.h} *` : c.h;
      h.font = { bold: true, color: { argb: "FFFFFFFF" } };
      h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD } };
      h.alignment = { vertical: "middle", wrapText: true };
      if (c.note) h.note = c.note;
      const e = eg.getCell(i + 1);
      e.value = c.eg ? `${EG}${c.eg}` : "";
      e.font = { italic: true, color: { argb: "FF9CA3AF" } };
      if (c.opts) {
        const list = c.opts.map((o) => o[0]).join(",");
        // Excel limits inline lists to 255 characters; longer ones (states) are left as free text.
        if (list.length < 250) {
          for (let r = 3; r <= 1000; r++) ws.getCell(r, i + 1).dataValidation = { type: "list", allowBlank: true, formulae: [`"${list}"`], showErrorMessage: false };
        }
      }
      if (c.kind === "date") ws.getColumn(i + 1).numFmt = "dd/mm/yyyy";
    });
    head.height = 30;
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// ─── Reading a filled template ──────────────────────────────────────────────

type Row = Record<string, string | number | null> & { _row: number };
export type Issue = { sheet: string; row: number; text: string };
export type SheetResult = { name: string; added: number; updated: number; skipped: number };
export type ImportPlan = { sheets: SheetResult[]; issues: Issue[]; apply: (d: StoneDB, firmId?: string) => void; total: number };

const norm = (s: string) => s.toLowerCase().replace(/\*/g, "").replace(/[^a-z0-9₹%/]+/g, " ").trim();

function cellValue(v: ExcelJS.CellValue): string | number | Date | null {
  if (v == null) return null;
  if (v instanceof Date || typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "object") {
    if ("result" in v) return cellValue((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    if ("richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("");
    if ("text" in v) return String((v as ExcelJS.CellHyperlinkValue).text);
  }
  return String(v);
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function toDate(v: string | number | Date | null): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return iso(new Date(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  if (typeof v === "number") { const d = new Date(Math.round((v - 25569) * 864e5)); return iso(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); }
  const s = v.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s); // Indian order: day / month / year
  if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : iso(d);
}

function toNum(v: string | number | Date | null): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  if (v instanceof Date) return null;
  let t = v.trim().replace(/^(rs\.?|inr|₹)\s*/i, "").replace(/\s/g, "");
  if (/^-?\d+,\d{1,2}$/.test(t)) t = t.replace(",", "."); // 15,5 written with a decimal comma
  const n = Number(t.replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

function readSheet(ws: ExcelJS.Worksheet, def: SheetDef, issues: Issue[]): Row[] {
  const head = ws.getRow(1);
  const map = new Map<number, ColDef>();
  head.eachCell((cell, col) => {
    const h = norm(String(cellValue(cell.value) ?? ""));
    const c = def.cols.find((x) => norm(x.h) === h);
    if (c) map.set(col, c);
  });
  const rows: Row[] = [];
  ws.eachRow((r, n) => {
    if (n === 1) return;
    const out: Row = { _row: n };
    let any = false;
    let example = false;
    map.forEach((c, col) => {
      const raw = cellValue(r.getCell(col).value);
      if (typeof raw === "string" && raw.trim().startsWith(EG.trim())) { example = true; return; }
      if (raw == null || (typeof raw === "string" && !raw.trim())) { out[c.key] = null; return; }
      any = true;
      if (c.kind === "num") {
        const v = toNum(raw);
        if (v == null) issues.push({ sheet: def.name, row: n, text: `${c.h}: "${String(raw)}" is not a number` });
        out[c.key] = v;
      } else if (c.kind === "date") {
        const v = toDate(raw);
        if (v == null) issues.push({ sheet: def.name, row: n, text: `${c.h}: "${String(raw)}" is not a date` });
        out[c.key] = v;
      } else if (c.kind === "list" && c.opts) {
        const s = String(raw instanceof Date ? iso(raw) : raw).trim().toLowerCase();
        const hit = c.opts.find(([l, v]) => l.toLowerCase() === s || v.toLowerCase() === s) ?? c.opts.find(([l]) => l.toLowerCase().startsWith(s));
        if (!hit) issues.push({ sheet: def.name, row: n, text: `${c.h}: "${String(raw)}" is not one of ${c.opts.slice(0, 6).map((o) => o[0]).join(", ")}${c.opts.length > 6 ? "…" : ""}` });
        out[c.key] = hit ? hit[1] : null;
      } else {
        out[c.key] = String(raw instanceof Date ? iso(raw) : raw).trim();
      }
    });
    if (example && !any) return;
    if (!any) return;
    const miss = def.cols.filter((c) => c.req && (out[c.key] == null || out[c.key] === ""));
    if (miss.length) { issues.push({ sheet: def.name, row: n, text: `Missing ${miss.map((c) => c.h).join(", ")}; row skipped` }); return; }
    rows.push(out);
  });
  return rows;
}

const S = (r: Row, k: string) => (r[k] == null ? "" : String(r[k]));
const N = (r: Row, k: string) => (typeof r[k] === "number" ? (r[k] as number) : 0);
const has = (r: Row, k: string) => r[k] != null && r[k] !== "";
const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const today = () => iso(new Date());

function blankParty(kind: PartyKind, company: string): Party {
  return { id: uid(), kind, name: "", company, gstin: "", pan: "", phone: "", whatsapp: "", email: "", billing: "", city: "", state: "08", pincode: "", shipping: "", contact: "", creditDays: 0, creditLimit: 0, bank: "", notes: "", createdAt: new Date().toISOString() };
}

function blankBlock(no: string): Block {
  return {
    id: uid(), no, variety: "", stoneType: "marble", source: "purchase", supplierId: "", mine: "", leaseNo: "", date: today(), l: 0, w: 0, h: 0, tonnes: 0, billedTonnes: 0, weighSlip: "",
    rate: 0, rateBasis: "tonne", royalty: 0, dmft: 0, eRawanna: "", ewayBill: "", invoiceNo: "", vehicleNo: "", driver: "", driverPhone: "", transporterId: "", freight: 0, loading: 0,
    otherCost: 0, importCost: 0, shipmentId: "", grade: "A", defects: "", photos: [], status: "godown", receivedOn: today(), damageAlloc: 0, notes: "",
  };
}

function blankLot(lotNo: string): SlabLot {
  return { id: uid(), lotNo, blockId: "", shipmentId: "", variety: "", stoneType: "marble", thicknessMm: 18, finish: "Polished", grade: "A", pieces: 0, sqft: 0, available: 0, cost: 0, listRate: 0, site: "depot", location: "", createdAt: new Date().toISOString() };
}

/** Reads a filled template and works out what it would add or change, without changing anything yet. */
export async function planImport(file: File, current: StoneDB): Promise<ImportPlan> {
  const mod = await import("exceljs");
  const { Workbook } = mod.default ?? mod;
  const wb: ExcelJS.Workbook = new Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const issues: Issue[] = [];
  const data: Record<string, Row[]> = {};
  for (const def of SHEETS) {
    const ws = wb.worksheets.find((w) => norm(w.name) === norm(def.name));
    data[def.name] = ws ? readSheet(ws, def, issues) : [];
  }
  if (!Object.values(data).some((r) => r.length) && !issues.length) {
    issues.push({ sheet: "File", row: 0, text: "No rows found. Fill the sheets from row 3 of the Karobar360 template." });
  }

  // Work out added / updated counts against the current data (the same matching apply() uses).
  const sheets: SheetResult[] = [];
  const count = (name: string, rows: Row[], exists: (r: Row) => boolean, group?: (r: Row) => string) => {
    let added = 0, updated = 0;
    const seen = new Set<string>();
    for (const r of rows) {
      const g = group ? group(r) : String(r._row);
      if (seen.has(g)) continue;
      seen.add(g);
      if (exists(r)) updated++; else added++;
    }
    if (rows.length) sheets.push({ name, added, updated, skipped: issues.filter((i) => i.sheet === name && /skipped/.test(i.text)).length });
  };
  const partyKey = (kind: string, name: string) => `${kind}|${key(name)}`;
  const partyIdx = new Set(current.parties.map((p) => partyKey(p.kind, p.company || p.name)));
  count("Masters", data.Masters, (r) => partyIdx.has(partyKey(S(r, "kind"), S(r, "company"))), (r) => partyKey(S(r, "kind"), S(r, "company")));
  count("Blocks", data.Blocks, (r) => current.blocks.some((b) => key(b.no) === key(S(r, "no"))), (r) => key(S(r, "no")));
  count("Slab stock", data["Slab stock"], (r) => current.lots.some((l) => key(l.lotNo) === key(S(r, "lotNo"))), (r) => key(S(r, "lotNo")));
  count("Sales", data.Sales, (r) => current.sales.some((s) => key(s.invoiceNo) === key(S(r, "invoiceNo"))), (r) => key(S(r, "invoiceNo")));
  count("Stores", data.Stores, (r) => (current.stores?.items ?? []).some((i) => key(i.name) === key(S(r, "name"))), (r) => key(S(r, "name")));
  count("Labour", data.Labour, (r) => (current.labour ?? []).some((w) => key(w.name) === key(S(r, "name")) && (!has(r, "phone") || w.phone === S(r, "phone"))));
  count("Quarry costs", data["Quarry costs"], (r) => current.mineCosts.some((x) => x.date === S(r, "date") && key(x.mine) === key(S(r, "mine")) && x.cat === (S(r, "cat") || "other") && x.amount === N(r, "amount") && (x.billNo ?? "") === S(r, "billNo")));

  // Sales lines must point at a lot or block that exists now or comes in this file.
  const lotNos = new Set([...current.lots.map((l) => key(l.lotNo)), ...data["Slab stock"].map((r) => key(S(r, "lotNo")))]);
  const blockNos = new Set([...current.blocks.map((b) => key(b.no)), ...data.Blocks.map((r) => key(S(r, "no")))]);
  for (const r of data.Sales) {
    const it = key(S(r, "item"));
    if (!lotNos.has(it) && !blockNos.has(it)) issues.push({ sheet: "Sales", row: r._row, text: `"${S(r, "item")}" is not a lot or block no. in your stock or this file; the line is kept without stock link` });
  }

  const apply = (d: StoneDB, firmId?: string) => {
    const withFirm = <T extends { firmId?: string }>(x: T) => { if (firmId && !x.firmId) x.firmId = firmId; return x; };
    // Masters first: other sheets refer to them by name.
    const findParty = (kinds: PartyKind[], name: string) => d.parties.find((p) => kinds.includes(p.kind) && (key(p.company) === key(name) || (!p.company && key(p.name) === key(name))));
    const ensureParty = (kind: PartyKind, name: string): string => {
      if (!name.trim()) return "";
      const hit = findParty([kind], name);
      if (hit) return hit.id;
      const p = blankParty(kind, name.trim());
      d.parties.push(p);
      return p.id;
    };
    for (const r of data.Masters) {
      const kind = S(r, "kind") as PartyKind;
      let p = findParty([kind], S(r, "company"));
      if (!p) { p = blankParty(kind, S(r, "company")); d.parties.push(p); }
      for (const k of ["name", "phone", "whatsapp", "email", "gstin", "pan", "billing", "city", "state", "pincode", "notes"] as const) if (has(r, k)) (p as unknown as Record<string, string>)[k] = k === "gstin" || k === "pan" ? S(r, k).toUpperCase() : S(r, k);
      if (has(r, "creditDays")) p.creditDays = N(r, "creditDays");
      if (has(r, "creditLimit")) p.creditLimit = N(r, "creditLimit");
      if (kind === "quality" && !p.stoneType) p.stoneType = "marble";
    }

    for (const r of data.Blocks) {
      let b = d.blocks.find((x) => key(x.no) === key(S(r, "no")));
      const isNew = !b;
      if (!b) { b = withFirm(blankBlock(S(r, "no"))); d.blocks.push(b); }
      b.variety = S(r, "variety");
      if (has(r, "stoneType")) b.stoneType = S(r, "stoneType") as StoneType;
      if (has(r, "source")) b.source = S(r, "source") as Block["source"];
      if (has(r, "supplier")) b.supplierId = ensureParty(b.source === "own_mine" ? "mine" : "supplier", S(r, "supplier"));
      if (has(r, "mine")) b.mine = S(r, "mine");
      if (has(r, "date")) { b.date = S(r, "date"); b.receivedOn = S(r, "date"); }
      for (const k of ["l", "w", "h", "rate", "royalty", "freight"] as const) if (has(r, k)) b[k] = N(r, k);
      if (has(r, "tonnes")) { b.tonnes = N(r, "tonnes"); if (!b.billedTonnes) b.billedTonnes = b.tonnes; }
      if (has(r, "rateBasis")) b.rateBasis = S(r, "rateBasis") as Block["rateBasis"];
      if (has(r, "grade")) b.grade = S(r, "grade") as Grade;
      if (has(r, "status")) b.status = S(r, "status") as BlockStatus;
      else if (isNew && b.source === "own_mine") b.status = "at_mine";
      if (has(r, "godown")) { b.godown = S(r, "godown"); ensureParty("godown", S(r, "godown")); }
      for (const k of ["invoiceNo", "vehicleNo", "notes"] as const) if (has(r, k)) b[k] = S(r, k);
    }

    for (const r of data["Slab stock"]) {
      let l = d.lots.find((x) => key(x.lotNo) === key(S(r, "lotNo")));
      if (!l) { l = withFirm(blankLot(S(r, "lotNo"))); d.lots.push(l); }
      l.variety = S(r, "variety");
      if (has(r, "stoneType")) l.stoneType = S(r, "stoneType") as StoneType;
      if (has(r, "thicknessMm")) l.thicknessMm = N(r, "thicknessMm");
      if (has(r, "finish")) l.finish = S(r, "finish");
      if (has(r, "grade")) l.grade = S(r, "grade") as Grade;
      if (has(r, "pieces")) l.pieces = N(r, "pieces");
      l.sqft = N(r, "sqft");
      l.available = has(r, "available") ? N(r, "available") : l.sqft;
      if (has(r, "cost")) l.cost = N(r, "cost");
      if (has(r, "listRate")) l.listRate = N(r, "listRate");
      if (has(r, "site")) l.site = S(r, "site") as SlabLot["site"];
      if (has(r, "location")) l.location = S(r, "location");
      if (has(r, "blockNo")) { const b = d.blocks.find((x) => key(x.no) === key(S(r, "blockNo"))); if (b) l.blockId = b.id; }
      if (has(r, "supplier")) { l.source = "purchase"; l.supplierId = ensureParty("supplier", S(r, "supplier")); if (has(r, "cost") && !l.buyValue) l.buyValue = l.cost; }
      else if (!l.source) l.source = "own";
      if (has(r, "note")) l.note = S(r, "note");
    }

    const byInvoice = new Map<string, Row[]>();
    for (const r of data.Sales) { const k = key(S(r, "invoiceNo")); byInvoice.set(k, [...(byInvoice.get(k) ?? []), r]); }
    for (const rows of byInvoice.values()) {
      const f = rows[0];
      let s = d.sales.find((x) => key(x.invoiceNo) === key(S(f, "invoiceNo")));
      if (!s) { s = withFirm<Sale>({ id: uid(), invoiceNo: S(f, "invoiceNo"), date: S(f, "date"), customerId: "", lines: [], freight: 0, vehicleNo: "", ewayBill: "", gstRate: 18, hsn: "6802", paid: false, notes: "" }); d.sales.push(s); }
      s.date = S(f, "date");
      s.customerId = ensureParty("customer", S(f, "customer"));
      s.lines = rows.map((r): SaleLine => {
        const it = key(S(r, "item"));
        const lot = d.lots.find((x) => key(x.lotNo) === it);
        const blk = lot ? undefined : d.blocks.find((x) => key(x.no) === it);
        return blk ? { lotId: "", blockId: blk.id, sqft: N(r, "qty"), rate: N(r, "rate") } : { lotId: lot?.id ?? "", sqft: N(r, "qty"), rate: N(r, "rate") };
      });
      const firstWith = (k: string) => rows.find((r) => has(r, k));
      const g = firstWith("gstRate"); if (g) s.gstRate = N(g, "gstRate");
      const h = firstWith("hsn"); if (h) s.hsn = S(h, "hsn");
      s.freight = rows.reduce((a, r) => a + N(r, "freight"), 0);
      const v = firstWith("vehicleNo"); if (v) s.vehicleNo = S(v, "vehicleNo");
      const p = firstWith("paid"); if (p) s.paid = S(p, "paid") === "yes";
      const po = firstWith("paidOn"); if (po) { s.paidOn = S(po, "paidOn"); s.paid = true; }
      const nt = rows.map((r) => S(r, "notes")).filter(Boolean).join("; "); if (nt) s.notes = nt;
    }

    if (data.Stores.length) {
      d.stores ??= { items: [], moves: [] };
      const st = d.stores;
      for (const r of data.Stores) {
        let it = st.items.find((x) => key(x.name) === key(S(r, "name")));
        const cat = (S(r, "cat") || "other") as StoreItem["cat"];
        if (!it) { it = { id: uid(), name: S(r, "name"), cat, unit: STORE_CATS.find((c) => c.key === cat)?.unit ?? "pcs", minQty: 0, rate: 0, location: "", notes: "" }; st.items.push(it); }
        if (has(r, "cat")) it.cat = cat;
        if (has(r, "unit")) it.unit = S(r, "unit");
        if (has(r, "minQty")) it.minQty = N(r, "minQty");
        if (has(r, "rate")) it.rate = N(r, "rate");
        if (has(r, "location")) it.location = S(r, "location");
        if (has(r, "notes")) it.notes = S(r, "notes");
        if (has(r, "vendor")) it.vendorId = ensureParty("vendor", S(r, "vendor"));
        if (has(r, "stock")) {
          const now = st.moves.filter((m) => m.itemId === it!.id).reduce((a, m) => a + (m.kind === "out" ? -m.qty : m.qty), 0);
          const diff = N(r, "stock") - now;
          if (Math.abs(diff) > 1e-9) st.moves.push({ id: uid(), itemId: it.id, date: today(), kind: "adjust", qty: diff, rate: it.rate, note: "Stock as per Excel import" } satisfies StoreMove);
        }
      }
    }

    if (data.Labour.length) {
      d.labour ??= [];
      for (const r of data.Labour) {
        let w = d.labour.find((x) => key(x.name) === key(S(r, "name")) && (!has(r, "phone") || x.phone === S(r, "phone")));
        if (!w) { w = withFirm<Worker>({ id: uid(), name: S(r, "name"), phone: "", trade: "", site: "Unit", wageType: "day", rate: 0, joinedOn: today(), active: true, notes: "" }); d.labour.push(w); }
        for (const k of ["phone", "trade", "site", "joinedOn"] as const) if (has(r, k)) w[k] = S(r, k);
        if (has(r, "wageType")) w.wageType = S(r, "wageType") as Worker["wageType"];
        if (has(r, "rate")) w.rate = N(r, "rate");
        if (has(r, "active")) w.active = S(r, "active") === "yes";
      }
    }

    for (const r of data["Quarry costs"]) {
      const c = withFirm<MineCost>({ id: uid(), date: S(r, "date"), mine: S(r, "mine"), cat: (S(r, "cat") || "other") as MineCostCat, machine: S(r, "machine"), qty: N(r, "qty"), unit: S(r, "unit"), rate: N(r, "rate"), amount: N(r, "amount"), note: S(r, "note"), billNo: S(r, "billNo") || undefined });
      if (has(r, "vendor")) c.vendorId = ensureParty("vendor", S(r, "vendor"));
      const dup = d.mineCosts.some((x) => x.date === c.date && key(x.mine) === key(c.mine) && x.cat === c.cat && x.amount === c.amount && (x.billNo ?? "") === (c.billNo ?? ""));
      if (!dup) d.mineCosts.push(c);
      ensureParty("mine", c.mine);
    }
  };

  const total = sheets.reduce((a, s) => a + s.added + s.updated, 0);
  return { sheets, issues, apply, total };
}
