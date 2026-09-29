import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { formatStoryDate, truncateStoryExcerpt } from "../../lib/story-format";
import { buildCurrentIssuePreview } from "../../lib/newsletter-current-issue";
import { listArchiveSummaries } from "../../lib/newsletter-archive-storage";
import { getJournalStories } from "../../lib/journal-stories";
import { readStoriesState } from "../../lib/story-storage";
import { resolveStoryThumbnailUrl } from "../../lib/story-thumbnail";
import { JournalSubscribeForm } from "./journal-subscribe-form";
import { buildPageMetadata } from "../../lib/site-seo";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "The Maroma Journal | Stories from Auroville",
  description:
    "Stories and events from Maroma — botanical fragrance, natural care, and community life from Auroville, India.",
  path: "/blog",
});

export default async function BlogPage() {
  noStore();
  const [state, issues] = await Promise.all([readStoriesState(), listArchiveSummaries()]);
  const currentIssue = buildCurrentIssuePreview(state);
  const stories = await getJournalStories(state);

  const cards = await Promise.all(
    stories.map(async (story, index) => {
      const thumb = await resolveStoryThumbnailUrl(story, state, index);
      return { story, thumb };
    })
  );

  return (
    <main className="stories-page">
      <section
        className="stories-hero"
        data-review="Journal hero"
        data-review-id="journal-hero"
        data-review-files="app/blog/page.tsx,app/blog/journal-subscribe-form.tsx"
      >
        <h1 className="stories-hero-title">Welcome to The Maroma Journal</h1>
        <p className="stories-hero-subhead">Stories and Events from the World of Maroma</p>
        <p className="stories-hero-cta">
          <Link href="#past-newsletters" className="button primary button-sage">Newsletter</Link>
        </p>
        <JournalSubscribeForm />
      </section>

      <section
        className="stories-grid"
        data-review="Journal stories"
        data-review-id="journal-stories"
        data-review-files="app/blog/page.tsx"
      >
        {cards.length === 0 ? (
          <article className="story-card">
            <h2>No stories yet</h2>
            <p>Add stories from <Link href="/newsletter?edit=1">the newsletter editor</Link> to start publishing blog content.</p>
          </article>
        ) : (
          cards.map(({ story, thumb }) => (
            <article key={story.id} className="story-card">
              <div className="story-card-media">
                {thumb ? (
                  <img src={thumb} alt={story.title} loading="lazy" />
                ) : (
                  <div className="story-card-media-placeholder" aria-hidden="true" />
                )}
              </div>
              <h2>{story.title}</h2>
              {story.publishedAt ? (
                <p className="story-meta">{formatStoryDate(story.publishedAt)}</p>
              ) : null}
              <p className="story-card-excerpt">{truncateStoryExcerpt(story.excerpt || story.body)}</p>
              <Link href={`/blog/${story.slug}`} className="button story-read-btn">
                Read story
              </Link>
            </article>
          ))
        )}
      </section>

      <section id="past-newsletters" className="newsletter-archive-page" aria-label="Past newsletters">
        <div className="stories-hero">
          <p className="stories-eyebrow">Maroma Newsletter</p>
          <h2 className="stories-hero-title">Past newsletters</h2>
          <p className="stories-hero-subhead">
            <Link href="/newsletter/archive">View full archive</Link>
          </p>
        </div>
        <div className="stories-grid newsletter-archive-grid">
        {currentIssue ? (
          <Link href="/newsletter/view" className="story-card newsletter-archive-card newsletter-archive-card-current">
            <div className="story-card-media">
              {currentIssue.thumbnailUrl ? (
                <img src={currentIssue.thumbnailUrl} alt="" loading="lazy" />
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
        ) : null}
        </div>
      </section>
    </main>
  );
}
