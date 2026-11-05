import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Logo from "@/components/Logo";
import Reveal from "@/components/Reveal";
import ThemeToggle from "@/components/ThemeToggle";
import { ClusterLinks, HeroPreview, ModuleExplorer } from "@/components/Landing";
import { PLANS } from "@/lib/pricing";
import IndustryGrid from "@/components/Industries";
import TrustedBy from "@/components/TrustedBy";

const d = (ms: number) => ({ ["--d" as string]: `${ms}ms` }) as React.CSSProperties;

export default function Home() {
  return (
    <>
      <Reveal />
      <header className="mx-auto flex max-w-7xl items-center gap-8 px-5 py-5 sm:px-8">
        <Logo />
        <nav className="hidden items-center gap-7 text-[0.95rem] text-ink-2 md:flex">
          <a href="#industries" className="hover:text-ink">Industries</a>
          <a href="#how" className="hover:text-ink">How it works</a>
          <a href="#modules" className="hover:text-ink">Modules</a>
          <a href="#clusters" className="hover:text-ink">Samples</a>
          <a href="#pricing" className="hover:text-ink">Pricing</a>
          <Link href="/contact" className="hover:text-ink">Contact</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Link href="/stone" className="btn btn-quiet btn-sm">Sign in</Link>
          <Link href="/build" className="btn btn-primary btn-sm">Build my dashboard</Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-16 pt-14 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:pt-20">
          <div>
            <h1 className="display reveal text-[3.1rem] font-semibold sm:text-[4.6rem]" style={d(0)}>Software that runs your way.</h1>
            <p className="reveal mt-7 max-w-[34rem] text-lg leading-relaxed text-ink-2 sm:text-xl" style={d(80)}>
              Tell us how your factory, godown or trading firm works. Karobar360 builds a dashboard for your sales, cash, stock, staff, payroll and GST in minutes, in English or Hindi.
            </p>
            <div className="reveal mt-10 flex flex-wrap items-center gap-3" style={d(160)}>
              <Link href="/build" className="btn btn-primary !px-6 !py-3.5 text-base">Build my dashboard <ArrowRight size={18} /></Link>
              <Link href="/stone/demo" className="btn btn-quiet !px-6 !py-3.5 text-base">Open the stone dashboard</Link>
            </div>
            <p className="reveal mt-6 text-sm text-ink-3" style={d(220)}>Works with Tally, Busy, Excel and WhatsApp. No credit card.</p>
          </div>
          <div className="reveal" style={d(200)}><HeroPreview /></div>
        </section>

        <TrustedBy />

        <section id="industries" className="mx-auto max-w-7xl px-5 pb-28 sm:px-8 lg:pb-36">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:items-end lg:gap-16">
            <h2 className="display reveal text-[2.6rem] font-semibold sm:text-[3.6rem]">Made for Rajasthan’s trades, one industry at a time.</h2>
            <p className="reveal max-w-[44ch] text-lg text-ink-2" style={d(80)}>Each industry gets its own screens, its own words and its own costing. Natural stones is live today; the next four are being built with units in their clusters.</p>
          </div>
          <div className="reveal mt-14" style={d(120)}><IndustryGrid /></div>
        </section>

        <section className="bg-surface">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-32 sm:px-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-20 lg:py-40">
            <p className="statement reveal text-[1.6rem] font-medium sm:text-[2.2rem]">
              Ready-made ERPs expect a Kishangarh marble yard to work like a Pune software company. So most MSMEs go back to Excel, a diary and forty WhatsApp groups.
            </p>
            <div className="space-y-8 lg:pt-3">
              <div className="reveal" style={d(80)}>
                <div className="font-semibold">Built around your words</div>
                <p className="mt-1 text-ink-2">Slabs and blocks, looms and takas, karigars and lots. The screens use the terms your team already says out loud.</p>
              </div>
              <div className="reveal" style={d(140)}>
                <div className="font-semibold">Only what you need</div>
                <p className="mt-1 text-ink-2">Start with three modules or eleven. Add a custom tracker by describing it in one sentence.</p>
              </div>
              <div className="reveal" style={d(200)}>
                <div className="font-semibold">Running in four weeks</div>
                <p className="mt-1 text-ink-2">We import your Tally history, train your supervisors on the shop floor, and go live in a month.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-7xl px-5 py-32 sm:px-8 lg:py-40">
          <h2 className="display reveal max-w-3xl text-[2.6rem] font-semibold sm:text-[3.6rem]">From a conversation to a dashboard.</h2>
          <div className="mt-20 grid gap-14 md:grid-cols-[1.2fr_1fr_1fr] md:gap-10">
            <div className="reveal" style={d(0)}>
              <div className="text-2xl font-semibold tracking-tight">Describe</div>
              <p className="mt-3 max-w-[38ch] text-ink-2">Fill a short form, or just speak: “हम भीलवाड़ा में सूटिंग बनाते हैं, 200 लोग हैं, जॉब-वर्क का हिसाब नहीं मिलता.” Gemini fills in the details for you.</p>
            </div>
            <div className="reveal md:pt-16" style={d(90)}>
              <div className="text-2xl font-semibold tracking-tight">Build</div>
              <p className="mt-3 max-w-[34ch] text-ink-2">The AI architect picks your modules, writes your KPIs and alerts, and builds custom trackers from your requests.</p>
            </div>
            <div className="reveal md:pt-32" style={d(180)}>
              <div className="text-2xl font-semibold tracking-tight">Run</div>
              <p className="mt-3 max-w-[34ch] text-ink-2">Connect your books. Owners get an 8 am WhatsApp brief, and anyone can ask the copilot questions in Hindi.</p>
            </div>
          </div>
        </section>

        <section id="modules" className="bg-surface-2/60">
          <div className="mx-auto max-w-7xl px-5 py-32 sm:px-8 lg:py-40">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
              <h2 className="display reveal text-[2.6rem] font-semibold sm:text-[3.6rem]">Eleven modules. One screen.</h2>
              <p className="reveal max-w-[46ch] self-end text-lg text-ink-2" style={d(80)}>Point at a module to see it with real sample data from a marble processor in Kishangarh.</p>
            </div>
            <div className="reveal mt-16" style={d(120)}><ModuleExplorer /></div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-32 sm:px-8 lg:py-40">
          <div className="grid gap-16 lg:grid-cols-2 lg:gap-24">
            <div>
              <h2 className="display reveal text-[2.6rem] font-semibold sm:text-[3.6rem]">It does more than show numbers.</h2>
              <p className="reveal mt-6 max-w-[44ch] text-lg text-ink-2" style={d(80)}>
                It chases payments, watches due dates and finds money you are leaving on the table.
              </p>
            </div>
            <dl className="grid gap-x-10 gap-y-10 sm:grid-cols-2">
              {[
                ["The 45-day rule, tracked", "MSME supplier bills unpaid past 45 days are flagged before 31 March, so the expense stays tax-deductible."],
                ["Payment reminders on WhatsApp", "Dealers with overdue bills get a polite reminder and a UPI link every Monday, without anyone having to call."],
                ["A GST and labour-law calendar", "GSTR-1, GSTR-3B, TDS, PF, ESI, consent-to-operate and factory licence dates, each with an owner."],
                ["Scheme and credit matching", "RIPS 2024, CGTMSE, TReDS and ZED, matched to your profile with the next step to apply."],
                ["A copilot that speaks Hindi", "“इस महीने किसका पैसा बाकी है?” The answer comes from your live numbers."],
                ["Built for every role", "Owners see everything. Accounts and plant managers see their own work. Your CA gets read-only access."],
              ].map(([t, s], i) => (
                <div key={t} className="reveal" style={d(i * 60)}>
                  <dt className="font-semibold">{t}</dt>
                  <dd className="mt-1.5 text-ink-2">{s}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="clusters" className="bg-night text-night-ink">
          <div className="mx-auto grid max-w-7xl gap-14 px-5 py-32 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20 lg:py-40">
            <div>
              <h2 className="display reveal text-[2.6rem] font-semibold sm:text-[3.6rem]">Ready for Rajasthan’s clusters.</h2>
              <p className="reveal mt-6 max-w-[40ch] text-lg text-night-ink/70" style={d(80)}>Playbooks for marble and stone, textiles, furniture, gems, spices, auto parts, block printing and distribution. Open a sample company to explore it.</p>
            </div>
            <div className="reveal" style={d(120)}><ClusterLinks /></div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-7xl px-5 py-32 sm:px-8 lg:py-40">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <h2 className="display reveal text-[2.6rem] font-semibold sm:text-[3.6rem]">Priced like a salary, not a software project.</h2>
            <p className="reveal max-w-[46ch] self-end text-lg text-ink-2" style={d(80)}>A one-time setup covers onboarding, data import and training. After that you pay monthly, and annual billing gets two months free.</p>
          </div>
          <div className="reveal scroll-thin mt-16 overflow-x-auto" style={d(120)}>
            <table className="w-full min-w-[680px] text-left">
              <thead>
                <tr>
                  <th className="w-1/4 pb-6" />
                  {PLANS.map((p) => (
                    <th key={p.key} className={`pb-6 align-bottom ${p.key === "growth" ? "rounded-t-2xl bg-surface px-5 pt-6" : "px-5"}`}>
                      <div className="text-lg font-semibold">{p.name}</div>
                      <div className="num mt-1 text-3xl font-semibold tracking-tight">₹{p.monthly.toLocaleString("en-IN")}<span className="text-base font-normal text-ink-3">/mo</span></div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-ink-2">
                {[
                  ["Modules", "Up to 4", "Up to 8", "All 11 + custom"],
                  ["Users", "5", "20", "60"],
                  ["Sites", "1", "3", "Unlimited"],
                  ["Tally / Busy / Excel import", "Yes", "Live sync", "Live sync"],
                  ["WhatsApp alerts & owner brief", "—", "Yes", "Yes"],
                  ["AI copilot (Hindi & English)", "50 questions/mo", "Unlimited", "Unlimited"],
                  ["Custom modules", "—", "Add-on", "Included"],
                  ["Support", "Email", "Phone & WhatsApp", "Dedicated manager"],
                ].map((row) => (
                  <tr key={row[0]}>
                    <td className="py-3.5 pr-4 text-ink">{row[0]}</td>
                    {row.slice(1).map((c, i) => <td key={i} className={`px-5 py-3.5 ${i === 1 ? "bg-surface" : ""}`}>{c}</td>)}
                  </tr>
                ))}
                <tr>
                  <td />
                  {PLANS.map((p) => (
                    <td key={p.key} className={`px-5 pb-6 pt-4 ${p.key === "growth" ? "rounded-b-2xl bg-surface" : ""}`}>
                      <Link href="/build" className={`btn btn-sm ${p.key === "growth" ? "btn-primary" : "btn-quiet"}`}>Start with {p.name}</Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-6 text-sm text-ink-3">Setup starts at ₹35,000. Prices exclude GST. <Link href="/pricing" className="text-accent hover:underline">See what each plan includes, or ask for a custom price</Link>.</p>
        </section>

        <section className="bg-accent text-accent-ink">
          <div className="mx-auto flex max-w-7xl flex-col gap-10 px-5 py-28 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:py-36">
            <h2 className="display reveal max-w-3xl text-[2.6rem] font-semibold sm:text-[4rem]">See your business on one screen by this afternoon.</h2>
            <div className="reveal flex flex-col items-start gap-4" style={d(100)}>
              <Link href="/build" className="btn !bg-accent-ink !px-6 !py-3.5 text-base !text-accent">Build my dashboard <ArrowRight size={18} /></Link>
              <span className="text-sm opacity-80">Takes about five minutes.</span>
            </div>
          </div>
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-6 px-5 pb-10 text-sm opacity-80 sm:px-8">
            <span className="font-semibold">Karobar360</span>
            <span>Operations software for Indian MSMEs</span>
            <span>Photographs: Unsplash</span>
            <Link href="/contact" className="ml-auto hover:underline">Contact us</Link>
            <Link href="/w" className="hover:underline">My dashboards</Link>
          </div>
        </section>
      </main>
    </>
  );
}
