import { rpc } from "./db";
import { slabCount } from "@/lib/stone/slabs";
import type { SlabLot, StoneSettings } from "@/lib/stone/types";

export type CatLot = Pick<SlabLot, "id" | "lotNo" | "variety" | "stoneType" | "thicknessMm" | "finish" | "grade" | "pieces" | "available" | "listRate" | "note"> & { photos: string[] };

export async function loadCatalogue(token: string) {
  if (!/^[0-9a-f]{12,64}$/.test(token)) return null;
  const org = await rpc<{ id: string; name: string } | null>("k_org_by", { p_kind: "cat", p_key: token });
  if (!org) return null;
  const got = await rpc<Record<string, { data: unknown }>>("k_data_get", { p_org: org.id, p_sections: ["settings", "lots"] });
  const S = (got.settings?.data ?? {}) as StoneSettings;
  const cat = S.catalogue ?? { enabled: false, showRates: false, whatsapp: "", note: "" };
  const lots = ((got.lots?.data ?? []) as SlabLot[])
    .filter((l) => l.catalogue && l.available > 0)
    .map((l): CatLot => ({
      id: l.id, lotNo: l.lotNo, variety: l.variety, stoneType: l.stoneType, thicknessMm: l.thicknessMm, finish: l.finish, grade: l.grade,
      pieces: slabCount(l), available: l.available, listRate: cat.showRates ? l.listRate : 0, note: l.note ?? "",
      photos: (l.photos ?? []).filter((p) => p.startsWith("file:")).map((p) => p.slice(5)),
    }));
  return { org, enabled: cat.enabled, showRates: cat.showRates, whatsapp: (cat.whatsapp || S.phone || "").replace(/\D/g, ""), note: cat.note, company: S.company || org.name, city: S.city, lots };
}
