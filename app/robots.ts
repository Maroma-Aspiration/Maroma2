import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/newsletter-archive-seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
