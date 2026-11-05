"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { KeyRound, Plus, RefreshCw } from "lucide-react";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import { AREAS, ROLES, clampPerms, level, roleLabel, type AreaKey, type Level, type Me, type Perms } from "@/lib/stone/perm";
import { hasBlocks } from "@/lib/stone/modules";
import type { Modules } from "@/lib/stone/types";
import type { Ctx } from "./StoneApp";
import { Badge, Drawer, F, Grid, Note, TextIn } from "./ui";

/** Areas that make sense for this business. */
export function areasFor(m: Modules) {
  const on: Record<AreaKey, boolean> = {
    quarry: m.quarry, blocks: hasBlocks(m), processing: m.processing, stores: m.stores, stock: m.depot || m.trading || m.processing || m.imports,
    sales: true, trade: m.imports || m.exports, parties: true, tally: true, settings: true,
  };
  return AREAS.filter((a) => on[a.key]);
}

const genPass = () => {
  const w = ["patthar", "marble", "khadan", "slab", "makrana", "kishan", "gangsaw", "granite"];
  return `${w[Math.floor(Math.random() * w.length)]}${Math.floor(1000 + Math.random() * 9000)}`;
};

export default function Team({ ctx }: { ctx: Ctx }) {
  const [users, setUsers] = useState<Me[] | null>(null);
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState<Me | "new" | null>(null);
  const [shared, setShared] = useState<{ name: string; login: string; password: string } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/team", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.ok) setUsers(j.users); else setErr(j.error ?? "Could not load the team.");
  }, []);
  useEffect(() => { if (ctx.mode === "cloud") load(); }, [ctx.mode, load]);

  if (ctx.mode === "demo") {
    return (
      <div className="max-w-[860px]">
        <Note>In your company account, the owner adds each person with a mobile number and password and chooses what they can see and change. The demo has no logins.</Note>
        <h2 className="mt-8 text-lg font-semibold">Ready-made roles</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {ROLES.filter((r) => r.key !== "custom").map((r) => (
            <li key={r.key} className="rounded-2xl bg-surface px-4 py-3">
              <div className="font-medium">{r.label}</div>
              <div className="text-[0.86rem] text-ink-2">{r.blurb}</div>
              <div className="mt-2 flex flex-wrap gap-1">{AREAS.filter((a) => level(r.perms, a.key) !== "none").map((a) => <Badge key={a.key} tone={level(r.perms, a.key) === "edit" ? "good" : "plain"}>{a.label}{level(r.perms, a.key) === "view" ? " · view" : ""}</Badge>)}</div>
            </li>
          ))}
        </ul>
        <Link href="/stone?signup=1" className="btn btn-primary mt-6">Create your company account</Link>
      </div>
    );
  }

  const appUrl = typeof window !== "undefined" ? `${window.location.origin}/stone` : "/stone";

  return (
    <div className="max-w-[980px]">
      <div className="flex flex-wrap items-center gap-3">
        <p className="max-w-[60ch] text-ink-2">Add the people who work with you. Each one signs in with their own mobile number and sees only what you allow.</p>
        <button className="btn btn-primary btn-sm ml-auto" onClick={() => setEdit("new")}><Plus size={15} />Add person</button>
      </div>
      {err && <div className="mt-4"><Note tone="neg">{err}</Note></div>}
      {!users && !err && <div className="mt-6 text-ink-3">Loading…</div>}
      {users && (
        <ul className="mt-5 divide-y divide-surface-2 rounded-2xl bg-surface">
          {users.map((u) => {
            const p = u.isOwner ? null : (u.perms as Perms);
            return (
              <li key={u.id}>
                <button className="focusable flex w-full flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3.5 text-left hover:bg-surface-2/60" onClick={() => setEdit(u)}>
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft font-semibold text-accent">{u.name.slice(0, 1).toUpperCase()}</div>
                  <div className="min-w-[180px] flex-1">
                    <div className="font-medium">{u.name} {u.id === ctx.me?.id && <span className="text-ink-3">(you)</span>}</div>
                    <div className="text-[0.84rem] text-ink-2">{roleLabel(u.role)} · {u.login}</div>
                  </div>
                  <div className="flex max-w-[460px] flex-wrap gap-1">
                    {u.isOwner ? <Badge tone="good">Everything</Badge> : AREAS.filter((a) => level(p!, a.key) !== "none").map((a) => <Badge key={a.key} tone={level(p!, a.key) === "edit" ? "good" : "plain"}>{a.label}{level(p!, a.key) === "view" ? " · view" : ""}</Badge>)}
                    {!u.isOwner && p?.costs && <Badge tone="info">Sees costs</Badge>}
                    {!u.isOwner && p?.team && <Badge tone="info">Manages team</Badge>}
                  </div>
                  <div className="w-full text-right text-[0.8rem] text-ink-3 sm:w-auto">
                    {!u.active ? <Badge tone="neg">Switched off</Badge> : u.lastLogin ? `Last in ${new Date(u.lastLogin).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "Not signed in yet"}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {edit && <PersonForm ctx={ctx} person={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={(u, pw) => { setEdit(null); load(); if (pw) setShared({ name: u.name, login: u.login, password: pw }); }} onRemoved={() => { setEdit(null); load(); }} />}

      {shared && (
        <Drawer open title={`Login for ${shared.name}`} sub="Share this once. They can sign in from any phone." onClose={() => setShared(null)}
          footer={<><a className="btn btn-primary" target="_blank" rel="noreferrer" href={`https://wa.me/${/^\d{10}$/.test(shared.login) ? `91${shared.login}` : ""}?text=${encodeURIComponent(`Karobar360 login for ${ctx.db.settings.company}\nOpen: ${appUrl}\nMobile: ${shared.login}\nPassword: ${shared.password}`)}`}><WhatsAppIcon size={15} />Send on WhatsApp</a><button className="btn btn-quiet" onClick={() => setShared(null)}>Done</button></>}>
          <div className="rounded-2xl bg-surface p-4 text-[0.95rem]">
            <div className="text-ink-3">Open</div><div className="font-medium">{appUrl}</div>
            <div className="mt-3 text-ink-3">Mobile / username</div><div className="num font-medium">{shared.login}</div>
            <div className="mt-3 text-ink-3">Password</div><div className="num font-medium">{shared.password}</div>
          </div>
          <div className="mt-3"><Note>The password is not shown again. If it is lost, set a new one from this page.</Note></div>
        </Drawer>
      )}
    </div>
  );
}

function PersonForm({ ctx, person, onClose, onSaved, onRemoved }: { ctx: Ctx; person: Me | null; onClose: () => void; onSaved: (u: Me, password: string | null) => void; onRemoved: () => void }) {
  const isOwnerRow = !!person?.isOwner;
  const [name, setName] = useState(person?.name ?? "");
  const [login, setLogin] = useState(person?.login ?? "");
  const [password, setPassword] = useState(person ? "" : genPass());
  const [role, setRole] = useState(person?.role ?? "gate");
  const [perms, setPerms] = useState<Perms>(() => person && !person.isOwner ? { areas: { ...(person.perms?.areas ?? {}) }, costs: !!person.perms?.costs, team: !!person.perms?.team } : structuredClone(ROLES.find((r) => r.key === "gate")!.perms));
  const [active, setActive] = useState(person?.active ?? true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const areas = useMemo(() => areasFor(ctx.mods), [ctx.mods]);
  const mine = ctx.perms;
  const ownerActor = !!ctx.me?.isOwner;
  const limited = clampPerms(mine, ownerActor, perms);
  const rank = { none: 0, view: 1, edit: 2 } as const;

  const pickRole = (k: string) => {
    setRole(k);
    const r = ROLES.find((x) => x.key === k);
    if (r && k !== "custom") setPerms(structuredClone(r.perms));
  };
  const setArea = (a: AreaKey, l: Level) => { setRole("custom"); setPerms({ ...perms, areas: { ...perms.areas, [a]: l } }); };

  const save = async () => {
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
    const r = await fetch(`/api/team?id=${person.id}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    if (r.ok) onRemoved(); else setErr(j.error ?? "Could not remove.");
  };

  return (
    <Drawer open wide title={person ? person.name : "Add a person"} sub={isOwnerRow ? "The owner always has full access." : "Choose a role, then adjust what they can see and change."} onClose={onClose}
      footer={<>
        <button className="btn btn-primary" disabled={busy || !name || !login || (!person && password.length < 6)} onClick={save}>{busy ? "Saving…" : person ? "Save" : "Add and share login"}</button>
        <button className="btn btn-quiet" onClick={onClose}>Cancel</button>
        {err && <span className="text-sm text-neg">{err}</span>}
        {person && !isOwnerRow && person.id !== ctx.me?.id && (confirmDel
          ? <span className="ml-auto flex items-center gap-2 text-sm">Remove {person.name}?<button className="btn btn-quiet btn-sm !text-neg" onClick={remove}>Yes, remove</button><button className="btn btn-quiet btn-sm" onClick={() => setConfirmDel(false)}>No</button></span>
          : <button className="btn btn-quiet btn-sm ml-auto !text-neg" onClick={() => setConfirmDel(true)}>Remove</button>)}
      </>}>
      <Grid cols={3}>
        <F label="Name"><TextIn value={name} onChange={setName} placeholder="Ramesh (gate)" /></F>
        <F label="Mobile or username" hint="They sign in with this"><TextIn value={login} onChange={setLogin} placeholder="98290 12345" /></F>
        <F label={person ? "New password" : "Password"} hint={person ? "Leave empty to keep the current one" : "At least 6 characters"}>
          <div className="flex gap-1.5"><TextIn value={password} onChange={setPassword} /><button type="button" className="btn btn-quiet btn-sm !px-2.5" title="Make a new password" onClick={() => setPassword(genPass())}>{person ? <KeyRound size={14} /> : <RefreshCw size={14} />}</button></div>
        </F>
      </Grid>

      {!isOwnerRow && (
        <>
          <div className="mt-6">
            <div className="text-sm font-medium">Role</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {ROLES.map((r) => (
                <button key={r.key} type="button" onClick={() => pickRole(r.key)} className={`focusable rounded-xl border px-3 py-2 text-left transition-colors ${role === r.key ? "border-accent bg-accent-soft" : "border-surface-2 hover:bg-surface-2"}`}>
                  <div className="text-[0.9rem] font-medium">{r.label}</div>
                  <div className="text-[0.78rem] text-ink-2">{r.blurb}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 text-sm font-medium">What they can do</div>
          <ul className="mt-2 divide-y divide-surface-2 rounded-2xl bg-surface">
            {areas.map((a) => {
              const cur = level(perms, a.key);
              const max = level(mine, a.key);
              return (
                <li key={a.key} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <div className="min-w-[200px] flex-1"><div className="font-medium">{a.label}</div><div className="text-[0.8rem] text-ink-3">{a.hint}</div></div>
                  <div className="inline-flex rounded-full bg-surface-2 p-0.5 text-[0.84rem]" role="radiogroup" aria-label={a.label}>
                    {(["none", "view", "edit"] as Level[]).map((l) => (
                      <button key={l} type="button" role="radio" aria-checked={cur === l} disabled={rank[l] > rank[max]} onClick={() => setArea(a.key, l)}
                        className={`rounded-full px-3 py-1 transition-colors disabled:opacity-35 ${cur === l ? "bg-surface font-medium shadow-sm" : "text-ink-2"}`}>
                        {l === "none" ? "No access" : l === "view" ? "View" : "View and change"}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Toggle on={perms.costs} disabled={!mine.costs} onChange={(v) => { setRole("custom"); setPerms({ ...perms, costs: v }); }} label="Sees costs and margins" hint="Purchase rates, cost per sq ft, margin on invoices" />
            <Toggle on={perms.team} disabled={!ownerActor} onChange={(v) => { setRole("custom"); setPerms({ ...perms, team: v }); }} label="Can add people" hint={ownerActor ? "Can manage the team within their own access" : "Only the owner can give this"} />
          </div>
          {person && <div className="mt-4"><Toggle on={active} onChange={setActive} label="Login switched on" hint="Switch off to block this person without deleting them" /></div>}
        </>
      )}
      {isOwnerRow && <div className="mt-4"><Note>You can change the owner’s name, mobile number and password here.</Note></div>}
    </Drawer>
  );
}

function Toggle({ on, onChange, label, hint, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className={`flex items-start gap-3 rounded-xl bg-surface px-4 py-3 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)} className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-surface-3"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface transition-transform ${on ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </button>
      <span><span className="block font-medium">{label}</span>{hint && <span className="block text-[0.8rem] text-ink-3">{hint}</span>}</span>
    </label>
  );
}

export { Toggle };

