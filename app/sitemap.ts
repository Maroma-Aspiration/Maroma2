import type { MetadataRoute } from "next";
import { catalogCategories } from "../lib/catalog-categories";
import { listArchiveSummaries } from "../lib/newsletter-archive-storage";
import { ARCHIVE_INDEX_URL, archiveIssueUrl, SITE_URL } from "../lib/newsletter-archive-seo";
import { readLiveStorefrontCatalog } from "../lib/product-catalog-admin";
import { hasDisplayImage } from "../lib/product-image";
import { getJournalStories } from "../lib/journal-stories";
import { readStoriesState } from "../lib/story-storage";
import { listIngredientPages } from "../lib/ingredient-pages";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [issues, state, catalog] = await Promise.all([
    listArchiveSummaries(),
    readStoriesState(),
    readLiveStorefrontCatalog(),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.85 },
    { url: `${SITE_URL}/blog`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/newsletter`, changeFrequency: "weekly", priority: 0.9 },
    { url: ARCHIVE_INDEX_URL, changeFrequency: "weekly", priority: 0.85 },
    { url: `${SITE_URL}/search`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE_URL}/shop`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/gifting/build-your-set`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/rituals`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/shipping`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/returns`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/safety-guidelines`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE_URL}/ingredient`, changeFrequency: "monthly", priority: 0.6 },
  ];

  const ingredientPages: MetadataRoute.Sitemap = listIngredientPages().map((item) => ({
    url: `${SITE_URL}/ingredient/${item.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.55,
  }));

  const categoryPages: MetadataRoute.Sitemap = catalogCategories.map((category) => ({
    url: `${SITE_URL}/${category.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.85,
  }));

  const productPages: MetadataRoute.Sitemap = catalog.products
    .filter((product) => hasDisplayImage(product))
    .map((product) => ({
      url: `${SITE_URL}/product/${product.id}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  const archivePages: MetadataRoute.Sitemap = issues.map((issue) => ({
    url: archiveIssueUrl(issue.slug),
    lastModified: issue.sentAt,
    changeFrequency: "yearly" as const,
    priority: 0.75,
  }));

  const journalStories = await getJournalStories(state);

  const blogPages: MetadataRoute.Sitemap = journalStories
    .filter((story) => story.slug?.trim())
    .map((story) => ({
      url: `${SITE_URL}/blog/${story.slug}`,
      lastModified: story.updatedAt || story.publishedAt || undefined,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));

  return [...staticPages, ...categoryPages, ...productPages, ...ingredientPages, ...archivePages, ...blogPages];
}
