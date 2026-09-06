import {
  clampHeroLayerDepth,
  HERO_LAYER_DEPTH_MAX,
  HERO_LAYER_DEPTH_MIN,
  migrateLegacyStackZ,
  normalizeRitualStackZ,
  RITUAL_CAROUSEL_STACK_REV,
} from "./hero-layer-depth";
import {
  HERO_PRIMARY_MEDIA_LAYOUT,
  HERO_RITUAL_BAND_DEFAULT_LAYOUT,
  HERO_RITUAL_DEFAULT_POS_PCT,
  LOVED_HANDOFF_OFFSET_Y_PX,
  ritualCarouselPxToPct,
  sanitizeArtboardPrimaryLayout,
  isLegacyHeroLayout,
} from "./hero-artboard";
import { clampMobileRitualBandLayout, DEFAULT_HERO_MOBILE_RITUAL_BAND_LAYOUT } from "./hero-mobile-layout";
import type {
  HeroMediaLayout,
  XY,
  HeroLayerSettings,
  HeroOverlayLayer,
  HeroVisualState,
  HeroPositionLockKey,
  HeroPositionLocks,
  HeroMobileOverrides,
} from "./hero-media-layout-types";

const defaultLayout: HeroMediaLayout = { ...HERO_PRIMARY_MEDIA_LAYOUT };

const defaultBgColors = ["#dbe3d0", "#cbd5c0", "#d6deca"];

export const defaultHeroVisualState: HeroVisualState = {
  layout: defaultLayout,
  backgroundVisible: true,
  headlineVisible: true,
  eyebrowVisible: false,
  actionsVisible: true,
  ritualsVisible: false,
  heroPos: { x: 0, y: 0 },
  headlinePos: { x: 0, y: 0 },
  headlineSizeRem: 5.28,
  eyebrowPos: { x: 0, y: 0 },
  eyebrowPosRatio: { x: 0, y: 0 },
  heroActionsPos: { x: 0, y: 0 },
  heroPromoBannerTopCm: 15,
  heroPromoBannerPos: { x: 0, y: 0 },
  heroPromoBannerWidthPct: 100,
  heroCopyWidthVw: 46,
  primarySettings: {
    visible: true,
    opacity: 1,
    zIndex: 1,
    rotateDeg: 0,
    scale: 0.68,
    fit: "contain",
  },
  overlayLayer: {
    src: "/staging-media/admin-hero/overlay-gemini.png",
    layout: defaultLayout,
    visible: true,
    opacity: 0.7,
    zIndex: 3,
    rotateDeg: 0,
    scale: 1,
    fit: "cover",
  },
  ritualCarouselPos: { x: 0, y: 0 },
  ritualCarouselPosPct: { ...HERO_RITUAL_DEFAULT_POS_PCT },
  bgColors: defaultBgColors,
  bgAngle: 135,
  lovedSectionVisible: true,
  lovedFloralsVisible: true,
  lovedWashVisible: true,
  lovedBandVisible: true,
  lovedDividerOffsetY: LOVED_HANDOFF_OFFSET_Y_PX,
  lovedFloralOffsetY: 0,
  lovedFloralOpacity: 1,
  lovedTintOffsetX: 0,
  lovedTintOffsetY: 0,
  lovedTintOpacity: 0.38,
  lovedTint2OffsetX: 0,
  lovedTint2OffsetY: 0,
  lovedTint2Opacity: 0,
  lovedTint2TopPct: 12,
  lovedTint2HeightPct: 28,
  lovedTint2WidthPct: 100,
  lovedTint2LeftPct: 0,
  heroLayout: { x: 0, y: 0, width: 100, height: 100 },
  productShowcasePos: { x: 0, y: 0 },
  heroSectionHeight: 100,
  heroCopyOffsetY: "7cm",
  heroBackgroundStackZ: 1,
  heroMediaStackZ: 8,
  heroRitualStackZ: 4,
  heroRitualBandStackZ: 2,
  ritualCarouselScale: 1,
  ritualBandVisible: true,
  ritualBandVisibleMobile: false,
  ritualBandLayout: { ...HERO_RITUAL_BAND_DEFAULT_LAYOUT },
  ritualBandScale: 1,
  ritualBandOpacity: 0.94,
  ritualBandColor: "#ffffff",
  heroCopyStackZ: 9,
  heroPromoStackZ: 7,
  lovedFloralsStackZ: 1,
  lovedWashStackZ: 2,
  lovedBandStackZ: 3,
  lovedContentStackZ: 5,
  positionLocks: {},
  ritualCarouselStackRev: RITUAL_CAROUSEL_STACK_REV,
};

const clampLayout = (layout: HeroMediaLayout): HeroMediaLayout => {
  const width = Math.min(200, Math.max(30, layout.width));
  const height = Math.min(500, Math.max(30, layout.height));
  const x = Math.max(-100, Math.min(100, layout.x));
  const y = Math.max(-100, Math.min(100, layout.y));
  return { x, y, width, height };
};

const clampXY = (value: XY): XY => ({
  x: Math.max(-2000, Math.min(2000, Number(value.x) || 0)),
  y: Math.max(-2000, Math.min(2000, Number(value.y) || 0)),
});

const clampOpacity = (value: number): number => Math.max(0, Math.min(1, Number(value) || 0));
const clampCopyWidth = (value: number): number => Math.max(24, Math.min(92, Number(value) || 46));
const clampPromoTopCm = (value: number): number => Math.max(0, Math.min(40, Number(value) || 15));
const clampPromoWidthPct = (value: number): number => Math.max(40, Math.min(100, Number(value) || 100));
const clampHeadlineSize = (value: number): number => Math.max(2.2, Math.min(7, Number(value) || 5.28));
const clampDividerOffset = (value: number): number => Math.max(-500, Math.min(500, Number(value) || 0));
const clampFlowOffset = (value: number): number => Math.max(-800, Math.min(800, Number(value) || 0));
const clampFloralOffset = (value: number): number => Math.max(-500, Math.min(500, Number(value) || 0));
const clampFloralOpacity = (value: number): number => Math.max(0, Math.min(1, Number(value) || 0));
const clampTintOffset = (value: number): number => Math.max(-500, Math.min(500, Number(value) || 0));
const clampTint2TopPct = (value: number): number => Math.max(0, Math.min(100, Number(value) || 0));
const clampTint2HeightPct = (value: number): number => Math.max(5, Math.min(100, Number(value) || 22));
const clampTint2WidthPct = (value: number): number => Math.max(20, Math.min(100, Number(value) || 100));
const clampTint2LeftPct = (value: number): number => Math.max(0, Math.min(80, Number(value) || 0));
const clampHexColor = (value: unknown, fallback: string): string => {
  const raw = String(value ?? fallback).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
    return raw.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const [, r, g, b] = raw;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
};
const clampRotateDeg = (value: number): number => Math.max(-180, Math.min(180, Number(value) || 0));
const clampScale = (value: number): number => Math.max(0.1, Math.min(3, Number(value) || 1));
const clampBandLayout = (layout: HeroMediaLayout): HeroMediaLayout => ({
  x: Math.min(100, Math.max(0, layout.x)),
  y: Math.min(100, Math.max(0, layout.y)),
  width: Math.min(160, Math.max(20, layout.width)),
  height: Math.min(50, Math.max(6, layout.height)),
});

/** Band layout uses % ranges 6–50 tall / 20–160 wide — not clampLayout (min 30). */
const parseBandLayout = (value: unknown, base?: HeroMediaLayout): HeroMediaLayout => {
  const fallback = base ?? HERO_RITUAL_BAND_DEFAULT_LAYOUT;
  if (!value || typeof value !== "object") {
    return clampBandLayout({ ...fallback });
  }
  const raw = value as Record<string, unknown>;
  return clampBandLayout({
    x: typeof raw.x === "number" ? raw.x : fallback.x,
    y: typeof raw.y === "number" ? raw.y : fallback.y,
    width: typeof raw.width === "number" ? raw.width : fallback.width,
    height: typeof raw.height === "number" ? raw.height : fallback.height,
  });
};
const clampStackZ = (value: number, fallback: number): number =>
  migrateLegacyStackZ(Number(value) || fallback, fallback);
const clampBool = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const clampLayerSettings = (settings: HeroLayerSettings): HeroLayerSettings => ({
  visible: Boolean(settings.visible),
  opacity: clampOpacity(settings.opacity),
  zIndex: Math.max(1, Math.min(10, Math.round(Number(settings.zIndex) || 1))),
  rotateDeg: clampRotateDeg(settings.rotateDeg),
  scale: clampScale(settings.scale),
  fit: settings.fit === "contain" ? "contain" : "cover",
});

const parseLayout = (value: unknown, base?: HeroMediaLayout): HeroMediaLayout => {
  if (!value || typeof value !== "object") {
    return base ?? defaultLayout;
  }
  const raw = value as Record<string, unknown>;
  const x = typeof raw.x === "number" ? raw.x : (base?.x ?? defaultLayout.x);
  const y = typeof raw.y === "number" ? raw.y : (base?.y ?? defaultLayout.y);
  const width = typeof raw.width === "number" ? raw.width : (base?.width ?? defaultLayout.width);
  const height = typeof raw.height === "number" ? raw.height : (base?.height ?? defaultLayout.height);

  return clampLayout({ x, y, width, height });
};

const POSITION_LOCK_KEYS: HeroPositionLockKey[] = [
  "primary",
  "overlay",
  "background",
  "headline",
  "eyebrow",
  "actions",
  "promo-banner",
  "rituals",
  "ritual-band",
  "loved-section",
  "loved-florals",
  "loved-wash",
  "loved-band",
];

const parsePositionLocks = (value: unknown, base: HeroPositionLocks): HeroPositionLocks => {
  if (!value || typeof value !== "object") {
    return base;
  }
  const raw = value as Record<string, unknown>;
  const next: HeroPositionLocks = { ...base };
  for (const key of POSITION_LOCK_KEYS) {
    if (typeof raw[key] === "boolean") {
      next[key] = raw[key] as boolean;
    }
  }
  return next;
};

const parseMobileOverrides = (value: unknown, base?: HeroMobileOverrides): HeroMobileOverrides | undefined => {
  if (!value || typeof value !== "object") {
    return base;
  }
  const raw = value as Record<string, unknown>;
  const next: HeroMobileOverrides = { ...base };
  if (raw.layout) {
    next.layout = parseLayout(raw.layout, base?.layout);
  }
  if (raw.overlayLayout) {
    next.overlayLayout = parseLayout(raw.overlayLayout, base?.overlayLayout);
  }
  if (typeof raw.primaryScale === "number") {
    next.primaryScale = clampScale(raw.primaryScale);
  }
  if (typeof raw.overlayScale === "number") {
    next.overlayScale = clampScale(raw.overlayScale);
  }
  if (raw.ritualCarouselPosPct && typeof raw.ritualCarouselPosPct === "object") {
    const pct = raw.ritualCarouselPosPct as XY;
    next.ritualCarouselPosPct = {
      x: Math.min(100, Math.max(0, Number(pct.x) || 0)),
      y: Math.min(100, Math.max(0, Number(pct.y) || 0)),
    };
  }
  if (raw.eyebrowPos && typeof raw.eyebrowPos === "object") {
    next.eyebrowPos = clampXY(raw.eyebrowPos as XY);
  }
  if (raw.headlinePos && typeof raw.headlinePos === "object") {
    next.headlinePos = clampXY(raw.headlinePos as XY);
  }
  if (raw.heroActionsPos && typeof raw.heroActionsPos === "object") {
    next.heroActionsPos = clampXY(raw.heroActionsPos as XY);
  }
  if (typeof raw.heroPromoBannerTopCm === "number") {
    next.heroPromoBannerTopCm = clampPromoTopCm(raw.heroPromoBannerTopCm);
  }
  if (raw.heroPromoBannerPos && typeof raw.heroPromoBannerPos === "object") {
    next.heroPromoBannerPos = clampXY(raw.heroPromoBannerPos as XY);
  }
  if (typeof raw.heroPromoBannerWidthPct === "number") {
    next.heroPromoBannerWidthPct = clampPromoWidthPct(raw.heroPromoBannerWidthPct);
  }
  if (typeof raw.headlineSizeRem === "number") {
    next.headlineSizeRem = clampHeadlineSize(raw.headlineSizeRem);
  }
  if (typeof raw.heroCopyWidthVw === "number") {
    next.heroCopyWidthVw = clampCopyWidth(raw.heroCopyWidthVw);
  }
  if (raw.backgroundLayout) {
    next.backgroundLayout = parseLayout(raw.backgroundLayout, base?.backgroundLayout);
  }
  if (typeof raw.lovedDividerOffsetY === "number") {
    next.lovedDividerOffsetY = clampDividerOffset(raw.lovedDividerOffsetY);
  }
  if (typeof raw.lovedFloralOffsetY === "number") {
    next.lovedFloralOffsetY = clampFloralOffset(raw.lovedFloralOffsetY);
  }
  if (typeof raw.lovedTintOpacity === "number") {
    next.lovedTintOpacity = clampOpacity(raw.lovedTintOpacity);
  }
  if (typeof raw.heroCopyOffsetY === "string" && raw.heroCopyOffsetY.trim()) {
    next.heroCopyOffsetY = raw.heroCopyOffsetY.trim();
  }
  if (typeof raw.ritualCarouselScale === "number") {
    next.ritualCarouselScale = clampScale(raw.ritualCarouselScale);
  }
  if (typeof raw.ritualBandVisible === "boolean") {
    next.ritualBandVisible = raw.ritualBandVisible;
  }
  if (raw.ritualBandLayout && typeof raw.ritualBandLayout === "object") {
    const band = raw.ritualBandLayout as Record<string, unknown>;
    const fallback = base?.ritualBandLayout ?? DEFAULT_HERO_MOBILE_RITUAL_BAND_LAYOUT;
    next.ritualBandLayout = clampMobileRitualBandLayout({
      x: typeof band.x === "number" ? band.x : fallback.x,
      y: typeof band.y === "number" ? band.y : fallback.y,
      width: typeof band.width === "number" ? band.width : fallback.width,
      height: typeof band.height === "number" ? band.height : fallback.height,
    });
  }
  if (typeof raw.ritualBandScale === "number") {
    next.ritualBandScale = clampScale(raw.ritualBandScale);
  }
  return Object.keys(next).length > 0 ? next : undefined;
};

export const parseHeroVisualState = (value: unknown, base?: HeroVisualState): HeroVisualState => {
  const b = base ?? defaultHeroVisualState;
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const hasFlatLayout = typeof raw.x === "number" || typeof raw.y === "number";
  const layout = parseLayout(raw.layout ?? (hasFlatLayout ? raw : undefined), b.layout);
  const heroPos = clampXY((raw.heroPos as XY) ?? b.heroPos);

  const headlinePos = clampXY((raw.headlinePos as XY) ?? b.headlinePos);
  const headlineSizeRem = clampHeadlineSize(
    (raw.headlineSizeRem as number) ?? b.headlineSizeRem
  );
  const eyebrowPos = clampXY((raw.eyebrowPos as XY) ?? b.eyebrowPos);
  const eyebrowPosRatio = clampXY((raw.eyebrowPosRatio as XY) ?? b.eyebrowPosRatio);
  const heroActionsPos = clampXY((raw.heroActionsPos as XY) ?? b.heroActionsPos);
  const heroPromoBannerTopCm = clampPromoTopCm(
    (raw.heroPromoBannerTopCm as number) ?? b.heroPromoBannerTopCm
  );
  const heroPromoBannerPos = clampXY((raw.heroPromoBannerPos as XY) ?? b.heroPromoBannerPos);
  const heroPromoBannerWidthPct = clampPromoWidthPct(
    (raw.heroPromoBannerWidthPct as number) ?? b.heroPromoBannerWidthPct
  );
  const heroCopyWidthVw = clampCopyWidth((raw.heroCopyWidthVw as number) ?? b.heroCopyWidthVw);

  const primarySettings = clampLayerSettings({
    ...b.primarySettings,
    ...((raw.primarySettings as HeroLayerSettings) ?? {}),
  });

  const overlayRaw = (raw.overlayLayer as Record<string, unknown>) ?? {};
  const overlayLayer: HeroOverlayLayer = {
    ...clampLayerSettings({
      ...b.overlayLayer,
      ...(overlayRaw as HeroLayerSettings),
    }),
    src:
      typeof overlayRaw.src === "string" && overlayRaw.src.trim()
        ? overlayRaw.src
        : b.overlayLayer.src,
    layout: parseLayout(overlayRaw.layout ?? b.overlayLayer.layout),
  };

  const ritualCarouselPos = clampXY(
    (raw.ritualCarouselPos as XY) ?? b.ritualCarouselPos
  );
  const ritualCarouselPosPct = clampXY(
    (raw.ritualCarouselPosPct as XY) ??
      (ritualCarouselPos.x !== 0 || ritualCarouselPos.y !== 0
        ? ritualCarouselPxToPct(ritualCarouselPos)
        : b.ritualCarouselPosPct ?? defaultHeroVisualState.ritualCarouselPosPct)
  );

  const bgColors = Array.isArray(raw.bgColors)
    ? raw.bgColors.map((c) => (typeof c === "string" ? c : "#ffffff"))
    : b.bgColors;
  const bgAngle = typeof raw.bgAngle === "number" ? raw.bgAngle : b.bgAngle;
  const backgroundVisible = clampBool(raw.backgroundVisible, b.backgroundVisible);
  const headlineVisible = clampBool(raw.headlineVisible, b.headlineVisible);
  const eyebrowVisible = clampBool(raw.eyebrowVisible, b.eyebrowVisible);
  const actionsVisible = clampBool(raw.actionsVisible, b.actionsVisible);
  const ritualsVisible = clampBool(raw.ritualsVisible, b.ritualsVisible);
  const lovedSectionVisible = clampBool(raw.lovedSectionVisible, b.lovedSectionVisible);
  const lovedFloralsVisible = clampBool(raw.lovedFloralsVisible, b.lovedFloralsVisible);
  const lovedWashVisible = clampBool(raw.lovedWashVisible, b.lovedWashVisible);
  const lovedBandVisible = clampBool(raw.lovedBandVisible, b.lovedBandVisible);
  const lovedDividerOffsetY = clampDividerOffset(
    (raw.lovedDividerOffsetY as number) ?? b.lovedDividerOffsetY
  );
  const lovedFlowOffsetPx =
    typeof raw.lovedFlowOffsetPx === "number"
      ? clampFlowOffset(raw.lovedFlowOffsetPx as number)
      : b.lovedFlowOffsetPx;
  const lovedPositionCustomized =
    typeof raw.lovedPositionCustomized === "boolean"
      ? raw.lovedPositionCustomized
      : b.lovedPositionCustomized;
  const lovedFloralOffsetY = clampFloralOffset(
    (raw.lovedFloralOffsetY as number) ?? b.lovedFloralOffsetY
  );
  const lovedFloralOpacity = clampFloralOpacity(
    (raw.lovedFloralOpacity as number) ?? b.lovedFloralOpacity ?? defaultHeroVisualState.lovedFloralOpacity
  );
  const lovedTintOffsetX = clampTintOffset(
    (raw.lovedTintOffsetX as number) ?? b.lovedTintOffsetX
  );
  const lovedTintOffsetY = clampTintOffset(
    (raw.lovedTintOffsetY as number) ?? b.lovedTintOffsetY
  );
  const lovedTintOpacity = clampOpacity(
    (raw.lovedTintOpacity as number) ?? b.lovedTintOpacity
  );
  const d = defaultHeroVisualState;
  const lovedTint2OffsetX = clampTintOffset(
    (raw.lovedTint2OffsetX as number) ?? b.lovedTint2OffsetX ?? d.lovedTint2OffsetX
  );
  const lovedTint2OffsetY = clampTintOffset(
    (raw.lovedTint2OffsetY as number) ?? b.lovedTint2OffsetY ?? d.lovedTint2OffsetY
  );
  const lovedTint2Opacity = clampOpacity(
    (raw.lovedTint2Opacity as number) ?? b.lovedTint2Opacity ?? d.lovedTint2Opacity
  );
  const lovedTint2TopPct = clampTint2TopPct(
    (raw.lovedTint2TopPct as number) ?? b.lovedTint2TopPct ?? d.lovedTint2TopPct
  );
  const lovedTint2HeightPct = clampTint2HeightPct(
    (raw.lovedTint2HeightPct as number) ?? b.lovedTint2HeightPct ?? d.lovedTint2HeightPct
  );
  const lovedTint2WidthPct = clampTint2WidthPct(
    (raw.lovedTint2WidthPct as number) ?? b.lovedTint2WidthPct ?? d.lovedTint2WidthPct
  );
  const lovedTint2LeftPct = clampTint2LeftPct(
    (raw.lovedTint2LeftPct as number) ?? b.lovedTint2LeftPct ?? d.lovedTint2LeftPct
  );

  const heroSectionHeight = typeof raw.heroSectionHeight === "number" ? raw.heroSectionHeight : b.heroSectionHeight;
  const heroCopyOffsetY =
    typeof raw.heroCopyOffsetY === "string" && raw.heroCopyOffsetY.trim()
      ? raw.heroCopyOffsetY.trim()
      : b.heroCopyOffsetY ?? "7cm";
  const positionLocks = parsePositionLocks(raw.positionLocks, b.positionLocks ?? {});
  const heroBackgroundStackZ = clampStackZ(
    (raw.heroBackgroundStackZ as number) ?? b.heroBackgroundStackZ ?? d.heroBackgroundStackZ,
    d.heroBackgroundStackZ
  );
  const heroMediaStackZ = clampStackZ(
    (raw.heroMediaStackZ as number) ?? b.heroMediaStackZ ?? d.heroMediaStackZ,
    d.heroMediaStackZ
  );
  const stackRev =
    typeof raw.ritualCarouselStackRev === "number" && Number.isFinite(raw.ritualCarouselStackRev)
      ? Math.round(raw.ritualCarouselStackRev)
      : 0;
  const heroRitualStackZ =
    stackRev >= RITUAL_CAROUSEL_STACK_REV
      ? normalizeRitualStackZ(
          (raw.heroRitualStackZ as number | undefined) ?? b.heroRitualStackZ ?? d.heroRitualStackZ,
          d.heroRitualStackZ
        )
      : 4;
  const ritualCarouselStackRev = Math.max(stackRev, RITUAL_CAROUSEL_STACK_REV);
  const heroCopyStackZ = clampStackZ(
    (raw.heroCopyStackZ as number) ?? b.heroCopyStackZ ?? d.heroCopyStackZ,
    d.heroCopyStackZ
  );
  const heroCopyAboveMediaStackZ =
    heroCopyStackZ <= heroMediaStackZ
      ? Math.min(HERO_LAYER_DEPTH_MAX, heroMediaStackZ + 1)
      : heroCopyStackZ;
  const heroPromoStackZDefault = Math.max(
    heroBackgroundStackZ,
    Math.max(HERO_LAYER_DEPTH_MIN, heroMediaStackZ - 1)
  );
  const heroPromoStackZ = clampStackZ(
    (raw.heroPromoStackZ as number) ?? b.heroPromoStackZ ?? heroPromoStackZDefault,
    heroPromoStackZDefault
  );
  const heroRitualBandStackZ = clampStackZ(
    (raw.heroRitualBandStackZ as number) ?? b.heroRitualBandStackZ ?? d.heroRitualBandStackZ,
    d.heroRitualBandStackZ
  );
  const ritualBandVisible = clampBool(
    raw.ritualBandVisible ?? b.ritualBandVisible,
    d.ritualBandVisible
  );
  const ritualBandVisibleMobile = clampBool(
    raw.ritualBandVisibleMobile ?? b.ritualBandVisibleMobile,
    d.ritualBandVisibleMobile
  );
  const ritualBandLayout = parseBandLayout(
    raw.ritualBandLayout,
    b.ritualBandLayout ?? d.ritualBandLayout
  );
  const ritualBandScale = clampScale(
    (raw.ritualBandScale as number) ?? b.ritualBandScale ?? d.ritualBandScale
  );
  const ritualBandOpacity = clampOpacity(
    (raw.ritualBandOpacity as number) ?? b.ritualBandOpacity ?? d.ritualBandOpacity
  );
  const ritualBandColor = clampHexColor(
    raw.ritualBandColor ?? b.ritualBandColor ?? d.ritualBandColor,
    d.ritualBandColor
  );
  const ritualCarouselScale = clampScale(
    (raw.ritualCarouselScale as number) ?? b.ritualCarouselScale ?? d.ritualCarouselScale
  );
  const lovedFloralsStackZ = clampStackZ(
    (raw.lovedFloralsStackZ as number) ?? b.lovedFloralsStackZ ?? d.lovedFloralsStackZ,
    d.lovedFloralsStackZ
  );
  const lovedWashStackZ = clampStackZ(
    (raw.lovedWashStackZ as number) ?? b.lovedWashStackZ ?? d.lovedWashStackZ,
    d.lovedWashStackZ
  );
  const lovedBandStackZ = clampStackZ(
    (raw.lovedBandStackZ as number) ?? b.lovedBandStackZ ?? d.lovedBandStackZ,
    d.lovedBandStackZ
  );
  const lovedContentStackZ = clampStackZ(
    (raw.lovedContentStackZ as number) ?? b.lovedContentStackZ ?? d.lovedContentStackZ,
    d.lovedContentStackZ
  );
  const updatedAt =
    typeof raw.updatedAt === "number" && Number.isFinite(raw.updatedAt)
      ? Math.round(raw.updatedAt)
      : b.updatedAt;

  let mobile = parseMobileOverrides(raw.mobile, b.mobile);
  if (typeof ritualBandVisibleMobile === "boolean") {
    if (mobile) {
      if (typeof mobile.ritualBandVisible !== "boolean") {
        mobile = { ...mobile, ritualBandVisible: ritualBandVisibleMobile };
      }
    } else if (ritualBandVisibleMobile) {
      mobile = { ritualBandVisible: ritualBandVisibleMobile };
    }
  }

  const heroLayoutRaw = parseLayout(raw.heroLayout, b.heroLayout);
  const heroLayout = isLegacyHeroLayout(heroLayoutRaw)
    ? { x: 0, y: 0, width: 100, height: 100 }
    : heroLayoutRaw;

  return {
    layout: sanitizeArtboardPrimaryLayout(layout),
    backgroundVisible,
    headlineVisible,
    eyebrowVisible,
    actionsVisible,
    ritualsVisible,
    heroPos,
    headlinePos,
    headlineSizeRem,
    eyebrowPos,
    eyebrowPosRatio,
    heroActionsPos,
    heroPromoBannerTopCm,
    heroPromoBannerPos,
    heroPromoBannerWidthPct,
    heroMarqueeStartOffsetCm:
      typeof raw.heroMarqueeStartOffsetCm === "number" && Number.isFinite(raw.heroMarqueeStartOffsetCm)
        ? Math.min(25, Math.max(-5, raw.heroMarqueeStartOffsetCm))
        : b.heroMarqueeStartOffsetCm,
    heroMarqueeStartOffsetPx:
      typeof raw.heroMarqueeStartOffsetPx === "number" && Number.isFinite(raw.heroMarqueeStartOffsetPx)
        ? Math.min(600, Math.max(-600, Math.round(raw.heroMarqueeStartOffsetPx)))
        : b.heroMarqueeStartOffsetPx,
    heroMarqueeEndOffsetCm:
      typeof raw.heroMarqueeEndOffsetCm === "number" && Number.isFinite(raw.heroMarqueeEndOffsetCm)
        ? Math.min(15, Math.max(-15, raw.heroMarqueeEndOffsetCm))
        : b.heroMarqueeEndOffsetCm,
    heroMarqueeEndOffsetPx:
      typeof raw.heroMarqueeEndOffsetPx === "number" && Number.isFinite(raw.heroMarqueeEndOffsetPx)
        ? Math.min(600, Math.max(-600, Math.round(raw.heroMarqueeEndOffsetPx)))
        : b.heroMarqueeEndOffsetPx,
    heroCopyWidthVw,
    primarySettings,
    overlayLayer,
    ritualCarouselPos,
    ritualCarouselPosPct,
    bgColors,
    bgAngle,
    lovedSectionVisible,
    lovedFloralsVisible,
    lovedWashVisible,
    lovedBandVisible,
    lovedDividerOffsetY,
    lovedFlowOffsetPx,
    lovedPositionCustomized,
    lovedFloralOffsetY,
    lovedFloralOpacity,
    lovedTintOffsetX,
    lovedTintOffsetY,
    lovedTintOpacity,
    lovedTint2OffsetX,
    lovedTint2OffsetY,
    lovedTint2Opacity,
    lovedTint2TopPct,
    lovedTint2HeightPct,
    lovedTint2WidthPct,
    lovedTint2LeftPct,
    heroLayout,
    productShowcasePos: clampXY((raw.productShowcasePos as XY) ?? b.productShowcasePos),
    heroSectionHeight,
    heroCopyOffsetY,
    heroBackgroundStackZ,
    heroMediaStackZ,
    heroRitualStackZ,
    heroRitualBandStackZ,
    ritualBandVisible,
    ritualBandVisibleMobile,
    ritualBandLayout,
    ritualBandScale,
    ritualBandOpacity,
    ritualBandColor,
    ritualCarouselScale,
    heroCopyStackZ: heroCopyAboveMediaStackZ,
    heroPromoStackZ,
    lovedFloralsStackZ,
    lovedWashStackZ,
    lovedBandStackZ,
    lovedContentStackZ,
    positionLocks,
    ritualCarouselStackRev,
    ...(mobile ? { mobile } : {}),
    ...(updatedAt !== undefined ? { updatedAt } : {}),
  };
};
