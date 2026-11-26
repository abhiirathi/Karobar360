// Server-only settings for sign-in: Google OAuth client and the mailbox that sends magic links.
// Read from environment variables first; anything missing there comes from the database's
// k_config table (reachable only with K360_SECRET), so keys can be changed without a redeploy.
import { rpc } from "./db";

export type Cfg = {
  googleId: string;
  googleSecret: string;
  smtpUser: string; // e.g. a Gmail address
  smtpPass: string; // Gmail app password
  smtpHost: string;
  smtpFrom: string;
};

let cache: { at: number; cfg: Cfg } | null = null;

export async function config(): Promise<Cfg> {
  if (cache && Date.now() - cache.at < 60_000) return cache.cfg;
  let db: Record<string, string> = {};
  if (process.env.K360_LOCAL !== "1") {
    try { db = (await rpc<Record<string, string> | null>("k_config_get", {})) ?? {}; } catch { db = {}; }
  }
  const e = process.env;
  const cfg: Cfg = {
    googleId: e.GOOGLE_CLIENT_ID || db.google_client_id || "",
    googleSecret: e.GOOGLE_CLIENT_SECRET || db.google_client_secret || "",
    smtpUser: e.SMTP_USER || db.smtp_user || "",
    smtpPass: (e.SMTP_PASS || db.smtp_pass || "").replace(/\s+/g, ""),
    smtpHost: e.SMTP_HOST || db.smtp_host || "smtp.gmail.com",
    smtpFrom: e.SMTP_FROM || db.smtp_from || "",
  };
  cache = { at: Date.now(), cfg };
  return cfg;
}
