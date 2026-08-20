"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Gift3dAssetStatus,
  Gift3dAssetsStore,
  Gift3dProductAsset,
  Gift3dRefImage,
  Gift3dRefLabel,
} from "../../../lib/gift-3d-assets-store";
import type { GiftBuilderCatalog, GiftElement } from "../../../lib/gift-builder-types";
import type { GiftShapeFamily } from "../../../lib/gift-shape-family";
import { resolveGiftShapeFamily } from "../../../lib/gift-shape-family";
import type { AdminProductDetail, AdminProductSummary } from "../../../lib/product-catalog-admin";
import { Gift3dImageCropper } from "./Gift3dImageCropper";

function emptyAsset(productId: string, elementId?: string): Gift3dProductAsset {
  return {
    productId,
    elementId,
    status: "missing",
    shapeFamily: "auto",
    catalogImageUsable: false,
    refs: [],
    reconstructionStatus: "idle",
    notes: "",
    updatedAt: new Date().toISOString(),
  };
}

const REF_LABELS: { value: Gift3dRefLabel; label: string }[] = [
  { value: "front", label: "Front" },
  { value: "label", label: "Label artwork" },
  { value: "back", label: "Back" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "top", label: "Top" },
  { value: "other", label: "Other" },
];

const SHAPE_OPTIONS: { value: GiftShapeFamily | "auto"; label: string }[] = [
  { value: "auto", label: "Auto (from category)" },
  { value: "bottle", label: "Bottle" },
  { value: "jar", label: "Jar / tin" },
  { value: "bar", label: "Soap bar" },
  { value: "box", label: "Box / carton" },
  { value: "candle", label: "Candle" },
  { value: "tube", label: "Tube" },
  { value: "pouch", label: "Pouch / sachet" },
];

const STATUS_OPTIONS: { value: Gift3dAssetStatus; label: string }[] = [
  { value: "missing", label: "Missing" },
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

type CatalogRow = {
  productId: string;
  elementId?: string;
  name: string;
  image: string;
  category?: string;
  element?: GiftElement;
};

function statusClass(status: Gift3dAssetStatus): string {
  return `gift-3d-status gift-3d-status--${status}`;
}

function previewRefUrl(asset: Gift3dProductAsset): string | undefined {
  return (
    asset.primaryRefUrl ??
    asset.refs.find((ref) => ref.useFor3d !== false && (ref.label === "front" || ref.label === "label"))?.url ??
    asset.refs.find((ref) => ref.useFor3d !== false)?.url
  );
}

function canGenerateMesh(asset: Gift3dProductAsset): boolean {
  return asset.catalogImageUsable || asset.refs.some((ref) => ref.useFor3d !== false);
}

function canApproveMesh(asset: Gift3dProductAsset): boolean {
  return Boolean(asset.glbUrl);
}

const SLOT_LABELS: Gift3dRefLabel[] = ["front", "back", "left", "right", "top", "label"];

function applyCropRefToStore(
  store: Gift3dAssetsStore,
  productId: string,
  slot: number,
  imageUrl: string,
  elementId?: string
): Gift3dAssetsStore {
  const label = SLOT_LABELS[slot - 1] ?? "other";
  const base = store.products[productId] ?? emptyAsset(productId, elementId);
  const index = slot - 1;
  const previous = base.refs[index];
  const nextRef: Gift3dRefImage = {
    id: previous?.id ?? `ref${slot}-${Date.now()}`,
    url: imageUrl,
    label: previous?.label ?? label,
    useFor3d: previous?.useFor3d !== false,
    uploadedAt: new Date().toISOString(),
  };
  const refs = [...base.refs];
  if (index < refs.length) refs[index] = nextRef;
  else refs.push(nextRef);
  const nextAsset: Gift3dProductAsset = {
    ...base,
    refs,
    primaryRefUrl:
      nextRef.useFor3d !== false && (nextRef.label === "front" || slot === 1)
        ? imageUrl
        : previewRefUrl({ ...base, refs }) ?? base.primaryRefUrl,
    status: base.status === "approved" ? "approved" : "draft",
    updatedAt: new Date().toISOString(),
  };
  return {
    ...store,
    products: { ...store.products, [productId]: nextAsset },
    updatedAt: new Date().toISOString(),
  };
}

function applyStatusToStore(
  store: Gift3dAssetsStore,
  productId: string,
  status: Gift3dAssetStatus,
  elementId?: string
): Gift3dAssetsStore {
  const base = store.products[productId] ?? emptyAsset(productId, elementId);
  return {
    ...store,
    products: {
      ...store.products,
      [productId]: {
        ...base,
        status,
        productId,
        elementId: base.elementId ?? elementId,
        updatedAt: new Date().toISOString(),
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

export default function Gift3dAdminClient() {
  const [store, setStore] = useState<Gift3dAssetsStore | null>(null);
  const [catalog, setCatalog] = useState<GiftBuilderCatalog | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Gift3dAssetStatus>("all");
  const [listQuery, setListQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");
  const [uploadLabel, setUploadLabel] = useState<Gift3dRefLabel>("front");

  const [adding, setAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AdminProductSummary[]>([]);
  const [listingImages, setListingImages] = useState<string[]>([]);
  const [listingLoading, setListingLoading] = useState(false);
  const [cropSource, setCropSource] = useState<{ url: string; slot: number } | null>(null);
  const [reconstructing, setReconstructing] = useState(false);
  const [falConfigured, setFalConfigured] = useState<boolean | null>(null);
  const storeRef = useRef<Gift3dAssetsStore | null>(null);
  storeRef.current = store;

  useEffect(() => {
    void Promise.all([
      fetch("/api/admin/gift-3d-assets", { cache: "no-store" }).then((res) => res.json()),
      fetch("/api/gift-builder/catalog", { cache: "no-store" }).then((res) => res.json()),
      fetch("/api/admin/gift-3d-reconstruct", { cache: "no-store" }).then((res) => res.json()),
    ]).then(([assets, live, reconstruct]) => {
      setStore(assets);
      setCatalog(live);
      setFalConfigured(Boolean(reconstruct?.configured));
      const first = (live as GiftBuilderCatalog)?.elements?.[0]?.productId;
      if (first) setSelectedId(first);
    });
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setListingImages([]);
      return;
    }
    let cancelled = false;
    setListingLoading(true);
    setCropSource(null);
    void fetch(`/api/admin/products/${encodeURIComponent(selectedId)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { product?: AdminProductDetail; error?: string }) => {
        if (cancelled) return;
        const product = data.product;
        if (!product) {
          setListingImages([]);
          return;
        }
        const urls = [product.imageUrl, ...(product.images ?? [])]
          .map((url) => (url || "").trim())
          .filter(Boolean);
        setListingImages(Array.from(new Set(urls)));
      })
      .catch(() => {
        if (!cancelled) setListingImages([]);
      })
      .finally(() => {
        if (!cancelled) setListingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const catalogRows = useMemo(() => {
    if (!catalog) return [] as CatalogRow[];
    const rows: CatalogRow[] = catalog.elements.map((element) => ({
      productId: element.productId,
      elementId: element.id,
      name: element.name,
      image: element.image,
      category: element.category,
      element,
    }));
    if (!store) return rows;
    for (const asset of Object.values(store.products)) {
      if (rows.some((row) => row.productId === asset.productId)) continue;
      rows.push({
        productId: asset.productId,
        elementId: asset.elementId,
        name: `Product ${asset.productId}`,
        image: asset.primaryRefUrl || asset.refs[0]?.url || "",
      });
    }
    return rows;
  }, [catalog, store]);

  const filteredRows = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    return catalogRows.filter((row) => {
      const asset = store?.products[row.productId];
      const assetStatus = asset?.status ?? "missing";
      if (filter !== "all" && assetStatus !== filter) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.productId.toLowerCase().includes(q) ||
        (row.elementId ?? "").toLowerCase().includes(q)
      );
    });
  }, [catalogRows, filter, listQuery, store]);

  const selectedRow = catalogRows.find((row) => row.productId === selectedId) ?? null;
  const selectedAsset: Gift3dProductAsset | null =
    selectedId && store
      ? store.products[selectedId] ??
        emptyAsset(selectedId, selectedRow?.elementId)
      : null;

  const updateSelected = (patch: Partial<Gift3dProductAsset>) => {
    if (!selectedId) return;
    setStore((current) => {
      if (!current) return current;
      const base = current.products[selectedId] ?? emptyAsset(selectedId, selectedRow?.elementId);
      const next: Gift3dProductAsset = {
        ...base,
        ...patch,
        productId: selectedId,
        elementId: patch.elementId ?? base.elementId ?? selectedRow?.elementId,
        updatedAt: new Date().toISOString(),
      };
      if (patch.status === undefined && next.status === "missing" && (next.refs.length > 0 || next.catalogImageUsable)) {
        next.status = "draft";
      }
      return {
        ...current,
        products: { ...current.products, [selectedId]: next },
      };
    });
  };

  const updateRef = (refId: string, patch: Partial<Gift3dRefImage>) => {
    if (!selectedAsset) return;
    const refs = selectedAsset.refs.map((ref) => (ref.id === refId ? { ...ref, ...patch } : ref));
    const updated = refs.find((ref) => ref.id === refId);
    const primaryRefUrl =
      updated?.useFor3d !== false && (updated?.label === "front" || updated?.label === "label")
        ? updated.url
        : previewRefUrl({ ...selectedAsset, refs }) ?? selectedAsset.primaryRefUrl;
    updateSelected({ refs, primaryRefUrl });
  };

  const persistStore = async (nextStore: Gift3dAssetsStore): Promise<boolean> => {
    try {
      const res = await fetch("/api/admin/gift-3d-assets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextStore),
      });
      const data = (await res.json()) as Gift3dAssetsStore & { error?: string };
      if (res.ok && data.products) {
        setStore(data);
        storeRef.current = data;
        return true;
      }
      setStatus(data.error || "Could not save.");
      return false;
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not save.");
      return false;
    }
  };

  const save = async () => {
    const current = storeRef.current;
    if (!current) return;
    setSaving(true);
    setStatus("");
    const ok = await persistStore(current);
    if (ok) setStatus("3D product assets saved.");
    setSaving(false);
  };

  const setProductStatus = async (nextStatus: Gift3dAssetStatus) => {
    if (!selectedId) return;
    const current = storeRef.current;
    if (!current) {
      setStatus("Product data is still loading. Try Approve again.");
      return;
    }
    setSaving(true);
    setStatus("");
    const nextStore = applyStatusToStore(current, selectedId, nextStatus, selectedRow?.elementId);
    setStore(nextStore);
    storeRef.current = nextStore;
    const ok = await persistStore(nextStore);
    if (ok) {
      if (nextStatus === "approved") setStatus("Approved mesh published to the gift builder.");
      else if (nextStatus === "rejected") setStatus("Product rejected for 3D.");
      else setStatus("Marked as draft.");
    }
    setSaving(false);
  };

  const generateMesh = async () => {
    if (!selectedId) return;
    const current = storeRef.current;
    if (!current) {
      setStatus("Product data is still loading. Try Generate again.");
      return;
    }
    setReconstructing(true);
    setStatus("Generating 3D mesh. This usually takes one to three minutes…");
    const saved = await persistStore(current);
    if (!saved) {
      setReconstructing(false);
      return;
    }
    try {
      const res = await fetch("/api/admin/gift-3d-reconstruct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedId,
          catalogImageUrl: selectedRow?.image,
        }),
      });
      const data = (await res.json()) as Gift3dAssetsStore & { error?: string; store?: Gift3dAssetsStore };
      const next = data.store ?? data;
      if (next.products) {
        setStore(next);
        storeRef.current = next;
      }
      if (!res.ok) {
        setStatus(data.error || "Mesh generation failed.");
      } else {
        setStatus("3D mesh ready. Review it, then approve for the gift builder.");
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Mesh generation failed.");
    }
    setReconstructing(false);
  };

  const uploadRef = async (file: File) => {
    if (!selectedId) return;
    setUploading(true);
    setStatus("");
    const form = new FormData();
    form.set("file", file);
    const res = await fetch("/api/upload-canvas-image", { method: "POST", body: form });
    const data = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !data.url) {
      setStatus(data.error || "Upload failed.");
      setUploading(false);
      return;
    }
    const ref = {
      id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      url: data.url,
      label: uploadLabel,
      useFor3d: true,
      uploadedAt: new Date().toISOString(),
    };
    const base = selectedAsset ?? emptyAsset(selectedId, selectedRow?.elementId);
    const refs = [...base.refs, ref];
    updateSelected({
      refs,
      primaryRefUrl:
        ref.label === "front" || ref.label === "label" || !base.primaryRefUrl
          ? data.url
          : base.primaryRefUrl,
      status: base.status === "missing" ? "draft" : base.status,
    });
    setStatus("Reference image uploaded. Press Save to publish.");
    setUploading(false);
  };

  const saveCropAsReference = async (blob: Blob) => {
    if (!selectedId || !cropSource) return;
    const slot = cropSource.slot;
    setUploading(true);
    setStatus("");
    const file = new File(
      [blob],
      `gift-3d-ref-${selectedId}-${slot}-${Date.now()}.png`,
      { type: "image/png" }
    );
    const form = new FormData();
    form.set("file", file);
    const res = await fetch("/api/upload-canvas-image", { method: "POST", body: form });
    const data = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !data.url) {
      setUploading(false);
      throw new Error(data.error || "Upload failed.");
    }
    const imageUrl = data.url;
    const current = storeRef.current;
    if (!current) {
      setUploading(false);
      throw new Error("Product data is still loading. Close and try Save again.");
    }
    const nextStore = applyCropRefToStore(current, selectedId, slot, imageUrl, selectedRow?.elementId);
    setStore(nextStore);
    storeRef.current = nextStore;
    const ok = await persistStore(nextStore);
    if (!ok) {
      setUploading(false);
      throw new Error("Could not save the cropped image. Try again.");
    }
    setCropSource(null);
    setStatus(`Reference image ${slot} saved.`);
    setUploading(false);
  };

  const searchCatalogue = async () => {
    const params = new URLSearchParams({ q: searchQuery, limit: "30", status: "all" });
    const data = await fetch(`/api/admin/products?${params}`, { cache: "no-store" }).then((res) =>
      res.json()
    );
    setSearchResults(data.products ?? []);
  };

  const addProduct = (product: AdminProductSummary) => {
    if (!store) return;
    if (store.products[product.id]) {
      setSelectedId(product.id);
      setAdding(false);
      return;
    }
    setStore({
      ...store,
      products: {
        ...store.products,
        [product.id]: {
          ...emptyAsset(product.id),
          notes: product.name,
        },
      },
    });
    setSelectedId(product.id);
    setAdding(false);
    setSearchResults([]);
    setSearchQuery("");
    setStatus("Product added to 3D dashboard. Upload refs and Save.");
  };

  const counts = useMemo(() => {
    const tally: Record<Gift3dAssetStatus | "all", number> = {
      all: catalogRows.length,
      missing: 0,
      draft: 0,
      approved: 0,
      rejected: 0,
    };
    for (const row of catalogRows) {
      const s = store?.products[row.productId]?.status ?? "missing";
      tally[s] += 1;
    }
    return tally;
  }, [catalogRows, store]);

  if (!store || !catalog) {
    return (
      <main className="catalog-admin-page">
        <p className="catalog-admin-empty">Loading 3D product dashboard…</p>
      </main>
    );
  }

  const inferredShape = selectedRow?.element
    ? resolveGiftShapeFamily(selectedRow.element, selectedAsset?.shapeFamily)
    : selectedAsset?.shapeFamily === "auto"
      ? "box"
      : selectedAsset?.shapeFamily ?? "box";

  return (
    <main className="catalog-admin-page">
      <div className="catalog-admin-shell catalog-admin-shell--edit gift-3d-admin">
        <header className="catalog-admin-header">
          <div>
            <Link href="/admin/gift-packing" className="catalog-admin-back">
              ← Gift packing
            </Link>
            <h1>3D products</h1>
            <p className="catalog-admin-lede">
              Isolate product photos, send them to an image-to-3D model, then approve the reconstructed
              mesh for the gift box. We do not wrap catalogue photos onto cylinders or boxes.
            </p>
          </div>
          <div className="catalog-admin-header-actions">
            <Link href="/gifting/build-your-set" className="button secondary">
              View gift builder
            </Link>
            <button
              type="button"
              className={`button primary button-sage${status.includes("saved") ? " process-success" : ""}`}
              onClick={() => void save()}
              disabled={saving}
            >
              {saving ? "Saving…" : status.includes("saved") ? "Saved!" : "Save"}
            </button>
          </div>
        </header>

        {status ? <p className="catalog-admin-status catalog-admin-status--ok">{status}</p> : null}

        <div className="gift-3d-admin-layout">
          <aside className="gift-3d-admin-list catalog-admin-card">
            <div className="gift-3d-admin-list-head">
              <h2>Products</h2>
              <button type="button" className="button secondary" onClick={() => setAdding((v) => !v)}>
                {adding ? "Cancel" : "Add product"}
              </button>
            </div>

            <div className="gift-3d-filter-row">
              {(["all", "missing", "draft", "approved", "rejected"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`gift-3d-filter-chip${filter === key ? " is-active" : ""}`}
                  onClick={() => setFilter(key)}
                >
                  {key === "all" ? "All" : key} <span>{counts[key]}</span>
                </button>
              ))}
            </div>

            <input
              type="search"
              className="gift-3d-list-search"
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
              placeholder="Filter by name or id"
            />

            {adding ? (
              <div className="gift-3d-add-panel">
                <div className="catalog-admin-search">
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search full catalogue"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void searchCatalogue();
                    }}
                  />
                  <button type="button" className="button secondary" onClick={() => void searchCatalogue()}>
                    Search
                  </button>
                </div>
                <div className="gift-3d-search-results">
                  {searchResults.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      className="gift-3d-search-result"
                      onClick={() => addProduct(product)}
                    >
                      {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span />}
                      <span>
                        <strong>{product.name}</strong>
                        <small>{product.sku || product.id}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <ul className="gift-3d-product-list">
              {filteredRows.map((row) => {
                const asset = store.products[row.productId];
                const assetStatus = asset?.status ?? "missing";
                return (
                  <li key={row.productId}>
                    <button
                      type="button"
                      className={`gift-3d-product-row${selectedId === row.productId ? " is-selected" : ""}`}
                      onClick={() => setSelectedId(row.productId)}
                    >
                      {row.image ? <img src={row.image} alt="" /> : <span className="gift-3d-thumb-empty" />}
                      <span className="gift-3d-product-copy">
                        <strong>{row.name}</strong>
                        <small>{row.productId}</small>
                      </span>
                      <span className="gift-3d-row-badges">
                        <span className={statusClass(assetStatus)}>{assetStatus}</span>
                        {asset?.glbUrl ? <span className="gift-3d-status gift-3d-status--mesh">mesh</span> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <section className="gift-3d-admin-detail catalog-admin-card">
            {!selectedRow || !selectedAsset ? (
              <p className="catalog-admin-empty">Select a product to isolate views and generate a 3D mesh.</p>
            ) : (
              <>
                <div className="gift-3d-detail-hero">
                  <div className="gift-3d-detail-preview">
                    {(selectedAsset.glbThumbnailUrl || selectedAsset.primaryRefUrl || selectedRow.image) ? (
                      <img
                        src={selectedAsset.glbThumbnailUrl || selectedAsset.primaryRefUrl || selectedRow.image}
                        alt=""
                      />
                    ) : (
                      <span>No image</span>
                    )}
                  </div>
                  <div>
                    <h2>{selectedRow.name}</h2>
                    <p className="catalog-admin-card-copy">
                      Product ID <code>{selectedRow.productId}</code>
                      {selectedRow.elementId ? (
                        <>
                          {" "}
                          · Gift element <code>{selectedRow.elementId}</code>
                        </>
                      ) : null}
                    </p>
                    <p className="catalog-admin-card-copy">
                      Placeholder shape if no mesh: <strong>{inferredShape}</strong>
                    </p>
                  </div>
                </div>

                <div className="gift-3d-detail-grid">
                  <label className="catalog-admin-field">
                    <span>Status</span>
                    <select
                      value={selectedAsset.status}
                      onChange={(e) =>
                        updateSelected({ status: e.target.value as Gift3dAssetStatus })
                      }
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="catalog-admin-field">
                    <span>3D shape</span>
                    <select
                      value={selectedAsset.shapeFamily}
                      onChange={(e) =>
                        updateSelected({
                          shapeFamily: e.target.value as GiftShapeFamily | "auto",
                        })
                      }
                    >
                      {SHAPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="gift-3d-checkbox-field">
                    <input
                      type="checkbox"
                      checked={selectedAsset.catalogImageUsable}
                      onChange={(e) => updateSelected({ catalogImageUsable: e.target.checked })}
                    />
                    <span>
                      Use catalogue photo as a front view
                      <small>Only if you have not isolated a front or label crop. Cropped refs are better for bottles.</small>
                    </span>
                  </label>
                </div>

                <div className="gift-3d-recon">
                  <h3>Reconstructed mesh</h3>
                  {falConfigured === false ? (
                    <p className="catalog-admin-card-copy">
                      Add a <code>FAL_KEY</code> environment variable (fal.ai API key) on Vercel, then
                      generate a mesh. Reconstruction uses Hunyuan 3D v3.1 Pro.
                    </p>
                  ) : (
                    <p className="catalog-admin-card-copy">
                      Hunyuan 3D builds a textured GLB from the labelled views. Isolate the bottle first —
                      pumps, caps and labels reconstruct more cleanly than lifestyle pack shots.
                    </p>
                  )}
                  <p className="catalog-admin-card-copy">
                    Status:{" "}
                    <strong>
                      {reconstructing || selectedAsset.reconstructionStatus === "running"
                        ? "generating"
                        : selectedAsset.glbUrl
                          ? "mesh ready"
                          : selectedAsset.reconstructionStatus ?? "idle"}
                    </strong>
                    {selectedAsset.reconstructedAt
                      ? ` · ${new Date(selectedAsset.reconstructedAt).toLocaleString()}`
                      : ""}
                  </p>
                  {selectedAsset.reconstructionError ? (
                    <p className="catalog-admin-status">{selectedAsset.reconstructionError}</p>
                  ) : null}
                  <button
                    type="button"
                    className="button primary button-sage"
                    onClick={() => void generateMesh()}
                    disabled={
                      reconstructing ||
                      saving ||
                      uploading ||
                      !canGenerateMesh(selectedAsset) ||
                      falConfigured === false
                    }
                  >
                    {reconstructing || selectedAsset.reconstructionStatus === "running"
                      ? "Generating mesh…"
                      : selectedAsset.glbUrl
                        ? "Regenerate 3D mesh"
                        : "Generate 3D mesh"}
                  </button>
                </div>

                <div className="gift-3d-catalog-shot">
                  <h3>Product listing images</h3>
                  <p className="catalog-admin-card-copy">
                    Choose an image, then isolate the product (frame + erase background). Isolate image 1
                    saves as reference image 1, isolate image 2 as reference image 2, and so on — they do
                    not overwrite each other.
                  </p>
                  {listingLoading ? (
                    <p className="catalog-admin-card-copy">Loading listing images…</p>
                  ) : listingImages.length === 0 ? (
                    <p className="catalog-admin-card-copy">No listing images found for this product.</p>
                  ) : (
                    <ul className="gift-3d-listing-grid">
                      {listingImages.map((url, index) => (
                        <li key={`${url}-${index}`}>
                          <button
                            type="button"
                            className="gift-3d-listing-thumb"
                            onClick={() => setCropSource({ url, slot: index + 1 })}
                          >
                            <img src={url} alt="" />
                            <span>Isolate image {index + 1}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="gift-3d-refs">
                  <div className="gift-3d-refs-head">
                    <h3>Reference images</h3>
                    <div className="gift-3d-upload-row">
                      <select
                        value={uploadLabel}
                        onChange={(e) => setUploadLabel(e.target.value as Gift3dRefLabel)}
                      >
                        {REF_LABELS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <label className="button secondary catalog-admin-upload-btn">
                        {uploading ? "Uploading…" : "Upload ref"}
                        <input
                          hidden
                          type="file"
                          accept="image/*"
                          disabled={uploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void uploadRef(file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {selectedAsset.refs.length === 0 ? (
                    <p className="catalog-admin-card-copy">
                      Crop a listing image above, or upload a clear front / label photo when the shop image
                      is not usable.
                    </p>
                  ) : (
                    <>
                      <p className="catalog-admin-card-copy">
                        Check the views to send to reconstruction and label each one (Front, Back, etc.).
                      </p>
                      <ul className="gift-3d-ref-grid">
                        {selectedAsset.refs.map((ref, index) => (
                          <li key={ref.id} className="gift-3d-ref-card">
                            <img src={ref.url} alt="" />
                            <div>
                              <strong>
                                {`Reference image ${index + 1}`}
                                {ref.useFor3d !== false ? " · 3D" : ""}
                              </strong>
                              <label className="gift-3d-ref-field">
                                <span>Face label</span>
                                <select
                                  value={ref.label}
                                  onChange={(e) => updateRef(ref.id, { label: e.target.value as Gift3dRefLabel })}
                                >
                                  {REF_LABELS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={ref.useFor3d !== false}
                                  onChange={(e) => updateRef(ref.id, { useFor3d: e.target.checked })}
                                />
                                Use as reconstruction view
                              </label>
                              <button
                                type="button"
                                className="gift-builder-link-btn"
                                onClick={() => {
                                  const refs = selectedAsset.refs.filter((item) => item.id !== ref.id);
                                  updateSelected({
                                    refs,
                                    primaryRefUrl: previewRefUrl({ ...selectedAsset, refs }),
                                  });
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>

                <label className="catalog-admin-field">
                  <span>Notes</span>
                  <textarea
                    rows={3}
                    value={selectedAsset.notes}
                    onChange={(e) => updateSelected({ notes: e.target.value })}
                    placeholder="e.g. Need better label crop; pump not visible"
                  />
                </label>

                <div className="gift-3d-detail-actions">
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => void setProductStatus("draft")}
                    disabled={saving}
                  >
                    Mark draft
                  </button>
                  <button
                    type="button"
                    className={`button primary button-sage${status.includes("Approved") ? " process-success" : ""}`}
                    onClick={() => void setProductStatus("approved")}
                    disabled={saving || reconstructing || !canApproveMesh(selectedAsset)}
                  >
                    {saving ? "Saving…" : status.includes("Approved") ? "Approved!" : "Approve mesh"}
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => void setProductStatus("rejected")}
                    disabled={saving}
                  >
                    Reject
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {cropSource ? (
        <Gift3dImageCropper
          imageUrl={cropSource.url}
          slot={cropSource.slot}
          title={selectedRow?.name}
          onCancel={() => setCropSource(null)}
          onSave={saveCropAsReference}
        />
      ) : null}
    </main>
  );
}
