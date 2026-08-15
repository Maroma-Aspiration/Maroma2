import { downloadLegacyBlobUrl, isCanvasBlobUrl } from "./canvas-legacy-blob";
import {
  canvasPathFromFirebaseUrl,
  isCanvasFirebaseConfigured,
  isCanvasFirebaseUrl,
} from "./canvas-firebase-storage";
import { uploadCanvasPublicBuffer } from "./canvas-public-upload";
import type { NewsletterCanvas, StoriesState } from "./story-types";

function parseDataUrl(src: string): { mime: string; buffer: Buffer } | null {
  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i.exec(src);
  if (!match) return null;
  try {
    return { mime: match[1] || "image/jpeg", buffer: Buffer.from(match[2], "base64") };
  } catch {
    return null;
  }
}

async function downloadRemoteUrl(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (isCanvasBlobUrl(url)) return downloadLegacyBlobUrl(url);
  if (url.startsWith("data:")) {
    const parsed = parseDataUrl(url);
    if (!parsed) return null;
    return { buffer: parsed.buffer, contentType: parsed.mime };
  }
  if (!/^https?:\/\//i.test(url)) return null;
  if (isCanvasFirebaseUrl(url)) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return {
      buffer: Buffer.from(await res.arrayBuffer()),
      contentType: res.headers.get("content-type") || "image/jpeg",
    };
  } catch {
    return null;
  }
}

function collectMigratableUrls(state: StoriesState): string[] {
  const urls = new Set<string>();
  const add = (raw: string | undefined) => {
    const url = (raw ?? "").trim();
    if (!url || isCanvasFirebaseUrl(url) || isCanvasBlobUrl(url)) return;
    if (url.startsWith("data:") || /^https?:\/\//i.test(url)) {
      urls.add(url);
    }
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

export type CanvasMigrateToFirebaseResult = {
  state: StoriesState;
  configured: boolean;
  urlsFound: number;
  migrated: number;
  skipped: number;
  failed: number;
};

/** Upload legacy / inline / remote URLs to public storage (Firebase, else Vercel Blob) and rewrite newsletter state. */
export async function migrateCanvasImagesToFirebase(
  state: StoriesState
): Promise<CanvasMigrateToFirebaseResult> {
  const canUpload = isCanvasFirebaseConfigured() || Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
  if (!canUpload) {
    return {
      state,
      configured: false,
      urlsFound: 0,
      migrated: 0,
      skipped: 0,
      failed: 0,
    };
  }

  const sourceUrls = collectMigratableUrls(state);
  const cache = new Map<string, string>();
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  const resolve = async (raw: string | undefined): Promise<string> => {
    const trimmed = (raw ?? "").trim();
    if (!trimmed) return "";
    if (isCanvasFirebaseUrl(trimmed) || isCanvasBlobUrl(trimmed)) {
      skipped += 1;
      return trimmed;
    }
    if (cache.has(trimmed)) return cache.get(trimmed)!;

    if (canvasPathFromFirebaseUrl(trimmed)) {
      cache.set(trimmed, trimmed);
      skipped += 1;
      return trimmed;
    }

    const downloaded = await downloadRemoteUrl(trimmed);
    if (!downloaded) {
      failed += 1;
      return trimmed;
    }

    try {
      const { url: publicUrl } = await uploadCanvasPublicBuffer(
        "canvas/migrated",
        downloaded.buffer,
        downloaded.contentType
      );
      cache.set(trimmed, publicUrl);
      migrated += 1;
      return publicUrl;
    } catch {
      failed += 1;
      return trimmed;
    }
  };

  const next: StoriesState = {
    ...state,
    executiveBriefImageOverrides: [...(state.executiveBriefImageOverrides ?? [])],
    stories: (state.stories ?? []).map((story) => ({
      ...story,
      images: [...(story.images ?? [])],
    })),
  };

  next.newsletterHeroImageUrl = await resolve(next.newsletterHeroImageUrl);
  next.newsletterPortraitUrl = await resolve(next.newsletterPortraitUrl);
  next.newsletterTopImageUrl = await resolve(next.newsletterTopImageUrl);
  next.newsletterLogoUrl = await resolve(next.newsletterLogoUrl);

  if (next.executiveBriefImageOverrides?.length) {
    next.executiveBriefImageOverrides = await Promise.all(
      next.executiveBriefImageOverrides.map((url) => resolve(url))
    );
  }

  if (next.stories?.length) {
    next.stories = await Promise.all(
      next.stories.map(async (story) => ({
        ...story,
        imageUrl: await resolve(story.imageUrl),
        images: story.images?.length
          ? await Promise.all(story.images.map((img) => resolve(img)))
          : story.images,
      }))
    );
  }

  const canvas = next.newsletterCanvas;
  if (canvas?.elements?.length) {
    const elements = await Promise.all(
      canvas.elements.map(async (el) => {
        if (el.kind === "image") {
          const src = await resolve(el.src);
          return src === el.src ? el : { ...el, src };
        }
        if (el.kind === "story-grid") {
          const stories = await Promise.all(
            el.stories.map(async (card) => {
              const imageUrl = card.imageUrl ? await resolve(card.imageUrl) : card.imageUrl;
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

  return {
    state: next,
    configured: true,
    urlsFound: sourceUrls.length,
    migrated,
    skipped,
    failed,
  };
}
