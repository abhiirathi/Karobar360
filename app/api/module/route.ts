import { aiEnabled, gemini, parseJSON } from "@/lib/gemini";
import { ICONS, sanitizeCustom } from "@/lib/sanitize";
import { customModulesFrom } from "@/lib/rules";
import type { Intake, Vocab } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { description, intake, vocab, seed } = (await req.json()) as { description: string; intake: Intake; vocab: Vocab; seed: number };
  const fallback = () => {
    const m = customModulesFrom(description + "\n", intake, vocab, seed + Date.now() % 1000)[0];
    return m;
  };
  if (!aiEnabled()) return Response.json({ module: fallback(), ai: false });
  try {
    const system = `You design one custom module for an Indian MSME's operations dashboard. Return ONLY JSON: { "title": string (max 32 chars), "icon": one of ${JSON.stringify(ICONS)}, "description": string, "kpis": [3 x {"label","value":number,"unit":"inr"|"num"|"pct"|"days"|"hrs"|"qty","goodWhen":"up"|"down"}], "columns": [5-7 x {"key": snake_case, "label", "type": "text"|"number"|"inr"|"date"|"status"|"pct"}], "rows": [8 objects keyed by column keys, realistic Indian context, pct as fraction, inr as rupees], "chart": {"title","kind":"bar"|"line","labels":string[6],"values":number[6],"unit"}, "insights": string[2] }. Use fictional names only.`;
    const prompt = `Company: ${intake.companyName}, industry ${intake.industry} (${intake.industryNote}), ${intake.city}, ${intake.employees} staff.\nTheir products: ${vocab.products.join(", ")}.\nThey asked for: "${description}"`;
    const text = await gemini({ system, prompt, json: true, temperature: 0.5 });
    const m = sanitizeCustom(parseJSON(text));
    return Response.json({ module: m ?? fallback(), ai: Boolean(m) });
  } catch (e) {
    return Response.json({ module: fallback(), ai: false, error: String((e as Error).message).slice(0, 200) });
  }
}
