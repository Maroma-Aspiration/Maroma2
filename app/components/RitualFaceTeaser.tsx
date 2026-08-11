"use client";

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { decodeBasicHtmlEntities } from "../../lib/decode-html-entities";
import { formatInrPrice } from "../../lib/format-price";
import { getRitualCaptionWord } from "../../lib/ritual-caption-benefits";
import { selectFaceCareProducts, selectLuxuryProducts } from "../../lib/face-products";
import { getDisplayImageUrl, hasDisplayImage } from "../../lib/product-image";
import type { ProductRecord } from "../../lib/product-types";

function RitualCaptionWord({ word }: { word: string }) {
  return <span className="ritual-face-caption-word">{word}</span>;
}

function ritualSpotlightDetailLine(product: ProductRecord): string {
  const short = decodeBasicHtmlEntities(product.shortDescription || "").trim();
  if (short) {
    return short;
  }
  const description = decodeBasicHtmlEntities(product.description || "").trim();
  if (description) {
    return description.length > 96 ? `${description.slice(0, 93).trimEnd()}…` : description;
  }
  return getRitualCaptionWord(product);
}

type Props = {
  products: ProductRecord[];
  positionPct?: { x: number; y: number };
  /** Hero stack depth (1–10); applied inline so admin slider changes paint order immediately. */
  stackZ?: number;
  /** Extra vertical nudge in px (fine-tune vs loved florals). */
  liftPx?: number;
  /** Uniform scale for the carousel panel. */
  scale?: number;
  /** When true, anchor carousel with artboard % coordinates (mobile layout). */
  useArtboardPosition?: boolean;
  adminPositionEditable?: boolean;
  onAdminPositionPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  onAdminPositionPointerMove?: (event: PointerEvent<HTMLDivElement>) => void;
  onAdminPositionPointerUp?: (event: PointerEvent<HTMLDivElement>) => void;
  range?: "face" | "luxury";
  onLuxuryInteractionHold?: () => void;
  onLuxuryInteractionRelease?: () => void;
  /** Mobile document-flow frosted band rendered behind the carousel row. */
  bandBehind?: ReactNode;
};

/** Fallback before layout measure; loop copies use measured `--ritual-visible-tiles`. */
const RITUAL_DEFAULT_VISIBLE_TILES = 8;
const RITUAL_MIN_VISIBLE_TILES = 5;
const RITUAL_MAX_VISIBLE_TILES = 32;

function readStageMetric(stage: HTMLElement, name: string, fallback: number): number {
  const raw = getComputedStyle(stage).getPropertyValue(name).trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function measureRitualStageLayout(stage: HTMLElement): { visibleTiles: number; cardSizePx: number } {
  const gap = readStageMetric(stage, "--ritual-gap", 14);
  const minCard = readStageMetric(stage, "--ritual-card-min", 62);
  const maxCard = readStageMetric(stage, "--ritual-card-max", 101);
  const width = stage.clientWidth;
  if (width < 1) {
    return { visibleTiles: RITUAL_DEFAULT_VISIBLE_TILES, cardSizePx: maxCard };
  }

  for (let tiles = RITUAL_MAX_VISIBLE_TILES; tiles >= RITUAL_MIN_VISIBLE_TILES; tiles -= 1) {
    const cardSize = (width - gap * (tiles - 1)) / tiles;
    if (cardSize >= minCard) {
      return { visibleTiles: tiles, cardSizePx: cardSize };
    }
  }

  const tiles = RITUAL_MIN_VISIBLE_TILES;
  return {
    visibleTiles: tiles,
    cardSizePx: Math.max(minCard, (width - gap * (tiles - 1)) / tiles),
  };
}

export function RitualFaceTeaser({
  products,
  positionPct,
  stackZ,
  liftPx = 0,
  scale = 1,
  useArtboardPosition = false,
  adminPositionEditable = false,
  onAdminPositionPointerDown,
  onAdminPositionPointerMove,
  onAdminPositionPointerUp,
  range = "face",
  onLuxuryInteractionHold,
  onLuxuryInteractionRelease,
  bandBehind,
}: Props) {
  const pool = useMemo(() => {
    if (range === "luxury") {
      const luxury = selectLuxuryProducts(products);
      if (luxury.length >= 3) {
        return luxury;
      }
      const merged: ProductRecord[] = [...luxury];
      for (const p of selectFaceCareProducts(products)) {
        if (merged.length >= 18) {
          break;
        }
        if (merged.some((x) => x.id === p.id)) {
          continue;
        }
        merged.push(p);
      }
      return merged;
    }

    const face = selectFaceCareProducts(products);
    if (face.length >= 3) {
      return face;
    }
    const merged: ProductRecord[] = [...face];
    for (const p of products) {
      if (merged.length >= 18) {
        break;
      }
      if (!hasDisplayImage(p) || merged.some((x) => x.id === p.id)) {
        continue;
      }
      merged.push(p);
    }
    return merged;
  }, [products, range]);

  const displayPool = useMemo(
    () => pool.filter((product) => Boolean(getDisplayImageUrl(product))),
    [pool]
  );

  const [visibleTiles, setVisibleTiles] = useState(RITUAL_DEFAULT_VISIBLE_TILES);
  const [focusMap, setFocusMap] = useState<Record<string, number>>({});
  const [scrollEndPx, setScrollEndPx] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const primaryTileRef = useRef<HTMLElement | null>(null);

  const loopCopies = useMemo(() => {
    if (displayPool.length === 0) {
      return 2;
    }
    // Fill the visible viewport plus one full product set for a seamless loop.
    const minCopies = Math.ceil((visibleTiles + displayPool.length) / displayPool.length);
    return Math.max(3, minCopies);
  }, [displayPool.length, visibleTiles]);

  const loopItems = useMemo(
    () => (displayPool.length > 0 ? Array.from({ length: loopCopies }, () => displayPool).flat() : []),
    [displayPool, loopCopies]
  );

  const scrollDuration = useMemo(() => {
    if (displayPool.length === 0) {
      return "30s";
    }
    return `${Math.max(28, displayPool.length * 5)}s`;
  }, [displayPool.length]);

  const scrollEndPct = `${100 / loopCopies}%`;

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || displayPool.length === 0) {
      return;
    }

    const applyStageLayout = () => {
      const { visibleTiles: nextVisible, cardSizePx } = measureRitualStageLayout(stage);
      stage.style.setProperty("--ritual-visible-tiles", String(nextVisible));
      stage.style.setProperty("--ritual-card-size", `${cardSizePx}px`);
      setVisibleTiles(nextVisible);
    };

    applyStageLayout();
    const resizeObserver = new ResizeObserver(applyStageLayout);
    resizeObserver.observe(stage);

    return () => resizeObserver.disconnect();
  }, [displayPool.length]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || displayPool.length === 0) {
      return;
    }

    const measureLoopStride = () => {
      const tiles = track.querySelectorAll<HTMLElement>(".ritual-face-tile");
      if (tiles.length <= displayPool.length) {
        return;
      }
      const first = tiles[0];
      const nextSetStart = tiles[displayPool.length];
      if (!first || !nextSetStart) {
        return;
      }
      const stride = nextSetStart.offsetLeft - first.offsetLeft;
      if (stride > 0) {
        setScrollEndPx(`${stride}px`);
      }
    };

    measureLoopStride();
    const resizeObserver = new ResizeObserver(measureLoopStride);
    resizeObserver.observe(track);
    for (const tile of track.querySelectorAll(".ritual-face-tile")) {
      resizeObserver.observe(tile);
    }

    return () => resizeObserver.disconnect();
  }, [displayPool.length, loopCopies, loopItems.length]);

  const clearPrimary = useCallback((stage: HTMLElement) => {
    stage.querySelectorAll<HTMLElement>(".ritual-face-tile[data-dock-primary]").forEach((tile) => {
      tile.removeAttribute("data-dock-primary");
      tile.style.removeProperty("z-index");
    });
    primaryTileRef.current = null;
  }, []);

  const setPrimaryTile = useCallback(
    (tile: HTMLElement) => {
      const stage = stageRef.current;
      if (!stage || primaryTileRef.current === tile) {
        return;
      }

      clearPrimary(stage);
      tile.setAttribute("data-dock-primary", "true");
      tile.style.zIndex = "250";
      primaryTileRef.current = tile;
      stage.classList.add("is-paused");
      onLuxuryInteractionHold?.();
    },
    [clearPrimary, onLuxuryInteractionHold]
  );

  const handleStagePointerLeave = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const stage = event.currentTarget;
      const related = event.relatedTarget;
      if (related instanceof Node && stage.contains(related)) {
        return;
      }

      clearPrimary(stage);
      stage.classList.remove("is-paused");
      onLuxuryInteractionRelease?.();
    },
    [clearPrimary, onLuxuryInteractionRelease]
  );

  const handleTilePointerEnter = useCallback(
    (event: React.PointerEvent<HTMLAnchorElement>) => {
      if (event.pointerType !== "mouse") {
        return;
      }
      setPrimaryTile(event.currentTarget);
    },
    [setPrimaryTile]
  );

  const handleTileTap = useCallback(
    (event: React.PointerEvent<HTMLAnchorElement>) => {
      if (event.pointerType === "mouse") {
        return;
      }
      const isMobileLayout =
        document.documentElement.hasAttribute("data-maroma-mobile-layout") ||
        document.querySelector(".page.maroma.is-mobile-document-flow") !== null;
      if (isMobileLayout) {
        return;
      }
      const tile = event.currentTarget;
      const stage = stageRef.current;
      if (!stage) {
        return;
      }
      if (tile.getAttribute("data-dock-primary") === "true") {
        return;
      }
      event.preventDefault();
      setPrimaryTile(tile);
    },
    [setPrimaryTile]
  );

  const focusMapRef = useRef(focusMap);
  focusMapRef.current = focusMap;

  const createImageFocusHandler = useCallback(
    (src: string) => (event: React.SyntheticEvent<HTMLImageElement>) => {
      const img = event.currentTarget;
      const key = img.currentSrc || img.src || src;
      if (!key || focusMapRef.current[key] !== undefined || img.naturalWidth <= 0 || img.naturalHeight <= 0) {
        return;
      }
      try {
        const targetMax = 260;
        const scale = Math.min(1, targetMax / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(16, Math.round(img.naturalWidth * scale));
        const h = Math.max(16, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const pixels = ctx.getImageData(0, 0, w, h).data;
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let samples = 0;
        const samplePixel = (x: number, y: number) => {
          const i = (y * w + x) * 4;
          sumR += pixels[i];
          sumG += pixels[i + 1];
          sumB += pixels[i + 2];
          samples += 1;
        };
        for (let x = 0; x < w; x++) {
          samplePixel(x, 0);
          samplePixel(x, h - 1);
        }
        for (let y = 1; y < h - 1; y++) {
          samplePixel(0, y);
          samplePixel(w - 1, y);
        }
        const bgR = sumR / Math.max(samples, 1);
        const bgG = sumG / Math.max(samples, 1);
        const bgB = sumB / Math.max(samples, 1);
        const threshold = 22;
        const rowHasContent = (row: number): boolean => {
          const base = row * w * 4;
          for (let x = 0; x < w; x++) {
            const i = base + x * 4;
            const a = pixels[i + 3];
            if (a < 12) {
              continue;
            }
            const dr = Math.abs(pixels[i] - bgR);
            const dg = Math.abs(pixels[i + 1] - bgG);
            const db = Math.abs(pixels[i + 2] - bgB);
            if (dr + dg + db > threshold) {
              return true;
            }
          }
          return false;
        };
        let top = -1;
        let bottom = -1;
        for (let y = 0; y < h; y++) {
          if (rowHasContent(y)) {
            top = y;
            break;
          }
        }
        for (let y = h - 1; y >= 0; y--) {
          if (rowHasContent(y)) {
            bottom = y;
            break;
          }
        }
        if (top < 0 || bottom < 0 || bottom <= top) {
          setFocusMap((prev) => ({ ...prev, [key]: 50 }));
          return;
        }
        const centerPct = ((top + bottom) * 0.5 * 100) / Math.max(h - 1, 1);
        const clamped = Math.max(36, Math.min(64, centerPct));
        setFocusMap((prev) => ({ ...prev, [key]: clamped }));
      } catch {
        setFocusMap((prev) => ({ ...prev, [key]: 50 }));
      }
    },
    []
  );

  const renderTile = (product: ProductRecord, index: number) => {
    const src = getDisplayImageUrl(product);
    if (!src) {
      return null;
    }
    const label = decodeBasicHtmlEntities(product.name);
    const captionWord = getRitualCaptionWord(product);
    const priceLabel = formatInrPrice(product.price) ?? "Price on request";
    const detailLine = ritualSpotlightDetailLine(product);
    const tileKey = `${product.id}-${index}`;

    return (
      <Link
        key={tileKey}
        href={`/product/${product.id}`}
        className="ritual-face-tile"
        data-tile-key={tileKey}
        aria-label={label}
        onPointerEnter={handleTilePointerEnter}
        onPointerUp={handleTileTap}
      >
        <span className="ritual-face-compact" aria-hidden="true">
          <span className="ritual-face-frame-slot">
            <span className="ritual-face-frame">
              <img
                src={src}
                alt=""
                loading="lazy"
                draggable={false}
                onLoad={createImageFocusHandler(src)}
                style={{ objectPosition: `50% ${focusMap[src] ?? 50}%` }}
              />
            </span>
          </span>
          <span className="ritual-face-caption">
            <RitualCaptionWord word={captionWord} />
          </span>
        </span>
        <span className="ritual-face-spotlight">
          <span className="ritual-face-frame-slot">
            <span className="ritual-face-frame">
              <img
                src={src}
                alt={label}
                loading="lazy"
                draggable={false}
                onLoad={createImageFocusHandler(src)}
                style={{ objectPosition: `50% ${focusMap[src] ?? 50}%` }}
              />
            </span>
          </span>
          <span className="ritual-face-caption">
            <span className="ritual-face-zoom-detail">
              <span className="ritual-face-zoom-detail-head">
                <span className="ritual-face-zoom-detail-name">{label}</span>
                <span className="ritual-face-zoom-detail-price">{priceLabel}</span>
              </span>
              <span className="ritual-face-zoom-detail-benefit">{detailLine}</span>
            </span>
          </span>
        </span>
      </Link>
    );
  };

  const panelUsesArtboardCoords = useArtboardPosition && Boolean(positionPct);

  const panelPositionStyle: CSSProperties | undefined =
    positionPct && panelUsesArtboardCoords
      ? ({
          position: "absolute",
          left: `${positionPct.x}%`,
          top: `${positionPct.y}%`,
          transform: `translateX(-50%) translateY(${liftPx}px) scale(${scale})`,
          transformOrigin: "center top",
          "--hero-ritual-x-pct": String(positionPct.x),
          "--hero-ritual-y-pct": String(positionPct.y),
          ...(typeof stackZ === "number"
            ? {
                zIndex: stackZ,
                "--hero-z-rituals": String(stackZ),
              }
            : {}),
        } as CSSProperties)
      : undefined;

  return (
    <div
      className={`hero-ritual-panel${panelUsesArtboardCoords ? " is-artboard-positioned is-ritual-live-positioned" : ""}${adminPositionEditable ? " is-ritual-admin-edit" : ""}${bandBehind ? " is-mobile-stack-panel" : ""}`}
      role="group"
      aria-label="Face care products"
      style={panelPositionStyle}
      onPointerDown={adminPositionEditable ? onAdminPositionPointerDown : undefined}
      onPointerMove={adminPositionEditable ? onAdminPositionPointerMove : undefined}
      onPointerUp={adminPositionEditable ? onAdminPositionPointerUp : undefined}
    >
      {bandBehind ? (
        <div className="hero-ritual-row-sync">
          {bandBehind}
          <div
            className="ritual-face-teaser"
            style={
              {
                transform: `translateY(${liftPx}px) scale(${scale})`,
                transformOrigin: "center center",
              } as CSSProperties
            }
          >
            <div className="ritual-face-teaser-inner">
              {loopItems.length > 0 ? (
                <div
                  ref={stageRef}
                  className={`carousel-fade-wrapper ritual-face-triple-stage ritual-face-range-${range}`}
                  style={
                    {
                      "--ritual-scroll-duration": scrollDuration,
                    } as CSSProperties
                  }
                  onPointerLeave={handleStagePointerLeave}
                >
                  <div className="carousel-edge-fade carousel-edge-fade-left" />
                  <div className="carousel-edge-fade carousel-edge-fade-right" />
                  <div className="ritual-face-track-wrap">
                    <div
                      ref={trackRef}
                      className="ritual-face-track"
                      style={
                        {
                          "--ritual-scroll-duration": scrollDuration,
                          "--ritual-scroll-end": scrollEndPx ?? scrollEndPct,
                        } as CSSProperties
                      }
                    >
                      {loopItems.map((product, index) => renderTile(product, index))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="ritual-face-empty">Face care products will appear here when the catalog loads.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="ritual-face-teaser">
          <div className="ritual-face-teaser-inner">
            {loopItems.length > 0 ? (
              <div
                ref={stageRef}
                className={`carousel-fade-wrapper ritual-face-triple-stage ritual-face-range-${range}`}
                style={
                  {
                    "--ritual-scroll-duration": scrollDuration,
                  } as CSSProperties
                }
                onPointerLeave={handleStagePointerLeave}
              >
                <div className="carousel-edge-fade carousel-edge-fade-left" />
                <div className="carousel-edge-fade carousel-edge-fade-right" />
                <div className="ritual-face-track-wrap">
                  <div
                    ref={trackRef}
                    className="ritual-face-track"
                    style={
                      {
                        "--ritual-scroll-duration": scrollDuration,
                        "--ritual-scroll-end": scrollEndPx ?? scrollEndPct,
                      } as CSSProperties
                    }
                  >
                    {loopItems.map((product, index) => renderTile(product, index))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="ritual-face-empty">Face care products will appear here when the catalog loads.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
