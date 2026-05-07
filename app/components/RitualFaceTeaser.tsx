"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { decodeBasicHtmlEntities } from "../../lib/decode-html-entities";
import { selectFaceCareProducts } from "../../lib/face-products";
import { getDisplayImageUrl, hasDisplayImage } from "../../lib/product-image";
import type { ProductRecord } from "../../lib/product-types";

type Props = {
  products: ProductRecord[];
  position?: { x: number; y: number };
};

export function RitualFaceTeaser({ products, position }: Props) {

  const visibleTiles = 6;
  const rotationMs = 3800;
  const scrollMs = 1800;
  const pool = useMemo(() => {
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
  }, [products]);

  const [start, setStart] = useState(0);
  const [isSliding, setIsSliding] = useState(false);
  const pos = position ?? { x: 0, y: 0 };

  const [focusMap, setFocusMap] = useState<Record<string, number>>({});
  const resetSlideTimer = useRef<number | null>(null);

  useEffect(() => {
    if (pool.length === 0) {
      return undefined;
    }
    const id = window.setInterval(() => {
      setIsSliding(true);
      if (resetSlideTimer.current !== null) {
        window.clearTimeout(resetSlideTimer.current);
      }
      resetSlideTimer.current = window.setTimeout(() => {
        setStart((s) => (s - 1 + pool.length) % pool.length);
        setIsSliding(false);
        resetSlideTimer.current = null;
      }, scrollMs);
    }, rotationMs);
    return () => {
      window.clearInterval(id);
      if (resetSlideTimer.current !== null) {
        window.clearTimeout(resetSlideTimer.current);
      }
    };
  }, [pool.length, rotationMs, scrollMs]);

  const buildStrip = useCallback(
    (offset: number | null): ProductRecord[] => {
      if (offset === null || pool.length === 0) {
        return [];
      }
      return Array.from({ length: visibleTiles + 1 }, (_, i) => {
        const idx = (offset - 1 + i + pool.length) % pool.length;
        return pool[idx];
      });
    },
    [pool, visibleTiles]
  );

  const strip = useMemo(() => {
    return buildStrip(start);
  }, [buildStrip, start]);

  const renderStrip = (items: ProductRecord[], keyPrefix: string) => {
    if (pool.length === 0) {
      return null;
    }
    return items.map((product, index) => {
      const src = getDisplayImageUrl(product);
      if (!src) {
        return null;
      }
      return (
        <Link
          key={`${keyPrefix}-${index}-${product.id}`}
          href={`/product/${product.id}`}
          className="ritual-face-frame"
        >
          <img
            src={src}
            alt={decodeBasicHtmlEntities(product.name)}
            loading="lazy"
            onLoad={(event) => {
              const img = event.currentTarget;
              const key = img.currentSrc || img.src;
              if (!key || focusMap[key] !== undefined || img.naturalWidth <= 0 || img.naturalHeight <= 0) {
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
                // Estimate image background from border pixels, then find "non-background" rows.
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
            }}
            style={{ objectPosition: `50% ${focusMap[src] ?? 50}%` }}
          />
        </Link>
      );
    });
  };

  return (
    <div
      className="hero-ritual-panel"
      role="group"
      aria-label="Face care products"
      style={{
        transform: `translate(${pos.x}px, ${pos.y}px)`
      }}
    >
      <div className="ritual-face-teaser">
        <div className="ritual-face-teaser-inner">
          {strip.length > 0 ? (
            <div
              className="carousel-fade-wrapper ritual-face-triple-stage"
              style={{ "--ritual-visible-tiles": String(visibleTiles) } as CSSProperties}
              aria-live="polite"
            >
              {/* Permanent carousel edge fade — do not remove. */}
              <div className="carousel-edge-fade carousel-edge-fade-left" />
              <div className="carousel-edge-fade carousel-edge-fade-right" />
              <div className={`ritual-face-track${isSliding ? " is-sliding" : ""}`}>
                {renderStrip(strip, `strip-${start}`)}
              </div>
            </div>
          ) : (
            <p className="ritual-face-empty">Face care products will appear here when the catalog loads.</p>
          )}
        </div>
      </div>
    </div>
  );
}
