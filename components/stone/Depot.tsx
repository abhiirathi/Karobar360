"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Camera, ChevronDown, Download, Plus, Printer, Trash2 } from "lucide-react";
import { STATES, blockCost, checkGstin, daysSince, dmy, inWords, lakh, n0, n2, rs, rs2, saleCost, saleTaxable, saleTotals, today, uid } from "@/lib/stone/calc";
import { lotUnit, qualities } from "@/lib/stone/costing";
import { inStock } from "@/lib/stone/godowns";
import { PORTS, checks, eInvoice, eWayBill } from "@/lib/stone/gst";
import type { Block, Party, Sale, SaleLine, SlabLot, StoneDB } from "@/lib/stone/types";
import { slabCount, slabRange, syncLot } from "@/lib/stone/slabs";
import { freeCount, reservations, reservedMap, sellableSqft, sellableTo, tidyReserves } from "@/lib/stone/reserve";
import type { Ctx } from "./StoneApp";
import { STATUS_LABEL } from "./BlockForm";
import { fileSrc } from "./files";
import { Badge, Drawer, F, Grid, Note, NumIn, Pick, Section, Sel, Seg, Stat, Table, TextIn, Area, readPhoto, setUrlTab, type Col } from "./ui";

const qtyUnit = (l: { blockId?: string }) => (l.blockId ? "t" : "sq ft");

export const isExport = (p?: Party) => !!p?.intl;
type Market = "all" | "india" | "export";

/** Sales: invoices in India and abroad, with payment tracking. Slab stock lives under Inventory. */
export default function Depot({ ctx }: { ctx: Ctx }) {
  const { db, update } = ctx;
  const C = ctx.costs;
  const [market, setMarket] = useState<Market>(ctx.sub === "export" || ctx.sub === "india" ? ctx.sub : "all");
  const [pay, setPay] = useState<"all" | "due" | "overdue" | "paid">("all");
  const billFor = ctx.sub.startsWith("bill:") ? ctx.sub.slice(5) : "";
  const [sale, setSale] = useState<Sale | null | "new">((ctx.sub === "new" || billFor) && ctx.edit("sales") ? "new" : null);
  useEffect(() => { if (ctx.sub === "new" || billFor) setUrlTab(""); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [inv, setInv] = useState<Sale | null>(null);
  const [confirmPay, setConfirmPay] = useState<Sale | null>(null);
  const clearsNow = !!db.settings.purge?.enabled && db.settings.purge.after === "paid";
  const unitCost = (l: SlabLot) => lotUnit(ctx.root, l);

  const cust = (id: string) => db.parties.find((p) => p.id === id);
  const outstanding = db.sales.filter((s) => !s.paid).reduce((a, s) => a + saleTotals(s, db.settings.state, cust(s.customerId)?.state ?? db.settings.state).total, 0);
  const overdue = db.sales.filter((s) => !s.paid && daysSince(s.date) > (cust(s.customerId)?.creditDays ?? 30));
  const total = (x: Sale) => saleTotals(x, db.settings.state, cust(x.customerId)?.state ?? db.settings.state).total;
  const late = (x: Sale) => !x.paid && daysSince(x.date) > (cust(x.customerId)?.creditDays ?? 30);
  const exp = (x: Sale) => isExport(cust(x.customerId));
  const recent = db.sales.filter((x) => daysSince(x.date) <= 30);
  const fyStart = `${new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1}-04-01`;
  const fy = db.sales.filter((x) => x.date >= fyStart);
  const sum = (xs: Sale[]) => xs.reduce((a, x) => a + saleTaxable(x), 0);
  const salesRows = [...db.sales].reverse().filter((x) => (market === "all" || (market === "export") === exp(x)) && (pay === "all" || (pay === "paid" ? x.paid : pay === "overdue" ? late(x) : !x.paid)));
  const marketSales = db.sales.filter((x) => market === "all" || (market === "export") === exp(x));
  const saleCols: Col<Sale>[] = [
    { key: "d", label: "Sold on", render: (s) => <span className="num whitespace-nowrap">{dmy(s.date)}</span>, sort: (s) => s.date },
    { key: "no", label: "Invoice", render: (s) => <div><div className="whitespace-nowrap font-medium">{s.invoiceNo}</div>{(s.irn || s.ewayBill) && <div className="text-[0.8rem] text-ink-3">{[s.irn && "IRN", s.ewayBill && "EWB"].filter(Boolean).join(" · ")}</div>}</div>, sort: (s) => s.invoiceNo },
    { key: "c", label: "Customer", render: (s) => { const c = cust(s.customerId); return <div><div>{c?.company ?? "—"}</div><div className="text-[0.8rem] text-ink-3">{[c?.city, c?.intl ? c.country : ""].filter(Boolean).join(", ")}{c?.intl && <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 py-0.5 text-[0.7rem] font-medium text-ink-2">Export</span>}</div></div>; } },
    { key: "lot", label: "Lot sold", render: (s) => <div className="space-y-0.5">{s.lines.map((l) => { const lot = db.lots.find((x) => x.id === l.lotId); const b = db.blocks.find((x) => x.id === l.blockId); return <div key={l.lotId || l.blockId} className="whitespace-nowrap">{b ? <span className="font-medium">Block {b.no}</span> : <><span className="font-medium">{lot?.lotNo ?? "Lot removed"}</span><span className="text-[0.8rem] text-ink-3">{lot ? ` · ${lot.variety}` : ""}{l.slabIds?.length ? ` · ${l.slabIds.length} slab${l.slabIds.length > 1 ? "s" : ""}` : ""}</span></>}</div>; })}</div>, sort: (s) => db.lots.find((x) => x.id === s.lines[0]?.lotId)?.lotNo ?? "" },
    { key: "q", label: "Qty", align: "right", render: (s) => <span className="whitespace-nowrap">{s.lines.some((l) => l.blockId) ? `${n2(s.lines.reduce((a, l) => a + l.sqft, 0))} t` : `${n0(s.lines.reduce((a, l) => a + l.sqft, 0))} sq ft`}</span> },
    { key: "t", label: "Total", align: "right", render: (s) => rs(saleTotals(s, db.settings.state, cust(s.customerId)?.state ?? "08").total), sort: (s) => saleTaxable(s) },
    ...(C ? [{ key: "m", label: "Margin", align: "right" as const, render: (s: Sale) => { const tx = saleTaxable(s) - s.freight; const m = tx - saleCost(s, ctx.root.lots, ctx.root.blocks, unitCost); return <span className={m < 0 ? "text-neg" : ""}>{tx ? `${Math.round((m / tx) * 100)}%` : "—"}</span>; } }] : []),
    { key: "p", label: "Payment", render: (s) => { const late = !s.paid && daysSince(s.date) > (cust(s.customerId)?.creditDays ?? 30); const tone = s.paid ? "bg-accent-soft text-accent" : late ? "bg-neg-soft text-neg" : "bg-warn-soft text-warn"; const label = s.paid ? "Received" : late ? `Overdue ${daysSince(s.date)} d` : "Due";
      if (!ctx.edit("sales")) return <Badge tone={s.paid ? "good" : late ? "neg" : "warn"}>{label}</Badge>;
      return (
        <div className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
          <select aria-label={`Payment for ${s.invoiceNo}`} value={s.paid ? "paid" : "due"} onChange={(e) => { const paid = e.target.value === "paid"; if (paid && clearsNow) { setConfirmPay(s); return; } update((d) => { const x = d.sales.find((y) => y.id === s.id)!; x.paid = paid; x.paidOn = paid ? today() : ""; }); ctx.say(paid ? `${s.invoiceNo} marked received` : `${s.invoiceNo} marked due`, "good"); }}
            className={`cursor-pointer appearance-none rounded-full py-1 pl-3 pr-7 text-[0.8rem] font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${tone}`}>
            <option value="due">{s.paid ? "Due" : label}</option>
            <option value="paid">Received{s.paidOn ? ` ${dmy(s.paidOn)}` : ""}</option>
          </select>
          <ChevronDown size={13} className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 ${s.paid ? "text-accent" : late ? "text-neg" : "text-warn"}`} />
        </div>
      ); } },
    { key: "a", label: "", render: (s) => <div className="flex justify-end" onClick={(e) => e.stopPropagation()}><button className="btn btn-quiet btn-sm" onClick={() => setInv(s)}><Printer size={13} />Invoice</button></div> },
  ];

  if (sale) return <SaleForm ctx={ctx} initial={sale === "new" ? null : sale} billFor={sale === "new" ? billFor : ""} onClose={() => setSale(null)} onSaved={(s) => { setSale(null); setInv(s); }} />;
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="India sales, last 30 days" value={lakh(sum(recent.filter((x) => !exp(x))))} sub={`${recent.filter((x) => !exp(x)).length} invoices · ${lakh(sum(fy.filter((x) => !exp(x))))} this year`} />
        <Stat label="Export sales, last 30 days" value={lakh(sum(recent.filter(exp)))} sub={`${recent.filter(exp).length} invoices · ${lakh(sum(fy.filter(exp)))} this year`} />
        <Stat label="To collect" value={lakh(outstanding)} sub={`India ${lakh(db.sales.filter((x) => !x.paid && !exp(x)).reduce((a, x) => a + total(x), 0))} · export ${lakh(db.sales.filter((x) => !x.paid && exp(x)).reduce((a, x) => a + total(x), 0))}`} />
        <Stat label="Past credit days" value={`${overdue.length}`} sub={overdue.length ? lakh(overdue.reduce((a, x) => a + total(x), 0)) : "Nothing overdue"} tone={overdue.length ? "neg" : undefined} />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Seg value={market} onChange={setMarket} tabs={[{ key: "all", label: "All sales", count: db.sales.length }, { key: "india", label: "India", count: db.sales.filter((x) => !exp(x)).length }, { key: "export", label: "Export", count: db.sales.filter(exp).length }]} />
        <Seg value={pay} onChange={setPay} tabs={[{ key: "all", label: "Any payment" }, { key: "due", label: "Due", count: marketSales.filter((x) => !x.paid).length }, { key: "overdue", label: "Overdue", count: marketSales.filter(late).length }, { key: "paid", label: "Received" }]} />
        <div className="ml-auto flex flex-wrap gap-2">
          {ctx.edit("sales") && <button className="btn btn-primary btn-sm" onClick={() => setSale("new")}><Plus size={15} />{market === "export" ? "New export sale" : "New sale"}</button>}
        </div>
      </div>
      <div className="mt-4">
        {db.settings.purge?.enabled && <div className="mb-3"><Note>Paid invoices are deleted {db.settings.purge.after === "paid" ? "as soon as payment is marked received" : `${db.settings.purge.days} days after payment`}. Change this in Settings.</Note></div>}
        {market !== "all" && salesRows.length > 0 && <div className="mb-3 text-sm text-ink-2">{salesRows.length} invoices · {lakh(sum(salesRows))} before GST · {lakh(salesRows.reduce((a, x) => a + total(x), 0))} billed</div>}
        <Table rows={salesRows} cols={saleCols} onRow={(s) => (ctx.edit("sales") ? setSale(s) : setInv(s))} search={(s) => `${s.invoiceNo} ${cust(s.customerId)?.company} ${cust(s.customerId)?.country ?? ""} ${s.vehicleNo} ${s.lines.map((l) => db.lots.find((x) => x.id === l.lotId)?.lotNo ?? "").join(" ")}`} empty={market === "export" ? "No export sales yet. Add an international customer under Masters → Customers, then make a sale to them." : market === "india" ? "No sales in India yet." : "No sales yet."} />
      </div>

      {inv && <Invoice ctx={ctx} sale={db.sales.find((x) => x.id === inv.id) ?? inv} onClose={() => setInv(null)} />}
      {confirmPay && (
        <Drawer open title={`Payment received for ${confirmPay.invoiceNo}?`} sub={`${cust(confirmPay.customerId)?.company ?? ""} · ${rs(total(confirmPay))}`} onClose={() => setConfirmPay(null)}
          footer={<><button className="btn btn-primary" onClick={() => { const id = confirmPay.id; update((d) => { const x = d.sales.find((y) => y.id === id); if (x) { x.paid = true; x.paidOn = today(); } }); ctx.say(`${confirmPay.invoiceNo} received and cleared`, "good"); setConfirmPay(null); }}>Mark received and delete</button><button className="btn btn-quiet" onClick={() => setConfirmPay(null)}>Cancel</button></>}>
          <Note tone="warn">Auto-clean is on, so this invoice is deleted from Karobar360 as soon as it is marked received. Your accounts software and GST returns keep their own copy.</Note>
          <button className="btn btn-quiet btn-sm mt-4" onClick={() => { setInv(confirmPay); setConfirmPay(null); }}><Printer size={14} />Open the invoice to save a PDF first</button>
        </Drawer>
      )}
    </div>
  );
}


export function LotForm({ ctx, lot, onSave, onClose, onSend }: { ctx: Ctx; lot: SlabLot; onSave: (l: SlabLot) => void; onClose: () => void; onSend?: () => void }) {
  const [l, setL] = useState<SlabLot>({ ...lot, photos: lot.photos ?? [] });
  const can = ctx.edit("stock");
  const add = async (files: FileList | null) => {
    if (!files) return;
    const urls = await Promise.all([...files].slice(0, 8).map((f) => readPhoto(f, 1400)));
    setL((x) => ({ ...x, photos: [...(x.photos ?? []), ...urls].slice(0, 8) }));
  };
  return (
    <Drawer open title={`Lot ${lot.lotNo}`} sub={`${lot.variety} · ${lot.thicknessMm} mm ${lot.finish}${ctx.costs ? ` · cost ${rs2(lotUnit(ctx.root, lot))}/sq ft` : ""}`} onClose={onClose}
      footer={can ? <><button className="btn btn-primary" onClick={() => onSave(l)}>Save</button><button className="btn btn-quiet" onClick={onClose}>Cancel</button>{onSend && <button className="btn btn-quiet btn-sm ml-auto" onClick={onSend}><ArrowRightLeft size={14} />Send to firm</button>}</> : <button className="btn btn-quiet" onClick={onClose}>Close</button>}>
      <Grid>
        <F label="List price"><NumIn value={l.listRate} onChange={(v) => setL({ ...l, listRate: v })} suffix="₹/sq ft" /></F>
        <F label="Rack / A-frame"><TextIn value={l.location} onChange={(v) => setL({ ...l, location: v })} /></F>
        {l.slabs?.length ? <F label="Sq ft in stock" hint="Change single slabs under By slab"><div className="field num">{n0(l.available)} sq ft · {l.slabs.filter((x) => x.status === "stock").length} slabs</div></F>
          : <F label="Sq ft in stock" hint="Correct after a physical count"><NumIn value={l.available} onChange={(v) => setL({ ...l, available: v })} suffix="sq ft" /></F>}
        <F label="Grade"><Sel value={l.grade} onChange={(v) => setL({ ...l, grade: v as SlabLot["grade"] })} options={["A", "B", "C", "Commercial"].map((v) => ({ v, l: v }))} /></F>
      </Grid>
      <Section title="Photos for dealers">
        <div className="flex flex-wrap gap-2">
          {(l.photos ?? []).map((p, i) => (
            <div key={i} className="relative h-24 w-32 overflow-hidden rounded-xl bg-surface-2">
              <img src={fileSrc(p)} alt={`Lot ${l.lotNo} photo ${i + 1}`} className="h-full w-full object-cover" />
              {can && <button className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white" aria-label="Remove photo" onClick={() => setL((x) => ({ ...x, photos: (x.photos ?? []).filter((_, j) => j !== i) }))}><Trash2 size={12} /></button>}
            </div>
          ))}
          {can && (l.photos ?? []).length < 8 && (
            <label className="grid h-24 w-32 cursor-pointer place-items-center rounded-xl bg-surface-2 text-ink-2 transition-colors hover:bg-surface-3">
              <span className="flex flex-col items-center gap-1 text-xs"><Camera size={18} />Add photos</span>
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => add(e.target.files)} />
            </label>
          )}
        </div>
        <p className="mt-2 text-[0.82rem] text-ink-3">Shoot the full slab in daylight, plus one close-up of the pattern. Wet the surface for unpolished stone.</p>
        <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl bg-surface px-4 py-3">
          <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={!!l.catalogue} disabled={!can} onChange={(e) => setL({ ...l, catalogue: e.target.checked })} />
          <span><span className="block font-medium">Show in the dealer catalogue</span><span className="block text-[0.8rem] text-ink-3">Dealers see photos, size, sq ft available{ctx.db.settings.catalogue?.showRates ? " and list price" : ""}. Never cost.</span></span>
        </label>
        <div className="mt-3"><F label="Note for dealers"><TextIn value={l.note ?? ""} onChange={(v) => setL({ ...l, note: v })} placeholder="Book-matched pairs available" /></F></div>
      </Section>
    </Drawer>
  );
}

export function BuyForm({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const { db, update } = ctx;
  const suppliers = db.parties.filter((p) => p.kind === "supplier");
  const [f, setF] = useState({ supplierId: "", invoiceNo: "", date: today(), variety: "", stoneType: "marble" as SlabLot["stoneType"], thicknessMm: 18, finish: "Polished", grade: "A" as SlabLot["grade"], pieces: 0, sqft: 0, rate: 0, freight: 0, gstRate: 18, listRate: 0, location: "" });
  const value = f.sqft * f.rate;
  const err = !f.variety ? "Enter the variety" : !f.sqft ? "Enter sq ft" : "";
  const save = () => {
    update((d) => {
      const n = d.lots.reduce((m, l) => Math.max(m, parseInt(l.lotNo.replace(/\D/g, "")) || 0), 100) + 1;
      d.lots.push({
        id: uid(), lotNo: `L-${n}`, blockId: "", shipmentId: "", variety: f.variety, stoneType: f.stoneType, thicknessMm: f.thicknessMm, finish: f.finish, grade: f.grade,
        pieces: f.pieces, sqft: f.sqft, available: f.sqft, cost: Math.round(value + f.freight), listRate: f.listRate, site: "depot", location: f.location, createdAt: f.date,
        source: "purchase", supplierId: f.supplierId, invoiceNo: f.invoiceNo, gstRate: f.gstRate, buyValue: value, photos: [],
      });
    });
    ctx.say("Slab lot added to stock", "good");
    onClose();
  };
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });
  return (
    <Drawer open wide page title="Slabs bought" sub="Slabs bought from another unit or importer go straight into stock with their cost." onClose={onClose}
      footer={<><button className="btn btn-primary" disabled={Boolean(err)} onClick={save}>Add to stock</button><button className="btn btn-quiet" onClick={onClose}>Cancel</button>{err && <span className="text-sm text-ink-3">{err}</span>}</>}>
      <Section title="Supplier bill">
        <Grid cols={3}>
          <F label="Supplier" span={2}><Sel value={f.supplierId} onChange={(v) => set("supplierId", v)} placeholder="Choose supplier" options={suppliers.map((p) => ({ v: p.id, l: `${p.company} · ${p.city}` }))} /></F>
          <F label="Bill no."><TextIn value={f.invoiceNo} onChange={(v) => set("invoiceNo", v)} upper /></F>
          <F label="Bill date"><TextIn type="date" value={f.date} onChange={(v) => set("date", v)} /></F>
          <F label="GST on bill"><NumIn value={f.gstRate} onChange={(v) => set("gstRate", v)} suffix="%" /></F>
        </Grid>
      </Section>
      <Section title="Slabs">
        <Grid cols={3}>
          <F label="Quality" span={2}><TextIn value={f.variety} onChange={(v) => set("variety", v)} list="buy-varieties" placeholder="Rajnagar White" /><datalist id="buy-varieties">{qualities(db).map((v) => <option key={v} value={v} />)}</datalist></F>
          <F label="Stone"><Sel value={f.stoneType} onChange={(v) => set("stoneType", v as SlabLot["stoneType"])} options={["marble", "granite", "sandstone", "quartzite", "onyx", "other"].map((v) => ({ v, l: v[0].toUpperCase() + v.slice(1) }))} /></F>
          <F label="Thickness"><NumIn value={f.thicknessMm} onChange={(v) => set("thicknessMm", v)} suffix="mm" /></F>
          <F label="Finish"><Sel value={f.finish} onChange={(v) => set("finish", v)} options={["Polished", "Honed", "Leather", "Flamed", "Rough-cut"].map((v) => ({ v, l: v }))} /></F>
          <F label="Grade"><Sel value={f.grade} onChange={(v) => set("grade", v as SlabLot["grade"])} options={["A", "B", "C", "Commercial"].map((v) => ({ v, l: v }))} /></F>
          <F label="Slabs"><NumIn value={f.pieces} onChange={(v) => set("pieces", v)} /></F>
          <F label="Sq ft"><NumIn value={f.sqft} onChange={(v) => set("sqft", v)} suffix="sq ft" /></F>
          <F label="Rate on bill"><NumIn value={f.rate} onChange={(v) => set("rate", v)} suffix="₹/sq ft" /></F>
          <F label="Freight to depot"><NumIn value={f.freight} onChange={(v) => set("freight", v)} suffix="₹" /></F>
          <F label="Your list price"><NumIn value={f.listRate} onChange={(v) => set("listRate", v)} suffix="₹/sq ft" /></F>
          <F label="Rack / A-frame"><TextIn value={f.location} onChange={(v) => set("location", v)} /></F>
        </Grid>
        <div className="mt-3 rounded-2xl bg-surface p-4 text-[0.9rem]">
          <div className="flex justify-between text-ink-2"><span>Bill value before GST</span><span className="num text-ink">{rs(value)}</span></div>
          <div className="flex justify-between text-ink-2"><span>Landed cost per sq ft (with freight)</span><span className="num text-ink">{f.sqft ? rs2((value + f.freight) / f.sqft) : "—"}</span></div>
          {f.listRate > 0 && f.sqft > 0 && f.listRate < (value + f.freight) / f.sqft && <div className="mt-2"><Note tone="warn">List price is below the landed cost.</Note></div>}
        </div>
      </Section>
    </Drawer>
  );
}

function release(d: StoneDB, l: SaleLine) {
  if (l.blockId) { const b = d.blocks.find((x) => x.id === l.blockId); if (b && b.status === "sold") b.status = b.source === "own_mine" && !b.godown ? "at_mine" : "godown"; return; }
  const lot = d.lots.find((x) => x.id === l.lotId);
  if (!lot) return;
  if (l.slabIds && lot.slabs?.length) { for (const x of lot.slabs) if (l.slabIds.includes(x.id) && x.status === "sold") { x.status = "stock"; delete x.saleId; } syncLot(lot); }
  else lot.available += l.sqft;
}

function take(d: StoneDB, l: SaleLine, saleId: string) {
  if (l.blockId) { const b = d.blocks.find((x) => x.id === l.blockId); if (b) b.status = "sold"; return; }
  const lot = d.lots.find((x) => x.id === l.lotId);
  if (!lot) return;
  if (l.slabIds && lot.slabs?.length) { for (const x of lot.slabs) if (l.slabIds.includes(x.id)) { x.status = "sold"; x.saleId = saleId; } syncLot(lot); tidyReserves(lot); }
  else lot.available -= l.sqft;
}

/** Tick the exact slabs going on the truck. */
function SlabPick({ lot, saleId, customerId, line, onChange }: { lot: SlabLot; saleId: string; customerId: string; line: SaleLine; onChange: (ids: string[]) => void }) {
  const picked = new Set(line.slabIds ?? []);
  const res = reservedMap(lot);
  const mine = (id: string) => !!customerId && res.get(id)?.customerId === customerId;
  const free = (lot.slabs ?? []).filter((x) => sellableTo(lot, x, customerId) || picked.has(x.id) || (saleId && x.saleId === saleId));
  const others = (lot.slabs ?? []).filter((x) => x.status === "stock" && !free.includes(x)).length;
  const flip = (id: string) => { const n = new Set(picked); if (n.has(id)) n.delete(id); else n.add(id); onChange([...n]); };
  return (
    <div className="sm:col-span-4">
      <div className="mb-1.5 flex items-center gap-3 text-[0.8rem] text-ink-3">
        <span>{picked.size} of {free.length} slabs picked</span>
        <button type="button" className="underline" onClick={() => onChange(free.map((x) => x.id))}>All</button>
        {picked.size > 0 && <button type="button" className="underline" onClick={() => onChange([])}>None</button>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {free.map((x) => (
          <button key={x.id} type="button" className={`chip num ${mine(x.id) && !picked.has(x.id) ? "ring-1 ring-accent" : ""}`} data-on={picked.has(x.id)} onClick={() => flip(x.id)} title={`${x.l && x.w ? `${x.l} × ${x.w} cm · grade ${x.grade}` : `Grade ${x.grade}`}${mine(x.id) ? " · reserved for this customer" : ""}`}>
            {x.no.split("/").pop()} · {n2(x.sqft)}{mine(x.id) ? " · R" : ""}
          </button>
        ))}
        {!free.length && <span className="text-[0.84rem] text-ink-3">No slabs left in this lot.</span>}
      </div>
      {others > 0 && <div className="mt-1.5 text-[0.8rem] text-ink-3">{others} slab{others > 1 ? "s" : ""} reserved for other customers not shown. R = reserved for this customer.</div>}
    </div>
  );
}

/** Invoice lines for every slab reserved for this customer in the firm on screen, at the agreed rates. */
function reservedLines(db: StoneDB, customerId: string): SaleLine[] {
  return reservations(db).filter((x) => x.r.customerId === customerId).map((x) => ({ lotId: x.lot.id, slabIds: x.slabs.map((y) => y.id), sqft: x.sqft, rate: x.r.rate }));
}

/** Adds reserved lines to a sale: a lot already on it gets the reserved slabs ticked and the agreed rate. */
function withReserved(lines: SaleLine[], add: SaleLine[], lots: SlabLot[]): SaleLine[] {
  const out = lines.map((l) => ({ ...l }));
  for (const a of add) {
    const ex = out.find((l) => l.lotId === a.lotId && !l.blockId);
    if (!ex) { out.push(a); continue; }
    const ids = [...new Set([...(ex.slabIds ?? []), ...(a.slabIds ?? [])])];
    const lot = lots.find((l) => l.id === a.lotId);
    ex.slabIds = ids;
    ex.rate = a.rate;
    ex.sqft = Math.round((lot?.slabs ?? []).filter((y) => ids.includes(y.id)).reduce((t, y) => t + y.sqft, 0) * 100) / 100;
  }
  return out;
}

function SaleForm({ ctx, initial, billFor = "", onClose, onSaved }: { ctx: Ctx; initial: Sale | null; billFor?: string; onClose: () => void; onSaved: (s: Sale) => void }) {
  const { db, update } = ctx;
  const C = ctx.costs;
  const customers = db.parties.filter((p) => p.kind === "customer");
  const transporters = db.parties.filter((p) => p.kind === "transporter");
  const nextNo = `${db.settings.invoicePrefix}${String(212 + db.sales.length).padStart(4, "0")}`;
  const [s, setS] = useState<Sale>(() => initial ? structuredClone(initial) : { id: "", invoiceNo: nextNo, date: today(), customerId: billFor, lines: billFor ? reservedLines(db, billFor) : [], freight: 0, vehicleNo: "", ewayBill: "", gstRate: 18, hsn: "6802", paid: false, notes: "" });
  const lotsAvail = db.lots.filter((l) => sellableSqft(l, s.customerId) > 0 || s.lines.some((x) => x.lotId === l.id));
  const resLines = s.customerId ? reservedLines(db, s.customerId) : [];
  const resMissing = resLines.filter((r) => !r.slabIds!.every((id) => s.lines.some((l) => l.lotId === r.lotId && l.slabIds?.includes(id))));
  const resFor = (lot: SlabLot | undefined, id: string) => (lot ? reservedMap(lot).get(id) : undefined);
  const clash = s.lines.flatMap((l) => { const lot = db.lots.find((x) => x.id === l.lotId); return (l.slabIds ?? []).map((id) => ({ lot, id, r: resFor(lot, id) })); }).find((x) => x.r && x.r.customerId !== s.customerId);
  const blocksAvail = db.blocks.filter((b) => inStock(b) || s.lines.some((x) => x.blockId === b.id));
  const sellBlocks = ctx.mods.quarry || ctx.mods.buyBlocks || ctx.mods.imports;
  const orig = useMemo(() => Object.fromEntries((initial?.lines ?? []).filter((l) => l.lotId).map((l) => [l.lotId, l.sqft])), [initial]);
  const avail = (id: string) => (db.lots.find((l) => l.id === id)?.available ?? 0) + (orig[id] ?? 0);
  const c = db.parties.find((p) => p.id === s.customerId);
  const t = saleTotals(s, db.settings.state, c?.state ?? db.settings.state);
  const cost = saleCost(s, db.lots, db.blocks, (l) => lotUnit(ctx.root, l));
  const err = !s.customerId ? "Choose a customer" : !s.lines.length ? "Add at least one lot or block" : s.lines.some((l) => l.slabIds && !l.slabIds.length) ? "Pick the slabs for each lot" : clash ? `Slab ${clash.lot?.slabs?.find((y) => y.id === clash.id)?.no ?? ""} is reserved for ${db.parties.find((p) => p.id === clash.r!.customerId)?.company ?? "another customer"}` : s.lines.some((l) => !l.blockId && l.sqft > avail(l.lotId)) ? "More sq ft than in stock" : "";
  const isBlockSale = s.lines.some((l) => l.blockId);

  const save = () => {
    const out = { ...s, id: s.id || uid() };
    update((d) => {
      for (const l of initial?.lines ?? []) release(d, l);
      for (const l of out.lines) take(d, l, out.id);
      const i = d.sales.findIndex((x) => x.id === out.id);
      if (i >= 0) d.sales[i] = out; else d.sales.push(out);
    });
    onSaved(out);
  };
  const del = () => {
    if (!initial) return;
    update((d) => {
      for (const l of initial.lines) release(d, l);
      d.sales = d.sales.filter((x) => x.id !== initial.id);
    });
    onClose();
  };
  const addBlock = (id: string) => {
    const b = db.blocks.find((x) => x.id === id);
    if (!b) return;
    setS({ ...s, hsn: b.stoneType === "granite" ? "2516" : "2515", gstRate: s.lines.length ? s.gstRate : 5, lines: [...s.lines, { lotId: "", blockId: id, sqft: b.tonnes || b.billedTonnes, rate: 0 }] });
  };

  return (
    <Drawer open wide page title={initial ? `Invoice ${initial.invoiceNo}` : "New sale"} sub={C ? "Pick lots or blocks. Prices below cost are flagged before you bill." : "Pick lots or blocks from stock."} onClose={onClose}
      footer={<><button className="btn btn-primary" disabled={Boolean(err)} onClick={save}>{initial ? "Save" : "Save and view invoice"}</button><button className="btn btn-quiet" onClick={onClose}>Cancel</button>{err && <span className="text-sm text-ink-3">{err}</span>}{initial && <button className="btn btn-quiet btn-sm ml-auto !text-neg" onClick={del}>Cancel invoice</button>}</>}>
      <Section title="Bill to">
        <Grid cols={3}>
          <F label="Customer" span={2} hint={c ? (c.intl ? `Export · ${c.country} · ${c.creditDays} days credit` : `${c.gstin || "No GSTIN"} · ${STATES[c.state] ?? ""} · ${c.creditDays} days credit`) : undefined}><Sel value={s.customerId} onChange={(v) => { const n = db.parties.find((p) => p.id === v); const was = isExport(c); setS({ ...s, customerId: v, ...(n?.intl && !was ? { lut: true, gstRate: 0 } : !n?.intl && was ? { lut: false, gstRate: s.hsn === "6802" ? 18 : 5 } : {}) }); }} placeholder="Choose customer" options={[...customers.filter((p) => !p.intl).map((p) => ({ v: p.id, l: `${p.company} · ${p.city}` })), ...customers.filter((p) => p.intl).map((p) => ({ v: p.id, l: `${p.company} · ${p.country} (export)` }))]} /></F>
          <F label="Invoice date"><TextIn type="date" value={s.date} onChange={(v) => setS({ ...s, date: v })} /></F>
          <F label="Invoice no."><TextIn value={s.invoiceNo} onChange={(v) => setS({ ...s, invoiceNo: v })} /></F>
          <F label="HSN"><Sel value={s.hsn} onChange={(v) => setS({ ...s, hsn: v, gstRate: v === "6802" ? 18 : s.gstRate })} options={[{ v: "6802", l: "6802 · worked slabs & tiles" }, { v: "2515", l: "2515 · marble blocks / rough" }, { v: "2516", l: "2516 · granite blocks / rough" }]} /></F>
          <F label={c?.intl ? "IGST rate" : "GST rate"}>{c?.intl && s.lut ? <div className="field">0% under LUT</div> : <NumIn value={s.gstRate} onChange={(v) => setS({ ...s, gstRate: v })} suffix="%" />}</F>
        </Grid>
        {c?.intl && (
          <div className="mt-3 rounded-2xl bg-surface p-4">
            <div className="font-medium">Export sale to {c.country}</div>
            <label className="mt-2 flex items-start gap-2.5 text-[0.9rem]">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={!!s.lut} onChange={(e) => setS({ ...s, lut: e.target.checked, gstRate: e.target.checked ? 0 : 18 })} />
              <span>Export under LUT, without paying IGST<span className="block text-[0.8rem] text-ink-3">Untick to pay IGST and claim it back as a refund.</span></span>
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <F label="Port of loading"><Sel value={s.port ?? ""} onChange={(v) => setS({ ...s, port: v })} placeholder="Choose port" options={PORTS.map((x) => ({ v: x.name, l: x.name }))} /></F>
              <F label="Shipping bill no." hint="Fill after the CHA files it"><TextIn value={s.sbNo ?? ""} onChange={(v) => setS({ ...s, sbNo: v })} upper /></F>
            </div>
          </div>
        )}
        {resMissing.length > 0 && <div className="mt-3"><Note tone="good"><span className="flex flex-wrap items-center gap-2">{resMissing.reduce((a, r) => a + (r.slabIds?.length ?? 0), 0)} slabs ({n2(resMissing.reduce((a, r) => a + r.sqft, 0))} sq ft) are reserved for this customer.<button type="button" className="btn btn-quiet btn-sm" onClick={() => setS((x) => ({ ...x, lines: withReserved(x.lines.filter((l) => !l.blockId), resLines, db.lots) }))}>Add reserved slabs</button></span></Note></div>}
        {c && checkGstin(c.gstin).ok === false && c.gstin && <div className="mt-3"><Note tone="warn">This customer’s GSTIN looks wrong: {checkGstin(c.gstin).msg}. Fix it in Customers before you file GSTR-1.</Note></div>}
      </Section>
      <Section title={isBlockSale ? "Blocks" : "Slabs"} aside={
        <div className="flex flex-wrap gap-2">
          {!isBlockSale && <Pick onPick={(id) => setS({ ...s, lines: [...s.lines, { lotId: id, sqft: 0, rate: db.lots.find((l) => l.id === id)?.listRate ?? 0, ...(db.lots.find((l) => l.id === id)?.slabs?.length ? { slabIds: [] } : {}) }] })} placeholder="+ Add lot" search="Search lot, block, variety…" empty="No lot matches" options={lotsAvail.filter((l) => !s.lines.some((x) => x.lotId === l.id)).map((l) => { const bno = ctx.root.blocks.find((b) => b.id === l.blockId)?.no; return { v: l.id, l: `${l.lotNo} · ${l.variety} ${l.thicknessMm} mm`, sub: `${l.slabs?.length ? freeCount(l) : slabCount(l)} slabs · ${n0(sellableSqft(l, s.customerId))} sq ft${bno ? ` · block ${bno}` : ""} · ${l.site === "depot" ? "depot" : "unit"} ${l.location}`, find: `${bno ?? ""} ${l.finish} ${l.grade}` }; })} />}
          {sellBlocks && (isBlockSale || !s.lines.length) && <Pick onPick={addBlock} placeholder="+ Add block" search="Search block, variety…" empty="No block matches" options={blocksAvail.filter((b) => !s.lines.some((x) => x.blockId === b.id)).map((b: Block) => ({ v: b.id, l: `${b.no} · ${b.variety}`, sub: `${n2(b.tonnes || b.billedTonnes)} t · ${STATUS_LABEL[b.status]}` }))} />}
        </div>}>
        {!s.lines.length && <div className="rounded-xl bg-surface px-4 py-6 text-center text-ink-3">Add a lot{sellBlocks ? " or a block" : ""} from the list above.</div>}
        <div className="space-y-2">
          {s.lines.map((ln, i) => {
            const lot = db.lots.find((l) => l.id === ln.lotId);
            const b = db.blocks.find((x) => x.id === ln.blockId);
            const unitCost = b ? blockCost(b) / Math.max(0.01, ln.sqft) : lot ? lotUnit(ctx.root, lot) : 0;
            const below = C && ln.rate > 0 && ln.rate < unitCost;
            return (
              <div key={ln.lotId || ln.blockId} className="grid items-end gap-2 rounded-xl bg-surface p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                {b ? <div><div className="font-medium">Block {b.no} · {b.variety}</div><div className="text-[0.8rem] text-ink-3">{b.l}×{b.w}×{b.h} cm{C ? ` · cost ${rs(unitCost)}/t` : ""}</div></div>
                  : <div><div className="font-medium">{lot?.lotNo} · {lot?.variety}</div><div className="text-[0.8rem] text-ink-3">{lot?.thicknessMm} mm {lot?.finish} · {n0(lot?.slabs?.length ? sellableSqft(lot, s.customerId) : avail(ln.lotId))} sq ft available{C && lot ? ` · cost ${rs2(lotUnit(ctx.root, lot))}` : ""}</div></div>}
                {lot?.slabs?.length ? <F label="Sq ft"><div className="field num">{n2(ln.sqft)}</div></F> : <F label={b ? "Tonnes" : "Sq ft"} err={!b && ln.sqft > avail(ln.lotId) ? "Exceeds stock" : undefined}><NumIn value={ln.sqft} onChange={(v) => setS({ ...s, lines: s.lines.map((x, j) => j === i ? { ...x, sqft: v } : x) })} /></F>}
                <F label="Rate" err={below ? "Below cost" : undefined}><NumIn value={ln.rate} onChange={(v) => setS({ ...s, lines: s.lines.map((x, j) => j === i ? { ...x, rate: v } : x) })} suffix={b ? "₹/t" : "₹/sq ft"} /></F>
                <button className="btn btn-quiet btn-sm !px-2" aria-label="Remove line" onClick={() => setS({ ...s, lines: s.lines.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
                {lot?.slabs?.length ? <SlabPick lot={lot} saleId={s.id} customerId={s.customerId} line={ln} onChange={(slabIds) => setS({ ...s, lines: s.lines.map((x, j) => j === i ? { ...x, slabIds, sqft: Math.round(lot.slabs!.filter((y) => slabIds.includes(y.id)).reduce((a, y) => a + y.sqft, 0) * 100) / 100 } : x) })} /> : null}
              </div>
            );
          })}
        </div>
      </Section>
      <Section title="Dispatch">
        <Grid cols={3}>
          <F label="Freight charged"><NumIn value={s.freight} onChange={(v) => setS({ ...s, freight: v })} suffix="₹" /></F>
          <F label="Vehicle no."><TextIn value={s.vehicleNo} onChange={(v) => setS({ ...s, vehicleNo: v })} upper /></F>
          <F label="Distance" hint={c?.intl ? "Up to the port, for the e-way bill" : "For the e-way bill"}><NumIn value={s.distanceKm ?? 0} onChange={(v) => setS({ ...s, distanceKm: v })} suffix="km" /></F>
          <F label="Transporter" span={2}><Sel value={s.transporterId ?? ""} onChange={(v) => setS({ ...s, transporterId: v })} placeholder="Own vehicle / not set" options={transporters.map((p) => ({ v: p.id, l: `${p.company}${p.gstin ? ` · ${p.gstin}` : ""}` }))} /></F>
          <F label="e-Way bill no."><TextIn value={s.ewayBill} onChange={(v) => setS({ ...s, ewayBill: v })} /></F>
          <F label="Notes" span={3}><Area value={s.notes} onChange={(v) => setS({ ...s, notes: v })} /></F>
        </Grid>
      </Section>
      <Section title="Totals">
        <div className="rounded-2xl bg-surface p-4 text-[0.9rem]">
          <Row l="Taxable value" v={rs(t.taxable)} />
          {t.inter ? <Row l={`IGST ${s.gstRate}%`} v={rs(t.igst)} /> : <><Row l={`CGST ${s.gstRate / 2}%`} v={rs(t.cgst)} /><Row l={`SGST ${s.gstRate / 2}%`} v={rs(t.sgst)} /></>}
          <div className="mt-1 flex justify-between border-t border-surface-2 pt-2 font-semibold"><span>Invoice total</span><span className="num">{rs(t.total)}</span></div>
          {C && <div className="mt-1 flex justify-between text-ink-2"><span>Stock cost · margin</span><span className="num">{rs(cost)} · {t.taxable - s.freight ? `${Math.round(((t.taxable - s.freight - cost) / (t.taxable - s.freight)) * 100)}%` : "—"}</span></div>}
          {t.taxable > 50000 && !s.ewayBill && <div className="mt-3"><Note tone="warn">Goods above ₹50,000 need an e-way bill before the vehicle leaves. Make the file from the invoice screen after saving.</Note></div>}
        </div>
      </Section>
    </Drawer>
  );
}

const Row = ({ l, v }: { l: string; v: string }) => <div className="flex justify-between py-1 text-ink-2"><span>{l}</span><span className="num text-ink">{v}</span></div>;

function dl(name: string, data: unknown) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function EDocs({ ctx, sale }: { ctx: Ctx; sale: Sale }) {
  const { db, update } = ctx;
  const p = db.parties.find((x) => x.id === sale.customerId);
  const t = saleTotals(sale, db.settings.state, p?.state ?? db.settings.state);
  const can = ctx.edit("sales");
  const [irn, setIrn] = useState(sale.irn ?? "");
  const [ack, setAck] = useState(sale.ackNo ?? "");
  const [ackDate, setAckDate] = useState(sale.ackDate ?? "");
  const [ewb, setEwb] = useState(sale.ewayBill ?? "");
  const pe = checks(db, sale, p, "einv");
  const pw = checks(db, sale, p, "ewb");
  const safe = sale.invoiceNo.replace(/[^\w-]+/g, "_");
  const save = () => update((d) => { const x = d.sales.find((y) => y.id === sale.id); if (x) { x.irn = irn.trim(); x.ackNo = ack.trim(); x.ackDate = ackDate; x.ewayBill = ewb.trim(); } });
  return (
    <div className="no-print mb-5 rounded-2xl bg-surface p-4">
      <div className="font-medium">GST e-invoice and e-way bill</div>
      <p className="mt-1 text-[0.86rem] text-ink-2">Download the file, upload it on the government portal or through your GST software, then type the numbers you get back.{t.taxable > 50000 ? " This invoice is above ₹50,000, so the vehicle needs an e-way bill." : ""}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <button className="btn btn-quiet btn-sm" disabled={pe.length > 0} onClick={() => dl(`einvoice_${safe}.json`, [eInvoice(db, sale)])}><Download size={14} />e-Invoice file (IRP 1.1)</button>
          {pe.length > 0 && <ul className="mt-2 list-disc pl-5 text-[0.8rem] text-warn">{pe.map((x) => <li key={x}>{x}</li>)}</ul>}
          <p className="mt-1.5 text-[0.78rem] text-ink-3">Needed when your turnover crossed ₹5 crore in any year since 2017-18. With vehicle and distance filled, the IRN also makes the e-way bill.</p>
        </div>
        <div>
          <button className="btn btn-quiet btn-sm" disabled={pw.length > 0} onClick={() => dl(`ewaybill_${safe}.json`, eWayBill(db, sale))}><Download size={14} />e-Way bill file</button>
          {pw.length > 0 && <ul className="mt-2 list-disc pl-5 text-[0.8rem] text-warn">{pw.map((x) => <li key={x}>{x}</li>)}</ul>}
          <p className="mt-1.5 text-[0.78rem] text-ink-3">For ewaybillgst.gov.in → e-Waybill → Generate Bulk. Use it when the invoice is not e-invoiced.</p>
        </div>
      </div>
      {can && (
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <F label="IRN"><TextIn value={irn} onChange={setIrn} /></F>
          <F label="Ack no."><TextIn value={ack} onChange={setAck} /></F>
          <F label="Ack date"><TextIn type="date" value={ackDate} onChange={setAckDate} /></F>
          <F label="e-Way bill no."><TextIn value={ewb} onChange={setEwb} /></F>
        </div>
      )}
      {can && <button className="btn btn-primary btn-sm mt-3" onClick={() => { save(); ctx.say("Saved on the invoice", "good"); }}>Save numbers</button>}
    </div>
  );
}

function Invoice({ ctx, sale, onClose }: { ctx: Ctx; sale: Sale; onClose: () => void }) {
  const { db } = ctx;
  const S = db.settings;
  const c = db.parties.find((p) => p.id === sale.customerId) as Party | undefined;
  const t = saleTotals(sale, S.state, c?.state ?? S.state);
  return (
    <Drawer open wide title={`${c?.intl ? "Export" : "Tax"} invoice ${sale.invoiceNo}`} onClose={onClose}
      footer={<><button className="btn btn-primary" onClick={() => window.print()}><Printer size={15} />Print or save PDF</button><button className="btn btn-quiet" onClick={onClose}>Close</button></>}>
      <EDocs ctx={ctx} sale={sale} />
      <div className="print-area rounded-2xl bg-white p-6 text-[13px] text-black">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/15 pb-4">
          <div>
            <div className="text-lg font-bold">{S.company}</div>
            <div>{S.address}</div>
            <div>{S.city}{S.pincode ? ` ${S.pincode}` : ""}, {STATES[S.state]}</div>
            <div>GSTIN: {S.gstin}</div>
          </div>
          <div className="text-right">
            <div className="text-base font-bold">{c?.intl ? "EXPORT INVOICE" : "TAX INVOICE"}</div>
            <div>No. {sale.invoiceNo}</div>
            <div>Date {dmy(sale.date)}</div>
            <div>Place of supply: {c?.intl ? `Outside India · ${c.country} (96)` : `${STATES[c?.state ?? S.state]} (${c?.state ?? S.state})`}</div>
          </div>
        </div>
        {sale.irn && <div className="border-b border-black/15 py-2 text-[11px]"><b>IRN</b> {sale.irn}{sale.ackNo ? ` · Ack ${sale.ackNo}` : ""}{sale.ackDate ? ` dt ${dmy(sale.ackDate)}` : ""}</div>}
        <div className="grid gap-4 border-b border-black/15 py-4 sm:grid-cols-2">
          <div>
            <div className="font-semibold">Bill to</div>
            <div>{c?.company}</div>
            <div>{c?.billing}{c?.city ? `, ${c.city}` : ""}{c?.pincode ? ` ${c.pincode}` : ""}</div>
            {c?.intl ? <div>{c.country}{c.pan ? ` · Tax no. ${c.pan}` : ""}</div> : <div>GSTIN: {c?.gstin || "Unregistered"}</div>}
            {c?.phone && <div>Ph: {c.phone}</div>}
          </div>
          <div>
            <div className="font-semibold">Ship to</div>
            <div>{c?.shipping || `${c?.billing ?? ""}${c?.city ? `, ${c.city}` : ""}`}</div>
            <div>Vehicle: {sale.vehicleNo || "—"}</div>
            <div>e-Way bill: {sale.ewayBill || "—"}</div>
            {c?.intl && <div>Port of loading: {sale.port || "—"}{sale.sbNo ? ` · SB ${sale.sbNo}` : ""}</div>}
          </div>
        </div>
        {c?.intl && <div className="border-b border-black/15 py-2 font-semibold">{sale.lut ? "Supply meant for export under LUT without payment of IGST" : "Supply meant for export on payment of IGST"}</div>}
        <table className="mt-3 w-full">
          <thead><tr className="border-b border-black/15 text-left"><th className="py-1.5">#</th><th>Description</th><th>HSN</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            {sale.lines.map((l, i) => {
              const lot = db.lots.find((x) => x.id === l.lotId);
              const b = db.blocks.find((x) => x.id === l.blockId);
              const desc = b ? `${b.variety} ${b.stoneType} rough block no. ${b.no}, ${b.l}×${b.w}×${b.h} cm` : `${lot?.variety} ${lot?.stoneType} slabs, ${lot?.thicknessMm} mm ${lot?.finish?.toLowerCase()} (lot ${lot?.lotNo}${l.slabIds?.length ? `; ${l.slabIds.length} slab${l.slabIds.length > 1 ? "s" : ""}: ${slabRange(lot?.slabs?.filter((x) => l.slabIds!.includes(x.id)).map((x) => x.no) ?? [])}` : ""})`;
              return <tr key={l.lotId || l.blockId} className="border-b border-black/10"><td className="py-1.5">{i + 1}</td><td>{desc}</td><td>{sale.hsn}</td><td className="whitespace-nowrap pl-2 text-right">{b ? n2(l.sqft) : n0(l.sqft)} {qtyUnit(l)}</td><td className="whitespace-nowrap pl-2 text-right">{rs2(l.rate)}</td><td className="whitespace-nowrap pl-2 text-right">{rs2(l.sqft * l.rate)}</td></tr>;
            })}
            {sale.freight > 0 && <tr className="border-b border-black/10"><td className="py-1.5" /><td>Freight</td><td>9965</td><td /><td /><td className="text-right">{rs2(sale.freight)}</td></tr>}
          </tbody>
        </table>
        <div className="ml-auto mt-3 w-full max-w-xs space-y-1">
          <div className="flex justify-between"><span>Taxable value</span><span>{rs2(t.taxable)}</span></div>
          {t.inter ? <div className="flex justify-between"><span>IGST @ {sale.gstRate}%</span><span>{rs2(t.igst)}</span></div> : <><div className="flex justify-between"><span>CGST @ {sale.gstRate / 2}%</span><span>{rs2(t.cgst)}</span></div><div className="flex justify-between"><span>SGST @ {sale.gstRate / 2}%</span><span>{rs2(t.sgst)}</span></div></>}
          <div className="flex justify-between border-t border-black/20 pt-1 text-base font-bold"><span>Total</span><span>{rs(t.total)}</span></div>
        </div>
        <div className="mt-3 italic">{inWords(t.total)}</div>
        <div className="mt-8 flex justify-between text-[12px]">
          <div>Goods once sold will not be taken back. Subject to {S.city || "local"} jurisdiction.</div>
          <div className="text-right">For {S.company}<div className="mt-8">Authorised signatory</div></div>
        </div>
      </div>
    </Drawer>
  );
}
