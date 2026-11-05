"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, KeyRound, Plus, RefreshCw } from "lucide-react";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import { AREAS, ROLES, clampPerms, level, roleLabel, type AreaKey, type Level, type Me, type Perms } from "@/lib/stone/perm";
import { hasBlocks, jobOnly } from "@/lib/stone/modules";
import type { Modules } from "@/lib/stone/types";
import type { Ctx } from "./StoneApp";
import { Drawer, F, Grid, Note, TextIn } from "./ui";

/** Areas that make sense for this business. */
export function areasFor(m: Modules) {
  const on: Record<AreaKey, boolean> = {
    quarry: m.quarry, blocks: hasBlocks(m), processing: m.processing, jobwork: !!m.jobwork, stores: m.stores, stock: (m.depot || m.trading || m.processing || m.imports) && !jobOnly(m),
    sales: true, trade: m.imports || m.exports, parties: true, tally: true, settings: true, labour: m.processing || m.quarry || m.stores,
  };
  return AREAS.filter((a) => on[a.key]);
}

const genPass = () => {
  const w = ["patthar", "marble", "khadan", "slab", "makrana", "kishan", "gangsaw", "granite"];
  return `${w[Math.floor(Math.random() * w.length)]}${Math.floor(1000 + Math.random() * 9000)}`;
};

const LEVELS: { key: Level; label: string }[] = [{ key: "none", label: "Hidden" }, { key: "view", label: "View" }, { key: "edit", label: "Edit" }];

/** One plain line instead of a row of badges. */
function accessLine(p: Perms, areas: { key: AreaKey; label: string }[]) {
  const edit = areas.filter((a) => level(p, a.key) === "edit").map((a) => a.label);
  const view = areas.filter((a) => level(p, a.key) === "view").map((a) => a.label);
  const parts = [edit.length ? `Edits ${edit.join(", ")}` : "", view.length ? `Views ${view.join(", ")}` : ""].filter(Boolean);
  return parts.length ? parts.join(" · ") : "No sections yet";
}

// The demo has no real logins; people added here live only in this browser.
const DEMO_KEY = "k360-demo-team";
const demoSeed = (owner: string): Me[] => {
  const mk = (id: string, name: string, login: string, role: string, extra: Partial<Me> = {}): Me => ({ id, orgId: "demo", orgName: "", name, login, role, perms: structuredClone(ROLES.find((r) => r.key === role)?.perms ?? ROLES[0].perms), isOwner: false, active: true, lastLogin: new Date(Date.now() - 86400000).toISOString(), ...extra });
  return [
    { ...mk("d0", owner, "98290 11111", "owner"), isOwner: true, perms: ROLES[0].perms },
    mk("d1", "Sunita Jain", "98290 22222", "accountant"),
    mk("d2", "Imran Khan", "98290 33333", "sales"),
    mk("d3", "Ramesh Gurjar", "98290 44444", "gate", { lastLogin: null }),
    mk("d4", "Kalu Ram", "98290 55555", "yard", { active: false }),
  ];
};

export default function Team({ ctx }: { ctx: Ctx }) {
  const demo = ctx.mode === "demo";
  const [users, setUsers] = useState<Me[] | null>(null);
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState<Me | "new" | null>(null);
  const [shared, setShared] = useState<{ name: string; login: string; password: string } | null>(null);
  const [roles, setRoles] = useState(false);
  const areas = useMemo(() => areasFor(ctx.mods), [ctx.mods]);

  const load = useCallback(async () => {
    if (demo) {
      try { const s = localStorage.getItem(DEMO_KEY); setUsers(s ? JSON.parse(s) : demoSeed("You (owner)")); } catch { setUsers(demoSeed("You (owner)")); }
      return;
    }
    const r = await fetch("/api/team", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.ok) setUsers(j.users); else setErr(j.error ?? "Could not load the team.");
  }, [demo]);
  useEffect(() => { load(); }, [load]);

  const saveDemo = (list: Me[]) => { setUsers(list); try { localStorage.setItem(DEMO_KEY, JSON.stringify(list)); } catch {} };
  const appUrl = typeof window !== "undefined" ? `${window.location.origin}/stone` : "/stone";
  const people = users ?? [];
  const activeCount = people.filter((u) => u.active).length;

  return (
    <div className="max-w-[880px]">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[260px] flex-1">
          <p className="text-ink-2">Each person signs in with their own mobile number and sees only the sections you allow.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEdit("new")}><Plus size={16} />Add person</button>
      </div>
      {demo && <div className="mt-4"><Note>Demo: add or change people to try it. No real login is created.</Note></div>}
      {err && <div className="mt-4"><Note tone="neg">{err}</Note></div>}
      {!users && !err && <div className="mt-6 text-ink-3">Loading…</div>}

      {users && (
        <>
          <div className="mt-6 mb-2 text-[0.82rem] text-ink-3">{people.length} {people.length === 1 ? "person" : "people"} · {activeCount} active</div>
          <ul className="divide-y divide-surface-2 overflow-hidden rounded-2xl bg-surface">
            {people.map((u) => (
              <li key={u.id}>
                <button className="focusable flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-surface-2/60" onClick={() => setEdit(u)}>
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-semibold ${u.active ? "bg-accent-soft text-accent" : "bg-surface-2 text-ink-3"}`}>{u.name.slice(0, 1).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium">{u.name}</span>
                      {u.id === ctx.me?.id && <span className="text-[0.82rem] text-ink-3">you</span>}
                      <span className="text-[0.86rem] text-ink-2">{u.isOwner ? "Owner" : roleLabel(u.role)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[0.82rem] text-ink-3">{u.isOwner ? "Full access to everything" : accessLine(u.perms, areas)}</span>
                  </span>
                  <span className="hidden shrink-0 text-right text-[0.8rem] sm:block">
                    {!u.active ? <span className="font-medium text-neg">Switched off</span> : <span className="text-ink-3">{u.lastLogin ? `Last in ${new Date(u.lastLogin).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "Not signed in yet"}</span>}
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-ink-3" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-8">
        <button className="inline-flex items-center gap-1.5 text-[0.9rem] font-medium text-accent hover:underline" onClick={() => setRoles((r) => !r)} aria-expanded={roles}>
          <ChevronDown size={15} className={`transition-transform ${roles ? "rotate-180" : ""}`} />What each role can do
        </button>
        {roles && (
          <div className="scroll-thin mt-3 overflow-x-auto rounded-2xl bg-surface">
            <table className="w-full min-w-[640px] text-left text-[0.86rem]">
              <thead><tr className="text-[0.78rem] text-ink-3"><th className="px-4 py-2.5 font-medium">Role</th><th className="px-3 py-2.5 font-medium">Can edit</th><th className="px-3 py-2.5 font-medium">Can only view</th></tr></thead>
              <tbody>
                {ROLES.filter((r) => r.key !== "custom").map((r) => (
                  <tr key={r.key} className="border-t border-surface-2 align-top">
                    <td className="px-4 py-2.5"><div className="font-medium">{r.label}</div><div className="text-[0.78rem] text-ink-3">{r.blurb}</div></td>
                    <td className="px-3 py-2.5 text-ink-2">{areas.filter((a) => level(r.perms, a.key) === "edit").map((a) => a.label).join(", ") || "—"}</td>
                    <td className="px-3 py-2.5 text-ink-2">{areas.filter((a) => level(r.perms, a.key) === "view").map((a) => a.label).join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {edit && (
        <PersonForm ctx={ctx} person={edit === "new" ? null : edit} areas={areas} demo={demo}
          onClose={() => setEdit(null)}
          onDemoSave={(u, remove) => saveDemo(remove ? people.filter((x) => x.id !== u.id) : people.some((x) => x.id === u.id) ? people.map((x) => (x.id === u.id ? u : x)) : [...people, u])}
          onSaved={(u, pw) => { setEdit(null); load(); if (pw) setShared({ name: u.name, login: u.login, password: pw }); }}
          onRemoved={() => { setEdit(null); load(); }} />
      )}

      {shared && (
        <Drawer open title={`Login for ${shared.name}`} sub="Share this once. They can sign in from any phone." onClose={() => setShared(null)}
          footer={<><a className="btn btn-primary" target="_blank" rel="noreferrer" href={`https://wa.me/${/^\d{10}$/.test(shared.login.replace(/\s/g, "")) ? `91${shared.login.replace(/\s/g, "")}` : ""}?text=${encodeURIComponent(`Karobar360 login for ${ctx.db.settings.company}\nOpen: ${appUrl}\nMobile: ${shared.login}\nPassword: ${shared.password}`)}`}><WhatsAppIcon size={15} />Send on WhatsApp</a><button className="btn btn-quiet" onClick={() => setShared(null)}>Done</button></>}>
          <div className="rounded-2xl bg-surface p-4 text-[0.95rem]">
            <div className="text-ink-3">Open</div><div className="font-medium">{appUrl}</div>
            <div className="mt-3 text-ink-3">Mobile / username</div><div className="num font-medium">{shared.login}</div>
            <div className="mt-3 text-ink-3">Password</div><div className="num font-medium">{shared.password}</div>
          </div>
          <div className="mt-3"><Note>{demo ? "Demo only: this login does not work. In your company account it does." : "The password is not shown again. If it is lost, set a new one from this page."}</Note></div>
        </Drawer>
      )}
    </div>
  );
}

function PersonForm({ ctx, person, areas, demo, onClose, onSaved, onRemoved, onDemoSave }: {
  ctx: Ctx; person: Me | null; areas: { key: AreaKey; label: string; hint: string }[]; demo: boolean;
  onClose: () => void; onSaved: (u: Me, password: string | null) => void; onRemoved: () => void; onDemoSave: (u: Me, remove?: boolean) => void;
}) {
  const isOwnerRow = !!person?.isOwner;
  const [name, setName] = useState(person?.name ?? "");
  const [login, setLogin] = useState(person?.login ?? "");
  const [password, setPassword] = useState(person ? "" : genPass());
  const [role, setRole] = useState(person?.role ?? "sales");
  const [perms, setPerms] = useState<Perms>(() => person && !person.isOwner ? { areas: { ...(person.perms?.areas ?? {}) }, costs: !!person.perms?.costs, team: !!person.perms?.team } : structuredClone(ROLES.find((r) => r.key === "sales")!.perms));
  const [active, setActive] = useState(person?.active ?? true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const mine = ctx.perms;
  const ownerActor = demo || !!ctx.me?.isOwner;
  const limited = clampPerms(mine, ownerActor, perms);
  const rank = { none: 0, view: 1, edit: 2 } as const;

  const pickRole = (k: string) => {
    setRole(k);
    const r = ROLES.find((x) => x.key === k);
    if (r && k !== "custom") setPerms(structuredClone(r.perms));
  };
  const setArea = (a: AreaKey, l: Level) => { setRole("custom"); setPerms({ ...perms, areas: { ...perms.areas, [a]: l } }); };
  const ready = !!name.trim() && !!login.trim() && (!!person || password.length >= 6);

  const save = async () => {
    if (demo) {
      const u: Me = { ...(person ?? { id: `d${Date.now()}`, orgId: "demo", orgName: "", isOwner: false, lastLogin: null }), name, login, role, perms: limited, active } as Me;
      onDemoSave(u);
      onSaved(u, person ? (password || null) : password);
      return;
    }
    setBusy(true);
    setErr("");
    const r = await fetch("/api/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: person?.id, name, login, password: password || null, role, perms: limited, active }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) onSaved(j.user, password || null);
    else setErr(j.error ?? "Could not save.");
  };
  const remove = async () => {
    if (!person) return;
    if (demo) { onDemoSave(person, true); onRemoved(); return; }
    const r = await fetch(`/api/team?id=${person.id}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    if (r.ok) onRemoved(); else setErr(j.error ?? "Could not remove.");
  };

  const Step = ({ n, title, sub }: { n: number; title: string; sub?: string }) => (
    <div className="mb-3 mt-7 flex items-start gap-3 first:mt-1">
      <span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-[0.75rem] font-semibold text-accent-ink">{n}</span>
      <span><span className="block font-semibold">{title}</span>{sub && <span className="block text-[0.84rem] text-ink-2">{sub}</span>}</span>
    </div>
  );

  return (
    <Drawer open wide title={person ? person.name : "Add a person"} sub={isOwnerRow ? "The owner always has full access." : undefined} onClose={onClose}
      footer={<>
        <button className="btn btn-primary" disabled={busy || !ready} onClick={save}>{busy ? "Saving…" : person ? "Save" : "Add and share login"}</button>
        <button className="btn btn-quiet" onClick={onClose}>Cancel</button>
        {err && <span className="text-sm text-neg">{err}</span>}
        {person && !isOwnerRow && person.id !== ctx.me?.id && (confirmDel
          ? <span className="ml-auto flex items-center gap-2 text-sm">Remove {person.name}?<button className="btn btn-quiet btn-sm !text-neg" onClick={remove}>Yes, remove</button><button className="btn btn-quiet btn-sm" onClick={() => setConfirmDel(false)}>No</button></span>
          : <button className="btn btn-quiet btn-sm ml-auto !text-neg" onClick={() => setConfirmDel(true)}>Remove</button>)}
      </>}>
      <Step n={1} title="Who" sub={person ? undefined : "They sign in with this mobile number and password."} />
      <Grid cols={3}>
        <F label="Name"><TextIn value={name} onChange={setName} placeholder="Ramesh Gurjar" /></F>
        <F label="Mobile or username"><TextIn value={login} onChange={setLogin} placeholder="98290 12345" /></F>
        <F label={person ? "New password" : "Password"} hint={person ? "Leave empty to keep it" : "Made for you; change it if you like"}>
          <div className="flex gap-1.5"><TextIn value={password} onChange={setPassword} /><button type="button" className="btn btn-quiet btn-sm !px-2.5" title="Make a new password" onClick={() => setPassword(genPass())}>{person ? <KeyRound size={14} /> : <RefreshCw size={14} />}</button></div>
        </F>
      </Grid>

      {!isOwnerRow && (
        <>
          <Step n={2} title="Role" sub="Pick the closest one. It fills in the access below." />
          <div className="grid gap-1.5 sm:grid-cols-2">
            {ROLES.filter((r) => r.key !== "custom").map((r) => (
              <label key={r.key} className={`flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition-colors ${role === r.key ? "bg-accent-soft" : "hover:bg-surface-2"}`}>
                <input type="radio" name="role" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={role === r.key} onChange={() => pickRole(r.key)} />
                <span><span className="block text-[0.92rem] font-medium">{r.label}</span><span className="block text-[0.8rem] text-ink-2">{r.blurb}</span></span>
              </label>
            ))}
          </div>
          {role === "custom" && <p className="mt-2 text-[0.84rem] text-ink-3">Custom: you changed the access below.</p>}

          <Step n={3} title="What they can open" sub="Hidden: not in their menu. View: can look, not change. Edit: can add and change." />
          <ul className="divide-y divide-surface-2 overflow-hidden rounded-2xl bg-surface">
            {areas.map((a) => {
              const cur = level(perms, a.key);
              const max = level(mine, a.key);
              return (
                <li key={a.key} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <div className="min-w-[180px] flex-1"><div className="text-[0.92rem] font-medium">{a.label}</div><div className="text-[0.78rem] text-ink-3">{a.hint}</div></div>
                  <div className="inline-flex rounded-full bg-surface-2 p-0.5 text-[0.84rem]" role="radiogroup" aria-label={a.label}>
                    {LEVELS.map((l) => (
                      <button key={l.key} type="button" role="radio" aria-checked={cur === l.key} disabled={rank[l.key] > rank[max]} onClick={() => setArea(a.key, l.key)}
                        className={`min-w-[64px] rounded-full px-3 py-1 transition-colors disabled:opacity-35 ${cur === l.key ? (l.key === "edit" ? "bg-accent font-medium text-accent-ink" : "bg-surface font-medium shadow-sm") : "text-ink-2"}`}>
                        {l.label}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Toggle on={perms.costs} disabled={!mine.costs} onChange={(v) => { setRole("custom"); setPerms({ ...perms, costs: v }); }} label="Sees costs and margins" hint="Purchase rates, cost per sq ft, profit on invoices" />
            <Toggle on={perms.team} disabled={!ownerActor} onChange={(v) => { setRole("custom"); setPerms({ ...perms, team: v }); }} label="Can add people" hint={ownerActor ? "Within their own access" : "Only the owner can give this"} />
          </div>
          {person && <div className="mt-2"><Toggle on={active} onChange={setActive} label="Login switched on" hint="Switch off to block this person without removing them" /></div>}
        </>
      )}
      {isOwnerRow && <div className="mt-4"><Note>You can change the owner’s name, mobile number and password here.</Note></div>}
    </Drawer>
  );
}

/** A switch whose state reads at a glance: knob left + grey + "Off", or knob right + green + tick + "On". The whole card is the switch. */
function Toggle({ on, onChange, label, hint, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)}
      className={`focusable flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left transition-colors ${on ? "bg-accent-soft ring-1 ring-accent/30" : "bg-surface hover:bg-surface-2"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}>
      <span aria-hidden className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-ink/20"}`}>
        <span className={`absolute left-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-white shadow-sm transition-transform ${on ? "translate-x-5" : "translate-x-0"}`}>
          {on && <Check size={12} strokeWidth={3} className="text-accent" />}
        </span>
      </span>
      <span className="min-w-0 flex-1"><span className="block font-medium">{label}</span>{hint && <span className="block text-[0.8rem] text-ink-3">{hint}</span>}</span>
      <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[0.72rem] font-semibold uppercase tracking-wide ${on ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-3"}`}>{on ? "On" : "Off"}</span>
    </button>
  );
}

export { Toggle };
