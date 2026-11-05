"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import type { Blueprint } from "@/lib/types";
import { listWorkspaces } from "@/lib/store";
import { PRESETS } from "@/lib/presets";
import { getIndustry } from "@/lib/industries";
import { fullDate } from "@/lib/format";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";

export default function Workspaces() {
  const [mine, setMine] = useState<Blueprint[] | null>(null);
  useEffect(() => setMine(listWorkspaces().filter((w) => !w.id.startsWith("demo-"))), []);
  return (
    <div className="mx-auto max-w-5xl px-5 pb-32 sm:px-8">
      <header className="flex items-center gap-4 py-5">
        <Logo />
        <div className="ml-auto flex items-center gap-2"><ThemeToggle /><Link href="/build" className="btn btn-primary btn-sm"><Plus size={15} />New dashboard</Link></div>
      </header>
      <h1 className="display mt-16 text-5xl font-semibold sm:text-6xl">Dashboards</h1>
      <section className="mt-14">
        <h2 className="text-lg font-medium">Built on this device</h2>
        {mine === null ? <p className="mt-4 text-ink-3">Loading…</p> : mine.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-surface p-6 text-ink-2">Nothing yet. <Link href="/build" className="text-accent underline-offset-4 hover:underline">Fill the intake form</Link> to build the first one — it takes about five minutes.</div>
        ) : (
          <ul className="mt-4 space-y-2">
            {mine.map((w) => (
              <li key={w.id}>
                <Link href={`/w/${encodeURIComponent(w.id)}`} className="focusable group flex items-center gap-6 rounded-2xl bg-surface px-6 py-5 transition-colors hover:bg-surface-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-lg font-medium">{w.intake.companyName}</div>
                    <div className="truncate text-sm text-ink-3">{getIndustry(w.intake.industry).name} · {w.intake.city} · {w.modules.length + w.customModules.length} modules</div>
                  </div>
                  <div className="hidden text-sm text-ink-3 sm:block">{fullDate(new Date(w.createdAt))}</div>
                  <ArrowRight size={18} className="text-ink-3 transition-transform group-hover:translate-x-1 group-hover:text-accent" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mt-20">
        <h2 className="text-lg font-medium">Sample companies for demos</h2>
        <p className="mt-1 max-w-[60ch] text-ink-2">Pre-built for common Rajasthan clusters. Open one in front of a prospect, then build theirs live.</p>
        <div className="mt-6 grid gap-x-10 gap-y-2 sm:grid-cols-2">
          {PRESETS.map((p) => (
            <Link key={p.id} href={`/w/${p.id}`} className="focusable group flex items-baseline gap-4 rounded-xl py-3">
              <span className="text-lg font-medium group-hover:text-accent">{p.intake.companyName}</span>
              <span className="text-sm text-ink-3">{p.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
