import type { ModuleKey } from "./types";

export interface ModuleMeta {
  key: ModuleKey;
  name: string;
  nameHi: string;
  icon: string; // lucide icon name
  group: "Commercial" | "Operations" | "People" | "Compliance & growth";
  blurb: string;
  roles: ("owner" | "accounts" | "plant")[];
}

export const MODULES: ModuleMeta[] = [
  { key: "sales", name: "Sales", nameHi: "बिक्री", icon: "TrendingUp", group: "Commercial", blurb: "Orders, dealers, targets and who owes you money.", roles: ["owner", "accounts"] },
  { key: "finance", name: "Finance", nameHi: "वित्त", icon: "Landmark", group: "Commercial", blurb: "Cash, margins, receivables ageing and the 45-day MSME payment rule.", roles: ["owner", "accounts"] },
  { key: "inventory", name: "Inventory", nameHi: "स्टॉक", icon: "Boxes", group: "Operations", blurb: "Stock by site, reorder alerts, dead stock and valuation.", roles: ["owner", "plant"] },
  { key: "supply", name: "Supply chain", nameHi: "खरीद", icon: "Truck", group: "Operations", blurb: "Purchase orders, vendor delivery performance and lead times.", roles: ["owner", "plant", "accounts"] },
  { key: "production", name: "Production", nameHi: "उत्पादन", icon: "Factory", group: "Operations", blurb: "Work orders, output vs plan, machine downtime and OEE.", roles: ["owner", "plant"] },
  { key: "logistics", name: "Logistics", nameHi: "लॉजिस्टिक्स", icon: "Route", group: "Operations", blurb: "Dispatches, e-way bills, transporters and on-time delivery.", roles: ["owner", "plant"] },
  { key: "quality", name: "Quality", nameHi: "गुणवत्ता", icon: "BadgeCheck", group: "Operations", blurb: "Inspections, rejections, complaints and corrective actions.", roles: ["owner", "plant"] },
  { key: "staff", name: "Staff", nameHi: "कर्मचारी", icon: "Users", group: "People", blurb: "Headcount, daily attendance, shifts, overtime and contractors.", roles: ["owner", "plant"] },
  { key: "payroll", name: "Payroll", nameHi: "वेतन", icon: "Wallet", group: "People", blurb: "Monthly salary run with PF, ESI, advances and payout status.", roles: ["owner", "accounts"] },
  { key: "compliance", name: "GST & compliance", nameHi: "जीएसटी व अनुपालन", icon: "ShieldCheck", group: "Compliance & growth", blurb: "GST, TDS, PF/ESI due dates, e-invoices and licence renewals.", roles: ["owner", "accounts"] },
  { key: "schemes", name: "Schemes & credit", nameHi: "योजनाएँ व ऋण", icon: "Sparkles", group: "Compliance & growth", blurb: "Government schemes, subsidies and working-capital options you qualify for.", roles: ["owner", "accounts"] },
];

export const MODULE_MAP = Object.fromEntries(MODULES.map((m) => [m.key, m])) as Record<ModuleKey, ModuleMeta>;

export const TURNOVER_BANDS = [
  { key: "lt1", label: "Under ₹1 Cr", annual: 6.5e6 },
  { key: "1to5", label: "₹1 – 5 Cr", annual: 3.2e7 },
  { key: "5to25", label: "₹5 – 25 Cr", annual: 1.25e8 },
  { key: "25to100", label: "₹25 – 100 Cr", annual: 4.8e8 },
  { key: "100to500", label: "₹100 – 500 Cr", annual: 1.6e9 },
];

export const CHANNELS = [
  { key: "dealers", label: "Dealers & distributors" },
  { key: "b2b", label: "Direct to businesses (B2B)" },
  { key: "retail", label: "Own shop / retail" },
  { key: "export", label: "Exports" },
  { key: "ecommerce", label: "Online marketplaces" },
  { key: "government", label: "Government tenders / GeM" },
  { key: "jobwork", label: "Job-work for others" },
];

export const INTEGRATIONS = [
  { key: "tally", label: "Tally Prime" },
  { key: "busy", label: "Busy" },
  { key: "excel", label: "Excel / Google Sheets" },
  { key: "whatsapp", label: "WhatsApp Business" },
  { key: "gst", label: "GST portal / e-invoice (IRP)" },
  { key: "ewaybill", label: "E-way bill portal" },
  { key: "biometric", label: "Biometric attendance" },
  { key: "upi", label: "UPI / payment gateway" },
  { key: "shiprocket", label: "Courier aggregators" },
];

export const SITE_TYPES = [
  { key: "factory", label: "Factory / plant" },
  { key: "warehouse", label: "Warehouse / godown" },
  { key: "yard", label: "Stock yard" },
  { key: "outlet", label: "Shop / showroom" },
  { key: "office", label: "Office" },
];
