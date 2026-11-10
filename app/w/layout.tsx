import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboards · Karobar360", robots: { index: false } };

export default function WorkspacesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
