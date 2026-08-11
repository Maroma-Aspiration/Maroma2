import {
  GIFT_ELEMENT_DEFS,
  getGiftBox,
  getGiftCardPreset,
  getGiftElement,
} from "./gift-builder-catalog";
import { resolveCommerceProducts } from "./commerce-product";
import type { CommerceProduct } from "./commerce-types";
import type { GiftElement } from "./gift-builder-types";

export { quantityDiscountRate, quantityTierRows } from "./gift-builder-pricing";

export { buildGiftSetProductId, GIFT_SET_ID_PREFIX, parseGiftSetProductId } from "./gift-set-id";

import { parseGiftSetProductId } from "./gift-set-id";

export type GiftSetValidation = {
  ok: boolean;
  error?: string;
  boxId?: string;
  elementIds?: string[];
  cardId?: string;
  elements?: GiftElement[];
  unitPrice?: number;
};

export async function validateGiftSet(
  boxId: string,
  elementIds: string[],
  cardId?: string
): Promise<GiftSetValidation> {
  const box = getGiftBox(boxId);
  if (!box) return { ok: false, error: "Unknown gift box." };

  const unique = Array.from(new Set(elementIds.map((id) => id.trim()).filter(Boolean)));
  if (unique.length !== box.slotCount) {
    return {
      ok: false,
      error: `Please choose exactly ${box.slotCount} elements for the ${box.name}.`,
    };
  }

  const elements: GiftElement[] = [];
  for (const id of unique) {
    const element = getGiftElement(id);
    if (!element) return { ok: false, error: `Unknown gift element: ${id}` };
    elements.push(element);
  }

  let cardPrice = 0;
  let resolvedCardId: string | undefined;
  if (cardId?.trim()) {
    const card = getGiftCardPreset(cardId.trim());
    if (!card) return { ok: false, error: "Unknown greeting card design." };
    cardPrice = card.price;
    resolvedCardId = card.id;
  }

  const productIds = elements.map((el) => el.productId);
  const resolved = await resolveCommerceProducts(productIds);

  let elementsTotal = 0;
  for (const element of elements) {
    const product = resolved.get(element.productId);
    if (!product || !product.active) {
      return { ok: false, error: `${element.name} is currently unavailable.` };
    }
    elementsTotal += product.price;
  }

  const unitPrice = box.basePrice + elementsTotal + cardPrice;
  return {
    ok: true,
    boxId,
    elementIds: unique,
    cardId: resolvedCardId,
    elements,
    unitPrice,
  };
}

export async function resolveGiftSetCommerceProduct(
  productId: string,
  displayName?: string
): Promise<CommerceProduct | null> {
  const parsed = parseGiftSetProductId(productId);
  if (!parsed) return null;

  const validation = await validateGiftSet(parsed.boxId, parsed.elementIds, parsed.cardId);
  if (!validation.ok || !validation.unitPrice || !validation.elements) return null;

  const box = getGiftBox(parsed.boxId);
  const card = parsed.cardId ? getGiftCardPreset(parsed.cardId) : null;
  const name =
    displayName?.trim() ||
    `${box?.name ?? "Custom"} Gift Set (${validation.elements.map((el) => el.name).join(", ")})${card ? ` + ${card.name} card` : ""}`;

  const image = validation.elements.find((el) => el.image)?.image ?? box?.image ?? "";

  return {
    id: productId,
    sku: productId,
    name: name.length > 120 ? `${name.slice(0, 117)}…` : name,
    price: validation.unitPrice,
    image,
    active: true,
    stock: 99,
    virtual: true,
  };
}

/** Enrich static element defs with live catalogue prices/images. */
export async function enrichGiftElements(): Promise<GiftElement[]> {
  const productIds = GIFT_ELEMENT_DEFS.map((def) => def.productId);
  const resolved = await resolveCommerceProducts(productIds);

  return GIFT_ELEMENT_DEFS.map((def) => {
    const product = resolved.get(def.productId);
    return {
      id: def.id,
      productId: def.productId,
      name: product?.name ?? def.name,
      description: def.description,
      category: def.category,
      image: product?.image || def.fallbackImage,
      price: product?.price ?? def.fallbackPrice,
    };
  });
}
