import type { Metadata } from "next";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { formatStoryDate } from "../../../../lib/story-format";
import { getArchiveIssueBySlug } from "../../../../lib/newsletter-archive-storage";
import { renderArchiveIssueBodyHtml } from "../../../../lib/newsletter-archive-render";
import {
  buildArchiveIssueJsonLd,
  buildArchiveIssueMetadata,
  SITE_URL,
} from "../../../../lib/newsletter-archive-seo";

export const dynamic = "force-dynamic";

type ArchiveIssuePageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ArchiveIssuePageProps): Promise<Metadata> {
  noStore();
  const { slug } = await params;
  const issue = await getArchiveIssueBySlug(slug);
  if (!issue) return { title: "Newsletter not found | Maroma" };
  return buildArchiveIssueMetadata(issue);
}

export default async function ArchiveIssuePage({ params }: ArchiveIssuePageProps) {
  noStore();
  const { slug } = await params;
  const issue = await getArchiveIssueBySlug(slug);
  if (!issue) notFound();

  const bodyHtml = renderArchiveIssueBodyHtml(issue, SITE_URL);
  const jsonLd = buildArchiveIssueJsonLd(issue);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="newsletter-archive-issue-page">
        <header className="newsletter-archive-issue-header">
          <Link href="/newsletter/archive" className="button secondary newsletter-archive-back">
            ← Archive
          </Link>
          <h1>{issue.subject}</h1>
          <time className="story-meta" dateTime={issue.sentAt}>
            {formatStoryDate(issue.sentAt)}
          </time>
          {issue.previewText ? <p className="newsletter-archive-issue-preview">{issue.previewText}</p> : null}
        </header>
        <article
          className="newsletter-archive-content"
          aria-label={issue.subject}
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      </main>
    </>
  );
}
