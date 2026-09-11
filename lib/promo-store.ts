import { readJsonKv, writeJsonKv } from "./json-kv-store";
import {
  buildDefaultPromoFrames,
  normalizePresentation,
  normalizePromoFrames,
  normalizeSequenceFadeDurationMs,
  normalizeSequenceTransition,
} from "./promo-sequence-utils";
import { normalizePromoStripFields } from "./promo-strip-utils";
import { normalizeCtaBuyLinks } from "./promo-buy-links-utils";
import type { PromoAnimation, PromoBanner, PromoMediaKind, PromoOverlayImage } from "./promo-types";

export type { PromoAnimation, PromoBanner, PromoMediaKind } from "./promo-types";

type PromoStore = { banners: PromoBanner[] };

const KEY = "maroma:promo-banners";
const FILE = "promo-banners.json";

const empty = (): PromoStore => ({ banners: [] });

function normalizeOverlayImages(value: unknown): PromoOverlayImage[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    const imageUrl = typeof row.imageUrl === "string" ? row.imageUrl.trim() : "";
    if (!imageUrl) return [];
    const animation = row.animation === "fade" || row.animation === "slide" || row.animation === "pulse" || row.animation === "zoom" ? row.animation : "none";
    const crop = row.crop === "square" || row.crop === "portrait" || row.crop === "landscape" ? row.crop : "none";
    return [{
      id: typeof row.id === "string" && row.id.trim() ? row.id : `overlay-${index + 1}`,
      imageUrl,
      x: Math.min(100, Math.max(0, Number(row.x) || 50)),
      y: Math.min(100, Math.max(0, Number(row.y) || 50)),
      scale: Math.min(220, Math.max(20, Number(row.scale) || 75)),
      radius: Math.min(50, Math.max(0, Number(row.radius) || 18)),
      shadow: row.shadow !== false,
      animation,
      animationDurationMs: Math.min(12000, Math.max(400, Number(row.animationDurationMs) || 2400)),
      crop,
      cropX: Math.min(100, Math.max(0, Number.isFinite(Number(row.cropX)) ? Number(row.cropX) : 50)),
      cropY: Math.min(100, Math.max(0, Number.isFinite(Number(row.cropY)) ? Number(row.cropY) : 50)),
    }];
  });
}

function parseBanner(raw: unknown): PromoBanner | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const title = typeof row.title === "string" ? row.title.trim() : "";
  const adminName = typeof row.adminName === "string" ? row.adminName.trim() : "";
  if (!id || (!title && !adminName)) return null;
  const animationRaw = row.animation;
  const animation: PromoAnimation =
    animationRaw === "fade" || animationRaw === "slide" || animationRaw === "pulse" || animationRaw === "marquee"
      ? animationRaw
      : "marquee";
  const mediaKind: PromoMediaKind =
    row.mediaKind === "image" ||
    row.mediaKind === "video" ||
    row.mediaKind === "title-media"
      ? row.mediaKind
      : "none";
  const mediaUrlRaw = typeof row.mediaUrl === "string" ? row.mediaUrl.trim() : "";
  const mediaUrl = mediaKind === "none" ? "" : mediaUrlRaw;
  const partial = {
    title,
    body: typeof row.body === "string" ? row.body : "",
    mediaUrl,
    mediaKind,
    ctaLabel: typeof row.ctaLabel === "string" ? row.ctaLabel : "",
    ctaHref: typeof row.ctaHref === "string" ? row.ctaHref : "",
  };
  const strip = normalizePromoStripFields(row as Partial<PromoBanner>);
  return {
    id,
    adminName,
    ...partial,
    animation,
    presentation: normalizePresentation(row.presentation),
    sequenceTransition: normalizeSequenceTransition(row.sequenceTransition),
    sequenceFadeDurationMs: normalizeSequenceFadeDurationMs(row.sequenceFadeDurationMs),
    sequenceLoop: false,
    frames: normalizePromoFrames(row.frames, partial),
    ctaBuyLinks: normalizeCtaBuyLinks(row.ctaBuyLinks),
    ...strip,
    ctaStyle:
      row.ctaStyle === "promo" || row.ctaStyle === "outline" || row.ctaStyle === "magical"
        ? row.ctaStyle
        : "magical",
    animateEnabled: row.animateEnabled !== false,
    textBannerEnabled: row.textBannerEnabled === true,
    textBannerOffsetX: Math.min(1200, Math.max(-1200, Number.isFinite(Number(row.textBannerOffsetX)) ? Number(row.textBannerOffsetX) : 0)),
    textBannerOffsetY: Math.min(900, Math.max(-900, Number.isFinite(Number(row.textBannerOffsetY)) ? Number(row.textBannerOffsetY) : 0)),
    textBannerScale: Math.min(220, Math.max(20, Number.isFinite(Number(row.textBannerScale)) ? Number(row.textBannerScale) : 100)),

    textBannerStyle:
      row.textBannerStyle === "ivory" || row.textBannerStyle === "teal" ? row.textBannerStyle : "glass",
    headlineOffsetX: Math.min(1200, Math.max(-1200, Number(row.headlineOffsetX) || 0)),
    headlineOffsetY: Math.min(900, Math.max(-900, Number(row.headlineOffsetY) || 0)),
    headlineScale: Math.min(220, Math.max(40, Number(row.headlineScale) || 100)),
    headlineAnimation: row.headlineAnimation === "fade" || row.headlineAnimation === "slide" || row.headlineAnimation === "pulse" || row.headlineAnimation === "zoom" ? row.headlineAnimation : "none",
    headlineAnimationDurationMs: Math.min(12000, Math.max(400, Number(row.headlineAnimationDurationMs) || 2400)),
    taglineOffsetX: Math.min(1200, Math.max(-1200, Number(row.taglineOffsetX) || 0)),
    taglineOffsetY: Math.min(900, Math.max(-900, Number(row.taglineOffsetY) || 0)),
    taglineScale: Math.min(220, Math.max(40, Number(row.taglineScale) || 100)),
    taglineAnimation: row.taglineAnimation === "fade" || row.taglineAnimation === "slide" || row.taglineAnimation === "pulse" || row.taglineAnimation === "zoom" ? row.taglineAnimation : "none",
    taglineAnimationDurationMs: Math.min(12000, Math.max(400, Number(row.taglineAnimationDurationMs) || 2400)),
    stripBackgroundGradient:
      typeof row.stripBackgroundGradient === "string" ? row.stripBackgroundGradient : "",
    overlayImageX: Math.min(100, Math.max(0, Number.isFinite(Number(row.overlayImageX)) ? Number(row.overlayImageX) : 50)),
    overlayImageY: Math.min(100, Math.max(0, Number.isFinite(Number(row.overlayImageY)) ? Number(row.overlayImageY) : 50)),
    overlayImageScale: Math.min(220, Math.max(20, Number.isFinite(Number(row.overlayImageScale)) ? Number(row.overlayImageScale) : 75)),
    overlayImageRadius: Math.min(50, Math.max(0, Number.isFinite(Number(row.overlayImageRadius)) ? Number(row.overlayImageRadius) : 18)),
    overlayImageShadow: row.overlayImageShadow !== false,
    overlayImageAnimation:
      row.overlayImageAnimation === "fade" || row.overlayImageAnimation === "slide" || row.overlayImageAnimation === "pulse" || row.overlayImageAnimation === "zoom"
        ? row.overlayImageAnimation
        : "none",
    overlayImageAnimationDurationMs: Math.min(12000, Math.max(400, Number(row.overlayImageAnimationDurationMs) || 2400)),
    overlayImages: normalizeOverlayImages(row.overlayImages),
    ctaOffsetX: Math.min(1200, Math.max(-1200, Number(row.ctaOffsetX) || 0)),
    ctaOffsetY: Math.min(900, Math.max(-900, Number(row.ctaOffsetY) || 0)),
    thumbnailOffsetX: Math.min(1200, Math.max(-1200, Number(row.thumbnailOffsetX) || 0)),
    thumbnailOffsetY: Math.min(900, Math.max(-900, Number(row.thumbnailOffsetY) || 0)),
    startsAt: typeof row.startsAt === "string" ? row.startsAt : "",
    endsAt: typeof row.endsAt === "string" ? row.endsAt : "",
    active: row.active !== false,
    promoModeEnabled: row.promoModeEnabled !== false,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString(),
  };
}

export function isPromoLive(banner: PromoBanner, now = new Date()): boolean {
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

export async function readPromoStore(): Promise<PromoStore> {
  const stored = await readJsonKv<PromoStore>(KEY, FILE, empty());
  return { banners: (stored.banners ?? []).map(parseBanner).filter((b): b is PromoBanner => Boolean(b)) };
}

export async function writePromoStore(store: PromoStore): Promise<void> {
  await writeJsonKv(KEY, FILE, store);
}

export async function listLivePromoBanners(): Promise<PromoBanner[]> {
  const store = await readPromoStore();
  return store.banners.filter((banner) => isPromoLive(banner));
}

export async function upsertPromoBanner(
  input: Partial<PromoBanner> & { title?: string; adminName?: string }
): Promise<PromoBanner> {
  const store = await readPromoStore();
  const now = new Date().toISOString();
  const existing = input.id ? store.banners.find((b) => b.id === input.id) : null;
  const mergedMediaKind = input.mediaKind ?? existing?.mediaKind ?? "none";
  const mergedMediaUrlRaw = input.mediaUrl?.trim() ?? existing?.mediaUrl?.trim() ?? "";
  const mergedPartial = {
    adminName:
      typeof input.adminName === "string"
        ? input.adminName.trim()
        : existing?.adminName?.trim() ?? "",
    title: typeof input.title === "string" ? input.title.trim() : existing?.title?.trim() ?? "",
    body: input.body?.trim() ?? existing?.body ?? "",
    mediaUrl: mergedMediaKind === "none" ? "" : mergedMediaUrlRaw,
    mediaKind: mergedMediaKind,
    ctaLabel: input.ctaLabel?.trim() ?? existing?.ctaLabel ?? "",
    ctaHref: input.ctaHref?.trim() ?? existing?.ctaHref ?? "",
  };
  const strip = normalizePromoStripFields({ ...existing, ...input });
  const banner: PromoBanner = {
    id: existing?.id ?? crypto.randomUUID(),
    ...mergedPartial,
    animation: input.animation ?? existing?.animation ?? "marquee",
    presentation: normalizePresentation(input.presentation ?? existing?.presentation),
    sequenceTransition: normalizeSequenceTransition(input.sequenceTransition ?? existing?.sequenceTransition),
    sequenceFadeDurationMs: normalizeSequenceFadeDurationMs(
      input.sequenceFadeDurationMs ?? existing?.sequenceFadeDurationMs
    ),
    sequenceLoop: false,
    frames: normalizePromoFrames(input.frames ?? existing?.frames, mergedPartial),
    ctaBuyLinks: normalizeCtaBuyLinks(input.ctaBuyLinks ?? existing?.ctaBuyLinks),
    ...strip,
    ctaStyle:
      input.ctaStyle === "magical" || input.ctaStyle === "outline" || input.ctaStyle === "promo"
        ? input.ctaStyle
        : existing?.ctaStyle ?? "magical",
    animateEnabled: input.animateEnabled ?? existing?.animateEnabled ?? true,
    textBannerEnabled: input.textBannerEnabled ?? existing?.textBannerEnabled ?? false,
    textBannerOffsetX: Math.min(1200, Math.max(-1200, input.textBannerOffsetX ?? existing?.textBannerOffsetX ?? 0)),
    textBannerOffsetY: Math.min(900, Math.max(-900, input.textBannerOffsetY ?? existing?.textBannerOffsetY ?? 0)),
    textBannerScale: Math.min(220, Math.max(20, input.textBannerScale ?? existing?.textBannerScale ?? 100)),

    textBannerStyle:
      input.textBannerStyle === "ivory" || input.textBannerStyle === "teal" || input.textBannerStyle === "glass"
        ? input.textBannerStyle
        : existing?.textBannerStyle ?? "glass",
    headlineOffsetX: Math.min(1200, Math.max(-1200, input.headlineOffsetX ?? existing?.headlineOffsetX ?? 0)),
    headlineOffsetY: Math.min(900, Math.max(-900, input.headlineOffsetY ?? existing?.headlineOffsetY ?? 0)),
    headlineScale: Math.min(220, Math.max(40, input.headlineScale ?? existing?.headlineScale ?? 100)),
    headlineAnimation: input.headlineAnimation === "fade" || input.headlineAnimation === "slide" || input.headlineAnimation === "pulse" || input.headlineAnimation === "zoom" || input.headlineAnimation === "none" ? input.headlineAnimation : existing?.headlineAnimation ?? "none",
    headlineAnimationDurationMs: Math.min(12000, Math.max(400, input.headlineAnimationDurationMs ?? existing?.headlineAnimationDurationMs ?? 2400)),
    taglineOffsetX: Math.min(1200, Math.max(-1200, input.taglineOffsetX ?? existing?.taglineOffsetX ?? 0)),
    taglineOffsetY: Math.min(900, Math.max(-900, input.taglineOffsetY ?? existing?.taglineOffsetY ?? 0)),
    taglineScale: Math.min(220, Math.max(40, input.taglineScale ?? existing?.taglineScale ?? 100)),
    taglineAnimation: input.taglineAnimation === "fade" || input.taglineAnimation === "slide" || input.taglineAnimation === "pulse" || input.taglineAnimation === "zoom" || input.taglineAnimation === "none" ? input.taglineAnimation : existing?.taglineAnimation ?? "none",
    taglineAnimationDurationMs: Math.min(12000, Math.max(400, input.taglineAnimationDurationMs ?? existing?.taglineAnimationDurationMs ?? 2400)),
    stripBackgroundGradient:
      typeof input.stripBackgroundGradient === "string"
        ? input.stripBackgroundGradient
        : existing?.stripBackgroundGradient ?? "",
    overlayImageX: Math.min(100, Math.max(0, input.overlayImageX ?? existing?.overlayImageX ?? 50)),
    overlayImageY: Math.min(100, Math.max(0, input.overlayImageY ?? existing?.overlayImageY ?? 50)),
    overlayImageScale: Math.min(220, Math.max(20, input.overlayImageScale ?? existing?.overlayImageScale ?? 75)),
    overlayImageRadius: Math.min(50, Math.max(0, input.overlayImageRadius ?? existing?.overlayImageRadius ?? 18)),
    overlayImageShadow: input.overlayImageShadow ?? existing?.overlayImageShadow ?? true,
    overlayImageAnimation:
      input.overlayImageAnimation === "fade" || input.overlayImageAnimation === "slide" || input.overlayImageAnimation === "pulse" || input.overlayImageAnimation === "zoom" || input.overlayImageAnimation === "none"
        ? input.overlayImageAnimation
        : existing?.overlayImageAnimation ?? "none",
    overlayImageAnimationDurationMs: Math.min(12000, Math.max(400, input.overlayImageAnimationDurationMs ?? existing?.overlayImageAnimationDurationMs ?? 2400)),
    overlayImages: normalizeOverlayImages(input.overlayImages ?? existing?.overlayImages),
    ctaOffsetX: Math.min(1200, Math.max(-1200, input.ctaOffsetX ?? existing?.ctaOffsetX ?? 0)),
    ctaOffsetY: Math.min(900, Math.max(-900, input.ctaOffsetY ?? existing?.ctaOffsetY ?? 0)),
    thumbnailOffsetX: Math.min(1200, Math.max(-1200, input.thumbnailOffsetX ?? existing?.thumbnailOffsetX ?? 0)),
    thumbnailOffsetY: Math.min(900, Math.max(-900, input.thumbnailOffsetY ?? existing?.thumbnailOffsetY ?? 0)),
    startsAt: input.startsAt ?? existing?.startsAt ?? "",
    endsAt: input.endsAt ?? existing?.endsAt ?? "",
    active: input.active ?? existing?.active ?? true,
    promoModeEnabled: input.promoModeEnabled ?? existing?.promoModeEnabled ?? true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  if (!existing && banner.frames.length === 0) {
    banner.frames = buildDefaultPromoFrames(banner);
  }
  store.banners = existing
    ? store.banners.map((b) => (b.id === banner.id ? banner : b))
    : [banner, ...store.banners];
  await writePromoStore(store);
  return banner;
}

export async function deletePromoBanner(id: string): Promise<boolean> {
  const store = await readPromoStore();
  const next = store.banners.filter((b) => b.id !== id);
  if (next.length === store.banners.length) return false;
  await writePromoStore({ banners: next });
  return true;
}
