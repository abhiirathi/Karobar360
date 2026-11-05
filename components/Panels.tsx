"use client";
import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Download, Search, Upload } from "lucide-react";
import type { Alert, ChartSpec, KPI, Lang, Row, TableSpec } from "@/lib/types";
import { delta, fmt } from "@/lib/format";
import { t } from "@/lib/i18n";
import { ChartBody, Spark } from "./Charts";

export function Panel({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <section className={`rounded-2xl bg-surface p-5 ${className}`} style={style}>{children}</section>;
}

export function KpiCard({ k, lang, i = 0 }: { k: KPI; lang: Lang; i?: number }) {
  const good = k.delta === undefined || !k.goodWhen ? null : (k.delta >= 0) === (k.goodWhen === "up");
  return (
    <Panel className="enter flex min-h-[132px] flex-col justify-between" style={{ ["--d" as string]: `${i * 60}ms` }}>
      <div className="text-sm leading-snug text-ink-2">{t(lang, k.label)}</div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="num whitespace-nowrap text-[1.55rem] font-semibold leading-none tracking-tight">{fmt(k.value, k.unit)}</div>
          <div className="mt-2 text-xs text-ink-3">
            {k.delta !== undefined && (
              <span className={`num mr-1.5 font-medium ${good === null ? "text-ink-2" : good ? "text-accent" : "text-neg"}`}>{delta(k.delta)}</span>
            )}
            {k.hint ?? (k.delta !== undefined ? "vs previous period" : "")}
          </div>
        </div>
        {k.spark && <Spark data={k.spark} />}
      </div>
    </Panel>
  );
}

export function ChartPanel({ spec, lang, i = 0 }: { spec: ChartSpec; lang: Lang; i?: number }) {
  return (
    <Panel className={`enter ${spec.wide ? "lg:col-span-2" : ""}`} style={{ ["--d" as string]: `${120 + i * 70}ms` }}>
      <div className="mb-1 flex items-baseline justify-between gap-4">
        <h3 className="font-medium">{t(lang, spec.title)}</h3>
        {spec.series.length > 1 && (
          <div className="flex shrink-0 gap-3 text-xs text-ink-3">
            {spec.series.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: `var(--${s.tone === "accent" ? "accent" : s.tone === "muted" ? "data-2" : "data-3"})` }} />
                {s.label}
              </span>
            ))}
          </div>
        )}
      </div>
      {spec.finding && <p className="mb-4 text-sm text-ink-2">{spec.finding}</p>}
      <ChartBody spec={spec} />
    </Panel>
  );
}

const NEG = /overdue|critical|delayed|escalate|hold|absent|behind|rework|lost|check loss|under repair|qc hold/i;
const WARN = /low|due|follow|reminder|late|pending|awaiting|leave|partial|high usage|negotiation|loading|not started/i;
const POS = /^ok$|delivered|completed|filed|paid|present|healthy|passed|reconciled|won|approved|qualified|returned|received|ready|on track|normal|shipped|dispatched|confirmed|done/i;

export function Status({ v }: { v: string }) {
  const tone = NEG.test(v) ? "text-neg" : POS.test(v) ? "text-accent" : WARN.test(v) ? "text-warn" : "text-ink-2";
  const dot = NEG.test(v) ? "bg-neg" : POS.test(v) ? "bg-accent" : WARN.test(v) ? "bg-warn" : "bg-ink-3";
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {v}
    </span>
  );
}

function cell(v: string | number | undefined, type: string) {
  if (v === undefined || v === null || v === "") return "—";
  if (type === "inr") return fmt(Number(v), "inr", false);
  if (type === "pct") return fmt(Number(v), "pct");
  if (type === "number" || type === "qty") return Number(v).toLocaleString("en-IN");
  return String(v);
}

function toCSV(spec: TableSpec, rows: Row[]) {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [spec.columns.map((c) => esc(c.label)).join(","), ...rows.map((r) => spec.columns.map((c) => esc(String(r[c.key] ?? ""))).join(","))].join("\n");
}

function parseCSV(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((x) => x.trim())) out.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((x) => x.trim())) out.push(row);
  return out;
}

export function DataTable({ spec, lang, onImport }: { spec: TableSpec; lang: Lang; onImport?: (rows: Row[]) => void }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rows = useMemo(() => {
    let r = spec.rows;
    if (q) r = r.filter((x) => Object.values(x).some((v) => String(v).toLowerCase().includes(q.toLowerCase())));
    if (sort) r = [...r].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      return (typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv))) * sort.dir;
    });
    return r;
  }, [spec.rows, q, sort]);

  const download = () => {
    const blob = new Blob([toCSV(spec, rows)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${spec.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
    a.click();
  };

  const upload = async (f: File) => {
    const grid = parseCSV(await f.text());
    if (grid.length < 2) return;
    const head = grid[0].map((h) => h.trim().toLowerCase());
    const idx = spec.columns.map((c) => {
      const i = head.findIndex((h) => h === c.label.toLowerCase() || h === c.key.toLowerCase());
      return i;
    });
    const mapped: Row[] = grid.slice(1).map((line) => {
      const o: Row = {};
      spec.columns.forEach((c, ci) => {
        const raw = (idx[ci] >= 0 ? line[idx[ci]] : line[ci]) ?? "";
        const clean = raw.replace(/[₹,\s]/g, "");
        o[c.key] = ["inr", "number", "qty", "pct"].includes(c.type) && clean !== "" && !isNaN(Number(clean)) ? Number(clean) : raw.trim();
      });
      return o;
    });
    onImport?.(mapped);
  };

  return (
    <Panel className="enter lg:col-span-2" style={{ ["--d" as string]: "200ms" }}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h3 className="mr-auto font-medium">{t(lang, spec.title)} <span className="num ml-1 text-sm font-normal text-ink-3">{rows.length}</span></h3>
        <label className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t(lang, "Search")} className="field !w-48 !py-2 !pl-9 text-sm" />
        </label>
        {onImport && (
          <>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <button className="btn btn-quiet btn-sm" onClick={() => fileRef.current?.click()} title="Upload a CSV exported from Tally, Busy or Excel"><Upload size={14} />{t(lang, "Import CSV")}</button>
          </>
        )}
        <button className="btn btn-quiet btn-sm" onClick={download}><Download size={14} />{t(lang, "Export CSV")}</button>
      </div>
      <div className="scroll-thin -mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="text-ink-3">
              {spec.columns.map((c) => {
                const right = ["inr", "number", "qty", "pct"].includes(c.type);
                return (
                  <th key={c.key} className={`whitespace-nowrap pb-2 pr-4 font-normal ${right ? "text-right" : ""}`}>
                    <button className="focusable inline-flex items-center gap-1 rounded hover:text-ink" onClick={() => setSort((s) => ({ key: c.key, dir: s?.key === c.key && s.dir === 1 ? -1 : 1 }))}>
                      {c.label}
                      {sort?.key === c.key && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="odd:bg-ground/60 [&>td:first-child]:rounded-l-lg [&>td:last-child]:rounded-r-lg">
                {spec.columns.map((c) => {
                  const right = ["inr", "number", "qty", "pct"].includes(c.type);
                  return (
                    <td key={c.key} className={`py-2.5 pr-4 first:pl-2 ${right ? "num text-right" : ""} ${c === spec.columns[0] ? "font-medium" : "text-ink-2"}`}>
                      {c.type === "status" ? <Status v={String(r[c.key] ?? "")} /> : cell(r[c.key], c.type)}
                    </td>
                  );
                })}
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={spec.columns.length} className="py-8 text-center text-ink-3">No rows match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function AlertList({ alerts, lang, onOpen }: { alerts: Alert[]; lang: Lang; onOpen?: (m: string) => void }) {
  if (!alerts.length) return null;
  return (
    <Panel className="enter">
      <h3 className="mb-3 font-medium">{t(lang, "Needs attention")}</h3>
      <ul className="space-y-1">
        {alerts.map((a, i) => (
          <li key={i}>
            <button onClick={() => onOpen?.(a.module)} className="focusable flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left text-sm transition-colors hover:bg-surface-2">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.level === "critical" ? "bg-neg" : a.level === "warn" ? "bg-warn" : "bg-data-2 bg-ink-3"}`} />
              <span className="text-ink-2">{a.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function InsightList({ items, lang, title = "Insights" }: { items: string[]; lang: Lang; title?: string }) {
  if (!items.length) return null;
  return (
    <Panel className="enter">
      <h3 className="mb-3 font-medium">{t(lang, title)}</h3>
      <ul className="space-y-3 text-sm text-ink-2">
        {items.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-2 h-1 w-3 shrink-0 rounded-full bg-accent" />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
