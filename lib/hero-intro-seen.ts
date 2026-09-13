export const HERO_INTRO_SEEN_KEY = "maroma-hero-intro-seen";

export function hasHeroIntroBeenSeen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(HERO_INTRO_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markHeroIntroSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HERO_INTRO_SEEN_KEY, "1");
  } catch {
    /* private mode / quota */
  }
}
