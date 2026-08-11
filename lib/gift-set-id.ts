export const GIFT_SET_ID_PREFIX = "giftset:";

export function buildGiftSetProductId(
  boxId: string,
  elementIds: string[],
  cardId?: string
): string {
  const sorted = [...elementIds].sort();
  const base = `${GIFT_SET_ID_PREFIX}${boxId}:${sorted.join(",")}`;
  const card = cardId?.trim();
  return card ? `${base}@${card}` : base;
}

export function parseGiftSetProductId(
  productId: string
): { boxId: string; elementIds: string[]; cardId?: string } | null {
  if (!productId.startsWith(GIFT_SET_ID_PREFIX)) return null;
  const rest = productId.slice(GIFT_SET_ID_PREFIX.length);
  const colon = rest.indexOf(":");
  if (colon < 0) return null;
  const boxId = rest.slice(0, colon);
  const afterBox = rest.slice(colon + 1);
  const at = afterBox.indexOf("@");
  const elementsPart = at >= 0 ? afterBox.slice(0, at) : afterBox;
  const cardId = at >= 0 ? afterBox.slice(at + 1).trim() || undefined : undefined;
  const elementIds = elementsPart
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return { boxId, elementIds, cardId };
}

export function isGiftSetProductId(productId: string): boolean {
  return productId.startsWith(GIFT_SET_ID_PREFIX);
}
