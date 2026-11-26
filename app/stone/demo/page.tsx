import type { Metadata } from "next";
import { redirect } from "next/navigation";
import StoneApp from "@/components/stone/StoneApp";
import { currentUser } from "@/lib/server/auth";

export const metadata: Metadata = {
  title: "Sample company: natural stones · Karobar360",
  description: "The natural stones dashboard with a sample Kishangarh company.",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

// The stone dashboard never opens without signing in, the sample company included.
export default async function Page() {
  if (!(await currentUser())) redirect("/stone");
  return <StoneApp mode="demo" />;
}
