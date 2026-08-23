"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties, type PointerEvent } from "react";
import { catalogCategories } from "../../lib/catalog-categories";
import { resolveCategoryCardFromOverride } from "../../lib/resolve-category-card";
import { formatBackgroundSize } from "../../lib/category-banner-position";
import type { CategoryBannerStore, ResolvedCategoryCard } from "../../lib/category-banner-types";
import { useAdminSession } from "../../lib/use-admin-session";
import { CollectionCardEditor } from "./CollectionCardEditor";

const emptyBannerStore = (): CategoryBannerStore => ({ banners: {} });

type HomeCollectionsProps = {
  title?: string;
  subtitle?: string;
  className?: string;
  sectionStyle?: CSSProperties;
  pageLayerZ?: number;
  initialCategoryBanners?: CategoryBannerStore;
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
  initialCategoryBanners,
  adminPositionEditable = false,
  onAdminPositionPointerDown,
  onAdminPositionPointerMove,
  onAdminPositionPointerUp,
}: HomeCollectionsProps) {
  const { isAdminUser, sessionReady } = useAdminSession();
  const [bannerStore, setBannerStore] = useState<CategoryBannerStore>(
    () => initialCategoryBanners ?? emptyBannerStore()
  );
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const lovedVeils = className.includes("scroller-loved-for-a-reason");

  useEffect(() => {
    if (initialCategoryBanners) {
      setBannerStore(initialCategoryBanners);
    }
  }, [initialCategoryBanners]);

  const cards: ResolvedCategoryCard[] = useMemo(
    () =>
      catalogCategories.map((category) =>
        resolveCategoryCardFromOverride(category.slug, category, bannerStore.banners[category.slug])
      ),
    [bannerStore]
  );

  const editingCard = editingSlug ? cards.find((card) => card.slug === editingSlug) ?? null : null;
  const showAdminChrome = sessionReady && isAdminUser;

  return (
    <section
      className={`scroller-section home-collections-section ${className}${adminPositionEditable ? " is-admin-position-editable" : ""}${showAdminChrome ? " is-admin-collections-editable" : ""}`}
      data-page-layer-z={pageLayerZ}
      style={sectionStyle}
      {...(lovedVeils ? { "data-maroma-loved-section": "true" } : {})}
      aria-label="Shop by collection"
      data-review="Collections grid"
      data-review-id="home-collections"
      data-review-files="app/components/HomeCollections.tsx"
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
        {cards.map((collection) => (
          <div key={collection.slug} className="home-collection-card-wrap">
            <Link href={`/${collection.slug}`} className="home-collection-card scroll-zoom">
              <div
                className={`home-collection-card-media home-collection-card-media--${collection.slug}`}
                style={
                  collection.imageUrl
                    ? {
                        backgroundImage: `url(${collection.imageUrl})`,
                        backgroundPosition: collection.objectPosition,
                        backgroundSize: formatBackgroundSize(collection.backgroundScale),
                      }
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
            {showAdminChrome ? (
              <button
                type="button"
                className="home-collection-edit-trigger"
                onClick={() => setEditingSlug(collection.slug)}
              >
                Edit tile
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {editingCard ? (
        <CollectionCardEditor
          card={editingCard}
          open={Boolean(editingCard)}
          onClose={() => setEditingSlug(null)}
        />
      ) : null}
    </section>
  );
}
