import { rpc } from "@/lib/server/db";
import { json } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

// The weighbridge connector posts the live weight here, about once a second while it changes.
export async function POST(req: Request) {
  const key = req.headers.get("x-karobar-key") ?? "";
  const b = await req.json().catch(() => null);
  const kg = Number(b?.weight);
  if (!b || !isFinite(kg) || Math.abs(kg) > 200000) return json({ error: "Bad reading." }, 400);
  const org = await rpc<{ name: string } | null>("k_weigh_put", { p_key: key, p_weight: Math.round(kg), p_stable: !!b.stable, p_device: String(b.device ?? "").slice(0, 80), p_raw: String(b.raw ?? "").slice(0, 120) });
  if (!org) return json({ error: "Unknown connector key. Download the weighbridge setup again from Settings." }, 401);
  return json({ ok: true });
}
