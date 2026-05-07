export type HeroMediaLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type XY = { x: number; y: number };

export type HeroLayerSettings = {
  visible: boolean;
  opacity: number;
  zIndex: number;
  rotateDeg: number;
  scale: number;
  fit: "cover" | "contain";
};

export type HeroOverlayLayer = HeroLayerSettings & {
  src: string;
  layout: HeroMediaLayout;
};

export type HeroVisualState = {
  layout: HeroMediaLayout;
  backgroundVisible: boolean;
  headlineVisible: boolean;
  eyebrowVisible: boolean;
  actionsVisible: boolean;
  ritualsVisible: boolean;
  heroPos: XY;
  headlinePos: XY;
  headlineSizeRem: number;
  eyebrowPos: XY;
  eyebrowPosRatio: XY;
  heroActionsPos: XY;
  heroCopyWidthVw: number;
  primarySettings: HeroLayerSettings;
  overlayLayer: HeroOverlayLayer;
  ritualCarouselPos: XY;
  bgColors: string[];
  bgAngle: number;
  lovedSectionVisible: boolean;
  lovedFloralsVisible: boolean;
  lovedWashVisible: boolean;
  lovedBandVisible: boolean;
  lovedDividerOffsetY: number;
  lovedFloralOffsetY: number;
  lovedFloralOpacity: number;
  /** Full-section wash layer horizontal nudge. */
  lovedTintOffsetX: number;
  lovedTintOffsetY: number;
  /** Full-section wash opacity (0–1). */
  lovedTintOpacity: number;
  /** Second veil: horizontal band stacked above the wash. */
  lovedTint2OffsetX: number;
  lovedTint2OffsetY: number;
  lovedTint2Opacity: number;
  /** Band vertical placement within the loved section (0–100%). */
  lovedTint2TopPct: number;
  /** Band height (5–100% of section). */
  lovedTint2HeightPct: number;
  heroLayout: HeroMediaLayout;
  productShowcasePos: XY;
  heroSectionHeight: number;
};

export const VISUAL_STATE_STORAGE_KEY = "maroma-hero-visual-state";
