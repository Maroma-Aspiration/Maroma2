import type { Metadata } from "next";
import type { NewsletterArchiveIssue, NewsletterArchiveSummary } from "./newsletter-archive-types";
import type { NewsletterCanvas } from "./story-types";
import { pickThumbnailFromCanvas } from "./newsletter-archive-utils";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://maroma.com").replace(/\/$/, "");
export const ARCHIVE_INDEX_URL = `${SITE_URL}/newsletter/archive`;

function safeMetadataBase(url: string): URL {
  try {
    return new URL(url);
  } catch {
    return new URL("https://maroma.com");
  }
}

export function archiveIssueUrl(slug: string): string {
  return `${ARCHIVE_INDEX_URL}/${slug}`;
}

export function buildArchiveIndexDescription(issues: NewsletterArchiveSummary[]): string {
  if (issues.length === 0) {
    return "Browse past Maroma newsletters: natural fragrance, ritual, and community stories from Auroville.";
  }
  const latest = issues.slice(0, 3).map((issue) => issue.subject);
  return `Past Maroma newsletters: ${latest.join(", ")}. Natural fragrance, ritual & community from Auroville.`;
}

export function buildArchiveIssueDescription(issue: NewsletterArchiveIssue): string {
  if (issue.previewText.trim()) return issue.previewText.trim();
  for (const el of issue.canvas.elements ?? []) {
    if (el.kind === "text") {
      const plain = el.html?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (plain && plain.length > 40) {
        return plain.length > 220 ? `${plain.slice(0, 217)}…` : plain;
      }
    }
    if (el.kind === "story-grid") {
      for (const story of el.stories ?? []) {
        const excerpt = story.excerpt?.trim();
        if (excerpt && excerpt.length > 40) {
          return excerpt.length > 220 ? `${excerpt.slice(0, 217)}…` : excerpt;
        }
      }
    }
  }
  return `${issue.subject} | Maroma newsletter from ${new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(issue.sentAt))}.`;
}

export function buildArchiveOgImage(issue: NewsletterArchiveIssue): string | undefined {
  if (issue.thumbnailUrl?.trim()) return issue.thumbnailUrl.trim();
  return pickThumbnailFromCanvas(issue.canvas);
}

export function buildOgImageFromCanvas(canvas: NewsletterCanvas | undefined): string | undefined {
  if (!canvas?.elements?.length) return undefined;
  return pickThumbnailFromCanvas(canvas);
}

export function buildArchiveIndexMetadata(issues: NewsletterArchiveSummary[]): Metadata {
  const description = buildArchiveIndexDescription(issues);
  const latestImage = issues.find((issue) => issue.thumbnailUrl)?.thumbnailUrl;
  const images = latestImage ? [{ url: latestImage, width: 1200, height: 630, alt: "Maroma newsletter archive" }] : undefined;

  return {
    title: "Newsletter archive | Maroma",
    description,
    metadataBase: safeMetadataBase(SITE_URL),
    alternates: { canonical: ARCHIVE_INDEX_URL },
    openGraph: {
      type: "website",
      url: ARCHIVE_INDEX_URL,
      siteName: "Maroma",
      title: "Newsletter archive | Maroma",
      description,
      images,
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: "Newsletter archive | Maroma",
      description,
      images: images?.map((img) => img.url),
    },
    robots: { index: true, follow: true },
  };
}

export function buildArchiveIssueMetadata(issue: NewsletterArchiveIssue): Metadata {
  const title = `${issue.subject} | Maroma Newsletter`;
  const description = buildArchiveIssueDescription(issue);
  const url = archiveIssueUrl(issue.slug);
  const ogImage = buildArchiveOgImage(issue);
  const images = ogImage ? [{ url: ogImage, width: 1200, height: 630, alt: issue.subject }] : undefined;

  return {
    title,
    description,
    metadataBase: safeMetadataBase(SITE_URL),
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      siteName: "Maroma",
      title,
      description,
      images,
      locale: "en_US",
      publishedTime: issue.sentAt,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images?.map((img) => img.url),
    },
    robots: { index: true, follow: true },
  };
}

export function buildArchiveIndexJsonLd(issues: NewsletterArchiveSummary[]) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Maroma Newsletter Archive",
    description: buildArchiveIndexDescription(issues),
    url: ARCHIVE_INDEX_URL,
    inLanguage: "en",
    publisher: {
      "@type": "Organization",
      name: "Maroma",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/maroma-logo.png` },
    },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: issues.map((issue, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        url: archiveIssueUrl(issue.slug),
        name: issue.subject,
        image: issue.thumbnailUrl,
      })),
    },
  };
}

export function buildArchiveIssueJsonLd(issue: NewsletterArchiveIssue) {
  const description = buildArchiveIssueDescription(issue);
  const image = buildArchiveOgImage(issue);
  const url = archiveIssueUrl(issue.slug);

  const storyParts = (issue.canvas.elements ?? [])
    .flatMap((el) => {
      if (el.kind !== "story-grid") return [];
      return (el.stories ?? []).map((story) => ({
        title: story.title,
        imageUrl: story.imageUrl,
        excerpt: story.excerpt,
      }));
    })
    .slice(0, 12);

  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: issue.subject,
    description,
    datePublished: issue.sentAt,
    dateModified: issue.sentAt,
    image: image ? [image] : undefined,
    inLanguage: "en",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    publisher: {
      "@type": "Organization",
      name: "Maroma",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/maroma-logo.png` },
    },
    author: { "@type": "Organization", name: "Maroma" },
    hasPart:
      storyParts.length > 0
        ? {
            "@type": "ItemList",
            itemListElement: storyParts.map((story, idx) => ({
              "@type": "ListItem",
              position: idx + 1,
              name: story.title || "Story",
              image: story.imageUrl,
              description: story.excerpt,
            })),
          }
        : undefined,
  };
}
