import Link from "next/link";

export default function Logo({ href = "/", light = false }: { href?: string; light?: boolean }) {
  return (
    <Link href={href} className="focusable inline-flex items-center gap-2 rounded-md" aria-label="Karobar360 home">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <rect x="1" y="9" width="5" height="12" rx="1.5" fill="currentColor" />
        <rect x="8.5" y="4" width="5" height="17" rx="1.5" fill="currentColor" opacity="0.75" />
        <rect x="16" y="1" width="5" height="20" rx="1.5" fill="var(--accent)" />
      </svg>
      <span className={`text-[1.05rem] font-semibold tracking-tight ${light ? "text-night-ink" : "text-ink"}`}>Karobar360</span>
    </Link>
  );
}
