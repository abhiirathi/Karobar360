"use client";
import { useEffect, useRef, useState } from "react";
import { Download, Scale } from "lucide-react";
import { n0, n2 } from "@/lib/stone/calc";
import type { Block } from "@/lib/stone/types";
import type { Ctx } from "./StoneApp";
import { F, Grid, Note, NumIn, Section } from "./ui";

export type Reading = { weight: number; stable: boolean; device?: string; age: number };
type Live = { reading: Reading | null; status: "loading" | "live" | "stale" | "off"; sim?: (kg: number) => void };

/** The weight on the weighbridge right now. Polls the server; in the demo, a simulated weighbridge. */
export function useLiveWeight(ctx: Ctx, on = true): Live {
  const demo = ctx.mode === "demo";
  const [reading, setReading] = useState<Reading | null>(null);
  const [status, setStatus] = useState<Live["status"]>("loading");
  const target = useRef(0);
  useEffect(() => {
    if (!on) return;
    let stop = false;
    if (demo) {
      let cur = 0;
      setStatus("live");
      const t = setInterval(() => {
        const goal = target.current;
        const diff = goal - cur;
        cur = Math.abs(diff) < 30 ? goal : cur + diff * 0.35 + (Math.random() - 0.5) * 60;
        const kg = Math.round(cur / 10) * 10;
        setReading({ weight: kg, stable: Math.abs(goal - cur) < 30, device: "Demo weighbridge", age: 0 });
      }, 400);
      return () => clearInterval(t);
    }
    const tick = async () => {
      const r = await fetch("/api/weighbridge/live", { cache: "no-store" }).catch(() => null);
      const j = r?.ok ? await r.json().catch(() => null) : null;
      if (stop) return;
      const x = j?.reading as Reading | null;
      setReading(x);
      setStatus(!x ? "off" : x.age < 20 ? "live" : "stale");
    };
    tick();
    const t = setInterval(tick, 1500);
    return () => { stop = true; clearInterval(t); };
  }, [demo, on]);
  return { reading, status, sim: demo ? (kg) => { target.current = kg; } : undefined };
}

/** The big readout of the current weight. */
export function WeightReadout({ live, compact }: { live: Live; compact?: boolean }) {
  const r = live.reading;
  const on = live.status === "live" && r;
  return (
    <div className={`flex items-center gap-4 rounded-2xl ${on ? "bg-night text-night-ink" : "bg-surface-2"} ${compact ? "px-4 py-3" : "px-5 py-4"}`}>
      <Scale size={compact ? 18 : 22} className="shrink-0 opacity-70" />
      <div className="min-w-0 flex-1">
        <div className={`num font-semibold tracking-tight ${compact ? "text-[1.5rem]" : "text-[2.1rem]"} leading-none`}>{on ? `${n0(r.weight)} kg` : live.status === "loading" ? "…" : "— kg"}</div>
        <div className="mt-1 text-[0.8rem] opacity-75">
          {on ? (r.stable ? "Steady" : "Settling…") : live.status === "stale" ? "Weighbridge not sending. Check its computer." : live.status === "off" ? "Weighbridge not connected" : "Connecting…"}
          {on && r.device ? ` · ${r.device}` : ""}
        </div>
      </div>
      {on && <span className={`h-3 w-3 shrink-0 rounded-full ${r.stable ? "bg-accent" : "bg-warn"}`} aria-hidden />}
    </div>
  );
}

const slipNo = () => { const d = new Date(); return `WB-${d.toISOString().slice(2, 10).replace(/-/g, "")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`; };
const time = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "");

/**
 * Gross (truck with the block) and tare (empty truck), from the weighbridge or typed in.
 * Each weight is saved on the block at once, so the truck can be unloaded and weighed again later.
 */
export function WeighCapture({ ctx, block, onChange }: { ctx: Ctx; block: Block; onChange: (p: Partial<Block>) => void }) {
  const [manual, setManual] = useState(block.weigh?.source === "manual");
  const live = useLiveWeight(ctx, !manual);
  const w = block.weigh ?? { source: "weighbridge" as const };
  const ok = live.status === "live" && !!live.reading?.stable;
  const now = new Date().toISOString();

  const apply = (next: NonNullable<Block["weigh"]>) => {
    const net = next.gross && next.tare !== undefined && next.gross > next.tare ? Math.round((next.gross - next.tare) / 10) / 100 : 0;
    const patch: Partial<Block> = { weigh: next, ...(net ? { tonnes: net, weighSlip: block.weighSlip || slipNo() } : {}) };
    onChange(patch);
    // Save on the block straight away, so closing the screen between the two weighings loses nothing.
    if (block.id && next.source === "weighbridge") ctx.update((d) => { const x = d.blocks.find((b) => b.id === block.id); if (x) { x.weigh = next; if (net) { x.tonnes = net; x.weighSlip = x.weighSlip || patch.weighSlip || ""; } } });
  };
  const take = (k: "gross" | "tare") => {
    if (!live.reading) return;
    apply({ ...w, source: "weighbridge", device: live.reading.device, [k]: live.reading.weight, [`${k}At`]: now, ...(k === "gross" ? { tare: undefined, tareAt: undefined } : {}) });
  };
  const net = w.gross && w.tare !== undefined && w.gross > w.tare ? (w.gross - w.tare) / 1000 : 0;

  return (
    <div>
      {!manual && (
        <>
          <WeightReadout live={live} />
          {live.sim && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.8rem] text-ink-3">
              Demo weighbridge:
              <button type="button" className="chip" onClick={() => live.sim!(31840)}>Truck with block drives on</button>
              <button type="button" className="chip" onClick={() => live.sim!(13920)}>Empty truck</button>
              <button type="button" className="chip" onClick={() => live.sim!(0)}>Nothing on it</button>
            </div>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <WeighStep n={1} title="Truck with the block" value={w.gross} at={w.grossAt} disabled={!ok} onTake={() => take("gross")} hint={!ok ? (live.status === "live" ? "Wait until the weight is steady" : "Needs the weighbridge connected") : undefined} />
            <WeighStep n={2} title="Empty truck, after unloading" value={w.tare} at={w.tareAt} disabled={!ok || !w.gross} onTake={() => take("tare")} hint={!w.gross ? "Take the loaded weight first" : !ok ? "Wait until the weight is steady" : undefined} />
          </div>
        </>
      )}
      {manual && (
        <Grid cols={3}>
          <F label="Truck with the block"><NumIn value={w.gross ?? 0} onChange={(v) => apply({ ...w, source: "manual", gross: v || undefined })} suffix="kg" /></F>
          <F label="Empty truck"><NumIn value={w.tare ?? 0} onChange={(v) => apply({ ...w, source: "manual", tare: v || undefined })} suffix="kg" /></F>
          <F label="Net"><div className="field num">{net ? `${n2(net)} t` : "—"}</div></F>
        </Grid>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[0.86rem]">
        {net > 0 && <span className="font-medium">Net {n2(net)} t {w.source === "weighbridge" ? <span className="text-accent">· from the weighbridge</span> : <span className="text-ink-3">· typed by hand</span>}</span>}
        <button type="button" className="ml-auto text-accent hover:underline" onClick={() => setManual((m) => !m)}>{manual ? "Use the weighbridge" : "Type the weights instead"}</button>
      </div>
    </div>
  );
}

function WeighStep({ n, title, value, at, disabled, onTake, hint }: { n: number; title: string; value?: number; at?: string; disabled: boolean; onTake: () => void; hint?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface px-3.5 py-3">
      <span className={`num grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.75rem] font-semibold ${value ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-2"}`}>{n}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[0.88rem] font-medium">{title}</div>
        <div className="num text-[0.8rem] text-ink-3">{value ? `${n0(value)} kg · ${time(at)}` : hint ?? "Not taken yet"}</div>
      </div>
      <button type="button" className={`btn btn-sm ${value ? "btn-quiet" : "btn-primary"}`} disabled={disabled} onClick={onTake}>{value ? "Again" : "Take weight"}</button>
    </div>
  );
}

/** Settings: connect the weighbridge. */
export function WeighbridgeSettings({ ctx }: { ctx: Ctx }) {
  const live = useLiveWeight(ctx, ctx.mode === "cloud");
  const [more, setMore] = useState(false);
  return (
    <Section title="Weighbridge">
      <p className="-mt-1 mb-3 text-[0.9rem] text-ink-2">Show the live weight on the gate screen. The gate person presses one button for the loaded truck and one for the empty truck; the net weight is filled in and can’t be mistyped.</p>
      {ctx.mode === "demo" ? <Note>In the demo the weighbridge is simulated. Open Processing unit → Block yard → Receive on a block that is on the road to try it.</Note> : (
        <div className="space-y-4">
          <WeightReadout live={live} compact />
          <ol className="space-y-3 rounded-2xl bg-surface p-4 text-[0.9rem] text-ink-2">
            <li className="flex gap-3"><span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-[0.75rem] font-semibold text-accent-ink">1</span><span>Use the computer the weighbridge indicator is connected to (the one the operator prints slips from). The indicator’s cable goes into its COM or USB-serial port.</span></li>
            <li className="flex gap-3"><span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-[0.75rem] font-semibold text-accent-ink">2</span><span>On that computer, download the setup and double-click it. If Windows warns you, click More info → Run anyway.<span className="mt-2 block"><a href="/api/weighbridge/script" className="btn btn-primary btn-sm"><Download size={14} />Download weighbridge setup</a></span></span></li>
            <li className="flex gap-3"><span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-[0.75rem] font-semibold text-accent-ink">3</span><span>It finds the weighbridge by itself and runs a 20-second test that shows the weight. After that the weight appears above, and it starts by itself whenever the computer is switched on.</span></li>
          </ol>
          <button className="text-[0.88rem] font-medium text-accent hover:underline" onClick={() => setMore((m) => !m)}>{more ? "Hide" : "Show"} help</button>
          {more && (
            <div className="space-y-2 text-[0.88rem] text-ink-2">
              <p><b className="text-ink">Weight not found:</b> another program may be holding the COM port, such as the weighbridge’s own slip software. The connector shares the port only if that program lets go of it; if not, ask your weighbridge vendor for a second output, or a serial splitter.</p>
              <p><b className="text-ink">Network weighbridge:</b> if the indicator is on the network, open <code className="rounded bg-surface-2 px-1">%LOCALAPPDATA%\Karobar360\karobar360-weighbridge.ps1</code> in Notepad and set <code className="rounded bg-surface-2 px-1">$Port = &quot;tcp:192.168.1.50:4001&quot;</code> with its address.</p>
              <p><b className="text-ink">Log:</b> <code className="rounded bg-surface-2 px-1">%LOCALAPPDATA%\Karobar360\karobar360-weighbridge.log</code> says what happened on each start.</p>
              <p>The connector uses the same private key as the Tally connector. Resetting that key on the Tally page switches both off.</p>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
