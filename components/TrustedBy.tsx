// "Trusted by" strip under the hero: customer logos in their own colours, scrolling slowly and pausing on hover.
const LOGOS = [
  { name: "World Class", src: "/logos/world-class.png", w: 403 },
  { name: "Vaid Stonex", src: "/logos/vaid-stonex.png", w: 427 },
  { name: "UGI", src: "/logos/ugi.png", w: 278, darkInvert: true }, // black logo: turn light in dark mode
];

export default function TrustedBy() {
  // Enough copies to fill a wide screen; the second half repeats the first so the loop is seamless.
  const set = Array.from({ length: 4 }, () => LOGOS).flat();
  const H = 48;
  return (
    <section aria-label="Trusted by" className="mx-auto max-w-7xl px-5 pb-24 sm:px-8 lg:pb-32">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-10">
        <p className="shrink-0 text-sm font-medium uppercase tracking-[0.14em] text-ink-3">Trusted by</p>
        <div className="marquee relative min-w-0 flex-1 overflow-hidden">
          <ul className="sr-only">{LOGOS.map((l) => <li key={l.name}>{l.name}</li>)}</ul>
          <div className="marquee-track flex w-max items-center" aria-hidden>
            {[...set, ...set].map((l, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={l.src} alt="" title={l.name} height={H} width={Math.round((l.w / 160) * H)} loading="lazy" draggable={false}
                className={`mx-10 block shrink-0 select-none opacity-90 transition-opacity hover:opacity-100 sm:mx-14 ${l.darkInvert ? "dark:invert" : ""}`}
                style={{ height: H, width: Math.round((l.w / 160) * H) }} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
