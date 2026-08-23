import {
  HERO_ARTBOARD_MAX_WIDTH_PX,
  HERO_ARTBOARD_REF_HEIGHT_PX,
  MOBILE_COMPOSED_ARTBOARD_HEIGHT_PX,
} from "./hero-artboard";
import type { HeroMediaLayout, XY } from "./hero-media-layout-types";
import type { ResolvedHeroMobileLayout } from "./hero-mobile-layout";
import {
  DEFAULT_HERO_MOBILE_BACKGROUND_LAYOUT,
  DEFAULT_HERO_MOBILE_LAYOUT,
  DEFAULT_HERO_MOBILE_OVERLAY_LAYOUT,
  DEFAULT_HERO_MOBILE_RITUAL_BAND_LAYOUT,
} from "./hero-mobile-layout";
import { MOBILE_DESIGN_WIDTH_PX } from "./mobile-design-snapshot";

/** Desktop artboard reference used for admin layout (% and px coords). */
export const DESKTOP_ARTBOARD_WIDTH_PX = HERO_ARTBOARD_MAX_WIDTH_PX;
export const DESKTOP_ARTBOARD_HEIGHT_PX = HERO_ARTBOARD_REF_HEIGHT_PX;

const MOBILE_ARTBOARD_WIDTH_PX = MOBILE_DESIGN_WIDTH_PX;
const MOBILE_ARTBOARD_HEIGHT_PX = MOBILE_COMPOSED_ARTBOARD_HEIGHT_PX;

const X_SCALE = MOBILE_ARTBOARD_WIDTH_PX / DESKTOP_ARTBOARD_WIDTH_PX;
const Y_SCALE = MOBILE_ARTBOARD_HEIGHT_PX / DESKTOP_ARTBOARD_HEIGHT_PX;

export type DesktopLayoutSource = {
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
  heroCopyOffsetY: string;
  lovedDividerOffsetY: number;
  lovedFloralOffsetY: number;
  lovedTintOpacity: number;
  ritualCarouselScale: number;
};

function scalePxToMobile(pos: XY): XY {
  return {
    x: Math.round(pos.x * X_SCALE),
    y: Math.round(pos.y * Y_SCALE),
  };
}

function scaleOffsetY(offset: string): string {
  const trimmed = offset.trim();
  if (!trimmed || trimmed === "0" || trimmed === "0px") {
    return "0px";
  }
  const cmMatch = trimmed.match(/^([\d.]+)cm$/);
  if (cmMatch) {
    const px = parseFloat(cmMatch[1]) * 37.7952755906;
    return `${Math.round(px * Y_SCALE)}px`;
  }
  const pxMatch = trimmed.match(/^([\d.]+)px$/);
  if (pxMatch) {
    return `${Math.round(parseFloat(pxMatch[1]) * Y_SCALE)}px`;
  }
  return "0px";
}

function scalePxOffset(value: number): number {
  return Math.round(value * Y_SCALE);
}

function scaleTopCmToMobile(cm: number): number {
  return Math.round(cm * Y_SCALE * 10) / 10;
}

/** Derive mobile render layout — media layers use mobile defaults; px nudges scale from desktop. */
export function deriveMobileFromDesktop(source: DesktopLayoutSource): ResolvedHeroMobileLayout {
  return {
    layout: { ...DEFAULT_HERO_MOBILE_LAYOUT },
    overlayLayout: { ...DEFAULT_HERO_MOBILE_OVERLAY_LAYOUT },
    backgroundLayout: { ...DEFAULT_HERO_MOBILE_BACKGROUND_LAYOUT },
    primaryScale: source.primaryScale,
    overlayScale: source.overlayScale,
    ritualCarouselPosPct: { ...source.ritualCarouselPosPct },
    eyebrowPos: scalePxToMobile(source.eyebrowPos),
    headlinePos: scalePxToMobile(source.headlinePos),
    heroActionsPos: scalePxToMobile(source.heroActionsPos),
    heroPromoBannerTopCm: scaleTopCmToMobile(source.heroPromoBannerTopCm),
    heroPromoBannerPos: scalePxToMobile(source.heroPromoBannerPos),
    heroPromoBannerWidthPct: source.heroPromoBannerWidthPct,
    headlineSizeRem: deriveMobileHeadlineSizeRem(source.headlineSizeRem),
    heroCopyWidthVw: Math.min(source.heroCopyWidthVw, 92),
    lovedDividerOffsetY: scalePxOffset(source.lovedDividerOffsetY),
    lovedFloralOffsetY: scalePxOffset(source.lovedFloralOffsetY),
    lovedTintOpacity: source.lovedTintOpacity,
    heroCopyOffsetY: scaleOffsetY(source.heroCopyOffsetY),
    ritualCarouselScale: source.ritualCarouselScale,
    ritualBandLayout: { ...DEFAULT_HERO_MOBILE_RITUAL_BAND_LAYOUT },
    ritualBandScale: 1,
    ritualBandVisible: false,
  };
}

/** Headline size clamped for narrow mobile artboard. */
export function deriveMobileHeadlineSizeRem(desktopRem: number): number {
  const scaled = desktopRem * Math.sqrt(X_SCALE);
  return Math.min(7, Math.max(1.55, Math.round(scaled * 100) / 100));
}
