import type {
  PromoBanner,
  PromoFrame,
  PromoFrameKind,
  PromoMediaKind,
  PromoPresentation,
  PromoSequenceTransition,
} from "./promo-types";

export const PROMO_FRAME_KIND_LABELS: Record<PromoFrameKind, string> = {
  empty: "Empty strip",
  "title-media": "Title + image",
  marquee: "Scrolling message",
  cta: "Call-to-action button",
};

export const PROMO_TRANSITION_OPTIONS: { value: PromoSequenceTransition; label: string }[] = [
  { value: "fade", label: "Fade" },
  { value: "crossfade", label: "Crossfade" },
  { value: "slide-up", label: "Slide up" },
  { value: "slide-down", label: "Slide down" },
];

const FRAME_KINDS: PromoFrameKind[] = ["empty", "title-media", "marquee", "cta"];

function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeMediaKind(value: unknown): PromoMediaKind {
  return value === "image" || value === "video" ? value : "none";
}

export function createPromoFrameId(): string {
  return crypto.randomUUID();
}

export function buildDefaultPromoFrames(_source?: Partial<PromoBanner>): PromoFrame[] {
  return [
    {
      id: createPromoFrameId(),
      kind: "empty",
      durationMs: 900,
    },
    {
      id: createPromoFrameId(),
      kind: "title-media",
      durationMs: 2800,
      titleSizeRem: 1.18,
      mediaScale: 3,
    },
    {
      id: createPromoFrameId(),
      kind: "marquee",
      durationMs: 5200,
      bodySizeRem: 0.96,
    },
    {
      id: createPromoFrameId(),
      kind: "cta",
      durationMs: 4200,
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
    title: typeof row.title === "string" ? row.title : undefined,
    body: typeof row.body === "string" ? row.body : undefined,
    mediaUrl: typeof row.mediaUrl === "string" ? row.mediaUrl : undefined,
    mediaKind: row.mediaKind ? normalizeMediaKind(row.mediaKind) : undefined,
    ctaLabel: typeof row.ctaLabel === "string" ? row.ctaLabel : undefined,
    ctaHref: typeof row.ctaHref === "string" ? row.ctaHref : undefined,
    titleSizeRem: clampNum(row.titleSizeRem, 0.6, 3.2, kind === "title-media" ? 1.18 : 1),
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

export function resolveFrameContent(
  frame: PromoFrame,
  source: PromoContentSource,
  options?: { heroVariant?: boolean }
): PromoFrame {
  const sourceMediaKind = source.mediaKind ?? "none";
  const frameMediaKind = frame.mediaKind ?? sourceMediaKind;
  const useStripMedia = frameMediaKind !== "none" && sourceMediaKind !== "none";
  const mediaUrl = useStripMedia ? frame.mediaUrl?.trim() || source.mediaUrl?.trim() || "" : "";
  const mediaKind =
    options?.heroVariant && frame.kind === "title-media"
      ? "none"
      : useStripMedia && mediaUrl
        ? frameMediaKind === "video"
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

export function resolvePromoFrames(
  banner: PromoContentSource & { frames?: PromoFrame[] },
  options?: { heroVariant?: boolean }
): PromoFrame[] {
  const frames = normalizePromoFrames(banner.frames, banner).map((frame) =>
    resolveFrameContent(frame, banner, options)
  );

  if (options?.heroVariant) {
    return frames.filter((frame) => frame.kind !== "title-media" && frame.kind !== "empty");
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
