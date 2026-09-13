"use client";

import { useEffect } from "react";

function isDesktopPin(): boolean {
  if (typeof window === "undefined") return false;
  if (document.documentElement.hasAttribute("data-maroma-viewport-mobile")) return false;
  return window.matchMedia("(min-width: 901px)").matches;
}

export function ProductPdpPinnedStage() {
  useEffect(() => {
    const layout = document.querySelector<HTMLElement>(".product-pdp-layout");
    const details = document.querySelector<HTMLElement>(".product-pdp-details-column");
    if (!layout || !details) return;

    const onWheel = (event: WheelEvent) => {
      if (!isDesktopPin()) return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

      const atTop = details.scrollTop <= 0;
      const atBottom = details.scrollTop + details.clientHeight >= details.scrollHeight - 1;
      const intoDetails = (event.deltaY > 0 && !atBottom) || (event.deltaY < 0 && !atTop);

      event.preventDefault();
      if (intoDetails) {
        details.scrollTop += event.deltaY;
        return;
      }
      window.scrollBy(0, event.deltaY);
    };

    layout.addEventListener("wheel", onWheel, { passive: false });
    return () => layout.removeEventListener("wheel", onWheel);
  }, []);

  return null;
}
