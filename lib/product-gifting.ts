import type { ProductRecord } from "./product-types";

/** Gift-builder component eligibility does not make a standalone item a gift product. */
export function isGiftingProduct(product: Pick<ProductRecord, "name" | "categories">): boolean {
  return /\b(gift|gifting|hamper|giftset)\b/i.test([product.name, ...product.categories].join(" "));
}
