import { rpc } from "@/lib/server/db";
import { currentUser, json } from "@/lib/server/auth";
import { notify } from "@/lib/server/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

// What customers can ask for. The label goes in the email subject.
const KINDS: Record<string, string> = {
  contact: "Contact form",
  website: "Website request",
  gbp: "Google Business Profile",
  photos: "Slab photo shoot and catalogue",
  whatsapp: "WhatsApp Business setup",
  setup: "Data entry and setup",
  training: "Staff training",
  custom: "Custom feature",
};

const clean = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f]/g, "").trim().slice(0, n);

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b) return json({ error: "Send the form again." }, 400);
  if (b.website_url) return json({ ok: true }); // honeypot: bots fill hidden fields
  const kind = KINDS[b.kind] ? String(b.kind) : "contact";
  const name = clean(b.name, 120), phone = clean(b.phone, 40), email = clean(b.email, 160), company = clean(b.company, 160), message = clean(b.message, 4000);
  if (!name) return json({ error: "Please enter your name." }, 400);
  if (!phone && !email) return json({ error: "Please enter a mobile number or email so we can reply." }, 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "That email does not look right." }, 400);
  const details: Record<string, string> = {};
  if (b.details && typeof b.details === "object") for (const [k, v] of Object.entries(b.details).slice(0, 20)) details[clean(k, 40)] = clean(v, 500);

  const u = await currentUser().catch(() => null);
  const saved = await rpc<{ ok: boolean; id?: string; error?: string }>("k_request_add", {
    p_kind: kind, p_org: u?.me.orgId ?? null, p_user: u?.me.id ?? null, p_name: name, p_company: company, p_phone: phone, p_email: email, p_message: message, p_details: details,
  }).catch(() => null);
  if (!saved?.ok) return json({ error: "We could not save that just now. Please try again in a minute, or WhatsApp us." }, 503);

  const origin = new URL(req.url).origin;
  const sent = await notify({
    subject: `Karobar360: ${KINDS[kind]} from ${company || name}`,
    replyTo: email || undefined,
    origin,
    fields: { Request: KINDS[kind], Name: name, Company: company, Mobile: phone, Email: email, ...Object.fromEntries(Object.entries(details).map(([k, v]) => [k, v])), Message: message, Account: u ? `${u.me.orgName} (signed in as ${u.me.name})` : "Not signed in" },
  });
  if (sent && saved.id) await rpc("k_request_mark", { p_id: saved.id }).catch(() => {});
  return json({ ok: true });
}
