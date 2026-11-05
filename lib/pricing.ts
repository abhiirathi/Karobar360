import type { Blueprint } from "./types";

export const PLANS = [
  { key: "starter", name: "Starter", monthly: 4999, modules: 4, users: 5, sites: 1, features: ["Up to 4 modules", "5 users, 1 site", "Excel & Tally import", "Email support"] },
  { key: "growth", name: "Growth", monthly: 11999, modules: 8, users: 20, sites: 3, features: ["Up to 8 modules", "20 users, 3 sites", "WhatsApp alerts & daily owner brief", "AI copilot in Hindi & English", "Tally live sync"] },
  { key: "factory", name: "Factory Pro", monthly: 24999, modules: 99, users: 60, sites: 99, features: ["All modules + custom modules", "60 users, unlimited sites", "Role-based access for CA & managers", "Priority support & on-site training", "Dedicated success manager"] },
];

export function quote(bp: Blueprint) {
  const i = bp.intake;
  const mods = bp.modules.length;
  const plan = mods > 8 || i.sites.length > 3 || i.users > 20 || bp.customModules.length > 0 ? PLANS[2] : mods > 4 || i.sites.length > 1 || i.users > 5 ? PLANS[1] : PLANS[0];
  const extraUsers = Math.max(0, i.users - plan.users);
  const monthly = plan.monthly + extraUsers * 399;
  const lines = [
    { item: "Configuration & onboarding", amount: 35000 },
    ...bp.customModules.map((c) => ({ item: `Custom module: ${c.title}`, amount: 20000 })),
    ...i.integrations.filter((x) => ["tally", "busy", "biometric", "gst", "ewaybill"].includes(x)).map((x) => ({ item: `Integration: ${({ tally: "Tally Prime", busy: "Busy", biometric: "Biometric attendance", gst: "GST / e-invoice", ewaybill: "E-way bill" } as Record<string, string>)[x]}`, amount: 10000 })),
    ...(i.integrations.includes("excel") || i.integrations.includes("tally") ? [{ item: "Historical data migration (2 years)", amount: 15000 }] : []),
    { item: "On-site training at your unit", amount: 10000 },
  ];
  const setup = lines.reduce((a, b) => a + b.amount, 0);
  return { plan, monthly, annual: monthly * 10, setup, lines, extraUsers };
}
