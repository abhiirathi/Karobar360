import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // Public pages only; signed-in screens, shared dashboards and APIs stay out of search.
    rules: { userAgent: "*", allow: ["/", "/pricing", "/contact", "/build"], disallow: ["/api/", "/w/", "/c/", "/share", "/stone"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
