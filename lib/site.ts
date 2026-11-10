// The live site's address, for share previews, robots and the sitemap.
// Vercel sets VERCEL_PROJECT_PRODUCTION_URL to the production domain on every build.
export const SITE_URL = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || "karobar360-ecru.vercel.app"}`;
