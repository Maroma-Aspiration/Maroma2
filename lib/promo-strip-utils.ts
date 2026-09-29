import type { CSSProperties } from "react";
import type { PromoBanner } from "./promo-types";
import { visibleCtaBuyLinks } from "./promo-buy-links-utils";
import { firstUsablePublicMediaUrl } from "./usable-media-url";

export const PROMO_STRIP_HEIGHT_MIN = 48;
export const PROMO_STRIP_HEIGHT_MAX = 1440;
export const PROMO_STRIP_POSITION_CM_MIN = -20;
export const PROMO_STRIP_POSITION_CM_MAX = 40;
export const PROMO_STRIP_POSITION_PX_MIN = -1200;
export const PROMO_STRIP_POSITION_PX_MAX = 1200;
export const PROMO_STRIP_ASPECT_21_9 = "21:9" as const;
export const PROMO_STRIP_ASPECT_FIXED = "fixed" as const;

export const PROMO_STRIP_CAROUSEL_MAX = 8;
export const PROMO_STRIP_CAROUSEL_INTERVAL_MS_DEFAULT = 5500;
export const PROMO_STRIP_CAROUSEL_FADE_MS_DEFAULT = 1100;
export const PROMO_STRIP_CAROUSEL_INTERVAL_MS_MIN = 3000;
export const PROMO_STRIP_CAROUSEL_INTERVAL_MS_MAX = 16000;
export const PROMO_STRIP_CAROUSEL_FADE_MS_MIN = 400;
export const PROMO_STRIP_CAROUSEL_FADE_MS_MAX = 2000;

export const PROMO_STRIP_DEFAULTS = {
  stripBackground: "#134a57",
  stripBackgroundImageUrl: "",
  stripBackgroundCarouselUrls: [] as string[],
  stripBackgroundCarouselEnabled: false,
  stripBackgroundCarouselIntervalMs: PROMO_STRIP_CAROUSEL_INTERVAL_MS_DEFAULT,
  stripBackgroundCarouselFadeMs: PROMO_STRIP_CAROUSEL_FADE_MS_DEFAULT,
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
  stripBackgroundCarouselUrls: string[];
  stripBackgroundCarouselEnabled: boolean;
  stripBackgroundCarouselIntervalMs: number;
  stripBackgroundCarouselFadeMs: number;
  stripBackgroundMediaKind: "none" | "image" | "video";
  stripBackgroundVideoLoop: boolean;
  stripBackgroundFallbackImageUrl: string;
  stripBackgroundImageScale: number;
  stripBackgroundImageOffsetX: number;
  stripBackgroundImageOffsetY: number;
  stripHeightPx: number;
  stripWidthPct?: number;
  stripFrameScale?: number;
  stripPositionOffsetX?: number;
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
      const row = frame as { title?: unknown };
      if (typeof row.title === "string" && row.title.trim()) {
        return row.title.replace(/\s+/g, " ").trim().slice(0, 80);
      }
    }
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

export function normalizePromoStripCarouselUrls(
  value: unknown,
  fallbackUrl = ""
): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  const push = (raw: unknown) => {
    const url = firstUsablePublicMediaUrl(raw);
    if (!url || seen.has(url)) return;
    seen.add(url);
    urls.push(url);
  };
  if (Array.isArray(value)) {
    for (const item of value) {
      push(item);
      if (urls.length >= PROMO_STRIP_CAROUSEL_MAX) return urls;
    }
  }
  if (urls.length === 0) push(fallbackUrl);
  return urls;
}

export function promoStripCarouselUrls(banner: Partial<PromoBanner>): string[] {
  return normalizePromoStripCarouselUrls(
    banner.stripBackgroundCarouselUrls,
    banner.stripBackgroundImageUrl
  );
}

export function promoStripUsesCarousel(banner: Partial<PromoBanner>): boolean {
  if (banner.stripBackgroundCarouselEnabled !== true) return false;
  if (banner.stripBackgroundMediaKind === "video") return false;
  return promoStripCarouselUrls(banner).length >= 2;
}

export function resolveStripBackgroundMediaKind(
  banner: Partial<PromoBanner>
): "none" | "image" | "video" {
  if (banner.stripBackgroundMediaKind === "video") {
    const url = firstUsablePublicMediaUrl(banner.stripBackgroundImageUrl);
    return url ? "video" : "none";
  }
  const carouselUrls = promoStripCarouselUrls(banner);
  const url = firstUsablePublicMediaUrl(banner.stripBackgroundImageUrl, carouselUrls[0]);
  if (!url && carouselUrls.length === 0) return "none";
  if (banner.stripBackgroundMediaKind === "image") return "image";
  if (banner.stripBackgroundCarouselEnabled === true && carouselUrls.length > 0) return "image";
  if (!url) return "none";
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
  const carouselUrls = normalizePromoStripCarouselUrls(
    banner.stripBackgroundCarouselUrls,
    banner.stripBackgroundImageUrl
  );
  const carouselEnabled = banner.stripBackgroundCarouselEnabled === true;
  const imageUrl =
    firstUsablePublicMediaUrl(banner.stripBackgroundImageUrl) ||
    (carouselEnabled ? carouselUrls[0] ?? "" : "");

  return {
    stripBackground: bg,
    stripBackgroundImageUrl: imageUrl,
    stripBackgroundCarouselUrls: carouselUrls,
    stripBackgroundCarouselEnabled: carouselEnabled,
    stripBackgroundCarouselIntervalMs: clampNum(
      banner.stripBackgroundCarouselIntervalMs,
      PROMO_STRIP_CAROUSEL_INTERVAL_MS_MIN,
      PROMO_STRIP_CAROUSEL_INTERVAL_MS_MAX,
      PROMO_STRIP_CAROUSEL_INTERVAL_MS_DEFAULT
    ),
    stripBackgroundCarouselFadeMs: clampNum(
      banner.stripBackgroundCarouselFadeMs,
      PROMO_STRIP_CAROUSEL_FADE_MS_MIN,
      PROMO_STRIP_CAROUSEL_FADE_MS_MAX,
      PROMO_STRIP_CAROUSEL_FADE_MS_DEFAULT
    ),
    stripBackgroundMediaKind: resolveStripBackgroundMediaKind({
      ...banner,
      stripBackgroundImageUrl: imageUrl,
      stripBackgroundCarouselUrls: carouselUrls,
      stripBackgroundCarouselEnabled: carouselEnabled,
    }),
    stripBackgroundVideoLoop: banner.stripBackgroundVideoLoop !== false,
    stripBackgroundFallbackImageUrl: firstUsablePublicMediaUrl(banner.stripBackgroundFallbackImageUrl),
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
    stripPositionOffsetX: clampNum(banner.stripPositionOffsetX, -1200, 1200, 0),
    stripFrameScale: clampNum(banner.stripFrameScale, 25, 150, 100),
    stripWidthPct: banner.stripWidthPct == null ? undefined : clampNum(banner.stripWidthPct, 20, 150, 100),
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
  const aspect =
    strip.stripAspectRatio === PROMO_STRIP_ASPECT_21_9
      ? " promo-banner--aspect-21-9"
      : " promo-banner--aspect-fixed";
  // A hand-tuned phone layout is authored in real phone pixels, so the auto-fit rescale is off.
  return banner.mobileTuned ? `${aspect} promo-banner--mobile-tuned` : aspect;
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
  const frameScale = (strip.stripFrameScale ?? 100) / 100;
  const frameHeight = strip.stripHeightPx * frameScale;
  const usesCarousel = promoStripUsesCarousel(strip);
  const hasBackgroundImage = Boolean(strip.stripBackgroundImageUrl && strip.stripBackgroundMediaKind === "image");
  const bgImage = usesCarousel
    ? "none"
    : strip.stripBackgroundImageUrl && strip.stripBackgroundMediaKind === "image"
      ? `url(${JSON.stringify(strip.stripBackgroundImageUrl)})`
      : typeof banner.stripBackgroundGradient === "string" && banner.stripBackgroundGradient.trim()
        ? banner.stripBackgroundGradient.trim()
        : "none";
  return {
    ...(strip.stripWidthPct == null && frameScale === 1 ? {} : { ["--hero-promo-width-pct" as string]: `${(strip.stripWidthPct ?? 100) * frameScale}%` }),
    ["--promo-strip-height" as string]: `${frameHeight}px`,
    ["--promo-frame-x" as string]: `${strip.stripPositionOffsetX ?? 0}px`,
    ["--promo-frame-y" as string]: `${strip.stripPositionOffsetPx}px`,
    ["--promo-responsive-height" as string]: `${frameHeight / 14.4}vw`,
    ["--promo-strip-min-height" as string]: `${frameHeight}px`,
    ["--promo-strip-bg" as string]: strip.stripBackground,
    ["--promo-strip-bg-fill" as string]: usesCarousel
      ? promoStripFillColor(strip.stripBackground, strip.stripOpacity)
      : bgImage !== "none" || strip.stripBackgroundMediaKind === "video"
        ? "transparent"
        : promoStripFillColor(strip.stripBackground, strip.stripOpacity),
    ["--promo-strip-bg-image" as string]: bgImage,
    ["--promo-strip-bg-image-size" as string]: hasBackgroundImage ? `${strip.stripBackgroundImageScale}% auto` : "100% 100%",
    ["--promo-frame-image-size" as string]: hasBackgroundImage ? `${strip.stripBackgroundImageScale}vw auto` : "100% 100%",
    ["--promo-frame-image-position" as string]: hasBackgroundImage ? `calc(50% + ${strip.stripBackgroundImageOffsetX - 50}vw) calc(50% + ${(strip.stripBackgroundImageOffsetY - 50) * 0.416667}vw)` : "center",
    ["--promo-strip-bg-image-position" as string]: hasBackgroundImage || strip.stripBackgroundMediaKind === "video" || usesCarousel ? `${strip.stripBackgroundImageOffsetX}% ${strip.stripBackgroundImageOffsetY}%` : "center",
    ["--promo-strip-bg-video-scale" as string]: String(strip.stripBackgroundImageScale / 100),
    ["--promo-strip-carousel-fade-ms" as string]: `${strip.stripBackgroundCarouselFadeMs}ms`,
    ["--promo-strip-opacity" as string]: String(strip.stripOpacity),
    ["--promo-media-offset-x" as string]: `${strip.mediaOffsetXCm}cm`,
  };
}
