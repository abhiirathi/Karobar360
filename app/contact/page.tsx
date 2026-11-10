import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import RequestForm from "@/components/RequestForm";

export const metadata: Metadata = { title: "Contact us · Karobar360", description: "Ask about Karobar360, book a demo, or request a website for your company." };

export default function Contact() {
  return (
    <>
      <header className="mx-auto flex max-w-7xl items-center gap-2 px-5 py-5 sm:gap-8 sm:px-8">
        <Logo />
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Link href="/stone" className="btn btn-quiet btn-sm max-sm:!px-2.5">Sign in</Link>
          <Link href="/stone/demo" className="btn btn-primary btn-sm max-sm:!px-2.5"><span className="sm:hidden">Demo</span><span className="hidden sm:inline">Open the demo</span></Link>
        </div>
      </header>
      <main className="mx-auto grid max-w-7xl gap-12 px-5 pb-28 pt-10 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20 lg:pt-16">
        <div>
          <h1 className="display text-[2.6rem] font-semibold sm:text-[3.4rem]">Talk to us.</h1>
          <p className="mt-5 max-w-[40ch] text-lg text-ink-2">Want a demo for your unit, help moving from Excel or Tally, or a website for your company? Leave a message and we will call or WhatsApp you back.</p>
          <dl className="mt-10 space-y-6">
            <div><dt className="font-semibold">Book a demo</dt><dd className="mt-1 text-ink-2">We show the tool with your own blocks, slabs and invoices.</dd></div>
            <div><dt className="font-semibold">Get a website</dt><dd className="mt-1 text-ink-2">A simple site with your stones, photos, and a WhatsApp enquiry button.</dd></div>
            <div><dt className="font-semibold">Setup and training</dt><dd className="mt-1 text-ink-2">We enter your opening stock and train your team at the unit.</dd></div>
          </dl>
        </div>
        <div className="rounded-[26px] bg-surface p-6 sm:p-8">
          <RequestForm kind="contact" extras={[{ key: "about", label: "What is this about?", kind: "select", options: ["Book a demo", "Pricing", "A website for my company", "Help with my account", "Something else"] }, { key: "city", label: "City", placeholder: "Kishangarh" }]}
            messagePlaceholder="Tell us a little about your business" submit="Send message" done="Thank you. We have your message and will call or WhatsApp you back soon." />
        </div>
      </main>
    </>
  );
}
