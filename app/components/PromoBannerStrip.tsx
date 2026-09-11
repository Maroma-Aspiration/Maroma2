"use client";

import { useEffect, useState, type PointerEventHandler, type RefObject } from "react";
import type { PromoBanner } from "../../lib/promo-types";
import { promoStripStyleVars } from "../../lib/promo-strip-utils";
import { PromoBannerCard } from "./PromoBannerCard";

// Survives client-side navigation, but resets on a fresh document load.
let promoEntranceSeen = false;

type PromoBannerStripProps = {
  initialBanners?: PromoBanner[];
  /** Allow standalone strips to hydrate themselves when no banners are supplied. */
  fetchWhenEmpty?: boolean;
  className?: string;
  /** When false, banners render as non-links (admin drag/preview). */
  linkable?: boolean;
  variant?: "default" | "hero";
  /** Hold hero marquee at start or end position while editing offsets. */
  /** Hold playback on frame 0 until Start (homepage preview iframe). */
  startHeld?: boolean;
  /** Hold marquee at start/end while editing offsets in admin. */
  marqueePreviewStart?: boolean;
  marqueePreviewMode?: "start" | "end";
  ctaDraggable?: boolean;
  thumbnailsDraggable?: boolean;
  onCtaPositionChange?: (position: { x: number; y: number }) => void;
  onThumbnailsPositionChange?: (position: { x: number; y: number }) => void;
  mediaEditable?: boolean;
  onMediaLayoutChange?: (patch: Partial<PromoBanner>) => void;
};

export function PromoBannerStrip({
  initialBanners = [],
  fetchWhenEmpty = true,
  className = "",
  linkable = true,
  variant = "default",
  startHeld = false,
  marqueePreviewStart = false,
  marqueePreviewMode = "start",
  ctaDraggable = false,
  thumbnailsDraggable = false,
  onCtaPositionChange,
  onThumbnailsPositionChange,
  mediaEditable = false,
  onMediaLayoutChange,
}: PromoBannerStripProps) {
  const [banners, setBanners] = useState(initialBanners);

  useEffect(() => {
    setBanners(initialBanners);
  }, [initialBanners]);

  useEffect(() => {
    if (!fetchWhenEmpty || initialBanners.length > 0) {
      return;
    }
    let cancelled = false;
    void fetch("/api/promos", { cache: "no-store", credentials: "same-origin" })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as { banners?: PromoBanner[] };
      })
      .then((data) => {
        if (!cancelled && data?.banners) setBanners(data.banners);
      })
      .catch(() => {
        /* keep server-rendered banners */
      });
    return () => {
      cancelled = true;
    };
  }, [fetchWhenEmpty, initialBanners.length]);

  if (banners.length === 0) return null;

  return (
    <div className={`promo-banner-stack${className ? ` ${className}` : ""}`}>
      {banners.map((banner) => (
        <PromoBannerCard
          key={banner.id}
          banner={banner}
          linkable={linkable}
          variant={variant}
          startHeld={startHeld}
          marqueePreviewStart={marqueePreviewStart}
          marqueePreviewMode={marqueePreviewMode}
          rememberStripVideoSeen={linkable && variant === "hero"}
          ctaDraggable={ctaDraggable}
          thumbnailsDraggable={thumbnailsDraggable}
          onCtaPositionChange={onCtaPositionChange}
          onThumbnailsPositionChange={onThumbnailsPositionChange}
          mediaEditable={mediaEditable}
          onMediaLayoutChange={onMediaLayoutChange}
        />
      ))}
    </div>
  );
}

type HeroPromoBannerProps = {
  entranceReady?: boolean;
  initialBanners?: PromoBanner[];
  editable?: boolean;
  bannerRef?: RefObject<HTMLDivElement>;
  onPointerDown?: PointerEventHandler<HTMLDivElement>;
  onPointerMove?: PointerEventHandler<HTMLDivElement>;
  onPointerUp?: PointerEventHandler<HTMLDivElement>;
  marqueePreviewMode?: "start" | "end";
  holdMarquee?: boolean;
  ctaDraggable?: boolean;
  thumbnailsDraggable?: boolean;
  onCtaPositionChange?: (position: { x: number; y: number }) => void;
  onThumbnailsPositionChange?: (position: { x: number; y: number }) => void;
  mediaEditable?: boolean;
  onMediaLayoutChange?: (patch: Partial<PromoBanner>) => void;
};

export function HeroPromoBanner({
  entranceReady = true,
  initialBanners = [],
  editable = false,
  bannerRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  marqueePreviewMode = "start",
  holdMarquee = false,
  ctaDraggable = false,
  thumbnailsDraggable = false,
  onCtaPositionChange,
  onThumbnailsPositionChange,
  mediaEditable = false,
  onMediaLayoutChange,
}: HeroPromoBannerProps) {
  const [playEntrance, setPlayEntrance] = useState(false);
  const [entrancePending, setEntrancePending] = useState(() => !promoEntranceSeen);
  const hasBanner = initialBanners.length > 0;
  useEffect(() => {
    if (editable || mediaEditable) {
      setPlayEntrance(false);
      setEntrancePending(false);
      return;
    }
    if (promoEntranceSeen) {
      setEntrancePending(false);
      return;
    }
    if (!entranceReady || !hasBanner) return;
    promoEntranceSeen = true;
    setEntrancePending(false);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPlayEntrance(true);
    }
  }, [entranceReady, hasBanner, editable, mediaEditable]);
  const stripStyle =
    initialBanners.length > 0 ? promoStripStyleVars(initialBanners[0]) : undefined;

  return (
    <div
      ref={bannerRef}
      className={`hero-promo-banner${editable ? " hero-promo-drag" : ""}${mediaEditable ? " is-promo-content-editing" : ""}`}
      aria-label="Homepage announcement"
      style={stripStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <PromoBannerStrip
        className={!editable && !mediaEditable ? (playEntrance ? undefined : entrancePending ? "promo-elements-pending" : "promo-elements-finished") : undefined}
        initialBanners={initialBanners}
        fetchWhenEmpty={false}
        linkable={!editable}
        variant="hero"
        startHeld={holdMarquee}
        marqueePreviewStart={editable}
        marqueePreviewMode={marqueePreviewMode}
        ctaDraggable={ctaDraggable}
        thumbnailsDraggable={thumbnailsDraggable}
        onCtaPositionChange={onCtaPositionChange}
        onThumbnailsPositionChange={onThumbnailsPositionChange}
        mediaEditable={mediaEditable}
        onMediaLayoutChange={onMediaLayoutChange}
      />
    </div>
  );
}
