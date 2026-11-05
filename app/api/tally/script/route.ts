import { rpc } from "@/lib/server/db";
import { currentUser } from "@/lib/server/auth";
import { level, permsOf } from "@/lib/stone/perm";
import { TALLY_PS1, setupCmd } from "@/lib/server/tallyScript";

export const dynamic = "force-dynamic";

// GET /api/tally/script          -> karobar360-tally-setup.cmd (double-click setup for Windows)
// GET /api/tally/script?file=ps1 -> karobar360-tally.ps1 (the connector on its own)
export async function GET(req: Request) {
  const u = await currentUser();
  if (!u || level(permsOf(u.me), "tally") !== "edit") return new Response("Only someone who can edit Tally can download the connector.", { status: 403 });
  const k = await rpc<{ tallyKey: string; name: string }>("k_org_keys", { p_org: u.me.orgId, p_rotate: null });
  const url = new URL(req.url);
  const ps = TALLY_PS1.replace("__KEY__", k.tallyKey).replace("__API__", `${url.origin}/api/tally/push`).replace("__COMPANY__", k.name.replace(/[^\w .&-]/g, ""));
  const asPs1 = url.searchParams.get("file") === "ps1";
  const body = asPs1 ? ps.replace(/\r?\n/g, "\r\n") : setupCmd(ps);
  const name = asPs1 ? "karobar360-tally.ps1" : "karobar360-tally-setup.cmd";
  return new Response(body, {
    headers: { "Content-Type": asPs1 ? "text/plain; charset=utf-8" : "application/octet-stream", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
