"use client";

import { useLayoutEffect, useRef } from "react";

/** Keep the complete product name within two lines at every available width. */
export function ProductPdpTitle({ children }: { children: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    const heading = ref.current;
    if (!heading) return;
    let disposed = false;
    let lastWidth = -1;
    const fit = () => {
      if (disposed || !heading.clientWidth) return;
      heading.style.removeProperty("font-size");
      const base = parseFloat(getComputedStyle(heading).fontSize);
      const fits = () => {
        const style = getComputedStyle(heading);
        const range = document.createRange();
        range.selectNodeContents(heading);
        return range.getBoundingClientRect().height <= parseFloat(style.lineHeight) * 2 + 1;
      };
      if (fits()) return;
      let low = 1;
      let high = base;
      for (let i = 0; i < 12; i++) {
        const size = (low + high) / 2;
        heading.style.fontSize = `${size}px`;
        if (fits()) low = size;
        else high = size;
      }
      heading.style.fontSize = `${Math.floor(low * 100) / 100}px`;
    };
    const observer = new ResizeObserver(() => {
      const width = heading.getBoundingClientRect().width;
      if (width === lastWidth) return;
      lastWidth = width;
      fit();
    });
    observer.observe(heading);
    window.addEventListener("resize", fit);
    document.fonts.addEventListener("loadingdone", fit);
    void document.fonts.ready.then(fit);
    fit();
    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener("resize", fit);
      document.fonts.removeEventListener("loadingdone", fit);
    };
  }, [children]);
  return (
    <div className="product-pdp-title-slot">
      <h1 ref={ref} className="product-pdp-title">{children}</h1>
    </div>
  );
}
