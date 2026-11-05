"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Mic, Plus, Trash2, Wand2 } from "lucide-react";
import type { Blueprint, Intake, ModuleKey, SiteType } from "@/lib/types";
import { BLANK_INTAKE, PRESETS } from "@/lib/presets";
import { INDUSTRIES, getIndustry } from "@/lib/industries";
import { CHANNELS, INTEGRATIONS, MODULES, SITE_TYPES, TURNOVER_BANDS } from "@/lib/catalog";
import { getWorkspace, saveWorkspace } from "@/lib/store";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";

const SECTIONS = ["Your business", "Sites & people", "Modules", "What you need", "Review"] as const;

function toggleIn<T>(arr: T[], v: T) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export default function Build() {
  const router = useRouter();
  const [intake, setIntake] = useState<Intake>(BLANK_INTAKE);
  const [sec, setSec] = useState(0);
  const [fromId, setFromId] = useState<string | null>(null);
  const [aiOn, setAiOn] = useState<boolean | null>(null);
  const [building, setBuilding] = useState(false);
  const set = <K extends keyof Intake>(k: K, v: Intake[K]) => setIntake((i) => ({ ...i, [k]: v }));

  useEffect(() => {
    fetch("/api/status").then((r) => r.json()).then((j) => setAiOn(Boolean(j.ai))).catch(() => setAiOn(false));
    const p = new URLSearchParams(window.location.search);
    const from = p.get("from");
    const preset = p.get("preset");
    if (from) {
      const w = getWorkspace(from);
      if (w) { setIntake(w.intake); setFromId(from.startsWith("demo-") ? null : from); }
    } else if (preset) {
      const pr = PRESETS.find((x) => x.id === preset);
      if (pr) setIntake(pr.intake);
    }
  }, []);

  const valid = [
    intake.companyName.trim().length > 1 && intake.city.trim().length > 1,
    intake.employees > 0 && intake.sites.length > 0,
    intake.modules.length > 0,
    true,
    true,
  ];

  async function submit() {
    setBuilding(true);
  }

  if (building) return <Building intake={intake} aiOn={aiOn} fromId={fromId} onDone={(bp) => router.push(`/w/${encodeURIComponent(bp.id)}`)} onFail={() => setBuilding(false)} />;

  const ind = getIndustry(intake.industry);

  return (
    <div className="mx-auto max-w-6xl px-5 pb-32 sm:px-8">
      <header className="flex items-center gap-4 py-5">
        <Logo />
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-sm text-ink-3 sm:inline">{aiOn === null ? "" : aiOn ? "Gemini connected" : "Rules engine (add Gemini key for AI)"}</span>
          <ThemeToggle />
        </div>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <h1 className="display text-4xl font-semibold">Build your dashboard</h1>
          <p className="mt-3 text-ink-2">About five minutes. Nothing is shared until you send the proposal.</p>
          <ol className="mt-8 flex gap-1 overflow-x-auto lg:flex-col">
            {SECTIONS.map((s, i) => (
              <li key={s}>
                <button onClick={() => (i <= sec || valid.slice(0, i).every(Boolean)) && setSec(i)} className={`focusable flex w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm transition-colors ${i === sec ? "bg-surface font-medium" : "text-ink-2 hover:bg-surface/60"}`}>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[0.7rem] ${i < sec ? "bg-accent text-accent-ink" : i === sec ? "bg-ink text-ground" : "bg-surface-3"}`}>{i < sec ? <Check size={12} /> : ""}</span>
                  {s}
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-8 hidden lg:block">
            <div className="text-sm text-ink-3">Demo shortcut</div>
            <div className="mt-2 flex flex-col items-start gap-1">
              {PRESETS.map((p) => <button key={p.id} onClick={() => { setIntake(p.intake); setSec(4); }} className="focusable rounded text-left text-sm text-ink-2 underline-offset-4 hover:text-accent hover:underline">{p.label}</button>)}
            </div>
          </div>
        </aside>

        <main key={sec} className="enter min-w-0">
          {sec === 0 && (
            <div className="space-y-8">
              <AutoFill aiOn={aiOn} onFill={(f) => setIntake((i) => merge(i, f))} />
              <Group title="Company">
                <Grid>
                  <F label="Company name *"><input className="field" value={intake.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="Shree Shyam Marbles" /></F>
                  <F label="Owner / your name"><input className="field" value={intake.ownerName} onChange={(e) => set("ownerName", e.target.value)} placeholder="Rajendra Agarwal" /></F>
                  <F label="Phone (WhatsApp)"><input className="field" inputMode="tel" value={intake.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98xxx xxxxx" /></F>
                  <F label="Email"><input className="field" type="email" value={intake.email} onChange={(e) => set("email", e.target.value)} placeholder="owner@company.in" /></F>
                  <F label="City *"><input className="field" value={intake.city} onChange={(e) => set("city", e.target.value)} placeholder="Kishangarh" /></F>
                  <F label="State"><input className="field" value={intake.state} onChange={(e) => set("state", e.target.value)} /></F>
                  <F label="GSTIN (optional)"><input className="field uppercase" value={intake.gstin} onChange={(e) => set("gstin", e.target.value.toUpperCase())} placeholder="08XXXXX0000X1Z5" maxLength={15} /></F>
                </Grid>
              </Group>
              <Group title="Industry" hint="Picks the right vocabulary, KPIs and seasonality.">
                <div className="flex flex-wrap gap-2">
                  {INDUSTRIES.map((x) => <button key={x.key} className="chip" data-on={intake.industry === x.key} onClick={() => set("industry", x.key)}>{x.name}</button>)}
                </div>
                <p className="mt-3 text-sm text-ink-3">Cluster: {ind.cluster}</p>
                <F label="What exactly do you make or trade?" className="mt-4"><input className="field" value={intake.industryNote} onChange={(e) => set("industryNote", e.target.value)} placeholder="e.g. Gang-saw processing of Makrana marble blocks into slabs and tiles" /></F>
              </Group>
              <Group title="Size">
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">{(["micro", "small", "medium"] as const).map((c) => <button key={c} className="chip capitalize" data-on={intake.category === c} onClick={() => set("category", c)}>{c} enterprise</button>)}</div>
                  <div className="flex flex-wrap gap-2">{TURNOVER_BANDS.map((b) => <button key={b.key} className="chip" data-on={intake.turnoverBand === b.key} onClick={() => set("turnoverBand", b.key)}>{b.label}</button>)}</div>
                </div>
              </Group>
            </div>
          )}

          {sec === 1 && (
            <div className="space-y-8">
              <Group title="People">
                <Grid>
                  <F label="Total employees incl. contract workers"><input className="field num" type="number" min={1} value={intake.employees} onChange={(e) => set("employees", Math.max(1, Number(e.target.value)))} /></F>
                  <F label="People who will log in"><input className="field num" type="number" min={1} value={intake.users} onChange={(e) => set("users", Math.max(1, Number(e.target.value)))} /></F>
                </Grid>
              </Group>
              <Group title="Sites" hint="Factories, warehouses, yards, shops — each gets its own view.">
                <div className="space-y-2">
                  {intake.sites.map((s, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[170px_1fr_160px_auto]">
                      <select className="field" value={s.type} onChange={(e) => set("sites", intake.sites.map((x, j) => (j === i ? { ...x, type: e.target.value as SiteType } : x)))}>
                        {SITE_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                      </select>
                      <input className="field order-3 col-span-2 sm:order-none sm:col-span-1" value={s.name} placeholder="Name, e.g. Unit 2, RIICO" onChange={(e) => set("sites", intake.sites.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                      <input className="field order-4 col-span-2 sm:order-none sm:col-span-1" value={s.city} placeholder="City" onChange={(e) => set("sites", intake.sites.map((x, j) => (j === i ? { ...x, city: e.target.value } : x)))} />
                      <button className="btn btn-quiet !px-3" disabled={intake.sites.length < 2} onClick={() => set("sites", intake.sites.filter((_, j) => j !== i))} aria-label="Remove site"><Trash2 size={15} /></button>
                    </div>
                  ))}
                  <button className="btn btn-quiet btn-sm mt-2" onClick={() => set("sites", [...intake.sites, { type: "warehouse", name: "", city: intake.city }])}><Plus size={14} />Add site</button>
                </div>
              </Group>
              <Group title="How you sell">
                <div className="flex flex-wrap gap-2">{CHANNELS.map((c) => <button key={c.key} className="chip" data-on={intake.channels.includes(c.key)} onClick={() => set("channels", toggleIn(intake.channels, c.key))}>{c.label}</button>)}</div>
              </Group>
            </div>
          )}

          {sec === 2 && (
            <div className="space-y-8">
              <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-accent-soft px-5 py-4">
                <span className="text-sm">Most {ind.name.toLowerCase()} businesses start with {ind.suggested.length} modules.</span>
                <button className="btn btn-primary btn-sm ml-auto" onClick={() => set("modules", ind.suggested)}>Use suggested</button>
              </div>
              {(["Commercial", "Operations", "People", "Compliance & growth"] as const).map((g) => (
                <Group key={g} title={g}>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {MODULES.filter((m) => m.group === g).map((m) => {
                      const on = intake.modules.includes(m.key);
                      return (
                        <button key={m.key} onClick={() => set("modules", toggleIn(intake.modules, m.key as ModuleKey))} className={`focusable flex items-start gap-3 rounded-2xl p-4 text-left transition-colors ${on ? "bg-surface" : "bg-surface-2/60 hover:bg-surface-2"}`}>
                          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${on ? "bg-accent text-accent-ink" : "bg-surface-3"}`}>{on && <Check size={13} />}</span>
                          <span>
                            <span className="font-medium">{m.name}</span>
                            {ind.suggested.includes(m.key) && <span className="ml-2 text-sm text-accent">suggested</span>}
                            <span className="mt-0.5 block text-sm text-ink-2">{m.blurb}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Group>
              ))}
            </div>
          )}

          {sec === 3 && (
            <div className="space-y-8">
              <Group title="What's hurting today?" hint="Plain words are best. Hindi or Hinglish is fine.">
                <textarea className="field resize-none" rows={5} value={intake.painPoints} onChange={(e) => set("painPoints", e.target.value)} placeholder="e.g. Dealers pay after 90 days. We don't know stock in the godown without counting. Salary takes 3 days every month." />
              </Group>
              <Group title="Anything special you want to track?" hint="One idea per line. Each becomes its own custom module.">
                <textarea className="field resize-none" rows={4} value={intake.customRequests} onChange={(e) => set("customRequests", e.target.value)} placeholder={"Block-wise yield from quarry to slab\nDiesel used by each DG set\nSamples sent to export buyers"} />
              </Group>
              <Group title="What do you use today?">
                <div className="flex flex-wrap gap-2">{INTEGRATIONS.map((x) => <button key={x.key} className="chip" data-on={intake.integrations.includes(x.key)} onClick={() => set("integrations", toggleIn(intake.integrations, x.key))}>{x.label}</button>)}</div>
              </Group>
              <Group title="Languages for your team">
                <div className="flex gap-2">
                  <button className="chip" data-on={intake.languages.includes("en")} onClick={() => set("languages", toggleIn(intake.languages, "en"))}>English</button>
                  <button className="chip" data-on={intake.languages.includes("hi")} onClick={() => set("languages", toggleIn(intake.languages, "hi"))}>हिंदी</button>
                </div>
              </Group>
            </div>
          )}

          {sec === 4 && <Review intake={intake} goto={setSec} />}

          <div className="mt-12 flex items-center gap-3">
            {sec > 0 && <button className="btn btn-quiet" onClick={() => setSec(sec - 1)}><ArrowLeft size={16} />Back</button>}
            {!valid[sec] && <span className="text-sm text-warn">{sec === 0 ? "Add company name and city to continue." : sec === 2 ? "Pick at least one module." : ""}</span>}
            {sec < 4 ? (
              <button className="btn btn-primary ml-auto" disabled={!valid[sec]} onClick={() => setSec(sec + 1)}>Continue<ArrowRight size={16} /></button>
            ) : (
              <button className="btn btn-primary ml-auto !px-6 !py-3.5 text-base" disabled={!valid.slice(0, 3).every(Boolean)} onClick={submit}><Wand2 size={17} />Submit & build</button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function merge(i: Intake, f: Record<string, unknown>): Intake {
  const out: Intake = { ...i };
  const s = (k: keyof Intake) => { if (typeof f[k] === "string" && (f[k] as string).trim()) (out as unknown as Record<string, unknown>)[k] = (f[k] as string).trim(); };
  (["companyName", "ownerName", "industryNote", "city", "state", "painPoints", "customRequests"] as (keyof Intake)[]).forEach(s);
  if (typeof f.industry === "string" && INDUSTRIES.some((x) => x.key === f.industry)) out.industry = f.industry;
  if (["micro", "small", "medium"].includes(f.category as string)) out.category = f.category as Intake["category"];
  if (TURNOVER_BANDS.some((b) => b.key === f.turnoverBand)) out.turnoverBand = f.turnoverBand as string;
  if (typeof f.employees === "number" && f.employees > 0) out.employees = Math.round(f.employees);
  if (Array.isArray(f.sites) && f.sites.length) out.sites = (f.sites as Record<string, string>[]).slice(0, 6).map((x) => ({ type: (SITE_TYPES.some((t) => t.key === x.type) ? x.type : "factory") as SiteType, name: x.name || "Unit", city: x.city || out.city }));
  if (Array.isArray(f.channels) && f.channels.length) out.channels = (f.channels as string[]).filter((c) => CHANNELS.some((x) => x.key === c));
  if (Array.isArray(f.integrations) && f.integrations.length) out.integrations = (f.integrations as string[]).filter((c) => INTEGRATIONS.some((x) => x.key === c));
  if (Array.isArray(f.modules) && f.modules.length) out.modules = (f.modules as string[]).filter((m) => MODULES.some((x) => x.key === m)) as ModuleKey[];
  else if (f.industry) out.modules = getIndustry(out.industry).suggested;
  if (out.sites.length === 1 && !out.sites[0].city) out.sites = [{ ...out.sites[0], city: out.city }];
  return out;
}

function AutoFill({ aiOn, onFill }: { aiOn: boolean | null; onFill: (f: Record<string, unknown>) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [listening, setListening] = useState(false);
  const recRef = useRef<{ stop: () => void } | null>(null);

  async function run() {
    setBusy(true);
    setDone("");
    try {
      const r = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const j = await r.json();
      onFill(j.fields ?? {});
      setDone(j.ai ? "Filled by Gemini — check the fields below." : "Filled what we could detect — check the fields below.");
    } catch {
      setDone("Couldn't reach the server. Fill the form manually.");
    } finally {
      setBusy(false);
    }
  }

  function mic(lang: string) {
    const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const SR = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!SR) { setDone("Voice input works in Chrome and Edge."); return; }
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e: RecEvt) => {
      let s = "";
      for (let i = e.resultIndex; i < e.results.length; i++) s += e.results[i][0].transcript + " ";
      setText((t) => (t ? t + " " : "") + s.trim());
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  return (
    <section className="rounded-3xl bg-surface p-6">
      <h2 className="text-lg font-medium">Or just tell us about your business</h2>
      <p className="mt-1 text-sm text-ink-2">Type or speak in English or Hindi. {aiOn ? "Gemini" : "Karobar360"} fills the form for you.</p>
      <textarea className="field mt-4 resize-none" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="हम किशनगढ़ में मार्बल स्लैब बनाते हैं, 60 लोग काम करते हैं, दो यार्ड हैं… / We run a marble processing unit in Kishangarh with 60 workers and two yards. Dealers pay late and we use Tally…" />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className={`btn btn-sm ${listening ? "btn-primary" : "btn-quiet"}`} onClick={() => mic("hi-IN")}><Mic size={14} />{listening ? "Stop" : "Speak Hindi"}</button>
        <button className="btn btn-quiet btn-sm" onClick={() => mic("en-IN")} disabled={listening}><Mic size={14} />Speak English</button>
        <button className="btn btn-primary btn-sm ml-auto" onClick={run} disabled={text.trim().length < 15 || busy}><Wand2 size={14} />{busy ? <span className="live-dot">Reading…</span> : "Fill the form"}</button>
      </div>
      {done && <p className="mt-3 text-sm text-accent">{done}</p>}
    </section>
  );
}

interface RecEvt { resultIndex: number; results: { 0: { transcript: string } }[] & { length: number } }
interface Rec { lang: string; continuous: boolean; interimResults: boolean; onresult: (e: RecEvt) => void; onend: () => void; start: () => void; stop: () => void }

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-medium">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-ink-2">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}
function F({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm text-ink-2">{label}</span>
      {children}
    </label>
  );
}

function Review({ intake, goto }: { intake: Intake; goto: (n: number) => void }) {
  const ind = getIndustry(intake.industry);
  const rows: [string, string, number][] = [
    ["Company", `${intake.companyName || "—"}${intake.ownerName ? ` · ${intake.ownerName}` : ""}`, 0],
    ["Business", `${ind.name} · ${intake.category} · ${TURNOVER_BANDS.find((b) => b.key === intake.turnoverBand)?.label}`, 0],
    ["Location", `${intake.city}, ${intake.state}`, 0],
    ["People", `${intake.employees} employees · ${intake.users} users`, 1],
    ["Sites", intake.sites.map((s) => s.name || s.type).join(", "), 1],
    ["Sells through", intake.channels.map((c) => CHANNELS.find((x) => x.key === c)?.label).join(", ") || "—", 1],
    ["Modules", intake.modules.map((m) => MODULES.find((x) => x.key === m)?.name).join(", "), 2],
    ["Pain points", intake.painPoints || "—", 3],
    ["Custom requests", intake.customRequests.split("\n").filter(Boolean).join(" · ") || "—", 3],
    ["Uses today", intake.integrations.map((c) => INTEGRATIONS.find((x) => x.key === c)?.label).join(", ") || "—", 3],
  ];
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight">Check and build</h2>
      <p className="mt-1 text-ink-2">The AI architect reads this and designs modules, KPIs, alerts and custom trackers for {intake.companyName || "you"}.</p>
      <dl className="mt-8 divide-y divide-surface-2 rounded-2xl bg-surface px-6">
        {rows.map(([k, v, s]) => (
          <div key={k} className="grid gap-1 py-4 sm:grid-cols-[160px_1fr_auto] sm:gap-6">
            <dt className="text-sm text-ink-3">{k}</dt>
            <dd className="text-sm">{v}</dd>
            <button onClick={() => goto(s)} className="focusable justify-self-start rounded text-sm text-accent hover:underline">Edit</button>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Building({ intake, aiOn, fromId, onDone, onFail }: { intake: Intake; aiOn: boolean | null; fromId: string | null; onDone: (bp: Blueprint) => void; onFail: () => void }) {
  const ind = getIndustry(intake.industry);
  const steps = [
    `Reading ${intake.companyName}'s profile`,
    `Matching the ${ind.name.toLowerCase()} playbook · ${ind.cluster.split(" · ")[0]}`,
    `Designing ${intake.modules.length} modules and their KPIs`,
    intake.customRequests.trim() ? "Building custom modules from your requests" : "Setting up alerts and automations",
    "Generating sample data in your vocabulary",
    "Briefing the AI copilot on your business",
  ];
  const [n, setN] = useState(0);
  const [result, setResult] = useState<{ bp: Blueprint; ai: boolean; error?: string } | null>(null);
  const [err, setErr] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    fetch("/api/blueprint", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intake }) })
      .then((r) => r.json())
      .then((j) => setResult({ bp: j.blueprint, ai: j.ai, error: j.error }))
      .catch(() => setErr("Couldn't reach the server."));
  }, [intake]);

  useEffect(() => {
    if (n >= steps.length) return;
    const lastHold = n === steps.length - 1 && !result;
    if (lastHold) return;
    const tm = setTimeout(() => setN((x) => x + 1), n < 2 ? 700 : 900);
    return () => clearTimeout(tm);
  }, [n, result, steps.length]);

  useEffect(() => {
    if (n >= steps.length && result) {
      const bp = fromId ? { ...result.bp, id: fromId } : result.bp;
      saveWorkspace(bp);
      const tm = setTimeout(() => onDone(bp), 500);
      return () => clearTimeout(tm);
    }
  }, [n, result, fromId, onDone, steps.length]);

  return (
    <div className="flex min-h-screen items-center px-6">
      <div className="mx-auto w-full max-w-xl">
        <h1 className="display text-4xl font-semibold sm:text-5xl">Building {intake.companyName}’s dashboard</h1>
        <p className="mt-4 text-ink-2">{aiOn ? "Gemini is designing it from your answers." : "The Karobar360 rules engine is designing it from your answers."}</p>
        <ul className="mt-10 space-y-4">
          {steps.map((s, i) => (
            <li key={s} className={`flex items-center gap-4 transition-opacity duration-500 ${i <= n ? "opacity-100" : "opacity-30"}`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${i < n ? "bg-accent text-accent-ink" : i === n ? "bg-surface-3" : "bg-surface-2"}`}>
                {i < n ? <Check size={14} /> : i === n ? <span className="live-dot h-2 w-2 rounded-full bg-accent" /> : null}
              </span>
              <span className={i === n ? "font-medium" : "text-ink-2"}>{s}</span>
            </li>
          ))}
        </ul>
        {err && (
          <div className="mt-8 text-neg">{err} <button className="underline" onClick={onFail}>Go back</button></div>
        )}
      </div>
    </div>
  );
}
