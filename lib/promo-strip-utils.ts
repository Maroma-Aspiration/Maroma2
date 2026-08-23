import type { CSSProperties } from "react";
import type { PromoBanner } from "./promo-types";

export const PROMO_STRIP_DEFAULTS = {
  stripBackground: "#134a57",
  stripHeightPx: 106,
  stripOpacity: 1,
  mediaOffsetXCm: 3,
  marqueeForceScroll: true,
  heroMarqueeStartOffsetCm: 3,
  heroMarqueeStartOffsetPx: 0,
} as const;

const LEGACY_STRIP_HEIGHT_PX = 76;

function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export type PromoStripFields = {
  stripBackground: string;
  stripHeightPx: number;
  stripOpacity: number;
  mediaOffsetXCm: number;
  marqueeForceScroll: boolean;
  heroMarqueeStartOffsetCm: number;
  heroMarqueeStartOffsetPx: number;
};

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

export function normalizePromoStripFields(banner: Partial<PromoBanner>): PromoStripFields {
  const bg =
    typeof banner.stripBackground === "string" && banner.stripBackground.trim()
      ? banner.stripBackground.trim()
      : PROMO_STRIP_DEFAULTS.stripBackground;

  return {
    stripBackground: bg,
    stripHeightPx: clampNum(
      typeof banner.stripHeightPx === "number" && banner.stripHeightPx === LEGACY_STRIP_HEIGHT_PX
        ? PROMO_STRIP_DEFAULTS.stripHeightPx
        : banner.stripHeightPx,
      48,
      160,
      PROMO_STRIP_DEFAULTS.stripHeightPx
    ),
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
  };
}

export function promoStripStyleVars(banner: Partial<PromoBanner>): CSSProperties {
  const strip = normalizePromoStripFields(banner);
  return {
    ["--promo-strip-height" as string]: `${strip.stripHeightPx}px`,
    ["--promo-strip-bg" as string]: strip.stripBackground,
    ["--promo-strip-bg-fill" as string]: promoStripFillColor(strip.stripBackground, strip.stripOpacity),
    ["--promo-strip-opacity" as string]: String(strip.stripOpacity),
    ["--promo-media-offset-x" as string]: `${strip.mediaOffsetXCm}cm`,
  };
}
