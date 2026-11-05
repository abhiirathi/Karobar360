import { rpc } from "@/lib/server/db";
import { loadCatalogue } from "@/lib/server/catalogue";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const c = await loadCatalogue(token);
  // Only photos of lots that are in the public catalogue can be opened with the link.
  if (!c?.enabled || !c.lots.some((l) => l.photos.includes(id))) return new Response("Not found", { status: 404 });
  const f = await rpc<{ mime: string; data: string } | null>("k_file_get", { p_org: c.org.id, p_id: id });
  if (!f) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(f.data, "base64"), { headers: { "Content-Type": f.mime, "Cache-Control": "public, max-age=3600" } });
}
