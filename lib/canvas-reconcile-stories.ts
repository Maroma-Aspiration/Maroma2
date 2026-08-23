/**
 * Repair newsletter canvas when TOP STORIES layout drifts or individual story
 * sections are missing after archive restore.
 */

import {
  clearSpacingLocks,
  ensureMastheadZOrder,
  estimateStoryGridHeight,
  measureElementHeight,
  storyGridLayoutFloor,
  syncCanvasStoryLayout,
} from "./canvas-layout";
import { plainTextFromHtml } from "./newsletter-archive-utils";
import { normalizeStoryImageFrame } from "./story-image-frame";
import { STORY_BODY_TO_CTA_GAP } from "./story-spacing-gaps";
import type {
  CanvasCtaEl,
  CanvasDividerEl,
  CanvasEl,
  CanvasImageEl,
  CanvasStoryGridEl,
  CanvasTextEl,
  NewsletterCanvas,
  StoriesState,
  StoryImageFrame,
  StoryRecord,
} from "./story-types";

const STORY_SECTION_RE = /^migrated-(sdiv|st|si|sb|cta)-\d+$/;

function storySlugFromTitle(title: string, fallback: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || fallback;
}

function storyFrameCanvasHeight(frame?: StoryImageFrame | null, width = 660): number {
  const f = normalizeStoryImageFrame(frame);
  const maxPx = f.maxHeightPx > 0 ? f.maxHeightPx : 360;
  const ar = f.aspectRatio.trim();
  if (!ar) return maxPx;
  const match = ar.match(/^\s*([0-9.]+)\s*\/\s*([0-9.]+)\s*$/);
  if (!match) return maxPx;
  const w = Number(match[1]);
  const h = Number(match[2]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return maxPx;
  return Math.min(maxPx, Math.round((width * h) / w));
}

function bodyTextColorFromCanvas(elements: CanvasEl[]): string {
  const greeting = elements.find((e) => e.id === "migrated-greeting" && e.kind === "text") as
    | CanvasTextEl
    | undefined;
  if (greeting?.color) return greeting.color;
  const grid = elements.find((e) => e.id === "migrated-story-grid" && e.kind === "story-grid") as
    | CanvasStoryGridEl
    | undefined;
  return grid?.textColor || "#1a4a52";
}

export function canvasHasIndividualStorySections(canvas: NewsletterCanvas | undefined): boolean {
  return (canvas?.elements ?? []).some((e) => /^migrated-st-\d+$/.test(e.id));
}

/** Never let stale DOM / saved heights inflate TOP STORIES layout floor. */
export function sanitizeStoryGridMeasuredHeights(canvas: NewsletterCanvas): NewsletterCanvas {
  if (!canvas.enabled) return canvas;
  const grid = canvas.elements.find(
    (e): e is CanvasStoryGridEl => e.id === "migrated-story-grid" && e.kind === "story-grid",
  );
  if (!grid) return canvas;

  const cap = estimateStoryGridHeight(grid) + 16;
  const mh = { ...(canvas.measuredHeights ?? {}) };
  const prev = mh["migrated-story-grid"];
  if (prev === undefined || prev <= cap) {
    delete mh["migrated-story-grid"];
    return { ...canvas, measuredHeights: Object.keys(mh).length ? mh : undefined };
  }
  mh["migrated-story-grid"] = cap;
  return { ...canvas, measuredHeights: mh };
}

/** Pull story sections back up when a bad grid height pushed them far below TOP STORIES. */
export function reanchorDetachedStorySections(elements: CanvasEl[]): CanvasEl[] {
  const grid = elements.find(
    (e): e is CanvasStoryGridEl => e.id === "migrated-story-grid" && e.kind === "story-grid",
  );
  if (!grid) return elements;

  const heightOf = (el: CanvasEl) => measureElementHeight(el);
  const targetTop = storyGridLayoutFloor(grid, heightOf);
  const anchor =
    elements.find((e) => e.id === "migrated-sdiv-0") ??
    elements.find((e) => e.id === "migrated-st-0");
  if (!anchor) return elements;

  if (anchor.y <= targetTop + 8) return elements;

  const delta = anchor.y - targetTop;
  return elements.map((e) => {
    if (!STORY_SECTION_RE.test(e.id)) return e;
    return { ...e, y: e.y - delta } as CanvasEl;
  });
}

export function extractStoriesFromCanvasElements(elements: CanvasEl[]): StoryRecord[] {
  const now = new Date().toISOString();
  const stories: StoryRecord[] = [];

  for (let i = 0; i < 50; i++) {
    const st = elements.find((e) => e.id === `migrated-st-${i}` && e.kind === "text") as
      | CanvasTextEl
      | undefined;
    const sb = elements.find((e) => e.id === `migrated-sb-${i}` && e.kind === "text") as
      | CanvasTextEl
      | undefined;
    const si = elements.find((e) => e.id === `migrated-si-${i}` && e.kind === "image") as
      | CanvasImageEl
      | undefined;
    const cta = elements.find((e) => e.id === `migrated-cta-${i}` && e.kind === "cta") as
      | CanvasCtaEl
      | undefined;
    if (!st && !sb && !si) break;

    const title = st ? plainTextFromHtml(st.html) : "";
    const body = sb?.html ?? "";
    const slug = storySlugFromTitle(title, `story-${i}`);

    stories.push({
      id: `restored-story-${i}`,
      kind: "story",
      slug,
      title,
      excerpt: body ? plainTextFromHtml(body).slice(0, 200) : "",
      body,
      imageUrl: si?.src ?? "",
      sourceUrl: cta?.href ?? "",
      source: "manual",
      ctaUrl: cta?.href ?? "",
      ctaLabel: cta?.label ?? "Read more →",
      publishedAt: now,
      updatedAt: now,
    });
  }

  return stories;
}

/** TOP STORIES cards when full story sections are not on the canvas yet. */
export function extractStoriesFromStoryGrid(elements: CanvasEl[]): StoryRecord[] {
  const grid = elements.find(
    (e): e is CanvasStoryGridEl => e.id === "migrated-story-grid" && e.kind === "story-grid",
  );
  if (!grid?.stories?.length) return [];

  const now = new Date().toISOString();
  return grid.stories
    .map((card, i) => {
      const title = card.title?.trim() ?? "";
      if (!title) return null;
      const excerpt = card.excerpt?.trim() ?? "";
      const slug = storySlugFromTitle(title, `story-${i}`);
      return {
        id: card.storyId?.trim() || `grid-story-${i}`,
        kind: "story" as const,
        slug,
        title,
        excerpt,
        body: excerpt ? `<p>${excerpt}</p>` : "",
        imageUrl: card.imageUrl?.trim() ?? "",
        sourceUrl: "",
        source: "manual" as const,
        ctaUrl: "",
        ctaLabel: "Read more →",
        publishedAt: now,
        updatedAt: now,
      };
    })
    .filter(Boolean) as StoryRecord[];
}

export function resolveStoriesFromCanvas(state: StoriesState): StoryRecord[] {
  const canvas = state.newsletterCanvas;
  if (!canvas?.enabled) return [];
  const elements = canvas.elements ?? [];
  const fromSections = extractStoriesFromCanvasElements(elements);
  if (fromSections.length > 0) return fromSections;
  return extractStoriesFromStoryGrid(elements);
}

export function getPublishableStories(state: StoriesState): StoryRecord[] {
  const saved = (state.stories ?? []).filter((story) => !story.kind || story.kind === "story");
  const withTitle = saved.filter((story) => story.title?.trim());
  if (withTitle.length > 0) return withTitle;
  return resolveStoriesFromCanvas(state).filter((story) => story.title?.trim());
}

function appendStorySections(
  elements: CanvasEl[],
  stories: StoryRecord[],
  bodyTextColor: string,
): CanvasEl[] {
  const byId = new Map(elements.map((e) => [e.id, e]));
  const grid = elements.find(
    (e): e is CanvasStoryGridEl => e.id === "migrated-story-grid" && e.kind === "story-grid",
  );
  if (!grid) return elements;

  const heightOf = (el: CanvasEl) => measureElementHeight(el);
  let y = storyGridLayoutFloor(grid, heightOf);
  const next = [...elements];

  stories.forEach((story, si) => {
    if (byId.has(`migrated-st-${si}`) || byId.has(`migrated-sb-${si}`)) {
      const existing = byId.get(`migrated-cta-${si}`);
      y = Math.max(y, (existing?.y ?? y) + (existing ? heightOf(existing as CanvasEl) + 88 : 0));
      return;
    }

    const divider: CanvasDividerEl = {
      id: `migrated-sdiv-${si}`,
      kind: "divider",
      x: 0,
      y,
      w: 716,
      zIndex: 5,
      color: "rgba(60,140,130,0.35)",
      thickness: 2,
      lineStyle: "solid",
    };
    next.push(divider);
    y += 28;

    if (story.title) {
      const headline: CanvasTextEl = {
        id: `migrated-st-${si}`,
        kind: "text",
        x: 28,
        y,
        w: 660,
        zIndex: 5,
        html: `<p>${story.title}</p>`,
        fontSize: 26,
        fontFamily: "inherit",
        fontWeight: 700,
        color: bodyTextColor,
        textAlign: "left",
        lineHeight: 1.2,
        letterSpacing: 0,
        bg: "",
        borderColor: "rgba(189,208,201,0.4)",
        borderWidth: 0,
        borderRadius: 0,
        shadow: false,
      };
      next.push(headline);
      y += measureElementHeight(headline) + 10;
    }

    const frame = normalizeStoryImageFrame(story.imageFrame);
    const imgW = 660;
    const imgH = storyFrameCanvasHeight(frame, imgW);
    const imgSrc = story.imageUrl || "";
    const image: CanvasImageEl = {
      id: `migrated-si-${si}`,
      kind: "image",
      x: 28,
      y,
      w: imgW,
      h: imgH,
      zIndex: 5,
      src: imgSrc,
      borderRadius: 8,
      objectFit: frame.objectFit ?? "cover",
      objectPositionX: frame.offsetX ?? 0,
      objectPositionY: frame.offsetY ?? 0,
      imageZoom: frame.zoom ?? 1,
      shadow: false,
    };
    next.push(image);
    y += imgH + 16;

    const bodyHtml = story.body || (story.excerpt ? `<p>${story.excerpt}</p>` : "");
    if (bodyHtml.trim()) {
      const body: CanvasTextEl = {
        id: `migrated-sb-${si}`,
        kind: "text",
        x: 28,
        y,
        w: 660,
        zIndex: 5,
        html: bodyHtml,
        fontSize: 16,
        fontFamily: "inherit",
        fontWeight: 400,
        color: bodyTextColor,
        textAlign: "left",
        lineHeight: 1.65,
        letterSpacing: 0,
        bg: "",
        borderColor: "rgba(189,208,201,0.4)",
        borderWidth: 0,
        borderRadius: 0,
        shadow: false,
      };
      next.push(body);
      y += measureElementHeight(body) + STORY_BODY_TO_CTA_GAP;
    } else {
      y += STORY_BODY_TO_CTA_GAP;
    }

    const cta: CanvasCtaEl = {
      id: `migrated-cta-${si}`,
      kind: "cta",
      x: 28,
      y,
      w: 200,
      zIndex: 5,
      label: story.ctaLabel || "Read more →",
      href: story.ctaUrl || story.sourceUrl || "",
      bgFrom: "#0e7490",
      bgTo: "#10b981",
      textColor: "#ffffff",
      borderRadius: 50,
      fontSize: 13,
      fontWeight: 700,
      letterSpacing: 1.5,
    };
    next.push(cta);
    y += 88;
  });

  return ensureMastheadZOrder(next);
}

/** Fix grid height drift, re-anchor sections, and rebuild missing story blocks. */
export function reconcileNewsletterCanvasState(state: StoriesState): StoriesState {
  const canvas = state.newsletterCanvas;
  if (!canvas?.enabled) return state;

  let elements = canvas.elements ?? [];
  let measuredHeights = canvas.measuredHeights;
  let sanitized = sanitizeStoryGridMeasuredHeights({ ...canvas, elements, measuredHeights });
  elements = sanitized.elements;
  measuredHeights = sanitized.measuredHeights;

  elements = reanchorDetachedStorySections(elements);
  elements = clearSpacingLocks(elements);

  let stories = (state.stories ?? []).filter((s) => !s.kind || s.kind === "story");
  const hasGrid = elements.some((e) => e.id === "migrated-story-grid");
  const hasSections = canvasHasIndividualStorySections({ ...canvas, elements });

  if (stories.length === 0) {
    stories = resolveStoriesFromCanvas({ ...state, newsletterCanvas: { ...canvas, elements } });
  }

  if (hasGrid && !hasSections && stories.length > 0) {
    elements = appendStorySections(elements, stories, bodyTextColorFromCanvas(elements));
  }

  const synced = syncCanvasStoryLayout(elements, canvas.storySpacingGaps, measuredHeights);

  const nextStories =
    stories.length > 0 && (state.stories ?? []).filter((s) => !s.kind || s.kind === "story").length === 0
      ? stories
      : state.stories;

  return {
    ...state,
    stories: nextStories,
    newsletterCanvas: {
      ...canvas,
      elements: synced.elements,
      measuredHeights: synced.measuredHeights,
    },
  };
}
