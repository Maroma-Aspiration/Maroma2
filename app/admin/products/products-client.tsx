"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SignOutButton } from "../../components/SignOutButton";
import { formatInrPrice } from "../../../lib/format-price";
import type { AdminProductStatus, AdminProductSummary } from "../../../lib/product-catalog-admin";

const STATUS_LABELS: Record<AdminProductStatus, string> = {
  active: "Active",
  draft: "Draft",
  out_of_stock: "Out of stock",
  no_image: "No image",
};

type StatusFilter = "all" | AdminProductStatus | "low_stock";

export default function AdminProductsClient() {
  const [products, setProducts] = useState<AdminProductSummary[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [q, setQ] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [statusMessage, setStatusMessage] = useState("Loading products…");

  const loadProducts = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        status,
      });
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
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Failed to load products.");
    }
  }, [category, limit, page, q, status]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const topCategories = useMemo(() => {
    return categories.slice(0, 24);
  }, [categories]);

  const runSearch = () => {
    setPage(1);
    setQ(searchDraft);
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
            <Link href="/" className="button secondary">
              Home
            </Link>
            <Link href="/admin" className="button secondary">
              Site admin
            </Link>
            <Link href="/admin/orders" className="button secondary">
              Orders
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
            <button type="button" className="button primary button-sage" onClick={runSearch}>
              Search
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

            <div className="catalog-admin-status-tabs" role="tablist" aria-label="Product status">
              {(
                [
                  ["all", "All"],
                  ["active", "Active"],
                  ["draft", "Draft"],
                  ["out_of_stock", "Out of stock"],
                  ["low_stock", "Low stock"],
                  ["no_image", "No image"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={status === value}
                  className={`catalog-admin-status-tab${status === value ? " is-active" : ""}`}
                  onClick={() => {
                    setStatus(value);
                    setPage(1);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="catalog-admin-table-wrap">
          <table className="catalog-admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Status</th>
                <th>Inventory</th>
                <th>Category</th>
                <th align="right">Price</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <Link href={`/admin/products/${product.id}`} className="catalog-admin-product-cell">
                      <span className="catalog-admin-thumb">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt="" />
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
                    <span className={`catalog-admin-badge catalog-admin-badge--${product.status}`}>
                      {STATUS_LABELS[product.status]}
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
        </div>

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
