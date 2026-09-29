"use client";

import { useEffect, useMemo, useState } from "react";
import { uploadFileToFirebase } from "../../../lib/client-firebase-upload";
import "./video-id.css";

type ProductOption = { id: string; name: string; searchText?: string };
type VideoRow = { id: string; file: File; previewUrl: string; productId: string; search: string; status: string; needsReview: boolean };

const UNCERTAIN_VIDEO_NAMES = new Set([
  "Hibscus shampoo + gel.mp4", "Neem conditioner.mp4", "Neem shampoo.mp4",
  "Bliss.mp4", "Dream.mp4", "Inspire.mp4", "Nurture.mp4", "Recharge.mp4", "Serene.mp4", "Stress Away.mp4",
  "Colibri Solid Balm Protection for the Great Outdoors.mp4", "Aloe & Calendula roll on deo.mp4", "Calendula Deo Spray.mp4", "Vinegar deo Spray.mp4",
  "Balancing Cleansing Milk.mp4", "Balancing Face Gel.mp4", "Bamboo Charcoal with walnut shell face scrub.mp4", "Moisturising Cleansing Milk.mp4", "Moisturising Face Gel.mp4",
  "Revitalising Cleansing Milk.mp4", "Revitalising Face Gel.mp4", "Turmeric and Walnut Shell Face Scrub.mp4", "spf 50 face sunscreen broad spectrum.mp4",
  "Wild Pomegranate Shower Gel.mp4", "bamboo charcoal soap.mp4", "coconut soaps f.mp4", "rose scrub soap.mp4", "soaps.mp4", "solid perfumes.mp4",
]);

const SEARCH_ALIASES: Record<string, string> = {
  moisturising: "moisturizing",
  moisturiser: "moisturizer",
  moisturisers: "moisturizers",
  moisturised: "moisturized",
  moisturise: "moisturize",
  moisturises: "moisturizes",
};

const normalizeSearch = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export default function VideoIdClient({ products }: { products: ProductOption[] }) {
  const [rows, setRows] = useState<VideoRow[]>([]);
  const [notice, setNotice] = useState("");

  useEffect(() => () => rows.forEach((row) => URL.revokeObjectURL(row.previewUrl)), [rows]);

  const sortedProducts = useMemo(() => [...products].sort((a, b) => a.name.localeCompare(b.name)), [products]);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files).filter((file) => file.type === "video/mp4" && /\.mp4$/i.test(file.name)).map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
      productId: "",
      search: file.name.replace(/\.mp4$/i, "").replace(/[_-]+/g, " "),
      status: UNCERTAIN_VIDEO_NAMES.has(file.name) ? "Review required" : "Not linked",
      needsReview: UNCERTAIN_VIDEO_NAMES.has(file.name),
    }));
    setRows((current) => [...current, ...next]);
    if (next.length !== Array.from(files).length) setNotice("Only H.264/AAC MP4 files are accepted.");
  };

  const updateRow = (id: string, patch: Partial<VideoRow>) => setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));

  const publish = async (row: VideoRow) => {
    if (!row.productId) {
      updateRow(row.id, { status: "Choose a product first" });
      return;
    }
    updateRow(row.id, { status: "Uploading to Firebase…" });
    try {
      const url = await uploadFileToFirebase(row.file, `admin-product-videos/${row.productId}`, { skipGallery: true });
      const response = await fetch("/api/products/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "attach-video", productId: row.productId, url }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not attach video to product.");
      updateRow(row.id, { status: "Published" });
    } catch (error) {
      updateRow(row.id, { status: error instanceof Error ? error.message : "Upload failed" });
    }
  };

  return (
    <main className="video-id-page">
      <header className="video-id-header">
        <div>
          <p>Maroma admin</p>
          <h1>Video ID</h1>
          <span>Preview each video, choose its exact product, then publish it to Firebase.</span>
        </div>
        <a href="/admin">Back to admin</a>
      </header>

      <section className="video-id-toolbar">
          <label className="video-id-picker">
          <strong>Load MP4 video folder</strong>
          <span>Select the complete video folder; every file will appear below.</span>
          {/* @ts-expect-error webkitdirectory is supported by Chromium and Safari but missing from React's input typings. */}
          <input type="file" accept="video/mp4,.mp4" multiple webkitdirectory="" onChange={(event) => { addFiles(event.currentTarget.files); event.currentTarget.value = ""; }} />
        </label>
        <p>{notice || `${rows.length} video${rows.length === 1 ? "" : "s"} in this workspace`}</p>
      </section>

      <section className="video-id-list" aria-label="Videos to identify">
        {rows.length === 0 ? <div className="video-id-empty">Add the MP4 folder contents to begin identifying videos.</div> : null}
        {rows.map((row) => {
          const query = row.search.trim().toLowerCase();
          const tokens = normalizeSearch(query).split(" ").filter(Boolean).map((token) => SEARCH_ALIASES[token] ?? token);
          const shown = query ? (() => {
            const ranked = sortedProducts.map((product) => {
              const fields = normalizeSearch(`${product.name} ${product.id} ${product.searchText ?? ""}`).split(" ");
              const score = tokens.reduce((total, token) => total + (fields.some((field) => field.startsWith(token)) ? 1 : 0), 0);
              return { product, score };
            }).filter((entry) => entry.score > 0);
            ranked.sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name));
            return ranked.slice(0, 30).map((entry) => entry.product);
          })() : sortedProducts;
          return (
            <article className="video-id-row" key={row.id}>
              <div className="video-id-preview"><video src={row.previewUrl} controls preload="metadata" /></div>
              <div className="video-id-details">
                <h2>{row.file.name} {row.needsReview ? <em className="video-id-review-badge">Needs visual confirmation</em> : null}</h2>
                <label className="video-id-search-label">Search entire catalogue
                  <input value={row.search} onChange={(event) => updateRow(row.id, { search: event.target.value, productId: "" })} placeholder="Type product name or ID" />
                </label>
                <div className="video-id-results" role="listbox" aria-label="Matching products">
                  {row.search.trim() ? (shown.length ? shown.map((product) => (
                    <button className={row.productId === product.id ? "is-selected" : ""} type="button" role="option" aria-selected={row.productId === product.id} key={product.id} onClick={() => updateRow(row.id, { productId: product.id, search: product.name })}>
                      <strong>{product.name}</strong><small>{product.id}</small>
                    </button>
                  )) : <p>No matching products found.</p>) : <p>Type to search the full catalogue.</p>}
                </div>
                {row.productId ? <p className="video-id-selected">Selected: <strong>{sortedProducts.find((product) => product.id === row.productId)?.name}</strong></p> : null}
                <div className="video-id-actions"><button type="button" disabled={row.status === "Uploading to Firebase…" || row.status === "Published"} onClick={() => void publish(row)}>{row.status === "Published" ? "Published" : "Link video"}</button><span className={row.status === "Published" ? "is-published" : ""}>{row.status}</span></div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
