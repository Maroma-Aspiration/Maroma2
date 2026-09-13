"use client";

import { useEffect } from "react";

function shouldLockProductScroll(): boolean {
  if (typeof window === "undefined") return false;
  if (document.documentElement.hasAttribute("data-maroma-viewport-mobile")) return false;
  return window.matchMedia("(min-width: 901px)").matches;
}

export function ProductPdpScrollLock() {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const desktop = window.matchMedia("(min-width: 901px)");

    const sync = () => {
      const on = shouldLockProductScroll();
      root.classList.toggle("product-pdp-scroll-lock", on);
      body.classList.toggle("product-pdp-scroll-lock", on);
    };

    sync();
    desktop.addEventListener("change", sync);
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-maroma-viewport-mobile"] });

    return () => {
      desktop.removeEventListener("change", sync);
      observer.disconnect();
      root.classList.remove("product-pdp-scroll-lock");
      body.classList.remove("product-pdp-scroll-lock");
    };
  }, []);

  return null;
}
