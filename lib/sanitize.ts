import type { Automation, Blueprint, Column, CustomModule, ModuleKey, Recommendation, Row, Unit } from "./types";
import { slug } from "./format";

const UNITS: Unit[] = ["inr", "num", "pct", "days", "hrs", "qty"];
const COLTYPES: Column["type"][] = ["text", "number", "inr", "date", "status", "pct", "qty"];
export const ICONS = ["LayoutGrid", "Layers", "Wrench", "Mountain", "Ship", "Handshake", "Zap", "Hammer", "Scale", "Inbox", "Car", "ClipboardList", "Gauge", "Package", "Leaf", "Flame", "Droplets", "Recycle", "Store", "FileText", "Timer", "MapPin"];

const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const arr = (v: unknown) => (Array.isArray(v) ? v : []);
const n = (v: unknown, d = 0) => (typeof v === "number" && isFinite(v) ? v : typeof v === "string" && isFinite(Number(v)) ? Number(v) : d);
const unit = (v: unknown): Unit => (UNITS.includes(v as Unit) ? (v as Unit) : "num");
const strs = (v: unknown, min: number, max: number, fallback: string[]) => {
  const a = arr(v).map((x) => str(x, 80)).filter(Boolean).slice(0, max);
  return a.length >= min ? a : fallback;
};

function kpis(v: unknown) {
  return arr(v).slice(0, 4).map((k) => {
    const o = (k ?? {}) as Record<string, unknown>;
    const u = unit(o.unit);
    let value = n(o.value);
    if (u === "pct" && value > 1.5) value = value / 100;
    return { label: str(o.label, 60) || "Metric", value, unit: u, goodWhen: o.goodWhen === "down" ? ("down" as const) : o.goodWhen === "up" ? ("up" as const) : undefined };
  });
}

export function sanitizeCustom(v: unknown): CustomModule | null {
  const o = (v ?? {}) as Record<string, unknown>;
  const title = str(o.title, 48);
  if (!title) return null;
  const columns: Column[] = arr(o.columns).slice(0, 7).map((c, i) => {
    const co = (c ?? {}) as Record<string, unknown>;
    return { key: slug(str(co.key, 30) || `col${i}`).replace(/-/g, "_"), label: str(co.label, 30) || `Field ${i + 1}`, type: COLTYPES.includes(co.type as Column["type"]) ? (co.type as Column["type"]) : "text" };
  });
  if (columns.length < 2) return null;
  const rawRows = arr(o.rows).slice(0, 12);
  const origKeys = arr(o.columns).slice(0, 7).map((c, i) => str(((c ?? {}) as Record<string, unknown>).key, 30) || `col${i}`);
  const rows: Row[] = rawRows.map((r) => {
    const ro = (r ?? {}) as Record<string, unknown>;
    const out: Row = {};
    columns.forEach((c, i) => {
      const val = ro[origKeys[i]] ?? ro[c.key] ?? ro[c.label];
      if (["number", "inr", "pct", "qty"].includes(c.type)) {
        let x = n(val);
        if (c.type === "pct" && x > 1.5) x = x / 100;
        out[c.key] = x;
      } else out[c.key] = str(val, 80) || "—";
    });
    return out;
  });
  const ch = (o.chart ?? {}) as Record<string, unknown>;
  const labels = arr(ch.labels).map((x) => str(x, 20)).slice(0, 12);
  const values = arr(ch.values).map((x) => n(x)).slice(0, labels.length);
  const u = unit(ch.unit);
  return {
    key: `x-${slug(title)}`,
    title,
    icon: ICONS.includes(str(o.icon)) ? str(o.icon) : "LayoutGrid",
    description: str(o.description, 200),
    kpis: kpis(o.kpis),
    columns,
    rows,
    chart: {
      title: str(ch.title, 60) || title,
      kind: ch.kind === "line" ? "line" : "bar",
      labels: labels.length ? labels : ["W1", "W2", "W3", "W4"],
      values: (values.length ? values : [4, 7, 5, 9]).map((x) => (u === "pct" && x > 1.5 ? x / 100 : x)),
      unit: u,
    },
    insights: strs(o.insights, 1, 3, []),
  };
}

export function mergeAI(base: Blueprint, ai: unknown): Blueprint {
  const o = (ai ?? {}) as Record<string, unknown>;
  const bp: Blueprint = { ...base, source: "gemini" };
  if (str(o.headline)) bp.headline = str(o.headline, 120);
  if (str(o.summary)) bp.summary = str(o.summary, 700);
  const v = (o.vocab ?? {}) as Record<string, unknown>;
  bp.vocab = {
    ...base.vocab,
    products: strs(v.products, 4, 6, base.vocab.products),
    rawMaterials: strs(v.rawMaterials, 3, 6, base.vocab.rawMaterials),
    customers: strs(v.customers, 4, 7, base.vocab.customers),
    suppliers: strs(v.suppliers, 3, 5, base.vocab.suppliers),
    cities: strs(v.cities, 3, 7, base.vocab.cities),
    departments: strs(v.departments, 3, 6, base.vocab.departments),
    unit: str(v.unit, 12) || base.vocab.unit,
  };
  const aiMods = arr(o.modules);
  bp.modules = base.modules.map((m) => {
    const found = aiMods.find((x) => (x as Record<string, unknown>)?.key === m.key) as Record<string, unknown> | undefined;
    if (!found) return m;
    return { key: m.key as ModuleKey, insights: strs(found.insights, 2, 3, m.insights), extraKpis: kpis(found.extraKpis).slice(0, 1) };
  });
  const cms = arr(o.customModules).map(sanitizeCustom).filter(Boolean) as CustomModule[];
  if (cms.length) bp.customModules = cms.slice(0, 4);
  const recs: Recommendation[] = arr(o.recommendations).slice(0, 5).map((r) => {
    const ro = (r ?? {}) as Record<string, unknown>;
    return { title: str(ro.title, 80), detail: str(ro.detail, 260), impact: str(ro.impact, 80), module: str(ro.module, 20) || "overview" };
  }).filter((r) => r.title);
  if (recs.length >= 2) bp.recommendations = recs;
  const autos: Automation[] = arr(o.automations).slice(0, 7).map((a) => {
    const ao = (a ?? {}) as Record<string, unknown>;
    const ch = ["WhatsApp", "SMS", "Email", "In-app"].includes(str(ao.channel)) ? (str(ao.channel) as Automation["channel"]) : "WhatsApp";
    return { trigger: str(ao.trigger, 100), action: str(ao.action, 160), channel: ch, enabled: ao.enabled !== false };
  }).filter((a) => a.trigger && a.action);
  if (autos.length >= 2) bp.automations = autos;
  return bp;
}
