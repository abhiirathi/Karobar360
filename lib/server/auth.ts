import { cookies } from "next/headers";
import { rpc } from "./db";
import type { Me } from "@/lib/stone/perm";

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
  let v = String(s || "").trim().toLowerCase().replace(/[\s-]/g, "");
  if (/^(\+?91)?[6-9]\d{9}$/.test(v)) v = v.slice(-10);
  return v;
}
export const validLogin = (v: string) => /^[a-z0-9._@]{3,40}$/.test(v);
