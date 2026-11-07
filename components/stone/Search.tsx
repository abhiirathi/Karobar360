"use client";
import { useMemo, useRef, useState } from "react";
import { Search as SearchIcon, X } from "lucide-react";
import { searchHits, searchIndex, type SearchScope } from "@/lib/stone/search";
import type { StoneDB } from "@/lib/stone/types";

/** One box above the sidebar sections: find a block, lot, invoice, purchase, job order or party and open it. */
export default function GlobalSearch({ db, scope, firms, onOpen }: { db: StoneDB; scope: SearchScope; firms: { id: string; name: string }[]; onOpen: (view: string, sub: string, firm?: string) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const index = useMemo(() => (open ? searchIndex(db, scope) : []), [db, scope, open]);
  const { hits, more } = useMemo(() => searchHits(index, q), [index, q]);
  const show = open && q.trim().length > 0;

  const pick = (i: number) => {
    const h = hits[i];
    if (!h) return;
    onOpen(h.go[0], h.go[1], h.firm);
    setQ("");
    setOpen(false);
    input.current?.blur();
  };

  return (
    <div className="relative">
      <label className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm ring-1 ring-surface-3 focus-within:ring-2 focus-within:ring-accent">
        <SearchIcon size={15} className="shrink-0 text-ink-3" />
        <input ref={input} value={q} placeholder="Search block, lot, invoice, party…" aria-label="Search everything"
          className="w-full min-w-0 bg-transparent outline-none placeholder:text-ink-3"
          onChange={(e) => { setQ(e.target.value); setHi(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setHi((x) => Math.min(hits.length - 1, x + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHi((x) => Math.max(0, x - 1)); }
            else if (e.key === "Enter") { e.preventDefault(); pick(hi); }
            else if (e.key === "Escape") { setQ(""); input.current?.blur(); }
          }} />
        {q && <button type="button" aria-label="Clear search" className="shrink-0 text-ink-3 hover:text-ink" onMouseDown={(e) => e.preventDefault()} onClick={() => { setQ(""); input.current?.focus(); }}><X size={14} /></button>}
      </label>
      {show && (
        <div role="listbox" aria-label="Search results" className="scroll-thin absolute inset-x-0 z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-2xl border border-surface-2 bg-ground p-1 shadow-xl">
          {hits.map((h, i) => (
            <button key={h.key} type="button" role="option" aria-selected={i === hi}
              className={`flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left ${i === hi ? "bg-surface-2" : "hover:bg-surface-2/60"}`}
              onMouseEnter={() => setHi(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(i)}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9rem] font-medium">{h.title}</span>
                <span className="block truncate text-[0.78rem] text-ink-3">{h.sub}{firms.length > 1 && h.firm ? ` · ${firms.find((f) => f.id === h.firm)?.name ?? ""}` : ""}</span>
              </span>
              <span className="mt-0.5 shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[0.72rem] text-ink-2">{h.kind}</span>
            </button>
          ))}
          {!hits.length && <div className="px-3 py-3 text-[0.86rem] text-ink-3">Nothing found for “{q.trim()}”.</div>}
          {more > 0 && <div className="px-3 py-2 text-[0.78rem] text-ink-3">{more} more. Type more of the number or name to narrow it down.</div>}
        </div>
      )}
    </div>
  );
}
