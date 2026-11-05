"use client";
import { useState } from "react";
import { Check, Mail, MessageCircle } from "lucide-react";
import RequestForm from "@/components/RequestForm";
import { SALES, mailLink, waLink } from "@/lib/contact";
import { PLANS } from "@/lib/pricing";

const FOR: Record<string, { who: string; points: string[] }> = {
  starter: {
    who: "One processing unit or one depot",
    points: ["1 firm, 5 people", "Blocks, sawing, slabs and lots", "Slab stock and dealer catalogue", "GST invoices, e-invoice and e-way bill files", "Export to Tally", "Email support"],
  },
  growth: {
    who: "A unit with its own quarry or depot",
    points: ["Up to 3 firms, 20 people", "Everything in Starter", "Quarry costs, royalty and rawanna", "Imports and exports with landed cost", "Live Tally figures and weighbridge link", "Stores and consumables", "Phone and WhatsApp support"],
  },
  factory: {
    who: "A group: mines, units and depots",
    points: ["Unlimited firms, 60 people", "Everything in Growth", "Access by role for every section", "Custom reports and features", "Training at your unit", "A dedicated manager"],
  },
};

const ALL = ["Works on phone and computer", "Trace any block from quarry to invoice", "QR labels for every block", "Unlimited invoices and records", "Download a backup of your data any time"];

/** Plans, a custom option, and ways to reach sales. Used in the app and on /pricing. */
export default function Pricing({ prefill }: { prefill?: { name?: string; company?: string; phone?: string } }) {
  const [yearly, setYearly] = useState(true);
  const [form, setForm] = useState(false);
  const price = (m: number) => (yearly ? Math.round((m * 10) / 12) : m);
  const hello = `Hi, I'd like to know about Karobar360 pricing${prefill?.company ? ` for ${prefill.company}` : ""}.`;

  return (
    <div className="max-w-[1120px]">
      <div className="flex flex-wrap items-center gap-4">
        <p className="max-w-[56ch] text-ink-2">One price a month for the whole team. A one-time setup covers data entry, Tally import and training. Prices exclude GST.</p>
        <div className="ml-auto inline-flex rounded-full bg-surface-2 p-0.5 text-[0.88rem]" role="radiogroup" aria-label="Billing">
          {[[true, "Yearly · 2 months free"], [false, "Monthly"]].map(([v, l]) => (
            <button key={String(v)} type="button" role="radio" aria-checked={yearly === v} onClick={() => setYearly(v as boolean)} className={`rounded-full px-4 py-1.5 transition-colors ${yearly === v ? "bg-surface font-medium shadow-sm" : "text-ink-2"}`}>{l as string}</button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((p) => {
          const f = FOR[p.key];
          const hot = p.key === "growth";
          return (
            <div key={p.key} className={`flex flex-col rounded-[22px] p-5 ${hot ? "bg-night text-night-ink" : "bg-surface"}`}>
              <div className="flex items-center justify-between gap-2"><div className="text-lg font-semibold">{p.name}</div>{hot && <span className="rounded-full bg-accent px-2.5 py-0.5 text-[0.72rem] font-medium text-accent-ink">Most chosen</span>}</div>
              <div className={`mt-0.5 text-[0.86rem] ${hot ? "text-night-ink/70" : "text-ink-2"}`}>{f.who}</div>
              <div className="mt-5 flex items-baseline gap-1"><span className="num text-[2rem] font-semibold tracking-tight">₹{price(p.monthly).toLocaleString("en-IN")}</span><span className={`text-[0.86rem] ${hot ? "text-night-ink/60" : "text-ink-3"}`}>/month</span></div>
              <div className={`text-[0.78rem] ${hot ? "text-night-ink/60" : "text-ink-3"}`}>{yearly ? `₹${(p.monthly * 10).toLocaleString("en-IN")} billed yearly` : "Billed monthly"}</div>
              <ul className="mt-5 flex-1 space-y-2 text-[0.9rem]">
                {f.points.map((x) => <li key={x} className="flex gap-2"><Check size={16} className={`mt-0.5 shrink-0 ${hot ? "text-accent-soft" : "text-accent"}`} />{x}</li>)}
              </ul>
              <a href={waLink(`${hello} I'm interested in the ${p.name} plan.`)} target="_blank" rel="noreferrer" className={`btn mt-6 justify-center ${hot ? "btn-primary" : "btn-quiet"}`}>Choose {p.name}</a>
            </div>
          );
        })}

        <div className="flex flex-col rounded-[22px] border-2 border-dashed border-surface-3 p-5">
          <div className="text-lg font-semibold">Custom</div>
          <div className="mt-0.5 text-[0.86rem] text-ink-2">Several units, special needs, or a price that fits you</div>
          <div className="mt-5 text-[2rem] font-semibold leading-tight tracking-tight">Let’s talk</div>
          <div className="text-[0.78rem] text-ink-3">Priced for your business</div>
          <ul className="mt-5 flex-1 space-y-2 text-[0.9rem]">
            {["Any number of firms and people", "Features built for your process", "Moving your old records in", "Your own website and catalogue"].map((x) => <li key={x} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-accent" />{x}</li>)}
          </ul>
          <div className="mt-6 text-[0.82rem] font-medium text-ink-2">Contact sales</div>
          <div className="mt-2 grid gap-2">
            <a href={waLink(`${hello} I'd like a custom plan.`)} target="_blank" rel="noreferrer" className="btn btn-primary justify-center"><MessageCircle size={15} />WhatsApp us</a>
            <a href={mailLink("Karobar360 custom pricing", hello)} className="btn btn-quiet justify-center"><Mail size={15} />Email us</a>
            <div className="text-center text-[0.78rem] leading-relaxed text-ink-3"><span className="num">{SALES.phoneLabel}</span><br /><span className="break-all">{SALES.email}</span></div>
            <button type="button" className="text-[0.86rem] text-accent hover:underline" onClick={() => setForm((x) => !x)}>{form ? "Hide the form" : "Or leave your number and we’ll call"}</button>
          </div>
        </div>
      </div>

      {form && (
        <div className="mt-4 rounded-[22px] bg-surface p-6">
          <RequestForm kind="contact" prefill={prefill} extras={[{ key: "about", label: "Interested in", kind: "select", options: ["Starter", "Growth", "Factory Pro", "Custom plan"] }]}
            messagePlaceholder="How many units, firms and people?" submit="Ask for a call" done="Thank you. Our team will call or WhatsApp you soon." />
        </div>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="font-semibold">In every plan</h2>
          <ul className="mt-3 grid gap-2 text-[0.92rem] text-ink-2 sm:grid-cols-2">{ALL.map((x) => <li key={x} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-accent" />{x}</li>)}</ul>
        </div>
        <dl className="space-y-4 text-[0.92rem]">
          <div><dt className="font-medium">What does setup cost?</dt><dd className="mt-0.5 text-ink-2">From ₹35,000, once. We enter your opening stock, connect Tally and train your team.</dd></div>
          <div><dt className="font-medium">Can I change plans later?</dt><dd className="mt-0.5 text-ink-2">Yes, move up or down any month. Your data stays as it is.</dd></div>
          <div><dt className="font-medium">Can I try it first?</dt><dd className="mt-0.5 text-ink-2">Open the demo company to try every section with sample data, free.</dd></div>
        </dl>
      </div>
    </div>
  );
}
