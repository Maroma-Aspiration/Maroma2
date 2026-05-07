import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { formatStoryDate } from "../../lib/story-format";
import { readStoriesState } from "../../lib/story-storage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Maroma Blog",
  description: "Stories, rituals, sourcing updates, and social highlights from Maroma."
};

export default async function BlogPage() {
  noStore();
  const state = await readStoriesState();
  const stories = state.stories;
  return (
    <main className="stories-page">
      <section className="stories-hero">
        <p className="stories-eyebrow">Maroma Journal</p>
        <h1>Stories for your ritual life</h1>
        <p>SEO-friendly updates automatically and manually curated from Maroma social and editorial stories.</p>
      </section>

      <section className="stories-grid">
        {stories.length === 0 ? (
          <article className="story-card">
            <h2>No stories yet</h2>
            <p>Add stories from <Link href="/newsletter?edit=1">the newsletter editor</Link> to start publishing blog content.</p>
          </article>
        ) : (
          stories.map((story) => (
            <article key={story.id} className="story-card">
              {story.imageUrl ? <img src={story.imageUrl} alt={story.title} /> : null}
              <p className="story-meta">{formatStoryDate(story.publishedAt)} - {story.source}</p>
              <h2>{story.title}</h2>
              <p>{story.excerpt}</p>
              <Link href={`/blog/${story.slug}`} className="button secondary">Read story</Link>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
