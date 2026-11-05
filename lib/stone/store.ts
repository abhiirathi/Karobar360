"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { applyPurge } from "./calc";
import { DEFAULT_SETTINGS, seed } from "./seed";
import { ALL_SECTIONS, permsOf, type Me, type Perms, type Section } from "./perm";
import type { StoneDB } from "./types";

const KEY = "karobar360.stone.v3"; // v3: slabs, firms, exports and Tally figures in the sample company
export type StoneMode = "demo" | "cloud";
export type Status = "loading" | "ready" | "signedout" | "error";

function loadLocal(): StoneDB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const db = JSON.parse(raw) as StoneDB;
      if (db && db.v === 1) {
        if (applyPurge(db)) saveLocal(db);
        return db;
      }
    }
  } catch {}
  return seed();
}

function saveLocal(db: StoneDB) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
    return true;
  } catch {
    return false;
  }
}

const EMPTY = { parties: [], blocks: [], mineCosts: [], jobs: [], lots: [], damages: [], shipments: [], sales: [], stores: { items: [], moves: [] }, tally: undefined };

type Payload = { me: Me; sections: Record<string, { data: unknown; version: number }>; read: Section[]; write: Section[] };

function build(p: Payload): StoneDB {
  const s = p.sections;
  const arr = (k: Section) => (Array.isArray(s[k]?.data) ? (s[k].data as never[]) : []);
  return {
    v: 1,
    settings: { ...DEFAULT_SETTINGS, ownMines: [], ...((s.settings?.data as object) ?? { company: p.me.orgName }) },
    parties: arr("parties"), blocks: arr("blocks"), mineCosts: arr("mineCosts"), jobs: arr("jobs"), lots: arr("lots"),
    damages: arr("damages"), shipments: arr("shipments"), sales: arr("sales"),
    tally: (s.tally?.data as StoneDB["tally"]) ?? undefined,
    tallyCfg: (s.tallyCfg?.data as StoneDB["tallyCfg"]) ?? undefined,
    stores: (s.stores?.data as StoneDB["stores"]) ?? undefined,
  };
}

const sec = (db: StoneDB, k: Section) => (db as unknown as Record<string, unknown>)[k];

export function useStone(mode: StoneMode) {
  const [db, setDb] = useState<StoneDB | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "neg" | "good" | "plain" } | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  const dbRef = useRef<StoneDB | null>(null);
  const versions = useRef<Record<string, number>>({});
  const access = useRef<{ read: Set<Section>; write: Set<Section> }>({ read: new Set(ALL_SECTIONS), write: new Set(ALL_SECTIONS) });
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);

  const set = (next: StoneDB) => { dbRef.current = next; setDb(next); };
  const say = useCallback((text: string, tone: "neg" | "good" | "plain" = "plain") => {
    setNotice({ text, tone });
    window.setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 5000);
  }, []);

  const fetchCloud = useCallback(async (): Promise<StoneDB | null> => {
    const r = await fetch("/api/stone/data", { cache: "no-store" });
    if (r.status === 401) { setStatus("signedout"); setMe(null); return null; }
    if (!r.ok) throw new Error(String(r.status));
    const p = (await r.json()) as Payload;
    versions.current = Object.fromEntries(Object.entries(p.sections).map(([k, v]) => [k, v.version]));
    access.current = { read: new Set(p.read), write: new Set(p.write) };
    setMe(p.me);
    return build(p);
  }, []);

  useEffect(() => {
    if (mode === "demo") {
      set(loadLocal());
      setStatus("ready");
      return;
    }
    let alive = true;
    fetchCloud().then((d) => { if (alive && d) { set(d); setStatus("ready"); } }).catch(() => alive && setStatus("error"));
    const t = window.setInterval(async () => {
      if (document.hidden || pending.current > 0) return;
      try {
        const d = await fetchCloud();
        if (d && pending.current === 0 && JSON.stringify(d) !== JSON.stringify(dbRef.current)) set(d);
      } catch {}
    }, 30000);
    return () => { alive = false; window.clearInterval(t); };
  }, [mode, fetchCloud]);

  const push = useCallback(async (fn: (d: StoneDB) => void, attempt = 0): Promise<void> => {
    const base = dbRef.current;
    if (!base) return;
    const next = structuredClone(base);
    fn(next);
    const W = access.current.write;
    if (W.has("sales") && W.has("lots") && W.has("blocks")) applyPurge(next);
    const changed = ALL_SECTIONS.filter((k) => k !== "tally" && JSON.stringify(sec(base, k)) !== JSON.stringify(sec(next, k)));
    if (!changed.length) return;
    const blocked = changed.filter((k) => !W.has(k));
    if (blocked.length) { say("You can view this but not change it. Ask your owner for edit access.", "neg"); return; }
    set(next);
    const items = changed.map((k) => ({ section: k, data: sec(next, k), base: versions.current[k] ?? null }));
    setSaving(true);
    try {
      const r = await fetch("/api/stone/data", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        Object.assign(versions.current, j.versions ?? {});
        // Swap uploaded photos for their stored file links, unless the section changed again meanwhile.
        if (j.echo && dbRef.current) {
          const cur = structuredClone(dbRef.current) as unknown as Record<string, unknown>;
          let touched = false;
          for (const [k, v] of Object.entries(j.echo as Record<string, unknown>)) {
            if (JSON.stringify(cur[k]) === JSON.stringify(sec(next, k as Section))) { cur[k] = v; touched = true; }
          }
          if (touched) set(cur as unknown as StoneDB);
        }
        setSaveError(false);
        return;
      }
      if (r.status === 409 && attempt < 2) {
        // Someone else saved first: take their version and apply this change again on top of it.
        const fresh = await fetchCloud();
        if (fresh) { set(fresh); return push(fn, attempt + 1); }
      }
      if (r.status === 401) { setStatus("signedout"); return; }
      const fresh = await fetchCloud().catch(() => null);
      if (fresh) set(fresh);
      say(j.error ?? "Could not save. Check the connection and try again.", "neg");
      setSaveError(true);
    } catch {
      say("No connection. Your last change was not saved.", "neg");
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }, [fetchCloud, say]);

  const update = useCallback((fn: (d: StoneDB) => void) => {
    if (mode === "demo") {
      const prev = dbRef.current;
      if (!prev) return;
      const next = structuredClone(prev);
      fn(next);
      applyPurge(next);
      setSaveError(!saveLocal(next));
      set(next);
      return;
    }
    pending.current++;
    queue.current = queue.current.then(() => push(fn)).finally(() => { pending.current--; });
  }, [mode, push]);

  const reset = useCallback((empty = false) => {
    const fresh = seed();
    const cur = dbRef.current;
    if (mode === "demo") {
      const next: StoneDB = empty ? { ...fresh, ...EMPTY, settings: { ...fresh.settings, firms: [] } } : fresh;
      saveLocal(next);
      set(next);
      return;
    }
    // In a company account, keep its own name and settings; replace only the records.
    update((d) => {
      const src = empty ? { ...fresh, ...EMPTY } : fresh;
      d.parties = src.parties; d.blocks = src.blocks; d.mineCosts = src.mineCosts; d.jobs = src.jobs; d.lots = src.lots;
      d.damages = src.damages; d.shipments = src.shipments; d.sales = src.sales; d.stores = src.stores;
      if (!empty && cur) d.settings = { ...fresh.settings, company: cur.settings.company, phone: cur.settings.phone, modules: cur.settings.modules, catalogue: cur.settings.catalogue, dashboard: cur.settings.dashboard };
    });
  }, [mode, update]);

  const replace = useCallback((next: StoneDB) => {
    if (mode === "demo") { saveLocal(next); set(next); return; }
    update((d) => { Object.assign(d, structuredClone(next)); });
  }, [mode, update]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setStatus("signedout");
    setMe(null);
    set(null as unknown as StoneDB);
  }, []);

  const reload = useCallback(async () => {
    setStatus("loading");
    try { const d = await fetchCloud(); if (d) { set(d); setStatus("ready"); } } catch { setStatus("error"); }
  }, [fetchCloud]);

  const perms: Perms = mode === "demo" ? permsOf({ isOwner: true, perms: { areas: {}, costs: true, team: true } }) : permsOf(me);
  return { db, update, reset, replace, saveError, saving, status, me, perms, notice, say, signOut, reload };
}
