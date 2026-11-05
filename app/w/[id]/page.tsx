"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import LZ from "lz-string";
import { Bot, FileText, Link2, Menu, Plus, Trash2, X } from "lucide-react";
import type { Blueprint, CustomModule, KPI, Lang, ModuleKey, Row } from "@/lib/types";
import { getWorkspace, saveWorkspace, deleteWorkspace } from "@/lib/store";
import { MODULES, MODULE_MAP } from "@/lib/catalog";
import { moduleData, overview } from "@/lib/data";
import { getIndustry } from "@/lib/industries";
import { t } from "@/lib/i18n";
import { fmt, fullDate } from "@/lib/format";
import Logo from "@/components/Logo";
import Icon from "@/components/Icon";
import ThemeToggle from "@/components/ThemeToggle";
import Copilot from "@/components/Copilot";
import AddModule from "@/components/AddModule";
import { AlertList, ChartPanel, DataTable, InsightList, KpiCard, Panel } from "@/components/Panels";
import { ChartBody } from "@/components/Charts";

type Role = "owner" | "accounts" | "plant";

export default function Workspace() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [bp, setBp] = useState<Blueprint | null>(null);
  const [missing, setMissing] = useState(false);
  const [view, setView] = useState<string>("overview");
  const [site, setSite] = useState<number | null>(null);
  const [role, setRole] = useState<Role>("owner");
  const [lang, setLang] = useState<Lang>("en");
  const [copilot, setCopilot] = useState(false);
  const [adding, setAdding] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const w = getWorkspace(decodeURIComponent(id));
    if (!w) { setMissing(true); return; }
    setBp(w);
    const v = new URLSearchParams(window.location.search).get("v");
    if (v) setView(v);
    try { const l = localStorage.getItem("karobar360.lang"); if (l === "hi" || l === "en") setLang(l); } catch {}
  }, [id]);

  const go = useCallback((v: string) => {
    setView(v);
    setNavOpen(false);
    const u = new URL(window.location.href);
    u.searchParams.set("v", v);
    window.history.replaceState(null, "", u.toString());
    window.scrollTo({ top: 0 });
  }, []);

  const update = useCallback((f: (b: Blueprint) => Blueprint) => {
    setBp((b) => {
      if (!b) return b;
      const n = f(b);
      saveWorkspace(n);
      return n;
    });
  }, []);

  const flash = (s: string) => { setToast(s); setTimeout(() => setToast(""), 2600); };

  const share = async () => {
    if (!bp) return;
    const code = LZ.compressToEncodedURIComponent(JSON.stringify(bp));
    const url = `${window.location.origin}/share#${code}`;
    try { await navigator.clipboard.writeText(url); flash("Share link copied — it opens this exact dashboard."); }
    catch { window.prompt("Copy this link", url); }
  };

  const setLanguage = (l: Lang) => { setLang(l); try { localStorage.setItem("karobar360.lang", l); } catch {} };

  if (missing) {
    return (
      <div className="mx-auto max-w-lg px-6 py-32 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">This dashboard isn’t on this device</h1>
        <p className="mt-3 text-ink-2">Dashboards are saved in the browser where they were built. Open the share link, or build a new one.</p>
        <div className="mt-8 flex justify-center gap-3"><Link href="/build" className="btn btn-primary">Build a dashboard</Link><Link href="/w" className="btn btn-quiet">My dashboards</Link></div>
      </div>
    );
  }
  if (!bp) return <div className="flex min-h-screen items-center justify-center text-ink-3"><span className="live-dot">Loading dashboard…</span></div>;

  const visible = bp.modules.filter((m) => !bp.hidden?.includes(m.key) && (role === "owner" || MODULE_MAP[m.key]?.roles.includes(role)));
  const customs = role === "accounts" ? [] : bp.customModules;
  const sites = bp.intake.sites;
  const title =
    view === "overview" ? t(lang, "Overview") : view === "automations" ? t(lang, "Automations") : view === "settings" ? t(lang, "Settings")
      : MODULE_MAP[view as ModuleKey] ? (lang === "hi" ? MODULE_MAP[view as ModuleKey].nameHi : MODULE_MAP[view as ModuleKey].name)
      : bp.customModules.find((c) => c.key === view)?.title ?? "";

  const NavItem = ({ k, label, icon }: { k: string; label: string; icon: string }) => (
    <button onClick={() => go(k)} className={`focusable flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[0.92rem] transition-colors ${view === k ? "bg-surface text-ink font-medium" : "text-ink-2 hover:bg-surface/60 hover:text-ink"}`}>
      <Icon name={icon} size={17} className={view === k ? "text-accent" : ""} />
      <span className="truncate">{label}</span>
    </button>
  );

  const sidebar = (
    <nav className="scroll-thin flex h-full flex-col gap-6 overflow-y-auto px-4 py-5">
      <div className="flex items-center justify-between px-2"><Logo href="/w" /><button className="btn btn-quiet btn-sm !px-2 lg:hidden" onClick={() => setNavOpen(false)} aria-label="Close menu"><X size={16} /></button></div>
      <div className="px-3">
        <div className="truncate font-semibold">{bp.intake.companyName}</div>
        <div className="truncate text-sm text-ink-3">{getIndustry(bp.intake.industry).name} · {bp.intake.city}</div>
      </div>
      <div className="space-y-0.5">
        <NavItem k="overview" label={t(lang, "Overview")} icon="LayoutDashboard" />
        {visible.map((m) => <NavItem key={m.key} k={m.key} label={lang === "hi" ? MODULE_MAP[m.key].nameHi : MODULE_MAP[m.key].name} icon={MODULE_MAP[m.key].icon} />)}
      </div>
      {customs.length > 0 && (
        <div className="space-y-0.5">
          <div className="px-3 pb-1 text-sm text-ink-3">Built for you</div>
          {customs.map((c) => <NavItem key={c.key} k={c.key} label={c.title} icon={c.icon} />)}
        </div>
      )}
      <div className="space-y-0.5">
        <button onClick={() => setAdding(true)} className="focusable flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[0.92rem] text-accent transition-colors hover:bg-surface/60"><Plus size={17} />{t(lang, "Add a module")}</button>
        <NavItem k="automations" label={t(lang, "Automations")} icon="Workflow" />
        <NavItem k="settings" label={t(lang, "Settings")} icon="Settings" />
      </div>
      <div className="mt-auto space-y-2 px-1">
        <button onClick={() => setCopilot(true)} className="btn btn-primary w-full justify-center"><Bot size={16} />{t(lang, "Ask Karobar360")}</button>
        <Link href={`/w/${encodeURIComponent(bp.id)}/proposal`} className="btn btn-quiet w-full justify-center"><FileText size={16} />{t(lang, "Proposal")}</Link>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="sticky top-0 hidden h-screen bg-surface-2/70 lg:block">{sidebar}</aside>
      {navOpen && (
        <div className="fixed inset-0 z-40 bg-night/30 lg:hidden fade-in" onClick={() => setNavOpen(false)}>
          <aside className="slidein h-full w-[280px] bg-surface-2" onClick={(e) => e.stopPropagation()}>{sidebar}</aside>
        </div>
      )}
      <main className="min-w-0 px-4 pb-24 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-30 -mx-4 flex flex-wrap items-center gap-2 bg-ground/95 px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <button className="btn btn-quiet btn-sm !px-2.5 lg:hidden" onClick={() => setNavOpen(true)} aria-label="Open menu"><Menu size={16} /></button>
          <h1 className="mr-auto text-xl font-semibold tracking-tight">{title}</h1>
          {sites.length > 1 && (
            <select value={site ?? ""} onChange={(e) => setSite(e.target.value === "" ? null : Number(e.target.value))} className="field !w-auto max-w-[11rem] !py-2 text-sm" aria-label="Site">
              <option value="">{t(lang, "All sites")}</option>
              {sites.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
            </select>
          )}
          <select value={role} onChange={(e) => { setRole(e.target.value as Role); go("overview"); }} className="field !w-auto !py-2 text-sm" aria-label="View as">
            <option value="owner">{t(lang, "Owner")}</option>
            <option value="accounts">{t(lang, "Accounts")}</option>
            <option value="plant">{t(lang, "Plant manager")}</option>
          </select>
          <div className="flex rounded-full bg-surface-2 p-0.5 text-sm" role="group" aria-label="Language">
            {(["en", "hi"] as Lang[]).map((l) => (
              <button key={l} onClick={() => setLanguage(l)} className={`focusable rounded-full px-3 py-1.5 transition-colors ${lang === l ? "bg-surface font-medium text-ink" : "text-ink-3 hover:text-ink"}`}>{l === "en" ? "EN" : "हिं"}</button>
            ))}
          </div>
          <button onClick={share} className="btn btn-quiet btn-sm" title="Copy a link to this dashboard"><Link2 size={15} /><span className="hidden sm:inline">{t(lang, "Share")}</span></button>
          <ThemeToggle />
        </header>

        <div key={`${view}-${site}-${role}`} className="mt-2">
          {view === "overview" && <Overview bp={bp} site={site} lang={lang} go={go} visible={visible.map((v) => v.key)} />}
          {MODULE_MAP[view as ModuleKey] && bp.modules.some((m) => m.key === view) && (
            <ModuleView bp={bp} k={view} site={site} lang={lang} onImport={(ti, rows) => update((b) => ({ ...b, overrides: { ...(b.overrides ?? {}), [`${view}:${ti}`]: rows } }))} />
          )}
          {bp.customModules.some((c) => c.key === view) && (
            <ModuleView bp={bp} k={view} site={site} lang={lang} custom={bp.customModules.find((c) => c.key === view)} onImport={(ti, rows) => update((b) => ({ ...b, overrides: { ...(b.overrides ?? {}), [`${view}:${ti}`]: rows } }))} />
          )}
          {view === "automations" && <Automations bp={bp} toggle={(i) => update((b) => ({ ...b, automations: b.automations.map((a, j) => (j === i ? { ...a, enabled: !a.enabled } : a)) }))} />}
          {view === "settings" && (
            <SettingsView bp={bp} update={update} onDelete={() => { deleteWorkspace(bp.id); router.push("/w"); }} removeCustom={(k) => { update((b) => ({ ...b, customModules: b.customModules.filter((c) => c.key !== k) })); }} />
          )}
        </div>
      </main>

      <button onClick={() => setCopilot(true)} className="btn btn-primary fixed bottom-5 right-5 z-30 shadow-xl lg:hidden"><Bot size={16} />Ask</button>
      <Copilot bp={bp} siteIdx={site} lang={lang} open={copilot} onClose={() => setCopilot(false)} />
      <AddModule bp={bp} open={adding} onClose={() => setAdding(false)} onAdd={(m: CustomModule) => { update((b) => ({ ...b, customModules: [...b.customModules, m] })); go(m.key); flash(`“${m.title}” added to your dashboard.`); }} />
      {toast && <div className="enter fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-sm text-ground shadow-xl">{toast}</div>}
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Overview({ bp, site, lang, go, visible }: { bp: Blueprint; site: number | null; lang: Lang; go: (v: string) => void; visible: string[] }) {
  const ov = useMemo(() => overview(bp, site), [bp, site]);
  const first = bp.intake.ownerName.split(" ")[0];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="enter lg:col-span-2">
          <div className="text-sm text-ink-3">{fullDate(new Date())}</div>
          <h2 className="mt-1 text-[1.65rem] font-semibold leading-tight tracking-tight">{lang === "hi" ? `नमस्ते${first ? ` ${first} जी` : ""}` : `${greeting()}${first ? `, ${first}` : ""}`}</h2>
          <p className="mt-3 max-w-[65ch] text-ink-2">{bp.summary}</p>
          <div className="mt-4 flex items-center gap-2 text-xs text-ink-3">
            <span className={`h-1.5 w-1.5 rounded-full ${bp.source === "gemini" ? "bg-accent" : "bg-ink-3"}`} />
            {bp.source === "gemini" ? "Designed by Gemini from your intake form" : "Designed by the Karobar360 rules engine"} · sample data until your books are connected
          </div>
        </Panel>
        <Panel className="enter" style={{ ["--d" as string]: "80ms" }}>
          <div className="flex items-baseline justify-between">
            <h3 className="font-medium">{t(lang, "Business health")}</h3>
            <span className="num text-3xl font-semibold tracking-tight">{ov.score}<span className="text-base font-normal text-ink-3">/100</span></span>
          </div>
          <ul className="mt-4 space-y-3 text-sm">
            {ov.scoreParts.map((p) => (
              <li key={p.name}>
                <div className="mb-1 flex justify-between text-ink-2"><span>{p.name}</span><span className="num">{Math.round(p.value * 100)}</span></div>
                <div className="h-1.5 rounded-full bg-surface-2"><div className={`h-1.5 rounded-full ${p.value < 0.6 ? "bg-warn" : "bg-accent"}`} style={{ width: `${Math.round(p.value * 100)}%` }} /></div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-6">
        {ov.kpis.map((k, i) => <KpiCard key={i} k={k} lang={lang} i={i} />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="enter lg:col-span-2" style={{ ["--d" as string]: "160ms" }}>
          <h3 className="font-medium">{t(lang, ov.chart.title)}</h3>
          <p className="mb-4 text-sm text-ink-2">{ov.chart.finding}</p>
          <ChartBody spec={ov.chart} height={260} />
        </Panel>
        <AlertList alerts={ov.alerts.filter((a) => visible.includes(a.module)).slice(0, 7)} lang={lang} onOpen={go} />
      </div>
      <Panel className="enter">
        <h3 className="mb-4 font-medium">{t(lang, "What to do next")}</h3>
        <div className="grid gap-x-10 gap-y-5 md:grid-cols-2">
          {bp.recommendations.map((r, i) => (
            <button key={i} onClick={() => (visible.includes(r.module) ? go(r.module) : undefined)} className="focusable group rounded-xl text-left">
              <div className="font-medium group-hover:text-accent">{r.title}</div>
              <div className="mt-1 text-sm text-ink-2">{r.detail}</div>
              <div className="mt-1.5 text-sm text-accent">{r.impact}</div>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function ModuleView({ bp, k, site, lang, custom, onImport }: { bp: Blueprint; k: string; site: number | null; lang: Lang; custom?: CustomModule; onImport: (ti: number, rows: Row[]) => void }) {
  const d = useMemo(() => moduleData(bp, k, site), [bp, k, site]);
  const meta = MODULE_MAP[k as ModuleKey];
  return (
    <div className="space-y-4">
      <p className="max-w-[70ch] text-ink-2">{custom ? custom.description : meta?.blurb}</p>
      <div className={`grid grid-cols-2 gap-4 ${d.kpis.length >= 5 ? "md:grid-cols-3 xl:grid-cols-5" : d.kpis.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        {d.kpis.map((kp, i) => <KpiCard key={i} k={kp} lang={lang} i={i} />)}
      </div>
      {(d.charts.length > 0 || d.insights.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {d.charts.map((c, i) => <ChartPanel key={c.id} spec={c} lang={lang} i={i} />)}
          {(d.insights.length > 0 || d.alerts.length > 0) && (
            <div className={`space-y-4 ${d.charts.reduce((a, c) => a + (c.wide ? 2 : 1), 0) % 2 === 0 ? `lg:col-span-2 ${d.insights.length && d.alerts.length ? "lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0" : ""}` : ""}`}>
              <InsightList items={d.insights} lang={lang} />
              <AlertList alerts={d.alerts} lang={lang} />
            </div>
          )}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {d.tables.map((tb, i) => {
          const ov = bp.overrides?.[`${k}:${i}`];
          return <DataTable key={i} spec={ov ? { ...tb, rows: ov } : tb} lang={lang} onImport={(rows) => onImport(i, rows)} />;
        })}
      </div>
    </div>
  );
}

function Automations({ bp, toggle }: { bp: Blueprint; toggle: (i: number) => void }) {
  return (
    <div className="space-y-4">
      <p className="max-w-[70ch] text-ink-2">Rules that run on their own. Messages go out from your WhatsApp Business number once it is connected.</p>
      <Panel className="enter">
        <ul className="divide-y divide-surface-2">
          {bp.automations.map((a, i) => (
            <li key={i} className="flex flex-wrap items-center gap-4 py-4 first:pt-1 last:pb-1">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{a.trigger}</div>
                <div className="text-sm text-ink-2">{a.action}</div>
              </div>
              <span className="text-sm text-ink-3">{a.channel}</span>
              <button role="switch" aria-checked={a.enabled} onClick={() => toggle(i)} className={`focusable relative h-6 w-11 rounded-full transition-colors ${a.enabled ? "bg-accent" : "bg-surface-3"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface transition-transform ${a.enabled ? "translate-x-[22px]" : "translate-x-0.5"}`} />
              </button>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel className="enter">
        <h3 className="font-medium">Sample owner brief</h3>
        <p className="mb-4 text-sm text-ink-2">What arrives on WhatsApp at 8 am.</p>
        <div className="max-w-md rounded-2xl rounded-tl-sm bg-accent-soft p-4 text-sm leading-relaxed">
          <OwnerBrief bp={bp} />
        </div>
      </Panel>
    </div>
  );
}

function OwnerBrief({ bp }: { bp: Blueprint }) {
  const ov = overview(bp, null);
  return (
    <div className="space-y-2">
      <div className="font-semibold">{bp.intake.companyName} · {fullDate(new Date())}</div>
      {ov.kpis.slice(0, 4).map((k, i) => <div key={i}>• {k.label}: <span className="num font-medium">{fmtK(k)}</span></div>)}
      {ov.alerts.slice(0, 2).map((a, i) => <div key={i}><span className="font-medium">Attention:</span> {a.text}</div>)}
      <div className="text-ink-3">Reply 1 for details, 2 for Hindi.</div>
    </div>
  );
}

function fmtK(k: KPI) { return fmt(k.value, k.unit); }

function SettingsView({ bp, update, onDelete, removeCustom }: { bp: Blueprint; update: (f: (b: Blueprint) => Blueprint) => void; onDelete: () => void; removeCustom: (k: string) => void }) {
  const [name, setName] = useState(bp.intake.companyName);
  const active = new Set(bp.modules.map((m) => m.key));
  const hidden = new Set(bp.hidden ?? []);
  const toggle = (k: ModuleKey) =>
    update((b) => {
      if (b.modules.some((m) => m.key === k)) {
        const h = new Set(b.hidden ?? []);
        if (h.has(k)) h.delete(k); else h.add(k);
        return { ...b, hidden: Array.from(h) };
      }
      const modules = MODULES.filter((m) => b.modules.some((x) => x.key === m.key) || m.key === k).map((m) => b.modules.find((x) => x.key === m.key) ?? { key: m.key, insights: [] });
      return { ...b, modules, intake: { ...b.intake, modules: modules.map((m) => m.key) } };
    });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel className="enter">
        <h3 className="mb-4 font-medium">Company</h3>
        <label className="text-sm text-ink-2">Company name</label>
        <div className="mt-1 flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className="field" />
          <button className="btn btn-primary btn-sm" onClick={() => update((b) => ({ ...b, intake: { ...b.intake, companyName: name } }))}>Save</button>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-y-3 text-sm">
          <dt className="text-ink-3">Industry</dt><dd>{getIndustry(bp.intake.industry).name}</dd>
          <dt className="text-ink-3">Location</dt><dd>{bp.intake.city}, {bp.intake.state}</dd>
          <dt className="text-ink-3">People</dt><dd className="num">{bp.intake.employees}</dd>
          <dt className="text-ink-3">Sites</dt><dd>{bp.intake.sites.map((s) => s.name).join(", ")}</dd>
          <dt className="text-ink-3">Built</dt><dd>{fullDate(new Date(bp.createdAt))} · {bp.source === "gemini" ? "Gemini" : "rules engine"}</dd>
        </dl>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={`/build?from=${encodeURIComponent(bp.id)}`} className="btn btn-quiet btn-sm">Edit intake & rebuild</Link>
          {bp.overrides && <button className="btn btn-quiet btn-sm" onClick={() => update((b) => ({ ...b, overrides: undefined }))}>Reset imported data</button>}
          <button className="btn btn-quiet btn-sm !text-neg" onClick={onDelete}><Trash2 size={14} />Delete dashboard</button>
        </div>
      </Panel>
      <Panel className="enter">
        <h3 className="mb-1 font-medium">Modules</h3>
        <p className="mb-4 text-sm text-ink-2">Turn modules on or off. Changes apply instantly.</p>
        <div className="flex flex-wrap gap-2">
          {MODULES.map((m) => (
            <button key={m.key} className="chip" data-on={active.has(m.key) && !hidden.has(m.key)} onClick={() => toggle(m.key)}>{m.name}</button>
          ))}
        </div>
        {bp.customModules.length > 0 && (
          <>
            <h3 className="mb-3 mt-8 font-medium">Custom modules</h3>
            <ul className="space-y-2">
              {bp.customModules.map((c) => (
                <li key={c.key} className="flex items-center gap-3 text-sm">
                  <Icon name={c.icon} size={16} className="text-ink-3" />
                  <span className="flex-1">{c.title}</span>
                  <button className="btn btn-quiet btn-sm" onClick={() => removeCustom(c.key)}>Remove</button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
}
