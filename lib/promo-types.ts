export type PromoAnimation = "marquee" | "fade" | "slide" | "pulse";
export type PromoMediaKind = "none" | "image" | "title-media" | "video";
export type PromoPresentation = "static" | "sequence";
export type PromoFrameKind = "empty" | "title-media" | "text" | "image" | "marquee" | "cta";
export type PromoSequenceTransition = "fade" | "slide-up" | "slide-down" | "crossfade";

export type PromoCtaBuyLink = {
  id: string;
  side: "left" | "right";
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
  /** Vertical nudge for the whole strip on the homepage (cm). Positive moves down. */
  stripPositionOffsetCm?: number;
  /** Fine vertical nudge for the strip (px). Positive moves down. */
  stripPositionOffsetPx?: number;
  /** Direct-drag offset for the CTA product cluster (px). */
  ctaOffsetX?: number;
  ctaOffsetY?: number;
  /** fixed = use stripHeightPx; 21:9 = match widescreen video aspect to strip width. */
  stripAspectRatio?: "fixed" | "21:9";
  /** Backdrop opacity (1 = fully opaque). */
  stripOpacity?: number;
  /** Horizontal nudge for promo gift/media in hero (cm). */
  mediaOffsetXCm?: number;
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
  createdAt: string;
  updatedAt: string;
};
