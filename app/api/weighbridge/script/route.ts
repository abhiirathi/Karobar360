import { rpc } from "@/lib/server/db";
import { currentUser } from "@/lib/server/auth";
import { level, permsOf } from "@/lib/stone/perm";
import { WEIGH_PS1, weighSetupCmd } from "@/lib/server/weighScript";

export const dynamic = "force-dynamic";

// GET -> karobar360-weighbridge-setup.cmd ; ?file=ps1 -> the connector alone.
export async function GET(req: Request) {
  const u = await currentUser();
  if (!u || level(permsOf(u.me), "settings") !== "edit") return new Response("Only someone who can edit settings can download the weighbridge connector.", { status: 403 });
  const k = await rpc<{ tallyKey: string; name: string }>("k_org_keys", { p_org: u.me.orgId, p_rotate: null });
  const url = new URL(req.url);
  const ps = WEIGH_PS1.replace("__KEY__", k.tallyKey).replace("__API__", `${url.origin}/api/weighbridge/push`).replace("__COMPANY__", k.name.replace(/[^\w .&-]/g, ""));
  const asPs1 = url.searchParams.get("file") === "ps1";
  return new Response(asPs1 ? ps.replace(/\r?\n/g, "\r\n") : weighSetupCmd(ps), {
    headers: { "Content-Type": asPs1 ? "text/plain; charset=utf-8" : "application/octet-stream", "Content-Disposition": `attachment; filename="${asPs1 ? "karobar360-weighbridge.ps1" : "karobar360-weighbridge-setup.cmd"}"`, "Cache-Control": "no-store" },
  });
}
