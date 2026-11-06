"use client";
import { useState } from "react";
import { FileDown, Pencil, Receipt, Send, Undo2, UserPlus } from "lucide-react";
import { dmy, n0, n2, rs, rs2, today, uid } from "@/lib/stone/calc";
import { lotUnit } from "@/lib/stone/costing";
import { firmName, firmOf } from "@/lib/stone/firms";
import { RESERVE_DAYS, addDays, byCustomer, expired, pickable, releaseReserve, reservations, reserveOf, saveReserve, type ResRow } from "@/lib/stone/reserve";
import { slabCount } from "@/lib/stone/slabs";
import { emptyParty } from "@/lib/stone/seed";
import type { Party, Reservation, SlabLot } from "@/lib/stone/types";
import type { Ctx } from "./StoneApp";
import { Drawer, F, Grid, Note, NumIn, Pick, TextIn } from "./ui";

const quality = (l: SlabLot) => `${l.variety} ${l.thicknessMm} mm ${l.finish}`.trim();

/** Reserve slabs of one lot for a customer, or change a reservation. One reservation per customer per lot. */
export function ReserveForm({ ctx, lot, initial, onClose }: { ctx: Ctx; lot: SlabLot; initial?: Reservation; onClose: () => void }) {
  const { db } = ctx;
  const C = ctx.costs;
  const customers = db.parties.filter((p) => p.kind === "customer");
  const tracked = !!lot.slabs?.length;
  const [cur, setCur] = useState<Reservation | undefined>(initial);
  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [ids, setIds] = useState<string[]>(() => initial?.slabIds ?? (tracked ? pickable(lot, "").slice(0, 1).map((s) => s.id) : []));
  const [count, setCount] = useState(initial?.slabIds.length ?? 1);
  const [rate, setRate] = useState(initial?.rate ?? lot.listRate ?? 0);
  const [till, setTill] = useState(initial?.till ?? addDays(today(), RESERVE_DAYS));
  const [advance, setAdvance] = useState(initial?.advance ?? 0);
  const [note, setNote] = useState(initial?.note ?? "");
  // Quick new customer: name and WhatsApp number now, the rest later under Masters → Customers.
  const canAdd = ctx.edit("parties") || ctx.edit("sales");
  const [nc, setNc] = useState<{ name: string; wa: string } | null>(null);
  const digits = (v: string) => v.replace(/\D/g, "").replace(/^91(\d{10})$/, "$1").replace(/^0(\d{10})$/, "$1");
  const ncDup = nc && digits(nc.wa).length === 10 ? customers.find((p) => digits(p.whatsapp || "") === digits(nc.wa) || digits(p.phone || "") === digits(nc.wa)) : undefined;
  const ncErr = !nc ? "" : ncDup ? `This number is already saved for ${ncDup.company}. Pick them from the list.` : !nc.name.trim() ? "Enter the customer's name" : digits(nc.wa).length !== 10 ? "Enter a 10-digit WhatsApp number" : "";
  const addCustomer = () => {
    if (!nc || ncErr) return;
    const S = ctx.firm ?? ctx.root.settings;
    const p = { ...emptyParty("customer"), id: uid(), company: nc.name.trim(), name: nc.name.trim(), whatsapp: digits(nc.wa), phone: digits(nc.wa), state: S.state || "08", createdAt: today() };
    ctx.update((d) => { d.parties.push(p); });
    ctx.say(`${p.company} added to customers. Add GSTIN and address later under Masters → Customers.`, "good");
    setNc(null);
    chooseCustomer(p.id);
  };

  const pool = tracked ? pickable(lot, customerId) : [];
  const max = tracked ? pool.length : slabCount(lot);
  const lowest = (n: number, keep: string[]) => {
    const kept = pool.filter((s) => keep.includes(s.id)).map((s) => s.id).slice(0, n);
    const add = pool.filter((s) => !kept.includes(s.id)).slice(0, Math.max(0, n - kept.length)).map((s) => s.id);
    return [...kept, ...add];
  };
  const picked = tracked ? ids.filter((id) => pool.some((s) => s.id === id)) : [];
  const n = tracked ? picked.length : count;
  const each = !tracked && lot.pieces ? lot.available / lot.pieces : 0;
  const sqft = tracked ? pool.filter((s) => picked.includes(s.id)).reduce((a, s) => a + s.sqft, 0) : n * each;

  const chooseCustomer = (v: string) => {
    setCustomerId(v);
    const ex = reserveOf(lot, v);
    if (ex && ex.id !== initial?.id) { setCur(ex); setIds(ex.slabIds); setCount(ex.slabIds.length); setRate(ex.rate); setTill(ex.till); setAdvance(ex.advance ?? 0); setNote(ex.note ?? ""); return; }
    if (!initial) setCur(undefined);
    if (tracked) { const p = pickable(lot, v); const keep = ids.filter((id) => p.some((s) => s.id === id)); setIds(keep.length ? keep : p.slice(0, Math.max(1, count)).map((s) => s.id)); }
  };
  const setN = (v: number) => { const k = Math.max(0, Math.min(max, Math.round(v))); setCount(k); if (tracked) setIds(lowest(k, ids)); };

  const err = !customerId ? "Choose a customer" : n < 1 ? "Reserve at least one slab" : n > max ? `Only ${max} slabs free in this lot` : !till ? "Set the date it is reserved till" : rate <= 0 ? "Enter the rate per sq ft" : "";
  const save = () => {
    const r: Reservation = { id: cur?.id ?? uid(), customerId, slabIds: tracked ? picked : [], on: cur?.on ?? today(), till, rate, ...(advance > 0 ? { advance } : {}), ...(note.trim() ? { note: note.trim() } : {}), by: cur?.by ?? ctx.me?.name };
    ctx.update((d) => saveReserve(d, lot.id, r, tracked ? undefined : n));
    ctx.say(`${n} slab${n === 1 ? "" : "s"} of lot ${lot.lotNo} reserved for ${customers.find((p) => p.id === customerId)?.company ?? "the customer"}`, "good");
    onClose();
  };
  const release = () => { if (!cur) return; ctx.update((d) => releaseReserve(d, lot.id, cur.id)); ctx.say(`Reservation on lot ${lot.lotNo} released`, "good"); onClose(); };

  return (
    <Drawer open title={cur ? `Reservation · lot ${lot.lotNo}` : `Reserve from lot ${lot.lotNo}`} sub={`${quality(lot)} · grade ${lot.grade} · ${lot.site === "depot" ? "depot" : "unit"} ${lot.location}${C ? ` · cost ${rs2(lotUnit(ctx.root, lot))}/sq ft` : ""}`} onClose={onClose}
      footer={<><button className="btn btn-primary" disabled={Boolean(err)} onClick={save}>{cur ? "Save reservation" : "Reserve"}</button><button className="btn btn-quiet" onClick={onClose}>Cancel</button>{err && <span className="text-sm text-ink-3">{err}</span>}
        {cur && <button className="btn btn-quiet btn-sm ml-auto !text-neg" onClick={release}><Undo2 size={14} />Release all</button>}</>}>
      {cur && !initial && <div className="mb-4"><Note>{customers.find((p) => p.id === customerId)?.company} already has {cur.slabIds.length} slabs reserved in this lot. Change the count, rate or date below; it stays one reservation.</Note></div>}
      {!tracked && <div className="mb-4"><Note>This lot is stocked as {n0(lot.available)} sq ft without slab numbers. Reserving gives it {slabCount(lot)} slab records of about {n2(each)} sq ft each.</Note></div>}
      <Grid>
        <F box label="Customer" span={2} hint={customerId ? [customers.find((p) => p.id === customerId)?.city, customers.find((p) => p.id === customerId)?.whatsapp || customers.find((p) => p.id === customerId)?.phone].filter(Boolean).join(" · ") || undefined : undefined}>
          <Pick align="left" onPick={chooseCustomer} placeholder={customers.find((p) => p.id === customerId)?.company ?? "Choose customer"} search="Search name, city or mobile…" empty="No customer matches"
            onAdd={canAdd ? (q) => setNc({ name: /^[\d\s+]+$/.test(q) ? "" : q, wa: /^[\d\s+]+$/.test(q) ? q : "" }) : undefined} addLabel="Add new customer"
            options={customers.map((p) => ({ v: p.id, l: p.company, sub: [p.city, p.whatsapp || p.phone].filter(Boolean).join(" · "), find: `${p.name} ${p.phone} ${p.whatsapp} ${p.gstin}` }))} />
        </F>
        {nc && (
          <div className="rounded-2xl border border-surface-3 bg-surface p-4 sm:col-span-2">
            <div className="flex items-center gap-2 font-medium"><UserPlus size={16} />New customer</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <F label="Customer name"><TextIn value={nc.name} onChange={(v) => setNc({ ...nc, name: v })} placeholder="Firm or person's name" /></F>
              <F label="WhatsApp mobile"><TextIn type="tel" value={nc.wa} onChange={(v) => setNc({ ...nc, wa: v })} placeholder="98290 12345" /></F>
            </div>
            <p className="mt-2 text-[0.8rem] text-ink-3">GSTIN, address and credit days can be added later under Masters → Customers.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-primary btn-sm" disabled={Boolean(ncErr)} onClick={addCustomer}>Add customer</button>
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => setNc(null)}>Cancel</button>
              {ncErr && <span className="text-[0.84rem] text-ink-3">{ncErr}</span>}
            </div>
          </div>
        )}
        <F label="No. of slabs" hint={cur ? `${max} available, incl. this reservation` : `${max} free in this lot`}><NumIn value={count} onChange={setN} /></F>
        <F label="Sq ft" hint={tracked ? "For this many slabs" : "At the lot's average slab size"}><div className="field num">{n2(sqft)}</div></F>
        <F label="Rate" hint={lot.listRate ? `List ${rs(lot.listRate)}` : undefined}><NumIn value={rate} onChange={setRate} suffix="₹/sq ft" /></F>
        <F label="Amount" hint="Before GST"><div className="field num">{rs(sqft * rate)}</div></F>
        <F label="Reserved on"><div className="field num">{dmy(cur?.on ?? today())}</div></F>
        <F label="Reserved till" hint={`${RESERVE_DAYS} days unless changed`}><TextIn type="date" value={till} onChange={setTill} /></F>
        <F label="Advance received" hint="Optional"><NumIn value={advance} onChange={setAdvance} suffix="₹" /></F>
        <F label="Note"><TextIn value={note} onChange={setNote} placeholder="Lifting after Diwali" /></F>
      </Grid>
    </Drawer>
  );
}

/** Reserved slabs, customer by customer, with the ones past their date kept apart. */
export function ReservedList({ ctx, onEdit }: { ctx: Ctx; onEdit: (lot: SlabLot, r: Reservation) => void }) {
  const { db } = ctx;
  const C = ctx.costs;
  const R = ctx.root;
  const can = ctx.edit("sales") || ctx.edit("stock");
  const rows = reservations(db);
  const live = rows.filter((x) => !expired(x.r));
  const old = rows.filter((x) => expired(x.r));
  const party = (id: string) => db.parties.find((p) => p.id === id) ?? R.parties.find((p) => p.id === id);
  const release = (x: ResRow) => { ctx.update((d) => releaseReserve(d, x.lot.id, x.r.id)); ctx.say(`Lot ${x.lot.lotNo} released for ${party(x.r.customerId)?.company ?? "the customer"}`, "good"); };
  const bill = (customerId: string, firmId: string) => {
    if (ctx.firms.length > 1 && ctx.firm?.id !== firmId) ctx.setFirm(firmId);
    ctx.go("sales", `bill:${customerId}`);
  };

  if (!rows.length) return <div className="rounded-2xl bg-surface px-4 py-10 text-center text-ink-3">Nothing reserved. Click Reserve on a lot under By lot to keep slabs aside for a customer.</div>;

  const lines = (items: ResRow[], showCustomer: boolean) => (
    <div className="scroll-thin overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-[0.88rem]">
        <thead>
          <tr className="text-[0.76rem] text-ink-3">
            {showCustomer && <th className="px-4 py-2 font-medium">Customer</th>}
            <th className={`py-2 font-medium ${showCustomer ? "px-3" : "px-4"}`}>Lot</th>
            <th className="px-3 py-2 font-medium">Quality</th>
            <th className="px-3 py-2 text-right font-medium">Slabs</th>
            <th className="px-3 py-2 text-right font-medium">Sq ft</th>
            <th className="px-3 py-2 text-right font-medium">Rate</th>
            {C && <th className="px-3 py-2 text-right font-medium">Cost</th>}
            <th className="px-3 py-2 text-right font-medium">Amount</th>
            <th className="px-3 py-2 font-medium">Reserved</th>
            <th className="px-3 py-2 pr-4" />
          </tr>
        </thead>
        <tbody>
          {items.map((x) => {
            const cost = lotUnit(R, x.lot);
            const late = expired(x.r);
            return (
              <tr key={x.r.id} className="border-t border-surface-2 align-top">
                {showCustomer && <td className="px-4 py-2.5 font-medium">{party(x.r.customerId)?.company ?? "—"}</td>}
                <td className={`py-2.5 font-medium ${showCustomer ? "px-3" : "px-4"}`}>{x.lot.lotNo}{ctx.firms.length > 1 && !ctx.firm && <span className="block text-[0.78rem] font-normal text-ink-3">{firmName(R.settings, firmOf(x.lot, R.settings))}</span>}</td>
                <td className="px-3 py-2.5">{quality(x.lot)}<span className="block text-[0.78rem] text-ink-3">grade {x.lot.grade} · {x.lot.site === "depot" ? "depot" : "unit"} {x.lot.location}</span></td>
                <td className="num px-3 py-2.5 text-right">{x.slabs.length}</td>
                <td className="num px-3 py-2.5 text-right">{n2(x.sqft)}</td>
                <td className="num px-3 py-2.5 text-right">{rs(x.r.rate)}</td>
                {C && <td className={`num px-3 py-2.5 text-right ${x.r.rate < cost ? "text-neg" : "text-ink-3"}`}>{rs2(cost)}</td>}
                <td className="num px-3 py-2.5 text-right">{rs(x.sqft * x.r.rate)}{x.r.advance ? <span className="block text-[0.78rem] text-ink-3">adv. {rs(x.r.advance)}</span> : null}</td>
                <td className="num px-3 py-2.5">{dmy(x.r.on)}<span className={`block text-[0.78rem] ${late ? "font-medium text-neg" : "text-ink-3"}`}>{late ? "expired" : "till"} {dmy(x.r.till)}</span>{x.r.note && <span className="block text-[0.78rem] text-ink-3">{x.r.note}</span>}</td>
                <td className="px-3 py-2.5 pr-4">
                  {can && <div className="flex justify-end gap-1.5">
                    <button className="btn btn-quiet btn-sm" onClick={() => onEdit(x.lot, x.r)}><Pencil size={13} />{late ? "Extend" : "Edit"}</button>
                    <button className={`btn btn-sm ${late ? "btn-primary" : "btn-quiet"}`} onClick={() => release(x)}><Undo2 size={13} />Release</button>
                  </div>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4">
      {byCustomer(live).map((g) => {
        const p = party(g.customerId);
        const firmIds = [...new Set(g.items.map((x) => firmOf(x.lot, R.settings)))];
        return (
          <section key={g.customerId} className="overflow-hidden rounded-2xl bg-surface">
            <div className="flex flex-wrap items-center gap-3 border-b border-surface-2 px-4 py-3">
              <div className="min-w-0">
                <div className="font-semibold">{p?.company ?? "Customer removed"}</div>
                <div className="text-[0.82rem] text-ink-3">{[p?.city, `${g.slabs} slabs`, `${n2(g.sqft)} sq ft`, rs(g.value), g.advance ? `advance ${rs(g.advance)}` : ""].filter(Boolean).join(" · ")}</div>
              </div>
              <div className="ml-auto flex flex-wrap gap-2">
                <SendSlip ctx={ctx} customer={p} items={g.items} />
                {ctx.edit("sales") && firmIds.map((fid) => (
                  <button key={fid} className="btn btn-primary btn-sm" onClick={() => bill(g.customerId, fid)}><Receipt size={14} />Bill{firmIds.length > 1 ? ` · ${firmName(R.settings, fid)}` : ""}</button>
                ))}
              </div>
            </div>
            {lines(g.items, false)}
          </section>
        );
      })}
      {!live.length && <div className="rounded-2xl bg-surface px-4 py-6 text-center text-ink-3">No reservation is running. The ones below are past their date.</div>}
      {old.length > 0 && (
        <section className="overflow-hidden rounded-2xl bg-surface">
          <div className="border-b border-surface-2 px-4 py-3">
            <div className="font-semibold text-neg">Expired · {old.length}</div>
            <div className="text-[0.82rem] text-ink-3">Past their date, but the slabs are still kept aside. Release them for other customers, or extend.</div>
          </div>
          {lines(old, true)}
        </section>
      )}
    </div>
  );
}

// ─── Reservation slip: PDF and WhatsApp ───

const inr = (v: number) => Math.round(v).toLocaleString("en-IN");
const waNo = (p?: Party) => (p?.whatsapp || p?.phone || "").replace(/\D/g, "").replace(/^(?!91)(\d{10})$/, "91$1");

function slipText(company: string, p: Party | undefined, items: ResRow[]) {
  const total = items.reduce((a, x) => a + x.sqft * x.r.rate, 0);
  const adv = items.reduce((a, x) => a + (x.r.advance ?? 0), 0);
  return [
    `Dear ${p?.company ?? "Sir"},`,
    `Slabs reserved for you at ${company}:`,
    "",
    ...items.map((x, i) => `${i + 1}. ${quality(x.lot)} (lot ${x.lot.lotNo})\n   ${x.slabs.length} slabs · ${n2(x.sqft)} sq ft @ ₹${inr(x.r.rate)}/sq ft = ₹${inr(x.sqft * x.r.rate)}\n   Reserved till ${dmy(x.r.till)}`),
    "",
    `Total: ${items.reduce((a, x) => a + x.slabs.length, 0)} slabs · ${n2(items.reduce((a, x) => a + x.sqft, 0))} sq ft · ₹${inr(total)} + GST`,
    ...(adv ? [`Advance received: ₹${inr(adv)}`] : []),
    "Details are in the attached PDF.",
  ].join("\n");
}

async function slipPdf(ctx: Ctx, p: Party | undefined, items: ResRow[]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const S = ctx.firm ?? ctx.root.settings;
  const name = ("name" in S ? S.name : S.company) || ctx.root.settings.company;
  const L = 15, W = 180;
  let y = 18;
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text(name, L, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  const head = [S.address, S.city, S.phone && `Phone ${S.phone}`, S.gstin && `GSTIN ${S.gstin}`].filter(Boolean).join(" · ");
  if (head) { y += 5; doc.text(doc.splitTextToSize(head, 120), L, y); }
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("SLAB RESERVATION", L + W, 18, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(`Date ${dmy(today())}`, L + W, 23, { align: "right" });
  y = Math.max(y, 23) + 9;
  doc.setDrawColor(200); doc.line(L, y - 4, L + W, y - 4);
  doc.setFontSize(9); doc.setTextColor(110); doc.text("Reserved for", L, y); doc.setTextColor(0);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(p?.company ?? "—", L, y + 5);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  const cust = [p?.city, p?.gstin && `GSTIN ${p.gstin}`, (p?.whatsapp || p?.phone) && `Phone ${p?.whatsapp || p?.phone}`].filter(Boolean).join(" · ");
  if (cust) doc.text(cust, L, y + 10);
  y += 18;

  // columns: x positions and widths in mm
  const col = { n: L, q: L + 7, c: L + 95, f: L + 112, r: L + 134, a: L + 158, t: L + W };
  const header = () => {
    doc.setFillColor(238, 240, 236); doc.rect(L, y - 4.5, W, 7, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
    doc.text("#", col.n + 1, y); doc.text("Quality / lot", col.q, y);
    doc.text("Slabs", col.c + 12, y, { align: "right" }); doc.text("Sq ft", col.f + 18, y, { align: "right" });
    doc.text("Rate Rs/sq ft", col.r + 20, y, { align: "right" }); doc.text("Amount Rs", col.a + 20, y, { align: "right" });
    y += 7; doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  };
  header();
  items.forEach((x, i) => {
    const q = doc.splitTextToSize(`${quality(x.lot)}`, 82);
    const sub = `Lot ${x.lot.lotNo} · grade ${x.lot.grade} · till ${dmy(x.r.till)}`;
    const h = (q.length + 1) * 4.4 + 2;
    if (y + h > 275) { doc.addPage(); y = 20; header(); }
    doc.text(String(i + 1), col.n + 1, y);
    doc.text(q, col.q, y);
    doc.setFontSize(8); doc.setTextColor(110); doc.text(sub, col.q, y + q.length * 4.4); doc.setTextColor(0); doc.setFontSize(9);
    doc.text(String(x.slabs.length), col.c + 12, y, { align: "right" });
    doc.text(n2(x.sqft), col.f + 18, y, { align: "right" });
    doc.text(inr(x.r.rate), col.r + 20, y, { align: "right" });
    doc.text(inr(x.sqft * x.r.rate), col.a + 20, y, { align: "right" });
    y += h;
    doc.setDrawColor(225); doc.line(L, y - 3.5, L + W, y - 3.5);
  });
  const total = items.reduce((a, x) => a + x.sqft * x.r.rate, 0);
  const adv = items.reduce((a, x) => a + (x.r.advance ?? 0), 0);
  doc.setFont("helvetica", "bold");
  doc.text("Total", col.q, y + 1);
  doc.text(String(items.reduce((a, x) => a + x.slabs.length, 0)), col.c + 12, y + 1, { align: "right" });
  doc.text(n2(items.reduce((a, x) => a + x.sqft, 0)), col.f + 18, y + 1, { align: "right" });
  doc.text(inr(total), col.a + 20, y + 1, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 9;
  const foot = [
    "Rates are per sq ft, before GST. GST is added on the invoice.",
    adv ? `Advance received: Rs ${inr(adv)}.` : "",
    "The slabs above are kept aside for you till the date shown against each lot.",
    ...items.filter((x) => x.r.note).map((x) => `Lot ${x.lot.lotNo}: ${x.r.note}`),
  ].filter(Boolean);
  doc.setFontSize(8.5); doc.setTextColor(90);
  for (const t of foot) { if (y > 285) { doc.addPage(); y = 20; } doc.text(doc.splitTextToSize(t, W), L, y); y += 5; }
  return { doc, name };
}

/** Reservation slip for one customer: a PDF, sent on WhatsApp with the same details as text. */
function SendSlip({ ctx, customer, items }: { ctx: Ctx; customer?: Party; items: ResRow[] }) {
  const [busy, setBusy] = useState(false);
  const file = `Reservation ${customer?.company ?? ""} ${today()}.pdf`.replace(/[\\/:*?"<>|]+/g, "").trim();
  const run = async (send: boolean) => {
    setBusy(true);
    try {
      const { doc, name } = await slipPdf(ctx, customer, items);
      const text = slipText(name, customer, items);
      const pdf = new File([doc.output("blob")], file, { type: "application/pdf" });
      if (send && typeof navigator !== "undefined" && navigator.canShare?.({ files: [pdf] })) {
        try { await navigator.share({ files: [pdf], text }); } catch { /* closed the share sheet */ }
        return;
      }
      doc.save(file);
      if (send) {
        window.open(`https://wa.me/${waNo(customer)}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
        ctx.say("PDF downloaded. Attach it in the WhatsApp chat that just opened.", "plain");
      }
    } finally { setBusy(false); }
  };
  return (
    <>
      <button className="btn btn-quiet btn-sm" disabled={busy} onClick={() => run(false)}><FileDown size={14} />PDF</button>
      <button className="btn btn-quiet btn-sm" disabled={busy} onClick={() => run(true)}><Send size={14} />WhatsApp</button>
    </>
  );
}
