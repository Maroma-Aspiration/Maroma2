import { readJsonKv, writeJsonKv } from "./json-kv-store";
import { defaultWideBannerCopyPosition, defaultWideBannerLayout } from "./category-banner-defaults";
import type {
  CategoryBannerOverride,
  CategoryBannerStore,
  ResolvedCategoryBanner,
  ResolvedCategoryCard,
} from "./category-banner-types";
import type { CatalogCategory } from "./catalog-categories";
import { ensureStorefrontMediaOnFirebase } from "./migrate-storefront-media-to-firebase";
import { firstUsablePublicMediaUrl } from "./usable-media-url";

export type {
  CategoryBannerOverride,
  CategoryBannerStore,
  ResolvedCategoryBanner,
  ResolvedCategoryCard,
} from "./category-banner-types";
export { defaultWideBannerLayout } from "./category-banner-defaults";

const KV_KEY = "maroma:category-banner-overrides";
const FILE_NAME = "category-banner-overrides.json";
const legacyDefaultMinHeight = "clamp(220px, 34vw, 400px)";
const legacyDefaultMaxHeight = "min(48vh, 440px)";

const emptyStore = (): CategoryBannerStore => ({ banners: {} });

export async function readCategoryBannerStore(): Promise<CategoryBannerStore> {
  try {
    await ensureStorefrontMediaOnFirebase();
  } catch (err) {
    console.error("[category-banners] firebase media migrate skipped", err);
  }
  const store = await readJsonKv<CategoryBannerStore>(KV_KEY, FILE_NAME, emptyStore());
  if (!store.banners || typeof store.banners !== "object") {
    return emptyStore();
  }
  return store;
}

export async function writeCategoryBannerStore(store: CategoryBannerStore): Promise<void> {
  await writeJsonKv(KV_KEY, FILE_NAME, store);
}

export async function resolveCategoryBanner(
  slug: string,
  category: Pick<
    CatalogCategory,
    "bannerImage" | "heroTitle" | "heroTagline" | "label" | "description"
  >
): Promise<ResolvedCategoryBanner> {
  const store = await readCategoryBannerStore();
  const o = store.banners[slug] ?? {};
  return {
    imageUrl: firstUsablePublicMediaUrl(o.imageUrl, category.bannerImage) || undefined,
    heroTitle: o.heroTitle ?? category.heroTitle ?? category.label,
    heroTagline: o.heroTagline ?? category.heroTagline ?? category.description,
    objectPosition: o.objectPosition ?? defaultWideBannerLayout.objectPosition,
    imageScale: o.imageScale ?? 100,
    // Treat previously saved "Default" values as defaults, so the improved
    // banner height also reaches existing categories without replacing custom sizes.
    minHeight: o.minHeight === legacyDefaultMinHeight ? defaultWideBannerLayout.minHeight : (o.minHeight ?? defaultWideBannerLayout.minHeight),
    maxHeight: o.maxHeight === legacyDefaultMaxHeight ? defaultWideBannerLayout.maxHeight : (o.maxHeight ?? defaultWideBannerLayout.maxHeight),
    thumbMaxWidth: o.thumbMaxWidth ?? 280,
    copyLeftPct: o.copyLeftPct ?? defaultWideBannerCopyPosition.copyLeftPct,
    copyBottomPct: o.copyBottomPct ?? defaultWideBannerCopyPosition.copyBottomPct
  };
}

export async function resolveCategoryCard(
  slug: string,
  category: Pick<CatalogCategory, "bannerImage" | "label" | "description" | "tileDescription">
): Promise<ResolvedCategoryCard> {
  const store = await readCategoryBannerStore();
  const { resolveCategoryCardFromOverride } = await import("./resolve-category-card");
  return resolveCategoryCardFromOverride(slug, category, store.banners[slug]);
}
