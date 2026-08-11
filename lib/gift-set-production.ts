import { parseGiftSetProductId } from "./gift-set-id";
import { getGiftBox, getGiftCardPreset, getGiftElement } from "./gift-builder-catalog";
import { parseGiftSetVariant } from "./gift-set-variant";
import type { OrderLineSnapshot, OrderRecord } from "./commerce-types";

export type ProductionGiftElement = {
  slot: number;
  id: string;
  name: string;
  category: string;
  sku: string;
  image: string;
};

export type ProductionGiftSetLine = {
  lineIndex: number;
  quantity: number;
  setName: string;
  box: { id: string; name: string; slotCount: number };
  elements: ProductionGiftElement[];
  card: {
    id: string;
    name: string;
    style: string;
    message: string;
  } | null;
  unitPrice: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  scent: "Scent",
  soap: "Soap",
  candle: "Candle",
  wellness: "Wellness",
  accent: "Accent",
};

export function giftSetCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

export function orderHasGiftSets(order: OrderRecord): boolean {
  return order.lines.some((line) => parseGiftSetProductId(line.productId) !== null);
}

export function expandOrderGiftSets(order: OrderRecord): ProductionGiftSetLine[] {
  const results: ProductionGiftSetLine[] = [];

  order.lines.forEach((line, lineIndex) => {
    const parsed = parseGiftSetProductId(line.productId);
    if (!parsed) return;

    const box = getGiftBox(parsed.boxId);
    const variant = parseGiftSetVariant(line.variant);
    const cardId = variant?.cardId ?? parsed.cardId;
    const cardPreset = cardId ? getGiftCardPreset(cardId) : null;

    const elements: ProductionGiftElement[] = parsed.elementIds.map((id, idx) => {
      const element = getGiftElement(id);
      return {
        slot: idx + 1,
        id,
        name: element?.name ?? id,
        category: element?.category ?? "unknown",
        sku: element?.productId ?? id,
        image: element?.image ?? line.image,
      };
    });

    results.push({
      lineIndex,
      quantity: line.quantity,
      setName: variant?.setName ?? line.name,
      box: {
        id: parsed.boxId,
        name: box?.name ?? parsed.boxId,
        slotCount: box?.slotCount ?? elements.length,
      },
      elements,
      card: cardPreset
        ? {
            id: cardPreset.id,
            name: cardPreset.name,
            style: cardPreset.style,
            message: variant?.cardMessage?.trim() || cardPreset.suggestedMessage,
          }
        : null,
      unitPrice: line.price,
    });
  });

  return results;
}

export function orderRegularLines(
  order: OrderRecord,
  giftSets: ProductionGiftSetLine[]
): OrderLineSnapshot[] {
  const giftLineIndexes = new Set(giftSets.map((set) => set.lineIndex));
  return order.lines.filter((_, index) => !giftLineIndexes.has(index));
}

export function countGiftSetsToMake(giftSets: ProductionGiftSetLine[]): number {
  return giftSets.reduce((sum, set) => sum + set.quantity, 0);
}
