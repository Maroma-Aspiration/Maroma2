"use client";

import { useState } from "react";
import {
  isEagerCanvasImage,
  isPriorityCanvasImage,
  resolveCanvasDisplaySources,
} from "../../lib/canvas-display-image";

type CanvasDisplayImageProps = {
  id: string;
  src: string;
  displaySrc?: string;
  width: number;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  onPointerDown?: React.PointerEventHandler<HTMLImageElement>;
  onError?: () => void;
};

export function CanvasDisplayImage({
  id,
  src,
  displaySrc,
  width,
  alt = "",
  className,
  style,
  onPointerDown,
  onError,
}: CanvasDisplayImageProps) {
  const [useOriginal, setUseOriginal] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const sources = resolveCanvasDisplaySources(src, { id, displaySrc, width });
  const href = useOriginal ? src : sources.src;
  const priority = isPriorityCanvasImage(id);
  const eager = isEagerCanvasImage(id);
  const blurStyle: React.CSSProperties | undefined =
    sources.blur && !loaded
      ? {
          backgroundImage: `url("${sources.blur}")`,
          backgroundSize: style?.objectFit === "contain" ? "contain" : "cover",
          backgroundPosition: (style?.objectPosition as string | undefined) ?? "center",
          backgroundRepeat: "no-repeat",
        }
      : undefined;

  const img = (
    <img
      ref={(node) => {
        if (node && !loaded && node.complete && node.naturalWidth > 0) setLoaded(true);
      }}
      src={href}
      srcSet={useOriginal ? undefined : sources.webpSrcSet}
      sizes={useOriginal ? undefined : sources.sizes}
      alt={alt}
      className={className}
      draggable={false}
      decoding="async"
      fetchPriority={priority || eager ? "high" : "low"}
      loading={eager ? "eager" : "lazy"}
      style={blurStyle ? { ...style, ...blurStyle } : style}
      onPointerDown={onPointerDown}
      onLoad={() => setLoaded(true)}
      onError={() => {
        if (!useOriginal && href !== src) {
          setUseOriginal(true);
          return;
        }
        onError?.();
      }}
    />
  );

  if (useOriginal || !sources.avifSrcSet) return img;

  return (
    <picture style={{ display: "contents" }}>
      <source type="image/avif" srcSet={sources.avifSrcSet} sizes={sources.sizes} />
      {img}
    </picture>
  );
}
