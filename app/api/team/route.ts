import { rpc } from "@/lib/server/db";
import { randomBytes } from "node:crypto";
import { currentUser, json, originOf, validEmail } from "@/lib/server/auth";
import { sendInvite } from "@/lib/server/mail";
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
  const login = String(b.login ?? "").trim().toLowerCase();
  const name = String(b.name ?? "").trim().slice(0, 60);
  if (!name) return json({ error: "Enter the person’s name." }, 400);
  if (!validEmail(login)) return json({ error: "Enter the person’s email address. They sign in with Google or an email link." }, 400);
  // Sign-in is by email only; the stored password is random and never shown to anyone.
  const pass = b.id ? null : randomBytes(18).toString("base64url");

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
  if (r.error === "login_taken") return json({ error: "This email already has a Karobar360 login, here or in another company." }, 400);
  if (r.error) return json({ error: "Could not save. Check the details and try again." }, 400);
  const invited = !b.id || (target && target.login !== login)
    ? await sendInvite(login, { name, company: u.me.orgName, by: u.me.name, url: `${originOf(req)}/stone` })
    : false;
  return json({ user: r.user, invited });
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
