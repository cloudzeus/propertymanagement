import type { MetadataRoute } from "next";
const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://property.dgsmart.gr";
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/super-admin", "/admin", "/manager", "/staff", "/owner", "/portal", "/marketplace", "/api"] }], sitemap: `${BASE}/sitemap.xml` };
}
