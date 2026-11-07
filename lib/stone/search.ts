import { dmy, n0 } from "./calc";
import { whereIs } from "./godowns";
import { firmOf } from "./firms";
import type { Block, StoneDB } from "./types";

/** One thing the search box can open: where to go and what to show in the list. */
export type Hit = { key: string; kind: string; title: string; sub: string; go: [string, string]; find: string; no: string; firm?: string };

/** Sections the person may open, by sidebar key; Masters lists its kinds separately. */
export type SearchScope = { views: Set<string>; parties: Set<string> };

const PARTY_KIND: Record<string, string> = { customer: "Customer", supplier: "Supplier", transporter: "Transporter" };

/** Everything searchable, across all firms; each hit knows its firm so opening it can switch there. */
export function searchIndex(db: StoneDB, can: SearchScope, root: StoneDB = db): Hit[] {
  const out: Hit[] = [];
  const party = (id?: string) => (id ? db.parties.find((p) => p.id === id) ?? root.parties.find((p) => p.id === id) : undefined);
  const name = (id?: string) => party(id)?.company ?? "";

  if (can.views.has("inventory")) {
    for (const b of db.blocks) {
      out.push({
        key: `b${b.id}`, firm: firmOf(b, db.settings), kind: "Block", no: b.no, title: `Block ${b.no}`,
        sub: [b.variety, whereIs(b), name(b.supplierId) || b.mine].filter(Boolean).join(" · "),
        go: ["inventory", `blocks:open:${b.id}`],
        find: [b.no, b.variety, b.mine, name(b.supplierId), b.invoiceNo, b.vehicleNo, b.eRawanna, b.godown, b.imp?.blNo].filter(Boolean).join(" "),
      });
    }
    for (const l of db.lots) {
      const blockNo = root.blocks.find((b) => b.id === l.blockId)?.no;
      out.push({
        key: `l${l.id}`, firm: firmOf(l, db.settings), kind: "Lot", no: l.lotNo, title: `Lot ${l.lotNo}`,
        sub: [`${l.variety} ${l.thicknessMm} mm ${l.finish}`.trim(), l.available > 0 ? `${n0(l.available)} sq ft in stock` : "sold out", blockNo && `block ${blockNo}`].filter(Boolean).join(" · "),
        go: ["inventory", `slabs:open:${l.id}`],
        find: [l.lotNo, l.variety, l.finish, blockNo, l.location, name(l.supplierId), l.invoiceNo].filter(Boolean).join(" "),
      });
    }
  }

  if (can.views.has("sales")) {
    for (const s of db.sales) {
      const lots = s.lines.map((x) => root.lots.find((l) => l.id === x.lotId)?.lotNo ?? root.blocks.find((b) => b.id === x.blockId)?.no).filter(Boolean);
      out.push({
        key: `s${s.id}`, firm: firmOf(s, db.settings), kind: "Invoice", no: s.invoiceNo, title: `Invoice ${s.invoiceNo}`,
        sub: [name(s.customerId), dmy(s.date), s.paid ? "paid" : "payment due"].filter(Boolean).join(" · "),
        go: ["sales", `inv:${s.id}`],
        find: [s.invoiceNo, name(s.customerId), s.vehicleNo, s.ewayBill, ...lots].filter(Boolean).join(" "),
      });
    }
  }

  if (can.views.has("purchases")) {
    const bills = new Map<string, Block[]>();
    for (const b of db.blocks) if (b.source !== "own_mine") bills.set(b.purchaseId || b.id, [...(bills.get(b.purchaseId || b.id) ?? []), b]);
    for (const [id, bs] of bills) {
      const h = bs[0];
      const imp = h.source === "import";
      const ref = imp ? (h.imp?.blNo ? `BL ${h.imp.blNo}` : "import") : h.invoiceNo || "no bill no.";
      out.push({
        key: `p${id}`, firm: firmOf(h, db.settings), kind: "Purchase", no: h.invoiceNo || h.imp?.blNo || "", title: `Purchase ${ref}`,
        sub: [name(h.supplierId) || h.mine, dmy(h.date), `${bs.length} block${bs.length > 1 ? "s" : ""}`].filter(Boolean).join(" · "),
        go: ["purchases", `${imp ? "import" : "domestic"}:bill:${id}`],
        find: [h.invoiceNo, h.imp?.blNo, name(h.supplierId), h.mine, h.vehicleNo, ...bs.map((b) => b.no)].filter(Boolean).join(" "),
      });
    }
  }

  if (can.views.has("unit")) {
    for (const o of db.jobwork ?? []) {
      out.push({
        key: `j${o.id}`, firm: firmOf(o, db.settings), kind: "Job order", no: o.no, title: `Job order ${o.no}`,
        sub: [name(o.customerId), dmy(o.date), `${o.blocks.length} block${o.blocks.length === 1 ? "" : "s"}`].filter(Boolean).join(" · "),
        go: ["unit", `jobwork:${o.id}`],
        find: [o.no, name(o.customerId), ...o.blocks.map((b) => `${b.no} ${b.variety}`)].filter(Boolean).join(" "),
      });
    }
  }

  for (const p of db.parties) {
    if (!PARTY_KIND[p.kind] || !can.parties.has(p.kind)) continue;
    out.push({
      key: `c${p.id}`, kind: PARTY_KIND[p.kind], no: p.company, title: p.company,
      sub: [PARTY_KIND[p.kind], p.city, p.whatsapp || p.phone].filter(Boolean).join(" · "),
      go: ["parties", `${p.kind}:open:${p.id}`],
      find: [p.company, p.name, p.city, p.phone, p.whatsapp, p.gstin].filter(Boolean).join(" "),
    });
  }
  return out;
}

/** Hits for what was typed: every word must appear; exact and starting numbers first. */
export function searchHits(index: Hit[], q: string, max = 12) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return { hits: [] as Hit[], more: 0 };
  const flat = q.toLowerCase().replace(/\s+/g, "");
  const found = index.filter((h) => { const t = `${h.title} ${h.find}`.toLowerCase(); return words.every((w) => t.includes(w)); });
  const score = (h: Hit) => { const n = h.no.toLowerCase().replace(/\s+/g, ""); return n === flat ? 0 : n.startsWith(flat) ? 1 : n.includes(flat) ? 2 : 3; };
  found.sort((a, b) => score(a) - score(b) || a.title.localeCompare(b.title, "en", { numeric: true }));
  return { hits: found.slice(0, max), more: Math.max(0, found.length - max) };
}
