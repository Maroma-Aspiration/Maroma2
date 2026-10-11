import { isClassicPillarProduct } from "./product-families";
import { hasDisplayImage } from "./product-image";
import type { ProductRecord } from "./product-types";

const scoreProduct = (current: ProductRecord, candidate: ProductRecord): number => {
  const cat = new Set(current.categories);
  const tags = new Set(current.tags);
  let score = 0;
  for (const c of candidate.categories) {
    if (cat.has(c)) {
      score += 2;
    }
  }
  for (const t of candidate.tags) {
    if (tags.has(t)) {
      score += 1;
    }
  }
  return score;
};

/** Related products: shared categories/tags first, then other catalog items with images. */
export function getSuggestedProducts(
  catalog: ProductRecord[],
  current: ProductRecord,
  limit: number
): ProductRecord[] {
  const hideFamilySiblings = isClassicPillarProduct(current);
  const others = catalog.filter((p) => {
    if (p.id === current.id || !hasDisplayImage(p)) return false;
    if (hideFamilySiblings && isClassicPillarProduct(p)) return false;
    return true;
  });
  return others
    .map((p) => ({ p, score: scoreProduct(current, p) }))
    .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name))
    .slice(0, limit)
    .map((row) => row.p);
}
