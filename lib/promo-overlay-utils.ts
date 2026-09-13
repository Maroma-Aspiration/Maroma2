/** Most second-layer images one promo banner can hold. */
export const PROMO_OVERLAY_IMAGE_MAX = 24;

/**
 * Layer depth for promo second-layer images.
 *
 * Depth 0 is the historic behaviour. Negative values push an image behind the
 * banner copy, positive values bring it in front of the copy and the CTA.
 * Two images on the same depth still stack in the order they were added.
 */
export const PROMO_OVERLAY_DEPTH_MIN = -2;
export const PROMO_OVERLAY_DEPTH_MAX = 4;
export const PROMO_OVERLAY_DEPTH_DEFAULT = 0;

/**
 * Stacking order inside `.promo-banner`: background media sits at 0, the copy
 * and CTA at 1 on strip banners and 4 on hero banners, product thumbnails at 2.
 * Depth steps map onto that scale so a single setting behaves the same either way.
 */
const depthZIndex: Record<number, number> = {
  [-2]: 0,
  [-1]: 1,
  0: 2,
  1: 3,
  2: 5,
  3: 7,
  4: 9,
};

const depthLabels: Record<number, string> = {
  [-2]: "Furthest back",
  [-1]: "Behind the text",
  0: "Default",
  1: "Forward",
  2: "In front of the text",
  3: "Further forward",
  4: "Front-most",
};

export function clampPromoOverlayDepth(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return PROMO_OVERLAY_DEPTH_DEFAULT;
  return Math.min(PROMO_OVERLAY_DEPTH_MAX, Math.max(PROMO_OVERLAY_DEPTH_MIN, Math.round(numeric)));
}

export function promoOverlayDepthZIndex(depth: unknown): number {
  return depthZIndex[clampPromoOverlayDepth(depth)] ?? depthZIndex[PROMO_OVERLAY_DEPTH_DEFAULT];
}

export function promoOverlayDepthLabel(depth: unknown): string {
  return depthLabels[clampPromoOverlayDepth(depth)] ?? depthLabels[PROMO_OVERLAY_DEPTH_DEFAULT];
}
