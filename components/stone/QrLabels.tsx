"use client";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Printer } from "lucide-react";
import { cbm, dmy, n2 } from "@/lib/stone/calc";
import type { Block } from "@/lib/stone/types";
import type { Ctx } from "./StoneApp";
import { Drawer, Note } from "./ui";

export const blockUrl = (id: string) => `${typeof window !== "undefined" ? window.location.origin : ""}/stone/b/${id}`;

function Qr({ text, size = 116 }: { text: string; size?: number }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toString(text, { type: "svg", margin: 0, errorCorrectionLevel: "M" }).then((s) => alive && setSvg(s));
    return () => { alive = false; };
  }, [text]);
  return <div style={{ width: size, height: size }} className="shrink-0 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} aria-label="QR code" />;
}

/** Sheet of QR labels, three across an A4 page. Stick one on each block or paint the number beside it. */
export default function QrLabels({ ctx, blocks, onClose }: { ctx: Ctx; blocks: Block[]; onClose: () => void }) {
  const [pick, setPick] = useState<Set<string>>(() => new Set(blocks.filter((b) => ["at_mine", "in_transit", "in_yard", "on_saw"].includes(b.status)).map((b) => b.id)));
  const chosen = useMemo(() => blocks.filter((b) => pick.has(b.id)), [blocks, pick]);
  const sup = (id: string) => ctx.db.parties.find((p) => p.id === id)?.company;
  const toggle = (id: string) => setPick((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <Drawer open wide title="QR labels for blocks" sub="Scan with any phone camera at the gate, yard or saw to open the block and update it." onClose={onClose}
      footer={<><button className="btn btn-primary" disabled={!chosen.length} onClick={() => window.print()}><Printer size={15} />Print {chosen.length} labels</button><button className="btn btn-quiet" onClick={onClose}>Close</button></>}>
      {ctx.mode === "demo" && <div className="mb-4"><Note>In the demo, the codes open the demo. In your company account they open the block for whoever is signed in.</Note></div>}
      <div className="no-print mb-4 flex flex-wrap gap-1.5">
        <button className="chip" onClick={() => setPick(new Set(blocks.map((b) => b.id)))}>All {blocks.length}</button>
        <button className="chip" onClick={() => setPick(new Set())}>None</button>
        {blocks.map((b) => <button key={b.id} className="chip" data-on={pick.has(b.id)} onClick={() => toggle(b.id)}>{b.no}</button>)}
      </div>
      <div className="print-area qr-sheet grid grid-cols-2 gap-3 bg-white p-3 text-black sm:grid-cols-3">
        {chosen.map((b) => (
          <div key={b.id} className="qr-label flex gap-3 rounded-lg border border-black/25 p-3">
            <Qr text={ctx.mode === "demo" ? `${window.location.origin}/stone/demo?v=scan&t=${b.id}` : blockUrl(b.id)} />
            <div className="min-w-0 text-[12px] leading-snug">
              <div className="whitespace-nowrap text-[17px] font-bold leading-tight">{b.no}</div>
              <div className="font-semibold">{b.variety}</div>
              <div>{b.l}×{b.w}×{b.h} cm</div>
              <div>{n2(b.tonnes || b.billedTonnes)} t · {n2(cbm(b))} CBM</div>
              <div className="truncate">{b.source === "own_mine" ? b.mine : sup(b.supplierId) ?? ""}</div>
              <div>{dmy(b.date)}</div>
              <div className="mt-1 text-[10px] opacity-70">{ctx.db.settings.company}</div>
            </div>
          </div>
        ))}
      </div>
    </Drawer>
  );
}

export { Qr };
