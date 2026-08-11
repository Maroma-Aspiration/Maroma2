import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { formatStoryDate } from "../../../lib/story-format";
import { buildCurrentIssuePreview } from "../../../lib/newsletter-current-issue";
import { listArchiveSummaries } from "../../../lib/newsletter-archive-storage";
import {
  buildArchiveIndexJsonLd,
  buildArchiveIndexMetadata,
} from "../../../lib/newsletter-archive-seo";
import { readStoriesState } from "../../../lib/story-storage";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  noStore();
  const issues = await listArchiveSummaries();
  return buildArchiveIndexMetadata(issues);
}

export default async function NewsletterArchivePage() {
  noStore();
  const [issues, state] = await Promise.all([listArchiveSummaries(), readStoriesState()]);
  const currentIssue = buildCurrentIssuePreview(state);
  const jsonLd = buildArchiveIndexJsonLd(issues);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="stories-page newsletter-archive-page">
        <section className="stories-hero">
          <p className="stories-eyebrow">Maroma Newsletter</p>
          <h1>Newsletter archive</h1>
          <p>Past issues sent to our community: natural fragrance, ritual, and stories from Auroville.</p>
        </section>

        <section className="stories-grid newsletter-archive-grid" aria-label="Newsletter issues">
          {currentIssue ? (
            <Link href="/newsletter" className="story-card newsletter-archive-card newsletter-archive-card-current">
              <div className="story-card-media">
                {currentIssue.thumbnailUrl ? (
                  <img src={currentIssue.thumbnailUrl} alt="" loading="eager" />
                ) : (
                  <div className="newsletter-archive-thumb-placeholder" aria-hidden="true" />
                )}
              </div>
              <p className="story-meta newsletter-archive-current-badge">Current issue</p>
              <h2>{currentIssue.title}</h2>
              <p className="story-meta">{currentIssue.dateLabel}</p>
              {currentIssue.previewText ? (
                <p className="newsletter-archive-preview">{currentIssue.previewText}</p>
              ) : null}
            </Link>
          ) : null}

          {issues.map((issue) => (
            <Link
              key={issue.id}
              href={`/newsletter/archive/${issue.slug}`}
              className="story-card newsletter-archive-card"
            >
              <div className="story-card-media">
                {issue.thumbnailUrl ? (
                  <img src={issue.thumbnailUrl} alt="" loading="lazy" />
                ) : (
                  <div className="newsletter-archive-thumb-placeholder" aria-hidden="true" />
                )}
              </div>
              <h2>{issue.subject}</h2>
              <p className="story-meta">{formatStoryDate(issue.sentAt)}</p>
              {issue.previewText ? <p className="newsletter-archive-preview">{issue.previewText}</p> : null}
            </Link>
          ))}

          {!currentIssue && issues.length === 0 ? (
            <article className="story-card">
              <h2>No published issues yet</h2>
              <p>When a newsletter campaign is sent, it will appear here for everyone to read.</p>
            </article>
          ) : issues.length === 0 && currentIssue ? (
            <article className="story-card newsletter-archive-empty-note">
              <h2>Past issues</h2>
              <p>When you send a campaign, archived copies will appear here alongside the current issue.</p>
            </article>
          ) : null}
        </section>
      </main>
    </>
  );
}
