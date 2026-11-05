"use client";
import { useState } from "react";
import { ArrowRight, ChevronDown, Factory, ReceiptText, ShoppingCart, Truck, Warehouse, Wallet } from "lucide-react";
import type { Ctx, View } from "./StoneApp";

type Guide = { key: string; view: View; sub?: string; title: string; what: string; steps: string[]; tip?: string };

const JOURNEY = [
  { icon: ShoppingCart, title: "Block is bought", where: "Purchases → Domestic or Import", text: "One bill, one or more blocks: supplier, quality, billed weight, rawanna, vehicle. Own quarry blocks: Inventory → Blocks → Block extracted." },
  { icon: Truck, title: "Into the godown", where: "Purchases → Godown, then Received qty", text: "Saving the purchase puts its blocks in the godown you pick. Enter the weight received when it is weighed; costing follows it." },
  { icon: Factory, title: "Processing, then lots", where: "Inventory → Blocks → Processing → Create lots", text: "Click Processing when a block goes to the saw. When it is done, Create lots: pick the block and enter each lot with its size and slabs." },
  { icon: Warehouse, title: "Slabs in stock", where: "Inventory → Slabs, by lot or by slab", text: "Each lot shows its block no. and its cost per sq ft, stores included." },
  { icon: ReceiptText, title: "Sold on an invoice", where: "Sales → New sale", text: "Pick the lot and the exact slabs. GST, e-way bill and export papers are made for you." },
  { icon: Wallet, title: "Payment received", where: "Sales → Payment column", text: "Switch Due to Received. Overdue invoices show on the dashboard." },
];

const GUIDES: Guide[] = [
  {
    key: "overview", view: "overview", title: "Overview (dashboard)",
    what: "One screen with today’s position: blocks in godowns and in processing, slab stock, sales, money to collect and anything that needs attention.",
    steps: ["Read the alerts at the top. Each one says what is wrong and takes you to the record when you click it.", "Click any figure to open the section behind it.", "Use Customise dashboard to hide panels you don’t need or reorder them."],
  },
  {
    key: "inventory", view: "inventory", sub: "blocks", title: "Inventory",
    what: "Every block and every slab lot you hold, with its cost so far.",
    steps: [
      "Blocks: block no., quality, supplier, weight, cost per tonne till now and the godown it is in. Tabs: In stock, Processing, Processed, Sold and All.",
      "Click Processing on a block in stock when it goes to the saw. When it is cut, click Create lots: pick the block, then add each lot with its no., thickness, slab size and number of slabs. The slabs go into slab stock and the block moves to Processed. More lots can be added to it later.",
      "A block sold without processing moves to Sold. A block written off after damage shows only under All.",
      "Click a block for everything else: date, vehicle, rawanna, size, each cost on it, the lots cut from it and every step it went through.",
      "Own quarry: click Block extracted when a block is cut. It stays At mine until it is sold or sent to another firm. Extraction costs and Cost per tonne sit next to the block list.",
      "Slabs: one line per lot, with the block it came from. Cost per sq ft includes the share of stores issued that month.",
      "Click a lot for its history: the opening entry, every sale on its own line, the total cost of the lot so far and the net margin on what is sold.",
    ],
    tip: "QR labels print from the block list. Scanning one on a phone opens that block.",
  },
  {
    key: "purchases", view: "purchases", title: "Purchases",
    what: "Blocks bought in India and imported, one bill at a time, and slabs bought from other units.",
    steps: [
      "Domestic: choose the supplier, then add each quality with the + button. Tick Auto for a block no. made from the quality, or type the number painted on the block.",
      "If the supplier has more than one mine, pick the mine; with one, it is filled in for you.",
      "Enter the billed quantity now and the received quantity when the block arrives. All costing uses the received weight.",
      "Royalty, freight and loading are entered once for the bill and shared over its blocks by weight.",
      "Import: the same, plus BL no. and date, CIF value and each extra charge (duty, CHA, port, freight) with a note.",
    ],
    tip: "Whether a supplier is Domestic or Import is set once, in Masters → Suppliers.",
  },
  {
    key: "unit", view: "unit", sub: "yard", title: "Manufacturing unit",
    what: "The factory floor: block yard, saws and transit damage.",
    steps: [
      "Godown: blocks waiting for the saw. Click Weigh on a block whose received weight is not in yet.",
      "Click Processing when the block goes on the gang saw or wire saw.",
      "When cutting is done, click Create lots and enter each lot with its slab size and count. Machine, hours, power and labour are entered once for the block and split over its lots.",
      "Damage: if a block cracks on the way, record it here. Its cost is spread over the blocks that came with it.",
    ],
    tip: "Blades, resin, netting and polishing are not entered on the saw: what Stores issue each month is spread over the sq ft cut that month.",
  },
  {
    key: "jobwork", view: "unit", sub: "jobwork", title: "Job work",
    what: "A customer's own block cut into slabs here for a charge. The block and slabs stay theirs: they never enter your stock, costs or sales. Switch it on in Settings → sections (We cut customers' blocks).",
    steps: [
      "New job order: pick the customer, thickness, finish and the cutting rate per sq ft of good slabs. Add extras such as resin, polishing, netting or loading, and the free days before yard rent starts.",
      "List each block with the customer's block mark, size, weight and challan no. Write down cracks or chips on arrival so nobody argues later.",
      "The blocks join the Production floor queue with a Job tag. Click Load on saw, then Slabs out when they are cut: enter good slabs and any that broke.",
      "Send slabs back makes a delivery challan for the vehicle. If the customer has dues past credit days or over the credit limit, it stops; only the owner can let it go, with a reason.",
      "Make bill charges good slabs at the order rate, the extras and any yard rent. Broken slabs are billed only if you add them with a reason. Mark payment received when it comes.",
    ],
    tip: "Job work does not take a share of stores cost; that stays on your own slabs.",
  },
  {
    key: "stores", view: "stores", title: "Stores",
    what: "Consumables bought in bulk and issued to the saws and lines: resin, mesh, blades, wire, abrasives, oil.",
    steps: ["Add each item once with New item, with its vendor and the quantity at which to reorder.", "Click Received when a bill comes in.", "Click Issue when something goes to a machine or line. Issues to the factory are spread over the sq ft cut that month; issues to a mine go into its extraction cost.", "Items running low turn red, and Lasts shows how many days are left at the current rate of use."],
  },
  {
    key: "sales", view: "sales", title: "Sales",
    what: "GST invoices for India and export invoices, with payment tracking.",
    steps: [
      "Click New sale and choose the customer.",
      "Click Add lot, type to search, and pick the lot. Tick the exact slabs going on the truck; the sq ft adds up.",
      "Enter the rate, freight and vehicle no. Tax is worked out from the customer’s state: CGST + SGST inside your state, IGST outside.",
      "For an international customer the invoice becomes an export invoice. Tick LUT if you export without paying IGST, and pick the port.",
      "Open the invoice to print it, send it on WhatsApp, or download the e-invoice and e-way bill files for the government portal.",
      "When money comes in, change Payment from Due to Received.",
    ],
    tip: "Use the India / Export and Due / Overdue / Paid filters to see each part of your sales on its own.",
  },
  {
    key: "parties", view: "parties", title: "Masters",
    what: "Customers, suppliers, vendors, transporters, stone qualities and your own mines.",
    steps: [
      "Suppliers are who you buy blocks from. Mark each Domestic or Import and, for domestic ones, add their mines.",
      "Vendors are everyone else you buy from: store items, diesel, machines on hire, wire and spares.",
      "Transporters cover trucks coming in and going out.",
      "Quality is the list purchases pick from. Mines are your own quarries.",
      "For Indian parties, type the GSTIN; the state and PAN fill in for you. Call or WhatsApp a party from the list.",
    ],
  },
  {
    key: "tally", view: "tally", title: "Tally",
    what: "Send your invoices to Tally and see Tally’s figures here.",
    steps: ["Export: download sales or purchases as a Tally XML file and import it in TallyPrime (Gateway of Tally → Import → Transactions). The Tally page lists each step.", "Connect: install the small connector on the computer running Tally to bring sales, receivables and cash figures into the dashboard."],
  },
  {
    key: "team", view: "team", title: "Team",
    what: "Logins for your staff, each seeing only what you allow.",
    steps: ["Click Add person and enter the name and mobile no.", "Pick a role such as Gate, Yard and saw supervisor, Sales or Accountant, or choose Custom and set what they can see and change.", "Choose whether they can see costs and margins.", "Share the login on WhatsApp."],
  },
  {
    key: "settings", view: "settings", title: "Settings and firms",
    what: "Company details, your firms, what your business does, and the rates used for costs.",
    steps: [
      "Fill in the company name, GSTIN, address and pincode. These print on invoices.",
      "Firms: if the mine, the factory and the depot are separate companies, add each one. Then pick a firm from Working in at the top of the menu.",
      "The main account can choose All firms · group view to see everything together.",
      "Set the royalty rate and power and labour rates once; they fill in on every purchase and sawing job.",
      "Download a backup whenever you like.",
    ],
  },
];

const WORDS: [string, string][] = [
  ["Block no.", "The number painted on a rough block, e.g. MW-212."],
  ["Lot", "A group of slabs sold together, usually from one block, e.g. L-121."],
  ["Slab no.", "Block no. plus the slab’s place in the cut, e.g. MW-212/07."],
  ["e-Rawanna", "The mining department’s transit pass. It must travel with every block."],
  ["Landed cost", "What an import really cost at your yard: CIF value plus duty, CHA, port charges and freight."],
  ["FOB / CIF", "FOB: the seller loads it on the ship and the buyer pays the sea freight. CIF: the seller pays freight and insurance up to the buyer’s port."],
  ["LUT", "Letter of Undertaking. Lets you export without paying IGST."],
  ["Challan", "The document that goes with stock moving between your own firms."],
];

export default function Help({ ctx }: { ctx: Ctx }) {
  const [open, setOpen] = useState<string>("inventory");
  const [sure, setSure] = useState(false);
  const owner = ctx.mode === "demo" || !!ctx.me?.isOwner;
  const hasData = ctx.root.blocks.length + ctx.root.sales.length + ctx.root.parties.length > 0;
  const loadSample = () => {
    if (hasData && !sure) { setSure(true); return; }
    ctx.reset(false);
    ctx.say("Sample data loaded in every section", "good");
    ctx.go("overview");
  };

  return (
    <div className="max-w-[980px]">
      <p className="max-w-[62ch] text-[1.02rem] text-ink-2">Karobar360 follows each block from the quarry to the customer’s invoice. Here is how a block moves through the tool, then a short guide to each section.</p>

      {owner && (
        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-[22px] bg-accent-soft p-5">
          <div className="min-w-[240px] flex-1">
            <div className="font-semibold">Practise with sample data</div>
            <p className="mt-0.5 text-[0.9rem] text-ink-2">{sure ? "This replaces the blocks, lots, invoices, customers and stores here with sample ones. Your company name and team stay. Download a backup from Settings first if you need your records." : "Fill every section with a sample stone business: three firms, quarry blocks, imports, slabs, invoices in India and abroad, and stores."}</p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={loadSample}>{sure ? "Yes, load sample data" : "Load sample data"}</button>
            {sure && <button className="btn btn-quiet" onClick={() => setSure(false)}>Cancel</button>}
          </div>
        </div>
      )}

      <h2 className="mt-10 text-[1.25rem] font-semibold tracking-tight">A block’s journey</h2>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {JOURNEY.map((j, i) => {
          const I = j.icon;
          return (
            <li key={j.title} className="rounded-2xl bg-surface p-4">
              <div className="flex items-center gap-2.5">
                <span className="num grid h-7 w-7 place-items-center rounded-full bg-accent text-[0.8rem] font-semibold text-accent-ink">{i + 1}</span>
                <I size={17} className="text-ink-3" />
                <span className="font-medium">{j.title}</span>
              </div>
              <p className="mt-2 text-[0.88rem] text-ink-2">{j.text}</p>
              <p className="mt-2 text-[0.78rem] font-medium text-accent">{j.where}</p>
            </li>
          );
        })}
      </ol>

      <h2 className="mt-10 text-[1.25rem] font-semibold tracking-tight">Section by section</h2>
      <ul className="mt-4 divide-y divide-surface-2 overflow-hidden rounded-[22px] bg-surface">
        {GUIDES.map((g) => {
          const on = open === g.key;
          return (
            <li key={g.key}>
              <button type="button" aria-expanded={on} onClick={() => setOpen(on ? "" : g.key)} className="focusable flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-surface-2/50">
                <span className="flex-1">
                  <span className="block font-medium">{g.title}</span>
                  <span className="block text-[0.86rem] text-ink-2">{g.what}</span>
                </span>
                <ChevronDown size={17} className={`shrink-0 text-ink-3 transition-transform ${on ? "rotate-180" : ""}`} />
              </button>
              {on && (
                <div className="px-5 pb-5">
                  <ol className="space-y-2.5">
                    {g.steps.map((s, i) => (
                      <li key={i} className="flex gap-3 text-[0.92rem]">
                        <span className="num mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 text-[0.75rem] font-semibold">{i + 1}</span>
                        <span className="leading-relaxed">{s}</span>
                      </li>
                    ))}
                  </ol>
                  {g.tip && <p className="mt-3 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[0.86rem] text-ink-2">{g.tip}</p>}
                  <button className="btn btn-quiet btn-sm mt-4" onClick={() => ctx.go(g.view, g.sub)}>Open {g.title.split(" (")[0]} <ArrowRight size={14} /></button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <h2 className="mt-10 text-[1.25rem] font-semibold tracking-tight">Words used in the tool</h2>
      <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {WORDS.map(([w, d]) => (
          <div key={w}><dt className="font-medium">{w}</dt><dd className="mt-0.5 text-[0.88rem] text-ink-2">{d}</dd></div>
        ))}
      </dl>

      <div className="mt-10 flex flex-wrap items-center gap-4 rounded-2xl bg-surface px-5 py-4">
        <div className="min-w-[220px] flex-1"><div className="font-semibold">Still stuck?</div><div className="text-[0.88rem] text-ink-2">Send us a message and we will call or WhatsApp you back.</div></div>
        <a className="btn btn-primary btn-sm" href="/contact">Contact us</a>
      </div>
    </div>
  );
}
