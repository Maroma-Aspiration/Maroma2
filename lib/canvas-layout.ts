import type {
  CanvasCtaEl,
  CanvasEl,
  CanvasImageEl,
  CanvasStoryGridEl,
  CanvasTextEl,
  NewsletterCanvas,
} from "./story-types";
import {
  DEFAULT_STORY_SPACING_GAPS,
  gapBetweenStoryElements,
  type StorySpacingGaps,
} from "./story-spacing-gaps";

/** Newsletter canvas coordinate width (matches editor + email scale source). */
export const NEWSLETTER_CANVAS_WIDTH = 716;

const isImage = (e: CanvasEl): e is CanvasImageEl => e.kind === "image";
const isDivider = (e: CanvasEl): e is import("./story-types").CanvasDividerEl =>
  e.kind === "divider";
const isStoryGrid = (e: CanvasEl): e is CanvasStoryGridEl => e.kind === "story-grid";
const isCta = (e: CanvasEl): e is import("./story-types").CanvasCtaEl => e.kind === "cta";

export function isSpacingLocked(e: CanvasEl): boolean {
  return !!(e as { spacingLocked?: boolean }).spacingLocked;
}

/** Clear manual spacing locks — run before ⇕ Apply spacing. */
export function clearSpacingLocks(elements: CanvasEl[]): CanvasEl[] {
  return elements.map((e) => {
    if (!(e as { spacingLocked?: boolean }).spacingLocked) return e;
    const next = { ...e } as CanvasEl & { spacingLocked?: boolean };
    delete next.spacingLocked;
    return next;
  });
}
const isText = (e: CanvasEl): e is CanvasTextEl => e.kind === "text";

function estimateTextHeight(el: CanvasTextEl): number {
  const plain = el.html.replace(/<[^>]+>/g, " ").trim();
  const charsPerLine = Math.max(1, Math.floor(el.w / (el.fontSize * 0.55)));
  const contentLines = Math.ceil(plain.length / charsPerLine);
  const paraBreaks = el.html.split(/<\/p>|<br/gi).length - 1;
  const blockTags = el.html.match(/<p[\s>]/gi)?.length ?? 0;
  const lineCount = Math.max(contentLines, blockTags, 1) + Math.max(0, paraBreaks);
  return Math.max(40, lineCount * el.fontSize * el.lineHeight + 20);
}

/** Strip HTML to plain text for story body height. */
function storyBodyParagraphs(html: string): string[] {
  const parts = html
    .split(/<\/p>/i)
    .map((p) =>
      p
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;|&#160;/gi, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
  if (parts.length > 0) return parts;
  const plain = html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain ? [plain] : [];
}

/** Story body block height at explicit render width + font size. */
export function storyBodyInkHeightAt(
  el: CanvasTextEl,
  widthPx: number,
  fontSizePx: number,
): number {
  const paragraphs = storyBodyParagraphs(el.html);
  if (paragraphs.length === 0) return 0;
  const charsPerLine = Math.max(1, Math.floor(widthPx / (fontSizePx * 0.55)));
  const lineH = fontSizePx * el.lineHeight;
  let totalLines = 0;
  for (const para of paragraphs) {
    totalLines += Math.max(1, Math.ceil(para.length / charsPerLine));
  }
  const paraGap = Math.max(0, paragraphs.length - 1) * fontSizePx * 0.65;
  return Math.ceil(totalLines * lineH + paraGap);
}

/** Story body block height — paragraph-aware ink; never use stale saved measurements. */
export function storyBodyInkHeight(el: CanvasTextEl): number {
  return storyBodyInkHeightAt(el, el.w, el.fontSize);
}

const EMAIL_RENDER_W = 600;

/** Story body height as rendered in 600px-wide email (scaled font + width). */
export function emailRenderStoryBodyInkHeight(el: CanvasTextEl): number {
  const fontSize = Math.max(11, Math.round((el.fontSize / NEWSLETTER_CANVAS_WIDTH) * EMAIL_RENDER_W));
  const width = (el.w / NEWSLETTER_CANVAS_WIDTH) * EMAIL_RENDER_W;
  return storyBodyInkHeightAt(el, width, fontSize);
}

const GRID_H_PAD = 56;
const GRID_CARD_GAP = 12;
const GRID_HEADING_H = 54;
/** Top + bottom padding on `.nl-story-grid-el` — must match StoryGridElView. */
const GRID_PAD_TOP = 36;
const GRID_PAD_BOTTOM = 40;

/** Gap between TOP STORIES block and first story section (divider / headline). */
export const STORY_GRID_TO_SECTION_GAP = 76;

function storyGridCardWidth(columns: number, canvasW = NEWSLETTER_CANVAS_WIDTH): number {
  return (canvasW - GRID_H_PAD - (columns - 1) * GRID_CARD_GAP) / columns;
}

function estimateStoryGridCardHeight(
  card: { title: string; excerpt?: string; imageUrl?: string },
  columns: number,
  canvasW = NEWSLETTER_CANVAS_WIDTH,
): number {
  const cardW = storyGridCardWidth(columns, canvasW);
  const imgH = card.imageUrl ? Math.round(cardW * 0.75) : 0;
  // Match `.nl-sgrid-card-body` + title/excerpt min-heights in globals.css
  const bodyPad = 14 + 22;
  const bodyGap = 10;
  const titleInk = Math.ceil(14 * 1.35 * 3);
  const excerptInk = card.excerpt?.trim() ? Math.ceil(12 * 1.5 * 5) : 0;
  return imgH + bodyPad + bodyGap + titleInk + excerptInk;
}

/** Match `.nl-story-grid-el` card rows (heading + 4:3 image + title/excerpt). */
export function estimateStoryGridHeight(el: CanvasStoryGridEl): number {
  const cols = el.columns;
  const stories = el.stories;
  if (stories.length === 0) return GRID_PAD_TOP + GRID_HEADING_H + GRID_PAD_BOTTOM + 200;
  const rowCount = Math.ceil(stories.length / cols);
  let cardsH = 0;
  for (let r = 0; r < rowCount; r++) {
    const rowCards = stories.slice(r * cols, r * cols + cols);
    cardsH += Math.max(...rowCards.map((c) => estimateStoryGridCardHeight(c, cols)), 200);
  }
  const heading = el.headingText ? GRID_HEADING_H : 0;
  return GRID_PAD_TOP + heading + cardsH + Math.max(0, rowCount - 1) * GRID_CARD_GAP + GRID_PAD_BOTTOM;
}

/** Prefer painted grid height; ignore stale saved measurements that exceed estimate. */
export function mergeStoryGridMeasuredHeight(
  est: number,
  dom: number,
  prev: number,
): number {
  if (dom > 0) return Math.min(dom, est + 16);
  if (prev > 0 && prev <= est + 16) return prev;
  return est;
}

/** Painted height of TOP STORIES for layout floor (never leave a gap under the grid). */
export function storyGridVisualHeight(
  grid: CanvasStoryGridEl,
  heightOf: (el: CanvasEl) => number = measureElementHeight,
): number {
  const est = estimateStoryGridHeight(grid);
  const measured = heightOf(grid);
  if (measured > est + 32) return est;
  if (measured > 0) return measured;
  return est;
}

/** Never under-estimate TOP STORIES shell height in email — layout floor uses storyGridVisualHeight. */
export function effectiveStoryGridHeight(
  grid: CanvasStoryGridEl,
  heightOf: (el: CanvasEl) => number,
): number {
  return Math.max(heightOf(grid), estimateStoryGridHeight(grid)) + 8;
}

/** Minimum Y for the first story divider / headline — bottom of TOP STORIES + gap. */
export function storyGridLayoutFloor(
  grid: CanvasStoryGridEl,
  heightOf: (el: CanvasEl) => number = measureElementHeight,
): number {
  // The editor can report a transiently short DOM height while card images and
  // fonts settle. Always reserve at least the deterministic full grid height so
  // the first story section cannot rise into the TOP STORIES cards.
  return grid.y + effectiveStoryGridHeight(grid, heightOf) + STORY_GRID_TO_SECTION_GAP;
}

export function measureElementHeight(el: CanvasEl, domH?: number): number {
  if (isImage(el)) return el.h;
  if (isDivider(el)) return Math.max(el.thickness + 8, 12);
  if (isStoryGrid(el)) {
    const est = estimateStoryGridHeight(el);
    const cap = est + 24;
    if (domH !== undefined && domH > 0) {
      if (domH > cap) return cap;
      return domH;
    }
    return est;
  }
  if (isCta(el)) return ctaInkHeight(el);
  if (isText(el)) {
    const h = estimateTextHeight(el);
    // Issue title (large type, tight line-height) needs slack so the welcome line stacks below the glyphs.
    if (el.id === "migrated-title") return h + 14;
    // Laura greeting: paragraph-aware ink so TOP STORIES stays below multi-paragraph welcome copy.
    // Use a tighter chars/line factor than body — proportional fonts wrap more than 0.55 suggests.
    if (el.id === "migrated-greeting") {
      const ink = storyBodyInkHeightAt(el, el.w, el.fontSize * 1.02);
      // Recompute with conservative wrap (≈0.48em avg glyph) via width shrink.
      const conservative = storyBodyInkHeightAt(el, Math.max(120, el.w * 0.88), el.fontSize);
      const base = Math.max(ink, conservative) + 20;
      if (domH !== undefined && domH > 0) return Math.max(domH, base);
      return base;
    }
    // Story headlines: tight ink box — generous estimates leave a persistent gap before the hero image.
    if (/^migrated-st-\d+$/.test(el.id)) return storyHeadlineInkHeight(el);
    // Story body: ink height only — saved measurements must not inflate CTA gap.
    if (/^migrated-sb-\d+$/.test(el.id)) return storyBodyInkHeight(el);
    if (domH !== undefined && domH > 0) return domH;
    return h;
  }
  if (domH !== undefined && domH > 0) return domH;
  return 48;
}

/** Canonical vertical order for poured newsletter elements (stable even when y overlaps). */
export function canvasLayoutOrder(el: CanvasEl): number {
  const id = el.id;

  const fixed: Record<string, number> = {
    "migrated-top": 10,
    "migrated-logo": 20,
    "migrated-portrait": 30,
    "migrated-hero": 40,
    "migrated-mission-hd": 50,
    "migrated-mission": 60,
    "migrated-div1": 70,
    "migrated-title": 80,
    "migrated-div2": 82,
    "migrated-greeting-hd": 85,
    "migrated-greeting": 110,
    "migrated-story-grid": 5000,
  };
  if (id in fixed) return fixed[id];

  const bdiv = id.match(/^migrated-bdiv-(\d+)$/);
  if (bdiv) return 200 + Number(bdiv[1]) * 100;
  const bh = id.match(/^migrated-bh-(\d+)$/);
  if (bh) return 201 + Number(bh[1]) * 100;
  const bt = id.match(/^migrated-bt-(\d+)$/);
  if (bt) return 202 + Number(bt[1]) * 100;
  const bi = id.match(/^migrated-bi-(\d+)$/);
  if (bi) return 203 + Number(bi[1]) * 100;

  const story = id.match(/^migrated-(sdiv|st|si|sb|cta)-(\d+)$/);
  if (story) {
    const si = Number(story[2]);
    const kindOrder: Record<string, number> = { sdiv: 0, st: 1, si: 2, sb: 3, cta: 4 };
    return 6000 + si * 100 + (kindOrder[story[1]] ?? 0);
  }

  // User-placed elements: preserve relative order by y, after migrated content
  return 50_000 + el.y;
}

export function sortByLayoutOrder(els: CanvasEl[]): CanvasEl[] {
  return [...els].sort((a, b) => {
    const oa = canvasLayoutOrder(a);
    const ob = canvasLayoutOrder(b);
    if (oa !== ob) return oa - ob;
    return a.id.localeCompare(b.id);
  });
}

/** Banner / logo / portrait / hero overlap — user-positioned, not restacked vertically. */
export const MASTHEAD_OVERLAY_IDS = new Set([
  "migrated-top",
  "migrated-logo",
  "migrated-portrait",
  "migrated-hero",
]);

export function isMastheadOverlayImage(el: CanvasEl): boolean {
  return isImage(el) && MASTHEAD_OVERLAY_IDS.has(el.id);
}

/** Masthead tiles are independent — never montage-grouped. */
export function clearMastheadMontage(elements: CanvasEl[]): CanvasEl[] {
  return elements.map((e) => {
    if (!isImage(e) || !MASTHEAD_OVERLAY_IDS.has(e.id)) return e;
    if (!e.montageGroup && e.montageIndex === undefined && e.montageCols === undefined) return e;
    const next = { ...e } as CanvasImageEl;
    delete next.montageGroup;
    delete next.montageIndex;
    delete next.montageCols;
    return next;
  });
}

/** Masthead images overlap by design — preserve their Y, only advance the stack cursor. */
function isMastheadStackUnit(el: CanvasEl): boolean {
  return isImage(el) && MASTHEAD_OVERLAY_IDS.has(el.id);
}

/** Montage tiles are user-positioned — preserve each member's Y within the group. */
function isMontageStackUnit(el: CanvasEl): boolean {
  return isImage(el) && !!el.montageGroup;
}

/** Move every id in a layout unit by the same delta (preserves montage mosaic offsets). */
function placeUnitAtCursor(
  unit: LayoutUnit,
  elements: CanvasEl[],
  heightOf: (el: CanvasEl) => number,
  placedTop: number,
  yById: Map<string, number>,
): number {
  const delta = placedTop - unit.top;
  let unitBottom = placedTop;
  for (const id of unit.ids) {
    const el = elements.find((e) => e.id === id);
    if (el) {
      const ny = Math.max(0, el.y + delta);
      yById.set(id, ny);
      unitBottom = Math.max(unitBottom, ny + heightOf(el));
    }
  }
  return unitBottom;
}

export type LayoutUnit = {
  order: number;
  top: number;
  height: number;
  ids: Set<string>;
  locked: boolean;
  representative: CanvasEl;
};

export function buildLayoutUnits(
  elements: CanvasEl[],
  heightOf: (el: CanvasEl) => number,
): LayoutUnit[] {
  const montageMemberIds = new Set<string>();
  const montageGroups = new Map<string, CanvasImageEl[]>();

  for (const e of elements) {
    if (isImage(e) && e.montageGroup && !MASTHEAD_OVERLAY_IDS.has(e.id)) {
      if (!montageGroups.has(e.montageGroup)) montageGroups.set(e.montageGroup, []);
      montageGroups.get(e.montageGroup)!.push(e);
      montageMemberIds.add(e.id);
    }
  }

  const units: LayoutUnit[] = [];

  for (const group of montageGroups.values()) {
    const top = Math.min(...group.map((e) => e.y));
    const bottom = Math.max(...group.map((e) => e.y + e.h));
    const rep = [...group].sort((a, b) => canvasLayoutOrder(a) - canvasLayoutOrder(b))[0];
    units.push({
      order: Math.min(...group.map(canvasLayoutOrder)),
      top,
      height: bottom - top,
      ids: new Set(group.map((e) => e.id)),
      locked: group.every((e) => (e as { locked?: boolean }).locked),
      representative: rep,
    });
  }

  for (const e of elements) {
    if (montageMemberIds.has(e.id)) continue;
    units.push({
      order: canvasLayoutOrder(e),
      top: e.y,
      height: heightOf(e),
      ids: new Set([e.id]),
      locked: !!(e as { locked?: boolean }).locked,
      representative: e,
    });
  }

  units.sort((a, b) => a.order - b.order || a.top - b.top);
  return units;
}

  /** Stack all units top-to-bottom with measured heights and per-pair gaps. */
export function stackCanvasElements(
  elements: CanvasEl[],
  heightOf: (el: CanvasEl) => number,
  gapFor: (current: CanvasEl, next: CanvasEl | undefined) => number,
  preserveIds: Set<string> = new Set(),
): CanvasEl[] {
  const units = buildLayoutUnits(elements, heightOf);
  if (units.length === 0) return elements;

  /** Lowest Y where body content may begin (below banner / hero / portrait). */
  const mastheadFloor = elements.reduce((max, e) => {
    if (MASTHEAD_OVERLAY_IDS.has(e.id)) {
      return Math.max(max, e.y + heightOf(e));
    }
    return max;
  }, 0);

  let cursor = 0;
  const yById = new Map<string, number>();

  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    const nextUnit = units[i + 1];
    const nxt = nextUnit?.representative;
    const gap = gapFor(unit.representative, nxt);

    if (isMontageStackUnit(unit.representative)) {
      cursor = Math.max(cursor, mastheadFloor);
      if (unitPreserved(unit, preserveIds)) {
        const unitBottom = preserveUnitY(unit, elements, heightOf, yById);
        cursor = Math.max(cursor, unitBottom + gap);
      } else {
        const unitBottom = placeUnitAtCursor(unit, elements, heightOf, cursor, yById);
        cursor = unitBottom + gap;
      }
      continue;
    }

    if (isMastheadStackUnit(unit.representative)) {
      preserveUnitY(unit, elements, heightOf, yById);
      continue;
    }

    if (unitPreserved(unit, preserveIds)) {
      let unitBottom: number;
      if (unit.top < cursor - 0.5) {
        const delta = cursor - unit.top;
        unitBottom = cursor;
        for (const id of unit.ids) {
          const el = elements.find((e) => e.id === id);
          if (el) {
            const ny = el.y + delta;
            yById.set(id, ny);
            unitBottom = Math.max(unitBottom, ny + heightOf(el));
          }
        }
      } else {
        unitBottom = preserveUnitY(unit, elements, heightOf, yById);
      }
      cursor = Math.max(cursor, mastheadFloor, unitBottom + gap);
      continue;
    }

    // Flow content: snap to cursor (compact — ignore stale stored Y).
    cursor = Math.max(cursor, mastheadFloor);
    const unitBottom = placeUnitAtCursor(unit, elements, heightOf, cursor, yById);
    cursor = unitBottom + gap;
  }

  return elements.map((e) => {
    const ny = yById.get(e.id);
    return ny !== undefined ? ({ ...e, y: ny } as CanvasEl) : e;
  });
}

const MASTHEAD_CENTER_IDS = new Set([
  "migrated-top",
  "migrated-logo",
  "migrated-hero",
]);

/** Horizontally center a masthead asset on the 716px canvas (760px full-bleed → x = -22). */
export function mastheadCenterX(width: number, canvasW = NEWSLETTER_CANVAS_WIDTH): number {
  return Math.round((canvasW - width) / 2);
}

/** Full-bleed masthead banner width (760px on 716px canvas → x = -22). */
export const MASTHEAD_BANNER_W = 760;
/** Masthead portrait diameter on canvas (66% of original 168px). */
export const MASTHEAD_PORTRAIT_SIZE = Math.round(168 * 0.66);

/** Rich-text translate(x%, y%) ≈ object-position px offset for object-fit: cover. */
export function legacyTransformToObjectPosition(
  tr: { x: number; y: number; zoom: number },
  width: number,
  height: number,
): { objectPositionX: number; objectPositionY: number; imageZoom: number } {
  return {
    objectPositionX: Math.round((tr.x / 100) * width),
    objectPositionY: Math.round((tr.y / 100) * height),
    imageZoom: Number.isFinite(tr.zoom) && tr.zoom > 0 ? tr.zoom : 1,
  };
}

/** Snap banner / portrait / logo to canvas center — fixes locked or legacy X drift. */
export function ensureMastheadCentered(
  elements: CanvasEl[],
  canvasW = NEWSLETTER_CANVAS_WIDTH,
): CanvasEl[] {
  return elements.map((e) => {
    if (!isImage(e) || !MASTHEAD_CENTER_IDS.has(e.id)) return e;
    const targetX = mastheadCenterX(e.w, canvasW);
    if (Math.abs(e.x - targetX) <= 1) return e;
    const next = { ...e, x: targetX } as CanvasEl;
    if ((e as { locked?: boolean }).locked) {
      (next as { locked?: boolean }).locked = false;
    }
    return next;
  });
}

/**
 * Normalize banner/hero width + horizontal center. Portrait is user-positioned — not touched.
 */
export function ensureMastheadLayout(elements: CanvasEl[]): CanvasEl[] {
  let els = ensureMastheadCentered(elements);

  els = els.map((e) => {
    if (!isImage(e)) return e;

    if (e.id === "migrated-top" || e.id === "migrated-hero") {
      const targetX = mastheadCenterX(MASTHEAD_BANNER_W);
      const changed =
        e.w !== MASTHEAD_BANNER_W || Math.abs(e.x - targetX) > 1;
      if (!changed) return e;
      const next = { ...e, w: MASTHEAD_BANNER_W, x: targetX } as CanvasImageEl;
      if ((e as { locked?: boolean }).locked) {
        (next as { locked?: boolean }).locked = false;
      }
      return next;
    }

    // Portrait: user-positioned in the editor — never auto-snapped here.

    return e;
  });

  return ensureMastheadZOrder(els);
}

/**
 * Masthead paint order: banner/hero under logo, logo under portrait.
 * Portrait sits on the banner/logo seam (matches email masthead). Opaque logo
 * assets must not cover the portrait circle.
 */
export function ensureMastheadZOrder(elements: CanvasEl[]): CanvasEl[] {
  let baseZ = 0;
  for (const e of elements) {
    if (!isImage(e) || !MASTHEAD_OVERLAY_IDS.has(e.id)) continue;
    if (e.id === "migrated-logo" || e.id === "migrated-portrait") continue;
    baseZ = Math.max(baseZ, e.zIndex ?? 1);
  }

  const hasPortrait = elements.some((e) => e.id === "migrated-portrait" && isImage(e));
  const hasLogo = elements.some((e) => e.id === "migrated-logo" && isImage(e));
  if (!hasPortrait && !hasLogo) return elements;

  const logoZ = baseZ + 2;
  const portraitZ = logoZ + 2;

  return elements.map((e) => {
    if (e.id === "migrated-logo" && isImage(e)) {
      return e.zIndex === logoZ ? e : ({ ...e, zIndex: logoZ } as CanvasEl);
    }
    if (e.id === "migrated-portrait" && isImage(e)) {
      return e.zIndex === portraitZ ? e : ({ ...e, zIndex: portraitZ } as CanvasEl);
    }
    return e;
  });
}

/** Copy live masthead overlay images (banner/logo/portrait/hero) onto a fresh-issue canvas. */
export function overlayMastheadFrom(
  source: NewsletterCanvas | undefined,
  target: NewsletterCanvas,
): NewsletterCanvas {
  if (!source?.elements?.length) return target;
  const sourceById = new Map(
    source.elements.filter((e) => MASTHEAD_OVERLAY_IDS.has(e.id)).map((e) => [e.id, e]),
  );
  if (sourceById.size === 0) return target;

  // If the target canvas was empty/disabled, still rebuild from live masthead overlays.
  if (!target.enabled || (target.elements?.length ?? 0) === 0) {
    return {
      enabled: true,
      elements: ensureMastheadZOrder(Array.from(sourceById.values()).map((e) => structuredClone(e))),
      storySpacingGaps: target.storySpacingGaps ?? source.storySpacingGaps,
      measuredHeights: target.measuredHeights,
      dividerDefaults: target.dividerDefaults,
    };
  }

  const used = new Set<string>();
  const elements = target.elements.map((el) => {
    const overlay = sourceById.get(el.id);
    if (!overlay) return el;
    used.add(el.id);
    return structuredClone(overlay);
  });

  for (const [id, overlay] of sourceById) {
    if (!used.has(id)) elements.push(structuredClone(overlay));
  }

  return {
    ...target,
    enabled: true,
    elements: ensureMastheadZOrder(elements),
  };
}

/** Issue title accidentally locked or dragged into the masthead band, or dropped below body content. */
export function issueTitleNeedsReflow(elements: CanvasEl[]): boolean {
  const title = elements.find((e) => e.id === "migrated-title");
  if (!title) return false;

  const grid = elements.find((e) => e.id === "migrated-story-grid");
  if (grid && title.y >= grid.y - 40) return true;

  const anchor =
    elements.find((e) => e.id === "migrated-hero") ??
    elements.find((e) => e.id === "migrated-mission");
  if (!anchor) return false;
  return title.y < anchor.y + measureElementHeight(anchor) * 0.45;
}

export function issueHeadingUsesLegacyDividerOrder(elements: CanvasEl[]): boolean {
  const div2 = elements.find((e) => e.id === "migrated-div2");
  const greetingHd = elements.find((e) => e.id === "migrated-greeting-hd");
  if (!div2 || !greetingHd) return false;
  // Legacy pour: div2 sat between title and welcome subtitle.
  return div2.y < greetingHd.y;
}

/** Issue title + welcome subtitle + framing dividers — always stack as one band. */
export const ISSUE_HEADING_BAND_IDS = new Set([
  "migrated-div1",
  "migrated-title",
  "migrated-greeting-hd",
  "migrated-div2",
]);

export type RelayoutOptions = {
  /** Snap flow blocks to the stack cursor (Apply spacing, export, initial layout). */
  compact?: boolean;
  /** Clear locks on the title band and re-stack it fresh (div1 → title → div2 → welcome). */
  resetIssueHeading?: boolean;
  /** Keep stored Y for these ids while compacting everything else (e.g. user drag). */
  preserveIds?: Set<string>;
};

/** Ids to pin during compact reflow when the user moves an element vertically. */
export function pinIdsForElement(el: CanvasEl, elements: CanvasEl[]): Set<string> {
  const ids = new Set<string>();
  if (isImage(el) && el.montageGroup) {
    for (const e of elements) {
      if (isImage(e) && e.montageGroup === el.montageGroup) ids.add(e.id);
    }
    return ids;
  }
  ids.add(el.id);
  return ids;
}

function unitPreserved(unit: LayoutUnit, preserveIds: Set<string>): boolean {
  if (isMastheadStackUnit(unit.representative)) return true;
  if (isImage(unit.representative) && unit.representative.montageDetached) return true;
  if (isSpacingLocked(unit.representative)) return true;
  for (const id of unit.ids) {
    if (preserveIds.has(id)) return true;
  }
  return false;
}

function preserveUnitY(
  unit: LayoutUnit,
  elements: CanvasEl[],
  heightOf: (el: CanvasEl) => number,
  yById: Map<string, number>,
): number {
  let unitBottom = unit.top;
  for (const id of unit.ids) {
    const el = elements.find((e) => e.id === id);
    if (el) {
      yById.set(id, el.y);
      unitBottom = Math.max(unitBottom, el.y + heightOf(el));
    }
  }
  return unitBottom;
}

/** Strip legacy lock flags — editor uses free positioning. */
export function stripLockedFlags(elements: CanvasEl[]): CanvasEl[] {
  return elements.map((e) => {
    if (!(e as { locked?: boolean }).locked) return e;
    const next = { ...e } as CanvasEl & { locked?: boolean };
    delete next.locked;
    return next;
  });
}
/** Clear saved locks on the issue heading band so compact can rebuild it. */
export function resetIssueHeadingBand(elements: CanvasEl[]): CanvasEl[] {
  return elements.map((e) => {
    if (!ISSUE_HEADING_BAND_IDS.has(e.id)) return e;
    const next = { ...e } as CanvasEl & { locked?: boolean };
    delete next.locked;
    return next;
  });
}

export function unlockIssueHeadingForStack(elements: CanvasEl[]): CanvasEl[] {
  if (!issueHeadingUsesLegacyDividerOrder(elements)) return elements;
  return resetIssueHeadingBand(elements);
}

export function unlockMisplacedIssueHeading(elements: CanvasEl[]): CanvasEl[] {
  if (!issueTitleNeedsReflow(elements)) return elements;
  return resetIssueHeadingBand(elements);
}

/** Canvas px between title ink bottom and welcome subtitle box top. */
export const ISSUE_TITLE_GREETING_GAP = 40;
/** Extra padding above welcome line (applied in canvas + email render). */
export const ISSUE_GREETING_HD_PAD_TOP = 12;

/** Visual height of title glyphs — stack estimates can be shorter than painted type. */
export function issueTitleInkHeight(title: CanvasTextEl): number {
  return Math.ceil(title.fontSize * title.lineHeight + 16);
}

/** Visual height of a CTA pill (padding + optional wrapped label). */
export function ctaInkHeight(el: CanvasCtaEl): number {
  const label = el.label ?? "";
  const charW = el.fontSize * 0.65 + (el.letterSpacing ?? 0);
  const charsPerLine = Math.max(1, Math.floor(el.w / charW));
  const lines = Math.max(1, Math.ceil(label.length / charsPerLine));
  return Math.ceil(32 + lines * el.fontSize * 1.4 + 4);
}

/** Visual height of story headline glyphs (stack + gap enforcement). */
export function storyHeadlineInkHeight(el: CanvasTextEl): number {
  const plain = el.html.replace(/<[^>]+>/g, " ").trim();
  const charsPerLine = Math.max(1, Math.floor(el.w / (el.fontSize * 0.52)));
  const lines = Math.max(1, Math.ceil(plain.length / charsPerLine));
  return Math.ceil(lines * el.fontSize * el.lineHeight + 2);
}

/** Bottom Y of a story hero + montage siblings when the hero anchor moves to anchorY. */
function storyImageBlockBottom(
  elements: CanvasEl[],
  si: CanvasImageEl,
  anchorY: number,
): number {
  if (!si.montageGroup) return anchorY + si.h;
  const group = elements.filter(
    (e): e is CanvasImageEl => isImage(e) && e.montageGroup === si.montageGroup,
  );
  if (group.length <= 1) return anchorY + si.h;
  const dy = anchorY - si.y;
  return Math.max(...group.map((t) => t.y + dy + t.h));
}

/** Gap between Laura greeting body and the next block (TOP STORIES / stories). */
export const GREETING_TO_NEXT_GAP = 100;

/** Push TOP STORIES + everything below below the Laura greeting when it grows. */
export function enforceContentBelowGreeting(
  elements: CanvasEl[],
  heightOf: (el: CanvasEl) => number = measureElementHeight,
  gap = GREETING_TO_NEXT_GAP,
): CanvasEl[] {
  const greeting =
    elements.find((e): e is CanvasTextEl => e.id === "migrated-greeting" && e.kind === "text") ??
    elements.find((e): e is CanvasTextEl => e.id === "migrated-greeting-hd" && e.kind === "text");
  if (!greeting) return elements;

  const floor = greeting.y + heightOf(greeting) + gap;
  const greetingOrder = canvasLayoutOrder(greeting);

  const blockers = elements.filter((e) => {
    if (MASTHEAD_OVERLAY_IDS.has(e.id)) return false;
    if (canvasLayoutOrder(e) <= greetingOrder) return false;
    return e.y < floor - 1;
  });
  if (blockers.length === 0) return elements;

  const anchor = blockers.sort((a, b) => canvasLayoutOrder(a) - canvasLayoutOrder(b))[0];
  return pushElementsFromLayoutOrder(elements, canvasLayoutOrder(anchor), floor - anchor.y);
}

/** True when TOP STORIES / later blocks sit inside the Laura greeting band. */
export function contentOverlapsGreeting(
  elements: CanvasEl[],
  heightOf: (el: CanvasEl) => number = measureElementHeight,
  gap = GREETING_TO_NEXT_GAP,
): boolean {
  const greeting =
    elements.find((e): e is CanvasTextEl => e.id === "migrated-greeting" && e.kind === "text") ??
    elements.find((e): e is CanvasTextEl => e.id === "migrated-greeting-hd" && e.kind === "text");
  if (!greeting) return false;
  const floor = greeting.y + heightOf(greeting) + gap;
  const greetingOrder = canvasLayoutOrder(greeting);
  return elements.some(
    (e) =>
      !MASTHEAD_OVERLAY_IDS.has(e.id) &&
      canvasLayoutOrder(e) > greetingOrder &&
      e.y < floor - 1,
  );
}

/** Push every element ordered after TOP STORIES below the full rendered grid. */
export function enforceStoryContentBelowGrid(
  elements: CanvasEl[],
  gaps: StorySpacingGaps = DEFAULT_STORY_SPACING_GAPS,
  heightOf: (el: CanvasEl) => number = measureElementHeight,
): CanvasEl[] {
  const grid = elements.find(
    (e): e is CanvasStoryGridEl => e.id === "migrated-story-grid" && isStoryGrid(e),
  );
  if (!grid) return elements;

  const floor = storyGridLayoutFloor(grid, heightOf);
  const gridOrder = canvasLayoutOrder(grid);
  const blockers = elements.filter((e) => {
    if (e.id === grid.id || MASTHEAD_OVERLAY_IDS.has(e.id)) return false;
    return canvasLayoutOrder(e) > gridOrder && e.y < floor - 1;
  });
  if (blockers.length === 0) return elements;

  const anchor = blockers.sort((a, b) => canvasLayoutOrder(a) - canvasLayoutOrder(b))[0];
  return pushElementsFromLayoutOrder(elements, canvasLayoutOrder(anchor), floor - anchor.y);
}

/** True when any later canvas element sits inside the TOP STORIES band. */
export function firstStorySectionOverlapsGrid(
  elements: CanvasEl[],
  heightOf: (el: CanvasEl) => number = measureElementHeight,
): boolean {
  const grid = elements.find(
    (e): e is CanvasStoryGridEl => e.id === "migrated-story-grid" && isStoryGrid(e),
  );
  if (!grid) return false;
  const floor = storyGridLayoutFloor(grid, heightOf);
  const gridOrder = canvasLayoutOrder(grid);
  return elements.some(
    (e) =>
      e.id !== grid.id &&
      !MASTHEAD_OVERLAY_IDS.has(e.id) &&
      canvasLayoutOrder(e) > gridOrder &&
      e.y < floor - 1,
  );
}

function pushElementsFromLayoutOrder(
  elements: CanvasEl[],
  fromOrder: number,
  delta: number,
): CanvasEl[] {
  if (Math.abs(delta) < 1) return elements;
  return elements.map((e) => {
    if (canvasLayoutOrder(e) < fromOrder) return e;
    if (MASTHEAD_OVERLAY_IDS.has(e.id)) return e;
    const next = { ...e, y: e.y + delta } as CanvasEl;
    if ((e as { locked?: boolean }).locked) {
      (next as { locked?: boolean }).locked = false;
    }
    return next;
  });
}

/** Pull story sections up when they sit below the painted TOP STORIES block. */
export function compactStorySectionsBelowGrid(
  elements: CanvasEl[],
  heightOf: (el: CanvasEl) => number = measureElementHeight,
): CanvasEl[] {
  const grid = elements.find(
    (e): e is CanvasStoryGridEl => e.id === "migrated-story-grid" && isStoryGrid(e),
  );
  if (!grid) return elements;

  const target = storyGridLayoutFloor(grid, heightOf);
  const gridOrder = canvasLayoutOrder(grid);
  const anchor = elements
    .filter((e) => !MASTHEAD_OVERLAY_IDS.has(e.id) && canvasLayoutOrder(e) > gridOrder)
    .sort((a, b) => canvasLayoutOrder(a) - canvasLayoutOrder(b))[0];
  if (!anchor || anchor.y <= target + 8) return elements;

  return pushElementsFromLayoutOrder(
    elements,
    canvasLayoutOrder(anchor),
    target - anchor.y,
  );
}

/** Chain story sections top-to-bottom — divider → headline → image → body → CTA → next section. */
export function enforceStorySectionSpacing(
  elements: CanvasEl[],
  gaps: StorySpacingGaps = DEFAULT_STORY_SPACING_GAPS,
  heightOf: (el: CanvasEl) => number = measureElementHeight,
): CanvasEl[] {
  const byId = new Map(elements.map((e) => [e.id, e]));
  const yById = new Map<string, number>();

  let cursor = 0;
  const grid = byId.get("migrated-story-grid");
  if (grid && isStoryGrid(grid)) {
    cursor = storyGridLayoutFloor(grid, heightOf);
  }

  for (let idx = 0; idx < 50; idx++) {
    const sdiv = byId.get(`migrated-sdiv-${idx}`);
    const st = byId.get(`migrated-st-${idx}`);
    if (!sdiv && !st && !byId.has(`migrated-si-${idx}`)) break;

    if (sdiv && isDivider(sdiv)) {
      if (isSpacingLocked(sdiv)) {
        cursor = Math.max(cursor, sdiv.y + heightOf(sdiv) + gaps.aboveHeadline);
      } else {
        yById.set(sdiv.id, cursor);
        cursor = cursor + heightOf(sdiv) + gaps.aboveHeadline;
      }
    }

    if (!st || st.kind !== "text") continue;

    let y: number;
    if (isSpacingLocked(st)) {
      y = st.y + storyHeadlineInkHeight(st) + gaps.belowHeadline;
      cursor = Math.max(cursor, y);
    } else {
      yById.set(st.id, cursor);
      y = cursor + storyHeadlineInkHeight(st) + gaps.belowHeadline;
    }

    const si = byId.get(`migrated-si-${idx}`);
    if (si && si.kind === "image") {
      const imageGap = gaps.belowImage;
      if (si.montageDetached || isSpacingLocked(si)) {
        y = Math.max(y, si.y + heightOf(si)) + imageGap;
      } else {
        yById.set(si.id, y);
        y = storyImageBlockBottom(elements, si, y) + imageGap;
      }
    }

    const sb = byId.get(`migrated-sb-${idx}`);
    const cta = byId.get(`migrated-cta-${idx}`);

    if (sb && sb.kind === "text") {
      const sbY = isSpacingLocked(sb) ? sb.y : y;
      if (!isSpacingLocked(sb)) yById.set(sb.id, sbY);
      const sbH = storyBodyInkHeight(sb);
      const sbBottom = sbY + sbH;
      if (cta && isCta(cta)) {
        yById.set(cta.id, sbBottom + gaps.aboveButton);
        y = sbBottom + gaps.aboveButton + heightOf(cta) + gaps.belowButton;
      } else {
        y = sbBottom + gaps.belowButton;
      }
    } else if (cta && isCta(cta)) {
      const ctaY = y + gaps.aboveButton;
      yById.set(cta.id, ctaY);
      y = ctaY + heightOf(cta) + gaps.belowButton;
    } else {
      y += gaps.belowButton;
    }

    cursor = y;
  }

  if (yById.size === 0) return elements;

  return elements.map((e) => {
    const ny = yById.get(e.id);
    if (ny !== undefined) return { ...e, y: ny } as CanvasEl;

    // Montage tiles follow their story hero vertical shift.
    if (isImage(e) && e.montageGroup) {
      for (const [anchorId, anchorY] of yById) {
        const anchor = byId.get(anchorId);
        if (
          anchor?.kind === "image" &&
          anchor.montageGroup === e.montageGroup &&
          anchor.id.startsWith("migrated-si-")
        ) {
          const delta = anchorY - anchor.y;
          if (Math.abs(delta) >= 1) return { ...e, y: e.y + delta } as CanvasEl;
        }
      }
    }
    return e;
  });
}

/** Force welcome subtitle below title — gap tweaks alone miss locked / unstored Y. */
export function enforceIssueTitleGreetingGap(
  elements: CanvasEl[],
  minGap = ISSUE_TITLE_GREETING_GAP,
): CanvasEl[] {
  const title = elements.find((e): e is CanvasTextEl => e.id === "migrated-title" && e.kind === "text");
  const greetingHd = elements.find(
    (e): e is CanvasTextEl => e.id === "migrated-greeting-hd" && e.kind === "text",
  );
  if (!title || !greetingHd) return elements;
  // Respect manual vertical placement from drag or toolbar nudge.
  if (isSpacingLocked(title) || isSpacingLocked(greetingHd)) return elements;

  const titleBottom = title.y + issueTitleInkHeight(title);
  const requiredY = titleBottom + minGap;
  const delta = requiredY - greetingHd.y;
  if (Math.abs(delta) < 1) return elements;

  const fromOrder = canvasLayoutOrder(greetingHd);
  return elements.map((e) => {
    if (canvasLayoutOrder(e) < fromOrder) return e;
    if (isSpacingLocked(e)) return e;
    const next = { ...e, y: e.y + delta } as CanvasEl;
    if ((e as { locked?: boolean }).locked) {
      (next as { locked?: boolean }).locked = false;
    }
    return next;
  });
}

export function paintOrderElements(elements: CanvasEl[]): CanvasEl[] {
  return [...elements].sort((a, b) => {
    const za = a.zIndex ?? 1;
    const zb = b.zIndex ?? 1;
    if (za !== zb) return za - zb;
    const oa = canvasLayoutOrder(a);
    const ob = canvasLayoutOrder(b);
    if (oa !== ob) return oa - ob;
    return a.id.localeCompare(b.id);
  });
}

/** Full-bleed banner width for email export only — editor keeps user dimensions. */
export function normalizeEmailBannerWidth(elements: CanvasEl[]): CanvasEl[] {
  return elements.map((e) => {
    if (!isImage(e) || (e.id !== "migrated-top" && e.id !== "migrated-hero")) return e;
    const targetX = mastheadCenterX(MASTHEAD_BANNER_W);
    if (e.w === MASTHEAD_BANNER_W && Math.abs(e.x - targetX) <= 1) return e;
    return { ...e, w: MASTHEAD_BANNER_W, x: targetX } as CanvasImageEl;
  });
}

/** Full pipeline: optional compact stack + title/welcome gap. Editor uses compact only on demand. */
export function relayoutNewsletterCanvas(
  elements: CanvasEl[],
  gaps: StorySpacingGaps = DEFAULT_STORY_SPACING_GAPS,
  heightOf: (el: CanvasEl) => number = measureElementHeight,
  options: RelayoutOptions = {},
): CanvasEl[] {
  const compact = options.compact ?? false;
  let els = stripLockedFlags(clearMastheadMontage(ensureMastheadZOrder(elements)));

  if (options.resetIssueHeading) {
    els = resetIssueHeadingBand(els);
  }

  if (!compact) return els;

  els = unlockIssueHeadingForStack(unlockMisplacedIssueHeading(els));
  const gapFn = (cur: CanvasEl, nxt: CanvasEl | undefined) =>
    gapBetweenStoryElements(cur, nxt, gaps);
  els = stackCanvasElements(els, heightOf, gapFn, options.preserveIds ?? new Set());
  els = enforceIssueTitleGreetingGap(els);
  els = layoutCanvasStorySpacing(els, gaps, heightOf);
  return els;
}

/** Shared story-spacing pass — editor display and email export must use the same order. */
export function layoutCanvasStorySpacing(
  elements: CanvasEl[],
  gaps: StorySpacingGaps = DEFAULT_STORY_SPACING_GAPS,
  heightOf: (el: CanvasEl) => number = measureElementHeight,
): CanvasEl[] {
  let els = enforceContentBelowGreeting(elements, heightOf);
  els = enforceStoryContentBelowGrid(els, gaps, heightOf);
  els = enforceStorySectionSpacing(els, gaps, heightOf);
  els = compactStorySectionsBelowGrid(els, heightOf);
  els = enforceStoryContentBelowGrid(els, gaps, heightOf);
  els = enforceContentBelowGreeting(els, heightOf);
  return els;
}

/** Single canonical height helper — editor, email, and view-in-browser share this. */
export function canvasLayoutHeightOf(
  measuredHeights?: Record<string, number>,
): (el: CanvasEl) => number {
  return (el: CanvasEl) => measureElementHeight(el, measuredHeights?.[el.id]);
}

/** Canonical element heights for layout (deterministic — no DOM). */
export function collectCanonicalMeasuredHeights(
  elements: CanvasEl[],
  measuredHeights?: Record<string, number>,
): Record<string, number> {
  const heightOf = canvasLayoutHeightOf(measuredHeights);
  const out: Record<string, number> = {};
  for (const el of elements) {
    if (isText(el) && /^migrated-sb-\d+$/.test(el.id)) {
      out[el.id] = storyBodyInkHeight(el);
    } else if (isCta(el)) {
      out[el.id] = ctaInkHeight(el);
    } else if (isStoryGrid(el)) {
      const est = estimateStoryGridHeight(el);
      const dom = measuredHeights?.[el.id] ?? 0;
      out[el.id] = mergeStoryGridMeasuredHeight(est, dom, dom);
    } else {
      const h = heightOf(el);
      if (h > 0) out[el.id] = h;
    }
  }
  return out;
}

/** Story-spacing layout with full vertical compact stack beneath the masthead. */
export function syncCanvasStoryLayout(
  elements: CanvasEl[],
  gaps: StorySpacingGaps = DEFAULT_STORY_SPACING_GAPS,
  measuredHeights?: Record<string, number>,
): { elements: CanvasEl[]; measuredHeights: Record<string, number> } {
  const heightOf = canvasLayoutHeightOf(measuredHeights);
  const stacked = relayoutNewsletterCanvas(
    clearSpacingLocks(elements),
    gaps,
    heightOf,
    { compact: true },
  );
  const ordered = paintOrderElements(stacked);
  return {
    elements: ordered,
    measuredHeights: collectCanonicalMeasuredHeights(ordered, measuredHeights),
  };
}

/** Height helper from a canvas snapshot (same as canvasLayoutHeightOf). */
export function canvasHeightOf(
  canvas: { measuredHeights?: Record<string, number> },
): (el: CanvasEl) => number {
  return canvasLayoutHeightOf(canvas.measuredHeights);
}

/** Export: preserve editor Y, then normalise story-section gaps for send. */
export function prepareCanvasForEmailExport(
  elements: CanvasEl[],
  gaps: StorySpacingGaps = DEFAULT_STORY_SPACING_GAPS,
): CanvasEl[] {
  let els = stripLockedFlags(clearMastheadMontage(ensureMastheadZOrder(elements)));
  els = normalizeEmailBannerWidth(els);
  return paintOrderElements(els);
}

/** Final pass after montage layout — delegates to syncCanvasStoryLayout. */
export function finalizeCanvasForEmailExport(
  elements: CanvasEl[],
  gaps: StorySpacingGaps = DEFAULT_STORY_SPACING_GAPS,
  measuredHeights?: Record<string, number>,
): CanvasEl[] {
  return syncCanvasStoryLayout(elements, gaps, measuredHeights).elements;
}

/** Scaled export height in canvas px (716-wide coordinate system). */
export function canvasExportHeightCanvasPx(
  elements: CanvasEl[],
  heightOf: (el: CanvasEl) => number = measureElementHeight,
): number {
  if (elements.length === 0) return 400;
  const minY = Math.min(0, ...elements.map((e) => e.y));
  let bottom = 0;
  for (const el of elements) {
    bottom = Math.max(bottom, el.y - minY + heightOf(el));
  }
  return bottom + 80;
}

export function canvasExportMinY(elements: CanvasEl[]): number {
  if (elements.length === 0) return 0;
  return Math.min(0, ...elements.map((e) => e.y));
}

export function pushElementsAfter(
  elements: CanvasEl[],
  anchorId: string,
  delta: number,
  excludeIds: Set<string>,
): CanvasEl[] {
  if (delta === 0) return elements;

  const anchor = elements.find((e) => e.id === anchorId);
  if (!anchor) return elements;

  let anchorOrder = canvasLayoutOrder(anchor);
  if (isImage(anchor) && anchor.montageGroup) {
    const group = elements.filter(
      (e): e is CanvasImageEl => isImage(e) && e.montageGroup === anchor.montageGroup,
    );
    anchorOrder = Math.max(...group.map(canvasLayoutOrder));
    for (const e of group) excludeIds.add(e.id);
  } else {
    excludeIds.add(anchorId);
  }

  return elements.map((e) => {
    if (excludeIds.has(e.id)) return e;
    if ((e as { locked?: boolean }).locked) return e;
    if (MASTHEAD_OVERLAY_IDS.has(e.id)) return e;
    if (canvasLayoutOrder(e) > anchorOrder) {
      return { ...e, y: Math.max(0, e.y + delta) } as CanvasEl;
    }
    return e;
  });
}
