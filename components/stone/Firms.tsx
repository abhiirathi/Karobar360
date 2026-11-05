"use client";
import { useState } from "react";
import { Building2, Plus } from "lucide-react";
import { STATES, checkGstin, uid } from "@/lib/stone/calc";
import { FIRM_KINDS, firmOf, firmsOf, kindLabel, kindModules } from "@/lib/stone/firms";
import { MODULE_INFO, modulesOf } from "@/lib/stone/modules";
import type { Firm, FirmKind } from "@/lib/stone/types";
import type { Ctx } from "./StoneApp";
import { Badge, Drawer, F, Grid, Note, Section, Sel, TextIn } from "./ui";

/** The companies of the group. Each keeps its own GSTIN, invoices and sections; stock moves between them. */
export default function FirmsSettings({ ctx }: { ctx: Ctx }) {
  const R = ctx.root;
  const firms = ctx.firms;
  const [edit, setEdit] = useState<Firm | "new" | null>(null);
  const count = (id: string) => {
    const of = (x: { firmId?: string }) => firmOf(x, R.settings) === id;
    return { blocks: R.blocks.filter(of).length, lots: R.lots.filter(of).length, sales: R.sales.filter(of).length };
  };
  const owner = ctx.mode === "demo" || !!ctx.me?.isOwner;

  return (
    <Section title="Firms in your group" aside={owner ? <button className="btn btn-quiet btn-sm" onClick={() => setEdit("new")}><Plus size={14} />Add firm</button> : undefined}>
      <p className="-mt-1 mb-3 text-[0.9rem] text-ink-2">Run the mine, the processing unit and the depot as separate companies? Add each one. Pick a firm in the sidebar to see only its sections and figures. Blocks and lots move between firms with a challan, and keep their numbers.</p>
      {firms.length < 2 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-[0.9rem]">
          <Building2 size={16} className="text-ink-3" />
          <span className="flex-1">Everything is under one company: {R.settings.company}.</span>
          {owner && <button className="btn btn-primary btn-sm" onClick={() => setEdit("new")}>Add a second firm</button>}
        </div>
      ) : (
        <ul className="divide-y divide-surface-2 rounded-2xl bg-surface">
          {firms.map((f) => {
            const c = count(f.id);
            return (
              <li key={f.id}>
                <button className="focusable flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-surface-2/50" onClick={() => owner && setEdit(f)}>
                  <div className="min-w-[200px] flex-1">
                    <div className="font-medium">{f.name} {f.id === firmsOf(R.settings)[0]?.id && <Badge>Main</Badge>}</div>
                    <div className="text-[0.82rem] text-ink-3">{kindLabel(f.kind)} · {f.gstin || "No GSTIN"} · {f.city}</div>
                  </div>
                  <div className="text-[0.82rem] text-ink-2">{c.blocks} blocks · {c.lots} lots · {c.sales} invoices</div>
                </button>
                <div className="flex justify-end px-4 pb-3 -mt-1">
                  {ctx.firm?.id === f.id ? <Badge tone="good">Working in this firm</Badge> : <button className="btn btn-quiet btn-sm" onClick={() => { ctx.setFirm(f.id); ctx.go("overview"); }}>Work in this firm</button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {firms.length > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.86rem] text-ink-2">
          <span>The main account sees every firm together under <b>All firms · group view</b>, or one firm at a time from the switcher in the sidebar.</span>
          {ctx.firm && <button className="btn btn-quiet btn-sm" onClick={() => { ctx.setFirm(null); ctx.go("overview"); }}>Show all firms</button>}
        </div>
      )}
      {edit && <FirmForm ctx={ctx} firm={edit === "new" ? null : edit} onClose={() => setEdit(null)} used={edit !== "new" && Object.values(count(edit.id)).some(Boolean)} />}
    </Section>
  );
}

function FirmForm({ ctx, firm, onClose, used }: { ctx: Ctx; firm: Firm | null; onClose: () => void; used: boolean }) {
  const R = ctx.root.settings;
  const first = firmsOf(ctx.root.settings)[0];
  const [f, setF] = useState<Firm>(() => firm ? structuredClone(firm) : { id: "", name: "", kind: "processing", gstin: "", address: "", city: R.city, state: R.state, pincode: "", phone: R.phone, invoicePrefix: "", modules: kindModules("processing") });
  const [err, setErr] = useState("");
  const set = <K extends keyof Firm>(k: K, v: Firm[K]) => setF((x) => ({ ...x, [k]: v }));
  const g = checkGstin(f.gstin);
  const save = () => {
    if (!f.name.trim()) return setErr("Enter the firm name.");
    if (f.gstin && !g.ok) return setErr("Fix the GSTIN or leave it blank.");
    ctx.update((d) => {
      const list = [...(d.settings.firms ?? [])];
      // The first time, the company already set up becomes the main firm and keeps every existing record.
      if (!list.length) list.push({ id: uid(), name: d.settings.company, kind: "other", gstin: d.settings.gstin, address: d.settings.address, city: d.settings.city, state: d.settings.state, pincode: d.settings.pincode ?? "", phone: d.settings.phone, invoicePrefix: d.settings.invoicePrefix, modules: modulesOf(d.settings) });
      const out = { ...f, id: f.id || uid(), invoicePrefix: f.invoicePrefix || `${f.name.replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 4) || "INV"}/26-27/` };
      const i = list.findIndex((x) => x.id === out.id);
      if (i >= 0) list[i] = out; else list.push(out);
      d.settings.firms = list;
    });
    ctx.say(firm ? "Firm saved" : `${f.name} added. Pick it in the sidebar to work in it.`, "good");
    onClose();
  };
  const remove = () => {
    if (!firm) return;
    ctx.update((d) => { d.settings.firms = (d.settings.firms ?? []).filter((x) => x.id !== firm.id); if ((d.settings.firms ?? []).length < 2) d.settings.firms = []; });
    if (ctx.firm?.id === firm.id) ctx.setFirm(null);
    onClose();
  };
  return (
    <Drawer open title={firm ? firm.name : "Add a firm"} sub={!firm && !ctx.firms.length ? `${R.company} becomes the main firm and keeps everything recorded so far.` : "Its own GSTIN, invoice numbers and sections."} onClose={onClose}
      footer={<><button className="btn btn-primary" onClick={save}>Save</button><button className="btn btn-quiet" onClick={onClose}>Cancel</button>{err && <span className="text-sm text-neg">{err}</span>}{firm && firm.id !== first?.id && <button className="btn btn-quiet btn-sm ml-auto !text-neg" disabled={used} title={used ? "Move its blocks, lots and invoices to another firm first" : undefined} onClick={remove}>Remove</button>}</>}>
      <div className="text-sm font-medium">What this firm does</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {FIRM_KINDS.map((k) => (
          <button key={k.key} type="button" onClick={() => setF((x) => ({ ...x, kind: k.key as FirmKind, modules: kindModules(k.key) }))}
            className={`focusable rounded-xl border px-3 py-2 text-left transition-colors ${f.kind === k.key ? "border-accent bg-accent-soft" : "border-surface-2 hover:bg-surface-2"}`}>
            <div className="text-[0.92rem] font-medium">{k.label}</div>
            <div className="text-[0.78rem] text-ink-2">{k.hint}</div>
          </button>
        ))}
      </div>
      {f.kind === "other" && (
        <ul className="mt-3 divide-y divide-surface-2 rounded-2xl bg-surface">
          {MODULE_INFO.map((m) => (
            <li key={m.key}><label className="flex cursor-pointer items-center gap-3 px-4 py-2 text-[0.9rem]"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={f.modules[m.key]} onChange={(e) => set("modules", { ...f.modules, [m.key]: e.target.checked })} />{m.label}</label></li>
          ))}
        </ul>
      )}
      <div className="mt-5"><Grid>
        <F label="Firm name *" span={2}><TextIn value={f.name} onChange={(v) => set("name", v)} placeholder="Shree Shyam Minerals" /></F>
        <F label="GSTIN" err={f.gstin && !g.ok ? g.msg : undefined}><TextIn value={f.gstin} onChange={(v) => { set("gstin", v); const c = checkGstin(v); if (c.ok) set("state", c.state!); }} upper /></F>
        <F label="Invoice prefix" hint="Each firm numbers its own invoices"><TextIn value={f.invoicePrefix} onChange={(v) => set("invoicePrefix", v)} placeholder="SSM/26-27/" /></F>
        <F label="Address" span={2}><TextIn value={f.address} onChange={(v) => set("address", v)} /></F>
        <F label="City"><TextIn value={f.city} onChange={(v) => set("city", v)} /></F>
        <F label="State"><Sel value={f.state} onChange={(v) => set("state", v)} options={Object.entries(STATES).map(([k, v]) => ({ v: k, l: v }))} /></F>
        <F label="Pincode"><TextIn value={f.pincode} onChange={(v) => set("pincode", v.replace(/\D/g, "").slice(0, 6))} /></F>
        <F label="Phone"><TextIn type="tel" value={f.phone} onChange={(v) => set("phone", v)} /></F>
      </Grid></div>
      {used && <div className="mt-4"><Note>This firm holds records. To remove it, move its blocks and lots to another firm first.</Note></div>}
    </Drawer>
  );
}
