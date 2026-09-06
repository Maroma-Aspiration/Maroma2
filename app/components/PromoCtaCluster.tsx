import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import type { PromoCtaBuyLink } from "../../lib/promo-types";
import { resolvePromoBuyLinkLabelLines, visibleCtaBuyLinks } from "../../lib/promo-buy-links-utils";

type PromoCtaClusterProps = {
  buyLinks?: PromoCtaBuyLink[];
  cta: ReactNode;
  linkable?: boolean;
  offsetX?: number;
  offsetY?: number;
  draggable?: boolean;
  onPositionChange?: (position: { x: number; y: number }) => void;
};

function renderBuyLink(link: PromoCtaBuyLink, linkable: boolean, side: "left" | "right") {
  const { title, subtitle, price } = resolvePromoBuyLinkLabelLines(link);
  const productName = [title, subtitle].filter(Boolean).join(" ");
  const accessibleName = [productName, price].filter(Boolean).join(", ");
  const content = (
    <span className="promo-cta-buy-link-image-wrap">
      <img src={link.imageUrl} alt="" className="promo-cta-buy-link-image" />
      {productName || price ? (
        <span className="promo-cta-buy-link-hover">
          {productName ? (
            <span className="promo-cta-buy-link-line promo-cta-buy-link-line--title">{productName}</span>
          ) : null}
          {price ? (
            <span className="promo-cta-buy-link-line promo-cta-buy-link-line--price">{price}</span>
          ) : null}
        </span>
      ) : null}
    </span>
  );

  if (linkable) {
    return (
      <a
        key={link.id}
        className={`promo-cta-buy-link promo-cta-buy-link--${side}`}
        href={link.href}
        aria-label={accessibleName || "Product"}
      >
        {content}
      </a>
    );
  }

  return (
    <span
      key={link.id}
      className={`promo-cta-buy-link promo-cta-buy-link--${side}`}
      aria-label={accessibleName || "Product"}
    >
      {content}
    </span>
  );
}

export function PromoCtaCluster({
  buyLinks = [],
  cta,
  linkable = true,
  offsetX = 0,
  offsetY = 0,
  draggable = false,
  onPositionChange,
}: PromoCtaClusterProps) {
  const { left, right } = visibleCtaBuyLinks(buyLinks);
  const [position, setPosition] = useState({ x: offsetX, y: offsetY });
  const dragStart = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => setPosition({ x: offsetX, y: offsetY }), [offsetX, offsetY]);

  if (!cta && left.length === 0 && right.length === 0) {
    return null;
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggable) return;
    event.preventDefault();
    event.stopPropagation();
    dragStart.current = { x: event.clientX, y: event.clientY, offsetX: position.x, offsetY: position.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    const next = { x: dragStart.current.offsetX + event.clientX - dragStart.current.x, y: dragStart.current.offsetY + event.clientY - dragStart.current.y };
    setPosition(next);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    dragStart.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    onPositionChange?.(position);
  };

  return (
    <div
      className={`promo-cta-cluster${draggable ? " is-admin-draggable" : ""}`}
      style={{ ["--promo-cta-user-x" as string]: `${position.x}px`, ["--promo-cta-user-y" as string]: `${position.y}px` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      title={draggable ? "Drag the CTA cluster to reposition it" : undefined}
    >
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
