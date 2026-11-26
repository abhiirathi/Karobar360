import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import Pricing from "@/components/Pricing";

export const metadata: Metadata = { title: "Pricing · Karobar360", description: "Custom pricing for stone mines, manufacturing units and distributors. Contact us for details." };

export default function PricingPage() {
  return (
    <>
      <header className="mx-auto flex max-w-7xl items-center gap-2 px-5 py-5 sm:gap-8 sm:px-8">
        <Logo />
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Link href="/contact" className="btn btn-quiet btn-sm max-sm:!px-2.5">Contact</Link>
          <Link href="/stone" className="btn btn-primary btn-sm max-sm:!px-2.5">Sign in</Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 pb-28 pt-8 sm:px-8 lg:pt-12">
        <h1 className="display mb-6 text-[2.6rem] font-semibold sm:text-[3.4rem]">Pricing</h1>
        <Pricing />
      </main>
    </>
  );
}
