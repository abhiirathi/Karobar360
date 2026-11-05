"use client";
import { useState } from "react";
import { Camera, Globe, GraduationCap, MapPin, MessageCircle, Sparkles, Table2 } from "lucide-react";
import RequestForm from "@/components/RequestForm";
import type { Ctx } from "./StoneApp";
import { Drawer } from "./ui";

type Service = { kind: string; icon: typeof Globe; title: string; text: string; ask: string };

const MORE: Service[] = [
  { kind: "gbp", icon: MapPin, title: "Google Business Profile", text: "Show up on Google Maps when buyers search “marble near Kishangarh”, with photos, timings and reviews.", ask: "Your address and the stones you want to be found for" },
  { kind: "photos", icon: Camera, title: "Slab photo shoot", text: "Clean, true-colour photos of your lots, added to your stock and the dealer catalogue.", ask: "How many lots, and where they are" },
  { kind: "whatsapp", icon: MessageCircle, title: "WhatsApp Business setup", text: "Business profile, catalogue of your stones, quick replies and a greeting message.", ask: "The WhatsApp number to use" },
  { kind: "setup", icon: Table2, title: "We set up your data", text: "We enter your blocks, lots, customers and opening balances, so you start with everything in place.", ask: "Roughly how many blocks, lots and customers" },
  { kind: "training", icon: GraduationCap, title: "Training at your unit", text: "A half-day at your unit for the gate, yard, sales and accounts staff.", ask: "Where, and how many people" },
  { kind: "custom", icon: Sparkles, title: "A feature made for you", text: "A report, form or tracker your business needs that the tool does not have yet.", ask: "What you would like it to do" },
];

export default function Services({ ctx }: { ctx: Ctx }) {
  const S = ctx.root.settings;
  const prefill = { name: ctx.me?.name ?? "", company: S.company, phone: S.phone || (/^\d[\d\s]{8,}$/.test(ctx.me?.login ?? "") ? ctx.me!.login : "") };
  const [open, setOpen] = useState<Service | "contact" | null>(ctx.sub === "contact" ? "contact" : null);
  const lots = ctx.root.lots.filter((l) => l.available > 0).length;

  return (
    <div className="max-w-[1080px]">
      <section className="grid gap-8 rounded-[26px] bg-surface p-6 sm:p-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div>
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent"><Globe size={20} /></span>
          <h2 className="mt-4 text-[1.6rem] font-semibold leading-tight tracking-tight">Get a website for your company</h2>
          <p className="mt-2 text-ink-2">Buyers check online before they call. We make a simple, fast website for {S.company || "your company"} and keep it running.</p>
          <ul className="mt-5 space-y-2.5 text-[0.92rem]">
            {[
              "Your stones, with photos and sizes",
              lots ? `Your live slab stock (${lots} lots today), straight from Karobar360` : "Your live slab stock, straight from Karobar360",
              "A WhatsApp button on every stone for enquiries",
              "Your own domain, like yourcompany.in",
              "English, Hindi, or both",
            ].map((t) => <li key={t} className="flex gap-2.5"><span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />{t}</li>)}
          </ul>
          <p className="mt-5 text-[0.84rem] text-ink-3">Send the form and we will call you to understand what you need, then share the price before starting.</p>
        </div>
        <div>
          <RequestForm kind="website" prefill={prefill} submit="Request my website"
            extras={[
              { key: "domain", label: "Do you have a domain name?", kind: "select", options: ["Yes, I have one", "No, please buy one for me", "Not sure"] },
              { key: "lang", label: "Language", kind: "select", options: ["English", "Hindi", "English and Hindi"] },
              { key: "existing", label: "Current website, if any", placeholder: "www.example.com" },
              { key: "sells", label: "What do you sell?", placeholder: "Makrana marble slabs, granite, tiles" },
            ]}
            messageLabel="Anything else" messagePlaceholder="Sites you like, pages you want, when you need it"
            done="Thank you. Your website request is with us. We will call you to discuss it." />
        </div>
      </section>

      <h2 className="mt-12 text-[1.25rem] font-semibold tracking-tight">More we can do for you</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MORE.map((s) => {
          const I = s.icon;
          return (
            <li key={s.kind} className="flex flex-col rounded-2xl bg-surface p-5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-2 text-ink-2"><I size={17} /></span>
              <div className="mt-3 font-semibold">{s.title}</div>
              <p className="mt-1 flex-1 text-[0.88rem] text-ink-2">{s.text}</p>
              <button className="btn btn-quiet btn-sm mt-4 self-start" onClick={() => setOpen(s)}>Request</button>
            </li>
          );
        })}
      </ul>

      <div className="mt-10 flex flex-wrap items-center gap-4 rounded-2xl bg-surface px-5 py-4">
        <div className="min-w-[220px] flex-1"><div className="font-semibold">Need help or have a question?</div><div className="text-[0.88rem] text-ink-2">Write to us and we will call or WhatsApp you back.</div></div>
        <button className="btn btn-primary btn-sm" onClick={() => setOpen("contact")}>Contact us</button>
      </div>

      {open && (
        <Drawer open title={open === "contact" ? "Contact us" : open.title} sub={open === "contact" ? "We will call or WhatsApp you back." : open.text} onClose={() => setOpen(null)}>
          <RequestForm key={open === "contact" ? "contact" : open.kind} kind={open === "contact" ? "contact" : open.kind} prefill={prefill}
            messageLabel={open === "contact" ? "Message" : "Details"} messagePlaceholder={open === "contact" ? "How can we help?" : open.ask}
            submit={open === "contact" ? "Send message" : "Send request"} done="Thank you. We have your request and will get back to you soon." />
        </Drawer>
      )}
    </div>
  );
}
