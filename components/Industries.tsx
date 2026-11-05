import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

// Photographs: Unsplash (free licence). Credit line sits in the page footer.
const u = (id: string, w: number) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=72`;

type Ind = {
  key: string;
  name: string;
  clusters: string;
  photo: string;
  alt: string;
  href: string;
  live?: boolean;
};

const INDUSTRIES: Ind[] = [
  {
    key: "stone",
    name: "Natural stones",
    clusters: "Kishangarh · Makrana · Rajsamand · Jalore",
    photo: "1551458601-14e8150ece4b",
    alt: "Terraced white marble quarry with cut blocks and a pool of green water",
    href: "/stone/demo",
    live: true,
  },
  {
    key: "minerals",
    name: "Minerals",
    clusters: "Bhilwara · Nagaur · Bikaner",
    photo: "1621329109234-d7657d2f3846",
    alt: "Rough mineral specimens laid out in rows on a white surface",
    href: "/build",
  },
  {
    key: "handicrafts",
    name: "Handicrafts",
    clusters: "Jodhpur · Jaipur · Barmer",
    photo: "1766585705105-803ea65bce82",
    alt: "Two Rajasthani kathputli puppets in red and embroidered costumes",
    href: "/build",
  },
  {
    key: "textiles",
    name: "Textiles",
    clusters: "Bhilwara · Pali · Sanganer",
    photo: "1681003564665-62848f8d481e",
    alt: "Shelves stacked with block-printed fabric bolts",
    href: "/build",
  },
  {
    key: "jewellery",
    name: "Imitation jewellery",
    clusters: "Jaipur · Jodhpur",
    photo: "1738754712726-d126c15e206b",
    alt: "Oxidised silver necklace and earring set on a marble board",
    href: "/build",
  },
];

function Card({ ind, big = false }: { ind: Ind; big?: boolean }) {
  return (
    <Link
      href={ind.href}
      className={`ind-card group relative flex overflow-hidden rounded-[22px] bg-night text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)] ${big ? "min-h-[440px] lg:row-span-2 lg:min-h-0" : "min-h-[260px]"}`}
    >
      <img
        src={u(ind.photo, big ? 1400 : 900)}
        srcSet={`${u(ind.photo, big ? 800 : 600)} 800w, ${u(ind.photo, big ? 1400 : 900)} 1400w`}
        sizes={big ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"}
        alt={ind.alt}
        loading={big ? "eager" : "lazy"}
        className="ind-photo absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/0" aria-hidden="true" />
      <div className="relative mt-auto flex w-full flex-col p-5 sm:p-6">
        <div className="mb-auto flex items-center gap-2 pb-6">
          {ind.live ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-ink"><span className="live-dot h-1.5 w-1.5 rounded-full bg-current" />Live dashboard</span>
          ) : (
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium backdrop-blur-sm">Coming next</span>
          )}
        </div>
        <div className="text-[0.8rem] text-white/70">{ind.clusters}</div>
        <div className="mt-1 flex items-end gap-3">
          <h3 className={`font-semibold tracking-tight ${big ? "text-[2.1rem] sm:text-[2.6rem]" : "text-[1.55rem]"}`} style={{ lineHeight: 1.02 }}>
            {ind.name}
          </h3>
          <span className="ind-arrow ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-ink">
            <ArrowUpRight size={18} />
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function IndustryGrid() {
  const [first, ...rest] = INDUSTRIES;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-[300px_300px]">
      <div className="sm:col-span-2 lg:row-span-2 lg:grid"><Card ind={first} big /></div>
      {rest.map((r) => <Card key={r.key} ind={r} />)}
    </div>
  );
}
