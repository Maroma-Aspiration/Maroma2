import type {
  PromoBanner,
  PromoFrame,
  PromoFrameKind,
  PromoMediaKind,
  PromoPresentation,
  PromoSequenceTransition,
} from "./promo-types";
import type { PromoCtaBuyLink } from "./promo-types";
import { visibleCtaBuyLinks } from "./promo-buy-links-utils";
import { promoStripVideoThenCta } from "./promo-strip-utils";
import { firstUsablePublicMediaUrl } from "./usable-media-url";

export const PROMO_FRAME_KIND_LABELS: Record<PromoFrameKind, string> = {
  empty: "Empty strip",
  "title-media": "Title + image",
  text: "Text only",
  image: "Image only",
  marquee: "Scrolling message",
  cta: "Call-to-action button",
};

export const PROMO_SEQUENCE_FADE_MS_DEFAULT = 600;
export const PROMO_FRAME_FADE_MS_DEFAULT = 400;

export function normalizeSequenceFadeDurationMs(value: unknown): number {
  return clampNum(value, 150, 3000, PROMO_SEQUENCE_FADE_MS_DEFAULT);
}

export function normalizeFrameFadeMs(value: unknown): number {
  return clampNum(value, 0, 4000, PROMO_FRAME_FADE_MS_DEFAULT);
}

export const PROMO_TRANSITION_OPTIONS: { value: PromoSequenceTransition; label: string }[] = [
  { value: "fade", label: "Fade" },
  { value: "crossfade", label: "Crossfade" },
  { value: "slide-up", label: "Slide up" },
  { value: "slide-down", label: "Slide down" },
];

const FRAME_KINDS: PromoFrameKind[] = ["empty", "title-media", "text", "image", "marquee", "cta"];

export function frameShowsTitle(kind: PromoFrameKind): boolean {
  return kind === "title-media" || kind === "text";
}

export function frameShowsMedia(kind: PromoFrameKind): boolean {
  return kind === "title-media" || kind === "image";
}

function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeMediaKind(value: unknown): PromoMediaKind {
  if (value === "image" || value === "video" || value === "title-media") return value;
  return "none";
}

export function createPromoFrameId(): string {
  return crypto.randomUUID();
}

export const PROMO_FRAME_KIND_HINTS: Record<PromoFrameKind, string> = {
  empty: "Blank pause. Skipped on the homepage strip.",
  "title-media": "Headline and catalog image together.",
  text: "Large headline only.",
  image: "Catalog image only, large in the strip.",
  marquee: "Scrolling offer line.",
  cta: "Shop button and product tiles.",
};

export function buildDefaultPromoFrames(_source?: Partial<PromoBanner>): PromoFrame[] {
  return [
    {
      id: createPromoFrameId(),
      kind: "image",
      durationMs: 2400,
      fadeInMs: PROMO_FRAME_FADE_MS_DEFAULT,
      fadeOutMs: PROMO_FRAME_FADE_MS_DEFAULT,
      mediaScale: 1.2,
    },
    {
      id: createPromoFrameId(),
      kind: "text",
      durationMs: 2200,
      fadeInMs: PROMO_FRAME_FADE_MS_DEFAULT,
      fadeOutMs: PROMO_FRAME_FADE_MS_DEFAULT,
      titleSizeRem: 1.45,
    },
    {
      id: createPromoFrameId(),
      kind: "marquee",
      durationMs: 5200,
      fadeInMs: PROMO_FRAME_FADE_MS_DEFAULT,
      fadeOutMs: PROMO_FRAME_FADE_MS_DEFAULT,
      bodySizeRem: 0.96,
    },
    {
      id: createPromoFrameId(),
      kind: "cta",
      durationMs: 4800,
      fadeInMs: PROMO_FRAME_FADE_MS_DEFAULT,
      fadeOutMs: PROMO_FRAME_FADE_MS_DEFAULT,
      ctaScale: 1,
    },
  ];
}

export function normalizePromoFrame(raw: unknown, index: number): PromoFrame | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const kind = FRAME_KINDS.includes(row.kind as PromoFrameKind) ? (row.kind as PromoFrameKind) : "empty";
  const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : `frame-${index + 1}`;
  return {
    id,
    kind,
    durationMs: clampNum(row.durationMs, 400, 30000, 2400),
    fadeInMs: normalizeFrameFadeMs(row.fadeInMs),
    fadeOutMs: normalizeFrameFadeMs(row.fadeOutMs),
    title: typeof row.title === "string" ? row.title : undefined,
    body: typeof row.body === "string" ? row.body : undefined,
    mediaUrl: firstUsablePublicMediaUrl(row.mediaUrl) || undefined,
    mediaKind: row.mediaKind ? normalizeMediaKind(row.mediaKind) : undefined,
    ctaLabel: typeof row.ctaLabel === "string" ? row.ctaLabel : undefined,
    ctaHref: typeof row.ctaHref === "string" ? row.ctaHref : undefined,
    titleSizeRem: clampNum(row.titleSizeRem, 0.6, 3.2, frameShowsTitle(kind) ? 1.18 : 1),
    bodySizeRem: clampNum(row.bodySizeRem, 0.6, 2.4, kind === "marquee" ? 0.96 : 0.92),
    mediaScale: clampNum(row.mediaScale, 1, 5, 3),
    ctaScale: clampNum(row.ctaScale, 0.6, 2.2, 1),
  };
}

export function normalizePromoFrames(raw: unknown, banner?: Partial<PromoBanner>): PromoFrame[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return buildDefaultPromoFrames(banner);
  }
  const parsed = raw.map(normalizePromoFrame).filter((frame): frame is PromoFrame => Boolean(frame));
  return parsed.length > 0 ? parsed : buildDefaultPromoFrames(banner);
}

export function normalizePresentation(value: unknown): PromoPresentation {
  return value === "static" ? "static" : "sequence";
}

export function normalizeSequenceTransition(value: unknown): PromoSequenceTransition {
  if (value === "slide-up" || value === "slide-down" || value === "crossfade" || value === "fade") {
    return value;
  }
  return "fade";
}

export type PromoContentSource = Pick<
  PromoBanner,
  "title" | "body" | "mediaUrl" | "mediaKind" | "ctaLabel" | "ctaHref"
>;

export function resolveFrameContent(frame: PromoFrame, source: PromoContentSource): PromoFrame {
  const mediaUrl = firstUsablePublicMediaUrl(frame.mediaUrl, source.mediaUrl);
  const mediaKind = mediaUrl
    ? frame.mediaKind === "video" || source.mediaKind === "video"
      ? "video"
      : "image"
    : "none";

  return {
    ...frame,
    title: frame.title?.trim() || source.title,
    body: frame.body?.trim() || source.body,
    mediaUrl: mediaKind === "none" ? "" : mediaUrl,
    mediaKind,
    ctaLabel: frame.ctaLabel?.trim() || source.ctaLabel,
    ctaHref: frame.ctaHref?.trim() || source.ctaHref,
  };
}

export function frameHasVisibleContent(frame: PromoFrame, buyLinks: PromoCtaBuyLink[] = []): boolean {
  if (frame.kind === "empty") return false;
  if (frame.kind === "image") return Boolean(frame.mediaUrl);
  if (frame.kind === "text") return Boolean(frame.title?.trim());
  if (frame.kind === "title-media") {
    return Boolean(frame.title?.trim() || frame.mediaUrl);
  }
  if (frame.kind === "marquee") return Boolean(frame.body?.trim());
  if (frame.kind === "cta") {
    if (frame.ctaLabel?.trim()) return true;
    const { left, right } = visibleCtaBuyLinks(buyLinks);
    return left.length + right.length > 0;
  }
  return true;
}

function buildVideoEndCtaFrame(): PromoFrame {
  return {
    id: createPromoFrameId(),
    kind: "cta",
    durationMs: 30000,
    fadeInMs: PROMO_FRAME_FADE_MS_DEFAULT,
    fadeOutMs: PROMO_FRAME_FADE_MS_DEFAULT,
    ctaScale: 1,
  };
}

function resolveVideoEndCtaFrames(
  frames: PromoFrame[],
  banner: PromoContentSource & { ctaBuyLinks?: PromoCtaBuyLink[] }
): PromoFrame[] {
  const ctaFrames = frames.filter((frame) => frame.kind === "cta");
  if (ctaFrames.length > 0) return ctaFrames;
  const buyLinks = banner.ctaBuyLinks ?? [];
  const candidate = buildVideoEndCtaFrame();
  return frameHasVisibleContent(candidate, buyLinks) ? [candidate] : [];
}

export function resolvePromoFrames(
  banner: PromoContentSource & { frames?: PromoFrame[]; ctaBuyLinks?: PromoCtaBuyLink[] },
  options?: { heroVariant?: boolean }
): PromoFrame[] {
  const buyLinks = banner.ctaBuyLinks ?? [];
  const frames = normalizePromoFrames(banner.frames, banner)
    .map((frame) => resolveFrameContent(frame, banner))
    .filter((frame) => frameHasVisibleContent(frame, buyLinks));

  if (options?.heroVariant && promoStripVideoThenCta(banner)) {
    return resolveVideoEndCtaFrames(frames, banner);
  }

  if (options?.heroVariant) {
    return frames.filter((frame) => frame.kind !== "empty");
  }

  return frames;
}

export function usesPromoSequence(
  banner: Pick<PromoBanner, "presentation">,
  variant: "default" | "hero" = "default"
): boolean {
  if (banner.presentation === "static") return false;
  if (banner.presentation === "sequence") return true;
  return variant === "hero";
}
