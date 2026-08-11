"use client";

import { useLayoutEffect } from "react";
import {
  MAROMA_MOBILE_MAX_WIDTH_PX,
  syncMaromaViewportRootClasses,
} from "../../lib/mobile-viewport";

/** Sets viewport hint on <html> before paint (nav carousel CSS). Homepage layout is driven by React. */
export function ViewportRootSync() {
  useLayoutEffect(() => {
    syncMaromaViewportRootClasses();
    const media = window.matchMedia(`(max-width: ${MAROMA_MOBILE_MAX_WIDTH_PX}px)`);
    const onChange = () => syncMaromaViewportRootClasses();
    media.addEventListener("change", onChange);
    const observer = new MutationObserver(onChange);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => {
      media.removeEventListener("change", onChange);
      observer.disconnect();
    };
  }, []);

  return null;
}
