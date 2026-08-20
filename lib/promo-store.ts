import { readJsonKv, writeJsonKv } from "./json-kv-store";
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
  if (!id || !title) return null;
  const animationRaw = row.animation;
  const animation: PromoAnimation =
    animationRaw === "fade" || animationRaw === "slide" || animationRaw === "pulse" || animationRaw === "marquee"
      ? animationRaw
      : "marquee";
  const mediaKind: PromoMediaKind =
    row.mediaKind === "image" || row.mediaKind === "video" ? row.mediaKind : "none";
  return {
    id,
    title,
    body: typeof row.body === "string" ? row.body : "",
    mediaUrl: typeof row.mediaUrl === "string" ? row.mediaUrl : "",
    mediaKind,
    animation,
    ctaLabel: typeof row.ctaLabel === "string" ? row.ctaLabel : "",
    ctaHref: typeof row.ctaHref === "string" ? row.ctaHref : "",
    startsAt: typeof row.startsAt === "string" ? row.startsAt : "",
    endsAt: typeof row.endsAt === "string" ? row.endsAt : "",
    active: row.active !== false,
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

export async function upsertPromoBanner(input: Partial<PromoBanner> & { title: string }): Promise<PromoBanner> {
  const store = await readPromoStore();
  const now = new Date().toISOString();
  const existing = input.id ? store.banners.find((b) => b.id === input.id) : null;
  const banner: PromoBanner = {
    id: existing?.id ?? crypto.randomUUID(),
    title: input.title.trim(),
    body: input.body?.trim() ?? existing?.body ?? "",
    mediaUrl: input.mediaUrl?.trim() ?? existing?.mediaUrl ?? "",
    mediaKind: input.mediaKind ?? existing?.mediaKind ?? "none",
    animation: input.animation ?? existing?.animation ?? "marquee",
    ctaLabel: input.ctaLabel?.trim() ?? existing?.ctaLabel ?? "",
    ctaHref: input.ctaHref?.trim() ?? existing?.ctaHref ?? "",
    startsAt: input.startsAt ?? existing?.startsAt ?? "",
    endsAt: input.endsAt ?? existing?.endsAt ?? "",
    active: input.active ?? existing?.active ?? true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
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
