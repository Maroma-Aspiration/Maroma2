/** Bump when carousel stack baseline changes — forces one-time reset to back (1). */
export const RITUAL_CAROUSEL_STACK_REV = 2;
export const HERO_LAYER_DEPTH_MIN = 1;
export const HERO_LAYER_DEPTH_MAX = 10;

export function clampHeroLayerDepth(value: number, fallback = 1): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.max(HERO_LAYER_DEPTH_MIN, Math.min(HERO_LAYER_DEPTH_MAX, Math.round(n)));
}

/** Map legacy 0–100 stack values to 1–10. */
export function migrateLegacyStackZ(value: number, fallback: number): number {
  if (Number.isFinite(value) && value >= HERO_LAYER_DEPTH_MIN && value <= HERO_LAYER_DEPTH_MAX) {
    return Math.round(value);
  }
  if (value > HERO_LAYER_DEPTH_MAX) {
    return clampHeroLayerDepth(Math.round(value / 10), fallback);
  }
  return clampHeroLayerDepth(fallback);
}

export function migrateLegacyLayerZ(value: number, fallback: number): number {
  return migrateLegacyStackZ(value, fallback);
}

/** Loved section stack 1–10 → paint z-index inside isolated section (default florals = -3). */
export function lovedStackZToPaintZ(stackZ: number): number {
  return clampHeroLayerDepth(stackZ) - 4;
}

/** Legacy saves (>10) and missing values resolve to 1 so stack can move forward from back. */
export function normalizeRitualStackZ(value: number | undefined, fallback = 1): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  if (value > HERO_LAYER_DEPTH_MAX) {
    return 1;
  }
  return clampHeroLayerDepth(value, fallback);
}
