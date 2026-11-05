"use client";
import { useMemo, useState } from "react";
import { Layers, Search } from "lucide-react";
import { n0, n2, rs2 } from "@/lib/stone/calc";
import { SLAB_STATUS, allSlabs, moveSlabs, nextLotNo, slabArea, splitLot, syncLot, type SlabRow } from "@/lib/stone/slabs";
import type { Grade, Slab, SlabStatus } from "@/lib/stone/types";
import type { Ctx } from "./StoneApp";
import { Badge, Drawer, F, Grid, Note, NumIn, Sel, Stat, TextIn } from "./ui";

type Where = "all" | "unit" | "depot";
type St = "all" | SlabStatus;

/** Every slab, one row each: which block it came from and which lot it sits in. */
export default function SlabsView({ ctx }: { ctx: Ctx }) {
  const { db, update } = ctx;
  const can = ctx.edit("processing") || ctx.edit("stock");
  const rows = useMemo(() => allSlabs(db), [db]);
  const [where, setWhere] = useState<Where>("all");
  const [status, setStatus] = useState<St>("stock");
  const [block, setBlock] = useState("");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [lotTo, setLotTo] = useState("");
  const [open, setOpen] = useState<SlabRow | null>(null);

  const blockNo = (id: string) => ctx.root.blocks.find((b) => b.id === id)?.no ?? "";
  const blocks = [...new Set(rows.map((r) => r.blockId))].map((id) => ({ v: id, l: blockNo(id) || "No block (bought / imported)" }));
  const shown = rows.filter((r) =>
    (where === "all" || r.lot.site === where) && (status === "all" || r.status === status) && (!block || r.blockId === block) &&
    (!q || `${r.no} ${r.lot.lotNo} ${blockNo(r.blockId)} ${r.lot.variety} ${r.lot.location}`.toLowerCase().includes(q.toLowerCase())));
  const inStock = rows.filter((r) => r.status === "stock");
  const untracked = db.lots.filter((l) => l.available > 0 && !l.slabs?.length);
  const picked = shown.filter((r) => sel.has(r.id));
  const allOn = shown.length > 0 && shown.every((r) => sel.has(r.id));

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const move = () => {
    const ids = picked.filter((r) => r.status !== "sold").map((r) => r.id);
    update((d) => moveSlabs(d, ids, lotTo));
    ctx.say(`${ids.length} slab${ids.length === 1 ? "" : "s"} moved to lot ${lotTo.trim()}`, "good");
    setSel(new Set());
    setLotTo("");
  };
  const mark = (st: SlabStatus) => {
    const ids = new Set(picked.filter((r) => r.status !== "sold").map((r) => r.id));
    update((d) => { for (const l of d.lots) if (l.slabs?.some((s) => ids.has(s.id))) { for (const s of l.slabs) if (ids.has(s.id)) s.status = st; syncLot(l); } });
    setSel(new Set());
  };
  const track = () => {
    update((d) => { for (const l of d.lots) if (l.available > 0 && !l.slabs?.length) splitLot(l, d.blocks.find((b) => b.id === l.blockId)?.no || l.lotNo); });
    ctx.say("Slab records made. Open each slab to enter its size.", "good");
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Slabs in stock" value={n0(inStock.length)} sub={`${n0(inStock.reduce((a, r) => a + r.sqft, 0))} sq ft`} />
        <Stat label="Lots" value={n0(new Set(inStock.map((r) => r.lot.id)).size)} sub={`from ${new Set(inStock.map((r) => r.blockId).filter(Boolean)).size} blocks`} />
        <Stat label="Sold" value={n0(rows.filter((r) => r.status === "sold").length)} sub="slabs on invoices" />
        <Stat label="Broken" value={n0(rows.filter((r) => r.status === "broken").length)} sub={`${n0(rows.filter((r) => r.status === "broken").reduce((a, r) => a + r.sqft, 0))} sq ft`} tone={rows.some((r) => r.status === "broken") ? "warn" : undefined} />
      </div>

      {untracked.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-[0.9rem]">
          <Layers size={16} className="text-ink-3" />
          <span className="flex-1">{untracked.length} lot{untracked.length > 1 ? "s were" : " was"} stocked before slab tracking ({untracked.map((l) => l.lotNo).slice(0, 4).join(", ")}{untracked.length > 4 ? "…" : ""}).</span>
          {can && <button className="btn btn-quiet btn-sm" onClick={track}>Make slab records</button>}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(["stock", "sold", "broken", "all"] as St[]).map((k) => <button key={k} className="chip" data-on={status === k} onClick={() => setStatus(k)}>{k === "all" ? "All" : SLAB_STATUS[k]}</button>)}
        </div>
        {ctx.mods.processing && (ctx.mods.depot || ctx.mods.trading) && (
          <div className="flex flex-wrap gap-1.5">
            {(["all", "unit", "depot"] as Where[]).map((k) => <button key={k} className="chip" data-on={where === k} onClick={() => setWhere(k)}>{k === "all" ? "Unit and depot" : k === "unit" ? "At unit" : "At depot"}</button>)}
          </div>
        )}
        <div className="w-56"><Sel value={block} onChange={setBlock} placeholder="All blocks" options={[{ v: "", l: "All blocks" }, ...blocks]} /></div>
        <label className="flex min-w-[180px] items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm">
          <Search size={15} className="text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Slab, lot or block no." className="w-full bg-transparent outline-none placeholder:text-ink-3" />
        </label>
      </div>

      {can && picked.length > 0 && (
        <div className="sticky top-16 z-20 mt-3 flex flex-wrap items-end gap-2 rounded-2xl bg-ink px-4 py-3 text-ground lg:top-3">
          <span className="self-center text-sm font-medium">{picked.length} selected · {n0(picked.reduce((a, r) => a + r.sqft, 0))} sq ft</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input className="field !w-36 !bg-ground !text-ink" value={lotTo} onChange={(e) => setLotTo(e.target.value)} placeholder={`Lot no., e.g. ${nextLotNo(db)}`} list="lot-nos" />
            <datalist id="lot-nos">{[...new Set(db.lots.map((l) => l.lotNo))].map((n) => <option key={n} value={n} />)}</datalist>
            <button className="btn btn-primary btn-sm" disabled={!lotTo.trim()} onClick={move}>Put in lot</button>
            <button className="btn btn-sm !bg-ground/15 !text-ground" onClick={() => mark("broken")}>Mark broken</button>
            {picked.some((r) => r.status === "broken") && <button className="btn btn-sm !bg-ground/15 !text-ground" onClick={() => mark("stock")}>Back in stock</button>}
            <button className="btn btn-sm !bg-transparent !text-ground/70" onClick={() => setSel(new Set())}>Clear</button>
          </div>
        </div>
      )}

      <div className="scroll-thin mt-3 overflow-x-auto rounded-2xl bg-surface">
        <table className="w-full min-w-[760px] text-left text-[0.88rem]">
          <thead>
            <tr className="text-[0.78rem] text-ink-3">
              {can && <th className="w-10 py-2.5 pl-4"><input type="checkbox" aria-label="Select all shown" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(shown.map((r) => r.id)))} /></th>}
              <th className={`px-3 py-2.5 font-medium ${can ? "" : "pl-4"}`}>Block no.</th>
              <th className="px-3 py-2.5 font-medium">Slab</th>
              <th className="px-3 py-2.5 font-medium">Lot</th>
              <th className="px-3 py-2.5 font-medium">Size (cm)</th>
              <th className="px-3 py-2.5 text-right font-medium">Sq ft</th>
              <th className="px-3 py-2.5 font-medium">Grade</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 pr-4 font-medium">Where</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className={`cursor-pointer border-t border-surface-2 hover:bg-surface-2/50 ${sel.has(r.id) ? "bg-accent-soft/60" : ""}`} onClick={() => setOpen(r)}>
                {can && <td className="py-2 pl-4" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${r.no}`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></td>}
                <td className={`px-3 py-2 font-medium ${can ? "" : "pl-4"}`}>{blockNo(r.blockId) || <span className="text-ink-3">—</span>}</td>
                <td className="num px-3 py-2">{r.no}</td>
                <td className="px-3 py-2"><span className="font-medium">{r.lot.lotNo}</span><span className="block text-[0.78rem] text-ink-3">{r.lot.variety} · {r.lot.thicknessMm} mm</span></td>
                <td className="num px-3 py-2">{r.l && r.w ? `${n0(r.l)} × ${n0(r.w)}` : <span className="text-ink-3">Not measured</span>}</td>
                <td className="num px-3 py-2 text-right">{n2(r.sqft)}</td>
                <td className="px-3 py-2">{r.grade}</td>
                <td className="px-3 py-2"><Badge tone={r.status === "stock" ? "good" : r.status === "broken" ? "neg" : "plain"}>{SLAB_STATUS[r.status]}</Badge></td>
                <td className="px-3 py-2 pr-4"><span>{r.lot.site === "depot" ? "Depot" : "Unit"}</span><span className="block text-[0.78rem] text-ink-3">{r.lot.location}</span></td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={9} className="px-4 py-10 text-center text-ink-3">{rows.length ? "No slabs match these filters." : "No slabs yet. When a block comes off the saw, record each slab under Manufacturing unit → Block yard → Slabs out."}</td></tr>}
          </tbody>
        </table>
      </div>
      {can && rows.length > 0 && <p className="mt-2 text-[0.8rem] text-ink-3">Tick slabs to put them in another lot or mark them broken. Cost moves with each slab.</p>}

      {open && <SlabForm ctx={ctx} row={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function SlabForm({ ctx, row, onClose }: { ctx: Ctx; row: SlabRow; onClose: () => void }) {
  const can = (ctx.edit("processing") || ctx.edit("stock")) && row.status !== "sold";
  const [s, setS] = useState<Slab>(() => { const { lot: _lot, ...x } = row; void _lot; return x; });
  const [lotNo, setLotNo] = useState(row.lot.lotNo);
  const sale = row.saleId ? ctx.db.sales.find((x) => x.id === row.saleId) : undefined;
  const set = <K extends keyof Slab>(k: K, v: Slab[K]) => setS((x) => { const n = { ...x, [k]: v }; if ((k === "l" || k === "w") && n.l && n.w) n.sqft = slabArea(n.l, n.w); return n; });
  const save = () => {
    ctx.update((d) => {
      const lot = d.lots.find((l) => l.id === row.lot.id);
      const i = lot?.slabs?.findIndex((x) => x.id === s.id) ?? -1;
      if (!lot || i < 0) return;
      lot.slabs![i] = s;
      syncLot(lot);
      if (lotNo.trim() && lotNo.trim() !== lot.lotNo) moveSlabs(d, [s.id], lotNo);
    });
    onClose();
  };
  return (
    <Drawer open title={`Slab ${row.no}`} sub={`${row.lot.variety} · ${row.lot.thicknessMm} mm ${row.lot.finish} · lot ${row.lot.lotNo}${ctx.costs ? ` · ${rs2(row.lot.sqft ? row.lot.cost / row.lot.sqft : 0)}/sq ft` : ""}`} onClose={onClose}
      footer={can ? <><button className="btn btn-primary" onClick={save}>Save</button><button className="btn btn-quiet" onClick={onClose}>Cancel</button></> : <button className="btn btn-quiet" onClick={onClose}>Close</button>}>
      {sale && <div className="mb-4"><Note>Sold on invoice {sale.invoiceNo}. Edit the invoice to change it.</Note></div>}
      <Grid>
        <F label="Lot no." hint="Type a new number to start a new lot"><TextIn value={lotNo} onChange={setLotNo} list="slab-lot-nos" /><datalist id="slab-lot-nos">{[...new Set(ctx.db.lots.map((l) => l.lotNo))].map((n) => <option key={n} value={n} />)}</datalist></F>
        <F label="Grade"><Sel value={s.grade} onChange={(v) => set("grade", v as Grade)} options={["A", "B", "C", "Commercial"].map((v) => ({ v, l: v }))} /></F>
        <F label="Length"><NumIn value={s.l} onChange={(v) => set("l", v)} suffix="cm" /></F>
        <F label="Width"><NumIn value={s.w} onChange={(v) => set("w", v)} suffix="cm" /></F>
        <F label="Area" hint={s.l && s.w ? "Worked out from the size" : undefined}><NumIn value={s.sqft} onChange={(v) => set("sqft", v)} suffix="sq ft" /></F>
        <F label="Status">{row.status === "sold" ? <div className="field">Sold</div> : <Sel value={s.status} onChange={(v) => set("status", v as SlabStatus)} options={[{ v: "stock", l: "In stock" }, { v: "broken", l: "Broken" }]} />}</F>
        <F label="Note" span={2}><TextIn value={s.note ?? ""} onChange={(v) => set("note", v)} placeholder="Crack at one corner, book-matched with /08" /></F>
      </Grid>
    </Drawer>
  );
}
