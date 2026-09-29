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
import { firstUsablePublicMediaUrl } from "./usable-media-url";

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

function oneLineCardDescription(
  override: string | undefined,
  tileDescription: string | undefined,
  description: string
): string {
  const custom = override?.trim() || "";
  if (custom && custom.length <= 42 && !/[.:]/.test(custom)) return custom;
  return tileDescription || description;
}

export function resolveCategoryCardFromOverride(
  slug: string,
  category: Pick<CatalogCategory, "bannerImage" | "label" | "description" | "tileDescription">,
  override: CategoryBannerOverride | undefined
): ResolvedCategoryCard {
  return {
    slug,
    label: override?.cardLabel?.trim() || category.label,
    description: oneLineCardDescription(
      override?.cardDescription,
      category.tileDescription,
      category.description
    ),
    imageUrl: firstUsablePublicMediaUrl(override?.cardImageUrl, override?.imageUrl, category.bannerImage) || undefined,
    objectPosition: resolveCategoryCardObjectPosition(slug, override),
    backgroundScale: resolveCategoryCardBackgroundScale(override),
  };
}

export function resolveAllCategoryCards(store: { banners: Record<string, CategoryBannerOverride | undefined> }): ResolvedCategoryCard[] {
  return catalogCategories.map((category) =>
    resolveCategoryCardFromOverride(category.slug, category, store.banners[category.slug])
  );
}
