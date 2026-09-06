const PREFIX = "maroma:promo-strip-video-seen:";

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
