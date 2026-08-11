export type GiftSetVariantData = {
  setName: string;
  cardId?: string;
  cardMessage?: string;
};

const MAX_SET_NAME = 80;
const MAX_CARD_MESSAGE = 220;

export function encodeGiftSetVariant(data: GiftSetVariantData): string | undefined {
  const setName = data.setName.trim().slice(0, MAX_SET_NAME);
  const cardId = data.cardId?.trim() || undefined;
  const cardMessage = data.cardMessage?.trim().slice(0, MAX_CARD_MESSAGE) || undefined;
  if (!setName && !cardId && !cardMessage) return undefined;
  return JSON.stringify({
    setName: setName || "Custom gift set",
    ...(cardId ? { cardId } : {}),
    ...(cardMessage ? { cardMessage } : {}),
  });
}

export function parseGiftSetVariant(variant?: string): GiftSetVariantData | null {
  if (!variant?.trim()) return null;
  try {
    const parsed = JSON.parse(variant) as GiftSetVariantData;
    if (parsed && typeof parsed.setName === "string") {
      return {
        setName: parsed.setName.trim().slice(0, MAX_SET_NAME),
        cardId: typeof parsed.cardId === "string" ? parsed.cardId.trim() : undefined,
        cardMessage:
          typeof parsed.cardMessage === "string"
            ? parsed.cardMessage.trim().slice(0, MAX_CARD_MESSAGE)
            : undefined,
      };
    }
  } catch {
    // legacy plain set name
  }
  return { setName: variant.trim().slice(0, MAX_SET_NAME) };
}

export function giftSetCartDisplayName(
  productName: string,
  variant?: string
): string {
  const data = parseGiftSetVariant(variant);
  if (!data) return productName;
  const base = data.setName || productName;
  return data.cardId ? `${base} + greeting card` : base;
}
