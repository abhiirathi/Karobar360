"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BookOpenCheck, Boxes, Building2, Check, ChevronDown, ChevronsUpDown, Globe, LifeBuoy, Factory, ReceiptText, LayoutDashboard, LogOut, Mountain, Package, Settings, ShoppingCart, UserCog, Users } from "lucide-react";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { useStone, type StoneMode } from "@/lib/stone/store";
import { level, roleLabel, type AreaKey, type Level, type Me, type Perms } from "@/lib/stone/perm";
import { hasBlocks, modulesOf } from "@/lib/stone/modules";
import type { Firm, Modules, PartyKind, StoneDB } from "@/lib/stone/types";
import { firmsOf, kindLabel, scope, tagNew } from "@/lib/stone/firms";
import Overview from "./Overview";
import Inventory from "./Inventory";
import Unit from "./Unit";
import Depot from "./Depot";
import StoresView from "./Stores";
import Purchases from "./Purchases";
import Parties from "./Parties";
import SettingsView from "./SettingsView";
import Team from "./Team";
import TallyView from "./TallyView";
import Scan from "./Scan";
import Auth from "./Auth";
import Help from "./Help";
import Services from "./Services";

export type View = "overview" | "inventory" | "unit" | "stores" | "purchases" | "sales" | "parties" | "tally" | "team" | "settings" | "services" | "help" | "scan";

/** Sections that were merged into others; old links still land in the right place. */
const MOVED: Record<string, [View, string]> = { mines: ["inventory", "blocks"], depot: ["inventory", "slabs"], trade: ["purchases", "import"], trace: ["inventory", "blocks"] };
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

export type NavChild = { sub: string; label: string; show: boolean };
type NavItem = { key: View; label: string; icon: typeof Mountain; show: boolean; children?: NavChild[] };

/** Masters each kind of business keeps. A quarry keeps its own mines; buyers keep suppliers and qualities. */
export function masterKinds(mods: Modules): NavChild[] {
  const buys = mods.buyBlocks || mods.imports || mods.processing || mods.trading || mods.depot;
  return [
    { sub: "customer", label: "Customers", show: true },
    { sub: "supplier", label: "Suppliers", show: buys },
    { sub: "vendor", label: "Vendors", show: true },
    { sub: "transporter", label: "Transporters", show: true },
    { sub: "quality", label: "Quality", show: buys },
    { sub: "mine", label: "Mines", show: mods.quarry },
  ];
}

export function navFor(mods: Modules, can: (a: AreaKey) => Level, perms: Perms): NavItem[] {
  const v = (a: AreaKey) => can(a) !== "none";
  const blocksOn = (hasBlocks(mods) && (v("blocks") || v("processing"))) || (mods.quarry && v("quarry"));
  const slabsOn = (mods.depot || mods.trading || mods.processing || mods.imports) && (v("stock") || v("processing") || v("sales"));
  const buyOn = ((mods.buyBlocks || mods.imports || mods.processing) && v("blocks")) || ((mods.trading || mods.depot) && v("stock"));
  return [
    { key: "overview", label: "Overview", icon: LayoutDashboard, show: true },
    { key: "inventory", label: "Inventory", icon: Boxes, show: blocksOn || slabsOn, children: [{ sub: "blocks", label: "Blocks", show: blocksOn }, { sub: "slabs", label: "Slabs", show: slabsOn }] },
    { key: "unit", label: "Manufacturing unit", icon: Factory, show: mods.processing && (v("blocks") || v("processing")) },
    { key: "stores", label: "Stores", icon: Package, show: mods.stores && v("stores") },
    { key: "purchases", label: "Purchases", icon: ShoppingCart, show: buyOn },
    { key: "sales", label: "Sales", icon: ReceiptText, show: v("sales") },
    { key: "parties", label: "Masters", icon: Users, show: v("parties"), children: masterKinds(mods) },
    { key: "tally", label: "Tally", icon: BookOpenCheck, show: v("tally") },
    { key: "team", label: "Team", icon: UserCog, show: perms.team },
    { key: "settings", label: "Settings", icon: Settings, show: v("settings") },
    { key: "services", label: "Website and services", icon: Globe, show: perms.team || can("settings") === "edit" },
    { key: "help", label: "How to use", icon: LifeBuoy, show: true },
  ];
}

export default function StoneApp({ mode, initialView, initialSub }: { mode: StoneMode; initialView?: View; initialSub?: string }) {
  const store = useStone(mode);
  const { db, update, reset, replace, saveError, saving, status, me, perms, notice, say, signOut, reload } = store;
  const [view, setView] = useState<View>(MOVED[initialView ?? ""]?.[0] ?? initialView ?? "overview");
  const [sub, setSub] = useState(MOVED[initialView ?? ""]?.[1] ?? initialSub ?? "");
  const [openNav, setOpenNav] = useState<Set<View>>(new Set());

  useEffect(() => {
    if (initialView) return;
    const p = new URLSearchParams(window.location.search);
    const v = p.get("v");
    if (v && MOVED[v]) { setView(MOVED[v][0]); setSub(MOVED[v][1]); return; }
    if (v) setView(v as View);
    setSub(p.get("t") ?? "");
  }, [initialView]);

  const base = mode === "demo" ? "/stone/demo" : "/stone";
  // Bumped on every navigation so a sidebar click leaves an open full-page form
  const [navN, setNavN] = useState(0);
  const go = (v: View, t = "") => {
    setNavN((n) => n + 1);
    setOpenNav((o) => (o.has(v) ? o : new Set([...o, v])));
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
  const kids = (n: NavItem) => (n.children ?? []).filter((c) => c.show);
  // A section with sub-items shows the one asked for, else its first; inner tabs (Extraction costs) belong to Blocks.
  const child = current?.children ? kids(current).find((c) => c.sub === sub) ?? (current.key === "inventory" && ["costs", "pertonne"].includes(sub) ? kids(current).find((c) => c.sub === "blocks") : undefined) ?? kids(current)[0] : undefined;
  const childSub = child?.sub ?? "";

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
        {firms.length > 1 ? (
          <div className="px-3 pb-2 pt-1 lg:px-3 lg:pt-3">
            <FirmSwitcher firms={firms} firm={firm} onPick={(id) => { setFirm(id); go("overview"); }} />
          </div>
        ) : (
          <div className="hidden px-5 pb-2 pt-3 lg:block">
            <div className="font-semibold leading-tight">{db.settings.company || me?.orgName}</div>
            <div className="text-sm text-ink-3">{db.settings.city || "Natural stones"}</div>
            {canFirms && <button onClick={() => go("settings", "firms")} className="mt-2 inline-flex items-center gap-1.5 text-[0.82rem] font-medium text-accent hover:underline"><Building2 size={14} />Add another firm</button>}
          </div>
        )}
        <nav className="scroll-thin flex gap-1 overflow-x-auto px-3 pb-3 lg:mt-2 lg:flex-col lg:overflow-visible lg:px-3" aria-label="Sections">
          {nav.map((n) => {
            const on = n.key === shown;
            const I = n.icon;
            const cs = kids(n);
            if (n.children) {
              const expanded = openNav.has(n.key) || on;
              return (
                <div key={n.key} className="flex shrink-0 gap-1 lg:flex-col">
                  <button onClick={() => { if (!on) go(n.key, cs[0]?.sub ?? ""); else setOpenNav((o) => { const x = new Set(o); if (expanded) x.delete(n.key); else x.add(n.key); return x; }); }} aria-expanded={expanded}
                    className={`focusable flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[0.92rem] transition-colors lg:py-2.5 ${on ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"}`}>
                    <I size={17} strokeWidth={1.9} className="shrink-0" />
                    <span className="whitespace-nowrap font-medium">{n.label}</span>
                    <ChevronDown size={15} className={`ml-auto shrink-0 text-ink-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
                  </button>
                  {expanded && cs.map((c) => {
                    const cOn = on && c.sub === childSub;
                    return (
                      <button key={c.sub} onClick={() => go(n.key, c.sub)} aria-current={cOn ? "page" : undefined}
                        className={`focusable flex shrink-0 items-center rounded-xl px-3 py-2 text-left text-[0.88rem] transition-colors lg:ml-6 ${cOn ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"}`}>
                        <span className="whitespace-nowrap font-medium">{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              );
            }
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
          <div className="flex items-center gap-3"><ThemeToggle />{nav.some((n) => n.key === "services") ? <button onClick={() => go("services", "contact")} className="hover:text-ink">Contact us</button> : <Link href="/contact" className="hover:text-ink">Contact us</Link>}<Link href="/" className="hover:text-ink">All industries</Link></div>
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
            <h1 className="text-[1.75rem] font-semibold tracking-tight sm:text-[2rem]">{child ? <><span className="text-ink-3">{current.label} · </span>{child.label}</> : current.label}</h1>
            {saving && <span className="text-sm text-ink-3">Saving…</span>}
          </div>
        )}
        {saveError && mode === "demo" && <div className="no-print mb-4 rounded-full bg-neg-soft px-3 py-1 text-sm text-neg">Browser storage is full. Remove photos or export a backup.</div>}
        {shown === "overview" && <Overview ctx={ctx} />}
        {shown === "inventory" && <Inventory ctx={ctx} page={childSub === "slabs" ? "slabs" : "blocks"} key={sub || childSub} />}
        {shown === "unit" && <Unit ctx={ctx} />}
        {shown === "stores" && <StoresView ctx={ctx} />}
        {shown === "purchases" && <Purchases ctx={ctx} key={navN} />}
        {shown === "sales" && <Depot ctx={ctx} key={navN} />}
        {shown === "parties" && <Parties ctx={ctx} kind={(childSub || "customer") as PartyKind} key={childSub} />}
        {shown === "tally" && <TallyView ctx={ctx} />}
        {shown === "team" && <Team ctx={ctx} />}
        {shown === "settings" && <SettingsView ctx={ctx} />}
        {shown === "help" && <Help ctx={ctx} />}
        {shown === "services" && <Services ctx={ctx} />}
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

/** One control for the firm: shows where you are working, opens a short list to switch. */
function FirmSwitcher({ firms, firm, onPick }: { firms: Firm[]; firm: Firm | null; onPick: (id: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [open]);
  const items: { id: string | null; name: string; sub: string }[] = [{ id: null, name: "All firms", sub: `Group view · ${firms.length} firms` }, ...firms.map((f) => ({ id: f.id, name: f.name, sub: kindLabel(f.kind) }))];
  const cur = items.find((x) => x.id === (firm?.id ?? null)) ?? items[0];
  return (
    <div ref={box} className="relative">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="focusable flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-2"><Building2 size={17} /></span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 block font-semibold leading-tight">{cur.name}</span>
          <span className="block truncate text-[0.8rem] text-ink-3">{cur.sub}</span>
        </span>
        <ChevronsUpDown size={15} className="shrink-0 text-ink-3" />
      </button>
      {open && (
        <ul role="listbox" aria-label="Switch firm" className="absolute inset-x-0 z-50 mt-1 overflow-hidden rounded-2xl border border-surface-2 bg-ground p-1 shadow-xl">
          {items.map((x) => {
            const on = x.id === cur.id;
            return (
              <li key={x.id ?? "all"} role="option" aria-selected={on}>
                <button type="button" onClick={() => { setOpen(false); if (!on) onPick(x.id); }}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors ${on ? "bg-accent-soft" : "hover:bg-surface-2"}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.9rem] font-medium leading-snug">{x.name}</span>
                    <span className="block truncate text-[0.78rem] text-ink-3">{x.sub}</span>
                  </span>
                  {on && <Check size={15} className="shrink-0 text-accent" />}
                </button>
                {x.id === null && <div className="mx-3 my-1 border-t border-surface-2" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
