// "Trusted by" strip under the hero: customer logos scrolling slowly in one colour, pausing on hover.
const LOGOS = [
  { name: "World Class", src: "/logos/world-class.png", w: 403 },
  { name: "Vaid Stonex", src: "/logos/vaid-stonex.png", w: 428 },
  { name: "UGI", src: "/logos/ugi.png", w: 277 },
];

export default function TrustedBy() {
  // Enough copies to fill a wide screen; the second half repeats the first so the loop is seamless.
  const set = Array.from({ length: 4 }, () => LOGOS).flat();
  const H = 44;
  return (
    <section aria-label="Trusted by" className="mx-auto max-w-7xl px-5 pb-24 sm:px-8 lg:pb-32">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-10">
        <p className="shrink-0 text-sm font-medium uppercase tracking-[0.14em] text-ink-3">Trusted by</p>
        <div className="marquee relative min-w-0 flex-1 overflow-hidden">
          <ul className="sr-only">{LOGOS.map((l) => <li key={l.name}>{l.name}</li>)}</ul>
          <div className="marquee-track flex w-max items-center" aria-hidden>
            {[...set, ...set].map((l, i) => (
              <span key={i} className="logo-mask mx-10 block shrink-0 text-ink-2 transition-colors hover:text-ink sm:mx-14"
                style={{ ["--src" as string]: `url(${l.src})`, height: H, width: Math.round((l.w / 160) * H) }} title={l.name} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
