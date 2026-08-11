import { parseHeroVisualState } from "./hero-visual-state-parse";
import type { HeroVisualState } from "./hero-media-layout-types";

export function getVisualStateUpdatedAt(state: unknown): number {
  if (!state || typeof state !== "object") {
    return 0;
  }
  const t = (state as Record<string, unknown>).updatedAt;
  return typeof t === "number" && Number.isFinite(t) ? t : 0;
}

export function stampVisualStateUpdatedAt<T extends Record<string, unknown>>(payload: T): T & { updatedAt: number } {
  return { ...payload, updatedAt: Date.now() };
}

/** Server wins when it is newer or tied — local only wins when strictly ahead (unsaved offline edits). */
export function mergeHeroVisualStates(local: HeroVisualState, server: HeroVisualState): HeroVisualState {
  const localAt = getVisualStateUpdatedAt(local);
  const serverAt = getVisualStateUpdatedAt(server);

  if (localAt > serverAt) {
    return parseHeroVisualState({ ...server, ...local, updatedAt: localAt });
  }

  return parseHeroVisualState({ ...local, ...server, updatedAt: serverAt || Date.now() });
}
