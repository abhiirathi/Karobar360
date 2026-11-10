"use client";
import { useEffect, useRef, useState } from "react";
import { Check, EyeOff, RotateCcw, Smartphone, Server, X } from "lucide-react";

// Home page privacy section: a short "video" built from live elements. Tap the lock to play it;
// each step shows one true fact about how Karobar360 keeps a firm's data private.

const GREEN = "#3cc08c";
const STEP_MS = 5200;

const STEPS = [
  { title: "Your firm, sealed off", text: "Each firm’s data is kept apart. No other business on Karobar360 can see your sales, stock or parties." },
  { title: "Each person sees their part", text: "Staff open only the sections you allow. Rates and costs stay hidden from anyone without that right." },
  { title: "Passwords scrambled, logins guarded", text: "Passwords are stored scrambled, never as typed. Too many wrong tries locks the login." },
  { title: "Sealed on the way", text: "Everything travels encrypted over HTTPS. The database opens only through our server’s secret key." },
  { title: "Never sold. Always yours.", text: "We never sell or share your data. Take all of it out, or have it deleted, whenever you ask." },
];

/** The padlock: shackle lifts when open and drops into the body when locked. */
function Padlock({ locked, size = 120, dark }: { locked: boolean; size?: number; dark?: boolean }) {
  const body = dark ? "#04120c" : GREEN;
  const hole = dark ? GREEN : "#04120c";
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden>
      <path d="M38 56 V38 a22 22 0 0 1 44 0 V56" fill="none" stroke={body} strokeWidth="10" strokeLinecap="round"
        style={{ transform: locked ? "translateY(0)" : "translateY(-14px) ", transformOrigin: "82px 56px", transition: "transform 450ms cubic-bezier(.5,1.8,.5,1)" }} />
      <rect x="24" y="52" width="72" height="56" rx="14" fill={body} />
      <circle cx="60" cy="76" r="7" fill={hole} />
      <rect x="57" y="78" width="6" height="14" rx="3" fill={hole} />
    </svg>
  );
}

const show = (on: boolean, extra = "") => `transition-all duration-500 ease-out motion-reduce:transition-none ${on ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"} ${extra}`;

function Chip({ label, on, delay = 0 }: { label: string; on: boolean; delay?: number }) {
  return (
    <span className={`inline-flex items-center rounded-lg bg-white/10 px-2.5 py-1 text-[0.8rem] font-medium ${show(on)}`} style={{ transitionDelay: `${delay}ms` }}>{label}</span>
  );
}

function SceneApart({ t }: { t: number }) {
  return (
    <div className="grid h-full grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5">
      <div className="rounded-2xl p-4 ring-2" style={{ ["--tw-ring-color" as string]: GREEN }}>
        <div className="text-[0.78rem] uppercase tracking-[0.12em]" style={{ color: GREEN }}>Your firm</div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {["Sales", "Stock", "Parties", "Rates", "Payments"].map((c, i) => <Chip key={c} label={c} on={t > 200} delay={i * 140} />)}
        </div>
      </div>
      <div className={`flex flex-col items-center gap-2 ${show(t > 1500)}`}>
        <div className="h-24 w-1 rounded-full" style={{ background: GREEN }} />
        <div className="rounded-full p-1.5" style={{ background: GREEN }}><Padlock locked dark size={22} /></div>
        <div className="h-24 w-1 rounded-full" style={{ background: GREEN }} />
      </div>
      <div className="rounded-2xl p-4 opacity-60 ring-1 ring-white/20">
        <div className="text-[0.78rem] uppercase tracking-[0.12em] text-white/60">Another firm</div>
        <div className={`mt-3 flex items-center gap-2 text-[0.85rem] ${show(t > 2600)}`}>
          <span className="grid size-6 place-items-center rounded-full bg-[#f0776c] text-[#1a0806]"><X size={14} strokeWidth={3} /></span>
          Can’t see yours
        </div>
      </div>
    </div>
  );
}

function SceneRoles({ t }: { t: number }) {
  const rows: { who: string; sees: string[]; rate: boolean }[] = [
    { who: "Owner", sees: ["Sales", "Stock", "Payments"], rate: true },
    { who: "Accounts", sees: ["Sales", "Payments"], rate: true },
    { who: "Yard staff", sees: ["Stock"], rate: false },
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-2.5">
      {rows.map((r, i) => (
        <div key={r.who} className={`flex items-center gap-3 rounded-xl bg-white/[0.06] px-3.5 py-3 ${show(t > 200 + i * 350)}`}>
          <span className="w-24 shrink-0 font-semibold sm:w-28">{r.who}</span>
          <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">{r.sees.map((s) => <span key={s} className="rounded-md bg-white/10 px-2 py-0.5 text-[0.78rem]">{s}</span>)}</span>
          <span className="num relative shrink-0 text-[0.9rem]">
            {r.rate ? "₹1,240/sq ft" : (
              <span className="inline-flex items-center gap-1.5">
                <span className="transition-all duration-500 motion-reduce:transition-none" style={{ filter: t > 2000 ? "blur(6px)" : "none", opacity: t > 2000 ? 0.5 : 1 }}>₹1,240/sq ft</span>
                <EyeOff size={15} className={show(t > 2200)} style={{ color: GREEN }} />
              </span>
            )}
          </span>
        </div>
      ))}
      <p className={`mt-1 text-[0.85rem] text-white/60 ${show(t > 2600)}`}>Rates hidden from yard staff, set by the owner.</p>
    </div>
  );
}

const HEX = "0123456789abcdef";
function SceneLogin({ t }: { t: number }) {
  const typed = Math.min(8, Math.max(0, Math.floor((t - 200) / 120)));
  const scrambling = t > 1400;
  // Same pseudo-random string each time for a given moment, so the scramble looks alive but settles.
  const seed = scrambling ? Math.floor(Math.min(t, 2400) / 70) : 0;
  const hash = Array.from({ length: 24 }, (_, i) => HEX[(i * 7 + seed * 13 + i * seed) % 16]).join("");
  const tries = t > 2800 ? Math.min(3, Math.floor((t - 2800) / 350) + 1) : 0;
  return (
    <div className="flex h-full flex-col justify-center gap-4">
      <div className="rounded-xl bg-white/[0.06] px-4 py-3">
        <div className="text-[0.78rem] text-white/60">Password</div>
        <div className="num mt-1 h-7 font-mono text-lg tracking-[0.2em]">{"•".repeat(typed)}</div>
      </div>
      <div className={`rounded-xl px-4 py-3 ring-1 ${show(scrambling)}`} style={{ ["--tw-ring-color" as string]: GREEN }}>
        <div className="text-[0.78rem]" style={{ color: GREEN }}>What we store</div>
        <div className="mt-1 truncate font-mono text-[0.95rem] text-white/85">{hash}…</div>
      </div>
      <div className={`flex items-center gap-2 text-[0.9rem] ${show(tries > 0)}`}>
        {[1, 2, 3].map((n) => (
          <span key={n} className={`grid size-6 place-items-center rounded-full transition-colors ${tries >= n ? "bg-[#f0776c] text-[#1a0806]" : "bg-white/10 text-white/40"}`}><X size={13} strokeWidth={3} /></span>
        ))}
        <span className={`ml-1 ${tries >= 3 ? "text-white" : "text-white/60"}`}>{tries >= 3 ? "Wrong tries: login locked" : "Wrong password"}</span>
      </div>
    </div>
  );
}

function SceneTransit({ t }: { t: number }) {
  const p = Math.min(1, Math.max(0, (t - 600) / 2200));
  return (
    <div className="flex h-full flex-col justify-center gap-6">
      <div className="relative flex items-center justify-between">
        <div className="flex flex-col items-center gap-2"><span className="grid size-14 place-items-center rounded-2xl bg-white/10"><Smartphone size={26} /></span><span className="text-[0.8rem] text-white/60">Your phone</span></div>
        <div className="relative mx-3 h-14 flex-1">
          <div className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-white/25" />
          <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-100 ease-linear motion-reduce:transition-none" style={{ left: `calc(${p} * (100% - 44px) + 22px)` }}>
            <span className="grid size-11 place-items-center rounded-xl" style={{ background: GREEN }}><Padlock locked dark size={26} /></span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2"><span className="grid size-14 place-items-center rounded-2xl bg-white/10"><Server size={26} /></span><span className="text-[0.8rem] text-white/60">Karobar360</span></div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className={`rounded-xl bg-white/[0.06] px-3.5 py-2.5 text-[0.88rem] ${show(t > 900)}`}><span className="font-semibold" style={{ color: GREEN }}>HTTPS</span> · locked on the way</div>
        <div className={`rounded-xl bg-white/[0.06] px-3.5 py-2.5 text-[0.88rem] ${show(p >= 1)}`}><span className="font-semibold" style={{ color: GREEN }}>Secret key</span> · only our server opens the database</div>
      </div>
    </div>
  );
}

function SceneYours({ t }: { t: number }) {
  const items = ["Never sold to anyone", "Never shown to advertisers or other firms", "Take all your data out, any time", "Deleted for good, when you ask"];
  return (
    <div className="flex h-full flex-col justify-center gap-2.5">
      {items.map((s, i) => (
        <div key={s} className={`flex items-center gap-3 text-[1.02rem] ${show(t > 200 + i * 450)}`}>
          <span className="grid size-7 shrink-0 place-items-center rounded-full" style={{ background: GREEN, color: "#04120c" }}><Check size={16} strokeWidth={3} /></span>
          {s}
        </div>
      ))}
    </div>
  );
}

const SCENES = [SceneApart, SceneRoles, SceneLogin, SceneTransit, SceneYours];

export default function Privacy() {
  // phase: idle (lock open, waiting for a tap) → locking (shackle drops) → playing → done
  const [phase, setPhase] = useState<"idle" | "locking" | "playing" | "done">("idle");
  const [step, setStep] = useState(0);
  const [t, setT] = useState(0);
  const [visible, setVisible] = useState(true);
  const box = useRef<HTMLDivElement>(null);

  // Pause when the section is off screen.
  useEffect(() => {
    const el = box.current;
    if (!el || !("IntersectionObserver" in window)) return;
    // Plays by itself the first time most of the stage scrolls into view; pauses when it leaves.
    const io = new IntersectionObserver(([e]) => {
      setVisible(e.isIntersecting);
      if (e.intersectionRatio >= 0.6) setPhase((p) => (p === "idle" ? "locking" : p));
    }, { threshold: [0, 0.2, 0.6] });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (phase === "locking") { const id = setTimeout(() => { setPhase("playing"); setStep(0); setT(0); }, 800); return () => clearTimeout(id); }
    if (phase !== "playing" || !visible) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setT((x) => x + dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, visible]);

  useEffect(() => {
    if (phase !== "playing" || t < STEP_MS) return;
    if (step < STEPS.length - 1) { setStep(step + 1); setT(0); } else { setPhase("done"); setT(STEP_MS); }
  }, [t, step, phase]);

  const play = () => { setStep(0); setT(0); setPhase("locking"); };
  const jump = (i: number) => { setStep(i); setT(0); setPhase("playing"); };
  const locked = phase !== "idle";
  const Scene = SCENES[step];

  return (
    <section id="privacy" className="bg-night text-night-ink" aria-label="Data privacy">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-28 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20 lg:py-36">
        <div>
          <p className="reveal text-sm font-medium uppercase tracking-[0.14em]" style={{ color: GREEN }}>Data privacy</p>
          <h2 className="display reveal mt-4 text-[2.6rem] font-semibold sm:text-[3.6rem]">Your business stays yours.</h2>
          <p className="reveal mt-6 max-w-[40ch] text-lg text-night-ink/70">Sales, rates and parties are the most private numbers you have. Here is how Karobar360 keeps them that way.</p>

          <ol className="mt-10 space-y-1">
            {STEPS.map((s, i) => {
              const active = locked && phase !== "locking" && i === step;
              const doneStep = phase === "done" || (locked && i < step);
              const fill = phase === "done" || doneStep ? 1 : active ? Math.min(1, t / STEP_MS) : 0;
              return (
                <li key={s.title}>
                  <button type="button" onClick={() => jump(i)} className={`focusable w-full rounded-xl px-3 py-3 text-left transition-colors ${active ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"}`} aria-current={active ? "step" : undefined}>
                    <div className={`font-semibold transition-colors ${active || doneStep ? "text-night-ink" : "text-night-ink/55"}`}>{s.title}</div>
                    <div className={`grid transition-all duration-500 motion-reduce:transition-none ${active ? "mt-1 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                      <p className="overflow-hidden text-[0.95rem] text-night-ink/70">{s.text}</p>
                    </div>
                    <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${fill * 100}%`, background: GREEN }} />
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <div ref={box} className="relative self-center">
          <div className="relative aspect-[4/3.4] overflow-hidden rounded-[28px] bg-white/[0.03] ring-1 ring-white/10 sm:aspect-[4/3]">
            {/* faint grid behind the scenes */}
            <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "36px 36px" }} />

            {/* playing: the current scene */}
            {(phase === "playing" || phase === "done") && (
              <div key={step} className="absolute inset-0 flex flex-col p-5 sm:p-8">
                <div className="flex items-center gap-2 text-[0.8rem] text-white/60">
                  <span className="rounded-full p-1" style={{ background: GREEN }}><Padlock locked dark size={16} /></span>
                  <span>Locked</span>
                  <span className="ml-auto num">{step + 1} / {STEPS.length}</span>
                </div>
                <div className="mt-2 text-xl font-semibold sm:hidden">{STEPS[step].title}</div>
                <div className="min-h-0 flex-1"><Scene t={t} /></div>
              </div>
            )}

            {/* idle and locking: the big lock button */}
            {(phase === "idle" || phase === "locking") && (
              <div className="absolute inset-0 grid place-items-center">
                <button type="button" onClick={play} disabled={phase === "locking"} aria-label="Lock and play the privacy walkthrough"
                  className="focusable group flex flex-col items-center gap-5 rounded-3xl p-6">
                  <span className="relative grid place-items-center">
                    <span className={`absolute size-44 rounded-full motion-reduce:animate-none ${phase === "idle" ? "animate-ping" : ""}`} style={{ background: GREEN, opacity: 0.12 }} />
                    <span className="relative grid size-44 place-items-center rounded-full bg-white/[0.06] ring-1 ring-white/15 transition-transform group-hover:scale-105 group-active:scale-95">
                      <Padlock locked={phase === "locking"} />
                    </span>
                  </span>
                  <span className="text-lg font-semibold">{phase === "locking" ? "Locked" : "Tap to lock"}</span>
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 flex min-h-9 items-center gap-3 text-[0.85rem] text-night-ink/60">
            {phase === "done" && (
              <button type="button" onClick={play} className="btn btn-sm !bg-white/10 !text-night-ink hover:!bg-white/15"><RotateCcw size={15} /> Play again</button>
            )}
            <span>The AI copilot and bill reading use Google Gemini: only the question with the figures it needs, or that one document, is sent to get the answer.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
