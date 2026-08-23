import { HERO_RITUAL_DEFAULT_POS_PCT } from "./hero-artboard";
import type { HeroMediaLayout, HeroMobileOverrides, XY } from "./hero-media-layout-types";

export const DEFAULT_HERO_MOBILE_LAYOUT: HeroMediaLayout = {
  x: 50,
  y: 58,
  width: 78,
  height: 62
};

export const DEFAULT_HERO_MOBILE_OVERLAY_LAYOUT: HeroMediaLayout = {
  x: 50,
  y: 58,
  width: 80,
  height: 64
};

export const DEFAULT_HERO_MOBILE_BACKGROUND_LAYOUT: HeroMediaLayout = {
  x: 0,
  y: 0,
  width: 100,
  height: 100
};

/** Mobile frosted band behind carousel tiles (% of ritual stack width; Y = % from stack top, negative lifts into hero). */
export const DEFAULT_HERO_MOBILE_RITUAL_BAND_LAYOUT: HeroMediaLayout = {
  x: 50,
  y: 0,
  width: 100,
  height: 52,
};

export type ResolvedHeroMobileLayout = {
  layout: HeroMediaLayout;
  overlayLayout: HeroMediaLayout;
  backgroundLayout: HeroMediaLayout;
  primaryScale: number;
  overlayScale: number;
  ritualCarouselPosPct: XY;
  eyebrowPos: XY;
  headlinePos: XY;
  heroActionsPos: XY;
  heroPromoBannerTopCm: number;
  heroPromoBannerPos: XY;
  heroPromoBannerWidthPct: number;
  headlineSizeRem: number;
  heroCopyWidthVw: number;
  lovedDividerOffsetY: number;
  lovedFloralOffsetY: number;
  lovedTintOpacity: number;
  heroCopyOffsetY: string;
  ritualCarouselScale: number;
  ritualBandLayout: HeroMediaLayout;
  ritualBandScale: number;
  ritualBandVisible: boolean;
};

const DEFAULTS: ResolvedHeroMobileLayout = {
  layout: DEFAULT_HERO_MOBILE_LAYOUT,
  overlayLayout: DEFAULT_HERO_MOBILE_OVERLAY_LAYOUT,
  backgroundLayout: DEFAULT_HERO_MOBILE_BACKGROUND_LAYOUT,
  primaryScale: 1,
  overlayScale: 1,
  ritualCarouselPosPct: { ...HERO_RITUAL_DEFAULT_POS_PCT },
  eyebrowPos: { x: 0, y: 0 },
  headlinePos: { x: 0, y: 0 },
  heroActionsPos: { x: 0, y: 0 },
  heroPromoBannerTopCm: 8,
  heroPromoBannerPos: { x: 0, y: 0 },
  heroPromoBannerWidthPct: 100,
  headlineSizeRem: 3.8,
  heroCopyWidthVw: 92,
  lovedDividerOffsetY: 0,
  lovedFloralOffsetY: 0,
  lovedTintOpacity: 0.38,
  heroCopyOffsetY: "0px",
  ritualCarouselScale: 1,
  ritualBandLayout: { ...DEFAULT_HERO_MOBILE_RITUAL_BAND_LAYOUT },
  ritualBandScale: 1,
  ritualBandVisible: false,
};

function clampNum(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampMobilePx(value: number, maxAbs = 240): number {
  return clampNum(value, -maxAbs, maxAbs);
}

function clampMobileLayoutPct(layout: HeroMediaLayout): HeroMediaLayout {
  return {
    x: clampNum(layout.x, -20, 100),
    y: clampNum(layout.y, -20, 100),
    width: clampNum(layout.width, 40, 110),
    height: clampNum(layout.height, 40, 120),
  };
}

export function clampMobileRitualBandLayout(layout: HeroMediaLayout): HeroMediaLayout {
  return {
    x: clampNum(layout.x, 0, 100),
    y: clampNum(layout.y, -200, 100),
    width: clampNum(layout.width, 60, 160),
    height: clampNum(layout.height, 28, 75),
  };
}

export function resolveHeroMobileLayout(
  overrides?: HeroMobileOverrides | null
): ResolvedHeroMobileLayout {
  const o = overrides ?? {};
  const layout = clampMobileLayoutPct({ ...DEFAULTS.layout, ...o.layout });
  const overlayLayout = clampMobileLayoutPct({
    ...DEFAULTS.overlayLayout,
    ...o.overlayLayout,
  });
  const backgroundLayout = {
    ...DEFAULTS.backgroundLayout,
    ...o.backgroundLayout,
    x: clampNum(
      typeof o.backgroundLayout?.x === "number" ? o.backgroundLayout.x : DEFAULTS.backgroundLayout.x,
      -100,
      100
    ),
    y: clampNum(
      typeof o.backgroundLayout?.y === "number" ? o.backgroundLayout.y : DEFAULTS.backgroundLayout.y,
      -150,
      150
    ),
    width: clampNum(
      typeof o.backgroundLayout?.width === "number"
        ? o.backgroundLayout.width
        : DEFAULTS.backgroundLayout.width,
      20,
      200
    ),
    height: clampNum(
      typeof o.backgroundLayout?.height === "number"
        ? o.backgroundLayout.height
        : DEFAULTS.backgroundLayout.height,
      20,
      200
    ),
  };
  return {
    layout,
    overlayLayout,
    backgroundLayout,
    primaryScale:
      typeof o.primaryScale === "number"
        ? Math.min(3, Math.max(0.1, o.primaryScale))
        : DEFAULTS.primaryScale,
    overlayScale:
      typeof o.overlayScale === "number"
        ? Math.min(3, Math.max(0.1, o.overlayScale))
        : DEFAULTS.overlayScale,
    ritualCarouselPosPct: {
      x:
        typeof o.ritualCarouselPosPct?.x === "number"
          ? o.ritualCarouselPosPct.x
          : DEFAULTS.ritualCarouselPosPct.x,
      y:
        typeof o.ritualCarouselPosPct?.y === "number"
          ? o.ritualCarouselPosPct.y
          : DEFAULTS.ritualCarouselPosPct.y
    },
    eyebrowPos: {
      x: clampMobilePx(typeof o.eyebrowPos?.x === "number" ? o.eyebrowPos.x : DEFAULTS.eyebrowPos.x),
      y: clampMobilePx(typeof o.eyebrowPos?.y === "number" ? o.eyebrowPos.y : DEFAULTS.eyebrowPos.y),
    },
    headlinePos: {
      x: clampMobilePx(typeof o.headlinePos?.x === "number" ? o.headlinePos.x : DEFAULTS.headlinePos.x),
      y: clampMobilePx(typeof o.headlinePos?.y === "number" ? o.headlinePos.y : DEFAULTS.headlinePos.y),
    },
    heroActionsPos: {
      x: clampMobilePx(
        typeof o.heroActionsPos?.x === "number" ? o.heroActionsPos.x : DEFAULTS.heroActionsPos.x
      ),
      y: clampMobilePx(
        typeof o.heroActionsPos?.y === "number" ? o.heroActionsPos.y : DEFAULTS.heroActionsPos.y
      ),
    },
    heroPromoBannerTopCm:
      typeof o.heroPromoBannerTopCm === "number"
        ? Math.min(40, Math.max(0, o.heroPromoBannerTopCm))
        : DEFAULTS.heroPromoBannerTopCm,
    heroPromoBannerPos: {
      x: clampMobilePx(
        typeof o.heroPromoBannerPos?.x === "number"
          ? o.heroPromoBannerPos.x
          : DEFAULTS.heroPromoBannerPos.x
      ),
      y: clampMobilePx(
        typeof o.heroPromoBannerPos?.y === "number"
          ? o.heroPromoBannerPos.y
          : DEFAULTS.heroPromoBannerPos.y
      ),
    },
    heroPromoBannerWidthPct:
      typeof o.heroPromoBannerWidthPct === "number"
        ? Math.min(100, Math.max(40, o.heroPromoBannerWidthPct))
        : DEFAULTS.heroPromoBannerWidthPct,
    headlineSizeRem:
      typeof o.headlineSizeRem === "number"
        ? Math.min(8, Math.max(1, o.headlineSizeRem))
        : DEFAULTS.headlineSizeRem,
    heroCopyWidthVw:
      typeof o.heroCopyWidthVw === "number"
        ? Math.min(92, Math.max(24, o.heroCopyWidthVw))
        : DEFAULTS.heroCopyWidthVw,
    lovedDividerOffsetY: clampNum(
      typeof o.lovedDividerOffsetY === "number" ? o.lovedDividerOffsetY : DEFAULTS.lovedDividerOffsetY,
      -800,
      800
    ),
    lovedFloralOffsetY: clampNum(
      typeof o.lovedFloralOffsetY === "number" ? o.lovedFloralOffsetY : DEFAULTS.lovedFloralOffsetY,
      -240,
      240
    ),
    lovedTintOpacity:
      typeof o.lovedTintOpacity === "number"
        ? Math.min(1, Math.max(0, o.lovedTintOpacity))
        : DEFAULTS.lovedTintOpacity,
    heroCopyOffsetY:
      typeof o.heroCopyOffsetY === "string" && o.heroCopyOffsetY.trim()
        ? o.heroCopyOffsetY.trim()
        : DEFAULTS.heroCopyOffsetY,
    ritualCarouselScale:
      typeof o.ritualCarouselScale === "number"
        ? Math.min(2, Math.max(0.5, o.ritualCarouselScale))
        : DEFAULTS.ritualCarouselScale,
    ritualBandLayout: clampMobileRitualBandLayout({
      ...DEFAULTS.ritualBandLayout,
      ...o.ritualBandLayout,
    }),
    ritualBandScale:
      typeof o.ritualBandScale === "number"
        ? Math.min(2, Math.max(0.5, o.ritualBandScale))
        : DEFAULTS.ritualBandScale,
    ritualBandVisible:
      typeof o.ritualBandVisible === "boolean" ? o.ritualBandVisible : DEFAULTS.ritualBandVisible,
  };
}

export function mergeHeroMobileOverrides(
  base: HeroMobileOverrides | undefined,
  patch: HeroMobileOverrides
): HeroMobileOverrides {
  return {
    ...base,
    ...patch,
    layout: patch.layout ? { ...base?.layout, ...patch.layout } : base?.layout,
    overlayLayout: patch.overlayLayout
      ? { ...base?.overlayLayout, ...patch.overlayLayout }
      : base?.overlayLayout,
    backgroundLayout: patch.backgroundLayout
      ? { ...base?.backgroundLayout, ...patch.backgroundLayout }
      : base?.backgroundLayout,
    ritualCarouselPosPct: patch.ritualCarouselPosPct
      ? { ...base?.ritualCarouselPosPct, ...patch.ritualCarouselPosPct }
      : base?.ritualCarouselPosPct,
    eyebrowPos: patch.eyebrowPos ? { ...base?.eyebrowPos, ...patch.eyebrowPos } : base?.eyebrowPos,
    headlinePos: patch.headlinePos ? { ...base?.headlinePos, ...patch.headlinePos } : base?.headlinePos,
    heroActionsPos: patch.heroActionsPos
      ? { ...base?.heroActionsPos, ...patch.heroActionsPos }
      : base?.heroActionsPos,
    heroPromoBannerPos: patch.heroPromoBannerPos
      ? { ...base?.heroPromoBannerPos, ...patch.heroPromoBannerPos }
      : base?.heroPromoBannerPos,
    ritualBandLayout: patch.ritualBandLayout
      ? { ...base?.ritualBandLayout, ...patch.ritualBandLayout }
      : base?.ritualBandLayout,
  };
}
