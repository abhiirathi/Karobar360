"use client";
import { useEffect, useState } from "react";
import { Copy, ExternalLink, RefreshCw } from "lucide-react";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import type { Ctx } from "./StoneApp";
import { Drawer, F, Grid, Note, TextIn } from "./ui";
import { Toggle } from "./Team";

export default function CatalogueShare({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const { db, update } = ctx;
  const cat = db.settings.catalogue ?? { enabled: false, showRates: false, whatsapp: db.settings.phone, note: "" };
  const canSet = ctx.edit("settings");
  const [token, setToken] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const lots = db.lots.filter((l) => l.catalogue && l.available > 0);
  const noPhoto = lots.filter((l) => !l.photos?.length).length;

  useEffect(() => {
    if (ctx.mode !== "cloud") return;
    fetch("/api/stone/keys").then((r) => r.json()).then((j) => j.catToken ? setToken(j.catToken) : setErr(j.error ?? "")).catch(() => setErr("Could not load the link."));
  }, [ctx.mode]);

  const link = token ? `${window.location.origin}/c/${token}` : "";
  const setCat = (patch: Partial<typeof cat>) => update((d) => { d.settings.catalogue = { ...cat, ...patch }; });
  const rotate = async () => {
    const r = await fetch("/api/stone/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rotate: "cat" }) });
    const j = await r.json().catch(() => ({}));
    if (j.catToken) { setToken(j.catToken); ctx.say("New link made. The old one no longer works.", "good"); }
  };
  const msg = `${db.settings.company} – slabs in stock now. See photos and sizes: ${link}`;

  return (
    <Drawer open title="Dealer catalogue" sub="A web page with photos of the lots you choose. Send it to dealers and architects on WhatsApp." onClose={onClose}
      footer={<button className="btn btn-quiet" onClick={onClose}>Close</button>}>
      {ctx.mode === "demo" && <div className="mb-4"><Note>The shareable page works in a company account. In the demo you can pick lots and add photos to see how it is set up.</Note></div>}
      <div className="rounded-2xl bg-surface p-4">
        <div className="text-[0.95rem]"><b>{lots.length}</b> lots are in the catalogue{noPhoto ? `, ${noPhoto} without photos` : ""}.</div>
        <p className="mt-1 text-[0.84rem] text-ink-2">Open a lot in Slab stock to add photos and tick “Show in the dealer catalogue”. Sold-out lots drop off on their own.</p>
      </div>

      {canSet ? (
        <div className="mt-4 space-y-2">
          <Toggle on={cat.enabled} onChange={(v) => setCat({ enabled: v })} label="Catalogue page is live" hint="Switch off to hide the page from everyone" />
          <Toggle on={cat.showRates} onChange={(v) => setCat({ showRates: v })} label="Show list prices" hint="Dealers see your list price per sq ft. Costs are never shown." />
          <Grid>
            <F label="WhatsApp number for enquiries" err={!cat.whatsapp && !db.settings.phone ? "Add a number so dealers can enquire" : undefined}><TextIn value={cat.whatsapp} onChange={(v) => setCat({ whatsapp: v })} placeholder="98290 12345" /></F>
            <F label="Line under your name"><TextIn value={cat.note} onChange={(v) => setCat({ note: v })} placeholder="Delivery across India from Kishangarh" /></F>
          </Grid>
        </div>
      ) : (
        <div className="mt-4"><Note>{cat.enabled ? "The catalogue page is live." : "The owner has not switched the catalogue page on yet."}</Note></div>
      )}

      {ctx.mode === "cloud" && (
        <div className="mt-5">
          <div className="text-sm font-medium">Link</div>
          {err && <div className="mt-2"><Note tone="neg">{err}</Note></div>}
          {link && (
            <>
              <div className="mt-2 flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5 text-[0.88rem]"><span className="min-w-0 flex-1 truncate">{link}</span>
                <button className="btn btn-quiet btn-sm !px-2" aria-label="Copy link" onClick={() => { navigator.clipboard?.writeText(link); ctx.say("Link copied", "good"); }}><Copy size={14} /></button>
                <a className="btn btn-quiet btn-sm !px-2" aria-label="Open catalogue" href={link} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a className={`btn btn-primary btn-sm ${!cat.enabled ? "pointer-events-none opacity-50" : ""}`} href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"><WhatsAppIcon size={14} />Share on WhatsApp</a>
                {canSet && <button className="btn btn-quiet btn-sm" onClick={rotate}><RefreshCw size={14} />Make a new link</button>}
              </div>
              {!cat.enabled && <p className="mt-2 text-[0.82rem] text-warn">Switch the page on before sharing.</p>}
            </>
          )}
        </div>
      )}
    </Drawer>
  );
}
