import type { CanvasEl, CanvasImageEl } from "./story-types";
import {
  MASTHEAD_OVERLAY_IDS,
  NEWSLETTER_CANVAS_WIDTH,
  clearMastheadMontage,
  isMastheadOverlayImage,
} from "./canvas-layout";

const CANVAS_COL_X = 28;
const CANVAS_COL_W = 660;
/** Match `.newsletter-story-montage { gap: 9px }` */
const MONTAGE_GAP = 9;

/** Default corner radius per montage tile (matches legacy block editor). */
export const MONTAGE_DEFAULT_BORDER_RADIUS = 8;

type MontageSlot = { c: number; r: number; cs?: number; rs?: number };

type MontageSpec = {
  aspect: number;
  cols: number[];
  rows: number[];
  hero: MontageSlot;
  /** One slot per satellite, in montageIndex order (excluding hero). */
  sats: MontageSlot[];
};

/** Match `.newsletter-story-montage { gap: 9px }` — exported for email HTML. */
export const MONTAGE_EMAIL_GAP = MONTAGE_GAP;

export type MontageLayoutSpec = MontageSpec;

/** Mosaic grid template for N tiles (2–9). */
export function montageLayoutSpec(count: number): MontageLayoutSpec {
  return getMontageSpec(count);
}

/** Match `.newsletter-story-montage-{n}` CSS grid templates. */
function getMontageSpec(count: number): MontageSpec {
  const n = Math.min(Math.max(count, 2), 9);
  switch (n) {
    case 2:
      return {
        aspect: 16 / 9,
        cols: [1.9, 1],
        rows: [1],
        hero: { c: 0, r: 0 },
        sats: [{ c: 1, r: 0 }],
      };
    case 3:
      return {
        aspect: 16 / 9,
        cols: [1.9, 1],
        rows: [1, 1],
        hero: { c: 0, r: 0, rs: 2 },
        sats: [
          { c: 1, r: 0 },
          { c: 1, r: 1 },
        ],
      };
    case 4:
      return {
        aspect: 4 / 3,
        cols: [2, 1],
        rows: [1, 1, 1],
        hero: { c: 0, r: 0, rs: 3 },
        sats: [
          { c: 1, r: 0 },
          { c: 1, r: 1 },
          { c: 1, r: 2 },
        ],
      };
    case 5:
      return {
        aspect: 16 / 9,
        cols: [2, 1, 1],
        rows: [1, 1],
        hero: { c: 0, r: 0, rs: 2 },
        sats: [
          { c: 1, r: 0 },
          { c: 2, r: 0 },
          { c: 1, r: 1 },
          { c: 2, r: 1 },
        ],
      };
    case 6:
      return {
        aspect: 16 / 9,
        cols: [2, 1, 1],
        rows: [1, 1, 1],
        hero: { c: 0, r: 0, rs: 2 },
        sats: [
          { c: 1, r: 0 },
          { c: 2, r: 0 },
          { c: 1, r: 1 },
          { c: 2, r: 1 },
          { c: 0, r: 2, cs: 3 },
        ],
      };
    case 7:
      return {
        aspect: 16 / 11,
        cols: [1.35, 1, 1, 1],
        rows: [1, 1, 1],
        hero: { c: 0, r: 0, cs: 2, rs: 2 },
        sats: [
          { c: 2, r: 0 },
          { c: 3, r: 0 },
          { c: 2, r: 1 },
          { c: 3, r: 1 },
          { c: 0, r: 2 },
          { c: 1, r: 2, cs: 3 },
        ],
      };
    case 8:
      return {
        aspect: 16 / 11,
        cols: [1.35, 1, 1, 1],
        rows: [1, 1, 1],
        hero: { c: 0, r: 0, cs: 2, rs: 2 },
        sats: [
          { c: 2, r: 0 },
          { c: 3, r: 0 },
          { c: 2, r: 1 },
          { c: 3, r: 1 },
          { c: 0, r: 2 },
          { c: 1, r: 2 },
          { c: 2, r: 2, cs: 2 },
        ],
      };
    default: // 9
      return {
        aspect: 16 / 11,
        cols: [1.35, 1, 1, 1],
        rows: [1, 1, 1],
        hero: { c: 0, r: 0, cs: 2, rs: 2 },
        sats: [
          { c: 2, r: 0 },
          { c: 3, r: 0 },
          { c: 2, r: 1 },
          { c: 3, r: 1 },
          { c: 0, r: 2 },
          { c: 1, r: 2 },
          { c: 2, r: 2 },
          { c: 3, r: 2 },
        ],
      };
  }
}

/** Distribute fr tracks so sizes + gaps exactly fill `total` (no leftover pixels). */
function distributeFrTracks(total: number, fr: number[], gap: number): number[] {
  const n = fr.length;
  if (n === 0) return [];
  const gapTotal = gap * (n - 1);
  const usable = total - gapTotal;
  const sum = fr.reduce((a, b) => a + b, 0);
  const raw = fr.map((f) => (usable * f) / sum);
  const sizes = raw.map((v) => Math.floor(v));
  let remainder = usable - sizes.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - sizes[i]! }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; remainder > 0; k++) {
    sizes[order[k % order.length]!.i]! += 1;
    remainder -= 1;
  }
  return sizes;
}

function slotRect(
  originX: number,
  originY: number,
  colWidths: number[],
  rowHeights: number[],
  gap: number,
  slot: MontageSlot,
): { x: number; y: number; w: number; h: number } {
  const cs = slot.cs ?? 1;
  const rs = slot.rs ?? 1;

  let x = originX;
  for (let i = 0; i < slot.c; i++) x += colWidths[i]! + gap;

  let y = originY;
  for (let i = 0; i < slot.r; i++) y += rowHeights[i]! + gap;

  let w = 0;
  for (let i = 0; i < cs; i++) {
    if (i > 0) w += gap;
    w += colWidths[slot.c + i]!;
  }

  let h = 0;
  for (let i = 0; i < rs; i++) {
    if (i > 0) h += gap;
    h += rowHeights[slot.r + i]!;
  }

  return { x, y, w, h };
}

/** Expand edge tiles so the montage bbox exactly fills the target frame. */
function snapMontageToFrame(
  tiles: CanvasImageEl[],
  frameX: number,
  frameY: number,
  frameW: number,
  frameH: number,
): CanvasImageEl[] {
  if (tiles.length === 0) return tiles;

  const minX = Math.min(...tiles.map((t) => t.x));
  const minY = Math.min(...tiles.map((t) => t.y));
  const maxX = Math.max(...tiles.map((t) => t.x + t.w));
  const maxY = Math.max(...tiles.map((t) => t.y + t.h));

  const dx = frameX - minX;
  const dy = frameY - minY;
  const dw = frameX + frameW - maxX;
  const dh = frameY + frameH - maxY;

  return tiles.map((t) => {
    let { x, y, w, h } = t;
    x += dx;
    y += dy;
    if (Math.abs(t.x + t.w - maxX) < 2 && dw !== 0) w += dw;
    if (Math.abs(t.y + t.h - maxY) < 2 && dh !== 0) h += dh;
    return { ...t, x, y, w, h };
  });
}

/** Mosaic layout — hero left, satellites in CSS-grid slots (matches block editor montage). */
export function layoutMontageMosaic(
  group: CanvasImageEl[],
  opts?: {
    originY?: number;
    originX?: number;
    heroId?: string;
    frameW?: number;
    frameH?: number;
  },
): CanvasImageEl[] {
  if (group.length <= 1) return group;

  const sorted = [...group].sort((a, b) => (a.montageIndex ?? 0) - (b.montageIndex ?? 0));
  const originX = opts?.originX ?? CANVAS_COL_X;
  const originY = opts?.originY ?? Math.min(...sorted.map((e) => e.y));
  const totalW = opts?.frameW ?? CANVAS_COL_W;
  const groupId = sorted[0].montageGroup ?? sorted[0].id;
  const radius = (() => {
    const maxStored = Math.max(0, ...sorted.map((e) => montageTileBorderRadius(e)));
    return maxStored > 0 ? maxStored : MONTAGE_DEFAULT_BORDER_RADIUS;
  })();

  let heroIdx = opts?.heroId ? sorted.findIndex((e) => e.id === opts.heroId) : 0;
  if (heroIdx < 0) heroIdx = 0;

  const spec = getMontageSpec(sorted.length);
  const totalH = opts?.frameH ?? Math.round(totalW / spec.aspect);

  const colWidths = distributeFrTracks(totalW, spec.cols, MONTAGE_GAP);
  const rowHeights = distributeFrTracks(totalH, spec.rows, MONTAGE_GAP);

  const hero = sorted[heroIdx];
  const satellites = sorted
    .filter((e) => e.id !== hero.id)
    .sort((a, b) => (a.montageIndex ?? 0) - (b.montageIndex ?? 0));
  const laid = new Map<string, CanvasImageEl>();

  const heroRect = slotRect(originX, originY, colWidths, rowHeights, MONTAGE_GAP, spec.hero);
  laid.set(hero.id, {
    ...hero,
    ...heroRect,
    montageGroup: groupId,
    montageCols: spec.cols.length,
    montageIndex: hero.montageIndex ?? heroIdx,
    borderRadius: radius,
  });

  satellites.forEach((e, i) => {
    const slot = spec.sats[i];
    if (!slot) return;
    const rect = slotRect(originX, originY, colWidths, rowHeights, MONTAGE_GAP, slot);
    laid.set(e.id, {
      ...e,
      ...rect,
      montageGroup: groupId,
      montageCols: spec.cols.length,
      montageIndex: e.montageIndex ?? i + 1,
      borderRadius: radius,
    });
  });

  const placed = sorted.map((e) => laid.get(e.id) ?? e);
  const snapped = snapMontageToFrame(placed, originX, originY, totalW, totalH);
  const customFrame = opts?.frameW !== undefined || opts?.frameH !== undefined;
  return snapped.map((t) => ({
    ...t,
    montageFrameW: customFrame ? totalW : undefined,
    montageFrameH: customFrame ? totalH : undefined,
  }));
}

/** Vertical span of a montage when its hero anchor sits at originY. */
export function montageStackHeight(
  group: CanvasImageEl[],
  originY: number,
  hero?: CanvasImageEl,
): number {
  if (group.length <= 1) return hero?.h ?? group[0]?.h ?? 0;
  const heroEl =
    hero ??
    group.find((e) => /^migrated-si-\d+$/.test(e.id)) ??
    [...group].sort((a, b) => (a.montageIndex ?? 0) - (b.montageIndex ?? 0))[0];
  const laid = layoutMontageMosaic(group, {
    originY,
    heroId: heroEl.id,
  });
  return Math.max(...laid.map((e) => e.y + e.h)) - originY;
}

/** Pick the story hero tile for a montage group (migrated-si-{n} when present). */
export function montageHeroTile(group: CanvasImageEl[]): CanvasImageEl {
  return (
    group.find((e) => /^migrated-si-\d+$/.test(e.id)) ??
    [...group].sort((a, b) => (a.montageIndex ?? 0) - (b.montageIndex ?? 0))[0]
  );
}

/** Images stacked in one column — re-group into montage mosaic. */
function findBrokenMontageClusters(images: CanvasImageEl[]): CanvasImageEl[][] {
  const sorted = [...images]
    .filter((e) => !e.montageGroup && !e.montageDetached && !MASTHEAD_OVERLAY_IDS.has(e.id))
    .sort((a, b) => a.y - b.y);
  const clusters: CanvasImageEl[][] = [];
  let cluster: CanvasImageEl[] = [];

  for (const img of sorted) {
    if (cluster.length === 0) {
      cluster.push(img);
      continue;
    }
    const prev = cluster[cluster.length - 1];
    const sameCol = Math.abs(img.x - prev.x) < 24 && Math.abs(img.w - prev.w) < 40;
    const gap = img.y - (prev.y + prev.h);
    const stacked = gap >= -5 && gap < 120;
    if (sameCol && stacked) {
      cluster.push(img);
    } else {
      if (cluster.length >= 2) clusters.push(cluster);
      cluster = [img];
    }
  }
  if (cluster.length >= 2) clusters.push(cluster);
  return clusters;
}

const isImage = (e: CanvasEl): e is CanvasImageEl => e.kind === "image";

/** Rebuild montage mosaics for grouped images and vertically stacked clusters. */
export function applyAllMontageLayouts(els: CanvasEl[]): CanvasEl[] {
  els = clearMastheadMontage(els);
  const byId = new Map(els.map((e) => [e.id, e]));
  const montageGroups = new Map<string, CanvasImageEl[]>();
  for (const e of els) {
    if (isImage(e) && e.montageGroup && !MASTHEAD_OVERLAY_IDS.has(e.id)) {
      if (!montageGroups.has(e.montageGroup)) montageGroups.set(e.montageGroup, []);
      montageGroups.get(e.montageGroup)!.push(e);
    }
  }
  for (const group of montageGroups.values()) {
    if (group.length < 2) continue;
    if (group.some(isMastheadOverlayImage)) continue;
    const hero = montageHeroTile(group);
    const originY = Math.min(...group.map((e) => e.y));
    const originX = Math.min(...group.map((e) => e.x));
    for (const laid of layoutMontageMosaic(group, {
      originY,
      originX,
      heroId: hero.id,
      frameW: hero.montageFrameW,
      frameH: hero.montageFrameH,
    })) {
      byId.set(laid.id, laid);
    }
  }
  for (const cluster of findBrokenMontageClusters(els.filter(isImage))) {
    if (cluster.some(isMastheadOverlayImage)) continue;
    const groupId = cluster[0].id;
    const tagged = cluster.map((e, i) => ({ ...e, montageGroup: groupId, montageIndex: i }));
    for (const laid of layoutMontageMosaic(tagged)) byId.set(laid.id, laid);
  }
  return els.map((e) => (byId.get(e.id) as CanvasEl) ?? e);
}

/** Effective corner radius for a montage tile (honours stored value or default). */
export function montageTileBorderRadius(el: CanvasImageEl): number {
  const stored = el.borderRadius ?? 0;
  if (stored > 0) return stored;
  if (el.montageGroup) return MONTAGE_DEFAULT_BORDER_RADIUS;
  return 0;
}

/** Per-tile border-radius — all four corners rounded (gaps separate tiles). */
export function montageImageBorderRadius(
  el: CanvasImageEl,
  _elements: CanvasEl[],
  mapRadius: (r: number) => number = (r) => r,
): string | undefined {
  const r = montageTileBorderRadius(el);
  if (r <= 0) return undefined;
  const mr = mapRadius(r);
  return `${mr}px ${mr}px ${mr}px ${mr}px`;
}

export function isFullBleedCanvasImage(el: CanvasImageEl): boolean {
  return (
    el.id === "migrated-top" ||
    el.id === "migrated-hero" ||
    (el.x <= 0 && el.w >= NEWSLETTER_CANVAS_WIDTH - 2)
  );
}
