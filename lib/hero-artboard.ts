import type { HeroMediaLayout, XY } from "./hero-media-layout-types";

/** Fixed-ratio hero design surface — all layers position relative to this box. */
export const HERO_ARTBOARD_MAX_WIDTH_PX = 1440;
export const HERO_ARTBOARD_ASPECT = 16 / 9;

/** Default copy block placement (% of artboard). */
export const HERO_COPY_LAYOUT = {
  leftPct: 6,
  topPct: 14,
  widthPct: 44,
} as const;

/** Reference artboard height for px → % migration (16:9). */
export const HERO_ARTBOARD_REF_HEIGHT_PX = HERO_ARTBOARD_MAX_WIDTH_PX / HERO_ARTBOARD_ASPECT;

/** Default carousel anchor when no custom offset is saved (% of artboard, bottom-center). */
export const HERO_RITUAL_DEFAULT_POS_PCT: XY = { x: 50, y: 86 };

/** Frosted band behind the ritual carousel (% of artboard, center-anchored). */
export const HERO_RITUAL_BAND_DEFAULT_LAYOUT: HeroMediaLayout = {
  x: 50,
  y: 80,
  width: 94,
  height: 18,
};

/** Default gap between carousel handoff and Loved section header (px). */
export const LOVED_HANDOFF_OFFSET_Y_PX = 36;

/** Fixed mobile artboard height — % ritual coordinates are relative to this box. */
export const MOBILE_COMPOSED_ARTBOARD_HEIGHT_PX = 640;

/** Mobile ritual stack grid row minimum — band % coords map to this reference height. */
export const MOBILE_RITUAL_STACK_REF_HEIGHT_PX = 140;

/** Reference tile size at 390px mobile artboard (matches 8.4cqw clamp min). */
export const MOBILE_RITUAL_REF_CARD_PX = 35;

/** Admin height slider default (% of MOBILE_RITUAL_STACK_REF_HEIGHT_PX). */
export const MOBILE_RITUAL_BAND_HEIGHT_PCT_DEFAULT = 52;

/** Snug band = tile row height × this ratio at default admin height %. */
export const MOBILE_RITUAL_BAND_HEIGHT_SNUG_RATIO = 1.15;

/** Height multiplier from admin height slider — applied to live --ritual-card-size in CSS. */
export function mobileRitualBandHeightRatio(heightPct: number): number {
  return (
    MOBILE_RITUAL_BAND_HEIGHT_SNUG_RATIO *
    (heightPct / MOBILE_RITUAL_BAND_HEIGHT_PCT_DEFAULT)
  );
}

/** Band height as px from saved mobile height % — tied to tile row, not stack ref. */
export function mobileRitualBandHeightPx(heightPct: number): number {
  return MOBILE_RITUAL_REF_CARD_PX * mobileRitualBandHeightRatio(heightPct);
}

/** Vertical nudge as a multiple of --ritual-card-size (CSS: card-size × this ratio). */
export function mobileRitualBandYRatio(yPct: number, heightPct?: number): number {
  return mobileRitualBandYOffsetPx(yPct, heightPct) / MOBILE_RITUAL_REF_CARD_PX;
}

/** Band Y% maps to ritual stack reference height — negative lifts toward carousel. */
export function mobileRitualBandYOffsetPx(yPct: number, _heightPct?: number): number {
  return (yPct / 100) * MOBILE_RITUAL_STACK_REF_HEIGHT_PX;
}

export function ritualCarouselPxToPct(px: XY, bounds?: { width: number; height: number }): XY {
  const width = bounds?.width ?? HERO_ARTBOARD_MAX_WIDTH_PX;
  const height = bounds?.height ?? HERO_ARTBOARD_REF_HEIGHT_PX;
  return {
    x: (px.x / width) * 100,
    y: (px.y / height) * 100,
  };
}

export function ritualCarouselPctToPx(pct: XY, bounds: { width: number; height: number }): XY {
  return {
    x: Math.round((pct.x / 100) * bounds.width),
    y: Math.round((pct.y / 100) * bounds.height),
  };
}

/** Matches `.nav { padding-inline: 6vw }` — primary frame right edge lines up with nav CTA column. */
export const HERO_NAV_INLINE_INSET_PCT = 6;

/** Default primary product scene (% of artboard, center-anchored frame). */
export const HERO_PRIMARY_MEDIA_LAYOUT: HeroMediaLayout = {
  x: 100 - HERO_NAV_INLINE_INSET_PCT - 44 / 2,
  y: 50,
  width: 44,
  height: 78,
};

export const HERO_ARTBOARD_ZERO_OFFSET: XY = { x: 0, y: 0 };

/** Pre-artboard admin drags used large viewport px nudges (e.g. -241px) — strip on load only. */
const LEGACY_PX_NUDGE_THRESHOLD = 200;

export function isLegacyArtboardPxNudge(offset: XY): boolean {
  return (
    Math.abs(offset.x) > LEGACY_PX_NUDGE_THRESHOLD ||
    Math.abs(offset.y) > LEGACY_PX_NUDGE_THRESHOLD
  );
}

/** Primary media parked on the far right / full-bleed from the old vh/vw hero. */
export function isLegacyArtboardPrimaryLayout(layout: HeroMediaLayout): boolean {
  return layout.width > 88 || layout.height > 88;
}

export function isLegacyHeroLayout(layout: HeroMediaLayout): boolean {
  return layout.width > 100 || layout.height > 100;
}

export function sanitizeArtboardPxNudge(offset: XY): XY {
  return isLegacyArtboardPxNudge(offset) ? HERO_ARTBOARD_ZERO_OFFSET : offset;
}

export function sanitizeArtboardPrimaryLayout(layout: HeroMediaLayout): HeroMediaLayout {
  return isLegacyArtboardPrimaryLayout(layout) ? { ...HERO_PRIMARY_MEDIA_LAYOUT } : layout;
}

/** Render-time nudge — always use saved values; legacy stripping happens once in parse. */
export function heroArtboardOffset(offset: { x: number; y: number }): { x: number; y: number } {
  return offset;
}

export function resolveArtboardPrimaryLayout(saved: HeroMediaLayout): HeroMediaLayout {
  return sanitizeArtboardPrimaryLayout(saved);
}
