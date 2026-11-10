import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Build your dashboard · Karobar360",
  description: "Answer a few questions about your business and get a dashboard for sales, cash, stock, staff and GST in about five minutes.",
};

export default function BuildLayout({ children }: { children: React.ReactNode }) {
  return children;
}
