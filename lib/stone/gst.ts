// e-Invoice (IRP schema 1.1) and e-way bill JSON built from a Karobar360 invoice.
import { checkGstin, saleTotals } from "./calc";
import type { Party, Sale, StoneDB } from "./types";

const ddmmyyyy = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}/${m}/${y}`; };
const r2 = (n: number) => Math.round(n * 100) / 100;
const pin = (s: string | undefined) => Number(String(s ?? "").replace(/\D/g, "").slice(0, 6)) || 0;

/** Sea ports stone exporters ship from: customs code, GST state and pincode (for the e-way bill to the port). */
export const PORTS: { name: string; code: string; state: string; pin: number }[] = [
  { name: "Mundra", code: "INMUN1", state: "24", pin: 370421 },
  { name: "Kandla", code: "INIXY1", state: "24", pin: 370210 },
  { name: "Pipavav", code: "INPAV1", state: "24", pin: 365560 },
  { name: "Hazira", code: "INHZA1", state: "24", pin: 394270 },
  { name: "Nhava Sheva (JNPT)", code: "INNSA1", state: "27", pin: 400707 },
  { name: "Chennai", code: "INMAA1", state: "33", pin: 600001 },
  { name: "Tuticorin", code: "INTUT1", state: "33", pin: 628004 },
  { name: "Kolkata", code: "INCCU1", state: "19", pin: 700001 },
  { name: "Visakhapatnam", code: "INVTZ1", state: "37", pin: 530035 },
  { name: "Cochin", code: "INCOK1", state: "32", pin: 682001 },
];
export const portOf = (name?: string) => PORTS.find((p) => name && name.toLowerCase().startsWith(p.name.toLowerCase().split(" ")[0]));

const ISO: Record<string, string> = {
  "united arab emirates": "AE", uae: "AE", "saudi arabia": "SA", qatar: "QA", oman: "OM", kuwait: "KW", bahrain: "BH", nepal: "NP", bangladesh: "BD", "sri lanka": "LK",
  maldives: "MV", mauritius: "MU", "united states": "US", usa: "US", "united kingdom": "GB", uk: "GB", australia: "AU", canada: "CA", singapore: "SG", malaysia: "MY",
  vietnam: "VN", italy: "IT", turkey: "TR", greece: "GR", spain: "ES", egypt: "EG", kenya: "KE", "south africa": "ZA",
};

type Line = { desc: string; hsn: string; qty: number; unit: string; rate: number; amount: number; service: boolean };

function lines(db: StoneDB, s: Sale): Line[] {
  const out: Line[] = s.lines.map((l) => {
    const lot = db.lots.find((x) => x.id === l.lotId);
    const b = db.blocks.find((x) => x.id === l.blockId);
    if (b) return { desc: `${b.variety} ${b.stoneType} block ${b.no}`.slice(0, 300), hsn: s.hsn, qty: l.sqft, unit: "TON", rate: l.rate, amount: l.sqft * l.rate, service: false };
    return { desc: `${lot?.variety ?? ""} ${lot?.stoneType ?? ""} slabs ${lot?.thicknessMm ?? ""}mm ${lot?.finish ?? ""} lot ${lot?.lotNo ?? ""}`.replace(/\s+/g, " ").trim().slice(0, 300), hsn: s.hsn, qty: l.sqft, unit: "SQF", rate: l.rate, amount: l.sqft * l.rate, service: false };
  });
  if (s.freight > 0) out.push({ desc: "Freight and cartage", hsn: "996511", qty: 1, unit: "OTH", rate: s.freight, amount: s.freight, service: true });
  return out;
}

export function checks(db: StoneDB, s: Sale, p: Party | undefined, kind: "einv" | "ewb"): string[] {
  const S = db.settings;
  const out: string[] = [];
  if (!S.gstin || !checkGstin(S.gstin).ok) out.push("Your company GSTIN is missing or wrong (Settings).");
  if (!pin(S.pincode)) out.push("Your company pincode is missing (Settings).");
  if (!S.address) out.push("Your company address is missing (Settings).");
  if (!p) out.push("Choose a customer.");
  if (p?.intl) {
    if (!p.country) out.push("The customer’s country is missing (Customers).");
    if (kind === "ewb" && !portOf(s.port)) out.push("Pick the port of loading.");
  } else {
    if (kind === "einv" && p && (!p.gstin || !checkGstin(p.gstin).ok)) out.push("e-Invoices are for registered buyers: the customer’s GSTIN is missing or wrong.");
    if (p && !pin(p.pincode)) out.push("The customer’s pincode is missing (Customers).");
  }
  if (p && !p.billing) out.push("The customer’s address is missing (Customers).");
  if (kind === "ewb") {
    if (!s.vehicleNo) out.push("Enter the vehicle number.");
    if (!s.distanceKm) out.push("Enter the distance in km.");
  }
  return out;
}

/** One invoice in the IRP format. Upload a list of these through a GSP, or the IRP bulk tool. */
export function eInvoice(db: StoneDB, s: Sale) {
  const S = db.settings;
  const p = db.parties.find((x) => x.id === s.customerId);
  const t = saleTotals(s, S.state, p?.state ?? S.state);
  const ls = lines(db, s);
  const tr = db.parties.find((x) => x.id === s.transporterId);
  const total = Math.round(t.total);
  return {
    Version: "1.1",
    TranDtls: { TaxSch: "GST", SupTyp: p?.intl ? (s.gstRate > 0 ? "EXPWP" : "EXPWOP") : "B2B", RegRev: "N", EcmGstin: null, IgstOnIntra: "N" },
    DocDtls: { Typ: "INV", No: s.invoiceNo.slice(0, 16), Dt: ddmmyyyy(s.date) },
    SellerDtls: { Gstin: S.gstin, LglNm: S.company, TrdNm: S.company, Addr1: S.address.slice(0, 100) || S.city, Loc: S.city, Pin: pin(S.pincode), Stcd: S.state, Ph: (S.phone || "").replace(/\D/g, "").slice(-10) || null, Em: null },
    BuyerDtls: p?.intl
      ? { Gstin: "URP", LglNm: p.company, TrdNm: p.company, Pos: "96", Addr1: (p.billing || p.city || p.country || "").slice(0, 100), Loc: (p.city || p.country || "").slice(0, 50), Pin: 999999, Stcd: "96", Ph: null, Em: p.email || null }
      : { Gstin: p?.gstin ?? "", LglNm: p?.company ?? "", TrdNm: p?.company ?? "", Pos: p?.state ?? S.state, Addr1: (p?.billing || p?.city || "").slice(0, 100), Loc: p?.city ?? "", Pin: pin(p?.pincode), Stcd: p?.state ?? S.state, Ph: (p?.phone || "").replace(/\D/g, "").slice(-10) || null, Em: p?.email || null },
    ItemList: ls.map((l, i) => {
      const tax = (l.amount * s.gstRate) / 100;
      return {
        SlNo: String(i + 1), PrdDesc: l.desc, IsServc: l.service ? "Y" : "N", HsnCd: l.hsn, Qty: r2(l.qty), Unit: l.unit, UnitPrice: r2(l.rate),
        TotAmt: r2(l.amount), Discount: 0, AssAmt: r2(l.amount), GstRt: s.gstRate,
        IgstAmt: t.inter ? r2(tax) : 0, CgstAmt: t.inter ? 0 : r2(tax / 2), SgstAmt: t.inter ? 0 : r2(tax / 2), CesRt: 0, CesAmt: 0, CesNonAdvlAmt: 0, StateCesRt: 0, StateCesAmt: 0, StateCesNonAdvlAmt: 0, OthChrg: 0,
        TotItemVal: r2(l.amount + tax),
      };
    }),
    ...(p?.intl ? { ExpDtls: { ShipBNo: s.sbNo || null, ShipBDt: null, Port: portOf(s.port)?.code ?? null, RefClm: s.gstRate > 0 ? "Y" : "N", ForCur: null, CntCode: ISO[(p.country ?? "").trim().toLowerCase()] ?? null, ExpDuty: null } } : {}),
    ValDtls: { AssVal: r2(t.taxable), CgstVal: r2(t.cgst), SgstVal: r2(t.sgst), IgstVal: r2(t.igst), CesVal: 0, StCesVal: 0, Discount: 0, OthChrg: 0, RndOffAmt: r2(total - t.total), TotInvVal: total },
    ...(s.vehicleNo && s.distanceKm ? { EwbDtls: { TransId: tr?.gstin || null, TransName: tr?.company || null, Distance: Math.round(s.distanceKm), TransDocNo: null, TransDocDt: null, VehNo: s.vehicleNo.replace(/\s/g, ""), VehType: "R", TransMode: "1" } } : {}),
  };
}

/** e-Way bill for invoices that do not go through e-invoicing (NIC e-way bill JSON fields). */
export function eWayBill(db: StoneDB, s: Sale) {
  const S = db.settings;
  const p = db.parties.find((x) => x.id === s.customerId);
  const t = saleTotals(s, S.state, p?.state ?? S.state);
  const tr = db.parties.find((x) => x.id === s.transporterId);
  const goods = lines(db, s).filter((l) => !l.service);
  const port = p?.intl ? portOf(s.port) : undefined;
  const half = s.gstRate / 2;
  return {
    version: "1.0.0621",
    billLists: [{
      userGstin: S.gstin, supplyType: "O", subSupplyType: p?.intl ? 3 : 1, subSupplyDesc: "", docType: "INV", docNo: s.invoiceNo, docDate: ddmmyyyy(s.date),
      fromGstin: S.gstin, fromTrdName: S.company, fromAddr1: S.address, fromAddr2: "", fromPlace: S.city, fromPincode: pin(S.pincode), fromStateCode: Number(S.state), actFromStateCode: Number(S.state),
      ...(p?.intl
        // Exports move to the port: the buyer is abroad (state 99), the goods go to the port's state and pincode.
        ? { toGstin: "URP", toTrdName: p.company, toAddr1: `${port?.name ?? ""} port`, toAddr2: "", toPlace: port?.name ?? "", toPincode: port?.pin ?? 0, toStateCode: 99, actToStateCode: Number(port?.state ?? S.state) }
        : { toGstin: p?.gstin || "URP", toTrdName: p?.company ?? "", toAddr1: p?.billing ?? "", toAddr2: "", toPlace: p?.city ?? "", toPincode: pin(p?.pincode), toStateCode: Number(p?.state ?? S.state), actToStateCode: Number(p?.state ?? S.state) }),
      transactionType: 1, otherValue: 0,
      totalValue: r2(t.taxable), cgstValue: r2(t.cgst), sgstValue: r2(t.sgst), igstValue: r2(t.igst), cessValue: 0, cessNonAdvolValue: 0, totInvValue: Math.round(t.total),
      transporterId: tr?.gstin ?? "", transporterName: tr?.company ?? "", transDocNo: "", transMode: 1, transDistance: Math.round(s.distanceKm ?? 0), transDocDate: "",
      vehicleNo: (s.vehicleNo || "").replace(/\s/g, ""), vehicleType: "R",
      itemList: goods.map((l, i) => ({
        itemNo: i + 1, productName: l.desc.slice(0, 100), productDesc: l.desc.slice(0, 100), hsnCode: Number(l.hsn), quantity: r2(l.qty), qtyUnit: l.unit,
        taxableAmount: r2(l.amount + (i === 0 ? s.freight : 0)), sgstRate: t.inter ? 0 : half, cgstRate: t.inter ? 0 : half, igstRate: t.inter ? s.gstRate : 0, cessRate: 0, cessNonAdvol: 0,
      })),
    }],
  };
}
