import type { Metadata } from "next";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { formatStoryDate, splitBodyToParagraphs } from "../../../lib/story-format";
import { readStoriesState } from "../../../lib/story-storage";
import { getStoryThumbnailUrl, resolveStoryThumbnailUrl } from "../../../lib/story-thumbnail";

export const dynamic = "force-dynamic";

type StoryPageProps = {
  params: {
    slug: string;
  };
};

export async function generateMetadata({ params }: StoryPageProps): Promise<Metadata> {
  noStore();
  const state = await readStoriesState();
  const storyIndex = state.stories.findIndex((item) => item.slug === params.slug);
  const story = storyIndex >= 0 ? state.stories[storyIndex] : undefined;
  if (!story) {
    return { title: "Story not found | Maroma Blog" };
  }
  const image = getStoryThumbnailUrl(story, state, storyIndex) || undefined;
  return {
    title: `${story.title} | Maroma Blog`,
    description: story.excerpt || story.title,
    openGraph: {
      title: story.title,
      description: story.excerpt || story.title,
      images: image ? [image] : undefined,
    },
  };
}

export default async function StoryPage({ params }: StoryPageProps) {
  noStore();
  const state = await readStoriesState();
  const storyIndex = state.stories.findIndex((item) => item.slug === params.slug);
  const story = storyIndex >= 0 ? state.stories[storyIndex] : undefined;
  if (!story) {
    notFound();
  }
  const heroImage = await resolveStoryThumbnailUrl(story, state, storyIndex);
  const paragraphs = splitBodyToParagraphs(story.body);
  return (
    <main className="story-page">
      <article className="story-article">
        <h1>{story.title}</h1>
        {story.publishedAt ? <p className="story-meta">{formatStoryDate(story.publishedAt)}</p> : null}
        {heroImage ? <img src={heroImage} alt={story.title} className="story-hero-image" /> : null}
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
