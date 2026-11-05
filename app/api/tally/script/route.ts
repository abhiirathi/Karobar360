import { rpc } from "@/lib/server/db";
import { currentUser } from "@/lib/server/auth";
import { level, permsOf } from "@/lib/stone/perm";
import { TALLY_PS1 } from "@/lib/server/tallyScript";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = await currentUser();
  if (!u || level(permsOf(u.me), "tally") !== "edit") return new Response("Only someone who can edit Tally can download the connector.", { status: 403 });
  const k = await rpc<{ tallyKey: string; name: string }>("k_org_keys", { p_org: u.me.orgId, p_rotate: null });
  const origin = new URL(req.url).origin;
  const ps = TALLY_PS1.replace("__KEY__", k.tallyKey).replace("__API__", `${origin}/api/tally/push`).replace("__COMPANY__", k.name.replace(/[^\w .&-]/g, ""));
  return new Response(ps.replace(/\n/g, "\r\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": 'attachment; filename="karobar360-tally.ps1"', "Cache-Control": "no-store" },
  });
}
