"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import type { PromoBanner } from "../../lib/promo-types";
import { normalizePromoStripFields, promoStripUsesCarousel, stripBackgroundIsVideo } from "../../lib/promo-strip-utils";
import {
  readPromoStripVideoPaused,
  writePromoStripVideoPaused,
} from "../../lib/promo-strip-video-session";
import { PromoStripBackgroundCarousel } from "./PromoStripBackgroundCarousel";

type PromoStripBackgroundMediaProps = {
  banner: Partial<PromoBanner>;
  autoPlay?: boolean;
  loop?: boolean;
  onEnded?: () => void;
  videoRef?: Ref<HTMLVideoElement>;
  className?: string;
  ended?: boolean;
  onReplay?: () => void;
  onPlaybackChange?: (playing: boolean) => void;
  /** Keep pause/play state while switching admin preview modes, never on the public page. */
  rememberPlayback?: boolean;
};

export function PromoStripBackgroundMedia({
  banner,
  autoPlay = true,
  loop,
  onEnded,
  videoRef,
  className = "",
  ended,
  onReplay,
  onPlaybackChange,
  rememberPlayback = false,
}: PromoStripBackgroundMediaProps) {
  const strip = normalizePromoStripFields(banner);
  const [internalEnded, setInternalEnded] = useState(false);
  const [internalReady, setInternalReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const internalVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoUrl = strip.stripBackgroundImageUrl;
  const bannerId = typeof banner.id === "string" ? banner.id : "";
  const keepPaused = rememberPlayback && readPromoStripVideoPaused(bannerId, videoUrl);
  const isVideo = stripBackgroundIsVideo(banner);

  useEffect(() => {
    setInternalEnded(false);
    setInternalReady(false);
    setIsPlaying(false);
  }, [videoUrl]);

  useEffect(() => {
    const video = internalVideoRef.current;
    if (!video || !autoPlay || keepPaused || !videoUrl || !isVideo) {
      return undefined;
    }

    let cancelled = false;
    let retryTimer: number | null = null;
    let attempts = 0;

    const startVideo = async () => {
      if (cancelled) return;
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      try {
        await video.play();
      } catch {
        attempts += 1;
        if (!cancelled && attempts < 5) {
          retryTimer = window.setTimeout(() => void startVideo(), attempts * 250);
        }
      }
    };

    const handleReady = () => void startVideo();
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      void startVideo();
    } else {
      video.addEventListener("loadeddata", handleReady, { once: true });
      video.addEventListener("canplay", handleReady, { once: true });
    }

    return () => {
      cancelled = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      video.removeEventListener("loadeddata", handleReady);
      video.removeEventListener("canplay", handleReady);
    };
  }, [autoPlay, isVideo, keepPaused, videoUrl]);

  if (promoStripUsesCarousel(banner)) {
    return <PromoStripBackgroundCarousel banner={banner} />;
  }

  if (!isVideo || !strip.stripBackgroundImageUrl) {
    return null;
  }

  const showFallback = (ended ?? internalEnded) && Boolean(strip.stripBackgroundFallbackImageUrl);
  const togglePlayback = async () => {
    const video = internalVideoRef.current;
    if (!video) return;
    if (!video.paused && !video.ended) {
      if (rememberPlayback) writePromoStripVideoPaused(bannerId, videoUrl, true);
      onPlaybackChange?.(false);
      video.pause();
      return;
    }
    if (rememberPlayback) writePromoStripVideoPaused(bannerId, videoUrl, false);
    onPlaybackChange?.(true);
    if (ended || internalEnded || video.ended) {
      if (onReplay) {
        onReplay();
        return;
      }
      setInternalEnded(false);
      try { video.currentTime = 0; } catch { /* metadata may still be loading */ }
    }
    try { await video.play(); } catch { setIsPlaying(false); }
  };

  return (
    <>
      <div
        className={`promo-strip-bg-media${internalReady ? " is-strip-video-ready" : ""}${className ? ` ${className}` : ""}`.trim()}
        aria-hidden
      >
        <video
          ref={(node) => {
            internalVideoRef.current = node;
            if (typeof videoRef === "function") videoRef(node);
            else if (videoRef) (videoRef as { current: HTMLVideoElement | null }).current = node;
          }}
          className="promo-strip-bg-media-video"
          src={strip.stripBackgroundImageUrl}
          autoPlay={autoPlay && !keepPaused}
          muted
          loop={loop ?? strip.stripBackgroundVideoLoop}
          playsInline
          preload="auto"
          onLoadedData={() => setInternalReady(true)}
          onCanPlay={() => setInternalReady(true)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            setInternalEnded(true);
            onEnded?.();
          }}
        />
        {showFallback ? (
          <img
            className="promo-strip-bg-fallback"
            src={strip.stripBackgroundFallbackImageUrl}
            alt=""
          />
        ) : null}
      </div>
      <button
        type="button"
        className="promo-strip-video-toggle"
        aria-label={isPlaying ? "Pause promo video" : "Play promo video"}
        title={isPlaying ? "Pause video" : "Play video"}
        aria-pressed={isPlaying}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void togglePlayback();
        }}
      >
        <span aria-hidden>{isPlaying ? "Ⅱ" : "▶"}</span>
        {isPlaying ? "Pause" : "Play"}
      </button>
    </>
  );
}
