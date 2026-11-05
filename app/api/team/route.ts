import { rpc } from "@/lib/server/db";
import { currentUser, json, normLogin, validLogin } from "@/lib/server/auth";
import { clampPerms, permsOf, ROLES, type Me, type Perms } from "@/lib/stone/perm";

export const dynamic = "force-dynamic";

async function gate() {
  const u = await currentUser();
  if (!u) return { err: json({ error: "Sign in again." }, 401) };
  const p = permsOf(u.me);
  if (!p.team) return { err: json({ error: "Only the owner or a manager can manage the team." }, 403) };
  return { u, p };
}

export async function GET() {
  const g = await gate();
  if ("err" in g) return g.err;
  const users = await rpc<Me[]>("k_users_list", { p_org: g.u.me.orgId });
  return json({ users });
}

export async function POST(req: Request) {
  const g = await gate();
  if ("err" in g) return g.err;
  const { u, p } = g;
  const b = await req.json().catch(() => ({}));
  const login = normLogin(b.login);
  const name = String(b.name ?? "").trim().slice(0, 60);
  if (!name) return json({ error: "Enter the person’s name." }, 400);
  if (!validLogin(login)) return json({ error: "Use a 10-digit mobile number or a short username (letters and numbers)." }, 400);
  const pass = b.password ? String(b.password) : null;
  if (!b.id && (!pass || pass.length < 6)) return json({ error: "Set a password of at least 6 characters." }, 400);
  if (pass && pass.length < 6) return json({ error: "Password needs at least 6 characters." }, 400);

  const users = await rpc<Me[]>("k_users_list", { p_org: u.me.orgId });
  const target = b.id ? users.find((x) => x.id === b.id) : null;
  if (b.id && !target) return json({ error: "That person is no longer in your team." }, 404);
  if (target?.isOwner && !u.me.isOwner) return json({ error: "Only the owner can change the owner’s login." }, 403);
  if (target && !u.me.isOwner && target.id !== u.me.id && permsOf(target).team) return json({ error: "Only the owner can change another manager." }, 403);
  if (target && target.id === u.me.id && !u.me.isOwner && b.perms) {
    // Managers cannot raise their own access.
    b.perms = target.perms;
  }

  const role = ROLES.some((r) => r.key === b.role) ? String(b.role) : "custom";
  const perms: Perms = clampPerms(p, u.me.isOwner, (b.perms ?? {}) as Perms);
  const r = await rpc<{ user?: Me; error?: string }>("k_user_save", {
    p_org: u.me.orgId, p_by: u.me.id, p_id: b.id ?? null, p_name: name, p_login: login, p_pass: pass,
    p_role: role, p_perms: perms, p_active: b.active !== false,
  });
  if (r.error === "login_taken") return json({ error: "This mobile number or username is already used. Pick another." }, 400);
  if (r.error) return json({ error: "Could not save. Check the details and try again." }, 400);
  return json({ user: r.user });
}

export async function DELETE(req: Request) {
  const g = await gate();
  if ("err" in g) return g.err;
  const id = new URL(req.url).searchParams.get("id");
  if (!id || id === g.u.me.id) return json({ error: "You cannot remove yourself." }, 400);
  const users = await rpc<Me[]>("k_users_list", { p_org: g.u.me.orgId });
  const t = users.find((x) => x.id === id);
  if (!t) return json({ ok: true });
  if (t.isOwner) return json({ error: "The owner cannot be removed." }, 403);
  if (!g.u.me.isOwner && permsOf(t).team) return json({ error: "Only the owner can remove a manager." }, 403);
  await rpc("k_user_delete", { p_org: g.u.me.orgId, p_id: id });
  return json({ ok: true });
}
