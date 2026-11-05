import { rpc } from "@/lib/server/db";
import { currentUser, json } from "@/lib/server/auth";
import { level, permsOf } from "@/lib/stone/perm";

export const dynamic = "force-dynamic";

async function keys(rotate: string | null) {
  const u = await currentUser();
  if (!u) return json({ error: "Sign in again." }, 401);
  const p = permsOf(u.me);
  const canCat = level(p, "stock") !== "none" || level(p, "sales") !== "none" || level(p, "settings") !== "none";
  const canTally = level(p, "tally") === "edit";
  if (rotate === "cat" && level(p, "settings") !== "edit") return json({ error: "Only someone who can edit settings can reset the link." }, 403);
  if (rotate === "tally" && !canTally) return json({ error: "Only someone who can edit Tally can reset the key." }, 403);
  const k = await rpc<{ catToken: string; tallyKey: string }>("k_org_keys", { p_org: u.me.orgId, p_rotate: rotate });
  return json({ catToken: canCat ? k.catToken : null, tallyKey: canTally ? k.tallyKey : null });
}

export async function GET() {
  return keys(null);
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  return keys(b.rotate === "cat" || b.rotate === "tally" ? b.rotate : null);
}
