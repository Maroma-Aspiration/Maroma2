import type { ReactNode } from "react";
import type { PromoCtaBuyLink } from "../../lib/promo-types";
import { resolvePromoBuyLinkLabelLines, visibleCtaBuyLinks } from "../../lib/promo-buy-links-utils";

type PromoCtaClusterProps = {
  buyLinks?: PromoCtaBuyLink[];
  cta: ReactNode;
  linkable?: boolean;
};

function renderBuyLinkLabel(link: PromoCtaBuyLink) {
  const { title, subtitle, price } = resolvePromoBuyLinkLabelLines(link);
  if (!title && !subtitle && !price) {
    return null;
  }

  return (
    <span className="promo-cta-buy-link-copy">
      {title ? <span className="promo-cta-buy-link-line promo-cta-buy-link-line--title">{title}</span> : null}
      {subtitle ? (
        <span className="promo-cta-buy-link-line promo-cta-buy-link-line--type">{subtitle}</span>
      ) : null}
      {price ? <span className="promo-cta-buy-link-line promo-cta-buy-link-line--price">{price}</span> : null}
    </span>
  );
}

function renderBuyLink(link: PromoCtaBuyLink, linkable: boolean, side: "left" | "right") {
  const { title, subtitle, price } = resolvePromoBuyLinkLabelLines(link);
  const accessibleName = [title, subtitle, price].filter(Boolean).join(" ");
  const labelEl = renderBuyLinkLabel(link);
  const imageEl = (
    <span className="promo-cta-buy-link-image-wrap">
      <img src={link.imageUrl} alt={accessibleName || "Product"} className="promo-cta-buy-link-image" />
    </span>
  );
  const content =
    side === "left" ? (
      <>
        {labelEl}
        {imageEl}
      </>
    ) : (
      <>
        {imageEl}
        {labelEl}
      </>
    );

  if (linkable) {
    return (
      <a key={link.id} className={`promo-cta-buy-link promo-cta-buy-link--${side}`} href={link.href}>
        {content}
      </a>
    );
  }

  return (
    <span key={link.id} className={`promo-cta-buy-link promo-cta-buy-link--${side}`}>
      {content}
    </span>
  );
}

export function PromoCtaCluster({ buyLinks = [], cta, linkable = true }: PromoCtaClusterProps) {
  const { left, right } = visibleCtaBuyLinks(buyLinks);

  if (!cta && left.length === 0 && right.length === 0) {
    return null;
  }

  return (
    <div className="promo-cta-cluster">
      <div className="promo-cta-buy-links promo-cta-buy-links--left" aria-hidden={left.length === 0}>
        {left.map((link) => renderBuyLink(link, linkable, "left"))}
      </div>
      <div className="promo-cta-cluster-main">{cta}</div>
      <div className="promo-cta-buy-links promo-cta-buy-links--right" aria-hidden={right.length === 0}>
        {right.map((link) => renderBuyLink(link, linkable, "right"))}
      </div>
    </div>
  );
}
