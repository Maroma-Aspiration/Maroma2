"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminProductSummary } from "../../lib/product-catalog-admin";
import { decodeBasicHtmlEntities } from "../../lib/decode-html-entities";
import { formatPromoBuyLinkPrice, splitPromoBuyLinkName } from "../../lib/promo-buy-links-utils";

export type MaromaCatalogPickerProduct = AdminProductSummary;

type MaromaCatalogPickerProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (product: MaromaCatalogPickerProduct) => void;
  onSelectMultiple?: (products: MaromaCatalogPickerProduct[]) => void;
  multiSelect?: boolean;
  maxSelection?: number;
  title?: string;
};

export function MaromaCatalogPicker({
  open,
  onClose,
  onSelect,
  onSelectMultiple,
  multiSelect = false,
  maxSelection = 6,
  title = "Maroma catalog",
}: MaromaCatalogPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminProductSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedProductsById, setSelectedProductsById] = useState<Record<string, AdminProductSummary>>({});

  const searchProducts = useCallback(async (searchQuery = query) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        limit: "30",
        sortBy: "product",
        sortDirection: "asc",
      });
      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }
      params.append("status", "live");
      const res = await fetch(`/api/admin/products?${params.toString()}`, { cache: "no-store" });
      const data = (await res.json()) as { products?: AdminProductSummary[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not load catalog.");
      }
      setResults(Array.isArray(data.products) ? data.products : []);
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : "Could not load catalog.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    if (!open) return undefined;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    void searchProducts("");
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, searchProducts]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setError("");
      setSelectedIds([]);
      setSelectedProductsById({});
    }
  }, [open]);

  const selectedProducts = selectedIds
    .map((id) => selectedProductsById[id])
    .filter((product): product is AdminProductSummary => Boolean(product));

  const toggleProduct = (product: AdminProductSummary) => {
    if (!multiSelect) {
      onSelect(product);
      onClose();
      return;
    }

    setSelectedIds((current) => {
      if (current.includes(product.id)) {
        setSelectedProductsById((products) => {
          const next = { ...products };
          delete next[product.id];
          return next;
        });
        return current.filter((id) => id !== product.id);
      }
      if (current.length >= maxSelection) {
        return current;
      }
      setSelectedProductsById((products) => ({ ...products, [product.id]: product }));
      return [...current, product.id];
    });
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setSelectedProductsById({});
  };

  const applyMultiSelection = () => {
    if (!multiSelect || selectedProducts.length === 0) return;
    onSelectMultiple?.(selectedProducts);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="maroma-catalog-picker-root" role="presentation">
      <button
        type="button"
        className="maroma-catalog-picker-backdrop"
        aria-label="Close catalog"
        onClick={onClose}
      />
      <aside
        className="maroma-catalog-picker"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="maroma-catalog-picker-head">
          <div>
            <p className="maroma-catalog-picker-eyebrow">Maroma catalog</p>
            <h2 className="maroma-catalog-picker-title">{title}</h2>
          </div>
          <button type="button" className="maroma-catalog-picker-close" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="maroma-catalog-picker-search">
          <input
            type="search"
            value={query}
            placeholder="Search by product name or SKU"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void searchProducts(query);
            }}
          />
          <button type="button" className="button secondary" onClick={() => void searchProducts(query)}>
            Search
          </button>
        </div>

        {error ? <p className="maroma-catalog-picker-error">{error}</p> : null}
        {loading ? <p className="maroma-catalog-picker-loading">Loading catalog…</p> : null}

        {!loading && results.length === 0 ? (
          <p className="maroma-catalog-picker-empty">No products found. Try another search.</p>
        ) : (
          <div className="maroma-catalog-picker-body">
            <div className="maroma-catalog-picker-grid">
              {results.map((product) => {
                const selected = selectedIds.includes(product.id);
                const selectionFull = multiSelect && selectedIds.length >= maxSelection && !selected;

                return (
                  <button
                    key={product.id}
                    type="button"
                    className={`maroma-catalog-picker-item${selected ? " is-selected" : ""}${selectionFull ? " is-disabled" : ""}`}
                    aria-pressed={multiSelect ? selected : undefined}
                    disabled={selectionFull}
                    onClick={() => toggleProduct(product)}
                  >
                    {multiSelect ? (
                      <span className="maroma-catalog-picker-check" aria-hidden="true">
                        {selected ? "✓" : ""}
                      </span>
                    ) : null}
                    <span className="maroma-catalog-picker-thumb">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt="" />
                      ) : (
                        <span className="maroma-catalog-picker-thumb-empty">No image</span>
                      )}
                    </span>
                    <span className="maroma-catalog-picker-copy">
                      <strong>{decodeBasicHtmlEntities(product.name)}</strong>
                      <small>{product.sku}</small>
                    </span>
                  </button>
                );
              })}
            </div>
            {multiSelect ? (
              <footer className="maroma-catalog-picker-selection-bar">
                <p className="maroma-catalog-picker-selection-count">
                  {selectedIds.length} selected (max {maxSelection})
                </p>
                <div className="maroma-catalog-picker-selection-actions">
                  <button
                    type="button"
                    className="button secondary"
                    disabled={selectedIds.length === 0}
                    onClick={clearSelection}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="button primary"
                    disabled={selectedIds.length === 0}
                    onClick={applyMultiSelection}
                  >
                    Add selected
                  </button>
                </div>
              </footer>
            ) : null}
          </div>
        )}
      </aside>
    </div>
  );
}

export function catalogProductToBuyLinkFields(product: MaromaCatalogPickerProduct) {
  const name = decodeBasicHtmlEntities(product.name);
  const { title, subtitle } = splitPromoBuyLinkName(name, product.primaryCategory);

  return {
    imageUrl: product.imageUrl ?? "",
    label: title,
    subtitleLabel: subtitle,
    priceLabel: formatPromoBuyLinkPrice(product.price),
    href: `/product/${product.id}`,
  };
}
