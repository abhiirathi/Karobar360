"use client";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Phone, Plus, UserCheck } from "lucide-react";
import { n0, rs, uid } from "@/lib/stone/calc";
import type { Mark, Worker } from "@/lib/stone/types";
import type { Ctx } from "./StoneApp";
import { Toggle } from "./Team";
import { Area, Badge, Drawer, F, Grid, Note, NumIn, Section, Seg, Table, TextIn, type Col } from "./ui";

type Tab = "today" | "register" | "workers";

const pad = (n: number) => String(n).padStart(2, "0");
/** Local calendar date, so marking at 8 am in India is today, not yesterday. */
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shift = (date: string, days: number) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + days); return ymd(d); };
const longDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const TRADES = ["Gang saw operator", "Block cutter operator", "Wire saw operator", "Polisher", "Resin / epoxy", "Loader / crane", "Excavator operator", "Driller", "Helper", "Driver", "Supervisor", "Security"];
const SITES = ["Unit", "Mine", "Depot"];
const MARKS: { k: Mark; label: string; on: string }[] = [
  { k: "P", label: "Present", on: "bg-accent text-accent-ink" },
  { k: "H", label: "Half day", on: "bg-warn text-white" },
  { k: "A", label: "Absent", on: "bg-neg text-white" },
];
const CELL: Record<Mark, string> = { P: "bg-accent-soft text-accent", H: "bg-warn-soft text-warn", A: "bg-neg-soft text-neg" };

/** Days worked: a half day counts as half. */
const worked = (w: Worker, dates: string[]) => dates.reduce((a, d) => a + (w.att?.[d] === "P" ? 1 : w.att?.[d] === "H" ? 0.5 : 0), 0);
/** Day rate: monthly wage ÷ 30. */
const dayRate = (w: Worker) => (w.wageType === "month" ? w.rate / 30 : w.rate);

const emptyWorker = (): Worker => ({ id: "", name: "", phone: "", trade: "", site: "Unit", wageType: "day", rate: 0, joinedOn: ymd(new Date()), active: true, notes: "", att: {} });

/** The supervisor keeps a list of workers and marks each one present, half day or absent every day. */
export default function Labour({ ctx }: { ctx: Ctx }) {
  const { db, update } = ctx;
  const can = ctx.edit("labour");
  const C = ctx.costs;
  const all = db.labour ?? [];
  const active = all.filter((w) => w.active);
  const [tab, setTab] = useState<Tab>(ctx.sub === "register" || ctx.sub === "workers" ? (ctx.sub as Tab) : "today");
  const [form, setForm] = useState<Worker | null>(null);

  const save = (w: Worker) => update((d) => {
    d.labour ??= [];
    const i = d.labour.findIndex((x) => x.id === w.id);
    if (i >= 0) d.labour[i] = w; else d.labour.push({ ...w, id: uid() });
  });
  const remove = (id: string) => update((d) => { d.labour = (d.labour ?? []).filter((x) => x.id !== id); });

  return (
    <div>
      <p className="-mt-3 mb-5 text-ink-2">The supervisor marks each worker once a day. Monthly days worked{C ? " and wages" : ""} add up by themselves.</p>
      <div className="flex flex-wrap items-center gap-3">
        <Seg value={tab} onChange={setTab} tabs={[{ key: "today", label: "Mark attendance" }, { key: "register", label: "Monthly register" }, { key: "workers", label: "Workers", count: active.length }]} />
        {can && <button className="btn btn-quiet btn-sm ml-auto" onClick={() => setForm(emptyWorker())}><Plus size={15} />Add worker</button>}
      </div>
      <div className="mt-5">
        {tab === "today" && <MarkDay ctx={ctx} workers={active} can={can} onAdd={() => setForm(emptyWorker())} />}
        {tab === "register" && <Register workers={all} costs={C} />}
        {tab === "workers" && <Workers workers={all} costs={C} onOpen={setForm} />}
      </div>
      {form && <WorkerForm initial={form} can={can} costs={C} onClose={() => setForm(null)}
        onSave={(w) => { save(w); setForm(null); ctx.say(form.id ? "Worker saved" : `${w.name} added to the list`, "good"); }}
        onDelete={form.id && !Object.keys(form.att ?? {}).length ? () => { remove(form.id); setForm(null); } : undefined} />}
    </div>
  );
}

function MarkDay({ ctx, workers, can, onAdd }: { ctx: Ctx; workers: Worker[]; can: boolean; onAdd: () => void }) {
  const today = ymd(new Date());
  const [date, setDate] = useState(today);
  const [q, setQ] = useState("");
  const [site, setSite] = useState("all");
  const sites = [...new Set(workers.map((w) => w.site).filter(Boolean))];
  const shown = workers.filter((w) => (site === "all" || w.site === site) && `${w.name} ${w.trade} ${w.phone}`.toLowerCase().includes(q.toLowerCase()));
  const future = date > today;
  const count = (m: Mark) => shown.filter((w) => w.att?.[date] === m).length;
  const unmarked = shown.filter((w) => !w.att?.[date]);

  const mark = (ids: string[], m: Mark | null) => ctx.update((d) => {
    for (const w of d.labour ?? []) {
      if (!ids.includes(w.id)) continue;
      w.att ??= {};
      if (m) w.att[date] = m; else delete w.att[date];
    }
  });

  if (!workers.length) return (
    <div className="rounded-2xl bg-surface px-5 py-8 text-center">
      <UserCheck size={26} className="mx-auto text-accent" />
      <p className="mt-3 font-medium">No workers on the list yet</p>
      <p className="mt-1 text-[0.9rem] text-ink-2">Add your labour once: name, trade and wage. Then mark attendance here every day.</p>
      {can && <button className="btn btn-primary mt-4" onClick={onAdd}><Plus size={15} />Add the first worker</button>}
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-full bg-surface p-1">
          <button type="button" className="btn btn-quiet btn-sm !px-2" aria-label="Previous day" onClick={() => setDate(shift(date, -1))}><ChevronLeft size={16} /></button>
          <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="num bg-transparent px-1 text-[0.92rem] font-medium outline-none" aria-label="Date" />
          <button type="button" className="btn btn-quiet btn-sm !px-2" aria-label="Next day" disabled={date >= today} onClick={() => setDate(shift(date, 1))}><ChevronRight size={16} /></button>
        </div>
        {date !== today && <button type="button" className="chip" onClick={() => setDate(today)}>Back to today</button>}
        <span className="text-[0.88rem] text-ink-3">{longDate(date)}</span>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-3">
        <Tally label="Present" n={count("P")} tone="text-accent" />
        <Tally label="Half day" n={count("H")} tone="text-warn" />
        <Tally label="Absent" n={count("A")} tone={count("A") ? "text-neg" : ""} />
        <Tally label="Not marked" n={unmarked.length} tone={unmarked.length ? "text-warn" : "text-accent"} />
      </div>
      <p className="mt-2 text-[0.8rem] text-ink-3">{shown.length} workers{unmarked.length ? ` · ${unmarked.length} still to mark today` : " · all marked"}</p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or trade" className="field max-w-xs !py-2" />
        {sites.length > 1 && <Seg value={site} onChange={setSite} tabs={[{ key: "all", label: "All" }, ...sites.map((s) => ({ key: s, label: s, count: workers.filter((w) => w.site === s).length }))]} />}
        {can && !future && unmarked.length > 0 && <button className="btn btn-primary btn-sm ml-auto" onClick={() => mark(unmarked.map((w) => w.id), "P")}><UserCheck size={15} />Mark {unmarked.length} not marked as present</button>}
      </div>

      {future && <div className="mt-3"><Note tone="warn">This day hasn&apos;t come yet. Attendance can be marked for today or earlier.</Note></div>}

      <ul className="mt-3 divide-y divide-surface-2 overflow-hidden rounded-2xl bg-surface">
        {shown.map((w) => {
          const m = w.att?.[date];
          return (
            <li key={w.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[0.85rem] font-semibold ${m ? CELL[m] : "bg-surface-2 text-ink-2"}`}>{w.name.trim().charAt(0).toUpperCase() || "?"}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{w.name}</div>
                <div className="truncate text-[0.82rem] text-ink-3">{[w.trade, w.site].filter(Boolean).join(" · ")}</div>
              </div>
              <div role="radiogroup" aria-label={`Attendance for ${w.name}`} className="flex w-full gap-1 rounded-full bg-surface-2 p-1 sm:w-auto">
                {MARKS.map((x) => (
                  <button key={x.k} type="button" role="radio" aria-checked={m === x.k} disabled={!can || future}
                    onClick={() => mark([w.id], m === x.k ? null : x.k)}
                    className={`flex-1 rounded-full px-3 py-1.5 text-[0.84rem] font-medium transition-colors sm:flex-none ${m === x.k ? x.on : "text-ink-2 hover:bg-surface"} disabled:cursor-not-allowed`}>
                    {x.label}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
        {!shown.length && <li className="px-4 py-6 text-center text-[0.9rem] text-ink-3">No worker matches.</li>}
      </ul>
      {can && <p className="mt-2 text-[0.8rem] text-ink-3">Tap a marked button again to clear it.</p>}
    </div>
  );
}

function Tally({ label, n, tone }: { label: string; n: number; tone: string }) {
  return (
    <div className="rounded-2xl bg-surface px-3 py-2.5 sm:px-4 sm:py-3">
      <div className={`num text-[1.35rem] font-semibold leading-none sm:text-[1.6rem] ${tone}`}>{n0(n)}</div>
      <div className="mt-1 truncate text-[0.74rem] text-ink-2 sm:text-[0.84rem]">{label}</div>
    </div>
  );
}

function Register({ workers, costs }: { workers: Worker[]; costs: boolean }) {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}`);
  const [y, m] = month.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const dates = Array.from({ length: days }, (_, i) => `${month}-${pad(i + 1)}`);
  const today = ymd(now);
  const rows = workers.filter((w) => w.active || dates.some((d) => w.att?.[d]));
  const total = useMemo(() => rows.reduce((a, w) => a + worked(w, dates) * dayRate(w), 0), [rows, dates]);

  const csv = () => {
    const head = ["Worker", "Trade", "Site", ...dates.map((d) => d.slice(8)), "Present", "Half days", "Absent", "Days worked", ...(costs ? ["Wage basis", "Wage (Rs)"] : [])];
    const lines = rows.map((w) => {
      const c = (k: Mark) => dates.filter((d) => w.att?.[d] === k).length;
      return [w.name, w.trade, w.site, ...dates.map((d) => w.att?.[d] ?? ""), c("P"), c("H"), c("A"), worked(w, dates), ...(costs ? [w.wageType === "month" ? `${w.rate}/month` : `${w.rate}/day`, Math.round(worked(w, dates) * dayRate(w))] : [])];
    });
    const text = [head, ...lines].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    a.download = `attendance-${month}.csv`;
    a.click();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="field num w-auto !py-2" aria-label="Month" />
        <span className="flex flex-wrap gap-1.5 text-[0.78rem]">
          {MARKS.map((x) => <span key={x.k} className={`rounded-md px-1.5 py-0.5 font-semibold ${CELL[x.k]}`}>{x.k} {x.label.toLowerCase()}</span>)}
        </span>
        <button className="btn btn-quiet btn-sm ml-auto" onClick={csv}><Download size={14} />Download for payroll</button>
      </div>
      {costs && <p className="mt-2 text-[0.84rem] text-ink-2">Wages this month so far: <b className="num text-ink">{rs(Math.round(total))}</b>. Monthly wages are paid per day at the month&apos;s wage ÷ 30.</p>}
      <div className="scroll-thin mt-3 overflow-x-auto rounded-2xl bg-surface">
        <table className="w-full border-collapse text-[0.8rem]">
          <thead>
            <tr className="text-ink-3">
              <th className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-medium">Worker</th>
              <th className="px-2 py-2 text-right font-medium">Days</th>
              {costs && <th className="px-3 py-2 text-right font-medium">Wage</th>}
              {dates.map((d) => { const dow = new Date(`${d}T12:00:00`).getDay(); return <th key={d} className={`num min-w-[26px] px-0.5 py-2 text-center font-medium ${dow === 0 ? "text-ink-3/60" : ""} ${d === today ? "text-accent" : ""}`}>{Number(d.slice(8))}</th>; })}
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.id} className="border-t border-surface-2">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-surface px-3 py-1.5"><div className="font-medium">{w.name}</div><div className="text-[0.72rem] text-ink-3">{w.trade}</div></td>
                <td className="num px-2 py-1.5 text-right font-semibold">{worked(w, dates)}</td>
                {costs && <td className="num whitespace-nowrap border-r border-surface-2 px-3 py-1.5 text-right">{rs(Math.round(worked(w, dates) * dayRate(w)))}</td>}
                {dates.map((d) => { const k = w.att?.[d]; return <td key={d} className="px-0.5 py-1.5 text-center"><span className={`num inline-grid h-6 w-6 place-items-center rounded-md text-[0.72rem] font-semibold ${k ? CELL[k] : "text-ink-3/40"}`}>{k ?? "·"}</span></td>; })}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={days + 3} className="px-3 py-6 text-center text-ink-3">No workers yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Workers({ workers, costs, onOpen }: { workers: Worker[]; costs: boolean; onOpen: (w: Worker) => void }) {
  const last30 = Array.from({ length: 30 }, (_, i) => shift(ymd(new Date()), -i));
  const cols: Col<Worker>[] = [
    { key: "n", label: "Name", render: (w) => <div><div className="font-medium">{w.name}</div><div className="text-[0.8rem] text-ink-3">{w.phone || "No mobile"}</div></div>, sort: (w) => w.name },
    { key: "t", label: "Trade", render: (w) => w.trade || <span className="text-ink-3">—</span>, sort: (w) => w.trade },
    { key: "s", label: "Works at", render: (w) => w.site || <span className="text-ink-3">—</span>, sort: (w) => w.site },
    { key: "d", label: "Days, last 30", align: "right", render: (w) => n0(worked(w, last30)), sort: (w) => worked(w, last30) },
    ...(costs ? [{ key: "w", label: "Wage", align: "right" as const, render: (w: Worker) => w.rate ? `${rs(w.rate)} / ${w.wageType === "month" ? "month" : "day"}` : <span className="text-ink-3">Not set</span>, sort: (w: Worker) => dayRate(w) }] : []),
    { key: "a", label: "", render: (w) => <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>{!w.active && <Badge>Left</Badge>}{w.phone && <a className="btn btn-quiet btn-sm !px-2" href={`tel:${w.phone}`} aria-label={`Call ${w.name}`}><Phone size={14} /></a>}</div> },
  ];
  return <Table rows={workers} cols={cols} onRow={onOpen} search={(w) => `${w.name} ${w.trade} ${w.site} ${w.phone}`} empty="No workers yet. Use Add worker." />;
}

function WorkerForm({ initial, can, costs, onSave, onDelete, onClose }: { initial: Worker; can: boolean; costs: boolean; onSave: (w: Worker) => void; onDelete?: () => void; onClose: () => void }) {
  const [w, setW] = useState<Worker>(initial);
  const [err, setErr] = useState("");
  const set = <K extends keyof Worker>(k: K, v: Worker[K]) => setW((x) => ({ ...x, [k]: v }));
  const submit = () => {
    if (!w.name.trim()) return setErr("Enter the worker's name.");
    if (w.phone && w.phone.replace(/\D/g, "").length !== 10) return setErr("Mobile number should be 10 digits.");
    onSave({ ...w, name: w.name.trim(), trade: w.trade.trim(), site: w.site.trim() });
  };
  return (
    <Drawer open title={initial.id ? w.name || "Worker" : "Add worker"} sub="On the attendance list from the day they join." onClose={onClose}
      footer={can ? <><button className="btn btn-primary" onClick={submit}>{initial.id ? "Save" : "Add worker"}</button><button className="btn btn-quiet" onClick={onClose}>Cancel</button>{err && <span className="text-sm text-neg">{err}</span>}{onDelete && <button className="btn btn-quiet btn-sm ml-auto !text-neg" onClick={onDelete}>Delete</button>}</> : <button className="btn btn-quiet" onClick={onClose}>Close</button>}>
      <Section title="Worker">
        <Grid>
          <F label="Name *"><TextIn value={w.name} onChange={(v) => set("name", v)} placeholder="Ramesh Kumawat" /></F>
          <F label="Mobile"><TextIn value={w.phone} onChange={(v) => set("phone", v.replace(/[^\d]/g, "").slice(0, 10))} placeholder="10-digit mobile" type="tel" /></F>
          <F label="Trade" hint="Pick or type"><TextIn value={w.trade} onChange={(v) => set("trade", v)} list="k-trades" placeholder="Gang saw operator" /></F>
          <F label="Works at"><TextIn value={w.site} onChange={(v) => set("site", v)} list="k-sites" placeholder="Unit" /></F>
          <F label="Joined on"><TextIn type="date" value={w.joinedOn} onChange={(v) => set("joinedOn", v)} /></F>
        </Grid>
        <datalist id="k-trades">{TRADES.map((t) => <option key={t} value={t} />)}</datalist>
        <datalist id="k-sites">{SITES.map((t) => <option key={t} value={t} />)}</datalist>
      </Section>
      {costs && (
        <Section title="Wage">
          <div className="mb-3"><Seg value={w.wageType} onChange={(v) => set("wageType", v)} tabs={[{ key: "day", label: "Paid per day" }, { key: "month", label: "Monthly salary" }]} /></div>
          <Grid>
            <F label={w.wageType === "month" ? "Salary per month" : "Wage per day"} hint={w.wageType === "month" && w.rate ? `${rs(Math.round(w.rate / 30))} a day; a half day is half of it` : undefined}><NumIn value={w.rate} onChange={(v) => set("rate", v)} suffix="₹" /></F>
          </Grid>
        </Section>
      )}
      <Section title="Status">
        <Toggle on={w.active} onChange={(v) => set("active", v)} label="On the attendance list" hint="Switch off when someone leaves. Their past attendance stays." />
        <div className="mt-3"><F label="Notes"><Area value={w.notes} onChange={(v) => set("notes", v)} placeholder="Advance taken, ID proof, village…" /></F></div>
      </Section>
    </Drawer>
  );
}
