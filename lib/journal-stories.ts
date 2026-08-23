import {
  extractStoriesFromCanvasElements,
  extractStoriesFromStoryGrid,
  getPublishableStories,
  resolveStoriesFromCanvas,
} from "./canvas-reconcile-stories";
import { readNewsletterArchive } from "./newsletter-archive-storage";
import { readTestSnapshots } from "./newsletter-test-snapshot-storage";
import type { NewsletterArchiveIssue } from "./newsletter-archive-types";
import type { StoriesState, StoryRecord } from "./story-types";

function storiesFromArchiveIssue(issue: NewsletterArchiveIssue): StoryRecord[] {
  const elements = issue.canvas?.elements ?? [];
  const fromSections = extractStoriesFromCanvasElements(elements);
  const extracted =
    fromSections.length > 0 ? fromSections : extractStoriesFromStoryGrid(elements);

  return extracted
    .filter((story) => story.title?.trim())
    .map((story) => ({
      ...story,
      id: `${issue.id}:${story.id}`,
      publishedAt: issue.sentAt,
      updatedAt: issue.sentAt,
    }));
}

function mergeJournalStories(primary: StoryRecord[], incoming: StoryRecord[]): StoryRecord[] {
  const bySlug = new Map<string, StoryRecord>();
  for (const story of incoming) {
    const slug = story.slug?.trim();
    if (!slug || !story.title?.trim()) continue;
    bySlug.set(slug, story);
  }
  for (const story of primary) {
    const slug = story.slug?.trim();
    if (!slug || !story.title?.trim()) continue;
    bySlug.set(slug, story);
  }
  return Array.from(bySlug.values()).sort((a, b) =>
    (b.publishedAt || "").localeCompare(a.publishedAt || "")
  );
}

/** Stories for the public Journal: live editor content plus newsletter archive issues. */
export async function getJournalStories(state: StoriesState): Promise<StoryRecord[]> {
  const live = getPublishableStories(state).filter((story) => story.title?.trim());
  const [{ issues }, testSnapshots] = await Promise.all([readNewsletterArchive(), readTestSnapshots()]);
  const archiveStories = [...issues, ...testSnapshots].flatMap(storiesFromArchiveIssue);

  const merged = mergeJournalStories(live, archiveStories);
  if (merged.length > 0) return merged;

  return resolveStoriesFromCanvas(state).filter((story) => story.title?.trim());
}

export async function getJournalStoryBySlug(
  state: StoriesState,
  slug: string
): Promise<{ story: StoryRecord; index: number } | null> {
  const key = slug.trim();
  if (!key) return null;
  const stories = await getJournalStories(state);
  const index = stories.findIndex((story) => story.slug === key);
  if (index < 0) return null;
  return { story: stories[index], index };
}
