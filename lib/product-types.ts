export type ProductRecord = {
  id: string;
  sku: string;
  name: string;
  description: string;
  shortDescription: string;
  price: string;
  /** Optional lower customer price set by Commerce admin. The regular price remains in `price`. */
  salePrice?: string;
  categories: string[];
  tags: string[];
  brand: string;
  images: string[];
  /** Optional product videos displayed alongside gallery images. */
  videos?: string[];
  imageUrl: string;
  attributes: Record<string, string[]>;
  /** Internal shipping rule derived from legacy catalogue wording; never customer copy. */
  ukAndChannelIslandsRestricted?: boolean;
  /** Live Maroma.com Store API review summary, when synced. */
  averageRating?: number;
  reviewCount?: number;
};
