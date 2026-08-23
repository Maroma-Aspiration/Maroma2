export type PromoAnimation = "marquee" | "fade" | "slide" | "pulse";
export type PromoMediaKind = "none" | "image" | "video";
export type PromoPresentation = "static" | "sequence";
export type PromoFrameKind = "empty" | "title-media" | "marquee" | "cta";
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
  sequenceLoop: boolean;
  frames: PromoFrame[];
  /** Solid strip background (hex or css color). */
  stripBackground?: string;
  /** Strip height in px. */
  stripHeightPx?: number;
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
  startsAt: string;
  endsAt: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
