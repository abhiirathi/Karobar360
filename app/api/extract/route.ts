import { aiEnabled, gemini, parseJSON } from "@/lib/gemini";
import { INDUSTRIES } from "@/lib/industries";
import { MODULES, TURNOVER_BANDS, CHANNELS, INTEGRATIONS } from "@/lib/catalog";

export const maxDuration = 60;

const CITY_HINTS = ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer", "Bhilwara", "Kishangarh", "Makrana", "Beawar", "Bikaner", "Alwar", "Bhiwadi", "Neemrana", "Pali", "Sikar", "Rajsamand", "Barmer", "Balotra", "Sanganer", "Bagru", "Ramganj Mandi", "Bharatpur", "Chittorgarh", "Jalore", "Surat", "Ahmedabad", "Delhi", "Mumbai", "Indore", "Ludhiana", "Bengaluru", "Pune"];
const IND_HINTS: [RegExp, string][] = [
  [/marble|granite|stone|slab|kota stone|sandstone|पत्थर|मार्बल/i, "marble"],
  [/textile|fabric|suiting|yarn|loom|weav|कपड़ा|denim/i, "textile"],
  [/furniture|handicraft|wood|sheesham|décor|decor|फर्नीचर/i, "handicrafts"],
  [/jewel|gem|kundan|silver|gold|emerald|ज्वेलरी|गहने/i, "gems"],
  [/spice|masala|food|oil|dhaniya|jeera|namkeen|मसाला|खाद्य/i, "food"],
  [/auto|engineering|cnc|forging|machin|component|fastener/i, "auto"],
  [/block print|handloom|dabu|indigo|bagru|sanganeri|ब्लॉक/i, "blockprint"],
  [/distribut|trading|wholesale|fmcg|stockist|डिस्ट्रीब्यूटर|थोक/i, "trading"],
];

function heuristic(text: string) {
  const out: Record<string, unknown> = {};
  const ind = IND_HINTS.find(([re]) => re.test(text));
  if (ind) out.industry = ind[1];
  const city = CITY_HINTS.find((c) => new RegExp(`\\b${c}\\b`, "i").test(text));
  if (city) { out.city = city; out.state = ["Surat", "Ahmedabad"].includes(city) ? "Gujarat" : ["Delhi"].includes(city) ? "Delhi" : ["Mumbai", "Pune"].includes(city) ? "Maharashtra" : ["Indore"].includes(city) ? "Madhya Pradesh" : ["Ludhiana"].includes(city) ? "Punjab" : ["Bengaluru"].includes(city) ? "Karnataka" : "Rajasthan"; }
  const emp = text.match(/(\d{1,4})\s*(?:\+\s*)?(?:people|staff|employees|workers|labour|karigar|कर्मचारी|लोग|मजदूर)/i);
  if (emp) out.employees = Number(emp[1]);
  const cr = text.match(/(\d+(?:\.\d+)?)\s*(?:cr|crore|करोड़)/i);
  if (cr) { const v = Number(cr[1]) * 1e7; out.turnoverBand = v < 1e7 ? "lt1" : v < 5e7 ? "1to5" : v < 2.5e8 ? "5to25" : v < 1e9 ? "25to100" : "100to500"; }
  const name = text.match(/(?:[Ww]e are|I run|[Cc]ompany is|called|named|हमारी कंपनी)\s+([A-Z][\w&.' -]{2,40}?)(?:[,.]| in | and | based)/);
  if (name) out.companyName = name[1].trim();
  const chans: string[] = [];
  if (/dealer|distributor|डीलर/i.test(text)) chans.push("dealers");
  if (/export|निर्यात/i.test(text)) chans.push("export");
  if (/online|amazon|flipkart|marketplace|meesho/i.test(text)) chans.push("ecommerce");
  if (/shop|showroom|retail|दुकान/i.test(text)) chans.push("retail");
  if (/b2b|builder|oem|factories|companies/i.test(text)) chans.push("b2b");
  if (/gem\b|tender|government/i.test(text)) chans.push("government");
  if (chans.length) out.channels = chans;
  const ints: string[] = [];
  if (/tally/i.test(text)) ints.push("tally");
  if (/busy/i.test(text)) ints.push("busy");
  if (/excel|sheet/i.test(text)) ints.push("excel");
  if (/whatsapp|व्हाट्सएप/i.test(text)) ints.push("whatsapp");
  if (ints.length) out.integrations = ints;
  out.painPoints = text.slice(0, 600);
  return out;
}

export async function POST(req: Request) {
  const { text } = (await req.json()) as { text: string };
  const h = heuristic(text);
  if (!aiEnabled()) return Response.json({ fields: h, ai: false });
  try {
    const system = `Extract an Indian MSME's intake form from the owner's free-text description (may be English, Hindi or Hinglish). Return ONLY JSON with any of these keys you can infer (omit unknown):
{"companyName","ownerName","industry": one of ${JSON.stringify(INDUSTRIES.map((i) => i.key))},"industryNote": short English description of what they make/do,"city","state","category":"micro"|"small"|"medium","turnoverBand": one of ${JSON.stringify(TURNOVER_BANDS.map((b) => b.key))} (lt1=<1Cr,1to5,5to25,25to100,100to500),"employees":number,"sites":[{"type":"factory"|"warehouse"|"yard"|"outlet"|"office","name","city"}],"channels": subset of ${JSON.stringify(CHANNELS.map((c) => c.key))},"modules": subset of ${JSON.stringify(MODULES.map((m) => m.key))} that they need,"painPoints": English summary of their problems,"customRequests": English, one line per special feature they want that is beyond standard modules,"integrations": subset of ${JSON.stringify(INTEGRATIONS.map((i) => i.key))}}`;
    const out = parseJSON<Record<string, unknown>>(await gemini({ system, prompt: text, json: true, temperature: 0.2, timeoutMs: 30000 }));
    return Response.json({ fields: { ...h, ...(out ?? {}) }, ai: Boolean(out) });
  } catch (e) {
    return Response.json({ fields: h, ai: false, error: String((e as Error).message).slice(0, 200) });
  }
}
