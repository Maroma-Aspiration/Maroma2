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

export type HeroMobileOverrides = {
  layout?: HeroMediaLayout;
  overlayLayout?: HeroMediaLayout;
  /** Mobile gradient fill position/size (% of artboard). */
  backgroundLayout?: HeroMediaLayout;
  primaryScale?: number;
  overlayScale?: number;
  ritualCarouselPosPct?: XY;
  eyebrowPos?: XY;
  headlinePos?: XY;
  heroActionsPos?: XY;
  heroPromoBannerTopCm?: number;
  heroPromoBannerPos?: XY;
  heroPromoBannerWidthPct?: number;
  headlineSizeRem?: number;
  heroCopyWidthVw?: number;
  lovedDividerOffsetY?: number;
  lovedFloralOffsetY?: number;
  lovedTintOpacity?: number;
  heroCopyOffsetY?: string;
  ritualCarouselScale?: number;
  /** Mobile carousel band position/size (% of ritual stack). */
  ritualBandLayout?: HeroMediaLayout;
  ritualBandScale?: number;
  /** Mobile carousel band visibility (independent from desktop). */
  ritualBandVisible?: boolean;
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
  /** Vertical offset below hero copy anchor (% + copy offset). */
  heroPromoBannerTopCm: number;
  /** Fine-tune promo strip position (px). */
  heroPromoBannerPos: XY;
  /** Promo strip width as % of artboard. */
  heroPromoBannerWidthPct: number;
  /** Homepage hero marquee start, cm from product right. Persisted with Save All. */
  heroMarqueeStartOffsetCm?: number;
  /** Homepage hero marquee start fine-tune (px). */
  heroMarqueeStartOffsetPx?: number;
  /** Homepage hero marquee rest/end, cm from strip center. */
  heroMarqueeEndOffsetCm?: number;
  /** Homepage hero marquee rest/end fine-tune (px). */
  heroMarqueeEndOffsetPx?: number;
  heroCopyWidthVw: number;
  primarySettings: HeroLayerSettings;
  overlayLayer: HeroOverlayLayer;
  ritualCarouselPos: XY;
  /** Artboard-relative carousel position (% of artboard width/height) — canonical for cross-browser sync. */
  ritualCarouselPosPct: XY;
  bgColors: string[];
  bgAngle: number;
  lovedSectionVisible: boolean;
  lovedFloralsVisible: boolean;
  lovedWashVisible: boolean;
  lovedBandVisible: boolean;
  lovedDividerOffsetY: number;
  /** Auto-measured gap from hero bottom to carousel/band; frozen when loved position is customized. */
  lovedFlowOffsetPx?: number;
  /** When true, loved section vertical position is user-set (do not auto-recalculate flow offset). */
  lovedPositionCustomized?: boolean;
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
  /** Band width (20–100% of section). */
  lovedTint2WidthPct: number;
  /** Band left edge (0–100% of section). */
  lovedTint2LeftPct: number;
  heroLayout: HeroMediaLayout;
  productShowcasePos: XY;
  heroSectionHeight: number;
  /** Extra top offset for the hero copy stack (headline + CTAs), e.g. `7cm` or `48px`. */
  heroCopyOffsetY: string;
  /** Stacking order vs other hero blocks (higher = in front). */
  heroBackgroundStackZ: number;
  heroMediaStackZ: number;
  heroRitualStackZ: number;
  /** Frosted band behind ritual carousel (% of artboard). */
  ritualBandVisible: boolean;
  /** Mobile document-flow carousel band (independent from desktop). */
  ritualBandVisibleMobile: boolean;
  ritualBandLayout: HeroMediaLayout;
  ritualBandScale: number;
  ritualBandOpacity: number;
  /** Carousel band fill color (hex). */
  ritualBandColor: string;
  heroRitualBandStackZ: number;
  ritualCarouselScale: number;
  heroCopyStackZ: number;
  /** Promo strip stacking vs other hero layers (1–10). */
  heroPromoStackZ: number;
  /** Loved section veil/content stacking (1–10; mapped to z-index inside the section). */
  lovedFloralsStackZ: number;
  lovedWashStackZ: number;
  lovedBandStackZ: number;
  lovedContentStackZ: number;
  /** When true, X/Y for that admin layer cannot be changed via drag or sliders. */
  positionLocks: HeroPositionLocks;
  /** Derived mobile layout cache (auto-generated from desktop; not separately edited). */
  mobile?: HeroMobileOverrides;
  /** Milliseconds since epoch — used to merge local vs server state across browsers. */
  updatedAt?: number;
  /** Internal migration rev for carousel stack baseline resets. */
  ritualCarouselStackRev?: number;
};

export type HeroPositionLockKey =
  | "primary"
  | "overlay"
  | "background"
  | "headline"
  | "eyebrow"
  | "actions"
  | "promo-banner"
  | "rituals"
  | "ritual-band"
  | "loved-section"
  | "loved-florals"
  | "loved-wash"
  | "loved-band";

export type HeroPositionLocks = Partial<Record<HeroPositionLockKey, boolean>>;

export const VISUAL_STATE_STORAGE_KEY = "maroma-hero-visual-state";
