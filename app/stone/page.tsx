import type { Metadata } from "next";
import StoneApp from "@/components/stone/StoneApp";

export const metadata: Metadata = {
  title: "Natural stones · Karobar360",
  description: "Mines, processing unit, depot and imports for natural stone businesses in Rajasthan.",
};

export default function Page() {
  return <StoneApp mode="cloud" />;
}
