"use client";
import { useMemo, useState } from "react";
import { Plus, QrCode, Truck } from "lucide-react";
import { blockCost, cbm, dmy, mineMonth, mineWindow, months, n0, n2, rs, today, uid, weightGap, lakh } from "@/lib/stone/calc";
import type { Block, MineCost, MineCostCat } from "@/lib/stone/types";
import type { Ctx } from "./StoneApp";
import BlockForm, { STATUS_LABEL, type BlockMode } from "./BlockForm";
import QrLabels from "./QrLabels";
import TransferForm from "./Transfer";
import { Area, Badge, Drawer, F, Grid, Note, NumIn, Sel, Seg, Stat, Table, TextIn, type Col } from "./ui";

export const CAT: Record<MineCostCat, { label: string; unit: string; rate: number }> = {
  diesel: { label: "Diesel", unit: "L", rate: 94 },
  power: { label: "Power", unit: "kWh", rate: 8.5 },
  wire: { label: "Diamond wire", unit: "m", rate: 3200 },
  labour: { label: "Labour", unit: "man-days", rate: 650 },
  tools: { label: "Tools & consumables", unit: "lot", rate: 0 },
  maintenance: { label: "Machine repair", unit: "job", rate: 0 },
  royalty: { label: "Royalty / DMG dues", unit: "₹", rate: 1 },
  rent: { label: "Dead rent & lease", unit: "₹", rate: 1 },
  other: { label: "Other", unit: "", rate: 0 },
};
const CAT_ORDER: MineCostCat[] = ["diesel", "power", "wire", "labour", "tools", "maintenance", "royalty", "rent", "other"];
const MACHINES = ["Excavator (PC-210)", "Wheel loader", "Wire saw machines", "Chain saw", "Compressor & DG set", "Drill machine", "Quarry crew", "Hydra crane"];

export function monthName(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleString("en-IN", { month: "short", year: "2-digit" });
}

type MTab = "quarry" | "bought" | "imported" | "costs" | "pertonne";

export default function Mines({ ctx }: { ctx: Ctx }) {
  const { db, update } = ctx;
  const quarryOn = ctx.mods.quarry && ctx.can("quarry") !== "none";
  const boughtOn = (ctx.mods.buyBlocks || ctx.mods.processing) && ctx.can("blocks") !== "none";
  const importOn = ctx.can("blocks") !== "none";
  const allowedTabs: MTab[] = [...(quarryOn ? (["quarry"] as MTab[]) : []), ...(boughtOn ? (["bought"] as MTab[]) : []), ...(importOn ? (["imported"] as MTab[]) : []), ...(quarryOn && ctx.costs ? (["costs", "pertonne"] as MTab[]) : [])];
  const [tabRaw, setTab] = useState<MTab>((ctx.sub as MTab) || allowedTabs[0] || "bought");
  const tab: MTab = allowedTabs.includes(tabRaw) ? tabRaw : allowedTabs[0] ?? "bought";
  const [labels, setLabels] = useState(false);
  const [send, setSend] = useState<Block | null>(null);
  const [form, setForm] = useState<{ b: Block | null; mode: BlockMode } | null>(null);
  const [costForm, setCostForm] = useState<MineCost | null | "new">(null);
  const ms = months(db);
  const m = mineWindow(db, 30);
  const prev = mineWindow(db, 30, 30);

  const own = db.blocks.filter((b) => b.source === "own_mine");
  const bought = db.blocks.filter((b) => b.source === "purchase");
  const imported = db.blocks.filter((b) => b.source === "import");
  const shipOf = (id: string) => db.shipments.find((x) => x.id === id);
  const sup = (id: string) => db.parties.find((p) => p.id === id);

  const saveBlock = (b: Block) => {
    update((d) => {
      const i = d.blocks.findIndex((x) => x.id === b.id);
      if (i >= 0) d.blocks[i] = b;
      else d.blocks.push(b);
    });
    setForm(null);
  };
  const delBlock = (id: string) => {
    update((d) => { d.blocks = d.blocks.filter((x) => x.id !== id); });
    setForm(null);
  };

  const blockCols: Col<Block>[] = [
    { key: "no", label: "Block", render: (b) => <div><div className="font-medium">{b.no}</div><div className="text-[0.8rem] text-ink-3">{b.variety}</div></div>, sort: (b) => b.no },
    { key: "date", label: "Date", render: (b) => dmy(b.date), sort: (b) => b.date },
    { key: "size", label: "Size (cm)", render: (b) => <span className="num">{b.l}×{b.w}×{b.h}</span> },
    { key: "t", label: "Tonnes", align: "right", render: (b) => n2(b.tonnes || b.billedTonnes), sort: (b) => b.tonnes },
    { key: "cbm", label: "CBM", align: "right", render: (b) => n2(cbm(b)), sort: (b) => cbm(b) },
    { key: "veh", label: "Vehicle · rawanna", render: (b) => b.vehicleNo ? <div><div>{b.vehicleNo}</div><div className="text-[0.8rem] text-ink-3">{b.eRawanna || <span className="text-neg">No rawanna</span>}</div></div> : <span className="text-ink-3">Not dispatched</span> },
    ...(ctx.costs ? [{ key: "cost", label: "Cost", align: "right" as const, render: (b: Block) => rs(blockCost(b)), sort: (b: Block) => blockCost(b) }] : []),
    { key: "st", label: "Status", render: (b) => <Badge tone={b.status === "at_mine" ? "info" : b.status === "in_transit" ? "warn" : b.status === "rejected" ? "neg" : "plain"}>{STATUS_LABEL[b.status]}</Badge> },
  ];

  const boughtCols: Col<Block>[] = [
    blockCols[0],
    { key: "sup", label: "Supplier", render: (b) => <div><div>{sup(b.supplierId)?.company ?? "—"}</div><div className="text-[0.8rem] text-ink-3">{b.invoiceNo || "No bill no."}</div></div>, sort: (b) => sup(b.supplierId)?.company ?? "" },
    blockCols[1],
    { key: "bt", label: "Billed / weighed", align: "right", render: (b) => { const g = weightGap(b); return <div><div>{n2(b.billedTonnes)} / {b.tonnes ? n2(b.tonnes) : "—"} t</div>{g > 0.02 && <div className="text-[0.8rem] text-warn">{(g * 100).toFixed(1)}% short</div>}</div>; } },
    ...(ctx.costs ? [{ key: "rate", label: "Rate", align: "right" as const, render: (b: Block) => `${rs(b.rate)}/${b.rateBasis === "cbm" ? "CBM" : "t"}` }] : []),
    ...blockCols.slice(5),
  ];

  const importCols: Col<Block>[] = [
    blockCols[0],
    { key: "sh", label: "Shipment", render: (b) => { const sh = shipOf(b.shipmentId); return <div><div>{sh?.partyName ?? b.mine ?? "—"}</div><div className="text-[0.8rem] text-ink-3">{sh ? `${sh.country} · BL ${sh.blNo || "pending"}` : b.mine}</div></div>; }, sort: (b) => shipOf(b.shipmentId)?.partyName ?? "" },
    { key: "date", label: "Received", render: (b) => dmy(b.receivedOn || b.date), sort: (b) => b.receivedOn || b.date },
    blockCols[2], blockCols[3], blockCols[4],
    ...(ctx.costs ? [{ key: "lc", label: "Landed cost", align: "right" as const, render: (b: Block) => <div><div>{rs(blockCost(b))}</div><div className="text-[0.8rem] text-ink-3">{cbm(b) ? `${rs(blockCost(b) / cbm(b))}/CBM` : ""}</div></div>, sort: (b: Block) => blockCost(b) }] : []),
    blockCols[blockCols.length - 1],
  ];

  const costCols: Col<MineCost>[] = [
    { key: "d", label: "Date", render: (c) => dmy(c.date), sort: (c) => c.date },
    { key: "cat", label: "Head", render: (c) => <div><div className="font-medium">{CAT[c.cat].label}</div><div className="text-[0.8rem] text-ink-3">{c.machine}</div></div>, sort: (c) => c.cat },
    { key: "q", label: "Quantity", align: "right", render: (c) => c.unit === "₹" ? "—" : `${n2(c.qty)} ${c.unit}` },
    { key: "r", label: "Rate", align: "right", render: (c) => c.unit === "₹" ? "—" : rs(c.rate) },
    { key: "a", label: "Amount", align: "right", render: (c) => rs(c.amount), sort: (c) => c.amount },
    { key: "n", label: "Note", render: (c) => <span className="text-ink-2">{c.note}</span> },
  ];

  const series = useMemo(() => ms.slice(-6).map((mm) => ({ m: mm, ...mineMonth(db, null, mm) })), [db, ms]);
  const pt = (x: number) => (m.tonnes ? x / m.tonnes : 0);

  return (
    <div>
      {quarryOn && ctx.costs && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Extracted, last 30 days" value={`${n0(m.tonnes)} t`} sub={`${m.blocks.length} blocks · ${n2(m.vol)} CBM`} />
        <Stat label="Extraction cost per tonne" value={rs(m.perTonne)} sub={prev.perTonne ? `${m.perTonne > prev.perTonne ? "▲" : "▼"} ${rs(Math.abs(m.perTonne - prev.perTonne))} vs the 30 days before` : "—"} tone={prev.perTonne && m.perTonne > prev.perTonne * 1.05 ? "warn" : undefined} />
        <Stat label="Diesel per tonne" value={`${n2(pt(m.qty("diesel")))} L`} sub={`${n0(m.qty("diesel"))} L in 30 days · ${rs(m.byCat.diesel ?? 0)}`} />
        <Stat label="Wire per 100 t" value={`${n2(pt(m.qty("wire")) * 100)} m`} sub={`Power ${n2(pt(m.qty("power")))} kWh/t · labour ${n2(pt(m.qty("labour")))} days/t`} />
      </div>}

      <div className={`${quarryOn && ctx.costs ? "mt-8" : ""} flex flex-wrap items-center gap-3`}>
        <Seg value={tab} onChange={setTab} tabs={([
          { key: "quarry", label: "Own quarry blocks", count: own.length },
          { key: "bought", label: "Bought from mines", count: bought.length },
          { key: "imported", label: "Imported blocks", count: imported.length },
          { key: "costs", label: "Running costs", count: db.mineCosts.length },
          { key: "pertonne", label: "Cost per tonne" },
        ] as { key: MTab; label: string; count?: number }[]).filter((t) => allowedTabs.includes(t.key))} />
        <div className="ml-auto flex gap-2">
          {(tab === "quarry" || tab === "bought" || tab === "imported") && <button className="btn btn-quiet btn-sm" onClick={() => setLabels(true)}><QrCode size={15} />QR labels</button>}
          {tab === "quarry" && ctx.edit("quarry") && <button className="btn btn-primary btn-sm" onClick={() => setForm({ b: null, mode: "own" })}><Plus size={15} />Block extracted</button>}
          {tab === "bought" && ctx.edit("blocks") && <button className="btn btn-primary btn-sm" onClick={() => setForm({ b: null, mode: "purchase" })}><Plus size={15} />Bought block</button>}
          {tab === "imported" && ctx.edit("blocks") && <button className="btn btn-primary btn-sm" onClick={() => setForm({ b: null, mode: "import" })}><Plus size={15} />Imported block</button>}
          {(tab === "costs" || tab === "pertonne") && ctx.edit("quarry") && <button className="btn btn-primary btn-sm" onClick={() => setCostForm("new")}><Plus size={15} />Cost entry</button>}
        </div>
      </div>

      <div className="mt-4">
        {tab === "quarry" && (
          <>
            {own.some((b) => b.status === "at_mine") && (
              <div className="mb-4 flex flex-wrap gap-2">
                {own.filter((b) => b.status === "at_mine").map((b) => (
                  <button key={b.id} className="btn btn-quiet btn-sm" onClick={() => setForm({ b: { ...b, status: "in_transit", date: today() }, mode: "edit" })}><Truck size={14} />Dispatch {b.no}</button>
                ))}
              </div>
            )}
            <Table rows={[...own].reverse()} cols={blockCols} onRow={(b) => setForm({ b, mode: "edit" })} search={(b) => `${b.no} ${b.variety} ${b.vehicleNo} ${b.eRawanna}`} empty="No blocks logged from your quarry yet." />
          </>
        )}
        {tab === "bought" && <Table rows={[...bought].reverse()} cols={boughtCols} onRow={(b) => setForm({ b, mode: "edit" })} search={(b) => `${b.no} ${b.variety} ${b.vehicleNo} ${sup(b.supplierId)?.company ?? ""} ${b.invoiceNo}`} empty="No purchased blocks yet." />}
        {tab === "imported" && (
          <>
            <div className="mb-3"><Note>Blocks that came on an import shipment land here when you click Receive under Import and export, with their share of the landed cost. Add one by hand for a shipment recorded elsewhere.</Note></div>
            <Table rows={[...imported].reverse()} cols={importCols} onRow={(b) => setForm({ b, mode: "edit" })} search={(b) => `${b.no} ${b.variety} ${shipOf(b.shipmentId)?.blNo ?? ""} ${shipOf(b.shipmentId)?.partyName ?? ""} ${b.mine}`} empty="No imported blocks yet." />
          </>
        )}
        {tab === "costs" && <Table rows={[...db.mineCosts].reverse()} cols={costCols} onRow={(c) => setCostForm(c)} search={(c) => `${CAT[c.cat].label} ${c.machine} ${c.note}`} empty="Log diesel, power, wire, labour and tool costs to see your cost per tonne." />}
        {tab === "pertonne" && (
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
                {CAT_ORDER.filter((c) => series.some((s) => s.byCat[c])).map((c) => (
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
        )}
      </div>

      {labels && <QrLabels ctx={ctx} blocks={tab === "quarry" ? own : bought} onClose={() => setLabels(false)} />}
      {form && <BlockForm costs={ctx.costs} db={db} initial={form.b?.id ? form.b : null} mode={form.mode} onSave={saveBlock} onDelete={delBlock} onClose={() => setForm(null)} key={form.b?.id ?? form.mode} onTransfer={ctx.firms.length > 1 && ctx.edit("blocks") && form.b?.id ? () => { setSend(form.b); setForm(null); } : undefined} />}
      {send && <TransferForm ctx={ctx} item={send} kind="block" onClose={() => setSend(null)} />}
      {costForm && <CostForm initial={costForm === "new" ? null : costForm} mines={db.settings.ownMines} onClose={() => setCostForm(null)}
        onSave={(c) => { update((d) => { const i = d.mineCosts.findIndex((x) => x.id === c.id); if (i >= 0) d.mineCosts[i] = c; else d.mineCosts.push(c); d.mineCosts.sort((a, b) => a.date.localeCompare(b.date)); }); setCostForm(null); }}
        onDelete={(id) => { update((d) => { d.mineCosts = d.mineCosts.filter((x) => x.id !== id); }); setCostForm(null); }} />}
    </div>
  );
}

function CostForm({ initial, mines, onSave, onDelete, onClose }: { initial: MineCost | null; mines: string[]; onSave: (c: MineCost) => void; onDelete: (id: string) => void; onClose: () => void }) {
  const [c, setC] = useState<MineCost>(() => initial ? { ...initial } : { id: "", date: today(), mine: mines[0] ?? "", cat: "diesel", machine: MACHINES[0], qty: 0, unit: "L", rate: CAT.diesel.rate, amount: 0, note: "" });
  const set = <K extends keyof MineCost>(k: K, v: MineCost[K]) => setC((x) => {
    const n = { ...x, [k]: v };
    if (k === "cat") { n.unit = CAT[v as MineCostCat].unit; n.rate = CAT[v as MineCostCat].rate || n.rate; }
    if (k === "qty" || k === "rate" || k === "cat") n.amount = Math.round(n.qty * n.rate);
    return n;
  });
  const lumpSum = c.unit === "₹";
  return (
    <Drawer open title={initial ? "Edit cost entry" : "Quarry cost entry"} sub="Log by day or by week. Quantities let you track diesel per tonne and wire per cut." onClose={onClose}
      footer={<>
        <button className="btn btn-primary" onClick={() => onSave({ ...c, id: c.id || uid(), qty: lumpSum ? 1 : c.qty, rate: lumpSum ? c.amount : c.rate })}>Save</button>
        <button className="btn btn-quiet" onClick={onClose}>Cancel</button>
        {initial && <button className="btn btn-quiet btn-sm ml-auto !text-neg" onClick={() => onDelete(initial.id)}>Delete</button>}
      </>}>
      <Grid>
        <F label="Date"><TextIn type="date" value={c.date} onChange={(v) => set("date", v)} /></F>
        <F label="Quarry"><Sel value={c.mine} onChange={(v) => set("mine", v)} options={mines.map((m) => ({ v: m, l: m }))} /></F>
        <F label="Cost head" span={2}>
          <div className="flex flex-wrap gap-1.5">{CAT_ORDER.map((k) => <button key={k} type="button" className="chip" data-on={c.cat === k} onClick={() => set("cat", k)}>{CAT[k].label}</button>)}</div>
        </F>
        <F label="Machine / crew" span={2}>
          <TextIn value={c.machine} onChange={(v) => set("machine", v)} list="mine-machines" />
          <datalist id="mine-machines">{MACHINES.map((m) => <option key={m} value={m} />)}</datalist>
        </F>
        {!lumpSum && <F label="Quantity"><NumIn value={c.qty} onChange={(v) => set("qty", v)} suffix={c.unit} /></F>}
        {!lumpSum && <F label="Rate"><NumIn value={c.rate} onChange={(v) => set("rate", v)} suffix={`₹/${c.unit || "unit"}`} /></F>}
        <F label="Amount" span={2}><NumIn value={c.amount} onChange={(v) => setC((x) => ({ ...x, amount: v }))} suffix="₹" /></F>
        <F label="Note" span={2}><Area value={c.note} onChange={(v) => set("note", v)} placeholder="Bill no., pump, meter reading" /></F>
      </Grid>
      {c.cat === "wire" && <div className="mt-4"><Note>Note the metres of wire used per cut. Wire wear per square metre of cut face is the number to compare between beads and suppliers.</Note></div>}
    </Drawer>
  );
}
