import type { CSSProperties } from "react";

/** Cross-browser layer nudge — use transform, not the translate property. */
export function heroLayerTransform(x: number, y: number): { transform: string } {
  return { transform: `translate(${x}px, ${y}px)` };
}

/** For elements whose transform is owned by CSS (scroll-zoom reset rules). */
export function heroNudgeStyle(x: number, y: number): CSSProperties {
  return {
    ["--hero-nudge-x" as string]: `${x}px`,
    ["--hero-nudge-y" as string]: `${y}px`
  };
}

/** Convert stored copy offset (cm/px string) to px using the active browser's cm unit. */
export function heroCopyOffsetToPx(raw: string): number {
  const trimmed = raw.trim();
  const cmMatch = /^(-?[\d.]+)cm$/i.exec(trimmed);
  if (cmMatch) {
    if (typeof document === "undefined") {
      return Math.round(parseFloat(cmMatch[1]) * 37.7952755906);
    }
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;height:1cm;width:0;pointer-events:none;";
    document.documentElement.appendChild(probe);
    const cmPx = probe.offsetHeight || 37.7952755906;
    document.documentElement.removeChild(probe);
    return Math.round(parseFloat(cmMatch[1]) * cmPx);
  }
  const pxMatch = /^(-?[\d.]+)px$/i.exec(trimmed);
  if (pxMatch) {
    return Math.round(parseFloat(pxMatch[1]));
  }
  return 0;
}
