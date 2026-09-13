import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import type { PromoCtaBuyLink } from "../../lib/promo-types";
import { resolvePromoBuyLinkLabelLines, visibleCtaBuyLinks } from "../../lib/promo-buy-links-utils";

type Position = { x: number; y: number };

/** The promo units are calc()s, so measure a throwaway probe to read them back as pixels. */
function measureUnitPx(host: HTMLElement): Position {
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;width:calc(1000 * var(--promo-unit, 1px));height:calc(1000 * var(--promo-unit-y, 1px));";
  host.appendChild(probe);
  const rect = probe.getBoundingClientRect();
  probe.remove();
  return { x: rect.width > 0 ? rect.width / 1000 : 1, y: rect.height > 0 ? rect.height / 1000 : 1 };
}

type PromoCtaClusterProps = {
  buyLinks?: PromoCtaBuyLink[];
  cta: ReactNode;
  linkable?: boolean;
  ctaOffsetX?: number;
  ctaOffsetY?: number;
  thumbnailOffsetX?: number;
  thumbnailOffsetY?: number;
  ctaDraggable?: boolean;
  thumbnailsDraggable?: boolean;
  onCtaPositionChange?: (position: Position) => void;
  onThumbnailsPositionChange?: (position: Position) => void;
};

function DraggableLayer({ className, children, offsetX = 0, offsetY = 0, draggable = false, onPositionChange, title, selected = false, onSelect }: {
  className: string;
  children: ReactNode;
  offsetX?: number;
  offsetY?: number;
  draggable?: boolean;
  onPositionChange?: (position: Position) => void;
  title?: string;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const [position, setPosition] = useState<Position>({ x: offsetX, y: offsetY });
  const positionRef = useRef(position);
  const dragStart = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const unitPx = useRef<Position>({ x: 1, y: 1 });

  useEffect(() => {
    const next = { x: offsetX, y: offsetY };
    positionRef.current = next;
    setPosition(next);
  }, [offsetX, offsetY]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggable) return;
    if ((event.target as HTMLElement).closest(".promo-element-position-menu")) return;
    onSelect?.();
    event.preventDefault();
    event.stopPropagation();
    dragStart.current = { x: event.clientX, y: event.clientY, offsetX: positionRef.current.x, offsetY: positionRef.current.y };
    unitPx.current = measureUnitPx(event.currentTarget);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const centre = (axis: "x" | "y" | "both") => {
    const next = {
      x: axis === "x" || axis === "both" ? 0 : positionRef.current.x,
      y: axis === "y" || axis === "both" ? 0 : positionRef.current.y,
    };
    positionRef.current = next;
    setPosition(next);
    onPositionChange?.(next);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    // Offsets are stored in desktop pixels, so convert the pointer travel back out of --promo-unit.
    const next = {
      x: Math.round(dragStart.current.offsetX + (event.clientX - dragStart.current.x) / unitPx.current.x),
      y: Math.round(dragStart.current.offsetY + (event.clientY - dragStart.current.y) / unitPx.current.y),
    };
    positionRef.current = next;
    setPosition(next);
  };
  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    dragStart.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    onPositionChange?.(positionRef.current);
  };

  return (
    <div
      className={`${className}${draggable ? " is-admin-draggable" : ""}`}
      style={{ transform: `translate(calc(${position.x} * var(--promo-unit, 1px)), calc(${position.y} * var(--promo-unit-y, 1px)))` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      title={draggable ? title : undefined}
    >
      {children}
      {draggable && selected ? (
        <select
          className="promo-element-position-menu"
          aria-label="Centre selected element"
          defaultValue=""
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => {
            if (event.target.value === "x" || event.target.value === "y" || event.target.value === "both") centre(event.target.value);
            event.target.value = "";
          }}
        >
          <option value="" disabled>Position…</option>
          <option value="x">Centre horizontally</option>
          <option value="y">Centre vertically</option>
          <option value="both">Centre both</option>
        </select>
      ) : null}
    </div>
  );
}

function renderBuyLink(link: PromoCtaBuyLink, linkable: boolean, side: "left" | "right") {
  const { title, subtitle, price } = resolvePromoBuyLinkLabelLines(link);
  const productName = [title, subtitle].filter(Boolean).join(" ");
  const accessibleName = [productName, price].filter(Boolean).join(", ");
  const content = (
    <span className="promo-cta-buy-link-image-wrap">
      <img src={link.imageUrl} alt="" className="promo-cta-buy-link-image" />
      {productName || price ? (
        <span className="promo-cta-buy-link-hover">
          {productName ? <span className="promo-cta-buy-link-line promo-cta-buy-link-line--title">{productName}</span> : null}
          {price ? <span className="promo-cta-buy-link-line promo-cta-buy-link-line--price">{price}</span> : null}
        </span>
      ) : null}
    </span>
  );
  if (linkable) return <a key={link.id} className={`promo-cta-buy-link promo-cta-buy-link--${side}`} href={link.href} aria-label={accessibleName || "Product"}>{content}</a>;
  return <span key={link.id} className={`promo-cta-buy-link promo-cta-buy-link--${side}`} aria-label={accessibleName || "Product"}>{content}</span>;
}

export function PromoCtaCluster({
  buyLinks = [], cta, linkable = true,
  ctaOffsetX = 0, ctaOffsetY = 0,
  thumbnailOffsetX = 0, thumbnailOffsetY = 0,
  ctaDraggable = false, thumbnailsDraggable = false,
  onCtaPositionChange, onThumbnailsPositionChange,
}: PromoCtaClusterProps) {
  const { left, right } = visibleCtaBuyLinks(buyLinks);
  const [selected, setSelected] = useState<"thumbnails" | "cta" | null>(null);
  if (!cta && left.length === 0 && right.length === 0) return null;

  return (
    <div className="promo-cta-cluster">
      {left.length || right.length ? (
        <DraggableLayer className="promo-cta-thumbnails-group" offsetX={thumbnailOffsetX} offsetY={thumbnailOffsetY} draggable={thumbnailsDraggable} onPositionChange={onThumbnailsPositionChange} title="Drag the product thumbnails as one group" selected={selected === "thumbnails"} onSelect={() => setSelected("thumbnails")}>
          <div className="promo-cta-buy-links promo-cta-buy-links--left" aria-hidden={left.length === 0}>{left.map((link) => renderBuyLink(link, linkable, "left"))}</div>
          <span className="promo-cta-thumbnails-centre-gap" aria-hidden="true" />
          <div className="promo-cta-buy-links promo-cta-buy-links--right" aria-hidden={right.length === 0}>{right.map((link) => renderBuyLink(link, linkable, "right"))}</div>
        </DraggableLayer>
      ) : null}
      {cta ? (
        <DraggableLayer className="promo-cta-cluster-main" offsetX={ctaOffsetX} offsetY={ctaOffsetY} draggable={ctaDraggable} onPositionChange={onCtaPositionChange} title="Drag the CTA button separately" selected={selected === "cta"} onSelect={() => setSelected("cta")}>{cta}</DraggableLayer>
      ) : null}
    </div>
  );
}
