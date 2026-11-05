"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, Check, Download, Scale } from "lucide-react";
import { n0, n2, netFromTruck, rs, weightCheck, type WeightCheck } from "@/lib/stone/calc";
import type { Block } from "@/lib/stone/types";
import type { Ctx } from "./StoneApp";
import { F, Grid, Note, NumIn, Section, TextIn } from "./ui";

export type Reading = { weight: number; stable: boolean; device?: string; age: number };
type Live = { reading: Reading | null; status: "loading" | "live" | "stale" | "off" };

/** The weight on a connected weighbridge right now. Only polls when a real connector is set up (never simulated). */
export function useLiveWeight(ctx: Ctx, on = true): Live {
  const cloud = ctx.mode === "cloud";
  const [reading, setReading] = useState<Reading | null>(null);
  const [status, setStatus] = useState<Live["status"]>(cloud ? "loading" : "off");
  useEffect(() => {
    if (!on || !cloud) return;
    let stop = false;
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
  }, [cloud, on]);
  return { reading, status };
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
const pct1 = (p: number) => `${p > 0 ? "+" : p < 0 ? "−" : ""}${Math.abs(p * 100).toFixed(1)}%`;

/**
 * Gate weighment, typed in by hand:
 * A = truck with the stone, B = the same truck empty after unloading, net = A − B.
 * The net is checked against the weight the supplier quoted (bill / rawanna); more than ±5% off is flagged.
 * With a real weighbridge connected, its live reading can fill A or B in one tap.
 */
export function Weighment({ ctx, block, onChange }: { ctx: Ctx; block: Block; onChange: (p: Partial<Block>) => void }) {
  const live = useLiveWeight(ctx);
  const w = block.weigh ?? { source: "manual" as const };
  const bad = !!w.gross && w.tare !== undefined && w.tare > 0 && w.tare >= w.gross;
  const fromTruck = !!w.gross && !!w.tare;
  const reading = live.status === "live" && live.reading?.stable ? live.reading : null;

  const setTruck = (k: "gross" | "tare", kg: number, src: "manual" | "weighbridge" = "manual") => {
    const next: NonNullable<Block["weigh"]> = { ...w, [k]: kg || undefined, [`${k}At`]: kg ? new Date().toISOString() : undefined, source: src === "weighbridge" || w.source === "weighbridge" ? "weighbridge" : "manual", ...(src === "weighbridge" ? { device: reading?.device } : {}) };
    const net = netFromTruck(next.gross, next.tare);
    onChange({ weigh: next, ...(net ? { tonnes: net, weighSlip: block.weighSlip || slipNo() } : next.gross && next.tare ? { tonnes: 0 } : {}) });
  };
  const check = weightCheck(block);

  return (
    <div className="space-y-4">
      <Grid cols={3}>
        <F label="A · Truck with stone" hint="Loaded, at the gate"><NumIn value={w.gross ?? 0} onChange={(v) => setTruck("gross", v)} suffix="kg" placeholder="31840" /></F>
        <F label="B · Empty truck" hint="After unloading" err={bad ? "Must be less than A" : undefined}><NumIn value={w.tare ?? 0} onChange={(v) => setTruck("tare", v)} suffix="kg" placeholder="13920" /></F>
        {fromTruck ? (
          <F label="Stone weight · A − B" box>
            <div className={`field num flex items-center justify-between font-semibold ${bad ? "text-ink-3" : ""}`}>{block.tonnes && !bad ? n2(block.tonnes) : "—"}<span className="text-[0.8rem] font-normal text-ink-3">t</span></div>
          </F>
        ) : (
          <F label="Stone weight" hint="Or type the net from the slip"><NumIn value={block.tonnes} onChange={(v) => onChange({ tonnes: v })} suffix="t" /></F>
        )}
      </Grid>

      {reading && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface px-3.5 py-2.5 text-[0.86rem]">
          <Scale size={15} className="text-accent" />
          <span>Weighbridge now <b className="num">{n0(reading.weight)} kg</b>{reading.device ? <span className="text-ink-3"> · {reading.device}</span> : null}</span>
          <span className="ml-auto flex gap-1.5">
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setTruck("gross", reading.weight, "weighbridge")}>Use for A</button>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setTruck("tare", reading.weight, "weighbridge")}>Use for B</button>
          </span>
        </div>
      )}

      <Grid cols={3}>
        <F label="Supplier's weight" hint="As on the bill / rawanna"><NumIn value={block.billedTonnes} onChange={(v) => onChange({ billedTonnes: v })} suffix="t" /></F>
        <F label="Slip no."><TextIn value={block.weighSlip} onChange={(v) => onChange({ weighSlip: v })} upper /></F>
      </Grid>

      <WeightVerdict check={check} received={block.tonnes} quoted={block.billedTonnes} rate={ctx.costs ? block.rate : 0} />
    </div>
  );
}

/** Received vs quoted, on a ±10% scale with the ±5% band that passes. */
export function WeightVerdict({ check, received, quoted, rate }: { check: WeightCheck | null; received: number; quoted: number; rate?: number }) {
  if (!check) return <p className="text-[0.84rem] text-ink-3">Enter the stone weight and the supplier&apos;s weight to cross-check them. More than ±5% apart gets flagged.</p>;
  const pos = Math.max(0, Math.min(100, 50 + (check.pct / 0.1) * 50));
  const tone = check.flag ? "bg-neg-soft" : "bg-accent-soft";
  return (
    <div className={`rounded-2xl px-4 py-3.5 ${tone}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {check.flag ? <AlertTriangle size={15} className="shrink-0 self-center text-neg" /> : <Check size={15} className="shrink-0 self-center text-accent" />}
        <span className="font-semibold">
          {check.flag === "short" ? `Flagged: ${n2(-check.diff)} t short` : check.flag === "over" ? `Flagged: ${n2(check.diff)} t more than quoted` : "Matches the supplier's weight"}
        </span>
        <span className="num text-[0.86rem] text-ink-2">{pct1(check.pct)} · limit ±5%</span>
      </div>
      <div className="mt-3" aria-hidden>
        <div className="relative h-2 rounded-full bg-ink/10">
          <div className="absolute inset-y-0 left-1/4 right-1/4 rounded-full bg-accent/35" />
          <div className="absolute left-1/2 top-1/2 h-3 w-px -translate-y-1/2 bg-ink/30" />
          <div className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-ground ${check.flag ? "bg-neg" : "bg-accent"}`} style={{ left: `${pos}%` }} />
        </div>
        <div className="num mt-1.5 flex justify-between text-[0.72rem] text-ink-3"><span>−10%</span><span>−5%</span><span>0</span><span>+5%</span><span>+10%</span></div>
      </div>
      <p className="mt-2 text-[0.84rem] text-ink-2">
        Supplier quoted <b className="num text-ink">{n2(quoted)} t</b>, the unit received <b className="num text-ink">{n2(received)} t</b>.
        {check.flag === "short" && <> The supplier billed for stone the unit didn&apos;t get{rate ? <>: about <b className="text-ink">{rs(-check.diff * rate)}</b></> : null}. Raise a debit note; it&apos;s listed under Weight flags.</>}
        {check.flag === "over" && <> Check the slip and the supplier&apos;s bill before accepting; it&apos;s listed under Weight flags.</>}
      </p>
    </div>
  );
}

/** Settings: connect the weighbridge. */
export function WeighbridgeSettings({ ctx }: { ctx: Ctx }) {
  const live = useLiveWeight(ctx, ctx.mode === "cloud");
  const [more, setMore] = useState(false);
  return (
    <Section title="Weighbridge">
      <p className="-mt-1 mb-3 text-[0.9rem] text-ink-2">Optional. Weights can always be typed in by hand. With the weighbridge connected, the gate screen shows its live reading and one tap fills in the loaded (A) or empty (B) truck weight.</p>
      {ctx.mode === "demo" ? <Note>In the demo, weights are typed in by hand: open Processing unit → Block yard → Receive on a block that is on the road. With a weighbridge connected, the gate screen offers its live reading for A and B.</Note> : (
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
