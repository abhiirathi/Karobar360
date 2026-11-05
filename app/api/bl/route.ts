import { aiEnabled, parseJSON } from "@/lib/gemini";

export const maxDuration = 60;

// Fastest reader first; the others are fallbacks.
const MODELS = Array.from(new Set(["gemini-3.5-flash", process.env.GEMINI_MODEL, "gemini-flash-latest"].filter(Boolean) as string[]));

const PROMPT = `You read ocean bills of lading for a natural-stone importer in India (marble, granite, quartzite blocks and slabs).
Return JSON only, with these keys (use "" or 0 when a value is not on the document; never guess):
{"blNo":"","blDate":"YYYY-MM-DD","line":"shipping line / carrier","vessel":"","voyage":"","pol":"port of loading, Country","pod":"port of discharge, Country",
"partyName":"shipper name","country":"shipper's country","variety":"stone name if stated, e.g. Volakas White","kind":"blocks|slabs",
"pieces":0,"tonnes":0,"cbm":0,"sqm":0,
"containers":[{"no":"ABCU 123456 7","seal":"","size":"20' open top","grossKg":0}]}
Weights: convert to metric tonnes for "tonnes" and kg for each container's grossKg. Pieces = number of blocks, slabs or bundles declared.`;

export async function POST(req: Request) {
  if (!aiEnabled()) return Response.json({ ok: false, error: "AI reading is not switched on for this workspace yet. Fill the details by hand." });
  let body: { data?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  const m = /^data:([^;]+);base64,(.+)$/.exec(body.data ?? "");
  if (!m) return Response.json({ ok: false, error: "Upload a PDF or an image of the BL." });
  const [, mime, b64] = m;
  if (!/^(application\/pdf|image\/(png|jpe?g|webp|heic|heif))$/.test(mime)) return Response.json({ ok: false, error: "Only PDF, JPG, PNG or WEBP files can be read." });
  if (b64.length > 6_000_000) return Response.json({ ok: false, error: "File too large to read. Keep it under 4 MB." });

  const key = process.env.GEMINI_API_KEY!;
  const errors: string[] = [];
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const tries = MODELS.flatMap((m) => [m, m]); // each model gets one retry when Google is busy
  for (let i = 0; i < tries.length; i++) {
    const model = tries[i];
    if (i % 2 === 1 && !/ (429|5\d\d)$/.test(errors[errors.length - 1] ?? "")) continue;
    if (i % 2 === 1) await sleep(1500);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 18000);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        signal: ctrl.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data: b64 } }, { text: PROMPT }] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
      });
      if (!res.ok) {
        errors.push(`${model} ${res.status}`);
        continue;
      }
      const j = await res.json();
      const text: string = (j?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
      const fields = parseJSON<Record<string, unknown>>(text);
      if (!fields) {
        errors.push(`${model}: unreadable`);
        continue;
      }
      return Response.json({ ok: true, fields, model });
    } catch (e) {
      errors.push(`${model}: ${(e as Error).name === "AbortError" ? "timeout" : (e as Error).message}`);
    } finally {
      clearTimeout(t);
    }
  }
  console.error("[bl]", errors.join(" | "));
  const busy = errors.some((e) => / (429|503)$/.test(e));
  return Response.json({ ok: false, error: busy ? "The AI reader is busy right now. Try the upload again in a minute, or fill the details by hand." : "Couldn't read this BL. Fill the details by hand." });
}
