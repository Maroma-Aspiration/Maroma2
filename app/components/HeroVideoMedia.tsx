"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import {
  bindYouTubePlayer,
  isYouTubeUrl,
  parseYouTubeVideoId,
  youTubeHeroEmbedUrl,
  youTubePosterUrl,
} from "../../lib/youtube-embed";

type HeroVideoMediaProps = {
  src: string;
  poster?: string;
  objectFit?: CSSProperties["objectFit"];
  /** Full-bleed hero background (maroma.com style) vs framed media tile */
  variant?: "frame" | "background";
  /** When false, video plays once (for homepage intro). Default true. */
  loop?: boolean;
  /** When false, show the poster and do not start playback. Default true. */
  autoPlay?: boolean;
  /** Fired when a non-looping YouTube/native video ends. */
  onEnded?: () => void;
  /** Fired once playback has actually started. */
  onPlaying?: () => void;
  /** Crop as 9:16 (mobile Shorts). */
  portrait?: boolean;
};

function HeroNativeVideo({
  src,
  poster,
  objectFit,
  loop,
  autoPlay,
  onEnded,
  onPlaying,
}: {
  src: string;
  poster?: string;
  objectFit?: CSSProperties["objectFit"];
  loop: boolean;
  autoPlay: boolean;
  onEnded?: () => void;
  onPlaying?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [needsTap, setNeedsTap] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.playsInline = true;
    if (!autoPlay) {
      video.pause();
      setNeedsTap(false);
      return;
    }

    const beginPlayback = () => {
      try {
        video.currentTime = 0;
      } catch {
        /* ignore seek before metadata */
      }
      const play = video.play();
      if (play && typeof play.then === "function") {
        play.then(() => setNeedsTap(false)).catch(() => setNeedsTap(true));
      }
    };

    if (video.readyState >= 2) beginPlayback();
    else video.addEventListener("canplay", beginPlayback, { once: true });

    const timer = window.setTimeout(() => {
      if (video.paused) setNeedsTap(true);
    }, 1200);

    return () => {
      window.clearTimeout(timer);
      video.removeEventListener("canplay", beginPlayback);
    };
  }, [autoPlay, src]);

  return (
    <div className="hero-native-video-wrap">
      <video
        ref={videoRef}
        className="hero-video"
        autoPlay={autoPlay}
        muted
        loop={loop}
        playsInline
        preload="auto"
        poster={poster}
        style={{ objectFit }}
        onEnded={(event) => {
          if (loop) return;
          const video = event.currentTarget;
          if (
            Number.isFinite(video.duration) &&
            video.duration > 0 &&
            video.currentTime < Math.max(0.35, video.duration * 0.08)
          ) {
            return;
          }
          onEnded?.();
        }}
        onPlaying={() => {
          setNeedsTap(false);
          onPlaying?.();
        }}
      >
        <source src={src} />
      </video>
      {needsTap ? (
        <button
          type="button"
          className="hero-video-play"
          onClick={() => {
            const video = videoRef.current;
            if (!video) return;
            video.muted = true;
            void video.play().then(() => setNeedsTap(false)).catch(() => undefined);
          }}
        >
          Play video
        </button>
      ) : null}
    </div>
  );
}

export function HeroVideoMedia({
  src,
  poster = "",
  objectFit = "cover",
  variant = "frame",
  loop = true,
  autoPlay = true,
  onEnded,
  onPlaying,
  portrait = false,
}: HeroVideoMediaProps) {
  const youTubeId = isYouTubeUrl(src) ? parseYouTubeVideoId(src) : null;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const onEndedRef = useRef(onEnded);
  const onPlayingRef = useRef(onPlaying);
  onEndedRef.current = onEnded;
  onPlayingRef.current = onPlaying;
  const iframeDomId = useId().replace(/:/g, "");
  const wrapClass =
    variant === "background" ? "hero-youtube-wrap hero-youtube-wrap--background" : "hero-youtube-wrap";

  useEffect(() => {
    if (!youTubeId || (!onEndedRef.current && !onPlayingRef.current)) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    let cancelled = false;
    let player: { destroy?: () => void } | null = null;

    void bindYouTubePlayer(iframe, {
      onEnded: () => {
        if (!cancelled) onEndedRef.current?.();
      },
      onPlaying: () => {
        if (!cancelled) onPlayingRef.current?.();
      },
    }).then((bound) => {
      if (cancelled) {
        bound?.destroy?.();
        return;
      }
      player = bound;
    });

    return () => {
      cancelled = true;
      try {
        player?.destroy?.();
      } catch {
        // ignore
      }
    };
  }, [youTubeId, loop, src]);

  if (youTubeId) {
    const embedPoster = poster || youTubePosterUrl(youTubeId);
    const origin = typeof window !== "undefined" ? window.location.origin : undefined;
    const isShort = portrait || /\/shorts\//i.test(src);
    return (
      <div
        className={`${wrapClass}${isShort ? " hero-youtube-wrap--shorts" : ""}`}
        style={embedPoster ? { backgroundImage: `url(${embedPoster})` } : undefined}
        aria-hidden="true"
      >
        <iframe
          ref={iframeRef}
          id={`maroma-hero-yt-${iframeDomId}`}
          className="hero-youtube-embed"
          src={youTubeHeroEmbedUrl(youTubeId, {
            loop: loop && autoPlay,
            autoPlay,
            enableJsApi: !loop || Boolean(onPlaying),
            origin,
          })}
          title=""
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    );
  }

  if (src) {
    return (
      <HeroNativeVideo
        src={src}
        poster={poster}
        objectFit={objectFit}
        loop={loop}
        autoPlay={autoPlay}
        onEnded={onEnded}
        onPlaying={onPlaying}
      />
    );
  }

  return (
    <img
      className="hero-media-image"
      src={poster || "/hero-right-product.png"}
      alt=""
      aria-hidden="true"
      style={{ objectFit }}
    />
  );
}
