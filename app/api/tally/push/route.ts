import { gunzipSync } from "node:zlib";
import { rpc } from "@/lib/server/db";
import { json } from "@/lib/server/auth";
import { compute } from "@/lib/server/tallyParse";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  const key = req.headers.get("x-karobar-key") ?? "";
  const org = await rpc<{ id: string; name: string } | null>("k_org_by", { p_kind: "tally", p_key: key });
  if (!org) return json({ error: "Unknown connector key. Download the connector again from the Tally page." }, 401);
  const body = await req.json().catch(() => null);
  if (!body?.gz) return json({ error: "Empty upload." }, 400);
  let input;
  try {
    input = JSON.parse(gunzipSync(Buffer.from(String(body.gz), "base64")).toString("utf8"));
  } catch {
    return json({ error: "Could not read the upload." }, 400);
  }
  const data = compute({ company: input.company, months: input.months ?? [], ledgers: String(input.ledgers ?? ""), groups: String(input.groups ?? "") });
  if (!data.months.length && !data.receivables && !data.cashBank) return json({ message: "Tally answered but sent no figures. Check that a company is open in Tally." });
  await rpc("k_data_put_many", { p_org: org.id, p_user: null, p_items: [{ section: "tally", data, base: null }] });
  return json({ message: `Tally figures updated for ${org.name}` });
}
