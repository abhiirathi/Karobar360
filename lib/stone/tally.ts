// Tally Prime / ERP 9 import files (Gateway of Tally → Import → Masters / Vouchers).
// Accounting-voucher format: party ledger first, debits negative, credits positive.
import { STATES, purchaseValue, saleTotals } from "./calc";
import { tallyOf } from "./modules";
import type { Block, Party, Sale, SlabLot, StoneDB } from "./types";

const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const d8 = (iso: string) => iso.slice(0, 10).replace(/-/g, "");
const amt = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

function envelope(report: "Vouchers" | "All Masters", company: string, body: string) {
  return `<ENVELOPE>
<HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
<BODY><IMPORTDATA>
<REQUESTDESC><REPORTNAME>${report}</REPORTNAME>${company ? `<STATICVARIABLES><SVCURRENTCOMPANY>${esc(company)}</SVCURRENTCOMPANY></STATICVARIABLES>` : ""}</REQUESTDESC>
<REQUESTDATA>
${body}
</REQUESTDATA>
</IMPORTDATA></BODY>
</ENVELOPE>
`;
}

const entry = (ledger: string, amount: number, party = false, bill?: string) => {
  // Negative = debit. ISDEEMEDPOSITIVE is Yes for debits.
  const deb = amount < 0;
  return `<ALLLEDGERENTRIES.LIST>
<LEDGERNAME>${esc(ledger)}</LEDGERNAME>
<ISDEEMEDPOSITIVE>${deb ? "Yes" : "No"}</ISDEEMEDPOSITIVE>${party ? "\n<ISPARTYLEDGER>Yes</ISPARTYLEDGER>" : ""}
<AMOUNT>${amt(amount)}</AMOUNT>${bill ? `
<BILLALLOCATIONS.LIST><NAME>${esc(bill)}</NAME><BILLTYPE>New Ref</BILLTYPE><AMOUNT>${amt(amount)}</AMOUNT></BILLALLOCATIONS.LIST>` : ""}
</ALLLEDGERENTRIES.LIST>`;
};

export type TallyRange = { from: string; to: string };
const inRange = (d: string, r: TallyRange) => d >= r.from && d <= r.to;

export function partyLedger(db: StoneDB, p: Party | undefined) {
  if (!p) return "Cash";
  return tallyOf(db).partyNames[p.id] || p.company || p.name;
}

export function salesXml(db: StoneDB, r: TallyRange) {
  const S = db.settings;
  const T = tallyOf(db);
  const sales = db.sales.filter((s) => inRange(s.date, r));
  const msgs = sales.map((s) => {
    const p = db.parties.find((x) => x.id === s.customerId);
    const t = saleTotals(s, S.state, p?.state ?? S.state);
    const goods = t.taxable - s.freight;
    const blockSale = s.lines.some((l) => l.blockId);
    const total = Math.round(t.total);
    const round = total - (t.taxable + t.tax);
    const items = s.lines.map((l) => {
      const lot = db.lots.find((x) => x.id === l.lotId);
      const b = db.blocks.find((x) => x.id === l.blockId);
      return lot ? `${lot.lotNo} ${lot.variety} ${lot.thicknessMm}mm ${l.sqft} sqft @${l.rate}` : b ? `Block ${b.no} ${b.variety} ${l.sqft} t @${l.rate}` : "";
    }).join("; ");
    const narr = [items, s.vehicleNo && `Vehicle ${s.vehicleNo}`, s.ewayBill && `EWB ${s.ewayBill}`, s.irn && `IRN ${s.irn}`].filter(Boolean).join(" | ");
    return `<TALLYMESSAGE xmlns:UDF="TallyUDF">
<VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Accounting Voucher View">
<DATE>${d8(s.date)}</DATE>
<VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
<VOUCHERNUMBER>${esc(s.invoiceNo)}</VOUCHERNUMBER>
<REFERENCE>${esc(s.invoiceNo)}</REFERENCE>
<PARTYLEDGERNAME>${esc(partyLedger(db, p))}</PARTYLEDGERNAME>
<PARTYGSTIN>${esc(p?.gstin ?? "")}</PARTYGSTIN>
<PLACEOFSUPPLY>${esc(STATES[p?.state ?? S.state] ?? "")}</PLACEOFSUPPLY>
<NARRATION>${esc(narr)}</NARRATION>
<ISINVOICE>No</ISINVOICE>
<PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
${entry(partyLedger(db, p), -total, true, s.invoiceNo)}
${entry(blockSale ? T.blockSalesLedger : T.salesLedger, goods)}
${s.freight ? entry(T.freightLedger, s.freight) : ""}
${t.inter ? entry(T.igstOut, t.igst) : `${entry(T.cgstOut, t.cgst)}\n${entry(T.sgstOut, t.sgst)}`}
${Math.abs(round) >= 0.01 ? entry("Round Off", round) : ""}
</VOUCHER>
</TALLYMESSAGE>`;
  });
  return { xml: envelope("Vouchers", T.company, msgs.join("\n")), count: sales.length };
}

type Purchase = { date: string; no: string; party: Party | undefined; value: number; gst: number; note: string; ledger: string };

export function purchasesOf(db: StoneDB, r: TallyRange): Purchase[] {
  const T = tallyOf(db);
  const party = (id?: string) => db.parties.find((x) => x.id === id);
  const fromBlocks = db.blocks
    .filter((b: Block) => b.source === "purchase" && b.invoiceNo && inRange(b.date, r))
    .map((b) => ({ date: b.date, no: b.invoiceNo, party: party(b.supplierId), value: purchaseValue(b), gst: T.blockGst, note: `Block ${b.no} ${b.variety} ${b.billedTonnes || b.tonnes} t`, ledger: T.purchaseLedger }));
  const fromLots = db.lots
    .filter((l: SlabLot) => l.source === "purchase" && l.invoiceNo && inRange(l.createdAt, r))
    .map((l) => ({ date: l.createdAt, no: l.invoiceNo!, party: party(l.supplierId), value: l.buyValue ?? l.cost, gst: l.gstRate ?? 18, note: `${l.lotNo} ${l.variety} ${l.thicknessMm}mm ${l.sqft} sqft`, ledger: T.purchaseLedger }));
  const st = db.stores ?? { items: [], moves: [] };
  const fromStores = st.moves
    .filter((m) => m.kind === "in" && m.billNo && inRange(m.date, r))
    .map((m) => { const it = st.items.find((x) => x.id === m.itemId); return { date: m.date, no: m.billNo!, party: party(m.supplierId), value: m.qty * m.rate, gst: m.gstRate ?? 18, note: `${it?.name ?? "Item"} ${m.qty} ${it?.unit ?? ""}`, ledger: T.storesLedger }; });
  // One voucher per supplier bill: blocks on the same bill are added together.
  const m = new Map<string, Purchase>();
  for (const x of [...fromBlocks, ...fromLots, ...fromStores]) {
    const k = `${x.party?.id}|${x.no}|${x.gst}|${x.ledger}`;
    const y = m.get(k);
    if (y) { y.value += x.value; y.note += `; ${x.note}`; } else m.set(k, { ...x });
  }
  return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function purchasesXml(db: StoneDB, r: TallyRange) {
  const S = db.settings;
  const T = tallyOf(db);
  const list = purchasesOf(db, r);
  const msgs = list.map((x) => {
    const inter = (x.party?.state ?? S.state) !== S.state;
    const tax = (x.value * x.gst) / 100;
    const total = Math.round(x.value + tax);
    const round = total - (x.value + tax);
    return `<TALLYMESSAGE xmlns:UDF="TallyUDF">
<VOUCHER VCHTYPE="Purchase" ACTION="Create" OBJVIEW="Accounting Voucher View">
<DATE>${d8(x.date)}</DATE>
<VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
<VOUCHERNUMBER>${esc(x.no)}</VOUCHERNUMBER>
<REFERENCE>${esc(x.no)}</REFERENCE>
<REFERENCEDATE>${d8(x.date)}</REFERENCEDATE>
<PARTYLEDGERNAME>${esc(partyLedger(db, x.party))}</PARTYLEDGERNAME>
<PARTYGSTIN>${esc(x.party?.gstin ?? "")}</PARTYGSTIN>
<NARRATION>${esc(x.note)}</NARRATION>
<ISINVOICE>No</ISINVOICE>
<PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
${entry(partyLedger(db, x.party), total, true, x.no)}
${entry(x.ledger, -x.value)}
${inter ? entry(T.igstIn, -tax) : `${entry(T.cgstIn, -tax / 2)}\n${entry(T.sgstIn, -tax / 2)}`}
${Math.abs(round) >= 0.01 ? entry("Round Off", -round) : ""}
</VOUCHER>
</TALLYMESSAGE>`;
  });
  return { xml: envelope("Vouchers", T.company, msgs.join("\n")), count: list.length };
}

/** Ledger masters used by the vouchers. Import first, with "Ignore duplicates" if some already exist. */
export function mastersXml(db: StoneDB, r: TallyRange) {
  const S = db.settings;
  const T = tallyOf(db);
  const used = new Map<string, Party>();
  for (const s of db.sales.filter((x) => inRange(x.date, r))) { const p = db.parties.find((y) => y.id === s.customerId); if (p) used.set(p.id, p); }
  for (const x of purchasesOf(db, r)) if (x.party) used.set(x.party.id, x.party);
  const party = (p: Party) => `<TALLYMESSAGE xmlns:UDF="TallyUDF">
<LEDGER NAME="${esc(partyLedger(db, p))}" ACTION="Create">
<NAME.LIST><NAME>${esc(partyLedger(db, p))}</NAME></NAME.LIST>
<PARENT>${p.kind === "customer" ? "Sundry Debtors" : "Sundry Creditors"}</PARENT>
<ISBILLWISEON>Yes</ISBILLWISEON>
<ADDRESS.LIST><ADDRESS>${esc(p.billing)}</ADDRESS><ADDRESS>${esc(p.city)}</ADDRESS></ADDRESS.LIST>
<LEDSTATENAME>${esc(STATES[p.state] ?? "")}</LEDSTATENAME>
<COUNTRYNAME>India</COUNTRYNAME>
<PINCODE>${esc(p.pincode)}</PINCODE>
<GSTREGISTRATIONTYPE>${p.gstin ? "Regular" : "Unregistered"}</GSTREGISTRATIONTYPE>
<PARTYGSTIN>${esc(p.gstin)}</PARTYGSTIN>
<INCOMETAXNUMBER>${esc(p.pan)}</INCOMETAXNUMBER>
<LEDGERPHONE>${esc(p.phone)}</LEDGERPHONE>
</LEDGER>
</TALLYMESSAGE>`;
  const plain = (name: string, parent: string, extra = "") => `<TALLYMESSAGE xmlns:UDF="TallyUDF">
<LEDGER NAME="${esc(name)}" ACTION="Create">
<NAME.LIST><NAME>${esc(name)}</NAME></NAME.LIST>
<PARENT>${parent}</PARENT>${extra}
</LEDGER>
</TALLYMESSAGE>`;
  const gst = (name: string, head: string) => plain(name, "Duties &amp; Taxes", `\n<TAXTYPE>GST</TAXTYPE>\n<GSTDUTYHEAD>${head}</GSTDUTYHEAD>`);
  const body = [
    ...[...used.values()].map(party),
    plain(T.salesLedger, "Sales Accounts"),
    plain(T.blockSalesLedger, "Sales Accounts"),
    plain(T.purchaseLedger, "Purchase Accounts"),
    plain(T.storesLedger, "Purchase Accounts"),
    plain(T.freightLedger, "Indirect Incomes"),
    plain("Round Off", "Indirect Expenses"),
    gst(T.cgstOut, "Central Tax"), gst(T.sgstOut, "State Tax"), gst(T.igstOut, "Integrated Tax"),
    gst(T.cgstIn, "Central Tax"), gst(T.sgstIn, "State Tax"), gst(T.igstIn, "Integrated Tax"),
  ];
  return { xml: envelope("All Masters", T.company, body.join("\n")), count: used.size };
}

/** Tally figures the owner can choose to show on the dashboard. */
export const TALLY_METRICS: { key: string; label: string }[] = [
  { key: "salesMonth", label: "Sales this month" },
  { key: "salesFy", label: "Sales this financial year" },
  { key: "purchasesMonth", label: "Purchases this month" },
  { key: "expensesMonth", label: "Indirect expenses this month" },
  { key: "receivables", label: "Receivables (Sundry Debtors)" },
  { key: "payables", label: "Payables (Sundry Creditors)" },
  { key: "cashBank", label: "Cash and bank balance" },
  { key: "gstPayable", label: "Duties and taxes balance" },
  { key: "salesTrend", label: "Monthly sales and purchases chart" },
  { key: "topDebtors", label: "Top 5 customers who owe you" },
];
