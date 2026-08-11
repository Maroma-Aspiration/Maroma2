import type { NewsletterCanvas, CanvasEl, CanvasImageEl, CanvasStoryGridEl } from "./story-types";
import {
  isCanvasFirebaseConfigured,
  makeCanvasObjectPath,
  uploadCanvasBuffer,
} from "./canvas-firebase-storage";

function parseDataUrl(src: string): { mime: string; buffer: Buffer } | null {
  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i.exec(src);
  if (!match) return null;
  try {
    return { mime: match[1] || "image/jpeg", buffer: Buffer.from(match[2], "base64") };
  } catch {
    return null;
  }
}

function extForMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

async function uploadDataUrl(src: string, cache: Map<string, string>): Promise<string | null> {
  if (cache.has(src)) return cache.get(src)!;
  const parsed = parseDataUrl(src);
  if (!parsed) return null;
  if (!isCanvasFirebaseConfigured()) return null;

  const ext = extForMime(parsed.mime);
  const path = makeCanvasObjectPath("canvas/email", ext);
  try {
    const url = await uploadCanvasBuffer(path, parsed.buffer, parsed.mime);
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

/** Replace data: URLs with public Firebase Storage URLs and make relative paths absolute for email clients. */
export async function ensureCanvasPublicImageUrls(
  canvas: NewsletterCanvas,
  siteUrl: string
): Promise<NewsletterCanvas> {
  const cache = new Map<string, string>();

  async function resolve(src: string | undefined): Promise<string> {
    if (!src?.trim()) return "";
    let out = src;
    if (out.startsWith("data:")) {
      const uploaded = await uploadDataUrl(out, cache);
      if (uploaded) out = uploaded;
    } else {
      out = toAbsoluteImageUrl(out, siteUrl);
    }
    return out;
  }

  const elements: CanvasEl[] = await Promise.all(
    canvas.elements.map(async (el) => {
      if (el.kind === "image") {
        const img = el as CanvasImageEl;
        return { ...img, src: await resolve(img.src) };
      }
      if (el.kind === "story-grid") {
        const grid = el as CanvasStoryGridEl;
        const stories = await Promise.all(
          grid.stories.map(async (s) => ({
            ...s,
            imageUrl: s.imageUrl ? await resolve(s.imageUrl) : s.imageUrl,
          }))
        );
        return { ...grid, stories };
      }
      return el;
    })
  );

  return { ...canvas, elements };
}
