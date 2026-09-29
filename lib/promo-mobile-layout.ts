import type { PromoBanner, PromoMobileLayout, PromoMobileOverlayLayout } from "./promo-types";

/** Width the desktop promo canvas is dragged against, mirrored by --promo-unit in CSS. */
export const PROMO_DESKTOP_DESIGN_WIDTH = 1440;
/** Reference phone width used to seed mobile values and to size the preview frame. */
export const PROMO_MOBILE_DESIGN_WIDTH = 390;
export const PROMO_MOBILE_HEIGHT_MIN = 100;
export const PROMO_MOBILE_HEIGHT_MAX = 900;

/** postMessage channel the mobile edit page uses to preview unsaved slider values. */
export const PROMO_MOBILE_PREVIEW_MESSAGE = "maroma:mobile-promo-preview";

export type PromoMobilePreviewMessage = {
  type: typeof PROMO_MOBILE_PREVIEW_MESSAGE;
  banner: PromoBanner | null;
};

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function normalizeOverlay(raw: unknown): PromoMobileOverlayLayout[] {
  if (!Array.isArray(raw)) return [];
  const rows: PromoMobileOverlayLayout[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    if (!id) continue;
    rows.push({
      id,
      x: clamp(row.x, 0, 100, 50),
      y: clamp(row.y, 0, 100, 50),
      scale: clamp(row.scale, 20, 270, 75),
    });
  }
  return rows.slice(0, 24);
}

export function normalizePromoMobileLayout(raw: unknown): PromoMobileLayout | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const row = raw as Record<string, unknown>;
  return {
    enabled: row.enabled === true,
    ...(row.stripWidthPct == null ? {} : { stripWidthPct: clamp(row.stripWidthPct, 20, 150, 100) }),
    stripPositionOffsetPx: clamp(row.stripPositionOffsetPx, -400, 400, 0),
    stripHeightPx: clamp(row.stripHeightPx, PROMO_MOBILE_HEIGHT_MIN, PROMO_MOBILE_HEIGHT_MAX, 300),
    textBannerOffsetX: clamp(row.textBannerOffsetX, -400, 400, 0),
    textBannerOffsetY: clamp(row.textBannerOffsetY, -400, 400, 0),
    textBannerScale: clamp(row.textBannerScale, 20, 220, 100),
    textBannerWidthPct: clamp(row.textBannerWidthPct, 20, 200, 100),
    textBannerHeightPct: clamp(row.textBannerHeightPct, 20, 300, 100),
    headlineOffsetX: clamp(row.headlineOffsetX, -400, 400, 0),
    headlineOffsetY: clamp(row.headlineOffsetY, -400, 400, 0),
    headlineScale: clamp(row.headlineScale, 40, 220, 100),
    taglineOffsetX: clamp(row.taglineOffsetX, -400, 400, 0),
    taglineOffsetY: clamp(row.taglineOffsetY, -400, 400, 0),
    taglineScale: clamp(row.taglineScale, 40, 220, 100),
    ctaOffsetX: clamp(row.ctaOffsetX, -400, 400, 0),
    ctaOffsetY: clamp(row.ctaOffsetY, -400, 400, 0),
    ctaScale: clamp(row.ctaScale, 40, 220, 100),
    thumbnailOffsetX: clamp(row.thumbnailOffsetX, -400, 400, 0),
    thumbnailOffsetY: clamp(row.thumbnailOffsetY, -400, 400, 0),
    overlay: normalizeOverlay(row.overlay),
  };
}

/**
 * Starting point for a hand-tuned phone layout: the desktop numbers put through the same
 * proportional maths the CSS auto-fit uses, so enabling the layout changes nothing at first.
 */
export function seedPromoMobileLayout(banner: PromoBanner): PromoMobileLayout {
  const desktopHeight = banner.stripHeightPx ?? 430;
  const mobileHeight = Math.min(desktopHeight, Math.max(260, PROMO_MOBILE_DESIGN_WIDTH * 0.78));
  const unitX = PROMO_MOBILE_DESIGN_WIDTH / PROMO_DESKTOP_DESIGN_WIDTH;
  const unitY = desktopHeight > 0 ? Math.min(1, mobileHeight / desktopHeight) : 1;
  const capped = (value: number | undefined) => Math.min(100, value ?? 100);
  return normalizePromoMobileLayout({
    enabled: true,
    stripWidthPct: Math.min(150, Math.max(20, banner.stripWidthPct ?? 100)),
    stripPositionOffsetPx: Math.round((banner.stripPositionOffsetPx ?? 0) * unitY),
    stripHeightPx: Math.round(mobileHeight),
    textBannerOffsetX: Math.round((banner.textBannerOffsetX ?? 0) * unitX),
    textBannerOffsetY: Math.round((banner.textBannerOffsetY ?? 0) * unitY),
    textBannerScale: capped(banner.textBannerScale),
    textBannerWidthPct: capped(banner.textBannerWidthPct),
    textBannerHeightPct: capped(banner.textBannerHeightPct),
    headlineOffsetX: Math.round((banner.headlineOffsetX ?? 0) * unitX),
    headlineOffsetY: Math.round((banner.headlineOffsetY ?? 0) * unitY),
    headlineScale: capped(banner.headlineScale),
    taglineOffsetX: Math.round((banner.taglineOffsetX ?? 0) * unitX),
    taglineOffsetY: Math.round((banner.taglineOffsetY ?? 0) * unitY),
    taglineScale: capped(banner.taglineScale),
    ctaOffsetX: Math.round((banner.ctaOffsetX ?? 0) * unitX),
    ctaOffsetY: Math.round((banner.ctaOffsetY ?? 0) * unitY),
    ctaScale: 100,
    thumbnailOffsetX: Math.round((banner.thumbnailOffsetX ?? 0) * unitX),
    thumbnailOffsetY: Math.round((banner.thumbnailOffsetY ?? 0) * unitY),
    overlay: (banner.overlayImages ?? []).map((layer) => ({
      id: layer.id,
      x: layer.x,
      y: layer.y,
      scale: layer.scale,
    })),
  }) as PromoMobileLayout;
}

/**
 * Merge a banner's mobile layout into the fields the renderer already reads, so nothing
 * downstream needs to know which viewport it is drawing.
 */
export function applyPromoMobileLayout(banner: PromoBanner): PromoBanner {
  const mobile = banner.mobile;
  if (!mobile?.enabled) return banner;
  const overlayById = new Map(mobile.overlay.map((row) => [row.id, row]));
  return {
    ...banner,
    mobileTuned: true,
    stripWidthPct: mobile.stripWidthPct ?? banner.stripWidthPct,
    stripPositionOffsetPx: mobile.stripPositionOffsetPx ?? banner.stripPositionOffsetPx,
    stripHeightPx: mobile.stripHeightPx,
    textBannerOffsetX: mobile.textBannerOffsetX,
    textBannerOffsetY: mobile.textBannerOffsetY,
    textBannerScale: mobile.textBannerScale,
    textBannerWidthPct: mobile.textBannerWidthPct,
    textBannerHeightPct: mobile.textBannerHeightPct,
    headlineOffsetX: mobile.headlineOffsetX,
    headlineOffsetY: mobile.headlineOffsetY,
    headlineScale: mobile.headlineScale,
    taglineOffsetX: mobile.taglineOffsetX,
    taglineOffsetY: mobile.taglineOffsetY,
    taglineScale: mobile.taglineScale,
    ctaOffsetX: mobile.ctaOffsetX,
    ctaOffsetY: mobile.ctaOffsetY,
    ctaScale: mobile.ctaScale,
    thumbnailOffsetX: mobile.thumbnailOffsetX,
    thumbnailOffsetY: mobile.thumbnailOffsetY,
    overlayImages: banner.overlayImages?.map((layer) => {
      const row = overlayById.get(layer.id);
      return row ? { ...layer, x: row.x, y: row.y, scale: row.scale } : layer;
    }),
  };
}
