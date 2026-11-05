"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Search, X } from "lucide-react";

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "warn" | "neg" | "good" }) {
  const t = tone === "neg" ? "text-neg" : tone === "warn" ? "text-warn" : tone === "good" ? "text-accent" : "text-ink-3";
  return (
    <div className="rounded-2xl bg-surface p-4">
      <div className="text-sm text-ink-2">{label}</div>
      <div className="num mt-1.5 text-[1.3rem] font-semibold leading-tight sm:text-[1.55rem] tracking-tight">{value}</div>
      {sub && <div className={`mt-1 text-[0.8rem] ${t}`}>{sub}</div>}
    </div>
  );
}

export function Seg<T extends string>({ tabs, value, onChange }: { tabs: { key: T; label: string; count?: number }[]; value: T; onChange: (k: T) => void }) {
  return (
    <div className="scroll-thin -mx-1 flex gap-1 overflow-x-auto px-1" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={value === t.key} onClick={() => onChange(t.key)} className="chip shrink-0" data-on={value === t.key}>
          {t.label}
          {t.count !== undefined && <span className="num ml-1.5 opacity-70">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Badge({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "good" | "warn" | "neg" | "info" }) {
  const c = {
    plain: "bg-surface-2 text-ink-2",
    good: "bg-accent-soft text-accent",
    warn: "bg-warn-soft text-warn",
    neg: "bg-neg-soft text-neg",
    info: "bg-surface-3 text-ink",
  }[tone];
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[0.75rem] font-medium ${c}`}>{children}</span>;
}

export type Col<T> = { key: string; label: string; render: (r: T) => ReactNode; sort?: (r: T) => number | string; align?: "right"; className?: string };

export function Table<T extends { id: string }>({ rows, cols, empty, onRow, search, initialSort }: {
  rows: T[];
  cols: Col<T>[];
  empty: ReactNode;
  onRow?: (r: T) => void;
  search?: (r: T) => string;
  initialSort?: { key: string; dir: 1 | -1 };
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState(initialSort ?? null);
  const view = useMemo(() => {
    let v = rows;
    if (q && search) {
      const s = q.toLowerCase();
      v = v.filter((r) => search(r).toLowerCase().includes(s));
    }
    if (sort) {
      const c = cols.find((x) => x.key === sort.key);
      if (c?.sort) v = [...v].sort((a, b) => ((c.sort!(a) as number) > (c.sort!(b) as number) ? 1 : (c.sort!(a) as number) < (c.sort!(b) as number) ? -1 : 0) * sort.dir);
    }
    return v;
  }, [rows, q, sort, cols, search]);
  return (
    <div>
      {search && rows.length > 6 && (
        <label className="mb-3 flex max-w-xs items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm">
          <Search size={15} className="text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="w-full bg-transparent outline-none placeholder:text-ink-3" />
        </label>
      )}
      <div className="scroll-thin overflow-x-auto rounded-2xl bg-surface">
        <table className="w-full min-w-[640px] text-left text-[0.88rem]">
          <thead>
            <tr className="text-[0.78rem] text-ink-3">
              {cols.map((c) => (
                <th key={c.key} className={`whitespace-nowrap px-3 py-2.5 font-medium first:pl-4 last:pr-4 ${c.align === "right" ? "text-right" : ""}`}>
                  {c.sort ? (
                    <button className="inline-flex items-center gap-1 hover:text-ink" onClick={() => setSort((s) => ({ key: c.key, dir: s?.key === c.key ? ((-s.dir) as 1 | -1) : -1 }))}>
                      {c.label}
                      {sort?.key === c.key && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </button>
                  ) : c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={r.id} onClick={onRow ? () => onRow(r) : undefined} className={`border-t border-surface-2 ${onRow ? "cursor-pointer transition-colors hover:bg-surface-2/60" : ""}`}>
                {cols.map((c) => (
                  <td key={c.key} className={`px-3 py-2.5 align-top first:pl-4 last:pr-4 ${c.align === "right" ? "num text-right" : ""} ${c.className ?? ""}`}>{c.render(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!view.length && <div className="px-4 py-10 text-center text-ink-3">{empty}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, title, sub, onClose, children, footer, wide }: { open: boolean; title: string; sub?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button className="fade-in absolute inset-0 bg-black/35" aria-label="Close" onClick={onClose} />
      <div className={`slidein relative flex h-full w-full flex-col bg-ground shadow-2xl ${wide ? "max-w-3xl" : "max-w-xl"}`}>
        <div className="flex items-start gap-3 px-5 pb-3 pt-5 sm:px-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            {sub && <p className="mt-0.5 text-sm text-ink-2">{sub}</p>}
          </div>
          <button onClick={onClose} className="btn btn-quiet btn-sm ml-auto !px-2" aria-label="Close"><X size={16} /></button>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto px-5 pb-6 sm:px-6">{children}</div>
        {footer && <div className="flex flex-wrap items-center gap-2 border-t border-surface-2 bg-surface px-5 py-3 sm:px-6">{footer}</div>}
      </div>
    </div>
  );
}

export function F({ label, hint, children, span = 1, err }: { label: string; hint?: ReactNode; children: ReactNode; span?: 1 | 2 | 3; err?: string }) {
  const s = span === 3 ? "sm:col-span-3" : span === 2 ? "sm:col-span-2" : "";
  return (
    <label className={`block ${s}`}>
      <span className="mb-1 block text-[0.82rem] font-medium text-ink-2">{label}</span>
      {children}
      {err ? <span className="mt-1 block text-[0.78rem] text-neg">{err}</span> : hint ? <span className="mt-1 block text-[0.78rem] text-ink-3">{hint}</span> : null}
    </label>
  );
}

export function Grid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  return <div className={`grid gap-3.5 ${cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>{children}</div>;
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <fieldset className="mt-6 first:mt-2">
      <div className="mb-3 flex items-center gap-2">
        <legend className="text-[0.95rem] font-semibold">{title}</legend>
        {aside && <div className="ml-auto">{aside}</div>}
      </div>
      {children}
    </fieldset>
  );
}

export function TextIn({ value, onChange, placeholder, type = "text", upper, list }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; upper?: boolean; list?: string }) {
  return <input className="field" type={type} value={value} list={list} placeholder={placeholder} onChange={(e) => onChange(upper ? e.target.value.toUpperCase() : e.target.value)} />;
}

export function NumIn({ value, onChange, placeholder, step = "any", suffix }: { value: number; onChange: (v: number) => void; placeholder?: string; step?: string; suffix?: string }) {
  const [txt, setTxt] = useState(value ? String(value) : "");
  useEffect(() => {
    if ((Number(txt) || 0) !== value) setTxt(value ? String(value) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="relative">
      <input className={`field num ${suffix ? "pr-12" : ""}`} inputMode="decimal" type="number" step={step} value={txt} placeholder={placeholder ?? "0"}
        onChange={(e) => { setTxt(e.target.value); onChange(Number(e.target.value) || 0); }} />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[0.8rem] text-ink-3">{suffix}</span>}
    </div>
  );
}

export function Sel({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[]; placeholder?: string }) {
  return (
    <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

/** Searchable picker for long lists (lots, blocks). Type to filter, arrow keys and Enter to choose. */
export function Pick({ onPick, options, placeholder, empty = "Nothing matches" }: { onPick: (v: string) => void; options: { v: string; l: string; sub?: string; find?: string }[]; placeholder: string; empty?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return options.filter((o) => { const t = `${o.l} ${o.sub ?? ""} ${o.find ?? ""}`.toLowerCase(); return words.every((w) => t.includes(w)); });
  }, [q, options]);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [open]);
  const choose = (v: string) => { onPick(v); setOpen(false); setQ(""); setHi(0); };
  return (
    <div ref={box} className="relative min-w-[220px]">
      <button type="button" className="field flex items-center justify-between gap-2 text-left" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="truncate text-ink-2">{placeholder}</span><ChevronDown size={15} className="shrink-0 text-ink-3" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-[min(92vw,440px)] overflow-hidden rounded-2xl border border-surface-2 bg-ground shadow-xl">
          <label className="flex items-center gap-2 border-b border-surface-2 px-3 py-2.5">
            <Search size={15} className="text-ink-3" />
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setHi(0); }} placeholder="Search lot, block, variety…" className="w-full bg-transparent text-[0.92rem] outline-none placeholder:text-ink-3"
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(shown.length - 1, h + 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
                else if (e.key === "Enter" && shown[hi]) { e.preventDefault(); choose(shown[hi].v); }
                else if (e.key === "Escape") setOpen(false);
              }} />
          </label>
          <ul role="listbox" className="scroll-thin max-h-72 overflow-y-auto py-1">
            {shown.map((o, i) => (
              <li key={o.v} role="option" aria-selected={i === hi}>
                <button type="button" onMouseEnter={() => setHi(i)} onClick={() => choose(o.v)} className={`w-full px-3 py-2 text-left text-[0.9rem] ${i === hi ? "bg-accent-soft" : ""}`}>
                  <span className="block font-medium">{o.l}</span>{o.sub && <span className="block text-[0.8rem] text-ink-3">{o.sub}</span>}
                </button>
              </li>
            ))}
            {!shown.length && <li className="px-3 py-4 text-center text-[0.88rem] text-ink-3">{empty}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

export function Area({ value, onChange, placeholder, rows = 2 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return <textarea className="field resize-y" rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface px-6 py-12 text-center">
      <div className="font-semibold">{title}</div>
      {children && <p className="mx-auto mt-1 max-w-[46ch] text-ink-2">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Note({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "warn" | "neg" | "good" }) {
  const c = tone === "warn" ? "bg-warn-soft" : tone === "neg" ? "bg-neg-soft" : tone === "good" ? "bg-accent-soft" : "bg-surface-2";
  return <div className={`rounded-xl px-3.5 py-2.5 text-[0.86rem] text-ink ${c}`}>{children}</div>;
}

/** Downscales a photo to keep localStorage small. */
export function readPhoto(file: File, max = 900): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = rej;
    fr.onload = () => {
      const img = new Image();
      img.onerror = rej;
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL("image/jpeg", 0.72));
      };
      img.src = String(fr.result);
    };
    fr.readAsDataURL(file);
  });
}

export function readFile(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = rej;
    fr.onload = () => res(String(fr.result));
    fr.readAsDataURL(file);
  });
}
