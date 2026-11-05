"use client";
import { useEffect, useMemo, useState } from "react";
import { PackagePlus, Plus, Trash2 } from "lucide-react";
import { baseCost, cbm, daysSince, dmy, lakh, n0, n2, r2, rs, rs2, today, uid, weightGap } from "@/lib/stone/calc";
import { nextBlockNo, qualities, qualityOf, split } from "@/lib/stone/costing";
import { emptyBlock } from "@/lib/stone/seed";
import type { Block, BlockStatus, Grade, ImportBill, SlabLot, StoneType } from "@/lib/stone/types";
import type { Ctx } from "./StoneApp";
import { STATUS_LABEL } from "./BlockForm";
import { BuyForm } from "./Depot";
import { Area, Badge, Drawer, F, Grid, Note, NumIn, Pick, Section, Sel, Seg, Stat, Table, TextIn, setUrlTab, type Col } from "./ui";

type Tab = "domestic" | "import" | "slabs";
export type Bill = { id: string; blocks: Block[]; imp: boolean };

const STONES: StoneType[] = ["marble", "granite", "sandstone", "quartzite", "onyx", "other"];
const GRADES: Grade[] = ["A", "B", "C", "Commercial"];
const CHARGES = ["Customs duty", "CHA charges", "Port, CFS & line charges", "Freight port to yard", "Insurance", "Other"];
/** Blocks still at the purchase stage; once on the saw, sawn or sold their status is no longer the bill's. */
const EARLY: BlockStatus[] = ["in_transit", "in_yard"];

/** Bought and imported blocks grouped by the bill they came on. Blocks entered one by one before bills each make their own. */
export function bills(blocks: Block[]): Bill[] {
  const m = new Map<string, Block[]>();
  for (const b of blocks) if (b.source !== "own_mine") m.set(b.purchaseId || b.id, [...(m.get(b.purchaseId || b.id) ?? []), b]);
  return [...m.entries()].map(([id, bs]) => ({ id, blocks: bs, imp: bs[0].source === "import" })).sort((a, b) => (b.blocks[0].date || "").localeCompare(a.blocks[0].date || ""));
}

export default function Purchases({ ctx }: { ctx: Ctx }) {
  const { db } = ctx;
  const C = ctx.costs;
  const blocksOk = ctx.can("blocks") !== "none" && (ctx.mods.buyBlocks || ctx.mods.imports || ctx.mods.processing);
  const slabsOk = ctx.can("stock") !== "none" && (ctx.mods.trading || ctx.mods.depot);
  const allowed: Tab[] = [...(blocksOk ? (["domestic", "import"] as Tab[]) : []), ...(slabsOk ? (["slabs"] as Tab[]) : [])];
  // A dashboard shortcut sends "domestic:new" etc. to open the form straight away
  const [sub0, act] = ctx.sub.split(":");
  const [tabRaw, setTab] = useState<Tab>((sub0 as Tab) || allowed[0] || "domestic");
  const tab: Tab = allowed.includes(tabRaw) ? tabRaw : allowed[0] ?? "domestic";
  const [open, setOpen] = useState<Bill | "new" | null>(act === "new" && tab !== "slabs" && ctx.edit("blocks") ? "new" : null);
  const [buy, setBuy] = useState(act === "new" && tab === "slabs" && ctx.edit("stock"));
  useEffect(() => { if (act) setUrlTab(sub0); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const sup = (id: string) => ctx.root.parties.find((p) => p.id === id);

  const all = useMemo(() => bills(db.blocks), [db.blocks]);
  const rows = all.filter((x) => (tab === "import") === x.imp);
  const slabLots = db.lots.filter((l) => l.source === "purchase");
  const month = all.filter((x) => daysSince(x.blocks[0].date) <= 30);
  const onRoad = db.blocks.filter((b) => b.source !== "own_mine" && b.status === "in_transit");
  const short = db.blocks.filter((b) => b.source !== "own_mine" && weightGap(b) > 0.02 && b.status !== "rejected");
  const val = (x: Bill) => x.blocks.reduce((a, b) => a + baseCost(b), 0);

  const cols: Col<Bill>[] = [
    { key: "d", label: "Date", render: (x) => dmy(x.blocks[0].date), sort: (x) => x.blocks[0].date },
    { key: "s", label: "Supplier", render: (x) => <div><div className="font-medium">{sup(x.blocks[0].supplierId)?.company ?? (x.imp ? x.blocks[0].mine || "Import" : "—")}</div><div className="text-[0.8rem] text-ink-3">{x.imp ? `BL ${(x.blocks[0].imp || null)?.blNo || "pending"}` : x.blocks[0].invoiceNo || "No bill no."}{!x.imp && x.blocks[0].mine ? ` · ${x.blocks[0].mine}` : ""}</div></div>, sort: (x) => sup(x.blocks[0].supplierId)?.company ?? "" },
    { key: "q", label: "Quality", render: (x) => [...new Set(x.blocks.map((b) => b.variety))].join(", ") },
    { key: "n", label: "Blocks", align: "right", render: (x) => <div><div>{x.blocks.length}</div><div className="max-w-[18ch] truncate text-[0.78rem] text-ink-3">{x.blocks.map((b) => b.no).join(", ")}</div></div>, sort: (x) => x.blocks.length },
    { key: "bt", label: "Billed", align: "right", render: (x) => `${n2(x.blocks.reduce((a, b) => a + b.billedTonnes, 0))} t` },
    { key: "rt", label: "Received", align: "right", render: (x) => { const r = x.blocks.reduce((a, b) => a + b.tonnes, 0); const bt = x.blocks.reduce((a, b) => a + b.billedTonnes, 0); return r ? <span className={bt && (bt - r) / r > 0.02 ? "text-warn" : ""}>{n2(r)} t</span> : <span className="text-ink-3">Not yet</span>; } },
    ...(C ? [{ key: "v", label: "Value", align: "right" as const, render: (x: Bill) => rs(val(x)), sort: (x: Bill) => val(x) }] : []),
    { key: "st", label: "Status", render: (x) => { const road = x.blocks.filter((b) => b.status === "in_transit").length; return road ? <Badge tone="warn">{road} on the road</Badge> : <Badge tone="good">Received</Badge>; } },
  ];
  const lotCols: Col<SlabLot>[] = [
    { key: "d", label: "Date", render: (l) => dmy(l.createdAt), sort: (l) => l.createdAt },
    { key: "s", label: "Supplier", render: (l) => <div><div className="font-medium">{sup(l.supplierId ?? "")?.company ?? "—"}</div><div className="text-[0.8rem] text-ink-3">{l.invoiceNo || "No bill no."}</div></div> },
    { key: "l", label: "Lot", render: (l) => <div><div className="font-medium">{l.lotNo}</div><div className="text-[0.8rem] text-ink-3">{l.variety} · {l.thicknessMm} mm {l.finish}</div></div> },
    { key: "q", label: "Sq ft", align: "right", render: (l) => n0(l.sqft) },
    ...(C ? [{ key: "c", label: "Landed ₹/sq ft", align: "right" as const, render: (l: SlabLot) => rs2(l.sqft ? l.cost / l.sqft : 0) }] : []),
  ];

  if (open) return <PurchaseForm ctx={ctx} bill={open === "new" ? null : open} imp={open === "new" ? tab === "import" : open.imp} onClose={() => setOpen(null)} />;
  if (buy) return <BuyForm ctx={ctx} onClose={() => setBuy(false)} />;
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {C ? <Stat label="Bought, last 30 days" value={lakh(month.reduce((a, x) => a + val(x), 0))} sub={`${month.length} bills · ${month.reduce((a, x) => a + x.blocks.length, 0)} blocks`} /> : <Stat label="Bills, last 30 days" value={`${month.length}`} sub={`${month.reduce((a, x) => a + x.blocks.length, 0)} blocks`} />}
        <Stat label="On the road" value={`${onRoad.length} blocks`} sub={`${n0(onRoad.reduce((a, b) => a + b.billedTonnes, 0))} t billed, not yet received`} tone={onRoad.length ? "warn" : undefined} />
        <Stat label="Short weight" value={`${short.length} blocks`} sub={short.length ? `${n2(short.reduce((a, b) => a + b.billedTonnes - b.tonnes, 0))} t less than billed` : "Received matches the bills"} tone={short.length ? "warn" : undefined} />
        <Stat label="Import bills" value={`${all.filter((x) => x.imp).length}`} sub={`${all.filter((x) => !x.imp).length} domestic`} />
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Seg value={tab} onChange={setTab} tabs={([
          { key: "domestic", label: "Domestic", count: all.filter((x) => !x.imp).length },
          { key: "import", label: "Import", count: all.filter((x) => x.imp).length },
          { key: "slabs", label: "Slabs bought", count: slabLots.length },
        ] as { key: Tab; label: string; count: number }[]).filter((t) => allowed.includes(t.key))} />
        <div className="ml-auto flex gap-2">
          {tab !== "slabs" && ctx.edit("blocks") && <button className="btn btn-primary btn-sm" onClick={() => setOpen("new")}><Plus size={15} />{tab === "import" ? "New import purchase" : "New purchase"}</button>}
          {tab === "slabs" && ctx.edit("stock") && <button className="btn btn-primary btn-sm" onClick={() => setBuy(true)}><PackagePlus size={15} />Slabs bought</button>}
        </div>
      </div>
      <div className="mt-4">
        {tab !== "slabs" && <Table rows={rows} cols={cols} onRow={setOpen} search={(x) => `${sup(x.blocks[0].supplierId)?.company ?? ""} ${x.blocks.map((b) => `${b.no} ${b.variety} ${b.vehicleNo}`).join(" ")} ${x.blocks[0].invoiceNo} ${(x.blocks[0].imp || null)?.blNo ?? ""}`} empty={tab === "import" ? "No import purchases yet. Add the overseas supplier under Masters → Suppliers as Import first." : "No purchases yet."} />}
        {tab === "slabs" && <Table rows={[...slabLots].reverse()} cols={lotCols} search={(l) => `${l.lotNo} ${l.variety} ${l.invoiceNo ?? ""} ${sup(l.supplierId ?? "")?.company ?? ""}`} empty="No slabs bought yet." />}
      </div>
    </div>
  );
}

type Line = { id: string; quality: string; no: string; auto: boolean; stoneType: StoneType; grade: Grade; billed: number; received: number; l: number; w: number; h: number; rate: number; old?: Block };
type Head = {
  supplierId: string; date: string; invoiceNo: string; mine: string; leaseNo: string; rateBasis: Block["rateBasis"];
  eRawanna: string; royalty: number; dmft: number; ewayBill: string;
  vehicleNo: string; driver: string; driverPhone: string; transporterId: string; freight: number; loading: number; otherCost: number;
  status: "in_transit" | "in_yard"; receivedOn: string; weighSlip: string; defects: string; notes: string; imp: ImportBill;
};

const emptyImp = (): ImportBill => ({ blNo: "", blDate: "", vessel: "", port: "", cif: 0, charges: [] });

function PurchaseForm({ ctx, bill, imp, onClose }: { ctx: Ctx; bill: Bill | null; imp: boolean; onClose: () => void }) {
  const { db, update } = ctx;
  const C = ctx.costs;
  const S = db.settings;
  const can = ctx.edit("blocks");
  const suppliers = db.parties.filter((p) => p.kind === "supplier" && !!p.intl === imp);
  const transporters = db.parties.filter((p) => p.kind === "transporter");
  const quals = qualities(db);
  const sum = (k: "royalty" | "dmft" | "freight" | "loading" | "otherCost") => (bill?.blocks ?? []).reduce((a, b) => a + (b[k] || 0), 0);
  const [h, setH] = useState<Head>(() => {
    const f = bill?.blocks[0];
    const old = f?.imp || null;
    return {
      supplierId: f?.supplierId ?? "", date: f?.date || today(), invoiceNo: f?.invoiceNo ?? "", mine: f?.mine ?? "", leaseNo: f?.leaseNo ?? "", rateBasis: f?.rateBasis ?? (imp ? "cbm" : "tonne"),
      eRawanna: f?.eRawanna ?? "", royalty: sum("royalty"), dmft: sum("dmft"), ewayBill: f?.ewayBill ?? "",
      vehicleNo: f?.vehicleNo ?? "", driver: f?.driver ?? "", driverPhone: f?.driverPhone ?? "", transporterId: f?.transporterId ?? "", freight: sum("freight"), loading: sum("loading"), otherCost: sum("otherCost"),
      status: f && f.status !== "in_transit" ? "in_yard" : "in_transit", receivedOn: f?.receivedOn ?? "", weighSlip: f?.weighSlip ?? "", defects: "", notes: f?.notes ?? "",
      // Import blocks entered before bills: their landed cost becomes one charge, so nothing is lost.
      imp: old ? structuredClone(old) : f && imp ? { ...emptyImp(), charges: [{ label: "Landed cost", amount: bill!.blocks.reduce((a, b) => a + b.importCost, 0), note: "Entered before" }] } : emptyImp(),
    };
  });
  const [lines, setLines] = useState<Line[]>(() => bill
    ? bill.blocks.map((b) => ({ id: b.id, quality: b.variety, no: b.no, auto: false, stoneType: b.stoneType, grade: b.grade, billed: b.billedTonnes, received: b.tonnes, l: b.l, w: b.w, h: b.h, rate: b.rate, old: b }))
    : [{ id: uid(), quality: "", no: "", auto: true, stoneType: "marble", grade: "A", billed: 0, received: 0, l: 0, w: 0, h: 0, rate: 0 }]);
  const [err, setErr] = useState("");
  const setHd = <K extends keyof Head>(k: K, v: Head[K]) => setH((x) => ({ ...x, [k]: v }));
  const setLine = (i: number, p: Partial<Line>) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const supplier = db.parties.find((p) => p.id === h.supplierId);
  const mines = supplier?.mines ?? [];

  // Block nos. for lines set to auto, worked out in order so two new lines never get the same one.
  const nos = useMemo(() => {
    const taken = lines.filter((x) => !x.auto).map((x) => x.no);
    const others = db.blocks.filter((b) => !lines.some((x) => x.id === b.id));
    return lines.map((x) => { if (!x.auto) return x.no; const n = nextBlockNo({ ...db, blocks: others }, x.quality || "Block", taken); taken.push(n); return n; });
  }, [lines, db]);

  const pickSupplier = (id: string) => {
    const p = db.parties.find((x) => x.id === id);
    const ms = p?.mines ?? [];
    setH((x) => ({ ...x, supplierId: id, mine: ms.length === 1 ? ms[0] : ms.includes(x.mine) ? x.mine : "" }));
  };
  const addLine = () => setLines((ls) => [...ls, { id: uid(), quality: ls[ls.length - 1]?.quality ?? "", no: "", auto: true, stoneType: ls[ls.length - 1]?.stoneType ?? "marble", grade: "A", billed: 0, received: 0, l: 0, w: 0, h: 0, rate: ls[ls.length - 1]?.rate ?? 0 }]);
  const locked = (x: Line) => !!x.old && !EARLY.includes(x.old.status);

  const weights = lines.map((x) => x.received || x.billed || (x.l * x.w * x.h) / 1e6);
  const landedTotal = h.imp.cif + h.imp.charges.reduce((a, c) => a + c.amount, 0);
  const valueOf = (x: Line) => x.rate * (h.rateBasis === "cbm" ? cbm(x) : x.received || x.billed);
  const stone = imp ? landedTotal : lines.reduce((a, x) => a + valueOf(x), 0);
  const total = stone + (imp ? 0 : h.royalty + h.dmft) + h.freight + h.loading + h.otherCost;
  const tonnes = lines.reduce((a, x) => a + (x.received || x.billed), 0);
  const suggestRoyalty = Math.round(lines.reduce((a, x) => a + x.billed, 0) * S.royaltyPerTonne);

  const save = () => {
    if (!h.supplierId) return setErr("Choose the supplier.");
    if (!lines.length) return setErr("Add at least one block.");
    if (lines.some((x) => !x.quality.trim())) return setErr("Pick the quality on every line.");
    if (lines.some((x) => !x.billed && !x.received)) return setErr("Enter the billed quantity on every line.");
    const clash = nos.find((n, i) => !n.trim() || nos.indexOf(n) !== i || db.blocks.some((b) => b.no.trim().toLowerCase() === n.trim().toLowerCase() && !lines.some((x) => x.id === b.id)));
    if (clash !== undefined) return setErr(clash.trim() ? `Block ${clash} is already in your register.` : "Enter a block no. or tick Auto.");
    const pid = bill?.blocks[0]?.purchaseId || bill?.id || uid();
    const share = (amt: number) => split(amt, weights);
    const roy = share(imp ? 0 : h.royalty), dm = share(imp ? 0 : h.dmft), fr = share(h.freight), ld = share(h.loading), ot = share(h.otherCost), ic = share(imp ? landedTotal : 0);
    const out: Block[] = lines.map((x, i) => {
      const b: Block = x.old ? structuredClone(x.old) : { ...emptyBlock(), id: x.id };
      const q = qualityOf(db, x.quality);
      Object.assign(b, {
        no: nos[i].trim().toUpperCase(), variety: x.quality.trim(), stoneType: q?.stoneType ?? x.stoneType, grade: x.grade, billedTonnes: x.billed, tonnes: x.received, l: x.l, w: x.w, h: x.h,
        source: imp ? "import" : "purchase", supplierId: h.supplierId, mine: imp ? supplier?.country ?? "" : h.mine, leaseNo: h.leaseNo, date: h.date, invoiceNo: h.invoiceNo,
        rate: imp ? 0 : x.rate, rateBasis: h.rateBasis, royalty: roy[i], dmft: dm[i], eRawanna: h.eRawanna, ewayBill: h.ewayBill,
        vehicleNo: h.vehicleNo, driver: h.driver, driverPhone: h.driverPhone, transporterId: h.transporterId, freight: fr[i], loading: ld[i], otherCost: ot[i],
        importCost: ic[i], imp: imp ? structuredClone(h.imp) : undefined, weighSlip: h.weighSlip, notes: h.notes, purchaseId: pid,
      } satisfies Partial<Block>);
      if (!b.imp) delete b.imp;
      if (!x.old && h.defects) b.defects = h.defects;
      if (!locked(x)) {
        b.status = x.received > 0 || h.status === "in_yard" ? "in_yard" : "in_transit";
        if (b.status === "in_yard" && !b.receivedOn) b.receivedOn = h.receivedOn || today();
        if (b.status === "in_transit") b.receivedOn = "";
      }
      return b;
    });
    const gone = (bill?.blocks ?? []).filter((b) => !lines.some((x) => x.id === b.id)).map((b) => b.id);
    update((d) => {
      d.blocks = d.blocks.filter((b) => !gone.includes(b.id));
      for (const b of out) { const i = d.blocks.findIndex((x) => x.id === b.id); if (i >= 0) d.blocks[i] = b; else d.blocks.push(b); }
    });
    ctx.say(bill ? "Purchase saved" : `${out.length} block${out.length > 1 ? "s" : ""} added from ${supplier?.company ?? "the supplier"}`, "good");
    onClose();
  };
  const del = () => {
    if (!bill) return;
    update((d) => { d.blocks = d.blocks.filter((b) => !bill.blocks.some((x) => x.id === b.id)); });
    onClose();
  };
  const canDelete = !!bill && bill.blocks.every((b) => EARLY.includes(b.status));

  return (
    <Drawer open wide page title={bill ? `${imp ? "Import purchase" : "Purchase"} · ${supplier?.company ?? ""}` : imp ? "New import purchase" : "New purchase"} sub="One bill, one or more blocks. Costing follows the weight received; until then, the billed weight." onClose={onClose}
      footer={can ? <><button className="btn btn-primary" onClick={save}>{bill ? "Save" : `Add ${lines.length} block${lines.length > 1 ? "s" : ""}`}</button><button className="btn btn-quiet" onClick={onClose}>Cancel</button>{err && <span className="text-sm text-neg">{err}</span>}{canDelete && <button className="btn btn-quiet btn-sm ml-auto !text-neg" onClick={del}><Trash2 size={14} />Delete purchase</button>}</> : <button className="btn btn-quiet" onClick={onClose}>Close</button>}>
      <Section title="Supplier">
        <Grid cols={3}>
          <F box label="Supplier *" span={2} hint={!suppliers.length ? `Add ${imp ? "an import" : "a domestic"} supplier under Masters → Suppliers first.` : supplier ? [supplier.city, supplier.intl ? supplier.country : supplier.gstin].filter(Boolean).join(" · ") : undefined}>
            <Pick align="left" onPick={pickSupplier} placeholder={supplier ? supplier.company : "Choose supplier"} empty="No supplier matches" options={suppliers.map((p) => ({ v: p.id, l: p.company, sub: [p.city, p.intl ? p.country : (p.mines ?? []).join(", ")].filter(Boolean).join(" · ") }))} />
          </F>
          <F label="Date" hint="Today unless you change it"><TextIn type="date" value={h.date} onChange={(v) => setHd("date", v)} /></F>
          {!imp && (mines.length > 1
            ? <F label="Mine" span={2}><Sel value={h.mine} onChange={(v) => setHd("mine", v)} placeholder="Choose the mine" options={mines.map((m) => ({ v: m, l: m }))} /></F>
            : <F label="Mine" span={2} hint={mines.length === 1 ? "The supplier's only mine" : "Optional. Add the supplier's mines in Masters to pick from a list"}><TextIn value={h.mine} onChange={(v) => setHd("mine", v)} placeholder="Ulodi quarry, Makrana" /></F>)}
          {!imp && <F label="Lease / quarry licence no."><TextIn value={h.leaseNo} onChange={(v) => setHd("leaseNo", v)} upper placeholder="ML 41/2009" /></F>}
        </Grid>
      </Section>

      <Section title={`Blocks · ${lines.length}`} aside={can && <button className="btn btn-quiet btn-sm" onClick={addLine}><Plus size={14} />Add quality / block</button>}>
        {!quals.length && <div className="mb-3"><Note>Add your stone qualities under Masters → Quality to pick them here.</Note></div>}
        <div className="space-y-2.5">
          {lines.map((x, i) => (
            <div key={x.id} className="rounded-2xl bg-surface p-3">
              <div className="grid items-end gap-2 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_auto]">
                <F box label="Quality *"><Pick align="left" onPick={(v) => setLine(i, { quality: v, stoneType: qualityOf(db, v)?.stoneType ?? x.stoneType })} placeholder={x.quality || "Choose quality"} empty="No quality matches" options={quals.map((q) => ({ v: q, l: q, sub: qualityOf(db, q)?.stoneType }))} /></F>
                <F box label="Block no.">
                  <div className="flex items-center gap-2">
                    {x.auto ? <div className="field num flex-1 text-ink-2">{nos[i]}</div> : <div className="flex-1"><TextIn value={x.no} onChange={(v) => setLine(i, { no: v })} upper placeholder="MW-233" /></div>}
                    {!x.old && <label className="flex shrink-0 items-center gap-1 text-[0.8rem]"><input type="checkbox" checked={x.auto} onChange={(e) => setLine(i, { auto: e.target.checked, no: e.target.checked ? "" : nos[i] })} />Auto</label>}
                  </div>
                </F>
                <F label="Stone"><Sel value={x.stoneType} onChange={(v) => setLine(i, { stoneType: v as StoneType })} options={STONES.map((v) => ({ v, l: v[0].toUpperCase() + v.slice(1) }))} /></F>
                <F label="Grade"><Sel value={x.grade} onChange={(v) => setLine(i, { grade: v as Grade })} options={GRADES.map((v) => ({ v, l: v }))} /></F>
                {can && lines.length > 1 && !locked(x) ? <button className="btn btn-quiet btn-sm mb-0.5 !px-2" aria-label="Remove line" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 size={14} /></button> : <span />}
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-6">
                <F label="Billed qty"><NumIn value={x.billed} onChange={(v) => setLine(i, { billed: v })} suffix="t" /></F>
                <F label="Received qty" hint={!x.received ? "Fill when it arrives" : x.billed && (x.billed - x.received) / x.received > 0.02 ? `${n2(x.billed - x.received)} t short` : undefined}><NumIn value={x.received} onChange={(v) => setLine(i, { received: v })} suffix="t" /></F>
                <F label="Length"><NumIn value={x.l} onChange={(v) => setLine(i, { l: v })} suffix="cm" /></F>
                <F label="Width"><NumIn value={x.w} onChange={(v) => setLine(i, { w: v })} suffix="cm" /></F>
                <F label="Height"><NumIn value={x.h} onChange={(v) => setLine(i, { h: v })} suffix="cm" /></F>
                {C && !imp ? <F label="Rate"><NumIn value={x.rate} onChange={(v) => setLine(i, { rate: v })} suffix={h.rateBasis === "cbm" ? "₹/CBM" : "₹/t"} /></F> : <F label="Volume"><div className="field num">{n2(cbm(x))} CBM</div></F>}
              </div>
              {locked(x) && <p className="mt-1.5 text-[0.78rem] text-ink-3">{STATUS_LABEL[x.old!.status]}: this block stays in the bill but can’t be removed.</p>}
            </div>
          ))}
        </div>
      </Section>

      {imp ? (
        <Section title="Bill of lading and CIF">
          <Grid cols={3}>
            <F label="BL no."><TextIn value={h.imp.blNo} onChange={(v) => setHd("imp", { ...h.imp, blNo: v })} upper /></F>
            <F label="BL date"><TextIn type="date" value={h.imp.blDate} onChange={(v) => setHd("imp", { ...h.imp, blDate: v })} /></F>
            <F label="Vessel"><TextIn value={h.imp.vessel} onChange={(v) => setHd("imp", { ...h.imp, vessel: v })} /></F>
            <F label="Port of discharge"><TextIn value={h.imp.port} onChange={(v) => setHd("imp", { ...h.imp, port: v })} list="imp-ports" placeholder="Mundra" /><datalist id="imp-ports">{["Mundra", "Pipavav", "Nhava Sheva", "Kandla", "Hazira", "ICD Kanakpura, Jaipur"].map((p) => <option key={p} value={p} />)}</datalist></F>
            <F label="Supplier invoice no."><TextIn value={h.invoiceNo} onChange={(v) => setHd("invoiceNo", v)} upper /></F>
            {C && <F label="CIF value" hint="For the whole bill, in rupees"><NumIn value={h.imp.cif} onChange={(v) => setHd("imp", { ...h.imp, cif: v })} suffix="₹" /></F>}
          </Grid>
          {C && (
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-2"><span className="text-[0.9rem] font-medium">Additional charges</span><button type="button" className="btn btn-quiet btn-sm ml-auto" onClick={() => setHd("imp", { ...h.imp, charges: [...h.imp.charges, { label: CHARGES[h.imp.charges.length] ?? "Other", amount: 0, note: "" }] })}><Plus size={14} />Charge</button></div>
              <div className="space-y-2">
                {h.imp.charges.map((c, i) => (
                  <div key={i} className="grid items-end gap-2 rounded-xl bg-surface p-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1.4fr)_auto]">
                    <F label="Charge"><TextIn value={c.label} onChange={(v) => setHd("imp", { ...h.imp, charges: h.imp.charges.map((y, j) => (j === i ? { ...y, label: v } : y)) })} list="imp-charges" /></F>
                    <F label="Amount"><NumIn value={c.amount} onChange={(v) => setHd("imp", { ...h.imp, charges: h.imp.charges.map((y, j) => (j === i ? { ...y, amount: v } : y)) })} suffix="₹" /></F>
                    <F label="Note"><TextIn value={c.note} onChange={(v) => setHd("imp", { ...h.imp, charges: h.imp.charges.map((y, j) => (j === i ? { ...y, note: v } : y)) })} placeholder="Bill of entry no., CHA bill" /></F>
                    <button type="button" className="btn btn-quiet btn-sm mb-0.5 !px-2" aria-label="Remove charge" onClick={() => setHd("imp", { ...h.imp, charges: h.imp.charges.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
                  </div>
                ))}
                <datalist id="imp-charges">{CHARGES.map((c) => <option key={c} value={c} />)}</datalist>
                {!h.imp.charges.length && <p className="text-sm text-ink-3">Duty, CHA, port and freight to the yard, each with a note.</p>}
              </div>
            </div>
          )}
        </Section>
      ) : (
        <Section title="Bill">
          <Grid cols={3}>
            <F label="Bill / invoice no."><TextIn value={h.invoiceNo} onChange={(v) => setHd("invoiceNo", v)} upper /></F>
            {C && <F label="Rate is per"><Sel value={h.rateBasis} onChange={(v) => setHd("rateBasis", v as Block["rateBasis"])} options={[{ v: "tonne", l: "Tonne" }, { v: "cbm", l: "CBM" }]} /></F>}
          </Grid>
        </Section>
      )}

      {!imp && (
        <Section title="Royalty & papers">
          <Grid cols={3}>
            <F label="e-Rawanna no." hint="Must travel with the vehicle"><TextIn value={h.eRawanna} onChange={(v) => setHd("eRawanna", v)} upper placeholder="ER…" /></F>
            {C && <F label="Royalty paid" hint={<button type="button" className="underline" onClick={() => setH((x) => ({ ...x, royalty: suggestRoyalty, dmft: Math.round((suggestRoyalty * S.dmftPct) / 100) }))}>Use {rs(suggestRoyalty)} ({rs(S.royaltyPerTonne)}/t)</button>}><NumIn value={h.royalty} onChange={(v) => setHd("royalty", v)} suffix="₹" /></F>}
            {C && <F label={`DMFT (${S.dmftPct}% of royalty)`}><NumIn value={h.dmft} onChange={(v) => setHd("dmft", v)} suffix="₹" /></F>}
            <F label="e-Way bill no."><TextIn value={h.ewayBill} onChange={(v) => setHd("ewayBill", v)} /></F>
          </Grid>
          {!h.eRawanna && <div className="mt-3"><Note tone="neg">No rawanna number. A vehicle stopped at a check-post without a valid rawanna can be asked to pay up to ten times the royalty, and the stone can be seized.</Note></div>}
        </Section>
      )}

      <Section title="Transport">
        <Grid cols={3}>
          <F label="Vehicle no."><TextIn value={h.vehicleNo} onChange={(v) => setHd("vehicleNo", v)} upper placeholder="RJ 30 GA 4417" /></F>
          <F label="Driver"><TextIn value={h.driver} onChange={(v) => setHd("driver", v)} /></F>
          <F label="Driver mobile"><TextIn type="tel" value={h.driverPhone} onChange={(v) => setHd("driverPhone", v)} /></F>
          <F label="Transporter" span={3}><Sel value={h.transporterId} onChange={(v) => setHd("transporterId", v)} placeholder="Choose transporter" options={transporters.map((p) => ({ v: p.id, l: `${p.company} · ${p.city}` }))} /></F>
          {C && <F label="Freight (whole load)"><NumIn value={h.freight} onChange={(v) => setHd("freight", v)} suffix="₹" /></F>}
          {C && <F label="Loading / crane"><NumIn value={h.loading} onChange={(v) => setHd("loading", v)} suffix="₹" /></F>}
          {C && <F label="Other charges"><NumIn value={h.otherCost} onChange={(v) => setHd("otherCost", v)} suffix="₹" /></F>}
        </Grid>
      </Section>

      <Section title="Where it is">
        <Grid cols={3}>
          <F label="Status" hint="A block with its received weight filled is in the yard"><Sel value={h.status} onChange={(v) => setHd("status", v as Head["status"])} options={[{ v: "in_transit", l: STATUS_LABEL.in_transit }, { v: "in_yard", l: STATUS_LABEL.in_yard }]} /></F>
          <F label="Received on"><TextIn type="date" value={h.receivedOn} onChange={(v) => setHd("receivedOn", v)} /></F>
          <F label="Weighbridge slip no."><TextIn value={h.weighSlip} onChange={(v) => setHd("weighSlip", v)} upper /></F>
          {!bill && <F label="Defects / damage" span={3}><Area value={h.defects} onChange={(v) => setHd("defects", v)} placeholder="Cracks, colour patches, veins, chipped corners" /></F>}
          <F label="Notes" span={3}><Area value={h.notes} onChange={(v) => setHd("notes", v)} /></F>
        </Grid>
      </Section>

      {C && (
        <Section title="Cost of this purchase">
          <div className="rounded-2xl bg-surface p-4 text-[0.9rem]">
            {([
              [imp ? "CIF and charges" : "Stone value", stone],
              ...(imp ? [] : [["Royalty + DMFT", h.royalty + h.dmft]]),
              ["Freight, loading, other", h.freight + h.loading + h.otherCost],
            ] as [string, number][]).map(([l, v]) => <div key={l} className="flex justify-between py-1 text-ink-2"><span>{l}</span><span className="num text-ink">{rs(v)}</span></div>)}
            <div className="mt-1 flex justify-between border-t border-surface-2 pt-2 font-semibold"><span>Total</span><span className="num">{rs(total)}</span></div>
            <div className="mt-1 flex justify-between text-ink-2"><span>Per tonne ({n2(tonnes)} t {lines.some((x) => x.received) ? "received" : "billed"})</span><span className="num">{tonnes ? rs(total / tonnes) : "—"}</span></div>
            {lines.length > 1 && <p className="mt-2 text-[0.8rem] text-ink-3">{imp ? "CIF, charges" : "Royalty"}, freight and loading are split over the blocks by weight: {lines.map((x, i) => `${nos[i] || "?"} ${n2(r2(weights[i]))} t`).join(", ")}.</p>}
          </div>
        </Section>
      )}
    </Drawer>
  );
}

