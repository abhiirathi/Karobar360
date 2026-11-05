"use client";
import { useMemo, useState } from "react";
import { dmy, lakh, mineMonth, mineWindow, months, n0, n2, rs, today, uid } from "@/lib/stone/calc";
import { ownMines } from "@/lib/stone/costing";
import type { MineCost, MineCostCat } from "@/lib/stone/types";
import type { Ctx } from "./StoneApp";
import { Area, Drawer, F, Grid, Note, NumIn, Sel, Stat, Table, TextIn, type Col } from "./ui";

export const CAT: Record<MineCostCat, { label: string; unit: string; rate: number }> = {
  diesel: { label: "Diesel", unit: "L", rate: 94 },
  power: { label: "Power", unit: "kWh", rate: 8.5 },
  wire: { label: "Diamond wire", unit: "m", rate: 3200 },
  machine: { label: "Machine hire", unit: "hours", rate: 1200 },
  consumables: { label: "Consumables", unit: "lot", rate: 0 },
  labour: { label: "Labour", unit: "man-days", rate: 650 },
  tools: { label: "Tools", unit: "lot", rate: 0 },
  maintenance: { label: "Machine repair", unit: "job", rate: 0 },
  loading: { label: "Loading into truck", unit: "trips", rate: 1500 },
  royalty: { label: "Royalty / DMG dues", unit: "₹", rate: 1 },
  rent: { label: "Dead rent & lease", unit: "₹", rate: 1 },
  other: { label: "Other", unit: "", rate: 0 },
  stores: { label: "Issued from stores", unit: "₹", rate: 1 },
};
/** Heads entered by hand, in the order they fall from cutting the block to loading the truck. */
const CAT_ORDER: MineCostCat[] = ["machine", "diesel", "power", "wire", "consumables", "labour", "tools", "maintenance", "loading", "royalty", "rent", "other"];
const MACHINES = ["Excavator (PC-210)", "Wheel loader", "Wire saw machines", "Chain saw", "Compressor & DG set", "Drill machine", "Quarry crew", "Hydra crane"];

export function monthName(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleString("en-IN", { month: "short", year: "2-digit" });
}

/** Quarry figures for the last 30 days, shown above own-quarry blocks. */
export function MineStats({ ctx }: { ctx: Ctx }) {
  const m = mineWindow(ctx.db, 30);
  const prev = mineWindow(ctx.db, 30, 30);
  const pt = (x: number) => (m.tonnes ? x / m.tonnes : 0);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Extracted, last 30 days" value={`${n0(m.tonnes)} t`} sub={`${m.blocks.length} blocks · ${n2(m.vol)} CBM`} />
      <Stat label="Extraction cost per tonne" value={rs(m.perTonne)} sub={prev.perTonne ? `${m.perTonne > prev.perTonne ? "▲" : "▼"} ${rs(Math.abs(m.perTonne - prev.perTonne))} vs the 30 days before` : "—"} tone={prev.perTonne && m.perTonne > prev.perTonne * 1.05 ? "warn" : undefined} />
      <Stat label="Diesel per tonne" value={`${n2(pt(m.qty("diesel")))} L`} sub={`${n0(m.qty("diesel"))} L in 30 days · ${rs(m.byCat.diesel ?? 0)}`} />
      <Stat label="Wire per 100 t" value={`${n2(pt(m.qty("wire")) * 100)} m`} sub={`Machine hire ${rs(pt(m.byCat.machine ?? 0))}/t · labour ${n2(pt(m.qty("labour")))} days/t`} />
    </div>
  );
}

/** Extraction cost entries, every head from cutting the block to loading it on the truck. */
export function MineCostList({ ctx, onOpen }: { ctx: Ctx; onOpen: (c: MineCost) => void }) {
  const { db } = ctx;
  const vendor = (id?: string) => ctx.root.parties.find((p) => p.id === id)?.company;
  const cols: Col<MineCost>[] = [
    { key: "d", label: "Date", render: (c) => dmy(c.date), sort: (c) => c.date },
    { key: "cat", label: "Head", render: (c) => <div><div className="font-medium">{CAT[c.cat]?.label ?? c.cat}</div><div className="text-[0.8rem] text-ink-3">{c.machine}</div></div>, sort: (c) => c.cat },
    { key: "v", label: "Vendor", render: (c) => <div><div>{vendor(c.vendorId) ?? <span className="text-ink-3">—</span>}</div>{c.billNo && <div className="text-[0.8rem] text-ink-3">Bill {c.billNo}</div>}</div> },
    { key: "q", label: "Quantity", align: "right", render: (c) => c.unit === "₹" ? "—" : `${n2(c.qty)} ${c.unit}` },
    { key: "r", label: "Rate", align: "right", render: (c) => c.unit === "₹" ? "—" : rs(c.rate) },
    { key: "a", label: "Amount", align: "right", render: (c) => rs(c.amount), sort: (c) => c.amount },
    { key: "n", label: "Mine", render: (c) => <span className="text-ink-2">{c.mine}</span> },
  ];
  return (
    <>
      <div className="mb-3"><Note>Enter every cost from cutting the block to loading it on the truck. Items issued to a mine from Stores are added on their own, as “Issued from stores”.</Note></div>
      <Table rows={[...db.mineCosts].reverse()} cols={cols} onRow={onOpen} search={(c) => `${CAT[c.cat]?.label} ${c.machine} ${c.note} ${vendor(c.vendorId) ?? ""} ${c.mine}`} empty="Log machine hire, diesel, wire, consumables, labour and loading to see your cost per tonne." />
    </>
  );
}

/** Cost per tonne, head by head, for the last six months. */
export function MinePerTonne({ ctx }: { ctx: Ctx }) {
  const { db } = ctx;
  const ms = months(db);
  const series = useMemo(() => ms.slice(-6).map((mm) => ({ m: mm, ...mineMonth(db, null, mm) })), [db, ms]);
  const heads: MineCostCat[] = [...CAT_ORDER, "stores"];
  return (
    <div className="scroll-thin overflow-x-auto rounded-2xl bg-surface">
      <table className="w-full min-w-[760px] text-[0.88rem]">
        <thead>
          <tr className="text-[0.78rem] text-ink-3">
            <th className="px-4 py-2.5 text-left font-medium">Head</th>
            {series.map((s) => <th key={s.m} className="px-3 py-2.5 text-right font-medium">{monthName(s.m)}</th>)}
          </tr>
        </thead>
        <tbody className="num">
          <tr className="border-t border-surface-2"><td className="px-4 py-2 text-left">Tonnes extracted</td>{series.map((s) => <td key={s.m} className="px-3 py-2 text-right">{n0(s.tonnes)}</td>)}</tr>
          {heads.filter((c) => series.some((s) => s.byCat[c])).map((c) => (
            <tr key={c} className="border-t border-surface-2">
              <td className="px-4 py-2 text-left">{CAT[c].label} <span className="text-ink-3">₹/t</span></td>
              {series.map((s) => <td key={s.m} className="px-3 py-2 text-right">{s.tonnes && s.byCat[c] ? rs(s.byCat[c] / s.tonnes) : "—"}</td>)}
            </tr>
          ))}
          <tr className="border-t border-surface-2 font-semibold"><td className="px-4 py-2.5 text-left">Cost per tonne</td>{series.map((s) => <td key={s.m} className="px-3 py-2.5 text-right">{s.perTonne ? rs(s.perTonne) : "—"}</td>)}</tr>
          <tr className="border-t border-surface-2 text-ink-2"><td className="px-4 py-2 text-left">Cost per CBM</td>{series.map((s) => <td key={s.m} className="px-3 py-2 text-right">{s.perCbm ? rs(s.perCbm) : "—"}</td>)}</tr>
          <tr className="border-t border-surface-2 text-ink-2"><td className="px-4 py-2 text-left">Total spend</td>{series.map((s) => <td key={s.m} className="px-3 py-2 text-right">{lakh(s.total)}</td>)}</tr>
        </tbody>
      </table>
      <p className="px-4 pb-4 pt-1 text-[0.82rem] text-ink-3">Royalty paid per block on the rawanna is counted on the block, not here, so it is not counted twice. New quarry blocks pick up the latest month’s cost per tonne.</p>
    </div>
  );
}

export function CostForm({ ctx, initial, onClose }: { ctx: Ctx; initial: MineCost | null; onClose: () => void }) {
  const mines = ownMines(ctx.db);
  const vendors = ctx.db.parties.filter((p) => p.kind === "vendor");
  const [c, setC] = useState<MineCost>(() => initial ? { ...initial } : { id: "", date: today(), mine: mines[0] ?? "", cat: "machine", machine: MACHINES[0], qty: 0, unit: CAT.machine.unit, rate: CAT.machine.rate, amount: 0, note: "", vendorId: "", billNo: "" });
  const set = <K extends keyof MineCost>(k: K, v: MineCost[K]) => setC((x) => {
    const n = { ...x, [k]: v };
    if (k === "cat") { n.unit = CAT[v as MineCostCat].unit; n.rate = CAT[v as MineCostCat].rate || n.rate; }
    if (k === "qty" || k === "rate" || k === "cat") n.amount = Math.round(n.qty * n.rate);
    return n;
  });
  const lumpSum = c.unit === "₹";
  const save = () => {
    const out = { ...c, id: c.id || uid(), qty: lumpSum ? 1 : c.qty, rate: lumpSum ? c.amount : c.rate };
    ctx.update((d) => { const i = d.mineCosts.findIndex((x) => x.id === out.id); if (i >= 0) d.mineCosts[i] = out; else d.mineCosts.push(out); d.mineCosts.sort((a, b) => a.date.localeCompare(b.date)); });
    onClose();
  };
  const del = () => { if (!initial) return; ctx.update((d) => { d.mineCosts = d.mineCosts.filter((x) => x.id !== initial.id); }); onClose(); };
  return (
    <Drawer open title={initial ? "Edit extraction cost" : "Extraction cost"} sub="Log by day or by week. Quantities let you track diesel per tonne and wire per cut." onClose={onClose}
      footer={<>
        <button className="btn btn-primary" onClick={save}>Save</button>
        <button className="btn btn-quiet" onClick={onClose}>Cancel</button>
        {initial && <button className="btn btn-quiet btn-sm ml-auto !text-neg" onClick={del}>Delete</button>}
      </>}>
      <Grid>
        <F label="Date"><TextIn type="date" value={c.date} onChange={(v) => set("date", v)} /></F>
        <F label="Mine" hint={!mines.length ? "Add your mines under Masters → Mines" : undefined}><Sel value={c.mine} onChange={(v) => set("mine", v)} options={mines.map((m) => ({ v: m, l: m }))} /></F>
        <F label="Cost head" span={2}>
          <div className="flex flex-wrap gap-1.5">{CAT_ORDER.map((k) => <button key={k} type="button" className="chip" data-on={c.cat === k} onClick={() => set("cat", k)}>{CAT[k].label}</button>)}</div>
        </F>
        <F label="Vendor" hint={!vendors.length ? "Add machine owners, the diesel pump and wire suppliers under Masters → Vendors" : undefined}><Sel value={c.vendorId ?? ""} onChange={(v) => set("vendorId", v)} placeholder="Own / not set" options={vendors.map((p) => ({ v: p.id, l: `${p.company}${p.city ? ` · ${p.city}` : ""}` }))} /></F>
        <F label="Vendor bill no."><TextIn value={c.billNo ?? ""} onChange={(v) => set("billNo", v)} upper /></F>
        <F label="Machine / crew" span={2}>
          <TextIn value={c.machine} onChange={(v) => set("machine", v)} list="mine-machines" />
          <datalist id="mine-machines">{MACHINES.map((m) => <option key={m} value={m} />)}</datalist>
        </F>
        {!lumpSum && <F label="Quantity"><NumIn value={c.qty} onChange={(v) => set("qty", v)} suffix={c.unit} /></F>}
        {!lumpSum && <F label="Rate"><NumIn value={c.rate} onChange={(v) => set("rate", v)} suffix={`₹/${c.unit || "unit"}`} /></F>}
        <F label="Amount" span={2}><NumIn value={c.amount} onChange={(v) => setC((x) => ({ ...x, amount: v }))} suffix="₹" /></F>
        <F label="Note" span={2}><Area value={c.note} onChange={(v) => set("note", v)} placeholder="Pump, meter reading, hours on the machine" /></F>
      </Grid>
      {c.cat === "wire" && <div className="mt-4"><Note>Note the metres of wire used per cut. Wire wear per square metre of cut face is the number to compare between beads and suppliers.</Note></div>}
    </Drawer>
  );
}
