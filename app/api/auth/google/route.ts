// Starts "Continue with Google": sends the person to Google's sign-in page.
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { originOf } from "@/lib/server/auth";
import { config } from "@/lib/server/config";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const origin = originOf(req);
  const { googleId } = await config();
  if (!googleId) return Response.redirect(`${origin}/stone?err=google_off`, 302);
  const state = randomBytes(16).toString("hex");
  const jar = await cookies();
  jar.set("k360g", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
  const q = new URLSearchParams({
    client_id: googleId,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`, 302);
}
