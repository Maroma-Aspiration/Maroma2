"use client";

import { useEffect, useState, type Ref } from "react";
import type { PromoBanner } from "../../lib/promo-types";
import { normalizePromoStripFields, stripBackgroundIsVideo } from "../../lib/promo-strip-utils";

type PromoStripBackgroundMediaProps = {
  banner: Partial<PromoBanner>;
  autoPlay?: boolean;
  loop?: boolean;
  onEnded?: () => void;
  videoRef?: Ref<HTMLVideoElement>;
  className?: string;
  ended?: boolean;
};

export function PromoStripBackgroundMedia({
  banner,
  autoPlay = true,
  loop,
  onEnded,
  videoRef,
  className = "",
  ended,
}: PromoStripBackgroundMediaProps) {
  const strip = normalizePromoStripFields(banner);
  const [internalEnded, setInternalEnded] = useState(false);
  const videoUrl = strip.stripBackgroundImageUrl;

  useEffect(() => {
    setInternalEnded(false);
  }, [videoUrl]);

  if (!stripBackgroundIsVideo(banner) || !strip.stripBackgroundImageUrl) {
    return null;
  }

  const showFallback = (ended ?? internalEnded) && Boolean(strip.stripBackgroundFallbackImageUrl);

  return (
    <div className={`promo-strip-bg-media${className ? ` ${className}` : ""}`.trim()} aria-hidden>
      <video
        ref={videoRef}
        className="promo-strip-bg-media-video"
        src={strip.stripBackgroundImageUrl}
        autoPlay={autoPlay}
        muted
        loop={loop ?? strip.stripBackgroundVideoLoop}
        playsInline
        preload="auto"
        onEnded={() => {
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
  );
}
