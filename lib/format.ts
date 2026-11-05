import type { Unit } from "./types";

export function inr(n: number, compact = true): string {
  const neg = n < 0;
  const a = Math.abs(n);
  let s: string;
  if (compact && a >= 1e7) s = `₹${(a / 1e7).toFixed(a >= 1e9 ? 0 : 2)} Cr`;
  else if (compact && a >= 1e5) s = `₹${(a / 1e5).toFixed(a >= 1e7 ? 0 : 1)} L`;
  else s = `₹${Math.round(a).toLocaleString("en-IN")}`;
  return neg ? `−${s}` : s;
}

export function num(n: number): string {
  if (Math.abs(n) >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`;
  if (Math.abs(n) >= 1e5) return `${(n / 1e5).toFixed(1)} L`;
  return Math.round(n).toLocaleString("en-IN");
}

export function fmt(v: number, unit: Unit, compact = true): string {
  switch (unit) {
    case "inr":
      return inr(v, compact);
    case "pct":
      return `${(v * 100).toFixed(1)}%`;
    case "days":
      return `${Math.round(v)} days`;
    case "hrs":
      return `${Math.round(v).toLocaleString("en-IN")} hrs`;
    case "qty":
    case "num":
    default:
      return num(v);
  }
}

export function delta(d?: number): string {
  if (d === undefined || !isFinite(d)) return "";
  const s = `${Math.abs(d * 100).toFixed(1)}%`;
  return d >= 0 ? `+${s}` : `−${s}`;
}

export function axisTick(v: number, unit: Unit): string {
  if (unit === "inr") {
    const a = Math.abs(v);
    if (a >= 1e7) return `${(v / 1e7).toFixed(1)}Cr`;
    if (a >= 1e5) return `${(v / 1e5).toFixed(0)}L`;
    if (a >= 1e3) return `${(v / 1e3).toFixed(a % 1000 === 0 ? 0 : 1)}k`;
    return `${v}`;
  }
  if (unit === "pct") return `${Math.round(v * 100)}%`;
  if (Math.abs(v) >= 1e5) return `${(v / 1e5).toFixed(0)}L`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(Math.abs(v) % 1000 === 0 ? 0 : 1)}k`;
  return `${v}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function monthLabel(d: Date) {
  return `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}
export function dateLabel(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]}`;
}
export function fullDate(d: Date) {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "module";
}

export function uid() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}
