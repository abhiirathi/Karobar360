import { rpc } from "@/lib/server/db";
import { clearSession, currentUser, json, normLogin, setSession, validLogin } from "@/lib/server/auth";
import { DEFAULT_SETTINGS } from "@/lib/stone/seed";
import { presetModules } from "@/lib/stone/modules";
import type { Me } from "@/lib/stone/perm";
import type { Modules, StoneSettings } from "@/lib/stone/types";

export const dynamic = "force-dynamic";

const ERR: Record<string, string> = {
  bad_login: "That mobile number or password is not right.",
  locked: "Too many wrong tries. Wait 10 minutes and try again, or ask your owner to reset the password.",
  inactive: "This login has been switched off by your company.",
  login_taken: "Someone already uses this mobile number or username. Try another, or sign in.",
};

export async function GET(_: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (action !== "me") return json({ error: "Not found" }, 404);
  const u = await currentUser();
  return json({ me: u?.me ?? null });
}

export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    if (action === "login") {
      const login = normLogin(body.login);
      if (!login || !body.password) return json({ error: "Enter your mobile number and password." }, 400);
      const r = await rpc<{ token?: string; user?: Me; error?: string }>("k_login", { p_login: login, p_pass: String(body.password) });
      if (r.error || !r.token) return json({ error: ERR[r.error ?? "bad_login"] ?? "Could not sign in." }, 401);
      await setSession(r.token);
      return json({ me: r.user });
    }
    if (action === "signup") {
      const login = normLogin(body.login);
      const company = String(body.company ?? "").trim().slice(0, 80);
      const name = String(body.name ?? "").trim().slice(0, 60);
      const pass = String(body.password ?? "");
      if (!company || !name) return json({ error: "Enter the company name and your name." }, 400);
      if (!validLogin(login)) return json({ error: "Use a 10-digit mobile number or a short username." }, 400);
      if (pass.length < 6) return json({ error: "Password needs at least 6 characters." }, 400);
      const r = await rpc<{ token?: string; user?: Me; error?: string }>("k_signup", { p_org: company, p_name: name, p_login: login, p_pass: pass });
      if (r.error || !r.token || !r.user) return json({ error: ERR[r.error ?? ""] ?? "Could not create the account." }, 400);
      const setup = body.setup ?? {};
      const settings: StoneSettings = {
        ...DEFAULT_SETTINGS,
        company, gstin: String(setup.gstin ?? "").toUpperCase().slice(0, 15), address: String(setup.address ?? "").slice(0, 160),
        city: String(setup.city ?? "").slice(0, 60), state: String(setup.state ?? "08").slice(0, 2), phone: String(setup.phone ?? login).slice(0, 20),
        pincode: String(setup.pincode ?? "").slice(0, 6), invoicePrefix: String(setup.invoicePrefix ?? "INV/26-27/").slice(0, 20),
        ownMines: [], machines: DEFAULT_SETTINGS.machines,
        modules: presetModules((setup.modules ?? { depot: true }) as Partial<Modules>),
      };
      await rpc("k_data_put_many", { p_org: r.user.orgId, p_user: r.user.id, p_items: [{ section: "settings", data: settings, base: null }] });
      await setSession(r.token);
      return json({ me: r.user });
    }
    if (action === "logout") {
      const u = await currentUser();
      if (u) await rpc("k_logout", { p_token: u.token });
      await clearSession();
      return json({ ok: true });
    }
  } catch (e) {
    console.error("auth", action, e);
    return json({ error: "The server could not reach the database. Try again in a minute." }, 500);
  }
  return json({ error: "Not found" }, 404);
}
