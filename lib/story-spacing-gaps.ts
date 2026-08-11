/** Manual gaps (px) used by canvas ⇕ Apply spacing between story blocks. */
export type StorySpacingGaps = {
  aboveHeadline: number;
  belowHeadline: number;
  /** Gap between story hero image and body copy. */
  belowImage: number;
  aboveButton: number;
  belowButton: number;
};

/** Legacy accidental wide CTA gap that produced oversized blank bands. */
const LEGACY_WIDE_STORY_BODY_TO_CTA_GAP = 132;
/** Default gap from story body bottom to CTA top. */
export const STORY_BODY_TO_CTA_GAP = 56;

export const DEFAULT_STORY_SPACING_GAPS: StorySpacingGaps = {
  aboveHeadline: 28,
  belowHeadline: 14,
  belowImage: 16,
  aboveButton: STORY_BODY_TO_CTA_GAP,
  belowButton: 36,
};

export const STORY_SPACING_LS_KEY = "maroma-story-spacing-gaps";

export function loadStorySpacingGaps(): StorySpacingGaps {
  if (typeof window === "undefined") return { ...DEFAULT_STORY_SPACING_GAPS };
  try {
    const raw = localStorage.getItem(STORY_SPACING_LS_KEY);
    if (!raw) return { ...DEFAULT_STORY_SPACING_GAPS };
    const o = JSON.parse(raw) as Partial<StorySpacingGaps>;
    return {
      aboveHeadline: clampGap(o.aboveHeadline, DEFAULT_STORY_SPACING_GAPS.aboveHeadline),
      belowHeadline: clampGap(o.belowHeadline, DEFAULT_STORY_SPACING_GAPS.belowHeadline),
      belowImage: clampGap(o.belowImage, DEFAULT_STORY_SPACING_GAPS.belowImage),
      aboveButton: normalizeAboveButtonGap(o.aboveButton, DEFAULT_STORY_SPACING_GAPS.aboveButton),
      belowButton: clampGap(o.belowButton, DEFAULT_STORY_SPACING_GAPS.belowButton),
    };
  } catch {
    return { ...DEFAULT_STORY_SPACING_GAPS };
  }
}

export function saveStorySpacingGaps(gaps: StorySpacingGaps): void {
  try {
    localStorage.setItem(STORY_SPACING_LS_KEY, JSON.stringify(gaps));
  } catch {
    /* quota */
  }
}

function clampGap(v: unknown, fallback: number, max = 160): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v))) : fallback;
}

function normalizeAboveButtonGap(v: unknown, fallback: number): number {
  const next = clampGap(v, fallback);
  return next === LEGACY_WIDE_STORY_BODY_TO_CTA_GAP ? STORY_BODY_TO_CTA_GAP : next;
}

/** Parse story spacing from API request body (matches localStorage slider values). */
export function parseStorySpacingGaps(raw: unknown): StorySpacingGaps | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Partial<StorySpacingGaps>;
  return {
    aboveHeadline: clampGap(o.aboveHeadline, DEFAULT_STORY_SPACING_GAPS.aboveHeadline),
    belowHeadline: clampGap(o.belowHeadline, DEFAULT_STORY_SPACING_GAPS.belowHeadline),
    belowImage: clampGap(o.belowImage, DEFAULT_STORY_SPACING_GAPS.belowImage),
    aboveButton: normalizeAboveButtonGap(o.aboveButton, DEFAULT_STORY_SPACING_GAPS.aboveButton),
    belowButton: clampGap(o.belowButton, DEFAULT_STORY_SPACING_GAPS.belowButton),
  };
}

/** Gap between two consecutive layout units when applying story spacing. */
export function gapBetweenStoryElements(
  current: { id: string },
  next: { id: string } | undefined,
  gaps: StorySpacingGaps,
  fallback = 20
): number {
  if (!next) return 24;
  const c = current.id;
  const n = next.id;

  if (c.startsWith("migrated-sb-") && n.startsWith("migrated-cta-")) return gaps.aboveButton;
  if (c.startsWith("migrated-cta-") && n.startsWith("migrated-sdiv-")) return gaps.belowButton;
  if (c.startsWith("migrated-cta-") && n.startsWith("migrated-st-")) return gaps.belowButton;
  if (c.startsWith("migrated-sb-") && n.startsWith("migrated-sdiv-")) return gaps.belowButton;
  if (c.startsWith("migrated-sb-") && n.startsWith("migrated-st-")) return gaps.belowButton;

  if (c.startsWith("migrated-sdiv-") && (n.startsWith("migrated-st-") || n.startsWith("migrated-si-"))) {
    return gaps.aboveHeadline;
  }
  if (c.startsWith("migrated-st-") && (n.startsWith("migrated-si-") || n.startsWith("migrated-sb-"))) {
    return gaps.belowHeadline;
  }

  if (c === "migrated-story-grid" || c.startsWith("migrated-story-grid")) {
    if (n.startsWith("migrated-sdiv-")) return 48;
    if (n.startsWith("migrated-st-")) return 48;
  }
  if (n === "migrated-story-grid" || n.startsWith("migrated-story-grid")) return 48;

  if (c.startsWith("migrated-si-") && n.startsWith("migrated-sb-")) return gaps.belowImage;
  if (c.startsWith("migrated-si-") && n.startsWith("migrated-cta-")) return gaps.aboveButton;
  if (c.startsWith("migrated-st-") && n.startsWith("migrated-sb-")) return gaps.belowHeadline;
  if (c.startsWith("migrated-st-") && n.startsWith("migrated-si-")) return gaps.belowHeadline;

  if (c.startsWith("migrated-bt-") && n.startsWith("migrated-cta-")) return gaps.aboveButton;
  if (c.startsWith("migrated-bt-") && n.startsWith("migrated-bi-")) return 20;

  if (c === "migrated-mission" && n === "migrated-div1") return 16;
  if (c === "migrated-mission-hd" && n === "migrated-mission") return 8;
  if (c === "migrated-div1" && n === "migrated-title") return 16;
  if (c === "migrated-title" && n === "migrated-div2") return 12;
  if (c === "migrated-div2" && n === "migrated-greeting-hd") return 14;
  if (c === "migrated-title" && n === "migrated-greeting-hd") return 52;
  if (c === "migrated-greeting-hd" && n === "migrated-div2") return 14;
  if (c === "migrated-div2" && n === "migrated-greeting") return 16;

  return fallback;
}
