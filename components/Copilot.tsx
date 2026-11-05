"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Mic, X } from "lucide-react";
import type { Blueprint, Lang } from "@/lib/types";
import { moduleData, overview } from "@/lib/data";
import { MODULE_MAP } from "@/lib/catalog";
import { fmt } from "@/lib/format";
import { getIndustry } from "@/lib/industries";

interface Msg { role: "user" | "ai"; text: string }

export function buildSnapshot(bp: Blueprint, siteIdx: number | null) {
  const ov = overview(bp, siteIdx);
  return {
    company: bp.intake.companyName,
    industry: getIndustry(bp.intake.industry).name,
    city: bp.intake.city,
    modules: [
      ...bp.modules.map((m) => {
        const d = moduleData(bp, m.key, siteIdx);
        return {
          name: MODULE_MAP[m.key]?.name ?? m.key,
          kpis: d.kpis.map((k) => `${k.label}: ${fmt(k.value, k.unit)}`),
          findings: [...d.charts.map((c) => c.finding ?? "").filter(Boolean), ...d.tables.slice(0, 1).flatMap((tb) => tb.rows.slice(0, 4).map((r) => Object.values(r).join(" | ")))].slice(0, 7),
        };
      }),
      ...bp.customModules.map((c) => ({ name: c.title, kpis: c.kpis.map((k) => `${k.label}: ${fmt(k.value, k.unit)}`), findings: c.insights })),
    ],
    alerts: ov.alerts.map((a) => a.text),
    recommendations: bp.recommendations.map((r) => `${r.title} — ${r.detail}`),
  };
}

function Md({ text }: { text: string }) {
  const lines = text.split("\n");
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((p, i) =>
      p.startsWith("**") ? <strong key={i} className="font-semibold text-ink">{p.slice(2, -2)}</strong> : p.startsWith("_") && p.endsWith("_") ? <em key={i} className="text-ink-3">{p.slice(1, -1)}</em> : <span key={i}>{p}</span>
    );
  return (
    <div className="space-y-1.5">
      {lines.map((l, i) => {
        const tl = l.trim();
        if (!tl) return <div key={i} className="h-1" />;
        if (/^[-*•]\s/.test(tl)) return <div key={i} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-3" /><span>{inline(tl.replace(/^[-*•]\s/, ""))}</span></div>;
        if (/^#+\s/.test(tl)) return <div key={i} className="font-semibold text-ink">{tl.replace(/^#+\s/, "")}</div>;
        return <p key={i}>{inline(tl)}</p>;
      })}
    </div>
  );
}

export default function Copilot({ bp, siteIdx, lang, open, onClose }: { bp: Blueprint; siteIdx: number | null; lang: Lang; open: boolean; onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [msgs, busy]);

  const suggestions = lang === "hi"
    ? ["इस महीने नकदी की स्थिति कैसी है?", "किन ग्राहकों से वसूली करनी है?", "कौन सा स्टॉक कम है?", "इस हफ्ते क्या फाइल करना है?"]
    : ["How is cash looking this month?", "Which customers should I chase for payment?", "What should I fix first this week?", "Which schemes can lower my loan cost?"];

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    const next = [...msgs, { role: "user" as const, text: question }];
    setMsgs(next);
    setQ("");
    setBusy(true);
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, snapshot: buildSnapshot(bp, siteIdx), history: next.slice(-6) }),
      });
      const j = await res.json();
      setMsgs((m) => [...m, { role: "ai", text: j.answer }]);
    } catch {
      setMsgs((m) => [...m, { role: "ai", text: "Couldn't reach the server. Check your connection and try again." }]);
    } finally {
      setBusy(false);
    }
  }

  function voice() {
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const SR = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!SR) { setMsgs((m) => [...m, { role: "ai", text: "Voice input works in Chrome and Edge. You can still type your question." }]); return; }
    const rec = new SR();
    rec.lang = lang === "hi" ? "hi-IN" : "en-IN";
    rec.interimResults = false;
    rec.onresult = (e: SpeechEvt) => { const txt = e.results[0][0].transcript; setQ(txt); ask(txt); };
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-night/30 fade-in" onClick={onClose}>
      <aside className="slidein flex h-full w-full max-w-md flex-col bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()} aria-label="AI copilot">
        <header className="flex items-center gap-3 px-5 py-4">
          <div>
            <div className="font-medium">{lang === "hi" ? "Karobar360 से पूछें" : "Ask Karobar360"}</div>
            <div className="text-xs text-ink-3">{lang === "hi" ? "आपके डेटा पर आधारित जवाब — हिंदी या अंग्रेज़ी में" : "Answers from your live data, in English or Hindi"}</div>
          </div>
          <button onClick={onClose} className="btn btn-quiet btn-sm ml-auto !px-2.5" aria-label="Close"><X size={16} /></button>
        </header>
        <div className="scroll-thin flex-1 space-y-4 overflow-y-auto px-5 py-2 text-sm">
          {!msgs.length && (
            <div className="space-y-2 pt-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => ask(s)} className="focusable block w-full rounded-xl bg-surface-2 px-4 py-3 text-left text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink">{s}</button>
              ))}
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={m.role === "user" ? "ml-10 rounded-2xl bg-accent px-4 py-2.5 text-accent-ink enter" : "mr-4 rounded-2xl bg-surface-2 px-4 py-3 text-ink-2 enter"}>
              {m.role === "ai" ? <Md text={m.text} /> : m.text}
            </div>
          ))}
          {busy && <div className="mr-4 rounded-2xl bg-surface-2 px-4 py-3 text-ink-3"><span className="live-dot">Reading your numbers…</span></div>}
          <div ref={endRef} />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex items-center gap-2 p-4">
          <button type="button" onClick={voice} className={`btn btn-sm !px-2.5 ${listening ? "btn-primary" : "btn-quiet"}`} aria-label="Speak your question"><Mic size={16} /></button>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={lang === "hi" ? "अपना सवाल लिखें या बोलें…" : "Ask about sales, cash, stock, staff…"} className="field flex-1" />
          <button className="btn btn-primary btn-sm !px-2.5" disabled={!q.trim() || busy} aria-label="Send"><ArrowUp size={16} /></button>
        </form>
      </aside>
    </div>
  );
}


interface SpeechEvt { results: { 0: { transcript: string } }[] }
interface SpeechRec { lang: string; interimResults: boolean; onresult: (e: SpeechEvt) => void; onend: () => void; start: () => void }
