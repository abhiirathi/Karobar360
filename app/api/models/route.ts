export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Diagnostics: which Gemini models this key can use, and how fast each answers a tiny prompt.
export async function GET() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: "no key" });
  const list = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": key } }).then((r) => r.json()).catch((e) => ({ error: String(e) }));
  const names: string[] = (list.models ?? []).filter((m: { supportedGenerationMethods?: string[] }) => m.supportedGenerationMethods?.includes("generateContent")).map((m: { name: string }) => m.name.replace("models/", ""));
  const candidates = names.filter((n) => /flash/.test(n) && !/image|tts|audio|live|robot|omni|transcribe|banana|embed/.test(n)).slice(0, 12);
  const timed = await Promise.all(
    candidates.map(async (m) => {
      const t = Date.now();
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 25000);
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
          method: "POST", signal: ctrl.signal,
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply with the single word OK." }] }] }),
        });
        const body = await r.text();
        return { model: m, status: r.status, ms: Date.now() - t, sample: body.slice(0, 120) };
      } catch (e) {
        return { model: m, status: 0, ms: Date.now() - t, sample: (e as Error).name };
      } finally {
        clearTimeout(to);
      }
    })
  );
  return Response.json({ total: names.length, names, timed });
}
