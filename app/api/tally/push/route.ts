import { gunzipSync } from "node:zlib";
import { rpc } from "@/lib/server/db";
import { json } from "@/lib/server/auth";
import { compute } from "@/lib/server/tallyParse";
import type { TallyData } from "@/lib/stone/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Upload = { company?: string; months?: { m: string; to: string; xml: string }[]; ledgers?: string; groups?: string };

const hasFigures = (d: TallyData) => d.months.some((m) => m.sales || m.purchases || m.expenses) || !!(d.receivables || d.payables || d.cashBank);

export async function POST(req: Request) {
  const key = req.headers.get("x-karobar-key") ?? "";
  const org = await rpc<{ id: string; name: string } | null>("k_org_by", { p_kind: "tally", p_key: key });
  if (!org) return json({ error: "Unknown connector key. Download the connector again from the Tally page." }, 401);
  const body = await req.json().catch(() => null);
  if (!body?.gz) return json({ error: "Empty upload." }, 400);
  let input: { v?: number; computer?: string; companies?: Upload[] } & Upload;
  try {
    input = JSON.parse(gunzipSync(Buffer.from(String(body.gz), "base64")).toString("utf8"));
  } catch {
    return json({ error: "Could not read the upload." }, 400);
  }
  // v2 sends every company open in Tally; the first connector sent one.
  const ups: Upload[] = Array.isArray(input.companies) ? input.companies : [input];
  const all = ups.map((u) => compute({ company: u.company ?? "", months: u.months ?? [], ledgers: String(u.ledgers ?? ""), groups: String(u.groups ?? "") })).filter(hasFigures);
  if (!all.length) return json({ message: "Tally answered but sent no figures. Check that a company with entries is open in Tally." });
  const data: TallyData = { ...all[0], computer: String(input.computer ?? "").slice(0, 60), ...(all.length > 1 ? { companies: all } : {}) };
  await rpc("k_data_put_many", { p_org: org.id, p_user: null, p_items: [{ section: "tally", data, base: null }] });
  return json({ message: `Tally figures updated for ${org.name} (${all.map((d) => d.company || "open company").join(", ")})` });
}
