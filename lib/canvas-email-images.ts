import type { NewsletterCanvas, CanvasEl, CanvasImageEl, CanvasStoryGridEl } from "./story-types";
import { uploadCanvasPublicBuffer } from "./canvas-public-upload";

function parseDataUrl(src: string): { mime: string; buffer: Buffer } | null {
  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i.exec(src);
  if (!match) return null;
  try {
    return { mime: match[1] || "image/jpeg", buffer: Buffer.from(match[2], "base64") };
  } catch {
    return null;
  }
}

async function uploadDataUrl(src: string, cache: Map<string, string>): Promise<string | null> {
  if (cache.has(src)) return cache.get(src)!;
  const parsed = parseDataUrl(src);
  if (!parsed) return null;

  try {
    const { url } = await uploadCanvasPublicBuffer("canvas/email", parsed.buffer, parsed.mime);
    cache.set(src, url);
    return url;
  } catch {
    return null;
  }
}

export function toAbsoluteImageUrl(src: string, siteUrl: string): string {
  const trimmed = src.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("/")) {
    const origin = siteUrl.replace(/\/$/, "");
    return `${origin}${trimmed}`;
  }
  return trimmed;
}

export function collectCanvasDataImageUrls(canvas: NewsletterCanvas | null | undefined): string[] {
  const out: string[] = [];
  for (const el of canvas?.elements ?? []) {
    if (el.kind === "image" && el.src?.startsWith("data:")) out.push(el.src);
    if (el.kind === "story-grid") {
      for (const card of el.stories) {
        if (card.imageUrl?.startsWith("data:")) out.push(card.imageUrl);
      }
    }
  }
  return out;
}

export type EnsureCanvasPublicImagesResult = {
  canvas: NewsletterCanvas;
  uploaded: number;
  remainingDataUrls: number;
  changed: boolean;
};

/** Replace data: URLs with public HTTPS URLs and make relative paths absolute for email clients. */
export async function ensureCanvasPublicImageUrls(
  canvas: NewsletterCanvas,
  siteUrl: string
): Promise<NewsletterCanvas> {
  const result = await ensureCanvasPublicImageUrlsDetailed(canvas, siteUrl);
  return result.canvas;
}

export async function ensureCanvasPublicImageUrlsDetailed(
  canvas: NewsletterCanvas,
  siteUrl: string
): Promise<EnsureCanvasPublicImagesResult> {
  const cache = new Map<string, string>();
  let uploaded = 0;
  let changed = false;

  async function resolve(src: string | undefined): Promise<string> {
    if (!src?.trim()) return "";
    let out = src;
    if (out.startsWith("data:")) {
      const hosted = await uploadDataUrl(out, cache);
      if (hosted) {
        uploaded += 1;
        changed = true;
        out = hosted;
      }
    } else {
      const abs = toAbsoluteImageUrl(out, siteUrl);
      if (abs !== out) changed = true;
      out = abs;
    }
    return out;
  }

  const elements: CanvasEl[] = await Promise.all(
    canvas.elements.map(async (el) => {
      if (el.kind === "image") {
        const img = el as CanvasImageEl;
        const src = await resolve(img.src);
        return src === img.src ? img : { ...img, src };
      }
      if (el.kind === "story-grid") {
        const grid = el as CanvasStoryGridEl;
        const stories = await Promise.all(
          grid.stories.map(async (s) => {
            const imageUrl = s.imageUrl ? await resolve(s.imageUrl) : s.imageUrl;
            return imageUrl === s.imageUrl ? s : { ...s, imageUrl };
          })
        );
        return stories === grid.stories ? grid : { ...grid, stories };
      }
      return el;
    })
  );

  const next = { ...canvas, elements };
  return {
    canvas: next,
    uploaded,
    remainingDataUrls: collectCanvasDataImageUrls(next).length,
    changed,
  };
}
