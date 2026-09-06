import type { CSSProperties } from "react";
import type { PromoBanner } from "./promo-types";
import { visibleCtaBuyLinks } from "./promo-buy-links-utils";

export const PROMO_STRIP_HEIGHT_MIN = 48;
export const PROMO_STRIP_HEIGHT_MAX = 720;
export const PROMO_STRIP_POSITION_CM_MIN = -20;
export const PROMO_STRIP_POSITION_CM_MAX = 40;
export const PROMO_STRIP_POSITION_PX_MIN = -600;
export const PROMO_STRIP_POSITION_PX_MAX = 600;
export const PROMO_STRIP_ASPECT_21_9 = "21:9" as const;
export const PROMO_STRIP_ASPECT_FIXED = "fixed" as const;

export const PROMO_STRIP_DEFAULTS = {
  stripBackground: "#134a57",
  stripBackgroundImageUrl: "",
  stripBackgroundMediaKind: "none" as const,
  stripBackgroundVideoLoop: true,
  stripBackgroundFallbackImageUrl: "",
  stripBackgroundImageScale: 100,
  stripBackgroundImageOffsetX: 50,
  stripBackgroundImageOffsetY: 50,
  stripHeightPx: 106,
  stripPositionOffsetCm: 0,
  stripPositionOffsetPx: 0,
  stripAspectRatio: PROMO_STRIP_ASPECT_FIXED,
  stripOpacity: 1,
  mediaOffsetXCm: 3,
  marqueeForceScroll: true,
  heroMarqueeStartOffsetCm: 3,
  heroMarqueeStartOffsetPx: 0,
  heroMarqueeEndOffsetCm: 0,
  heroMarqueeEndOffsetPx: 0,
} as const;

const LEGACY_STRIP_HEIGHT_PX = 76;

function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export type PromoStripFields = {
  stripBackground: string;
  stripBackgroundImageUrl: string;
  stripBackgroundMediaKind: "none" | "image" | "video";
  stripBackgroundVideoLoop: boolean;
  stripBackgroundFallbackImageUrl: string;
  stripBackgroundImageScale: number;
  stripBackgroundImageOffsetX: number;
  stripBackgroundImageOffsetY: number;
  stripHeightPx: number;
  stripPositionOffsetCm: number;
  stripPositionOffsetPx: number;
  stripAspectRatio: "fixed" | "21:9";
  stripOpacity: number;
  mediaOffsetXCm: number;
  marqueeForceScroll: boolean;
  heroMarqueeStartOffsetCm: number;
  heroMarqueeStartOffsetPx: number;
  heroMarqueeEndOffsetCm: number;
  heroMarqueeEndOffsetPx: number;
};

export function asFiniteNumber(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function resolvePromoBannerTitle(input: {
  title?: unknown;
  body?: unknown;
  frames?: unknown;
}): string {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (title) return title;
  if (Array.isArray(input.frames)) {
    for (const frame of input.frames) {
      if (!frame || typeof frame !== "object") continue;
      const row = frame as { kind?: unknown; body?: unknown };
      if (row.kind === "marquee" && typeof row.body === "string" && row.body.trim()) {
        return row.body.trim().slice(0, 80);
      }
    }
  }
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (body) return body.slice(0, 80);
  return "Homepage promo";
}

function parseHexColor(input: string): { r: number; g: number; b: number } | null {
  const trimmed = input.trim();
  const match = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) {
    return null;
  }
  let hex = match[1];
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

/** Opaque fill for the strip pseudo-element (alpha baked in, no CSS `opacity`). */
export function promoStripFillColor(background: string, opacity: number): string {
  const alpha = Math.min(1, Math.max(0.05, opacity));
  const rgb = parseHexColor(background);
  if (!rgb) {
    return background.trim();
  }
  if (alpha >= 0.999) {
    return background.trim();
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

const VIDEO_URL_PATTERN = /\.(mp4|webm|mov|m4v|ogv)(\?|$)/i;

export function resolveStripBackgroundMediaKind(
  banner: Partial<PromoBanner>
): "none" | "image" | "video" {
  const url =
    typeof banner.stripBackgroundImageUrl === "string" ? banner.stripBackgroundImageUrl.trim() : "";
  if (!url) return "none";
  if (banner.stripBackgroundMediaKind === "video") return "video";
  if (banner.stripBackgroundMediaKind === "image") return "image";
  return VIDEO_URL_PATTERN.test(url) ? "video" : "image";
}

export function stripBackgroundIsVideo(banner: Partial<PromoBanner>): boolean {
  return resolveStripBackgroundMediaKind(banner) === "video";
}

export function normalizePromoStripFields(banner: Partial<PromoBanner>): PromoStripFields {
  const bg =
    typeof banner.stripBackground === "string" && banner.stripBackground.trim()
      ? banner.stripBackground.trim()
      : PROMO_STRIP_DEFAULTS.stripBackground;

  return {
    stripBackground: bg,
    stripBackgroundImageUrl:
      typeof banner.stripBackgroundImageUrl === "string" ? banner.stripBackgroundImageUrl.trim() : "",
    stripBackgroundMediaKind: resolveStripBackgroundMediaKind(banner),
    stripBackgroundVideoLoop: banner.stripBackgroundVideoLoop !== false,
    stripBackgroundFallbackImageUrl:
      typeof banner.stripBackgroundFallbackImageUrl === "string"
        ? banner.stripBackgroundFallbackImageUrl.trim()
        : "",
    stripBackgroundImageScale: clampNum(
      banner.stripBackgroundImageScale,
      25,
      400,
      PROMO_STRIP_DEFAULTS.stripBackgroundImageScale
    ),
    stripBackgroundImageOffsetX: clampNum(
      banner.stripBackgroundImageOffsetX,
      0,
      100,
      PROMO_STRIP_DEFAULTS.stripBackgroundImageOffsetX
    ),
    stripBackgroundImageOffsetY: clampNum(
      banner.stripBackgroundImageOffsetY,
      0,
      100,
      PROMO_STRIP_DEFAULTS.stripBackgroundImageOffsetY
    ),
    stripHeightPx: clampNum(
      typeof banner.stripHeightPx === "number" && banner.stripHeightPx === LEGACY_STRIP_HEIGHT_PX
        ? PROMO_STRIP_DEFAULTS.stripHeightPx
        : banner.stripHeightPx,
      PROMO_STRIP_HEIGHT_MIN,
      PROMO_STRIP_HEIGHT_MAX,
      PROMO_STRIP_DEFAULTS.stripHeightPx
    ),
    stripPositionOffsetCm: clampNum(
      banner.stripPositionOffsetCm,
      PROMO_STRIP_POSITION_CM_MIN,
      PROMO_STRIP_POSITION_CM_MAX,
      PROMO_STRIP_DEFAULTS.stripPositionOffsetCm
    ),
    stripPositionOffsetPx: clampNum(
      banner.stripPositionOffsetPx,
      PROMO_STRIP_POSITION_PX_MIN,
      PROMO_STRIP_POSITION_PX_MAX,
      PROMO_STRIP_DEFAULTS.stripPositionOffsetPx
    ),
    stripAspectRatio:
      banner.stripAspectRatio === PROMO_STRIP_ASPECT_21_9 &&
      resolveStripBackgroundMediaKind(banner) === "video"
        ? PROMO_STRIP_ASPECT_21_9
        : PROMO_STRIP_ASPECT_FIXED,
    stripOpacity: clampNum(banner.stripOpacity, 0.05, 1, PROMO_STRIP_DEFAULTS.stripOpacity),
    mediaOffsetXCm: clampNum(banner.mediaOffsetXCm, -10, 20, PROMO_STRIP_DEFAULTS.mediaOffsetXCm),
    marqueeForceScroll: banner.marqueeForceScroll !== false,
    heroMarqueeStartOffsetCm: clampNum(
      banner.heroMarqueeStartOffsetCm,
      -5,
      25,
      PROMO_STRIP_DEFAULTS.heroMarqueeStartOffsetCm
    ),
    heroMarqueeStartOffsetPx: clampNum(
      banner.heroMarqueeStartOffsetPx,
      -600,
      600,
      PROMO_STRIP_DEFAULTS.heroMarqueeStartOffsetPx
    ),
    heroMarqueeEndOffsetCm: clampNum(
      banner.heroMarqueeEndOffsetCm,
      -15,
      15,
      PROMO_STRIP_DEFAULTS.heroMarqueeEndOffsetCm
    ),
    heroMarqueeEndOffsetPx: clampNum(
      banner.heroMarqueeEndOffsetPx,
      -600,
      600,
      PROMO_STRIP_DEFAULTS.heroMarqueeEndOffsetPx
    ),
  };
}

export function promoStripBannerClass(banner: Partial<PromoBanner>): string {
  const strip = normalizePromoStripFields(banner);
  return strip.stripAspectRatio === PROMO_STRIP_ASPECT_21_9
    ? " promo-banner--aspect-21-9"
    : " promo-banner--aspect-fixed";
}

export function isPromoModeEnabled(banner: Partial<PromoBanner> | null | undefined): boolean {
  if (!banner) return false;
  return banner.promoModeEnabled !== false;
}

/** Live homepage hides the hero product graphic when a 21:9 video strip is active. */
export function promoStripHidesHeroPrimary(banner: Partial<PromoBanner> | null | undefined): boolean {
  if (!isPromoModeEnabled(banner)) return false;
  if (!banner) return false;
  const strip = normalizePromoStripFields(banner);
  return (
    strip.stripAspectRatio === PROMO_STRIP_ASPECT_21_9 && strip.stripBackgroundMediaKind === "video"
  );
}

/** Strip background video plays first; CTA product tiles appear when the video ends. */
export function promoStripVideoThenCta(banner: Partial<PromoBanner> | null | undefined): boolean {
  if (!banner || !stripBackgroundIsVideo(banner)) return false;
  const { left, right } = visibleCtaBuyLinks(banner.ctaBuyLinks ?? []);
  if (left.length + right.length > 0) return true;
  return Boolean(banner.ctaLabel?.trim());
}

export function promoStripStyleVars(banner: Partial<PromoBanner>): CSSProperties {
  const strip = normalizePromoStripFields(banner);
  const bgImage =
    strip.stripBackgroundImageUrl && strip.stripBackgroundMediaKind === "image"
      ? `url(${JSON.stringify(strip.stripBackgroundImageUrl)})`
      : "none";
  return {
    ["--promo-strip-height" as string]: `${strip.stripHeightPx}px`,
    ["--promo-strip-min-height" as string]: `${strip.stripHeightPx}px`,
    ["--promo-strip-bg" as string]: strip.stripBackground,
    ["--promo-strip-bg-fill" as string]: promoStripFillColor(strip.stripBackground, strip.stripOpacity),
    ["--promo-strip-bg-image" as string]: bgImage,
    ["--promo-strip-bg-image-size" as string]: `${strip.stripBackgroundImageScale}% auto`,
    ["--promo-strip-bg-image-position" as string]: `${strip.stripBackgroundImageOffsetX}% ${strip.stripBackgroundImageOffsetY}%`,
    ["--promo-strip-bg-video-scale" as string]: String(strip.stripBackgroundImageScale / 100),
    ["--promo-strip-opacity" as string]: String(strip.stripOpacity),
    ["--promo-media-offset-x" as string]: `${strip.mediaOffsetXCm}cm`,
  };
}
