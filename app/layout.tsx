import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { SITE_URL } from "@/lib/site";

const description = "Describe how your factory, warehouse or trading business runs. Karobar360 builds a dashboard for sales, finance, stock, production, staff, payroll and GST, in English or Hindi.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Karobar360 — operations software shaped around your MSME",
  description,
  applicationName: "Karobar360",
  // Link previews on WhatsApp, LinkedIn and X; the image comes from app/opengraph-image.tsx.
  openGraph: { type: "website", siteName: "Karobar360", title: "Karobar360: software that runs your way", description, url: "/", locale: "en_IN" },
  twitter: { card: "summary_large_image", title: "Karobar360: software that runs your way", description },
};

// Browser bar colour follows the page background in light and dark mode.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#d3d8d0" },
    { media: "(prefers-color-scheme: dark)", color: "#0d100f" },
  ],
};

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
