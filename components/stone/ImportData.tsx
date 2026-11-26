"use client";
import { useRef, useState } from "react";
import { AlertTriangle, Download, FileSpreadsheet, Upload } from "lucide-react";
import type { ImportPlan } from "@/lib/stone/importer";
import type { Ctx } from "./StoneApp";
import { Drawer, Note } from "./ui";

/** Download the Excel template, or upload a filled copy and preview what it will add before saving. */
export function useImport(ctx: Ctx) {
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState<"" | "template" | "read">("");
  const input = useRef<HTMLInputElement>(null);

  const template = async () => {
    setBusy("template");
    try {
      const { buildTemplate } = await import("@/lib/stone/importer");
      const blob = await buildTemplate(ctx.root.settings.company);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "Karobar360 data template.xlsx";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch {
      ctx.say("Could not make the template. Try again.", "neg");
    } finally {
      setBusy("");
    }
  };

  const read = async (f?: File | null) => {
    if (!f) return;
    setBusy("read");
    try {
      const { planImport } = await import("@/lib/stone/importer");
      setFileName(f.name);
      setPlan(await planImport(f, ctx.root));
    } catch {
      ctx.say("That file could not be read. Upload the Karobar360 template saved as .xlsx.", "neg");
    } finally {
      setBusy("");
      if (input.current) input.current.value = "";
    }
  };

  const pick = () => input.current?.click();
  const fileInput = <input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => read(e.target.files?.[0])} />;
  const preview = plan && <Preview plan={plan} fileName={fileName} ctx={ctx} onClose={() => setPlan(null)} />;
  return { template, pick, busy, fileInput, preview };
}

export function ImportBanner({ ctx }: { ctx: Ctx }) {
  const im = useImport(ctx);
  return (
    <div className="no-print flex flex-wrap items-start gap-4 rounded-[22px] bg-surface p-5 sm:items-center">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent"><FileSpreadsheet size={20} /></span>
      <div className="min-w-[240px] flex-1">
        <div className="font-semibold">Bring in your existing data</div>
        <p className="mt-0.5 text-[0.9rem] text-ink-2">Download the Excel template, fill in your blocks, slab stock, customers, invoices, stores and labour, then upload it. Every section and the dashboard update at once.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-quiet" onClick={im.template} disabled={!!im.busy}><Download size={15} />{im.busy === "template" ? "Preparing…" : "Download template"}</button>
        <button className="btn btn-primary" onClick={im.pick} disabled={!!im.busy}><Upload size={15} />{im.busy === "read" ? "Reading…" : "Upload filled template"}</button>
      </div>
      {im.fileInput}
      {im.preview}
    </div>
  );
}

export function ImportButtons({ ctx }: { ctx: Ctx }) {
  const im = useImport(ctx);
  return (
    <>
      <button className="btn btn-quiet btn-sm" onClick={im.template} disabled={!!im.busy}><Download size={14} />{im.busy === "template" ? "Preparing…" : "Excel template"}</button>
      <button className="btn btn-quiet btn-sm" onClick={im.pick} disabled={!!im.busy}><Upload size={14} />{im.busy === "read" ? "Reading…" : "Upload filled template"}</button>
      {im.fileInput}
      {im.preview}
    </>
  );
}

function Preview({ plan, fileName, ctx, onClose }: { plan: ImportPlan; fileName: string; ctx: Ctx; onClose: () => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? plan.issues : plan.issues.slice(0, 12);
  const go = () => {
    ctx.update((d) => plan.apply(d));
    const added = plan.sheets.reduce((a, s) => a + s.added, 0);
    const updated = plan.sheets.reduce((a, s) => a + s.updated, 0);
    ctx.say(`Imported: ${added} added${updated ? `, ${updated} updated` : ""}`, "good");
    onClose();
    ctx.go("overview");
  };
  return (
    <Drawer open title="Check before importing" sub={fileName} onClose={onClose}
      footer={<>
        <button className="btn btn-primary" disabled={!plan.total} onClick={go}>{plan.total ? `Import ${plan.total} record${plan.total > 1 ? "s" : ""}` : "Nothing to import"}</button>
        <button className="btn btn-quiet" onClick={onClose}>Cancel</button>
      </>}>
      {ctx.firm && <div className="mb-4"><Note>New records go into <b>{ctx.firm.name}</b>. Pick “All firms” first to put them in the main firm.</Note></div>}
      {plan.sheets.length > 0 && (
        <ul className="divide-y divide-surface-2 overflow-hidden rounded-2xl bg-surface">
          {plan.sheets.map((s) => (
            <li key={s.name} className="flex items-center gap-3 px-4 py-3">
              <span className="flex-1 font-medium">{s.name}</span>
              <span className="num text-[0.9rem] text-ink-2">
                {s.added > 0 && <span className="text-accent">{s.added} new</span>}
                {s.added > 0 && s.updated > 0 && " · "}
                {s.updated > 0 && <span>{s.updated} updated</span>}
                {s.skipped > 0 && <span className="text-warn"> · {s.skipped} skipped</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {plan.issues.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center gap-2 text-sm font-medium"><AlertTriangle size={15} className="text-warn" />{plan.issues.length} thing{plan.issues.length > 1 ? "s" : ""} to look at</div>
          <ul className="mt-2 space-y-1.5 text-[0.86rem]">
            {shown.map((i, n) => (
              <li key={n} className="rounded-xl bg-warn-soft px-3 py-2"><span className="font-medium">{i.sheet}{i.row ? `, row ${i.row}` : ""}:</span> {i.text}</li>
            ))}
          </ul>
          {plan.issues.length > shown.length && <button className="mt-2 text-sm font-medium text-accent hover:underline" onClick={() => setAll(true)}>Show all {plan.issues.length}</button>}
          <p className="mt-3 text-[0.84rem] text-ink-3">You can import the rest now and upload a corrected file later; matching rows are updated, not copied.</p>
        </div>
      )}
      {!plan.issues.length && plan.total > 0 && <p className="mt-4 text-[0.9rem] text-ink-2">Everything in the file looks right.</p>}
    </Drawer>
  );
}
