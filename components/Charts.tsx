"use client";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { ChartSpec, Unit } from "@/lib/types";
import { axisTick, fmt } from "@/lib/format";

const TONE: Record<string, string> = {
  accent: "var(--accent)",
  muted: "var(--data-2)",
  faint: "var(--data-3)",
  neg: "var(--neg)",
  warn: "var(--warn)",
};
const DONUT = ["var(--accent)", "var(--data-2)", "var(--data-3)", "var(--surface-3)", "var(--ink-3)", "var(--accent-soft)", "var(--ink-2)"];

function Tip({ active, payload, label, unit }: { active?: boolean; payload?: { name: string; value: number; color?: string; payload?: Record<string, unknown> }[]; label?: string; unit: Unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-surface px-3 py-2 text-sm shadow-lg">
      {label && <div className="mb-1 text-ink-3">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="num flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-ink-2">{p.name}</span>
          <span className="ml-auto font-medium">{fmt(Number(p.value), unit)}</span>
        </div>
      ))}
    </div>
  );
}

const axis = { stroke: "var(--ink-3)", fontSize: 11, tickLine: false, axisLine: false } as const;

export function ChartBody({ spec, height = 240 }: { spec: ChartSpec; height?: number }) {
  const u = spec.unit;
  const grid = <CartesianGrid vertical={false} stroke="var(--surface-2)" />;
  const tip = <Tooltip cursor={{ fill: "var(--surface-2)", opacity: 0.6 }} content={<Tip unit={u} />} />;
  if (spec.kind === "donut") {
    const total = spec.data.reduce((a, b) => a + Number(b.value), 0);
    return (
      <div className="flex items-center gap-6">
        <div style={{ width: 170, height: 170 }} className="shrink-0">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={spec.data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none" isAnimationActive>
                {spec.data.map((_, i) => <Cell key={i} fill={DONUT[i % DONUT.length]} />)}
              </Pie>
              <Tooltip content={<Tip unit={u} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="min-w-0 flex-1 space-y-2 text-sm">
          {spec.data.map((d, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: DONUT[i % DONUT.length] }} />
              <span className="truncate text-ink-2">{String(d.name)}</span>
              <span className="num ml-auto font-medium">{Math.round((Number(d.value) / (total || 1)) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (spec.kind === "hbar") {
    return (
      <ResponsiveContainer width="100%" height={Math.max(160, spec.data.length * 34 + 20)}>
        <BarChart data={spec.data} layout="vertical" margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey={spec.xKey} width={150} {...axis} tick={{ fill: "var(--ink-2)", fontSize: 12 }} />
          {tip}
          {spec.series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={TONE[s.tone]} radius={[0, 6, 6, 0]} barSize={16} />)}
        </BarChart>
      </ResponsiveContainer>
    );
  }
  if (spec.kind === "line") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={spec.data} margin={{ left: -8, right: 8, top: 8, bottom: 0 }}>
          {grid}
          <XAxis dataKey={spec.xKey} {...axis} minTickGap={18} />
          <YAxis {...axis} tickFormatter={(v) => axisTick(v, u)} width={48} />
          {tip}
          {spec.series.map((s) => <Line key={s.key} dataKey={s.key} name={s.label} stroke={TONE[s.tone]} strokeWidth={s.tone === "accent" ? 2.25 : 1.5} strokeDasharray={s.tone === "faint" ? "4 4" : undefined} dot={false} type="monotone" />)}
        </LineChart>
      </ResponsiveContainer>
    );
  }
  if (spec.kind === "area") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={spec.data} margin={{ left: -8, right: 8, top: 8, bottom: 0 }}>
          {grid}
          <XAxis dataKey={spec.xKey} {...axis} minTickGap={18} />
          <YAxis {...axis} tickFormatter={(v) => axisTick(v, u)} width={48} />
          {tip}
          {spec.series.map((s) => <Area key={s.key} dataKey={s.key} name={s.label} stroke={TONE[s.tone]} strokeWidth={2.25} fill="var(--accent-soft)" fillOpacity={0.7} type="monotone" />)}
        </AreaChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={spec.data} margin={{ left: -8, right: 8, top: 8, bottom: 0 }} barGap={3}>
        {grid}
        <XAxis dataKey={spec.xKey} {...axis} minTickGap={8} />
        <YAxis {...axis} tickFormatter={(v) => axisTick(v, u)} width={48} />
        {tip}
        {spec.series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={TONE[s.tone]} radius={[5, 5, 0, 0]} maxBarSize={34} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Spark({ data }: { data: number[] }) {
  const d = data.map((v, i) => ({ i, v }));
  return (
    <div style={{ width: 84, height: 28 }}>
      <ResponsiveContainer>
        <LineChart data={d} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
          <Line dataKey="v" stroke="var(--accent)" strokeWidth={1.75} dot={false} type="monotone" isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
