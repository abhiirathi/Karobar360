"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import Logo from "@/components/Logo";
import { STATES } from "@/lib/stone/calc";
import { BUSINESS_PRESETS, MODULE_INFO, presetModules } from "@/lib/stone/modules";
import type { Modules } from "@/lib/stone/types";

export default function Auth({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("signup")) setMode("signup");
  }, []);
  return (
    <div className="min-h-screen px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-[560px]">
        <div className="flex items-center justify-between">
          <Logo />
          <Link href="/stone/demo" className="text-sm text-ink-2 underline-offset-4 hover:underline">Try the demo first</Link>
        </div>
        {mode === "login" ? <Login onDone={onDone} toSignup={() => setMode("signup")} /> : <Signup onDone={onDone} toLogin={() => setMode("login")} />}
      </div>
    </div>
  );
}

function Login({ onDone, toSignup }: { onDone: () => void; toSignup: () => void }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login, password }) }).catch(() => null);
    const j = await r?.json().catch(() => ({}));
    setBusy(false);
    if (r?.ok) onDone();
    else setErr(j?.error ?? "Could not sign in. Check the connection.");
  };
  return (
    <form onSubmit={submit} className="mt-10 rounded-[22px] bg-surface p-6 sm:p-8">
      <h1 className="text-[1.6rem] font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-ink-2">Use the mobile number and password your company gave you.</p>
      <label className="mt-6 block text-sm font-medium" htmlFor="l">Mobile number or username</label>
      <input id="l" className="field mt-1.5" autoComplete="username" inputMode="text" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="98290 12345" required />
      <label className="mt-4 block text-sm font-medium" htmlFor="p">Password</label>
      <input id="p" className="field mt-1.5" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {err && <p className="mt-3 text-sm text-neg" role="alert">{err}</p>}
      <button className="btn btn-primary mt-6 w-full justify-center" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      <p className="mt-5 text-sm text-ink-2">Forgot the password? Ask your owner or manager to set a new one from the Team page.</p>
      <div className="mt-6 border-t border-surface-2 pt-5 text-sm">
        New to Karobar360? <button type="button" onClick={toSignup} className="font-medium text-accent underline-offset-4 hover:underline">Create your company account</button>
      </div>
    </form>
  );
}

function Signup({ onDone, toLogin }: { onDone: () => void; toLogin: () => void }) {
  const [step, setStep] = useState(1);
  const [mods, setMods] = useState<Modules>(presetModules({ buyBlocks: true, processing: true, depot: true }));
  const [preset, setPreset] = useState("processor");
  const [f, setF] = useState({ company: "", city: "Kishangarh", state: "08", gstin: "", name: "", login: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const any = Object.values(mods).some(Boolean);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await fetch("/api/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company: f.company, name: f.name, login: f.login, password: f.password, setup: { modules: mods, city: f.city, state: f.state, gstin: f.gstin, phone: f.login } }),
    }).catch(() => null);
    const j = await r?.json().catch(() => ({}));
    setBusy(false);
    if (r?.ok) onDone();
    else setErr(j?.error ?? "Could not create the account. Check the connection.");
  };

  return (
    <div className="mt-10 rounded-[22px] bg-surface p-6 sm:p-8">
      <div className="text-sm text-ink-3">Step {step} of 2</div>
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
          <div className="mt-5 text-sm">Already have an account? <button type="button" onClick={toLogin} className="font-medium text-accent underline-offset-4 hover:underline">Sign in</button></div>
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
            <Fld label="Mobile number" hint="You sign in with this"><input className="field" inputMode="tel" autoComplete="username" value={f.login} onChange={set("login")} placeholder="98290 12345" required /></Fld>
            <Fld label="Password" hint="At least 6 characters"><input className="field" type="password" autoComplete="new-password" value={f.password} onChange={set("password")} minLength={6} required /></Fld>
          </div>
          {err && <p className="mt-4 text-sm text-neg" role="alert">{err}</p>}
          <button className="btn btn-primary mt-6 w-full justify-center" disabled={busy}>{busy ? "Creating your workspace…" : "Create account"}</button>
          <p className="mt-4 text-[0.82rem] text-ink-3">You can add your munim, sales staff and yard team from the Team page and choose exactly what each one sees.</p>
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
