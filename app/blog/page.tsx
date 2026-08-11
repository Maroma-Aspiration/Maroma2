import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { formatStoryDate, truncateStoryExcerpt } from "../../lib/story-format";
import { readStoriesState } from "../../lib/story-storage";
import { resolveStoryThumbnailUrl } from "../../lib/story-thumbnail";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Maroma Journal",
  description: "Stories and events from the world of Maroma."
};

export default async function BlogPage() {
  noStore();
  const state = await readStoriesState();
  const stories = state.stories.filter((story) => story.kind !== "divider" && story.kind !== "text");

  const cards = await Promise.all(
    stories.map(async (story, index) => {
      const thumb = await resolveStoryThumbnailUrl(story, state, index);
      return { story, thumb };
    })
  );

  return (
    <main className="stories-page">
      <section className="stories-hero">
        <h1 className="stories-hero-title">Welcome to The Maroma Journal</h1>
        <p className="stories-hero-subhead">Stories and Events from the World of Maroma</p>
        <p className="stories-hero-cta">
          <Link href="/newsletter" className="button primary button-sage">Read the newsletter</Link>
          <Link href="/newsletter/archive" className="button secondary">Newsletter archive</Link>
        </p>
      </section>

      <section className="stories-grid">
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
    </main>
  );
}
