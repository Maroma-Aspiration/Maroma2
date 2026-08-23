"use client";

import { useEffect, useState, type PointerEventHandler, type RefObject } from "react";
import type { PromoBanner } from "../../lib/promo-types";
import { promoStripStyleVars } from "../../lib/promo-strip-utils";
import { PromoBannerCard } from "./PromoBannerCard";

type PromoBannerStripProps = {
  initialBanners?: PromoBanner[];
  className?: string;
  /** When false, banners render as non-links (admin drag/preview). */
  linkable?: boolean;
  variant?: "default" | "hero";
  /** Hold hero marquee at start position while editing offsets. */
  marqueePreviewStart?: boolean;
};

export function PromoBannerStrip({
  initialBanners = [],
  className = "",
  linkable = true,
  variant = "default",
  marqueePreviewStart = false,
}: PromoBannerStripProps) {
  const [banners, setBanners] = useState(initialBanners);

  useEffect(() => {
    setBanners(initialBanners);
  }, [initialBanners]);

  useEffect(() => {
    if (initialBanners.length > 0) {
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
  }, [initialBanners.length]);

  if (banners.length === 0) return null;

  return (
    <div className={`promo-banner-stack${className ? ` ${className}` : ""}`}>
      {banners.map((banner) => (
        <PromoBannerCard
          key={banner.id}
          banner={banner}
          linkable={linkable}
          variant={variant}
          marqueePreviewStart={marqueePreviewStart}
        />
      ))}
    </div>
  );
}

type HeroPromoBannerProps = {
  initialBanners?: PromoBanner[];
  editable?: boolean;
  bannerRef?: RefObject<HTMLDivElement>;
  onPointerDown?: PointerEventHandler<HTMLDivElement>;
  onPointerMove?: PointerEventHandler<HTMLDivElement>;
  onPointerUp?: PointerEventHandler<HTMLDivElement>;
};

export function HeroPromoBanner({
  initialBanners = [],
  editable = false,
  bannerRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: HeroPromoBannerProps) {
  const stripStyle =
    initialBanners.length > 0 ? promoStripStyleVars(initialBanners[0]) : undefined;

  return (
    <div
      ref={bannerRef}
      className={`hero-promo-banner${editable ? " hero-promo-drag" : ""}`}
      aria-label="Homepage announcement"
      style={stripStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <PromoBannerStrip
        initialBanners={initialBanners}
        linkable={!editable}
        variant="hero"
        marqueePreviewStart={editable}
      />
    </div>
  );
}
