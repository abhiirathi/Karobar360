"use client";
import { useState } from "react";
import { Check, Mail, MessageCircle, Phone } from "lucide-react";
import RequestForm from "@/components/RequestForm";
import { SALES, mailLink, waLink } from "@/lib/contact";

// No price list: every business is quoted after a short call. Used in the app, on /pricing and on the home page.
const SIZED_BY = [
  { title: "Your businesses", text: "Mine, manufacturing unit, distribution, or all three as one group." },
  { title: "Your team", text: "How many people sign in, and what each of them needs to see." },
  { title: "Your setup", text: "Opening stock, old records from Excel or Tally, and training at your unit." },
];

const ALL = [
  "Works on phone and computer, as a website or an installed app",
  "Trace any block from quarry to invoice",
  "GST invoices, e-invoice and e-way bill files",
  "QR labels for every block",
  "Team logins by email, each seeing only their part",
  "Download a backup of your data any time",
];

export function ContactButtons({ topic = "pricing", company }: { topic?: string; company?: string }) {
  const hello = `Hi, I'd like to know about Karobar360 ${topic}${company ? ` for ${company}` : ""}.`;
  return (
    <div className="flex flex-wrap gap-2">
      <a href={waLink(hello)} target="_blank" rel="noreferrer" className="btn btn-primary"><MessageCircle size={16} />WhatsApp us</a>
      <a href={`tel:+${SALES.whatsapp}`} className="btn btn-quiet"><Phone size={16} /><span className="num">{SALES.phoneLabel}</span></a>
      <a href={mailLink("Karobar360 pricing", hello)} className="btn btn-quiet"><Mail size={16} />Email us</a>
    </div>
  );
}

export default function Pricing({ prefill }: { prefill?: { name?: string; company?: string; phone?: string } }) {
  const [form, setForm] = useState(false);
  return (
    <div className="max-w-[1120px]">
      <div className="rounded-[28px] bg-surface p-6 sm:p-10">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-14">
          <div>
            <div className="text-sm font-medium text-accent">Custom pricing</div>
            <h2 className="mt-2 text-[1.9rem] font-semibold leading-tight tracking-tight sm:text-[2.3rem]">Priced for your business. Contact us for details.</h2>
            <p className="mt-4 max-w-[52ch] text-ink-2">No two stone businesses run the same way, so we don’t publish a price list. Tell us how you work and we will send you a quote.</p>
            <div className="mt-7"><ContactButtons company={prefill?.company} /></div>
            <button type="button" className="mt-4 text-[0.9rem] font-medium text-accent underline-offset-4 hover:underline" onClick={() => setForm((x) => !x)}>{form ? "Hide the form" : "Or leave your number and we’ll call you"}</button>
          </div>
          <ol className="space-y-5 self-center">
            {SIZED_BY.map((x, i) => (
              <li key={x.title} className="flex gap-4">
                <span className="num grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">{i + 1}</span>
                <span><span className="block font-semibold">{x.title}</span><span className="block text-[0.92rem] text-ink-2">{x.text}</span></span>
              </li>
            ))}
          </ol>
        </div>
        {form && (
          <div className="mt-8 border-t border-surface-2 pt-8">
            <RequestForm kind="contact" prefill={prefill} extras={[{ key: "about", label: "Businesses", kind: "select", options: ["Mine", "Manufacturing unit", "Distribution / depot", "Two or three of these"] }]}
              messagePlaceholder="How many firms and people? Anything special you need?" submit="Ask for a quote" done="Thank you. We will call or WhatsApp you soon with a quote." />
          </div>
        )}
      </div>

      <div className="mt-10">
        <h2 className="font-semibold">Always included</h2>
        <ul className="mt-3 grid gap-2 text-[0.92rem] text-ink-2 sm:grid-cols-2 lg:grid-cols-3">{ALL.map((x) => <li key={x} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-accent" />{x}</li>)}</ul>
      </div>
    </div>
  );
}
