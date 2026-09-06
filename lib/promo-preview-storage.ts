import type { PromoBanner } from "./promo-types";

export const PROMO_PREVIEW_STORAGE_KEY = "maroma:promo-admin-preview";
export const PROMO_PREVIEW_MESSAGE = "maroma:promo-preview-update";
export const PROMO_PREVIEW_PLAY = "maroma:promo-preview-play";
export const PROMO_PREVIEW_STOP = "maroma:promo-preview-stop";
export const PROMO_PREVIEW_STATUS = "maroma:promo-preview-status";

export type PromoPreviewPayload = {
  banners: PromoBanner[];
  updatedAt: number;
  marqueePreviewMode?: "start" | "end";
};

export function writePromoPreviewPayload(
  banners: PromoBanner[],
  extras?: Pick<PromoPreviewPayload, "marqueePreviewMode">
): void {
  if (typeof window === "undefined") return;
  const payload: PromoPreviewPayload = {
    banners,
    updatedAt: Date.now(),
    marqueePreviewMode: extras?.marqueePreviewMode,
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

export function notifyPromoPreviewUpdate(
  target: Window | null | undefined,
  banners?: PromoBanner[]
) {
  target?.postMessage(
    {
      type: PROMO_PREVIEW_MESSAGE,
      banners: banners?.length ? banners : undefined,
    },
    window.location.origin
  );
}

export function notifyPromoPreviewPlayback(
  target: Window | null | undefined,
  action: "play" | "stop"
) {
  target?.postMessage(
    { type: action === "play" ? PROMO_PREVIEW_PLAY : PROMO_PREVIEW_STOP },
    window.location.origin
  );
}
