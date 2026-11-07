"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, ArrowRightLeft, Bookmark, Factory, Images, Layers, Pencil, Plus, QrCode, Undo2 } from "lucide-react";
import { baseCost, blockCost, cbm, daysSince, dmy, lakh, n0, n2, perTonne, purchaseValue, rs, rs2, today } from "@/lib/stone/calc";
import { IN_STOCK, godowns, whereIs } from "@/lib/stone/godowns";
import { lotCost, lotUnit, storesPerSqft, storesShare } from "@/lib/stone/costing";
import { firmName, firmOf, journey } from "@/lib/stone/firms";
import { slabCount } from "@/lib/stone/slabs";
import { freeCount, freeSqft, reservations, reservedCount, reservedSqft } from "@/lib/stone/reserve";
import type { Block, BlockStatus, MineCost, Reservation, SlabLot } from "@/lib/stone/types";
import { ReserveForm, ReservedList } from "./Reserved";
import type { Ctx } from "./StoneApp";
import BlockForm, { STATUS_LABEL, type BlockMode } from "./BlockForm";
import QrLabels from "./QrLabels";
import TransferForm from "./Transfer";
import SlabsView from "./Slabs";
import Catalogue from "./CatalogueShare";
import { LotForm } from "./Depot";
import { MoveForm } from "./Unit";
import { CostForm, MineCostList, MinePerTonne, MineStats } from "./Mines";
import { fileSrc } from "./files";
import LotsForm from "./LotsForm";
import { Badge, Drawer, Note, Seg, Sel, Stat, Table, setUrlTab, type Col } from "./ui";

export default function Inventory({ ctx, page }: { ctx: Ctx; page: "blocks" | "slabs" }) {
  return page === "slabs" ? <SlabInventory ctx={ctx} /> : <BlockInventory ctx={ctx} />;
}

// ─── Blocks ───

type BTab = "blocks" | "costs" | "pertonne";
type BStatus = "stock" | "processing" | "processed" | "sold" | "all";
const IN: Record<BStatus, BlockStatus[] | null> = { stock: IN_STOCK, processing: ["processing"], processed: ["processed"], sold: ["sold"], all: null };

function BlockInventory({ ctx }: { ctx: Ctx }) {
  const { db, update } = ctx;
  const C = ctx.costs;
  const quarryOn = ctx.mods.quarry && ctx.can("quarry") !== "none";
  const tabs: BTab[] = ["blocks", ...(quarryOn && C ? (["costs", "pertonne"] as BTab[]) : [])];
  const [tabRaw, setTab] = useState<BTab>((ctx.sub as BTab) || "blocks");
  const tab = tabs.includes(tabRaw) ? tabRaw : "blocks";
  const [status, setStatus] = useState<BStatus>("stock");
  const [gd, setGd] = useState("");
  // A scanned label can open the lots form for its block ("lots:<block id>")
  const [lotsFor, setLotsFor] = useState<string | null>(ctx.sub.startsWith("lots:") ? ctx.sub.slice(5) : null);
  useEffect(() => { if (ctx.sub.startsWith("lots:")) setUrlTab("blocks"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState<Block | null>(() => (ctx.sub.startsWith("blocks:open:") ? db.blocks.find((b) => b.id === ctx.sub.slice(12)) ?? null : null));
  useEffect(() => { if (ctx.sub.startsWith("blocks:open:")) setUrlTab("blocks"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [form, setForm] = useState<{ b: Block | null; mode: BlockMode } | null>(null);
  const [labels, setLabels] = useState(false);
  const [send, setSend] = useState<Block | null>(null);
  const [cost, setCost] = useState<MineCost | "new" | null>(null);
  const party = (id: string) => ctx.root.parties.find((p) => p.id === id);

  const blocks = db.blocks.filter((b) => (!IN[status] || IN[status]!.includes(b.status)) && (!gd || status !== "stock" || (b.status === "godown" && b.godown === gd)));
  const stock = db.blocks.filter((b) => IN.stock!.includes(b.status));
  const count = (k: BStatus) => db.blocks.filter((b) => IN[k]!.includes(b.status)).length;
  const gds = [...new Set([...godowns(db), ...stock.filter((b) => b.status === "godown" && b.godown).map((b) => b.godown!)])];
  const canProcess = ctx.mods.processing && ctx.edit("processing");
  const lotsOf = (b: Block) => db.lots.filter((l) => l.blockId === b.id);
  const issue = (b: Block) => { update((d) => { const x = d.blocks.find((y) => y.id === b.id); if (x) { x.status = "processing"; x.processOn = today(); } }); ctx.say(`${b.no} issued for processing`, "good"); };
  const unissue = (b: Block) => update((d) => { const x = d.blocks.find((y) => y.id === b.id); if (x) { x.status = "godown"; x.processOn = ""; } });
  const from = (b: Block) => (b.source === "own_mine" ? b.mine || "Own quarry" : party(b.supplierId)?.company ?? (b.source === "import" ? b.mine || "Import" : b.mine || "—"));

  const cols: Col<Block>[] = [
    { key: "no", label: "Block no.", render: (b) => <span className="font-medium">{b.no}</span>, sort: (b) => b.no },
    { key: "q", label: "Quality", render: (b) => b.variety, sort: (b) => b.variety },
    { key: "od", label: "Ordered", render: (b) => <span className="num whitespace-nowrap">{dmy(b.date)}</span>, sort: (b) => b.date },
    { key: "rd", label: "Received", render: (b) => b.receivedOn ? <span className="num whitespace-nowrap">{dmy(b.receivedOn)}</span> : <span className="text-ink-3">—</span>, sort: (b) => b.receivedOn || "" },
    { key: "s", label: "Supplier", render: (b) => from(b), sort: (b) => from(b) },
    { key: "t", label: "Weight", align: "right", render: (b) => (b.tonnes ? `${n2(b.tonnes)} t` : <span className="text-ink-3">{n2(b.billedTonnes)} t billed</span>), sort: (b) => b.tonnes || b.billedTonnes },
    ...(C ? [{ key: "c", label: "Cost till now ₹/t", align: "right" as const, render: (b: Block) => { const t = b.tonnes || b.billedTonnes; return t ? rs(blockCost(b) / t) : "—"; }, sort: (b: Block) => perTonne(b) }] : []),
    { key: "w", label: status === "processed" ? "Lots" : status === "processing" ? "Issued" : "Where", render: (b) => {
      if (b.status === "processed") { const ls = lotsOf(b); return <span>{ls.length} lot{ls.length === 1 ? "" : "s"} · {n0(ls.reduce((a, l) => a + l.sqft, 0))} sq ft</span>; }
      if (b.status === "processing") return <span>{b.processOn ? `${dmy(b.processOn)} · ${daysSince(b.processOn)} d` : "Processing"}</span>;
      return <Badge tone={b.status === "written_off" ? "neg" : b.status === "sold" ? "good" : "plain"}>{whereIs(b)}</Badge>;
    } },
    ...(canProcess ? [{ key: "a", label: "", render: (b: Block) => (
      <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
        {b.status === "godown" && <button className="btn btn-quiet btn-sm" onClick={() => issue(b)}><Factory size={13} />Processing</button>}
        {b.status === "processing" && <>{!lotsOf(b).length && <button className="btn btn-quiet btn-sm !px-2" title="Back to the godown" aria-label="Back to the godown" onClick={() => unissue(b)}><Undo2 size={13} /></button>}<button className="btn btn-primary btn-sm" onClick={() => setLotsFor(b.id)}><Layers size={13} />Create lots</button></>}
        {b.status === "processed" && <button className="btn btn-quiet btn-sm" onClick={() => setLotsFor(b.id)}>Lots</button>}
      </div>
    ) }] : []),
  ];

  const save = (b: Block) => { update((d) => { const i = d.blocks.findIndex((x) => x.id === b.id); if (i >= 0) d.blocks[i] = b; else d.blocks.push(b); }); setForm(null); };

  if (lotsFor !== null) return <LotsForm ctx={ctx} blockId={lotsFor || undefined} onClose={(id) => { setLotsFor(null); if (id) setStatus("processed"); }} />;

  return (
    <div>
      {quarryOn && C ? <MineStats ctx={ctx} /> : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Blocks in stock" value={`${stock.length} · ${n0(stock.reduce((a, b) => a + (b.tonnes || b.billedTonnes), 0))} t`} sub={gds.length > 1 ? gds.map((g) => `${g} ${stock.filter((b) => b.godown === g).length}`).join(" · ") : `${new Set(stock.map((b) => b.variety)).size} qualities`} />
          {C ? <Stat label="Stock at cost" value={lakh(stock.reduce((a, b) => a + blockCost(b), 0))} sub="Stone, royalty, freight and damage share" /> : <Stat label="Qualities in stock" value={`${new Set(stock.map((b) => b.variety)).size}`} />}
          <Stat label="Processing" value={`${count("processing")}`} sub={`${n0(db.blocks.filter((b) => b.status === "processing").reduce((a, b) => a + (b.tonnes || b.billedTonnes), 0))} t on the saws`} tone={count("processing") ? "warn" : undefined} />
          <Stat label="Processed · sold as block" value={`${count("processed")} · ${count("sold")}`} sub={`${db.blocks.filter((b) => b.status === "written_off").length} written off`} />
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {tabs.length > 1 && <Seg value={tab} onChange={setTab} tabs={[{ key: "blocks", label: "Blocks", count: db.blocks.length }, { key: "costs", label: "Extraction costs", count: db.mineCosts.length }, { key: "pertonne", label: "Cost per tonne" }]} />}
        {tab === "blocks" && <Seg value={status} onChange={setStatus} tabs={([
          { key: "stock", label: "In stock", count: stock.length },
          ...(ctx.mods.processing ? [{ key: "processing", label: "Processing", count: count("processing") }, { key: "processed", label: "Processed", count: count("processed") }] : []),
          { key: "sold", label: "Sold", count: count("sold") },
          { key: "all", label: "All", count: db.blocks.length },
        ] as { key: BStatus; label: string; count: number }[])} />}
        {tab === "blocks" && status === "stock" && gds.length > 1 && <div className="w-44"><Sel value={gd} onChange={setGd} placeholder="All godowns" options={gds.map((g) => ({ v: g, l: g }))} /></div>}
        <div className="ml-auto flex flex-wrap gap-2">
          {tab === "blocks" && <button className="btn btn-quiet btn-sm" onClick={() => setLabels(true)}><QrCode size={15} />QR labels</button>}
          {tab === "blocks" && canProcess && <button className="btn btn-primary btn-sm" onClick={() => setLotsFor("")}><Layers size={15} />Create lots</button>}
          {tab === "blocks" && quarryOn && ctx.edit("quarry") && <button className="btn btn-primary btn-sm" onClick={() => setForm({ b: null, mode: "own" })}><Plus size={15} />Block extracted</button>}
          {tab !== "blocks" && ctx.edit("quarry") && <button className="btn btn-primary btn-sm" onClick={() => setCost("new")}><Plus size={15} />Extraction cost</button>}
        </div>
      </div>

      <div className="mt-4">
        {tab === "blocks" && (
          <>
            <Table rows={[...blocks].reverse()} cols={cols} onRow={setOpen} search={(b) => `${b.no} ${b.variety} ${from(b)} ${b.vehicleNo} ${b.eRawanna}`} empty={status === "stock" ? "No blocks in stock. Bought and imported blocks are entered under Purchases." : status === "processing" ? "No block is being processed. Click Processing on a block in stock when it goes to the saw." : status === "processed" ? "No processed blocks yet. They show here once their lots are created." : "No blocks here."} />
            {(ctx.mods.buyBlocks || ctx.mods.imports || ctx.mods.processing) && <p className="mt-2 text-[0.8rem] text-ink-3">Click a block to see its full history and costs. Bought and imported blocks are entered under <button className="underline" onClick={() => ctx.go("purchases")}>Purchases</button>.</p>}
          </>
        )}
        {tab === "costs" && <MineCostList ctx={ctx} onOpen={setCost} />}
        {tab === "pertonne" && <MinePerTonne ctx={ctx} />}
      </div>

      {open && <BlockHistory ctx={ctx} block={db.blocks.find((x) => x.id === open.id) ?? open} onLots={canProcess ? (b) => { setOpen(null); setLotsFor(b.id); } : undefined} onClose={() => setOpen(null)} onEdit={(b) => { setOpen(null); setForm({ b, mode: "edit" }); }} onSend={ctx.firms.length > 1 && ctx.edit("blocks") ? (b) => { setOpen(null); setSend(b); } : undefined} />}
      {form && <BlockForm costs={C} db={db} initial={form.b?.id ? form.b : null} mode={form.mode} key={form.b?.id ?? form.mode} onClose={() => setForm(null)} onSave={save} onDelete={(id) => { update((d) => { d.blocks = d.blocks.filter((x) => x.id !== id); }); setForm(null); }} />}
      {labels && <QrLabels ctx={ctx} blocks={blocks} onClose={() => setLabels(false)} />}
      {send && <TransferForm ctx={ctx} item={send} kind="block" onClose={() => setSend(null)} />}
      {cost && <CostForm ctx={ctx} initial={cost === "new" ? null : cost} onClose={() => setCost(null)} />}
    </div>
  );
}

const Line = ({ l, v, strong }: { l: string; v: string; strong?: boolean }) => (
  <div className={`flex justify-between gap-4 py-1 ${strong ? "mt-1 border-t border-surface-2 pt-2 font-semibold" : "text-ink-2"}`}><span>{l}</span><span className="num text-right text-ink">{v}</span></div>
);
const Fact = ({ l, v }: { l: string; v: ReactNode }) => (
  <div><div className="text-[0.76rem] text-ink-3">{l}</div><div className="mt-0.5">{v || <span className="text-ink-3">—</span>}</div></div>
);

/** Everything about one block: where it came from, every cost on it, and each step it went through. */
function BlockHistory({ ctx, block: b, onClose, onEdit, onSend, onLots }: { ctx: Ctx; block: Block; onClose: () => void; onEdit: (b: Block) => void; onSend?: (b: Block) => void; onLots?: (b: Block) => void }) {
  const C = ctx.costs;
  const party = (id: string) => ctx.root.parties.find((p) => p.id === id);
  const t = b.tonnes || b.billedTonnes;
  const total = blockCost(b);
  const imp = b.imp || null;
  const steps = journey(ctx.root, b.no)?.steps ?? [];
  const lots = ctx.root.lots.filter((l) => l.blockId === b.id);
  const canEdit = b.source === "own_mine" ? ctx.edit("quarry") : ctx.edit("blocks");
  return (
    <Drawer open wide title={`Block ${b.no}`} sub={`${b.variety} · ${STATUS_LABEL[b.status]}${ctx.firms.length > 1 ? ` · ${firmName(ctx.root.settings, firmOf(b, ctx.root.settings))}` : ""}`} onClose={onClose}
      footer={<>{onLots && (b.status === "processing" || b.status === "processed") && <button className="btn btn-primary" onClick={() => onLots(b)}><Layers size={14} />{b.status === "processing" ? "Create lots" : "Lots"}</button>}{canEdit && <button className={`btn ${onLots && (b.status === "processing" || b.status === "processed") ? "btn-quiet" : "btn-primary"}`} onClick={() => onEdit(b)}><Pencil size={14} />Edit block</button>}<button className="btn btn-quiet" onClick={onClose}>Close</button>{onSend && <button className="btn btn-quiet btn-sm ml-auto" onClick={() => onSend(b)}><ArrowRightLeft size={14} />Send to firm</button>}</>}>
      <div className="grid gap-x-6 gap-y-3 rounded-2xl bg-surface p-4 text-[0.9rem] sm:grid-cols-3">
        <Fact l="Date" v={dmy(b.date)} />
        <Fact l={b.source === "own_mine" ? "Own quarry" : b.source === "import" ? "Imported from" : "Supplier"} v={b.source === "own_mine" ? b.mine : party(b.supplierId)?.company ?? b.mine} />
        <Fact l={b.source === "import" ? "BL no." : "Mine"} v={b.source === "import" ? imp?.blNo : b.source === "own_mine" ? b.leaseNo : b.mine} />
        <Fact l="Bill no." v={b.invoiceNo} />
        <Fact l="Vehicle no." v={b.vehicleNo} />
        <Fact l="Driver" v={[b.driver, b.driverPhone].filter(Boolean).join(" · ")} />
        <Fact l="Transporter" v={party(b.transporterId)?.company} />
        <Fact l="e-Rawanna" v={b.source === "import" ? "Not needed" : b.eRawanna || <span className="text-neg">Not on record</span>} />
        <Fact l="e-Way bill" v={b.ewayBill} />
        <Fact l="Size" v={b.l ? `${b.l} × ${b.w} × ${b.h} cm · ${n2(cbm(b))} CBM` : ""} />
        <Fact l="Billed · received" v={`${n2(b.billedTonnes)} t · ${b.tonnes ? `${n2(b.tonnes)} t` : "not yet"}`} />
        <Fact l="Received on" v={b.receivedOn ? `${dmy(b.receivedOn)}${b.weighSlip ? ` · slip ${b.weighSlip}` : ""}` : ""} />
        <Fact l="Stone · grade" v={`${b.stoneType[0].toUpperCase() + b.stoneType.slice(1)} · ${b.grade}`} />
        <Fact l="Where" v={b.status === "godown" ? b.godown || "Godown" : `${STATUS_LABEL[b.status]}${b.processOn && b.status === "processing" ? ` since ${dmy(b.processOn)}` : ""}`} />
        {b.defects && <div className="sm:col-span-2"><Fact l="Defects" v={b.defects} /></div>}
      </div>

      {C && (
        <div className="mt-5">
          <div className="mb-2 font-semibold">Cost till now</div>
          <div className="rounded-2xl bg-surface p-4 text-[0.9rem]">
            {b.source === "import" ? (
              imp ? <>
                <Line l="Share of CIF and charges" v={rs(b.importCost)} />
                <p className="pb-1 text-[0.78rem] text-ink-3">Whole bill: CIF {rs(imp.cif)}{imp.charges.map((c) => ` · ${c.label} ${rs(c.amount)}${c.note ? ` (${c.note})` : ""}`).join("")}</p>
              </> : <Line l="Landed import cost" v={rs(b.importCost)} />
            ) : <Line l={b.source === "own_mine" ? `Extraction (${rs(b.rate)}/t)` : `Stone value (${rs(b.rate)}/${b.rateBasis === "cbm" ? "CBM" : "t"})`} v={rs(purchaseValue(b))} />}
            {b.source !== "import" && <Line l="Royalty + DMFT" v={rs(b.royalty + b.dmft)} />}
            <Line l="Freight" v={rs(b.freight)} />
            <Line l="Loading / crane" v={rs(b.loading)} />
            {b.otherCost > 0 && <Line l="Other charges" v={rs(b.otherCost)} />}
            {b.damageAlloc > 0 && <Line l="Share of transit damage" v={rs(b.damageAlloc)} />}
            <Line l="Total" v={rs(total)} strong />
            <Line l="Per tonne · per CBM" v={`${t ? rs(total / t) : "—"} · ${cbm(b) ? rs(total / cbm(b)) : "—"}`} />
            {b.damageAlloc > 0 && <p className="mt-1 text-[0.78rem] text-ink-3">Without damage share: {rs(baseCost(b))}.</p>}
          </div>
        </div>
      )}

      {lots.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 font-semibold">Slabs from this block</div>
          <ul className="space-y-1.5">
            {lots.map((l) => <li key={l.id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-[0.88rem]"><span><b>Lot {l.lotNo}</b> · {l.thicknessMm} mm {l.finish}</span><span className="text-ink-2">{slabCount(l)} slabs · {n0(l.available)} of {n0(l.sqft)} sq ft in stock</span></li>)}
          </ul>
        </div>
      )}

      {steps.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 font-semibold">History</div>
          <ol className="relative space-y-3 border-l border-surface-3 pl-5">
            {steps.map((s, i) => (
              <li key={i} className="relative">
                <span className={`absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full ${s.tone === "sale" ? "bg-accent" : s.tone === "move" ? "bg-warn" : s.tone === "cut" ? "bg-ink" : "bg-ink-3"}`} />
                <div className="text-[0.78rem] text-ink-3">{dmy(s.date)}{ctx.firms.length > 1 ? ` · ${firmName(ctx.root.settings, s.firm)}` : ""}</div>
                <div className="font-medium">{s.title}</div>
                {s.detail && <div className="text-[0.86rem] text-ink-2">{s.detail}</div>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Drawer>
  );
}

// ─── Slabs, lot by lot ───

function SlabInventory({ ctx }: { ctx: Ctx }) {
  const { db, update } = ctx;
  const C = ctx.costs;
  const R = ctx.root;
  const [view, setView] = useState<"lots" | "slabs" | "reserved">(ctx.sub === "slabs:reserved" ? "reserved" : "lots");
  useEffect(() => { if (ctx.sub === "slabs:reserved") setUrlTab("slabs"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [reserve, setReserve] = useState<{ lot: SlabLot; r?: Reservation } | null>(null);
  const canReserve = ctx.edit("sales") || ctx.edit("stock");
  const [site, setSite] = useState<"all" | "depot" | "unit">("all");
  const [open, setOpen] = useState<SlabLot | null>(() => (ctx.sub.startsWith("slabs:open:") ? db.lots.find((l) => l.id === ctx.sub.slice(11)) ?? null : null));
  useEffect(() => { if (ctx.sub.startsWith("slabs:open:")) setUrlTab("slabs"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [edit, setEdit] = useState<SlabLot | null>(null);
  const [send, setSend] = useState<SlabLot | null>(null);
  const [move, setMove] = useState<SlabLot | null>(null);
  const [share, setShare] = useState(false);
  const unit = (l: SlabLot) => lotUnit(R, l);

  const all = db.lots.filter((l) => l.available > 0);
  const lots = all.filter((l) => (site === "all" || l.site === site) && freeSqft(l) > 0);
  const resRows = reservations(db);
  const resSqft = all.reduce((a, l) => a + reservedSqft(l), 0);
  const stockSqft = all.reduce((a, l) => a + l.available, 0);
  const stockVal = all.reduce((a, l) => a + l.available * unit(l), 0);
  const listVal = all.reduce((a, l) => a + l.available * (l.listRate || 0), 0);
  const slow = all.filter((l) => daysSince(l.createdAt) > 90);
  const inCat = all.filter((l) => l.catalogue).length;
  const blockNo = (l: SlabLot) => R.blocks.find((b) => b.id === l.blockId)?.no;
  const src = (l: SlabLot) => blockNo(l) ?? (l.shipmentId ? "Import" : l.source === "purchase" ? "Bought" : "—");

  const cols: Col<SlabLot>[] = [
    { key: "lot", label: "Lot", render: (l) => <div className="flex items-center gap-2.5">{l.photos?.[0] ? <img src={fileSrc(l.photos[0])} alt="" className="h-9 w-12 shrink-0 rounded-md object-cover" /> : null}<span className="font-medium">{l.lotNo}</span></div>, sort: (l) => l.lotNo },
    { key: "blk", label: "Block no.", render: (l) => <span className={blockNo(l) ? "font-medium" : "text-ink-3"}>{src(l)}</span>, sort: (l) => src(l) },
    { key: "cd", label: "Date", render: (l) => <div><div className="num whitespace-nowrap">{dmy(l.createdAt)}</div><div className="text-[0.8rem] text-ink-3">{l.blockId ? "cut" : "bought"}</div></div>, sort: (l) => l.createdAt },
    { key: "q", label: "Quality", render: (l) => <div><div>{l.variety}</div><div className="text-[0.8rem] text-ink-3">{l.thicknessMm} mm · {l.finish} · grade {l.grade}{l.catalogue ? " · in catalogue" : ""}</div></div>, sort: (l) => l.variety },
    { key: "n", label: "Slabs", align: "right", render: (l) => <div><div className="font-medium">{freeCount(l)}</div>{reservedCount(l) > 0 && <div className="text-[0.8rem] text-warn">+{reservedCount(l)} reserved</div>}</div>, sort: (l) => freeCount(l) },
    { key: "s", label: "In stock", align: "right", render: (l) => { const rv = reservedSqft(l); return <div><div>{n0(freeSqft(l))} sq ft</div><div className={`text-[0.8rem] ${rv ? "text-warn" : "text-ink-3"}`}>{rv ? `${n0(rv)} reserved` : `of ${n0(l.sqft)}`}</div></div>; }, sort: (l) => freeSqft(l) },
    ...(C ? [{ key: "c", label: "Cost ₹/sq ft", align: "right" as const, render: (l: SlabLot) => { const st = storesPerSqft(R, l); return <div><div className="font-medium">{rs2(unit(l))}</div>{st > 0 && <div className="text-[0.78rem] text-ink-3">incl. {rs2(st)} stores</div>}</div>; }, sort: (l: SlabLot) => unit(l) }] : []),
    { key: "p", label: "List", align: "right", render: (l) => l.listRate ? <div><div>{rs(l.listRate)}</div>{C && <div className={`text-[0.8rem] ${l.listRate < unit(l) ? "text-neg" : "text-ink-3"}`}>{l.listRate < unit(l) ? "below cost" : `${Math.round(((l.listRate - unit(l)) / l.listRate) * 100)}% margin`}</div>}</div> : <span className="text-ink-3">Set</span> },
    { key: "w", label: "Where", render: (l) => <div><Badge tone={l.site === "depot" ? "good" : "plain"}>{l.site === "depot" ? "Depot" : "Unit"}</Badge><div className="mt-0.5 text-[0.8rem] text-ink-3">{l.location}</div></div> },
    { key: "age", label: "Age", align: "right", render: (l) => { const a = daysSince(l.createdAt); return <span className={a > 90 ? "text-warn" : ""}>{a} d</span>; }, sort: (l) => daysSince(l.createdAt) },
    ...(canReserve ? [{ key: "rv", label: "", render: (l: SlabLot) => <div className="flex justify-end" onClick={(e) => e.stopPropagation()}><button className="btn btn-quiet btn-sm" onClick={() => setReserve({ lot: l })}><Bookmark size={13} />Reserve</button></div> }] : []),
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Slab stock" value={`${n0(stockSqft)} sq ft`} sub={`${all.length} lots · ${n0(all.reduce((a, l) => a + slabCount(l), 0))} slabs${resSqft ? ` · ${n0(resSqft)} sq ft reserved` : ""}`} />
        {C ? <Stat label="Stock at cost" value={lakh(stockVal)} sub={listVal ? `${lakh(listVal)} at list price` : "Includes stores cost per sq ft"} /> : <Stat label="Stock at list price" value={lakh(listVal)} sub={`${inCat} lots in the dealer catalogue`} />}
        <Stat label="Older than 90 days" value={`${n0(slow.reduce((a, l) => a + l.available, 0))} sq ft`} sub={slow.length ? `${slow.length} lots` : "None"} tone={slow.length ? "warn" : undefined} />
        <Stat label="In dealer catalogue" value={`${inCat} lots`} sub={`${n0(all.filter((l) => l.site === "depot").reduce((a, l) => a + l.available, 0))} sq ft at depot`} />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Seg value={view} onChange={setView} tabs={[{ key: "lots", label: "By lot" }, { key: "slabs", label: "By slab" }, { key: "reserved", label: "Reserved", count: resRows.length }]} />
        {view === "lots" && ctx.mods.processing && <Seg value={site} onChange={setSite} tabs={[{ key: "all", label: "All" }, { key: "depot", label: "Depot" }, { key: "unit", label: "Unit" }]} />}
        <div className="ml-auto flex flex-wrap gap-2"><button className="btn btn-quiet btn-sm" onClick={() => setShare(true)}><Images size={15} />Dealer catalogue</button></div>
      </div>
      <div className="mt-4">
        {view === "reserved" ? <ReservedList ctx={ctx} onEdit={(lot, r) => setReserve({ lot, r })} /> : view === "slabs" ? <SlabsView ctx={ctx} /> : (
          <>
            <Table rows={lots} cols={cols} onRow={setOpen} search={(l) => `${l.lotNo} ${src(l)} ${l.variety} ${l.location} ${l.finish}`} empty="No slabs in stock." initialSort={{ key: "age", dir: -1 }} />
            <p className="mt-2 text-[0.8rem] text-ink-3">Click a lot to see its history: opening, every sale, its cost so far and the margin on what is sold. Slabs and sq ft show what is free to sell; reserved slabs are under Reserved.{C ? " Stores issued each month are spread over the sq ft cut that month." : ""}</p>
          </>
        )}
      </div>

      {open && <LotHistory ctx={ctx} lot={db.lots.find((x) => x.id === open.id) ?? open} onClose={() => setOpen(null)}
        onEdit={ctx.edit("stock") || ctx.edit("processing") ? (l) => { setOpen(null); setEdit(l); } : undefined}
        onSend={ctx.firms.length > 1 && (ctx.edit("stock") || ctx.edit("processing")) ? (l) => { setOpen(null); setSend(l); } : undefined}
        onMove={ctx.firms.length < 2 && ctx.edit("processing") ? (l) => { setOpen(null); setMove(l); } : undefined} />}
      {edit && <LotForm ctx={ctx} lot={edit} onClose={() => setEdit(null)} onSave={(l) => { update((d) => { const i = d.lots.findIndex((x) => x.id === l.id); d.lots[i] = l; }); setEdit(null); }} />}
      {send && <TransferForm ctx={ctx} item={send} kind="lot" onClose={() => setSend(null)} />}
      {move && <MoveForm lot={move} onClose={() => setMove(null)} onSave={(freight, loc) => { update((d) => { const l = d.lots.find((x) => x.id === move.id)!; l.site = "depot"; l.location = loc; l.cost += freight; }); setMove(null); }} />}
      {share && <Catalogue ctx={ctx} onClose={() => setShare(false)} />}
      {reserve && <ReserveForm ctx={ctx} lot={db.lots.find((x) => x.id === reserve.lot.id) ?? reserve.lot} initial={reserve.r} onClose={() => setReserve(null)} />}
    </div>
  );
}

/** A lot from opening to today: where it came from, each sale on its own line, cost so far and margin on what is sold. */
function LotHistory({ ctx, lot: l, onClose, onEdit, onSend, onMove }: { ctx: Ctx; lot: SlabLot; onClose: () => void; onEdit?: (l: SlabLot) => void; onSend?: (l: SlabLot) => void; onMove?: (l: SlabLot) => void }) {
  const R = ctx.root;
  const C = ctx.costs;
  const party = (id: string) => R.parties.find((p) => p.id === id);
  const block = R.blocks.find((b) => b.id === l.blockId);
  const job = R.jobs.find((j) => j.blockId === l.blockId);
  const stores = storesShare(R, l);
  const all = lotCost(R, l);
  const unit = lotUnit(R, l);
  const opening = l.slabs?.length ? l.slabs.filter((x) => x.status !== "broken").length : l.pieces;
  const broken = l.slabs?.filter((x) => x.status === "broken").length ?? 0;
  const sales = useMemo(() => R.sales.filter((s) => s.lines.some((x) => x.lotId === l.id)).sort((a, b) => a.date.localeCompare(b.date)).map((s) => {
    const ln = s.lines.find((x) => x.lotId === l.id)!;
    const amount = ln.sqft * ln.rate;
    const cost = unit * ln.sqft;
    return { s, ln, amount, cost, margin: amount - cost };
  }), [R.sales, l.id, unit]);
  const soldSqft = sales.reduce((a, x) => a + x.ln.sqft, 0);
  const revenue = sales.reduce((a, x) => a + x.amount, 0);
  const soldCost = sales.reduce((a, x) => a + x.cost, 0);
  const margin = revenue - soldCost;
  const origin = block ? `Cut from block ${block.no}${job ? ` on ${job.machine}` : ""}` : l.shipmentId ? "Imported as slabs" : l.source === "purchase" ? `Bought from ${party(l.supplierId ?? "")?.company ?? "supplier"}${l.invoiceNo ? `, bill ${l.invoiceNo}` : ""}` : "Opening stock";
  const row = "grid grid-cols-[72px_minmax(0,1fr)_auto] gap-3 px-4 py-2.5";

  return (
    <Drawer open wide title={`Lot ${l.lotNo}`} sub={`${l.variety} · ${l.thicknessMm} mm ${l.finish} · grade ${l.grade} · ${l.site === "depot" ? "depot" : "unit"} ${l.location}`} onClose={onClose}
      footer={<>{onEdit && <button className="btn btn-primary" onClick={() => onEdit(l)}><Pencil size={14} />Price, rack and photos</button>}<button className="btn btn-quiet" onClick={onClose}>Close</button>
        {onSend && <button className="btn btn-quiet btn-sm ml-auto" onClick={() => onSend(l)}><ArrowRightLeft size={14} />Send to firm</button>}
        {onMove && l.site === "unit" && <button className="btn btn-quiet btn-sm ml-auto" onClick={() => onMove(l)}>Send to depot <ArrowRight size={14} /></button>}</>}>
      {C && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-surface p-4"><div className="text-sm text-ink-2">Total cost of the lot so far</div><div className="num mt-1 text-xl font-semibold">{rs(all)}</div><div className="text-[0.8rem] text-ink-3">{rs2(unit)}/sq ft on {n0(l.sqft)} sq ft</div></div>
          <div className="rounded-2xl bg-surface p-4"><div className="text-sm text-ink-2">Sold so far</div><div className="num mt-1 text-xl font-semibold">{rs(revenue)}</div><div className="text-[0.8rem] text-ink-3">{n0(soldSqft)} sq ft · {sales.length} invoice{sales.length === 1 ? "" : "s"}, before GST</div></div>
          <div className={`rounded-2xl p-4 ${margin < 0 ? "bg-neg-soft" : "bg-accent-soft"}`}><div className="text-sm text-ink-2">Net margin on slabs sold</div><div className="num mt-1 text-xl font-semibold">{sales.length ? rs(margin) : "—"}</div><div className="text-[0.8rem] text-ink-2">{revenue ? `${Math.round((margin / revenue) * 100)}% on sales · cost of sold ${rs(soldCost)}` : "Nothing sold yet"}</div></div>
        </div>
      )}

      <div className="mt-5 font-semibold">History</div>
      <div className="mt-2 overflow-hidden rounded-2xl bg-surface text-[0.88rem]">
        <div className={`${row} text-[0.76rem] text-ink-3`}><span>Date</span><span>Entry</span><span className="text-right">Sq ft{C ? " · ₹" : ""}</span></div>
        <div className={`${row} border-t border-surface-2`}>
          <span className="num">{dmy(l.createdAt)}</span>
          <span><b>Opening</b> · {origin}<span className="block text-[0.8rem] text-ink-3">{opening} slabs{broken ? ` · ${broken} broken on the saw` : ""}{C && stores > 0 ? ` · block and sawing ${rs(l.cost)}, stores ${rs(stores)}` : ""}</span></span>
          <span className="num text-right">+{n0(l.sqft)}{C && <span className="block text-[0.8rem] text-ink-3">{rs(all)}</span>}</span>
        </div>
        {(l.trail ?? []).map((t, i) => (
          <div key={`t${i}`} className={`${row} border-t border-surface-2`}>
            <span className="num">{dmy(t.date)}</span>
            <span>Moved to {firmName(R.settings, t.to)}<span className="block text-[0.8rem] text-ink-3">{[t.doc && `challan ${t.doc}`, t.note].filter(Boolean).join(" · ")}</span></span>
            <span className="num text-right text-ink-3">{C && t.value ? rs(t.value) : ""}</span>
          </div>
        ))}
        {sales.map(({ s, ln, amount, cost, margin: m }) => (
          <div key={s.id} className={`${row} border-t border-surface-2`}>
            <span className="num">{dmy(s.date)}</span>
            <span><b>Sale</b> · {s.invoiceNo} · {party(s.customerId)?.company ?? "—"}<span className="block text-[0.8rem] text-ink-3">{ln.slabIds?.length ? `${ln.slabIds.length} slab${ln.slabIds.length > 1 ? "s" : ""} · ` : ""}{rs2(ln.rate)}/sq ft{C ? ` · cost ${rs(cost)} · margin ${rs(m)}` : ""}{s.paid ? "" : " · payment due"}</span></span>
            <span className="num text-right">−{n0(ln.sqft)}{C && <span className={`block text-[0.8rem] ${m < 0 ? "text-neg" : "text-ink-3"}`}>{rs(amount)}</span>}</span>
          </div>
        ))}
        <div className={`${row} border-t border-surface-2 bg-surface-2/50 font-semibold`}>
          <span />
          <span>In stock now<span className="block text-[0.8rem] font-normal text-ink-3">{slabCount(l)} slabs{reservedCount(l) ? ` · ${reservedCount(l)} reserved` : ""}{C ? ` · ${rs(l.available * unit)} at cost` : ""}</span></span>
          <span className="num text-right">{n0(l.available)}</span>
        </div>
      </div>
      {!sales.length && <div className="mt-3"><Note>No sales from this lot yet.</Note></div>}
    </Drawer>
  );
}
