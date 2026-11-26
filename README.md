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

Sign-in is email only: Continue with Google, or a magic link plus 6-digit code (the code is for the installed app). The owner adds staff by email on the Team page and can limit each person to some firms of the group. Settings → Your data has an Excel template for importing existing records.

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
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional; Google sign-in. If unset, read from the database's `k_config` table |
| `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_HOST` | Optional; mailbox for sign-in links, codes and team invites (Gmail + app password). If unset, read from `k_config` |
| `K360_LOCAL` | Set to `1` to run against local storage instead of Supabase |
