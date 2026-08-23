"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { SiteMediaItem } from "../../../lib/site-media-gallery-types";

export default function MediaGalleryClient() {
  const [items, setItems] = useState<SiteMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");
  const [labelDraft, setLabelDraft] = useState("");

  const loadGallery = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/site-media-gallery", { cache: "no-store" });
      const data = (await res.json()) as { items?: SiteMediaItem[] };
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setStatus("Could not load gallery.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGallery();
  }, [loadGallery]);

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) {
      return;
    }
    setUploading(true);
    setStatus("");
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set("file", file);
        if (labelDraft.trim()) {
          form.set("label", labelDraft.trim());
        }
        const res = await fetch("/api/site-media-gallery/upload", { method: "POST", body: form });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? "Upload failed");
        }
      }
      setLabelDraft("");
      setStatus(`${files.length} image${files.length === 1 ? "" : "s"} uploaded.`);
      await loadGallery();
    } catch (error) {
      setStatus((error as Error).message ?? "Upload failed.");
    } finally {
      setUploading(false);
      window.setTimeout(() => setStatus(""), 4000);
    }
  };

  const copyUrl = async (url: string) => {
    try {
      const absolute =
        typeof window !== "undefined" && url.startsWith("/")
          ? `${window.location.origin}${url}`
          : url;
      await navigator.clipboard.writeText(absolute);
      setStatus("URL copied.");
    } catch {
      setStatus("Could not copy URL.");
    }
    window.setTimeout(() => setStatus(""), 2400);
  };

  const deleteItem = async (id: string) => {
    if (!window.confirm("Remove this image from the gallery catalog? (The file stays on the server.)")) {
      return;
    }
    const res = await fetch("/api/site-media-gallery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleteId: id }),
    });
    if (!res.ok) {
      setStatus("Delete failed.");
      return;
    }
    setStatus("Removed from gallery.");
    await loadGallery();
    window.setTimeout(() => setStatus(""), 2400);
  };

  return (
    <div className="admin-media-page">
      <header className="admin-media-head">
        <div>
          <p className="admin-media-eyebrow">Admin · Media</p>
          <h1>Site image gallery</h1>
          <p className="admin-media-lead">
            Upload images once, then pick them for collection tiles, banners, promos, and anywhere else on the site.
          </p>
        </div>
        <Link href="/?skipIntro=1" className="admin-media-back">
          Back to site
        </Link>
      </header>

      <section className="admin-media-upload-panel">
        <label className="admin-media-field">
          <span>Label (optional, applies to next upload)</span>
          <input
            value={labelDraft}
            onChange={(event) => setLabelDraft(event.target.value)}
            placeholder="e.g. Summer face care hero"
            disabled={uploading}
          />
        </label>
        <label className="admin-media-upload-drop">
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={uploading}
            onChange={(event) => void uploadFiles(event.target.files)}
          />
          <span>{uploading ? "Uploading…" : "Drop images here or click to upload"}</span>
        </label>
        {status ? <p className="admin-media-status">{status}</p> : null}
      </section>

      {loading ? (
        <p className="admin-media-loading">Loading gallery…</p>
      ) : items.length === 0 ? (
        <p className="admin-media-empty">No images yet. Upload your first asset above.</p>
      ) : (
        <div className="admin-media-grid">
          {items.map((item) => (
            <article key={item.id} className="admin-media-card">
              <div
                className="admin-media-thumb"
                style={{ backgroundImage: `url(${item.url})` }}
                role="img"
                aria-label={item.label ?? item.filename}
              />
              <div className="admin-media-card-body">
                <p className="admin-media-card-title">{item.label ?? item.filename}</p>
                <code className="admin-media-card-url">{item.url}</code>
                <div className="admin-media-card-actions">
                  <button type="button" onClick={() => void copyUrl(item.url)}>
                    Copy URL
                  </button>
                  <button type="button" className="is-danger" onClick={() => void deleteItem(item.id)}>
                    Remove
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
