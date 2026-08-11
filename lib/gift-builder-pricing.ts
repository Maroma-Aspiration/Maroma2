import { GIFT_QUANTITY_TIERS } from "./gift-builder-catalog";
import type { GiftQuantityTier } from "./gift-builder-types";

export function quantityDiscountRate(quantity: number): number {
  let rate = 0;
  for (const tier of GIFT_QUANTITY_TIERS) {
    if (quantity >= tier.minQty) rate = tier.discountRate;
  }
  return rate;
}

export function quantityTierRows(
  unitPrice: number
): Array<GiftQuantityTier & { unitPrice: number; total: number }> {
  return GIFT_QUANTITY_TIERS.map((tier) => {
    const discounted = Math.round(unitPrice * (1 - tier.discountRate));
    return {
      ...tier,
      unitPrice: discounted,
      total: discounted * tier.minQty,
    };
  });
}
