"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import type { PromoBanner, PromoFrame, PromoSequenceTransition } from "../../lib/promo-types";
import { resolvePromoFrames } from "../../lib/promo-sequence-utils";
import { normalizePromoStripFields, promoStripStyleVars } from "../../lib/promo-strip-utils";
import { PromoCtaCluster } from "./PromoCtaCluster";
import { PromoSequenceMarquee } from "./PromoSequenceMarquee";
import type { PromoCtaBuyLink } from "../../lib/promo-types";

type PromoBannerSequenceProps = {
  banner: Pick<
    PromoBanner,
    | "title"
    | "body"
    | "mediaUrl"
    | "mediaKind"
    | "ctaLabel"
    | "ctaHref"
    | "ctaBuyLinks"
    | "frames"
    | "sequenceTransition"
    | "sequenceLoop"
    | "stripBackground"
    | "stripHeightPx"
    | "stripOpacity"
    | "mediaOffsetXCm"
    | "marqueeForceScroll"
    | "heroMarqueeStartOffsetCm"
    | "heroMarqueeStartOffsetPx"
  >;
  linkable?: boolean;
  variant?: "default" | "hero";
  className?: string;
  marqueePreviewStart?: boolean;
};

function renderCta(frame: PromoFrame, linkable: boolean, scale: number) {
  if (!frame.ctaLabel?.trim()) return null;
  const style = { transform: `scale(${scale})` };
  if (linkable && frame.ctaHref) {
    return (
      <a className="promo-banner-cta promo-sequence-cta" href={frame.ctaHref} style={style}>
        <span className="promo-banner-cta-label">{frame.ctaLabel}</span>
        <span className="promo-banner-cta-shine" aria-hidden="true" />
      </a>
    );
  }
  return (
    <span className="promo-banner-cta promo-sequence-cta" style={style}>
      <span className="promo-banner-cta-label">{frame.ctaLabel}</span>
      <span className="promo-banner-cta-shine" aria-hidden="true" />
    </span>
  );
}

function renderMedia(frame: PromoFrame, mediaScale: number) {
  if (!frame.mediaUrl || frame.mediaKind === "none") return null;
  const wrapStyle = { ["--promo-media-scale" as string]: String(mediaScale) };
  if (frame.mediaKind === "video") {
    return (
      <div className="promo-banner-media-wrap promo-sequence-media-wrap" style={wrapStyle}>
        <video className="promo-banner-media" src={frame.mediaUrl} autoPlay muted loop playsInline />
      </div>
    );
  }
  return (
    <div className="promo-banner-media-wrap promo-sequence-media-wrap" style={wrapStyle}>
      <img src={frame.mediaUrl} alt="" className="promo-banner-media" />
    </div>
  );
}

function renderFrameBody(
  frame: PromoFrame,
  linkable: boolean,
  ctaBuyLinks: PromoCtaBuyLink[],
  variant: "default" | "hero",
  onMarqueeDurationReady?: (durationMs: number) => void,
  marqueeRunId?: number,
  forceMarqueeScroll?: boolean,
  heroMarqueeStartOffsetCm?: number,
  heroMarqueeStartOffsetPx?: number,
  marqueePreviewStart?: boolean
) {
  switch (frame.kind) {
    case "empty":
      return <span className="promo-sequence-empty" aria-hidden="true" />;
    case "title-media":
      if (variant === "hero") {
        return <span className="promo-sequence-empty" aria-hidden="true" />;
      }
      return (
        <div className="promo-sequence-title-media">
          {renderMedia(frame, frame.mediaScale ?? 3)}
          {frame.title ? (
            <strong
              className="promo-banner-title promo-sequence-title"
              style={{ fontSize: `${frame.titleSizeRem ?? 1.18}rem` }}
            >
              {frame.title}
            </strong>
          ) : null}
        </div>
      );
    case "marquee":
      return frame.body ? (
        <PromoSequenceMarquee
          frame={frame}
          runId={marqueeRunId ?? 0}
          forceScroll={forceMarqueeScroll ?? false}
          variant={variant}
          heroMarqueeStartOffsetCm={heroMarqueeStartOffsetCm}
          heroMarqueeStartOffsetPx={heroMarqueeStartOffsetPx}
          previewStartPosition={marqueePreviewStart}
          onDurationReady={(durationMs) => onMarqueeDurationReady?.(durationMs)}
        />
      ) : null;
    case "cta":
      return (
        <div className="promo-sequence-cta-wrap">
          <PromoCtaCluster
            buyLinks={ctaBuyLinks}
            linkable={linkable}
            cta={renderCta(frame, linkable, frame.ctaScale ?? 1)}
          />
        </div>
      );
    default:
      return null;
  }
}

export function PromoBannerSequence({
  banner,
  linkable = true,
  variant = "default",
  className = "",
  marqueePreviewStart = false,
}: PromoBannerSequenceProps) {
  const frames = useMemo(
    () => resolvePromoFrames(banner, { heroVariant: variant === "hero" }),
    [banner, variant]
  );
  const strip = useMemo(() => normalizePromoStripFields(banner), [banner]);
  const ctaBuyLinks = useMemo(() => banner.ctaBuyLinks ?? [], [banner.ctaBuyLinks]);
  const transition =
    variant === "hero" ? "crossfade" : (banner.sequenceTransition ?? "fade");
  const loop = banner.sequenceLoop !== false;
  const [activeIndex, setActiveIndex] = useState(0);
  const [entering, setEntering] = useState(true);
  const [runId, setRunId] = useState(0);
  const [marqueeDurationMs, setMarqueeDurationMs] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const enterTimerRef = useRef<number | null>(null);

  const handleMarqueeDurationReady = useCallback((durationMs: number) => {
    setMarqueeDurationMs(durationMs);
  }, []);

  useEffect(() => {
    if (marqueePreviewStart) return;
    setMarqueeDurationMs(null);
    setRunId((value) => value + 1);
  }, [marqueePreviewStart, strip.heroMarqueeStartOffsetCm, strip.heroMarqueeStartOffsetPx]);

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (enterTimerRef.current !== null) {
      window.clearTimeout(enterTimerRef.current);
      enterTimerRef.current = null;
    }
  }, []);

  const goToFrame = useCallback(
    (nextIndex: number) => {
      setActiveIndex(nextIndex);
      setEntering(true);
      if (enterTimerRef.current !== null) window.clearTimeout(enterTimerRef.current);
      enterTimerRef.current = window.setTimeout(() => setEntering(false), 620);
    },
    []
  );

  useEffect(() => {
    if (!marqueePreviewStart) return;
    const marqueeIndex = frames.findIndex((frame) => frame.kind === "marquee");
    if (marqueeIndex >= 0 && activeIndex !== marqueeIndex) {
      goToFrame(marqueeIndex);
    }
  }, [activeIndex, frames, goToFrame, marqueePreviewStart]);

  const replay = useCallback(() => {
    clearTimers();
    setMarqueeDurationMs(null);
    setEntering(true);
    setRunId((value) => value + 1);
    setActiveIndex(0);
  }, [clearTimers]);

  const handleReplayPointerDown = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  }, []);

  const handleReplayClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      replay();
    },
    [replay]
  );

  const handleReplayKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        replay();
      }
    },
    [replay]
  );

  useEffect(() => {
    setMarqueeDurationMs(null);
  }, [activeIndex, runId]);

  useEffect(() => {
    if (frames.length === 0) return undefined;

    const current = frames[activeIndex];
    if (!current) return undefined;

    if (current.kind === "cta") {
      clearTimers();
      return undefined;
    }

    if (current.kind === "marquee" && marqueePreviewStart) {
      clearTimers();
      return undefined;
    }

    if (current.kind === "marquee" && marqueeDurationMs === null) {
      return undefined;
    }

    clearTimers();
    const waitMs =
      current.kind === "marquee" && marqueeDurationMs !== null
        ? marqueeDurationMs
        : current.durationMs ?? 2400;

    timerRef.current = window.setTimeout(() => {
      const isLast = activeIndex >= frames.length - 1;
      if (isLast && !loop) return;
      const nextIndex = isLast ? 0 : activeIndex + 1;
      goToFrame(nextIndex);
    }, waitMs);

    return clearTimers;
  }, [activeIndex, clearTimers, frames, goToFrame, loop, marqueeDurationMs, marqueePreviewStart]);

  useEffect(() => {
    setEntering(true);
    const timer = window.setTimeout(() => setEntering(false), 620);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      className={`promo-banner promo-banner-sequence promo-banner--${variant} promo-banner--transition-${transition} ${className}`.trim()}
      style={promoStripStyleVars(banner)}
      data-promo-run={runId}
    >
      <div className="promo-banner-sequence-stage" aria-live="polite">
        {frames.map((frame, index) => {
          const isActive = index === activeIndex;
          const frameBody =
            isActive || frame.kind !== "marquee"
              ? renderFrameBody(
                  frame,
                  linkable,
                  ctaBuyLinks,
                  variant,
                  isActive && frame.kind === "marquee" ? handleMarqueeDurationReady : undefined,
                  isActive && frame.kind === "marquee" ? runId : undefined,
                  strip.marqueeForceScroll,
                  strip.heroMarqueeStartOffsetCm,
                  strip.heroMarqueeStartOffsetPx,
                  marqueePreviewStart
                )
              : null;
          return (
            <div
              key={`${frame.id}-${runId}`}
              data-frame-kind={frame.kind}
              className={`promo-banner-sequence-frame${isActive ? " is-active" : ""}${
                isActive && entering ? " is-entering" : ""
              }`}
              aria-hidden={!isActive}
            >
              {frameBody}
            </div>
          );
        })}
      </div>
      {frames.length > 1 ? (
        <button
          type="button"
          className="promo-banner-replay"
          aria-label="Replay banner animation"
          title="Replay animation"
          onPointerDown={handleReplayPointerDown}
          onClick={handleReplayClick}
          onKeyDown={handleReplayKeyDown}
        >
          ↻
        </button>
      ) : null}
    </div>
  );
}

export type { PromoSequenceTransition };
