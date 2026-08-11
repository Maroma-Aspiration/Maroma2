import { parseHeroVisualState } from "./hero-visual-state-parse";
import type { HeroVisualState } from "./hero-media-layout-types";
import { VISUAL_STATE_STORAGE_KEY } from "./hero-media-layout-types";

export function readHeroVisualLocalBackup(): HeroVisualState | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const stored = window.localStorage.getItem(VISUAL_STATE_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    return parseHeroVisualState(JSON.parse(stored));
  } catch {
    return null;
  }
}

export function writeHeroVisualLocalBackup(state: HeroVisualState): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(VISUAL_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Best-effort browser backup.
  }
}
