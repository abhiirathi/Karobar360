"use client";
import { useState } from "react";
import { PURGE_DEFAULT, STATES, checkGstin, purgePlan } from "@/lib/stone/calc";
import type { StoneDB, StoneSettings } from "@/lib/stone/types";
import type { Ctx } from "./StoneApp";
import { MODULE_INFO, hasBlocks, modulesOf } from "@/lib/stone/modules";
import { F, Grid, Note, NumIn, Section, Sel, TextIn } from "./ui";
import FirmsSettings from "./Firms";
import { jobSettings } from "@/lib/stone/jobwork";
import type { JobSettings } from "@/lib/stone/types";
import { WeighbridgeSettings } from "./Weigh";

export default function SettingsView({ ctx }: { ctx: Ctx }) {
  const { db, update, reset, replace } = ctx;
  const [s, setS] = useState<StoneSettings>({ ...db.settings });
  const [msg, setMsg] = useState("");
  const [confirm, setConfirm] = useState<false | true | "sample">(false);
  const set = <K extends keyof StoneSettings>(k: K, v: StoneSettings[K]) => setS((x) => ({ ...x, [k]: v }));
  const g = checkGstin(s.gstin);
  const firm = ctx.firm;
  const save = () => {
    update((d) => {
      if (firm) {
        // Company details and sections belong to the selected firm; rates and clean-up are shared by the group.
        const firms = (d.settings.firms ?? []).map((x) => x.id === firm.id ? { ...x, name: s.company, gstin: s.gstin, address: s.address, city: s.city, state: s.state, pincode: s.pincode ?? "", phone: s.phone, invoicePrefix: s.invoicePrefix, modules: modulesOf(s) } : x);
        const keep = { company: d.settings.company, gstin: d.settings.gstin, address: d.settings.address, city: d.settings.city, state: d.settings.state, pincode: d.settings.pincode, phone: d.settings.phone, invoicePrefix: d.settings.invoicePrefix, modules: d.settings.modules };
        d.settings = { ...d.settings, ...s, ...keep, firms, catalogue: d.settings.catalogue, dashboard: d.settings.dashboard };
      } else {
        d.settings = { ...d.settings, ...s, firms: d.settings.firms, catalogue: d.settings.catalogue, dashboard: d.settings.dashboard };
      }
    });
    setMsg("Saved.");
  };
  const M = modulesOf(s);
  const canEdit = ctx.edit("settings");
  const owner = ctx.mode === "demo" || !!ctx.me?.isOwner;
  const backup = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(db)], { type: "application/json" }));
    a.download = `karobar360-stone-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  const restore = async (f?: File) => {
    if (!f) return;
    try {
      const j = JSON.parse(await f.text()) as StoneDB;
      if (j.v !== 1 || !Array.isArray(j.blocks)) throw new Error();
      replace(j);
      setS({ ...j.settings });
      setMsg("Backup restored.");
    } catch {
      setMsg("That file isn't a Karobar360 stone backup.");
    }
  };
  return (
    <div className="max-w-3xl">
      {!canEdit && <div className="mb-4"><Note>You can view these settings. Only the owner or a manager can change them.</Note></div>}
      {firm && <div className="mb-4"><Note>Settings for <b>{firm.name}</b>. Company details and sections are this firm’s own; rates and clean-up apply to every firm.</Note></div>}
      {!firm && ctx.firms.length > 1 && <div className="mb-4"><Note>You are looking at all firms. Company details below are the group’s; pick a firm in the sidebar to change its own details.</Note></div>}
      {canEdit && <FirmsSettings ctx={ctx} />}
      {(firm || ctx.firms.length < 2) && <Section title={firm ? `What ${firm.name} does` : "What your business does"}>
        <p className="-mt-1 mb-3 text-[0.9rem] text-ink-2">Sections, dashboard panels and team access follow these. Switching one off hides it; nothing is deleted.</p>
        <ul className="divide-y divide-surface-2 rounded-2xl bg-surface">
          {MODULE_INFO.map((m) => (
            <li key={m.key}>
              <label className="flex cursor-pointer items-start gap-3 px-4 py-2.5">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={M[m.key]} disabled={!canEdit} onChange={(e) => set("modules", { ...M, [m.key]: e.target.checked })} />
                <span><span className="font-medium">{m.label}</span><span className="block text-[0.82rem] text-ink-3">{m.hint}</span></span>
              </label>
            </li>
          ))}
        </ul>
      </Section>}
      <Section title={firm ? "Firm on invoices" : "Company on invoices"}>
        <Grid>
          <F label="Company name" span={2}><TextIn value={s.company} onChange={(v) => set("company", v)} /></F>
          <F label="GSTIN" err={s.gstin && !g.ok ? g.msg : undefined}><TextIn value={s.gstin} onChange={(v) => { set("gstin", v); const c = checkGstin(v); if (c.ok) set("state", c.state!); }} upper /></F>
          <F label="State"><Sel value={s.state} onChange={(v) => set("state", v)} options={Object.entries(STATES).map(([k, v]) => ({ v: k, l: `${v} (${k})` }))} /></F>
          <F label="Address" span={2}><TextIn value={s.address} onChange={(v) => set("address", v)} /></F>
          <F label="City"><TextIn value={s.city} onChange={(v) => set("city", v)} /></F>
          <F label="Pincode" hint="Needed for e-invoice and e-way bill"><TextIn value={s.pincode ?? ""} onChange={(v) => set("pincode", v.replace(/\D/g, "").slice(0, 6))} /></F>
          <F label="Phone"><TextIn type="tel" value={s.phone} onChange={(v) => set("phone", v)} /></F>
          <F label="Invoice prefix"><TextIn value={s.invoicePrefix} onChange={(v) => set("invoicePrefix", v)} /></F>
        </Grid>
      </Section>
      {(M.quarry || M.processing) && <Section title="Quarries and machines">
        <Grid>
          <F label="Own quarries" hint="Separate with commas" span={2}><TextIn value={s.ownMines.join(", ")} onChange={(v) => set("ownMines", v.split(",").map((x) => x.trim()).filter(Boolean))} /></F>
          <F label="Machines at the unit" hint="Separate with commas" span={2}><TextIn value={s.machines.join(", ")} onChange={(v) => set("machines", v.split(",").map((x) => x.trim()).filter(Boolean))} /></F>
        </Grid>
      </Section>}
      {hasBlocks(M) && <Section title="Royalty and weights">
        <Grid cols={3}>
          <F label="Royalty rate" hint="Set from the current DMG schedule for your stone"><NumIn value={s.royaltyPerTonne} onChange={(v) => set("royaltyPerTonne", v)} suffix="₹/t" /></F>
          <F label="DMFT" hint="Share of royalty"><NumIn value={s.dmftPct} onChange={(v) => set("dmftPct", v)} suffix="%" /></F>
          <F label="Stone density" hint="Marble ≈ 2.7, granite ≈ 2.65"><NumIn value={s.density} onChange={(v) => set("density", v)} suffix="t/m³" /></F>
        </Grid>
      </Section>}
      {M.processing && ctx.costs && <Section title="Processing rates (used to pre-fill sawing costs)">
        <Grid cols={3}>
          <F label="Power tariff"><NumIn value={s.powerRate} onChange={(v) => set("powerRate", v)} suffix="₹/kWh" /></F>
          <F label="Gang saw load"><NumIn value={s.sawKw} onChange={(v) => set("sawKw", v)} suffix="kW" /></F>
          <F label="Blades / wire"><NumIn value={s.bladePerSqft} onChange={(v) => set("bladePerSqft", v)} suffix="₹/sq ft" /></F>
          <F label="Resin / epoxy"><NumIn value={s.resinPerSqft} onChange={(v) => set("resinPerSqft", v)} suffix="₹/sq ft" /></F>
          <F label="Fibre netting"><NumIn value={s.nettingPerSqft} onChange={(v) => set("nettingPerSqft", v)} suffix="₹/sq ft" /></F>
          <F label="Polishing"><NumIn value={s.polishPerSqft} onChange={(v) => set("polishPerSqft", v)} suffix="₹/sq ft" /></F>
          <F label="Labour"><NumIn value={s.labourPerSqft} onChange={(v) => set("labourPerSqft", v)} suffix="₹/sq ft" /></F>
        </Grid>
      </Section>}
      {M.jobwork && <JobDefaults s={s} onChange={(j) => set("jobwork", j)} />}
      {canEdit && hasBlocks(M) && <WeighbridgeSettings ctx={ctx} />}
      {owner && <Cleanup s={s} db={db} onChange={(p) => set("purge", p)} />}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" disabled={!canEdit} onClick={save}>Save settings</button>
        {msg && <span className="text-sm text-ink-2">{msg}</span>}
      </div>

      <Section title="Your data">
        <Note>{ctx.mode === "demo" ? "This demo is saved only in this browser. Create a company account to share it with your team." : "Your company’s data is stored online and shared with your team, each person seeing only what you allow. Download a backup whenever you want a copy."}</Note>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-quiet btn-sm" onClick={backup}>Download backup</button>
          {owner && <><label className="btn btn-quiet btn-sm">Restore backup<input type="file" accept="application/json" className="sr-only" onChange={(e) => restore(e.target.files?.[0])} /></label>
          <button className="btn btn-quiet btn-sm" onClick={() => { if (confirm !== "sample") { setConfirm("sample"); setMsg("This replaces the blocks, lots, invoices, customers and stores here with sample ones. Click again to confirm."); return; } setConfirm(false); reset(false); setMsg("Sample data loaded in every section."); }}>{confirm === "sample" ? "Yes, load sample data" : "Load sample data"}</button>
          <button className="btn btn-quiet btn-sm !text-neg" onClick={() => { if (confirm !== true) { setConfirm(true); setMsg("This clears every block, lot, invoice and customer here. Click again to confirm."); return; } setConfirm(false); reset(true); setMsg("Started fresh. Add your company details above."); }}>{confirm === true ? "Yes, clear everything" : "Start with my own data"}</button></>}
        </div>
      </Section>
    </div>
  );
}

function Cleanup({ s, db, onChange }: { s: StoneSettings; db: StoneDB; onChange: (p: NonNullable<StoneSettings["purge"]>) => void }) {
  const p = s.purge ?? PURGE_DEFAULT;
  const plan = purgePlan(db, { ...p, enabled: true });
  const preset = p.after === "paid" ? "paid" : p.days === 60 ? "60" : p.days === 90 ? "90" : "custom";
  return (
    <Section title="Clear settled invoices automatically">
      <div className="rounded-2xl bg-surface p-4">
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={p.enabled} onChange={(e) => onChange({ ...p, enabled: e.target.checked })} />
          <span>
            <span className="block font-medium">Delete a sales invoice once it is fully paid</span>
            <span className="block text-[0.86rem] text-ink-2">Off by default. For owners who don’t want old bills kept here. Your accounts software and GST returns keep their own copy. Before an invoice is marked received you are asked to confirm, and can download a copy first.</span>
          </span>
        </label>
        <div className={`mt-4 space-y-4 ${p.enabled ? "" : "pointer-events-none opacity-50"}`}>
          <div>
            <div className="mb-1.5 text-[0.82rem] font-medium text-ink-2">When</div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className="chip" data-on={preset === "paid"} onClick={() => onChange({ ...p, after: "paid" })}>As soon as payment is received</button>
              <button type="button" className="chip" data-on={preset === "60"} onClick={() => onChange({ ...p, after: "days", days: 60 })}>60 days after payment</button>
              <button type="button" className="chip" data-on={preset === "90"} onClick={() => onChange({ ...p, after: "days", days: 90 })}>90 days after payment</button>
              <button type="button" className="chip" data-on={preset === "custom"} onClick={() => onChange({ ...p, after: "days", days: p.days === 60 || p.days === 90 ? 30 : p.days })}>Custom</button>
            </div>
            {preset === "custom" && <div className="mt-2 w-44"><NumIn value={p.days} onChange={(v) => onChange({ ...p, days: Math.max(1, Math.round(v)) })} suffix="days" /></div>}
          </div>
          <p className="text-[0.86rem] text-ink-2">The whole trail goes with the invoice: a sold-out lot and its slabs, and once a block's last lot is gone, the block itself with its purchase line, processing record and transfers. A block sold without processing goes with its invoice. Yield and cost history for those blocks goes too.</p>
          <Note tone={plan.sales.length ? "warn" : "plain"}>
            {plan.sales.length
              ? <>With this rule, {plan.sales.length} paid invoice{plan.sales.length > 1 ? "s" : ""}{plan.lots.length ? `, ${plan.lots.length} sold-out lot${plan.lots.length > 1 ? "s" : ""}` : ""}{plan.blocks.length ? ` and ${plan.blocks.length} block${plan.blocks.length > 1 ? "s" : ""}` : ""} would be deleted when you save. Deleted data can’t be brought back, so download a backup first if you may need it.</>
              : p.after === "paid" ? "No invoice is marked received right now. Each one will be deleted the moment you mark its payment received." : `No invoice has been paid for ${p.days} days yet. Paid invoices will be cleared as they reach it.`}
          </Note>
        </div>
      </div>
    </Section>
  );
}

/** What every new job order starts with. Each order can change them. */
function JobDefaults({ s, onChange }: { s: StoneSettings; onChange: (j: JobSettings) => void }) {
  const j = jobSettings(s);
  const set = <K extends keyof JobSettings>(k: K, v: JobSettings[K]) => onChange({ ...j, [k]: v });
  return (
    <Section title="Job work (filled into each new job order)">
      <Grid cols={3}>
        <F label="Cutting rate" hint="Per sq ft of good slabs"><NumIn value={j.rate} onChange={(v) => set("rate", v)} suffix="₹/sq ft" /></F>
        <F label="GST on job work bills"><NumIn value={j.gstRate} onChange={(v) => set("gstRate", v)} suffix="%" /></F>
        <F label="SAC" hint="Printed on job work bills"><TextIn value={j.sac} onChange={(v) => set("sac", v)} /></F>
        <F label="Free days at the unit"><NumIn value={j.freeDays} onChange={(v) => set("freeDays", v)} suffix="days" /></F>
        <F label="Yard rent after that" hint="0 = no rent"><NumIn value={j.rentPerDay} onChange={(v) => set("rentPerDay", v)} suffix="₹/block/day" /></F>
      </Grid>
    </Section>
  );
}
