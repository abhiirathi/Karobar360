import { aiEnabled, gemini } from "@/lib/gemini";

export const maxDuration = 60;

interface Snapshot {
  company: string;
  industry: string;
  city: string;
  modules: { name: string; kpis: string[]; findings: string[] }[];
  alerts: string[];
  recommendations: string[];
}

const KEYWORDS: [RegExp, string[]][] = [
  [/cash|bank|paisa|पैसा|नकद|liquidity|fund/i, ["Finance"]],
  [/receiv|outstanding|collect|udhaar|उधार|due|dso|payment|बकाया|वसूली/i, ["Sales", "Finance"]],
  [/sale|revenue|order|बिक्री|dealer|customer|ग्राहक/i, ["Sales"]],
  [/stock|inventory|स्टॉक|माल|godown|reorder|dead/i, ["Inventory"]],
  [/purchase|vendor|supplier|खरीद|po\b/i, ["Supply chain"]],
  [/output|production|उत्पादन|machine|oee|downtime|मशीन/i, ["Production"]],
  [/dispatch|e-?way|transport|freight|delivery|गाड़ी|डिस्पैच/i, ["Logistics"]],
  [/staff|attendance|worker|labour|कर्मचारी|हाजिरी|absent/i, ["Staff"]],
  [/salary|payroll|pf|esi|वेतन|तनख्वाह/i, ["Payroll"]],
  [/gst|tds|compliance|filing|return|जीएसटी/i, ["GST & compliance"]],
  [/scheme|subsidy|loan|rips|योजना|सब्सिडी|ऋण/i, ["Schemes & credit"]],
  [/quality|reject|defect|complaint|गुणवत्ता/i, ["Quality"]],
];

function fallback(q: string, s: Snapshot) {
  const hi = /[ऀ-ॿ]/.test(q);
  const hits = new Set<string>();
  for (const [re, mods] of KEYWORDS) if (re.test(q)) mods.forEach((m) => hits.add(m));
  const mods = s.modules.filter((m) => hits.has(m.name));
  const chosen = mods.length ? mods : s.modules.slice(0, 2);
  const lines: string[] = [];
  lines.push(hi ? `${s.company} — आपके सवाल से जुड़ी मुख्य बातें:` : `Here's what the numbers say for ${s.company}:`);
  for (const m of chosen.slice(0, 2)) {
    lines.push(`\n**${m.name}**`);
    m.kpis.slice(0, 4).forEach((k) => lines.push(`- ${k}`));
    m.findings.slice(0, 2).forEach((f) => lines.push(`- ${f}`));
  }
  const rel = s.alerts.filter((a) => chosen.some((m) => a.toLowerCase().includes(m.name.split(" ")[0].toLowerCase()))).concat(s.alerts).slice(0, 2);
  if (rel.length) {
    lines.push(hi ? "\n**ध्यान दें**" : "\n**Needs attention**");
    rel.forEach((a) => lines.push(`- ${a}`));
  }
  if (s.recommendations[0]) lines.push(hi ? `\n**अगला कदम:** ${s.recommendations[0]}` : `\n**Suggested next step:** ${s.recommendations[0]}`);
  if (hi) lines.push("\n_(पूरे हिंदी जवाब के लिए AI key जोड़ें।)_");
  return lines.join("\n");
}

export async function POST(req: Request) {
  const { question, snapshot, history } = (await req.json()) as { question: string; snapshot: Snapshot; history?: { role: string; text: string }[] };
  if (!aiEnabled()) return Response.json({ answer: fallback(question, snapshot), ai: false });
  try {
    const system = `You are the AI business analyst inside Karobar360, the operations dashboard of ${snapshot.company}, a ${snapshot.industry} MSME in ${snapshot.city}, India.
Answer the owner's question using ONLY the data snapshot below. Be direct and practical, like a sharp CA-cum-operations advisor. Use ₹ with lakh/crore. Keep answers under 140 words; use short bullet points when listing. If the data doesn't cover the question, say what you'd need and which module would hold it.
Reply in the same language as the question (Hindi in Devanagari if asked in Hindi; Hinglish if asked in Hinglish).
DATA SNAPSHOT:
${JSON.stringify(snapshot)}`;
    const convo = (history ?? []).slice(-6).map((h) => `${h.role === "user" ? "Owner" : "Analyst"}: ${h.text}`).join("\n");
    const answer = await gemini({ system, prompt: `${convo ? convo + "\n" : ""}Owner: ${question}`, temperature: 0.4, timeoutMs: 30000 });
    return Response.json({ answer, ai: true });
  } catch (e) {
    return Response.json({ answer: fallback(question, snapshot), ai: false, error: String((e as Error).message).slice(0, 200) });
  }
}
