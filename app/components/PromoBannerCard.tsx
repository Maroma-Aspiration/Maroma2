"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { PromoBanner, PromoOverlayImage } from "../../lib/promo-types";
import { usesPromoSequence } from "../../lib/promo-sequence-utils";
import { promoStripStyleVars, promoStripBannerClass } from "../../lib/promo-strip-utils";
import { PromoBannerSequence } from "./PromoBannerSequence";
import { PromoCtaCluster } from "./PromoCtaCluster";
import { PromoSequenceMarquee } from "./PromoSequenceMarquee";
import { PromoStripBackgroundMedia } from "./PromoStripBackgroundMedia";

export type PromoBannerLike = Pick<
  PromoBanner,
  | "id"
  | "title"
  | "body"
  | "mediaUrl"
  | "mediaKind"
  | "animation"
  | "ctaLabel"
  | "ctaHref"
  | "ctaStyle"
  | "animateEnabled"
  | "textBannerEnabled"
  | "textBannerOffsetX"
  | "textBannerOffsetY"
  | "textBannerScale"

  | "textBannerStyle"
  | "headlineOffsetX"
  | "headlineOffsetY"
  | "headlineScale"
  | "headlineAnimation"
  | "headlineAnimationDurationMs"
  | "taglineOffsetX"
  | "taglineOffsetY"
  | "taglineScale"
  | "taglineAnimation"
  | "taglineAnimationDurationMs"
  | "ctaBuyLinks"
  | "presentation"
  | "sequenceTransition"
  | "sequenceFadeDurationMs"
  | "sequenceLoop"
  | "frames"
  | "stripBackground"
  | "stripBackgroundGradient"
  | "stripBackgroundFallbackImageUrl"
  | "stripHeightPx"
  | "stripOpacity"
  | "mediaOffsetXCm"
  | "marqueeForceScroll"
  | "heroMarqueeStartOffsetCm"
  | "heroMarqueeStartOffsetPx"
  | "heroMarqueeEndOffsetCm"
  | "heroMarqueeEndOffsetPx"
  | "ctaOffsetX"
  | "ctaOffsetY"
  | "thumbnailOffsetX"
  | "thumbnailOffsetY"
  | "overlayImageX"
  | "overlayImageY"
  | "overlayImageScale"
  | "overlayImageRadius"
  | "overlayImageShadow"
  | "overlayImageAnimation"
  | "overlayImageAnimationDurationMs"
  | "overlayImages"
>;

type PromoBannerCardProps = {
  banner: PromoBannerLike;
  /** When false, CTA renders without a link (admin preview). */
  linkable?: boolean;
  className?: string;
  variant?: "default" | "hero";
  /** Hold playback on frame 0 until Start (homepage preview iframe). */
  startHeld?: boolean;
  /** Hold marquee at start/end while editing offsets in admin. */
  marqueePreviewStart?: boolean;
  marqueePreviewMode?: "start" | "end";
  /** Remember strip video playback for the browser session (live homepage). */
  rememberStripVideoSeen?: boolean;
  ctaDraggable?: boolean;
  thumbnailsDraggable?: boolean;
  onCtaPositionChange?: (position: { x: number; y: number }) => void;
  onThumbnailsPositionChange?: (position: { x: number; y: number }) => void;
  mediaEditable?: boolean;
  onMediaLayoutChange?: (patch: Partial<PromoBannerLike>) => void;
};

function PromoSecondaryLayer({
  banner,
  layer,
  editable = false,
  onChange,
}: {
  banner: PromoBannerLike;
  layer?: PromoOverlayImage;
  editable?: boolean;
  onChange?: (patch: Partial<PromoOverlayImage>) => void;
}) {
  const dragRef = useRef<{
    mode: "move" | "resize";
    startX: number;
    startY: number;
    x: number;
    y: number;
    scale: number;
    width: number;
    height: number;
  } | null>(null);

  const imageUrl = layer?.imageUrl ?? banner.mediaUrl;
  if (!imageUrl) return null;
  const x = layer?.x ?? banner.overlayImageX ?? 50;
  const y = layer?.y ?? banner.overlayImageY ?? 50;
  const scale = layer?.scale ?? banner.overlayImageScale ?? 75;
  const crop = layer?.crop ?? "none";
  const cropAspect = crop === "square" ? "1 / 1" : crop === "portrait" ? "4 / 5" : crop === "landscape" ? "16 / 9" : "auto";
  const start = (event: ReactPointerEvent<HTMLElement>, mode: "move" | "resize") => {
    if (!editable) return;
    event.preventDefault();
    event.stopPropagation();
    const host = event.currentTarget.closest<HTMLElement>(".promo-banner");
    const rect = host?.getBoundingClientRect();
    if (!rect) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      x,
      y,
      scale,
      width: rect.width,
      height: rect.height,
    };
  };
  const move = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || !editable) return;
    event.preventDefault();
    event.stopPropagation();
    if (drag.mode === "resize") {
      onChange?.({ scale: Math.min(220, Math.max(20, drag.scale + ((event.clientX - drag.startX) / drag.width) * 180)) });
      return;
    }
    onChange?.({
      x: Math.min(100, Math.max(0, drag.x + ((event.clientX - drag.startX) / drag.width) * 100)),
      y: Math.min(100, Math.max(0, drag.y + ((event.clientY - drag.startY) / drag.height) * 100)),
    });
  };

  return (
    <div
      className={`promo-secondary-layer promo-secondary-layer--${layer?.animation ?? banner.overlayImageAnimation ?? "none"}${editable ? " is-editable" : ""}`}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        ["--promo-overlay-scale" as string]: String(scale / 100),
        ["--promo-overlay-radius" as string]: `${layer?.radius ?? banner.overlayImageRadius ?? 18}px`,
        ["--promo-overlay-shadow" as string]: (layer?.shadow ?? banner.overlayImageShadow) === false ? "none" : "0 18px 38px rgba(0,0,0,.28)",
        ["--promo-overlay-animation-duration" as string]: `${layer?.animationDurationMs ?? banner.overlayImageAnimationDurationMs ?? 2400}ms`,
        ["--promo-overlay-crop-aspect" as string]: cropAspect,
        ["--promo-overlay-crop-position" as string]: `${layer?.cropX ?? 50}% ${layer?.cropY ?? 50}%`,
      }}
      onPointerDown={(event) => start(event, "move")}
      onPointerMove={move}
      onPointerUp={() => { dragRef.current = null; }}
      onPointerCancel={() => { dragRef.current = null; }}
    >
      <span className={`promo-secondary-crop-frame${crop === "none" ? "" : " is-cropped"}`}>
        <img src={imageUrl} alt="" className="promo-banner-media" />
      </span>
      {editable ? (
        <span
          className="promo-secondary-resize-handle"
          aria-label="Resize second image"
          onPointerDown={(event) => start(event, "resize")}
        />
      ) : null}
    </div>
  );
}

function PromoBannerStatic({
  banner,
  linkable,
  className,
  variant,
  ctaDraggable,
  thumbnailsDraggable,
  onCtaPositionChange,
  onThumbnailsPositionChange,
  mediaEditable,
  onMediaLayoutChange,
}: PromoBannerCardProps) {
  const isHero = variant === "hero";
  const useMarquee = banner.animation === "marquee";
  const overlayImages: PromoOverlayImage[] = banner.overlayImages?.length
    ? banner.overlayImages
    : banner.mediaUrl && (banner.mediaKind === "image" || banner.mediaKind === "title-media")
      ? [{ id: "legacy-overlay", imageUrl: banner.mediaUrl, x: banner.overlayImageX ?? 50, y: banner.overlayImageY ?? 50, scale: banner.overlayImageScale ?? 75, radius: banner.overlayImageRadius ?? 18, shadow: banner.overlayImageShadow !== false, animation: banner.overlayImageAnimation ?? "none", animationDurationMs: banner.overlayImageAnimationDurationMs ?? 2400, crop: "none", cropX: 50, cropY: 50 }]
      : [];

  const cta =
    banner.ctaLabel && banner.ctaLabel.trim() ? (
      linkable && banner.ctaHref ? (
        <a className={`promo-banner-cta promo-banner-cta--${banner.ctaStyle ?? "magical"}`} href={banner.ctaHref}>
          <span className="promo-banner-cta-label">{banner.ctaLabel}</span>
          <span className="promo-banner-cta-shine" aria-hidden="true" />
        </a>
      ) : (
        <span className={`promo-banner-cta promo-banner-cta--${banner.ctaStyle ?? "magical"}`}>
          <span className="promo-banner-cta-label">{banner.ctaLabel}</span>
          <span className="promo-banner-cta-shine" aria-hidden="true" />
        </span>
      )
    ) : null;

  return (
    <div
      className={`promo-banner promo-banner--${banner.animation} promo-banner--${variant}${banner.animateEnabled === false ? " promo-banner--animation-off" : ""}${banner.sequenceLoop === false ? " promo-banner--run-once" : ""}${promoStripBannerClass(banner)} ${className}`.trim()}
      style={promoStripStyleVars(banner)}
    >
      <PromoStripBackgroundMedia banner={banner} rememberPlayback={!linkable} />
      {overlayImages.map((layer) => (
        <PromoSecondaryLayer
          key={layer.id}
          banner={banner}
          layer={layer}
          editable={mediaEditable}
          onChange={(patch) => onMediaLayoutChange?.({ overlayImages: overlayImages.map((item) => item.id === layer.id ? { ...item, ...patch } : item) })}
        />
      ))}
      {banner.mediaKind === "video" && banner.mediaUrl ? (
        <div className="promo-banner-media-wrap">
          <video className="promo-banner-media" src={banner.mediaUrl} autoPlay muted loop playsInline />
        </div>
      ) : null}
      <div className="promo-banner-content">
        <div style={{ ["--text-banner-x" as string]: `${banner.textBannerOffsetX ?? 0}px`, ["--text-banner-y" as string]: `${banner.textBannerOffsetY ?? 0}px`, ["--text-banner-scale" as string]: String((banner.textBannerScale ?? 100) / 100) }} className={`promo-banner-copy${banner.textBannerEnabled ? ` has-text-banner is-${banner.textBannerStyle ?? "glass"}` : ""}`}>
          {banner.title ? (
            <span className="promo-copy-layer promo-headline-layer" style={{ transform: `translate(${banner.headlineOffsetX ?? 0}px, ${banner.headlineOffsetY ?? 0}px) scale(${(banner.headlineScale ?? 100) / 100})` }}>
              <span className={`promo-copy-animated-content promo-copy-animated-content--${banner.headlineAnimation ?? "none"}`} style={{ ["--promo-copy-animation-duration" as string]: `${banner.headlineAnimationDurationMs ?? 2400}ms` }}>
                <strong className="promo-banner-title">{banner.title}</strong>
              </span>
            </span>
          ) : null}
          {banner.body ? (
            <span className="promo-copy-layer promo-tagline-layer" style={{ transform: `translate(${banner.taglineOffsetX ?? 0}px, ${banner.taglineOffsetY ?? 0}px) scale(${(banner.taglineScale ?? 100) / 100})` }}>
              <span className={`promo-copy-animated-content promo-copy-animated-content--${banner.taglineAnimation ?? "none"}`} style={{ ["--promo-copy-animation-duration" as string]: `${banner.taglineAnimationDurationMs ?? 2400}ms` }}>
                {isHero && useMarquee ? (
                <PromoSequenceMarquee
                  frame={{ id: "static-hero-marquee", kind: "marquee", durationMs: 24000, body: banner.body, bodySizeRem: 0.96 }}
                  variant="hero"
                  forceScroll={banner.marqueeForceScroll !== false}
                  heroMarqueeStartOffsetCm={banner.heroMarqueeStartOffsetCm}
                  heroMarqueeStartOffsetPx={banner.heroMarqueeStartOffsetPx}
                  heroMarqueeEndOffsetCm={banner.heroMarqueeEndOffsetCm}
                  heroMarqueeEndOffsetPx={banner.heroMarqueeEndOffsetPx}
                  onDurationReady={() => {}}
                />
              ) : useMarquee ? (
                <div className="promo-banner-marquee-track"><span className="promo-banner-marquee-text">{banner.body}</span></div>
              ) : (
                <span className="promo-banner-body-text">{banner.body}</span>
              )}
              </span>
            </span>
          ) : null}
        </div>
        <PromoCtaCluster
          buyLinks={banner.ctaBuyLinks}
          linkable={linkable}
          cta={cta}
          ctaOffsetX={banner.ctaOffsetX}
          ctaOffsetY={banner.ctaOffsetY}
          thumbnailOffsetX={banner.thumbnailOffsetX}
          thumbnailOffsetY={banner.thumbnailOffsetY}
          ctaDraggable={ctaDraggable}
          thumbnailsDraggable={thumbnailsDraggable}
          onCtaPositionChange={onCtaPositionChange}
          onThumbnailsPositionChange={onThumbnailsPositionChange}
        />
      </div>
    </div>
  );
}

export function PromoBannerCard({
  banner,
  linkable = true,
  className = "",
  variant = "default",
  startHeld = false,
  marqueePreviewStart = false,
  marqueePreviewMode = "start",
  rememberStripVideoSeen = false,
  ctaDraggable = false,
  thumbnailsDraggable = false,
  onCtaPositionChange,
  onThumbnailsPositionChange,
  mediaEditable = false,
  onMediaLayoutChange,
}: PromoBannerCardProps) {
  if (usesPromoSequence(banner, variant)) {
    return (
      <PromoBannerSequence
        banner={banner}
        linkable={linkable}
        variant={variant}
        className={className}
        startHeld={startHeld}
        marqueePreviewStart={marqueePreviewStart}
        marqueePreviewMode={marqueePreviewMode}
        rememberStripVideoSeen={rememberStripVideoSeen}
        ctaDraggable={ctaDraggable}
        thumbnailsDraggable={thumbnailsDraggable}
        onCtaPositionChange={onCtaPositionChange}
        onThumbnailsPositionChange={onThumbnailsPositionChange}
      />
    );
  }

  return (
    <PromoBannerStatic
      banner={banner}
      linkable={linkable}
      className={className}
      variant={variant}
      ctaDraggable={ctaDraggable}
      thumbnailsDraggable={thumbnailsDraggable}
      onCtaPositionChange={onCtaPositionChange}
      onThumbnailsPositionChange={onThumbnailsPositionChange}
      mediaEditable={mediaEditable}
      onMediaLayoutChange={onMediaLayoutChange}
    />
  );
}
