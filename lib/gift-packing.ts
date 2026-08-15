import type { GiftBox, GiftElement, PackedGift } from "./gift-builder-types";

type FreeRect = { x: number; y: number; lengthCm: number; widthCm: number };

/** Deterministic guillotine packer. It tries both orientations and places larger gifts first. */
export function packGifts(box: GiftBox, elements: GiftElement[]): { fits: boolean; packed: PackedGift[] } {
  if (elements.some((item) => item.heightCm > box.heightCm)) return { fits: false, packed: [] };
  const free: FreeRect[] = [{ x: 0, y: 0, lengthCm: box.lengthCm, widthCm: box.widthCm }];
  const packed: PackedGift[] = [];
  const ordered = [...elements].sort((a, b) => b.lengthCm * b.widthCm - a.lengthCm * a.widthCm);

  for (const item of ordered) {
    let choice: { index: number; l: number; w: number; rotated: boolean; waste: number } | null = null;
    free.forEach((rect, index) => {
      ([[item.lengthCm, item.widthCm, false], [item.widthCm, item.lengthCm, true]] as const).forEach(([l, w, rotated]) => {
        if (l <= rect.lengthCm && w <= rect.widthCm) {
          const waste = rect.lengthCm * rect.widthCm - l * w;
          if (!choice || waste < choice.waste) choice = { index, l, w, rotated, waste };
        }
      });
    });
    if (!choice) return { fits: false, packed: [] };
    const selected = choice as { index: number; l: number; w: number; rotated: boolean; waste: number };
    const rect = free.splice(selected.index, 1)[0];
    packed.push({ elementId: item.id, x: rect.x, y: rect.y, lengthCm: selected.l, widthCm: selected.w, heightCm: item.heightCm, rotated: selected.rotated });
    const right = { x: rect.x + selected.l, y: rect.y, lengthCm: rect.lengthCm - selected.l, widthCm: selected.w };
    const below = { x: rect.x, y: rect.y + selected.w, lengthCm: rect.lengthCm, widthCm: rect.widthCm - selected.w };
    if (right.lengthCm > 0 && right.widthCm > 0) free.push(right);
    if (below.lengthCm > 0 && below.widthCm > 0) free.push(below);
  }
  return { fits: true, packed };
}

export function canAddGift(box: GiftBox, selected: GiftElement[], candidate: GiftElement): boolean {
  return !selected.some((item) => item.id === candidate.id) && packGifts(box, [...selected, candidate]).fits;
}
