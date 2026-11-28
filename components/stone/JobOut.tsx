"use client";
import { useMemo, useState } from "react";
import { PackageCheck, Plus, RotateCcw, Send, Trash2, Truck, Undo2 } from "lucide-react";
import type { Ctx } from "./StoneApp";
import { blockCost, dmy, n0, n2, rs, rs2, today, uid } from "@/lib/stone/calc";
import { whereIs } from "@/lib/stone/godowns";
import { FINISHES } from "@/lib/stone/jobwork";
import { nextLotNo, slabArea } from "@/lib/stone/slabs";
import { emptyParty } from "@/lib/stone/seed";
import {
  BASIS_LABEL, COST_PRESETS, addInward, atWorker, brokenPcs, cuttingCharge, daysOut, goodSlabs, goodSqft, jobTotal, jwDone,
  otherCosts, removeInward, slabCostPerSqft, spreadJobCost, tripLocked, tripSqft, type InwardDraft,
} from "@/lib/stone/jobout";
import type { Block, BlockJobWork, Grade, JwBasis, Party } from "@/lib/stone/types";
import { Area, Badge, Drawer, Empty, F, Grid, Note, NumIn, Section, Seg, Sel, Stat, Table, TextIn, type Col } from "./ui";

// Depot → Job work: send own blocks to an outside cutter, record what it costs, take the slabs back into stock.

type Tab = "send" | "out" | "done";
const GRADES: Grade[] = ["A", "B", "C", "Commercial"];
const THICK = [16, 18, 20, 25, 30];

export default function JobOut({ ctx }: { ctx: Ctx }) {
  const { db } = ctx;
  const C = ctx.costs;
  const can = ctx.edit("blocks");
  const workers = db.parties.filter((p) => p.kind === "jobworker");
  const nameOf = (id: string) => ctx.root.parties.find((p) => p.id === id)?.company ?? "—";

  const ready = db.blocks.filter((b) => b.status === "godown");
  const out = db.blocks.filter(atWorker);
  const done = db.blocks.filter(jwDone);
  const [sub0, , arg] = ctx.sub.split(":");
  const [tab, setTab] = useState<Tab>(sub0 === "send" || sub0 === "done" ? sub0 : sub0 === "out" || out.length || !ready.length ? "out" : "send");
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [openId, setOpenId] = useState<string | null>(ctx.sub.startsWith("open:") ? arg ?? ctx.sub.slice(5) : null);
  const [tripFor, setTripFor] = useState<string | null>(null);
  const open = openId ? db.blocks.find((b) => b.id === openId && b.jw) ?? null : null;
  const tripBlock = tripFor ? db.blocks.find((b) => b.id === tripFor && b.jw) ?? null : null;

  const month = db.blocks.flatMap((b) => b.jw?.inwards ?? []).filter((x) => Date.now() - Date.parse(x.date) <= 30 * 86400000);
  const doneSq = done.reduce((a, b) => a + goodSqft(b.jw!), 0);
  const doneT = done.reduce((a, b) => a + (b.tonnes || b.billedTonnes || 0), 0);
  const doneJobCost = done.reduce((a, b) => a + jobTotal(b), 0);

  if (tripBlock) return <TripForm ctx={ctx} block={tripBlock} onClose={() => setTripFor(null)} />;

  const tonnes = (b: Block) => b.tonnes || b.billedTonnes || 0;
  const blockCell = (b: Block) => <div><div className="font-medium">{b.no}</div><div className="text-[0.8rem] text-ink-3">{b.variety}</div></div>;

  const readyCols: Col<Block>[] = [
    ...(can ? [{ key: "x", label: "", render: (b: Block) => <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" aria-label={`Pick block ${b.no}`} checked={pick.has(b.id)} onChange={(e) => setPick((s) => { const n = new Set(s); if (e.target.checked) n.add(b.id); else n.delete(b.id); return n; })} onClick={(e) => e.stopPropagation()} /> }] : []),
    { key: "no", label: "Block", render: blockCell, sort: (b) => b.no },
    { key: "w", label: "Where", render: (b) => whereIs(b) },
    { key: "t", label: "Tonnes", align: "right", render: (b) => n2(tonnes(b)), sort: tonnes },
    { key: "size", label: "Size (cm)", align: "right", render: (b) => (b.l ? `${b.l} × ${b.w} × ${b.h}` : "—") },
    ...(C ? [{ key: "c", label: "Block cost", align: "right" as const, render: (b: Block) => rs(blockCost(b)), sort: (b: Block) => blockCost(b) }] : []),
  ];

  const outCols: Col<Block>[] = [
    { key: "no", label: "Block", render: blockCell, sort: (b) => b.no },
    { key: "jw", label: "Job worker", render: (b) => <div><div>{nameOf(b.jw!.workerId)}</div><div className="text-[0.8rem] text-ink-3">{b.jw!.thicknessMm} mm {b.jw!.finish.toLowerCase()}</div></div>, sort: (b) => nameOf(b.jw!.workerId) },
    { key: "s", label: "Sent", render: (b) => { const d = daysOut(b.jw!); return <div><div className="num whitespace-nowrap">{dmy(b.jw!.sentOn)}</div><div className={`text-[0.8rem] ${d > 30 ? "font-medium text-warn" : "text-ink-3"}`}>{d} days out</div></div>; }, sort: (b) => b.jw!.sentOn },
    { key: "t", label: "Tonnes", align: "right", render: (b) => n2(tonnes(b)), sort: tonnes },
    { key: "r", label: "Slabs back", align: "right", render: (b) => b.jw!.inwards.length ? <div><div>{goodSlabs(b.jw!)} · {n0(goodSqft(b.jw!))} sq ft</div><div className="text-[0.8rem] text-ink-3">{b.jw!.inwards.length} trip{b.jw!.inwards.length > 1 ? "s" : ""}</div></div> : <span className="text-ink-3">None yet</span>, sort: (b) => goodSqft(b.jw!) },
    { key: "st", label: "Status", render: (b) => <Badge tone={b.jw!.inwards.length ? "info" : "warn"}>{b.jw!.inwards.length ? "Part received" : "At job worker"}</Badge> },
    { key: "act", label: "", render: (b) => can ? <div className="flex justify-end" onClick={(e) => e.stopPropagation()}><button className="btn btn-primary btn-sm" onClick={() => setTripFor(b.id)}><PackageCheck size={14} />Slabs in</button></div> : null },
  ];

  const doneCols: Col<Block>[] = [
    { key: "no", label: "Block", render: blockCell, sort: (b) => b.no },
    { key: "jw", label: "Job worker", render: (b) => nameOf(b.jw!.workerId), sort: (b) => nameOf(b.jw!.workerId) },
    { key: "d", label: "Received", render: (b) => <div><div className="num whitespace-nowrap">{dmy(b.jw!.closedOn!)}</div><div className="text-[0.8rem] text-ink-3">{daysOut(b.jw!)} days</div></div>, sort: (b) => b.jw!.closedOn! },
    { key: "q", label: "Good slabs", align: "right", render: (b) => <div><div>{goodSlabs(b.jw!)} · {n0(goodSqft(b.jw!))} sq ft</div>{brokenPcs(b.jw!) > 0 && <div className="text-[0.8rem] text-ink-3">{brokenPcs(b.jw!)} broken</div>}</div>, sort: (b) => goodSqft(b.jw!) },
    { key: "y", label: "Sq ft / t", align: "right", render: (b) => (tonnes(b) ? n0(goodSqft(b.jw!) / tonnes(b)) : "—"), sort: (b) => (tonnes(b) ? goodSqft(b.jw!) / tonnes(b) : 0) },
    ...(C ? [
      { key: "jc", label: "Job cost", align: "right" as const, render: (b: Block) => rs(jobTotal(b)), sort: (b: Block) => jobTotal(b) },
      { key: "sc", label: "Slab cost / sq ft", align: "right" as const, render: (b: Block) => <span className="font-medium">{rs2(slabCostPerSqft(b))}</span>, sort: (b: Block) => slabCostPerSqft(b) },
    ] : []),
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="At job workers" value={`${out.length} block${out.length === 1 ? "" : "s"}`} sub={`${n0(out.reduce((a, b) => a + tonnes(b), 0))} t${out.some((b) => daysOut(b.jw!) > 30) ? ` · ${out.filter((b) => daysOut(b.jw!) > 30).length} over 30 days` : ""}`} tone={out.some((b) => daysOut(b.jw!) > 30) ? "warn" : undefined} />
        <Stat label="Slabs back, last 30 days" value={`${n0(month.reduce((a, x) => a + x.sqft, 0))} sq ft`} sub={`${month.reduce((a, x) => a + x.slabs, 0)} slabs · ${month.length} trips`} />
        <Stat label="Average yield" value={doneT ? `${n0(doneSq / doneT)} sq ft/t` : "—"} sub={`${done.length} block${done.length === 1 ? "" : "s"} finished`} />
        {C ? <Stat label="Job cost per sq ft" value={doneSq ? rs2(doneJobCost / doneSq) : "—"} sub="Cutting, freight and extras, finished blocks" /> : <Stat label="Ready to send" value={`${ready.length}`} sub="Blocks in godown" />}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Seg value={tab} onChange={(t) => setTab(t)} tabs={[{ key: "send", label: "Ready to send", count: ready.length }, { key: "out", label: "At job worker", count: out.length }, { key: "done", label: "Done", count: done.length }]} />
        {tab === "send" && can && (
          <button className="btn btn-primary btn-sm ml-auto" disabled={!pick.size} onClick={() => setSending(true)}><Send size={14} />Send {pick.size || ""} for job work</button>
        )}
      </div>

      <div className="mt-4">
        {tab === "send" && <>
          <Table rows={ready} cols={readyCols} search={(b) => `${b.no} ${b.variety} ${b.godown ?? ""}`} onRow={can ? (b) => setPick((s) => { const n = new Set(s); if (n.has(b.id)) n.delete(b.id); else n.add(b.id); return n; }) : undefined}
            empty={<Empty title="No blocks in the godown">Blocks bought under Purchases land here, ready to send to a job worker.</Empty>} />
          {can && ready.length > 0 && <p className="mt-2 text-[0.82rem] text-ink-3">Tick the blocks going on one truck, then Send.</p>}
        </>}
        {tab === "out" && <Table rows={out} cols={outCols} onRow={(b) => setOpenId(b.id)} search={(b) => `${b.no} ${b.variety} ${nameOf(b.jw!.workerId)}`} initialSort={{ key: "s", dir: 1 }}
          empty={<Empty title="No blocks at job workers">Send blocks from Ready to send. They show here until all their slabs are back.</Empty>} />}
        {tab === "done" && <Table rows={done} cols={doneCols} onRow={(b) => setOpenId(b.id)} search={(b) => `${b.no} ${b.variety} ${nameOf(b.jw!.workerId)}`} initialSort={{ key: "d", dir: -1 }}
          empty={<Empty title="Nothing finished yet">Blocks whose slabs are all back show here with yield and cost per sq ft.</Empty>} />}
      </div>

      {sending && <SendForm ctx={ctx} blocks={ready.filter((b) => pick.has(b.id))} workers={workers} onClose={(sent) => { setSending(false); if (sent) { setPick(new Set()); setTab("out"); } }} />}
      {open && <JobDrawer ctx={ctx} block={open} onTrip={() => { setTripFor(open.id); setOpenId(null); }} onClose={() => setOpenId(null)} />}
    </div>
  );
}

/** Blocks going out on one truck to one job worker. */
function SendForm({ ctx, blocks, workers, onClose }: { ctx: Ctx; blocks: Block[]; workers: Party[]; onClose: (sent: boolean) => void }) {
  const first = workers[0];
  const [workerId, setWorkerId] = useState(first?.id ?? "");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const w = workers.find((x) => x.id === workerId);
  const [f, setF] = useState({ sentOn: today(), vehicleNo: "", freight: 0, basis: (first?.jwBasis ?? "sqft") as JwBasis, rate: first?.jwRate ?? 0, thicknessMm: blocks[0]?.stoneType === "granite" ? 17 : 18, finish: "Polished", note: "" });
  const [err, setErr] = useState("");
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const choose = (id: string) => { setWorkerId(id); const p = workers.find((x) => x.id === id); if (p?.jwBasis) set("basis", p.jwBasis); if (p?.jwRate) set("rate", p.jwRate); };
  const tonnes = blocks.reduce((a, b) => a + (b.tonnes || b.billedTonnes || 0), 0);

  const save = () => {
    if (!workerId && !newName.trim()) return setErr("Pick the job worker, or type a new one's name.");
    if (!f.sentOn) return setErr("Enter the date sent.");
    if (f.basis !== "lump" && !f.rate) return setErr(`Enter the cutting rate ${BASIS_LABEL[f.basis]}, or 0 if it is not agreed yet.`);
    ctx.update((d) => {
      let id = workerId;
      if (!id) {
        const p: Party = { ...emptyParty("jobworker"), id: uid(), company: newName.trim(), phone: newPhone.replace(/\D/g, "").slice(-10), jwBasis: f.basis, jwRate: f.rate, createdAt: today() };
        d.parties.push(p);
        id = p.id;
      }
      for (const b of blocks) {
        const x = d.blocks.find((y) => y.id === b.id);
        if (!x || x.status !== "godown") continue;
        // Freight for the truck is shared by tonnes; a lump-sum charge is for each block.
        const share = tonnes ? (f.freight * (x.tonnes || x.billedTonnes || 0)) / tonnes : f.freight / blocks.length;
        const jw: BlockJobWork = { workerId: id, sentOn: f.sentOn, vehicleNo: f.vehicleNo.trim().toUpperCase(), freightOut: Math.round(share), basis: f.basis, rate: f.rate, thicknessMm: f.thicknessMm, finish: f.finish, costs: [], inwards: [], note: f.note.trim() };
        x.jw = jw;
        x.status = "processing";
        x.processOn = f.sentOn;
      }
    });
    ctx.say(`${blocks.length} block${blocks.length > 1 ? "s" : ""} sent to ${w?.company ?? newName.trim()}`, "good");
    onClose(true);
  };

  return (
    <Drawer open title={`Send ${blocks.length} block${blocks.length > 1 ? "s" : ""} for job work`} sub={`${blocks.map((b) => b.no).join(", ")} · ${n2(tonnes)} t`} onClose={() => onClose(false)}
      footer={<><button className="btn btn-primary" onClick={save}><Truck size={15} />Send</button><button className="btn btn-quiet" onClick={() => onClose(false)}>Cancel</button>{err && <span className="text-sm text-neg">{err}</span>}</>}>
      <Section title="Job worker">
        {workers.length > 0 && (
          <F label="Job worker *"><Sel value={workerId} onChange={choose} options={[...workers.map((p) => ({ v: p.id, l: `${p.company}${p.city ? ` · ${p.city}` : ""}` })), { v: "", l: "+ New job worker" }]} /></F>
        )}
        {!workerId && (
          <div className="mt-3"><Grid>
            <F label="New job worker's name *"><TextIn value={newName} onChange={setNewName} placeholder="Rathi Stone Cutters" /></F>
            <F label="Mobile" hint="Other details later, in Masters → Job workers"><TextIn type="tel" value={newPhone} onChange={setNewPhone} placeholder="10-digit mobile" /></F>
          </Grid></div>
        )}
      </Section>
      <Section title="Truck">
        <Grid cols={3}>
          <F label="Date sent *"><TextIn type="date" value={f.sentOn} onChange={(v) => set("sentOn", v)} /></F>
          <F label="Vehicle no."><TextIn value={f.vehicleNo} onChange={(v) => set("vehicleNo", v)} upper placeholder="RJ01 GA 1234" /></F>
          <F label="Freight to job worker" hint={blocks.length > 1 ? "Whole truck; shared by tonnes" : undefined}><NumIn value={f.freight} onChange={(v) => set("freight", v)} suffix="₹" /></F>
        </Grid>
      </Section>
      <Section title="Cutting">
        <div className="mb-3"><Seg value={f.basis} onChange={(v) => set("basis", v)} tabs={[{ key: "sqft", label: "Per sq ft" }, { key: "tonne", label: "Per tonne" }, { key: "lump", label: "Lump sum" }]} /></div>
        <Grid cols={3}>
          <F label={f.basis === "sqft" ? "Rate per sq ft of good slabs" : f.basis === "tonne" ? "Rate per tonne of block" : "Lump sum per block"}><NumIn value={f.rate} onChange={(v) => set("rate", v)} suffix="₹" /></F>
          <F label="Thickness"><Sel value={String(f.thicknessMm)} onChange={(v) => set("thicknessMm", Number(v))} options={[...new Set([...THICK, f.thicknessMm])].sort((a, b) => a - b).map((t) => ({ v: String(t), l: `${t} mm` }))} /></F>
          <F label="Finish"><Sel value={f.finish} onChange={(v) => set("finish", v)} options={FINISHES.map((x) => ({ v: x, l: x }))} /></F>
        </Grid>
        <p className="mt-2 text-[0.82rem] text-ink-3">{f.basis === "sqft" ? "Charged on the good sq ft that comes back." : f.basis === "tonne" ? `About ${rs(f.rate * tonnes)} for these blocks.` : `${rs(f.rate * blocks.length)} for these blocks.`} Resin, polish, freight back and other costs are added when the slabs come in.</p>
      </Section>
      <Section title="Note"><Area value={f.note} onChange={(v) => set("note", v)} placeholder="Instructions to the job worker, challan no." /></Section>
    </Drawer>
  );
}

/** One block at, or back from, the job worker: trips, costs and what the slabs cost. */
function JobDrawer({ ctx, block, onTrip, onClose }: { ctx: Ctx; block: Block; onTrip: () => void; onClose: () => void }) {
  const C = ctx.costs;
  const can = ctx.edit("blocks");
  const jw0 = block.jw!;
  const [jw, setJw] = useState<BlockJobWork>({ ...jw0, costs: jw0.costs.map((c) => ({ ...c })) });
  const [err, setErr] = useState("");
  const set = <K extends keyof BlockJobWork>(k: K, v: BlockJobWork[K]) => setJw((x) => ({ ...x, [k]: v }));
  const worker = ctx.root.parties.find((p) => p.id === jw.workerId);
  const live = { ...block, jw };
  const sq = goodSqft(jw);
  const t = block.tonnes || block.billedTonnes || 0;
  const closed = !!jw0.closedOn;
  const lots = useMemo(() => new Map(ctx.db.lots.map((l) => [l.id, l])), [ctx.db.lots]);

  const persist = (extra?: (x: BlockJobWork, b: Block) => void) => {
    if (jw.costs.some((c) => c.amount && !c.label.trim())) return setErr("Give each cost a name.");
    ctx.update((d) => {
      const b = d.blocks.find((y) => y.id === block.id);
      if (!b?.jw) return;
      Object.assign(b.jw, { vehicleNo: jw.vehicleNo, freightOut: jw.freightOut, basis: jw.basis, rate: jw.rate, thicknessMm: jw.thicknessMm, finish: jw.finish, note: jw.note, costs: jw.costs.filter((c) => c.label.trim() || c.amount).map((c) => ({ label: c.label.trim(), amount: c.amount || 0 })) });
      extra?.(b.jw, b);
      spreadJobCost(d, b.id);
    });
    return true;
  };
  const save = () => { if (persist()) { ctx.say(`${block.no}: job work saved`, "good"); onClose(); } };
  const finish = () => { if (persist((x, b) => { x.closedOn = today(); b.status = "processed"; })) { ctx.say(`${block.no}: all slabs received, cost per sq ft is final`, "good"); onClose(); } };
  const reopen = () => { if (persist((x, b) => { x.closedOn = undefined; b.status = "processing"; })) { ctx.say(`${block.no} is open again for more slabs`); onClose(); } };
  const recall = () => {
    ctx.update((d) => { const b = d.blocks.find((y) => y.id === block.id); if (b?.jw && !b.jw.inwards.length) { b.jw = undefined; b.status = "godown"; b.processOn = undefined; } });
    ctx.say(`${block.no} is back in the godown`);
    onClose();
  };
  const undoTrip = (id: string) => {
    const t = jw0.inwards.find((x) => x.id === id);
    if (!t || tripLocked(ctx.db, t.lotId)) return ctx.say("Some of those slabs are already sold, reserved or moved", "neg");
    ctx.update((d) => { removeInward(d, block.id, id); });
    ctx.say("Trip removed, its lot taken out of stock");
    onClose();
  };

  return (
    <Drawer open wide title={`Block ${block.no} · ${worker?.company ?? "Job worker"}`} sub={`${block.variety} · ${n2(t)} t · sent ${dmy(jw.sentOn)}, ${daysOut(jw0)} days${closed ? ` · all received ${dmy(jw0.closedOn!)}` : ""}`} onClose={onClose}
      footer={can ? <>
        <button className="btn btn-primary" onClick={save}>Save</button>
        {!closed && <button className="btn btn-quiet" onClick={onTrip}><PackageCheck size={15} />Slabs in</button>}
        {!closed && jw.inwards.length > 0 && <button className="btn btn-quiet" onClick={finish}>All slabs received</button>}
        {closed && <button className="btn btn-quiet" onClick={reopen}><RotateCcw size={14} />Reopen</button>}
        {!jw.inwards.length && <button className="btn btn-quiet btn-sm ml-auto" onClick={recall}><Undo2 size={14} />Back to godown</button>}
        {err && <span className="text-sm text-neg">{err}</span>}
      </> : <button className="btn btn-quiet" onClick={onClose}>Close</button>}>
      <Section title="Slabs received">
        {jw.inwards.length ? (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[560px] text-[0.9rem]">
              <thead className="text-left text-[0.78rem] text-ink-3"><tr><th className="py-1.5 pr-3 font-medium">Date</th><th className="pr-3 font-medium">Lot</th><th className="pr-3 text-right font-medium">Slabs</th><th className="pr-3 text-right font-medium">Sq ft</th><th className="pr-3 font-medium">Size</th><th className="pr-3 text-right font-medium">Broken</th><th className="pr-3 font-medium">Vehicle</th><th /></tr></thead>
              <tbody>
                {jw.inwards.map((x) => (
                  <tr key={x.id} className="border-t border-surface-2">
                    <td className="num py-2 pr-3 whitespace-nowrap">{dmy(x.date)}</td>
                    <td className="pr-3"><button className="font-medium text-accent hover:underline" onClick={() => ctx.go("inventory", `slabs:open:${x.lotId}`)}>{lots.get(x.lotId)?.lotNo ?? "—"}</button></td>
                    <td className="pr-3 text-right">{x.slabs}</td>
                    <td className="pr-3 text-right">{n0(x.sqft)}</td>
                    <td className="pr-3 whitespace-nowrap">{x.thicknessMm} mm {x.finish.toLowerCase()} · {x.grade}</td>
                    <td className="pr-3 text-right">{x.broken || "—"}</td>
                    <td className="pr-3">{x.vehicleNo || "—"}</td>
                    <td className="text-right">{can && !tripLocked(ctx.db, x.lotId) && <button className="rounded p-1 text-ink-3 hover:text-neg" aria-label="Remove this trip" title="Remove this trip" onClick={() => undoTrip(x.id)}><Trash2 size={14} /></button>}</td>
                  </tr>
                ))}
                <tr className="border-t border-surface-3 font-medium"><td className="py-2 pr-3">Total</td><td /><td className="pr-3 text-right">{goodSlabs(jw)}</td><td className="pr-3 text-right">{n0(sq)}</td><td className="pr-3 text-ink-3">{t ? `${n0(sq / t)} sq ft per tonne` : ""}</td><td className="pr-3 text-right">{brokenPcs(jw) || "—"}</td><td /><td /></tr>
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-ink-3">Nothing back yet. Enter each truck with Slabs in; every trip becomes a lot in depot stock.</p>}
      </Section>

      <Section title="Sent">
        <Grid cols={3}>
          <F label="Vehicle no."><TextIn value={jw.vehicleNo} onChange={(v) => set("vehicleNo", v.toUpperCase())} upper /></F>
          <F label="Thickness asked"><NumIn value={jw.thicknessMm} onChange={(v) => set("thicknessMm", v)} suffix="mm" /></F>
          <F label="Finish asked"><Sel value={jw.finish} onChange={(v) => set("finish", v)} options={FINISHES.map((x) => ({ v: x, l: x }))} /></F>
        </Grid>
        <div className="mt-3"><F label="Note"><Area value={jw.note} onChange={(v) => set("note", v)} /></F></div>
      </Section>

      {C && (
        <Section title="Costs" aside={can ? <button className="btn btn-quiet btn-sm" onClick={() => set("costs", [...jw.costs, { label: "", amount: 0 }])}><Plus size={14} />Cost</button> : undefined}>
          <div className="mb-3"><Seg value={jw.basis} onChange={(v) => set("basis", v)} tabs={[{ key: "sqft", label: "Per sq ft" }, { key: "tonne", label: "Per tonne" }, { key: "lump", label: "Lump sum" }]} /></div>
          <Grid cols={3}>
            <F label={jw.basis === "sqft" ? "Cutting rate per sq ft" : jw.basis === "tonne" ? "Cutting rate per tonne" : "Cutting, lump sum"}><NumIn value={jw.rate} onChange={(v) => set("rate", v)} suffix="₹" /></F>
            <F label="Cutting charge" hint={jw.basis === "sqft" ? `${n0(sq)} sq ft × ${rs2(jw.rate)}` : jw.basis === "tonne" ? `${n2(t)} t × ${rs(jw.rate)}` : undefined}><div className="field num">{rs(cuttingCharge(live))}</div></F>
            <F label="Freight to job worker"><NumIn value={jw.freightOut} onChange={(v) => set("freightOut", v)} suffix="₹" /></F>
          </Grid>
          <datalist id="jw-costs">{COST_PRESETS.map((c) => <option key={c} value={c} />)}</datalist>
          {jw.costs.length > 0 && (
            <div className="mt-3 space-y-2">
              {jw.costs.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1"><TextIn value={c.label} onChange={(v) => set("costs", jw.costs.map((x, j) => (j === i ? { ...x, label: v } : x)))} list="jw-costs" placeholder="Resin / epoxy, freight back…" /></div>
                  <div className="w-36"><NumIn value={c.amount} onChange={(v) => set("costs", jw.costs.map((x, j) => (j === i ? { ...x, amount: v } : x)))} suffix="₹" /></div>
                  <button type="button" className="btn btn-quiet btn-sm !px-2" aria-label="Remove cost" onClick={() => set("costs", jw.costs.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
          {!jw.costs.length && <p className="mt-3 text-[0.82rem] text-ink-3">Add resin, polishing, netting, freight back, loading and anything else this job cost.</p>}
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 rounded-2xl bg-surface-2/60 p-4 text-[0.92rem] sm:grid-cols-4">
            <div><dt className="text-ink-3">Block cost</dt><dd className="num font-medium">{rs(blockCost(block))}</dd></div>
            <div><dt className="text-ink-3">Job cost</dt><dd className="num font-medium">{rs(jobTotal(live))}</dd><dd className="text-[0.78rem] text-ink-3">cutting {rs(cuttingCharge(live))} · other {rs(otherCosts(jw) + jw.freightOut)}</dd></div>
            <div><dt className="text-ink-3">Good sq ft</dt><dd className="num font-medium">{n0(sq)}</dd></div>
            <div><dt className="text-ink-3">Slab cost / sq ft</dt><dd className="num font-semibold">{sq ? rs2(slabCostPerSqft(live)) : "—"}</dd>{!closed && sq > 0 && <dd className="text-[0.78rem] text-warn">Final when all slabs are back</dd>}</div>
          </dl>
        </Section>
      )}
      {!closed && jw.inwards.length > 0 && <Note>When the last truck is in, press <b>All slabs received</b>. The block then moves to Processed and its slab cost is final.</Note>}
    </Drawer>
  );
}

/** One truck of slabs back from the job worker; becomes a lot in depot stock. */
function TripForm({ ctx, block, onClose }: { ctx: Ctx; block: Block; onClose: () => void }) {
  const jw = block.jw!;
  const C = ctx.costs;
  const [f, setF] = useState<InwardDraft & { last: boolean; extra: number; extraLabel: string }>({
    date: today(), slabs: 0, sqft: 0, slabL: 0, slabW: 0, thicknessMm: jw.thicknessMm, finish: jw.finish, grade: block.grade, broken: 0, vehicleNo: "", note: "",
    lotNo: nextLotNo(ctx.db), location: "", listRate: 0, last: !jw.inwards.length, extra: 0, extraLabel: "Freight back",
  });
  const [err, setErr] = useState("");
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const sq = tripSqft(f);

  const save = () => {
    if (!f.date) return setErr("Enter the date received.");
    if (!f.slabs) return setErr("Enter the number of good slabs.");
    if (!sq) return setErr("Enter the average slab size, or the total sq ft.");
    if (!f.lotNo.trim()) return setErr("Enter a lot no.");
    if (ctx.db.lots.some((l) => l.lotNo.trim().toUpperCase() === f.lotNo.trim().toUpperCase())) return setErr(`Lot ${f.lotNo} is already used. Pick another lot no.`);
    const lotNo = f.lotNo.trim();
    ctx.update((d) => {
      const b = d.blocks.find((y) => y.id === block.id);
      if (!b?.jw) return;
      if (f.extra) b.jw.costs.push({ label: f.extraLabel.trim() || "Other", amount: f.extra });
      addInward(d, block.id, f);
      if (f.last) { b.jw.closedOn = f.date; b.status = "processed"; spreadJobCost(d, b.id); }
    });
    ctx.say(`Lot ${lotNo}: ${f.slabs} slabs, ${n0(sq)} sq ft in depot stock${f.last ? `. Block ${block.no} is done.` : ""}`, "good");
    onClose();
  };

  return (
    <Drawer open page title={`Slabs in · block ${block.no}`} sub={`${block.variety} · from ${ctx.root.parties.find((p) => p.id === jw.workerId)?.company ?? "job worker"} · ${jw.inwards.length ? `trip ${jw.inwards.length + 1}, ${n0(goodSqft(jw))} sq ft received so far` : "first trip"}`} onClose={onClose}
      footer={<><button className="btn btn-primary" onClick={save}><PackageCheck size={15} />Add to stock</button><button className="btn btn-quiet" onClick={onClose}>Cancel</button>{err && <span className="text-sm text-neg">{err}</span>}</>}>
      <Section title="Truck">
        <Grid cols={3}>
          <F label="Date received *"><TextIn type="date" value={f.date} onChange={(v) => set("date", v)} /></F>
          <F label="Vehicle no."><TextIn value={f.vehicleNo} onChange={(v) => set("vehicleNo", v)} upper placeholder="RJ01 GA 1234" /></F>
          <F label="Lot no. *"><TextIn value={f.lotNo} onChange={(v) => set("lotNo", v)} upper /></F>
        </Grid>
      </Section>
      <Section title="Slabs">
        <Grid cols={3}>
          <F label="Good slabs *"><NumIn value={f.slabs} onChange={(v) => set("slabs", Math.max(0, Math.round(v)))} suffix="slabs" /></F>
          <F label="Average slab size" hint={f.slabL && f.slabW ? `${n2(slabArea(f.slabL, f.slabW))} sq ft each` : "Length × width, cm"}>
            <div className="flex items-center gap-1.5"><NumIn value={f.slabL} onChange={(v) => set("slabL", v)} placeholder="L" /><span className="text-ink-3">×</span><NumIn value={f.slabW} onChange={(v) => set("slabW", v)} placeholder="W" /></div>
          </F>
          <F label={f.slabL && f.slabW ? "Total sq ft" : "Total sq ft *"} hint={f.slabL && f.slabW ? "From the size" : "As on the job worker's measurement"}>
            {f.slabL && f.slabW ? <div className="field num">{n0(sq)}</div> : <NumIn value={f.sqft} onChange={(v) => set("sqft", v)} suffix="sq ft" />}
          </F>
          <F label="Thickness"><NumIn value={f.thicknessMm} onChange={(v) => set("thicknessMm", v)} suffix="mm" /></F>
          <F label="Finish"><Sel value={f.finish} onChange={(v) => set("finish", v)} options={FINISHES.map((x) => ({ v: x, l: x }))} /></F>
          <F label="Grade"><Sel value={f.grade} onChange={(v) => set("grade", v as Grade)} options={GRADES.map((g) => ({ v: g, l: g }))} /></F>
          <F label="Broken pieces"><NumIn value={f.broken} onChange={(v) => set("broken", Math.max(0, Math.round(v)))} /></F>
          <F label="Rack / location"><TextIn value={f.location} onChange={(v) => set("location", v)} placeholder="A-frame 4" /></F>
          {C && <F label="List rate" hint="Optional"><NumIn value={f.listRate} onChange={(v) => set("listRate", v)} suffix="₹/sq ft" /></F>}
        </Grid>
      </Section>
      {C && (
        <Section title="Cost on this truck">
          <Grid>
            <F label="What"><TextIn value={f.extraLabel} onChange={(v) => set("extraLabel", v)} list="jw-trip-costs" /><datalist id="jw-trip-costs">{COST_PRESETS.map((c) => <option key={c} value={c} />)}</datalist></F>
            <F label="Amount" hint="Optional; more costs can be added on the block later"><NumIn value={f.extra} onChange={(v) => set("extra", v)} suffix="₹" /></F>
          </Grid>
        </Section>
      )}
      <Section title="Note"><Area value={f.note} onChange={(v) => set("note", v)} /></Section>
      <label className="mt-2 flex items-start gap-3 rounded-2xl bg-surface-2/60 p-4 text-[0.95rem]">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={f.last} onChange={(e) => set("last", e.target.checked)} />
        <span><b>This is the last truck</b> for block {block.no}<span className="block text-[0.85rem] text-ink-3">The block moves to Processed and its slab cost becomes final. Leave unticked if more slabs are still to come.</span></span>
      </label>
    </Drawer>
  );
}
