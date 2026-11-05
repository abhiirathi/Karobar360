import type { ModuleKey } from "./types";

export interface Industry {
  key: string;
  name: string;
  cluster: string;
  margin: number; // gross margin fraction
  unit: string;
  avgUnitPrice: number; // ₹ per unit
  season: number[]; // Jan..Dec multipliers
  products: string[];
  rawMaterials: string[];
  customers: string[];
  suppliers: string[];
  cities: string[];
  departments: string[];
  suggested: ModuleKey[];
  painHints: string[];
}

const T = ["VRL Logistics", "Gati", "Om Roadways", "Shree Maruti Transport", "Rajasthan Roadlines", "Delhivery"];

export const INDUSTRIES: Industry[] = [
  {
    key: "marble",
    name: "Marble, granite & stone",
    cluster: "Kishangarh · Makrana · Rajsamand",
    margin: 0.31,
    unit: "sq ft",
    avgUnitPrice: 115,
    season: [1.15, 1.1, 1.2, 0.95, 0.85, 0.7, 0.6, 0.65, 0.85, 1.1, 1.25, 1.3],
    products: ["Makrana white slabs", "Rajnagar marble tiles", "Jalore granite slabs", "Kota stone flooring", "Sandstone cobbles", "Italian-finish marble"],
    rawMaterials: ["Raw marble blocks", "Granite blocks", "Epoxy resin", "Diamond gang-saw blades", "Diesel", "Polishing abrasives"],
    customers: ["Shiv Builders, Ahmedabad", "Kapoor Interiors, Delhi", "Sai Constructions, Hyderabad", "Gupta Stone Traders, Indore", "Prestige Homes, Bengaluru", "Arihant Infra, Pune", "Royal Tiles, Lucknow"],
    suppliers: ["Rajsamand Quarry Co-op", "Jalore Granite Mines", "Makrana Block Suppliers", "Resin India Pvt Ltd", "Kishangarh Fuel Station"],
    cities: ["Ahmedabad", "Delhi", "Hyderabad", "Indore", "Bengaluru", "Pune", "Lucknow"],
    departments: ["Gang saw", "Cutting & polishing", "Yard & loading", "Sales", "Accounts"],
    suggested: ["sales", "inventory", "production", "logistics", "finance", "staff", "payroll", "compliance"],
    painHints: ["Slab-level stock tracking across yards", "Dealer credit running past 90 days", "Gang-saw downtime"],
  },
  {
    key: "textile",
    name: "Textiles & suiting",
    cluster: "Bhilwara · Pali · Balotra",
    margin: 0.22,
    unit: "m",
    avgUnitPrice: 165,
    season: [0.9, 0.85, 1.05, 0.95, 0.9, 0.85, 1.0, 1.2, 1.3, 1.25, 1.0, 0.85],
    products: ["PV suiting", "Cotton shirting", "Grey fabric", "Denim fabric", "Polyester yarn", "Trouser fabric"],
    rawMaterials: ["Polyester filament yarn", "Viscose staple fibre", "Cotton yarn", "Reactive dyes", "Sizing chemicals", "Coal for boiler"],
    customers: ["Agarwal Textiles, Delhi", "Shah Fabrics, Surat", "Kohli Garments, Ludhiana", "Mehta Traders, Mumbai", "Jain Cloth House, Jaipur", "Bansal Suitings, Kolkata", "Laxmi Creations, Chennai"],
    suppliers: ["Surat Filament Yarn Dealers", "Bhilwara Yarn Agency", "Colourtex Dyes", "Rajasthan Spinners", "Bhilwara Coal Depot"],
    cities: ["Delhi", "Surat", "Ludhiana", "Mumbai", "Jaipur", "Kolkata", "Chennai"],
    departments: ["Weaving", "Processing & dyeing", "Folding & packing", "Sales", "Accounts"],
    suggested: ["sales", "inventory", "production", "supply", "staff", "payroll", "finance", "compliance"],
    painHints: ["Loom efficiency per shift", "Job-work fabric at processors", "Agent commissions"],
  },
  {
    key: "handicrafts",
    name: "Handicrafts & furniture",
    cluster: "Jodhpur · Jaipur · Barmer",
    margin: 0.36,
    unit: "pcs",
    avgUnitPrice: 6800,
    season: [0.95, 1.0, 1.05, 0.9, 0.85, 0.9, 1.05, 1.15, 1.2, 1.1, 0.95, 0.9],
    products: ["Sheesham dining tables", "Mango wood sideboards", "Iron-and-wood shelves", "Carved jharokha mirrors", "Brass décor", "Bone-inlay chests"],
    rawMaterials: ["Sheesham timber", "Mango wood", "MS iron sheets", "PU lacquer", "Brass sheets", "Export cartons"],
    customers: ["Nordic Home AB, Sweden", "Casa Living, Spain", "Westfield Interiors, USA", "Maison Lumière, France", "Heritage Living Stores, Delhi", "Urban Loft, Australia"],
    suppliers: ["Jodhpur Timber Mart", "Marwar Iron Works", "Jodhpur Paints & Lacquers", "Rajasthan Packaging", "Barmer Brassware"],
    cities: ["Stockholm", "Madrid", "New York", "Paris", "Delhi", "Sydney"],
    departments: ["Carpentry", "Metal shop", "Finishing", "Packing & export", "Accounts"],
    suggested: ["sales", "production", "inventory", "logistics", "quality", "finance", "staff", "schemes"],
    painHints: ["Export order costing", "Container stuffing schedule", "Karigar piece-rate payments"],
  },
  {
    key: "gems",
    name: "Gems & jewellery",
    cluster: "Jaipur · Johari Bazaar · Sitapura",
    margin: 0.18,
    unit: "pcs",
    avgUnitPrice: 14500,
    season: [0.9, 1.05, 0.95, 1.0, 0.9, 0.8, 0.85, 0.95, 1.05, 1.35, 1.3, 1.1],
    products: ["Kundan necklace sets", "Silver jhumkas", "Polki bangles", "Cut emeralds", "Tanzanite rings", "Meenakari pendants"],
    rawMaterials: ["Silver bullion", "Gold 22K", "Rough emeralds", "Polki diamonds", "Lac & enamel", "Hallmarking"],
    customers: ["Swarn Jewellers, Delhi", "Malabar Coast Jewels, Kochi", "Peshwa Gold House, Pune", "Gem Gallery, Dubai", "Silverline, London", "Retail counter, Jaipur"],
    suppliers: ["Jaipur Bullion Traders", "Johari Bazaar Metal House", "Zambian rough importer", "Surat diamond broker", "Sitapura enamel works"],
    cities: ["Delhi", "Kochi", "Pune", "Dubai", "London", "Jaipur"],
    departments: ["Cutting & polishing", "Setting", "Meenakari", "Sales counter", "Accounts"],
    suggested: ["sales", "inventory", "production", "finance", "staff", "payroll", "compliance", "quality"],
    painHints: ["Gold and silver weight reconciliation", "Karigar issue and receipt", "Hallmarking backlog"],
  },
  {
    key: "food",
    name: "Food processing & spices",
    cluster: "Ramganj Mandi · Jodhpur · Bharatpur",
    margin: 0.17,
    unit: "kg",
    avgUnitPrice: 210,
    season: [1.0, 1.05, 1.15, 1.1, 0.95, 0.9, 0.9, 0.95, 1.0, 1.1, 1.0, 0.95],
    products: ["Coriander powder", "Cumin seeds", "Red chilli powder", "Kachi ghani mustard oil", "Garam masala", "Turmeric powder"],
    rawMaterials: ["Raw coriander (dhaniya)", "Cumin (jeera)", "Red chillies", "Mustard seed", "Laminated pouches", "Corrugated boxes"],
    customers: ["Cash & carry wholesaler, Jaipur", "Kirana distributor, Kota", "Modern trade buyer, Ahmedabad", "Hotel supplier, Udaipur", "Export buyer, Dubai", "Quick-commerce dark stores"],
    suppliers: ["Ramganj Mandi APMC traders", "Unjha jeera brokers", "Guntur chilli agents", "Bharatpur mustard mills", "Kota Flexi Pack"],
    cities: ["Kota", "Ahmedabad", "Udaipur", "Jaipur", "Dubai", "Delhi"],
    departments: ["Cleaning & grading", "Grinding", "Packing", "Sales", "Accounts"],
    suggested: ["sales", "inventory", "supply", "production", "quality", "logistics", "compliance", "schemes"],
    painHints: ["Batch traceability for FSSAI", "Mandi price swings", "Distributor schemes and claims"],
  },
  {
    key: "auto",
    name: "Auto & engineering components",
    cluster: "Bhiwadi · Neemrana · Alwar",
    margin: 0.24,
    unit: "pcs",
    avgUnitPrice: 340,
    season: [1.0, 1.05, 1.1, 0.95, 0.95, 1.0, 1.0, 1.0, 1.05, 1.1, 0.95, 0.9],
    products: ["Machined brackets", "Forged flanges", "Sheet-metal housings", "Gear blanks", "Brake levers", "Fastener kits"],
    rawMaterials: ["HR steel coils", "EN8 forging bars", "Cutting inserts", "Powder coating", "Lubricants", "Packing crates"],
    customers: ["Tier-1 OEM supplier, Manesar", "Two-wheeler OEM, Neemrana", "Tractor maker, Jaipur", "Aftermarket distributor, Delhi", "Export buyer, Germany"],
    suppliers: ["Steel stockist, Bhiwadi", "Alwar Forgings", "Tooling distributor, Gurugram", "Coatings India", "Neemrana Packaging"],
    cities: ["Manesar", "Neemrana", "Jaipur", "Delhi", "Stuttgart"],
    departments: ["CNC shop", "Press shop", "Quality", "Dispatch", "Accounts"],
    suggested: ["production", "quality", "inventory", "supply", "logistics", "sales", "staff", "payroll"],
    painHints: ["PPM rejection from OEMs", "Schedule adherence", "Tool life tracking"],
  },
  {
    key: "blockprint",
    name: "Block printing & handloom",
    cluster: "Sanganer · Bagru · Barmer",
    margin: 0.34,
    unit: "pcs",
    avgUnitPrice: 950,
    season: [0.95, 1.0, 1.1, 1.0, 0.9, 0.85, 0.9, 1.0, 1.1, 1.3, 1.2, 1.0],
    products: ["Hand-block bedsheets", "Dabu print fabric", "Cotton kurtis", "Table linen sets", "Indigo dohars", "Printed stoles"],
    rawMaterials: ["Cotton greige fabric", "Natural indigo", "Pigment colours", "Wooden blocks", "Binder", "Packing polybags"],
    customers: ["Online marketplace seller account", "Boutique chain, Mumbai", "Export buyer, Japan", "Retail store, Jaipur", "Corporate gifting client"],
    suppliers: ["Sanganer greige dealer", "Bagru colour supplier", "Block carvers, Pethapur", "Jaipur Packaging"],
    cities: ["Mumbai", "Jaipur", "Tokyo", "Bengaluru", "Delhi"],
    departments: ["Printing tables", "Washing & drying", "Stitching", "Online orders", "Accounts"],
    suggested: ["sales", "production", "inventory", "staff", "payroll", "logistics", "schemes"],
    painHints: ["Karigar piece-rate wages", "Marketplace returns", "Wash-fastness complaints"],
  },
  {
    key: "trading",
    name: "Distribution & trading",
    cluster: "Jaipur · Beawar · Ajmer",
    margin: 0.09,
    unit: "cases",
    avgUnitPrice: 1450,
    season: [0.95, 0.95, 1.05, 1.0, 1.05, 1.0, 0.95, 1.0, 1.05, 1.2, 1.1, 0.95],
    products: ["Packaged foods", "Personal care", "Home care", "Beverages", "Confectionery", "Staples (atta, oil)"],
    rawMaterials: ["Company stock (primary)", "Crates & cartons", "Diesel for vans"],
    customers: ["Sharma Kirana, Beawar", "Gupta General Store, Ajmer", "Mahaveer Mart, Kishangarh", "New Bombay Stores, Nasirabad", "Rathi Provision, Bijainagar", "Super Bazaar, Pushkar"],
    suppliers: ["FMCG company A (primary)", "FMCG company B (primary)", "Regional brand C", "Packaging vendor"],
    cities: ["Beawar", "Ajmer", "Kishangarh", "Nasirabad", "Bijainagar", "Pushkar"],
    departments: ["Godown", "Delivery vans", "Salesmen", "Accounts"],
    suggested: ["sales", "inventory", "logistics", "finance", "staff", "payroll", "compliance"],
    painHints: ["Retailer credit and collections", "Scheme claims from companies", "Expiry stock"],
  },
  {
    key: "general",
    name: "Other manufacturing",
    cluster: "Anywhere in India",
    margin: 0.25,
    unit: "units",
    avgUnitPrice: 800,
    season: [1, 1, 1.05, 0.95, 0.95, 0.95, 0.95, 1, 1.05, 1.1, 1.05, 0.95],
    products: ["Product A", "Product B", "Product C", "Product D", "Spare parts", "Services"],
    rawMaterials: ["Raw material 1", "Raw material 2", "Consumables", "Packaging", "Power & fuel"],
    customers: ["Key customer, Delhi", "Distributor, Jaipur", "Institutional buyer, Mumbai", "Dealer, Ahmedabad", "Retail chain, Bengaluru"],
    suppliers: ["Main supplier", "Local vendor", "Packaging vendor", "Spares dealer"],
    cities: ["Delhi", "Jaipur", "Mumbai", "Ahmedabad", "Bengaluru"],
    departments: ["Production", "Stores", "Dispatch", "Sales", "Accounts"],
    suggested: ["sales", "finance", "inventory", "production", "staff", "payroll", "compliance"],
    painHints: ["Data split across Excel and WhatsApp", "No single view of cash"],
  },
];

export const INDUSTRY_MAP = Object.fromEntries(INDUSTRIES.map((i) => [i.key, i])) as Record<string, Industry>;
export const getIndustry = (k: string) => INDUSTRY_MAP[k] ?? INDUSTRY_MAP.general;
export { T as TRANSPORTERS };
