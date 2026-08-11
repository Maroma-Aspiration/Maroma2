import type { GiftSetCollectionItem, GiftTrack } from "./gift-builder-types";

export const GIFT_BUILDER_COLLECTION_KEY = "maroma-gift-builder-collection";

function normalizeCollectionItem(item: GiftSetCollectionItem): GiftSetCollectionItem {
  return {
    ...item,
    track: item.track ?? "personal",
  };
}

export function readGiftCollection(): GiftSetCollectionItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GIFT_BUILDER_COLLECTION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GiftSetCollectionItem[];
    return Array.isArray(parsed) ? parsed.map(normalizeCollectionItem) : [];
  } catch {
    return [];
  }
}

export function readGiftCollectionByTrack(track: GiftTrack): GiftSetCollectionItem[] {
  return readGiftCollection().filter((item) => item.track === track);
}

export function writeGiftCollection(items: GiftSetCollectionItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GIFT_BUILDER_COLLECTION_KEY, JSON.stringify(items));
  } catch {
    // best effort
  }
}

export function addToGiftCollection(item: GiftSetCollectionItem): GiftSetCollectionItem[] {
  const next = [item, ...readGiftCollection()];
  writeGiftCollection(next);
  return next;
}

export function updateGiftCollectionItem(
  id: string,
  patch: Partial<GiftSetCollectionItem>
): GiftSetCollectionItem[] {
  const next = readGiftCollection().map((item) =>
    item.id === id
      ? { ...item, ...patch, updatedAt: new Date().toISOString() }
      : item
  );
  writeGiftCollection(next);
  return next;
}

export function removeFromGiftCollection(id: string): GiftSetCollectionItem[] {
  const next = readGiftCollection().filter((item) => item.id !== id);
  writeGiftCollection(next);
  return next;
}
