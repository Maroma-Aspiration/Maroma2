/** Scroll speed for promo marquee text (px per second). */
const MARQUEE_PX_PER_SECOND = 68;
const MARQUEE_START_HOLD_MS = 350;
const MARQUEE_END_HOLD_MS = 1800;
const MARQUEE_MIN_MS = 3600;
const MARQUEE_MAX_MS = 32000;

/** Default hero marquee start offset (cm left of product right edge). */
export const PROMO_HERO_MARQUEE_START_NUDGE_CM = 3;

export type HeroMarqueeStartInput = {
  trackWidth: number;
  textWidth: number;
  productRightInTrack: number | null;
  productLeftInTrack?: number | null;
  startOffsetCm?: number;
  startOffsetPx?: number;
  cmToPx?: (cm: number) => number;
};

/** Hero marquee start X — cm/px offsets apply directly; text may start beyond the track (behind product). */
export function computeHeroMarqueeStartX(input: HeroMarqueeStartInput): number {
  const toPx = input.cmToPx ?? ((cm: number) => (cm * 96) / 2.54);
  const startNudgePx = toPx(input.startOffsetCm ?? PROMO_HERO_MARQUEE_START_NUDGE_CM);
  const extraPx = input.startOffsetPx ?? 0;
  const trackWidth = input.trackWidth;
  const textWidth = input.textWidth;
  const productRight = input.productRightInTrack;
  const productLeft = input.productLeftInTrack ?? 0;

  const trackFallback = trackWidth - startNudgePx + extraPx;

  if (productRight === null || !Number.isFinite(productRight)) {
    return trackFallback;
  }

  if (productRight <= 0 || productLeft >= trackWidth) {
    return trackFallback;
  }

  // Higher cm moves start further left (text emerges sooner from behind the product).
  const startX = productRight - startNudgePx + extraPx;
  return Math.max(-textWidth, startX);
}

/** Shift applied to both marquee start and end so the whole message moves together. */
export function computeHeroMarqueePathShift(
  startX: number,
  input: Pick<HeroMarqueeStartInput, "productRightInTrack" | "trackWidth" | "startOffsetCm" | "startOffsetPx" | "cmToPx">
): number {
  const baselineStart = computeHeroMarqueeStartX({
    trackWidth: input.trackWidth,
    textWidth: 0,
    productRightInTrack: input.productRightInTrack ?? null,
    productLeftInTrack: null,
    startOffsetCm: PROMO_HERO_MARQUEE_START_NUDGE_CM,
    startOffsetPx: 0,
    cmToPx: input.cmToPx,
  });
  return startX - baselineStart;
}

export type PromoMarqueeTiming = {
  startX: number;
  endX: number;
  startHoldMs: number;
  scrollDurationMs: number;
  endHoldMs: number;
  totalMs: number;
  fits: boolean;
};

/** Left-edge translateX that centres text within a reference width. */
export function computePromoMarqueeEndX(referenceCenterX: number, textWidth: number): number {
  return referenceCenterX - textWidth / 2;
}

/** Resolve cm to px using the browser (falls back to 96dpi). */
export function cmToPx(cm: number, referenceEl?: Element | null): number {
  if (typeof document !== "undefined") {
    const host = referenceEl ?? document.documentElement;
    const probe = document.createElement("div");
    probe.style.width = `${cm}cm`;
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.style.pointerEvents = "none";
    host.appendChild(probe);
    const px = probe.getBoundingClientRect().width;
    probe.remove();
    if (px > 0) return px;
  }
  return (cm * 96) / 2.54;
}

export function computePromoMarqueeTiming(
  trackWidth: number,
  textWidth: number,
  configuredMs = 5200,
  forceScroll = false,
  options?: {
    startXOverride?: number;
    endXOverride?: number;
  }
): PromoMarqueeTiming {
  if (trackWidth <= 0 || textWidth <= 0) {
    const totalMs = Math.min(MARQUEE_MAX_MS, Math.max(MARQUEE_MIN_MS, configuredMs));
    return {
      startX: 0,
      endX: 0,
      startHoldMs: 0,
      scrollDurationMs: 0,
      endHoldMs: totalMs,
      totalMs,
      fits: true,
    };
  }

  const endX =
    typeof options?.endXOverride === "number" && Number.isFinite(options.endXOverride)
      ? options.endXOverride
      : computePromoMarqueeEndX(trackWidth / 2, textWidth);

  if (!forceScroll && textWidth <= trackWidth) {
    const endHoldMs = MARQUEE_END_HOLD_MS * 2;
    const totalMs = Math.min(MARQUEE_MAX_MS, Math.max(MARQUEE_MIN_MS, configuredMs, endHoldMs));
    return {
      startX: endX,
      endX,
      startHoldMs: 0,
      scrollDurationMs: 0,
      endHoldMs,
      totalMs,
      fits: true,
    };
  }

  const startX =
    typeof options?.startXOverride === "number" && Number.isFinite(options.startXOverride)
      ? options.startXOverride
      : trackWidth;
  const scrollDurationMs = Math.round((Math.abs(endX - startX) / MARQUEE_PX_PER_SECOND) * 1000);
  const startHoldMs = MARQUEE_START_HOLD_MS;
  const endHoldMs = MARQUEE_END_HOLD_MS;
  const totalMs = Math.min(
    MARQUEE_MAX_MS,
    Math.max(MARQUEE_MIN_MS, configuredMs, startHoldMs + scrollDurationMs + endHoldMs)
  );

  return {
    startX,
    endX,
    startHoldMs,
    scrollDurationMs,
    endHoldMs,
    totalMs,
    fits: false,
  };
}
