"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PRESETS } from "@/lib/presets";
import { rulesBlueprint } from "@/lib/rules";
import { moduleData, overview } from "@/lib/data";
import { MODULES } from "@/lib/catalog";
import { fmt, delta } from "@/lib/format";
import { ChartBody } from "./Charts";
import Icon from "./Icon";

function useDemo(idx = 0) {
  return useMemo(() => ({ ...rulesBlueprint(PRESETS[idx].intake), id: PRESETS[idx].id }), [idx]);
}

export function HeroPreview() {
  const bp = useDemo(0);
  const ov = useMemo(() => overview(bp, null), [bp]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 2400);
    return () => clearInterval(t);
  }, []);
  const collected = 184000 + tick * 12500;
  return (
    <div className="drift">
      <div className="rounded-[28px] bg-surface p-4 shadow-[0_30px_80px_-30px_rgba(15,20,18,0.35)] sm:p-5" aria-label="Example dashboard for a marble processor in Kishangarh">
        <div className="flex items-center gap-3 px-1">
          <div className="font-semibold">{bp.intake.companyName}</div>
          <div className="text-sm text-ink-3">Kishangarh</div>
          <div className="ml-auto flex items-center gap-2 text-xs text-ink-3"><span className="live-dot h-1.5 w-1.5 rounded-full bg-accent" />Live</div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {ov.kpis.slice(0, 2).map((k, i) => (
            <div key={i} className="rounded-2xl bg-ground p-3.5">
              <div className="truncate text-xs text-ink-2">{k.label}</div>
              <div className="num mt-2 text-lg font-semibold tracking-tight sm:text-xl">{fmt(k.value, k.unit)}</div>
              {k.delta !== undefined && <div className={`num text-xs ${(k.delta >= 0) === (k.goodWhen !== "down") ? "text-accent" : "text-neg"}`}>{delta(k.delta)}</div>}
            </div>
          ))}
          <div className="rounded-2xl bg-ground p-3.5">
            <div className="truncate text-xs text-ink-2">Collected today</div>
            <div key={tick} className="num fade-in mt-2 text-lg font-semibold tracking-tight sm:text-xl">{fmt(collected, "inr")}</div>
            <div className="text-xs text-ink-3">via WhatsApp links</div>
          </div>
        </div>
        <div className="mt-2.5 rounded-2xl bg-ground p-3.5">
          <div className="mb-2 text-xs text-ink-2">Revenue, last 12 months</div>
          <ChartBody spec={ov.chart} height={150} />
        </div>
        <ul className="mt-2.5 space-y-1.5 rounded-2xl bg-ground p-3.5 text-[0.8rem]">
          {ov.alerts.slice(0, 3).map((a, i) => (
            <li key={i} className="flex gap-2 text-ink-2">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${a.level === "critical" ? "bg-neg" : a.level === "warn" ? "bg-warn" : "bg-ink-3"}`} />
              <span className="line-clamp-1">{a.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ModuleExplorer() {
  const bp = useDemo(0);
  const [k, setK] = useState<string>("sales");
  const all = useMemo(() => ({ ...bp, modules: MODULES.map((m) => ({ key: m.key, insights: [] })) }), [bp]);
  const d = useMemo(() => moduleData(all, k, null), [all, k]);
  const meta = MODULES.find((m) => m.key === k)!;
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
      <ul className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 lg:grid-cols-1">
        {MODULES.map((m) => (
          <li key={m.key}>
            <button onMouseEnter={() => setK(m.key)} onFocus={() => setK(m.key)} onClick={() => setK(m.key)} className={`focusable flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${k === m.key ? "bg-surface text-ink" : "text-ink-2 hover:text-ink"}`}>
              <Icon name={m.icon} size={18} className={k === m.key ? "text-accent" : "text-ink-3"} />
              <span className="font-medium">{m.name}</span>
            </button>
          </li>
        ))}
      </ul>
      <div key={k} className="enter lg:pt-1">
        <h3 className="text-3xl font-semibold tracking-tight">{meta.name}</h3>
        <p className="mt-2 max-w-[52ch] text-lg text-ink-2">{meta.blurb}</p>
        <div className="mt-8 grid grid-cols-2 gap-3">
          {d.kpis.slice(0, 4).map((kp, i) => (
            <div key={i} className="rounded-2xl bg-surface p-4">
              <div className="text-sm text-ink-2">{kp.label}</div>
              <div className="num mt-2 text-2xl font-semibold tracking-tight">{fmt(kp.value, kp.unit)}</div>
            </div>
          ))}
        </div>
        {d.charts[0] && (
          <div className="mt-3 rounded-2xl bg-surface p-4">
            <div className="text-sm text-ink-2">{d.charts[0].title}</div>
            <div className="mt-3"><ChartBody spec={d.charts[0]} height={170} /></div>
          </div>
        )}
        {k === "schemes" && d.tables[0] && (
          <ul className="mt-3 space-y-2 rounded-2xl bg-surface p-4 text-sm">
            {d.tables[0].rows.slice(0, 4).map((r, i) => <li key={i}><span className="font-medium">{r.scheme}</span> <span className="text-ink-2">— {r.benefit}</span></li>)}
          </ul>
        )}
      </div>
    </div>
  );
}

export function ClusterLinks() {
  return (
    <ul className="divide-y divide-white/10">
      {PRESETS.map((p) => (
        <li key={p.id}>
          <Link href={`/w/${p.id}`} className="group flex items-baseline gap-6 py-6 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]">
            <span className="text-2xl font-semibold tracking-tight text-night-ink sm:text-3xl">{p.intake.companyName}</span>
            <span className="hidden text-night-ink/60 sm:inline">{p.label}</span>
            <ArrowRight size={22} className="ml-auto shrink-0 text-night-ink/50 transition-transform duration-300 group-hover:translate-x-1.5 group-hover:text-[var(--accent)]" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
