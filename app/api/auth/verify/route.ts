// The link in a sign-in email lands here.
import { finishEmail, originOf } from "@/lib/server/auth";
import { verify } from "@/lib/server/sign";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const origin = originOf(req);
  const t = verify<{ email: string }>("magic", new URL(req.url).searchParams.get("t"));
  if (!t) return Response.redirect(`${origin}/stone?err=link`, 302);
  try {
    const path = await finishEmail({ email: t.email, name: "", via: "email" });
    return Response.redirect(`${origin}${path}`, 302);
  } catch (e) {
    console.error("verify", e);
    return Response.redirect(`${origin}/stone?err=server`, 302);
  }
}
