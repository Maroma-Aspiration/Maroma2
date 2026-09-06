import type { PromoBanner, PromoFrame, PromoPresentation, PromoSequenceTransition } from "./promo-types";
import { normalizeCtaBuyLinks } from "./promo-buy-links-utils";
import { normalizePromoStripFields } from "./promo-strip-utils";

export function isPromoLiveClient(
  banner: Pick<PromoBanner, "active" | "startsAt" | "endsAt">,
  now = new Date()
): boolean {
  if (!banner.active) return false;
  if (banner.startsAt) {
    const start = new Date(banner.startsAt);
    if (!Number.isNaN(start.getTime()) && now < start) return false;
  }
  if (banner.endsAt) {
    const end = new Date(banner.endsAt);
    if (!Number.isNaN(end.getTime()) && now > end) return false;
  }
  return true;
}

/** datetime-local input value from ISO or stored string. */
export function toDatetimeLocalValue(value: string): string {
  if (!value.trim()) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.length >= 16 ? value.slice(0, 16) : value;
  }
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Store schedule as ISO for consistent server-side checks. */
export function toIsoScheduleValue(value: string): string {
  if (!value.trim()) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.trim() : date.toISOString();
}

export function formatScheduleLabel(startsAt: string, endsAt: string): string {
  if (!startsAt && !endsAt) return "Always on (no schedule)";
  const fmt = (raw: string) => {
    if (!raw) return "open";
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? raw : date.toLocaleString();
  };
  return `${fmt(startsAt)} to ${fmt(endsAt)}`;
}

export type PromoVisibilityStatus = "live" | "scheduled" | "expired" | "inactive" | "draft";

export function promoVisibilityStatus(
  banner: Pick<PromoBanner, "active" | "startsAt" | "endsAt">,
  now = new Date()
): PromoVisibilityStatus {
  if (!banner.active) return "inactive";
  if (banner.startsAt) {
    const start = new Date(banner.startsAt);
    if (!Number.isNaN(start.getTime()) && now < start) return "scheduled";
  }
  if (banner.endsAt) {
    const end = new Date(banner.endsAt);
    if (!Number.isNaN(end.getTime()) && now > end) return "expired";
  }
  return "live";
}

/** Label for admin banner lists (prefers adminName over strip headline). */
export function resolvePromoAdminName(
  banner: Pick<PromoBanner, "adminName" | "title">
): string {
  const adminName = typeof banner.adminName === "string" ? banner.adminName.trim() : "";
  if (adminName) return adminName.slice(0, 80);
  const title = typeof banner.title === "string" ? banner.title.trim() : "";
  if (title) return title.slice(0, 80);
  return "Untitled banner";
}

export function buildPreviewBannerStack(
  savedBanners: PromoBanner[],
  draft: Pick<
    PromoBanner,
    | "adminName"
    | "title"
    | "body"
    | "mediaUrl"
    | "mediaKind"
    | "animation"
    | "ctaLabel"
    | "ctaHref"
    | "ctaBuyLinks"
    | "presentation"
    | "sequenceTransition"
    | "sequenceFadeDurationMs"
    | "sequenceLoop"
    | "frames"
    | "startsAt"
    | "endsAt"
    | "active"
    | "promoModeEnabled"
    | "stripBackground"
    | "stripBackgroundImageUrl"
    | "stripBackgroundMediaKind"
    | "stripBackgroundVideoLoop"
    | "stripBackgroundImageScale"
    | "stripBackgroundImageOffsetX"
    | "stripBackgroundImageOffsetY"
    | "stripHeightPx"
    | "stripPositionOffsetCm"
    | "stripPositionOffsetPx"
    | "stripAspectRatio"
    | "stripOpacity"
    | "mediaOffsetXCm"
    | "marqueeForceScroll"
    | "heroMarqueeStartOffsetCm"
    | "heroMarqueeStartOffsetPx"
    | "heroMarqueeEndOffsetCm"
    | "heroMarqueeEndOffsetPx"
  >,
  editingId: string | null
): PromoBanner[] {
  const draftBanner: PromoBanner = {
    id: editingId ?? "__draft__",
    adminName: draft.adminName?.trim() || resolvePromoAdminName(draft),
    title: draft.title.trim(),
    body: draft.body.trim(),
    mediaUrl: draft.mediaUrl,
    mediaKind: draft.mediaKind,
    animation: draft.animation,
    presentation: draft.presentation,
    sequenceTransition: draft.sequenceTransition,
    sequenceFadeDurationMs: draft.sequenceFadeDurationMs,
    sequenceLoop: draft.sequenceLoop,
    frames: draft.frames,
    ctaLabel: draft.ctaLabel.trim(),
    ctaHref: draft.ctaHref.trim(),
    ctaBuyLinks: normalizeCtaBuyLinks(draft.ctaBuyLinks),
    ...normalizePromoStripFields(draft),
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    active: draft.active,
    promoModeEnabled: draft.promoModeEnabled,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Admin editor always previews the in-progress banner alone, including when inactive,
  // so strip background and layout edits are visible before publish.
  return [draftBanner];
}
