"use client";
import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { blockCost, n0, rs, today } from "@/lib/stone/calc";
import { firmOf, kindLabel, transfer } from "@/lib/stone/firms";
import type { Block, SlabLot } from "@/lib/stone/types";
import { godowns } from "@/lib/stone/godowns";
import type { Ctx } from "./StoneApp";
import { Drawer, F, Grid, Note, NumIn, Sel, TextIn } from "./ui";

/** Moves a block (mine → factory) or a lot (factory → distribution) to another firm of the group. */
export default function TransferForm({ ctx, item, kind, onClose }: { ctx: Ctx; item: Block | SlabLot; kind: "block" | "lot"; onClose: () => void }) {
  const S = ctx.root.settings;
  const from = firmOf(item, S);
  const others = ctx.firms.filter((f) => f.id !== from);
  const prefer = others.find((f) => (kind === "block" ? f.modules.processing : f.modules.depot || f.modules.trading)) ?? others[0];
  const moves = ctx.root.blocks.reduce((a, b) => a + (b.trail?.length ?? 0), 0) + ctx.root.lots.reduce((a, l) => a + (l.trail?.length ?? 0), 0);
  const [to, setTo] = useState(prefer?.id ?? "");
  const [date, setDate] = useState(today());
  const [doc, setDoc] = useState(`DC/${String(moves + 1).padStart(4, "0")}`);
  const [value, setValue] = useState(() => Math.round(kind === "block" ? blockCost(item as Block) : (item as SlabLot).cost));
  const [vehicle, setVehicle] = useState("");
  const [note, setNote] = useState("");
  const gds = godowns(ctx.root);
  const [godown, setGodown] = useState(gds[0] ?? "");
  const name = kind === "block" ? `block ${(item as Block).no}` : `lot ${(item as SlabLot).lotNo}`;
  const dest = ctx.firms.find((f) => f.id === to);

  const save = () => {
    ctx.update((d) => {
      const x = kind === "block" ? d.blocks.find((b) => b.id === item.id) : d.lots.find((l) => l.id === item.id);
      if (!x) return;
      transfer(x, d.settings, { date, to, doc: doc.trim(), value: ctx.costs ? value : 0, note: [vehicle && `vehicle ${vehicle.toUpperCase()}`, note].filter(Boolean).join(" · ") });
      if (kind === "block") {
        const b = x as Block;
        // At the receiving firm it lies in a godown, unless that firm is a quarry too.
        if (dest && !dest.modules.quarry && (b.status === "at_mine" || b.status === "godown")) { b.status = "godown"; b.godown = godown; if (!b.receivedOn) b.receivedOn = date; }
        if (vehicle) b.vehicleNo = vehicle.toUpperCase();
      } else {
        const l = x as SlabLot;
        if (dest) l.site = dest.modules.processing && !dest.modules.depot ? "unit" : "depot";
      }
    });
    ctx.say(`${name[0].toUpperCase()}${name.slice(1)} moved to ${dest?.name ?? ""}`, "good");
    onClose();
  };

  return (
    <Drawer open title={`Send ${name} to another firm`} sub={`Now with ${ctx.firms.find((f) => f.id === from)?.name ?? "—"}. Block, lot and slab numbers stay the same.`} onClose={onClose}
      footer={<><button className="btn btn-primary" disabled={!to} onClick={save}><ArrowRightLeft size={15} />Move to {dest?.name ?? "firm"}</button><button className="btn btn-quiet" onClick={onClose}>Cancel</button></>}>
      {!others.length ? <Note>Add your other firms in Settings first.</Note> : (
        <Grid>
          <F label="To firm" span={2}><Sel value={to} onChange={setTo} options={others.map((f) => ({ v: f.id, l: `${f.name} · ${kindLabel(f.kind)}` }))} /></F>
          <F label="Date"><TextIn type="date" value={date} onChange={setDate} /></F>
          <F label="Challan / invoice no." hint="The document that goes with the goods"><TextIn value={doc} onChange={setDoc} upper /></F>
          {ctx.costs && <F label="Transfer value" hint={kind === "block" ? `Block cost so far ${rs(blockCost(item as Block))}` : `Lot cost ${rs((item as SlabLot).cost)} · ${n0((item as SlabLot).available)} sq ft`}><NumIn value={value} onChange={setValue} suffix="₹" /></F>}
          {kind === "block" && dest && !dest.modules.quarry && <F label="Into godown" hint={gds.length ? undefined : "Add godowns under Masters → Godowns"}><Sel value={godown} onChange={setGodown} placeholder="Choose godown" options={gds.map((g) => ({ v: g, l: g }))} /></F>}
          <F label="Vehicle no."><TextIn value={vehicle} onChange={setVehicle} upper placeholder="RJ 01 GA 4417" /></F>
          <F label="Note" span={2}><TextIn value={note} onChange={setNote} placeholder="Sent for sawing on gang saw 2" /></F>
        </Grid>
      )}
      {dest && from && dest.gstin && ctx.firms.find((f) => f.id === from)?.gstin && dest.gstin !== ctx.firms.find((f) => f.id === from)?.gstin && (
        <div className="mt-4"><Note>The two firms have different GSTINs, so this move is a sale between them for GST. Raise the tax invoice or delivery challan in your accounts with the number above.</Note></div>
      )}
    </Drawer>
  );
}
