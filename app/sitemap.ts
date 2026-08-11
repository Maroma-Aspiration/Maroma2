import type { MetadataRoute } from "next";
import { listArchiveSummaries } from "../lib/newsletter-archive-storage";
import { ARCHIVE_INDEX_URL, archiveIssueUrl, SITE_URL } from "../lib/newsletter-archive-seo";
import { readStoriesState } from "../lib/story-storage";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [issues, state] = await Promise.all([listArchiveSummaries(), readStoriesState()]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/blog`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/newsletter`, changeFrequency: "weekly", priority: 0.9 },
    { url: ARCHIVE_INDEX_URL, changeFrequency: "weekly", priority: 0.85 },
  ];

  const archivePages: MetadataRoute.Sitemap = issues.map((issue) => ({
    url: archiveIssueUrl(issue.slug),
    lastModified: issue.sentAt,
    changeFrequency: "yearly" as const,
    priority: 0.75,
  }));

  const blogPages: MetadataRoute.Sitemap = (state.stories ?? [])
    .filter((story) => story.slug?.trim())
    .map((story) => ({
      url: `${SITE_URL}/blog/${story.slug}`,
      lastModified: story.updatedAt || story.publishedAt || undefined,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));

  return [...staticPages, ...archivePages, ...blogPages];
}
