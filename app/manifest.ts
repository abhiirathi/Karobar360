import type { MetadataRoute } from "next";

// Makes Karobar360 installable as an app on PCs (Chrome, Edge), Android and iPhone.
// The installed app opens straight to sign-in, or the dashboard when already signed in.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/stone",
    name: "Karobar360",
    short_name: "Karobar360",
    description: "Stock, sales, purchases and payments for your stone business, on PC and phone.",
    start_url: "/stone",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#d3d8d0",
    theme_color: "#d3d8d0",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
