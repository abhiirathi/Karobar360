"use client";
import { useState } from "react";
import { Phone, Plus } from "lucide-react";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import { STATES, checkGstin, daysSince, lakh, saleTotals } from "@/lib/stone/calc";
import { emptyParty } from "@/lib/stone/seed";
import type { Party } from "@/lib/stone/types";
import type { Ctx } from "./StoneApp";
import { Area, Badge, Drawer, F, Grid, NumIn, Section, Sel, Seg, Table, TextIn, type Col } from "./ui";

type Kind = Party["kind"];
const COUNTRIES = ["United Arab Emirates", "Saudi Arabia", "Qatar", "Oman", "Kuwait", "Bahrain", "Nepal", "Bangladesh", "Sri Lanka", "Maldives", "Mauritius", "United States", "United Kingdom", "Australia", "Canada", "Singapore", "Malaysia", "Vietnam", "Italy", "Turkey", "Greece", "Spain", "Egypt", "Kenya", "South Africa"];
const LABEL: Record<Kind, string> = { customer: "Customers", supplier: "Suppliers & mine owners", transporter: "Transporters" };

export default function Parties({ ctx }: { ctx: Ctx }) {
  const { db, update } = ctx;
  const [kind, setKind] = useState<Kind>((ctx.sub as Kind) || "customer");
  const [form, setForm] = useState<Party | null>(null);
  const [where, setWhere] = useState<"all" | "india" | "intl">("all");
  const ofKind = db.parties.filter((p) => p.kind === kind);
  const rows = ofKind.filter((p) => where === "all" || (where === "intl") === !!p.intl);
  const due = (p: Party) => db.sales.filter((s) => s.customerId === p.id && !s.paid).reduce((a, s) => a + saleTotals(s, db.settings.state, p.state).total, 0);
  const late = (p: Party) => db.sales.some((s) => s.customerId === p.id && !s.paid && daysSince(s.date) > p.creditDays);
  const bought = (p: Party) => db.blocks.filter((b) => b.supplierId === p.id).length;
  const wa = (n: string) => `https://wa.me/${n.replace(/\D/g, "").replace(/^(?!91)(\d{10})$/, "91$1")}`;

  const cols: Col<Party>[] = [
    { key: "c", label: "Company", render: (p) => <div><div className="font-medium">{p.company}</div><div className="text-[0.8rem] text-ink-3">{p.name}{p.contact && p.contact !== p.name ? ` · ${p.contact}` : ""}</div></div>, sort: (p) => p.company },
    { key: "l", label: "Place", render: (p) => <div><div>{p.city}</div><div className="text-[0.8rem] text-ink-3">{p.intl ? <>{p.country} <span className="ml-1 rounded-full bg-surface-2 px-1.5 py-0.5 text-[0.7rem] font-medium text-ink-2">International</span></> : STATES[p.state] ?? ""}</div></div>, sort: (p) => `${p.intl ? p.country : ""} ${p.city}` },
    { key: "g", label: "GSTIN", render: (p) => { if (p.intl) return <span className="text-ink-3">{p.pan ? `Tax no. ${p.pan}` : "Outside India"}</span>; if (!p.gstin) return <span className="text-ink-3">{kind === "transporter" ? "—" : "Unregistered"}</span>; const g = checkGstin(p.gstin); return <div><div className="num">{p.gstin}</div>{!g.ok && <Badge tone="neg">Check digit wrong</Badge>}</div>; } },
    ...(kind === "customer" ? [
      { key: "cr", label: "Credit", align: "right" as const, render: (p: Party) => <div><div>{p.creditDays} days</div><div className="text-[0.8rem] text-ink-3">{p.creditLimit ? `limit ${lakh(p.creditLimit)}` : ""}</div></div> },
      { key: "d", label: "To collect", align: "right" as const, render: (p: Party) => { const d = due(p); return d ? <span className={late(p) ? "text-neg" : ""}>{lakh(d)}</span> : <span className="text-ink-3">—</span>; }, sort: (p: Party) => due(p) },
    ] : kind === "supplier" ? [{ key: "b", label: "Blocks bought", align: "right" as const, render: (p: Party) => String(bought(p)), sort: (p: Party) => bought(p) }] : []),
    { key: "a", label: "", render: (p) => (
      <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
        {p.phone && <a className="btn btn-quiet btn-sm !px-2" href={`tel:${p.phone}`} aria-label={`Call ${p.company}`}><Phone size={14} /></a>}
        {(p.whatsapp || p.phone) && <a className="btn btn-quiet btn-sm !px-2" href={wa(p.whatsapp || p.phone)} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${p.company}`}><WhatsAppIcon size={15} brand /></a>}
      </div>
    ) },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Seg value={kind} onChange={setKind} tabs={(Object.keys(LABEL) as Kind[]).map((k) => ({ key: k, label: LABEL[k], count: db.parties.filter((p) => p.kind === k).length }))} />
        {kind !== "transporter" && <Seg value={where} onChange={setWhere} tabs={[{ key: "all", label: "All" }, { key: "india", label: "Indian", count: ofKind.filter((p) => !p.intl).length }, { key: "intl", label: "International", count: ofKind.filter((p) => p.intl).length }]} />}
        <div className="ml-auto"><button className="btn btn-primary btn-sm" onClick={() => setForm({ ...emptyParty(kind), ...(where === "intl" && kind !== "transporter" ? { intl: true, state: "96", country: "" } : {}) })}><Plus size={15} />Add {where === "intl" && kind !== "transporter" ? `international ${kind}` : kind}</button></div>
      </div>
      <div className="mt-4"><Table rows={rows} cols={cols} onRow={setForm} search={(p) => `${p.company} ${p.name} ${p.city} ${p.country ?? ""} ${p.gstin} ${p.phone}`} empty={`No ${LABEL[kind].toLowerCase()} yet.`} /></div>
      {form && <PartyForm initial={form} onClose={() => setForm(null)}
        onSave={(p) => { update((d) => { const i = d.parties.findIndex((x) => x.id === p.id); if (i >= 0) d.parties[i] = p; else d.parties.push(p); }); setForm(null); }}
        onDelete={(id) => { update((d) => { d.parties = d.parties.filter((x) => x.id !== id); }); setForm(null); }}
        inUse={db.sales.some((s) => s.customerId === form.id) || db.blocks.some((b) => b.supplierId === form.id || b.transporterId === form.id)} />}
    </div>
  );
}

function PartyForm({ initial, onSave, onDelete, onClose, inUse }: { initial: Party; onSave: (p: Party) => void; onDelete: (id: string) => void; onClose: () => void; inUse: boolean }) {
  const [p, setP] = useState<Party>({ ...initial });
  const [same, setSame] = useState(!initial.shipping);
  const [err, setErr] = useState("");
  const set = <K extends keyof Party>(k: K, v: Party[K]) => setP((x) => ({ ...x, [k]: v }));
  const g = checkGstin(p.gstin);
  const onGstin = (v: string) => setP((x) => {
    const n = { ...x, gstin: v };
    const c = checkGstin(v);
    if (c.ok) { n.state = c.state!; n.pan = c.pan!; }
    return n;
  });
  const save = () => {
    if (!p.company.trim()) return setErr("Company or firm name is needed.");
    if (!p.intl && p.gstin && !g.ok) return setErr("Fix the GSTIN or leave it blank.");
    if (p.intl && !p.country?.trim()) return setErr("Enter the country.");
    onSave({ ...p, id: p.id || Math.random().toString(36).slice(2, 10), shipping: same ? "" : p.shipping, createdAt: p.createdAt || new Date().toISOString().slice(0, 10) });
  };
  const who = p.kind === "customer" ? "customer" : p.kind === "supplier" ? "supplier" : "transporter";
  return (
    <Drawer open title={initial.id ? p.company || "Edit" : `New ${who}`} sub={p.kind === "customer" ? (p.intl ? "Everything an export invoice needs." : "Everything a GST tax invoice needs.") : undefined} onClose={onClose}
      footer={<><button className="btn btn-primary" onClick={save}>Save</button><button className="btn btn-quiet" onClick={onClose}>Cancel</button>{err && <span className="text-sm text-neg">{err}</span>}{initial.id && !inUse && <button className="btn btn-quiet btn-sm ml-auto !text-neg" onClick={() => onDelete(initial.id)}>Delete</button>}</>}>
      {p.kind !== "transporter" && (
        <div className="mb-5">
          <div className="mb-1.5 text-sm font-medium">{p.kind === "customer" ? "Customer is" : "Supplier is"}</div>
          <div className="inline-flex rounded-full bg-surface-2 p-0.5 text-[0.9rem]" role="radiogroup" aria-label="Indian or international">
            {([[false, "Indian"], [true, "International"]] as const).map(([v, l]) => (
              <button key={l} type="button" role="radio" aria-checked={!!p.intl === v} onClick={() => setP((x) => ({ ...x, intl: v, state: v ? "96" : x.state === "96" ? "08" : x.state, gstin: v ? "" : x.gstin, country: v ? x.country || "" : "" }))}
                className={`rounded-full px-4 py-1.5 transition-colors ${!!p.intl === v ? "bg-surface font-medium shadow-sm" : "text-ink-2"}`}>{l}</button>
            ))}
          </div>
          {p.intl && p.kind === "customer" && <p className="mt-1.5 text-[0.82rem] text-ink-3">Sales to this customer count as export sales and are tracked apart from sales in India.</p>}
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
            {p.kind === "supplier" && <F label="Bank (for payments)"><TextIn value={p.bank} onChange={(v) => set("bank", v)} placeholder="Bank, branch, IFSC" /></F>}
          </Grid>
        </Section>
      )}
      <Section title="Notes"><Area value={p.notes} onChange={(v) => set("notes", v)} /></Section>
    </Drawer>
  );
}
