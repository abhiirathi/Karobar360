"use client";
import { useMemo, useState } from "react";
import { ArrowRightLeft, Pickaxe, ReceiptText, Scissors, Search } from "lucide-react";
import { dmy } from "@/lib/stone/calc";
import { firmName, journey } from "@/lib/stone/firms";
import type { Ctx } from "./StoneApp";
import { Note } from "./ui";

/** Follow one block, lot or slab through every firm of the group, from quarry to customer. */
export default function TraceView({ ctx }: { ctx: Ctx }) {
  const db = ctx.root;
  const [q, setQ] = useState(ctx.sub || "");
  const res = useMemo(() => journey(db, q), [db, q]);
  const multi = ctx.firms.length > 1;
  const recent = useMemo(() => [...db.blocks].sort((a, b) => (b.receivedOn || b.date).localeCompare(a.receivedOn || a.date)).slice(0, 10), [db.blocks]);
  const opts = useMemo(() => [...db.blocks.map((b) => b.no), ...db.lots.map((l) => l.lotNo)], [db.blocks, db.lots]);

  return (
    <div className="max-w-[860px]">
      <p className="text-ink-2">Type a block no., lot no. or slab no. to see where it came from, every firm it passed through, and who bought it.</p>
      <label className="mt-4 flex items-center gap-2 rounded-2xl bg-surface px-4 py-3">
        <Search size={17} className="text-ink-3" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} list="trace-nos" placeholder="BL-001, L-121 or MW-227/07" className="w-full bg-transparent text-[1.05rem] outline-none placeholder:text-ink-3" />
        <datalist id="trace-nos">{opts.map((o) => <option key={o} value={o} />)}</datalist>
      </label>

      {!q && (
        <div className="mt-6">
          <div className="text-sm font-medium text-ink-2">Recent blocks</div>
          <div className="mt-2 flex flex-wrap gap-1.5">{recent.map((b) => <button key={b.id} className="chip" onClick={() => setQ(b.no)}>{b.no}</button>)}</div>
        </div>
      )}
      {q && !res && <div className="mt-6"><Note>Nothing found for “{q}”. Check the number, including the dash and slash.</Note></div>}

      {res && (
        <div className="mt-6 rounded-[22px] bg-surface p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[1.4rem] font-semibold tracking-tight">{res.what}</h2>
            <span className="text-sm text-ink-2">Now: {res.now}</span>
          </div>
          <ol className="relative mt-5 space-y-5 border-l-2 border-surface-2 pl-6">
            {res.steps.map((st, i) => {
              const I = st.tone === "move" ? ArrowRightLeft : st.tone === "sale" ? ReceiptText : st.tone === "cut" ? Scissors : Pickaxe;
              return (
                <li key={i} className="relative">
                  <span className={`absolute -left-[37px] top-0 grid h-8 w-8 place-items-center rounded-full ${st.tone === "move" ? "bg-accent text-accent-ink" : st.tone === "sale" ? "bg-ink text-ground" : "bg-surface-2 text-ink-2"}`}><I size={15} /></span>
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="font-medium">{st.title}</span>
                    <span className="text-[0.82rem] text-ink-3">{dmy(st.date)}</span>
                  </div>
                  {multi && <div className="mt-0.5 text-[0.8rem] font-medium text-accent">{firmName(db.settings, st.firm)}</div>}
                  {st.detail && <div className="mt-0.5 text-[0.88rem] text-ink-2">{st.detail}</div>}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
