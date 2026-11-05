"use client";
import { useMemo, useState } from "react";
import { Lock, Plus, Trash2 } from "lucide-react";
import { blockCost, jobCost, n0, n2, r2, rs, rs2, theoreticalSlabs, today, uid } from "@/lib/stone/calc";
import { firmOf } from "@/lib/stone/firms";
import { STATUS_LABEL } from "@/lib/stone/godowns";
import { nextLotNo, slabArea, slabNo, syncLot } from "@/lib/stone/slabs";
import type { Block, Grade, SawJob, Slab, SlabLot } from "@/lib/stone/types";
import type { Ctx } from "./StoneApp";
import { F, Grid, Note, NumIn, Pick, Section, Sel, TextIn, Drawer } from "./ui";

const FINISHES = ["Polished", "Honed", "Leather", "Flamed", "Unpolished"];
const GRADES: Grade[] = ["A", "B", "C", "Commercial"];

type Draft = {
  id: string; // existing lot id, or "" for a new lot
  lotNo: string;
  thicknessMm: number;
  finish: string;
  grade: Grade;
  slabL: number; // cm
  slabW: number;
  slabs: number; // good slabs
  broken: number;
  location: string;
  listRate: number;
  locked: string; // why an existing lot can no longer be changed here
};

/** A lot already sold from, moved on or in another firm keeps its slabs as they are. */
function lockOf(l: SlabLot, block: Block, s: Ctx["root"]["settings"]) {
  if (l.slabs?.some((x) => x.status === "sold") || l.available < l.sqft - 0.01) return "Has sales";
  if (l.site !== "unit") return "Moved to depot";
  if (firmOf(l, s) !== firmOf(block, s)) return "With another firm";
  return "";
}

function draftOf(l: SlabLot, block: Block, s: Ctx["root"]["settings"]): Draft {
  const good = (l.slabs ?? []).filter((x) => x.status !== "broken");
  const first = l.slabs?.[0];
  return {
    id: l.id, lotNo: l.lotNo, thicknessMm: l.thicknessMm, finish: l.finish, grade: l.grade, slabL: first?.l ?? 0, slabW: first?.w ?? 0,
    slabs: l.slabs?.length ? good.length : l.pieces, broken: (l.slabs ?? []).filter((x) => x.status === "broken").length,
    location: l.location, listRate: l.listRate, locked: lockOf(l, block, s),
  };
}

const sqftOf = (d: Draft) => r2(d.slabs * slabArea(d.slabL, d.slabW));

/**
 * After processing: pick the block, then enter its lots one by one. The slabs go into slab inventory,
 * the block's cost and processing cost are split over its lots by sq ft, and the block becomes Processed.
 */
export default function LotsForm({ ctx, blockId, onClose }: { ctx: Ctx; blockId?: string; onClose: (savedBlockId?: string) => void }) {
  const { db, update } = ctx;
  const S = db.settings;
  const C = ctx.costs;
  const choosable = db.blocks.filter((b) => b.status === "processing" || b.status === "processed");
  const [bid, setBid] = useState(blockId ?? "");
  const block = db.blocks.find((b) => b.id === bid);
  const oldJob = block ? db.jobs.find((j) => j.blockId === block.id) : undefined;
  const oldLots = useMemo(() => (block ? db.lots.filter((l) => l.blockId === block.id) : []), [block, db.lots]);

  const fresh = (b: Block, taken: string[]): Draft => ({
    id: "", lotNo: nextLotNo(db, taken), thicknessMm: b.stoneType === "granite" ? 17 : 18, finish: "Polished", grade: b.grade,
    slabL: Math.max(0, b.l - 6), slabW: Math.max(0, b.w - 4), slabs: 0, broken: 0, location: "Unit rack 1", listRate: 0, locked: "",
  });
  const startJob = (b: Block): SawJob => oldJob ?? {
    id: uid(), blockId: b.id, machine: S.machines[0] || "Gang saw 1", startedOn: b.processOn || today(), finishedOn: today(), thicknessMm: 18, slabs: 0,
    slabL: 0, slabW: 0, sqft: 0, rejectSqft: 0, hours: 0, power: 0, blades: 0, resin: 0, netting: 0, polishing: 0, labour: 0, other: 0, finish: "Polished", grade: b.grade, lotId: "",
  };
  const [job, setJob] = useState<SawJob | null>(() => (block ? startJob(block) : null));
  const [lots, setLots] = useState<Draft[]>(() => (block ? (oldLots.length ? oldLots.map((l) => draftOf(l, block, ctx.root.settings)) : [fresh(block, [])]) : []));
  const [err, setErr] = useState("");

  const pick = (id: string) => {
    const b = db.blocks.find((x) => x.id === id);
    if (!b) return;
    setBid(id);
    const ls = db.lots.filter((l) => l.blockId === id);
    setJob(db.jobs.find((j) => j.blockId === id) ?? startJob(b));
    setLots(ls.length ? ls.map((l) => draftOf(l, b, ctx.root.settings)) : [fresh(b, [])]);
    setErr("");
  };
  const setLot = (i: number, p: Partial<Draft>) => setLots((x) => x.map((d, k) => (k === i ? { ...d, ...p } : d)));
  const setJ = <K extends keyof SawJob>(k: K, v: SawJob[K]) => setJob((x) => (x ? { ...x, [k]: v } : x));

  const good = r2(lots.reduce((a, d) => a + (d.locked ? oldLots.find((l) => l.id === d.id)?.sqft ?? 0 : sqftOf(d)), 0));
  const brokenSqft = r2(lots.reduce((a, d) => a + d.broken * slabArea(d.slabL, d.slabW), 0));
  const total = block && job ? blockCost(block) + jobCost(job) : 0;
  // What an existing lot carries beyond its share of the block: freight to the depot, transfers.
  const oldTotal = block ? blockCost(block) + (oldJob ? jobCost(oldJob) : 0) : 0;
  const oldGood = oldLots.reduce((a, l) => a + l.sqft, 0);
  const extra = (l: SlabLot) => Math.max(0, l.cost - (oldGood ? (oldTotal * l.sqft) / oldGood : 0));

  const save = () => {
    if (!block || !job) return setErr("Choose the block first");
    if (!lots.length || lots.every((d) => !d.slabs && !d.broken)) return setErr("Enter the slabs of at least one lot");
    for (const d of lots) {
      if (d.locked) continue;
      if (!d.lotNo.trim()) return setErr("Every lot needs a lot no.");
      if ((d.slabs || d.broken) && (!d.slabL || !d.slabW)) return setErr(`Lot ${d.lotNo}: fill the slab size`);
    }
    const nos = lots.map((d) => d.lotNo.trim().toUpperCase());
    const twice = nos.find((n, i) => nos.indexOf(n) !== i);
    if (twice) return setErr(`Lot ${twice} is entered twice`);
    const clash = lots.find((d) => db.lots.some((l) => l.lotNo.trim().toUpperCase() === d.lotNo.trim().toUpperCase() && l.id !== d.id && l.blockId !== block.id && firmOf(l, S) === firmOf(block, S)));
    if (clash) return setErr(`Lot ${clash.lotNo} is already used for another block`);

    update((x) => {
      const firm = firmOf(block, x.settings);
      const keep = new Set(lots.filter((d) => d.id).map((d) => d.id));
      // Lots taken off the form go, unless they can no longer be changed.
      x.lots = x.lots.filter((l) => l.blockId !== block.id || keep.has(l.id) || lockOf(l, block, x.settings));
      // A lot whose slabs were not touched keeps them as they are (grades, notes, photos); new slabs are numbered after every kept one.
      const same = (ex: SlabLot, d: Draft) => { const o = draftOf(ex, block, x.settings); return o.slabs === d.slabs && o.broken === d.broken && o.slabL === d.slabL && o.slabW === d.slabW && o.grade === d.grade; };
      const kept = x.lots.filter((l) => l.blockId === block.id && (lockOf(l, block, x.settings) || lots.some((d) => d.id === l.id && same(l, d)))).flatMap((l) => l.slabs ?? []);
      let n = kept.reduce((m, s) => Math.max(m, Number(/\/(\d+)$/.exec(s.no)?.[1] ?? 0)), 0);
      const ids: string[] = [];
      for (const d of lots) {
        const ex = d.id ? x.lots.find((l) => l.id === d.id) : undefined;
        if (ex && lockOf(ex, block, x.settings)) { ids.push(ex.id); continue; }
        if (ex && same(ex, d)) {
          Object.assign(ex, { lotNo: d.lotNo.trim(), thicknessMm: d.thicknessMm, finish: d.finish, listRate: d.listRate, location: d.location });
          ids.push(ex.id);
          continue;
        }
        if (!d.slabs && !d.broken) { if (ex) x.lots = x.lots.filter((l) => l.id !== ex.id); continue; }
        const area = slabArea(d.slabL, d.slabW);
        const slabs: Slab[] = [];
        for (let i = 0; i < d.slabs + d.broken; i++) slabs.push({ id: uid(), no: slabNo(block.no, ++n), blockId: block.id, l: d.slabL, w: d.slabW, sqft: area, grade: d.grade, status: i < d.slabs ? "stock" : "broken" });
        const lot: SlabLot = {
          ...(ex ?? { id: uid(), blockId: block.id, shipmentId: "", stoneType: block.stoneType, cost: 0, site: "unit" as const, createdAt: job.finishedOn, firmId: firm }),
          lotNo: d.lotNo.trim(), variety: block.variety, thicknessMm: d.thicknessMm, finish: d.finish, grade: d.grade, pieces: 0, sqft: 0, available: 0,
          listRate: d.listRate, location: d.location, slabs,
        } as SlabLot;
        syncLot(lot);
        if (ex) Object.assign(ex, lot); else x.lots.push(lot);
        ids.push(lot.id);
      }
      // Block and processing cost, split over all the block's lots by good sq ft.
      const mine = x.lots.filter((l) => l.blockId === block.id);
      const all = mine.reduce((a, l) => a + l.sqft, 0);
      for (const l of mine) {
        const was = oldLots.find((o) => o.id === l.id);
        l.cost = Math.round((all ? (total * l.sqft) / all : 0) + (was ? extra(was) : 0));
      }
      const first = mine[0];
      const rec: SawJob = {
        ...job, thicknessMm: first?.thicknessMm ?? job.thicknessMm, finish: first?.finish ?? job.finish, grade: first?.grade ?? job.grade,
        slabs: mine.reduce((a, l) => a + (l.slabs?.length ?? l.pieces), 0), sqft: Math.round(all + brokenSqft), rejectSqft: Math.round(brokenSqft),
        slabL: lots[0]?.slabL ?? 0, slabW: lots[0]?.slabW ?? 0, blades: 0, resin: 0, netting: 0, polishing: 0, lotId: ids[0] ?? "",
      };
      const ji = x.jobs.findIndex((j) => j.blockId === block.id);
      if (ji >= 0) x.jobs[ji] = rec; else x.jobs.push({ ...rec, firmId: firm });
      const b = x.blocks.find((y) => y.id === block.id)!;
      b.status = "processed";
      b.processOn = b.processOn || job.startedOn;
    });
    ctx.say(`${block.no} processed: ${lots.filter((d) => d.slabs || d.broken || d.locked).length} lot${lots.length > 1 ? "s" : ""}, ${n0(good)} sq ft in slab stock`, "good");
    onClose(block.id);
  };

  const taken = lots.map((d) => d.lotNo);
  return (
    <Drawer open page wide title={block?.status === "processed" ? `Lots of block ${block.no}` : "Lots from a processed block"} sub="Pick the block, then add its lots one by one. The slabs go into slab inventory and the block moves to Processed." onClose={() => onClose()}
      footer={<><button className="btn btn-primary" disabled={!block} onClick={save}>Save lots{good ? ` · ${n0(good)} sq ft` : ""}</button><button className="btn btn-quiet" onClick={() => onClose()}>Cancel</button>{err && <span className="text-sm text-neg">{err}</span>}</>}>
      <Section title="Block">
        <div className="max-w-xl">
          <F box label="Block *" hint={block ? `${block.variety} · ${n2(block.tonnes || block.billedTonnes)} t · ${block.l}×${block.w}×${block.h} cm · ${STATUS_LABEL[block.status]}` : !choosable.length ? "No block is in Processing. Click Processing on a block under Inventory → Blocks first." : "Blocks issued for processing, and processed blocks to add lots to"}>
            <Pick align="left" onPick={pick} placeholder={block ? `${block.no} · ${block.variety}` : "Choose block"} empty="No block matches" options={choosable.map((b) => ({ v: b.id, l: `${b.no} · ${b.variety}`, sub: `${STATUS_LABEL[b.status]}${b.processOn ? ` since ${b.processOn.split("-").reverse().join("/")}` : ""} · ${n2(b.tonnes || b.billedTonnes)} t` }))} />
          </F>
        </div>
      </Section>

      {block && job && <>
        <Section title="Processing">
          <Grid cols={3}>
            <F label="Machine"><Sel value={job.machine} onChange={(v) => setJ("machine", v)} options={[...new Set([...S.machines, job.machine])].filter(Boolean).map((m) => ({ v: m, l: m }))} /></F>
            <F label="Issued on"><TextIn type="date" value={job.startedOn} onChange={(v) => setJ("startedOn", v)} /></F>
            <F label="Finished on"><TextIn type="date" value={job.finishedOn} onChange={(v) => setJ("finishedOn", v)} /></F>
            <F label="Saw hours"><NumIn value={job.hours} onChange={(v) => setJ("hours", v)} suffix="h" /></F>
            {C && <>
              <F label="Power" hint={job.hours ? `About ${rs(job.hours * S.sawKw * 0.8 * S.powerRate)} at ${S.sawKw} kW` : undefined}><NumIn value={job.power} onChange={(v) => setJ("power", v)} suffix="₹" /></F>
              <F label="Labour" hint={good ? `About ${rs(good * S.labourPerSqft)} at ${rs2(S.labourPerSqft)}/sq ft` : undefined}><NumIn value={job.labour} onChange={(v) => setJ("labour", v)} suffix="₹" /></F>
              <F label="Other"><NumIn value={job.other} onChange={(v) => setJ("other", v)} suffix="₹" /></F>
            </>}
          </Grid>
          {C && <p className="mt-2 text-[0.82rem] text-ink-3">Entered once for the block and split over its lots by sq ft, with the block&apos;s cost. Blades, resin, netting and polishing come from Stores.</p>}
        </Section>

        <Section title={`Lots · ${lots.length}`} aside={<button type="button" className="btn btn-quiet btn-sm" onClick={() => setLots((x) => [...x, { ...fresh(block, taken), thicknessMm: x[x.length - 1]?.thicknessMm ?? 18, finish: x[x.length - 1]?.finish ?? "Polished", slabL: x[x.length - 1]?.slabL || Math.max(0, block.l - 6), slabW: x[x.length - 1]?.slabW || Math.max(0, block.w - 4), location: x[x.length - 1]?.location ?? "Unit rack 1" }])}><Plus size={14} />Add lot</button>}>
          <div className="space-y-3">
            {lots.map((d, i) => {
              const sq = d.locked ? oldLots.find((l) => l.id === d.id)?.sqft ?? 0 : sqftOf(d);
              const share = good ? (total * sq) / good : 0;
              if (d.locked) {
                const l = oldLots.find((x) => x.id === d.id)!;
                return (
                  <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-[0.9rem]">
                    <Lock size={15} className="text-ink-3" />
                    <div className="flex-1"><b>Lot {l.lotNo}</b> · {l.thicknessMm} mm {l.finish.toLowerCase()} · {l.pieces} slabs · {n0(l.sqft)} sq ft</div>
                    <span className="text-[0.82rem] text-ink-3">{d.locked}: kept as it is</span>
                  </div>
                );
              }
              return (
                <div key={d.id || `n${i}`} className="rounded-2xl bg-surface p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="font-medium">Lot {i + 1}</span>
                    <span className="text-[0.84rem] text-ink-3">{n0(sq)} sq ft{C && sq ? ` · ${rs2(share / sq)}/sq ft` : ""}</span>
                    {lots.length > 1 && <button type="button" className="btn btn-quiet btn-sm ml-auto !text-neg" onClick={() => setLots((x) => x.filter((_, k) => k !== i))}><Trash2 size={14} />Remove</button>}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <F label="Lot no. *"><TextIn value={d.lotNo} onChange={(v) => setLot(i, { lotNo: v })} upper /></F>
                    <F label="Thickness"><NumIn value={d.thicknessMm} onChange={(v) => setLot(i, { thicknessMm: v })} suffix="mm" /></F>
                    <F label="Finish"><Sel value={d.finish} onChange={(v) => setLot(i, { finish: v })} options={[...new Set([...FINISHES, d.finish])].map((v) => ({ v, l: v }))} /></F>
                    <F label="Grade"><Sel value={d.grade} onChange={(v) => setLot(i, { grade: v as Grade })} options={GRADES.map((g) => ({ v: g, l: g }))} /></F>
                    <F label="Slab length"><NumIn value={d.slabL} onChange={(v) => setLot(i, { slabL: v })} suffix="cm" /></F>
                    <F label="Slab height"><NumIn value={d.slabW} onChange={(v) => setLot(i, { slabW: v })} suffix="cm" /></F>
                    <F label="Good slabs" hint={i === 0 ? `Block height allows about ${theoreticalSlabs(block.h, d.thicknessMm)}` : undefined}><NumIn value={d.slabs} onChange={(v) => setLot(i, { slabs: Math.max(0, Math.round(v)) })} /></F>
                    <F label="Broken slabs"><NumIn value={d.broken} onChange={(v) => setLot(i, { broken: Math.max(0, Math.round(v)) })} /></F>
                    <F label="Rack / A-frame"><TextIn value={d.location} onChange={(v) => setLot(i, { location: v })} /></F>
                    <F label="List price" hint="Optional"><NumIn value={d.listRate} onChange={(v) => setLot(i, { listRate: v })} suffix="₹/sq ft" /></F>
                  </div>
                </div>
              );
            })}
          </div>
          {oldLots.length > 0 && <div className="mt-3"><Note>Saving re-splits the block&apos;s cost over all its lots by sq ft. Lots that are already sold from or moved keep their slabs.</Note></div>}
        </Section>

        {C && good > 0 && (
          <Section title="What this block's slabs cost">
            <div className="grid gap-x-6 gap-y-1 text-[0.9rem] sm:grid-cols-2">
              <div className="flex justify-between"><span className="text-ink-2">Block, with royalty and freight</span><span>{rs(blockCost(block))}</span></div>
              <div className="flex justify-between"><span className="text-ink-2">Processing</span><span>{rs(jobCost(job))}</span></div>
              <div className="flex justify-between"><span className="text-ink-2">Good slabs</span><span>{n0(good)} sq ft{brokenSqft ? ` (+${n0(brokenSqft)} broken)` : ""}</span></div>
              <div className="flex justify-between font-medium"><span>Cost per sq ft, before stores</span><span>{rs2(total / good)}</span></div>
            </div>
          </Section>
        )}
      </>}
    </Drawer>
  );
}
