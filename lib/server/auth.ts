import { cookies } from "next/headers";
import { rpc } from "./db";
import type { Me } from "@/lib/stone/perm";
import { SITE_URL } from "@/lib/site";
import { sign, verify } from "./sign";

export const COOKIE = "k360s";

export async function currentUser(): Promise<{ me: Me; token: string } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token || token.length < 20) return null;
  try {
    const me = await rpc<Me | null>("k_me", { p_token: token });
    return me ? { me, token } : null;
  } catch {
    return null;
  }
}

export async function setSession(token: string) {
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 30 * 86400 });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

/** Logins are mobile numbers or short usernames: lowercase, no spaces, Indian numbers without +91. */
export function normLogin(s: string) {
  const raw = String(s || "").trim().toLowerCase();
  if (raw.includes("@")) return raw; // email logins keep their dots, dashes and plus signs
  let v = raw.replace(/[\s-]/g, "");
  if (/^(\+?91)?[6-9]\d{9}$/.test(v)) v = v.slice(-10);
  return v;
}
export const validLogin = (v: string) => /^[a-z0-9._@]{3,40}$/.test(v) || validEmail(v);
export const validEmail = (v: string) => v.length <= 120 && /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(v);

// ─── Email sign-in (Google or magic link) ───────────────────────────────────

/** Set after Google or a magic link proves the email, while the person sets up their company. */
export const VERIFIED = "k360v";
export type Verified = { email: string; name: string; via: "google" | "email" };

/** Where links and redirects point. Production always uses the real site address, never a header. */
export function originOf(req: Request) {
  if (process.env.VERCEL_ENV === "production") return SITE_URL;
  const h = req.headers;
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}

export async function verifiedEmail(): Promise<Verified | null> {
  const jar = await cookies();
  return verify<Verified>("verified", jar.get(VERIFIED)?.value);
}

/**
 * The email is proven. Sign in if a login with this email exists; otherwise remember the email
 * for an hour and send the person to set up their company. Returns the path to go to.
 */
export async function finishEmail(v: Verified): Promise<string> {
  const r = await rpc<{ token?: string; user?: Me; error?: string } | null>("k_session_for", { p_login: v.email });
  const jar = await cookies();
  if (r?.token) {
    await setSession(r.token);
    jar.delete(VERIFIED);
    return "/stone";
  }
  if (r?.error === "inactive") return "/stone?err=inactive";
  jar.set(VERIFIED, sign("verified", v, 3600), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 3600 });
  return "/stone?welcome=1";
}
