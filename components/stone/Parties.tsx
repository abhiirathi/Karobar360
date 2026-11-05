"use client";
import { useState } from "react";
import { Phone, Plus, Trash2 } from "lucide-react";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import { STATES, checkGstin, daysSince, lakh, n0, saleTotals } from "@/lib/stone/calc";
import { storesOf } from "@/lib/stone/stores";
import { emptyParty } from "@/lib/stone/seed";
import type { Party, PartyKind, StoneDB } from "@/lib/stone/types";
import type { Ctx } from "./StoneApp";
import { Area, Badge, Drawer, F, Grid, NumIn, Section, Sel, Seg, Table, TextIn, type Col } from "./ui";

const COUNTRIES = ["United Arab Emirates", "Saudi Arabia", "Qatar", "Oman", "Kuwait", "Bahrain", "Nepal", "Bangladesh", "Sri Lanka", "Maldives", "Mauritius", "United States", "United Kingdom", "Australia", "Canada", "Singapore", "Malaysia", "Vietnam", "Italy", "Turkey", "Greece", "Spain", "Egypt", "Kenya", "South Africa", "Brazil", "Portugal", "Iran", "China"];
const LABEL: Record<PartyKind, string> = { customer: "Customers", supplier: "Suppliers", vendor: "Vendors", transporter: "Transporters", quality: "Quality", mine: "Mines" };
const ONE: Record<PartyKind, string> = { customer: "customer", supplier: "supplier", vendor: "vendor", transporter: "transporter", quality: "quality", mine: "mine" };
const HINT: Record<PartyKind, string> = {
  customer: "Everyone you sell to, in India and abroad.",
  supplier: "Who you buy blocks from. Mark each one Domestic or Import; purchases follow it.",
  vendor: "Everyone else you buy from: store items, diesel, machines on hire, wire, spares, services.",
  transporter: "Every transporter, inward and outward.",
  quality: "Stone qualities you buy, cut and sell. Purchases pick from this list.",
  mine: "Your own quarries. Extracted blocks and extraction costs are entered against each one.",
};
const STONES = ["marble", "granite", "sandstone", "quartzite", "onyx", "other"] as const;

/** Where a master record is used, so it is not deleted while records point to it. */
function usedBy(db: StoneDB, p: Party) {
  const n = p.company.trim().toLowerCase();
  if (p.kind === "quality") return db.blocks.some((b) => b.variety.toLowerCase() === n) || db.lots.some((l) => l.variety.toLowerCase() === n);
  if (p.kind === "mine") return db.blocks.some((b) => b.mine.toLowerCase() === n) || db.mineCosts.some((c) => c.mine.toLowerCase() === n);
  const st = storesOf(db);
  return db.sales.some((s) => s.customerId === p.id || s.transporterId === p.id) || db.blocks.some((b) => b.supplierId === p.id || b.transporterId === p.id) || db.lots.some((l) => l.supplierId === p.id)
    || st.items.some((i) => i.vendorId === p.id) || st.moves.some((m) => m.supplierId === p.id) || db.mineCosts.some((c) => c.vendorId === p.id);
}

export default function Parties({ ctx, kind }: { ctx: Ctx; kind: PartyKind }) {
  const { db, update } = ctx;
  const [form, setForm] = useState<Party | null>(null);
  const [where, setWhere] = useState<"all" | "india" | "intl">("all");
  const can = ctx.edit("parties");
  const ofKind = db.parties.filter((p) => p.kind === kind);
  const twoWay = kind === "customer" || kind === "supplier";
  const rows = ofKind.filter((p) => !twoWay || where === "all" || (where === "intl") === !!p.intl);
  const due = (p: Party) => db.sales.filter((s) => s.customerId === p.id && !s.paid).reduce((a, s) => a + saleTotals(s, db.settings.state, p.state).total, 0);
  const late = (p: Party) => db.sales.some((s) => s.customerId === p.id && !s.paid && daysSince(s.date) > p.creditDays);
  const bought = (p: Party) => db.blocks.filter((b) => b.supplierId === p.id).length;
  const st = storesOf(db);
  const supplies = (p: Party) => st.items.filter((i) => i.vendorId === p.id).length + db.mineCosts.filter((c) => c.vendorId === p.id).length;
  const wa = (n: string) => `https://wa.me/${n.replace(/\D/g, "").replace(/^(?!91)(\d{10})$/, "91$1")}`;
  const intlWord = kind === "supplier" ? "Import" : "International";
  const indiaWord = kind === "supplier" ? "Domestic" : "Indian";

  const contact: Col<Party> = { key: "a", label: "", render: (p) => (
    <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
      {p.phone && <a className="btn btn-quiet btn-sm !px-2" href={`tel:${p.phone}`} aria-label={`Call ${p.company}`}><Phone size={14} /></a>}
      {(p.whatsapp || p.phone) && <a className="btn btn-quiet btn-sm !px-2" href={wa(p.whatsapp || p.phone)} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${p.company}`}><WhatsAppIcon size={15} brand /></a>}
    </div>
  ) };

  const cols: Col<Party>[] = kind === "quality" ? [
    { key: "c", label: "Quality", render: (p) => <span className="font-medium">{p.company}</span>, sort: (p) => p.company },
    { key: "s", label: "Stone", render: (p) => (p.stoneType ? p.stoneType[0].toUpperCase() + p.stoneType.slice(1) : "—") },
    { key: "b", label: "Blocks", align: "right", render: (p) => String(db.blocks.filter((b) => b.variety === p.company).length) },
    { key: "l", label: "Slabs in stock", align: "right", render: (p) => `${n0(db.lots.filter((l) => l.variety === p.company).reduce((a, l) => a + l.available, 0))} sq ft` },
    { key: "n", label: "Notes", render: (p) => <span className="text-ink-2">{p.notes}</span> },
  ] : kind === "mine" ? [
    { key: "c", label: "Mine", render: (p) => <span className="font-medium">{p.company}</span>, sort: (p) => p.company },
    { key: "ls", label: "Lease / licence no.", render: (p) => p.leaseNo || <span className="text-ink-3">—</span> },
    { key: "l", label: "Place", render: (p) => p.city || <span className="text-ink-3">—</span> },
    { key: "b", label: "Blocks extracted", align: "right", render: (p) => String(db.blocks.filter((b) => b.source === "own_mine" && b.mine === p.company).length) },
  ] : [
    { key: "c", label: "Company", render: (p) => <div><div className="font-medium">{p.company}</div><div className="text-[0.8rem] text-ink-3">{p.name}{p.contact && p.contact !== p.name ? ` · ${p.contact}` : ""}</div></div>, sort: (p) => p.company },
    { key: "l", label: "Place", render: (p) => <div><div>{p.city}</div><div className="text-[0.8rem] text-ink-3">{p.intl ? <>{p.country} <span className="ml-1 rounded-full bg-surface-2 px-1.5 py-0.5 text-[0.7rem] font-medium text-ink-2">{intlWord}</span></> : STATES[p.state] ?? ""}</div></div>, sort: (p) => `${p.intl ? p.country : ""} ${p.city}` },
    { key: "g", label: "GSTIN", render: (p) => { if (p.intl) return <span className="text-ink-3">{p.pan ? `Tax no. ${p.pan}` : "Outside India"}</span>; if (!p.gstin) return <span className="text-ink-3">{kind === "transporter" ? "—" : "Unregistered"}</span>; const g = checkGstin(p.gstin); return <div><div className="num">{p.gstin}</div>{!g.ok && <Badge tone="neg">Check digit wrong</Badge>}</div>; } },
    ...(kind === "customer" ? [
      { key: "cr", label: "Credit", align: "right" as const, render: (p: Party) => <div><div>{p.creditDays} days</div><div className="text-[0.8rem] text-ink-3">{p.creditLimit ? `limit ${lakh(p.creditLimit)}` : ""}</div></div> },
      { key: "d", label: "To collect", align: "right" as const, render: (p: Party) => { const d = due(p); return d ? <span className={late(p) ? "text-neg" : ""}>{lakh(d)}</span> : <span className="text-ink-3">—</span>; }, sort: (p: Party) => due(p) },
    ] : kind === "supplier" ? [
      { key: "m", label: "Mines", render: (p: Party) => (p.intl ? <span className="text-ink-3">—</span> : p.mines?.length ? <span>{p.mines.join(", ")}</span> : <span className="text-ink-3">Not set</span>) },
      { key: "b", label: "Blocks bought", align: "right" as const, render: (p: Party) => String(bought(p)), sort: (p: Party) => bought(p) },
    ] : kind === "vendor" ? [
      { key: "s", label: "Supplies", align: "right" as const, render: (p: Party) => { const n = supplies(p); return n ? String(n) : <span className="text-ink-3">—</span>; } },
    ] : []),
    contact,
  ];

  return (
    <div>
      <p className="-mt-3 mb-5 text-ink-2">{HINT[kind]}</p>
      <div className="flex flex-wrap items-center gap-3">
        {twoWay && <Seg value={where} onChange={setWhere} tabs={[{ key: "all", label: "All", count: ofKind.length }, { key: "india", label: indiaWord, count: ofKind.filter((p) => !p.intl).length }, { key: "intl", label: intlWord, count: ofKind.filter((p) => p.intl).length }]} />}
        {can && <div className="ml-auto"><button className="btn btn-primary btn-sm" onClick={() => setForm({ ...emptyParty(kind), ...(where === "intl" && twoWay ? { intl: true, state: "96", country: "" } : {}), ...(kind === "quality" ? { stoneType: "marble" as const } : {}) })}><Plus size={15} />Add {where === "intl" && twoWay ? `${intlWord.toLowerCase()} ${ONE[kind]}` : ONE[kind]}</button></div>}
      </div>
      <div className="mt-4"><Table rows={rows} cols={cols} onRow={setForm} search={(p) => `${p.company} ${p.name} ${p.city} ${p.country ?? ""} ${p.gstin} ${p.phone} ${(p.mines ?? []).join(" ")}`} empty={`No ${LABEL[kind].toLowerCase()} yet.`} /></div>
      {form && <PartyForm initial={form} can={can} onClose={() => setForm(null)}
        onSave={(p) => { update((d) => { const i = d.parties.findIndex((x) => x.id === p.id); if (i >= 0) d.parties[i] = p; else d.parties.push(p); }); setForm(null); }}
        onDelete={(id) => { update((d) => { d.parties = d.parties.filter((x) => x.id !== id); }); setForm(null); }}
        inUse={!!form.id && usedBy(ctx.root, form)} />}
    </div>
  );
}

export function PartyForm({ initial, onSave, onDelete, onClose, inUse, can }: { initial: Party; onSave: (p: Party) => void; onDelete: (id: string) => void; onClose: () => void; inUse: boolean; can: boolean }) {
  const [p, setP] = useState<Party>({ ...initial, mines: [...(initial.mines ?? [])] });
  const [same, setSame] = useState(!initial.shipping);
  const [err, setErr] = useState("");
  const set = <K extends keyof Party>(k: K, v: Party[K]) => setP((x) => ({ ...x, [k]: v }));
  const g = checkGstin(p.gstin);
  const simple = p.kind === "quality" || p.kind === "mine";
  const twoWay = p.kind === "customer" || p.kind === "supplier";
  const onGstin = (v: string) => setP((x) => {
    const n = { ...x, gstin: v };
    const c = checkGstin(v);
    if (c.ok) { n.state = c.state!; n.pan = c.pan!; }
    return n;
  });
  const save = () => {
    if (!p.company.trim()) return setErr(p.kind === "quality" ? "Enter the quality name." : p.kind === "mine" ? "Enter the mine name." : "Company or firm name is needed.");
    if (!simple && !p.intl && p.gstin && !g.ok) return setErr("Fix the GSTIN or leave it blank.");
    if (p.intl && !p.country?.trim()) return setErr("Enter the country.");
    const mines = (p.mines ?? []).map((m) => m.trim()).filter(Boolean);
    onSave({ ...p, company: p.company.trim(), mines: p.kind === "supplier" && !p.intl ? mines : undefined, id: p.id || Math.random().toString(36).slice(2, 10), shipping: same ? "" : p.shipping, createdAt: p.createdAt || new Date().toISOString().slice(0, 10) });
  };
  const who = ONE[p.kind];
  const footer = can
    ? <><button className="btn btn-primary" onClick={save}>Save</button><button className="btn btn-quiet" onClick={onClose}>Cancel</button>{err && <span className="text-sm text-neg">{err}</span>}{initial.id && !inUse && <button className="btn btn-quiet btn-sm ml-auto !text-neg" onClick={() => onDelete(initial.id)}>Delete</button>}{initial.id && inUse && <span className="ml-auto text-[0.8rem] text-ink-3">In use, so it can’t be deleted</span>}</>
    : <button className="btn btn-quiet" onClick={onClose}>Close</button>;

  if (simple) {
    return (
      <Drawer open title={initial.id ? p.company || "Edit" : `New ${who}`} onClose={onClose} footer={footer}>
        <Grid>
          <F label={p.kind === "quality" ? "Quality name *" : "Mine name *"} span={2}><TextIn value={p.company} onChange={(v) => set("company", v)} placeholder={p.kind === "quality" ? "Makrana Albeta" : "Morwad quarry, Rajsamand"} /></F>
          {p.kind === "quality" ? (
            <F label="Stone"><Sel value={p.stoneType ?? "marble"} onChange={(v) => set("stoneType", v as Party["stoneType"])} options={STONES.map((v) => ({ v, l: v[0].toUpperCase() + v.slice(1) }))} /></F>
          ) : <>
            <F label="Lease / quarry licence no."><TextIn value={p.leaseNo ?? ""} onChange={(v) => set("leaseNo", v)} upper placeholder="ML 41/2009" /></F>
            <F label="Place"><TextIn value={p.city} onChange={(v) => set("city", v)} placeholder="Morwad, Rajsamand" /></F>
          </>}
          <F label="Notes" span={2}><Area value={p.notes} onChange={(v) => set("notes", v)} /></F>
        </Grid>
      </Drawer>
    );
  }

  return (
    <Drawer open title={initial.id ? p.company || "Edit" : `New ${who}`} sub={p.kind === "customer" ? (p.intl ? "Everything an export invoice needs." : "Everything a GST tax invoice needs.") : p.kind === "transporter" ? "Used for blocks coming in and goods going out." : undefined} onClose={onClose} footer={footer}>
      {twoWay && (
        <div className="mb-5">
          <div className="mb-1.5 text-sm font-medium">{p.kind === "customer" ? "Customer is" : "Supplier is"}</div>
          <div className="inline-flex rounded-full bg-surface-2 p-0.5 text-[0.9rem]" role="radiogroup" aria-label={p.kind === "supplier" ? "Domestic or import" : "Indian or international"}>
            {([[false, p.kind === "supplier" ? "Domestic" : "Indian"], [true, p.kind === "supplier" ? "Import" : "International"]] as const).map(([v, l]) => (
              <button key={l} type="button" role="radio" aria-checked={!!p.intl === v} onClick={() => setP((x) => ({ ...x, intl: v, state: v ? "96" : x.state === "96" ? "08" : x.state, gstin: v ? "" : x.gstin, country: v ? x.country || "" : "" }))}
                className={`rounded-full px-4 py-1.5 transition-colors ${!!p.intl === v ? "bg-surface font-medium shadow-sm" : "text-ink-2"}`}>{l}</button>
            ))}
          </div>
          {p.intl && p.kind === "customer" && <p className="mt-1.5 text-[0.82rem] text-ink-3">Sales to this customer count as export sales and are tracked apart from sales in India.</p>}
          {p.kind === "supplier" && <p className="mt-1.5 text-[0.82rem] text-ink-3">{p.intl ? "Shows under Purchases → Import, with BL and CIF value." : "Shows under Purchases → Domestic, with its mines."}</p>}
        </div>
      )}
      <Section title="Business">
        <Grid>
          <F label="Company / firm name *" span={2}><TextIn value={p.company} onChange={(v) => set("company", v)} placeholder={p.intl ? "Al Noor Building Materials LLC" : "Sharma Tiles & Marble House"} /></F>
          {p.intl ? <>
            <F label="Country *"><TextIn value={p.country ?? ""} onChange={(v) => set("country", v)} list="countries" placeholder="United Arab Emirates" /><datalist id="countries">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist></F>
            <F label="Tax / VAT no." hint="Optional"><TextIn value={p.pan} onChange={(v) => set("pan", v)} upper /></F>
          </> : <>
            <F label="GSTIN" err={p.gstin && !g.ok ? g.msg : undefined} hint={g.ok ? `✓ ${g.msg}` : "State and PAN fill in from it"}><TextIn value={p.gstin} onChange={onGstin} upper placeholder="08ABCDE1234F1Z5" /></F>
            <F label="PAN"><TextIn value={p.pan} onChange={(v) => set("pan", v)} upper /></F>
          </>}
          <F label="Owner / proprietor"><TextIn value={p.name} onChange={(v) => set("name", v)} /></F>
          <F label="Contact person"><TextIn value={p.contact} onChange={(v) => set("contact", v)} /></F>
        </Grid>
      </Section>
      {p.kind === "supplier" && !p.intl && (
        <Section title="Mines" aside={<button type="button" className="btn btn-quiet btn-sm" onClick={() => set("mines", [...(p.mines ?? []), ""])}><Plus size={14} />Mine</button>}>
          <p className="mb-2 text-[0.82rem] text-ink-3">Optional. With one mine it is picked on its own in a purchase; with more, you choose.</p>
          <div className="space-y-2">
            {(p.mines ?? []).map((m, i) => (
              <div key={i} className="flex gap-2">
                <div className="flex-1"><TextIn value={m} onChange={(v) => set("mines", (p.mines ?? []).map((x, j) => (j === i ? v : x)))} placeholder="Ulodi quarry, Makrana" /></div>
                <button type="button" className="btn btn-quiet btn-sm !px-2" aria-label="Remove mine" onClick={() => set("mines", (p.mines ?? []).filter((_, j) => j !== i))}><Trash2 size={14} /></button>
              </div>
            ))}
            {!(p.mines ?? []).length && <p className="text-sm text-ink-3">No mines added.</p>}
          </div>
        </Section>
      )}
      <Section title="Contact">
        <Grid>
          <F label="Mobile"><TextIn type="tel" value={p.phone} onChange={(v) => set("phone", v)} placeholder={p.intl ? "With country code, +971 50 123 4567" : "10-digit mobile"} /></F>
          <F label="WhatsApp" hint="Leave blank if same as mobile"><TextIn type="tel" value={p.whatsapp} onChange={(v) => set("whatsapp", v)} /></F>
          <F label="Email" span={2}><TextIn type="email" value={p.email} onChange={(v) => set("email", v)} /></F>
        </Grid>
      </Section>
      <Section title="Billing address">
        <Grid cols={3}>
          <F label="Street / area" span={3}><Area value={p.billing} onChange={(v) => set("billing", v)} /></F>
          <F label="City"><TextIn value={p.city} onChange={(v) => set("city", v)} /></F>
          {p.intl ? <F label="Country"><div className="field">{p.country || "—"}</div></F> : <F label="State" hint="Decides CGST+SGST or IGST"><Sel value={p.state} onChange={(v) => set("state", v)} options={Object.entries(STATES).map(([k, v]) => ({ v: k, l: `${v} (${k})` }))} /></F>}
          <F label={p.intl ? "Postal code" : "PIN code"}><TextIn value={p.pincode} onChange={(v) => set("pincode", p.intl ? v.slice(0, 12) : v.replace(/\D/g, "").slice(0, 6))} /></F>
        </Grid>
        {p.kind === "customer" && (
          <div className="mt-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={same} onChange={(e) => setSame(e.target.checked)} />Ship to the same address</label>
            {!same && <div className="mt-2"><F label="Shipping / site address"><Area value={p.shipping} onChange={(v) => set("shipping", v)} placeholder="Site name, area, city" /></F></div>}
          </div>
        )}
      </Section>
      {p.kind !== "transporter" && (
        <Section title={p.kind === "customer" ? "Credit" : "Payment"}>
          <Grid>
            <F label="Credit days"><NumIn value={p.creditDays} onChange={(v) => set("creditDays", v)} suffix="days" /></F>
            {p.kind === "customer" && <F label="Credit limit"><NumIn value={p.creditLimit} onChange={(v) => set("creditLimit", v)} suffix="₹" /></F>}
            {p.kind !== "customer" && <F label="Bank (for payments)"><TextIn value={p.bank} onChange={(v) => set("bank", v)} placeholder="Bank, branch, IFSC" /></F>}
          </Grid>
        </Section>
      )}
      <Section title="Notes"><Area value={p.notes} onChange={(v) => set("notes", v)} placeholder={p.kind === "vendor" ? "What they supply: diesel, machine hire, resin, spares" : undefined} /></Section>
    </Drawer>
  );
}
