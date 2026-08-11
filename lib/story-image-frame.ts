import type { CSSProperties } from "react";
import type { StoryImageFrame } from "./story-types";
import { DEFAULT_STORY_IMAGE_FRAME } from "./story-types";

const THEME_DEFAULT_MAX_PX = 360;

/** Parse `imageFrame` from persisted JSON. Returns `undefined` when equivalent to legacy defaults. */
export function parseStoryImageFrame(raw: unknown): StoryImageFrame | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const aspectRatio = typeof o.aspectRatio === "string" ? o.aspectRatio.trim() : "";
  const maxHeightPx =
    typeof o.maxHeightPx === "number" && Number.isFinite(o.maxHeightPx)
      ? Math.min(2000, Math.max(0, Math.floor(o.maxHeightPx)))
      : 0;
  const objectFit = o.objectFit === "contain" ? "contain" : "cover";
  const offsetX = typeof o.offsetX === "number" && Number.isFinite(o.offsetX) ? o.offsetX : 0;
  const offsetY = typeof o.offsetY === "number" && Number.isFinite(o.offsetY) ? o.offsetY : 0;
  const zoom =
    typeof o.zoom === "number" && Number.isFinite(o.zoom) ? Math.min(5, Math.max(0.2, o.zoom)) : 1;
  if (
    aspectRatio === "" &&
    objectFit === "cover" &&
    maxHeightPx === 0 &&
    offsetX === 0 &&
    offsetY === 0 &&
    zoom === 1
  ) {
    return undefined;
  }
  return { aspectRatio, objectFit, maxHeightPx, offsetX, offsetY, zoom };
}

export function normalizeStoryImageFrame(f?: StoryImageFrame | null): StoryImageFrame {
  if (!f) return { ...DEFAULT_STORY_IMAGE_FRAME };
  return {
    aspectRatio: typeof f.aspectRatio === "string" ? f.aspectRatio.trim() : "",
    objectFit: f.objectFit === "contain" ? "contain" : "cover",
    maxHeightPx:
      typeof f.maxHeightPx === "number" && Number.isFinite(f.maxHeightPx) && f.maxHeightPx > 0
        ? Math.min(2000, Math.floor(f.maxHeightPx))
        : 0,
    offsetX: typeof f.offsetX === "number" && Number.isFinite(f.offsetX) ? f.offsetX : 0,
    offsetY: typeof f.offsetY === "number" && Number.isFinite(f.offsetY) ? f.offsetY : 0,
    zoom:
      typeof f.zoom === "number" && Number.isFinite(f.zoom)
        ? Math.min(5, Math.max(0.2, f.zoom))
        : 1
  };
}

/**
 * Layout for one story hero image (newsletter + blog): fixed frame uses aspect + max height;
 * without aspect ratio, max height caps a natural-aspect image.
 */
export function storySingleImageFrameStyles(frame?: StoryImageFrame | null): {
  wrapper: CSSProperties;
  img: CSSProperties;
} {
  const f = normalizeStoryImageFrame(frame);
  const maxPx = f.maxHeightPx > 0 ? f.maxHeightPx : THEME_DEFAULT_MAX_PX;
  const ar = f.aspectRatio.trim();
  const wrapper: CSSProperties = {
    width: "100%",
    maxHeight: `${maxPx}px`,
    marginInline: "auto",
    borderRadius: 12,
    overflow: "hidden",
    background: "rgba(255, 255, 255, 0.06)",
    boxSizing: "border-box",
    display: "block"
  };
  if (ar) {
    wrapper.aspectRatio = ar;
  }
  const img: CSSProperties = {
    width: "100%",
    display: "block",
    objectFit: f.objectFit,
    objectPosition: "center"
  };
  if (ar) {
    img.height = "100%";
  } else {
    img.height = "auto";
    img.maxHeight = `${maxPx}px`;
  }
  const ox = f.offsetX ?? 0;
  const oy = f.offsetY ?? 0;
  const zoom = f.zoom ?? 1;
  if (ox !== 0 || oy !== 0 || zoom !== 1) {
    img.transform = `translate(${ox}px, ${oy}px) scale(${zoom})`;
    img.transformOrigin = "center center";
  }
  return { wrapper, img };
}
