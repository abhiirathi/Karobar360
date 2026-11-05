"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpenCheck, Building2, LifeBuoy, Factory, ReceiptText, Route, LayoutDashboard, LogOut, Mountain, Package, Settings, Ship, UserCog, Users, Warehouse } from "lucide-react";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { useStone, type StoneMode } from "@/lib/stone/store";
import { level, roleLabel, type AreaKey, type Level, type Me, type Perms } from "@/lib/stone/perm";
import { hasBlocks, modulesOf } from "@/lib/stone/modules";
import type { Firm, Modules, StoneDB } from "@/lib/stone/types";
import { firmsOf, kindLabel, scope, tagNew } from "@/lib/stone/firms";
import Overview from "./Overview";
import Mines from "./Mines";
import Unit from "./Unit";
import Depot from "./Depot";
import StoresView from "./Stores";
import Trade from "./Trade";
import Parties from "./Parties";
import SettingsView from "./SettingsView";
import Team from "./Team";
import TallyView from "./TallyView";
import Scan from "./Scan";
import Auth from "./Auth";
import TraceView from "./Trace";
import Help from "./Help";

export type View = "overview" | "mines" | "unit" | "stores" | "depot" | "sales" | "trade" | "parties" | "trace" | "tally" | "team" | "settings" | "help" | "scan";
export type Ctx = {
  db: StoneDB;
  update: (fn: (d: StoneDB) => void) => void;
  go: (v: View, sub?: string) => void;
  sub: string;
  reset: (empty?: boolean) => void;
  replace: (db: StoneDB) => void;
  mode: StoneMode;
  me: Me | null;
  perms: Perms;
  can: (a: AreaKey) => Level;
  edit: (a: AreaKey) => boolean;
  costs: boolean;
  mods: Modules;
  say: (text: string, tone?: "neg" | "good" | "plain") => void;
  /** The whole group's data, for lookups across firms. db is what the selected firm sees. */
  root: StoneDB;
  firms: Firm[];
  firm: Firm | null;
  setFirm: (id: string | null) => void;
};

type NavItem = { key: View; label: string; icon: typeof Mountain; show: boolean };

export function navFor(mods: Modules, can: (a: AreaKey) => Level, perms: Perms): NavItem[] {
  const v = (a: AreaKey) => can(a) !== "none";
  return [
    { key: "overview", label: "Overview", icon: LayoutDashboard, show: true },
    { key: "mines", label: mods.quarry ? "Mines" : "Blocks", icon: Mountain, show: (mods.quarry && v("quarry")) || ((mods.buyBlocks || mods.imports) && v("blocks")) },
    { key: "unit", label: "Processing unit", icon: Factory, show: mods.processing && (v("blocks") || v("processing")) },
    { key: "stores", label: "Stores", icon: Package, show: mods.stores && v("stores") },
    { key: "depot", label: "Slab stock", icon: Warehouse, show: (mods.depot || mods.trading || mods.processing || mods.imports) && (v("stock") || v("sales")) },
    { key: "sales", label: "Sales and invoices", icon: ReceiptText, show: v("sales") },
    { key: "trade", label: "Import and export", icon: Ship, show: (mods.imports || mods.exports) && v("trade") },
    { key: "parties", label: "Customers and suppliers", icon: Users, show: v("parties") },
    { key: "trace", label: "Trace a block", icon: Route, show: v("blocks") || v("stock") || v("processing") || v("sales") },
    { key: "tally", label: "Tally", icon: BookOpenCheck, show: v("tally") },
    { key: "team", label: "Team", icon: UserCog, show: perms.team },
    { key: "settings", label: "Settings", icon: Settings, show: v("settings") },
    { key: "help", label: "How to use", icon: LifeBuoy, show: true },
  ];
}

export default function StoneApp({ mode, initialView, initialSub }: { mode: StoneMode; initialView?: View; initialSub?: string }) {
  const store = useStone(mode);
  const { db, update, reset, replace, saveError, saving, status, me, perms, notice, say, signOut, reload } = store;
  const [view, setView] = useState<View>(initialView ?? "overview");
  const [sub, setSub] = useState(initialSub ?? "");

  useEffect(() => {
    if (initialView) return;
    const p = new URLSearchParams(window.location.search);
    const v = p.get("v") as View | null;
    if (v) setView(v);
    setSub(p.get("t") ?? "");
  }, [initialView]);

  const base = mode === "demo" ? "/stone/demo" : "/stone";
  const go = (v: View, t = "") => {
    setView(v);
    setSub(t);
    const p = new URLSearchParams();
    if (v !== "overview") p.set("v", v);
    if (t) p.set("t", t);
    const qs = p.toString();
    window.history.replaceState(null, "", `${base}${qs ? `?${qs}` : ""}`);
    window.scrollTo({ top: 0 });
  };

  const firmKey = `k360-firm-${me?.orgId ?? mode}`;
  const [firmId, setFirmId] = useState<string | null>(null);
  useEffect(() => { try { setFirmId(localStorage.getItem(firmKey) || null); } catch {} }, [firmKey]);
  const firms = firmsOf(db?.settings);
  const firm = firms.length > 1 ? firms.find((f) => f.id === firmId) ?? null : null;
  const setFirm = (id: string | null) => { setFirmId(id); try { if (id) localStorage.setItem(firmKey, id); else localStorage.removeItem(firmKey); } catch {} };
  const vdb = useMemo(() => (db ? scope(db, firm?.id ?? null) : db), [db, firm?.id]);
  const mods = useMemo(() => modulesOf(vdb?.settings), [vdb?.settings]);
  const can = (a: AreaKey) => level(perms, a);
  const nav = navFor(mods, can, perms).filter((n) => n.show);
  const canFirms = (mode === "demo" || !!me?.isOwner) && can("settings") === "edit";

  if (status === "signedout") return <Auth onDone={reload} />;
  if (status === "error") {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <div><div className="text-lg font-semibold">Could not load your workspace</div><p className="mt-2 text-ink-2">Check the internet connection and try again.</p><button className="btn btn-primary mt-5" onClick={reload}>Try again</button></div>
      </div>
    );
  }
  if (!db || status === "loading") {
    return <div className="grid min-h-screen place-items-center text-ink-3">Loading your stone workspace…</div>;
  }

  const fUpdate = (fn: (d: StoneDB) => void) => update((d) => {
    if (!firm) { fn(d); return; }
    const before = { ...d, blocks: [...d.blocks], lots: [...d.lots], sales: [...d.sales], mineCosts: [...d.mineCosts], jobs: [...d.jobs], shipments: [...d.shipments], damages: [...d.damages] };
    fn(d);
    tagNew(before, d, firm.id);
  });
  const ctx: Ctx = { db: vdb!, update: fUpdate, go, sub, reset, replace, mode, me, perms, can, edit: (a) => can(a) === "edit", costs: perms.costs, mods, say, root: db, firms, firm, setFirm };
  const allowed = view === "scan" || nav.some((n) => n.key === view);
  const shown: View = allowed ? view : "overview";
  const current = nav.find((n) => n.key === shown);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      <aside className="no-print sticky top-0 z-30 border-b border-surface-2 bg-ground/95 backdrop-blur lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r lg:bg-surface/60">
        <div className="flex items-center gap-3 px-4 py-3 lg:px-5 lg:pt-5">
          <Logo />
          <div className="ml-auto flex items-center gap-2 lg:hidden">
            <ThemeToggle />
            {mode === "cloud" && <button onClick={signOut} className="btn btn-quiet btn-sm" aria-label="Sign out"><LogOut size={14} /></button>}
          </div>
        </div>
        <div className="hidden px-5 pb-2 pt-3 lg:block">
          <div className="text-[0.78rem] font-medium uppercase tracking-wide text-ink-3">Natural stones</div>
          <div className="mt-1 font-semibold leading-tight">{firm ? firm.name : db.settings.company || me?.orgName}</div>
          <div className="text-sm text-ink-2">{firm ? kindLabel(firm.kind) : firms.length > 1 ? `Group · ${firms.length} firms` : db.settings.city}</div>
        </div>
        {firms.length > 1 ? (
          <div className="px-4 pb-2 pt-1 lg:px-5">
            <label className="relative block">
              <span className="mb-1 hidden text-[0.75rem] font-medium text-ink-3 lg:block">Working in</span>
              <span className="relative block">
                <Building2 size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                <select className="field !pl-9 text-[0.9rem] font-medium" value={firm?.id ?? ""} onChange={(e) => { setFirm(e.target.value || null); go("overview"); }}>
                  <option value="">All firms · group view</option>
                  {firms.map((f) => <option key={f.id} value={f.id}>{f.name} · {kindLabel(f.kind)}</option>)}
                </select>
              </span>
            </label>
          </div>
        ) : canFirms && (
          <div className="hidden px-5 pb-1 lg:block">
            <button onClick={() => go("settings", "firms")} className="inline-flex items-center gap-1.5 text-[0.82rem] font-medium text-accent hover:underline"><Building2 size={14} />Add another firm</button>
          </div>
        )}
        <nav className="scroll-thin flex gap-1 overflow-x-auto px-3 pb-3 lg:mt-2 lg:flex-col lg:overflow-visible lg:px-3" aria-label="Sections">
          {nav.map((n) => {
            const on = n.key === shown;
            const I = n.icon;
            return (
              <button key={n.key} onClick={() => go(n.key)} aria-current={on ? "page" : undefined}
                className={`focusable flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[0.92rem] transition-colors lg:py-2.5 ${on ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"}`}>
                <I size={17} strokeWidth={1.9} className="shrink-0" />
                <span className="whitespace-nowrap font-medium">{n.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="hidden space-y-3 px-5 pb-5 pt-6 text-[0.8rem] text-ink-3 lg:block">
          {mode === "cloud" && me && (
            <div className="rounded-xl bg-surface-2/60 px-3 py-2.5">
              <div className="font-medium text-ink">{me.name}</div>
              <div>{roleLabel(me.role)} · {me.login}</div>
              <button onClick={signOut} className="mt-1.5 inline-flex items-center gap-1.5 text-ink-2 hover:text-ink"><LogOut size={13} />Sign out</button>
            </div>
          )}
          <div className="flex items-center gap-2"><ThemeToggle /><Link href="/" className="hover:text-ink">All industries</Link></div>
        </div>
      </aside>

      <main className="min-w-0 px-4 pb-24 pt-5 sm:px-6 lg:px-10 lg:pt-8">
        {mode === "demo" && (
          <div className="no-print mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-accent-soft px-4 py-3 text-[0.9rem]">
            <span><b>Demo company.</b> Sample data, saved only in this browser.</span>
            <Link href="/stone?signup=1" className="font-medium text-accent underline-offset-4 hover:underline">Create your company account</Link>
            <Link href="/stone" className="text-ink-2 underline-offset-4 hover:underline">Sign in</Link>
          </div>
        )}
        {shown !== "overview" && shown !== "scan" && current && (
          <div className="no-print mb-6 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-[1.75rem] font-semibold tracking-tight sm:text-[2rem]">{current.label}</h1>
            {saving && <span className="text-sm text-ink-3">Saving…</span>}
          </div>
        )}
        {saveError && mode === "demo" && <div className="no-print mb-4 rounded-full bg-neg-soft px-3 py-1 text-sm text-neg">Browser storage is full. Remove photos or export a backup.</div>}
        {shown === "overview" && <Overview ctx={ctx} />}
        {shown === "mines" && <Mines ctx={ctx} />}
        {shown === "unit" && <Unit ctx={ctx} />}
        {shown === "stores" && <StoresView ctx={ctx} />}
        {shown === "depot" && <Depot ctx={ctx} page="stock" />}
        {shown === "sales" && <Depot ctx={ctx} page="sales" key="sales" />}
        {shown === "trade" && <Trade ctx={ctx} />}
        {shown === "parties" && <Parties ctx={ctx} />}
        {shown === "trace" && <TraceView ctx={ctx} />}
        {shown === "tally" && <TallyView ctx={ctx} />}
        {shown === "team" && <Team ctx={ctx} />}
        {shown === "settings" && <SettingsView ctx={ctx} />}
        {shown === "help" && <Help ctx={ctx} />}
        {shown === "scan" && <Scan ctx={ctx} blockId={sub} />}
      </main>

      {notice && (
        <div role="status" className={`no-print fixed inset-x-0 bottom-5 z-50 mx-auto w-fit max-w-[92vw] rounded-full px-4 py-2.5 text-sm shadow-lg ${notice.tone === "neg" ? "bg-neg text-white" : notice.tone === "good" ? "bg-accent text-accent-ink" : "bg-ink text-ground"}`}>
          {notice.text}
        </div>
      )}
    </div>
  );
}

export const blocksOn = hasBlocks;
