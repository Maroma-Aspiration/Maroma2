"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Gift3dPublicAsset } from "../../../lib/gift-3d-assets-store";
import type { GiftBox, GiftElement, PackedGift } from "../../../lib/gift-builder-types";

const GiftBoxScene = dynamic(() => import("./GiftBoxScene"), {
  ssr: false,
  loading: () => <div className="gift-builder-3d-canvas-fallback">Loading 3D preview…</div>,
});

type GiftBox3dReviewProps = {
  box: GiftBox;
  elements: GiftElement[];
  packed: PackedGift[];
  activeElementId?: string | null;
  onSelectElement?: (elementId: string) => void;
  assetsByProductId?: Record<string, Gift3dPublicAsset>;
};

function detectWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isCompactViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 900px)").matches;
}

export function GiftBox3dReview({
  box,
  elements,
  packed,
  activeElementId,
  onSelectElement,
  assetsByProductId: assetsProp,
}: GiftBox3dReviewProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const [nearView, setNearView] = useState(false);
  const [mobileUnlocked, setMobileUnlocked] = useState(false);
  const [webglOk, setWebglOk] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [compact, setCompact] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<"angled" | "top" | "reset">("angled");
  const [fetchedAssets, setFetchedAssets] = useState<Record<string, Gift3dPublicAsset>>({});
  const assetsByProductId = assetsProp ?? fetchedAssets;

  useEffect(() => {
    setWebglOk(detectWebGL());
    setReducedMotion(prefersReducedMotion());
    setCompact(isCompactViewport());
    const onResize = () => setCompact(isCompactViewport());
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => setReducedMotion(motionQuery.matches);
    window.addEventListener("resize", onResize);
    motionQuery.addEventListener?.("change", onMotion);
    return () => {
      window.removeEventListener("resize", onResize);
      motionQuery.removeEventListener?.("change", onMotion);
    };
  }, []);

  useEffect(() => {
    if (assetsProp) return;
    let cancelled = false;
    void fetch("/api/gift-3d-assets", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { assets?: Record<string, Gift3dPublicAsset> }) => {
        if (!cancelled) setFetchedAssets(data.assets ?? {});
      })
      .catch(() => {
        if (!cancelled) setFetchedAssets({});
      });
    return () => {
      cancelled = true;
    };
  }, [assetsProp]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setNearView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNearView(true);
        }
      },
      { rootMargin: "160px 0px", threshold: 0.05 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const shouldMountScene = webglOk && nearView && (!compact || mobileUnlocked);

  const summary = useMemo(() => {
    if (packed.length === 0) return "Empty gift box preview.";
    const names = packed
      .map((item) => elements.find((el) => el.id === item.elementId)?.name)
      .filter(Boolean);
    return `3D preview of ${box.name} with ${names.join(", ")}.`;
  }, [box.name, elements, packed]);

  const meshCount = useMemo(() => {
    return packed.filter((item) => {
      const element = elements.find((el) => el.id === item.elementId);
      return Boolean(element && assetsByProductId[element.productId]?.glbUrl);
    }).length;
  }, [assetsByProductId, elements, packed]);

  return (
    <section className="gift-builder-3d gift-builder-3d--live" ref={rootRef} aria-label="3D review of packed gift box">
      <div className="gift-builder-3d-toolbar">
        <span className="gift-builder-3d-label">3D review</span>
        {shouldMountScene ? (
          <div className="gift-builder-3d-cameras" role="group" aria-label="Camera views">
            <button type="button" className="gift-builder-3d-cam-btn" onClick={() => setCameraPreset("angled")}>
              Angled
            </button>
            <button type="button" className="gift-builder-3d-cam-btn" onClick={() => setCameraPreset("top")}>
              Top
            </button>
            <button type="button" className="gift-builder-3d-cam-btn" onClick={() => setCameraPreset("reset")}>
              Reset
            </button>
          </div>
        ) : null}
      </div>

      <p className="sr-only">{summary}</p>
      <p className="gift-builder-3d-note">
        {packed.length === 0
          ? "This arrangement is an approximation. Catalogue photos wrap onto boxes and cylinder labels. Items with a 3D ready badge use a reconstructed mesh."
          : meshCount > 0
            ? `${meshCount} of ${packed.length} items in this box have a reconstructed 3D model. Others show a photo wrap.`
            : "Catalogue photos wrap onto the packed shapes. A 3D badge marks every gift component in this preview."}
      </p>

      {!webglOk ? (
        <FlatFallback box={box} elements={elements} packed={packed} message="3D preview is unavailable on this device. Use the top-down packing view below." />
      ) : compact && !mobileUnlocked ? (
        <div className="gift-builder-3d-unlock">
          <FlatFallback box={box} elements={elements} packed={packed} />
          <button type="button" className="button secondary gift-builder-3d-unlock-btn" onClick={() => setMobileUnlocked(true)}>
            View in 3D
          </button>
        </div>
      ) : shouldMountScene ? (
        <div className="gift-builder-3d-canvas-wrap">
          <GiftBoxScene
            box={box}
            elements={elements}
            packed={packed}
            activeElementId={activeElementId}
            onSelectElement={onSelectElement}
            cameraPreset={cameraPreset}
            reducedMotion={reducedMotion}
            assetsByProductId={assetsByProductId}
          />
        </div>
      ) : (
        <FlatFallback box={box} elements={elements} packed={packed} message="Scroll to load the 3D preview…" />
      )}
    </section>
  );
}

function FlatFallback({
  box,
  elements,
  packed,
  message,
}: {
  box: GiftBox;
  elements: GiftElement[];
  packed: PackedGift[];
  message?: string;
}) {
  const map = useMemo(() => {
    const next = new Map<string, GiftElement>();
    elements.forEach((el) => next.set(el.id, el));
    return next;
  }, [elements]);

  return (
    <div className="gift-builder-3d-fallback">
      {message ? <p className="gift-builder-3d-fallback-msg">{message}</p> : null}
      <div className="gift-builder-3d-box" aria-hidden>
        {packed.map((item) => {
          const element = map.get(item.elementId);
          if (!element) return null;
          return (
            <span
              key={item.elementId}
              title={element.name}
              style={{
                left: `${(item.x / box.lengthCm) * 78 + 11}%`,
                top: `${(item.y / box.widthCm) * 66 + 12}%`,
                width: `${(item.lengthCm / box.lengthCm) * 78}%`,
                height: `${(item.widthCm / box.widthCm) * 66}%`,
                backgroundImage: `url(${element.image})`,
                transform: `translateZ(${Math.min(34, item.heightCm * 2)}px)`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
