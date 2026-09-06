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
import type { PromoAnimation, PromoBanner, PromoMediaKind } from "./promo-types";

export type { PromoAnimation, PromoBanner, PromoMediaKind } from "./promo-types";

type PromoStore = { banners: PromoBanner[] };

const KEY = "maroma:promo-banners";
const FILE = "promo-banners.json";

const empty = (): PromoStore => ({ banners: [] });

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
    sequenceLoop: row.sequenceLoop !== false,
    frames: normalizePromoFrames(row.frames, partial),
    ctaBuyLinks: normalizeCtaBuyLinks(row.ctaBuyLinks),
    ...strip,
    ctaOffsetX: Math.min(1200, Math.max(-1200, Number(row.ctaOffsetX) || 0)),
    ctaOffsetY: Math.min(900, Math.max(-900, Number(row.ctaOffsetY) || 0)),
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
    sequenceLoop: input.sequenceLoop ?? existing?.sequenceLoop ?? true,
    frames: normalizePromoFrames(input.frames ?? existing?.frames, mergedPartial),
    ctaBuyLinks: normalizeCtaBuyLinks(input.ctaBuyLinks ?? existing?.ctaBuyLinks),
    ...strip,
    ctaOffsetX: Math.min(1200, Math.max(-1200, input.ctaOffsetX ?? existing?.ctaOffsetX ?? 0)),
    ctaOffsetY: Math.min(900, Math.max(-900, input.ctaOffsetY ?? existing?.ctaOffsetY ?? 0)),
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
