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
  /** Wide category-banner zoom, as a percentage (100 = natural cover size). */
  imageScale?: number;
  minHeight?: string;
  maxHeight?: string;
  thumbMaxWidth?: number;
  /** Wide-banner headline position (% from left edge). */
  copyLeftPct?: number;
  /** Wide-banner headline position (% from bottom edge). */
  copyBottomPct?: number;
  updatedAt?: string;
};

export type CategoryBannerStore = {
  banners: Record<string, CategoryBannerOverride>;
  firebaseMediaVersion?: string;
};

export type ResolvedCategoryBanner = {
  imageUrl: string | undefined;
  heroTitle: string;
  heroTagline: string;
  objectPosition: string;
  imageScale: number;
  minHeight: string;
  maxHeight: string;
  thumbMaxWidth: number;
  copyLeftPct: number;
  copyBottomPct: number;
};

export type ResolvedCategoryCard = {
  slug: string;
  label: string;
  description: string;
  imageUrl: string | undefined;
  objectPosition: string;
  backgroundScale: number;
};
