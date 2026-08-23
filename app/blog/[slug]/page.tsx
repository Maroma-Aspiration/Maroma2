import type { Metadata } from "next";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { JsonLd } from "../../components/JsonLd";
import { formatStoryDate, splitBodyToParagraphs } from "../../../lib/story-format";
import { getJournalStoryBySlug } from "../../../lib/journal-stories";
import { readStoriesState } from "../../../lib/story-storage";
import { getStoryThumbnailUrl, resolveStoryThumbnailUrl } from "../../../lib/story-thumbnail";
import { articleJsonLd, breadcrumbJsonLd, buildPageMetadata } from "../../../lib/site-seo";

export const dynamic = "force-dynamic";

type StoryPageProps = {
  params: {
    slug: string;
  };
};

export async function generateMetadata({ params }: StoryPageProps): Promise<Metadata> {
  noStore();
  const state = await readStoriesState();
  const match = await getJournalStoryBySlug(state, params.slug);
  const story = match?.story;
  if (!story) {
    return { title: "Story not found | Maroma" };
  }
  const image = getStoryThumbnailUrl(story, state, match.index) || undefined;
  return buildPageMetadata({
    title: `${story.title} | Maroma Journal`,
    description: story.excerpt || story.title,
    path: `/blog/${story.slug}`,
    image,
    type: "article",
  });
}

export default async function StoryPage({ params }: StoryPageProps) {
  noStore();
  const state = await readStoriesState();
  const match = await getJournalStoryBySlug(state, params.slug);
  const story = match?.story;
  const storyIndex = match?.index ?? -1;
  if (!story) {
    notFound();
  }
  const heroImage = await resolveStoryThumbnailUrl(story, state, storyIndex);
  const paragraphs = splitBodyToParagraphs(story.body);
  return (
    <main className="story-page">
      <JsonLd
        data={[
          articleJsonLd({
            title: story.title,
            description: story.excerpt || story.title,
            path: `/blog/${story.slug}`,
            image: heroImage,
            datePublished: story.publishedAt,
            dateModified: story.updatedAt || story.publishedAt,
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Journal", path: "/blog" },
            { name: story.title, path: `/blog/${story.slug}` },
          ]),
        ]}
      />
      <article className="story-article">
        <h1>{story.title}</h1>
        {story.publishedAt ? <p className="story-meta">{formatStoryDate(story.publishedAt)}</p> : null}
        {heroImage ? <img src={heroImage} alt="" className="story-hero-image" /> : null}
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
