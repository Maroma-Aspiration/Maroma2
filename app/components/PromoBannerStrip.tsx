"use client";

import { useEffect, useState } from "react";
import type { PromoBanner } from "../../lib/promo-types";

export function PromoBannerStrip() {
  const [banners, setBanners] = useState<PromoBanner[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/promos", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { banners?: PromoBanner[] }) => {
        if (!cancelled) setBanners(data.banners ?? []);
      })
      .catch(() => {
        if (!cancelled) setBanners([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (banners.length === 0) return null;

  return (
    <div className="promo-banner-stack">
      {banners.map((banner) => {
        const inner = (
          <>
            {banner.mediaKind === "image" && banner.mediaUrl ? (
              <img src={banner.mediaUrl} alt="" className="promo-banner-media" />
            ) : null}
            {banner.mediaKind === "video" && banner.mediaUrl ? (
              <video className="promo-banner-media" src={banner.mediaUrl} autoPlay muted loop playsInline />
            ) : null}
            <div className="promo-banner-copy">
              <strong>{banner.title}</strong>
              {banner.body ? <span>{banner.body}</span> : null}
              {banner.ctaLabel ? <em>{banner.ctaLabel}</em> : null}
            </div>
          </>
        );
        const className = `promo-banner promo-banner--${banner.animation}`;
        if (banner.ctaHref) {
          return (
            <a key={banner.id} className={className} href={banner.ctaHref}>
              {inner}
            </a>
          );
        }
        return (
          <div key={banner.id} className={className}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
