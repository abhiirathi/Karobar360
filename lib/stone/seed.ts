import { baseCost, cbm, gstinCheckChar, spreadDamage } from "./calc";
import { presetModules } from "./modules";
import { slabNo, syncLot } from "./slabs";
import { autoLines, emptyJobBlock } from "./jobwork";
import type { StoreItem, StoreMove, Block, DamageEvent, JobBlock, JobOrder, MineCost, Party, Sale, SawJob, Shipment, SlabLot, StoneDB, StoneSettings } from "./types";

// Sample company: a gang-saw unit in Kishangarh with its own quarry near Rajsamand.
// Every figure is sample data, built relative to today so the screens always look current.

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const gst = (st: string, pan: string, ent = "1") => {
  const f = `${st}${pan}${ent}Z`;
  return f + gstinCheckChar(f);
};

export const DEFAULT_SETTINGS: StoneSettings = {
  company: "Shree Shyam Marbles",
  gstin: gst("08", "AAKFS4821K"),
  address: "Plot 14, RIICO Industrial Area, Phase II",
  city: "Kishangarh, Ajmer",
  state: "08",
  phone: "",
  invoicePrefix: "SSM/26-27/",
  royaltyPerTonne: 320,
  dmftPct: 10,
  density: 2.7,
  powerRate: 8.5,
  sawKw: 75,
  bladePerSqft: 3,
  resinPerSqft: 2.5,
  nettingPerSqft: 1.5,
  polishPerSqft: 4,
  labourPerSqft: 2,
  ownMines: ["Morwad quarry, Rajsamand"],
  machines: ["Gang saw 1", "Gang saw 2", "Block cutter", "Multi-wire saw"],
};

const blank = (): Omit<Party, "id" | "kind" | "name" | "company"> => ({
  gstin: "", pan: "", phone: "", whatsapp: "", email: "", billing: "", city: "", state: "08", pincode: "", shipping: "", contact: "",
  creditDays: 0, creditLimit: 0, bank: "", notes: "", createdAt: "",
});

export function emptyBlock(): Block {
  return {
    id: "", no: "", variety: "", stoneType: "marble", source: "purchase", supplierId: "", mine: "", leaseNo: "", date: "",
    l: 0, w: 0, h: 0, tonnes: 0, billedTonnes: 0, weighSlip: "", rate: 0, rateBasis: "tonne", royalty: 0, dmft: 0,
    eRawanna: "", ewayBill: "", invoiceNo: "", vehicleNo: "", driver: "", driverPhone: "", transporterId: "", freight: 0,
    loading: 0, otherCost: 0, importCost: 0, shipmentId: "", grade: "A", defects: "", photos: [], status: "godown",
    receivedOn: "", damageAlloc: 0, notes: "",
  };
}

export function emptyParty(kind: Party["kind"]): Party {
  return { id: "", kind, name: "", company: "", ...blank() };
}

export function emptyShipment(dir: "import" | "export"): Shipment {
  return {
    id: "", dir, kind: "blocks", partyName: "", country: "", variety: "", stoneType: "marble", blNo: "", blDate: "", line: "",
    vessel: "", voyage: "", pol: "", pod: "", containers: [], pieces: 0, tonnes: 0, cbm: 0, sqm: 0, thicknessMm: 18,
    cifUsd: 0, fx: 88, beNo: "", beDate: "", duty: 0, igst: 0, cha: 0, port: 0, inland: 0, eta: "", arrived: "", freeDays: 14,
    status: "booked", blFile: null, notes: "", receivedIds: [],
  };
}

export function seed(): StoneDB {
  const r = rng(26);
  const now = new Date();
  const day = (offset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  const ago = (d: string) => Math.floor((now.getTime() - new Date(d).getTime()) / 86400000);
  const S = { ...DEFAULT_SETTINGS, pincode: "305801" };
  const mine = S.ownMines[0];

  const party = (id: string, kind: Party["kind"], company: string, name: string, extra: Partial<Party>): Party => ({
    ...emptyParty(kind), id, company, name, createdAt: day(-200), ...extra,
  });

  const parties: Party[] = [
    party("s1", "supplier", "Makrana Marble Udyog", "Ramesh Kumawat", { gstin: gst("08", "AAHFM2290P"), pan: "AAHFM2290P", city: "Makrana, Nagaur", billing: "Station Road", pincode: "341505", creditDays: 15, mines: ["Ulodi quarry, Makrana", "Dungri quarry, Makrana"] }),
    party("s2", "supplier", "Agariya Stone Supply", "Bhanwar Lal Gurjar", { gstin: gst("08", "ABQPG7713D"), pan: "ABQPG7713D", city: "Agariya, Rajsamand", billing: "Mine area, Agariya", pincode: "313324", creditDays: 7, mines: ["Agariya"] }),
    party("s3", "supplier", "Rishabh Green Minerals", "Mahesh Jain", { gstin: gst("08", "AAFFR5106H"), pan: "AAFFR5106H", city: "Rishabhdev, Udaipur", billing: "NH-48, Kesariyaji", pincode: "313802", creditDays: 30, mines: ["Kesariyaji"] }),
    party("s4", "supplier", "Jalore Granite Quarries", "Sohan Singh Deora", { gstin: gst("08", "AAGFJ3348M"), pan: "AAGFJ3348M", city: "Jalore", billing: "Granite area, Bhinmal Road", pincode: "343001", creditDays: 15, mines: ["Bhinmal Road"] }),
    party("s6", "supplier", "Anatolia Natural Stone Ltd.", "Mehmet Yilmaz", { intl: true, country: "Turkey", state: "96", city: "Burdur", billing: "Organize Sanayi Bölgesi", creditDays: 0 }),
    party("v1", "vendor", "Morwad Diesel Point", "Pradeep Paliwal", { gstin: gst("08", "AAPFM5521D"), pan: "AAPFM5521D", city: "Morwad, Rajsamand", billing: "Nathdwara Road", pincode: "313324", creditDays: 15, notes: "Diesel for the excavator, loader and DG set" }),
    party("v2", "vendor", "Rajsamand Earthmovers", "Dinesh Gurjar", { gstin: gst("08", "ABBFR7730E"), pan: "ABBFR7730E", city: "Rajsamand", billing: "Kankroli bypass", pincode: "313326", creditDays: 30, notes: "Hydra crane and excavator on hire, servicing" }),
    party("g1", "godown", "Main yard", "", { billing: "Plot 14, RIICO Phase II", city: "Kishangarh, Ajmer" }),
    party("g2", "godown", "Godown 2", "", { billing: "Plot 31, RIICO Phase III", city: "Kishangarh, Ajmer" }),
    party("m1", "mine", "Morwad quarry, Rajsamand", "", { leaseNo: "ML 41/2009", city: "Morwad, Rajsamand" }),
    ...([["Morwad White", "marble"], ["Makrana Albeta", "marble"], ["Agariya White", "marble"], ["Udaipur Green", "marble"], ["Jalore Rosy Pink", "granite"], ["Burdur Beige", "marble"], ["Carrara White", "marble"]] as const)
      .map(([q, st], i) => party(`q${i + 1}`, "quality", q, "", { stoneType: st })),
    party("s5", "vendor", "Kishangarh Stone Chemicals", "Naveen Agarwal", { gstin: gst("08", "AAPFK6604Q"), pan: "AAPFK6604Q", city: "Kishangarh, Ajmer", billing: "Marble Mandi Road", pincode: "305801", creditDays: 30 }),
    party("t1", "transporter", "Shri Balaji Roadlines", "Gopal Choudhary", { city: "Kishangarh, Ajmer", billing: "Transport Nagar", pincode: "305801" }),
    party("t2", "transporter", "Mewar Trailer Service", "Kalu Ram Meena", { city: "Rajsamand", billing: "Kankroli bypass", pincode: "313326" }),
    party("c1", "customer", "Sharma Tiles & Marble House", "Vikas Sharma", { gstin: gst("08", "ABCFS6620R"), pan: "ABCFS6620R", city: "Jaipur", billing: "Tonk Road, Sanganer", pincode: "302029", creditDays: 30, creditLimit: 1500000, contact: "Vikas Sharma" }),
    party("c2", "customer", "Gupta Stone Gallery", "Anil Gupta", { gstin: gst("07", "AAJFG1187C"), pan: "AAJFG1187C", city: "New Delhi", state: "07", billing: "Sultanpur, MG Road", pincode: "110030", creditDays: 45, creditLimit: 2500000, contact: "Rohit Gupta" }),
    party("c3", "customer", "Shivam Infra Projects", "Hardik Patel", { gstin: gst("24", "AAQCS4410N"), pan: "AAQCS4410N", city: "Ahmedabad", state: "24", billing: "SG Highway, Thaltej", pincode: "380059", creditDays: 60, creditLimit: 4000000, shipping: "Site: Shivam Heights, Gota, Ahmedabad", contact: "Site engineer: Nirav Shah" }),
    party("c5", "customer", "Al Noor Building Materials LLC", "Imran Qureshi", { intl: true, country: "United Arab Emirates", state: "96", city: "Dubai", billing: "Al Quoz Industrial Area 3", pincode: "", phone: "+971 50 412 7788", whatsapp: "+971504127788", creditDays: 60, creditLimit: 5000000, pan: "100384920600003" }),
    party("c4", "customer", "Krishna Interiors", "Pooja Agarwal", { gstin: gst("08", "BXKPA9921L"), pan: "BXKPA9921L", city: "Ajmer", billing: "Vaishali Nagar", pincode: "305004", creditDays: 15, creditLimit: 500000 }),
    party("c6", "customer", "Rathore Marble Traders", "Devendra Singh Rathore", { gstin: gst("08", "AAKFR3307M"), pan: "AAKFR3307M", city: "Kishangarh, Ajmer", billing: "Marble Mandi, Gate 4", pincode: "305801", creditDays: 15, creditLimit: 300000, contact: "Devendra Singh" }),
  ];

  const blocks: Block[] = [];
  const mk = (p: Partial<Block>): Block => {
    const b: Block = { ...JSON.parse(JSON.stringify(emptyBlockStatic)), id: `b${blocks.length + 1}`, ...p };
    if (!b.billedTonnes) b.billedTonnes = b.tonnes;
    if (!b.royalty && b.source !== "import") b.royalty = Math.round(b.billedTonnes * S.royaltyPerTonne);
    if (!b.dmft && b.source !== "import") b.dmft = Math.round((b.royalty * S.dmftPct) / 100);
    blocks.push(b);
    return b;
  };

  // Own quarry: 7 blocks a month for the last three months.
  const vehiclesOwn = ["RJ 30 GA 4417", "RJ 30 GB 1290", "RJ 27 GC 0832"];
  for (let i = 0; i < 21; i++) {
    const off = i >= 19 ? -2 + (i - 19) : i === 18 ? -3 : -86 + i * 4 + Math.floor(r() * 3);
    const l = 220 + Math.round(r() * 60), w = 130 + Math.round(r() * 30), h = 120 + Math.round(r() * 30);
    const t = Math.round(((l * w * h) / 1e6) * S.density * 100) / 100;
    const date = day(off);
    const a = ago(date);
    mk({
      no: `MW-${String(212 + i)}`, variety: "Morwad White", stoneType: "marble", source: "own_mine", mine, leaseNo: "ML 41/2009", date,
      l, w, h, tonnes: t, billedTonnes: t, rate: 6100, rateBasis: "tonne", eRawanna: a < 3 ? "" : `ER${String(5310200 + i * 37)}`,
      vehicleNo: a < 3 ? "" : vehiclesOwn[i % 3], transporterId: "t2", freight: a < 3 ? 0 : Math.round(t * 520), loading: a < 3 ? 0 : 1800,
      grade: r() > 0.8 ? "B" : "A", weighSlip: a < 5 ? "" : `WB-${7700 + i}`,
      status: a < 5 ? "at_mine" : a < 30 ? "godown" : "processed",
      receivedOn: a < 5 ? "" : day(off + 2),
    });
  }

  // Purchased blocks.
  const albeta1 = mk({ no: "MK-A-0917", variety: "Makrana Albeta", source: "purchase", supplierId: "s1", mine: "Ulodi quarry, Makrana", date: day(-52), l: 210, w: 140, h: 125, tonnes: 9.8, billedTonnes: 10.1, rate: 32000, vehicleNo: "RJ 21 GB 7712", transporterId: "t1", freight: 6200, loading: 2400, invoiceNo: "MMU/1182", purchaseId: "pb1", eRawanna: "ER5288731", ewayBill: "4718 2290 1132", weighSlip: "WB-7581", status: "processed", receivedOn: day(-51) });
  mk({ no: "MK-A-0918", variety: "Makrana Albeta", source: "purchase", supplierId: "s1", mine: "Ulodi quarry, Makrana", date: day(-52), l: 195, w: 135, h: 120, tonnes: 8.6, billedTonnes: 8.6, rate: 32000, vehicleNo: "RJ 21 GB 7712", transporterId: "t1", freight: 5400, loading: 2400, invoiceNo: "MMU/1182", purchaseId: "pb1", eRawanna: "ER5288732", ewayBill: "4718 2290 1132", weighSlip: "WB-7581", status: "godown", receivedOn: day(-51) });

  const ag = [
    mk({ no: "AG-3301", variety: "Agariya White", source: "purchase", supplierId: "s2", mine: "Agariya", date: day(-19), l: 260, w: 150, h: 140, tonnes: 14.4, billedTonnes: 15.4, rate: 3200, vehicleNo: "RJ 30 GA 9054", transporterId: "t2", freight: 7400, loading: 2000, invoiceNo: "ASS/774", purchaseId: "pb2", eRawanna: "ER5341102", ewayBill: "5120 6634 0918", weighSlip: "WB-7802", status: "godown", receivedOn: day(-18) }),
    mk({ no: "AG-3302", variety: "Agariya White", source: "purchase", supplierId: "s2", mine: "Agariya", date: day(-19), l: 240, w: 145, h: 130, tonnes: 12.2, billedTonnes: 12.2, rate: 3200, vehicleNo: "RJ 30 GA 9054", transporterId: "t2", freight: 6100, loading: 2000, invoiceNo: "ASS/774", purchaseId: "pb2", eRawanna: "ER5341103", ewayBill: "5120 6634 0918", weighSlip: "WB-7802", status: "processed", receivedOn: day(-18) }),
    mk({ no: "AG-3303", variety: "Agariya White", source: "purchase", supplierId: "s2", mine: "Agariya", date: day(-19), l: 230, w: 140, h: 120, tonnes: 10.4, billedTonnes: 10.4, rate: 3200, vehicleNo: "RJ 30 GA 9054", transporterId: "t2", freight: 5200, loading: 2000, invoiceNo: "ASS/774", purchaseId: "pb2", eRawanna: "ER5341104", ewayBill: "5120 6634 0918", weighSlip: "WB-7802", status: "written_off", defects: "Cracked through the middle while unloading from trolley", receivedOn: day(-18) }),
  ];
  mk({ no: "UG-118", variety: "Udaipur Green", source: "purchase", supplierId: "s3", mine: "Kesariyaji", date: day(-9), l: 200, w: 130, h: 115, tonnes: 8.1, billedTonnes: 8.4, rate: 9000, vehicleNo: "RJ 27 GD 3341", transporterId: "t2", freight: 5600, loading: 1800, invoiceNo: "RGM/2207", purchaseId: "pb3", eRawanna: "", ewayBill: "6011 2093 4471", weighSlip: "WB-7866", status: "godown", receivedOn: day(-8), notes: "Rawanna copy not received with the vehicle" });
  mk({ no: "UG-119", variety: "Udaipur Green", source: "purchase", supplierId: "s3", mine: "Kesariyaji", date: day(-2), l: 210, w: 135, h: 120, tonnes: 0, billedTonnes: 9.2, rate: 9000, vehicleNo: "RJ 27 GD 3341", transporterId: "t2", freight: 5900, invoiceNo: "RGM/2231", purchaseId: "pb4", eRawanna: "ER5350417", ewayBill: "6011 2093 5102", status: "godown" });
  const jal = mk({ no: "JL-RP-552", variety: "Jalore Rosy Pink", stoneType: "granite", source: "purchase", supplierId: "s4", mine: "Bhinmal Road", date: day(-61), l: 280, w: 160, h: 150, tonnes: 18.1, billedTonnes: 18.1, rate: 3800, vehicleNo: "RJ 16 GA 6620", transporterId: "t1", freight: 14400, loading: 3000, invoiceNo: "JGQ/091", purchaseId: "pb5", eRawanna: "ER5270036", ewayBill: "3907 1150 8806", weighSlip: "WB-7524", status: "processed", receivedOn: day(-59) });

  // Imports: Turkish beige blocks (received) — landed cost shared by CBM.
  const shipments: Shipment[] = [];
  const ship = (p: Partial<Shipment>): Shipment => {
    const s: Shipment = { ...JSON.parse(JSON.stringify(emptyShipStatic)), id: `sh${shipments.length + 1}`, ...p };
    shipments.push(s);
    return s;
  };
  const tr = ship({
    dir: "import", kind: "blocks", partyName: "Anatolia Natural Stone Ltd.", country: "Turkey", variety: "Burdur Beige", blNo: "MEDUMR418827", blDate: day(-48),
    line: "MSC", vessel: "MSC Aurora", voyage: "QX617R", pol: "Mersin, Turkey", pod: "Mundra, India",
    containers: [{ no: "MSCU 418226 1", seal: "TR0099172", size: "20' open top", grossKg: 26100 }, { no: "MEDU 772031 5", seal: "TR0099173", size: "20' open top", grossKg: 25900 }],
    pieces: 3, tonnes: 52, cbm: 19.26, terms: "CIF", cifUsd: 15600, fx: 87.9, beNo: "4821937", beDate: day(-27), duty: 548000, igst: 96000, cha: 18500, port: 41200, inland: 92000,
    eta: day(-30), arrived: day(-30), freeDays: 14, status: "received",
  });
  const trTotal = tr.cifUsd * tr.fx + tr.duty + tr.cha + tr.port + tr.inland;
  const trBlocks = [
    { l: 290, w: 175, h: 140, t: 19.2 },
    { l: 270, w: 165, h: 135, t: 16.4 },
    { l: 255, w: 160, h: 145, t: 16.4 },
  ];
  const trVol = trBlocks.reduce((a, b) => a + (b.l * b.w * b.h) / 1e6, 0);
  trBlocks.forEach((x, i) => {
    const b = mk({
      no: `TR-BB-${41 + i}`, variety: "Burdur Beige", source: "import", shipmentId: tr.id, supplierId: "s6", purchaseId: "pi1", invoiceNo: "ANS-2026-118", mine: "Turkey",
      imp: { blNo: tr.blNo, blDate: tr.blDate, vessel: tr.vessel, port: "Mundra", cif: Math.round(tr.cifUsd * tr.fx), charges: [{ label: "Customs duty", amount: tr.duty, note: `BE ${tr.beNo}` }, { label: "CHA charges", amount: tr.cha, note: "" }, { label: "Port, CFS & line charges", amount: tr.port, note: "" }, { label: "Freight port to yard", amount: tr.inland, note: "Mundra to Kishangarh" }] }, date: day(-24), l: x.l, w: x.w, h: x.h,
      tonnes: x.t, billedTonnes: x.t, rate: 0, rateBasis: "cbm", importCost: Math.round((trTotal * ((x.l * x.w * x.h) / 1e6)) / trVol),
      vehicleNo: "GJ 12 BW 4410", status: i === 0 ? "processed" : "godown", receivedOn: day(-24),
    });
    tr.receivedIds.push(b.id);
  });

  const it = ship({
    dir: "import", kind: "slabs", partyName: "Apuana Marmi S.r.l.", country: "Italy", variety: "Carrara White", blNo: "HLCUGOA260911", blDate: day(-70),
    line: "Hapag-Lloyd", vessel: "Seaspan Calypso", voyage: "2611E", pol: "La Spezia, Italy", pod: "Mundra, India",
    containers: [{ no: "HLXU 300418 2", seal: "IT55120", size: "20' standard", grossKg: 24400 }], pieces: 96, tonnes: 22.1, sqm: 430, thicknessMm: 18,
    terms: "CIF", cifUsd: 21500, fx: 87.4, beNo: "4630552", beDate: day(-44), duty: 702000, igst: 133000, cha: 16000, port: 28400, inland: 61000,
    eta: day(-47), arrived: day(-47), freeDays: 14, status: "received",
  });
  ship({
    dir: "import", kind: "blocks", partyName: "Hellenic Marble Quarries S.A.", country: "Greece", variety: "Volakas White", blNo: "MAEU245118872", blDate: day(-29),
    line: "Maersk", vessel: "Maersk Kowloon", voyage: "243W", pol: "Thessaloniki, Greece", pod: "Mundra, India",
    containers: [{ no: "MRKU 551902 4", seal: "GR77101", size: "20' open top", grossKg: 33400 }, { no: "MSKU 610228 9", seal: "GR77102", size: "20' open top", grossKg: 32900 }],
    pieces: 4, tonnes: 66, cbm: 24.4, terms: "FOB", fobUsd: 20400, freightUsd: 2450, insuranceUsd: 250, cifUsd: 23100, forwarder: "Seahorse Shipping & Logistics, Ahmedabad", bookingNo: "MAEU-BKG-7781204", fx: 88.2, eta: day(-9), arrived: day(-9), freeDays: 14, status: "customs",
    notes: "CHA filed bill of entry; first check pending",
  });
  ship({
    dir: "import", kind: "slabs", partyName: "Granitos do Espírito Santo Ltda.", country: "Brazil", variety: "Taj Mahal Quartzite", stoneType: "quartzite", blNo: "CMDUVIX0882103", blDate: day(-18),
    line: "CMA CGM", vessel: "CMA CGM Tage", voyage: "0FR6KW1MA", pol: "Vitória, Brazil", pod: "Nhava Sheva, India",
    containers: [{ no: "CMAU 812046 0", seal: "BR301877", size: "20' standard", grossKg: 23800 }], pieces: 44, tonnes: 21.4, sqm: 236, thicknessMm: 20,
    terms: "FOB", fobUsd: 29600, freightUsd: 3100, insuranceUsd: 300, cifUsd: 33000, forwarder: "Allcargo Logistics, Mumbai", bookingNo: "CMA-BKG-0882103", fx: 88.4, eta: day(12), freeDays: 10, status: "sailing",
  });
  ship({
    dir: "import", kind: "blocks", partyName: "Levantina Natural Stone S.A.", country: "Spain", variety: "Crema Marfil", blNo: "", blDate: "",
    line: "MSC", vessel: "", voyage: "", pol: "Valencia, Spain", pod: "Mundra, India", containers: [], pieces: 3, tonnes: 54, cbm: 20,
    terms: "FOB", fobUsd: 17800, freightUsd: 2600, insuranceUsd: 200, cifUsd: 20600, forwarder: "Seahorse Shipping & Logistics, Ahmedabad", bookingNo: "MSC-BKG-5521830", fx: 88.3,
    eta: day(34), freeDays: 14, status: "booked", notes: "Blocks inspected at the quarry on video call. Supplier loads in 10 days.",
  });
  ship({
    dir: "export", kind: "slabs", partyName: "Al Noor Building Materials LLC", country: "UAE", variety: "Morwad White", blNo: "ONEYMUN9X1182", blDate: day(-6),
    line: "ONE", vessel: "ONE Harmony", voyage: "077W", pol: "Mundra, India", pod: "Jebel Ali, UAE",
    containers: [{ no: "ONEU 019922 7", seal: "IN440921", size: "20' standard", grossKg: 25100 }], pieces: 120, tonnes: 23.5, sqm: 520, thicknessMm: 18,
    terms: "CIF", fobUsd: 14200, freightUsd: 1250, insuranceUsd: 150, cifUsd: 15600, forwarder: "JM Baxi Freight, Mundra", bookingNo: "ONE-BKG-3301877", fx: 88.1, beNo: "SB 7718402", beDate: day(-8), eta: day(3), freeDays: 0, status: "sailing",
  });

  // Damage: one Agariya block cracked while unloading the trolley. Its cost is spread on the two that survived.
  const dmgLines = [{ blockId: ag[2].id, loss: Math.round(baseCost(ag[2])), writeOff: true }];
  const dmg: DamageEvent = { id: "d1", date: day(-18), vehicleNo: "RJ 30 GA 9054", cause: "Block slipped from the trolley during unloading by hydra; cracked through", lines: dmgLines, extra: 6500, recovery: 0, basis: "tonne", spreadIds: [ag[0].id, ag[1].id], alloc: {} };
  dmg.alloc = spreadDamage(blocks, dmg);
  for (const [id, v] of Object.entries(dmg.alloc)) {
    const b = blocks.find((x) => x.id === id)!;
    b.damageAlloc += v;
  }

  // Mine running costs for the last three months.
  const mineCosts: MineCost[] = [];
  const cost = (date: string, cat: MineCost["cat"], machine: string, qty: number, unit: string, rate: number, note = "", vendorId = "") =>
    mineCosts.push({ id: `mc${mineCosts.length + 1}`, date, mine, cat, machine, qty, unit, rate, amount: Math.round(qty * rate), note, vendorId });
  for (let wk = 0; wk < 13; wk++) {
    const d = day(-88 + wk * 7);
    const j = 0.85 + r() * 0.3;
    cost(d, "diesel", "Excavator (PC-210)", Math.round(220 * j), "L", 94, "", "v1");
    cost(d, "diesel", "Wheel loader", Math.round(90 * j), "L", 94, "", "v1");
    cost(d, "diesel", "Compressor & DG set", Math.round(60 * j), "L", 94, "", "v1");
    cost(d, "machine", "Hydra crane", Math.round(10 * j), "hours", 1200, "", "v2");
    cost(d, "loading", "Hydra crane", Math.round(5 * j), "trips", 1500, "Loading blocks into trucks");
    cost(d, "power", "Wire saw machines", Math.round(1150 * j), "kWh", 8.5);
    cost(d, "wire", "Diamond wire", Math.round(7 * j * 10) / 10, "m", 3200, "Plastic-coated, 11 mm beads");
    cost(d, "labour", "Quarry crew", Math.round(46 * j), "man-days", 650);
    if (wk % 2 === 0) cost(d, "tools", "Drill rods, bits, wedges", 1, "lot", Math.round(11000 * j));
    if (wk % 4 === 1) cost(d, "maintenance", "Excavator service", 1, "job", Math.round(16000 * j), "", "v2");
  }
  cost(day(-60), "rent", "Dead rent (quarterly)", 1, "qtr", 42000);
  // Own-quarry blocks carry that month's extraction cost per tonne.
  const perMonth: Record<string, { amt: number; t: number }> = {};
  for (const c of mineCosts) (perMonth[c.date.slice(0, 7)] ??= { amt: 0, t: 0 }).amt += c.amount;
  for (const b of blocks.filter((x) => x.source === "own_mine")) (perMonth[b.date.slice(0, 7)] ??= { amt: 0, t: 0 }).t += b.tonnes;
  for (const b of blocks.filter((x) => x.source === "own_mine")) {
    const m = perMonth[b.date.slice(0, 7)];
    if (m && m.t) b.rate = Math.round(m.amt / m.t);
  }

  // Sawing jobs and slab lots for every block marked sawn.
  const jobs: SawJob[] = [];
  const lots: SlabLot[] = [];
  const YIELD: Record<string, number> = { "Morwad White": 124, "Makrana Albeta": 112, "Agariya White": 128, "Jalore Rosy Pink": 104, "Burdur Beige": 119 };
  const LIST: Record<string, number> = { "Morwad White": 95, "Makrana Albeta": 430, "Agariya White": 62, "Jalore Rosy Pink": 78, "Burdur Beige": 420 };
  let lotN = 101;
  for (const b of blocks.filter((x) => x.status === "processed")) {
    const start = new Date(b.receivedOn || b.date);
    start.setDate(start.getDate() + 3);
    const s = start.toISOString().slice(0, 10);
    const fin = new Date(start);
    fin.setDate(fin.getDate() + 2);
    const f = fin.toISOString().slice(0, 10);
    const sqft = Math.round(b.tonnes * (YIELD[b.variety] ?? 115) * (0.93 + r() * 0.1));
    const thick = b.stoneType === "granite" ? 17 : 18;
    const slabs = Math.max(1, Math.floor((b.h * 10) / (thick + 5)) - 2);
    const hours = b.stoneType === "granite" ? 70 : 26 + Math.round(r() * 6);
    const lotId = `l${lots.length + 1}`;
    const j: SawJob = {
      id: `j${jobs.length + 1}`, blockId: b.id, machine: b.stoneType === "granite" ? "Multi-wire saw" : b.variety === "Makrana Albeta" ? "Gang saw 2" : "Gang saw 1",
      startedOn: s, finishedOn: f, thicknessMm: thick, slabs, slabL: b.l - 6, slabW: b.w - 4, sqft, rejectSqft: Math.round(sqft * 0.04),
      // Blades, resin, netting and polishing come from Stores, spread per sq ft each month.
      hours, power: Math.round(hours * S.sawKw * 0.8 * S.powerRate), blades: 0, resin: 0, netting: 0, polishing: 0, labour: Math.round(sqft * S.labourPerSqft), other: 0,
      finish: "Polished", grade: b.grade, lotId,
    };
    jobs.push(j);
    const procCost = j.power + j.blades + j.resin + j.netting + j.polishing + j.labour;
    const toDepot = ago(f) > 25;
    const transfer = toDepot ? Math.round(sqft * 1.5) : 0;
    lots.push({
      id: lotId, lotNo: `L-${lotN++}`, blockId: b.id, shipmentId: "", variety: b.variety, stoneType: b.stoneType, thicknessMm: thick, finish: "Polished",
      grade: b.grade, pieces: slabs, sqft, available: sqft, cost: Math.round(baseCost(b) + b.damageAlloc + procCost + transfer), listRate: LIST[b.variety] ?? 90,
      site: toDepot ? "depot" : "unit", location: toDepot ? `Depot A-frame ${1 + Math.floor(r() * 12)}` : `Unit rack ${1 + Math.floor(r() * 8)}`, createdAt: f,
    });
  }
  // Imported Italian slabs go straight to the depot.
  const itSqft = Math.round(it.sqm * 10.7639);
  lots.push({
    id: `l${lots.length + 1}`, lotNo: `L-${lotN++}`, blockId: "", shipmentId: it.id, variety: "Carrara White", stoneType: "marble", thicknessMm: 18, finish: "Polished",
    grade: "A", pieces: it.pieces, sqft: itSqft, available: itSqft, cost: Math.round(it.cifUsd * it.fx + it.duty + it.cha + it.port + it.inland), listRate: 640,
    site: "depot", location: "Depot showroom bay 2", createdAt: day(-42),
  });
  it.receivedIds.push(lots[lots.length - 1].id);

  // Every slab on record, one by one: block no./running no., measured size, grade.
  for (const lot of lots) {
    const b = blocks.find((x) => x.id === lot.blockId);
    const n = Math.max(1, lot.pieces);
    const L = b ? b.l - 6 : 300;
    const each = lot.sqft / n;
    lot.slabs = Array.from({ length: n }, (_, i) => {
      const l = Math.round(L - r() * 12);
      const sqft = Math.round(each * (0.94 + r() * 0.12) * 100) / 100;
      return { id: `${lot.id}s${i + 1}`, no: slabNo(b?.no ?? lot.lotNo, i + 1), blockId: lot.blockId, l, w: Math.round((sqft * 929.03) / l), sqft, grade: i >= n - 2 && lot.grade === "A" ? "B" as const : lot.grade, status: "stock" as const };
    });
    const cost = lot.cost;
    syncLot(lot);
    lot.cost = cost;
  }

  const sales: Sale[] = [];
  const depot = lots.filter((l) => l.site === "depot");
  const sell = (off: number, customerId: string, picks: [number, number, number][], freight: number, vehicleNo: string, paid: boolean) => {
    const saleId = `sa${sales.length + 1}`;
    const lines = picks.filter(([i]) => depot[i]).map(([i, frac, rate]) => {
      const lot = depot[i];
      const want = lot.available * frac;
      const slabIds: string[] = [];
      let q = 0;
      for (const x of lot.slabs ?? []) {
        if (x.status !== "stock" || q >= want) continue;
        x.status = "sold";
        x.saleId = saleId;
        slabIds.push(x.id);
        q += x.sqft;
      }
      syncLot(lot);
      return { lotId: lot.id, sqft: Math.round(q * 100) / 100, rate, slabIds };
    });
    if (!lines.length) return;
    sales.push({ paidOn: paid ? day(off + 20) : "", id: saleId, invoiceNo: `${S.invoicePrefix}${String(212 + sales.length).padStart(4, "0")}`, date: day(off), customerId, lines, freight, vehicleNo, ewayBill: `${6100 + sales.length} 2210 ${4400 + sales.length * 7}`, gstRate: 18, hsn: "6802", paid, notes: "" });
  };
  sell(-38, "c1", [[0, 0.5, 98], [1, 0.4, 96]], 9500, "RJ 01 GB 2201", true);
  sell(-24, "c2", [[2, 0.6, 99], [depot.length - 1, 0.25, 655]], 28000, "RJ 01 GC 8812", false);
  sell(-12, "c3", [[3, 0.7, 92], [4, 0.5, 92]], 34000, "GJ 01 KT 5520", false);
  sell(-8, "c5", [[5, 0.5, 148], [6, 0.4, 148]], 0, "RJ 01 GC 4410", false);
  Object.assign(sales[sales.length - 1], { gstRate: 0, lut: true, port: "Mundra", sbNo: "8841207", distanceKm: 690 });
  sell(-4, "c4", [[0, 0.3, 102]], 2500, "RJ 01 PA 1180", false);

  // Stores: consumables bought in bulk and issued to the saws and lines every week.
  const items: StoreItem[] = [
    ["si1", "Epoxy resin, clear (part A)", "epoxy", "kg", 60, 410, "Store room, rack 1"],
    ["si2", "Epoxy hardener (part B)", "epoxy", "kg", 30, 430, "Store room, rack 1"],
    ["si3", "Polyester resin, knife-grade", "resin", "kg", 40, 165, "Store room, rack 1"],
    ["si4", "Fibreglass mesh, 4×4 mm", "netting", "sq m", 150, 28, "Store room, rack 2"],
    ["si5", "Polishing powder (oxalic)", "polish", "kg", 25, 190, "Store room, rack 3"],
    ["si6", "Magnesite abrasives, grit 60–1500 (set)", "abrasive", "set", 6, 2250, "Polishing line"],
    ["si7", "Gang saw blades, 4.2 m", "blades", "pcs", 20, 1850, "Blade store"],
    ["si8", "Diamond wire, 11.5 mm", "blades", "m", 40, 3150, "Blade store"],
    ["si9", "Stone sealer, water-based", "chemicals", "L", 10, 620, "Store room, rack 3"],
    ["si10", "Hydraulic oil 68", "fuel", "L", 50, 155, "Oil shed"],
    ["si11", "Wooden A-frame crates", "packing", "pcs", 8, 1350, "Dispatch bay"],
    ["si12", "MS strapping roll", "packing", "roll", 4, 980, "Dispatch bay"],
  ].map(([id, name, cat, unit, minQty, rate, location]) => ({ id: id as string, name: name as string, cat: cat as StoreItem["cat"], unit: unit as string, minQty: minQty as number, rate: rate as number, location: location as string, notes: "", vendorId: "s5" }));
  const moves: StoreMove[] = [];
  const buyQty: Record<string, number> = { si1: 400, si2: 200, si3: 320, si4: 900, si5: 150, si6: 38, si7: 80, si8: 160, si9: 50, si10: 260, si11: 45, si12: 24 };
  const useWk: Record<string, number> = { si1: 52, si2: 26, si3: 30, si4: 120, si5: 14, si6: 4, si7: 9, si8: 14, si9: 4, si10: 22, si11: 4, si12: 2 };
  for (const it of items) {
    moves.push({ id: `sm${moves.length + 1}`, itemId: it.id, date: day(-60), kind: "in", qty: buyQty[it.id], rate: Math.round(it.rate * 0.96), supplierId: "s5", billNo: "KSC/2290", gstRate: 18, note: "" });
    if (["si1", "si2", "si4", "si7"].includes(it.id)) moves.push({ id: `sm${moves.length + 1}`, itemId: it.id, date: day(-21), kind: "in", qty: Math.round(buyQty[it.id] * 0.5), rate: it.rate, supplierId: "s5", billNo: "KSC/2417", gstRate: 18, note: "" });
    for (let w = 8; w >= 0; w--) {
      const place = it.id === "si8" ? "Multi-wire saw" : it.cat === "epoxy" || it.cat === "resin" || it.cat === "netting" ? "Epoxy line" : it.cat === "abrasive" || it.cat === "polish" ? "Polishing line" : it.cat === "packing" ? "Dispatch" : it.cat === "blades" ? "Gang saw 1" : "General";
      moves.push({ id: `sm${moves.length + 1}`, itemId: it.id, date: day(-w * 7 - 2), kind: "out", qty: Math.round(useWk[it.id] * (0.85 + r() * 0.3) * (place === "General" || place === "Dispatch" ? 1 : 0.25)), rate: 0, usedFor: place, note: "" });
    }
  }

  void albeta1; void jal;
  // Sample figures as the Tally connector would bring them in (demo only; a company account keeps its own Tally data).
  const tally = {
    syncedAt: new Date(now.getTime() - 3 * 3600000).toISOString(), company: S.company,
    months: Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const k = 0.8 + r() * 0.45;
      return { m: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, sales: Math.round(2400000 * k), purchases: Math.round(1500000 * k * (0.9 + r() * 0.2)), expenses: Math.round(380000 * (0.9 + r() * 0.2)) };
    }),
    receivables: 4210000, payables: 1880000, cashBank: 1640000, gstPayable: 212000,
    topDebtors: [{ name: "Shivam Infra Projects", amount: 1460000 }, { name: "Gupta Stone Gallery", amount: 1120000 }, { name: "Al Noor Building Materials LLC", amount: 910000 }, { name: "Krishna Interiors", amount: 410000 }, { name: "Sharma Tiles & Marble House", amount: 310000 }],
    topCreditors: [{ name: "Makrana Marble Udyog", amount: 720000 }, { name: "Kishangarh Stone Chemicals", amount: 460000 }, { name: "Agariya Stone Supply", amount: 390000 }, { name: "Mewar Trailer Service", amount: 180000 }, { name: "Shri Balaji Roadlines", amount: 130000 }],
  };
  const db: StoneDB = { v: 1, settings: S, parties, blocks, mineCosts, jobs, lots, damages: [dmg], shipments, sales, stores: { items, moves }, tally, jobwork: jobSample(S, day) };
  group(db);
  // Blocks in hand lie in the main yard; imported blocks in the second godown.
  for (const b of db.blocks) if (b.status === "godown") b.godown = b.source === "import" ? "Godown 2" : "Main yard";
  return db;
}

/** The sample company runs as three firms: the quarry company, the processing unit and the depot. */
function group(db: StoneDB) {
  const S = db.settings;
  const unit = { id: "f1", name: S.company, kind: "processing" as const, gstin: S.gstin, address: S.address, city: S.city, state: S.state, pincode: S.pincode ?? "", phone: S.phone, invoicePrefix: S.invoicePrefix, modules: presetModules({ buyBlocks: true, processing: true, imports: true, stores: true, jobwork: true }) };
  const mine = { id: "f2", name: "Shree Shyam Minerals", kind: "mine" as const, gstin: gst("08", "ABMFS7720K"), address: "Khasra 118, Morwad mining zone", city: "Morwad, Rajsamand", state: "08", pincode: "313324", phone: S.phone, invoicePrefix: "SSMN/26-27/", modules: presetModules({ quarry: true, stores: true }) };
  const depot = { id: "f3", name: "Shyam Stone Gallery", kind: "distribution" as const, gstin: gst("08", "AAJFS3394P"), address: "Marble Mandi, Gate 2", city: "Kishangarh, Ajmer", state: "08", pincode: "305801", phone: S.phone, invoicePrefix: "SSG/26-27/", modules: presetModules({ depot: true, trading: true, imports: true, exports: true }) };
  S.firms = [unit, mine, depot];
  let dc = 0;
  const doc = () => `DC/${String(++dc).padStart(4, "0")}`;
  for (const c of db.mineCosts) c.firmId = mine.id;
  for (const b of db.blocks) {
    if (b.source !== "own_mine") { b.firmId = unit.id; continue; }
    if (b.status === "at_mine") { b.firmId = mine.id; continue; }
    b.firmId = unit.id;
    b.trail = [{ date: b.receivedOn || b.date, from: mine.id, to: unit.id, doc: doc(), value: Math.round(baseCost(b)), note: b.vehicleNo ? `vehicle ${b.vehicleNo}` : "" }];
  }
  for (const j of db.jobs) j.firmId = unit.id;
  for (const e of db.damages) e.firmId = unit.id;
  for (const l of db.lots) {
    if (!l.blockId) { l.firmId = depot.id; continue; }
    l.firmId = l.site === "depot" ? depot.id : unit.id;
    if (l.site === "depot") l.trail = [{ date: l.createdAt, from: unit.id, to: depot.id, doc: doc(), value: Math.round(l.cost), note: "Shifted to depot" }];
  }
  for (const sh of db.shipments) sh.firmId = sh.dir === "import" && sh.kind === "blocks" ? unit.id : depot.id;
  for (const o of db.jobwork ?? []) o.firmId = unit.id;
  for (const sale of db.sales) { sale.firmId = depot.id; sale.invoiceNo = sale.invoiceNo.replace(S.invoicePrefix, depot.invoicePrefix); }
}

const emptyBlockStatic = emptyBlock();
const emptyShipStatic = emptyShipment("import");
export { cbm };

/** Customers' blocks cut for a charge at the unit: one order done and billed, one at the saw, one just in. */
function jobSample(S: StoneSettings, day: (offset: number) => string): JobOrder[] {
  S.jobwork = { rate: 18, gstRate: 5, sac: "9988", freeDays: 30, rentPerDay: 100, extras: [] };
  const P = S.invoicePrefix;
  const blk = (id: string, no: string, variety: string, size: [number, number, number], t: number, p: Partial<JobBlock>): JobBlock => ({ ...emptyJobBlock(), id, no, variety, l: size[0], w: size[1], h: size[2], tonnes: t, ...p });
  const area = (L: number, W: number) => (L * W) / 929.0304;
  const cut = (on: number, slabs: number, L: number, W: number, broken = 0, thk = 18, finish = "As cut") => ({ machine: "Gang saw 2", startedOn: day(on - 2), finishedOn: day(on), thicknessMm: thk, finish, slabs, sqft: Math.round(slabs * area(L, W) * 100) / 100, slabL: L, slabW: W, brokenSlabs: broken, brokenSqft: Math.round(broken * area(L, W) * 100) / 100, hours: 30, note: broken ? "Hidden crack along the vein" : "" });
  const o1: JobOrder = {
    id: "jo1", no: "JO-0001", date: day(-40), customerId: "c6", thicknessMm: 18, finish: "As cut", instructions: "Full slabs, no calibration. Mark block no. on every slab.", rate: 18,
    extras: [{ label: "Netting", basis: "sqft", rate: 3 }, { label: "Loading", basis: "lump", rate: 1500 }], waste: "return", freeDays: 30, rentPerDay: 100,
    blocks: [
      blk("jb1", "RMT-221", "Makrana Dungri", [270, 165, 160], 19.2, { receivedOn: day(-38), vehicleNo: "RJ 01 GB 4471", challanNo: "RMT/118", status: "returned", condition: "Small chip on one top corner", cut: cut(-30, 52, 262, 156, 2) }),
      blk("jb2", "RMT-224", "Makrana Dungri", [262, 158, 150], 16.8, { receivedOn: day(-38), vehicleNo: "RJ 01 GB 4471", challanNo: "RMT/119", status: "returned", cut: cut(-24, 48, 255, 146) }),
    ],
    dispatches: [], bills: [], closed: false, notes: "",
  };
  o1.dispatches.push(
    { id: "jd1", no: `${P}JC-0001`, date: day(-27), vehicleNo: "RJ 01 GA 9023", driver: "Mohan Lal", driverPhone: "", transporterId: "t1", ewayBill: "4412 7781 3305", value: 380000, shipTo: "", offcuts: "2 broken pieces, 1 top slice", lines: [{ blockId: "jb1", slabs: 52, sqft: o1.blocks[0].cut!.sqft, broken: 2 }], notes: "" },
    { id: "jd2", no: `${P}JC-0002`, date: day(-20), vehicleNo: "RJ 36 GA 1180", driver: "", driverPhone: "", transporterId: "", ewayBill: "", value: 340000, shipTo: "Rathore Marble Traders, Godown 7, RIICO Phase III, Kishangarh", offcuts: "", lines: [{ blockId: "jb2", slabs: 48, sqft: o1.blocks[1].cut!.sqft, broken: 0 }], notes: "Customer's own vehicle" },
  );
  const bill = (id: string, no: number, on: number, ids: string[], paidOn = "") => ({ id, invoiceNo: `${P}JW-${String(no).padStart(4, "0")}`, date: day(on), blockIds: ids, lines: autoLines(o1, o1.blocks.filter((b) => ids.includes(b.id)), day(on)), gstRate: 5, sac: "9988", paid: !!paidOn, paidOn, notes: "" });
  o1.bills.push(bill("jbl1", 1, -27, ["jb1"], day(-12)), bill("jbl2", 2, -20, ["jb2"]));

  const o2: JobOrder = {
    id: "jo2", no: "JO-0002", date: day(-12), customerId: "c1", thicknessMm: 16, finish: "Polished", instructions: "Calibrate to 16 mm, polish one face, resin both sides.", rate: 20,
    extras: [{ label: "Resin / epoxy", basis: "sqft", rate: 6 }, { label: "Polishing", basis: "sqft", rate: 9 }], waste: "keep", freeDays: 30, rentPerDay: 100,
    blocks: [
      blk("jb3", "ST-77", "Katni Beige", [280, 170, 155], 20.4, { receivedOn: day(-11), vehicleNo: "MP 21 H 6620", challanNo: "STM/0412", ewayBill: "3310 5528 9017", status: "cut", cut: cut(-4, 60, 272, 150, 3, 16, "Polished") }),
      blk("jb4", "ST-78", "Katni Beige", [275, 160, 150], 18.1, { receivedOn: day(-11), vehicleNo: "MP 21 H 6620", challanNo: "STM/0412", status: "on_saw" }),
      blk("jb5", "ST-79", "Katni Beige", [250, 155, 145], 15.2, { receivedOn: day(-6), vehicleNo: "MP 21 H 7714", challanNo: "STM/0418", status: "in_yard", condition: "Open vein on the long side, customer told" }),
      blk("jb6", "ST-80", "Katni Beige", [0, 0, 0], 17, { status: "expected" }),
    ],
    dispatches: [], bills: [], closed: false, notes: "Customer collects with their own trailer.",
  };
  const o3: JobOrder = {
    id: "jo3", no: "JO-0003", date: day(-3), customerId: "c6", thicknessMm: 18, finish: "As cut", instructions: "", rate: 18, extras: [{ label: "Netting", basis: "sqft", rate: 3 }], waste: "return", freeDays: 30, rentPerDay: 100,
    blocks: [blk("jb7", "RMT-230", "Makrana Albeta", [240, 150, 140], 13.6, { receivedOn: day(-2), vehicleNo: "RJ 01 GB 4471", challanNo: "RMT/131", status: "in_yard" })],
    dispatches: [], bills: [], closed: false, notes: "",
  };
  return [o1, o2, o3];
}
