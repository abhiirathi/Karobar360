// Google sends the person back here with a one-time code; swap it for their verified email.
import { cookies } from "next/headers";
import { finishEmail, originOf } from "@/lib/server/auth";
import { config } from "@/lib/server/config";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const origin = originOf(req);
  const back = (path: string) => Response.redirect(`${origin}${path}`, 302);
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const want = jar.get("k360g")?.value;
  jar.delete("k360g");
  if (url.searchParams.get("error")) return back("/stone");
  if (!code || !state || !want || state !== want) return back("/stone?err=google");
  try {
    const { googleId, googleSecret } = await config();
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: googleId, client_secret: googleSecret, redirect_uri: `${origin}/api/auth/google/callback`, grant_type: "authorization_code" }),
      cache: "no-store",
    });
    const t = (await r.json()) as { id_token?: string };
    if (!r.ok || !t.id_token) { console.error("google token", r.status, JSON.stringify(t).slice(0, 200)); return back("/stone?err=google"); }
    // The token came straight from Google over TLS, so its contents can be read without re-checking the signature.
    const p = JSON.parse(Buffer.from(t.id_token.split(".")[1], "base64url").toString("utf8")) as { aud?: string; email?: string; email_verified?: boolean; name?: string; iss?: string };
    if (p.aud !== googleId || !p.email || !p.email_verified) return back("/stone?err=google");
    const path = await finishEmail({ email: p.email.toLowerCase(), name: String(p.name ?? "").slice(0, 60), via: "google" });
    return back(path);
  } catch (e) {
    console.error("google callback", e);
    return back("/stone?err=server");
  }
}
