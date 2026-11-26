import { rpc } from "@/lib/server/db";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { clearSession, currentUser, finishEmail, json, originOf, setSession, validEmail, VERIFIED, verifiedEmail } from "@/lib/server/auth";
import { config } from "@/lib/server/config";
import { sendMagicLink } from "@/lib/server/mail";
import { sign } from "@/lib/server/sign";
import { DEFAULT_SETTINGS } from "@/lib/stone/seed";
import { presetModules } from "@/lib/stone/modules";
import { kindModules } from "@/lib/stone/firms";
import { uid } from "@/lib/stone/calc";
import type { Me } from "@/lib/stone/perm";
import type { Firm, Modules, StoneSettings } from "@/lib/stone/types";

export const dynamic = "force-dynamic";

const codeHash = (email: string, code: string) => createHash("sha256").update(`${email}:${code}:${process.env.K360_SECRET ?? ""}`).digest("hex");

export async function GET(_: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (action !== "me") return json({ error: "Not found" }, 404);
  const u = await currentUser();
  if (u) return json({ me: u.me });
  const [pending, c] = await Promise.all([verifiedEmail(), config()]);
  return json({ me: null, pending: pending ? { email: pending.email, name: pending.name } : null, google: !!(c.googleId && c.googleSecret), email: !!(c.smtpUser && c.smtpPass) || process.env.K360_LOCAL === "1" });
}

type Biz = { kind: "mine" | "processing" | "distribution"; name: string; gstin: string };
type Setup = { gstin?: string; address?: string; city?: string; state?: string; phone?: string; pincode?: string; invoicePrefix?: string; modules?: Partial<Modules>; businesses?: Biz[] };

const FLOW = ["mine", "processing", "distribution"] as const;
const initials = (name: string) => name.replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 4) || "INV";
const prefixOf = (name: string) => `${initials(name)}/26-27/`;
// Each firm numbers its own invoices; a short code per business keeps the series apart.
const CODE = { mine: "MIN", processing: "MFG", distribution: "DST" } as const;

/**
 * The parent account and the businesses ticked at sign-up. One business: the account is that company.
 * Two or three: each becomes a firm of the group (mine, manufacturing, distribution, in that order).
 */
function accountSettings(group: string, setup: Setup): StoneSettings {
  const city = String(setup.city ?? "").slice(0, 60);
  const state = String(setup.state ?? "08").slice(0, 2);
  const phone = String(setup.phone ?? "").slice(0, 20);
  const list = (Array.isArray(setup.businesses) ? setup.businesses : [])
    .filter((b) => FLOW.includes(b?.kind))
    .filter((b, i, a) => a.findIndex((x) => x.kind === b.kind) === i)
    .sort((a, b) => FLOW.indexOf(a.kind) - FLOW.indexOf(b.kind))
    .map((b) => ({ kind: b.kind, name: String(b.name ?? "").trim().slice(0, 80) || group, gstin: String(b.gstin ?? "").toUpperCase().replace(/\s/g, "").slice(0, 15) }));
  if (!list.length) return settingsFor(group, setup, phone);
  const base = settingsFor(group, { ...setup, modules: undefined }, phone);
  if (list.length === 1) {
    const b = list[0];
    return { ...base, company: b.name, gstin: b.gstin, invoicePrefix: prefixOf(b.name), modules: kindModules(b.kind) };
  }
  const firms: Firm[] = list.map((b) => ({ id: uid(), name: b.name, kind: b.kind, gstin: b.gstin, address: "", city, state, pincode: "", phone, invoicePrefix: `${initials(group)}-${CODE[b.kind]}/26-27/`, modules: kindModules(b.kind) }));
  const modules = presetModules({});
  for (const f of firms) for (const k of Object.keys(modules) as (keyof Modules)[]) modules[k] = modules[k] || !!f.modules[k];
  return { ...base, company: group, modules, firms };
}

function settingsFor(company: string, setup: Setup, phone: string): StoneSettings {
  return {
    ...DEFAULT_SETTINGS,
    company, gstin: String(setup.gstin ?? "").toUpperCase().slice(0, 15), address: String(setup.address ?? "").slice(0, 160),
    city: String(setup.city ?? "").slice(0, 60), state: String(setup.state ?? "08").slice(0, 2), phone: String(setup.phone ?? phone).slice(0, 20),
    pincode: String(setup.pincode ?? "").slice(0, 6), invoicePrefix: String(setup.invoicePrefix ?? "INV/26-27/").slice(0, 20),
    ownMines: [], machines: DEFAULT_SETTINGS.machines,
    modules: presetModules((setup.modules ?? { depot: true }) as Partial<Modules>),
  };
}

export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    if (action === "magic") {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!validEmail(email)) return json({ error: "Enter a valid email address." }, 400);
      const link = `${originOf(req)}/api/auth/verify?t=${encodeURIComponent(sign("magic", { email }, 1200))}`;
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      await rpc("k_magic_put", { p_email: email, p_code_hash: codeHash(email, code) });
      const r = await sendMagicLink(email, link, code);
      if (!r.ok) return json({ error: r.reason === "not_configured" ? "Email sign-in is not switched on yet. Use Google or your mobile number." : "Could not send the email. Check the address and try again." }, r.reason === "not_configured" ? 503 : 502);
      return json({ ok: true });
    }
    if (action === "code") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const code = String(body.code ?? "").replace(/\D/g, "");
      if (!validEmail(email) || code.length !== 6) return json({ error: "Enter the 6-digit code from the email." }, 400);
      const ok = await rpc<boolean>("k_magic_check", { p_email: email, p_code_hash: codeHash(email, code) });
      if (!ok) return json({ error: "That code is not right or has expired. Check the latest email, or ask for a new one." }, 401);
      return json({ next: await finishEmail({ email, name: "", via: "email" }) });
    }
    if (action === "onboard") {
      const v = await verifiedEmail();
      if (!v) return json({ error: "Your sign-in expired. Sign in with Google or email again." }, 401);
      const company = String(body.company ?? "").trim().slice(0, 80);
      const name = String(body.name ?? v.name ?? "").trim().slice(0, 60);
      if (!company || !name) return json({ error: "Enter the company name and your name." }, 400);
      const r = await rpc<{ token?: string; user?: Me; error?: string }>("k_signup", { p_org: company, p_name: name, p_login: v.email, p_pass: randomBytes(18).toString("base64url") });
      if (r.error === "login_taken") { await finishEmail(v); return json({ ok: true }); }
      if (r.error || !r.token || !r.user) return json({ error: "Could not create the company. Try again." }, 400);
      const setup = (body.setup ?? {}) as Setup;
      await rpc("k_data_put_many", { p_org: r.user.orgId, p_user: r.user.id, p_items: [{ section: "settings", data: accountSettings(company, setup), base: null }] });
      await setSession(r.token);
      (await cookies()).delete(VERIFIED);
      return json({ me: r.user });
    }
    if (action === "logout") {
      const u = await currentUser();
      if (u) await rpc("k_logout", { p_token: u.token });
      await clearSession();
      (await cookies()).delete(VERIFIED);
      return json({ ok: true });
    }
  } catch (e) {
    console.error("auth", action, e);
    return json({ error: "The server could not reach the database. Try again in a minute." }, 500);
  }
  return json({ error: "Not found" }, 404);
}
