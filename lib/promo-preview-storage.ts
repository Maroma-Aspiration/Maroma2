import type { PromoBanner } from "./promo-types";

export const PROMO_PREVIEW_STORAGE_KEY = "maroma:promo-admin-preview";
export const PROMO_PREVIEW_MESSAGE = "maroma:promo-preview-update";

export type PromoPreviewPayload = {
  banners: PromoBanner[];
  updatedAt: number;
};

export function writePromoPreviewPayload(banners: PromoBanner[]): void {
  if (typeof window === "undefined") return;
  const payload: PromoPreviewPayload = {
    banners,
    updatedAt: Date.now(),
  };
  sessionStorage.setItem(PROMO_PREVIEW_STORAGE_KEY, JSON.stringify(payload));
}

export function readPromoPreviewPayload(): PromoPreviewPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PROMO_PREVIEW_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PromoPreviewPayload;
    if (!parsed || !Array.isArray(parsed.banners)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function notifyPromoPreviewUpdate(target: Window | null | undefined) {
  target?.postMessage({ type: PROMO_PREVIEW_MESSAGE }, window.location.origin);
}
