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

/** Shown only when a banner has neither a typed name nor any copy to borrow from. */
export const PROMO_UNNAMED_LABEL = "Untitled banner";

type PromoNameSource = Pick<PromoBanner, "adminName" | "title"> &
  Partial<Pick<PromoBanner, "body" | "ctaLabel" | "frames">>;

/** Collapse line breaks so a multi-line headline still reads as one label. */
function toNameLabel(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 80) : "";
}

/**
 * Name borrowed from the banner copy when no admin name was typed: the headline
 * first, then the headline of a sequence frame, then the tagline or CTA label.
 * Returns an empty string when there is nothing to borrow.
 */
export function derivePromoNameFromCopy(banner: PromoNameSource): string {
  const frames = Array.isArray(banner.frames) ? banner.frames : [];
  const candidates = [
    toNameLabel(banner.title),
    ...frames.map((frame) => toNameLabel(frame?.title)),
    toNameLabel(banner.body),
    ...frames.map((frame) => toNameLabel(frame?.body)),
    toNameLabel(banner.ctaLabel),
  ];
  return candidates.find((candidate) => candidate.length > 0) ?? "";
}

/** Label for admin banner lists (prefers adminName over the banner headline). */
export function resolvePromoAdminName(banner: PromoNameSource): string {
  const adminName = toNameLabel(banner.adminName);
  // Older banners stored the placeholder as their name, so treat it as unnamed.
  if (adminName && adminName !== PROMO_UNNAMED_LABEL) return adminName;
  return derivePromoNameFromCopy(banner) || PROMO_UNNAMED_LABEL;
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
    | "stripBackgroundCarouselUrls"
    | "stripBackgroundCarouselEnabled"
    | "stripBackgroundCarouselIntervalMs"
    | "stripBackgroundCarouselFadeMs"
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
