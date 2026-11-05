// Server-only helper for Google Gemini (REST, no SDK dependency).
const MODELS = Array.from(new Set([process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-3.8-flash", "gemini-3.5-flash"].filter(Boolean) as string[]));

export function aiEnabled() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function aiModel() {
  return MODELS[0];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function gemini(opts: { system: string; prompt: string; json?: boolean; temperature?: number; timeoutMs?: number }): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("NO_KEY");
  const errors: string[] = [];
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 40000);
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          signal: ctrl.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: opts.system }] },
            contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
            generationConfig: {
              temperature: opts.temperature ?? 0.6,
              ...(opts.json ? { responseMimeType: "application/json" } : {}),
            },
          }),
        });
        if (!res.ok) {
          const body = (await res.text()).slice(0, 240);
          errors.push(`${model} ${res.status}: ${body}`);
          if ((res.status === 429 || res.status >= 500) && attempt === 0) {
            await sleep(1500);
            continue;
          }
          break; // try next model
        }
        const j = await res.json();
        const text: string = (j?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
        if (!text) {
          errors.push(`${model}: empty response (${j?.candidates?.[0]?.finishReason ?? "no candidates"})`);
          break;
        }
        return text;
      } catch (e) {
        errors.push(`${model}: ${(e as Error).name === "AbortError" ? "timeout" : (e as Error).message}`);
        if ((e as Error).name === "AbortError") throw new Error(errors.join(" | "));
        break;
      } finally {
        clearTimeout(t);
      }
    }
  }
  console.error("[gemini]", errors.join(" | "));
  throw new Error(errors.join(" | ") || "AI_FAILED");
}

export function parseJSON<T = unknown>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
