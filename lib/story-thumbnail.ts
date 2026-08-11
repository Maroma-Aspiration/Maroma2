import type { NewsletterBlock, NewsletterCanvas, StoriesState, StoryRecord } from "./story-types";

const USABLE_IMAGE = /^(https?:|\/|data:image\/)/i;

function cleanUrl(raw: string | undefined | null): string {
  const url = (raw ?? "").trim();
  if (!url || !USABLE_IMAGE.test(url)) return "";
  return url;
}

function firstImgFromHtml(html: string): string {
  if (!html.trim()) return "";
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return cleanUrl(match?.[1]);
}

function fromStoryFields(story: StoryRecord): string {
  const primary = cleanUrl(story.imageUrl);
  if (primary) return primary;
  if (Array.isArray(story.images)) {
    for (const item of story.images) {
      const url = cleanUrl(item);
      if (url) return url;
    }
  }
  return firstImgFromHtml(story.body) || firstImgFromHtml(story.excerpt);
}

function fromNewsletterBlocks(blocks: NewsletterBlock[] | undefined, story: StoryRecord): string {
  if (!blocks?.length) return "";
  for (const block of blocks) {
    if (block.kind !== "story") continue;
    if (block.storyId !== story.id && block.snapshot.slug !== story.slug) continue;
    if (Array.isArray(block.snapshot.images)) {
      for (const item of block.snapshot.images) {
        const url = cleanUrl(item);
        if (url) return url;
      }
    }
  }
  return "";
}

function fromCanvas(canvas: NewsletterCanvas | undefined, story: StoryRecord, storyIndex: number): string {
  if (!canvas?.elements?.length) return "";

  for (const el of canvas.elements) {
    if (el.kind !== "story-grid") continue;
    for (const card of el.stories) {
      if (card.storyId === story.id) {
        const url = cleanUrl(card.imageUrl);
        if (url) return url;
      }
    }
  }

  const byIndex = canvas.elements.find(
    (el) => el.kind === "image" && el.id === `migrated-si-${storyIndex}`
  );
  if (byIndex?.kind === "image") {
    const url = cleanUrl(byIndex.src);
    if (url) return url;
  }

  return "";
}

/** Resolve a blog/card thumbnail from story fields, newsletter snapshots, and canvas. */
export function getStoryThumbnailUrl(
  story: StoryRecord,
  state?: Pick<StoriesState, "newsletterBlocks" | "newsletterCanvas">,
  storyIndex = -1
): string {
  const fromFields = fromStoryFields(story);
  if (fromFields) return fromFields;

  const fromBlocks = fromNewsletterBlocks(state?.newsletterBlocks, story);
  if (fromBlocks) return fromBlocks;

  if (state?.newsletterCanvas && storyIndex >= 0) {
    const fromCanvasSrc = fromCanvas(state.newsletterCanvas, story, storyIndex);
    if (fromCanvasSrc) return fromCanvasSrc;
  }

  return "";
}

const ogImageCache = new Map<string, string>();

/** Fetch og:image (or twitter:image) from a story source URL — cached in-memory per process. */
export async function fetchStoryOgImage(sourceUrl: string): Promise<string> {
  const url = sourceUrl.trim();
  if (!url.startsWith("http")) return "";
  if (ogImageCache.has(url)) return ogImageCache.get(url) ?? "";

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MaromaStoryBot/1.0)" },
      next: { revalidate: 86400 },
    });
    if (!response.ok) {
      ogImageCache.set(url, "");
      return "";
    }
    const html = await response.text();
    const image =
      extractMetaContent(html, "og:image") ||
      extractMetaContent(html, "twitter:image") ||
      firstImgFromHtml(html);
    const cleaned = cleanUrl(image);
    ogImageCache.set(url, cleaned);
    return cleaned;
  } catch {
    ogImageCache.set(url, "");
    return "";
  }
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function extractMetaContent(html: string, name: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1].trim());
  }
  return "";
}

export async function resolveStoryThumbnailUrl(
  story: StoryRecord,
  state?: Pick<StoriesState, "newsletterBlocks" | "newsletterCanvas">,
  storyIndex = -1
): Promise<string> {
  const direct = getStoryThumbnailUrl(story, state, storyIndex);
  if (direct) return direct;
  if (story.sourceUrl?.trim().startsWith("http")) {
    return fetchStoryOgImage(story.sourceUrl);
  }
  if (story.ctaUrl?.trim().startsWith("http")) {
    return fetchStoryOgImage(story.ctaUrl);
  }
  return "";
}
