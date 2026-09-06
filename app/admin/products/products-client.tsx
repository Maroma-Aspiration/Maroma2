"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SignOutButton } from "../../components/SignOutButton";
import { formatInrPrice } from "../../../lib/format-price";
import { productImageTransform } from "../../../lib/product-image-focus";
import type { AdminProductDetail, AdminProductFilter, AdminProductSummary } from "../../../lib/product-catalog-admin";

const LIVE_STATUS_LABELS = { live: "Live", not_live: "Not live", draft: "Draft" } as const;

type SortColumn = "product" | "status" | "inventory" | "category" | "price";
type ViewMode = "list" | "grid";

const FILTER_OPTIONS: { value: AdminProductFilter; label: string }[] = [
  { value: "live", label: "Live" },
  { value: "not_live", label: "Not live" },
  { value: "draft", label: "Draft" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "low_stock", label: "Low stock" },
  { value: "no_image", label: "No image" },
  { value: "missing_inci", label: "Missing INCI" },
];

const INCI_STATUS_LABELS = {
  ok: "INCI",
  missing: "No INCI",
  not_applicable: "INCI n/a",
} as const;

export default function AdminProductsClient() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [products, setProducts] = useState<AdminProductSummary[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [q, setQ] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [searchState, setSearchState] = useState<"idle" | "searching" | "complete">("idle");
  const searchRequestedRef = useRef(false);
  const searchResetTimerRef = useRef<number | null>(null);
  const [category, setCategory] = useState("");
  const [statuses, setStatuses] = useState<AdminProductFilter[]>([]);
  const [sortBy, setSortBy] = useState<SortColumn>("product");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [statusMessage, setStatusMessage] = useState("Loading products…");

  const loadProducts = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy,
        sortDirection,
      });
      for (const status of statuses) params.append("status", status);
      if (q.trim()) params.set("q", q.trim());
      if (category) params.set("category", category);

      const res = await fetch(`/api/admin/products?${params.toString()}`, { cache: "no-store" });
      const data = (await res.json()) as {
        products?: AdminProductSummary[];
        total?: number;
        categories?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Failed to load products.");
      setProducts(data.products ?? []);
      setTotal(data.total ?? 0);
      setCategories(data.categories ?? []);
      setStatusMessage(`${data.total ?? 0} products`);
      if (searchRequestedRef.current) {
        searchRequestedRef.current = false;
        setSearchState("complete");
        if (searchResetTimerRef.current !== null) window.clearTimeout(searchResetTimerRef.current);
        searchResetTimerRef.current = window.setTimeout(() => {
          setSearchState("idle");
          searchResetTimerRef.current = null;
        }, 1800);
      }
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Failed to load products.");
      searchRequestedRef.current = false;
      setSearchState("idle");
    }
  }, [category, limit, page, q, sortBy, sortDirection, statuses]);

  const changeSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDirection("asc");
    }
    setPage(1);
  };

  const sortableHeading = (column: SortColumn, label: string) => (
    <button
      type="button"
      className="catalog-admin-sort-button"
      onClick={() => changeSort(column)}
      aria-label={`Sort by ${label}${sortBy === column ? `, currently ${sortDirection === "asc" ? "ascending" : "descending"}` : ""}`}
    >
      {label}<span aria-hidden>{sortBy === column ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}</span>
    </button>
  );

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    const savedView = window.localStorage.getItem("maroma-admin-product-view");
    if (savedView === "grid" || savedView === "list") setViewMode(savedView);
  }, []);

  const changeView = (nextView: ViewMode) => {
    setViewMode(nextView);
    window.localStorage.setItem("maroma-admin-product-view", nextView);
  };

  useEffect(() => () => {
    if (searchResetTimerRef.current !== null) window.clearTimeout(searchResetTimerRef.current);
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const topCategories = useMemo(() => {
    return categories.slice(0, 24);
  }, [categories]);

  const activeFilterLabel = useMemo(() => {
    if (statuses.length === 0) return "All";
    return statuses
      .map((value) => FILTER_OPTIONS.find((option) => option.value === value)?.label ?? value)
      .join(" + ");
  }, [statuses]);

  const runSearch = () => {
    if (searchState === "searching") return;
    searchRequestedRef.current = true;
    setSearchState("searching");
    setPage(1);
    setQ(searchDraft);
    if (page === 1 && q === searchDraft) void loadProducts();
  };

  const toggleFilter = (value: AdminProductFilter) => {
    setPage(1);
    setStatuses((current) =>
      current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]
    );
  };

  const clearFilters = () => {
    setPage(1);
    setStatuses([]);
  };

  const exportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const params = new URLSearchParams({
        sortBy,
        sortDirection,
      });
      for (const status of statuses) params.append("status", status);
      if (q.trim()) params.set("q", q.trim());
      if (category) params.set("category", category);

      const res = await fetch(`/api/admin/products/export?${params.toString()}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Export failed.");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `maroma-products-${Date.now()}.csv`;
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      setStatusMessage(`Exported ${total.toLocaleString()} products (${activeFilterLabel}).`);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  const addProduct = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = (await res.json()) as { product?: AdminProductDetail; error?: string };
      if (!res.ok || !data.product) throw new Error(data.error || "Could not add product.");
      router.push(`/admin/products/${data.product.id}`);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Could not add product.");
      setCreating(false);
    }
  };

  return (
    <main className="catalog-admin-page">
      <div className="catalog-admin-shell">
        <header className="catalog-admin-header">
          <div>
            <p className="catalog-admin-eyebrow">Commerce</p>
            <h1>Products</h1>
            <p className="catalog-admin-lede">{statusMessage}</p>
          </div>
          <div className="catalog-admin-header-actions">
            <button type="button" className="button primary button-sage" disabled={creating} onClick={() => void addProduct()}>
              {creating ? "Adding…" : "Add product"}
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={exporting || total === 0}
              onClick={() => void exportCsv()}
              title={total === 0 ? "No products to export" : `Export ${total} filtered products as CSV`}
            >
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
            <Link href="/" className="button secondary">
              Home
            </Link>
            <Link href="/admin" className="button secondary">
              Site admin
            </Link>
            <Link href="/admin/orders" className="button secondary">
              Orders
            </Link>
            <Link href="/admin/reports" className="button secondary">
              Reports
            </Link>
            <SignOutButton />
          </div>
        </header>

        <div className="catalog-admin-toolbar">
          <div className="catalog-admin-search">
            <input
              type="search"
              placeholder="Search products by name, SKU, or category"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runSearch();
              }}
            />
            <button
              type="button"
              className={`button primary button-sage${searchState === "complete" ? " process-success" : ""}`}
              disabled={searchState === "searching"}
              onClick={runSearch}
            >
              {searchState === "searching" ? "Searching…" : searchState === "complete" ? "Complete" : "Search"}
            </button>
          </div>

          <div className="catalog-admin-filters">
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              {topCategories.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>

            <div className="catalog-admin-status-tabs" role="group" aria-label="Product filters">
              <button
                type="button"
                aria-pressed={statuses.length === 0}
                className={`catalog-admin-status-tab catalog-admin-status-tab--all${statuses.length === 0 ? " is-active" : ""}`}
                onClick={clearFilters}
              >
                All
              </button>
              {FILTER_OPTIONS.map(({ value, label }) => {
                const active = statuses.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    className={`catalog-admin-status-tab catalog-admin-status-tab--${value}${active ? " is-active" : ""}`}
                    onClick={() => toggleFilter(value)}
                  >
                    {label}
                  </button>
                );
              })}
              <span className="catalog-admin-filter-results" aria-live="polite">
                {total.toLocaleString()} {total === 1 ? "result" : "results"}
                {statuses.length > 0 ? ` · ${activeFilterLabel}` : ""}
              </span>
              <div className="catalog-admin-view-toggle" role="group" aria-label="Product view">
                <button
                  type="button"
                  className={viewMode === "list" ? "is-active" : ""}
                  aria-pressed={viewMode === "list"}
                  onClick={() => changeView("list")}
                >
                  <span aria-hidden>☰</span> List
                </button>
                <button
                  type="button"
                  className={viewMode === "grid" ? "is-active" : ""}
                  aria-pressed={viewMode === "grid"}
                  onClick={() => changeView("grid")}
                >
                  <span aria-hidden>▦</span> Grid
                </button>
              </div>
            </div>
            <p className="catalog-admin-filter-hint">
              Tip: turn on multiple filters at once (for example Live + Missing INCI). Export downloads the full filtered list.
            </p>
          </div>
        </div>

        {viewMode === "list" ? <div className="catalog-admin-table-wrap">
          <table className="catalog-admin-table">
            <thead>
              <tr>
                <th>{sortableHeading("product", "Product")}</th>
                <th className="catalog-admin-status-heading">{sortableHeading("status", "Live status")}</th>
                <th className="catalog-admin-status-heading">Image status</th>
                <th className="catalog-admin-status-heading">INCI</th>
                <th>{sortableHeading("inventory", "Inventory")}</th>
                <th>{sortableHeading("category", "Category")}</th>
                <th className="catalog-admin-price-heading">{sortableHeading("price", "Price")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="catalog-admin-status-cell">
                    <Link href={`/admin/products/${product.id}`} className="catalog-admin-product-cell">
                      <span className="catalog-admin-thumb">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt="" style={{ transform: productImageTransform(product.id) }} />
                        ) : (
                          <span aria-hidden>◇</span>
                        )}
                      </span>
                      <span className="catalog-admin-product-copy">
                        <strong>{product.name}</strong>
                        <small>
                          SKU {product.sku}
                          {product.hasCatalogEdit ? " · edited" : ""}
                        </small>
                      </span>
                    </Link>
                  </td>
                  <td>
                    <span className={`catalog-admin-badge catalog-admin-badge--${product.liveStatus}`}>
                      {LIVE_STATUS_LABELS[product.liveStatus]}
                    </span>
                  </td>
                  <td>
                    <span className={`catalog-admin-badge catalog-admin-badge--${product.hasImage ? "has_image" : "no_image"}`}>
                      {product.hasImage ? "Image" : "No image"}
                    </span>
                  </td>
                  <td>
                    <span className={`catalog-admin-badge catalog-admin-badge--inci_${product.inciStatus}`}>
                      {INCI_STATUS_LABELS[product.inciStatus]}
                    </span>
                  </td>
                  <td>{product.stock} in stock</td>
                  <td>{product.primaryCategory}</td>
                  <td align="right">{formatInrPrice(product.price) ?? product.price}</td>
                  <td align="right">
                    <Link href={`/admin/products/${product.id}`} className="catalog-admin-row-link">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div> : (
          <div className="catalog-admin-product-grid">
            {products.map((product) => (
              <article className="catalog-admin-product-card" key={product.id}>
                <Link href={`/admin/products/${product.id}`} className="catalog-admin-product-card-image">
                  {product.imageUrl ? <img src={product.imageUrl} alt="" style={{ transform: productImageTransform(product.id) }} /> : <span aria-hidden>◇</span>}
                  <span className="catalog-admin-product-card-badges">
                    <span className={`catalog-admin-badge catalog-admin-badge--${product.liveStatus}`}>
                      {LIVE_STATUS_LABELS[product.liveStatus]}
                    </span>
                    <span className={`catalog-admin-badge catalog-admin-badge--${product.hasImage ? "has_image" : "no_image"}`}>
                      {product.hasImage ? "Image" : "No image"}
                    </span>
                    {product.inciStatus !== "not_applicable" ? (
                      <span className={`catalog-admin-badge catalog-admin-badge--inci_${product.inciStatus}`}>
                        {INCI_STATUS_LABELS[product.inciStatus]}
                      </span>
                    ) : null}
                  </span>
                </Link>
                <div className="catalog-admin-product-card-body">
                  <Link href={`/admin/products/${product.id}`} className="catalog-admin-product-card-title">
                    {product.name}
                  </Link>
                  <p>SKU {product.sku}{product.hasCatalogEdit ? " · edited" : ""}</p>
                  <dl>
                    <div><dt>Stock</dt><dd>{product.stock}</dd></div>
                    <div><dt>Price</dt><dd>{formatInrPrice(product.price) ?? product.price}</dd></div>
                  </dl>
                  <p className="catalog-admin-product-card-category">{product.primaryCategory}</p>
                  <Link href={`/admin/products/${product.id}`} className="button secondary catalog-admin-product-card-edit">
                    Edit product
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        {products.length === 0 ? (
          <p className="catalog-admin-empty">No products match your filters.</p>
        ) : null}

        <div className="catalog-admin-pagination">
          <button
            type="button"
            className="button secondary"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="button secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </main>
  );
}
