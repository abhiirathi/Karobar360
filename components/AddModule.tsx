"use client";
import { useState } from "react";
import { X } from "lucide-react";
import type { Blueprint, CustomModule } from "@/lib/types";

const EXAMPLES = [
  "Track each raw marble block from quarry to slabs, with yield per block",
  "Machine maintenance schedule with breakdown log for every loom",
  "Karigar piece-rate: material issued, pieces returned and payment due",
  "Solar and DG diesel usage per site against production",
  "Enquiries from IndiaMART and WhatsApp through to quotation and order",
];

export default function AddModule({ bp, open, onClose, onAdd }: { bp: Blueprint; open: boolean; onClose: () => void; onAdd: (m: CustomModule) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!open) return null;

  async function build() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: text, intake: bp.intake, vocab: bp.vocab, seed: bp.seed }),
      });
      const j = await res.json();
      if (!j.module) throw new Error("No module returned");
      const m: CustomModule = { ...j.module, key: `${j.module.key}-${Date.now().toString(36).slice(-3)}` };
      onAdd(m);
      setText("");
      onClose();
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/40 p-4 fade-in" onClick={onClose}>
      <div className="enter w-full max-w-xl rounded-3xl bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Add a custom module">
        <div className="flex items-start gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Describe what you want to track</h2>
            <p className="mt-1 text-sm text-ink-2">Write it the way you would explain it to your manager. Karobar360 designs the fields, KPIs and chart.</p>
          </div>
          <button onClick={onClose} className="btn btn-quiet btn-sm ml-auto !px-2.5" aria-label="Close"><X size={16} /></button>
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="field mt-5 resize-none" placeholder="e.g. Track samples sent to export buyers and whether they converted to orders" />
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => setText(ex)} className="chip !text-xs">{ex}</button>
          ))}
        </div>
        {err && <p className="mt-3 text-sm text-neg">{err}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-quiet">Cancel</button>
          <button onClick={build} disabled={text.trim().length < 8 || busy} className="btn btn-primary">{busy ? <span className="live-dot">Designing module…</span> : "Build module"}</button>
        </div>
      </div>
    </div>
  );
}
