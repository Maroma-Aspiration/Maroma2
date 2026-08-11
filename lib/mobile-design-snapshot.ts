import { MOBILE_COMPOSED_ARTBOARD_HEIGHT_PX } from "./hero-artboard";
import type { HeroMobileOverrides } from "./hero-media-layout-types";
import type { ResolvedHeroMobileLayout } from "./hero-mobile-layout";

/** Canonical mobile preview width (matches admin frame). */
export const MOBILE_DESIGN_WIDTH_PX = 390;

export const MOBILE_DESIGN_ARTBOARD_HEIGHT_PX = MOBILE_COMPOSED_ARTBOARD_HEIGHT_PX;

/** Full mobile layout snapshot for persistence — phone and laptop preview read the same object. */
export function buildMobilePersistenceSnapshot(
  resolved: ResolvedHeroMobileLayout,
  extras?: HeroMobileOverrides
): HeroMobileOverrides {
  return {
    ...extras,
    layout: { ...resolved.layout },
    overlayLayout: { ...resolved.overlayLayout },
    backgroundLayout: { ...resolved.backgroundLayout },
    primaryScale: resolved.primaryScale,
    overlayScale: resolved.overlayScale,
    ritualCarouselPosPct: { ...resolved.ritualCarouselPosPct },
    eyebrowPos: { ...resolved.eyebrowPos },
    headlinePos: { ...resolved.headlinePos },
    heroActionsPos: { ...resolved.heroActionsPos },
    headlineSizeRem: resolved.headlineSizeRem,
    heroCopyWidthVw: resolved.heroCopyWidthVw,
    lovedDividerOffsetY: resolved.lovedDividerOffsetY,
    lovedFloralOffsetY: resolved.lovedFloralOffsetY,
    lovedTintOpacity: resolved.lovedTintOpacity,
    heroCopyOffsetY: resolved.heroCopyOffsetY,
    ritualCarouselScale: resolved.ritualCarouselScale,
    ritualBandLayout: { ...resolved.ritualBandLayout },
    ritualBandScale: resolved.ritualBandScale,
    ritualBandVisible: resolved.ritualBandVisible,
  };
}
