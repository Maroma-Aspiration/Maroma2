import { MASTHEAD_OVERLAY_IDS } from "./canvas-layout";
import displayManifest from "./canvas-display-manifest.json";

export const CANVAS_DISPLAY_WIDE_MAX = 1600;
export const CANVAS_DISPLAY_PORTRAIT_MAX = 512;
export const CANVAS_IMAGE_QUALITY = 90;

type PrebuiltDisplay = {
  webp: string;
  webpSm: string;
  avif: string;
  avifSm: string;
  w: number;
  wSm: number;
  blur: string;
};

/** Prebuilt display copies, keyed by Firebase object name or public path. */
const PREBUILT_CANVAS_DISPLAY: Record<string, PrebuiltDisplay> = displayManifest;

export type CanvasDisplaySources = {
  src: string;
  avifSrcSet?: string;
  webpSrcSet?: string;
  sizes?: string;
  blur?: string;
};

const OPTIMIZER_WIDTHS = [256, 384, 640, 750, 828, 1080, 1200, 1600, 1920] as const;

const OPTIMIZABLE_HOST_SUFFIXES = [
  "firebasestorage.googleapis.com",
  "firebasestorage.app",
  "storage.googleapis.com",
  "public.blob.vercel-storage.com",
  "blob.vercel-storage.com",
  "maromashopping.com",
  "vercel.app",
] as const;

export function canvasDisplayMaxWidth(id?: string): number {
  return id === "migrated-portrait" ? CANVAS_DISPLAY_PORTRAIT_MAX : CANVAS_DISPLAY_WIDE_MAX;
}

export function isPriorityCanvasImage(id: string): boolean {
  return id === "migrated-top" || id === "migrated-hero";
}

export function isEagerCanvasImage(id: string): boolean {
  return MASTHEAD_OVERLAY_IDS.has(id);
}

function parseUrl(src: string): URL | null {
  try {
    return new URL(src, "https://www.maromashopping.com");
  } catch {
    return null;
  }
}

function unwrapProxiedSrc(src: string): string {
  const url = parseUrl(src);
  if (!url) return src;
  if (url.pathname === "/_next/image" || url.pathname === "/api/newsletter/image") {
    return url.searchParams.get("url") || url.searchParams.get("src") || src;
  }
  return src;
}

export function firebaseCanvasObjectName(src: string): string | null {
  const url = parseUrl(unwrapProxiedSrc(src.trim()));
  if (!url) return null;
  const match = url.pathname.match(/\/o\/(.+)$/);
  if (!match) return null;
  const base = decodeURIComponent(match[1]).split("/").pop() || "";
  return base.replace(/\.[^.]+$/, "") || null;
}

function prebuiltDisplay(src: string): PrebuiltDisplay | null {
  const name = firebaseCanvasObjectName(src);
  if (name && PREBUILT_CANVAS_DISPLAY[name]) return PREBUILT_CANVAS_DISPLAY[name];
  const url = parseUrl(unwrapProxiedSrc(src.trim()));
  if (!url) return null;
  const path = decodeURIComponent(url.pathname);
  return PREBUILT_CANVAS_DISPLAY[path] ?? null;
}

function srcSet(small: string, smallW: number, big: string, bigW: number): string {
  return smallW >= bigW ? `${big} ${bigW}w` : `${small} ${smallW}w, ${big} ${bigW}w`;
}

export function canvasImageSizes(id: string | undefined, width: number): string {
  const css = Math.max(1, Math.round(width || (id === "migrated-portrait" ? 111 : 760)));
  if (css >= 600) return "(max-width: 800px) 100vw, 760px";
  return `${css}px`;
}

function canOptimizeSrc(src: string): boolean {
  if (!src || src.startsWith("data:") || src.startsWith("blob:")) return false;
  if (/\.svg(?:[?#]|$)/i.test(src)) return false;
  if (src.startsWith("/_next/image") || src.startsWith("/newsletter/display/")) return false;
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  const url = parseUrl(src);
  if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) return false;
  const host = url.hostname.toLowerCase();
  return OPTIMIZABLE_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

function optimizerWidth(displayWidth: number): number {
  const needed = Math.ceil(Math.max(64, displayWidth) * 2);
  return OPTIMIZER_WIDTHS.find((w) => w >= needed) ?? OPTIMIZER_WIDTHS[OPTIMIZER_WIDTHS.length - 1];
}

function optimizerHref(src: string, displayWidth: number): string {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${optimizerWidth(displayWidth)}&q=${CANVAS_IMAGE_QUALITY}`;
}

/** Screen-only source: prebuilt WebP, uploaded display copy, or resized optimizer URL. */
export function resolveCanvasDisplaySrc(
  src: string | undefined,
  options?: { id?: string; displaySrc?: string; width?: number },
): string {
  const explicit = options?.displaySrc?.trim();
  if (explicit) return explicit;
  const value = src?.trim() ?? "";
  if (!value) return "";
  const prebuilt = prebuiltDisplay(value);
  if (prebuilt) return prebuilt.webp;
  if (!canOptimizeSrc(value)) return value;
  const width = options?.width ?? (options?.id === "migrated-portrait" ? 128 : 760);
  return optimizerHref(value, width);
}

/** Screen sources with AVIF/WebP size variants and an inline blurred preview when prebuilt. */
export function resolveCanvasDisplaySources(
  src: string | undefined,
  options?: { id?: string; displaySrc?: string; width?: number },
): CanvasDisplaySources {
  const value = src?.trim() ?? "";
  const sizes = canvasImageSizes(options?.id, options?.width ?? 0);
  if (!options?.displaySrc?.trim() && value) {
    const prebuilt = prebuiltDisplay(value);
    if (prebuilt) {
      return {
        src: prebuilt.webp,
        avifSrcSet: srcSet(prebuilt.avifSm, prebuilt.wSm, prebuilt.avif, prebuilt.w),
        webpSrcSet: srcSet(prebuilt.webpSm, prebuilt.wSm, prebuilt.webp, prebuilt.w),
        sizes,
        blur: prebuilt.blur,
      };
    }
  }
  return { src: resolveCanvasDisplaySrc(src, options), sizes };
}

export type MastheadPreload = {
  id: string;
  href: string;
  imageSrcSet?: string;
  imageSizes?: string;
  type?: string;
};

export function collectMastheadImagePreloads(
  elements: Array<{ id: string; kind: string; src?: string; displaySrc?: string; w?: number }> | undefined,
): MastheadPreload[] {
  if (!elements?.length) return [];
  const ids = ["migrated-top", "migrated-hero", "migrated-portrait"] as const;
  const preloads: MastheadPreload[] = [];
  for (const id of ids) {
    const el = elements.find((item) => item.id === id && item.kind === "image" && item.src);
    if (!el) continue;
    const sources = resolveCanvasDisplaySources(el.src, { id, displaySrc: el.displaySrc, width: el.w });
    if (!sources.src) continue;
    preloads.push(
      sources.avifSrcSet
        ? { id, href: sources.src, imageSrcSet: sources.avifSrcSet, imageSizes: sources.sizes, type: "image/avif" }
        : { id, href: sources.src },
    );
  }
  return preloads;
}

function escHtmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

const MASTHEAD_CLASS_TO_ID: Record<string, string> = {
  "email-masthead-banner-img": "migrated-top",
  "email-masthead-hero-img": "migrated-hero",
  "email-masthead-portrait-img": "migrated-portrait",
};

/** Browser-only: swap every image for its display copy. Sent email HTML stays unchanged. */
export function optimizeMastheadImagesInEmailHtml(
  html: string,
  elements?: Array<{ id: string; kind: string; src?: string; displaySrc?: string }>,
): string {
  const byId = new Map((elements ?? []).map((el) => [el.id, el]));
  const displayBySrc = new Map<string, string>();
  for (const el of elements ?? []) {
    if (el.kind === "image" && el.src && el.displaySrc) displayBySrc.set(el.src, el.displaySrc);
  }

  const preloads: string[] = [];
  const rewritten = html.replace(/<img\b[^>]*>/gi, (tag) => {
    const srcMatch = tag.match(/\bsrc="([^"]+)"/i);
    if (!srcMatch) return tag;
    const src = srcMatch[1].replace(/&amp;/g, "&");
    if (!src || src.includes("/newsletter/track/") || /\bwidth="1"/.test(tag)) return tag;
    const mastheadClass = /email-masthead-(?:banner|hero|portrait)-img/.exec(tag)?.[0];
    const id = mastheadClass ? MASTHEAD_CLASS_TO_ID[mastheadClass] : undefined;
    const el = id ? byId.get(id) : undefined;
    const unwrapped = unwrapProxiedSrc(src);
    const href = resolveCanvasDisplaySrc(unwrapped, {
      id,
      displaySrc: el?.displaySrc ?? displayBySrc.get(unwrapped),
      width: id === "migrated-portrait" ? 128 : 760,
    });
    if (!href || href === src) return tag;
    if (mastheadClass) {
      preloads.push(`<link rel="preload" as="image" href="${escHtmlAttr(href)}" fetchpriority="high" />`);
    }
    return tag.replace(/\bsrc="[^"]+"/i, `src="${escHtmlAttr(href)}"`);
  });

  if (!preloads.length) return rewritten;
  const links = preloads.join("");
  if (/<head\b[^>]*>/i.test(rewritten)) {
    return rewritten.replace(/<head\b[^>]*>/i, (head) => `${head}${links}`);
  }
  return `${links}${rewritten}`;
}
