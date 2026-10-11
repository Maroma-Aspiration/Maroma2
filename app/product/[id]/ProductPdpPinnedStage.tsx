"use client";

import { useEffect } from "react";

function isDesktopPin(): boolean {
  if (typeof window === "undefined") return false;
  if (document.documentElement.hasAttribute("data-maroma-viewport-mobile")) return false;
  return window.matchMedia("(min-width: 901px)").matches;
}

function canScroll(el: HTMLElement, deltaY: number): boolean {
  if (el.scrollHeight <= el.clientHeight + 1) return false;
  const atTop = el.scrollTop <= 0;
  const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
  return (deltaY > 0 && !atBottom) || (deltaY < 0 && !atTop);
}

export function ProductPdpPinnedStage() {
  useEffect(() => {
    const layout = document.querySelector<HTMLElement>(".product-pdp-layout");
    const details = document.querySelector<HTMLElement>(".product-pdp-details-column");
    const gallery = document.querySelector<HTMLElement>(".product-pdp-left-column");
    if (!layout || !details) return;

    const onWheel = (event: WheelEvent) => {
      if (!isDesktopPin()) return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

      const target = event.target;
      if (!(target instanceof Node)) return;

      if (gallery?.contains(target)) {
        const thumbs = target instanceof Element ? target.closest(".product-pdp-thumbs") : null;
        if (thumbs instanceof HTMLElement && canScroll(thumbs, event.deltaY)) {
          return;
        }
        event.preventDefault();
        gallery.dispatchEvent(
          new CustomEvent("maroma-pdp-gallery-wheel", { detail: { deltaY: event.deltaY } })
        );
        return;
      }

      if (details.contains(target)) {
        const scroller = details.querySelector<HTMLElement>(".product-pdp-info") ?? details;
        const nested = target instanceof Element ? target.closest("textarea, select, .product-pdp-thumbs") : null;
        if (nested instanceof HTMLElement && nested !== scroller && canScroll(nested, event.deltaY)) {
          return;
        }
        if (canScroll(scroller, event.deltaY)) {
          event.preventDefault();
          scroller.scrollTop += event.deltaY;
        }
        return;
      }

      event.preventDefault();
      window.scrollBy(0, event.deltaY);
    };

    layout.addEventListener("wheel", onWheel, { passive: false });
    return () => layout.removeEventListener("wheel", onWheel);
  }, []);

  return null;
}
