import type { Metadata } from "next";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { formatStoryDate, splitBodyToParagraphs } from "../../../lib/story-format";
import { readStoriesState } from "../../../lib/story-storage";

export const dynamic = "force-dynamic";

type StoryPageProps = {
  params: {
    slug: string;
  };
};

export async function generateMetadata({ params }: StoryPageProps): Promise<Metadata> {
  noStore();
  const state = await readStoriesState();
  const story = state.stories.find((item) => item.slug === params.slug);
  if (!story) {
    return { title: "Story not found | Maroma Blog" };
  }
  return {
    title: `${story.title} | Maroma Blog`,
    description: story.excerpt || story.title,
    openGraph: {
      title: story.title,
      description: story.excerpt || story.title,
      images: story.imageUrl ? [story.imageUrl] : undefined
    }
  };
}

export default async function StoryPage({ params }: StoryPageProps) {
  noStore();
  const state = await readStoriesState();
  const story = state.stories.find((item) => item.slug === params.slug);
  if (!story) {
    notFound();
  }
  const paragraphs = splitBodyToParagraphs(story.body);
  return (
    <main className="story-page">
      <article className="story-article">
        <p className="story-meta">{formatStoryDate(story.publishedAt)} - {story.source}</p>
        <h1>{story.title}</h1>
        {story.imageUrl ? <img src={story.imageUrl} alt={story.title} className="story-hero-image" /> : null}
        {paragraphs.length > 0 ? paragraphs.map((line) => <p key={line}>{line}</p>) : <p>{story.excerpt}</p>}
        <div className="story-actions">
          {story.ctaUrl ? (
            <a href={story.ctaUrl} className="button primary button-gold" target="_blank" rel="noopener noreferrer">
              {story.ctaLabel || "Explore"}
            </a>
          ) : null}
          {story.sourceUrl ? (
            <a href={story.sourceUrl} className="button secondary" target="_blank" rel="noopener noreferrer">
              Source link
            </a>
          ) : null}
          <Link href="/blog" className="button secondary">Back to blog</Link>
        </div>
      </article>
    </main>
  );
}
