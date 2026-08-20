"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, forwardRef } from "react";

// ─── Inline format bar (appears above a text element while editing) ───────────
function InlineFormatBar({ containerRef }: { containerRef: React.RefObject<HTMLDivElement> }) {
  const savedRange = useRef<Range | null>(null);

  // Save selection before focus leaves the editable div (e.g. on color picker open)
  const saveSelection = () => {
    const sel = window.getSelection();
    savedRange.current = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
  };

  const restoreAndExec = (cmd: string, value?: string) => {
    containerRef.current?.focus();
    if (savedRange.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedRange.current);
    }
    document.execCommand(cmd, false, value ?? "");
  };

  return (
    <div
      className="nl-inline-format-bar"
      // Prevent clicks on buttons from stealing focus away from the editable div
      onPointerDown={(e) => {
        const t = e.target as HTMLElement;
        if (t.tagName !== "INPUT") e.preventDefault();
      }}
    >
      <button type="button" className="nl-fmt-btn" title="Bold"
        onClick={() => restoreAndExec("bold")}><strong>B</strong></button>
      <button type="button" className="nl-fmt-btn" title="Italic"
        onClick={() => restoreAndExec("italic")}><em>I</em></button>
      <button type="button" className="nl-fmt-btn" title="Underline"
        onClick={() => restoreAndExec("underline")}><u>U</u></button>
      <span className="nl-fmt-divider" />
      <label className="nl-fmt-btn nl-fmt-color-btn" title="Highlight colour: select text first">
        A
        <input
          type="color" defaultValue="#f3f7f6"
          onFocus={saveSelection}
          onChange={(e) => restoreAndExec("foreColor", e.target.value)}
          style={{ position: "absolute", opacity: 0, width: "100%", height: "100%", top: 0, left: 0, cursor: "pointer" }}
        />
      </label>
      <button type="button" className="nl-fmt-btn" title="Clear formatting"
        onClick={() => restoreAndExec("removeFormat")}>✕</button>
    </div>
  );
}
import type {
  CanvasEl,
  CanvasTextEl,
  CanvasImageEl,
  CanvasDividerEl,
  CanvasStoryGridEl,
  CanvasCtaEl,
  DividerDefaults,
  NewsletterCanvas as NewsletterCanvasData,
} from "../../lib/story-types";
import {
  ISSUE_GREETING_HD_PAD_TOP,
  MASTHEAD_OVERLAY_IDS,
  canvasLayoutHeightOf,
  collectCanonicalMeasuredHeights,
  contentOverlapsGreeting,
  firstStorySectionOverlapsGrid,
  isMastheadOverlayImage,
  measureElementHeight,
  mergeStoryGridMeasuredHeight,
  paintOrderElements,
  pinIdsForElement,
  clearSpacingLocks,
  pushElementsAfter,
  relayoutNewsletterCanvas,
  type RelayoutOptions,
} from "../../lib/canvas-layout";
import { layoutNewsletterCanvas } from "../../lib/canvas-render-layout";
import {
  applyAllMontageLayouts,
  layoutMontageMosaic,
  montageHeroTile,
  montageTileBorderRadius,
  MONTAGE_DEFAULT_BORDER_RADIUS,
} from "../../lib/canvas-montage";
import {
  DEFAULT_STORY_SPACING_GAPS,
  type StorySpacingGaps,
} from "../../lib/story-spacing-gaps";

const DIVIDER_FALLBACK: DividerDefaults = {
  color: "rgba(120,170,160,0.85)",
  thickness: 1,
  lineStyle: "solid",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() {
  return typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

const isText = (e: CanvasEl): e is CanvasTextEl => e.kind === "text";

/** Strip inline color / font-color styles from HTML so the element-level colour takes effect. */
function stripInlineColors(html: string): string {
  return html
    .replace(/\s*color\s*:[^;"]*/gi, "")          // remove color: ... in style attrs
    .replace(/\s*style\s*=\s*"(\s*;?\s*)"/gi, ""); // remove empty style="" leftovers
}
const isImage = (e: CanvasEl): e is CanvasImageEl => e.kind === "image";
const isDivider = (e: CanvasEl): e is CanvasDividerEl => e.kind === "divider";
const isStoryGrid = (e: CanvasEl): e is CanvasStoryGridEl => e.kind === "story-grid";
const isCta = (e: CanvasEl): e is CanvasCtaEl => e.kind === "cta";

/** Any layout-affecting change — may trigger compact stack (size / grid only). */
function patchNeedsRelayout(patch: Partial<CanvasEl>): boolean {
  const layoutKeys = ["y", "h", "w", "html", "fontSize", "lineHeight", "stories", "columns"];
  return layoutKeys.some((k) => k in patch);
}

/** Structural changes that should run compact auto-stack (not plain text edits). */
function patchNeedsCompactStack(patch: Partial<CanvasEl>): boolean {
  return ["h", "w", "stories", "columns"].some((k) => k in patch);
}

function patchIsXOnly(patch: Partial<CanvasEl>): boolean {
  return "x" in patch && !patchNeedsRelayout(patch);
}

/** Drag / nudge — x or y only, no size or content change. */
function patchIsPositionOnly(patch: Partial<CanvasEl>): boolean {
  const hasPos = "x" in patch || "y" in patch;
  const hasSizeOrContent =
    "h" in patch ||
    "w" in patch ||
    "html" in patch ||
    "fontSize" in patch ||
    "lineHeight" in patch ||
    "stories" in patch ||
    "columns" in patch;
  return hasPos && !hasSizeOrContent;
}

const MONTAGE_CROP_KEYS = new Set(["objectPositionX", "objectPositionY", "imageZoom", "shadow"]);

/** Crop / zoom tweaks on a montage tile — must not trigger stack relayout. */
function patchIsMontageCrop(patch: Partial<CanvasEl>): boolean {
  const keys = Object.keys(patch);
  return keys.length > 0 && keys.every((k) => MONTAGE_CROP_KEYS.has(k));
}

function isMontageTile(el: CanvasEl): boolean {
  return isImage(el) && !!el.montageGroup && !MASTHEAD_OVERLAY_IDS.has(el.id);
}

type MontageBounds = { minX: number; minY: number; w: number; h: number };

const CANVAS_TOOLBAR_W = 320;
const CANVAS_TOOLBAR_PAD = 12;
const CANVAS_TOP_TOOLS_TOP = 80;
const CANVAS_RIGHT_PAD = 16;

function clampCanvasToolbarPosition(
  left: number,
  top: number,
  panelW: number,
  panelH: number,
): { left: number; top: number } {
  const maxH = Math.min(panelH, window.innerHeight - CANVAS_TOOLBAR_PAD * 2);
  const maxLeft = window.innerWidth - panelW - CANVAS_TOOLBAR_PAD;
  const maxTop = window.innerHeight - maxH - CANVAS_TOOLBAR_PAD;
  return {
    left: Math.max(CANVAS_TOOLBAR_PAD, Math.min(left, maxLeft)),
    top: Math.max(CANVAS_TOOLBAR_PAD, Math.min(top, maxTop)),
  };
}

/** Pin to the right of the viewport so the panel does not cover the newsletter text. */
function defaultCanvasToolbarPosition(
  elRect: DOMRect,
  panelW: number,
  panelH: number,
): { left: number; top: number } {
  const left = window.innerWidth - panelW - CANVAS_RIGHT_PAD;
  const maxH = Math.min(panelH, window.innerHeight - CANVAS_TOOLBAR_PAD * 2);
  const top = Math.max(
    CANVAS_TOP_TOOLS_TOP,
    Math.min(elRect.top, window.innerHeight - maxH - CANVAS_TOOLBAR_PAD),
  );
  return clampCanvasToolbarPosition(left, top, panelW, panelH);
}

function montageGroupBounds(tiles: CanvasImageEl[]): MontageBounds {
  const minX = Math.min(...tiles.map((e) => e.x));
  const minY = Math.min(...tiles.map((e) => e.y));
  const maxX = Math.max(...tiles.map((e) => e.x + e.w));
  const maxY = Math.max(...tiles.map((e) => e.y + e.h));
  return { minX, minY, w: maxX - minX, h: maxY - minY };
}

function relayoutMontageGroupElements(
  elements: CanvasEl[],
  groupId: string,
  tiles: CanvasImageEl[],
  frame?: MontageBounds,
): CanvasEl[] {
  if (tiles.length < 2) return elements;
  const hero = montageHeroTile(tiles);
  const originY = frame?.minY ?? Math.min(...tiles.map((e) => e.y));
  const originX = frame?.minX ?? Math.min(...tiles.map((e) => e.x));
  const laid = layoutMontageMosaic(tiles, {
    originY,
    originX,
    heroId: hero.id,
    frameW: frame?.w ?? hero.montageFrameW,
    frameH: frame?.h ?? hero.montageFrameH,
  });
  const ids = new Set(tiles.map((e) => e.id));
  return [...elements.filter((e) => !ids.has(e.id)), ...laid];
}

function elMovesFreely(_el: CanvasEl): boolean {
  return true;
}

export function makeCtaEl(overrides: Partial<CanvasCtaEl> = {}): CanvasCtaEl {
  return {
    id: uid(), kind: "cta",
    x: 28, y: 28, w: 660, zIndex: 5,
    label: "Shop Now",
    href: "",
    bgFrom: "#0e7490", bgTo: "#10b981",
    textColor: "#ffffff",
    borderRadius: 50,
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: 2,
    ...overrides,
  };
}

export function makeStoryGridEl(overrides: Partial<CanvasStoryGridEl> = {}): CanvasStoryGridEl {
  return {
    id: uid(), kind: "story-grid",
    x: 0, y: 28, w: 716, zIndex: 5,
    columns: 3,
    headingText: "TOP STORIES THIS MONTH",
    headingColor: "#e8f3f0",
    cardBg: "rgba(255,255,255,0.15)",
    textColor: "#e8f3f0",
    stories: [],
    ...overrides,
  };
}

export function makeTextEl(overrides: Partial<CanvasTextEl> = {}): CanvasTextEl {
  return {
    id: uid(), kind: "text",
    x: 28, y: 28, w: 660, zIndex: 1,
    html: "<p>New text</p>",
    fontSize: 16, fontFamily: "inherit", fontWeight: 400,
    color: "#f3f7f6", textAlign: "left",
    lineHeight: 1.6, letterSpacing: 0,
    bg: "", borderColor: "rgba(189,208,201,0.4)", borderWidth: 0,
    borderRadius: 0, shadow: false,
    ...overrides,
  };
}

export function makeImageEl(src: string, overrides: Partial<CanvasImageEl> = {}): CanvasImageEl {
  return {
    id: uid(), kind: "image",
    x: 28, y: 28, w: 660, h: 380, zIndex: 1,
    src,
    borderRadius: 0,
    objectFit: "cover",
    objectPositionX: 0, objectPositionY: 0,
    imageZoom: 1,
    shadow: false,
    ...overrides,
  };
}

export function makeDividerEl(
  overrides: Partial<CanvasDividerEl> = {},
  defaults?: DividerDefaults
): CanvasDividerEl {
  const d = defaults ?? DIVIDER_FALLBACK;
  return {
    id: uid(), kind: "divider",
    x: 0, y: 28, w: 716, zIndex: 1,
    color: d.color,
    thickness: d.thickness,
    lineStyle: d.lineStyle,
    ...overrides,
  };
}

/** Content column inside the 716px newsletter shell. */
export const NEWSLETTER_CANVAS_WIDTH = 716;
const CANVAS_W = NEWSLETTER_CANVAS_WIDTH;
const CANVAS_COL_X = 28;
const CANVAS_COL_W = 660;
const MAX_MONTAGE_IMAGES = 9;

export function estimateTextHeight(el: CanvasTextEl): number {
  const plain = el.html.replace(/<[^>]+>/g, " ").trim();
  const charsPerLine = Math.max(1, Math.floor(el.w / (el.fontSize * 0.55)));
  const contentLines = Math.ceil(plain.length / charsPerLine);
  // Each paragraph/line-break adds a small gap, not a full extra line
  const paraBreaks = el.html.split(/<\/p>|<br/gi).length - 1;
  return Math.max(40, contentLines * el.fontSize * el.lineHeight + paraBreaks * 8 + 16);
}

function elementHeight(el: CanvasEl, measuredH?: number): number {
  return measureElementHeight(el, measuredH);
}

function elementBottom(el: CanvasEl, measuredH?: number): number {
  return el.y + elementHeight(el, measuredH);
}

function canvasHeight(elements: CanvasEl[], layoutMinY = 0): number {
  if (elements.length === 0) return 400;
  const minY = layoutMinY || Math.min(0, ...elements.map((e) => e.y));
  const bottom = elements.reduce(
    (max, el) => Math.max(max, el.y - minY + elementHeight(el)),
    0,
  );
  return bottom + 80;
}

// ─── Single element render ────────────────────────────────────────────────────

function TextElView({
  el, selected, editing, canEdit, onPointerDown, onBlur, onInput,
}: {
  el: CanvasTextEl; selected: boolean; editing: boolean;
  canEdit: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  onBlur?: (html: string) => void;
  onInput?: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Sync content via ref using useLayoutEffect so that the parent canvas's
  // useLayoutEffect (which measures element heights for auto-reflow) always sees
  // the populated content. Child layout effects fire before parent layout effects,
  // so heights are accurate when the parent measures them.
  useLayoutEffect(() => {
    if (ref.current && !editing) {
      ref.current.innerHTML = el.html;
    }
  }, [el.html, editing]);

  // When entering edit mode: populate content then focus + place cursor at end
  useEffect(() => {
    if (editing && ref.current) {
      // Populate first (React may have cleared it when removing dangerouslySetInnerHTML)
      if (!ref.current.innerHTML) {
        ref.current.innerHTML = el.html;
      }
      ref.current.focus();
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]); // intentionally only on editing toggle, not el.html

  const innerStyle: React.CSSProperties = {
    fontFamily: el.fontFamily || "inherit",
    fontSize: el.fontSize,
    fontWeight: el.fontWeight,
    color: el.color || "inherit",
    textAlign: el.textAlign,
    lineHeight: el.lineHeight,
    letterSpacing: el.letterSpacing ? `${el.letterSpacing}px` : undefined,
    outline: "none",
    minHeight: "1em",
    cursor: editing ? "text" : canEdit ? (selected ? "text" : "grab") : "default",
  };

  const titleParaStyle =
    el.id === "migrated-title"
      ? `
    .nl-title-inner p { margin: 0; }
    .nl-title-inner p + p { margin-top: 12px; }
  `
      : null;
  const storyBodyParaStyle = /^migrated-sb-\d+$/.test(el.id)
    ? `
    .nl-story-body-inner p { margin: 0 0 0.65em 0; }
    .nl-story-body-inner p:last-child { margin-bottom: 0; }
  `
    : null;
  const greetingParaStyle =
    el.id === "migrated-greeting"
      ? `
    .nl-greeting-inner p { margin: 0 0 0.75em 0; }
    .nl-greeting-inner p:last-child { margin-bottom: 0; }
  `
      : null;

  return (
    <div
      className={`nl-canvas-el${selected ? " is-selected" : ""}${editing ? " is-editing" : ""}`}
      style={{
        position: "relative",
        width: "100%",
        boxSizing: "border-box",
        padding:
          el.borderWidth > 0 || el.bg
            ? "12px 14px"
            : el.id === "migrated-title"
              ? "0 0 12px 0"
              : el.id === "migrated-greeting-hd"
                ? `${ISSUE_GREETING_HD_PAD_TOP}px 0 0 0`
                : 0,
        backgroundColor: el.bg || undefined,
        border: el.borderWidth > 0 ? `${el.borderWidth}px solid ${el.borderColor}` : undefined,
        borderRadius: el.borderRadius > 0 ? `${el.borderRadius}px` : undefined,
        boxShadow: el.shadow ? "0 4px 24px rgba(0,0,0,0.28)" : undefined,
        cursor: editing ? "text" : canEdit ? (selected ? "text" : "grab") : "default",
      }}
      onPointerDown={canEdit ? onPointerDown : undefined}
    >
      {titleParaStyle ? <style>{titleParaStyle}</style> : null}
      {storyBodyParaStyle ? <style>{storyBodyParaStyle}</style> : null}
      {greetingParaStyle ? <style>{greetingParaStyle}</style> : null}
      {editing && <InlineFormatBar containerRef={ref as React.RefObject<HTMLDivElement>} />}
      <div
        ref={ref}
        className={
          el.id === "migrated-title"
            ? "nl-title-inner"
            : el.id === "migrated-greeting"
              ? "nl-greeting-inner"
              : /^migrated-sb-\d+$/.test(el.id)
                ? "nl-story-body-inner"
                : undefined
        }
        contentEditable={editing}
        suppressContentEditableWarning
        style={innerStyle}
        onBlur={editing ? (e) => {
          // Don't exit edit mode if focus moved to the format bar
          const rel = e.relatedTarget as HTMLElement | null;
          if (rel?.closest?.(".nl-inline-format-bar")) return;
          onBlur?.(e.currentTarget.innerHTML);
        } : undefined}
        onInput={editing ? (e) => onInput?.(e.currentTarget.innerHTML) : undefined}
        onPaste={editing ? (e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
        } : undefined}
      />
    </div>
  );
}

function ResizeHandle({
  cursor, style, onResize, onResizeStart, onResizeEnd,
}: {
  cursor: string;
  style: React.CSSProperties;
  onResize: (dx: number, dy: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
}) {
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onResizeStart?.();
    const startX = e.clientX;
    const startY = e.clientY;
    const onMove = (ev: PointerEvent) => {
      onResize(ev.clientX - startX, ev.clientY - startY);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      onResizeEnd?.();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  return (
    <div
      className="nl-canvas-resize-handle"
      style={{ ...style, cursor }}
      onPointerDown={handlePointerDown}
    />
  );
}

function ImageElView({
  el, selected, canEdit, onPointerDown, onCropPan, uploadRef, onReplace, onResize, allElements,
}: {
  el: CanvasImageEl; selected: boolean; canEdit: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  onCropPan?: (objectPositionX: number, objectPositionY: number) => void;
  uploadRef?: React.RefObject<HTMLInputElement>;
  onReplace?: (files: File[]) => void;
  onResize?: (edge: string, dx: number, dy: number) => void;
  allElements: CanvasEl[];
}) {
  const inMontage = !!el.montageGroup && !MASTHEAD_OVERLAY_IDS.has(el.id);
  const br = (() => {
    const r = inMontage ? montageTileBorderRadius(el) : (el.borderRadius ?? 0);
    return r > 0 ? `${r}px` : undefined;
  })();
  const ox = el.objectPositionX ?? 0;
  const oy = el.objectPositionY ?? 0;
  const isCircle =
    el.borderRadius >= Math.min(el.w, el.h) / 2 - 2 && Math.abs(el.w - el.h) < 8;
  const isPortrait = el.id === "migrated-portrait" || isCircle;

  const handleCropPanStart = (e: React.PointerEvent) => {
    if (!canEdit || !selected || !onCropPan) return;
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const origOX = ox;
    const origOY = oy;
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      if (moved) onCropPan(origOX + dx, origOY + dy);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      className={`nl-canvas-el${selected ? " is-selected" : ""}`}
      style={{
        position: "absolute", left: 0, top: 0,
        width: "100%", height: "100%",
        borderRadius: br,
        overflow: "hidden",
        isolation: "isolate",
        cursor: canEdit ? (inMontage && selected ? "default" : "grab") : "default",
        background: el.src ? undefined : "rgba(167,199,188,0.1)",
        boxShadow: isPortrait || el.shadow ? "0 10px 32px rgba(0,0,0,0.42)" : undefined,
        boxSizing: "border-box",
      }}
      onPointerDown={canEdit ? onPointerDown : undefined}
    >
      {el.src ? (
        <img
          src={el.src} alt=""
          draggable={false}
          onPointerDown={canEdit && selected && inMontage ? handleCropPanStart : undefined}
          style={{
            width: "100%", height: "100%", objectFit: el.objectFit ?? "cover", display: "block",
            objectPosition: `calc(50% + ${ox}px) calc(50% + ${oy}px)`,
            transform: el.imageZoom !== 1 ? `scale(${el.imageZoom})` : undefined,
            transformOrigin: "center center",
            userSelect: "none",
            cursor: canEdit && selected && inMontage ? "move" : "inherit",
            borderRadius: br,
          }}
        />
      ) : (
        <div style={{ display: "grid", placeItems: "center", height: "100%", fontSize: 13, opacity: 0.4 }}>
          No image
        </div>
      )}
      {canEdit && selected && (
        <button
          type="button"
          className="nl-canvas-img-replace"
          onClick={() => uploadRef?.current?.click()}
        >
          Replace{inMontage ? "" : " / Add"}
        </button>
      )}
      {canEdit && onReplace && (
        <input
          ref={uploadRef}
          type="file" accept="image/*" multiple
          style={{ display: "none" }}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) onReplace(files);
            e.target.value = "";
          }}
        />
      )}
    </div>
  );
}

function DividerElView({
  el, selected, canEdit, onPointerDown, layoutMinY = 0, outerRef,
}: {
  el: CanvasDividerEl; selected: boolean; canEdit: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  layoutMinY?: number;
  outerRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={outerRef}
      className={`nl-canvas-el${selected ? " is-selected" : ""}`}
      style={{
        position: "absolute", left: el.x, top: el.y - layoutMinY, width: el.w,
        height: Math.max(el.thickness, 8),
        zIndex: el.zIndex,
        cursor: canEdit ? "grab" : "default",
        display: "flex", alignItems: "center",
      }}
      onPointerDown={canEdit ? onPointerDown : undefined}
    >
      <hr style={{
        width: "100%", border: "none",
        borderTop: `${el.thickness}px ${el.lineStyle} ${el.color}`,
        margin: 0,
      }} />
    </div>
  );
}

// ─── CTA button element ───────────────────────────────────────────────────────

function CtaElView({
  el, selected, canEdit, onPointerDown, layoutMinY = 0, outerRef,
}: {
  el: CanvasCtaEl;
  selected: boolean;
  canEdit: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  layoutMinY?: number;
  outerRef?: React.Ref<HTMLDivElement>;
}) {
  const cssVars = {
    "--cta-from": el.bgFrom,
    "--cta-to": el.bgTo,
    "--cta-text": el.textColor,
    "--cta-radius": `${el.borderRadius}px`,
    "--cta-fs": `${el.fontSize}px`,
    "--cta-fw": String(el.fontWeight),
    "--cta-ls": `${el.letterSpacing}px`,
  } as React.CSSProperties;

  return (
    <div
      ref={outerRef}
      className={`nl-canvas-el nl-cta-wrapper${selected ? " is-selected" : ""}`}
      style={{
        position: "absolute",
        left: el.x, top: el.y - layoutMinY,
        width: el.w,
        zIndex: el.zIndex,
        display: "flex",
        justifyContent: "center",
        cursor: canEdit ? "move" : "default",
        ...cssVars,
      }}
      onPointerDown={canEdit ? onPointerDown : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href={canEdit ? undefined : el.href || "#"}
        className="nl-cta-btn"
        onClick={canEdit ? (e) => e.preventDefault() : undefined}
        draggable={false}
      >
        {el.label || "Click here"}
      </a>
    </div>
  );
}

// ─── Story grid element ───────────────────────────────────────────────────────

function StoryGridElView({
  el, selected, canEdit, onPointerDown, layoutMinY = 0, outerRef,
}: {
  el: CanvasStoryGridEl;
  selected: boolean;
  canEdit: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  layoutMinY?: number;
  outerRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={outerRef}
      className={`nl-canvas-el nl-story-grid-el${selected ? " is-selected" : ""}`}
      style={{
        position: "absolute",
        left: el.x, top: el.y - layoutMinY,
        width: el.w,
        zIndex: el.zIndex,
        cursor: canEdit ? "move" : "default",
        boxSizing: "border-box",
        // Keep top padding so the heading clears the greeting above (CSS .nl-story-grid-el).
        padding: "36px 28px 40px",
      }}
      onPointerDown={canEdit ? onPointerDown : undefined}
    >
      {el.headingText && (
        <p className="nl-sgrid-heading" style={{ color: el.headingColor }}>
          {el.headingText}
        </p>
      )}
      <div className={`nl-sgrid-cards nl-sgrid-cols-${el.columns}`}>
        {el.stories.map((s, i) => (
          <div key={i} className="nl-sgrid-card" style={{ background: el.cardBg }}>
            {s.imageUrl && (
              <div className="nl-sgrid-card-img-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.imageUrl} alt={s.title} className="nl-sgrid-card-img" />
              </div>
            )}
            <div className="nl-sgrid-card-body">
              <p className="nl-sgrid-card-title" style={{ color: el.textColor }}>{s.title}</p>
              {s.excerpt && (
                <p className="nl-sgrid-card-excerpt" style={{ color: el.textColor }}>{s.excerpt}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Floating toolbar ─────────────────────────────────────────────────────────

function Toolbar({
  el, rect,
  onUpdate, onDelete, onClose,
  onBringForward, onSendBack, onApplyColorToAll, onCentreAll, onApplyDividerToAll, onApplyCtaToAll,
  onSave, onDuplicate, onUndo, onRedo, canUndo, canRedo,
  montageImageCount, onAddMontageImages, montageBounds, onMontageBoundsChange,
  canvasHeight = 800,
}: {
  el: CanvasEl;
  rect: DOMRect | null;
  canvasHeight?: number;
  onUpdate: (patch: Partial<CanvasEl>) => void;
  onDelete: () => void;
  onClose: () => void;
  onBringForward: () => void;
  onSendBack: () => void;
  onApplyColorToAll?: (color: string) => void;
  onCentreAll?: () => void;
  onApplyDividerToAll?: (defaults: DividerDefaults) => void;
  onApplyCtaToAll?: (style: Pick<CanvasCtaEl, "bgFrom"|"bgTo"|"textColor"|"borderRadius"|"fontSize"|"letterSpacing">) => void;
  onSave?: () => Promise<void> | void;
  onDuplicate?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  montageImageCount?: number;
  onAddMontageImages?: (files: File[]) => void;
  montageBounds?: MontageBounds | null;
  onMontageBoundsChange?: (w: number, h: number) => void;
}) {
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const addMontageInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const [panelHeight, setPanelHeight] = useState(480);

  useEffect(() => {
    setDrag(null);
  }, [el.id]);

  useLayoutEffect(() => {
    const node = panelRef.current;
    if (!node) return;
    const measure = () => {
      const h = node.getBoundingClientRect().height;
      if (h > 0) setPanelHeight(h);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [el.id, el.kind]);

  const handleHeadPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const panelEl = (e.currentTarget as HTMLElement).closest(".nl-canvas-toolbar") as HTMLElement | null;
    if (!panelEl) return;
    const panelRect = panelEl.getBoundingClientRect();
    const offsetX = e.clientX - panelRect.left;
    const offsetY = e.clientY - panelRect.top;

    const onMove = (ev: PointerEvent) => {
      const live = panelEl.getBoundingClientRect();
      const clamped = clampCanvasToolbarPosition(
        ev.clientX - offsetX,
        ev.clientY - offsetY,
        live.width || CANVAS_TOOLBAR_W,
        live.height || panelHeight,
      );
      setDrag({ x: clamped.left, y: clamped.top });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  if (!rect || typeof document === "undefined") return null;

  const estimatedH = Math.min(panelHeight, window.innerHeight - CANVAS_TOOLBAR_PAD * 2);
  const docked = defaultCanvasToolbarPosition(rect, CANVAS_TOOLBAR_W, estimatedH);
  const panelLeft = drag ? drag.x : docked.left;
  const panelTop = drag ? drag.y : docked.top;

  const num = (label: string, val: number, key: string, min = -2000, max = 2000, step = 1) => (
    <label key={key} className="nl-tb-grid-cell">
      <span className="nl-tb-cell-label">{label}</span>
      <input
        type="number" min={min} max={max} step={step} value={Math.round(val)}
        className="nl-tb-num"
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onUpdate({ [key]: v } as Partial<CanvasEl>);
        }}
      />
    </label>
  );

  const slider = (label: string, val: number, key: string, min: number, max: number, step = 1) => (
    <label key={key} className="nl-tb-row nl-tb-slider-row">
      <span className="nl-tb-label">{label} <em>{typeof val === "number" ? (step < 1 ? val.toFixed(2) : Math.round(val)) : val}</em></span>
      <input
        type="range" min={min} max={max} step={step} value={val}
        className="nl-tb-range"
        onChange={(e) => onUpdate({ [key]: parseFloat(e.target.value) } as Partial<CanvasEl>)}
      />
    </label>
  );

  const col = (label: string, val: string, key: string) => {
    const applyColor = (newColor: string) => {
      const patch: Partial<CanvasEl> = { [key]: newColor } as Partial<CanvasEl>;
      // When changing text colour, strip any inline colour styles baked into the HTML
      if (key === "color" && isText(el)) {
        (patch as Partial<CanvasTextEl>).html = stripInlineColors(el.html);
      }
      onUpdate(patch);
    };
    return (
      <label key={key} className="nl-tb-row">
        <span className="nl-tb-label">{label}</span>
        <input
          type="color" value={val.startsWith("#") ? val : "#f3f7f6"}
          className="nl-tb-color"
          onChange={(e) => applyColor(e.target.value)}
        />
        <input
          type="text" value={val} placeholder="rgba(…) or #hex"
          className="nl-tb-text-sm"
          onChange={(e) => applyColor(e.target.value)}
        />
      </label>
    );
  };

  const check = (label: string, val: boolean, key: string) => (
    <label key={key} className="nl-tb-row nl-tb-check-row">
      <input type="checkbox" checked={val} onChange={(e) => onUpdate({ [key]: e.target.checked } as Partial<CanvasEl>)} />
      <span>{label}</span>
    </label>
  );

  const sel = (label: string, val: string, key: string, opts: [string, string][]) => (
    <label key={key} className="nl-tb-row">
      <span className="nl-tb-label">{label}</span>
      <select
        value={val} className="nl-tb-select"
        onChange={(e) => onUpdate({ [key]: e.target.value } as Partial<CanvasEl>)}
      >
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );

  const centrePositionButtons = () => {
    const elH = "h" in el && typeof el.h === "number" ? el.h : 40;
    return (
      <div className="nl-tb-centre-row">
        <button
          type="button"
          className="nl-tb-centre-btn"
          onClick={() => onUpdate({ x: Math.round((716 - el.w) / 2) })}
        >
          ⊹ Centre horizontally
        </button>
        <button
          type="button"
          className="nl-tb-centre-btn"
          onClick={() => onUpdate({ y: Math.max(0, Math.round((canvasHeight - elH) / 2)) })}
        >
          ⊹ Centre vertically
        </button>
      </div>
    );
  };

  const node = (
    <aside
      ref={panelRef}
      className="nl-canvas-toolbar"
      style={{ position: "fixed", left: panelLeft, top: panelTop, zIndex: 9999 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="nl-tb-head" onPointerDown={handleHeadPointerDown} style={{ cursor: "grab" }}>
        <span className="nl-tb-kind">{el.kind}</span>
        <div className="nl-tb-head-actions">
          {onUndo ? (
            <button
              type="button"
              className="nl-tb-icon-btn"
              title="Undo (⌘Z)"
              disabled={!canUndo}
              onClick={onUndo}
            >
              ↶
            </button>
          ) : null}
          {onRedo ? (
            <button
              type="button"
              className="nl-tb-icon-btn"
              title="Redo (⌘⇧Z)"
              disabled={!canRedo}
              onClick={onRedo}
            >
              ↷
            </button>
          ) : null}
          <button type="button" className="nl-tb-icon-btn" title="Send backward (layer)" onClick={onSendBack}>↓</button>
          <button type="button" className="nl-tb-icon-btn" title="Bring forward (layer)" onClick={onBringForward}>↑</button>
          {onDuplicate && (
            <button type="button" className="nl-tb-icon-btn nl-tb-dup" title="Duplicate element (⌘D)" onClick={onDuplicate}>⧉</button>
          )}
          {onSave && (
            <button
              type="button"
              className={`nl-tb-icon-btn nl-tb-save${
                saveState === "saved"
                  ? " nl-tb-saved"
                  : saveState === "error"
                    ? " nl-tb-save-err"
                    : saveState === "saving"
                      ? " nl-tb-saving"
                      : ""
              }`}
              title="Save newsletter"
              disabled={saveState === "saving"}
              onClick={async () => {
                if (saveState === "saving") return;
                setSaveState("saving");
                try {
                  await onSave();
                  setSaveState("saved");
                  window.setTimeout(() => setSaveState("idle"), 2500);
                } catch {
                  setSaveState("error");
                  window.setTimeout(() => setSaveState("idle"), 3000);
                }
              }}
            >
              {saveState === "saving"
                ? "Saving"
                : saveState === "saved"
                  ? "Saved"
                  : saveState === "error"
                    ? "Error"
                    : "Save"}
            </button>
          )}
          <button type="button" className="nl-tb-icon-btn nl-tb-close" onClick={onClose}>✕</button>
        </div>
      </div>

      {isText(el) && (
        <div className="nl-tb-section">
          <div className="nl-tb-section-label">Position &amp; size: drag to move</div>
          <div className="nl-tb-nudge-row">
            <button type="button" className="nl-tb-centre-btn" title="Move up 8px"
              onClick={() => onUpdate({ y: Math.max(0, el.y - 8) })}>↑ Up</button>
            <button type="button" className="nl-tb-centre-btn" title="Move down 8px"
              onClick={() => onUpdate({ y: el.y + 8 })}>↓ Down</button>
          </div>
          {slider("X", el.x, "x", -200, 716)}
          {slider("Y", el.y, "y", 0, 3000)}
          {slider("Width", el.w, "w", 40, 760)}
          {centrePositionButtons()}
          {onCentreAll && (
            <button type="button" className="nl-tb-centre-btn" style={{ marginTop: 2 }}
              onClick={onCentreAll}>
              ⊹ Centre all elements
            </button>
          )}
        </div>
      )}

      {isDivider(el) && (
        <div className="nl-tb-section">
          <div className="nl-tb-section-label">Position &amp; size: drag to move</div>
          <div className="nl-tb-nudge-row">
            <button type="button" className="nl-tb-centre-btn" title="Move up 8px"
              onClick={() => onUpdate({ y: Math.max(0, el.y - 8) })}>↑ Up</button>
            <button type="button" className="nl-tb-centre-btn" title="Move down 8px"
              onClick={() => onUpdate({ y: el.y + 8 })}>↓ Down</button>
          </div>
          {slider("X", el.x, "x", -200, 716)}
          {slider("Y", el.y, "y", 0, 3000)}
          {slider("Width", el.w, "w", 40, 760)}
          {centrePositionButtons()}
          {onCentreAll && (
            <button type="button" className="nl-tb-centre-btn" style={{ marginTop: 2 }}
              onClick={onCentreAll}>
              ⊹ Centre all elements
            </button>
          )}
        </div>
      )}

      {isText(el) && (
        <>
          <div className="nl-tb-section">
            {slider("Size", el.fontSize, "fontSize", 10, 120)}
            {slider("Weight", el.fontWeight, "fontWeight", 100, 900, 100)}
            {slider("Line height", el.lineHeight, "lineHeight", 0.8, 3, 0.05)}
            {slider("Letter spacing", el.letterSpacing, "letterSpacing", -4, 20, 0.5)}
            {sel("Align", el.textAlign, "textAlign", [["left","Left"],["center","Center"],["right","Right"]])}
            {col("Text color", el.color, "color")}
            {onApplyColorToAll && (
              <button type="button" className="nl-tb-centre-btn"
                style={{ marginTop: 2 }}
                onClick={() => onApplyColorToAll(el.color || "#f3f7f6")}>
                Apply colour to all text
              </button>
            )}
          </div>
          <div className="nl-tb-section">
            <div className="nl-tb-section-label">Background &amp; border</div>
            {col("Fill", el.bg, "bg")}
            <button
              type="button"
              className="nl-tb-centre-btn"
              style={{ marginTop: 2 }}
              disabled={!el.bg?.trim()}
              title="Remove background fill so text sits directly on the newsletter colour"
              onClick={() => onUpdate({ bg: "" })}
            >
              No fill (transparent)
            </button>
            {slider("Border width", el.borderWidth, "borderWidth", 0, 12)}
            {el.borderWidth > 0 && col("Border color", el.borderColor, "borderColor")}
            {slider("Corner radius", el.borderRadius, "borderRadius", 0, 60)}
            {check("Drop shadow", el.shadow, "shadow")}
          </div>
        </>
      )}

      {isImage(el) && isMontageTile(el) && (
        <div className="nl-tb-section">
          <div className="nl-tb-section-label">Montage tile</div>
          <p className="nl-tb-hint" style={{ margin: "0 0 8px", fontSize: 12, opacity: 0.75, lineHeight: 1.45 }}>
            Drag handles on the montage border to resize the whole grid. Use <strong>Add image to montage</strong> for more photos (up to {MAX_MONTAGE_IMAGES}).
            Drag a tile to pan, or use the sliders below. Corner radius applies to every tile.
          </p>
          {montageBounds && onMontageBoundsChange && (
            <>
              <label className="nl-tb-row nl-tb-slider-row">
                <span style={{ fontSize: 11, color: "rgba(167,199,188,0.75)", minWidth: 108 }}>Montage width</span>
                <input
                  type="range"
                  min={120}
                  max={760}
                  step={4}
                  value={montageBounds.w}
                  onChange={(e) => onMontageBoundsChange(Number(e.target.value), montageBounds.h)}
                />
                <span style={{ fontSize: 11, color: "rgba(167,199,188,0.55)", minWidth: 36, textAlign: "right" }}>
                  {montageBounds.w}px
                </span>
              </label>
              <label className="nl-tb-row nl-tb-slider-row">
                <span style={{ fontSize: 11, color: "rgba(167,199,188,0.75)", minWidth: 108 }}>Montage height</span>
                <input
                  type="range"
                  min={80}
                  max={1200}
                  step={4}
                  value={montageBounds.h}
                  onChange={(e) => onMontageBoundsChange(montageBounds.w, Number(e.target.value))}
                />
                <span style={{ fontSize: 11, color: "rgba(167,199,188,0.55)", minWidth: 36, textAlign: "right" }}>
                  {montageBounds.h}px
                </span>
              </label>
            </>
          )}
        </div>
      )}

      {isImage(el) && !isMontageTile(el) && (
        <div className="nl-tb-section">
          <div className="nl-tb-section-label">Frame: drag to move, handles to resize</div>
          {slider("X", el.x, "x", -200, 716)}
          {slider("Y", el.y, "y", 0, 3000)}
          {slider("Width", el.w, "w", 40, 760)}
          {slider("Height", el.h, "h", 20, 1200)}
          {centrePositionButtons()}
          {onCentreAll && (
            <button type="button" className="nl-tb-centre-btn" style={{ marginTop: 2 }}
              onClick={onCentreAll}>
              ⊹ Centre all elements
            </button>
          )}
        </div>
      )}

      {isImage(el) && (
        <div className="nl-tb-section">
          {isMontageTile(el) && (
            <>
              {onAddMontageImages && (montageImageCount ?? 0) < MAX_MONTAGE_IMAGES && (
                <>
                  <button
                    type="button"
                    className="nl-tb-centre-btn"
                    style={{ marginBottom: 8 }}
                    title="Add one or more photos to this montage"
                    onClick={() => addMontageInputRef.current?.click()}
                  >
                    + Add image to montage
                  </button>
                  <input
                    ref={addMontageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      if (files.length) onAddMontageImages(files);
                      e.target.value = "";
                    }}
                  />
                </>
              )}
              <button
                type="button"
                className="nl-tb-centre-btn"
                style={{ marginBottom: 8 }}
                title="Detach this image so it moves independently of its montage neighbours"
                onClick={() =>
                  onUpdate({
                    montageGroup: undefined,
                    montageIndex: undefined,
                    montageCols: undefined,
                    montageDetached: true,
                  } as Partial<CanvasEl>)
                }
              >
                ⎘ Ungroup from montage
              </button>
            </>
          )}
          <div className="nl-tb-section-label">Image crop &amp; zoom</div>
          {slider("Zoom", el.imageZoom, "imageZoom", 0.5, 4, 0.05)}
          {slider("Pan left/right", el.objectPositionX ?? 0, "objectPositionX", -300, 300)}
          {slider("Pan up/down", el.objectPositionY ?? 0, "objectPositionY", -300, 300)}
          <button type="button" className="nl-tb-centre-btn"
            onClick={() => onUpdate({ objectFit: "contain", imageZoom: 1, objectPositionX: 0, objectPositionY: 0 } as Partial<CanvasEl>)}>
            ⊡ Show full image
          </button>
          {slider(
            isMontageTile(el) ? "Corner radius (all tiles)" : "Corner radius",
            el.borderRadius || (isMontageTile(el) ? MONTAGE_DEFAULT_BORDER_RADIUS : 0),
            "borderRadius",
            0,
            80,
          )}
          {check("Drop shadow", el.shadow, "shadow")}
        </div>
      )}

      {isDivider(el) && (
        <div className="nl-tb-section">
          <div className="nl-tb-section-label">Style</div>
          {slider("Thickness", el.thickness, "thickness", 1, 12)}
          {col("Color", el.color, "color")}
          {sel("Style", el.lineStyle, "lineStyle", [["solid","Solid"],["dashed","Dashed"],["dotted","Dotted"]])}
          {onApplyDividerToAll && (
            <button type="button" className="nl-tb-centre-btn" style={{ marginTop: 4 }}
              onClick={() => onApplyDividerToAll({ color: el.color, thickness: el.thickness, lineStyle: el.lineStyle })}>
              Apply style to all dividers
            </button>
          )}
        </div>
      )}

      {isCta(el) && (
        <>
          <div className="nl-tb-section">
            <div className="nl-tb-section-label">Position &amp; size</div>
            {slider("X", el.x, "x", -200, 716)}
            {slider("Y", el.y, "y", 0, 3000)}
            {slider("Width", el.w, "w", 100, 760)}
            {centrePositionButtons()}
            {onCentreAll && (
              <button type="button" className="nl-tb-centre-btn" style={{ marginTop: 2 }}
                onClick={onCentreAll}>
                ⊹ Centre all elements
              </button>
            )}
          </div>
          <div className="nl-tb-section">
            <div className="nl-tb-section-label">Label &amp; link</div>
            <label className="nl-tb-row">
              <span className="nl-tb-label">Label</span>
              <input type="text" value={el.label} className="nl-tb-text-input"
                onChange={(e) => onUpdate({ label: e.target.value } as Partial<CanvasEl>)} />
            </label>
            <label className="nl-tb-row">
              <span className="nl-tb-label">URL</span>
              <input type="text" value={el.href} placeholder="https://…" className="nl-tb-text-input"
                onChange={(e) => onUpdate({ href: e.target.value } as Partial<CanvasEl>)} />
            </label>
          </div>
          <div className="nl-tb-section">
            <div className="nl-tb-section-label">Style</div>
            {col("Gradient from", el.bgFrom, "bgFrom")}
            {col("Gradient to", el.bgTo, "bgTo")}
            {col("Text color", el.textColor, "textColor")}
            {slider("Corner radius", el.borderRadius, "borderRadius", 0, 60)}
            {slider("Font size", el.fontSize, "fontSize", 10, 32)}
            {slider("Letter spacing", el.letterSpacing, "letterSpacing", 0, 12, 0.5)}
            {onApplyCtaToAll && (
              <button type="button" className="nl-tb-centre-btn" style={{ marginTop: 4 }}
                onClick={() => onApplyCtaToAll({ bgFrom: el.bgFrom, bgTo: el.bgTo, textColor: el.textColor, borderRadius: el.borderRadius, fontSize: el.fontSize, letterSpacing: el.letterSpacing })}>
                Apply style to all CTA buttons
              </button>
            )}
          </div>
        </>
      )}

      {isStoryGrid(el) && (
        <>
          <div className="nl-tb-section">
            <div className="nl-tb-section-label">Position</div>
            {slider("Y", el.y, "y", 0, 3000)}
          </div>
          <div className="nl-tb-section">
            <div className="nl-tb-section-label">Layout</div>
            <label className="nl-tb-row">
              <span className="nl-tb-label">Columns</span>
              <select value={el.columns} className="nl-tb-select"
                onChange={(e) => onUpdate({ columns: Number(e.target.value) as 2 | 3 } as Partial<CanvasEl>)}>
                <option value={2}>2 columns</option>
                <option value={3}>3 columns</option>
              </select>
            </label>
          </div>
          <div className="nl-tb-section">
            <div className="nl-tb-section-label">Colors</div>
            {col("Heading color", el.headingColor, "headingColor")}
            {col("Card background", el.cardBg, "cardBg")}
            {col("Text color", el.textColor, "textColor")}
          </div>
        </>
      )}

      <div className="nl-tb-section nl-tb-delete-section">
        <button type="button" className="nl-tb-delete-btn" onClick={onDelete}>
          Delete element
        </button>
      </div>
    </aside>
  );

  return createPortal(node, document.body);
}

// ─── Main canvas component ────────────────────────────────────────────────────

export type NewsletterCanvasHandle = {
  compactSpacing: (gaps?: StorySpacingGaps) => void;
  restoreMontages: () => void;
};

export type CanvasVisualPreviewOptions = {
  /** Target width in px (e.g. 600 for email). Canvas is scaled uniformly from 716px. */
  width: number;
  backgroundColor?: string;
};

type CanvasProps = {
  canvas: NewsletterCanvasData;
  canEdit: boolean;
  onChange?: (canvas: NewsletterCanvasData) => void;
  onSave?: () => Promise<void> | void;
  /** Read-only scaled mirror of the canvas — same layout as the editor, for email preview. */
  visualPreview?: CanvasVisualPreviewOptions;
  /** When set, ⇕ Apply spacing in the add bar uses these gaps (see StorySpacingControls). */
  storySpacingGaps?: StorySpacingGaps;
};

export const NewsletterCanvas = forwardRef<NewsletterCanvasHandle, CanvasProps>(function NewsletterCanvasInner({
  canvas,
  canEdit,
  onChange,
  onSave,
  visualPreview,
  storySpacingGaps,
}, ref) {
  const elements = canvas.elements;
  const gaps = canvas.storySpacingGaps ?? storySpacingGaps ?? DEFAULT_STORY_SPACING_GAPS;
  const draggingIdRef = useRef<string | null>(null);
  const resizingIdRef = useRef<string | null>(null);
  const [dragTick, setDragTick] = useState(0);
  const [resizeTick, setResizeTick] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const elRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const applyStorySpacing = useCallback(
    (els: CanvasEl[], measuredHeights?: Record<string, number>) => {
      return layoutNewsletterCanvas(
        {
          elements: els,
          measuredHeights: measuredHeights ?? canvas.measuredHeights,
          storySpacingGaps: gaps,
        },
        gaps,
      ).elements;
    },
    [gaps, canvas.measuredHeights],
  );

  const collectDomMeasuredHeights = useCallback((): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const [id, node] of elRefs.current) {
      const h = Math.ceil(node.getBoundingClientRect().height);
      if (h > 0) out[id] = h;
    }
    return out;
  }, []);

  const collectMeasuredHeights = useCallback((): Record<string, number> => {
    const domHeights = collectDomMeasuredHeights();
    const merged: Record<string, number> = { ...(canvas.measuredHeights ?? {}) };
    for (const el of elementsRef.current) {
      const est = measureElementHeight(el);
      const dom = domHeights[el.id] ?? 0;
      const prev = merged[el.id] ?? 0;
      if (el.kind === "story-grid") {
        merged[el.id] = mergeStoryGridMeasuredHeight(est, dom, prev);
      } else {
        merged[el.id] = Math.max(est, dom, prev);
      }
    }
    const enforced = applyStorySpacing(elementsRef.current, merged);
    return collectCanonicalMeasuredHeights(enforced, merged);
  }, [applyStorySpacing, canvas.measuredHeights, collectDomMeasuredHeights]);

  const displayElements = useMemo(() => {
    if (draggingIdRef.current || resizingIdRef.current) return paintOrderElements(elements);
    const domHeights = collectDomMeasuredHeights();
    const merged: Record<string, number> = { ...(canvas.measuredHeights ?? {}) };
    for (const el of elements) {
      const est = measureElementHeight(el);
      const dom = domHeights[el.id] ?? 0;
      const prev = merged[el.id] ?? 0;
      if (el.kind === "story-grid") {
        merged[el.id] = mergeStoryGridMeasuredHeight(est, dom, prev);
      } else {
        merged[el.id] = Math.max(est, dom, prev);
      }
    }
    return paintOrderElements(applyStorySpacing(elements, merged));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements, dragTick, resizeTick, applyStorySpacing, canvas.measuredHeights, collectDomMeasuredHeights]);

  const layoutMinY = useMemo(
    () => (displayElements.length === 0 ? 0 : Math.min(0, ...displayElements.map((e) => e.y))),
    [displayElements],
  );
  const layoutTop = (y: number) => y - layoutMinY;
  const h = canvasHeight(displayElements, layoutMinY);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [elRect, setElRect] = useState<DOMRect | null>(null);
  // Placement mode: user picked an element type from the menu and must click to place it
  const [pendingKind, setPendingKind] = useState<string | null>(null);
  const [ghostY, setGhostY] = useState<number>(0);
  const uploadRefs = useRef<Map<string, React.RefObject<HTMLInputElement>>>(new Map());
  const clipboardRef = useRef<CanvasEl | null>(null);
  // Guards against re-entrant reflow loops
  const isReflowingRef = useRef(false);
  const canvasSnapshotRef = useRef(canvas);
  canvasSnapshotRef.current = canvas;
  const historyStackRef = useRef<NewsletterCanvasData[]>([]);
  const redoStackRef = useRef<NewsletterCanvasData[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0);
  const canUndo = historyVersion >= 0 && historyStackRef.current.length > 0;
  const canRedo = historyVersion >= 0 && redoStackRef.current.length > 0;

  const cloneCanvasState = (source: NewsletterCanvasData): NewsletterCanvasData =>
    structuredClone(source);

  const bumpHistoryUi = useCallback(() => setHistoryVersion((v) => v + 1), []);

  const recordHistory = useCallback(() => {
    historyStackRef.current.push(cloneCanvasState(canvasSnapshotRef.current));
    if (historyStackRef.current.length > 60) historyStackRef.current.shift();
    redoStackRef.current = [];
    bumpHistoryUi();
  }, [bumpHistoryUi]);

  const upd = useCallback((
    patch: Partial<NewsletterCanvasData>,
    opts?: { skipHistory?: boolean },
  ) => {
    const skip =
      opts?.skipHistory ||
      isReflowingRef.current ||
      skipHistoryDuringDragRef.current;
    const hasUserEdit =
      patch.elements !== undefined ||
      patch.measuredHeights !== undefined ||
      patch.dividerDefaults !== undefined ||
      patch.storySpacingGaps !== undefined;
    if (!skip && hasUserEdit) recordHistory();
    onChange?.({ ...canvasSnapshotRef.current, ...patch });
  }, [onChange, recordHistory]);

  const undo = useCallback(() => {
    const prev = historyStackRef.current.pop();
    if (!prev) return;
    redoStackRef.current.push(cloneCanvasState(canvasSnapshotRef.current));
    bumpHistoryUi();
    onChange?.(prev);
  }, [onChange, bumpHistoryUi]);

  const redo = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    historyStackRef.current.push(cloneCanvasState(canvasSnapshotRef.current));
    bumpHistoryUi();
    onChange?.(next);
  }, [onChange, bumpHistoryUi]);

  const skipHistoryDuringDragRef = useRef(false);
  const dragHistoryRecordedRef = useRef(false);

  const finishUpd = useCallback(
    (
      next: CanvasEl[],
      gapOverrides?: StorySpacingGaps,
      relayoutOpts?: RelayoutOptions,
    ) => {
      const g = gapOverrides ?? storySpacingGaps ?? DEFAULT_STORY_SPACING_GAPS;
      const domHeights = collectDomMeasuredHeights();
      const mergedHeights: Record<string, number> = { ...(canvas.measuredHeights ?? {}) };
      for (const el of next) {
        const est = measureElementHeight(el);
        const dom = domHeights[el.id] ?? 0;
        const prev = mergedHeights[el.id] ?? 0;
        if (el.kind === "story-grid") {
          mergedHeights[el.id] = mergeStoryGridMeasuredHeight(est, dom, prev);
        } else {
          mergedHeights[el.id] = Math.max(est, dom, prev);
        }
      }
      const heightOf = canvasLayoutHeightOf(mergedHeights);

      isReflowingRef.current = true;
      const base = relayoutOpts?.compact ? clearSpacingLocks(next) : next;
      const stacked = relayoutNewsletterCanvas(base, g, heightOf, {
        compact: true,
        ...relayoutOpts,
      });
      upd({ elements: stacked, measuredHeights: collectCanonicalMeasuredHeights(stacked, mergedHeights) });
      requestAnimationFrame(() => {
        isReflowingRef.current = false;
      });
    },
    [upd, storySpacingGaps, canvas.measuredHeights, collectDomMeasuredHeights],
  );

  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  const beginResize = useCallback((id: string) => {
    resizingIdRef.current = id;
    setResizeTick((t) => t + 1);
  }, []);

  const endResize = useCallback(() => {
    resizingIdRef.current = null;
    setResizeTick((t) => t + 1);
  }, []);

  const montageResizeOrigRef = useRef<{ groupId: string; bounds: MontageBounds } | null>(null);

  const beginMontageGroupResize = useCallback((groupId: string) => {
    const tiles = elementsRef.current.filter(
      (e): e is CanvasImageEl => isImage(e) && e.montageGroup === groupId,
    );
    if (tiles.length === 0) return;
    montageResizeOrigRef.current = { groupId, bounds: montageGroupBounds(tiles) };
    beginResize(groupId);
  }, [beginResize]);

  const endMontageGroupResize = useCallback(() => {
    montageResizeOrigRef.current = null;
    endResize();
  }, [endResize]);

  const applyMontageGroupResize = useCallback((
    mode: "se" | "e" | "s" | "w" | "n",
    dx: number,
    dy: number,
  ) => {
    const origState = montageResizeOrigRef.current;
    if (!origState) return;
    const { groupId, bounds: orig } = origState;
    const minW = 120;
    const minH = 80;
    let next: MontageBounds = { ...orig };
    switch (mode) {
      case "se":
        next = { ...orig, w: Math.max(minW, orig.w + dx), h: Math.max(minH, orig.h + dy) };
        break;
      case "e":
        next = { ...orig, w: Math.max(minW, orig.w + dx) };
        break;
      case "s":
        next = { ...orig, h: Math.max(minH, orig.h + dy) };
        break;
      case "w": {
        const w = Math.max(minW, orig.w - dx);
        next = { minX: orig.minX + orig.w - w, minY: orig.minY, w, h: orig.h };
        break;
      }
      case "n": {
        const h = Math.max(minH, orig.h - dy);
        next = { minX: orig.minX, minY: orig.minY + orig.h - h, w: orig.w, h };
        break;
      }
    }
    upd({
      elements: relayoutMontageGroupElements(
        elementsRef.current,
        groupId,
        elementsRef.current.filter(
          (e): e is CanvasImageEl => isImage(e) && e.montageGroup === groupId,
        ),
        next,
      ),
    });
  }, [upd]);

  const setMontageGroupSize = useCallback((groupId: string, w: number, h: number) => {
    const tiles = elementsRef.current.filter(
      (e): e is CanvasImageEl => isImage(e) && e.montageGroup === groupId,
    );
    if (tiles.length < 2) return;
    const bounds = montageGroupBounds(tiles);
    const frame = {
      ...bounds,
      w: Math.max(120, Math.round(w)),
      h: Math.max(80, Math.round(h)),
    };
    upd({ elements: relayoutMontageGroupElements(elementsRef.current, groupId, tiles, frame) });
  }, [upd]);

  const finishUpdRef = useRef(finishUpd);
  finishUpdRef.current = finishUpd;

  // Persist enforced story spacing + measured heights for email export parity.
  useLayoutEffect(() => {
    if (!canEdit || isReflowingRef.current || draggingIdRef.current || resizingIdRef.current) return;

    const measuredHeights = collectMeasuredHeights();
    const heightOf = canvasLayoutHeightOf(measuredHeights);
    const enforced = applyStorySpacing(elementsRef.current, measuredHeights);

    if (
      contentOverlapsGreeting(enforced, heightOf) ||
      firstStorySectionOverlapsGrid(enforced, heightOf)
    ) {
      isReflowingRef.current = true;
      finishUpdRef.current(enforced, gaps);
      requestAnimationFrame(() => {
        isReflowingRef.current = false;
      });
      return;
    }

    let changed = false;
    for (const e of enforced) {
      const orig = elementsRef.current.find((o) => o.id === e.id);
      if (orig && Math.abs(orig.y - e.y) >= 1) {
        changed = true;
        break;
      }
    }
    if (!changed) {
      for (const [id, h] of Object.entries(measuredHeights)) {
        if ((canvas.measuredHeights?.[id] ?? 0) !== h) {
          changed = true;
          break;
        }
      }
    }
    if (!changed) return;

    isReflowingRef.current = true;
    upd({ elements: enforced, measuredHeights });
    requestAnimationFrame(() => {
      isReflowingRef.current = false;
    });
  }, [canEdit, elements, applyStorySpacing, collectMeasuredHeights, canvas.measuredHeights, upd]);

  const compactWithPin = useCallback(
    (next: CanvasEl[], target: CanvasEl | undefined) => {
      const heightOf = canvasLayoutHeightOf(canvas.measuredHeights);
      const preserveIds = target ? pinIdsForElement(target, next) : undefined;
      return relayoutNewsletterCanvas(next, gaps, heightOf, {
        compact: true,
        preserveIds,
      });
    },
    [gaps, canvas.measuredHeights],
  );

  const clickToStoredY = useCallback(
    (clickY: number) => {
      const pad = layoutMinY < 0 ? -layoutMinY : 0;
      return Math.max(0, Math.round(clickY - pad + layoutMinY));
    },
    [layoutMinY],
  );

  const applyCompact = useCallback(
    (next: CanvasEl[], target: CanvasEl | undefined) => {
      isReflowingRef.current = true;
      const stacked = compactWithPin(next, target);
      requestAnimationFrame(() => {
        isReflowingRef.current = false;
      });
      return stacked;
    },
    [compactWithPin],
  );

  const updEl = useCallback((id: string, patch: Partial<CanvasEl>, opts?: { skipHistory?: boolean }) => {
    const current = elementsRef.current;
    const target = current.find((e) => e.id === id);

    // Detach from montage: nudge aside, raise z-index, re-layout remaining tiles.
    if (
      target &&
      isImage(target) &&
      target.montageGroup &&
      "montageGroup" in patch &&
      patch.montageGroup === undefined
    ) {
      const next = current.map((e) => {
        if (e.id !== id || !isImage(e)) return e;
        return {
          ...e,
          ...patch,
          montageIndex: undefined,
          montageCols: undefined,
          montageDetached: true,
          x: e.x + 24,
          y: e.y + 24,
          zIndex: Math.max(e.zIndex ?? 5, 15) + 10,
        } as CanvasImageEl;
      });
      upd({ elements: applyAllMontageLayouts(next) });
      return;
    }

    // Montage crop/zoom: update in place — never run compact stack / relayout.
    if (target && isImage(target) && isMontageTile(target) && patchIsMontageCrop(patch)) {
      upd({
        elements: current.map((e) =>
          e.id === id ? ({ ...e, ...patch } as CanvasEl) : e,
        ),
      });
      return;
    }

    // Montage corner radius: sync to every tile in the group, then re-mosaic.
    if (target && isImage(target) && isMontageTile(target) && "borderRadius" in patch) {
      const r = (patch as { borderRadius: number }).borderRadius;
      const groupId = target.montageGroup;
      const next = current.map((e) =>
        isImage(e) && e.montageGroup === groupId
          ? ({ ...e, borderRadius: r } as CanvasEl)
          : e.id === id
            ? ({ ...e, ...patch } as CanvasEl)
            : e,
      );
      upd({ elements: applyAllMontageLayouts(next) });
      return;
    }

    // Montage tiles: block individual geometry edits (layout owns x/y/w/h).
    if (
      target &&
      isImage(target) &&
      isMontageTile(target) &&
      ("x" in patch || "y" in patch || "w" in patch || "h" in patch)
    ) {
      return;
    }

    // Montage: toolbar "Centre on canvas" (X only) moves the whole group together.
    if (
      target &&
      isImage(target) &&
      target.montageGroup &&
      "x" in patch &&
      !("y" in patch) &&
      !("w" in patch) &&
      !("h" in patch)
    ) {
      const rawX = (patch as { x: number }).x;
      const centreForEl = Math.round((716 - target.w) / 2);
      if (rawX === centreForEl) {
        const group = current.filter(
          (e): e is CanvasImageEl =>
            isImage(e) && (e as CanvasImageEl).montageGroup === target.montageGroup,
        );
        const groupMinX = Math.min(...group.map((e) => e.x));
        const groupMaxX = Math.max(...group.map((e) => e.x + e.w));
        const groupW = groupMaxX - groupMinX;
        const dx = Math.round((716 - groupW) / 2) - groupMinX;
        upd({
          elements: current.map((e) =>
            isImage(e) && (e as CanvasImageEl).montageGroup === target.montageGroup
              ? ({ ...e, x: e.x + dx } as CanvasEl)
              : e,
          ),
        });
        return;
      }
    }

    const next = current.map((e) =>
      e.id === id ? ({ ...e, ...patch } as CanvasEl) : e,
    );

    const withLock =
      patchIsPositionOnly(patch) && "y" in patch
        ? next.map((e) => (e.id === id ? ({ ...e, spacingLocked: true } as CanvasEl) : e))
        : next;

    if (patchIsXOnly(patch)) {
      upd({ elements: withLock }, opts);
      return;
    }

    // Position changes should move only the selected element.
    // Auto-compacting here causes later elements to cascade far down the canvas.
    if (target && patchIsPositionOnly(patch)) {
      upd({ elements: withLock }, opts);
      return;
    }

    // Dividers: width/style edits must not re-stack the canvas (jumps greeting/title).
    if (target && isDivider(target)) {
      upd({ elements: withLock }, opts);
      return;
    }

    if (patchNeedsCompactStack(patch)) {
      // Standalone images: resize in place — compact stack hides tiles under montages.
      if (target && isImage(target) && !target.montageGroup) {
        upd({ elements: withLock }, opts);
        return;
      }
      upd({ elements: applyCompact(withLock, target) }, opts);
      return;
    }

    // Text / greeting growth: push everything below so Laura's letter opens space.
    if (
      target &&
      isText(target) &&
      patchNeedsRelayout(patch) &&
      ("html" in patch || "fontSize" in patch || "lineHeight" in patch || "w" in patch)
    ) {
      const nextEl = { ...target, ...patch } as CanvasTextEl;
      const oldH = measureElementHeight(target);
      const newH = measureElementHeight(nextEl);
      const delta = newH - oldH;
      let els = withLock;
      if (Math.abs(delta) >= 1) {
        els = pushElementsAfter(els, id, delta, new Set());
      }
      const measuredHeights = { ...(canvasSnapshotRef.current.measuredHeights ?? {}) };
      delete measuredHeights[id];
      measuredHeights[id] = newH;
      upd({ elements: els, measuredHeights }, opts);
      return;
    }

    if (patchNeedsRelayout(patch)) {
      upd({ elements: withLock }, opts);
      return;
    }

    upd({ elements: withLock }, opts);
  }, [upd, applyCompact]);

  const delEl = useCallback((id: string) => {
    setSelectedId(null);
    setEditingId(null);
    upd({ elements: elements.filter((e) => e.id !== id) });
  }, [elements, upd]);

  const addEl = useCallback((el: CanvasEl) => {
    const next = [...elementsRef.current, el];
    upd({ elements: applyCompact(next, el) });
    setSelectedId(el.id);
  }, [upd, applyCompact]);

  // Deselect on outside click
  useEffect(() => {
    if (!canEdit) return;
    const handler = (e: PointerEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      const toolbar = document.querySelector(".nl-canvas-toolbar");
      if (toolbar?.contains(target)) return;
      const formatBar = document.querySelector(".nl-inline-format-bar");
      if (formatBar?.contains(target)) return;
      setSelectedId(null);
      setEditingId(null);
    };
    window.addEventListener("pointerdown", handler);
    return () => window.removeEventListener("pointerdown", handler);
  }, [canEdit]);

  // Update toolbar rect only when selection changes (NOT on every elements update —
  // that would reposition the toolbar on every slider tick causing glitch).
  // Window resize/scroll keep it accurate without fighting slider drags.
  useEffect(() => {
    if (!selectedId) { setElRect(null); return; }
    const update = () => {
      const domEl = elRefs.current.get(selectedId);
      if (domEl) setElRect(domEl.getBoundingClientRect());
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]); // intentionally exclude elements — toolbar must not jump on slider drag

  const handlePointerDown = useCallback((id: string, e: React.PointerEvent) => {
    if (!canEdit) return;
    // When already editing this text, let the browser handle clicks natively
    if (editingId === id) {
      e.stopPropagation();
      return;
    }
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const el = elements.find((x) => x.id === id);
    if (!el) return;

    // Montage tiles: click selects; geometry is fixed — pan via drag on the image itself.
    if (isMontageTile(el)) {
      setSelectedId(id);
      const domEl = elRefs.current.get(id);
      if (domEl) setElRect(domEl.getBoundingClientRect());
      return;
    }

    const origX = el.x;
    const origY = el.y;
    let moved = false;
    let lastX = origX;
    let lastY = origY;
    dragHistoryRecordedRef.current = false;
    skipHistoryDuringDragRef.current = false;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) > 3) {
        moved = true;
        draggingIdRef.current = id;
        skipHistoryDuringDragRef.current = true;
        setDragTick((t) => t + 1);
      }
      if (moved) {
        if (!dragHistoryRecordedRef.current) {
          recordHistory();
          dragHistoryRecordedRef.current = true;
        }
        lastX = Math.round(origX + dx);
        lastY = Math.max(0, Math.round(origY + dy));
        updEl(id, { x: lastX, y: lastY }, { skipHistory: true });
      }
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      skipHistoryDuringDragRef.current = false;
      if (draggingIdRef.current === id) {
        draggingIdRef.current = null;
        setDragTick((t) => t + 1);
      }
      if (!moved) {
        setSelectedId(id);
        const domEl = elRefs.current.get(id);
        if (domEl) setElRect(domEl.getBoundingClientRect());
        const clickedEl = elements.find((x) => x.id === id);
        if (clickedEl && isText(clickedEl)) {
          setEditingId(id);
        }
        return;
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [canEdit, editingId, elements, updEl, recordHistory]);

  useEffect(() => {
    if (!canEdit) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.isContentEditable ||
          t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT")
      ) {
        return;
      }
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canEdit, undo, redo]);

  const selectedEl = elements.find((e) => e.id === selectedId) ?? null;
  const selectedMontageCount =
    selectedEl && isImage(selectedEl) && selectedEl.montageGroup
      ? elements.filter(
          (e): e is CanvasImageEl => isImage(e) && e.montageGroup === selectedEl.montageGroup,
        ).length
      : 0;
  const selectedMontageBounds =
    selectedEl && isImage(selectedEl) && selectedEl.montageGroup && isMontageTile(selectedEl)
      ? montageGroupBounds(
          elements.filter(
            (e): e is CanvasImageEl => isImage(e) && e.montageGroup === selectedEl.montageGroup,
          ),
        )
      : null;

  const getUploadRef = (id: string) => {
    if (!uploadRefs.current.has(id)) {
      uploadRefs.current.set(id, { current: null } as React.RefObject<HTMLInputElement>);
    }
    return uploadRefs.current.get(id)!;
  };

  const uploadCanvasImages = useCallback((files: File[]) => {
    if (files.length === 0) return Promise.resolve([] as string[]);
    return Promise.all(files.map(async (f) => {
      try {
        const form = new FormData();
        form.append("file", f);
        const res = await fetch("/api/upload-canvas-image", { method: "POST", body: form });
        if (res.ok) {
          const data = await res.json() as { url?: string };
          if (data.url) return data.url;
        }
      } catch { /* fall through to base64 */ }
      return new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = (ev) => resolve(ev.target?.result as string);
        r.readAsDataURL(f);
      });
    }));
  }, []);

  const relayoutMontageGroup = useCallback((
    current: CanvasEl[],
    groupId: string,
    tiles: CanvasImageEl[],
  ): CanvasEl[] => relayoutMontageGroupElements(current, groupId, tiles),
  []);

  const appendImagesToMontage = useCallback((tileId: string, srcs: string[]) => {
    if (srcs.length === 0) return;
    const current = elementsRef.current;
    const target = current.find((e) => e.id === tileId);
    if (!target || !isImage(target)) return;

    const groupId = target.montageGroup ?? target.id;
    const existing = current.filter(
      (e): e is CanvasImageEl => isImage(e) && e.montageGroup === groupId,
    );
    const tiles = existing.length > 0 ? existing : [target];
    const room = MAX_MONTAGE_IMAGES - tiles.length;
    if (room <= 0) return;

    const hero = montageHeroTile(tiles);
    const originY = Math.min(...tiles.map((e) => e.y));
    const radius = Math.max(
      MONTAGE_DEFAULT_BORDER_RADIUS,
      ...tiles.map((e) => montageTileBorderRadius(e)),
    );
    const maxIndex = Math.max(-1, ...tiles.map((e) => e.montageIndex ?? 0));

    const newcomers = srcs.slice(0, room).map((src, i) =>
      makeImageEl(src, {
        x: CANVAS_COL_X,
        y: originY,
        w: CANVAS_COL_W,
        h: hero.h >= 100 ? hero.h : 260,
        zIndex: target.zIndex,
        borderRadius: radius,
        shadow: target.shadow,
        montageGroup: groupId,
        montageIndex: maxIndex + 1 + i,
      }),
    );

    let combined = [...tiles];
    if (tiles.length === 1 && !tiles[0].montageGroup) {
      combined = [{
        ...tiles[0],
        montageGroup: groupId,
        montageIndex: 0,
        borderRadius: radius,
      }];
    }
    combined = [...combined, ...newcomers];

    upd({ elements: relayoutMontageGroup(current, groupId, combined) });
  }, [relayoutMontageGroup, upd]);

  const handleImageFiles = useCallback((id: string, files: File[]) => {
    if (files.length === 0) return;

    uploadCanvasImages(files).then((srcs) => {
      const current = elementsRef.current;
      const target = current.find((e) => e.id === id);
      if (!target || !isImage(target)) return;

      if (isMastheadOverlayImage(target)) {
        upd({
          elements: current.map((e) =>
            e.id === id ? ({ ...e, src: srcs[0] } as CanvasEl) : e,
          ),
        });
        return;
      }

      if (target.montageGroup) {
        if (srcs.length === 1) {
          upd({
            elements: current.map((e) =>
              e.id === id ? ({ ...e, src: srcs[0] } as CanvasEl) : e,
            ),
          });
        } else {
          appendImagesToMontage(id, srcs);
        }
        return;
      }

      if (srcs.length === 1) {
        upd({
          elements: current.map((e) =>
            e.id === id ? ({ ...e, src: srcs[0] } as CanvasEl) : e,
          ),
        });
        return;
      }

      const heroH = target.h >= 100 ? target.h : 260;
      const draft: CanvasImageEl[] = srcs.map((src, i) =>
        makeImageEl(src, {
          id: i === 0 ? id : uid(),
          x: CANVAS_COL_X,
          y: target.y,
          w: CANVAS_COL_W,
          h: heroH,
          zIndex: target.zIndex,
          borderRadius: target.borderRadius || MONTAGE_DEFAULT_BORDER_RADIUS,
          shadow: target.shadow,
          montageGroup: id,
          montageCols: 2,
          montageIndex: i,
        }),
      );
      const montage = layoutMontageMosaic(draft, { originY: target.y });
      upd({ elements: [...current.filter((e) => e.id !== id), ...montage] });
    });
  }, [appendImagesToMontage, uploadCanvasImages, upd]);

  const handleAddMontageImages = useCallback((tileId: string, files: File[]) => {
    if (files.length === 0) return;
    uploadCanvasImages(files).then((srcs) => appendImagesToMontage(tileId, srcs));
  }, [appendImagesToMontage, uploadCanvasImages]);

  const bringForward = (id: string) => {
    const el = elements.find((e) => e.id === id);
    if (el) updEl(id, { zIndex: (el.zIndex ?? 1) + 1 });
  };
  const sendBack = (id: string) => {
    const el = elements.find((e) => e.id === id);
    if (el) updEl(id, { zIndex: Math.max(0, (el.zIndex ?? 1) - 1) });
  };

  const duplicateEl = useCallback((id: string) => {
    const el = elementsRef.current.find((e) => e.id === id);
    if (!el) return;
    const copy = { ...el, id: uid(), x: el.x + 20, y: el.y + 20 } as CanvasEl;
    addEl(copy);
  }, [addEl]);

  // Keyboard copy/paste: Cmd+C copies selected, Cmd+V pastes offset clone
  useEffect(() => {
    if (!canEdit) return;
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      // Don't intercept when typing inside an input/textarea/contentEditable
      const tag = (e.target as HTMLElement).tagName;
      const isEditing = (e.target as HTMLElement).isContentEditable
        || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (e.key === "c" && !isEditing) {
        const sel = elements.find((el) => el.id === selectedId);
        if (sel) { clipboardRef.current = sel; e.preventDefault(); }
      }
      if (e.key === "v" && !isEditing) {
        const src = clipboardRef.current;
        if (!src) return;
        e.preventDefault();
        const copy = { ...src, id: uid(), x: src.x + 20, y: src.y + 20 } as CanvasEl;
        addEl(copy);
      }
      if ((e.key === "d") && !isEditing) {
        if (selectedId) { e.preventDefault(); duplicateEl(selectedId); }
      }
      if (e.key === "Escape") {
        setPendingKind(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canEdit, elements, selectedId, addEl, duplicateEl]);

  // Place a pending element at a given canvas y (called on canvas click in placement mode)
  const placePending = (y: number) => {
    if (!pendingKind) return;
    const inheritColor = (elements.find(e => e.kind === "text") as import("../../lib/story-types").CanvasTextEl | undefined)?.color ?? "#1a3a36";
    let el: CanvasEl;
    switch (pendingKind) {
      case "heading":
        el = makeTextEl({ y, color: inheritColor, fontSize: 28, fontWeight: 700, lineHeight: 1.2 });
        break;
      case "text":
        el = makeTextEl({ y, color: inheritColor });
        break;
      case "textbox":
        el = makeTextEl({ y, color: inheritColor, bg: "rgba(255,255,255,0.08)", borderWidth: 1, borderRadius: 8, borderColor: "rgba(167,199,188,0.3)" });
        break;
      case "image":
        el = makeImageEl("", { y });
        break;
      case "divider-full":
        el = makeDividerEl({ y, x: 0, w: 716 }, canvas.dividerDefaults);
        break;
      case "divider-deco":
        el = makeDividerEl({ y, x: 158, w: 400 }, canvas.dividerDefaults);
        break;
      case "spacer":
        el = makeDividerEl({ y, x: 0, w: 716, thickness: 0, color: "transparent" }, canvas.dividerDefaults);
        break;
      case "cta":
        el = makeCtaEl({ y, x: Math.round((716 - 260) / 2), w: 260 });
        break;
      default:
        el = makeTextEl({ y, color: inheritColor });
    }
    addEl(el);
    setPendingKind(null);
  };

  const ADD_MENU_ITEMS: { kind: string; label: string; icon: string }[] = [
    { kind: "heading",      label: "Heading",            icon: "H" },
    { kind: "text",         label: "Text",               icon: "T" },
    { kind: "textbox",      label: "Text box",           icon: "⬜" },
    { kind: "image",        label: "Image / montage",    icon: "🖼" },
    { kind: "divider-full", label: "Divider (full rule)", icon: "—" },
    { kind: "divider-deco", label: "Decorative line",    icon: "╌" },
    { kind: "spacer",       label: "Spacer",             icon: "↕" },
    { kind: "cta",          label: "CTA button",         icon: "✦" },
  ];

  const compactSpacing = useCallback(
    (gapOverrides?: StorySpacingGaps) => {
      finishUpd(elements, gapOverrides, { compact: true, resetIssueHeading: true });
    },
    [elements, finishUpd],
  );

  const restoreMontages = useCallback(() => {
    const cleared = elements.map((e) => {
      if (!isImage(e) || !e.montageGroup) return e;
      const next = { ...e } as CanvasImageEl;
      delete next.montageFrameW;
      delete next.montageFrameH;
      delete (next as { montageCustomBounds?: boolean }).montageCustomBounds;
      return next;
    });
    upd({ elements: applyAllMontageLayouts(cleared) });
  }, [elements, upd]);

  useImperativeHandle(ref, () => ({ compactSpacing, restoreMontages }), [compactSpacing, restoreMontages]);

  const isVisualPreview = Boolean(visualPreview);
  const fitToWidth = isVisualPreview || !canEdit;
  const previewOuterRef = useRef<HTMLDivElement>(null);
  const [fitPreviewWidth, setFitPreviewWidth] = useState(visualPreview?.width ?? CANVAS_W);

  useLayoutEffect(() => {
    if (!fitToWidth) return;
    const el = previewOuterRef.current;
    if (!el) return;
    const cap = visualPreview?.width ?? CANVAS_W;
    const measure = () => {
      const w = el.clientWidth;
      setFitPreviewWidth(Math.min(cap, w > 0 ? w : cap));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitToWidth, visualPreview?.width]);

  const previewScale = fitToWidth ? fitPreviewWidth / CANVAS_W : 1;
  const previewBg = visualPreview?.backgroundColor?.trim() || "#10151c";

  const canvasSurface = (
      <div
        ref={containerRef}
        className={`nl-canvas${canEdit && !isVisualPreview ? " nl-canvas-edit" : ""}${pendingKind ? " nl-canvas-placing" : ""}${isVisualPreview ? " nl-canvas-visual" : ""}`}
        style={{ position: "relative", width: CANVAS_W, maxWidth: "100%", minHeight: h, paddingTop: layoutMinY < 0 ? -layoutMinY : 0 }}
        onPointerMove={pendingKind ? (e) => {
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) setGhostY(clickToStoredY(Math.round(e.clientY - rect.top)));
        } : undefined}
        onClick={(e) => {
          if (pendingKind) {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) placePending(clickToStoredY(Math.round(e.clientY - rect.top)));
            return;
          }
          if (e.target === containerRef.current) {
            setSelectedId(null);
            setEditingId(null);
          }
        }}
      >
        {/* Ghost placement line */}
        {pendingKind && (
          <div className="nl-canvas-ghost-line" style={{ top: layoutTop(ghostY) }}>
            <span className="nl-canvas-ghost-label">
              {ADD_MENU_ITEMS.find(i => i.kind === pendingKind)?.label ?? pendingKind}
            </span>
          </div>
        )}
        {displayElements.map((el) => {
          const sel = el.id === selectedId;
          const editing = el.id === editingId;
          const setRef = (node: HTMLDivElement | null) => {
            if (node) {
              elRefs.current.set(el.id, node);
              node.dataset.elId = el.id;
            } else {
              elRefs.current.delete(el.id);
            }
          };

          if (isText(el)) return (
            <div
              key={el.id}
              ref={setRef}
              style={{
                position: "absolute",
                left: el.x,
                top: layoutTop(el.y),
                width: el.w,
                zIndex: el.zIndex ?? 5,
              }}
            >
              <TextElView
                el={el} selected={sel} editing={editing} canEdit={canEdit}
                onPointerDown={(e) => handlePointerDown(el.id, e)}
                onBlur={(html) => { updEl(el.id, { html }); setEditingId(null); }}
                onInput={(html) => updEl(el.id, { html })}
              />
            </div>
          );

          if (isImage(el)) {
            const ref = getUploadRef(el.id);
            return (
              <div key={el.id} ref={setRef} style={{ position: "absolute", left: el.x, top: layoutTop(el.y), width: el.w, height: el.h, zIndex: el.zIndex, overflow: "visible" }}>
                <ImageElView
                  el={el} selected={sel} canEdit={canEdit}
                  allElements={displayElements}
                  onPointerDown={(e) => handlePointerDown(el.id, e)}
                  onCropPan={(objectPositionX, objectPositionY) =>
                    updEl(el.id, { objectPositionX, objectPositionY })
                  }
                  uploadRef={ref}
                  onReplace={(files) => handleImageFiles(el.id, files)}
                />
                {sel && canEdit && !el.montageGroup && (() => {
                  const origW = el.w, origH = el.h;
                  const resizeStart = () => beginResize(el.id);
                  const resizeEnd = () => endResize();
                  return (<>
                    {/* right edge */}
                    <ResizeHandle cursor="ew-resize"
                      style={{ position: "absolute", right: -5, top: "10%", width: 10, height: "80%" }}
                      onResizeStart={resizeStart}
                      onResizeEnd={resizeEnd}
                      onResize={(dx) => updEl(el.id, { w: Math.max(40, origW + dx) })} />
                    {/* bottom edge */}
                    <ResizeHandle cursor="ns-resize"
                      style={{ position: "absolute", bottom: -5, left: "10%", width: "80%", height: 10 }}
                      onResizeStart={resizeStart}
                      onResizeEnd={resizeEnd}
                      onResize={(_, dy) => updEl(el.id, { h: Math.max(20, origH + dy) })} />
                    {/* bottom-right corner */}
                    <ResizeHandle cursor="nwse-resize"
                      style={{ position: "absolute", right: -6, bottom: -6, width: 16, height: 16 }}
                      onResizeStart={resizeStart}
                      onResizeEnd={resizeEnd}
                      onResize={(dx, dy) => updEl(el.id, { w: Math.max(40, origW + dx), h: Math.max(20, origH + dy) })} />
                    {/* left edge */}
                    <ResizeHandle cursor="ew-resize"
                      style={{ position: "absolute", left: -5, top: "10%", width: 10, height: "80%" }}
                      onResizeStart={resizeStart}
                      onResizeEnd={resizeEnd}
                      onResize={(dx) => updEl(el.id, { x: el.x + dx, w: Math.max(40, origW - dx) })} />
                    {/* top edge */}
                    <ResizeHandle cursor="ns-resize"
                      style={{ position: "absolute", top: -5, left: "10%", width: "80%", height: 10 }}
                      onResizeStart={resizeStart}
                      onResizeEnd={resizeEnd}
                      onResize={(_, dy) => updEl(el.id, { y: el.y + dy, h: Math.max(20, origH - dy) })} />
                  </>);
                })()}
              </div>
            );
          }

          if (isDivider(el)) return (
            <DividerElView
              key={el.id}
              outerRef={setRef}
              el={el} selected={sel} canEdit={canEdit} layoutMinY={layoutMinY}
              onPointerDown={(e) => handlePointerDown(el.id, e)}
            />
          );

          if (isStoryGrid(el)) {
            // Dynamically inject image srcs from canvas image frames so the grid
            // always reflects the latest uploaded images without needing a re-pour.
            const enrichedEl = {
              ...el,
              stories: el.stories.map((s, cardIdx) => {
                const imgEl = elements.find(
                  (e): e is CanvasImageEl =>
                    isImage(e) && (e as CanvasImageEl).id === `migrated-si-${cardIdx}`
                );
                const liveSrc = imgEl?.src;
                return liveSrc ? { ...s, imageUrl: liveSrc } : s;
              }),
            };
            return (
              <StoryGridElView
                key={el.id}
                outerRef={setRef}
                el={enrichedEl} selected={sel} canEdit={canEdit} layoutMinY={layoutMinY}
                onPointerDown={(e) => handlePointerDown(el.id, e)}
              />
            );
          }

          if (isCta(el)) return (
            <CtaElView
              key={el.id}
              outerRef={setRef}
              el={el} selected={sel} canEdit={canEdit} layoutMinY={layoutMinY}
              onPointerDown={(e) => handlePointerDown(el.id, e)}
            />
          );

          return null;
        })}
        {canEdit && selectedEl && isImage(selectedEl) && selectedEl.montageGroup && isMontageTile(selectedEl) && (() => {
          const groupId = selectedEl.montageGroup!;
          const b = selectedMontageBounds ?? montageGroupBounds(
            displayElements.filter(
              (e): e is CanvasImageEl => isImage(e) && e.montageGroup === groupId,
            ),
          );
          const resizeStart = () => beginMontageGroupResize(groupId);
          const resizeEnd = () => endMontageGroupResize();
          return (
            <div
              key={`montage-resize-${groupId}`}
              style={{
                position: "absolute",
                left: b.minX,
                top: layoutTop(b.minY),
                width: b.w,
                height: b.h,
                zIndex: 10000,
                pointerEvents: "none",
                boxShadow: "inset 0 0 0 2px rgba(126, 200, 232, 0.95)",
                borderRadius: 4,
              }}
            >
              <ResizeHandle cursor="ew-resize"
                style={{ position: "absolute", right: -5, top: "10%", width: 10, height: "80%", pointerEvents: "auto" }}
                onResizeStart={resizeStart}
                onResizeEnd={resizeEnd}
                onResize={(dx) => applyMontageGroupResize("e", dx, 0)} />
              <ResizeHandle cursor="ns-resize"
                style={{ position: "absolute", bottom: -5, left: "10%", width: "80%", height: 10, pointerEvents: "auto" }}
                onResizeStart={resizeStart}
                onResizeEnd={resizeEnd}
                onResize={(_, dy) => applyMontageGroupResize("s", 0, dy)} />
              <ResizeHandle cursor="nwse-resize"
                style={{ position: "absolute", right: -6, bottom: -6, width: 16, height: 16, pointerEvents: "auto" }}
                onResizeStart={resizeStart}
                onResizeEnd={resizeEnd}
                onResize={(dx, dy) => applyMontageGroupResize("se", dx, dy)} />
              <ResizeHandle cursor="ew-resize"
                style={{ position: "absolute", left: -5, top: "10%", width: 10, height: "80%", pointerEvents: "auto" }}
                onResizeStart={resizeStart}
                onResizeEnd={resizeEnd}
                onResize={(dx) => applyMontageGroupResize("w", dx, 0)} />
              <ResizeHandle cursor="ns-resize"
                style={{ position: "absolute", top: -5, left: "10%", width: "80%", height: 10, pointerEvents: "auto" }}
                onResizeStart={resizeStart}
                onResizeEnd={resizeEnd}
                onResize={(_, dy) => applyMontageGroupResize("n", 0, dy)} />
            </div>
          );
        })()}
      </div>
  );

  if (fitToWidth) {
    const scaledH = Math.ceil(h * previewScale);
    return (
      <div
        ref={previewOuterRef}
        className={isVisualPreview ? "nl-canvas-visual-preview" : "nl-canvas-outer nl-canvas-fit"}
        style={{ width: "100%", maxWidth: visualPreview?.width ?? CANVAS_W, height: scaledH }}
        aria-hidden={isVisualPreview || undefined}
      >
        <div
          className="nl-canvas-visual-preview-scaler"
          style={{
            width: CANVAS_W,
            height: h,
            transform: `scale(${previewScale})`,
            transformOrigin: "top left",
            background: isVisualPreview ? previewBg : undefined,
            position: "relative",
            pointerEvents: isVisualPreview ? "none" : undefined,
          }}
        >
          {canvasSurface}
        </div>
      </div>
    );
  }

  return (
    <div className="nl-canvas-outer">
      {canvasSurface}

      {canEdit && selectedEl && (
        <Toolbar
          el={selectedEl}
          rect={elRect}
          canvasHeight={h}
          onUpdate={(patch) => updEl(selectedEl.id, patch)}
          onDelete={() => delEl(selectedEl.id)}
          onClose={() => { setSelectedId(null); setEditingId(null); }}
          onBringForward={() => bringForward(selectedEl.id)}
          onSendBack={() => sendBack(selectedEl.id)}
          onApplyColorToAll={(color) => {
            upd({ elements: elements.map((e) =>
              e.kind === "text" ? { ...e, color } as CanvasEl : e
            )});
          }}
          onCentreAll={() => {
            upd({ elements: elements.map((e) => ({
              ...e,
              x: Math.round((716 - e.w) / 2),
            } as CanvasEl)) });
          }}
          onApplyDividerToAll={(defaults) => {
            upd({
              dividerDefaults: defaults,
              elements: elements.map((e) =>
                e.kind === "divider"
                  ? { ...e, color: defaults.color, thickness: defaults.thickness, lineStyle: defaults.lineStyle } as CanvasEl
                  : e
              ),
            });
          }}
          onApplyCtaToAll={(style) => {
            upd({
              elements: elements.map((e) =>
                e.kind === "cta"
                  ? { ...e, ...style } as CanvasEl
                  : e
              ),
            });
          }}
          onDuplicate={() => duplicateEl(selectedEl.id)}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          onSave={onSave}
          montageImageCount={selectedMontageCount}
          onAddMontageImages={
            selectedEl && isImage(selectedEl) && isMontageTile(selectedEl)
              ? (files) => handleAddMontageImages(selectedEl.id, files)
              : undefined
          }
          montageBounds={selectedMontageBounds}
          onMontageBoundsChange={
            selectedEl && isImage(selectedEl) && selectedEl.montageGroup
              ? (w, h) => setMontageGroupSize(selectedEl.montageGroup!, w, h)
              : undefined
          }
        />
      )}
    </div>
  );
});
