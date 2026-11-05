"use client";
import { useState } from "react";
import { ArrowRight, ChevronDown, Factory, Mountain, ReceiptText, Truck, Warehouse, Wallet } from "lucide-react";
import type { Ctx, View } from "./StoneApp";

type Guide = { key: string; view: View; sub?: string; title: string; what: string; steps: string[]; tip?: string };

const JOURNEY = [
  { icon: Mountain, title: "Block comes in", where: "Mines → own quarry, bought or imported", text: "Note the block no., size, weight, rawanna and vehicle." },
  { icon: Truck, title: "Reaches the yard", where: "Processing unit → Block yard → Receive", text: "Weigh it at the gate. Any shortage against the bill is flagged." },
  { icon: Factory, title: "Cut on the saw", where: "Block yard → Load on saw → Slabs out", text: "Enter how many slabs came out and give them a lot no." },
  { icon: Warehouse, title: "Slabs in stock", where: "Slab stock, by lot or by slab", text: "Every slab carries its block no., so BL-001/07 is always traceable." },
  { icon: ReceiptText, title: "Sold on an invoice", where: "Sales and invoices → New sale", text: "Pick the lot and the exact slabs. GST, e-way bill and export papers are made for you." },
  { icon: Wallet, title: "Payment received", where: "Sales and invoices → Payment column", text: "Switch Due to Received. Overdue invoices show on the dashboard." },
];

const GUIDES: Guide[] = [
  {
    key: "overview", view: "overview", title: "Overview (dashboard)",
    what: "One screen with today’s position: blocks on the road and in the yard, slab stock, sales, money to collect and anything that needs attention.",
    steps: ["Read the alerts at the top. Each one says what is wrong and takes you to the record when you click it.", "Click any figure to open the section behind it.", "Use Customise dashboard to hide panels you don’t need or reorder them."],
  },
  {
    key: "mines", view: "mines", title: "Mines and blocks",
    what: "Every rough block, wherever it came from: your own quarry, bought from a mine owner, or imported.",
    steps: [
      "Own quarry: click Block extracted when a block is cut. When it leaves, click Dispatch and enter the vehicle no. and e-Rawanna.",
      "Bought from mines: click Bought block, choose the supplier and enter the bill no., rate and billed weight.",
      "Imported blocks: they arrive here by themselves when you receive an import shipment. You can also add one with Imported block.",
      "Running costs: log diesel, power, wire, labour and repairs once a week with Cost entry. Cost per tonne then works itself out each month.",
      "QR labels: print a label for each block. Scanning it on a phone opens the block and lets the gate or saw team update it.",
    ],
    tip: "Royalty and DMFT fill in from the rate in Settings. A block without a rawanna is flagged in red.",
  },
  {
    key: "unit", view: "unit", sub: "yard", title: "Processing unit",
    what: "The factory: block yard, saws, slabs, lots and transit damage.",
    steps: [
      "Block yard: when a truck arrives, click Receive and enter the weighbridge net weight.",
      "Click Load on saw when the block goes on the gang saw or wire saw.",
      "When cutting is done, click Slabs out. Enter the number of slabs, then give all of them one lot no. or split them by range (slabs 1–12 in L-121, 13–20 in L-122). Tick any broken slab.",
      "Slabs: every slab is listed with its block no. Tick slabs to move them to another lot or mark them broken.",
      "Lots: each lot shows how many slabs it holds. Send a lot to the depot (or to another firm) when it leaves the unit.",
      "Damage: if a block cracks on the way, record it here. Its cost is spread over the blocks that came with it.",
    ],
    tip: "Power, blades, resin, polishing and labour are filled from the rates in Settings, so cost per sq ft is ready the moment you save.",
  },
  {
    key: "depot", view: "depot", title: "Slab stock",
    what: "Everything ready to sell, at the unit or the depot.",
    steps: ["Switch between By lot and By slab at the top.", "Search by lot no., block no. or variety.", "Open a lot to set its list price and rack location.", "Dealer catalogue makes a link you can send on WhatsApp so dealers see what is in stock."],
  },
  {
    key: "sales", view: "sales", title: "Sales and invoices",
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
    key: "trade", view: "trade", title: "Import and export",
    what: "Containers coming in and going out, from booking to stock.",
    steps: [
      "Click New import (or New export) and enter the supplier, stone and quantity.",
      "Choose FOB or CIF. On FOB imports you book the ship: enter the forwarder, freight and insurance. The CIF value adds itself up.",
      "Upload the bill of lading. The BL no., vessel, ports and containers are read from it for you to check.",
      "As it moves, change the status. Free days at port count down on the dashboard.",
      "After customs, enter the duty and charges, then click Receive. Blocks go to the yard and slabs to the depot, each with its landed cost.",
    ],
    tip: "The same steps are shown at the top of the Import and export page.",
  },
  {
    key: "stores", view: "stores", title: "Stores",
    what: "Consumables bought in bulk and issued to the saws and lines: resin, mesh, blades, wire, abrasives, oil.",
    steps: ["Add each item once with New item, and set the quantity at which to reorder.", "Click Received when a bill comes in.", "Click Issue when something goes to a machine or line.", "Items running low turn red, and Lasts shows how many days are left at the current rate of use."],
  },
  {
    key: "parties", view: "parties", title: "Customers and suppliers",
    what: "Everyone you buy from, sell to, or hire trucks from.",
    steps: ["Choose Indian or International at the top of the form.", "For Indian parties, type the GSTIN; the state and PAN fill in for you.", "Set credit days and a credit limit for customers. Overdue amounts show in red.", "Call or WhatsApp a party straight from the list."],
  },
  {
    key: "trace", view: "trace", title: "Trace a block",
    what: "The full story of one block, lot or slab.",
    steps: ["Type a block no. (MW-212), lot no. (L-121) or slab no. (MW-212/07).", "You see where it came from, each firm it passed through with the challan no., which lot it went into, and which invoice sold it."],
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
      "Set the royalty rate and processing rates once; they fill in on every block and sawing job.",
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
  const [open, setOpen] = useState<string>("unit");
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
    </div>
  );
}
