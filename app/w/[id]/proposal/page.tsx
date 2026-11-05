"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import type { Blueprint } from "@/lib/types";
import { getWorkspace } from "@/lib/store";
import { MODULE_MAP, INTEGRATIONS } from "@/lib/catalog";
import { getIndustry } from "@/lib/industries";
import { quote } from "@/lib/pricing";
import { fullDate, inr } from "@/lib/format";
import Logo from "@/components/Logo";

export default function Proposal() {
  const { id } = useParams<{ id: string }>();
  const [bp, setBp] = useState<Blueprint | null>(null);
  useEffect(() => setBp(getWorkspace(decodeURIComponent(id))), [id]);
  if (!bp) return <div className="flex min-h-screen items-center justify-center text-ink-3">Loading…</div>;
  const q = quote(bp);
  const ind = getIndustry(bp.intake.industry);
  const valid = new Date(Date.now() + 30 * 86400000);
  const rupee = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  return (
    <div className="min-h-screen bg-ground print:bg-white">
      <div className="no-print sticky top-0 z-10 flex items-center gap-3 bg-ground/95 px-5 py-3 sm:px-8">
        <Link href={`/w/${encodeURIComponent(bp.id)}`} className="btn btn-quiet btn-sm"><ArrowLeft size={15} />Back to dashboard</Link>
        <button onClick={() => window.print()} className="btn btn-primary btn-sm ml-auto"><Printer size={15} />Print or save as PDF</button>
      </div>
      <article className="mx-auto max-w-3xl bg-surface px-8 py-14 sm:my-8 sm:rounded-3xl sm:px-14 print:my-0 print:rounded-none">
        <div className="flex items-start justify-between gap-6">
          <Logo />
          <div className="text-right text-sm text-ink-3">Proposal · {fullDate(new Date())}<br />Valid until {fullDate(valid)}</div>
        </div>
        <h1 className="display mt-16 text-4xl font-semibold sm:text-5xl">{bp.intake.companyName}</h1>
        <p className="mt-3 text-lg text-ink-2">Operations software for a {ind.name.toLowerCase()} business in {bp.intake.city}{bp.intake.ownerName ? `, prepared for ${bp.intake.ownerName}` : ""}.</p>

        <section className="mt-14">
          <h2 className="text-xl font-semibold tracking-tight">What we heard</h2>
          <p className="mt-3 leading-relaxed text-ink-2">{bp.intake.painPoints || bp.summary}</p>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold tracking-tight">What we will set up</h2>
          <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-[180px_1fr]">
            {bp.modules.map((m) => (
              <div key={m.key} className="contents">
                <dt className="font-medium">{MODULE_MAP[m.key].name}</dt>
                <dd className="text-ink-2">{MODULE_MAP[m.key].blurb}</dd>
              </div>
            ))}
            {bp.customModules.map((c) => (
              <div key={c.key} className="contents">
                <dt className="font-medium">{c.title}<span className="block text-sm font-normal text-accent">Built for you</span></dt>
                <dd className="text-ink-2">{c.description}</dd>
              </div>
            ))}
          </dl>
          {bp.intake.integrations.length > 0 && (
            <p className="mt-6 text-ink-2"><span className="font-medium text-ink">Connected to:</span> {bp.intake.integrations.map((k) => INTEGRATIONS.find((x) => x.key === k)?.label ?? k).join(", ")}.</p>
          )}
          <p className="mt-3 text-ink-2"><span className="font-medium text-ink">Automations:</span> {bp.automations.filter((a) => a.enabled).map((a) => a.action.charAt(0).toLowerCase() + a.action.slice(1)).join("; ")}.</p>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold tracking-tight">Go-live in four weeks</h2>
          <ol className="mt-4 space-y-3 text-ink-2">
            <li><span className="font-medium text-ink">Week 1 —</span> Visit your unit, import masters and two years of history from {bp.intake.integrations.includes("tally") ? "Tally" : bp.intake.integrations.includes("busy") ? "Busy" : "your Excel sheets"}.</li>
            <li><span className="font-medium text-ink">Week 2 —</span> Configure modules, users and roles; owner reviews the dashboard with live numbers.</li>
            <li><span className="font-medium text-ink">Week 3 —</span> {bp.customModules.length ? "Build custom modules and " : ""}connect integrations and WhatsApp alerts.</li>
            <li><span className="font-medium text-ink">Week 4 —</span> Train supervisors and accounts on the shop floor, in Hindi; go live.</li>
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold tracking-tight">Investment</h2>
          <table className="mt-4 w-full text-left">
            <tbody>
              {q.lines.map((l, i) => (
                <tr key={i} className="[&>td]:py-2">
                  <td className="text-ink-2">{l.item}</td>
                  <td className="num text-right">{rupee(l.amount)}</td>
                </tr>
              ))}
              <tr className="[&>td]:pt-4 [&>td]:font-semibold">
                <td>One-time setup</td>
                <td className="num text-right">{rupee(q.setup)}</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-8 rounded-2xl bg-surface-2 p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">{q.plan.name} plan</div>
                <div className="text-sm text-ink-2">{q.plan.features.join(" · ")}{q.extraUsers ? ` · ${q.extraUsers} extra users` : ""}</div>
              </div>
              <div className="sm:text-right">
                <div className="num text-3xl font-semibold tracking-tight">{rupee(q.monthly)}<span className="text-base font-normal text-ink-3"> / month</span></div>
                <div className="num text-sm text-ink-2">or {rupee(q.annual)} / year — two months free</div>
              </div>
            </div>
          </div>
          <p className="mt-4 text-sm text-ink-3">Prices exclude 18% GST. First-year total on annual billing: {inr(q.setup + q.annual)} + GST.</p>
        </section>

        <section className="mt-12 text-sm text-ink-2">
          <h2 className="text-xl font-semibold tracking-tight text-ink">Our promise</h2>
          <p className="mt-3 leading-relaxed">Your data stays yours and can be exported to Excel at any time. If the dashboard doesn’t match how your business runs after go-live, we change it — that is the point of building it for you.</p>
        </section>

        <footer className="mt-16 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="text-sm text-ink-3">Accepted for {bp.intake.companyName}</div>
            <div className="mt-10 w-56 border-t border-ink-3/40 pt-2 text-sm text-ink-3">Signature & date</div>
          </div>
          <div className="text-right text-sm text-ink-3">Prepared by Karobar360</div>
        </footer>
      </article>
    </div>
  );
}
