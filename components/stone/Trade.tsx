"use client";
import { useState } from "react";
import { FileUp, PackageCheck, Plus, Sparkles, Trash2 } from "lucide-react";
import { SQFT_PER_SQM, dmy, freeDaysLeft, lakh, landed, mipCheck, n0, n2, rs, today, uid } from "@/lib/stone/calc";
import { emptyBlock, emptyShipment } from "@/lib/stone/seed";
import type { Block, Container, Shipment, ShipStatus } from "@/lib/stone/types";
import type { Ctx } from "./StoneApp";
import { fileSrc } from "./files";
import { VARIETIES } from "./BlockForm";
import { Area, Badge, Drawer, F, Grid, Note, NumIn, Section, Sel, Seg, Stat, Table, TextIn, readFile, type Col } from "./ui";

const STATUS: Record<ShipStatus, string> = { booked: "Booked", sailing: "On the water", at_port: "At port / CFS", customs: "In customs", cleared: "Cleared", received: "In our stock" };
const COUNTRIES = ["Italy", "Turkey", "Greece", "Spain", "Portugal", "Brazil", "China", "Vietnam", "Iran", "Egypt", "Oman", "Croatia", "Norway", "UAE", "USA", "UK", "Saudi Arabia", "Qatar", "Bangladesh", "Nepal"];
const PORTS = ["Mundra, India", "Pipavav, India", "Nhava Sheva, India", "Kandla, India", "Hazira, India", "ICD Kanakpura, Jaipur", "ICD Bhilwara"];

export default function Trade({ ctx }: { ctx: Ctx }) {
  const { db, update } = ctx;
  const [dir, setDir] = useState<"import" | "export">((ctx.sub as "import") || "import");
  const [form, setForm] = useState<Shipment | null>(null);
  const [recv, setRecv] = useState<Shipment | null>(null);
  const rows = db.shipments.filter((s) => s.dir === dir);
  const imp = db.shipments.filter((s) => s.dir === "import");
  const open = imp.filter((s) => s.status !== "received");
  const atPort = imp.filter((s) => freeDaysLeft(s) !== null);
  const minFree = atPort.reduce((a, s) => Math.min(a, freeDaysLeft(s)!), 99);
  const fy = imp.filter((s) => s.blDate >= `${new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1}-04-01`);
  const mipBad = imp.filter((s) => mipCheck(s)?.ok === false);

  const cols: Col<Shipment>[] = [
    { key: "bl", label: "Bill of lading", render: (s) => <div><div className="font-medium">{s.blNo || "No BL yet"}</div><div className="text-[0.8rem] text-ink-3">{s.line} · {dmy(s.blDate)}</div></div>, sort: (s) => s.blDate },
    { key: "p", label: dir === "import" ? "Supplier" : "Buyer", render: (s) => <div><div>{s.partyName}</div><div className="text-[0.8rem] text-ink-3">{s.country}</div></div> },
    { key: "g", label: "Goods", render: (s) => <div><div>{s.variety}</div><div className="text-[0.8rem] text-ink-3">{s.kind === "blocks" ? `${s.pieces} blocks · ${n2(s.tonnes)} t` : `${s.pieces} slabs · ${n0(s.sqm)} m²`}</div></div> },
    { key: "r", label: "Route", render: (s) => <div><div>{s.pol.split(",")[0]} → {s.pod.split(",")[0]}</div><div className="text-[0.8rem] text-ink-3">{s.terms ?? (s.dir === "import" ? "CIF" : "FOB")} · {s.containers.length} container{s.containers.length === 1 ? "" : "s"}{s.forwarder ? ` · ${s.forwarder.split(",")[0]}` : ""}</div></div> },
    { key: "v", label: dir === "import" ? "Landed" : "FOB / CIF", align: "right", render: (s) => <div className="whitespace-nowrap"><div>{lakh(dir === "import" ? landed(s) : s.cifUsd * s.fx)}</div><div className="text-[0.8rem] text-ink-3">${n0(s.cifUsd)}</div></div>, sort: (s) => landed(s) },
    { key: "st", label: "Status", render: (s) => { const f = freeDaysLeft(s); const m = mipCheck(s); return <div className="flex flex-col items-start gap-1"><Badge tone={s.status === "received" ? "good" : s.status === "sailing" ? "info" : "warn"}>{STATUS[s.status]}</Badge>{f !== null && <Badge tone={f <= 3 ? "neg" : "warn"}>{f < 0 ? `${-f} d demurrage` : `${f} free days left`}</Badge>}{m && !m.ok && <Badge tone="neg">Below MIP</Badge>}</div>; } },
    { key: "a", label: "", render: (s) => <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>{s.dir === "import" && s.status !== "received" && ["at_port", "customs", "cleared"].includes(s.status) && <button className="btn btn-quiet btn-sm" onClick={() => setRecv(s)}><PackageCheck size={14} />Receive</button>}</div> },
  ];

  return (
    <div>
      <Guide dir={dir} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Imports not yet in stock" value={String(open.length)} sub={`${open.reduce((a, s) => a + s.containers.length, 0)} containers`} />
        <Stat label="Free days at port" value={atPort.length ? `${minFree} days` : "—"} sub={atPort.length ? `${atPort.length} shipment${atPort.length > 1 ? "s" : ""} waiting at port` : "Nothing waiting"} tone={atPort.length && minFree <= 5 ? "neg" : undefined} />
        <Stat label="Imported this year" value={lakh(fy.reduce((a, s) => a + landed(s), 0))} sub={`${fy.length} shipments, landed`} />
        <Stat label="Below minimum import price" value={String(mipBad.length)} sub="Marble blocks US$200/MT · slabs US$40/m²" tone={mipBad.length ? "neg" : "good"} />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Seg value={dir} onChange={setDir} tabs={[{ key: "import", label: "Imports", count: imp.length }, { key: "export", label: "Exports", count: db.shipments.length - imp.length }]} />
        <div className="ml-auto"><button className="btn btn-primary btn-sm" onClick={() => setForm({ ...emptyShipment(dir), pod: dir === "import" ? PORTS[0] : "", pol: dir === "export" ? PORTS[0] : "" })}><Plus size={15} />{dir === "import" ? "New import" : "New export"}</button></div>
      </div>
      <div className="mt-4"><Table rows={[...rows].reverse()} cols={cols} onRow={setForm} search={(s) => `${s.blNo} ${s.partyName} ${s.variety} ${s.containers.map((c) => c.no).join(" ")} ${s.country}`} empty={dir === "import" ? "No imports recorded." : "No exports recorded."} /></div>

      <div className="mt-8 grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl bg-surface p-5">
          <div className="font-semibold">Upload the BL, we read it</div>
          <p className="mt-1.5 text-[0.9rem] text-ink-2">Drop the bill of lading PDF or a phone photo into any shipment. The BL number, vessel, ports, containers, seals and weights are filled in for you to check.</p>
        </div>
        <div className="rounded-2xl bg-surface p-5">
          <div className="font-semibold">Can BLs come in from our GSTIN?</div>
          <p className="mt-1.5 text-[0.9rem] text-ink-2">There is no free government API that returns your bills of lading from a company name or GSTIN. ICEGATE shows your bills of entry after you log in; paid trade-data services sell shipment records.</p>
        </div>
        <div className="rounded-2xl bg-surface p-5">
          <div className="font-semibold">Live container tracking</div>
          <p className="mt-1.5 text-[0.9rem] text-ink-2">With a BL or container number, tracking services such as ShipsGo or Searates give vessel position and ETA through an API. We can connect one with your account key.</p>
        </div>
      </div>

      {form && <ShipmentForm initial={form} onClose={() => setForm(null)} onSave={(s) => { update((d) => { const i = d.shipments.findIndex((x) => x.id === s.id); if (i >= 0) d.shipments[i] = s; else d.shipments.push(s); }); setForm(null); }} onDelete={(id) => { update((d) => { d.shipments = d.shipments.filter((x) => x.id !== id); }); setForm(null); }} />}
      {recv && <ReceiveShipment ctx={ctx} s={recv} onClose={() => setRecv(null)} />}
    </div>
  );
}

const STEPS: Record<"import" | "export", [string, string][]> = {
  import: [
    ["Add the order", "Click New import as soon as you confirm the order. Enter the supplier, country, stone, number of blocks or slabs, and the terms: FOB or CIF."],
    ["Book the ship (FOB only)", "On FOB, the supplier only loads the goods at their port. You book the ship through a forwarder. Enter the forwarder, booking no., ocean freight and insurance. The CIF value is worked out for you."],
    ["Upload the BL", "When the supplier sends the bill of lading, upload the PDF or a phone photo. The BL no., vessel, ports, containers and weights fill in. Check them and save."],
    ["Watch it sail", "Set the status to On the water and add the ETA. When it reaches the port, enter the arrival date. Free days count down on the dashboard so you clear before demurrage starts."],
    ["Clear customs", "Your CHA files the bill of entry. Enter its no., the duty and IGST paid, CHA charges, port charges and freight to your yard. Landed cost and the minimum import price check update as you type."],
    ["Receive into stock", "Click Receive. Blocks: measure each one; landed cost is shared by volume. Slabs: they go to the depot as a lot with cost per sq ft. From here they are in your yard, unit or slab stock."],
  ],
  export: [
    ["Add the order", "Click New export. Enter the buyer, country, stone and quantity, and the terms: FOB (the buyer books the ship) or CIF (you book it)."],
    ["Book the ship (CIF only)", "On CIF, book through your forwarder and enter the booking no., ocean freight and insurance. The invoice value becomes FOB + freight + insurance."],
    ["Shipping bill and loading", "Your CHA files the shipping bill. Enter its no. and date. Add each container and seal as it is stuffed."],
    ["Upload the BL", "Upload the bill of lading from the line. It fills in the vessel, ports and containers. Send a copy to the buyer."],
    ["Track until delivered", "Keep the status and ETA current. The export invoice is made under Sales and invoices, on the international customer."],
  ],
};

/** Step-by-step help, open the first time, remembered after that. */
function Guide({ dir }: { dir: "import" | "export" }) {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem("k360-trade-guide") !== "closed"; } catch { return true; } });
  const toggle = () => { const n = !open; setOpen(n); try { localStorage.setItem("k360-trade-guide", n ? "open" : "closed"); } catch {} };
  const steps = STEPS[dir];
  return (
    <div className="mb-6 rounded-[22px] bg-surface p-5">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center justify-between gap-3 text-left">
        <span><span className="block font-semibold">How {dir === "import" ? "imports" : "exports"} work here</span><span className="block text-[0.86rem] text-ink-2">{steps.length} steps, from order to stock</span></span>
        <span className="btn btn-quiet btn-sm">{open ? "Hide" : "Show steps"}</span>
      </button>
      {open && (
        <ol className="mt-5 grid gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
          {steps.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-[0.82rem] font-semibold text-accent-ink">{i + 1}</span>
              <span><span className="block font-medium">{t}</span><span className="mt-0.5 block text-[0.86rem] leading-relaxed text-ink-2">{d}</span></span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ShipmentForm({ initial, onSave, onDelete, onClose }: { initial: Shipment; onSave: (s: Shipment) => void; onDelete: (id: string) => void; onClose: () => void }) {
  const [s, setS] = useState<Shipment>(structuredClone(initial));
  const [ai, setAi] = useState<{ busy: boolean; msg: string; tone?: "good" | "warn" | "neg" }>({ busy: false, msg: "" });
  const set = <K extends keyof Shipment>(k: K, v: Shipment[K]) => setS((x) => ({ ...x, [k]: v }));
  const imp = s.dir === "import";
  const terms = s.terms ?? (imp ? "CIF" : "FOB");
  const weBook = (imp && terms === "FOB") || (!imp && terms === "CIF");
  const setVal = (p: Partial<Shipment>) => setS((x) => { const n = { ...x, ...p }; n.cifUsd = (n.fobUsd ?? 0) + (n.freightUsd ?? 0) + (n.insuranceUsd ?? 0); return n; });
  const setTerms = (t: "FOB" | "CIF") => setS((x) => {
    const book = (imp && t === "FOB") || (!imp && t === "CIF");
    // Switching to a booking we make: start the FOB value from what was entered so far.
    if (book && !x.fobUsd && !x.freightUsd) return { ...x, terms: t, fobUsd: x.cifUsd, freightUsd: 0, insuranceUsd: 0 };
    return { ...x, terms: t };
  });
  const mip = mipCheck(s);
  const L = landed(s);

  const upload = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) return setAi({ busy: false, msg: "That file is over 4 MB. Upload a smaller scan or a phone photo.", tone: "warn" });
    const data = await readFile(f);
    setS((x) => ({ ...x, blFile: { name: f.name, data: f.size < 1.2 * 1024 * 1024 ? data : "" } }));
    setAi({ busy: true, msg: "Reading the bill of lading…" });
    try {
      const res = await fetch("/api/bl", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data, name: f.name }) });
      const j = await res.json();
      if (!j.ok) return setAi({ busy: false, msg: j.error ?? "Couldn't read this file. Fill the details by hand.", tone: "warn" });
      const r = j.fields as Partial<Shipment> & { containers?: Container[] };
      setS((x) => {
        const n = { ...x };
        (["blNo", "blDate", "line", "vessel", "voyage", "pol", "pod", "partyName", "country", "variety"] as const).forEach((k) => { if (r[k]) (n as Record<string, unknown>)[k] = r[k]; });
        (["pieces", "tonnes", "cbm", "sqm"] as const).forEach((k) => { if (r[k]) n[k] = Number(r[k]) || n[k]; });
        if (r.kind === "blocks" || r.kind === "slabs") n.kind = r.kind;
        if (r.containers?.length) n.containers = r.containers.map((c) => ({ no: c.no ?? "", seal: c.seal ?? "", size: c.size ?? "", grossKg: Number(c.grossKg) || 0 }));
        return n;
      });
      setAi({ busy: false, msg: "Filled from the BL. Check each field against the document before saving.", tone: "good" });
    } catch {
      setAi({ busy: false, msg: "Couldn't reach the reader. Fill the details by hand.", tone: "warn" });
    }
  };

  const setC = (i: number, k: keyof Container, v: string | number) => setS((x) => ({ ...x, containers: x.containers.map((c, j) => (j === i ? { ...c, [k]: v } : c)) }));

  return (
    <Drawer open wide title={initial.id ? `${imp ? "Import" : "Export"} ${initial.blNo || initial.variety}` : imp ? "New import shipment" : "New export shipment"} sub={imp ? "Blocks or slabs coming in. Landed cost flows to the blocks when you receive them." : "Slabs or blocks going out."} onClose={onClose}
      footer={<><button className="btn btn-primary" onClick={() => onSave({ ...s, id: s.id || uid() })}>Save</button><button className="btn btn-quiet" onClick={onClose}>Cancel</button>{initial.id && s.status !== "received" && <button className="btn btn-quiet btn-sm ml-auto !text-neg" onClick={() => onDelete(initial.id)}>Delete</button>}</>}>
      <Section title="Bill of lading">
        <label className={`flex cursor-pointer flex-wrap items-center gap-3 rounded-2xl border-2 border-dashed border-surface-3 bg-surface px-4 py-4 transition-colors hover:border-accent ${ai.busy ? "opacity-60" : ""}`}>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-accent">{ai.busy ? <Sparkles size={18} className="live-dot" /> : <FileUp size={18} />}</span>
          <span>
            <span className="block font-medium">{s.blFile ? s.blFile.name : "Upload BL (PDF or photo)"}</span>
            <span className="block text-[0.82rem] text-ink-3">We read BL no., vessel, ports, containers and weights from it.</span>
          </span>
          {s.blFile?.data && <a href={fileSrc(s.blFile.data)} download={s.blFile.name} onClick={(e) => e.stopPropagation()} className="btn btn-quiet btn-sm ml-auto">Open file</a>}
          <input type="file" accept="application/pdf,image/*" className="sr-only" disabled={ai.busy} onChange={(e) => upload(e.target.files?.[0])} />
        </label>
        {ai.msg && <div className="mt-2"><Note tone={ai.tone ?? "plain"}>{ai.msg}</Note></div>}
        <div className="mt-4"><Grid cols={3}>
          <F label="BL no."><TextIn value={s.blNo} onChange={(v) => set("blNo", v)} upper /></F>
          <F label="BL date"><TextIn type="date" value={s.blDate} onChange={(v) => set("blDate", v)} /></F>
          <F label="Shipping line"><TextIn value={s.line} onChange={(v) => set("line", v)} list="lines" /><datalist id="lines">{["MSC", "Maersk", "CMA CGM", "Hapag-Lloyd", "ONE", "Evergreen", "COSCO", "Yang Ming", "ZIM", "HMM"].map((l) => <option key={l} value={l} />)}</datalist></F>
          <F label="Vessel"><TextIn value={s.vessel} onChange={(v) => set("vessel", v)} /></F>
          <F label="Voyage"><TextIn value={s.voyage} onChange={(v) => set("voyage", v)} upper /></F>
          <F label="Status"><Sel value={s.status} onChange={(v) => set("status", v as ShipStatus)} options={(Object.keys(STATUS) as ShipStatus[]).map((k) => ({ v: k, l: STATUS[k] }))} /></F>
          <F label="Port of loading"><TextIn value={s.pol} onChange={(v) => set("pol", v)} list="ports" /></F>
          <F label="Port of discharge"><TextIn value={s.pod} onChange={(v) => set("pod", v)} list="ports" /><datalist id="ports">{PORTS.map((p) => <option key={p} value={p} />)}</datalist></F>
          <F label="ETA"><TextIn type="date" value={s.eta} onChange={(v) => set("eta", v)} /></F>
        </Grid></div>
      </Section>

      <Section title="Goods">
        <Grid cols={3}>
          <F label={imp ? "Overseas supplier" : "Buyer"} span={2}><TextIn value={s.partyName} onChange={(v) => set("partyName", v)} /></F>
          <F label="Country"><TextIn value={s.country} onChange={(v) => set("country", v)} list="countries" /><datalist id="countries">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist></F>
          <F label="Variety"><TextIn value={s.variety} onChange={(v) => set("variety", v)} list="ship-var" /><datalist id="ship-var">{VARIETIES.map((v) => <option key={v} value={v} />)}</datalist></F>
          <F label="Stone"><Sel value={s.stoneType} onChange={(v) => set("stoneType", v as Shipment["stoneType"])} options={["marble", "granite", "quartzite", "onyx", "sandstone", "other"].map((v) => ({ v, l: v[0].toUpperCase() + v.slice(1) }))} /></F>
          <F label="Form"><Sel value={s.kind} onChange={(v) => set("kind", v as Shipment["kind"])} options={[{ v: "blocks", l: "Blocks" }, { v: "slabs", l: "Slabs" }]} /></F>
          <F label={s.kind === "blocks" ? "No. of blocks" : "No. of slabs"}><NumIn value={s.pieces} onChange={(v) => set("pieces", v)} /></F>
          <F label="Weight"><NumIn value={s.tonnes} onChange={(v) => set("tonnes", v)} suffix="MT" /></F>
          {s.kind === "blocks" ? <F label="Volume"><NumIn value={s.cbm} onChange={(v) => set("cbm", v)} suffix="CBM" /></F> : <F label="Area" hint={s.sqm ? `${n0(s.sqm * SQFT_PER_SQM)} sq ft` : undefined}><NumIn value={s.sqm} onChange={(v) => set("sqm", v)} suffix="m²" /></F>}
          {s.kind === "slabs" && <F label="Thickness"><NumIn value={s.thicknessMm} onChange={(v) => set("thicknessMm", v)} suffix="mm" /></F>}
        </Grid>
      </Section>

      <Section title="Containers" aside={<button className="btn btn-quiet btn-sm" onClick={() => set("containers", [...s.containers, { no: "", seal: "", size: "20' open top", grossKg: 0 }])}><Plus size={14} />Container</button>}>
        {!s.containers.length && <p className="text-sm text-ink-3">No containers yet.</p>}
        <div className="space-y-2">
          {s.containers.map((c, i) => (
            <div key={i} className="grid items-end gap-2 rounded-xl bg-surface p-3 sm:grid-cols-[1.3fr_1fr_1fr_1fr_auto]">
              <F label="Container no."><TextIn value={c.no} onChange={(v) => setC(i, "no", v)} upper /></F>
              <F label="Seal"><TextIn value={c.seal} onChange={(v) => setC(i, "seal", v)} upper /></F>
              <F label="Type"><Sel value={c.size} onChange={(v) => setC(i, "size", v)} options={["20' open top", "20' standard", "40' standard", "40' high cube", "20' flat rack", "40' flat rack"].map((v) => ({ v, l: v }))} /></F>
              <F label="Gross"><NumIn value={c.grossKg} onChange={(v) => setC(i, "grossKg", v)} suffix="kg" /></F>
              <button className="btn btn-quiet btn-sm !px-2" aria-label="Remove container" onClick={() => set("containers", s.containers.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Trade terms and freight">
        <div className="flex flex-wrap items-center gap-3">
          <Seg value={terms} onChange={(v) => setTerms(v)} tabs={[{ key: "FOB", label: "FOB" }, { key: "CIF", label: "CIF" }]} />
          <span className="text-[0.86rem] text-ink-2">{weBook ? (imp ? "FOB: the supplier loads it on the ship at their port. You book the ship and pay freight and insurance." : "CIF: you book the ship and pay freight and insurance up to the buyer’s port.") : imp ? "CIF: the supplier books the ship and pays freight and insurance up to your port." : "FOB: your job ends once the goods are on the ship at the Indian port. The buyer books the ship."}</span>
        </div>
        {weBook && (
          <div className="mt-4 rounded-2xl bg-surface p-4">
            <div className="font-medium">{imp ? "Your freight booking" : "Freight you book for the buyer"}</div>
            <div className="mt-3"><Grid cols={3}>
              <F label="Forwarder or shipping line"><TextIn value={s.forwarder ?? ""} onChange={(v) => set("forwarder", v)} list="forwarders" placeholder="Seahorse Shipping, Ahmedabad" /><datalist id="forwarders">{["Seahorse Shipping & Logistics, Ahmedabad", "Allcargo Logistics, Mumbai", "JM Baxi Freight, Mundra", "Transworld Logistics", "DP World Cargo Services"].map((f) => <option key={f} value={f} />)}</datalist></F>
              <F label="Booking no."><TextIn value={s.bookingNo ?? ""} onChange={(v) => set("bookingNo", v)} upper /></F>
              <F label="Shipping line"><TextIn value={s.line} onChange={(v) => set("line", v)} list="lines" /></F>
              <F label={imp ? "FOB value (supplier invoice)" : "FOB value"}><NumIn value={s.fobUsd ?? 0} onChange={(v) => setVal({ fobUsd: v })} suffix="US$" /></F>
              <F label="Ocean freight" hint="All containers, as quoted by the forwarder"><NumIn value={s.freightUsd ?? 0} onChange={(v) => setVal({ freightUsd: v })} suffix="US$" /></F>
              <F label="Marine insurance" hint={<button type="button" className="underline" onClick={() => setVal({ insuranceUsd: Math.round((s.fobUsd ?? 0) * 0.01125) })}>Use 1.125% of FOB, as customs does when there is no policy</button>}><NumIn value={s.insuranceUsd ?? 0} onChange={(v) => setVal({ insuranceUsd: v })} suffix="US$" /></F>
            </Grid></div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[0.9rem]">
              <span>CIF value <b className="num">${n0(s.cifUsd)}</b> = FOB + freight + insurance</span>
              <span className="text-ink-2">{rs(s.cifUsd * s.fx)} at {s.fx} ₹/$</span>
              {imp && <span className="text-ink-2">Customs charges duty on this CIF value</span>}
            </div>
          </div>
        )}
      </Section>

      <Section title={imp ? "Value, customs & clearing" : "Value & shipping bill"}>
        <Grid cols={3}>
          {weBook ? <F label={imp ? "CIF value" : "Invoice value (CIF)"} hint="From the freight booking above"><div className="field num">US$ {n0(s.cifUsd)}</div></F> : <F label={imp ? "CIF value" : "Invoice value (FOB)"}><NumIn value={s.cifUsd} onChange={(v) => set("cifUsd", v)} suffix="US$" /></F>}
          <F label="Exchange rate" hint={`= ${rs(s.cifUsd * s.fx)}`}><NumIn value={s.fx} onChange={(v) => set("fx", v)} suffix="₹/$" /></F>
          <F label={imp ? "Bill of entry no." : "Shipping bill no."}><TextIn value={s.beNo} onChange={(v) => set("beNo", v)} upper /></F>
          <F label={imp ? "BE date" : "SB date"}><TextIn type="date" value={s.beDate} onChange={(v) => set("beDate", v)} /></F>
          {imp && <>
            <F label="Customs duty paid" hint="BCD + cess from the bill of entry"><NumIn value={s.duty} onChange={(v) => set("duty", v)} suffix="₹" /></F>
            <F label="IGST paid" hint="Claimed back as input credit"><NumIn value={s.igst} onChange={(v) => set("igst", v)} suffix="₹" /></F>
            <F label="CHA charges"><NumIn value={s.cha} onChange={(v) => set("cha", v)} suffix="₹" /></F>
            <F label="Port, CFS & line charges"><NumIn value={s.port} onChange={(v) => set("port", v)} suffix="₹" /></F>
            <F label="Port to Kishangarh freight"><NumIn value={s.inland} onChange={(v) => set("inland", v)} suffix="₹" /></F>
            <F label="Arrived at port"><TextIn type="date" value={s.arrived} onChange={(v) => set("arrived", v)} /></F>
            <F label="Free days"><NumIn value={s.freeDays} onChange={(v) => set("freeDays", v)} suffix="days" /></F>
          </>}
        </Grid>
        {imp && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-surface p-4"><div className="text-sm text-ink-2">Landed cost</div><div className="num mt-1 text-xl font-semibold">{rs(L)}</div><div className="text-[0.8rem] text-ink-3">IGST excluded (input credit)</div></div>
            <div className="rounded-2xl bg-surface p-4"><div className="text-sm text-ink-2">{s.kind === "blocks" ? "Per tonne · per CBM" : "Per sq ft"}</div><div className="num mt-1 text-xl font-semibold">{s.kind === "blocks" ? `${s.tonnes ? rs(L / s.tonnes) : "—"} · ${s.cbm ? rs(L / s.cbm) : "—"}` : s.sqm ? rs(L / (s.sqm * SQFT_PER_SQM)) : "—"}</div></div>
            <div className={`rounded-2xl p-4 ${mip ? (mip.ok ? "bg-accent-soft" : "bg-neg-soft") : "bg-surface"}`}><div className="text-sm text-ink-2">Minimum import price</div><div className="num mt-1 text-xl font-semibold">{mip ? `$${n0(mip.value)} / ${mip.unit.split("/")[1]}` : "Not applicable"}</div><div className="text-[0.8rem] text-ink-2">{mip ? (mip.ok ? `Clears the ${mip.floor} ${mip.unit} floor` : `Below the ${mip.floor} ${mip.unit} floor; customs can hold it`) : "Applies to marble"}</div></div>
          </div>
        )}
      </Section>
      <Section title="Notes"><Area value={s.notes} onChange={(v) => set("notes", v)} /></Section>
    </Drawer>
  );
}

function ReceiveShipment({ ctx, s, onClose }: { ctx: Ctx; s: Shipment; onClose: () => void }) {
  const { db, update } = ctx;
  const L = landed(s);
  const n = Math.max(1, s.pieces || 1);
  const [rows, setRows] = useState(() => Array.from({ length: s.kind === "blocks" ? n : 0 }, (_, i) => ({ no: `${s.variety.slice(0, 2).toUpperCase()}-${s.blNo.slice(-4)}-${i + 1}`, l: 0, w: 0, h: 0, t: s.tonnes ? Math.round((s.tonnes / n) * 100) / 100 : 0 })));
  const [loc, setLoc] = useState("Depot A-frame 1");
  const [list, setList] = useState(0);
  const vol = rows.reduce((a, r) => a + (r.l * r.w * r.h) / 1e6, 0);
  const tot = rows.reduce((a, r) => a + r.t, 0);
  const share = (r: (typeof rows)[number]) => (vol > 0 ? (L * ((r.l * r.w * r.h) / 1e6)) / vol : tot > 0 ? (L * r.t) / tot : L / rows.length);

  const save = () => {
    update((d) => {
      const sh = d.shipments.find((x) => x.id === s.id)!;
      if (s.kind === "blocks") {
        for (const r of rows) {
          const b: Block = { ...emptyBlock(), id: uid(), no: r.no, variety: s.variety, stoneType: s.stoneType, source: "import", shipmentId: s.id, mine: s.country, date: today(), l: r.l, w: r.w, h: r.h, tonnes: r.t, billedTonnes: r.t, rateBasis: "cbm", importCost: Math.round(share(r)), status: "in_yard", receivedOn: today(), vehicleNo: "" };
          d.blocks.push(b);
          sh.receivedIds.push(b.id);
        }
      } else {
        const sqft = Math.round(s.sqm * SQFT_PER_SQM);
        const id = uid();
        d.lots.push({ id, lotNo: `L-${100 + d.lots.length + 1}`, blockId: "", shipmentId: s.id, variety: s.variety, stoneType: s.stoneType, thicknessMm: s.thicknessMm, finish: "Polished", grade: "A", pieces: s.pieces, sqft, available: sqft, cost: Math.round(L), listRate: list, site: "depot", location: loc, createdAt: today() });
        sh.receivedIds.push(id);
      }
      sh.status = "received";
    });
    onClose();
  };

  return (
    <Drawer open wide title={`Receive ${s.variety} into stock`} sub={`BL ${s.blNo} · landed ${rs(L)}`} onClose={onClose}
      footer={<><button className="btn btn-primary" onClick={save}>{s.kind === "blocks" ? `Add ${rows.length} blocks to the yard` : "Add slabs to depot"}</button><button className="btn btn-quiet" onClick={onClose}>Cancel</button></>}>
      {s.kind === "blocks" ? (
        <>
          <Note>Measure each block at the yard. Landed cost is shared by volume, so a bigger block carries more of the freight and duty.</Note>
          <div className="mt-4 space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid items-end gap-2 rounded-xl bg-surface p-3 sm:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))_1fr]">
                <F label="Block no."><TextIn value={r.no} onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, no: v } : x)))} upper /></F>
                {(["l", "w", "h"] as const).map((k) => <F key={k} label={k.toUpperCase() + " cm"}><NumIn value={r[k]} onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, [k]: v } : x)))} /></F>)}
                <F label="Tonnes"><NumIn value={r.t} onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, t: v } : x)))} /></F>
                <div className="pb-2 text-right text-sm"><div className="text-ink-3">Cost</div><div className="num font-medium">{rs(share(r))}</div></div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <Grid cols={3}>
          <F label="Area"><div className="field num">{n0(s.sqm * SQFT_PER_SQM)} sq ft</div></F>
          <F label="Cost per sq ft"><div className="field num">{s.sqm ? rs(L / (s.sqm * SQFT_PER_SQM)) : "—"}</div></F>
          <F label="List price"><NumIn value={list} onChange={setList} suffix="₹/sq ft" /></F>
          <F label="Depot rack / A-frame" span={3}><TextIn value={loc} onChange={setLoc} /></F>
        </Grid>
      )}
      {db.settings && null}
    </Drawer>
  );
}
