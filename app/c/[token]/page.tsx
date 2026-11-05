import type { Metadata } from "next";
import { notFound } from "next/navigation";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import { loadCatalogue, type CatLot } from "@/lib/server/catalogue";

export const dynamic = "force-dynamic";

type P = { params: Promise<{ token: string }>; searchParams: Promise<{ v?: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { token } = await params;
  const c = await loadCatalogue(token).catch(() => null);
  if (!c?.enabled) return { title: "Catalogue", robots: { index: false } };
  return { title: `${c.company} · slabs in stock`, description: `${c.lots.length} lots of marble, granite and natural stone in stock${c.city ? ` at ${c.city}` : ""}.`, robots: { index: false } };
}

const wa = (n: string) => (n.length === 10 ? `91${n}` : n);
const nf = (n: number) => Math.round(n).toLocaleString("en-IN");

export default async function Catalogue({ params, searchParams }: P) {
  const { token } = await params;
  const { v } = await searchParams;
  const c = await loadCatalogue(token).catch(() => null);
  if (!c || !c.enabled) notFound();
  const varieties = [...new Set(c.lots.map((l) => l.variety))].sort();
  const lots = v ? c.lots.filter((l) => l.variety === v) : c.lots;
  const img = (id: string) => `/api/catalogue/${token}/img/${id}`;
  const ask = (l?: CatLot) => `https://wa.me/${wa(c.whatsapp)}?text=${encodeURIComponent(l ? `Hello ${c.company}, I am interested in lot ${l.lotNo} (${l.variety}, ${l.thicknessMm} mm ${l.finish}). Is it available? Please share the best rate.` : `Hello ${c.company}, I saw your slab catalogue. Please share details.`)}`;

  return (
    <div className="min-h-screen bg-ground pb-28">
      <header className="mx-auto max-w-[1200px] px-4 pb-6 pt-10 sm:px-6 sm:pt-14">
        <div className="text-[0.8rem] font-medium uppercase tracking-wide text-ink-3">In stock now</div>
        <h1 className="mt-2 text-[2.2rem] font-semibold leading-[1.05] tracking-tight sm:text-[3rem]">{c.company}</h1>
        <p className="mt-2 max-w-[60ch] text-ink-2">{[c.city, c.note].filter(Boolean).join(" · ")}</p>
        {varieties.length > 1 && (
          <nav className="mt-6 flex flex-wrap gap-1.5" aria-label="Filter by variety">
            <a href="?" className="chip" data-on={!v}>All {c.lots.length}</a>
            {varieties.map((x) => <a key={x} href={`?v=${encodeURIComponent(x)}`} className="chip" data-on={v === x}>{x}</a>)}
          </nav>
        )}
      </header>
      <main className="mx-auto grid max-w-[1200px] gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
        {lots.map((l) => (
          <article key={l.id} className="overflow-hidden rounded-[22px] bg-surface">
            {l.photos[0] ? (
              <div className="relative aspect-[4/3] bg-surface-2">
                <img src={img(l.photos[0])} alt={`${l.variety} slab, lot ${l.lotNo}`} className="h-full w-full object-cover" loading="lazy" />
                {l.photos.length > 1 && (
                  <div className="absolute inset-x-0 bottom-0 flex gap-1.5 overflow-x-auto bg-gradient-to-t from-black/60 to-transparent p-2">
                    {l.photos.slice(1).map((p) => <a key={p} href={img(p)} target="_blank" rel="noreferrer"><img src={img(p)} alt="" className="h-12 w-16 shrink-0 rounded-md object-cover ring-1 ring-white/40" loading="lazy" /></a>)}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid aspect-[4/3] place-items-center bg-surface-2 text-ink-3">Photo on request</div>
            )}
            <div className="p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[1.2rem] font-semibold tracking-tight">{l.variety}</h2>
                <span className="text-[0.8rem] text-ink-3">Lot {l.lotNo}</span>
              </div>
              <div className="mt-1 text-[0.92rem] text-ink-2">{l.thicknessMm} mm · {l.finish} · Grade {l.grade}</div>
              <dl className="num mt-4 grid grid-cols-3 gap-2 text-[0.84rem]">
                <div><dt className="text-ink-3">Available</dt><dd className="font-semibold">{nf(l.available)} sq ft</dd></div>
                <div><dt className="text-ink-3">Slabs</dt><dd className="font-semibold">{l.pieces || "—"}</dd></div>
                <div><dt className="text-ink-3">Rate</dt><dd className="font-semibold">{l.listRate ? `₹${nf(l.listRate)}/sq ft` : "Ask"}</dd></div>
              </dl>
              {l.note && <p className="mt-3 text-[0.86rem] text-ink-2">{l.note}</p>}
              {c.whatsapp && <a href={ask(l)} target="_blank" rel="noreferrer" className="btn btn-primary mt-4 w-full justify-center"><WhatsAppIcon size={16} />Enquire on WhatsApp</a>}
            </div>
          </article>
        ))}
        {!lots.length && <p className="col-span-full rounded-2xl bg-surface px-5 py-10 text-center text-ink-2">Nothing listed right now. Message us for current stock.</p>}
      </main>
      {c.whatsapp && (
        <a href={ask()} target="_blank" rel="noreferrer" className="fixed bottom-5 left-1/2 z-40 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-accent px-5 py-3 font-medium text-accent-ink shadow-lg">
          <WhatsAppIcon size={17} />Chat with {c.company}
        </a>
      )}
      <footer className="mx-auto mt-12 max-w-[1200px] px-4 text-[0.78rem] text-ink-3 sm:px-6">Catalogue by Karobar360. Stock and rates can change; confirm before you book.</footer>
    </div>
  );
}
