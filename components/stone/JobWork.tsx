"use client";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Play, Plus, Printer, ReceiptText, Scissors, Trash2, Truck } from "lucide-react";
import { STATES, cbm, daysSince, dmy, inWords, lakh, n0, n2, r2, rs, rs2, today, uid } from "@/lib/stone/calc";
import { qualities, qualityOf } from "@/lib/stone/costing";
import { EXTRA_LABELS, FINISHES, JOB_STATUS, autoLines, billTotals, billedIds, emptyJobBlock, holdReason, isCut, jobSettings, jobsOf, leftOf, lineAmount, nextBillNo, nextChallanNo, nextOrderNo, orderDone, sentOf, unbilled } from "@/lib/stone/jobwork";
import type { JobBill, JobBillLine, JobBlock, JobCut, JobDispatch, JobExtra, JobOrder, Party, StoneType } from "@/lib/stone/types";
import type { Ctx } from "./StoneApp";
import { Area, Badge, Drawer, F, Grid, Note, NumIn, Pick, Section, Sel, Seg, Stat, Table, TextIn, readPhoto, setUrlTab, type Col } from "./ui";

type Tab = "open" | "ready" | "bills" | "all";
type Page = { kind: "order"; id: string } | { kind: "edit"; id: string | null } | { kind: "dispatch"; id: string } | { kind: "bill"; id: string };

const STONE: StoneType[] = ["marble", "granite", "sandstone", "quartzite", "onyx", "other"];

/** Customers' blocks cut for a charge: orders, delivery challans back and cutting bills. */
export default function JobWork({ ctx }: { ctx: Ctx }) {
  const { db, update } = ctx;
  const orders = jobsOf(db);
  // A link may name an order ("jobwork:<id>"), ask for a new one ("jobwork:new") or a list ("jobwork:ready")
  const arg = ctx.sub.split(":")[1] ?? "";
  const [tab, setTab] = useState<Tab>(["ready", "bills", "all"].includes(arg) ? (arg as Tab) : "open");
  const [page, setPage] = useState<Page | null>(arg === "new" && ctx.edit("jobwork") ? { kind: "edit", id: null } : orders.some((o) => o.id === arg) ? { kind: "order", id: arg } : null);
  const [printBill, setPrintBill] = useState<{ o: string; b: string } | null>(null);
  useEffect(() => { if (arg) setUrlTab("jobwork"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cust = (id: string) => ctx.root.parties.find((p) => p.id === id);
  const open = orders.filter((o) => !orderDone(o));
  const atUnit = orders.flatMap((o) => o.blocks.filter((b) => b.status === "in_yard" || b.status === "on_saw" || b.status === "cut"));
  const ready = orders.flatMap((o) => o.blocks.filter((b) => b.status === "cut" && leftOf(o, b).slabs + leftOf(o, b).broken > 0).map((b) => ({ id: b.id, o, b })));
  const toBill = orders.flatMap((o) => { const bl = unbilled(o); return bl.length ? [autoLines(o, bl, today()).reduce((a, l) => a + lineAmount(l), 0)] : []; }).reduce((a, x) => a + x, 0);
  const bills = orders.flatMap((o) => o.bills.map((b) => ({ id: b.id, o, b })));
  const totalOf = (o: JobOrder, b: JobBill) => billTotals(b, db.settings.state, cust(o.customerId)?.state || db.settings.state).total;
  const toCollect = bills.filter((x) => !x.b.paid).reduce((a, x) => a + totalOf(x.o, x.b), 0);
  const cut30 = orders.flatMap((o) => o.blocks).filter((b) => b.cut && daysSince(b.cut.finishedOn) <= 30);

  const markPaid = (o: JobOrder, b: JobBill) => update((d) => { const x = jobsOf(d).find((y) => y.id === o.id)?.bills.find((y) => y.id === b.id); if (x) { x.paid = !x.paid; x.paidOn = x.paid ? today() : ""; } });

  if (page?.kind === "edit") return <OrderForm ctx={ctx} initial={page.id ? orders.find((o) => o.id === page.id) ?? null : null} onClose={(id) => setPage(id ? { kind: "order", id } : page.id ? { kind: "order", id: page.id } : null)} />;
  const po = page ? orders.find((o) => o.id === page.id) : undefined;
  if (page?.kind === "dispatch" && po) return <DispatchForm ctx={ctx} order={po} onClose={() => setPage({ kind: "order", id: po.id })} />;
  if (page?.kind === "bill" && po) return <BillForm ctx={ctx} order={po} onClose={(billId) => { setPage({ kind: "order", id: po.id }); if (billId) setPrintBill({ o: po.id, b: billId }); }} />;
  if (page?.kind === "order" && po) return (
    <>
      <OrderPage ctx={ctx} order={po} onClose={() => setPage(null)} onEdit={() => setPage({ kind: "edit", id: po.id })} onDispatch={() => setPage({ kind: "dispatch", id: po.id })} onBill={() => setPage({ kind: "bill", id: po.id })} onPrintBill={(b) => setPrintBill({ o: po.id, b })} onPaid={(b) => markPaid(po, b)} />
      {printBill && <BillPrint ctx={ctx} order={orders.find((o) => o.id === printBill.o)!} bill={orders.find((o) => o.id === printBill.o)!.bills.find((b) => b.id === printBill.b)!} onClose={() => setPrintBill(null)} />}
    </>
  );

  const status = (o: JobOrder) => {
    if (o.closed) return <Badge>Closed</Badge>;
    if (orderDone(o)) return <Badge tone="good">Completed</Badge>;
    const c = (s: JobBlock["status"]) => o.blocks.filter((b) => b.status === s).length;
    const parts = ([["expected", "to arrive"], ["in_yard", "in yard"], ["on_saw", "on saw"], ["cut", "cut"]] as const).filter(([k]) => c(k)).map(([k, l]) => `${c(k)} ${l}`);
    return <span className="text-[0.84rem] text-ink-2">{parts.join(" · ") || "All sent back"}{unbilled(o).length ? <span className="text-warn"> · {unbilled(o).length} to bill</span> : null}</span>;
  };
  const orderCols: Col<JobOrder>[] = [
    { key: "no", label: "Order", render: (o) => <div><div className="whitespace-nowrap font-medium">{o.no}</div><div className="text-[0.8rem] text-ink-3">{dmy(o.date)}</div></div>, sort: (o) => o.date },
    { key: "c", label: "Customer", render: (o) => <div><div>{cust(o.customerId)?.company ?? "—"}</div><div className="text-[0.8rem] text-ink-3">{o.thicknessMm} mm {o.finish.toLowerCase()} · {rs2(o.rate)}/sq ft</div></div>, sort: (o) => cust(o.customerId)?.company ?? "" },
    { key: "b", label: "Blocks", align: "right", render: (o) => o.blocks.length },
    { key: "q", label: "Cut sq ft", align: "right", render: (o) => n0(o.blocks.reduce((a, b) => a + (b.cut?.sqft ?? 0), 0)) },
    { key: "s", label: "Sent back", align: "right", render: (o) => n0(o.blocks.reduce((a, b) => a + sentOf(o, b.id).sqft, 0)) },
    { key: "bl", label: "Billed", align: "right", render: (o) => rs(o.bills.reduce((a, b) => a + totalOf(o, b), 0)) },
    { key: "st", label: "Status", render: status },
  ];
  const readyCols: Col<{ id: string; o: JobOrder; b: JobBlock }>[] = [
    { key: "b", label: "Block", render: ({ b }) => <div><div className="font-medium">{b.no}</div><div className="text-[0.8rem] text-ink-3">{b.variety}</div></div> },
    { key: "c", label: "Customer", render: ({ o }) => <div><div>{cust(o.customerId)?.company}</div><div className="text-[0.8rem] text-ink-3">{o.no}</div></div> },
    { key: "s", label: "Slabs waiting", align: "right", render: ({ o, b }) => { const l = leftOf(o, b); return <div><div>{l.slabs} · {n0(l.sqft)} sq ft</div>{l.broken > 0 && <div className="text-[0.78rem] text-ink-3">{l.broken} broken</div>}</div>; } },
    { key: "d", label: "Cut", align: "right", render: ({ b }) => <span className={daysSince(b.cut!.finishedOn) > 7 ? "text-warn" : ""}>{daysSince(b.cut!.finishedOn)} d ago</span>, sort: ({ b }) => daysSince(b.cut!.finishedOn) },
    { key: "bl", label: "Bill", render: ({ o, b }) => (billedIds(o).has(b.id) ? <Badge tone="good">Billed</Badge> : <Badge tone="warn">Not billed</Badge>) },
  ];
  const billCols: Col<{ id: string; o: JobOrder; b: JobBill }>[] = [
    { key: "n", label: "Bill", render: ({ b }) => <div><div className="font-medium">{b.invoiceNo}</div><div className="text-[0.8rem] text-ink-3">{dmy(b.date)}</div></div>, sort: ({ b }) => b.date },
    { key: "c", label: "Customer", render: ({ o }) => <div><div>{cust(o.customerId)?.company}</div><div className="text-[0.8rem] text-ink-3">{o.no}</div></div> },
    { key: "t", label: "Total", align: "right", render: ({ o, b }) => rs(totalOf(o, b)), sort: ({ o, b }) => totalOf(o, b) },
    { key: "p", label: "Payment", render: ({ o, b }) => { const late = !b.paid && daysSince(b.date) > (cust(o.customerId)?.creditDays ?? 30); return b.paid ? <Badge tone="good">Received {b.paidOn ? dmy(b.paidOn) : ""}</Badge> : <Badge tone={late ? "neg" : "warn"}>{late ? "Overdue" : "Due"}</Badge>; } },
    { key: "a", label: "", render: ({ o, b }) => (
      <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
        <button className="btn btn-quiet btn-sm" onClick={() => setPrintBill({ o: o.id, b: b.id })}><Printer size={13} />Bill</button>
        {ctx.edit("jobwork") && <button className="btn btn-quiet btn-sm" onClick={() => markPaid(o, b)}>{b.paid ? "Mark unpaid" : "Payment received"}</button>}
      </div>
    ) },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Customer blocks at the unit" value={`${atUnit.length} · ${n0(atUnit.reduce((a, b) => a + b.tonnes, 0))} t`} sub={`${orders.flatMap((o) => o.blocks).filter((b) => b.status === "expected").length} still to arrive`} />
        <Stat label="Cut, last 30 days" value={`${n0(cut30.reduce((a, b) => a + (b.cut?.sqft ?? 0), 0))} sq ft`} sub={`${cut30.length} blocks · ${n0(cut30.reduce((a, b) => a + (b.cut?.brokenSqft ?? 0), 0))} sq ft broken`} />
        <Stat label="Slabs waiting to go back" value={`${n0(ready.reduce((a, x) => a + leftOf(x.o, x.b).sqft, 0))} sq ft`} sub={`${ready.length} block${ready.length === 1 ? "" : "s"}`} tone={ready.some((x) => daysSince(x.b.cut!.finishedOn) > 7) ? "warn" : undefined} />
        <Stat label="To collect" value={lakh(toCollect)} sub={toBill > 0 ? `${lakh(toBill)} of cutting not billed yet` : "All cut work is billed"} tone={toBill > 0 ? "warn" : undefined} />
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Seg value={tab} onChange={setTab} tabs={[
          { key: "open", label: "Open orders", count: open.length },
          { key: "ready", label: "Ready to send", count: ready.length },
          { key: "bills", label: "Bills", count: bills.length },
          { key: "all", label: "All orders", count: orders.length },
        ]} />
        <div className="ml-auto flex gap-2">
          {ctx.edit("jobwork") && <button className="btn btn-primary btn-sm" onClick={() => setPage({ kind: "edit", id: null })}><Plus size={15} />New job order</button>}
        </div>
      </div>
      <div className="mt-4">
        {(tab === "open" || tab === "all") && <Table rows={[...(tab === "open" ? open : orders)].reverse()} cols={orderCols} onRow={(o) => setPage({ kind: "order", id: o.id })} search={(o) => `${o.no} ${cust(o.customerId)?.company ?? ""} ${o.blocks.map((b) => `${b.no} ${b.variety} ${b.vehicleNo}`).join(" ")}`} empty={tab === "open" ? "No open job orders. When a customer sends a block to cut, make a job order for it." : "No job orders yet."} />}
        {tab === "ready" && <Table rows={ready} cols={readyCols} onRow={(x) => setPage({ kind: "order", id: x.o.id })} search={(x) => `${x.b.no} ${x.o.no} ${cust(x.o.customerId)?.company ?? ""}`} empty="Nothing waiting. Slabs show here once they come off the saw." />}
        {tab === "bills" && <Table rows={[...bills].reverse()} cols={billCols} search={(x) => `${x.b.invoiceNo} ${x.o.no} ${cust(x.o.customerId)?.company ?? ""}`} empty="No job work bills yet." />}
      </div>
      {printBill && <BillPrint ctx={ctx} order={orders.find((o) => o.id === printBill.o)!} bill={orders.find((o) => o.id === printBill.o)!.bills.find((b) => b.id === printBill.b)!} onClose={() => setPrintBill(null)} />}
    </div>
  );
}

// ─── One order: its blocks, what came off the saw, what went back and what was billed ───

function OrderPage({ ctx, order: o, onClose, onEdit, onDispatch, onBill, onPrintBill, onPaid }: { ctx: Ctx; order: JobOrder; onClose: () => void; onEdit: () => void; onDispatch: () => void; onBill: () => void; onPrintBill: (billId: string) => void; onPaid: (b: JobBill) => void }) {
  const { db, update } = ctx;
  const c = ctx.root.parties.find((p) => p.id === o.customerId);
  const [recv, setRecv] = useState<JobBlock | null>(null);
  const [cut, setCut] = useState<JobBlock | null>(null);
  const [challan, setChallan] = useState<JobDispatch | null>(null);
  const can = ctx.edit("jobwork");
  const floor = ctx.edit("processing");
  const done = billedIds(o);
  const left = o.blocks.filter((b) => b.status === "cut" && (leftOf(o, b).slabs + leftOf(o, b).broken > 0));
  const toBill = unbilled(o);
  const total = (b: JobBill) => billTotals(b, db.settings.state, c?.state || db.settings.state).total;
  const setStatus = (id: string, s: JobBlock["status"]) => update((d) => { const b = jobsOf(d).find((x) => x.id === o.id)?.blocks.find((x) => x.id === id); if (b) b.status = s; });
  const good = o.blocks.reduce((a, b) => a + (b.cut?.sqft ?? 0), 0);
  const broken = o.blocks.reduce((a, b) => a + (b.cut?.brokenSqft ?? 0), 0);
  const sent = o.blocks.reduce((a, b) => a + sentOf(o, b.id).sqft, 0);

  const blockCols: Col<JobBlock>[] = [
    { key: "no", label: "Block", render: (b) => <div><div className="font-medium">{b.no}</div><div className="text-[0.8rem] text-ink-3">{b.variety}{b.l ? ` · ${b.l}×${b.w}×${b.h} cm` : ""}</div></div> },
    { key: "t", label: "Weight", align: "right", render: (b) => (b.tonnes ? `${n2(b.tonnes)} t` : "—") },
    { key: "r", label: "Arrived", render: (b) => (b.receivedOn ? <div><div>{dmy(b.receivedOn)}</div><div className="text-[0.8rem] text-ink-3">{b.vehicleNo}{b.challanNo ? ` · DC ${b.challanNo}` : ""}</div></div> : "—") },
    { key: "c", label: "Off the saw", align: "right", render: (b) => (b.cut ? <div><div>{b.cut.slabs} slabs · {n0(b.cut.sqft)} sq ft</div>{b.cut.brokenSlabs > 0 && <div className="text-[0.78rem] text-warn">{b.cut.brokenSlabs} broken · {n0(b.cut.brokenSqft)} sq ft</div>}</div> : "—") },
    { key: "s", label: "Sent back", align: "right", render: (b) => { const s = sentOf(o, b.id); return b.cut ? `${s.slabs} · ${n0(s.sqft)} sq ft` : "—"; } },
    { key: "st", label: "Status", render: (b) => <div className="flex flex-wrap gap-1"><Badge tone={b.status === "expected" ? "warn" : b.status === "returned" ? "good" : b.status === "on_saw" ? "info" : "plain"}>{JOB_STATUS[b.status]}</Badge>{isCut(b) && !done.has(b.id) && <Badge tone="warn">Not billed</Badge>}</div> },
    { key: "a", label: "", render: (b) => (
      <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
        {b.status === "expected" && ctx.edit("blocks") && <button className="btn btn-quiet btn-sm" onClick={() => setRecv(b)}>Receive</button>}
        {b.status === "in_yard" && floor && <button className="btn btn-quiet btn-sm" onClick={() => setStatus(b.id, "on_saw")}><Play size={13} />Load on saw</button>}
        {b.status === "on_saw" && floor && <button className="btn btn-primary btn-sm" onClick={() => setCut(b)}><Scissors size={13} />Slabs out</button>}
        {b.status === "cut" && floor && !done.has(b.id) && !sentOf(o, b.id).slabs && <button className="btn btn-quiet btn-sm" onClick={() => setCut(b)}>Edit cut</button>}
      </div>
    ) },
  ];

  return (
    <Drawer open page wide title={`Job order ${o.no}`} sub={`${c?.company ?? "—"} · ${dmy(o.date)}${o.closed ? " · closed" : ""}`} onClose={onClose}
      footer={<>
        {can && left.length > 0 && <button className="btn btn-primary" onClick={onDispatch}><Truck size={15} />Send slabs back</button>}
        {can && toBill.length > 0 && <button className="btn btn-primary" onClick={onBill}><ReceiptText size={15} />Make bill</button>}
        {can && <button className="btn btn-quiet" onClick={onEdit}>Edit order</button>}
        <button className="btn btn-quiet" onClick={onClose}>Back</button>
        {can && <button className="btn btn-quiet btn-sm ml-auto" onClick={() => update((d) => { const x = jobsOf(d).find((y) => y.id === o.id); if (x) x.closed = !x.closed; })}>{o.closed ? "Reopen order" : "Close order"}</button>}
      </>}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Blocks" value={`${o.blocks.length} · ${n0(o.blocks.reduce((a, b) => a + b.tonnes, 0))} t`} sub={`${o.blocks.filter((b) => b.status === "expected").length} still to arrive`} />
        <Stat label="Good slabs cut" value={`${n0(good)} sq ft`} sub={broken ? `${n0(broken)} sq ft broken` : "Nothing broken"} tone={broken ? "warn" : undefined} />
        <Stat label="Sent back" value={`${n0(sent)} sq ft`} sub={`${o.dispatches.length} vehicle${o.dispatches.length === 1 ? "" : "s"}`} />
        <Stat label="Billed" value={rs(o.bills.reduce((a, b) => a + total(b), 0))} sub={toBill.length ? `${toBill.length} cut block${toBill.length > 1 ? "s" : ""} not billed` : `${rs(o.bills.filter((b) => !b.paid).reduce((a, b) => a + total(b), 0))} unpaid`} tone={toBill.length ? "warn" : undefined} />
      </div>

      <div className="mt-5 rounded-2xl bg-surface p-4 text-[0.9rem]">
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-3">
          <div><span className="text-ink-3">Cut to </span>{o.thicknessMm} mm · {o.finish}</div>
          <div><span className="text-ink-3">Cutting </span>{rs2(o.rate)}/sq ft of good slabs</div>
          <div><span className="text-ink-3">Off-cuts </span>{o.waste === "return" ? "go back to the customer" : "stay with us"}</div>
          {o.extras.filter((x) => x.label).length > 0 && <div className="sm:col-span-2"><span className="text-ink-3">Extras </span>{o.extras.filter((x) => x.label).map((x) => `${x.label} ${rs2(x.rate)}${x.basis === "sqft" ? "/sq ft" : x.basis === "slab" ? "/slab" : " once"}`).join(" · ")}</div>}
          <div><span className="text-ink-3">Yard rent </span>{o.rentPerDay > 0 ? `${rs(o.rentPerDay)}/block/day after ${o.freeDays} days` : "none"}</div>
        </div>
        {o.instructions && <div className="mt-3 border-t border-surface-2 pt-3"><span className="text-ink-3">Instructions </span>{o.instructions}</div>}
      </div>

      <Section title="Blocks">
        <Table rows={o.blocks} cols={blockCols} empty="No blocks on this order." />
        {o.blocks.some((b) => b.condition) && <ul className="mt-3 space-y-1 text-[0.84rem] text-ink-2">{o.blocks.filter((b) => b.condition).map((b) => <li key={b.id}><b>{b.no}</b> on arrival: {b.condition}</li>)}</ul>}
      </Section>

      {o.dispatches.length > 0 && (
        <Section title="Sent back">
          <ul className="divide-y divide-surface-2 rounded-2xl bg-surface">
            {o.dispatches.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-[180px] flex-1">
                  <div className="font-medium">{d.no} · {dmy(d.date)}</div>
                  <div className="text-[0.82rem] text-ink-3">{d.vehicleNo || "No vehicle no."}{d.shipTo ? ` · to ${d.shipTo.split("\n")[0]}` : ""}</div>
                  {d.release && <div className="text-[0.8rem] text-warn">Let go with {rs(d.release.dues)} due, by {d.release.by}: {d.release.reason}</div>}
                </div>
                <div className="text-[0.86rem] text-ink-2">{d.lines.reduce((a, l) => a + l.slabs, 0)} slabs · {n0(d.lines.reduce((a, l) => a + l.sqft, 0))} sq ft{d.lines.some((l) => l.broken) ? ` · ${d.lines.reduce((a, l) => a + l.broken, 0)} broken` : ""}</div>
                <button className="btn btn-quiet btn-sm" onClick={() => setChallan(d)}><Printer size={13} />Challan</button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {o.bills.length > 0 && (
        <Section title="Bills">
          <ul className="divide-y divide-surface-2 rounded-2xl bg-surface">
            {o.bills.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-[180px] flex-1">
                  <div className="font-medium">{b.invoiceNo} · {dmy(b.date)}</div>
                  <div className="text-[0.82rem] text-ink-3">Blocks {o.blocks.filter((x) => b.blockIds.includes(x.id)).map((x) => x.no).join(", ") || "—"}</div>
                </div>
                <div className="font-medium">{rs(total(b))}</div>
                {b.paid ? <Badge tone="good">Received</Badge> : <Badge tone="warn">Due</Badge>}
                <button className="btn btn-quiet btn-sm" onClick={() => onPrintBill(b.id)}><Printer size={13} />Bill</button>
                {can && <button className="btn btn-quiet btn-sm" onClick={() => onPaid(b)}>{b.paid ? "Mark unpaid" : "Payment received"}</button>}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {o.notes && <p className="mt-4 text-[0.86rem] text-ink-2">{o.notes}</p>}

      {recv && <ReceiveJobBlock ctx={ctx} order={o} block={recv} onClose={() => setRecv(null)} />}
      {cut && <JobCutForm ctx={ctx} order={o} block={cut} onClose={() => setCut(null)} />}
      {challan && <ChallanPrint ctx={ctx} order={o} d={challan} onClose={() => setChallan(null)} />}
    </Drawer>
  );
}

// ─── New or edited order ───

function OrderForm({ ctx, initial, onClose }: { ctx: Ctx; initial: JobOrder | null; onClose: (savedId?: string) => void }) {
  const { db, update } = ctx;
  const J = jobSettings(db.settings);
  const [o, setO] = useState<JobOrder>(() => initial ? structuredClone(initial) : {
    id: "", no: nextOrderNo(ctx.root), date: today(), customerId: "", thicknessMm: 18, finish: "As cut", instructions: "", rate: J.rate,
    extras: structuredClone(J.extras), waste: "return", freeDays: J.freeDays, rentPerDay: J.rentPerDay,
    blocks: [{ ...emptyJobBlock(), id: uid(), status: "in_yard", receivedOn: today() }], dispatches: [], bills: [], closed: false, notes: "",
  });
  const [err, setErr] = useState("");
  const set = <K extends keyof JobOrder>(k: K, v: JobOrder[K]) => setO((x) => ({ ...x, [k]: v }));
  const setBlock = (i: number, p: Partial<JobBlock>) => setO((x) => ({ ...x, blocks: x.blocks.map((b, j) => (j === i ? { ...b, ...p } : b)) }));
  const setExtra = (i: number, p: Partial<JobExtra>) => setO((x) => ({ ...x, extras: x.extras.map((e, j) => (j === i ? { ...e, ...p } : e)) }));
  const customers = db.parties.filter((p) => p.kind === "customer");
  const c = customers.find((p) => p.id === o.customerId);
  const quals = qualities(db);
  const locked = (b: JobBlock) => !!initial?.blocks.some((x) => x.id === b.id && (x.status === "on_saw" || isCut(x)));

  const save = () => {
    if (!o.customerId) return setErr("Choose the customer");
    if (!o.blocks.length) return setErr("Add at least one block");
    const bad = o.blocks.findIndex((b) => !b.no.trim());
    if (bad >= 0) return setErr(`Block ${bad + 1} needs its number`);
    const dup = o.blocks.map((b) => b.no.trim().toUpperCase()).find((n, i, a) => a.indexOf(n) !== i);
    if (dup) return setErr(`Block ${dup} is listed twice`);
    const id = o.id || uid();
    const clean: JobOrder = { ...o, id, extras: o.extras.filter((x) => x.label.trim()), blocks: o.blocks.map((b) => ({ ...b, no: b.no.trim(), receivedOn: b.status === "expected" ? "" : b.receivedOn || o.date })) };
    update((d) => { d.jobwork ??= []; const i = d.jobwork.findIndex((x) => x.id === id); if (i >= 0) d.jobwork[i] = clean; else d.jobwork.push(clean); });
    ctx.say(initial ? `${o.no} saved` : `Job order ${o.no} made`, "good");
    onClose(id);
  };
  const del = () => {
    if (!initial || initial.blocks.some((b) => b.status !== "expected" && b.status !== "in_yard") || initial.bills.length || initial.dispatches.length) return;
    update((d) => { d.jobwork = jobsOf(d).filter((x) => x.id !== initial.id); });
    ctx.say(`${initial.no} deleted`);
    onClose();
  };
  const canDelete = !!initial && !initial.bills.length && !initial.dispatches.length && initial.blocks.every((b) => b.status === "expected" || b.status === "in_yard");

  return (
    <Drawer open page wide title={initial ? `Job order ${o.no}` : "New job order"} sub="The customer's own block: it stays theirs. Only the cutting and the agreed extras are billed." onClose={() => onClose()}
      footer={<><button className="btn btn-primary" onClick={save}>{initial ? "Save" : "Make job order"}</button><button className="btn btn-quiet" onClick={() => onClose()}>Cancel</button>{err && <span className="text-sm text-neg">{err}</span>}{canDelete && <button className="btn btn-quiet btn-sm ml-auto !text-neg" onClick={del}><Trash2 size={14} />Delete order</button>}</>}>
      <Section title="Customer and terms">
        <Grid cols={3}>
          <F box span={2} label="Customer *" hint={!customers.length ? "Add the customer under Masters → Customers first" : c ? [c.city, c.gstin || "Unregistered", c.creditDays ? `${c.creditDays} credit days` : ""].filter(Boolean).join(" · ") : undefined}>
            <Pick align="left" onPick={(v) => set("customerId", v)} placeholder={c ? c.company : "Choose customer"} empty="No customer matches" options={customers.map((p) => ({ v: p.id, l: p.company, sub: [p.name, p.city].filter(Boolean).join(" · "), find: p.gstin }))} />
          </F>
          <F label="Order date"><TextIn type="date" value={o.date} onChange={(v) => set("date", v)} /></F>
          <F label="Slab thickness"><NumIn value={o.thicknessMm} onChange={(v) => set("thicknessMm", v)} suffix="mm" /></F>
          <F label="Finish"><Sel value={o.finish} onChange={(v) => set("finish", v)} options={FINISHES.map((x) => ({ v: x, l: x }))} /></F>
          <F label="Cutting rate" hint="Per sq ft of good slabs"><NumIn value={o.rate} onChange={(v) => set("rate", v)} suffix="₹/sq ft" /></F>
          <F label="Off-cuts and waste"><Sel value={o.waste} onChange={(v) => set("waste", v as JobOrder["waste"])} options={[{ v: "return", l: "Go back to the customer" }, { v: "keep", l: "Stay with us" }]} /></F>
          <F label="Free days at the unit"><NumIn value={o.freeDays} onChange={(v) => set("freeDays", v)} suffix="days" /></F>
          <F label="Yard rent after that" hint="0 = no rent"><NumIn value={o.rentPerDay} onChange={(v) => set("rentPerDay", v)} suffix="₹/block/day" /></F>
          <F span={3} label="Cutting instructions" hint="Sizes, calibration, edges, which face to polish: what the saw operator needs to know"><Area value={o.instructions} onChange={(v) => set("instructions", v)} /></F>
        </Grid>
      </Section>

      <Section title="Extra charges" aside={<button type="button" className="btn btn-quiet btn-sm" onClick={() => set("extras", [...o.extras, { label: "", basis: "sqft", rate: 0 }])}><Plus size={14} />Add charge</button>}>
        {o.extras.length === 0 && <p className="text-[0.86rem] text-ink-3">None. Add resin, polishing, netting, edge cutting or loading if they are charged on this order.</p>}
        <datalist id="jw-extras">{EXTRA_LABELS.map((x) => <option key={x} value={x} />)}</datalist>
        <div className="space-y-2">
          {o.extras.map((x, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[2fr_1.3fr_1fr_auto]">
              <TextIn value={x.label} onChange={(v) => setExtra(i, { label: v })} placeholder="Polishing" list="jw-extras" />
              <Sel value={x.basis} onChange={(v) => setExtra(i, { basis: v as JobExtra["basis"] })} options={[{ v: "sqft", l: "Per sq ft" }, { v: "slab", l: "Per slab" }, { v: "lump", l: "Once per bill" }]} />
              <NumIn value={x.rate} onChange={(v) => setExtra(i, { rate: v })} suffix="₹" />
              <button type="button" className="btn btn-quiet btn-sm !px-2" aria-label="Remove charge" onClick={() => set("extras", o.extras.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`Blocks · ${o.blocks.length}`} aside={<button type="button" className="btn btn-quiet btn-sm" onClick={() => set("blocks", [...o.blocks, { ...emptyJobBlock(), id: uid(), status: "in_yard", receivedOn: today(), variety: o.blocks[o.blocks.length - 1]?.variety ?? "" }])}><Plus size={14} />Add block</button>}>
        <datalist id="jw-quals">{quals.map((q) => <option key={q} value={q} />)}</datalist>
        <div className="space-y-3">
          {o.blocks.map((b, i) => (
            <div key={b.id} className="rounded-2xl bg-surface p-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <F label="Block no. *" hint="As marked by the customer"><TextIn value={b.no} onChange={(v) => setBlock(i, { no: v })} upper /></F>
                <F label="Quality"><TextIn value={b.variety} list="jw-quals" onChange={(v) => setBlock(i, { variety: v, stoneType: qualityOf(db, v)?.stoneType ?? b.stoneType })} /></F>
                <F label="Stone"><Sel value={b.stoneType} onChange={(v) => setBlock(i, { stoneType: v as StoneType })} options={STONE.map((x) => ({ v: x, l: x[0].toUpperCase() + x.slice(1) }))} /></F>
                <F label="Has it arrived?">{locked(b) ? <div className="field flex items-center text-ink-2">{JOB_STATUS[b.status]}</div> : <Sel value={b.status === "expected" ? "expected" : "in_yard"} onChange={(v) => setBlock(i, { status: v as JobBlock["status"], receivedOn: v === "in_yard" ? b.receivedOn || today() : "" })} options={[{ v: "in_yard", l: "Yes, in our yard" }, { v: "expected", l: "Not yet" }]} />}</F>
                <F label="Length"><NumIn value={b.l} onChange={(v) => setBlock(i, { l: v })} suffix="cm" /></F>
                <F label="Width"><NumIn value={b.w} onChange={(v) => setBlock(i, { w: v })} suffix="cm" /></F>
                <F label="Height"><NumIn value={b.h} onChange={(v) => setBlock(i, { h: v })} suffix="cm" /></F>
                <F label="Weight" hint={!b.tonnes && b.l && b.w && b.h ? `About ${n2(cbm(b) * db.settings.density)} t by size` : undefined}><NumIn value={b.tonnes} onChange={(v) => setBlock(i, { tonnes: v })} suffix="t" /></F>
                {b.status !== "expected" && <>
                  <F label="Arrived on"><TextIn type="date" value={b.receivedOn} onChange={(v) => setBlock(i, { receivedOn: v })} /></F>
                  <F label="Vehicle no."><TextIn value={b.vehicleNo} onChange={(v) => setBlock(i, { vehicleNo: v })} upper /></F>
                  <F label="Customer's challan no."><TextIn value={b.challanNo} onChange={(v) => setBlock(i, { challanNo: v })} upper /></F>
                  <F label="e-Way bill"><TextIn value={b.ewayBill} onChange={(v) => setBlock(i, { ewayBill: v })} /></F>
                </>}
                <F span={3} label="Condition on arrival" hint="Cracks, open veins, chipped edges: written down now so nobody argues later"><TextIn value={b.condition} onChange={(v) => setBlock(i, { condition: v })} /></F>
                <div className="flex items-end justify-end">
                  {!locked(b) && o.blocks.length > 1 && <button type="button" className="btn btn-quiet btn-sm !text-neg" onClick={() => set("blocks", o.blocks.filter((_, j) => j !== i))}><Trash2 size={14} />Remove</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Notes"><Area value={o.notes} onChange={(v) => set("notes", v)} placeholder="Anything else agreed with the customer" /></Section>
    </Drawer>
  );
}

// ─── Floor entries: receive a block, record what came off the saw ───

export function ReceiveJobBlock({ ctx, order, block, onClose }: { ctx: Ctx; order: JobOrder; block: JobBlock; onClose: () => void }) {
  const [b, setB] = useState<JobBlock>({ ...block, receivedOn: block.receivedOn || today() });
  const set = <K extends keyof JobBlock>(k: K, v: JobBlock[K]) => setB((x) => ({ ...x, [k]: v }));
  const save = () => {
    ctx.update((d) => { const o = jobsOf(d).find((x) => x.id === order.id); const i = o?.blocks.findIndex((x) => x.id === b.id) ?? -1; if (o && i >= 0) o.blocks[i] = { ...b, status: "in_yard" }; });
    ctx.say(`${b.no} received in the yard`, "good");
    onClose();
  };
  return (
    <Drawer open title={`Receive ${b.no}`} sub={`Customer's block · ${order.no}`} onClose={onClose}
      footer={<><button className="btn btn-primary" onClick={save}>Received in the yard</button><button className="btn btn-quiet" onClick={onClose}>Cancel</button></>}>
      <Grid>
        <F label="Arrived on"><TextIn type="date" value={b.receivedOn} onChange={(v) => set("receivedOn", v)} /></F>
        <F label="Weight"><NumIn value={b.tonnes} onChange={(v) => set("tonnes", v)} suffix="t" /></F>
        <F label="Vehicle no."><TextIn value={b.vehicleNo} onChange={(v) => set("vehicleNo", v)} upper /></F>
        <F label="Customer's challan no."><TextIn value={b.challanNo} onChange={(v) => set("challanNo", v)} upper /></F>
        <F label="e-Way bill"><TextIn value={b.ewayBill} onChange={(v) => set("ewayBill", v)} /></F>
        <F label="Size (L × W × H cm)"><div className="grid grid-cols-3 gap-1.5"><NumIn value={b.l} onChange={(v) => set("l", v)} /><NumIn value={b.w} onChange={(v) => set("w", v)} /><NumIn value={b.h} onChange={(v) => set("h", v)} /></div></F>
        <F span={2} label="Condition on arrival" hint="Cracks, open veins, chipped edges"><Area value={b.condition} onChange={(v) => set("condition", v)} /></F>
        <F span={2} label="Photos">
          <input type="file" accept="image/*" multiple className="text-sm" onChange={async (e) => { const fs = [...(e.target.files ?? [])]; const ps = await Promise.all(fs.map((f) => readPhoto(f))); set("photos", [...b.photos, ...ps]); }} />
          {b.photos.length > 0 && <div className="mt-2 text-[0.8rem] text-ink-3">{b.photos.length} photo{b.photos.length > 1 ? "s" : ""}</div>}
        </F>
      </Grid>
    </Drawer>
  );
}

/** Slabs out for a customer's block. Also used from the Production floor. */
export function JobCutForm({ ctx, order, block, onClose }: { ctx: Ctx; order: JobOrder; block: JobBlock; onClose: () => void }) {
  const S = ctx.db.settings;
  const [c, setC] = useState<JobCut>(() => block.cut ? { ...block.cut } : { machine: S.machines[0] ?? "Gang saw 1", startedOn: today(), finishedOn: today(), thicknessMm: order.thicknessMm, finish: order.finish, slabs: 0, sqft: 0, slabL: block.l, slabW: block.h, brokenSlabs: 0, brokenSqft: 0, hours: 0, note: "" });
  const [err, setErr] = useState("");
  const set = <K extends keyof JobCut>(k: K, v: JobCut[K]) => setC((x) => ({ ...x, [k]: v }));
  const per = c.slabL && c.slabW ? (c.slabL * c.slabW) / 929.0304 : 0;
  const save = () => {
    if (!c.slabs && !c.brokenSlabs) return setErr("How many slabs came off?");
    if (c.slabs && !c.sqft) return setErr("Fill the sq ft of good slabs");
    ctx.update((d) => { const b = jobsOf(d).find((x) => x.id === order.id)?.blocks.find((x) => x.id === block.id); if (b) { b.cut = { ...c, sqft: r2(c.sqft), brokenSqft: r2(c.brokenSqft) }; b.status = c.slabs || order.waste === "return" ? "cut" : "returned"; } });
    ctx.say(`${block.no}: ${c.slabs} slabs ready to go back`, "good");
    onClose();
  };
  return (
    <Drawer open title={`Slabs out · ${block.no}`} sub={`${ctx.root.parties.find((p) => p.id === order.customerId)?.company ?? ""} · ${order.no}${order.instructions ? ` · ${order.instructions}` : ""}`} onClose={onClose}
      footer={<><button className="btn btn-primary" onClick={save}>Save slabs out</button><button className="btn btn-quiet" onClick={onClose}>Cancel</button>{err && <span className="text-sm text-neg">{err}</span>}</>}>
      <Grid>
        <F label="Machine"><Sel value={c.machine} onChange={(v) => set("machine", v)} options={[...new Set([...S.machines, c.machine])].filter(Boolean).map((m) => ({ v: m, l: m }))} /></F>
        <F label="Hours on the saw"><NumIn value={c.hours} onChange={(v) => set("hours", v)} suffix="h" /></F>
        <F label="Started"><TextIn type="date" value={c.startedOn} onChange={(v) => set("startedOn", v)} /></F>
        <F label="Finished"><TextIn type="date" value={c.finishedOn} onChange={(v) => set("finishedOn", v)} /></F>
        <F label="Thickness"><NumIn value={c.thicknessMm} onChange={(v) => set("thicknessMm", v)} suffix="mm" /></F>
        <F label="Finish"><Sel value={c.finish} onChange={(v) => set("finish", v)} options={[...new Set([...FINISHES, c.finish])].map((x) => ({ v: x, l: x }))} /></F>
      </Grid>
      <Section title="Good slabs">
        <Grid cols={3}>
          <F label="Slabs"><NumIn value={c.slabs} onChange={(v) => setC((x) => ({ ...x, slabs: v, sqft: per ? r2(v * per) : x.sqft }))} /></F>
          <F label="Average length"><NumIn value={c.slabL} onChange={(v) => setC((x) => ({ ...x, slabL: v, sqft: v && x.slabW ? r2((x.slabs * v * x.slabW) / 929.0304) : x.sqft }))} suffix="cm" /></F>
          <F label="Average height"><NumIn value={c.slabW} onChange={(v) => setC((x) => ({ ...x, slabW: v, sqft: v && x.slabL ? r2((x.slabs * x.slabL * v) / 929.0304) : x.sqft }))} suffix="cm" /></F>
          <F label="Total sq ft" hint="Worked out from the size; type the measured figure if different"><NumIn value={c.sqft} onChange={(v) => set("sqft", v)} suffix="sq ft" /></F>
        </Grid>
      </Section>
      <Section title="Broken or cracked while cutting">
        <Grid cols={3}>
          <F label="Pieces"><NumIn value={c.brokenSlabs} onChange={(v) => setC((x) => ({ ...x, brokenSlabs: v, brokenSqft: per && !x.brokenSqft ? r2(v * per) : x.brokenSqft }))} /></F>
          <F label="Sq ft"><NumIn value={c.brokenSqft} onChange={(v) => set("brokenSqft", v)} suffix="sq ft" /></F>
        </Grid>
        <p className="mt-2 text-[0.82rem] text-ink-3">Broken slabs are not billed on their own. If they should be, add the charge on the bill with the reason.</p>
        <div className="mt-3"><F label="Note"><TextIn value={c.note} onChange={(v) => set("note", v)} placeholder="Why they broke: hidden crack, vein, blade" /></F></div>
      </Section>
    </Drawer>
  );
}

// ─── Slabs going back ───

function DispatchForm({ ctx, order: o, onClose }: { ctx: Ctx; order: JobOrder; onClose: () => void }) {
  const { db, update } = ctx;
  const c = ctx.root.parties.find((p) => p.id === o.customerId);
  const cands = o.blocks.filter((b) => b.status === "cut" && leftOf(o, b).slabs + leftOf(o, b).broken > 0);
  const [d, setD] = useState<JobDispatch>(() => ({
    id: "", no: nextChallanNo(ctx.root, db.settings), date: today(), vehicleNo: "", driver: "", driverPhone: "", transporterId: "", ewayBill: "", value: 0, shipTo: "", offcuts: "", notes: "",
    lines: cands.map((b) => { const l = leftOf(o, b); return { blockId: b.id, slabs: l.slabs, sqft: l.sqft, broken: o.waste === "return" ? l.broken : 0 }; }),
  }));
  const [other, setOther] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const set = <K extends keyof JobDispatch>(k: K, v: JobDispatch[K]) => setD((x) => ({ ...x, [k]: v }));
  const setLine = (i: number, p: Partial<JobDispatch["lines"][number]>) => setD((x) => ({ ...x, lines: x.lines.map((l, j) => (j === i ? { ...l, ...p } : l)) }));
  const hold = holdReason(ctx.root, c);
  const owner = ctx.mode === "demo" || !!ctx.me?.isOwner;
  const done = billedIds(o);
  const notBilled = d.lines.filter((l) => (l.slabs || l.broken) && !done.has(l.blockId)).map((l) => o.blocks.find((b) => b.id === l.blockId)?.no);
  const transporters = db.parties.filter((p) => p.kind === "transporter");

  const save = () => {
    const lines = d.lines.filter((l) => l.slabs > 0 || l.broken > 0);
    if (!lines.length) return setErr("Nothing is going on this vehicle");
    for (const l of lines) {
      const b = o.blocks.find((x) => x.id === l.blockId)!;
      const left = leftOf(o, b);
      if (l.slabs > left.slabs) return setErr(`${b.no} has only ${left.slabs} slabs left`);
      if (l.broken > left.broken) return setErr(`${b.no} has only ${left.broken} broken pieces left`);
    }
    if (!d.vehicleNo.trim()) return setErr("Fill the vehicle no.");
    if (hold && !owner) return setErr("Dues are pending. Ask the owner to let this go.");
    if (hold && !reason.trim()) return setErr("Write why it is going with dues pending");
    const id = uid();
    const rec: JobDispatch = { ...d, id, lines, shipTo: other ? d.shipTo : "", ...(hold ? { release: { by: ctx.me?.name ?? "Owner", reason: reason.trim(), dues: hold.dues } } : {}) };
    update((x) => {
      const ord = jobsOf(x).find((y) => y.id === o.id);
      if (!ord) return;
      ord.dispatches.push(rec);
      for (const b of ord.blocks) { const l = leftOf(ord, b); if (b.status === "cut" && l.slabs === 0 && (l.broken === 0 || ord.waste === "keep")) b.status = "returned"; }
    });
    ctx.say(`${d.no} saved: ${lines.reduce((a, l) => a + l.slabs, 0)} slabs going back`, "good");
    onClose();
  };

  return (
    <Drawer open page wide title="Send slabs back" sub={`${c?.company ?? ""} · ${o.no} · delivery challan ${d.no}`} onClose={onClose}
      footer={<><button className="btn btn-primary" disabled={!!hold && !owner} onClick={save}><Truck size={15} />Save challan</button><button className="btn btn-quiet" onClick={onClose}>Cancel</button>{err && <span className="text-sm text-neg">{err}</span>}</>}>
      {hold && (
        <div className="mb-4">
          <Note tone="neg">{c?.company} has {hold.text}. {owner ? "You can let this vehicle go: write why below." : "Only the owner can let slabs go with dues pending."}</Note>
          {owner && <div className="mt-3 max-w-xl"><F label="Why it can go *"><TextIn value={reason} onChange={setReason} placeholder="Payment promised by cheque on Friday" /></F></div>}
        </div>
      )}
      {notBilled.length > 0 && <div className="mb-4"><Note tone="warn">Not billed yet: {notBilled.join(", ")}. You can bill after they leave, but the customer may not pay for slabs already delivered.</Note></div>}
      <Section title="What goes on this vehicle">
        <div className="space-y-2">
          {d.lines.map((l, i) => {
            const b = o.blocks.find((x) => x.id === l.blockId)!;
            const left = leftOf(o, b);
            const per = left.slabs ? left.sqft / left.slabs : 0;
            return (
              <div key={l.blockId} className="grid items-end gap-3 rounded-2xl bg-surface p-4 sm:grid-cols-4">
                <div><div className="font-medium">{b.no}</div><div className="text-[0.8rem] text-ink-3">{b.variety} · {left.slabs} slabs, {n0(left.sqft)} sq ft{left.broken ? `, ${left.broken} broken` : ""} at the unit</div></div>
                <F label="Good slabs"><NumIn value={l.slabs} onChange={(v) => setLine(i, { slabs: v, sqft: v === left.slabs ? left.sqft : r2(v * per) })} /></F>
                <F label="Sq ft"><NumIn value={l.sqft} onChange={(v) => setLine(i, { sqft: v })} suffix="sq ft" /></F>
                <F label="Broken pieces" hint={o.waste === "keep" ? "Off-cuts stay with us on this order" : undefined}><NumIn value={l.broken} onChange={(v) => setLine(i, { broken: v })} /></F>
              </div>
            );
          })}
        </div>
      </Section>
      <Section title="Vehicle">
        <Grid cols={3}>
          <F label="Date"><TextIn type="date" value={d.date} onChange={(v) => set("date", v)} /></F>
          <F label="Vehicle no. *"><TextIn value={d.vehicleNo} onChange={(v) => set("vehicleNo", v)} upper /></F>
          <F label="Transporter"><Sel value={d.transporterId} onChange={(v) => set("transporterId", v)} placeholder="Customer's own vehicle" options={transporters.map((p) => ({ v: p.id, l: p.company }))} /></F>
          <F label="Driver"><TextIn value={d.driver} onChange={(v) => set("driver", v)} /></F>
          <F label="Driver's phone"><TextIn value={d.driverPhone} onChange={(v) => set("driverPhone", v)} /></F>
          <F label="e-Way bill"><TextIn value={d.ewayBill} onChange={(v) => set("ewayBill", v)} /></F>
          <F label="Value of the goods" hint="The customer's slabs, for the challan and e-way bill"><NumIn value={d.value} onChange={(v) => set("value", v)} suffix="₹" /></F>
          {o.waste === "return" && <F span={2} label="Off-cuts and waste on this vehicle"><TextIn value={d.offcuts} onChange={(v) => set("offcuts", v)} placeholder="2 side pieces, 1 top slice" /></F>}
        </Grid>
      </Section>
      <Section title="Deliver to">
        <label className="flex items-center gap-2 text-[0.9rem]"><input type="checkbox" checked={other} onChange={(e) => setOther(e.target.checked)} />Somewhere other than the customer&apos;s own address</label>
        {!other && <p className="mt-2 text-[0.86rem] text-ink-2">{c?.company}, {c?.shipping || [c?.billing, c?.city].filter(Boolean).join(", ")}</p>}
        {other && <div className="mt-3 max-w-xl"><F label="Name and address" hint="The customer's buyer or site, as they told you"><Area value={d.shipTo} onChange={(v) => set("shipTo", v)} rows={3} /></F></div>}
        <div className="mt-3 max-w-xl"><F label="Notes"><TextIn value={d.notes} onChange={(v) => set("notes", v)} /></F></div>
      </Section>
    </Drawer>
  );
}

// ─── Bill for the cutting ───

function BillForm({ ctx, order: o, onClose }: { ctx: Ctx; order: JobOrder; onClose: (billId?: string) => void }) {
  const { db, update } = ctx;
  const J = jobSettings(db.settings);
  const c = ctx.root.parties.find((p) => p.id === o.customerId);
  const cands = unbilled(o);
  const [ids, setIds] = useState<string[]>(cands.map((b) => b.id));
  const [date, setDate] = useState(today());
  const [auto, setAuto] = useState<JobBillLine[]>(() => autoLines(o, cands, today()));
  const [manual, setManual] = useState<JobBillLine[]>([]);
  const [gstRate, setGst] = useState(J.gstRate);
  const [sac, setSac] = useState(J.sac);
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  const picked = useMemo(() => cands.filter((b) => ids.includes(b.id)), [cands, ids]);
  const regen = (nextIds: string[], d = date) => { setIds(nextIds); setAuto(autoLines(o, cands.filter((b) => nextIds.includes(b.id)), d)); };
  const brokenSqft = r2(picked.reduce((a, b) => a + (b.cut?.brokenSqft ?? 0), 0));
  const draft: JobBill = { id: "", invoiceNo: nextBillNo(ctx.root, db.settings), date, blockIds: ids, lines: [...auto, ...manual], gstRate, sac, paid: false, notes };
  const t = billTotals(draft, db.settings.state, c?.state || db.settings.state);
  const setA = (i: number, p: Partial<JobBillLine>) => setAuto((x) => x.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const setM = (i: number, p: Partial<JobBillLine>) => setManual((x) => x.map((l, j) => (j === i ? { ...l, ...p } : l)));

  const save = () => {
    if (!ids.length) return setErr("Pick the blocks this bill is for");
    const m = manual.findIndex((l) => !l.note?.trim());
    if (m >= 0) return setErr(`Write the reason for "${manual[m].label || "the extra charge"}"`);
    if (t.taxable <= 0) return setErr("The bill has no amount");
    const id = uid();
    const bill: JobBill = { ...draft, id, lines: draft.lines.filter((l) => l.qty && l.rate) };
    update((d) => { jobsOf(d).find((x) => x.id === o.id)?.bills.push(bill); });
    ctx.say(`Bill ${bill.invoiceNo} made`, "good");
    onClose(id);
  };

  const row = (l: JobBillLine, i: number, setL: (i: number, p: Partial<JobBillLine>) => void, onDel?: () => void) => (
    <div key={`${l.kind}${i}`} className="grid items-start gap-2 rounded-2xl bg-surface p-3 sm:grid-cols-[2.4fr_1fr_1fr_1fr_auto]">
      <div>
        <TextIn value={l.label} onChange={(v) => setL(i, { label: v })} />
        {(l.kind === "broken" || l.kind === "other") && <div className="mt-2"><TextIn value={l.note ?? ""} onChange={(v) => setL(i, { note: v })} placeholder={l.kind === "broken" ? "Reason: why the customer pays for broken slabs *" : "Reason for this charge *"} /></div>}
      </div>
      <NumIn value={l.qty} onChange={(v) => setL(i, { qty: v })} suffix={l.unit} />
      <NumIn value={l.rate} onChange={(v) => setL(i, { rate: v })} suffix="₹" />
      <div className="field flex items-center justify-end">{rs2(lineAmount(l))}</div>
      {onDel ? <button type="button" className="btn btn-quiet btn-sm !px-2" aria-label="Remove line" onClick={onDel}><Trash2 size={14} /></button> : <span />}
    </div>
  );

  return (
    <Drawer open page wide title="Job work bill" sub={`${c?.company ?? ""} · ${o.no} · bill ${draft.invoiceNo}`} onClose={() => onClose()}
      footer={<><button className="btn btn-primary" onClick={save}>Save and view bill</button><button className="btn btn-quiet" onClick={() => onClose()}>Cancel</button><span className="text-sm text-ink-2">Total {rs(t.total)}</span>{err && <span className="text-sm text-neg">{err}</span>}</>}>
      <Section title="Blocks on this bill">
        <div className="flex flex-wrap gap-2">
          {cands.map((b) => (
            <label key={b.id} className="chip !h-auto cursor-pointer py-1.5" data-on={ids.includes(b.id)}>
              <input type="checkbox" className="mr-1.5" checked={ids.includes(b.id)} onChange={(e) => regen(e.target.checked ? [...ids, b.id] : ids.filter((x) => x !== b.id))} />
              {b.no} · {n0(b.cut?.sqft ?? 0)} sq ft{b.cut?.brokenSlabs ? ` · ${b.cut.brokenSlabs} broken` : ""}
            </label>
          ))}
        </div>
        <div className="mt-3 grid max-w-xl gap-3 sm:grid-cols-3">
          <F label="Bill date"><TextIn type="date" value={date} onChange={(v) => { setDate(v); regen(ids, v); }} /></F>
          <F label="GST rate"><NumIn value={gstRate} onChange={setGst} suffix="%" /></F>
          <F label="SAC"><TextIn value={sac} onChange={setSac} /></F>
        </div>
      </Section>
      <Section title="Charges" aside={<div className="flex flex-wrap gap-2">
        {brokenSqft > 0 && !manual.some((l) => l.kind === "broken") && <button type="button" className="btn btn-quiet btn-sm" onClick={() => setManual((x) => [...x, { kind: "broken", label: "Cutting of broken slabs", qty: brokenSqft, unit: "sq ft", rate: o.rate, note: "" }])}><Plus size={14} />Charge broken slabs</button>}
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => setManual((x) => [...x, { kind: "other", label: "", qty: 1, unit: "lump sum", rate: 0, note: "" }])}><Plus size={14} />Other charge</button>
      </div>}>
        <div className="space-y-2">
          {auto.map((l, i) => row(l, i, setA))}
          {manual.map((l, i) => row(l, i, setM, () => setManual((x) => x.filter((_, j) => j !== i))))}
        </div>
        {brokenSqft > 0 && !manual.some((l) => l.kind === "broken") && <p className="mt-2 text-[0.82rem] text-ink-3">{n0(brokenSqft)} sq ft broke while cutting and is not on the bill. Charge it only with a reason.</p>}
      </Section>
      <div className="ml-auto mt-5 w-full max-w-xs space-y-1 text-[0.92rem]">
        <div className="flex justify-between"><span>Taxable value</span><span>{rs2(t.taxable)}</span></div>
        {t.inter ? <div className="flex justify-between"><span>IGST @ {gstRate}%</span><span>{rs2(t.igst)}</span></div> : <><div className="flex justify-between"><span>CGST @ {gstRate / 2}%</span><span>{rs2(t.cgst)}</span></div><div className="flex justify-between"><span>SGST @ {gstRate / 2}%</span><span>{rs2(t.sgst)}</span></div></>}
        <div className="flex justify-between border-t border-surface-2 pt-1 text-base font-semibold"><span>Total</span><span>{rs(t.total)}</span></div>
      </div>
      <Section title="Notes"><TextIn value={notes} onChange={setNotes} /></Section>
    </Drawer>
  );
}

// ─── Printouts ───

function PartyBlock({ title, p, extra }: { title: string; p?: Party; extra?: string }) {
  return (
    <div>
      <div className="font-semibold">{title}</div>
      {extra ? <div className="whitespace-pre-line">{extra}</div> : <>
        <div>{p?.company}</div>
        <div>{p?.billing}{p?.city ? `, ${p.city}` : ""}{p?.pincode ? ` ${p.pincode}` : ""}</div>
        <div>GSTIN: {p?.gstin || "Unregistered"} · State {STATES[p?.state ?? ""] ?? "—"} ({p?.state})</div>
      </>}
    </div>
  );
}

function Head({ ctx, title, no, date }: { ctx: Ctx; title: string; no: string; date: string }) {
  const S = ctx.db.settings;
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/15 pb-4">
      <div>
        <div className="text-lg font-bold">{S.company}</div>
        <div>{S.address}</div>
        <div>{S.city}{S.pincode ? ` ${S.pincode}` : ""}, {STATES[S.state]}</div>
        <div>GSTIN: {S.gstin}</div>
      </div>
      <div className="text-right">
        <div className="text-base font-bold">{title}</div>
        <div>No. {no}</div>
        <div>Date {dmy(date)}</div>
      </div>
    </div>
  );
}

function ChallanPrint({ ctx, order: o, d, onClose }: { ctx: Ctx; order: JobOrder; d: JobDispatch; onClose: () => void }) {
  const c = ctx.root.parties.find((p) => p.id === o.customerId);
  const tr = ctx.root.parties.find((p) => p.id === d.transporterId);
  return (
    <Drawer open wide title={`Delivery challan ${d.no}`} onClose={onClose}
      footer={<><button className="btn btn-primary" onClick={() => window.print()}><Printer size={15} />Print or save PDF</button><button className="btn btn-quiet" onClick={onClose}>Close</button></>}>
      <div className="print-area rounded-2xl bg-white p-6 text-[13px] text-black">
        <Head ctx={ctx} title="DELIVERY CHALLAN · JOB WORK" no={d.no} date={d.date} />
        <div className="border-b border-black/15 py-2">Return of processed goods to the principal after job work (Rule 55 of the CGST Rules). Not a sale.</div>
        <div className="grid gap-4 border-b border-black/15 py-4 sm:grid-cols-2">
          <PartyBlock title="Principal (owner of the goods)" p={c} />
          <PartyBlock title="Deliver to" p={c} extra={d.shipTo || undefined} />
        </div>
        <table className="mt-3 w-full">
          <thead><tr className="border-b border-black/15 text-left"><th className="py-1.5">#</th><th>Description</th><th>HSN</th><th className="text-right">Slabs</th><th className="text-right">Sq ft</th></tr></thead>
          <tbody>
            {d.lines.map((l, i) => {
              const b = o.blocks.find((x) => x.id === l.blockId);
              return <tr key={l.blockId} className="border-b border-black/10"><td className="py-1.5">{i + 1}</td><td>{b?.variety} {b?.stoneType} slabs, {b?.cut?.thicknessMm ?? o.thicknessMm} mm {(b?.cut?.finish ?? o.finish).toLowerCase()}, from block {b?.no}{b?.challanNo ? ` (your challan ${b.challanNo})` : ""}{l.broken ? `; ${l.broken} broken piece${l.broken > 1 ? "s" : ""}` : ""}</td><td>6802</td><td className="text-right">{l.slabs}</td><td className="text-right">{n2(l.sqft)}</td></tr>;
            })}
          </tbody>
        </table>
        {d.offcuts && <div className="mt-2">Off-cuts / waste returned: {d.offcuts}</div>}
        <div className="mt-3 grid gap-1 sm:grid-cols-2">
          <div>Vehicle: {d.vehicleNo}{tr ? ` · ${tr.company}` : ""}</div>
          <div>Driver: {d.driver || "—"}{d.driverPhone ? ` · ${d.driverPhone}` : ""}</div>
          <div>e-Way bill: {d.ewayBill || "—"}</div>
          <div>Value of goods: {d.value ? rs(d.value) : "—"}</div>
          <div>Job order: {o.no}</div>
        </div>
        {d.notes && <div className="mt-2">{d.notes}</div>}
        <div className="mt-10 flex justify-between text-[12px]">
          <div>Received the above in good condition<div className="mt-8">Receiver&apos;s signature</div></div>
          <div className="text-right">For {ctx.db.settings.company}<div className="mt-8">Authorised signatory</div></div>
        </div>
      </div>
    </Drawer>
  );
}

function BillPrint({ ctx, order: o, bill: b, onClose }: { ctx: Ctx; order: JobOrder; bill: JobBill; onClose: () => void }) {
  const S = ctx.db.settings;
  const c = ctx.root.parties.find((p) => p.id === o.customerId);
  const t = billTotals(b, S.state, c?.state || S.state);
  return (
    <Drawer open wide title={`Bill ${b.invoiceNo}`} onClose={onClose}
      footer={<><button className="btn btn-primary" onClick={() => window.print()}><Printer size={15} />Print or save PDF</button><button className="btn btn-quiet" onClick={onClose}>Close</button>{b.paid && <span className="inline-flex items-center gap-1 text-sm text-accent"><CheckCircle2 size={15} />Payment received</span>}</>}>
      <div className="print-area rounded-2xl bg-white p-6 text-[13px] text-black">
        <Head ctx={ctx} title="TAX INVOICE · JOB WORK" no={b.invoiceNo} date={b.date} />
        <div className="grid gap-4 border-b border-black/15 py-4 sm:grid-cols-2">
          <PartyBlock title="Bill to" p={c} />
          <div>
            <div className="font-semibold">Job order {o.no}</div>
            <div>Place of supply: {STATES[c?.state ?? S.state]} ({c?.state ?? S.state})</div>
            <div>Blocks: {o.blocks.filter((x) => b.blockIds.includes(x.id)).map((x) => x.no).join(", ")}</div>
            <div>Goods belong to the customer; only job work charges are billed.</div>
          </div>
        </div>
        <table className="mt-3 w-full">
          <thead><tr className="border-b border-black/15 text-left"><th className="py-1.5">#</th><th>Description</th><th>SAC</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            {b.lines.map((l, i) => <tr key={i} className="border-b border-black/10"><td className="py-1.5">{i + 1}</td><td>{l.label}{l.note ? <div className="text-[11px] text-black/60">{l.note}</div> : null}</td><td>{b.sac}</td><td className="whitespace-nowrap pl-2 text-right">{n2(l.qty)} {l.unit}</td><td className="whitespace-nowrap pl-2 text-right">{rs2(l.rate)}</td><td className="whitespace-nowrap pl-2 text-right">{rs2(lineAmount(l))}</td></tr>)}
          </tbody>
        </table>
        <div className="ml-auto mt-3 w-full max-w-xs space-y-1">
          <div className="flex justify-between"><span>Taxable value</span><span>{rs2(t.taxable)}</span></div>
          {t.inter ? <div className="flex justify-between"><span>IGST @ {b.gstRate}%</span><span>{rs2(t.igst)}</span></div> : <><div className="flex justify-between"><span>CGST @ {b.gstRate / 2}%</span><span>{rs2(t.cgst)}</span></div><div className="flex justify-between"><span>SGST @ {b.gstRate / 2}%</span><span>{rs2(t.sgst)}</span></div></>}
          <div className="flex justify-between border-t border-black/20 pt-1 text-base font-bold"><span>Total</span><span>{rs(t.total)}</span></div>
        </div>
        <div className="mt-3 italic">{inWords(t.total)}</div>
        {b.notes && <div className="mt-2">{b.notes}</div>}
        <div className="mt-8 flex justify-between text-[12px]">
          <div>Subject to {S.city || "local"} jurisdiction.</div>
          <div className="text-right">For {S.company}<div className="mt-8">Authorised signatory</div></div>
        </div>
      </div>
    </Drawer>
  );
}
