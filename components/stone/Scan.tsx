"use client";
import { useState } from "react";
import { Camera, Check, Factory, Truck } from "lucide-react";
import { cbm, dmy, n2, today } from "@/lib/stone/calc";
import type { Ctx } from "./StoneApp";
import type { Block } from "@/lib/stone/types";
import { whereIs } from "@/lib/stone/godowns";
import { Badge, Note, readPhoto } from "./ui";
import { Weighment } from "./Weigh";
import { fileSrc } from "./files";

/** What a phone sees after scanning a block's QR label. */
export default function Scan({ ctx, blockId }: { ctx: Ctx; blockId: string }) {
  const { db, update, go } = ctx;
  const b = ctx.root.blocks.find((x) => x.id === blockId);
  const [wb, setWb] = useState<Partial<Block>>({ tonnes: 0 });
  const [done, setDone] = useState("");
  if (!b) {
    return (
      <div className="mx-auto max-w-[520px] pt-6 text-center">
        <div className="text-lg font-semibold">Block not found</div>
        <p className="mt-2 text-ink-2">This label belongs to a block that is not in {db.settings.company}’s records, or you do not have access to blocks.</p>
        <button className="btn btn-quiet mt-5" onClick={() => go("overview")}>Go to the dashboard</button>
      </div>
    );
  }
  const sup = db.parties.find((p) => p.id === b.supplierId)?.company;
  const canGate = ctx.edit("blocks") || ctx.edit("quarry");
  const canSaw = ctx.edit("processing");

  const receive = () => {
    update((d) => { const x = d.blocks.find((y) => y.id === b.id)!; x.receivedOn = x.receivedOn || today(); Object.assign(x, wb); if (!x.tonnes) x.tonnes = x.billedTonnes; });
    setDone("Received weight saved");
  };
  const toSaw = () => {
    update((d) => { const x = d.blocks.find((y) => y.id === b.id)!; x.status = "processing"; x.processOn = today(); });
    setDone("Issued for processing");
  };
  const addPhoto = async (file: File | undefined) => {
    if (!file) return;
    const p = await readPhoto(file);
    update((d) => { const x = d.blocks.find((y) => y.id === b.id)!; x.photos = [...(x.photos ?? []), p].slice(-6); });
    setDone("Photo added");
  };

  return (
    <div className="mx-auto max-w-[560px]">
      <div className="rounded-[22px] bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-ink-3">Block</div>
            <h1 className="text-[2rem] font-semibold leading-tight tracking-tight">{b.no}</h1>
            <div className="text-ink-2">{b.variety} · {b.l}×{b.w}×{b.h} cm · {n2(b.tonnes || b.billedTonnes)} t · {n2(cbm(b))} CBM</div>
            <div className="mt-1 text-[0.86rem] text-ink-3">{b.source === "own_mine" ? b.mine : sup} · {dmy(b.date)} {b.vehicleNo && `· ${b.vehicleNo}`}</div>
          </div>
          <Badge tone={b.status === "godown" || b.status === "processing" ? "good" : "plain"}>{whereIs(b)}</Badge>
        </div>
        {!!b.photos?.length && (
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {b.photos.map((p, i) => <img key={i} src={fileSrc(p)} alt={`Block ${b.no} photo ${i + 1}`} className="h-24 w-32 shrink-0 rounded-lg object-cover" />)}
          </div>
        )}
        {!b.eRawanna && b.source !== "import" && <div className="mt-4"><Note tone="warn">No e-Rawanna on record for this block.</Note></div>}
      </div>

      {done && <div className="mt-4 flex items-center gap-2 rounded-2xl bg-accent-soft px-4 py-3 font-medium"><Check size={16} />{done}</div>}

      <div className="mt-4 space-y-3">
        {canGate && b.status === "godown" && !b.tonnes && (
          <div className="rounded-2xl bg-surface p-4">
            <div className="mb-3 text-sm font-medium">Weighment <span className="font-normal text-ink-3">(optional)</span></div>
            <Weighment ctx={ctx} block={{ ...b, ...wb }} onChange={(p) => setWb((x) => ({ ...x, ...p }))} />
            <button className="btn btn-primary mt-3 w-full justify-center py-3" onClick={receive}><Truck size={16} />Save received weight</button>
          </div>
        )}
        {canSaw && b.status === "godown" && <button className="btn btn-primary w-full justify-center py-3" onClick={toSaw}><Factory size={16} />Issue for processing</button>}
        {canSaw && b.status === "processing" && <button className="btn btn-primary w-full justify-center py-3" onClick={() => go("inventory", `lots:${b.id}`)}>Create lots</button>}
        {canGate && (
          <label className="btn btn-quiet w-full cursor-pointer justify-center py-3">
            <Camera size={16} />Add a photo
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => addPhoto(e.target.files?.[0])} />
          </label>
        )}
        {!canGate && !canSaw && <Note>You can view this block. Ask your owner for edit access to update it.</Note>}
        <button className="btn btn-quiet w-full justify-center" onClick={() => go("inventory", "blocks")}>Open block inventory</button>
      </div>
    </div>
  );
}
