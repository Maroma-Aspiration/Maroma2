"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { catalogCategories } from "../../lib/catalog-categories";
import { resolveCategoryCardFromOverride } from "../../lib/resolve-category-card";
import { DEFAULT_COLLECTION_CARD_BACKGROUND_SCALE } from "../../lib/category-banner-position";
import type { CategoryBannerStore, ResolvedCategoryCard } from "../../lib/category-banner-types";
import { useAdminSession } from "../../lib/use-admin-session";
import { CollectionCardEditor } from "./CollectionCardEditor";
import { CarouselScrollHint } from "./CarouselScrollHint";

const emptyBannerStore = (): CategoryBannerStore => ({ banners: {} });

type TileEditPosition = { top: number; left: number };
type CollectionTileDraft = Pick<ResolvedCategoryCard, "slug" | "label" | "description" | "imageUrl" | "objectPosition" | "backgroundScale">;

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
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<CollectionTileDraft | null>(null);
  const [tileEditPositions, setTileEditPositions] = useState<Record<string, TileEditPosition>>({});
  const tileRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [activeTileSlug, setActiveTileSlug] = useState<string | null>(null);
  const lovedVeils = className.includes("scroller-loved-for-a-reason");

  const cards: ResolvedCategoryCard[] = useMemo(
    () =>
      catalogCategories.map((category) =>
        resolveCategoryCardFromOverride(category.slug, category, bannerStore.banners[category.slug])
      ),
    [bannerStore]
  );

  const isMobileCollections = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 560px), ((hover: none) and (pointer: coarse))").matches
      || document.querySelector(".page.maroma")?.classList.contains("is-mobile-layout")
      || document.querySelector(".page.maroma")?.classList.contains("is-mobile-document-flow")
      || Boolean(document.body.classList.contains("admin-mobile-preview-active"));
  }, []);

  const centerClosestTile = useCallback(() => {
    const grid = gridRef.current;
    if (!grid || !isMobileCollections()) return;
    const tiles = [...grid.querySelectorAll<HTMLElement>("[data-collection-tile]")];
    if (!tiles.length) return;
    const mid = grid.getBoundingClientRect().left + grid.clientWidth / 2;
    let best = tiles[0];
    let bestDist = Number.POSITIVE_INFINITY;
    for (const tile of tiles) {
      const rect = tile.getBoundingClientRect();
      const dist = Math.abs(rect.left + rect.width / 2 - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = tile;
      }
    }
    setActiveTileSlug(best.dataset.collectionTile || null);
  }, [isMobileCollections]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    let timer = 0;
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => centerClosestTile(), 90);
    };
    grid.addEventListener("scroll", onScroll, { passive: true });
    const frame = window.requestAnimationFrame(() => centerClosestTile());
    return () => {
      grid.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
    };
  }, [centerClosestTile, cards]);

  useEffect(() => {
    if (initialCategoryBanners) {
      setBannerStore(initialCategoryBanners);
    }
  }, [initialCategoryBanners]);

  const editingCard = editingSlug ? cards.find((card) => card.slug === editingSlug) ?? null : null;
  const showAdminChrome = sessionReady && isAdminUser;

  const syncTileEditPositions = useCallback(() => {
    const next: Record<string, TileEditPosition> = {};
    for (const [slug, tile] of Object.entries(tileRefs.current)) {
      if (!tile) continue;
      const bounds = tile.getBoundingClientRect();
      next[slug] = { top: bounds.top + 12, left: bounds.right - 12 };
    }
    setTileEditPositions(next);
  }, []);

  useEffect(() => {
    if (!showAdminChrome) {
      setTileEditPositions({});
      return;
    }
    const frame = window.requestAnimationFrame(syncTileEditPositions);
    window.addEventListener("resize", syncTileEditPositions);
    window.addEventListener("scroll", syncTileEditPositions, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", syncTileEditPositions);
      window.removeEventListener("scroll", syncTileEditPositions, true);
    };
  }, [showAdminChrome, syncTileEditPositions, cards]);

  return (
    <>
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
            <p className="scroller-subtitle scroll-zoom home-collections-subtitle">
              {subtitle.split("\n").map((line, index) => (
                <span key={`${line}-${index}`} className="scroller-subtitle-line">
                  {line}
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </div>

      <div className="carousel-shell home-collections-carousel">
      <div className="home-collections-grid" ref={gridRef}>
        {cards.map((collection, index) => {
          const visibleCollection = editingDraft?.slug === collection.slug
            ? { ...collection, ...editingDraft }
            : collection;
          return (
          <div
            key={visibleCollection.slug}
            className={`home-collection-card-wrap${activeTileSlug === visibleCollection.slug ? " is-selected" : ""}`}
            data-collection-tile={visibleCollection.slug}
            ref={(node) => {
              tileRefs.current[visibleCollection.slug] = node;
            }}
          >
            <Link href={`/${visibleCollection.slug}`} className="home-collection-card scroll-zoom">
              <div className={`home-collection-card-media home-collection-card-media--${visibleCollection.slug}`}>
                {visibleCollection.imageUrl && !failedImages[visibleCollection.slug] ? (
                  <img
                    className="home-collection-card-image"
                    src={visibleCollection.imageUrl}
                    alt=""
                    sizes="(max-width: 560px) 100vw, (max-width: 960px) 46vw, 32vw"
                    loading={index === 0 ? "eager" : "lazy"}
                    fetchPriority={index === 0 ? "high" : "low"}
                    decoding="async"
                    onError={() =>
                      setFailedImages((current) =>
                        current[visibleCollection.slug] ? current : { ...current, [visibleCollection.slug]: true }
                      )
                    }
                    style={{
                      objectPosition: visibleCollection.objectPosition,
                      transform:
                        visibleCollection.backgroundScale &&
                        visibleCollection.backgroundScale !== DEFAULT_COLLECTION_CARD_BACKGROUND_SCALE
                          ? `scale(${visibleCollection.backgroundScale / 100})`
                          : undefined,
                    }}
                  />
                ) : null}
                <h3 className="home-collection-card-title">{visibleCollection.label}</h3>
                <span className="home-collection-card-veil" aria-hidden="true" />
              </div>
              <div className="home-collection-card-body">
                <p className="home-collection-card-desc">{visibleCollection.description}</p>
              </div>
            </Link>
          </div>
          );
        })}
      </div>
      <CarouselScrollHint scrollerRef={gridRef} itemSelector="[data-collection-tile]" />
      </div>

      {editingCard ? (
        <CollectionCardEditor
          card={editingCard}
          open={Boolean(editingCard)}
          onClose={() => {
            setEditingDraft(null);
            setEditingSlug(null);
          }}
          onDraftChange={(draft) => {
            if (draft.imageUrl) {
              setFailedImages((current) => {
                if (!current[editingCard.slug]) return current;
                const next = { ...current };
                delete next[editingCard.slug];
                return next;
              });
            }
            setEditingDraft({ slug: editingCard.slug, ...draft });
          }}
        />
      ) : null}
    </section>
    {showAdminChrome && typeof document !== "undefined"
      ? createPortal(
          <div className="home-collection-edit-overlay" aria-label="Collection tile editing controls">
            {cards.map((collection) => {
              const position = tileEditPositions[collection.slug];
              if (!position) return null;
              return (
                <button
                  key={collection.slug}
                  type="button"
                  className="home-collection-edit-trigger home-collection-edit-trigger--overlay"
                  style={{ top: position.top, left: position.left }}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setEditingSlug(collection.slug);
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setEditingSlug(collection.slug);
                  }}
                >
                  Edit tile
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null}
    </>
  );
}
