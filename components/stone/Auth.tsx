"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import Logo from "@/components/Logo";
import InstallApp from "@/components/InstallApp";
import { STATES } from "@/lib/stone/calc";
import { BUSINESS_PRESETS, MODULE_INFO, presetModules } from "@/lib/stone/modules";
import type { Modules } from "@/lib/stone/types";

type AuthInfo = { pending: { email: string; name: string } | null; google: boolean; email: boolean };

const ERRS: Record<string, string> = {
  google_off: "Google sign-in is not switched on yet. Use your email or mobile number.",
  google: "Google sign-in did not finish. Try again.",
  link: "That sign-in link has expired or was already replaced. Ask for a new one.",
  inactive: "This login has been switched off by your company.",
  server: "The server could not finish signing you in. Try again in a minute.",
};

export default function Auth({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [info, setInfo] = useState<AuthInfo | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("signup")) setMode("signup");
    const e = q.get("err");
    if (e) setErr(ERRS[e] ?? "");
    if (e || q.get("welcome")) window.history.replaceState(null, "", "/stone");
    fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (j.me) { onDone(); return; }
      setInfo({ pending: j.pending ?? null, google: !!j.google, email: !!j.email });
    }).catch(() => setInfo({ pending: null, google: false, email: false }));
  }, [onDone]);

  const restart = async () => { await fetch("/api/auth/logout", { method: "POST" }).catch(() => {}); setInfo((i) => (i ? { ...i, pending: null } : i)); setMode("signup"); };

  return (
    <div className="min-h-screen px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-[560px]">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4 text-sm text-ink-2">
            <InstallApp variant="link" />
          </div>
        </div>
        {err && <p className="mt-6 rounded-2xl bg-neg-soft px-4 py-3 text-sm text-neg" role="alert">{err}</p>}
        {!info ? (
          <div className="mt-10 h-[420px] animate-pulse rounded-[22px] bg-surface" aria-label="Loading" />
        ) : info.pending ? (
          <Signup onDone={onDone} verified={info.pending} onRestart={restart} />
        ) : (
          <Start info={info} kind={mode} toOther={() => setMode(mode === "login" ? "signup" : "login")} onDone={onDone} />
        )}
      </div>
    </div>
  );
}

/** Google and magic-link entry; the same flow signs in existing people and starts sign-up for new ones. */
function Start({ info, kind, toOther, onDone }: { info: AuthInfo; kind: "login" | "signup"; toOther: () => void; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const enter = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await fetch("/api/auth/code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: sent, code }) }).catch(() => null);
    const j = await r?.json().catch(() => ({}));
    if (r?.ok) {
      // Signed in, or verified and on to company setup: reload the screen either way.
      if (j.next === "/stone") { onDone(); setBusy(false); return; }
      window.location.assign(j.next ?? "/stone");
      return;
    }
    setBusy(false);
    setErr(j?.error ?? "Could not check the code. Check the connection.");
  };
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await fetch("/api/auth/magic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }).catch(() => null);
    const j = await r?.json().catch(() => ({}));
    setBusy(false);
    if (r?.ok) setSent(email.trim().toLowerCase());
    else setErr(j?.error ?? "Could not send the email. Check the connection.");
  };
  const signup = kind === "signup";
  return (
    <div className="mt-10 rounded-[22px] bg-surface p-6 sm:p-8">
      <h1 className="text-[1.6rem] font-semibold tracking-tight">{signup ? "Create your company account" : "Sign in"}</h1>
      <p className="mt-1 text-ink-2">{signup ? "Start with Google or your email. Next you set up your company, then bring in your existing data." : "Use Google, or get a sign-in link and code on your email. Your team members use the email their owner added for them."}</p>

      {sent ? (
        <form onSubmit={enter} className="mt-6 rounded-2xl bg-accent-soft px-5 py-4">
          <div className="font-medium">Check your inbox</div>
          <p className="mt-1 text-[0.92rem] text-ink-2">We sent a link and a 6-digit code to <span className="font-medium text-ink">{sent}</span>. Tap the link, or type the code here (easiest in the installed app). Not there? Look in Spam or Promotions.</p>
          <label className="mt-4 block text-sm font-medium" htmlFor="code">6-digit code</label>
          <div className="mt-1.5 flex gap-2">
            <input id="code" className="field num tracking-[0.3em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" />
            <button className="btn btn-primary shrink-0" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Sign in"}</button>
          </div>
          {err && <p className="mt-3 text-sm text-neg" role="alert">{err}</p>}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <button type="button" className="font-medium text-accent underline-offset-4 hover:underline" onClick={() => { setSent(""); setCode(""); setErr(""); }}>Use a different email</button>
            <button type="button" className="text-ink-2 underline-offset-4 hover:underline" disabled={busy} onClick={(e) => { setEmail(sent); send(e as unknown as React.FormEvent); }}>Send again</button>
          </div>
        </form>
      ) : (
        <>
          <a href="/api/auth/google" aria-disabled={!info.google}
            className={`focusable mt-6 flex h-12 w-full items-center justify-center gap-3 rounded-full border border-surface-3 bg-ground font-medium transition-colors hover:bg-surface-2 ${info.google ? "" : "pointer-events-none opacity-50"}`}>
            <GoogleMark />{signup ? "Sign up with Google" : "Continue with Google"}
          </a>
          {!info.google && <p className="mt-2 text-center text-xs text-ink-3">Google sign-in is being switched on.</p>}
          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-ink-3"><span className="h-px flex-1 bg-surface-2" />or<span className="h-px flex-1 bg-surface-2" /></div>
          <form onSubmit={send}>
            <label className="block text-sm font-medium" htmlFor="em">Work email</label>
            <input id="em" className="field mt-1.5" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
            {err && <p className="mt-3 text-sm text-neg" role="alert">{err}</p>}
            <button className="btn btn-primary mt-4 w-full justify-center" disabled={busy || !info.email}>{busy ? "Sending…" : "Email me a sign-in link"}</button>
            {!info.email && <p className="mt-2 text-center text-xs text-ink-3">Email links are being switched on.</p>}
          </form>
        </>
      )}

      <div className="mt-6 border-t border-surface-2 pt-5 text-sm">
        {signup ? (
          <>Already have an account? <button type="button" onClick={toOther} className="font-medium text-accent underline-offset-4 hover:underline">Sign in</button></>
        ) : (
          <>New to Karobar360? <button type="button" onClick={toOther} className="font-medium text-accent underline-offset-4 hover:underline">Create your company account</button></>
        )}
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function Signup({ onDone, verified, onRestart }: { onDone: () => void; verified: { email: string; name: string }; onRestart: () => void }) {
  const [step, setStep] = useState(1);
  const [mods, setMods] = useState<Modules>(presetModules({ buyBlocks: true, processing: true, depot: true }));
  const [preset, setPreset] = useState("processor");
  const [f, setF] = useState({ company: "", city: "Kishangarh", state: "08", gstin: "", name: verified.name, phone: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const any = Object.values(mods).some(Boolean);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await fetch("/api/auth/onboard", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company: f.company, name: f.name, setup: { modules: mods, city: f.city, state: f.state, gstin: f.gstin, phone: f.phone } }),
    }).catch(() => null);
    const j = await r?.json().catch(() => ({}));
    setBusy(false);
    if (r?.ok) onDone();
    else setErr(j?.error ?? "Could not create the account. Check the connection.");
  };

  return (
    <div className="mt-10 rounded-[22px] bg-surface p-6 sm:p-8">
      {(
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-accent-soft px-4 py-3 text-sm">
          <span className="inline-flex items-center gap-2"><Check size={15} className="text-accent" />Signed in as <span className="font-medium">{verified.email}</span></span>
          <button type="button" onClick={onRestart} className="text-ink-2 underline-offset-4 hover:underline">Not you?</button>
        </div>
      )}
      <div className="text-sm text-ink-3">{`Set up your company · step ${step} of 2`}</div>
      {step === 1 ? (
        <>
          <h1 className="mt-1 text-[1.6rem] font-semibold tracking-tight">What does your business do?</h1>
          <p className="mt-1 text-ink-2">Your dashboard shows only these parts. You can change this later in Settings.</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {BUSINESS_PRESETS.map((p) => (
              <button key={p.key} type="button" onClick={() => { setPreset(p.key); setMods(presetModules(p.m)); }}
                className={`focusable rounded-2xl border px-4 py-3 text-left transition-colors ${preset === p.key ? "border-accent bg-accent-soft" : "border-surface-2 hover:bg-surface-2"}`}>
                <div className="font-medium">{p.label}</div>
                <div className="text-[0.84rem] text-ink-2">{p.blurb}</div>
              </button>
            ))}
          </div>
          <div className="mt-6 text-sm font-medium">Fine-tune</div>
          <ul className="mt-2 divide-y divide-surface-2">
            {MODULE_INFO.map((m) => (
              <li key={m.key}>
                <label className="flex cursor-pointer items-start gap-3 py-2.5">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={mods[m.key]} onChange={(e) => { setPreset(""); setMods({ ...mods, [m.key]: e.target.checked }); }} />
                  <span><span className="font-medium">{m.label}</span><span className="block text-[0.84rem] text-ink-2">{m.hint}</span></span>
                </label>
              </li>
            ))}
          </ul>
          <button className="btn btn-primary mt-6 w-full justify-center" disabled={!any} onClick={() => setStep(2)}>Continue</button>
        </>
      ) : (
        <form onSubmit={submit}>
          <button type="button" onClick={() => setStep(1)} className="mt-1 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink"><ArrowLeft size={14} />Business type</button>
          <h1 className="mt-2 text-[1.6rem] font-semibold tracking-tight">Your company</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {MODULE_INFO.filter((m) => mods[m.key]).map((m) => <span key={m.key} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs"><Check size={12} />{m.label.replace(/^We /, "")}</span>)}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Fld label="Company name" span><input className="field" value={f.company} onChange={set("company")} placeholder="Shree Shyam Marbles" required /></Fld>
            <Fld label="City"><input className="field" value={f.city} onChange={set("city")} /></Fld>
            <Fld label="State"><select className="field" value={f.state} onChange={set("state")}>{Object.entries(STATES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Fld>
            <Fld label="GSTIN (optional)" span><input className="field uppercase" value={f.gstin} onChange={set("gstin")} maxLength={15} placeholder="08ABCDE1234F1Z5" /></Fld>
          </div>
          <h2 className="mt-7 text-lg font-semibold">You, the owner</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Fld label="Your name" span><input className="field" value={f.name} onChange={set("name")} required /></Fld>
            <Fld label="Mobile number (optional)" hint="Printed on invoices and the catalogue, not used to sign in"><input className="field" inputMode="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} placeholder="98290 12345" /></Fld>
          </div>
          {err && <p className="mt-4 text-sm text-neg" role="alert">{err}</p>}
          <button className="btn btn-primary mt-6 w-full justify-center" disabled={busy}>{busy ? "Creating your workspace…" : "Create my workspace"}</button>
          <p className="mt-4 text-[0.82rem] text-ink-3">Next: bring in your existing data with our Excel template, and add your munim, sales staff and yard team by email from the Team page. Have a mine, a unit and a depot as separate firms? Add them in Settings → Firms.</p>
        </form>
      )}
    </div>
  );
}

function Fld({ label, hint, span, children }: { label: string; hint?: string; span?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block ${span ? "sm:col-span-2" : ""}`}>
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}
