import { hasDisplayImage } from "./product-image";
import type { ProductRecord } from "./product-types";

/**
 * Popularity order from the live Maroma.com Store API (`orderby=popularity`).
 * Used when the local catalogue does not yet carry sales ranks.
 */
export const MAROMA_STORE_BESTSELLER_IDS = [
  "2661",
  "2995",
  "2658",
  "3043",
  "2882",
  "2931",
  "3048",
  "2940",
  "2856",
  "2674",
  "5490",
  "795",
  "816",
  "2962",
  "2919",
  "2902",
  "2834",
  "4017",
  "4178",
  "3000",
] as const;

const RANK: Map<string, number> = new Map(
  MAROMA_STORE_BESTSELLER_IDS.map((id, index) => [id, MAROMA_STORE_BESTSELLER_IDS.length - index])
);

function bestsellerTagScore(product: ProductRecord): number {
  const haystack = [...product.tags, ...product.categories].join(" ").toLowerCase();
  if (/\bbest\s*-?\s*sellers?\b/.test(haystack)) return 80;
  if (/\bpopular\b/.test(haystack)) return 20;
  return 0;
}

export function rankBestsellerProducts(products: ProductRecord[], limit = 16): ProductRecord[] {
  return products
    .filter((product) => hasDisplayImage(product))
    .map((product, index) => {
      const storeRank = RANK.get(product.id) ?? 0;
      const reviewBoost = Math.min(12, Number(product.reviewCount) || 0);
      const ratingBoost = Number(product.averageRating) > 0 ? Number(product.averageRating) : 0;
      const score = storeRank * 10 + bestsellerTagScore(product) + reviewBoost + ratingBoost;
      return { product, score, index };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.product);
}
