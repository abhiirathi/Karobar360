import { rpc } from "@/lib/server/db";
import { currentUser, json } from "@/lib/server/auth";
import { ALL_SECTIONS, COST_FIELDS, permsOf, sectionAccess, type Section } from "@/lib/stone/perm";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Stored = Record<string, { data: unknown; version: number; at: string }>;
type Item = { section: Section; data: unknown; base: number | null };

type StoresData = { items?: Record<string, unknown>[]; moves?: Record<string, unknown>[] };
const zeroRate = (xs: Record<string, unknown>[] = []) => xs.map((x) => ({ ...x, rate: 0 }));

function strip(section: Section, data: unknown) {
  if (section === "stores" && data && typeof data === "object") {
    const d = data as StoresData;
    return { ...d, items: zeroRate(d.items), moves: zeroRate(d.moves) };
  }
  const f = COST_FIELDS[section];
  if (!f || !Array.isArray(data)) return data;
  return data.map((x) => { const y = { ...(x as Record<string, unknown>) }; for (const k of f) if (k in y) y[k] = 0; return y; });
}

export async function GET() {
  const u = await currentUser();
  if (!u) return json({ error: "Sign in again." }, 401);
  const p = permsOf(u.me);
  const { read, write } = sectionAccess(p);
  const got = await rpc<Stored>("k_data_get", { p_org: u.me.orgId, p_sections: [...read] });
  const sections: Record<string, { data: unknown; version: number }> = {};
  for (const s of read) {
    const g = got[s];
    sections[s] = { data: g ? (p.costs ? g.data : strip(s, g.data)) : null, version: g?.version ?? 0 };
  }
  return json({ me: u.me, sections, read: [...read], write: [...write] });
}

const DATA_URL = /^data:([\w/+.-]+);base64,(.+)$/s;

async function toFile(org: string, v: unknown): Promise<unknown> {
  if (typeof v !== "string") return v;
  const m = DATA_URL.exec(v);
  if (!m) return v;
  if (m[2].length > 4_500_000) throw new Error("File too large");
  const id = await rpc<string>("k_file_put", { p_org: org, p_mime: m[1], p_data: m[2] });
  return `file:${id}`;
}

/** Photos and documents are kept as separate files; the data keeps only "file:<id>". */
async function extractFiles(org: string, section: Section, data: unknown) {
  if (!Array.isArray(data)) return data;
  if (section === "blocks" || section === "lots") {
    for (const x of data as { photos?: unknown[] }[]) if (Array.isArray(x.photos)) x.photos = await Promise.all(x.photos.map((p) => toFile(org, p)));
  }
  if (section === "shipments") {
    for (const x of data as { blFile?: { data?: unknown } | null }[]) if (x.blFile?.data) x.blFile.data = (await toFile(org, x.blFile.data)) as string;
  }
  return data;
}

export async function PUT(req: Request) {
  const u = await currentUser();
  if (!u) return json({ error: "Sign in again." }, 401);
  const p = permsOf(u.me);
  const { write } = sectionAccess(p);
  const body = (await req.json().catch(() => null)) as { items?: Item[] } | null;
  const items = (body?.items ?? []).filter((i) => ALL_SECTIONS.includes(i.section));
  if (!items.length) return json({ ok: true, versions: {} });
  const denied = items.filter((i) => !write.has(i.section)).map((i) => i.section);
  if (denied.length) return json({ error: `You can view but not change: ${denied.join(", ")}.`, denied }, 403);

  // People who cannot see money fields send zeros; keep the stored amounts for records that already exist.
  const needMerge = p.costs ? [] : items.filter((i) => (COST_FIELDS[i.section] && Array.isArray(i.data)) || i.section === "stores").map((i) => i.section);
  const stored = needMerge.length ? await rpc<Stored>("k_data_get", { p_org: u.me.orgId, p_sections: needMerge }) : {};
  for (const it of items) {
    if (!needMerge.includes(it.section)) continue;
    if (it.section === "stores") {
      const old = (stored.stores?.data ?? {}) as StoresData;
      const d = (it.data ?? {}) as StoresData;
      for (const key of ["items", "moves"] as const) {
        const prev = new Map((old[key] ?? []).map((x) => [x.id as string, x]));
        for (const x of d[key] ?? []) { const o = prev.get(x.id as string); if (o) x.rate = o.rate; }
      }
      continue;
    }
    const prev = new Map(((stored[it.section]?.data as { id: string }[]) ?? []).map((x) => [x.id, x as Record<string, unknown>]));
    for (const x of it.data as Record<string, unknown>[]) {
      const old = prev.get(x.id as string);
      if (old) for (const k of COST_FIELDS[it.section]!) x[k] = old[k];
    }
  }
  try {
    for (const it of items) it.data = await extractFiles(u.me.orgId, it.section, it.data);
  } catch {
    return json({ error: "A photo or file is too large. Use one under 3 MB." }, 413);
  }
  const r = await rpc<{ ok: boolean; versions?: Record<string, number>; conflict?: string[] }>("k_data_put_many", { p_org: u.me.orgId, p_user: u.me.id, p_items: items });
  if (!r.ok) return json({ ok: false, conflict: r.conflict }, 409);
  // Send back what was stored when files were extracted, so the browser drops the heavy data URLs.
  const echo = Object.fromEntries(items.filter((i) => i.section === "blocks" || i.section === "lots" || i.section === "shipments").map((i) => [i.section, p.costs ? i.data : strip(i.section, i.data)]));
  return json({ ok: true, versions: r.versions, echo });
}
