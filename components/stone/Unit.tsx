"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronRight, Layers, Play, Plus, QrCode, Scissors } from "lucide-react";
import { baseCost, blockCost, cbm, daysSince, dmy, jobCost, n0, n2, perTonne, r2, rs, rs2, spreadDamage, theoreticalSlabs, today, uid, weightCheck, damageNet, lakh } from "@/lib/stone/calc";
import type { Block, DamageEvent, JobBlock, JobOrder, SawJob, Slab, SlabLot } from "@/lib/stone/types";
import { jobsOf, leftOf } from "@/lib/stone/jobwork";
import { jobOnly } from "@/lib/stone/modules";
import { emptyBlock } from "@/lib/stone/seed";
import { nextLotNo, slabArea, slabNo, syncLot } from "@/lib/stone/slabs";
import { lotCost, lotUnit } from "@/lib/stone/costing";
import { firmOf } from "@/lib/stone/firms";
import type { Ctx } from "./StoneApp";
import { Weighment } from "./Weigh";
import BlockForm, { STATUS_LABEL } from "./BlockForm";
import QrLabels from "./QrLabels";
import TransferForm from "./Transfer";
import { JobCutForm, ReceiveJobBlock } from "./JobWork";
import LotsForm from "./LotsForm";
import { whereIs } from "@/lib/stone/godowns";
import { Badge, Drawer, F, Grid, Note, NumIn, Section, Sel, Stat, Table, TextIn, Area, type Col } from "./ui";

/** "slabs" and "lots" are steps on the chain that open Inventory → Slabs. */
type Tab = "yard" | "sawing" | "slabs" | "lots" | "damage" | "weight";
/** A block in the yard queue: our own, or a customer's block in for job work. */
type YardRow = Block & { job?: { o: JobOrder; b: JobBlock }; stage: "arrive" | "wait" | "saw" };

/** The factory floor: blocks in the yard go on the saw and come off as slabs. Stock itself lives under Inventory. */
export default function Unit({ ctx }: { ctx: Ctx }) {
  const { db, update } = ctx;
  const gate = ctx.can("blocks") !== "none";
  const proc = ctx.can("processing") !== "none";
  const allowed: Tab[] = [...(gate || proc ? (["yard", "weight"] as Tab[]) : []), ...(proc ? (["sawing", "slabs", "damage"] as Tab[]) : [])];
  const [tabRaw, setTabRaw] = useState<Tab>(["yard", "sawing", "damage", "weight"].includes(ctx.sub) ? (ctx.sub as Tab) : "yard");
  const only = jobOnly(ctx.mods);
  const setTab = (t: Tab) => (t === "slabs" || t === "lots" ? (only ? ctx.go("unit", "jobwork:ready") : ctx.go("inventory", "slabs")) : setTabRaw(t));
  const [jobRecv, setJobRecv] = useState<{ o: JobOrder; b: JobBlock } | null>(null);
  const [jobCut, setJobCut] = useState<{ o: JobOrder; b: JobBlock } | null>(null);
  const tab: Tab = allowed.includes(tabRaw) ? tabRaw : allowed[0] ?? "yard";
  const [labels, setLabels] = useState(false);
  const [send, setSend] = useState<Block | null>(null);
  const C = ctx.costs;
  const [edit, setEdit] = useState<Block | null>(null);
  const [receive, setReceive] = useState<Block | null>(null);
  const [lotsFor, setLotsFor] = useState<string | null>(null);
  const [dmg, setDmg] = useState<DamageEvent | null | "new">(null);

  const orders = jobsOf(db);
  const jobRows: YardRow[] = orders.filter((o) => !o.closed).flatMap((o) => o.blocks.filter((b) => b.status === "expected" || b.status === "in_yard" || b.status === "on_saw").map((b) => ({
    ...emptyBlock(), id: b.id, no: b.no, variety: b.variety, stoneType: b.stoneType, l: b.l, w: b.w, h: b.h, tonnes: b.tonnes, billedTonnes: b.tonnes, vehicleNo: b.vehicleNo, receivedOn: b.receivedOn,
    status: "godown" as const, job: { o, b }, stage: b.status === "expected" ? "arrive" as const : b.status === "on_saw" ? "saw" as const : "wait" as const,
  })));
  const jobReady = orders.flatMap((o) => o.blocks.filter((b) => b.status === "cut").map((b) => leftOf(o, b).slabs)).reduce((a, x) => a + x, 0);
  const jobLoad = (r: YardRow) => update((d) => { const b = jobsOf(d).find((o) => o.id === r.job!.o.id)?.blocks.find((x) => x.id === r.id); if (b) b.status = "on_saw"; });
  const own: YardRow[] = db.blocks.filter((b) => b.status === "godown" || b.status === "processing").map((b) => ({ ...b, stage: b.status === "processing" ? "saw" as const : "wait" as const }));
  const yard: YardRow[] = [...own, ...jobRows];
  const inYard = yard.filter((b) => b.stage !== "arrive");
  const transit = yard.filter((b) => b.stage === "arrive");
  const waiting = yard.filter((b) => b.stage === "wait");
  const onSaw = yard.filter((b) => b.stage === "saw");
  const unweighed = own.filter((b) => b.stage === "wait" && !b.tonnes);
  const issue = (b: Block) => { update((d) => { const x = d.blocks.find((y) => y.id === b.id); if (x) { x.status = "processing"; x.processOn = today(); } }); ctx.say(`${b.no} issued for processing`, "good"); };
  const flagged = db.blocks.filter((b) => b.status !== "written_off" && b.status !== "at_mine" && weightCheck(b)?.flag);
  const slabsInStock = db.lots.reduce((a, l) => a + (l.slabs?.filter((x) => x.status === "stock").length ?? 0), 0);
  const unitLots = db.lots.filter((l) => l.site === "unit" && l.available > 0);
  const jobsMonth = db.jobs.filter((j) => daysSince(j.finishedOn) <= 30);
  const varAvg = useMemo(() => {
    const m: Record<string, { s: number; t: number }> = {};
    for (const j of db.jobs) {
      const b = db.blocks.find((x) => x.id === j.blockId);
      if (!b?.tonnes) continue;
      (m[b.variety] ??= { s: 0, t: 0 }).s += j.sqft;
      m[b.variety].t += b.tonnes;
    }
    return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.s / v.t]));
  }, [db]);
  const allSqft = db.jobs.reduce((a, j) => a + j.sqft, 0);
  const allT = db.jobs.reduce((a, j) => a + (db.blocks.find((b) => b.id === j.blockId)?.tonnes ?? 0), 0);
  const recentLots = db.lots.filter((l) => l.blockId && daysSince(l.createdAt) <= 60);
  const avgCost = recentLots.reduce((a, l) => a + lotCost(ctx.root, l), 0) / Math.max(1, recentLots.reduce((a, l) => a + l.sqft, 0));

  const putBlock = (b: Block) => update((d) => { const i = d.blocks.findIndex((x) => x.id === b.id); if (i >= 0) d.blocks[i] = b; else d.blocks.push(b); });

  if (lotsFor !== null) return <LotsForm ctx={ctx} blockId={lotsFor || undefined} onClose={(id) => { setLotsFor(null); if (id) ctx.go("inventory", "slabs"); }} />;

  const yardCols: Col<YardRow>[] = [
    { key: "no", label: "Block", render: (b) => <div><div className="flex items-center gap-1.5 whitespace-nowrap font-medium">{b.no}{b.job && <Badge tone="info">Job</Badge>}</div><div className="text-[0.8rem] text-ink-3">{b.variety}{b.job ? "" : ` · ${b.grade}`}</div></div>, sort: (b) => b.no },
    { key: "od", label: "Ordered", render: (b) => <span className="num whitespace-nowrap">{dmy(b.date)}</span>, sort: (b) => b.date },
    { key: "src", label: "From", render: (b) => b.job ? <div><div>{db.parties.find((p) => p.id === b.job!.o.customerId)?.company ?? "—"}</div><div className="text-[0.8rem] text-ink-3">{b.job.o.no} · {b.job.o.thicknessMm} mm</div></div> : <div><div>{b.source === "own_mine" ? "Own quarry" : b.source === "import" ? "Import" : db.parties.find((p) => p.id === b.supplierId)?.company ?? "—"}</div><div className="text-[0.8rem] text-ink-3">{b.vehicleNo}</div></div> },
    { key: "t", label: "Tonnes", align: "right", render: (b) => { const c = weightCheck(b); return <div><div>{n2(b.tonnes || b.billedTonnes)}</div>{c?.flag && <div className="text-[0.78rem] font-medium text-neg">{c.flag === "short" ? "short" : "over"} {(Math.abs(c.pct) * 100).toFixed(1)}% vs {n2(b.billedTonnes)}</div>}</div>; }, sort: (b) => b.tonnes },
    ...(C ? [{ key: "c", label: "₹ / tonne", align: "right" as const, render: (b: YardRow) => b.job ? <span className="text-ink-3">Customer&apos;s</span> : <div><div>{b.tonnes ? rs(perTonne(b)) : "—"}</div>{b.damageAlloc > 0 && <div className="text-[0.78rem] text-warn">+{rs(b.damageAlloc)} damage</div>}</div>, sort: (b: YardRow) => (b.job ? 0 : perTonne(b)) }] : []),
    { key: "age", label: "In yard", align: "right", render: (b) => b.receivedOn ? `${daysSince(b.receivedOn)} d` : "—", sort: (b) => (b.receivedOn ? daysSince(b.receivedOn) : -1) },
    { key: "st", label: "Status", render: (b) => <Badge tone={b.stage === "arrive" ? "warn" : b.stage === "saw" ? "good" : "plain"}>{b.job ? (b.stage === "arrive" ? "Not arrived" : b.stage === "saw" ? "On the saw" : "In yard") : whereIs(b)}</Badge> },
    { key: "act", label: "", render: (b) => (
      <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
        {b.stage === "arrive" && b.job && ctx.edit("blocks") && <button className="btn btn-quiet btn-sm" onClick={() => setJobRecv(b.job!)}>Receive</button>}
        {b.stage === "wait" && !b.job && !b.tonnes && ctx.edit("blocks") && <button className="btn btn-quiet btn-sm" onClick={() => setReceive(b)}>Weigh</button>}
        {b.stage === "wait" && ctx.edit("processing") && <button className="btn btn-quiet btn-sm" onClick={() => (b.job ? jobLoad(b) : issue(b))}><Play size={13} />{b.job ? "Load on saw" : "Processing"}</button>}
        {b.stage === "saw" && ctx.edit("processing") && <button className="btn btn-primary btn-sm" onClick={() => (b.job ? setJobCut(b.job) : setLotsFor(b.id))}><Scissors size={13} />{b.job ? "Slabs out" : "Create lots"}</button>}
      </div>
    ) },
  ];

  const jobColsAll: Col<SawJob>[] = [
    { key: "b", label: "Block", render: (j) => { const b = db.blocks.find((x) => x.id === j.blockId); return <div><div className="font-medium">{b?.no}</div><div className="text-[0.8rem] text-ink-3">{b?.variety}</div></div>; } },
    { key: "sd", label: "Sawn on", render: (j) => <span className="num whitespace-nowrap">{dmy(j.finishedOn)}</span>, sort: (j) => j.finishedOn },
    { key: "m", label: "Machine", render: (j) => <div><div>{j.machine}</div><div className="text-[0.8rem] text-ink-3">{j.hours} h</div></div>, sort: (j) => j.machine },
    { key: "s", label: "Slabs", align: "right", render: (j) => `${j.slabs} × ${j.thicknessMm} mm` },
    { key: "q", label: "Sq ft", align: "right", render: (j) => n0(j.sqft), sort: (j) => j.sqft },
    { key: "y", label: "Sq ft / t", align: "right", render: (j) => { const b = db.blocks.find((x) => x.id === j.blockId); const y = b?.tonnes ? j.sqft / b.tonnes : 0; const avg = b ? varAvg[b.variety] : 0; return <div><div>{n0(y)}</div>{avg && y < avg * 0.92 ? <div className="text-[0.78rem] text-warn">avg {n0(avg)}</div> : null}</div>; }, sort: (j) => { const b = db.blocks.find((x) => x.id === j.blockId); return b?.tonnes ? j.sqft / b.tonnes : 0; } },
    { key: "pc", label: "Processing ₹/sq ft", align: "right", render: (j) => rs2(jobCost(j) / Math.max(1, j.sqft)) },
    { key: "lc", label: "Slab cost ₹/sq ft", align: "right", render: (j) => { const l = db.lots.find((x) => x.id === j.lotId); return l ? <span className="font-medium">{rs2(lotUnit(ctx.root, l))}</span> : "—"; }, sort: (j) => { const l = db.lots.find((x) => x.id === j.lotId); return l ? lotUnit(ctx.root, l) : 0; } },
  ];
  const jobCols = jobColsAll.filter((c) => C || (c.key !== "pc" && c.key !== "lc"));

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Blocks at the unit" value={`${inYard.length} · ${n0(inYard.reduce((a, b) => a + (b.tonnes || b.billedTonnes), 0))} t`} sub={`${C ? `${lakh(own.reduce((a, b) => a + blockCost(b), 0))} at cost · ` : ""}${onSaw.length} in processing`} />
        <Stat label="Slabs cut, last 30 days" value={`${n0(jobsMonth.reduce((a, j) => a + j.sqft, 0))} sq ft`} sub={`${jobsMonth.length} blocks sawn`} />
        <Stat label="Average yield" value={`${n0(allT ? allSqft / allT : 0)} sq ft/t`} sub="All sawn blocks" />
        {C ? <Stat label="Slab cost, last 60 days" value={`${rs2(avgCost)}/sq ft`} sub="Block, royalty, freight, damage, sawing and stores" /> : <Stat label="Slabs at unit" value={`${n0(unitLots.reduce((a, l) => a + l.available, 0))} sq ft`} sub={`${unitLots.length} lots`} />}
      </div>

      <ProcessChain tab={tab} setTab={setTab} allowed={allowed} stages={[
        { key: "yard", title: "Godown", count: waiting.length + transit.length, unit: "blocks",
          sub: [`${waiting.length} waiting`, unweighed.length ? `${unweighed.length} to weigh` : "", transit.length ? `${transit.length} customer block${transit.length > 1 ? "s" : ""} to arrive` : ""].filter(Boolean).join(" · "),
          todo: transit.length ? { text: `${transit.length} to receive at the gate`, go: "yard" } : waiting.length ? { text: `${waiting.length} ready for processing`, go: "yard" } : undefined },
        { key: "sawing", title: "Processing", count: onSaw.length, unit: "on the saw",
          sub: `${jobsMonth.length} blocks sawn in 30 days`,
          todo: onSaw.length ? { text: `${onSaw.length} to create lots for`, go: "sawing" } : undefined },
        only
          ? { key: "slabs", title: "Slabs", count: jobReady, unit: "to send back", sub: "Customers' slabs waiting at the unit", todo: jobReady ? { text: `${jobReady} slabs to send back`, go: "lots" } : undefined }
          : { key: "slabs", title: "Slabs", count: slabsInStock, unit: "in stock",
            sub: `${n0(jobsMonth.reduce((a, j) => a + j.sqft, 0))} sq ft cut in 30 days${jobReady ? ` · ${jobReady} customer slabs to send back` : ""}`,
            todo: unitLots.length ? { text: `${unitLots.length} lots at the unit to send on`, go: "lots" } : undefined },
      ]} links={["Processing", "Create lots"]} filters={[
        { key: "weight", label: "Weight flags", count: flagged.length, warn: true },
        { key: "damage", label: "Damage & loss", count: db.damages.length, warn: true },
      ]} actions={<>
        {tab === "yard" && <button className="btn btn-quiet btn-sm" onClick={() => setLabels(true)}><QrCode size={15} />QR labels</button>}
        {(tab === "yard" || tab === "sawing") && !only && ctx.edit("processing") && <button className="btn btn-primary btn-sm" onClick={() => setLotsFor("")}><Layers size={15} />Create lots</button>}
        {tab === "yard" && ctx.edit("blocks") && !only && <button className="btn btn-quiet btn-sm" onClick={() => ctx.go("purchases")}><Plus size={15} />New purchase</button>}
        {tab === "yard" && ctx.mods.jobwork && ctx.edit("jobwork") && <button className="btn btn-quiet btn-sm" onClick={() => ctx.go("unit", "jobwork:new")}><Plus size={15} />New job order</button>}
        {tab === "damage" && ctx.edit("processing") && <button className="btn btn-primary btn-sm" onClick={() => setDmg("new")}><AlertTriangle size={14} />Record damage</button>}
      </>} />

      {tab === "sawing" && onSaw.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {onSaw.map((b) => (
            <div key={b.id} className="flex items-center gap-3 rounded-2xl bg-accent-soft px-4 py-3">
              <Scissors size={16} className="shrink-0 text-accent" />
              <div className="min-w-0 flex-1"><div className="font-medium">{b.no} {b.job ? "is on the saw · job work" : "is being processed"}</div><div className="text-[0.82rem] text-ink-2">{b.variety} · {n2(b.tonnes || b.billedTonnes)} t{b.job ? ` · ${db.parties.find((p) => p.id === b.job!.o.customerId)?.company ?? ""}, ${b.job.o.thicknessMm} mm` : ""}</div></div>
              {ctx.edit("processing") && <button className="btn btn-primary btn-sm" onClick={() => (b.job ? setJobCut(b.job) : setLotsFor(b.id))}>{b.job ? "Slabs out" : "Create lots"}</button>}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4">
        {tab === "yard" && <Table rows={yard} cols={yardCols} onRow={(b) => (b.job ? ctx.go("unit", `jobwork:${b.job.o.id}`) : setEdit(b))} search={(b) => `${b.no} ${b.variety} ${b.vehicleNo} ${b.job ? `job ${db.parties.find((p) => p.id === b.job!.o.customerId)?.company ?? ""} ${b.job.o.no}` : ""}`} empty={only ? "No customer blocks in the yard. Make a job order when a block comes in." : "No blocks in the yard. Blocks dispatched from mines show up here."} />}
        {tab === "sawing" && <Table rows={[...db.jobs].reverse()} cols={jobCols} search={(j) => `${db.blocks.find((b) => b.id === j.blockId)?.no} ${j.machine}`} empty="No blocks sawn yet." />}
        {tab === "damage" && <DamageList ctx={ctx} onOpen={setDmg} />}
        {tab === "weight" && <WeightFlags ctx={ctx} rows={flagged} onOpen={setEdit} />}
      </div>

      {labels && <QrLabels ctx={ctx} blocks={yard.filter((b) => !b.job)} onClose={() => setLabels(false)} />}
      {edit && <BlockForm costs={C} db={db} initial={edit} mode="edit" onTransfer={ctx.firms.length > 1 && ctx.edit("blocks") ? () => { setSend(edit); setEdit(null); } : undefined} onClose={() => setEdit(null)} onSave={(b) => { putBlock(b); setEdit(null); }} onDelete={(id) => { update((d) => { d.blocks = d.blocks.filter((x) => x.id !== id); }); setEdit(null); }} />}
      {receive && <ReceiveForm ctx={ctx} block={receive} density={db.settings.density} onClose={() => setReceive(null)} onSave={(b, damaged) => { putBlock(b); setReceive(null); if (damaged) { setTab("damage"); setDmg("new"); } }} />}
      {send && <TransferForm ctx={ctx} item={send} kind="block" onClose={() => setSend(null)} />}
      {jobRecv && <ReceiveJobBlock ctx={ctx} order={jobRecv.o} block={jobRecv.b} onClose={() => setJobRecv(null)} />}
      {jobCut && <JobCutForm ctx={ctx} order={jobCut.o} block={jobCut.b} onClose={() => setJobCut(null)} />}
      {dmg && <DamageForm ctx={ctx} initial={dmg === "new" ? null : dmg} onClose={() => setDmg(null)} />}
    </div>
  );
}

/** Blocks whose gate weight is more than ±5% away from what the supplier quoted. */
function WeightFlags({ ctx, rows, onOpen }: { ctx: Ctx; rows: Block[]; onOpen: (b: Block) => void }) {
  const sup = (b: Block) => (b.source === "own_mine" ? "Own quarry" : b.source === "import" ? "Import" : ctx.db.parties.find((p) => p.id === b.supplierId)?.company ?? "—");
  const cols: Col<Block>[] = [
    { key: "no", label: "Block", render: (b) => <div><div className="font-medium">{b.no}</div><div className="text-[0.8rem] text-ink-3">{b.variety} · {b.receivedOn ? dmy(b.receivedOn) : "—"}</div></div>, sort: (b) => b.receivedOn ?? "" },
    { key: "s", label: "Supplier", render: (b) => <div><div>{sup(b)}</div><div className="text-[0.8rem] text-ink-3">{b.invoiceNo || b.eRawanna || "No bill no."}</div></div>, sort: sup },
    { key: "q", label: "Quoted", align: "right", render: (b) => `${n2(b.billedTonnes)} t` },
    { key: "r", label: "Received", align: "right", render: (b) => `${n2(b.tonnes)} t` },
    { key: "d", label: "Difference", align: "right", render: (b) => { const c = weightCheck(b)!; return <div className="font-medium text-neg"><div>{c.diff > 0 ? "+" : "−"}{n2(Math.abs(c.diff))} t</div><div className="text-[0.78rem]">{c.diff > 0 ? "+" : "−"}{(Math.abs(c.pct) * 100).toFixed(1)}%</div></div>; }, sort: (b) => weightCheck(b)!.pct },
    ...(ctx.costs ? [{ key: "v", label: "Value", align: "right" as const, render: (b: Block) => rs(Math.abs(weightCheck(b)!.diff) * b.rate) }] : []),
    { key: "f", label: "", render: (b) => <Badge tone="neg">{weightCheck(b)!.flag === "short" ? "Received less" : "Received more"}</Badge> },
  ];
  return (
    <div>
      <p className="mb-3 text-[0.86rem] text-ink-2">Gate weight (A − B) more than ±5% away from the supplier&apos;s bill or rawanna. Short ones mean the supplier billed for stone the unit didn&apos;t receive: raise a debit note.</p>
      <Table rows={rows} cols={cols} onRow={onOpen} search={(b) => `${b.no} ${b.variety} ${sup(b)}`} empty="No weight mismatches. Every received block is within ±5% of the supplier's weight." />
    </div>
  );
}

function ReceiveForm({ ctx, block, density, onSave, onClose }: { ctx: Ctx; block: Block; density: number; onSave: (b: Block, damaged: boolean) => void; onClose: () => void }) {
  // The gate weight starts empty: it has to be weighed (A − B) or typed, not copied from the bill.
  const [b, setB] = useState<Block>({ ...block, receivedOn: today(), tonnes: block.weigh?.gross && block.weigh?.tare ? block.tonnes : 0 });
  const [damaged, setDamaged] = useState(false);
  const set = <K extends keyof Block>(k: K, v: Block[K]) => setB((x) => ({ ...x, [k]: v }));
  return (
    <Drawer open title={`Received weight · ${block.no}`} sub={`${block.variety} · ${block.vehicleNo || "vehicle not noted"}`} onClose={onClose}
      footer={<>
        <button className="btn btn-primary" onClick={() => onSave({ ...b, tonnes: b.tonnes || b.billedTonnes, defects: damaged && !b.defects ? "Damaged in transit / unloading" : b.defects }, damaged)}>{damaged ? "Save and record damage" : "Save received weight"}</button>
        <button className="btn btn-quiet" onClick={onClose}>Cancel</button>
      </>}>
      <Section title="Weighment">
        <Weighment ctx={ctx} block={b} onChange={(p) => setB((x) => ({ ...x, ...p }))} />
      </Section>
      <Section title="Measured size">
        <Grid cols={3}>
          <F label="Length"><NumIn value={b.l} onChange={(v) => set("l", v)} suffix="cm" /></F>
          <F label="Width"><NumIn value={b.w} onChange={(v) => set("w", v)} suffix="cm" /></F>
          <F label="Height"><NumIn value={b.h} onChange={(v) => set("h", v)} suffix="cm" /></F>
        </Grid>
        {cbm(b) > 0 && <p className="mt-2 text-sm text-ink-3">{n2(cbm(b))} CBM · {n2(cbm(b) * density)} t expected at {density} t/m³</p>}
      </Section>
      <Section title="Condition">
        <div className="flex gap-2">
          <button type="button" className="chip" data-on={!damaged} onClick={() => setDamaged(false)}>Arrived fine</button>
          <button type="button" className="chip" data-on={damaged} onClick={() => setDamaged(true)}>Damaged on the trolley or while unloading</button>
        </div>
        <div className="mt-3"><F label="Defects seen"><Area value={b.defects} onChange={(v) => set("defects", v)} placeholder="Crack line, chipped edge, colour patch" /></F></div>
        <div className="mt-3"><F label="Received on"><TextIn type="date" value={b.receivedOn} onChange={(v) => set("receivedOn", v)} /></F></div>
      </Section>
    </Drawer>
  );
}

function DamageList({ ctx, onOpen }: { ctx: Ctx; onOpen: (e: DamageEvent) => void }) {
  const { db } = ctx;
  const cols: Col<DamageEvent>[] = [
    { key: "d", label: "Date", render: (e) => dmy(e.date), sort: (e) => e.date },
    { key: "v", label: "Vehicle", render: (e) => <div><div className="font-medium">{e.vehicleNo}</div><div className="max-w-[34ch] text-[0.8rem] text-ink-3">{e.cause}</div></div> },
    { key: "b", label: "Damaged", render: (e) => e.lines.map((l) => db.blocks.find((b) => b.id === l.blockId)?.no).join(", ") },
    { key: "n", label: "Net loss", align: "right", render: (e) => rs(damageNet(e)) },
    { key: "s", label: "Spread over", render: (e) => <div>{e.spreadIds.map((id) => db.blocks.find((b) => b.id === id)?.no).join(", ")}<div className="text-[0.8rem] text-ink-3">by {e.basis === "value" ? "value" : e.basis === "cbm" ? "CBM" : "tonnes"}</div></div> },
  ];
  return (
    <div className="space-y-4">
      <Note>When a block breaks on the trolley or while unloading, its cost doesn’t vanish. Record it here and the loss is added to the other blocks of that load, so their slabs carry the true cost.</Note>
      <Table rows={[...db.damages].reverse()} cols={cols} onRow={onOpen} empty="No damage recorded." />
    </div>
  );
}

function DamageForm({ ctx, initial, onClose }: { ctx: Ctx; initial: DamageEvent | null; onClose: () => void }) {
  const { db, update } = ctx;
  const vehicles = useMemo(() => {
    // One load = one vehicle on one dispatch date.
    const m = new Map<string, Block[]>();
    for (const b of [...db.blocks].sort((x, y) => y.date.localeCompare(x.date))) if (b.vehicleNo && daysSince(b.date) < 120) { const k = `${b.vehicleNo}|${b.date}`; m.set(k, [...(m.get(k) ?? []), b]); }
    return m;
  }, [db.blocks]);
  const [e, setE] = useState<DamageEvent>(() => initial ? structuredClone(initial) : { id: "", date: today(), vehicleNo: "", cause: "", lines: [], extra: 0, recovery: 0, basis: "tonne", spreadIds: [], alloc: {} });
  const locked = Boolean(initial);
  const [loadKey, setLoadKey] = useState(() => {
    if (!initial) return "";
    const b = db.blocks.find((x) => x.id === initial.lines[0]?.blockId);
    return b ? `${b.vehicleNo}|${b.date}` : "";
  });
  const load = vehicles.get(loadKey) ?? [];
  const damagedIds = e.lines.map((l) => l.blockId);
  const canDamage = (b: Block) => b.status === "godown" || b.status === "processing";
  const carriable = (b: Block) => canDamage(b) && !e.lines.find((l) => l.blockId === b.id && l.writeOff);
  const sameVariety = useMemo(() => db.blocks.filter((b) => carriable(b) && load.some((x) => x.variety === b.variety) && !load.includes(b)), [db.blocks, load, e.lines]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickVehicle = (k: string) => {
    const blocks = vehicles.get(k) ?? [];
    setLoadKey(k);
    setE((x) => ({ ...x, vehicleNo: k.split("|")[0] ?? "", lines: [], spreadIds: blocks.filter((b) => b.status === "godown" || b.status === "processing").map((b) => b.id) }));
  };
  const toggleDamaged = (b: Block) => setE((x) => {
    const has = x.lines.find((l) => l.blockId === b.id);
    const lines = has ? x.lines.filter((l) => l.blockId !== b.id) : [...x.lines, { blockId: b.id, loss: Math.round(baseCost(b)), writeOff: true }];
    const spreadIds = has ? [...x.spreadIds, b.id] : x.spreadIds.filter((id) => id !== b.id);
    return { ...x, lines, spreadIds };
  });
  const toggleSpread = (id: string) => setE((x) => ({ ...x, spreadIds: x.spreadIds.includes(id) ? x.spreadIds.filter((y) => y !== id) : [...x.spreadIds, id] }));
  const alloc = locked ? e.alloc : spreadDamage(db.blocks, e);
  const net = damageNet(e);

  const save = () => {
    update((d) => {
      const ev = { ...e, id: e.id || uid(), alloc };
      for (const [id, v] of Object.entries(alloc)) { const b = d.blocks.find((x) => x.id === id); if (b) b.damageAlloc = r2(b.damageAlloc + v); }
      for (const l of e.lines) { const b = d.blocks.find((x) => x.id === l.blockId); if (b && l.writeOff) { b.status = "written_off"; b.defects = b.defects || e.cause; } }
      d.damages.push(ev);
    });
    onClose();
  };
  const undo = () => {
    update((d) => {
      for (const [id, v] of Object.entries(e.alloc)) { const b = d.blocks.find((x) => x.id === id); if (b) b.damageAlloc = r2(Math.max(0, b.damageAlloc - v)); }
      for (const l of e.lines) { const b = d.blocks.find((x) => x.id === l.blockId); if (b && l.writeOff && b.status === "written_off") b.status = "godown"; }
      d.damages = d.damages.filter((x) => x.id !== e.id);
    });
    onClose();
  };
  const err = !e.vehicleNo ? "Pick the vehicle" : !e.lines.length ? "Tick the block that was damaged" : !e.spreadIds.length ? "Pick at least one block to carry the loss" : "";

  return (
    <Drawer open wide title={locked ? `Damage on ${e.vehicleNo}` : "Record transit or unloading damage"} sub="The loss is spread over the blocks that survived, so their cost per tonne rises." onClose={onClose}
      footer={locked ? <><button className="btn btn-quiet" onClick={onClose}>Close</button><button className="btn btn-quiet btn-sm ml-auto !text-neg" onClick={undo}>Undo this spread</button></> : <><button className="btn btn-primary" disabled={Boolean(err)} onClick={save}>Spread {rs(net)} and save</button><button className="btn btn-quiet" onClick={onClose}>Cancel</button>{err && <span className="text-sm text-ink-3">{err}</span>}</>}>
      <Section title="Which load">
        <Grid>
          <F label="Vehicle and dispatch date">{locked ? <div className="field">{e.vehicleNo}</div> : <Sel value={loadKey} onChange={pickVehicle} placeholder="Choose the load" options={[...vehicles.entries()].map(([k, bs]) => ({ v: k, l: `${bs[0].vehicleNo} · ${dmy(bs[0].date)} · ${bs.map((b) => b.no).join(", ")}` }))} />}</F>
          <F label="Date"><TextIn type="date" value={e.date} onChange={(v) => setE((x) => ({ ...x, date: v }))} /></F>
          <F label="What happened" span={2}><Area value={e.cause} onChange={(v) => setE((x) => ({ ...x, cause: v }))} placeholder="Block slipped while unloading with hydra; crack through the middle" /></F>
        </Grid>
      </Section>
      {loadKey && (
        <Section title="Blocks on this load">
          <div className="space-y-2">
            {load.map((b) => {
              const line = e.lines.find((l) => l.blockId === b.id);
              return (
                <div key={b.id} className={`flex flex-wrap items-center gap-3 rounded-xl px-3 py-2.5 ${line ? "bg-neg-soft" : "bg-surface"}`}>
                  <label className={`flex items-center gap-2.5 ${!canDamage(b) && !line ? "opacity-55" : ""}`}>
                    <input type="checkbox" disabled={locked || (!canDamage(b) && !line)} checked={Boolean(line)} onChange={() => toggleDamaged(b)} className="h-4 w-4 accent-[var(--neg)]" />
                    <span className="font-medium">{b.no}</span><span className="text-sm text-ink-2">{b.variety} · {n2(b.tonnes || b.billedTonnes)} t · {rs(baseCost(b))}{!canDamage(b) && !line ? ` · ${STATUS_LABEL[b.status].toLowerCase()}` : ""}</span>
                  </label>
                  {line && (
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-sm text-ink-2">Loss</span>
                      <div className="w-36"><NumIn value={line.loss} onChange={(v) => setE((x) => ({ ...x, lines: x.lines.map((l) => l.blockId === b.id ? { ...l, loss: v } : l) }))} suffix="₹" /></div>
                      <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" disabled={locked} checked={line.writeOff} onChange={() => setE((x) => ({ ...x, lines: x.lines.map((l) => l.blockId === b.id ? { ...l, writeOff: !l.writeOff } : l) }))} />Write off block</label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[0.82rem] text-ink-3">Untick “write off” when the block can still be sawn smaller; then enter only the value lost.</p>
        </Section>
      )}
      {e.lines.length > 0 && (
        <>
          <Section title="Other costs and recovery">
            <Grid cols={3}>
              <F label="Crane, re-loading, repair"><NumIn value={e.extra} onChange={(v) => setE((x) => ({ ...x, extra: v }))} suffix="₹" /></F>
              <F label="Recovered" hint="From transporter or insurance"><NumIn value={e.recovery} onChange={(v) => setE((x) => ({ ...x, recovery: v }))} suffix="₹" /></F>
              <F label="Spread by"><Sel value={e.basis} onChange={(v) => setE((x) => ({ ...x, basis: v as DamageEvent["basis"] }))} options={[{ v: "tonne", l: "Weight (tonnes)" }, { v: "cbm", l: "Volume (CBM)" }, { v: "value", l: "Block value" }]} /></F>
            </Grid>
          </Section>
          <Section title={`Who carries the ${rs(net)} loss`}>
            <div className="scroll-thin overflow-x-auto rounded-2xl bg-surface">
              <table className="w-full min-w-[560px] text-[0.88rem]">
                <thead><tr className="text-[0.78rem] text-ink-3"><th className="px-4 py-2 text-left font-medium">Block</th><th className="px-3 py-2 text-right font-medium">Tonnes</th><th className="px-3 py-2 text-right font-medium">Share</th><th className="px-3 py-2 text-right font-medium">₹/t before</th><th className="px-4 py-2 text-right font-medium">₹/t after</th></tr></thead>
                <tbody className="num">
                  {[...load.filter((b) => carriable(b) && !damagedIds.includes(b.id)), ...sameVariety].map((b) => {
                    const on = e.spreadIds.includes(b.id);
                    const share = alloc[b.id] ?? 0;
                    const before = perTonne(b) - (locked ? share : 0);
                    return (
                      <tr key={b.id} className="border-t border-surface-2">
                        <td className="px-4 py-2 text-left"><label className="flex items-center gap-2"><input type="checkbox" disabled={locked} checked={on} onChange={() => toggleSpread(b.id)} />{b.no}<span className="text-ink-3">{load.includes(b) ? "" : "· same variety"}</span></label></td>
                        <td className="px-3 py-2 text-right">{n2(b.tonnes)}</td>
                        <td className="px-3 py-2 text-right">{on ? rs(share) : "—"}</td>
                        <td className="px-3 py-2 text-right">{rs(before)}</td>
                        <td className="px-4 py-2 text-right font-medium">{on && b.tonnes ? rs(before + share / b.tonnes) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[0.82rem] text-ink-3">Only blocks not yet sawn can carry the loss. Their slabs will show the higher cost when they come off the saw.</p>
          </Section>
        </>
      )}
    </Drawer>
  );
}

export function MoveForm({ lot, onSave, onClose }: { lot: SlabLot; onSave: (freight: number, loc: string) => void; onClose: () => void }) {
  const [rate, setRate] = useState(1.5);
  const [loc, setLoc] = useState("Depot A-frame 1");
  return (
    <Drawer open title={`Send ${lot.lotNo} to depot`} sub={`${n0(lot.available)} sq ft of ${lot.variety}`} onClose={onClose}
      footer={<><button className="btn btn-primary" onClick={() => onSave(Math.round(rate * lot.available), loc)}>Move to depot</button><button className="btn btn-quiet" onClick={onClose}>Cancel</button></>}>
      <Grid>
        <F label="Shifting cost" hint={`${rs(rate * lot.available)} added to the lot`}><NumIn value={rate} onChange={setRate} suffix="₹/sq ft" /></F>
        <F label="Depot rack / A-frame"><TextIn value={loc} onChange={setLoc} /></F>
      </Grid>
    </Drawer>
  );
}

type Stage = { key: Tab; title: string; count: number; unit: string; sub: string; todo?: { text: string; go: Tab } };

/** The unit as a chain: steps spread across the full width, joined by one line running left to right. */
function ProcessChain({ tab, setTab, allowed, stages, links, filters, actions }: {
  tab: Tab; setTab: (t: Tab) => void; allowed: Tab[]; stages: Stage[]; links: string[];
  filters: { key: Tab; label: string; count: number; warn?: boolean }[]; actions: React.ReactNode;
}) {
  const shown = stages.filter((s) => allowed.includes(s.key));
  const active = (k: Tab) => tab === k || (k === "slabs" && tab === "lots");
  const cur = stages.find((s) => active(s.key));
  return (
    <div className="mt-6">
      <ol className="scroll-thin -mx-1 flex items-center overflow-x-auto px-1 pb-1 pt-1 sm:pt-5" aria-label="Processing steps">
        {shown.map((s, i) => {
          const on = active(s.key);
          const idx = stages.findIndex((x) => x.key === s.key);
          const last = i === shown.length - 1;
          return (
            <li key={s.key} className={`flex items-center ${last ? "shrink-0" : "flex-1 sm:min-w-[150px]"}`}>
              <button type="button" onClick={() => setTab(s.key)} aria-current={on ? "step" : undefined} title={s.todo?.text ?? "All caught up"}
                className={`focusable relative inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full pl-1.5 pr-3.5 text-[0.88rem] font-medium transition-colors ${on ? "bg-accent text-accent-ink shadow-sm" : "bg-surface text-ink hover:bg-surface-2"}`}>
                <span className={`num grid h-6 w-6 place-items-center rounded-full text-[0.72rem] font-semibold ${on ? "bg-accent-ink/20" : "bg-surface-2 text-ink-2"}`}>{idx + 1}</span>
                {s.title}
                <span className={`num ${on ? "opacity-80" : "text-ink-3"}`}>{n0(s.count)}</span>
                {s.todo && <span className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-warn ring-2 ${on ? "ring-accent" : "ring-ground"}`} aria-label="Needs attention" />}
              </button>
              {!last && (
                <span className="relative flex min-w-[28px] flex-1 items-center pl-2 pr-1" aria-hidden>
                  <span className="h-[2px] flex-1 rounded-full bg-accent/45" />
                  <ChevronRight size={16} strokeWidth={2.5} className="-ml-[7px] shrink-0 text-accent/70" />
                  <span className="absolute inset-x-0 -top-4 hidden text-center text-[0.68rem] sm:block font-medium uppercase tracking-wide text-ink-3">{links[idx]}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {cur && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[0.84rem] text-ink-3">
          <span>{cur.sub}</span>
          <span aria-hidden>·</span>
          {cur.todo ? <span className="inline-flex items-center gap-1.5 font-medium text-warn"><span className="h-1.5 w-1.5 rounded-full bg-warn" />{cur.todo.text}</span> : <span className="inline-flex items-center gap-1 font-medium text-accent"><Check size={13} />All caught up</span>}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {filters.filter((f) => allowed.includes(f.key)).map((f) => (
          <button key={f.key} type="button" className="chip !h-9" data-on={tab === f.key} onClick={() => setTab(tab === f.key ? (f.key === "lots" ? "slabs" : "yard") : f.key)}>
            {f.label}<span className={`num ml-1.5 ${f.warn && f.count ? "text-warn" : "opacity-70"}`}>{f.count}</span>
          </button>
        ))}
        <div className="ml-auto flex flex-wrap gap-2">{actions}</div>
      </div>
    </div>
  );
}
