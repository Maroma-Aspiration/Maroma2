"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SignOutButton } from "../../../components/SignOutButton";
import { formatInrPrice } from "../../../../lib/format-price";
import type { AdminProductDetail } from "../../../../lib/product-catalog-admin";

const IMAGE_SLOTS = [
  { id: "main", label: "Main image" },
  { id: "view1", label: "Gallery 1" },
  { id: "view2", label: "Gallery 2" },
  { id: "view3", label: "Gallery 3" },
  { id: "view4", label: "Gallery 4" },
] as const;

type ProductEditClientProps = {
  productId: string;
};

export default function ProductEditClient({ productId }: ProductEditClientProps) {
  const [product, setProduct] = useState<AdminProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSucceeded, setSaveSucceeded] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [uploadedSlot, setUploadedSlot] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [saleEnabled, setSaleEnabled] = useState(false);
  const [stock, setStock] = useState(0);
  const [published, setPublished] = useState(true);
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [categoriesText, setCategoriesText] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [images, setImages] = useState<string[]>([]);

  const hydrateForm = useCallback((detail: AdminProductDetail) => {
    setName(detail.name);
    setSku(detail.sku);
    setPrice(detail.price);
    setSalePrice(detail.salePrice ?? "");
    setSaleEnabled(Boolean(detail.salePrice));
    setStock(detail.stock);
    setPublished(detail.published);
    setShortDescription(detail.shortDescription);
    setDescription(detail.description);
    setBrand(detail.brand);
    setCategoriesText(detail.categories.join(", "));
    setTagsText(detail.tags.join(", "));
    setImages(detail.images.length > 0 ? detail.images : detail.imageUrl ? [detail.imageUrl] : []);
  }, []);

  const loadProduct = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}`, { cache: "no-store" });
      const data = (await res.json()) as { product?: AdminProductDetail; error?: string };
      if (!res.ok || !data.product) {
        throw new Error(data.error || "Product not found.");
      }
      setProduct(data.product);
      hydrateForm(data.product);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load product.");
    } finally {
      setLoading(false);
    }
  }, [hydrateForm, productId]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  const saveProduct = async () => {
    if (saving) return;
    setSaving(true);
    setSaveSucceeded(false);
    setStatus(null);
    setError(null);
    try {
      const categories = categoriesText
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      const tags = tagsText
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          sku,
          price,
          salePrice: saleEnabled ? salePrice : "",
          stock,
          published,
          shortDescription,
          description,
          brand,
          categories,
          tags,
        }),
      });
      const data = (await res.json()) as { product?: AdminProductDetail; error?: string };
      if (!res.ok || !data.product) {
        throw new Error(data.error || "Could not save product.");
      }
      setProduct(data.product);
      hydrateForm(data.product);
      setStatus("Product Saved!");
      setSaveSucceeded(true);
      window.setTimeout(() => setSaveSucceeded(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save product.");
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (slot: string, file: File) => {
    setUploadingSlot(slot);
    setUploadedSlot(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("productId", productId);
      formData.set("slot", slot);
      formData.set("image", file);
      const res = await fetch("/api/products/upload", { method: "POST", body: formData });
      const data = (await res.json()) as { allImages?: string[]; imageUrl?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      if (data.allImages?.length) {
        setImages(data.allImages.filter(Boolean));
      } else if (data.imageUrl) {
        setImages((prev) => {
          const next = [...prev];
          if (slot === "main") next[0] = data.imageUrl!;
          return next;
        });
      }
      setStatus(`${slot === "main" ? "Main Image" : "Gallery Image"} Uploaded!`);
      setUploadedSlot(slot);
      window.setTimeout(() => setUploadedSlot((current) => current === slot ? null : current), 3000);
      await loadProduct();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadingSlot(null);
    }
  };

  if (loading) {
    return (
      <main className="catalog-admin-page">
        <div className="catalog-admin-shell">
          <p className="catalog-admin-empty">Loading product…</p>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="catalog-admin-page">
        <div className="catalog-admin-shell">
          <p className="catalog-admin-empty">{error ?? "Product not found."}</p>
          <Link href="/admin/products" className="button secondary">
            Back to products
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="catalog-admin-page">
      <div className="catalog-admin-shell catalog-admin-shell--edit">
        <header className="catalog-admin-header">
          <div>
            <Link href="/admin/products" className="catalog-admin-back">
              ← All products
            </Link>
            <h1>{name || product.name}</h1>
            <p className="catalog-admin-lede">
              SKU {sku || product.sku} · {formatInrPrice(price) ?? price}
            </p>
          </div>
          <div className="catalog-admin-header-actions">
            <Link href="/" className="button secondary">
              Home
            </Link>
            <Link href={`/product/${productId}`} className="button secondary" target="_blank">
              View on store
            </Link>
            <SignOutButton />
            <button
              type="button"
              className={`button primary button-sage${saveSucceeded ? " process-success" : ""}`}
              disabled={saving}
              onClick={() => void saveProduct()}
            >
              {saving ? "Saving…" : saveSucceeded ? "Product Saved!" : "Save"}
            </button>
          </div>
        </header>

        {status ? <p className="catalog-admin-status catalog-admin-status--ok">{status}</p> : null}
        {error ? (
          <p className="catalog-admin-status catalog-admin-status--error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="catalog-admin-edit-grid">
          <div className="catalog-admin-edit-main">
            <section className="catalog-admin-card">
              <h2>Product details</h2>
              <label className="catalog-admin-field">
                <span>Title</span>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="catalog-admin-field">
                <span>Short description</span>
                <textarea
                  rows={3}
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                />
              </label>
              <label className="catalog-admin-field">
                <span>Description</span>
                <textarea
                  rows={10}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
            </section>

            <section className="catalog-admin-card">
              <h2>Media</h2>
              <p className="catalog-admin-card-copy">
                Upload a main image and up to four gallery images. Changes appear on the storefront
                immediately after upload.
              </p>
              <div className="catalog-admin-media-grid">
                {IMAGE_SLOTS.map((slot, index) => {
                  const imageUrl = slot.id === "main" ? images[0] : images[index] ?? "";
                  return (
                    <div key={slot.id} className="catalog-admin-media-slot">
                      <span className="catalog-admin-media-label">{slot.label}</span>
                      <div className="catalog-admin-media-preview">
                        {imageUrl ? <img src={imageUrl} alt="" /> : <span>No image</span>}
                      </div>
                      <label className={`button secondary catalog-admin-upload-btn${uploadedSlot === slot.id ? " process-success" : ""}`}>
                        {uploadingSlot === slot.id ? "Uploading…" : uploadedSlot === slot.id ? "Image Uploaded!" : "Upload"}
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          disabled={uploadingSlot !== null}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void uploadImage(slot.id, file);
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="catalog-admin-card">
              <h2>Organization</h2>
              <label className="catalog-admin-field">
                <span>Brand</span>
                <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} />
              </label>
              <label className="catalog-admin-field">
                <span>Categories (comma-separated)</span>
                <input
                  type="text"
                  value={categoriesText}
                  onChange={(e) => setCategoriesText(e.target.value)}
                />
              </label>
              <label className="catalog-admin-field">
                <span>Tags (comma-separated)</span>
                <input type="text" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
              </label>
            </section>
          </div>

          <aside className="catalog-admin-edit-side">
            <section className="catalog-admin-card">
              <h2>Status</h2>
              <label className="catalog-admin-toggle">
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                />
                <span>Published on storefront</span>
              </label>
              <p className="catalog-admin-card-copy">
                Draft products stay hidden even if inventory is available.
              </p>
            </section>

            <section className="catalog-admin-card">
              <h2>Pricing</h2>
              <label className="catalog-admin-field">
                <span>Price (INR)</span>
                <input type="text" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
              </label>
              <div className="catalog-admin-sale-status">
                <span>Sale pricing</span>
                <div className="catalog-admin-sale-toggle" role="group" aria-label="Sale pricing status">
                  <button
                    type="button"
                    className={!saleEnabled ? "is-active" : ""}
                    aria-pressed={!saleEnabled}
                    onClick={() => setSaleEnabled(false)}
                  >
                    Disabled
                  </button>
                  <button
                    type="button"
                    className={saleEnabled ? "is-active" : ""}
                    aria-pressed={saleEnabled}
                    onClick={() => setSaleEnabled(true)}
                  >
                    Enabled
                  </button>
                </div>
              </div>
              <label className="catalog-admin-field">
                <span>Sale price (INR)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  placeholder={saleEnabled ? "Enter a sale price" : "Sale pricing is disabled"}
                  disabled={!saleEnabled}
                />
              </label>
              <p className="catalog-admin-card-copy">
                {saleEnabled
                  ? "When lower than the regular price, the storefront shows the regular price crossed out and uses this sale price in the bag and checkout."
                  : "Enable sale pricing to enter a discounted storefront price."}
              </p>
            </section>

            <section className="catalog-admin-card">
              <h2>Inventory</h2>
              <label className="catalog-admin-field">
                <span>Quantity in stock</span>
                <input
                  type="number"
                  min={0}
                  value={stock}
                  onChange={(e) => setStock(Math.max(0, Number(e.target.value) || 0))}
                />
              </label>
              <p className="catalog-admin-card-copy">
                Customers cannot add to bag when stock is zero.
              </p>
            </section>

            <section className="catalog-admin-card">
              <h2>SKU</h2>
              <label className="catalog-admin-field">
                <span>SKU</span>
                <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} />
              </label>
            </section>

            <button
              type="button"
              className={`button primary button-sage catalog-admin-save-side${saveSucceeded ? " process-success" : ""}`}
              disabled={saving}
              onClick={() => void saveProduct()}
            >
              {saving ? "Saving…" : saveSucceeded ? "Product Saved!" : "Save product"}
            </button>
          </aside>
        </div>
      </div>
    </main>
  );
}
