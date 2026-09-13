export type PromoAnimation = "marquee" | "fade" | "slide" | "pulse";
export type PromoMediaKind = "none" | "image" | "title-media" | "video";
export type PromoPresentation = "static" | "sequence";
export type PromoFrameKind = "empty" | "title-media" | "text" | "image" | "marquee" | "cta";
export type PromoSequenceTransition = "fade" | "slide-up" | "slide-down" | "crossfade";
export type PromoCtaStyle = "magical" | "promo" | "outline";
export type PromoTextBannerStyle = "glass" | "ivory" | "teal";
export type PromoOverlayAnimation = "none" | "fade" | "slide" | "pulse" | "zoom";
export type PromoOverlayCrop = "none" | "square" | "portrait" | "landscape";

export type PromoOverlayImage = {
  id: string;
  /** Admin label in the editor. Not shown on the live promo. */
  name?: string;
  imageUrl: string;
  x: number;
  y: number;
  scale: number;
  radius: number;
  shadow: boolean;
  animation: PromoOverlayAnimation;
  animationDurationMs: number;
  crop: PromoOverlayCrop;
  cropX: number;
  cropY: number;
  /** Stacking depth: negative sits behind the banner copy, positive in front of it. */
  depth?: number;
  /** Editor only: bumping this remounts the layer so its animation replays. Never stored. */
  replayToken?: number;
};

export type PromoCtaBuyLink = {
  id: string;
  side: "left" | "right";
  /** Admin-controlled visibility without deleting the configured product. */
  visible?: boolean;
  /** First line: scent or product name (e.g. "Aloe Vera Hibiscus"). */
  label?: string;
  /** Second line: product type (e.g. "Conditioner"). */
  subtitleLabel?: string;
  /** Third line: compact price (e.g. "Rs755"). */
  priceLabel?: string;
  href: string;
  imageUrl: string;
};

export type PromoFrame = {
  id: string;
  kind: PromoFrameKind;
  durationMs: number;
  /** Time to fade this frame in from 0 opacity (ms). */
  fadeInMs?: number;
  /** Time to fade this frame out to 0 opacity (ms). */
  fadeOutMs?: number;
  title?: string;
  body?: string;
  mediaUrl?: string;
  mediaKind?: PromoMediaKind;
  ctaLabel?: string;
  ctaHref?: string;
  titleSizeRem?: number;
  bodySizeRem?: number;
  mediaScale?: number;
  ctaScale?: number;
};

/** Per-layer mobile placement, matched to an overlay image by id. */
export type PromoMobileOverlayLayout = {
  id: string;
  x: number;
  y: number;
  scale: number;
};

/**
 * Optional mobile-only layout. While enabled, the phone view uses these numbers verbatim
 * instead of rescaling the desktop offsets, so the two views are edited independently.
 */
export type PromoMobileLayout = {
  enabled: boolean;
  stripHeightPx: number;
  textBannerOffsetX: number;
  textBannerOffsetY: number;
  textBannerScale: number;
  textBannerWidthPct: number;
  textBannerHeightPct: number;
  headlineOffsetX: number;
  headlineOffsetY: number;
  headlineScale: number;
  taglineOffsetX: number;
  taglineOffsetY: number;
  taglineScale: number;
  ctaOffsetX: number;
  ctaOffsetY: number;
  thumbnailOffsetX: number;
  thumbnailOffsetY: number;
  overlay: PromoMobileOverlayLayout[];
};

export type PromoBanner = {
  id: string;
  /** Admin-only label for saved banners (shown in Site admin lists). */
  adminName?: string;
  /** Strip headline copy (Text only / Title + image frames). */
  title: string;
  body: string;
  mediaUrl: string;
  mediaKind: PromoMediaKind;
  animation: PromoAnimation;
  ctaLabel: string;
  ctaHref: string;
  ctaStyle?: PromoCtaStyle;
  animateEnabled?: boolean;
  /** Optional translucent strip behind the promo headline and tagline. */
  textBannerEnabled?: boolean;
  textBannerOffsetX?: number;
  textBannerOffsetY?: number;
  textBannerScale?: number;
  /** Strip width as a percentage of its natural width. */
  textBannerWidthPct?: number;
  /** Strip height as a percentage of its natural height. */
  textBannerHeightPct?: number;
  /** Custom strip fill (hex). Empty falls back to the chosen appearance preset. */
  textBannerColor?: string;
  /** Strip fill opacity, 0 to 100. Only used with a custom colour. */
  textBannerOpacity?: number;

  textBannerStyle?: PromoTextBannerStyle;
  /** Independent headline and tagline layout controls. */
  headlineOffsetX?: number;
  headlineOffsetY?: number;
  headlineScale?: number;
  headlineAnimation?: PromoOverlayAnimation;
  headlineAnimationDurationMs?: number;
  taglineOffsetX?: number;
  taglineOffsetY?: number;
  taglineScale?: number;
  taglineAnimation?: PromoOverlayAnimation;
  taglineAnimationDurationMs?: number;
  /** Up to 3 buy links per side of the CTA button (6 total). */
  ctaBuyLinks?: PromoCtaBuyLink[];
  presentation: PromoPresentation;
  sequenceTransition: PromoSequenceTransition;
  /** Opacity/transform duration when advancing between sequence frames (ms). */
  sequenceFadeDurationMs?: number;
  sequenceLoop: boolean;
  frames: PromoFrame[];
  /** Solid strip background (hex or css color). */
  stripBackground?: string;
  /** Optional curated CSS gradient used when no background image is selected. */
  stripBackgroundGradient?: string;
  /** Optional image painted behind strip content; clipped by strip overflow. */
  stripBackgroundImageUrl?: string;
  /** Strip background media type when stripBackgroundImageUrl is set. */
  stripBackgroundMediaKind?: "none" | "image" | "video";
  /** When true (default), strip background video loops; when false, plays once then stops. */
  stripBackgroundVideoLoop?: boolean;
  /** Optional still banner shown after a play-once background video finishes. */
  stripBackgroundFallbackImageUrl?: string;
  /** Background image width as % of strip (25–400). */
  stripBackgroundImageScale?: number;
  /** Background image horizontal position (%). */
  stripBackgroundImageOffsetX?: number;
  /** Background image vertical position (%). */
  stripBackgroundImageOffsetY?: number;
  /** Strip height in px (when stripAspectRatio is fixed). */
  stripHeightPx?: number;
  /** Banner frame width as a percentage of available space. */
  stripWidthPct?: number;
  stripFrameScale?: number;
  stripPositionOffsetX?: number;
  /** Vertical nudge for the whole strip on the homepage (cm). Positive moves down. */
  stripPositionOffsetCm?: number;
  /** Fine vertical nudge for the strip (px). Positive moves down. */
  stripPositionOffsetPx?: number;
  /** Direct-drag offset for the CTA button (px). */
  ctaOffsetX?: number;
  ctaOffsetY?: number;
  /** Direct-drag offset for the product thumbnail group (px). */
  thumbnailOffsetX?: number;
  thumbnailOffsetY?: number;
  /** fixed = use stripHeightPx; 21:9 = match widescreen video aspect to strip width. */
  stripAspectRatio?: "fixed" | "21:9";
  /** Backdrop opacity (1 = fully opaque). */
  stripOpacity?: number;
  /** Horizontal nudge for promo gift/media in hero (cm). */
  mediaOffsetXCm?: number;
  overlayImageX?: number;
  overlayImageY?: number;
  overlayImageScale?: number;
  overlayImageRadius?: number;
  overlayImageShadow?: boolean;
  overlayImageAnimation?: PromoOverlayAnimation;
  /** Duration of one second-layer animation cycle, in milliseconds. */
  overlayImageAnimationDurationMs?: number;
  /** Multiple independently positioned foreground image layers. */
  overlayImages?: PromoOverlayImage[];
  /** Scroll marquee even when the message fits in the strip. */
  marqueeForceScroll?: boolean;
  /** Hero marquee: cm left of product right edge where text begins (default 3). */
  heroMarqueeStartOffsetCm?: number;
  /** Hero marquee: extra px nudge after cm offset (positive = further right). */
  heroMarqueeStartOffsetPx?: number;
  /** Hero marquee: cm from strip center where the message rests (positive = right). */
  heroMarqueeEndOffsetCm?: number;
  /** Hero marquee: extra px nudge for the rest/end position (positive = further right). */
  heroMarqueeEndOffsetPx?: number;
  startsAt: string;
  endsAt: string;
  active: boolean;
  /** When false, homepage hides the promo strip and shows primary hero media. */
  promoModeEnabled?: boolean;
  /** Hand-tuned phone layout, edited on /admin/mobile-promo. */
  mobile?: PromoMobileLayout;
  /** Render only: set once a mobile layout has been merged in. Never stored. */
  mobileTuned?: boolean;
  createdAt: string;
  updatedAt: string;
};
