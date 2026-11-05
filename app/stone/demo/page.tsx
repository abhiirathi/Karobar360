import type { Metadata } from "next";
import StoneApp from "@/components/stone/StoneApp";

export const metadata: Metadata = {
  title: "Demo: natural stones · Karobar360",
  description: "Try the natural stones dashboard with a sample Kishangarh company.",
};

export default function Page() {
  return <StoneApp mode="demo" />;
}
