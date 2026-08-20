"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Gift3dImageCropperProps = {
  imageUrl: string;
  slot?: number;
  title?: string;
  onCancel: () => void;
  onSave: (blob: Blob) => Promise<void> | void;
};

type ToolMode = "move" | "erase" | "restore";
type Handle = "nw" | "ne" | "sw" | "se" | "n" | "e" | "s" | "w";

type CropBox = { x: number; y: number; w: number; h: number };

type DragState =
  | { kind: "pan"; x: number; y: number; panX: number; panY: number }
  | { kind: "crop-move"; x: number; y: number; start: CropBox }
  | {
      kind: "crop-resize";
      handle: Handle;
      startClientX: number;
      startClientY: number;
      start: CropBox;
    }
  | { kind: "brush" };

const VIEW = 400;
const OUTPUT_MAX = 1024;
const MIN_CROP = 40;
const HANDLE = 28;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image for cropping."));
    img.src = url;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function drawChecker(ctx: CanvasRenderingContext2D, size: number) {
  const cell = 12;
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const odd = (x / cell + y / cell) % 2 === 0;
      ctx.fillStyle = odd ? "#d7ddd3" : "#eef2ea";
      ctx.fillRect(x, y, cell, cell);
    }
  }
}

function hitHandle(localX: number, localY: number, box: CropBox): Handle | null {
  const points: { id: Handle; x: number; y: number }[] = [
    { id: "nw", x: box.x, y: box.y },
    { id: "ne", x: box.x + box.w, y: box.y },
    { id: "sw", x: box.x, y: box.y + box.h },
    { id: "se", x: box.x + box.w, y: box.y + box.h },
    { id: "n", x: box.x + box.w / 2, y: box.y },
    { id: "e", x: box.x + box.w, y: box.y + box.h / 2 },
    { id: "s", x: box.x + box.w / 2, y: box.y + box.h },
    { id: "w", x: box.x, y: box.y + box.h / 2 },
  ];
  const half = HANDLE / 2;
  for (const point of points) {
    if (Math.abs(localX - point.x) <= half && Math.abs(localY - point.y) <= half) {
      return point.id;
    }
  }
  return null;
}

function hitInsideCrop(localX: number, localY: number, box: CropBox) {
  return localX >= box.x && localX <= box.x + box.w && localY >= box.y && localY <= box.y + box.h;
}

function resizeBox(handle: Handle, start: CropBox, dx: number, dy: number): CropBox {
  let left = start.x;
  let top = start.y;
  let right = start.x + start.w;
  let bottom = start.y + start.h;

  if (handle.includes("w")) left = start.x + dx;
  if (handle.includes("e")) right = start.x + start.w + dx;
  if (handle.includes("n")) top = start.y + dy;
  if (handle.includes("s")) bottom = start.y + start.h + dy;

  left = clamp(left, 0, VIEW - MIN_CROP);
  top = clamp(top, 0, VIEW - MIN_CROP);
  right = clamp(right, MIN_CROP, VIEW);
  bottom = clamp(bottom, MIN_CROP, VIEW);

  if (right - left < MIN_CROP) {
    if (handle.includes("w")) left = right - MIN_CROP;
    else right = left + MIN_CROP;
  }
  if (bottom - top < MIN_CROP) {
    if (handle.includes("n")) top = bottom - MIN_CROP;
    else bottom = top + MIN_CROP;
  }

  left = clamp(left, 0, VIEW - MIN_CROP);
  top = clamp(top, 0, VIEW - MIN_CROP);
  right = clamp(right, left + MIN_CROP, VIEW);
  bottom = clamp(bottom, top + MIN_CROP, VIEW);

  return { x: left, y: top, w: right - left, h: bottom - top };
}

export function Gift3dImageCropper({ imageUrl, slot = 1, title, onCancel, onSave }: Gift3dImageCropperProps) {
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [crop, setCrop] = useState<CropBox>({ x: 40, y: 60, w: VIEW - 80, h: VIEW - 120 });
  const [mode, setMode] = useState<ToolMode>("move");
  const [brush, setBrush] = useState(28);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const stageRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const cropRef = useRef(crop);
  cropRef.current = crop;
  const transformRef = useRef({ rotation, zoom, pan });
  transformRef.current = { rotation, zoom, pan };

  const resetMask = useCallback(() => {
    const canvas = maskRef.current;
    if (!canvas) return;
    canvas.width = VIEW;
    canvas.height = VIEW;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, VIEW, VIEW);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, VIEW, VIEW);
  }, []);

  const redrawPreview = useCallback(() => {
    const preview = previewRef.current;
    const mask = maskRef.current;
    const img = imageRef.current;
    if (!preview || !mask || !img) return;
    const ctx = preview.getContext("2d");
    if (!ctx) return;
    const { rotation: rot, zoom: z, pan: p } = transformRef.current;

    preview.width = VIEW;
    preview.height = VIEW;
    drawChecker(ctx, VIEW);

    ctx.save();
    ctx.translate(VIEW / 2 + p.x, VIEW / 2 + p.y);
    ctx.rotate((rot * Math.PI) / 180);
    const fit = Math.min(VIEW / img.naturalWidth, VIEW / img.naturalHeight) * z;
    const drawW = img.naturalWidth * fit;
    const drawH = img.naturalHeight * fit;
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }, []);

  useEffect(() => {
    let cancelled = false;
    setRotation(0);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setCrop({ x: 40, y: 60, w: VIEW - 80, h: VIEW - 120 });
    setMode("move");
    setError("");
    imageRef.current = null;
    transformRef.current = { rotation: 0, zoom: 1, pan: { x: 0, y: 0 } };

    void loadImage(imageUrl)
      .then((img) => {
        if (cancelled) return;
        imageRef.current = img;
        resetMask();
        redrawPreview();
      })
      .catch(() => {
        if (!cancelled) setError("Could not load this listing image for isolation.");
      });

    return () => {
      cancelled = true;
    };
  }, [imageUrl, redrawPreview, resetMask]);

  useEffect(() => {
    redrawPreview();
  }, [pan.x, pan.y, redrawPreview, rotation, zoom]);

  const localPoint = (clientX: number, clientY: number) => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const rect = stage.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const paintBrush = (clientX: number, clientY: number, erase: boolean) => {
    const canvas = maskRef.current;
    if (!canvas) return;
    const { x, y } = localPoint(clientX, clientY);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, brush / 2, 0, Math.PI * 2);
    if (erase) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#ffffff";
    }
    ctx.fill();
    ctx.restore();
    redrawPreview();
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = localPoint(event.clientX, event.clientY);

    if (mode === "erase" || mode === "restore") {
      dragRef.current = { kind: "brush" };
      paintBrush(event.clientX, event.clientY, mode === "erase");
      return;
    }

    const handle = hitHandle(point.x, point.y, cropRef.current);
    if (handle) {
      dragRef.current = {
        kind: "crop-resize",
        handle,
        startClientX: event.clientX,
        startClientY: event.clientY,
        start: { ...cropRef.current },
      };
      return;
    }

    if (hitInsideCrop(point.x, point.y, cropRef.current)) {
      dragRef.current = {
        kind: "crop-move",
        x: event.clientX,
        y: event.clientY,
        start: { ...cropRef.current },
      };
      return;
    }

    dragRef.current = {
      kind: "pan",
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    event.preventDefault();

    if (drag.kind === "brush") {
      paintBrush(event.clientX, event.clientY, mode === "erase");
      return;
    }

    if (drag.kind === "pan") {
      setPan({
        x: drag.panX + (event.clientX - drag.x),
        y: drag.panY + (event.clientY - drag.y),
      });
      return;
    }

    if (drag.kind === "crop-move") {
      setCrop({
        x: clamp(drag.start.x + (event.clientX - drag.x), 0, VIEW - drag.start.w),
        y: clamp(drag.start.y + (event.clientY - drag.y), 0, VIEW - drag.start.h),
        w: drag.start.w,
        h: drag.start.h,
      });
      return;
    }

    if (drag.kind === "crop-resize") {
      const dx = event.clientX - drag.startClientX;
      const dy = event.clientY - drag.startClientY;
      setCrop(resizeBox(drag.handle, drag.start, dx, dy));
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  const exportBlob = useCallback(async () => {
    const img = imageRef.current ?? (await loadImage(imageUrl));
    const mask = maskRef.current;
    if (!mask) throw new Error("Mask canvas missing.");

    const composed = document.createElement("canvas");
    composed.width = VIEW;
    composed.height = VIEW;
    const cctx = composed.getContext("2d");
    if (!cctx) throw new Error("Canvas unavailable.");

    cctx.save();
    cctx.translate(VIEW / 2 + pan.x, VIEW / 2 + pan.y);
    cctx.rotate((rotation * Math.PI) / 180);
    const fit = Math.min(VIEW / img.naturalWidth, VIEW / img.naturalHeight) * zoom;
    const drawW = img.naturalWidth * fit;
    const drawH = img.naturalHeight * fit;
    cctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    cctx.restore();

    cctx.globalCompositeOperation = "destination-in";
    cctx.drawImage(mask, 0, 0);
    cctx.globalCompositeOperation = "source-over";

    const scale = OUTPUT_MAX / Math.max(crop.w, crop.h);
    const outW = Math.max(1, Math.round(crop.w * scale));
    const outH = Math.max(1, Math.round(crop.h * scale));
    const out = document.createElement("canvas");
    out.width = outW;
    out.height = outH;
    const octx = out.getContext("2d");
    if (!octx) throw new Error("Canvas unavailable.");
    octx.clearRect(0, 0, outW, outH);
    octx.drawImage(composed, crop.x, crop.y, crop.w, crop.h, 0, 0, outW, outH);

    const blob = await new Promise<Blob>((resolve, reject) => {
      out.toBlob(
        (value) => (value ? resolve(value) : reject(new Error("Could not export isolated image."))),
        "image/png"
      );
    });
    return blob;
  }, [crop.h, crop.w, crop.x, crop.y, imageUrl, pan.x, pan.y, rotation, zoom]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const blob = await exportBlob();
      await onSave(blob);
      setSaving(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save isolated image.");
      setSaving(false);
    }
  };

  const handles: Handle[] = ["nw", "ne", "sw", "se", "n", "e", "s", "w"];

  return (
    <div className="gift-3d-cropper-overlay" role="dialog" aria-modal="true" aria-label="Isolate product image">
      <div className="gift-3d-cropper-panel gift-3d-cropper-panel--wide">
        <header className="gift-3d-cropper-head">
          <div>
            <h3>Isolate element</h3>
            <p>
              {title
                ? `Cut out the product from “${title}” so reconstruction sees the bottle, not the lifestyle crop.`
                : `Frame the product tightly, erase the background, then save as reference image ${slot}.`}
            </p>
          </div>
          <button type="button" className="gift-builder-link-btn" onClick={onCancel} disabled={saving}>
            Close
          </button>
        </header>

        <div className="gift-3d-cropper-tools" role="tablist" aria-label="Editing tools">
          <button type="button" className={mode === "move" ? "is-active" : ""} onClick={() => setMode("move")}>
            Move / frame
          </button>
          <button type="button" className={mode === "erase" ? "is-active" : ""} onClick={() => setMode("erase")}>
            Erase background
          </button>
          <button type="button" className={mode === "restore" ? "is-active" : ""} onClick={() => setMode("restore")}>
            Restore
          </button>
        </div>

        <div
          ref={stageRef}
          className={`gift-3d-cropper-stage gift-3d-cropper-stage--isolate mode-${mode}`}
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <canvas ref={previewRef} className="gift-3d-cropper-preview" width={VIEW} height={VIEW} />
          <canvas ref={maskRef} className="gift-3d-cropper-mask-hidden" width={VIEW} height={VIEW} aria-hidden />
          <div
            className="gift-3d-cropper-frame gift-3d-cropper-frame--adjustable"
            style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}
          >
            <span className="gift-3d-cropper-frame-label">Keep</span>
            {handles.map((handle) => (
              <span key={handle} className={`gift-3d-cropper-resize gift-3d-cropper-resize--${handle}`} aria-hidden />
            ))}
          </div>
        </div>

        <div className="gift-3d-cropper-controls">
          <div className="gift-3d-cropper-rotate-row">
            <button type="button" className="button secondary" onClick={() => setRotation((r) => r - 90)}>
              Rotate −90°
            </button>
            <button type="button" className="button secondary" onClick={() => setRotation((r) => r + 90)}>
              Rotate +90°
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setRotation(0);
                setZoom(1);
                setPan({ x: 0, y: 0 });
                setCrop({ x: 40, y: 60, w: VIEW - 80, h: VIEW - 120 });
                resetMask();
                window.setTimeout(redrawPreview, 0);
              }}
            >
              Reset all
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                resetMask();
                redrawPreview();
              }}
            >
              Reset erase
            </button>
          </div>
          <label>
            <span>Fine rotate ({rotation}°)</span>
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={rotation}
              onInput={(e) => setRotation(Number((e.target as HTMLInputElement).value))}
              onChange={(e) => setRotation(Number(e.target.value))}
            />
          </label>
          <label>
            <span>Zoom ({zoom.toFixed(2)}×)</span>
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.01}
              value={zoom}
              onInput={(e) => setZoom(Number((e.target as HTMLInputElement).value))}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </label>
          <label>
            <span>Brush size ({brush}px)</span>
            <input
              type="range"
              min={8}
              max={80}
              step={1}
              value={brush}
              onChange={(e) => setBrush(Number(e.target.value))}
            />
          </label>
          <p className="gift-3d-cropper-hint">
            Frame size: {Math.round(crop.w)} × {Math.round(crop.h)} px — drag corners or edge handles to set any
            rectangle.
          </p>
          <ol className="gift-3d-cropper-steps">
            <li>
              <strong>Move / frame</strong> — drag inside the box to move; drag corners or edge handles for a precise
              rectangle (not locked to square).
            </li>
            <li>
              <strong>Erase background</strong> — paint away cardboard and extras. Checkerboard = removed.
            </li>
            <li>
              <strong>Save</strong> — transparent PNG keeps that exact shape as reference image {slot}.
            </li>
          </ol>
        </div>

        {error ? <p className="catalog-admin-status">{error}</p> : null}

        <div className="gift-3d-cropper-actions">
          <button type="button" className="button secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="button primary button-sage" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : `Save as reference image ${slot}`}
          </button>
        </div>
      </div>
    </div>
  );
}
