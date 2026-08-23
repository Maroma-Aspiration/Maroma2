export type CategoryBannerOverride = {
  imageUrl?: string;
  heroTitle?: string;
  heroTagline?: string;
  /** Homepage collection tile image (falls back to imageUrl, then catalog default). */
  cardImageUrl?: string;
  cardLabel?: string;
  cardDescription?: string;
  /** Homepage collection tile crop (`background-position`). */
  cardObjectPosition?: string;
  /** Homepage collection tile zoom (`background-size`, 100 = cover). */
  cardBackgroundScale?: number;
  objectPosition?: string;
  minHeight?: string;
  maxHeight?: string;
  thumbMaxWidth?: number;
  updatedAt?: string;
};

export type CategoryBannerStore = {
  banners: Record<string, CategoryBannerOverride>;
};

export type ResolvedCategoryBanner = {
  imageUrl: string | undefined;
  heroTitle: string;
  heroTagline: string;
  objectPosition: string;
  minHeight: string;
  maxHeight: string;
  thumbMaxWidth: number;
};

export type ResolvedCategoryCard = {
  slug: string;
  label: string;
  description: string;
  imageUrl: string | undefined;
  objectPosition: string;
  backgroundScale: number;
};
