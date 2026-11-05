"use client";
import { useMemo, useState } from "react";
import { ArrowRightLeft, Camera, Trash2 } from "lucide-react";
import { baseCost, cbm, mineMonth, months, n2, purchaseValue, rs, today, uid, weightCheck } from "@/lib/stone/calc";
import { emptyBlock } from "@/lib/stone/seed";
import { ownMines, qualities } from "@/lib/stone/costing";
import type { Block, BlockStatus, StoneDB } from "@/lib/stone/types";
import { Area, Drawer, F, Grid, Note, NumIn, Section, Sel, TextIn, readPhoto } from "./ui";
import { fileSrc } from "./files";

export const STATUS_LABEL: Record<BlockStatus, string> = {
  at_mine: "At mine",
  in_transit: "On the road",
  in_yard: "In block yard",
  on_saw: "On saw",
  sawn: "Sawn into slabs",
  sold: "Sold as block",
  rejected: "Rejected / written off",
};

export const VARIETIES = [
  "Makrana Albeta", "Makrana Kumari", "Makrana Dungri", "Morwad White", "Rajnagar White", "Agariya White", "Banswara White",
  "Udaipur Green", "Rajsamand Pink", "Ambaji White", "Indian Statuario", "Toronto Brown", "Jalore Rosy Pink", "Lakha Red",
  "Kota Stone", "Burdur Beige", "Volakas White", "Carrara White", "Botticino Classico", "Emperador Dark",
];

export type BlockMode = "own" | "purchase" | "import" | "receive" | "edit";

export default function BlockForm({ db, initial, mode, onSave, onDelete, onClose, costs = true, onTransfer }: {
  costs?: boolean;
  onTransfer?: () => void;
  db: StoneDB;
  initial: Block | null;
  mode: BlockMode;
  onSave: (b: Block) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}) {
  const S = db.settings;
  const mines = ownMines(db);
  const lastMineRate = useMemo(() => {
    const ms = months(db).reverse();
    for (const m of ms) {
      const x = mineMonth(db, null, m);
      if (x.perTonne) return Math.round(x.perTonne);
    }
    return 0;
  }, [db]);

  const [b, setB] = useState<Block>(() => {
    if (initial) return structuredClone(initial);
    const e = emptyBlock();
    e.date = today();
    if (mode === "import") {
      e.source = "import";
      e.status = "in_yard";
      e.rateBasis = "cbm";
      e.receivedOn = today();
    } else if (mode === "own") {
      e.source = "own_mine";
      e.mine = mines[0] ?? "";
      e.status = "at_mine";
      e.rate = lastMineRate;
    } else {
      e.status = "in_transit";
    }
    return e;
  });
  const set = <K extends keyof Block>(k: K, v: Block[K]) => setB((x) => ({ ...x, [k]: v }));
  const [err, setErr] = useState("");

  const vol = cbm(b);
  const estT = vol * S.density;
  const wc = weightCheck(b);
  const suggestRoyalty = Math.round((b.billedTonnes || b.tonnes || estT) * S.royaltyPerTonne);
  const total = baseCost(b) + b.damageAlloc;
  const suppliers = db.parties.filter((p) => p.kind === "supplier");
  const transporters = db.parties.filter((p) => p.kind === "transporter");
  const dup = db.blocks.find((x) => x.no.trim().toLowerCase() === b.no.trim().toLowerCase() && x.id !== b.id && b.no.trim());

  const save = () => {
    if (!b.no.trim()) return setErr("Enter the block number painted on the block.");
    if (!b.variety.trim()) return setErr("Pick or type the stone quality.");
    if (dup) return setErr(`Block ${b.no} is already in your register.`);
    const out = { ...b, id: b.id || uid() };
    if (!out.receivedOn && (out.status === "in_yard" || out.status === "on_saw")) out.receivedOn = today();
    onSave(out);
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const urls: string[] = [];
    for (const f of Array.from(files).slice(0, 4)) {
      try { urls.push(await readPhoto(f)); } catch {}
    }
    setB((x) => ({ ...x, photos: [...x.photos, ...urls].slice(0, 6) }));
  };

  const title = initial ? `Block ${initial.no}` : mode === "own" ? "New block from own quarry" : mode === "import" ? "Imported block" : mode === "receive" ? "Block arriving at the unit" : "Bought block";
  const isOwn = b.source === "own_mine";

  return (
    <Drawer open title={title} sub={initial ? `${initial.variety} · ${STATUS_LABEL[initial.status]}` : "Fields marked * are needed. Everything else can be filled later."} onClose={onClose}
      footer={<>
        <button className="btn btn-primary" onClick={save}>{initial ? "Save changes" : "Add block"}</button>
        <button className="btn btn-quiet" onClick={onClose}>Cancel</button>
        {err && <span className="text-sm text-neg">{err}</span>}
        {initial && onTransfer && <button className="btn btn-quiet btn-sm ml-auto" onClick={onTransfer}><ArrowRightLeft size={14} />Send to firm</button>}
        {initial && onDelete && <button className={`btn btn-quiet btn-sm !text-neg ${onTransfer ? "" : "ml-auto"}`} onClick={() => onDelete(initial.id)}><Trash2 size={14} />Delete</button>}
      </>}>
      <Section title="Block">
        <Grid cols={3}>
          <F label="Block no. *" err={dup ? "Already in register" : undefined}><TextIn value={b.no} onChange={(v) => set("no", v)} upper placeholder="e.g. MW-233" /></F>
          <F label="Quality *" span={2}>
            <TextIn value={b.variety} onChange={(v) => set("variety", v)} list="stone-varieties" placeholder="Makrana Albeta" />
            <datalist id="stone-varieties">{[...new Set([...qualities(db), ...VARIETIES])].map((v) => <option key={v} value={v} />)}</datalist>
          </F>
          <F label="Stone"><Sel value={b.stoneType} onChange={(v) => set("stoneType", v as Block["stoneType"])} options={["marble", "granite", "sandstone", "quartzite", "onyx", "other"].map((v) => ({ v, l: v[0].toUpperCase() + v.slice(1) }))} /></F>
          <F label="Grade"><Sel value={b.grade} onChange={(v) => set("grade", v as Block["grade"])} options={["A", "B", "C", "Commercial"].map((v) => ({ v, l: v }))} /></F>
          <F label="Source"><Sel value={b.source} onChange={(v) => set("source", v as Block["source"])} options={[{ v: "own_mine", l: "Own quarry" }, { v: "purchase", l: "Bought from mine owner" }, { v: "import", l: "Imported" }]} /></F>
          <F label="Quarry / mine" span={2}>
            {isOwn ? <Sel value={b.mine} onChange={(v) => set("mine", v)} options={mines.map((m) => ({ v: m, l: m }))} /> : <TextIn value={b.mine} onChange={(v) => set("mine", v)} placeholder="e.g. Ulodi quarry, Makrana" />}
          </F>
          <F label="Lease / quarry licence no."><TextIn value={b.leaseNo} onChange={(v) => set("leaseNo", v)} upper placeholder="ML 41/2009" /></F>
        </Grid>
      </Section>

      {!isOwn && b.source !== "import" && (
        <Section title="Supplier & bill">
          <Grid cols={3}>
            <F label="Supplier" span={2}><Sel value={b.supplierId} onChange={(v) => set("supplierId", v)} placeholder="Choose mine owner / trader" options={suppliers.map((p) => ({ v: p.id, l: `${p.company} · ${p.city}` }))} /></F>
            <F label="Bill / invoice no."><TextIn value={b.invoiceNo} onChange={(v) => set("invoiceNo", v)} upper /></F>
            {costs && <F label="Rate"><NumIn value={b.rate} onChange={(v) => set("rate", v)} suffix={b.rateBasis === "cbm" ? "₹/CBM" : "₹/t"} /></F>}
            {costs && <F label="Billed on"><Sel value={b.rateBasis} onChange={(v) => set("rateBasis", v as Block["rateBasis"])} options={[{ v: "tonne", l: "Per tonne" }, { v: "cbm", l: "Per CBM" }]} /></F>}
            <F label="Billed weight"><NumIn value={b.billedTonnes} onChange={(v) => set("billedTonnes", v)} suffix="t" /></F>
          </Grid>
        </Section>
      )}
      {b.source === "import" && (
        <Section title="Import">
          <Grid cols={3}>
            <F label="Shipment" span={2}><Sel value={b.shipmentId} onChange={(v) => { const sh = db.shipments.find((x) => x.id === v); setB((x) => ({ ...x, shipmentId: v, mine: x.mine || (sh ? `${sh.partyName}, ${sh.country}` : ""), variety: x.variety || sh?.variety || "" })); }} placeholder="Not linked to a shipment" options={db.shipments.filter((x) => x.dir === "import" && x.kind === "blocks").map((x) => ({ v: x.id, l: `${x.partyName} · ${x.variety} · BL ${x.blNo || "pending"}` }))} /></F>
            {costs && <F label="Landed cost of this block" hint="Its share of CIF, duty, CHA, port and freight to your yard"><NumIn value={b.importCost} onChange={(v) => set("importCost", v)} suffix="₹" /></F>}
          </Grid>
        </Section>
      )}
      {isOwn && costs && (
        <Section title="Extraction cost">
          <Grid cols={3}>
            <F label="Cost per tonne" hint={lastMineRate ? `Latest month at the quarry: ${rs(lastMineRate)}/t` : "Log quarry costs to calculate this"}><NumIn value={b.rate} onChange={(v) => set("rate", v)} suffix="₹/t" /></F>
          </Grid>
        </Section>
      )}

      <Section title="Size & weight">
        <Grid cols={3}>
          <F label="Length"><NumIn value={b.l} onChange={(v) => set("l", v)} suffix="cm" /></F>
          <F label="Width"><NumIn value={b.w} onChange={(v) => set("w", v)} suffix="cm" /></F>
          <F label="Height"><NumIn value={b.h} onChange={(v) => set("h", v)} suffix="cm" /></F>
          <F label="Weighbridge net" hint={vol ? `${n2(vol)} CBM ≈ ${n2(estT)} t at ${S.density} t/m³` : "Net weight at your gate"}><NumIn value={b.tonnes} onChange={(v) => set("tonnes", v)} suffix="t" /></F>
          <F label="Weighbridge slip no."><TextIn value={b.weighSlip} onChange={(v) => set("weighSlip", v)} upper /></F>
          {isOwn && <F label="Weight on rawanna"><NumIn value={b.billedTonnes} onChange={(v) => set("billedTonnes", v)} suffix="t" /></F>}
        </Grid>
        {wc?.flag && <div className="mt-3"><Note tone="neg">Supplier quoted {n2(b.billedTonnes)} t but the gate weighed {n2(b.tonnes)} t: {(Math.abs(wc.pct) * 100).toFixed(1)}% {wc.flag === "short" ? "short" : "more"}, outside ±5%{wc.flag === "short" && costs ? `, about ${rs(-wc.diff * b.rate)} at this rate. Raise a debit note with the supplier` : ""}.</Note></div>}
      </Section>

      {b.source !== "import" && (
        <Section title="Royalty & papers">
          <Grid cols={3}>
            <F label="e-Rawanna no." hint="Must travel with the vehicle"><TextIn value={b.eRawanna} onChange={(v) => set("eRawanna", v)} upper placeholder="ER…" /></F>
            {costs && <F label="Royalty paid" hint={<button type="button" className="underline" onClick={() => { set("royalty", suggestRoyalty); set("dmft", Math.round((suggestRoyalty * S.dmftPct) / 100)); }}>Use {rs(suggestRoyalty)} ({rs(S.royaltyPerTonne)}/t)</button>}><NumIn value={b.royalty} onChange={(v) => set("royalty", v)} suffix="₹" /></F>}
            {costs && <F label={`DMFT (${S.dmftPct}% of royalty)`}><NumIn value={b.dmft} onChange={(v) => set("dmft", v)} suffix="₹" /></F>}
            <F label="e-Way bill no."><TextIn value={b.ewayBill} onChange={(v) => set("ewayBill", v)} /></F>
            <F label="Dispatch date"><TextIn type="date" value={b.date} onChange={(v) => set("date", v)} /></F>
          </Grid>
          {!b.eRawanna && b.status !== "at_mine" && <div className="mt-3"><Note tone="neg">No rawanna number. A vehicle stopped at a check-post without a valid rawanna can be asked to pay up to ten times the royalty, and the stone can be seized.</Note></div>}
        </Section>
      )}

      <Section title="Transport">
        <Grid cols={3}>
          <F label="Vehicle no."><TextIn value={b.vehicleNo} onChange={(v) => set("vehicleNo", v)} upper placeholder="RJ 30 GA 4417" /></F>
          <F label="Driver"><TextIn value={b.driver} onChange={(v) => set("driver", v)} /></F>
          <F label="Driver mobile"><TextIn type="tel" value={b.driverPhone} onChange={(v) => set("driverPhone", v)} /></F>
          <F label="Transporter" span={3}><Sel value={b.transporterId} onChange={(v) => set("transporterId", v)} placeholder="Choose transporter" options={transporters.map((p) => ({ v: p.id, l: `${p.company} · ${p.city}` }))} /></F>
          {costs && <F label="Freight (this block)"><NumIn value={b.freight} onChange={(v) => set("freight", v)} suffix="₹" /></F>}
          {costs && <F label="Loading / crane"><NumIn value={b.loading} onChange={(v) => set("loading", v)} suffix="₹" /></F>}
          {costs && <F label="Other charges"><NumIn value={b.otherCost} onChange={(v) => set("otherCost", v)} suffix="₹" /></F>}
        </Grid>
      </Section>

      <Section title="Where it is">
        <Grid cols={3}>
          <F label="Status" span={2}><Sel value={b.status} onChange={(v) => set("status", v as BlockStatus)} options={(Object.keys(STATUS_LABEL) as BlockStatus[]).map((k) => ({ v: k, l: STATUS_LABEL[k] }))} /></F>
          <F label="Received at unit"><TextIn type="date" value={b.receivedOn} onChange={(v) => set("receivedOn", v)} /></F>
          <F label="Defects / damage" span={3}><Area value={b.defects} onChange={(v) => set("defects", v)} placeholder="Cracks, colour patches, veins, chipped corners" /></F>
          <F label="Notes" span={3}><Area value={b.notes} onChange={(v) => set("notes", v)} /></F>
        </Grid>
      </Section>

      <Section title="Photos (optional)">
        <div className="flex flex-wrap gap-2">
          {b.photos.map((p, i) => (
            <div key={i} className="group relative h-20 w-24 overflow-hidden rounded-xl bg-surface-2">
              <img src={fileSrc(p)} alt={`Block ${b.no} photo ${i + 1}`} className="h-full w-full object-cover" />
              <button className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white" aria-label="Remove photo" onClick={() => setB((x) => ({ ...x, photos: x.photos.filter((_, j) => j !== i) }))}><Trash2 size={12} /></button>
            </div>
          ))}
          {b.photos.length < 6 && (
            <label className="grid h-20 w-24 cursor-pointer place-items-center rounded-xl bg-surface-2 text-ink-2 transition-colors hover:bg-surface-3">
              <span className="flex flex-col items-center gap-1 text-xs"><Camera size={18} />Add</span>
              <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
            </label>
          )}
        </div>
      </Section>

      {costs && <Section title="Cost of this block">
        <div className="rounded-2xl bg-surface p-4 text-[0.9rem]">
          {[
            [isOwn ? "Extraction" : b.source === "import" ? "Landed import cost" : "Stone value", isOwn || b.source !== "import" ? purchaseValue(b) : b.importCost],
            ["Royalty + DMFT", b.royalty + b.dmft],
            ["Freight, loading, other", b.freight + b.loading + b.otherCost],
            ...(b.damageAlloc ? [["Share of transit damage", b.damageAlloc]] : []),
          ].map(([l, v]) => (
            <div key={l as string} className="flex justify-between py-1 text-ink-2"><span>{l}</span><span className="num text-ink">{rs(v as number)}</span></div>
          ))}
          <div className="mt-1 flex justify-between border-t border-surface-2 pt-2 font-semibold"><span>Total</span><span className="num">{rs(total)}</span></div>
          <div className="mt-1 flex justify-between text-ink-2"><span>Per tonne · per CBM</span><span className="num">{b.tonnes ? rs(total / b.tonnes) : "—"} · {vol ? rs(total / vol) : "—"}</span></div>
        </div>
      </Section>}
    </Drawer>
  );
}
