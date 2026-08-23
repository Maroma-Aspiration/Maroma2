import {
  defaultCollectionCardObjectPosition,
  defaultCollectionCardPositions,
} from "./category-banner-defaults";
import {
  clampBackgroundScale,
  DEFAULT_COLLECTION_CARD_BACKGROUND_SCALE,
} from "./category-banner-position";
import type { CategoryBannerOverride, ResolvedCategoryCard } from "./category-banner-types";
import type { CatalogCategory } from "./catalog-categories";
import { catalogCategories } from "./catalog-categories";

export function resolveCategoryCardObjectPosition(
  slug: string,
  override: CategoryBannerOverride | undefined
): string {
  return (
    override?.cardObjectPosition?.trim() ||
    defaultCollectionCardPositions[slug] ||
    defaultCollectionCardObjectPosition
  );
}

export function resolveCategoryCardBackgroundScale(
  override: CategoryBannerOverride | undefined
): number {
  if (typeof override?.cardBackgroundScale === "number") {
    return clampBackgroundScale(override.cardBackgroundScale);
  }
  return DEFAULT_COLLECTION_CARD_BACKGROUND_SCALE;
}

export function resolveCategoryCardFromOverride(
  slug: string,
  category: Pick<CatalogCategory, "bannerImage" | "label" | "description">,
  override: CategoryBannerOverride | undefined
): ResolvedCategoryCard {
  return {
    slug,
    label: override?.cardLabel?.trim() || category.label,
    description: override?.cardDescription?.trim() || category.description,
    imageUrl: override?.cardImageUrl ?? override?.imageUrl ?? category.bannerImage,
    objectPosition: resolveCategoryCardObjectPosition(slug, override),
    backgroundScale: resolveCategoryCardBackgroundScale(override),
  };
}

export function resolveAllCategoryCards(store: { banners: Record<string, CategoryBannerOverride | undefined> }): ResolvedCategoryCard[] {
  return catalogCategories.map((category) =>
    resolveCategoryCardFromOverride(category.slug, category, store.banners[category.slug])
  );
}
