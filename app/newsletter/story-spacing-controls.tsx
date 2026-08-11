"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { StorySpacingGaps } from "../../lib/story-spacing-gaps";
import { DEFAULT_STORY_SPACING_GAPS } from "../../lib/story-spacing-gaps";

const POS_LS_KEY = "maroma-story-spacing-panel-pos";
const PANEL_W = 400;

type Props = {
  gaps: StorySpacingGaps;
  onChange: (gaps: StorySpacingGaps) => void;
  /** Optional manual re-sync (sliders already update the canvas live). */
  onApply?: () => void;
  applying?: boolean;
  compact?: boolean;
  /** Inline panel for edit-menu drawer (default). Omit floating drag behaviour. */
  inline?: boolean;
};

const SLIDERS: { key: keyof StorySpacingGaps; label: string }[] = [
  { key: "aboveHeadline", label: "Above headline" },
  { key: "belowHeadline", label: "Below headline" },
  { key: "belowImage", label: "Below image" },
  { key: "aboveButton", label: "Above button (~3.5cm)" },
  { key: "belowButton", label: "Below button" },
];

const labelStyle: CSSProperties = {
  fontSize: 11,
  color: "rgba(167,199,188,0.75)",
  minWidth: 108,
};

const valueStyle: CSSProperties = {
  fontSize: 11,
  color: "#c8ecf5",
  width: 36,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

function defaultPosition(): { x: number; y: number } {
  if (typeof window === "undefined") return { x: 24, y: 88 };
  return {
    x: Math.max(16, Math.round((window.innerWidth - PANEL_W) / 2)),
    y: 88,
  };
}

function loadPosition(): { x: number; y: number } {
  if (typeof window === "undefined") return defaultPosition();
  try {
    const raw = localStorage.getItem(POS_LS_KEY);
    if (!raw) return defaultPosition();
    const o = JSON.parse(raw) as { x?: number; y?: number };
    if (typeof o.x === "number" && typeof o.y === "number") {
      return {
        x: Math.max(8, Math.min(window.innerWidth - 120, o.x)),
        y: Math.max(8, Math.min(window.innerHeight - 80, o.y)),
      };
    }
  } catch {
    /* ignore */
  }
  return defaultPosition();
}

function savePosition(pos: { x: number; y: number }): void {
  try {
    localStorage.setItem(POS_LS_KEY, JSON.stringify(pos));
  } catch {
    /* quota */
  }
}

export default function StorySpacingControls({
  gaps,
  onChange,
  onApply,
  applying,
  compact,
  inline = true,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [pos, setPos] = useState(loadPosition);
  const [dragging, setDragging] = useState(false);

  const set = (key: keyof StorySpacingGaps, value: number) => {
    onChange({ ...gaps, [key]: value });
  };

  const clampPos = useCallback((x: number, y: number) => {
    const w = panelRef.current?.offsetWidth ?? PANEL_W;
    const h = panelRef.current?.offsetHeight ?? 220;
    return {
      x: Math.max(8, Math.min(window.innerWidth - w - 8, x)),
      y: Math.max(8, Math.min(window.innerHeight - h - 8, y)),
    };
  }, []);

  const onHeaderPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: pos.x, originY: pos.y };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onHeaderPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos(clampPos(dragRef.current.originX + dx, dragRef.current.originY + dy));
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    setPos((p) => {
      savePosition(p);
      return p;
    });
  };

  useEffect(() => {
    if (inline) return;
    const onResize = () => setPos((p) => clampPos(p.x, p.y));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampPos, inline]);

  return (
    <div
      ref={panelRef}
      className={`story-spacing-controls${inline ? " story-spacing-controls--inline" : ""}${compact ? " story-spacing-controls--compact" : ""}${dragging ? " is-dragging" : ""}`}
      style={inline ? undefined : { left: pos.x, top: pos.y }}
      role={inline ? "region" : "dialog"}
      aria-label="Story spacing controls"
    >
      <div
        className="story-spacing-controls-head"
        {...(inline
          ? {}
          : {
              onPointerDown: onHeaderPointerDown,
              onPointerMove: onHeaderPointerMove,
              onPointerUp: endDrag,
              onPointerCancel: endDrag,
            })}
      >
        {!inline ? (
          <span className="story-spacing-controls-grip" aria-hidden title="Drag to move">
            ⠿
          </span>
        ) : null}
        <span className="story-spacing-controls-title">Story spacing</span>
        <button
          type="button"
          className="story-spacing-controls-reset"
          onClick={() => onChange({ ...DEFAULT_STORY_SPACING_GAPS })}
        >
          Reset
        </button>
      </div>
      <div className="story-spacing-controls-sliders">
        {SLIDERS.map(({ key, label }) => (
          <label key={key} className="story-spacing-controls-row">
            <span style={labelStyle}>{label}</span>
            <input
              type="range"
              min={0}
              max={80}
              step={2}
              value={gaps[key]}
              onChange={(e) => set(key, Number(e.target.value))}
            />
            <span style={valueStyle}>{gaps[key]}px</span>
          </label>
        ))}
      </div>
      <p className="story-spacing-controls-hint">Use ⇕ Apply spacing on the canvas to re-stack. Sliders set gap sizes for that action.</p>
      {onApply && (
        <button
          type="button"
          className="story-spacing-controls-apply story-spacing-controls-apply--secondary"
          disabled={applying}
          onClick={onApply}
        >
          {applying ? "Syncing…" : "Re-sync layout"}
        </button>
      )}
    </div>
  );
}
