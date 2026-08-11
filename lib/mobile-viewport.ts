/** Phone/tablet portrait — desktop layout applies above this width (unless touch-primary). */
export const MAROMA_MOBILE_MAX_WIDTH_PX = 900;

/** Touch-only phones (incl. Chrome "Desktop site" with ~980px layout viewport). */
export function isTouchPrimaryDevice(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}

/** Viewport width only — no admin preview body class. */
export function getMaromaNarrowViewportMatches(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia(`(max-width: ${MAROMA_MOBILE_MAX_WIDTH_PX}px)`).matches;
}

/** Narrow viewport, touch-primary device, or admin phone preview frame. */
export function getMaromaMobileViewportMatches(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (getMaromaNarrowViewportMatches()) {
    return true;
  }
  if (isTouchPrimaryDevice()) {
    return true;
  }
  return document.body?.classList.contains("admin-mobile-preview-active") ?? false;
}

/** Mouse/trackpad desktop — not touch-primary phone. */
export function getMaromaDesktopLikePointer(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/** Real phones / touch tablets — mobile document-flow even in Chrome desktop-site mode. */
export function getMaromaForceMobileLayout(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (isTouchPrimaryDevice()) {
    return true;
  }
  if (getMaromaNarrowViewportMatches() && !getMaromaDesktopLikePointer()) {
    return true;
  }
  return false;
}

/** Server-side hint from User-Agent for hydration snapshots on the homepage. */
export function isMaromaMobileUserAgent(ua: string): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
}

function subscribeMediaQuery(query: string, onStoreChange: () => void): () => void {
  const media = window.matchMedia(query);
  const onChange = () => onStoreChange();
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function subscribeMaromaNarrowViewport(onStoreChange: () => void): () => void {
  return subscribeMediaQuery(`(max-width: ${MAROMA_MOBILE_MAX_WIDTH_PX}px)`, onStoreChange);
}

export function subscribeMaromaMobileViewport(onStoreChange: () => void): () => void {
  const unsubs = [
    subscribeMediaQuery(`(max-width: ${MAROMA_MOBILE_MAX_WIDTH_PX}px)`, onStoreChange),
    subscribeMediaQuery("(hover: none) and (pointer: coarse)", onStoreChange),
  ];
  const observer = new MutationObserver(onStoreChange);
  if (document.body) {
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }
  return () => {
    unsubs.forEach((u) => u());
    observer.disconnect();
  };
}

export function subscribeMaromaDesktopLikePointer(onStoreChange: () => void): () => void {
  return subscribeMediaQuery("(hover: hover) and (pointer: fine)", onStoreChange);
}

export function subscribeMaromaForceMobileLayout(onStoreChange: () => void): () => void {
  const unsubs = [
    subscribeMediaQuery(`(max-width: ${MAROMA_MOBILE_MAX_WIDTH_PX}px)`, onStoreChange),
    subscribeMediaQuery("(hover: none)", onStoreChange),
    subscribeMediaQuery("(pointer: coarse)", onStoreChange),
    subscribeMediaQuery("(hover: hover) and (pointer: fine)", onStoreChange),
  ];
  return () => unsubs.forEach((u) => u());
}

/** Hint on <html> for nav CSS only — homepage layout classes come from React. */
export function syncMaromaViewportRootClasses(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const isMobile = getMaromaMobileViewportMatches();
  document.documentElement.classList.toggle("maroma-viewport-mobile", isMobile);
  document.documentElement.toggleAttribute("data-maroma-viewport-mobile", isMobile);
  return isMobile;
}
