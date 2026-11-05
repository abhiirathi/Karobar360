// Server-only access to the Karobar360 database. Every database function checks K360_SECRET,
// so the public key alone cannot read or write anything.
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

// Project URL and publishable key are public by design (Supabase ships them to browsers); access is gated by the secret below.
const URL_ = process.env.K360_SUPABASE_URL || "https://uanjptxexthdhiidnxyv.supabase.co";
const KEY = process.env.K360_SUPABASE_KEY || "sb_publishable_PowF-ZhN153nXh_mi1Vd_A_XLpqBAhz";
// Server-only key, set as the K360_SECRET environment variable on Vercel. Never put it in code.
const SECRET = process.env.K360_SECRET ?? "";
const LOCAL = process.env.K360_LOCAL === "1";

export async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  if (LOCAL) return local(fn, args) as T;
  if (!SECRET) throw new Error("K360_SECRET is not set on the server");
  const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_secret: SECRET, ...args }),
    cache: "no-store",
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`db ${fn} ${r.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : null) as T;
}

// ─── Local stand-in (K360_LOCAL=1) for development without network ───────────

type LUser = { id: string; org_id: string; name: string; login: string; pass: string; role: string; perms: unknown; is_owner: boolean; active: boolean; created_at: string; last_login: string | null; fails: number };
type LDB = {
  orgs: { id: string; name: string; cat_token: string | null; tally_key: string | null }[];
  users: LUser[];
  sessions: { token: string; user_id: string; exp: number }[];
  data: { org_id: string; section: string; data: unknown; version: number; at: string }[];
  files: { id: string; org_id: string; mime: string; data: string }[];
};
const FILE = "/tmp/k360-local.json";
const ld = (): LDB => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : { orgs: [], users: [], sessions: [], data: [], files: [] });
const ls = (d: LDB) => writeFileSync(FILE, JSON.stringify(d));
const hash = (p: string) => { const s = randomBytes(8).toString("hex"); return `${s}:${scryptSync(p, s, 32).toString("hex")}`; };
const ok = (p: string, h: string) => { const [s, v] = h.split(":"); return timingSafeEqual(Buffer.from(v, "hex"), scryptSync(p, s, 32)); };
const uj = (d: LDB, u: LUser) => ({ id: u.id, orgId: u.org_id, name: u.name, login: u.login, role: u.role, perms: u.perms, isOwner: u.is_owner, active: u.active, createdAt: u.created_at, lastLogin: u.last_login, orgName: d.orgs.find((o) => o.id === u.org_id)?.name });
const sess = (d: LDB, u: LUser) => { const t = randomBytes(24).toString("hex"); d.sessions.push({ token: t, user_id: u.id, exp: Date.now() + 30 * 864e5 }); u.last_login = new Date().toISOString(); return t; };

function local(fn: string, a: Record<string, unknown>): unknown {
  const d = ld();
  const s = (k: string) => a[k] as string;
  let out: unknown = null;
  switch (fn) {
    case "k_signup": {
      if (d.users.some((u) => u.login === s("p_login").toLowerCase())) { out = { error: "login_taken" }; break; }
      const o = { id: randomUUID(), name: s("p_org"), cat_token: null, tally_key: null };
      d.orgs.push(o);
      const u: LUser = { id: randomUUID(), org_id: o.id, name: s("p_name"), login: s("p_login").toLowerCase(), pass: hash(s("p_pass")), role: "owner", perms: {}, is_owner: true, active: true, created_at: new Date().toISOString(), last_login: null, fails: 0 };
      d.users.push(u);
      out = { token: sess(d, u), user: uj(d, u) };
      break;
    }
    case "k_login": {
      const u = d.users.find((x) => x.login === s("p_login").toLowerCase());
      if (!u) { out = { error: "bad_login" }; break; }
      if (!u.active) { out = { error: "inactive" }; break; }
      if (!ok(s("p_pass"), u.pass)) { u.fails++; out = { error: u.fails >= 5 ? "locked" : "bad_login" }; break; }
      u.fails = 0;
      out = { token: sess(d, u), user: uj(d, u) };
      break;
    }
    case "k_me": {
      const x = d.sessions.find((t) => t.token === s("p_token") && t.exp > Date.now());
      const u = x && d.users.find((y) => y.id === x.user_id && y.active);
      out = u ? uj(d, u) : null;
      break;
    }
    case "k_logout": d.sessions = d.sessions.filter((t) => t.token !== s("p_token")); break;
    case "k_users_list": out = d.users.filter((u) => u.org_id === s("p_org")).sort((x, y) => Number(y.is_owner) - Number(x.is_owner)).map((u) => uj(d, u)); break;
    case "k_user_save": {
      const login = s("p_login").toLowerCase();
      if (d.users.some((u) => u.login === login && u.id !== a.p_id)) { out = { error: "login_taken" }; break; }
      let u = d.users.find((x) => x.id === a.p_id && x.org_id === s("p_org"));
      if (!a.p_id) {
        if (!a.p_pass || s("p_pass").length < 6) { out = { error: "weak_password" }; break; }
        u = { id: randomUUID(), org_id: s("p_org"), name: s("p_name"), login, pass: hash(s("p_pass")), role: s("p_role"), perms: a.p_perms, is_owner: false, active: a.p_active !== false, created_at: new Date().toISOString(), last_login: null, fails: 0 };
        d.users.push(u);
      } else if (u) {
        u.name = s("p_name"); u.login = login;
        if (!u.is_owner) { u.role = s("p_role"); u.perms = a.p_perms; u.active = a.p_active !== false; }
        if (a.p_pass && s("p_pass").length >= 6) u.pass = hash(s("p_pass"));
        if (a.p_pass || !u.active) d.sessions = d.sessions.filter((t) => t.user_id !== u!.id || u!.id === a.p_by);
      } else { out = { error: "not_found" }; break; }
      out = { user: uj(d, u!) };
      break;
    }
    case "k_user_delete": { const n = d.users.length; d.users = d.users.filter((u) => !(u.id === a.p_id && u.org_id === a.p_org && !u.is_owner)); out = { ok: d.users.length < n }; break; }
    case "k_data_get": {
      const secs = a.p_sections as string[];
      out = Object.fromEntries(d.data.filter((x) => x.org_id === a.p_org && secs.includes(x.section)).map((x) => [x.section, { data: x.data, version: x.version, at: x.at }]));
      break;
    }
    case "k_data_put_many": {
      const items = a.p_items as { section: string; data: unknown; base: number | null }[];
      const cur = (sec: string) => d.data.find((x) => x.org_id === a.p_org && x.section === sec);
      const bad = items.filter((i) => { const c = cur(i.section); return c && i.base != null && i.base !== c.version; });
      if (bad.length) { out = { ok: false, conflict: bad.map((b) => b.section) }; break; }
      const versions: Record<string, number> = {};
      for (const i of items) {
        const c = cur(i.section);
        if (c) { c.data = i.data; c.version++; c.at = new Date().toISOString(); versions[i.section] = c.version; }
        else { d.data.push({ org_id: s("p_org"), section: i.section, data: i.data, version: 1, at: new Date().toISOString() }); versions[i.section] = 1; }
      }
      out = { ok: true, versions };
      break;
    }
    case "k_file_put": { const id = randomUUID(); d.files.push({ id, org_id: s("p_org"), mime: s("p_mime"), data: s("p_data") }); out = id; break; }
    case "k_file_get": { const f = d.files.find((x) => x.id === a.p_id && x.org_id === a.p_org); out = f ? { mime: f.mime, data: f.data } : null; break; }
    case "k_org_keys": {
      const o = d.orgs.find((x) => x.id === a.p_org)!;
      if (a.p_rotate === "cat") o.cat_token = null;
      if (a.p_rotate === "tally") o.tally_key = null;
      o.cat_token ??= randomBytes(9).toString("hex");
      o.tally_key ??= randomBytes(24).toString("hex");
      out = { catToken: o.cat_token, tallyKey: o.tally_key, name: o.name };
      break;
    }
    case "k_org_by": {
      const k = s("p_key");
      const o = d.orgs.find((x) => (a.p_kind === "cat" ? x.cat_token : x.tally_key) === k);
      out = o && k && k.length >= 12 ? { id: o.id, name: o.name } : null;
      break;
    }
    case "k_weigh_put": {
      const k = s("p_key");
      const o = d.orgs.find((x) => x.tally_key === k);
      if (!o || !k || k.length < 12) { out = null; break; }
      const w = ((d as unknown as { weigh?: Record<string, unknown> }).weigh ??= {});
      w[o.id] = { weight: Number(a.p_weight), stable: !!a.p_stable, device: s("p_device"), at: new Date().toISOString() };
      out = { name: o.name };
      break;
    }
    case "k_weigh_get": {
      const r = ((d as unknown as { weigh?: Record<string, { at: string }> }).weigh ?? {})[s("p_org")];
      out = r ? { ...r, age: (Date.now() - new Date(r.at).getTime()) / 1000 } : null;
      break;
    }
    case "k_request_add": {
      const r = { id: randomUUID(), kind: s("p_kind"), name: s("p_name"), company: s("p_company"), phone: s("p_phone"), email: s("p_email"), message: s("p_message"), details: a.p_details, created_at: new Date().toISOString(), emailed: false };
      ((d as unknown as { requests?: unknown[] }).requests ??= []).push(r);
      out = { ok: true, id: r.id };
      break;
    }
    case "k_request_mark": {
      const r = ((d as unknown as { requests?: { id: string; emailed: boolean }[] }).requests ?? []).find((x) => x.id === a.p_id);
      if (r) r.emailed = true;
      out = null;
      break;
    }
    default: throw new Error(`local db: unknown ${fn}`);
  }
  ls(d);
  return out;
}

export const sha = (s: string) => createHash("sha1").update(s).digest("hex");
