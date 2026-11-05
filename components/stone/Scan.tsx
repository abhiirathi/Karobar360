"use client";
import { useState } from "react";
import { Camera, Check, Factory, Truck } from "lucide-react";
import { cbm, dmy, n2, today } from "@/lib/stone/calc";
import type { Ctx } from "./StoneApp";
import type { Block } from "@/lib/stone/types";
import { STATUS_LABEL } from "./BlockForm";
import { Badge, Note, readPhoto } from "./ui";
import { WeighCapture } from "./Weigh";
import { fileSrc } from "./files";

/** What a phone sees after scanning a block's QR label. */
export default function Scan({ ctx, blockId }: { ctx: Ctx; blockId: string }) {
  const { db, update, go } = ctx;
  const b = ctx.root.blocks.find((x) => x.id === blockId);
  const [wb, setWb] = useState<Partial<Block>>({});
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
    update((d) => { const x = d.blocks.find((y) => y.id === b.id)!; x.status = "in_yard"; x.receivedOn = x.receivedOn || today(); Object.assign(x, wb); });
    setDone("Received in the yard");
  };
  const toSaw = () => {
    update((d) => { const x = d.blocks.find((y) => y.id === b.id)!; x.status = "on_saw"; });
    setDone("Loaded on the saw");
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
          <Badge tone={b.status === "in_yard" || b.status === "on_saw" ? "good" : "plain"}>{STATUS_LABEL[b.status]}</Badge>
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
        {canGate && (b.status === "in_transit" || b.status === "at_mine") && (
          <div className="rounded-2xl bg-surface p-4">
            <div className="mb-2 text-sm font-medium">Weighbridge (optional){b.billedTonnes ? <span className="font-normal text-ink-3"> · billed {n2(b.billedTonnes)} t</span> : null}</div>
            <WeighCapture ctx={ctx} block={{ ...b, ...wb }} onChange={(p) => setWb((x) => ({ ...x, ...p }))} />
            <button className="btn btn-primary mt-3 w-full justify-center py-3" onClick={receive}><Truck size={16} />Received at the gate</button>
          </div>
        )}
        {canSaw && b.status === "in_yard" && <button className="btn btn-primary w-full justify-center py-3" onClick={toSaw}><Factory size={16} />Loaded on the saw</button>}
        {canSaw && b.status === "on_saw" && <button className="btn btn-primary w-full justify-center py-3" onClick={() => go("unit", "yard")}>Record slabs out</button>}
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
