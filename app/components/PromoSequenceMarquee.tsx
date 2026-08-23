"use client";

import { useLayoutEffect, useRef } from "react";
import type { PromoFrame } from "../../lib/promo-types";
import {
  cmToPx,
  computeHeroMarqueePathShift,
  computeHeroMarqueeStartX,
  computePromoMarqueeEndX,
  computePromoMarqueeTiming,
} from "../../lib/promo-marquee-timing";

type PromoSequenceMarqueeProps = {
  frame: PromoFrame;
  runId?: number;
  forceScroll?: boolean;
  variant?: "default" | "hero";
  heroMarqueeStartOffsetCm?: number;
  heroMarqueeStartOffsetPx?: number;
  /** Admin: hold text at start X while adjusting offsets (no scroll). */
  previewStartPosition?: boolean;
  onDurationReady: (durationMs: number) => void;
};

type HeroMarqueeGeometry = {
  trackWidth: number;
  textWidth: number;
  productRightInTrack: number | null;
  productLeftInTrack: number | null;
  startX: number;
  endX: number;
};

function getVisualStripElement(track: HTMLElement): HTMLElement | null {
  return (
    (track.closest(".hero-promo-banner") as HTMLElement | null) ??
    (track.closest(".promo-banner-sequence") as HTMLElement | null) ??
    (track.closest(".promo-banner") as HTMLElement | null)
  );
}

function getStripCenterInTrack(track: HTMLElement): number {
  const trackRect = track.getBoundingClientRect();
  const strip = getVisualStripElement(track);
  const stripRect = strip?.getBoundingClientRect();
  if (!stripRect || stripRect.width <= 0) {
    return track.clientWidth / 2;
  }
  return stripRect.left + stripRect.width / 2 - trackRect.left;
}

function measureMarqueeTextWidth(text: HTMLElement): number {
  const track = text.parentElement;
  if (!track) {
    return Math.ceil(text.scrollWidth || text.getBoundingClientRect().width);
  }

  const sourceStyle = getComputedStyle(text);
  const clone = text.cloneNode(true) as HTMLElement;
  clone.textContent = text.textContent;
  clone.style.position = "absolute";
  clone.style.visibility = "hidden";
  clone.style.pointerEvents = "none";
  clone.style.left = "-9999px";
  clone.style.top = "0";
  clone.style.transform = "none";
  clone.style.animation = "none";
  clone.style.whiteSpace = "nowrap";
  clone.style.width = "max-content";
  clone.style.maxWidth = "none";
  clone.style.font = sourceStyle.font;
  clone.style.fontSize = sourceStyle.fontSize;
  clone.style.fontWeight = sourceStyle.fontWeight;
  clone.style.letterSpacing = sourceStyle.letterSpacing;
  track.appendChild(clone);
  const width = Math.ceil(clone.getBoundingClientRect().width);
  clone.remove();
  return width;
}

function getHeroProductRect(track: HTMLElement): DOMRect | null {
  const artboard = track.closest(".hero-artboard");
  if (!artboard) {
    return null;
  }

  const frame = artboard.querySelector(
    ".hero-media .hero-media-frame:not(.hero-overlay-frame)"
  ) as HTMLElement | null;
  if (!frame) {
    return null;
  }

  const media = frame.querySelector(
    "img, video, .hero-youtube-wrap, .hero-native-video-wrap"
  ) as HTMLElement | null;
  const target = media ?? frame;
  const rect = target.getBoundingClientRect();
  if (rect.width <= 8 || rect.height <= 8) {
    return null;
  }
  return rect;
}

function resolveHeroMarqueeGeometry(
  track: HTMLElement,
  text: HTMLElement,
  options?: { startOffsetCm?: number; startOffsetPx?: number }
): HeroMarqueeGeometry {
  const trackWidth = track.clientWidth;
  const textWidth = measureMarqueeTextWidth(text);
  const trackRect = track.getBoundingClientRect();
  const productRect = getHeroProductRect(track);
  const productRightInTrack = productRect ? productRect.right - trackRect.left : null;
  const productLeftInTrack = productRect ? productRect.left - trackRect.left : null;
  const cmToPxFn = (cm: number) => cmToPx(cm, track);

  const startX = computeHeroMarqueeStartX({
    trackWidth,
    textWidth,
    productRightInTrack,
    productLeftInTrack,
    startOffsetCm: options?.startOffsetCm,
    startOffsetPx: options?.startOffsetPx,
    cmToPx: cmToPxFn,
  });

  const pathShift = computeHeroMarqueePathShift(startX, {
    trackWidth,
    productRightInTrack,
    startOffsetCm: options?.startOffsetCm,
    startOffsetPx: options?.startOffsetPx,
    cmToPx: cmToPxFn,
  });

  const baseEndX = computePromoMarqueeEndX(getStripCenterInTrack(track), textWidth);
  const endX = baseEndX + pathShift;

  return {
    trackWidth,
    textWidth,
    productRightInTrack,
    productLeftInTrack,
    startX,
    endX,
  };
}

function setTextTransform(text: HTMLElement, x: number) {
  text.style.transform = `translate3d(${x}px, -50%, 0)`;
}

export function PromoSequenceMarquee({
  frame,
  runId = 0,
  forceScroll = true,
  variant = "default",
  heroMarqueeStartOffsetCm,
  heroMarqueeStartOffsetPx,
  previewStartPosition = false,
  onDurationReady,
}: PromoSequenceMarqueeProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const geometryRef = useRef<HeroMarqueeGeometry | null>(null);

  useLayoutEffect(() => {
    if (!previewStartPosition || variant !== "hero") return;

    const track = trackRef.current;
    const text = textRef.current;
    if (!track || !text || !frame.body) return;

    animationRef.current?.cancel();
    animationRef.current = null;

    const applyPreview = () => {
      if (track.clientWidth <= 0) return;
      const geometry = resolveHeroMarqueeGeometry(track, text, {
        startOffsetCm: heroMarqueeStartOffsetCm,
        startOffsetPx: heroMarqueeStartOffsetPx,
      });
      geometryRef.current = geometry;
      text.dataset.marqueeMode = "preview";
      text.style.whiteSpace = "nowrap";
      text.style.visibility = "visible";
      text.style.opacity = "1";
      setTextTransform(text, geometry.startX);
    };

    applyPreview();
    const retry = window.setTimeout(applyPreview, 120);
    return () => window.clearTimeout(retry);
  }, [
    frame.body,
    frame.bodySizeRem,
    heroMarqueeStartOffsetCm,
    heroMarqueeStartOffsetPx,
    previewStartPosition,
    runId,
    variant,
  ]);

  useLayoutEffect(() => {
    if (previewStartPosition && variant === "hero") {
      return;
    }

    const track = trackRef.current;
    const text = textRef.current;
    if (!track || !text || !frame.body) return;

    let cancelled = false;
    let retryTimer: number | null = null;

    const applyTiming = async (attempt = 0) => {
      if (cancelled) return;

      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      if (cancelled) return;

      animationRef.current?.cancel();
      animationRef.current = null;
      text.style.animation = "none";
      text.style.whiteSpace = "nowrap";
      text.style.paddingLeft = "0";
      text.style.margin = "0";
      text.style.opacity = "0";
      text.style.visibility = "hidden";

      if (track.clientWidth <= 0) {
        if (attempt < 16) {
          retryTimer = window.setTimeout(() => {
            void applyTiming(attempt + 1);
          }, 80);
        }
        return;
      }

      const geometry =
        variant === "hero"
          ? resolveHeroMarqueeGeometry(track, text, {
              startOffsetCm: heroMarqueeStartOffsetCm,
              startOffsetPx: heroMarqueeStartOffsetPx,
            })
          : null;

      const startXOverride = geometry?.startX;
      const endXOverride = geometry?.endX;

      const timing = computePromoMarqueeTiming(
        geometry?.trackWidth ?? track.clientWidth,
        geometry?.textWidth ?? measureMarqueeTextWidth(text),
        frame.durationMs,
        forceScroll,
        {
          startXOverride,
          endXOverride,
        }
      );

      const resolvedStartX = startXOverride ?? timing.startX;
      const resolvedEndX = endXOverride ?? timing.endX;

      if (timing.fits || timing.scrollDurationMs <= 0) {
        text.dataset.marqueeMode = "static";
        text.style.visibility = "visible";
        text.style.opacity = "1";
        setTextTransform(text, resolvedEndX);
        onDurationReady(timing.totalMs);
        return;
      }

      text.dataset.marqueeMode = "scroll";
      setTextTransform(text, resolvedStartX);

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      if (cancelled) return;

      text.style.visibility = "visible";

      const motionMs = timing.startHoldMs + timing.scrollDurationMs;
      const holdOffset =
        motionMs > 0 ? Math.min(Math.max(timing.startHoldMs / motionMs, 0), 0.98) : 0;

      animationRef.current = text.animate(
        [
          { transform: `translate3d(${resolvedStartX}px, -50%, 0)`, opacity: 0 },
          { transform: `translate3d(${resolvedStartX}px, -50%, 0)`, opacity: 0, offset: holdOffset },
          { transform: `translate3d(${resolvedEndX}px, -50%, 0)`, opacity: 1 },
        ],
        {
          duration: motionMs,
          fill: "forwards",
          easing: "linear",
        }
      );

      onDurationReady(timing.totalMs);
    };

    void applyTiming();

    return () => {
      cancelled = true;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
      animationRef.current?.cancel();
    };
  }, [
    frame.body,
    frame.bodySizeRem,
    frame.durationMs,
    forceScroll,
    heroMarqueeStartOffsetCm,
    heroMarqueeStartOffsetPx,
    onDurationReady,
    previewStartPosition,
    runId,
    variant,
  ]);

  if (!frame.body) return null;

  return (
    <div className={`promo-sequence-marquee${variant === "hero" ? " promo-sequence-marquee--hero" : ""}`}>
      <div ref={trackRef} className="promo-sequence-marquee-track">
        <span
          key={`marquee-${runId}-${frame.id}`}
          ref={textRef}
          className="promo-sequence-marquee-text"
          data-marquee-mode="scroll"
          style={{ fontSize: `${frame.bodySizeRem ?? 0.96}rem` }}
        >
          {frame.body}
        </span>
      </div>
    </div>
  );
}
