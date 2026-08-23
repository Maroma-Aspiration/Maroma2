export function parseBackgroundPosition(value: string): { x: number; y: number } {
  const trimmed = value.trim();
  const match = trimmed.match(/([\d.]+)%\s+([\d.]+)%/);
  if (match) {
    return {
      x: Math.min(100, Math.max(0, parseFloat(match[1]))),
      y: Math.min(100, Math.max(0, parseFloat(match[2]))),
    };
  }
  return { x: 50, y: 50 };
}

export function formatBackgroundPosition(x: number, y: number): string {
  return `${Math.round(x)}% ${Math.round(y)}%`;
}

export const DEFAULT_COLLECTION_CARD_BACKGROUND_SCALE = 100;

export function clampBackgroundScale(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return DEFAULT_COLLECTION_CARD_BACKGROUND_SCALE;
  }
  return Math.min(300, Math.max(50, Math.round(n)));
}

/** 100 = CSS `cover`; other values zoom relative to the tile frame. */
export function formatBackgroundSize(scale: number): string {
  const clamped = clampBackgroundScale(scale);
  if (clamped === DEFAULT_COLLECTION_CARD_BACKGROUND_SCALE) {
    return "cover";
  }
  return `${clamped}%`;
}
