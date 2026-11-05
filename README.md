# Karobar360

Operations software for Indian MSMEs. The first vertical is natural stone: quarries, gang-saw units, depots and stone traders.

## What the stone workspace covers

- **Blocks**: own-quarry, bought and imported blocks, with royalty, e-Rawanna, weighbridge checks, transit damage and QR labels.
- **Processing unit**: block yard, sawing jobs, per-slab records (Block no. / slab no.), lots, and cost per sq ft.
- **Slab stock and sales**: lots and slab counts, GST and export invoices (LUT, port, shipping bill), e-invoice and e-way bill JSON, India and export filters, payment status.
- **Import and export**: FOB/CIF, freight booking, landed cost, minimum import price check, BL reading, and a step-by-step guide.
- **Multi-firm groups**: separate firms for the mine, the processing unit and distribution. Blocks and lots move between firms with a challan, and "Trace a block" follows any block from quarry to customer.
- **Stores, Tally export, team roles, dealer catalogue.**

## Stack

Next.js 16, React 19, Tailwind CSS v4, Supabase (custom auth through SECURITY DEFINER RPCs).

## Run locally

```bash
npm install
npm run dev
```

The demo company at `/stone/demo` runs fully in the browser with sample data.

## Environment variables

| Name | Purpose |
| --- | --- |
| `K360_SUPABASE_URL` | Supabase project URL |
| `K360_SUPABASE_KEY` | Supabase publishable key |
| `K360_SECRET` | Server secret checked by the database RPCs; never commit it |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Optional, for reading bills of lading |
| `K360_LOCAL` | Set to `1` to run against local storage instead of Supabase |
