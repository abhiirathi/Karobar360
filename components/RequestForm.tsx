"use client";
import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";

export type Extra = { key: string; label: string; kind?: "text" | "select" | "area"; options?: string[]; placeholder?: string };

/** One form for the contact page, the website request and the other services. Saves, then emails the team. */
export default function RequestForm({ kind, prefill, extras = [], messageLabel = "Message", messagePlaceholder, submit = "Send", done = "Thank you. We have your message and will get back to you soon." }: {
  kind: string;
  prefill?: { name?: string; company?: string; phone?: string; email?: string };
  extras?: Extra[];
  messageLabel?: string;
  messagePlaceholder?: string;
  submit?: string;
  done?: string;
}) {
  const [f, setF] = useState({ name: prefill?.name ?? "", company: prefill?.company ?? "", phone: prefill?.phone ?? "", email: prefill?.email ?? "", message: "", website_url: "" });
  const [x, setX] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!f.name.trim()) return setErr("Please enter your name.");
    if (!f.phone.trim() && !f.email.trim()) return setErr("Please enter a mobile number or email so we can reply.");
    setState("busy");
    const details = Object.fromEntries(extras.map((d) => [d.label, x[d.key] ?? ""]).filter(([, v]) => v));
    const r = await fetch("/api/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, ...f, details }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) setState("done");
    else { setState("idle"); setErr((j as { error?: string }).error ?? "Could not send. Check the internet connection and try again."); }
  };

  if (state === "done") {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-accent-soft p-5">
        <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-accent" />
        <div><div className="font-semibold">Sent</div><p className="mt-0.5 text-[0.92rem] text-ink-2">{done}</p></div>
      </div>
    );
  }

  const field = "field";
  return (
    <form onSubmit={send} className="space-y-3.5" noValidate>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <label className="block"><span className="mb-1 block text-[0.82rem] font-medium text-ink-2">Your name *</span><input className={field} value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" /></label>
        <label className="block"><span className="mb-1 block text-[0.82rem] font-medium text-ink-2">Company</span><input className={field} value={f.company} onChange={(e) => set("company", e.target.value)} autoComplete="organization" /></label>
        <label className="block"><span className="mb-1 block text-[0.82rem] font-medium text-ink-2">Mobile / WhatsApp</span><input className={field} type="tel" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" placeholder="98290 12345" /></label>
        <label className="block"><span className="mb-1 block text-[0.82rem] font-medium text-ink-2">Email</span><input className={field} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" /></label>
        {extras.map((d) => (
          <label key={d.key} className={`block ${d.kind === "area" ? "sm:col-span-2" : ""}`}>
            <span className="mb-1 block text-[0.82rem] font-medium text-ink-2">{d.label}</span>
            {d.kind === "select" ? (
              <select className={field} value={x[d.key] ?? ""} onChange={(e) => setX((p) => ({ ...p, [d.key]: e.target.value }))}>
                <option value="">Choose</option>
                {d.options?.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : d.kind === "area" ? (
              <textarea className={`${field} resize-y`} rows={2} value={x[d.key] ?? ""} placeholder={d.placeholder} onChange={(e) => setX((p) => ({ ...p, [d.key]: e.target.value }))} />
            ) : (
              <input className={field} value={x[d.key] ?? ""} placeholder={d.placeholder} onChange={(e) => setX((p) => ({ ...p, [d.key]: e.target.value }))} />
            )}
          </label>
        ))}
      </div>
      <label className="block"><span className="mb-1 block text-[0.82rem] font-medium text-ink-2">{messageLabel}</span><textarea className={`${field} resize-y`} rows={4} value={f.message} placeholder={messagePlaceholder} onChange={(e) => set("message", e.target.value)} /></label>
      <input type="text" name="website_url" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={f.website_url} onChange={(e) => set("website_url", e.target.value)} />
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button type="submit" className="btn btn-primary" disabled={state === "busy"}><Send size={15} />{state === "busy" ? "Sending…" : submit}</button>
        {err && <span className="text-sm text-neg" role="alert">{err}</span>}
      </div>
    </form>
  );
}
