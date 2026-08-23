import type { PromoBanner } from "../../lib/promo-types";
import { usesPromoSequence } from "../../lib/promo-sequence-utils";
import { promoStripStyleVars } from "../../lib/promo-strip-utils";
import { PromoBannerSequence } from "./PromoBannerSequence";
import { PromoCtaCluster } from "./PromoCtaCluster";
import { PromoSequenceMarquee } from "./PromoSequenceMarquee";

export type PromoBannerLike = Pick<
  PromoBanner,
  | "title"
  | "body"
  | "mediaUrl"
  | "mediaKind"
  | "animation"
  | "ctaLabel"
  | "ctaHref"
  | "ctaBuyLinks"
  | "presentation"
  | "sequenceTransition"
  | "sequenceLoop"
  | "frames"
  | "stripBackground"
  | "stripHeightPx"
  | "stripOpacity"
  | "mediaOffsetXCm"
  | "marqueeForceScroll"
>;

type PromoBannerCardProps = {
  banner: PromoBannerLike;
  /** When false, CTA renders without a link (admin preview). */
  linkable?: boolean;
  className?: string;
  variant?: "default" | "hero";
  marqueePreviewStart?: boolean;
};

function PromoBannerStatic({
  banner,
  linkable,
  className,
  variant,
}: PromoBannerCardProps) {
  const isHero = variant === "hero";
  const useMarquee = isHero || banner.animation === "marquee";

  const cta =
    banner.ctaLabel && banner.ctaLabel.trim() ? (
      linkable && banner.ctaHref ? (
        <a className="promo-banner-cta" href={banner.ctaHref}>
          <span className="promo-banner-cta-label">{banner.ctaLabel}</span>
          <span className="promo-banner-cta-shine" aria-hidden="true" />
        </a>
      ) : (
        <span className="promo-banner-cta">
          <span className="promo-banner-cta-label">{banner.ctaLabel}</span>
          <span className="promo-banner-cta-shine" aria-hidden="true" />
        </span>
      )
    ) : null;

  return (
    <div
      className={`promo-banner promo-banner--${banner.animation} promo-banner--${variant} ${className}`.trim()}
      style={promoStripStyleVars(banner)}
    >
      {banner.mediaKind === "image" && banner.mediaUrl ? (
        <div className="promo-banner-media-wrap">
          <img src={banner.mediaUrl} alt="" className="promo-banner-media" />
        </div>
      ) : null}
      {banner.mediaKind === "video" && banner.mediaUrl ? (
        <div className="promo-banner-media-wrap">
          <video className="promo-banner-media" src={banner.mediaUrl} autoPlay muted loop playsInline />
        </div>
      ) : null}
      <div className="promo-banner-content">
        {banner.title && !isHero ? <strong className="promo-banner-title">{banner.title}</strong> : null}
        {banner.body ? (
          isHero ? (
            <PromoSequenceMarquee
              frame={{
                id: "static-hero-marquee",
                kind: "marquee",
                durationMs: 24000,
                body: banner.body,
                bodySizeRem: 0.96,
              }}
              variant="hero"
              forceScroll={banner.marqueeForceScroll !== false}
              onDurationReady={() => {}}
            />
          ) : useMarquee ? (
            <div className="promo-banner-marquee-track">
              <span className="promo-banner-marquee-text">{banner.body}</span>
            </div>
          ) : (
            <span className="promo-banner-body-text">{banner.body}</span>
          )
        ) : null}
        <PromoCtaCluster
          buyLinks={banner.ctaBuyLinks}
          linkable={linkable}
          cta={cta}
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
  marqueePreviewStart = false,
}: PromoBannerCardProps) {
  if (usesPromoSequence(banner, variant)) {
    return (
      <PromoBannerSequence
        banner={banner}
        linkable={linkable}
        variant={variant}
        className={className}
        marqueePreviewStart={marqueePreviewStart}
      />
    );
  }

  return (
    <PromoBannerStatic banner={banner} linkable={linkable} className={className} variant={variant} />
  );
}
