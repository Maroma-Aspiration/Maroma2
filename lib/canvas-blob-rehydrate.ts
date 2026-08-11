import { downloadLegacyBlobUrl, isCanvasBlobUrl } from "./canvas-legacy-blob";
import type { NewsletterCanvas, StoriesState } from "./story-types";

async function blobUrlToDataUrl(url: string, cache: Map<string, string>): Promise<string | null> {
  if (cache.has(url)) return cache.get(url)!;
  if (!isCanvasBlobUrl(url)) return url;

  const downloaded = await downloadLegacyBlobUrl(url);
  if (!downloaded) return null;

  const dataUrl = `data:${downloaded.contentType};base64,${downloaded.buffer.toString("base64")}`;
  cache.set(url, dataUrl);
  return dataUrl;
}

async function resolveSrc(
  src: string | undefined,
  cache: Map<string, string>
): Promise<{ src: string; changed: boolean; failed: boolean }> {
  const trimmed = (src ?? "").trim();
  if (!trimmed) return { src: "", changed: false, failed: false };
  if (!isCanvasBlobUrl(trimmed)) return { src: trimmed, changed: false, failed: false };

  const dataUrl = await blobUrlToDataUrl(trimmed, cache);
  if (dataUrl && dataUrl !== trimmed) return { src: dataUrl, changed: true, failed: false };
  return { src: trimmed, changed: false, failed: true };
}

function collectBlobUrls(state: StoriesState): string[] {
  const urls = new Set<string>();
  const add = (raw: string | undefined) => {
    const url = (raw ?? "").trim();
    if (isCanvasBlobUrl(url)) urls.add(url);
  };

  add(state.newsletterHeroImageUrl);
  add(state.newsletterPortraitUrl);
  add(state.newsletterTopImageUrl);
  add(state.newsletterLogoUrl);
  for (const url of state.executiveBriefImageOverrides ?? []) add(url);
  for (const story of state.stories ?? []) {
    add(story.imageUrl);
    for (const img of story.images ?? []) add(img);
  }
  for (const el of state.newsletterCanvas?.elements ?? []) {
    if (el.kind === "image") add(el.src);
    if (el.kind === "story-grid") {
      for (const card of el.stories) add(card.imageUrl);
    }
  }
  return Array.from(urls);
}

export type CanvasBlobRehydrateResult = {
  state: StoriesState;
  blobUrlsFound: number;
  replaced: number;
  stillBlocked: number;
};

/** Replace legacy blob URLs with inline data URLs when the blob store is readable again. */
export async function rehydrateCanvasBlobUrls(state: StoriesState): Promise<CanvasBlobRehydrateResult> {
  const cache = new Map<string, string>();
  const blobUrlsFound = collectBlobUrls(state).length;
  let replaced = 0;
  let stillBlocked = 0;

  const next: StoriesState = {
    ...state,
    executiveBriefImageOverrides: [...(state.executiveBriefImageOverrides ?? [])],
    stories: (state.stories ?? []).map((story) => ({
      ...story,
      images: [...(story.images ?? [])],
    })),
  };

  const track = async (raw: string | undefined): Promise<string> => {
    const resolved = await resolveSrc(raw, cache);
    if (resolved.changed) replaced += 1;
    if (resolved.failed) stillBlocked += 1;
    return resolved.src;
  };

  next.newsletterHeroImageUrl = await track(next.newsletterHeroImageUrl);
  next.newsletterPortraitUrl = await track(next.newsletterPortraitUrl);
  next.newsletterTopImageUrl = await track(next.newsletterTopImageUrl);
  next.newsletterLogoUrl = await track(next.newsletterLogoUrl);

  if (next.executiveBriefImageOverrides?.length) {
    next.executiveBriefImageOverrides = await Promise.all(
      next.executiveBriefImageOverrides.map((url) => track(url))
    );
  }

  if (next.stories?.length) {
    next.stories = await Promise.all(
      next.stories.map(async (story) => ({
        ...story,
        imageUrl: await track(story.imageUrl),
        images: story.images?.length
          ? await Promise.all(story.images.map((img) => track(img)))
          : story.images,
      }))
    );
  }

  const canvas = next.newsletterCanvas;
  if (canvas?.elements?.length) {
    const elements = await Promise.all(
      canvas.elements.map(async (el) => {
        if (el.kind === "image") {
          const src = await track(el.src);
          return src === el.src ? el : { ...el, src };
        }
        if (el.kind === "story-grid") {
          const stories = await Promise.all(
            el.stories.map(async (card) => {
              const imageUrl = card.imageUrl ? await track(card.imageUrl) : card.imageUrl;
              return imageUrl === card.imageUrl ? card : { ...card, imageUrl };
            })
          );
          return stories === el.stories ? el : { ...el, stories };
        }
        return el;
      })
    );
    next.newsletterCanvas = { ...canvas, elements } as NewsletterCanvas;
  }

  return { state: next, blobUrlsFound, replaced, stillBlocked };
}
