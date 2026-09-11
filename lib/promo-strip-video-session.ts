const PREFIX = "maroma:promo-strip-video-seen:";
const PLAYBACK_PREFIX = "maroma:promo-strip-video-playback:";

declare global {
  interface Window {
    __maromaPromoVideoSeen?: Set<string>;
  }
}

export function promoStripVideoSessionKey(bannerId: string, videoUrl: string): string {
  return `${PREFIX}${bannerId}:${videoUrl}`;
}

export function readPromoStripVideoSeen(bannerId: string, videoUrl: string): boolean {
  if (typeof window === "undefined" || !bannerId || !videoUrl) return false;
  return window.__maromaPromoVideoSeen?.has(promoStripVideoSessionKey(bannerId, videoUrl)) ?? false;
}

export function writePromoStripVideoSeen(bannerId: string, videoUrl: string): void {
  if (typeof window === "undefined" || !bannerId || !videoUrl) return;
  const seen = window.__maromaPromoVideoSeen ?? new Set<string>();
  seen.add(promoStripVideoSessionKey(bannerId, videoUrl));
  window.__maromaPromoVideoSeen = seen;
}

export function readPromoStripVideoPaused(bannerId: string, videoUrl: string): boolean {
  if (typeof window === "undefined" || !bannerId || !videoUrl) return false;
  try {
    return window.sessionStorage.getItem(`${PLAYBACK_PREFIX}${bannerId}:${videoUrl}`) === "paused";
  } catch {
    return false;
  }
}

export function writePromoStripVideoPaused(
  bannerId: string,
  videoUrl: string,
  paused: boolean
): void {
  if (typeof window === "undefined" || !bannerId || !videoUrl) return;
  try {
    window.sessionStorage.setItem(
      `${PLAYBACK_PREFIX}${bannerId}:${videoUrl}`,
      paused ? "paused" : "playing"
    );
  } catch {
    /* Playback still works when browser storage is unavailable. */
  }
}
