"use client";

import { useEffect } from "react";

export function ProductPdpScrollLock() {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.classList.add("product-pdp-scroll-lock");
    body.classList.add("product-pdp-scroll-lock");

    return () => {
      root.classList.remove("product-pdp-scroll-lock");
      body.classList.remove("product-pdp-scroll-lock");
    };
  }, []);

  return null;
}
