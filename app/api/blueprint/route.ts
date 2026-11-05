import { rulesBlueprint } from "@/lib/rules";
import { aiEnabled, gemini, parseJSON } from "@/lib/gemini";
import { mergeAI, ICONS } from "@/lib/sanitize";
import { getIndustry } from "@/lib/industries";
import type { Intake } from "@/lib/types";

export const maxDuration = 60;

const SYSTEM = `You are the solution architect at Karobar360, a company that builds custom operations software for Indian MSMEs (micro, small and medium enterprises), especially in Rajasthan clusters.
Given a company's intake form, design their dashboard. Be concrete and specific to their industry, cluster, products and stated pain points. Use Indian business vocabulary (dealers, godown, karigar, e-way bill, GST, PF/ESI, lakh/crore) where natural. Never invent real brand or company names for customers or suppliers; use plausible fictional trade names with a city (e.g. "Agarwal Stone Traders, Indore").
Return ONLY JSON matching this shape:
{
 "headline": string (max 90 chars, plain, no hype),
 "summary": string (2-3 sentences: who they are and what this dashboard fixes for them),
 "vocab": { "products": string[6], "rawMaterials": string[5], "customers": string[6], "suppliers": string[5], "cities": string[6] (where they sell), "departments": string[4-5], "unit": string (sales unit like "sq ft","m","kg","pcs") },
 "modules": [ { "key": one of the selected module keys, "insights": string[3] (specific, actionable, one sentence each, no made-up exact numbers), "extraKpis": [ { "label": string, "value": number, "unit": "inr"|"num"|"pct"|"days"|"hrs"|"qty", "goodWhen": "up"|"down" } ] (0 or 1 item, something specific to this business) } ],
 "customModules": [ up to 4 modules built from the customer's custom requests and pain points that are NOT covered by the standard modules: { "title": string (max 32 chars), "icon": one of ${JSON.stringify(ICONS)}, "description": string, "kpis": [3 x {label,value,unit,goodWhen}], "columns": [5-7 x {"key": snake_case, "label": string, "type": "text"|"number"|"inr"|"date"|"status"|"pct"}], "rows": [8 objects keyed by column keys with realistic values; pct as fraction 0-1; inr as rupees number; status as short word], "chart": {"title": string, "kind": "bar"|"line", "labels": string[6], "values": number[6], "unit": unit}, "insights": string[2] } ],
 "recommendations": [ 4-5 x { "title": string, "detail": string, "impact": string (short), "module": module key or "overview" } ],
 "automations": [ 4-6 x { "trigger": string, "action": string, "channel": "WhatsApp"|"SMS"|"Email"|"In-app", "enabled": boolean } ]
}
Keep KPI values realistic for the stated turnover band and headcount. pct values are fractions (0.18 = 18%).`;

export async function POST(req: Request) {
  const { intake } = (await req.json()) as { intake: Intake };
  const base = rulesBlueprint(intake);
  if (!aiEnabled()) return Response.json({ blueprint: base, ai: false });
  try {
    const ind = getIndustry(intake.industry);
    const prompt = `Intake form:\n${JSON.stringify({ ...intake, industryName: ind.name, cluster: ind.cluster }, null, 1)}\n\nSelected standard module keys: ${JSON.stringify(base.modules.map((m) => m.key))}\nDefault vocabulary to improve on: ${JSON.stringify(base.vocab)}`;
    const text = await gemini({ system: SYSTEM, prompt, json: true, temperature: 0.55, timeoutMs: 50000 });
    const parsed = parseJSON(text);
    if (!parsed) return Response.json({ blueprint: base, ai: false, error: "AI returned invalid JSON; used rules engine" });
    return Response.json({ blueprint: mergeAI(base, parsed), ai: true });
  } catch (e) {
    return Response.json({ blueprint: base, ai: false, error: String((e as Error).message ?? e).slice(0, 200) });
  }
}
