import { NextResponse } from "next/server";
import { GIFT_BOXES, GIFT_CARD_PRESETS, GIFT_EVENT_PRESETS, GIFT_QUANTITY_TIERS } from "../../../../lib/gift-builder-catalog";
import { enrichGiftElements } from "../../../../lib/gift-builder";
import { readGiftPackingStore } from "../../../../lib/gift-packing-store";
import { resolveCommerceProducts } from "../../../../lib/commerce-product";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [baseElements, packing] = await Promise.all([enrichGiftElements(), readGiftPackingStore()]);
    const customResolved = await resolveCommerceProducts(packing.customProducts.map((item) => item.productId));
    const customElements = packing.customProducts.flatMap((item) => {
      const product = customResolved.get(item.productId);
      const dims = packing.elementDimensions[item.id];
      if (!product || !product.active || !dims) return [];
      return [{ id: item.id, productId: item.productId, name: product.name, description: item.description, category: item.category, image: product.image, price: product.price, ...dims }];
    });
    const elements = [...baseElements.map((element) => ({ ...element, ...packing.elementDimensions[element.id] })), ...customElements];
    return NextResponse.json({
      boxes: packing.boxes,
      elements,
      presets: GIFT_EVENT_PRESETS,
      quantityTiers: GIFT_QUANTITY_TIERS,
      cardPresets: GIFT_CARD_PRESETS,
    });
  } catch (error) {
    console.error("gift-builder catalog GET failed", error);
    return NextResponse.json({ error: "Failed to load gift builder catalog." }, { status: 500 });
  }
}
