import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/newsletter-archive-seo";

/**
 * Allow major search and AI crawlers. Preview-password gating (when enabled)
 * still blocks anonymous HTML access at the edge — remove MAROMA_PREVIEW_PASSWORD
 * before expecting public indexing.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/preview-access", "/checkout", "/cart", "/account", "/login", "/signup", "/b2b/"],
      },
      {
        userAgent: "OAI-SearchBot",
        allow: "/",
        disallow: ["/admin/", "/api/", "/preview-access", "/checkout", "/cart", "/account", "/b2b/"],
      },
      {
        userAgent: "ChatGPT-User",
        allow: "/",
        disallow: ["/admin/", "/api/", "/preview-access", "/checkout", "/cart", "/account", "/b2b/"],
      },
      {
        userAgent: "GPTBot",
        allow: "/",
        disallow: ["/admin/", "/api/", "/preview-access", "/checkout", "/cart", "/account", "/b2b/"],
      },
      {
        userAgent: "Google-Extended",
        allow: "/",
        disallow: ["/admin/", "/api/", "/preview-access", "/checkout", "/cart", "/account", "/b2b/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
