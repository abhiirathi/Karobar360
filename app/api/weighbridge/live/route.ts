import { rpc } from "@/lib/server/db";
import { currentUser, json } from "@/lib/server/auth";
import { level, permsOf } from "@/lib/stone/perm";

export const dynamic = "force-dynamic";

// The gate screen polls this for the current weight on the weighbridge.
export async function GET() {
  const u = await currentUser();
  if (!u) return json({ error: "Sign in again." }, 401);
  const p = permsOf(u.me);
  if (level(p, "blocks") === "none" && level(p, "quarry") === "none" && level(p, "settings") === "none") return json({ error: "No access." }, 403);
  const r = await rpc<{ weight: number; stable: boolean; device: string; at: string; age: number } | null>("k_weigh_get", { p_org: u.me.orgId });
  return json({ reading: r ? { weight: Number(r.weight), stable: r.stable, device: r.device, at: r.at, age: Number(r.age) } : null });
}
