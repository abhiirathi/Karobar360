import type { Metadata } from "next";
import StoneApp from "@/components/stone/StoneApp";

export const metadata: Metadata = { title: "Block · Karobar360" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StoneApp mode="cloud" initialView="scan" initialSub={id} />;
}
