"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import type { PromoBanner, PromoFrame } from "../../lib/promo-types";
import {
  frameShowsMedia,
  frameShowsTitle,
  PROMO_FRAME_FADE_MS_DEFAULT,
  resolvePromoFrames,
} from "../../lib/promo-sequence-utils";
import { normalizePromoStripFields, promoStripStyleVars, promoStripBannerClass, promoStripVideoThenCta } from "../../lib/promo-strip-utils";
import {
  readPromoStripVideoPaused,
  readPromoStripVideoSeen,
  writePromoStripVideoSeen,
} from "../../lib/promo-strip-video-session";
import { PromoCtaCluster } from "./PromoCtaCluster";
import { PromoSequenceMarquee } from "./PromoSequenceMarquee";
import { PromoStripBackgroundMedia } from "./PromoStripBackgroundMedia";
import type { PromoCtaBuyLink } from "../../lib/promo-types";
import {
  PROMO_PREVIEW_PLAY,
  PROMO_PREVIEW_STATUS,
  PROMO_PREVIEW_STOP,
} from "../../lib/promo-preview-storage";

type PromoPlayback = "held" | "playing" | "paused";
type FramePhase = "in" | "hold" | "out";
type StripVideoPhase = "idle" | "playing" | "ended";

type PromoBannerSequenceProps = {
  banner: Pick<
    PromoBanner,
    | "id"
    | "title"
    | "body"
    | "mediaUrl"
    | "mediaKind"
    | "ctaLabel"
    | "ctaHref"
    | "ctaBuyLinks"
    | "frames"
    | "sequenceTransition"
    | "sequenceFadeDurationMs"
    | "sequenceLoop"
    | "stripBackground"
    | "stripHeightPx"
    | "stripOpacity"
    | "mediaOffsetXCm"
    | "marqueeForceScroll"
    | "heroMarqueeStartOffsetCm"
    | "heroMarqueeStartOffsetPx"
    | "heroMarqueeEndOffsetCm"
    | "heroMarqueeEndOffsetPx"
    | "stripBackgroundImageUrl"
    | "stripBackgroundMediaKind"
    | "stripBackgroundVideoLoop"
    | "stripBackgroundFallbackImageUrl"
    | "stripAspectRatio"
    | "ctaOffsetX"
    | "ctaOffsetY"
    | "thumbnailOffsetX"
    | "thumbnailOffsetY"
  >;
  linkable?: boolean;
  variant?: "default" | "hero";
  className?: string;
  /** Hold playback on frame 0 until Start (homepage preview iframe). */
  startHeld?: boolean;
  /** Hold marquee at start/end while editing offsets in admin. */
  marqueePreviewStart?: boolean;
  marqueePreviewMode?: "start" | "end";
  /** Skip autoplay when strip video was already seen this session (live homepage). */
  rememberStripVideoSeen?: boolean;
  ctaDraggable?: boolean;
  thumbnailsDraggable?: boolean;
  onCtaPositionChange?: (position: { x: number; y: number }) => void;
  onThumbnailsPositionChange?: (position: { x: number; y: number }) => void;
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
  const mediaStyle = {
    height: `calc(var(--promo-strip-height, 106px) * ${mediaScale})`,
    maxHeight: "none",
  };
  if (frame.mediaKind === "video") {
    return (
      <div className="promo-banner-media-wrap promo-sequence-media-wrap" style={wrapStyle}>
        <video
          className="promo-banner-media"
          src={frame.mediaUrl}
          autoPlay
          muted
          loop
          playsInline
          style={mediaStyle}
        />
      </div>
    );
  }
  return (
    <div className="promo-banner-media-wrap promo-sequence-media-wrap" style={wrapStyle}>
      <img src={frame.mediaUrl} alt="" className="promo-banner-media" style={mediaStyle} />
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
  heroMarqueeEndOffsetCm?: number,
  heroMarqueeEndOffsetPx?: number,
  marqueeOffsetPreview?: boolean,
  marqueePreviewMode?: "start" | "end",
  ctaOffsetX = 0,
  ctaOffsetY = 0,
  thumbnailOffsetX = 0,
  thumbnailOffsetY = 0,
  ctaDraggable = false,
  thumbnailsDraggable = false,
  onCtaPositionChange?: (position: { x: number; y: number }) => void,
  onThumbnailsPositionChange?: (position: { x: number; y: number }) => void,
) {
  switch (frame.kind) {
    case "empty":
      return <span className="promo-sequence-empty" aria-hidden="true" />;
    case "title-media":
    case "text":
    case "image":
      return (
        <div
          className={`promo-sequence-title-media${
            frame.kind === "text" ? " promo-sequence-title-media--text" : ""
          }${frame.kind === "image" ? " promo-sequence-title-media--image" : ""}`}
        >
          {frameShowsMedia(frame.kind)
            ? renderMedia(frame, frame.mediaScale ?? 3)
            : null}
          {frameShowsTitle(frame.kind) && frame.title ? (
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
          heroMarqueeEndOffsetCm={heroMarqueeEndOffsetCm}
          heroMarqueeEndOffsetPx={heroMarqueeEndOffsetPx}
          previewStartPosition={marqueeOffsetPreview}
          previewMode={marqueePreviewMode}
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
            ctaOffsetX={ctaOffsetX}
            ctaOffsetY={ctaOffsetY}
            thumbnailOffsetX={thumbnailOffsetX}
            thumbnailOffsetY={thumbnailOffsetY}
            ctaDraggable={ctaDraggable}
            thumbnailsDraggable={thumbnailsDraggable}
            onCtaPositionChange={onCtaPositionChange}
            onThumbnailsPositionChange={onThumbnailsPositionChange}
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
  startHeld = false,
  marqueePreviewStart = false,
  marqueePreviewMode = "start",
  rememberStripVideoSeen = false,
  ctaDraggable = false,
  thumbnailsDraggable = false,
  onCtaPositionChange,
  onThumbnailsPositionChange,
}: PromoBannerSequenceProps) {
  const frames = useMemo(
    () => resolvePromoFrames(banner, { heroVariant: variant === "hero" }),
    [banner, variant]
  );
  const strip = useMemo(() => normalizePromoStripFields(banner), [banner]);
  const stripVideoThenCta = useMemo(
    () => variant === "hero" && promoStripVideoThenCta(banner),
    [banner, variant]
  );
  const stripVideoUrl = strip.stripBackgroundImageUrl;
  const stripVideoPausedOnLoad = Boolean(
    !linkable && banner.id && stripVideoUrl && readPromoStripVideoPaused(banner.id, stripVideoUrl)
  );
  const stripVideoSeenOnLoad =
    rememberStripVideoSeen &&
    Boolean(banner.id && stripVideoUrl && readPromoStripVideoSeen(banner.id, stripVideoUrl));
  const ctaBuyLinks = useMemo(() => banner.ctaBuyLinks ?? [], [banner.ctaBuyLinks]);
  const transition = "fade";
  const [activeIndex, setActiveIndex] = useState(0);
  const [phase, setPhase] = useState<FramePhase>("hold");
  const [runId, setRunId] = useState(0);
  const [playback, setPlayback] = useState<PromoPlayback>(
    stripVideoPausedOnLoad ? "paused" : startHeld || marqueePreviewStart ? "held" : "playing"
  );
  const [stripVideoPhase, setStripVideoPhase] = useState<StripVideoPhase>(() => {
    if (!stripVideoThenCta) return "ended";
    if (startHeld || marqueePreviewStart || stripVideoPausedOnLoad) return "idle";
    if (stripVideoSeenOnLoad) return "ended";
    return "playing";
  });
  const [stripVideoDisplayReady, setStripVideoDisplayReady] = useState(!stripVideoThenCta);
  const [marqueeDurationMs, setMarqueeDurationMs] = useState<number | null>(null);
  const holdStart = playback === "held";
  const isPaused = playback === "paused";
  const isPlaying = playback === "playing";
  const timerRef = useRef<number | null>(null);
  const userStartedRef = useRef(false);
  const stripVideoRef = useRef<HTMLVideoElement | null>(null);
  const showSequenceOverlay = !stripVideoThenCta || stripVideoPhase === "ended";

  const handleMarqueeDurationReady = useCallback((durationMs: number) => {
    setMarqueeDurationMs(durationMs);
  }, []);

  const shouldAutoPlayStripVideo =
    !stripVideoPausedOnLoad && !startHeld && !marqueePreviewStart && !(stripVideoThenCta && stripVideoSeenOnLoad);

  useEffect(() => {
    if (userStartedRef.current) return;
    const shouldHold = startHeld || marqueePreviewStart;
    setPlayback(stripVideoPausedOnLoad ? "paused" : shouldHold ? "held" : "playing");
    if (stripVideoThenCta) {
      if (stripVideoPausedOnLoad) {
        setStripVideoPhase("idle");
      } else if (stripVideoSeenOnLoad && !shouldHold) {
        setStripVideoPhase("ended");
      } else {
        setStripVideoPhase(shouldHold ? "idle" : "playing");
      }
    } else {
      setStripVideoPhase("ended");
    }
    if (shouldHold) return;
    setActiveIndex(0);
    setPhase("hold");
  }, [
    startHeld,
    marqueePreviewStart,
    stripVideoPausedOnLoad,
    stripVideoSeenOnLoad,
    stripVideoThenCta,
  ]);

  useEffect(() => {
    if (!stripVideoThenCta) {
      setStripVideoDisplayReady(true);
      return;
    }
    // When the video ends, preserve its final painted frame while the CTA
    // sequence fades in. Reset only before a new playback or while held.
    if (stripVideoPhase !== "ended") {
      setStripVideoDisplayReady(false);
    }
  }, [stripVideoPhase, stripVideoThenCta, stripVideoUrl]);

  useEffect(() => {
    if (!stripVideoThenCta) return undefined;
    const video = stripVideoRef.current;
    if (!video) return undefined;

    let cancelled = false;
    let revealTimer: number | null = null;
    let retryTimer: number | null = null;
    let playAttempts = 0;

    const revealVideo = () => {
      if (!cancelled) setStripVideoDisplayReady(true);
    };

    const scheduleReveal = () => {
      if (revealTimer !== null) window.clearTimeout(revealTimer);
      revealTimer = window.setTimeout(revealVideo, 32);
    };

    if (stripVideoPhase === "playing") {
      const beginPlayback = async () => {
        if (cancelled) return;
        try {
          // Set these as DOM properties too: Safari can ignore JSX attributes
          // if media metadata arrives before hydration completes.
          video.muted = true;
          video.defaultMuted = true;
          video.playsInline = true;
          video.currentTime = 0;
        } catch {
          /* ignore seek errors before metadata */
        }
        try {
          await video.play();
          revealVideo();
        } catch {
          // A video can reject while it is still buffering despite being muted.
          // Retry after the browser's next media readiness event before giving up.
          playAttempts += 1;
          if (!cancelled && playAttempts < 3) {
            retryTimer = window.setTimeout(() => void beginPlayback(), 240 * playAttempts);
          }
        }
      };

      if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) void beginPlayback();
      else video.addEventListener("canplay", beginPlayback, { once: true });

      return () => {
        cancelled = true;
        if (revealTimer !== null) window.clearTimeout(revealTimer);
        if (retryTimer !== null) window.clearTimeout(retryTimer);
        video.removeEventListener("canplay", beginPlayback);
      };
    }

    if (stripVideoPhase === "ended") {
      const pauseAtEnd = () => {
        if (cancelled) return;
        if (Number.isFinite(video.duration) && video.duration > 0) {
          const onSeeked = () => {
            video.removeEventListener("seeked", onSeeked);
            scheduleReveal();
          };
          video.addEventListener("seeked", onSeeked);
          try {
            video.currentTime = Math.max(0, video.duration - 0.05);
          } catch {
            scheduleReveal();
          }
        } else {
          scheduleReveal();
        }
        video.pause();
      };

      if (video.readyState >= 1) pauseAtEnd();
      else video.addEventListener("loadedmetadata", pauseAtEnd, { once: true });

      return () => {
        cancelled = true;
        if (revealTimer !== null) window.clearTimeout(revealTimer);
        video.removeEventListener("loadedmetadata", pauseAtEnd);
      };
    }

    video.pause();
    try {
      video.currentTime = 0;
    } catch {
      /* ignore */
    }
    scheduleReveal();

    return () => {
      cancelled = true;
      if (revealTimer !== null) window.clearTimeout(revealTimer);
    };
  }, [stripVideoPhase, stripVideoThenCta, stripVideoUrl]);

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const restartStripVideo = useCallback(async () => {
    const video = stripVideoRef.current;
    if (!video) return;
    setStripVideoDisplayReady(false);
    try {
      video.currentTime = 0;
      await video.play();
      setStripVideoDisplayReady(true);
    } catch {
      /* autoplay policies may block until user gesture */
      setStripVideoDisplayReady(true);
    }
  }, []);

  const handleStripVideoEnded = useCallback(() => {
    if (!stripVideoThenCta || stripVideoPhase !== "playing") return;
    const video = stripVideoRef.current;
    if (
      video &&
      Number.isFinite(video.duration) &&
      video.duration > 0 &&
      video.currentTime < Math.max(0.35, video.duration * 0.08)
    ) {
      return;
    }
    if (rememberStripVideoSeen && banner.id && stripVideoUrl) {
      writePromoStripVideoSeen(banner.id, stripVideoUrl);
    }
    setStripVideoPhase("ended");
    userStartedRef.current = true;
    clearTimers();
    setMarqueeDurationMs(null);
    setActiveIndex(0);
    setPhase("in");
    setRunId((value) => value + 1);
    setPlayback("playing");
  }, [banner.id, clearTimers, rememberStripVideoSeen, stripVideoPhase, stripVideoThenCta, stripVideoUrl]);

  const goToFrame = useCallback((nextIndex: number) => {
    setActiveIndex(nextIndex);
    setPhase("in");
  }, []);

  useEffect(() => {
    if (!holdStart) return;
    setPhase("hold");
    if (stripVideoThenCta) {
      if (stripVideoPhase === "ended" && activeIndex !== 0) {
        setActiveIndex(0);
      }
      return;
    }
    if (marqueePreviewStart) {
      const marqueeIndex = frames.findIndex((frame) => frame.kind === "marquee");
      if (marqueeIndex >= 0 && activeIndex !== marqueeIndex) {
        setActiveIndex(marqueeIndex);
      }
      return;
    }
    if (activeIndex !== 0) {
      setActiveIndex(0);
    }
  }, [activeIndex, frames, holdStart, marqueePreviewStart, stripVideoPhase, stripVideoThenCta]);

  const startPlayback = useCallback(() => {
    userStartedRef.current = true;
    clearTimers();
    setMarqueeDurationMs(null);
    setRunId((value) => value + 1);
    setActiveIndex(0);
    if (stripVideoThenCta) {
      setStripVideoPhase("playing");
      setPhase("hold");
      setPlayback("held");
      void restartStripVideo();
      return;
    }
    setPlayback("playing");
    setPhase("in");
  }, [clearTimers, restartStripVideo, stripVideoThenCta]);

  const stopPlayback = useCallback(() => {
    userStartedRef.current = false;
    clearTimers();
    setPlayback("paused");
    if (stripVideoThenCta) {
      stripVideoRef.current?.pause();
      setStripVideoPhase("idle");
    }
  }, [clearTimers, stripVideoThenCta]);

  const handleReplayPointerDown = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  }, []);

  const handleReplayClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      startPlayback();
    },
    [startPlayback]
  );

  const handleStartClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      startPlayback();
    },
    [startPlayback]
  );

  const handleStopClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      stopPlayback();
    },
    [stopPlayback]
  );

  const handlePlaybackKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, action: "start" | "stop") => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (action === "start") startPlayback();
        else stopPlayback();
      }
    },
    [startPlayback, stopPlayback]
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === PROMO_PREVIEW_PLAY) startPlayback();
      if (event.data?.type === PROMO_PREVIEW_STOP) stopPlayback();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [startPlayback, stopPlayback]);

  useEffect(() => {
    if (window.parent && window.parent !== window) {
      const isAnimating =
        playback === "playing" || (stripVideoThenCta && stripVideoPhase === "playing");
      window.parent.postMessage(
        {
          type: PROMO_PREVIEW_STATUS,
          playback: isAnimating ? "playing" : "paused",
        },
        window.location.origin
      );
    }
  }, [playback, stripVideoPhase, stripVideoThenCta]);

  useEffect(() => {
    setMarqueeDurationMs(null);
  }, [activeIndex, runId]);

  useEffect(() => {
    const current = frames[activeIndex];
    if (!current || current.kind !== "marquee") return undefined;
    if (marqueeDurationMs !== null || holdStart || isPaused) return undefined;

    const fallbackMs = current.durationMs ?? 5200;
    const timer = window.setTimeout(() => {
      setMarqueeDurationMs((value) => value ?? fallbackMs);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [activeIndex, frames, holdStart, isPaused, marqueeDurationMs, runId]);

  useEffect(() => {
    if (frames.length === 0) return undefined;

    const current = frames[activeIndex];
    if (!current) return undefined;

    if (stripVideoThenCta && stripVideoPhase !== "ended") {
      clearTimers();
      return undefined;
    }

    if (current.kind === "cta" && !isPlaying && !(stripVideoThenCta && stripVideoPhase === "ended")) {
      clearTimers();
      return undefined;
    }

    if (holdStart || isPaused) {
      clearTimers();
      return undefined;
    }

    if (
      stripVideoThenCta &&
      stripVideoPhase === "ended" &&
      current.kind === "cta" &&
      phase === "hold"
    ) {
      clearTimers();
      return undefined;
    }

    if (phase === "hold" && current.kind === "marquee" && marqueeDurationMs === null) {
      return undefined;
    }

    clearTimers();
    const fadeIn = current.fadeInMs ?? PROMO_FRAME_FADE_MS_DEFAULT;
    const fadeOut = current.fadeOutMs ?? PROMO_FRAME_FADE_MS_DEFAULT;
    const holdMs =
      current.kind === "marquee" && marqueeDurationMs !== null
        ? marqueeDurationMs
        : current.durationMs ?? 2400;

    if (phase === "in") {
      timerRef.current = window.setTimeout(() => setPhase("hold"), Math.max(0, fadeIn));
      return clearTimers;
    }

    if (phase === "hold" && activeIndex === frames.length - 1) {
      return undefined;
    }

    if (phase === "hold") {
      timerRef.current = window.setTimeout(() => setPhase("out"), Math.max(50, holdMs));
      return clearTimers;
    }

    timerRef.current = window.setTimeout(() => {
      const isLast = activeIndex >= frames.length - 1;
      if (isLast) return;
      const nextIndex = isLast ? 0 : activeIndex + 1;
      goToFrame(nextIndex);
    }, Math.max(0, fadeOut));

    return clearTimers;
  }, [
    activeIndex,
    clearTimers,
    frames,
    goToFrame,
    holdStart,
    isPaused,
    isPlaying,
    marqueeDurationMs,
    phase,
    stripVideoPhase,
    stripVideoThenCta,
  ]);

  const sequenceStyle = useMemo(() => promoStripStyleVars(banner), [banner]);

  const marqueeOffsetPreview = holdStart && marqueePreviewStart;
  const activeKind = frames[activeIndex]?.kind;
  const mediaOverflow = activeKind === "image" || activeKind === "title-media";

  return (
    <div
      className={`promo-banner promo-banner-sequence promo-banner--${variant} promo-banner--transition-${transition}${
        mediaOverflow ? " promo-banner-sequence--media-overflow" : ""
      }${promoStripBannerClass(banner)} ${className}`.trim()}
      style={sequenceStyle}
      data-promo-run={runId}
      data-promo-opening={activeIndex === 0 && phase === "hold" ? "1" : undefined}
      data-promo-video-phase={stripVideoThenCta ? stripVideoPhase : undefined}
    >
      <PromoStripBackgroundMedia
        banner={banner}
        autoPlay={stripVideoThenCta ? false : shouldAutoPlayStripVideo}
        loop={stripVideoThenCta ? false : undefined}
        onEnded={handleStripVideoEnded}
        videoRef={stripVideoRef}
        className={stripVideoDisplayReady ? "is-strip-video-ready" : ""}
        ended={stripVideoThenCta && stripVideoPhase === "ended"}
        onReplay={startPlayback}
        onPlaybackChange={(playing) => {
          userStartedRef.current = true;
          clearTimers();
          setPlayback(playing ? "held" : "paused");
          if (stripVideoThenCta) setStripVideoPhase(playing ? "playing" : "idle");
        }}
        rememberPlayback={!linkable}
      />
      <div
        className={`promo-banner-sequence-stage${
          showSequenceOverlay ? "" : " promo-banner-sequence-stage--awaiting-video"
        }`}
        aria-live="polite"
      >
        {frames.map((frame, index) => {
          const isActive = index === activeIndex;
          const isExiting = isActive && phase === "out";
          const fadeInMs = frame.fadeInMs ?? PROMO_FRAME_FADE_MS_DEFAULT;
          const fadeOutMs = frame.fadeOutMs ?? PROMO_FRAME_FADE_MS_DEFAULT;
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
                  strip.heroMarqueeEndOffsetCm,
                  strip.heroMarqueeEndOffsetPx,
                  marqueeOffsetPreview,
                  marqueePreviewMode,
                  banner.ctaOffsetX,
                  banner.ctaOffsetY,
                  banner.thumbnailOffsetX,
                  banner.thumbnailOffsetY,
                  ctaDraggable,
                  thumbnailsDraggable,
                  onCtaPositionChange,
                  onThumbnailsPositionChange
                )
              : null;
          return (
            <div
              key={`${frame.id}-${runId}`}
              data-frame-kind={frame.kind}
              className={`promo-banner-sequence-frame${isActive ? " is-active" : ""}${
                isExiting ? " is-exiting" : ""
              }`}
              style={{
                ["--promo-frame-fade-in-ms" as string]: `${fadeInMs}ms`,
                ["--promo-frame-fade-out-ms" as string]: `${fadeOutMs}ms`,
              }}
              aria-hidden={!isActive}
            >
              {frameBody}
            </div>
          );
        })}
      </div>
      {rememberStripVideoSeen && stripVideoThenCta && stripVideoPhase === "ended" ? (
        <button
          type="button"
          className="promo-strip-video-replay"
          aria-label="Replay strip video"
          title="Replay video"
          onPointerDown={handleReplayPointerDown}
          onClick={handleReplayClick}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 5a7 7 0 110 14 7 7 0 010-14zm0 2a5 5 0 100 10 5 5 0 000-10zm-1.1 2.8v3.4L14.8 12 10.9 9.8z"
              fill="currentColor"
            />
          </svg>
        </button>
      ) : null}
      {frames.length > 1 || stripVideoThenCta ? (
        <div className="promo-banner-playback" role="group" aria-label="Promo animation">
          <button
            type="button"
            className={`promo-banner-playback-btn${isPlaying ? " is-active" : ""}`}
            aria-label="Start promo animation"
            title="Start animation"
            aria-pressed={isPlaying}
            onPointerDown={handleReplayPointerDown}
            onClick={handleStartClick}
            onKeyDown={(event) => handlePlaybackKeyDown(event, "start")}
          >
            Start
          </button>
          <button
            type="button"
            className={`promo-banner-playback-btn${isPlaying ? "" : " is-active"}`}
            aria-label="Stop promo animation"
            title="Stop animation"
            aria-pressed={!isPlaying}
            onPointerDown={handleReplayPointerDown}
            onClick={handleStopClick}
            onKeyDown={(event) => handlePlaybackKeyDown(event, "stop")}
          >
            Stop
          </button>
        </div>
      ) : null}
    </div>
  );
}
