// Short-lived signed values (magic links, a verified email waiting for company setup, OAuth state).
// HMAC with the server secret, so nothing needs to be stored in the database.
import { createHmac, timingSafeEqual } from "node:crypto";

const key = () => process.env.K360_SECRET || (process.env.K360_LOCAL === "1" ? "local-dev-secret" : "");

const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");

export function sign(purpose: string, data: Record<string, unknown>, ttlSec: number): string {
  const k = key();
  if (!k) throw new Error("K360_SECRET is not set on the server");
  const body = b64(JSON.stringify({ ...data, p: purpose, exp: Math.floor(Date.now() / 1000) + ttlSec }));
  const mac = createHmac("sha256", k).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verify<T extends Record<string, unknown>>(purpose: string, token: string | undefined | null): T | null {
  const k = key();
  if (!k || !token || token.length > 2000) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const want = createHmac("sha256", k).update(body).digest();
  const got = Buffer.from(mac, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const d = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { p: string; exp: number };
    if (d.p !== purpose || d.exp < Date.now() / 1000) return null;
    return d;
  } catch {
    return null;
  }
}
