"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, Play, Plus, QrCode, Scissors } from "lucide-react";
import { baseCost, blockCost, cbm, daysSince, dmy, jobCost, n0, n2, perTonne, r2, rs, rs2, spreadDamage, theoreticalSlabs, today, uid, weightGap, damageNet, lakh } from "@/lib/stone/calc";
import type { Block, DamageEvent, SawJob, Slab, SlabLot } from "@/lib/stone/types";
import { nextLotNo, slabArea, slabNo, syncLot } from "@/lib/stone/slabs";
import { lotCost, lotUnit } from "@/lib/stone/costing";
import { firmOf } from "@/lib/stone/firms";
import type { Ctx } from "./StoneApp";
import BlockForm, { STATUS_LABEL } from "./BlockForm";
import QrLabels from "./QrLabels";
import TransferForm from "./Transfer";
import { Badge, Drawer, F, Grid, Note, NumIn, Section, Sel, Seg, Stat, Table, TextIn, Area, type Col } from "./ui";

type Tab = "yard" | "sawing" | "damage";

/** The factory floor: blocks in the yard go on the saw and come off as slabs. Stock itself lives under Inventory. */
export default function Unit({ ctx }: { ctx: Ctx }) {
  const { db, update } = ctx;
  const gate = ctx.can("blocks") !== "none";
  const proc = ctx.can("processing") !== "none";
  const allowed: Tab[] = [...(gate || proc ? (["yard"] as Tab[]) : []), ...(proc ? (["sawing", "damage"] as Tab[]) : [])];
  const [tabRaw, setTab] = useState<Tab>((ctx.sub as Tab) || "yard");
  const tab: Tab = allowed.includes(tabRaw) ? tabRaw : allowed[0] ?? "yard";
  const [labels, setLabels] = useState(false);
  const [send, setSend] = useState<Block | null>(null);
  const C = ctx.costs;
  const [edit, setEdit] = useState<Block | null>(null);
  const [receive, setReceive] = useState<Block | null>(null);
  const [saw, setSaw] = useState<Block | null>(null);
  const [dmg, setDmg] = useState<DamageEvent | null | "new">(null);

  const yard = db.blocks.filter((b) => ["in_transit", "in_yard", "on_saw"].includes(b.status));
  const inYard = yard.filter((b) => b.status !== "in_transit");
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

  const yardCols: Col<Block>[] = [
    { key: "no", label: "Block", render: (b) => <div><div className="font-medium">{b.no}</div><div className="text-[0.8rem] text-ink-3">{b.variety} · {b.grade}</div></div>, sort: (b) => b.no },
    { key: "src", label: "From", render: (b) => <div><div>{b.source === "own_mine" ? "Own quarry" : b.source === "import" ? "Import" : db.parties.find((p) => p.id === b.supplierId)?.company ?? "—"}</div><div className="text-[0.8rem] text-ink-3">{b.vehicleNo}</div></div> },
    { key: "t", label: "Tonnes", align: "right", render: (b) => { const g = weightGap(b); return <div><div>{n2(b.tonnes || b.billedTonnes)}</div>{g > 0.02 && <div className="text-[0.78rem] text-warn">billed {n2(b.billedTonnes)}</div>}</div>; }, sort: (b) => b.tonnes },
    ...(C ? [{ key: "c", label: "₹ / tonne", align: "right" as const, render: (b: Block) => <div><div>{b.tonnes ? rs(perTonne(b)) : "—"}</div>{b.damageAlloc > 0 && <div className="text-[0.78rem] text-warn">+{rs(b.damageAlloc)} damage</div>}</div>, sort: (b: Block) => perTonne(b) }] : []),
    { key: "age", label: "In yard", align: "right", render: (b) => b.receivedOn ? `${daysSince(b.receivedOn)} d` : "—", sort: (b) => (b.receivedOn ? daysSince(b.receivedOn) : -1) },
    { key: "st", label: "Status", render: (b) => <Badge tone={b.status === "in_transit" ? "warn" : b.status === "on_saw" ? "good" : "plain"}>{STATUS_LABEL[b.status]}</Badge> },
    { key: "act", label: "", render: (b) => (
      <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
        {b.status === "in_transit" && ctx.edit("blocks") && <button className="btn btn-quiet btn-sm" onClick={() => setReceive(b)}>Receive</button>}
        {b.status === "in_yard" && ctx.edit("processing") && <button className="btn btn-quiet btn-sm" onClick={() => { update((d) => { d.blocks.find((y) => y.id === b.id)!.status = "on_saw"; }); }}><Play size={13} />Load on saw</button>}
        {b.status === "on_saw" && ctx.edit("processing") && <button className="btn btn-primary btn-sm" onClick={() => setSaw(b)}><Scissors size={13} />Slabs out</button>}
      </div>
    ) },
  ];

  const jobColsAll: Col<SawJob>[] = [
    { key: "b", label: "Block", render: (j) => { const b = db.blocks.find((x) => x.id === j.blockId); return <div><div className="font-medium">{b?.no}</div><div className="text-[0.8rem] text-ink-3">{b?.variety}</div></div>; } },
    { key: "m", label: "Machine", render: (j) => <div><div>{j.machine}</div><div className="text-[0.8rem] text-ink-3">{dmy(j.finishedOn)} · {j.hours} h</div></div>, sort: (j) => j.finishedOn },
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
        <Stat label="Blocks in yard" value={`${inYard.length} · ${n0(inYard.reduce((a, b) => a + b.tonnes, 0))} t`} sub={C ? `${lakh(inYard.reduce((a, b) => a + blockCost(b), 0))} at cost · ${yard.length - inYard.length} on the road` : `${yard.length - inYard.length} on the road`} />
        <Stat label="Slabs cut, last 30 days" value={`${n0(jobsMonth.reduce((a, j) => a + j.sqft, 0))} sq ft`} sub={`${jobsMonth.length} blocks sawn`} />
        <Stat label="Average yield" value={`${n0(allT ? allSqft / allT : 0)} sq ft/t`} sub="All sawn blocks" />
        {C ? <Stat label="Slab cost, last 60 days" value={`${rs2(avgCost)}/sq ft`} sub="Block, royalty, freight, damage, sawing and stores" /> : <Stat label="Slabs at unit" value={`${n0(unitLots.reduce((a, l) => a + l.available, 0))} sq ft`} sub={`${unitLots.length} lots`} />}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Seg value={tab} onChange={setTab} tabs={([
          { key: "yard", label: "Block yard", count: yard.length },
          { key: "sawing", label: "Sawing log", count: db.jobs.length },
          { key: "damage", label: "Damage & loss", count: db.damages.length },
        ] as { key: Tab; label: string; count: number }[]).filter((t) => allowed.includes(t.key))} />
        <div className="ml-auto flex gap-2">
          {tab === "yard" && <button className="btn btn-quiet btn-sm" onClick={() => setLabels(true)}><QrCode size={15} />QR labels</button>}
          {tab === "yard" && ctx.edit("blocks") && <button className="btn btn-quiet btn-sm" onClick={() => ctx.go("purchases")}><Plus size={15} />New purchase</button>}
          {tab === "damage" && ctx.edit("processing") && <button className="btn btn-primary btn-sm" onClick={() => setDmg("new")}><AlertTriangle size={14} />Record damage</button>}
        </div>
      </div>

      <div className="mt-4">
        {tab === "yard" && <Table rows={yard} cols={yardCols} onRow={setEdit} search={(b) => `${b.no} ${b.variety} ${b.vehicleNo}`} empty="No blocks in the yard. Blocks dispatched from mines show up here." />}
        {tab === "sawing" && <Table rows={[...db.jobs].reverse()} cols={jobCols} search={(j) => `${db.blocks.find((b) => b.id === j.blockId)?.no} ${j.machine}`} empty="No blocks sawn yet." />}
        {tab === "damage" && <DamageList ctx={ctx} onOpen={setDmg} />}
      </div>

      {labels && <QrLabels ctx={ctx} blocks={yard} onClose={() => setLabels(false)} />}
      {edit && <BlockForm costs={C} db={db} initial={edit} mode="edit" onTransfer={ctx.firms.length > 1 && ctx.edit("blocks") ? () => { setSend(edit); setEdit(null); } : undefined} onClose={() => setEdit(null)} onSave={(b) => { putBlock(b); setEdit(null); }} onDelete={(id) => { update((d) => { d.blocks = d.blocks.filter((x) => x.id !== id); }); setEdit(null); }} />}
      {receive && <ReceiveForm block={receive} density={db.settings.density} onClose={() => setReceive(null)} onSave={(b, damaged) => { putBlock(b); setReceive(null); if (damaged) { setTab("damage"); setDmg("new"); } }} />}
      {send && <TransferForm ctx={ctx} item={send} kind="block" onClose={() => setSend(null)} />}
      {saw && <SawForm ctx={ctx} block={saw} onClose={() => setSaw(null)} onDone={() => { setSaw(null); ctx.go("inventory", "slabs"); }} />}
      {dmg && <DamageForm ctx={ctx} initial={dmg === "new" ? null : dmg} onClose={() => setDmg(null)} />}
    </div>
  );
}

const pendingMachine: Record<string, string> = {};

function ReceiveForm({ block, density, onSave, onClose }: { block: Block; density: number; onSave: (b: Block, damaged: boolean) => void; onClose: () => void }) {
  const [b, setB] = useState<Block>({ ...block, receivedOn: today() });
  const [damaged, setDamaged] = useState(false);
  const set = <K extends keyof Block>(k: K, v: Block[K]) => setB((x) => ({ ...x, [k]: v }));
  const gap = weightGap(b);
  return (
    <Drawer open title={`Receive ${block.no}`} sub={`${block.variety} · ${block.vehicleNo || "vehicle not noted"}`} onClose={onClose}
      footer={<>
        <button className="btn btn-primary" onClick={() => onSave({ ...b, status: "in_yard", defects: damaged && !b.defects ? "Damaged in transit / unloading" : b.defects }, damaged)}>{damaged ? "Receive and record damage" : "Receive into yard"}</button>
        <button className="btn btn-quiet" onClick={onClose}>Cancel</button>
      </>}>
      <Section title="Weighbridge">
        <Grid cols={3}>
          <F label="Net weight at gate"><NumIn value={b.tonnes} onChange={(v) => set("tonnes", v)} suffix="t" /></F>
          <F label="Billed / rawanna"><NumIn value={b.billedTonnes} onChange={(v) => set("billedTonnes", v)} suffix="t" /></F>
          <F label="Slip no."><TextIn value={b.weighSlip} onChange={(v) => set("weighSlip", v)} upper /></F>
        </Grid>
        {gap > 0.02 && <div className="mt-3"><Note tone="warn">{(gap * 100).toFixed(1)}% short of the bill: {n2(b.billedTonnes - b.tonnes)} t, about {rs((b.billedTonnes - b.tonnes) * b.rate)}.</Note></div>}
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

type Row = { id: string; no: string; l: number; w: number; sqft: number; grade: SawJob["grade"]; lotNo: string; broken: boolean };

function SawForm({ ctx, block, onClose, onDone }: { ctx: Ctx; block: Block; onClose: () => void; onDone: () => void }) {
  const { db, update } = ctx;
  const S = db.settings;
  const C = ctx.costs;
  // With Stores in use, blades, resin, netting and polishing come from what the store issues each month, spread per sq ft.
  const fromStores = ctx.mods.stores;
  const est = (rate: number, sqft: number) => (fromStores ? 0 : Math.round(sqft * rate));
  const firstLot = nextLotNo(db);
  const mkRows = (n: number, L: number, W: number, from: Row[] = [], lot = firstLot, grade = block.grade): Row[] =>
    Array.from({ length: Math.max(0, Math.min(200, Math.round(n))) }, (_, i) => from[i] ?? { id: uid(), no: slabNo(block.no, i + 1), l: L, w: W, sqft: slabArea(L, W), grade, lotNo: from[from.length - 1]?.lotNo ?? lot, broken: false });
  const [j, setJ] = useState<SawJob>(() => {
    const thick = block.stoneType === "granite" ? 17 : 18;
    const slabs = Math.max(1, theoreticalSlabs(block.h, thick) - 2);
    const sqft = Math.round((slabs * (block.l - 6) * (block.w - 4)) / 929.03);
    const hours = block.stoneType === "granite" ? 70 : 28;
    return {
      id: uid(), blockId: block.id, machine: pendingMachine[block.id] || S.machines[0] || "Gang saw 1", startedOn: today(), finishedOn: today(), thicknessMm: thick, slabs,
      slabL: block.l - 6, slabW: block.w - 4, sqft, rejectSqft: 0, hours, power: Math.round(hours * S.sawKw * 0.8 * S.powerRate), blades: est(S.bladePerSqft, sqft),
      resin: est(S.resinPerSqft, sqft), netting: est(S.nettingPerSqft, sqft), polishing: est(S.polishPerSqft, sqft), labour: Math.round(sqft * S.labourPerSqft), other: 0,
      finish: "Polished", grade: block.grade, lotId: "",
    };
  });
  const [rows, setRows] = useState<Row[]>(() => mkRows(j.slabs, j.slabL, j.slabW));
  const [range, setRange] = useState({ from: 1, to: 1, lot: "" });
  const [loc, setLoc] = useState("Unit rack 1");
  const [list, setList] = useState(0);

  const setCount = (n: number) => { setJ((x) => ({ ...x, slabs: n })); setRows((r) => mkRows(n, j.slabL, j.slabW, r)); };
  const setAvg = (k: "slabL" | "slabW", v: number) => {
    const old = { l: j.slabL, w: j.slabW };
    setJ((x) => ({ ...x, [k]: v }));
    // Rows still at the old average follow the new one; rows measured one by one keep their size.
    setRows((r) => r.map((x) => {
      if (x.l !== old.l || x.w !== old.w) return x;
      const l = k === "slabL" ? v : x.l, w = k === "slabW" ? v : x.w;
      return { ...x, l, w, sqft: slabArea(l, w) };
    }));
  };
  const setRow = (i: number, p: Partial<Row>) => setRows((r) => r.map((x, k) => {
    if (k !== i) return x;
    const n = { ...x, ...p };
    if (("l" in p || "w" in p) && n.l && n.w) n.sqft = slabArea(n.l, n.w);
    return n;
  }));
  const allLot = (lot: string) => setRows((r) => r.map((x) => ({ ...x, lotNo: lot })));
  const applyRange = () => {
    const a = Math.max(1, Math.min(range.from, range.to)), b = Math.min(rows.length, Math.max(range.from, range.to));
    if (!range.lot.trim()) return;
    setRows((r) => r.map((x, k) => (k + 1 >= a && k + 1 <= b ? { ...x, lotNo: range.lot.trim() } : x)));
    setRange({ from: b + 1, to: rows.length, lot: nextLotNo(db, [...rows.map((x) => x.lotNo), range.lot.trim()]) });
  };

  const total = r2(rows.reduce((a, x) => a + x.sqft, 0));
  const reject = r2(rows.filter((x) => x.broken).reduce((a, x) => a + x.sqft, 0));
  const good = Math.max(0, total - reject);
  const job = { ...j, sqft: Math.round(total), rejectSqft: Math.round(reject), slabs: rows.length };
  const allCost = blockCost(block) + jobCost(job);
  const theo = theoreticalSlabs(block.h, j.thicknessMm);
  const y = block.tonnes ? total / block.tonnes : 0;

  const groups = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const x of rows) m.set(x.lotNo.trim(), [...(m.get(x.lotNo.trim()) ?? []), x]);
    return [...m.entries()].map(([no, rs]) => {
      const ok = rs.filter((x) => !x.broken);
      const sqft = ok.reduce((a, x) => a + x.sqft, 0);
      const ex = db.lots.find((l) => l.lotNo === no);
      return { no, rs, ok: ok.length, sqft, cost: good ? (allCost * sqft) / good : 0, ex, clash: ex && (ex.variety !== block.variety || ex.thicknessMm !== j.thicknessMm) };
    });
  }, [rows, db.lots, allCost, good, block.variety, j.thicknessMm]);
  const err = !rows.length ? "Enter the number of slabs" : groups.some((g) => !g.no) ? "Every slab needs a lot no." : groups.find((g) => g.clash) ? `Lot ${groups.find((g) => g.clash)!.no} already holds ${groups.find((g) => g.clash)!.ex!.variety} ${groups.find((g) => g.clash)!.ex!.thicknessMm} mm` : "";

  const save = () => {
    update((d) => {
      const ids: string[] = [];
      for (const g of groups) {
        const slabs: Slab[] = g.rs.map((x) => ({ id: x.id, no: x.no, blockId: block.id, l: x.l, w: x.w, sqft: x.sqft, grade: x.grade, status: x.broken ? "broken" : "stock" }));
        const ex = d.lots.find((l) => l.lotNo === g.no && (!ctx.firm || firmOf(l, d.settings) === ctx.firm.id));
        if (ex) {
          ex.slabs = [...(ex.slabs ?? []), ...slabs];
          ex.cost += Math.round(g.cost);
          syncLot(ex);
          ids.push(ex.id);
          continue;
        }
        const lot: SlabLot = { id: uid(), lotNo: g.no, blockId: block.id, shipmentId: "", variety: block.variety, stoneType: block.stoneType, thicknessMm: j.thicknessMm, finish: j.finish, grade: g.rs[0]?.grade ?? j.grade, pieces: 0, sqft: 0, available: 0, cost: Math.round(g.cost), listRate: list, site: "unit", location: loc, createdAt: j.finishedOn, slabs };
        syncLot(lot);
        d.lots.push(lot);
        ids.push(lot.id);
      }
      d.jobs.push({ ...job, lotId: ids[0] ?? "" });
      d.blocks.find((x) => x.id === block.id)!.status = "sawn";
    });
    ctx.say(`${rows.length - rows.filter((x) => x.broken).length} slabs of ${block.no} in stock, in ${groups.length} lot${groups.length > 1 ? "s" : ""}`, "good");
    onDone();
  };

  return (
    <Drawer open title={`Slabs out of ${block.no}`} sub={`${block.variety} · ${n2(block.tonnes)} t · ${block.l}×${block.w}×${block.h} cm`} onClose={onClose} wide
      footer={<><button className="btn btn-primary" disabled={Boolean(err)} onClick={save}>Stock {rows.length - rows.filter((x) => x.broken).length} slabs · {n0(good)} sq ft</button><button className="btn btn-quiet" onClick={onClose}>Cancel</button>{err && <span className="text-sm text-neg">{err}</span>}</>}>
      <Section title="Cut">
        <Grid cols={3}>
          <F label="Machine"><Sel value={j.machine} onChange={(v) => setJ({ ...j, machine: v })} options={S.machines.map((m) => ({ v: m, l: m }))} /></F>
          <F label="Thickness"><NumIn value={j.thicknessMm} onChange={(v) => setJ({ ...j, thicknessMm: v })} suffix="mm" /></F>
          <F label="Number of slabs" hint={`Block height allows ${theo} at ${j.thicknessMm} mm + 5 mm blade`}><NumIn value={j.slabs} onChange={setCount} /></F>
          <F label="Usual slab length" hint="Fills every slab; change any one below"><NumIn value={j.slabL} onChange={(v) => setAvg("slabL", v)} suffix="cm" /></F>
          <F label="Usual slab width"><NumIn value={j.slabW} onChange={(v) => setAvg("slabW", v)} suffix="cm" /></F>
          <F label="Saw hours"><NumIn value={j.hours} onChange={(v) => setJ({ ...j, hours: v })} suffix="h" /></F>
          <F label="Finish"><Sel value={j.finish} onChange={(v) => setJ({ ...j, finish: v })} options={["Polished", "Honed", "Leather", "Flamed", "Unpolished"].map((v) => ({ v, l: v }))} /></F>
          <F label="Finished on"><TextIn type="date" value={j.finishedOn} onChange={(v) => setJ({ ...j, finishedOn: v })} /></F>
        </Grid>
      </Section>

      <Section title={`Slabs · ${rows.length}`} aside={<span className="text-sm text-ink-2">{n0(total)} sq ft{reject ? ` · ${n0(reject)} broken` : ""}</span>}>
        <div className="mb-3 flex flex-wrap items-end gap-2 rounded-2xl bg-surface p-3">
          <F label="Lot no. for all slabs"><div className="flex gap-1.5"><TextIn value={rows[0]?.lotNo ?? ""} onChange={allLot} /></div></F>
          <span className="pb-2.5 text-sm text-ink-3">or split:</span>
          <div className="w-20"><F label="Slab"><NumIn value={range.from} onChange={(v) => setRange({ ...range, from: v })} /></F></div>
          <div className="w-20"><F label="to"><NumIn value={range.to} onChange={(v) => setRange({ ...range, to: v })} /></F></div>
          <div className="w-32"><F label="into lot"><TextIn value={range.lot} onChange={(v) => setRange({ ...range, lot: v })} placeholder={nextLotNo(db, rows.map((x) => x.lotNo))} /></F></div>
          <button className="btn btn-quiet btn-sm mb-0.5" disabled={!range.lot.trim()} onClick={applyRange}>Apply</button>
        </div>
        <div className="scroll-thin max-h-[420px] overflow-auto rounded-2xl bg-surface">
          <table className="w-full min-w-[640px] text-[0.86rem]">
            <thead className="sticky top-0 bg-surface"><tr className="text-[0.76rem] text-ink-3"><th className="py-2 pl-3 text-left font-medium">Slab</th><th className="px-2 text-left font-medium">Length cm</th><th className="px-2 text-left font-medium">Width cm</th><th className="px-2 text-right font-medium">Sq ft</th><th className="px-2 text-left font-medium">Grade</th><th className="px-2 text-left font-medium">Lot</th><th className="px-2 pr-3 text-left font-medium">Broken</th></tr></thead>
            <tbody>
              {rows.map((x, i) => (
                <tr key={x.id} className={`border-t border-surface-2 ${x.broken ? "bg-neg-soft" : ""}`}>
                  <td className="num py-1 pl-3 font-medium">{x.no}</td>
                  <td className="px-2 py-1"><input className="field !w-20 !py-1" inputMode="decimal" value={x.l || ""} onChange={(e) => setRow(i, { l: Number(e.target.value) || 0 })} aria-label={`${x.no} length`} /></td>
                  <td className="px-2 py-1"><input className="field !w-20 !py-1" inputMode="decimal" value={x.w || ""} onChange={(e) => setRow(i, { w: Number(e.target.value) || 0 })} aria-label={`${x.no} width`} /></td>
                  <td className="num px-2 py-1 text-right">{n2(x.sqft)}</td>
                  <td className="px-2 py-1"><select className="field !w-24 !py-1" value={x.grade} onChange={(e) => setRow(i, { grade: e.target.value as Row["grade"] })} aria-label={`${x.no} grade`}>{["A", "B", "C", "Commercial"].map((g) => <option key={g}>{g}</option>)}</select></td>
                  <td className="px-2 py-1"><input className="field !w-24 !py-1" value={x.lotNo} onChange={(e) => setRow(i, { lotNo: e.target.value })} aria-label={`${x.no} lot`} /></td>
                  <td className="px-2 py-1 pr-3"><input type="checkbox" checked={x.broken} onChange={(e) => setRow(i, { broken: e.target.checked })} aria-label={`${x.no} broken`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-3 flex flex-wrap gap-2">
          {groups.map((g) => (
            <li key={g.no || "-"} className={`rounded-xl px-3 py-2 text-[0.84rem] ${g.clash ? "bg-neg-soft" : "bg-accent-soft"}`}>
              <b>Lot {g.no || "?"}</b> · {g.ok} slabs · {n0(g.sqft)} sq ft{C && g.sqft ? ` · ${rs2(g.cost / g.sqft)}/sq ft` : ""}{g.ex && !g.clash ? " · adds to the existing lot" : ""}
            </li>
          ))}
        </ul>
      </Section>

      {C && <Section title="Processing cost" aside={<button className="btn btn-quiet btn-sm" onClick={() => setJ((x) => ({ ...x, power: Math.round(x.hours * S.sawKw * 0.8 * S.powerRate), blades: est(S.bladePerSqft, total), resin: est(S.resinPerSqft, total), netting: est(S.nettingPerSqft, total), polishing: est(S.polishPerSqft, total), labour: Math.round(total * S.labourPerSqft) }))}>Recalculate from rates</button>}>
        <Grid cols={3}>
          <F label="Power"><NumIn value={j.power} onChange={(v) => setJ({ ...j, power: v })} suffix="₹" /></F>
          {!fromStores && <>
            <F label="Blades / wire"><NumIn value={j.blades} onChange={(v) => setJ({ ...j, blades: v })} suffix="₹" /></F>
            <F label="Resin / epoxy"><NumIn value={j.resin} onChange={(v) => setJ({ ...j, resin: v })} suffix="₹" /></F>
            <F label="Fibre netting"><NumIn value={j.netting} onChange={(v) => setJ({ ...j, netting: v })} suffix="₹" /></F>
            <F label="Polishing line"><NumIn value={j.polishing} onChange={(v) => setJ({ ...j, polishing: v })} suffix="₹" /></F>
          </>}
          <F label="Labour"><NumIn value={j.labour} onChange={(v) => setJ({ ...j, labour: v })} suffix="₹" /></F>
          <F label="Other"><NumIn value={j.other} onChange={(v) => setJ({ ...j, other: v })} suffix="₹" /></F>
        </Grid>
        {fromStores && <p className="mt-2 text-[0.82rem] text-ink-3">Blades, resin, netting and polishing are not entered here. Everything issued from Stores this month is spread over the sq ft cut this month and added to each lot.</p>}
      </Section>}
      <Section title="Into stock">
        <Grid cols={3}>
          <F label="Rack / A-frame"><TextIn value={loc} onChange={setLoc} /></F>
          <F label="List price" hint="Optional, for new lots"><NumIn value={list} onChange={setList} suffix="₹/sq ft" /></F>
        </Grid>
      </Section>
      {C && <Section title="What this block's slabs cost">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-surface p-4"><div className="text-sm text-ink-2">Block landed</div><div className="num mt-1 text-xl font-semibold">{rs(blockCost(block))}</div>{block.damageAlloc > 0 && <div className="text-[0.8rem] text-warn">includes {rs(block.damageAlloc)} damage share</div>}</div>
          <div className="rounded-2xl bg-surface p-4"><div className="text-sm text-ink-2">Processing</div><div className="num mt-1 text-xl font-semibold">{rs(jobCost(job))}</div><div className="text-[0.8rem] text-ink-3">{rs2(jobCost(job) / Math.max(1, total))}/sq ft</div></div>
          <div className="rounded-2xl bg-accent-soft p-4"><div className="text-sm text-ink-2">Slab cost{fromStores ? ", before stores" : ""}</div><div className="num mt-1 text-xl font-semibold">{rs2(allCost / Math.max(1, good))}/sq ft</div><div className="text-[0.8rem] text-ink-2">{n0(y)} sq ft per tonne</div></div>
        </div>
      </Section>}
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
  const canDamage = (b: Block) => ["in_transit", "in_yard", "on_saw"].includes(b.status);
  const carriable = (b: Block) => ["in_transit", "in_yard", "on_saw"].includes(b.status) && !e.lines.find((l) => l.blockId === b.id && l.writeOff);
  const sameVariety = useMemo(() => db.blocks.filter((b) => carriable(b) && load.some((x) => x.variety === b.variety) && !load.includes(b)), [db.blocks, load, e.lines]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickVehicle = (k: string) => {
    const blocks = vehicles.get(k) ?? [];
    setLoadKey(k);
    setE((x) => ({ ...x, vehicleNo: k.split("|")[0] ?? "", lines: [], spreadIds: blocks.filter((b) => ["in_transit", "in_yard", "on_saw"].includes(b.status)).map((b) => b.id) }));
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
      for (const l of e.lines) { const b = d.blocks.find((x) => x.id === l.blockId); if (b && l.writeOff) { b.status = "rejected"; b.defects = b.defects || e.cause; } }
      d.damages.push(ev);
    });
    onClose();
  };
  const undo = () => {
    update((d) => {
      for (const [id, v] of Object.entries(e.alloc)) { const b = d.blocks.find((x) => x.id === id); if (b) b.damageAlloc = r2(Math.max(0, b.damageAlloc - v)); }
      for (const l of e.lines) { const b = d.blocks.find((x) => x.id === l.blockId); if (b && l.writeOff && b.status === "rejected") b.status = "in_yard"; }
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
