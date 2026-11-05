import { rpc } from "@/lib/server/db";
import { currentUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });
  const u = await currentUser();
  if (!u) return new Response("Sign in", { status: 401 });
  const f = await rpc<{ mime: string; data: string } | null>("k_file_get", { p_org: u.me.orgId, p_id: id });
  if (!f) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(f.data, "base64"), { headers: { "Content-Type": f.mime, "Cache-Control": "private, max-age=86400" } });
}
