"use client";

import Link from "next/link";
import type { CSSProperties, PointerEvent } from "react";
import { catalogCategories } from "../../lib/catalog-categories";

type HomeCollectionsProps = {
  title?: string;
  subtitle?: string;
  className?: string;
  sectionStyle?: CSSProperties;
  pageLayerZ?: number;
  adminPositionEditable?: boolean;
  onAdminPositionPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  onAdminPositionPointerMove?: (event: PointerEvent<HTMLElement>) => void;
  onAdminPositionPointerUp?: (event: PointerEvent<HTMLElement>) => void;
};

export function HomeCollections({
  title = "Collections",
  subtitle,
  className = "",
  sectionStyle,
  pageLayerZ,
  adminPositionEditable = false,
  onAdminPositionPointerDown,
  onAdminPositionPointerMove,
  onAdminPositionPointerUp,
}: HomeCollectionsProps) {
  const lovedVeils = className.includes("scroller-loved-for-a-reason");

  return (
    <section
      className={`scroller-section home-collections-section ${className}${adminPositionEditable ? " is-admin-position-editable" : ""}`}
      data-page-layer-z={pageLayerZ}
      style={sectionStyle}
      {...(lovedVeils ? { "data-maroma-loved-section": "true" } : {})}
      aria-label="Shop by collection"
    >
      {lovedVeils ? (
        <>
          <div className="loved-veil loved-veil-wash" aria-hidden />
          <div className="loved-veil loved-veil-band" aria-hidden />
        </>
      ) : null}

      <div className="home-collections-hero">
        <div
          className={`scroller-header home-collections-header${adminPositionEditable ? " is-admin-position-handle" : ""}`}
          data-maroma-loved-target={lovedVeils ? "headline-row" : undefined}
          onPointerDown={adminPositionEditable ? onAdminPositionPointerDown : undefined}
          onPointerMove={adminPositionEditable ? onAdminPositionPointerMove : undefined}
          onPointerUp={adminPositionEditable ? onAdminPositionPointerUp : undefined}
        >
          {title ? <h2 className="scroller-title scroll-zoom">{title}</h2> : null}
          {subtitle ? (
            <p className="scroller-subtitle scroller-subtitle-loved scroll-zoom home-collections-subtitle">
              {subtitle.split("\n").map((line, index) => (
                <span key={`${line}-${index}`} className="scroller-subtitle-line">
                  {line}
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </div>

      <div className="home-collections-grid">
        {catalogCategories.map((collection) => (
          <Link
            key={collection.slug}
            href={`/${collection.slug}`}
            className="home-collection-card scroll-zoom"
          >
            <div
              className="home-collection-card-media"
              style={
                collection.bannerImage
                  ? { backgroundImage: `url(${collection.bannerImage})` }
                  : undefined
              }
            >
              <h3 className="home-collection-card-title">{collection.label}</h3>
              <span className="home-collection-card-veil" aria-hidden="true" />
            </div>
            <div className="home-collection-card-body">
              <p className="home-collection-card-desc">{collection.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
