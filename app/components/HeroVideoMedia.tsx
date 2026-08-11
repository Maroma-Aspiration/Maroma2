"use client";

import { useEffect, useId, useRef, type CSSProperties } from "react";
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
  /** Fired when a non-looping YouTube/native video ends. */
  onEnded?: () => void;
};

export function HeroVideoMedia({
  src,
  poster = "",
  objectFit = "cover",
  variant = "frame",
  loop = true,
  onEnded,
}: HeroVideoMediaProps) {
  const youTubeId = isYouTubeUrl(src) ? parseYouTubeVideoId(src) : null;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const iframeDomId = useId().replace(/:/g, "");
  const wrapClass =
    variant === "background" ? "hero-youtube-wrap hero-youtube-wrap--background" : "hero-youtube-wrap";

  useEffect(() => {
    if (!youTubeId || loop || !onEndedRef.current) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    let cancelled = false;
    let player: { destroy?: () => void } | null = null;

    void bindYouTubePlayer(iframe, {
      onEnded: () => {
        if (!cancelled) onEndedRef.current?.();
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
    return (
      <div
        className={wrapClass}
        style={embedPoster ? { backgroundImage: `url(${embedPoster})` } : undefined}
        aria-hidden="true"
      >
        <iframe
          ref={iframeRef}
          id={`maroma-hero-yt-${iframeDomId}`}
          className="hero-youtube-embed"
          src={youTubeHeroEmbedUrl(youTubeId, {
            loop,
            enableJsApi: !loop,
            origin,
          })}
          title=""
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }

  if (src) {
    return (
      <video
        className="hero-video"
        autoPlay
        muted
        loop={loop}
        playsInline
        poster={poster}
        style={{ objectFit }}
        onEnded={() => {
          if (!loop) onEnded?.();
        }}
      >
        <source src={src} />
      </video>
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
