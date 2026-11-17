import { ImageResponse } from "next/og";
import { AppIconArt } from "@/lib/appIcon";

// App icons for the install manifest: /icons/192.png, /icons/512.png, /icons/maskable-512.png
const ICONS: Record<string, { size: number; maskable: boolean }> = {
  "192.png": { size: 192, maskable: false },
  "512.png": { size: 512, maskable: false },
  "maskable-512.png": { size: 512, maskable: true },
};

export const dynamic = "force-static";
export function generateStaticParams() {
  return Object.keys(ICONS).map((name) => ({ name }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const icon = ICONS[(await params).name];
  if (!icon) return new Response("Not found", { status: 404 });
  const { size, maskable } = icon;
  return new ImageResponse(<AppIconArt size={size} pad={maskable ? 0.26 : 0.18} round={!maskable} />, { width: size, height: size });
}
