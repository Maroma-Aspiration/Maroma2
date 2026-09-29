"use client";

import { useEffect, useMemo, useState } from "react";
import type { PromoBanner } from "../../lib/promo-types";
import {
  normalizePromoStripFields,
  promoStripCarouselUrls,
  promoStripUsesCarousel,
} from "../../lib/promo-strip-utils";

type PromoStripBackgroundCarouselProps = {
  banner: Partial<PromoBanner>;
};

export function PromoStripBackgroundCarousel({ banner }: PromoStripBackgroundCarouselProps) {
  const strip = normalizePromoStripFields(banner);
  const urlKey = promoStripCarouselUrls(strip).join("|");
  const urls = useMemo(() => (urlKey ? urlKey.split("|") : []), [urlKey]);
  const [current, setCurrent] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const canRotate = promoStripUsesCarousel(strip) && urls.length >= 2;
  const intervalMs = strip.stripBackgroundCarouselIntervalMs;
  const fadeMs = strip.stripBackgroundCarouselFadeMs;

  useEffect(() => {
    setCurrent(0);
    setPrevious(null);
  }, [urlKey]);

  useEffect(() => {
    if (!canRotate) return undefined;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let fadeId = 0;

    const advance = () => {
      if (document.visibilityState === "hidden") return;
      setCurrent((index) => {
        const next = (index + 1) % urls.length;
        if (reducedMotion.matches) return next;
        setPrevious(index);
        window.clearTimeout(fadeId);
        fadeId = window.setTimeout(() => setPrevious(null), fadeMs);
        return next;
      });
    };

    const intervalId = window.setInterval(advance, intervalMs);
    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(fadeId);
    };
  }, [canRotate, fadeMs, intervalMs, urls.length]);

  if (!canRotate) return null;

  return (
    <div className="promo-strip-bg-media promo-strip-bg-carousel" aria-hidden>
      {urls.map((url, index) => {
        const isCurrent = index === current;
        const isPrevious = index === previous;
        return (
          <img
            key={url}
            src={url}
            alt=""
            className={`promo-strip-bg-carousel-slide${isCurrent ? " is-active" : ""}${
              isPrevious ? " is-previous" : ""
            }`}
          />
        );
      })}
    </div>
  );
}
