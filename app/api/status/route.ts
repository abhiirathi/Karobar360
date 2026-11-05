import { aiEnabled, aiModel } from "@/lib/gemini";
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ ai: aiEnabled(), model: aiEnabled() ? aiModel() : null });
}
