/**
 * Single layout pipeline for canvas editor, email export, and view-in-browser.
 * Editor display and email must call layoutNewsletterCanvas — never diverge.
 */

import type { CanvasEl, NewsletterCanvas } from "./story-types";
import { applyAllMontageLayouts } from "./canvas-montage";
import {
  canvasLayoutHeightOf,
  clearMastheadMontage,
  ensureMastheadZOrder,
  emailRenderStoryBodyInkHeight,
  normalizeEmailBannerWidth,
  paintOrderElements,
  syncCanvasStoryLayout,
} from "./canvas-layout";
import {
  DEFAULT_STORY_SPACING_GAPS,
  type StorySpacingGaps,
} from "./story-spacing-gaps";

export type LaidOutNewsletterCanvas = {
  elements: CanvasEl[];
  measuredHeights: Record<string, number>;
  storySpacingGaps: StorySpacingGaps;
  heightOf: (el: CanvasEl) => number;
};

/** Canonical layout — montage → story spacing → montage. Same in editor + email. */
export function layoutNewsletterCanvas(
  canvas: Pick<NewsletterCanvas, "elements" | "measuredHeights" | "storySpacingGaps">,
  gapsOverride?: StorySpacingGaps,
): LaidOutNewsletterCanvas {
  const gaps = canvas.storySpacingGaps ?? gapsOverride ?? DEFAULT_STORY_SPACING_GAPS;
  let els = ensureMastheadZOrder(canvas.elements);
  els = applyAllMontageLayouts(els);
  const synced = syncCanvasStoryLayout(els, gaps, canvas.measuredHeights);
  els = applyAllMontageLayouts(synced.elements);
  els = ensureMastheadZOrder(els);
  const measuredHeights = synced.measuredHeights;
  return {
    elements: els,
    measuredHeights,
    storySpacingGaps: gaps,
    heightOf: canvasLayoutHeightOf(measuredHeights),
  };
}

/** Email-only: snap CTA Y to scaled render height so gap matches visible text. */
export function snapStoryCtasForEmailRender(elements: CanvasEl[]): CanvasEl[] {
  const byId = new Map(elements.map((e) => [e.id, e]));
  return elements.map((el) => {
    if (el.kind !== "cta") return el;
    const m = el.id.match(/^migrated-cta-(\d+)$/);
    if (!m) return el;
    const sb = byId.get(`migrated-sb-${m[1]}`);
    if (!sb || sb.kind !== "text") return el;
    const emailSbH = emailRenderStoryBodyInkHeight(sb);
    return { ...el, y: sb.y + emailSbH + DEFAULT_STORY_SPACING_GAPS.aboveButton };
  });
}

/** Email-only visual tweaks (banner width, z-order) — does not change Y or re-layout. */
export function normalizeCanvasVisualsForEmail(elements: CanvasEl[]): CanvasEl[] {
  let els = clearMastheadMontage(ensureMastheadZOrder(elements));
  els = normalizeEmailBannerWidth(els);
  return paintOrderElements(els);
}
