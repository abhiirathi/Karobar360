export type ModuleKey =
  | "sales"
  | "finance"
  | "inventory"
  | "supply"
  | "production"
  | "logistics"
  | "staff"
  | "payroll"
  | "quality"
  | "compliance"
  | "schemes";

export type Lang = "en" | "hi";
export type Unit = "inr" | "num" | "pct" | "days" | "hrs" | "qty";
export type SiteType = "factory" | "warehouse" | "office" | "outlet" | "yard";

export interface Site {
  type: SiteType;
  name: string;
  city: string;
}

export interface Intake {
  companyName: string;
  ownerName: string;
  phone: string;
  email: string;
  industry: string; // key from industries
  industryNote: string; // free text, e.g. "we make PV suiting and do job-work dyeing"
  city: string;
  state: string;
  category: "micro" | "small" | "medium";
  turnoverBand: string; // key from TURNOVER_BANDS
  employees: number;
  users: number;
  sites: Site[];
  channels: string[];
  modules: ModuleKey[];
  painPoints: string;
  customRequests: string;
  integrations: string[];
  languages: Lang[];
  gstin: string;
}

export interface KPI {
  label: string;
  labelHi?: string;
  value: number;
  unit: Unit;
  delta?: number; // fractional change vs previous period, e.g. 0.08
  goodWhen?: "up" | "down";
  hint?: string;
  spark?: number[];
}

export interface Column {
  key: string;
  label: string;
  type: "text" | "number" | "inr" | "date" | "status" | "pct" | "qty";
}

export type Row = Record<string, string | number>;

export interface ChartSpec {
  id: string;
  title: string;
  titleHi?: string;
  finding?: string;
  kind: "area" | "bar" | "line" | "donut" | "hbar" | "stacked";
  unit: Unit;
  data: Record<string, string | number>[];
  xKey: string;
  series: { key: string; label: string; tone: "accent" | "muted" | "faint" | "neg" | "warn" }[];
  wide?: boolean;
}

export interface TableSpec {
  title: string;
  titleHi?: string;
  columns: Column[];
  rows: Row[];
}

export interface Alert {
  level: "critical" | "warn" | "info";
  text: string;
  module: string;
}

export interface CustomModule {
  key: string;
  title: string;
  description: string;
  icon: string;
  kpis: { label: string; value: number; unit: Unit; delta?: number; goodWhen?: "up" | "down" }[];
  columns: Column[];
  rows: Row[];
  chart: { title: string; kind: "bar" | "line"; labels: string[]; values: number[]; unit: Unit };
  insights: string[];
}

export interface ModuleConfig {
  key: ModuleKey;
  insights: string[];
  extraKpis?: { label: string; value: number; unit: Unit; delta?: number; goodWhen?: "up" | "down" }[];
}

export interface Recommendation {
  title: string;
  detail: string;
  impact: string;
  module: string;
}

export interface Automation {
  trigger: string;
  action: string;
  channel: "WhatsApp" | "SMS" | "Email" | "In-app";
  enabled: boolean;
}

export interface Vocab {
  products: string[];
  rawMaterials: string[];
  customers: string[];
  suppliers: string[];
  cities: string[];
  departments: string[];
  unit: string;
  transporters: string[];
}

export interface Blueprint {
  id: string;
  createdAt: number;
  source: "gemini" | "rules";
  intake: Intake;
  headline: string;
  summary: string;
  vocab: Vocab;
  modules: ModuleConfig[];
  customModules: CustomModule[];
  recommendations: Recommendation[];
  automations: Automation[];
  seed: number;
  overrides?: Record<string, Row[]>;
  hidden?: string[];
}

export interface ModuleData {
  key: string;
  kpis: KPI[];
  charts: ChartSpec[];
  tables: TableSpec[];
  alerts: Alert[];
  insights: string[];
}
