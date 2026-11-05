import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Karobar360 — operations software shaped around your MSME",
  description: "Describe how your factory, warehouse or trading business runs. Karobar360 builds a dashboard for sales, finance, stock, production, staff, payroll and GST — in English or Hindi.",
};

export const viewport: Viewport = { themeColor: "#eef0ec" };

const boot = `(function(){try{var d=document.documentElement;d.classList.add('js');var t=localStorage.getItem('karobar360.theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches))d.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
      </head>
      <body className="min-h-screen bg-ground text-ink">{children}</body>
    </html>
  );
}
