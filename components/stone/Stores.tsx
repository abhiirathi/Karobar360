"use client";
import { useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Plus, Trash2 } from "lucide-react";
import { dmy, lakh, n0, n2, rs, today, uid } from "@/lib/stone/calc";
import { STORE_CATS, avgRate, catLabel, daysLeft, onHand, storesOf, used } from "@/lib/stone/stores";
import { ownMines } from "@/lib/stone/costing";
import type { StoreCat, StoreItem, StoreMove, Stores } from "@/lib/stone/types";
import type { Ctx } from "./StoneApp";
import { Badge, Drawer, F, Grid, Note, NumIn, Section, Sel, Seg, Stat, Table, TextIn, type Col } from "./ui";

type Tab = "stock" | "log";

export default function StoresView({ ctx }: { ctx: Ctx }) {
  const { db } = ctx;
  const S = storesOf(db);
  const C = ctx.costs;
  const can = ctx.edit("stores");
  const [tab, setTab] = useState<Tab>((ctx.sub as Tab) || "stock");
  const [cat, setCat] = useState<StoreCat | "all">("all");
  const [item, setItem] = useState<StoreItem | "new" | null>(null);
  const [recv, setRecv] = useState(false);
  const [issue, setIssue] = useState<StoreItem | null | "pick">(null);

  const rows = useMemo(() => S.items.map((i) => ({ ...i, have: onHand(S, i.id), avg: avgRate(S, i), left: daysLeft(S, i) })), [S]);
  const shown = rows.filter((r) => cat === "all" || r.cat === cat);
  const low = rows.filter((r) => r.minQty > 0 && r.have <= r.minQty);
  const value = rows.reduce((a, r) => a + Math.max(0, r.have) * r.avg, 0);
  const out30 = used(S, null, 30);
  const out30Val = out30.reduce((a, m) => { const it = S.items.find((x) => x.id === m.itemId); return a + m.qty * (it ? avgRate(S, it) : 0); }, 0);
  const sqft30 = db.jobs.filter((j) => j.finishedOn && Date.now() - new Date(j.finishedOn).getTime() < 30 * 864e5).reduce((a, j) => a + j.sqft, 0);
  const epoxy30 = out30.filter((m) => ["epoxy", "resin"].includes(S.items.find((x) => x.id === m.itemId)?.cat ?? "")).reduce((a, m) => { const it = S.items.find((x) => x.id === m.itemId)!; return a + m.qty * avgRate(S, it); }, 0);
  const sup = (id?: string) => ctx.root.parties.find((p) => p.id === id)?.company;
  const cats = STORE_CATS.filter((c) => S.items.some((i) => i.cat === c.key));

  const cols: Col<(typeof rows)[number]>[] = [
    { key: "n", label: "Item", render: (r) => <div><div className="font-medium">{r.name}</div><div className="text-[0.8rem] text-ink-3">{catLabel(r.cat)}{r.location ? ` · ${r.location}` : ""}{sup(r.vendorId) ? ` · ${sup(r.vendorId)}` : ""}</div></div>, sort: (r) => r.name },
    { key: "h", label: "In stock", align: "right", render: (r) => <span className={r.have <= r.minQty && r.minQty > 0 ? "font-semibold text-neg" : "font-medium"}>{n2(r.have)} {r.unit}</span>, sort: (r) => r.have },
    { key: "m", label: "Reorder at", align: "right", render: (r) => r.minQty ? `${n2(r.minQty)} ${r.unit}` : <span className="text-ink-3">—</span> },
    { key: "d", label: "Lasts", align: "right", render: (r) => (isFinite(r.left) ? <span className={r.left < 10 ? "text-warn" : ""}>{n0(r.left)} days</span> : <span className="text-ink-3">—</span>), sort: (r) => (isFinite(r.left) ? r.left : 9999) },
    ...(C ? [{ key: "v", label: "Value", align: "right" as const, render: (r: (typeof rows)[number]) => <div><div>{rs(Math.max(0, r.have) * r.avg)}</div><div className="text-[0.78rem] text-ink-3">{rs(r.avg)}/{r.unit}</div></div>, sort: (r: (typeof rows)[number]) => r.have * r.avg }] : []),
    { key: "s", label: "", render: (r) => <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>{r.minQty > 0 && r.have <= r.minQty && <Badge tone="neg">Reorder</Badge>}{can && <button className="btn btn-quiet btn-sm" onClick={() => setIssue(r)}><ArrowUpFromLine size={13} />Issue</button>}</div> },
  ];

  const logCols: Col<StoreMove>[] = [
    { key: "d", label: "Date", render: (m) => dmy(m.date), sort: (m) => m.date },
    { key: "i", label: "Item", render: (m) => { const it = S.items.find((x) => x.id === m.itemId); return <div><div className="font-medium">{it?.name ?? "—"}</div><div className="text-[0.8rem] text-ink-3">{it ? catLabel(it.cat) : ""}</div></div>; } },
    { key: "k", label: "", render: (m) => <Badge tone={m.kind === "in" ? "good" : m.kind === "out" ? "plain" : "warn"}>{m.kind === "in" ? "Received" : m.kind === "out" ? "Issued" : "Count"}</Badge> },
    { key: "q", label: "Qty", align: "right", render: (m) => { const it = S.items.find((x) => x.id === m.itemId); return `${m.kind === "out" ? "−" : m.kind === "adjust" && m.qty < 0 ? "" : "+"}${n2(m.qty)} ${it?.unit ?? ""}`; } },
    { key: "w", label: "From / used for", render: (m) => <span className="text-ink-2">{m.kind === "in" ? [sup(m.supplierId), m.billNo].filter(Boolean).join(" · ") : m.usedFor || m.note}</span> },
    ...(C ? [{ key: "v", label: "Value", align: "right" as const, render: (m: StoreMove) => (m.kind === "in" ? rs(m.qty * m.rate) : "") }] : []),
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Items to reorder" value={`${low.length}`} sub={low.length ? low.slice(0, 3).map((x) => x.name).join(", ") : "All above reorder level"} tone={low.length ? "neg" : undefined} />
        {C ? <Stat label="Stores value" value={lakh(value)} sub={`${S.items.length} items at average cost`} /> : <Stat label="Items" value={`${S.items.length}`} sub={`${cats.length} categories`} />}
        {C ? <Stat label="Used, last 30 days" value={lakh(out30Val)} sub={`${out30.length} issues`} /> : <Stat label="Issues, last 30 days" value={`${out30.length}`} />}
        {C && ctx.mods.processing ? <Stat label="Epoxy and resin per sq ft" value={sqft30 ? `${rs(epoxy30 / sqft30)}` : "—"} sub={sqft30 ? `${n0(sqft30)} sq ft sawn in 30 days` : "Log sawing to see this"} /> : <Stat label="Received, last 30 days" value={`${S.moves.filter((m) => m.kind === "in" && Date.now() - new Date(m.date).getTime() < 30 * 864e5).length} bills`} />}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Seg value={tab} onChange={setTab} tabs={[{ key: "stock", label: "Stock", count: S.items.length }, { key: "log", label: "Received and issued", count: S.moves.length }]} />
        <div className="ml-auto flex flex-wrap gap-2">
          {can && <button className="btn btn-quiet btn-sm" onClick={() => setItem("new")}><Plus size={15} />New item</button>}
          {can && <button className="btn btn-quiet btn-sm" onClick={() => setIssue("pick")}><ArrowUpFromLine size={15} />Issue</button>}
          {can && <button className="btn btn-primary btn-sm" onClick={() => setRecv(true)}><ArrowDownToLine size={15} />Received</button>}
        </div>
      </div>
      {tab === "stock" && cats.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          <button className="chip" data-on={cat === "all"} onClick={() => setCat("all")}>All</button>
          {cats.map((c) => <button key={c.key} className="chip" data-on={cat === c.key} onClick={() => setCat(c.key)}>{c.label}</button>)}
        </div>
      )}
      <div className="mt-4">
        {tab === "stock" && <Table rows={shown} cols={cols} onRow={(r) => setItem(S.items.find((x) => x.id === r.id)!)} search={(r) => `${r.name} ${catLabel(r.cat)} ${r.location} ${sup(r.vendorId) ?? ""}`} empty="No items yet. Add epoxy, resin, polishing powder, abrasives, blades and spares you keep in the store." initialSort={{ key: "h", dir: 1 }} />}
        {tab === "log" && <Table rows={[...S.moves].reverse()} cols={logCols} search={(m) => `${S.items.find((x) => x.id === m.itemId)?.name} ${m.usedFor} ${m.billNo} ${m.note}`} empty="Nothing received or issued yet." />}
      </div>

      {item && <ItemForm ctx={ctx} S={S} item={item === "new" ? null : item} onClose={() => setItem(null)} />}
      {recv && <ReceiveForm ctx={ctx} S={S} onClose={() => setRecv(false)} />}
      {issue && <IssueForm ctx={ctx} S={S} item={issue === "pick" ? null : issue} onClose={() => setIssue(null)} />}
      {!can && <div className="mt-4"><Note>You can view the store. Ask your owner for edit access to receive or issue items.</Note></div>}
    </div>
  );
}

const put = (ctx: Ctx, fn: (s: Stores) => void) => ctx.update((d) => { d.stores ??= { items: [], moves: [] }; fn(d.stores); });

function ItemForm({ ctx, S, item, onClose }: { ctx: Ctx; S: Stores; item: StoreItem | null; onClose: () => void }) {
  const [it, setIt] = useState<StoreItem>(() => item ? { ...item } : { id: "", name: "", cat: "epoxy", unit: "kg", minQty: 0, rate: 0, location: "", notes: "" });
  const have = item ? onHand(S, item.id) : 0;
  const [count, setCount] = useState<number>(have);
  const [opening, setOpening] = useState(0);
  const can = ctx.edit("stores");
  const vendors = ctx.db.parties.filter((p) => p.kind === "vendor");
  const set = <K extends keyof StoreItem>(k: K, v: StoreItem[K]) => setIt({ ...it, [k]: v });
  const save = () => {
    const id = it.id || uid();
    put(ctx, (s) => {
      const i = s.items.findIndex((x) => x.id === id);
      if (i >= 0) s.items[i] = { ...it, id }; else s.items.push({ ...it, id });
      if (item && Math.abs(count - have) > 1e-9) s.moves.push({ id: uid(), itemId: id, date: today(), kind: "adjust", qty: count - have, rate: 0, note: "Physical count" });
      if (!item && opening > 0) s.moves.push({ id: uid(), itemId: id, date: today(), kind: "adjust", qty: opening, rate: it.rate, note: "Opening stock" });
    });
    onClose();
  };
  const del = () => { if (!item) return; put(ctx, (s) => { s.items = s.items.filter((x) => x.id !== item.id); s.moves = s.moves.filter((m) => m.itemId !== item.id); }); onClose(); };
  return (
    <Drawer open title={item ? item.name : "New store item"} sub={item ? `${catLabel(item.cat)} · ${n2(have)} ${item.unit} in stock` : "Anything you buy and use up: epoxy, resin, powders, blades, spares, packing."} onClose={onClose}
      footer={can ? <><button className="btn btn-primary" disabled={!it.name} onClick={save}>Save</button><button className="btn btn-quiet" onClick={onClose}>Cancel</button>{item && <button className="btn btn-quiet btn-sm ml-auto !text-neg" onClick={del}><Trash2 size={14} />Delete</button>}</> : <button className="btn btn-quiet" onClick={onClose}>Close</button>}>
      <Grid>
        <F label="Item name" span={2}><TextIn value={it.name} onChange={(v) => set("name", v)} placeholder="Epoxy resin, clear (A + B)" /></F>
        <F label="Category"><Sel value={it.cat} onChange={(v) => { const c = STORE_CATS.find((x) => x.key === v)!; setIt({ ...it, cat: c.key, unit: it.unit || c.unit }); }} options={STORE_CATS.map((c) => ({ v: c.key, l: c.label }))} /></F>
        <F label="Unit"><Sel value={it.unit} onChange={(v) => set("unit", v)} options={["kg", "g", "L", "pcs", "set", "m", "sq m", "box", "drum", "bag", "roll"].map((v) => ({ v, l: v }))} /></F>
        <F label="Reorder when stock falls to" hint="0 means no reminder"><NumIn value={it.minQty} onChange={(v) => set("minQty", v)} suffix={it.unit} /></F>
        {ctx.costs && <F label="Usual rate"><NumIn value={it.rate} onChange={(v) => set("rate", v)} suffix={`₹/${it.unit}`} /></F>}
        <F label="Vendor" span={2} hint={!vendors.length ? "Add vendors under Masters → Vendors" : undefined}><Sel value={it.vendorId ?? ""} onChange={(v) => set("vendorId", v)} placeholder="Choose vendor" options={vendors.map((p) => ({ v: p.id, l: `${p.company}${p.city ? ` · ${p.city}` : ""}` }))} /></F>
        <F label="Kept at"><TextIn value={it.location} onChange={(v) => set("location", v)} placeholder="Store room, shelf 2" /></F>
        {!item && <F label="Opening stock"><NumIn value={opening} onChange={setOpening} suffix={it.unit} /></F>}
        {item && <F label="Physical count" hint="Change this after counting; the difference is logged"><NumIn value={count} onChange={setCount} suffix={it.unit} /></F>}
        <F label="Notes" span={2}><TextIn value={it.notes} onChange={(v) => set("notes", v)} placeholder="Mixing ratio, supplier, shelf life" /></F>
      </Grid>
    </Drawer>
  );
}

function ReceiveForm({ ctx, S, onClose }: { ctx: Ctx; S: Stores; onClose: () => void }) {
  const vendors = ctx.db.parties.filter((p) => p.kind === "vendor");
  const [h, setH] = useState({ supplierId: "", billNo: "", date: today(), gstRate: 18 });
  const [lines, setLines] = useState<{ itemId: string; qty: number; rate: number }[]>([]);
  const total = lines.reduce((a, l) => a + l.qty * l.rate, 0);
  const err = !lines.length ? "Add at least one item" : lines.some((l) => !l.qty) ? "Enter quantity" : "";
  const save = () => {
    put(ctx, (s) => {
      for (const l of lines) {
        s.moves.push({ id: uid(), itemId: l.itemId, date: h.date, kind: "in", qty: l.qty, rate: l.rate, supplierId: h.supplierId, billNo: h.billNo, gstRate: h.gstRate, note: "" });
        const it = s.items.find((x) => x.id === l.itemId);
        if (it && l.rate > 0) it.rate = l.rate;
      }
    });
    ctx.say("Received into store", "good");
    onClose();
  };
  return (
    <Drawer open wide title="Received into store" sub="One vendor bill, one or more items." onClose={onClose}
      footer={<><button className="btn btn-primary" disabled={Boolean(err)} onClick={save}>Save</button><button className="btn btn-quiet" onClick={onClose}>Cancel</button>{err && <span className="text-sm text-ink-3">{err}</span>}</>}>
      <Section title="Bill">
        <Grid cols={3}>
          <F label="Vendor" span={2}><Sel value={h.supplierId} onChange={(v) => setH({ ...h, supplierId: v })} placeholder="Choose vendor (optional)" options={vendors.map((p) => ({ v: p.id, l: `${p.company} · ${p.city}` }))} /></F>
          <F label="Bill no."><TextIn value={h.billNo} onChange={(v) => setH({ ...h, billNo: v })} upper /></F>
          <F label="Date"><TextIn type="date" value={h.date} onChange={(v) => setH({ ...h, date: v })} /></F>
          {ctx.costs && <F label="GST on bill"><NumIn value={h.gstRate} onChange={(v) => setH({ ...h, gstRate: v })} suffix="%" /></F>}
        </Grid>
      </Section>
      <Section title="Items" aside={<Sel value="" onChange={(id) => { const it = S.items.find((x) => x.id === id); if (it) { setLines([...lines, { itemId: id, qty: 0, rate: it.rate }]); if (!h.supplierId && it.vendorId) setH({ ...h, supplierId: it.vendorId }); } }} placeholder="+ Add item" options={S.items.filter((i) => !lines.some((l) => l.itemId === i.id)).map((i) => ({ v: i.id, l: `${i.name} (${i.unit})` }))} />}>
        {!S.items.length && <Note>Add items to the store first with “New item”.</Note>}
        <div className="space-y-2">
          {lines.map((l, i) => {
            const it = S.items.find((x) => x.id === l.itemId)!;
            return (
              <div key={l.itemId} className="grid items-end gap-2 rounded-xl bg-surface p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                <div><div className="font-medium">{it.name}</div><div className="text-[0.8rem] text-ink-3">{n2(onHand(S, it.id))} {it.unit} in stock</div></div>
                <F label="Quantity"><NumIn value={l.qty} onChange={(v) => setLines(lines.map((x, j) => j === i ? { ...x, qty: v } : x))} suffix={it.unit} /></F>
                {ctx.costs ? <F label="Rate"><NumIn value={l.rate} onChange={(v) => setLines(lines.map((x, j) => j === i ? { ...x, rate: v } : x))} suffix={`₹/${it.unit}`} /></F> : <span />}
                <button className="btn btn-quiet btn-sm !px-2" aria-label="Remove line" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>
        {ctx.costs && total > 0 && <div className="mt-3 text-right text-[0.92rem]">Bill value before GST <b className="num">{rs(total)}</b> · with GST <b className="num">{rs(total * (1 + h.gstRate / 100))}</b></div>}
      </Section>
    </Drawer>
  );
}

function IssueForm({ ctx, S, item, onClose }: { ctx: Ctx; S: Stores; item: StoreItem | null; onClose: () => void }) {
  const [itemId, setItemId] = useState(item?.id ?? "");
  const [qty, setQty] = useState(0);
  const [usedFor, setUsedFor] = useState(ctx.db.settings.machines[0] ?? "");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const it = S.items.find((x) => x.id === itemId);
  const have = it ? onHand(S, it.id) : 0;
  const places = [...ctx.db.settings.machines, "Epoxy line", "Polishing line", "Cutter", ...ownMines(ctx.db), "Loader / crane", "General"];
  const save = () => {
    put(ctx, (s) => { s.moves.push({ id: uid(), itemId, date, kind: "out", qty, rate: 0, usedFor, note }); });
    ctx.say(`Issued ${n2(qty)} ${it?.unit ?? ""} ${it?.name ?? ""}`, "good");
    onClose();
  };
  return (
    <Drawer open title="Issue from store" sub="Record what goes out to a machine or line, so you know what each sq ft uses." onClose={onClose}
      footer={<><button className="btn btn-primary" disabled={!itemId || !qty || qty > have} onClick={save}>Issue</button><button className="btn btn-quiet" onClick={onClose}>Cancel</button></>}>
      <Grid>
        <F label="Item" span={2}><Sel value={itemId} onChange={setItemId} placeholder="Choose item" options={S.items.map((i) => ({ v: i.id, l: `${i.name} · ${n2(onHand(S, i.id))} ${i.unit}` }))} /></F>
        <F label="Quantity" err={it && qty > have ? `Only ${n2(have)} ${it.unit} in stock` : undefined}><NumIn value={qty} onChange={setQty} suffix={it?.unit} /></F>
        <F label="Date"><TextIn type="date" value={date} onChange={setDate} /></F>
        <F label="Used for" span={2} hint={ownMines(ctx.db).some((m) => m.toLowerCase() === usedFor.trim().toLowerCase()) ? "Issued to a mine: added to that mine’s extraction cost" : "Spread over the sq ft cut this month"}><TextIn value={usedFor} onChange={setUsedFor} list="store-places" /><datalist id="store-places">{[...new Set(places)].map((p) => <option key={p} value={p} />)}</datalist></F>
        <F label="Note" span={2}><TextIn value={note} onChange={setNote} placeholder="Block or lot no., shift, person" /></F>
      </Grid>
    </Drawer>
  );
}
