"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ResolvedCategoryCard } from "../../lib/category-banner-types";
import {
  formatBackgroundPosition,
  formatBackgroundSize,
  parseBackgroundPosition,
} from "../../lib/category-banner-position";
import type { SiteMediaItem } from "../../lib/site-media-gallery-types";
import { prepareBannerImageFile } from "../../lib/prepare-banner-image-file";

type CollectionCardEditorProps = {
  card: ResolvedCategoryCard;
  open: boolean;
  onClose: () => void;
};

export function CollectionCardEditor({ card, open, onClose }: CollectionCardEditorProps) {
  const router = useRouter();
  const [label, setLabel] = useState(card.label);
  const [description, setDescription] = useState(card.description);
  const [imageUrl, setImageUrl] = useState(card.imageUrl ?? "");
  const [posX, setPosX] = useState(() => parseBackgroundPosition(card.objectPosition).x);
  const [posY, setPosY] = useState(() => parseBackgroundPosition(card.objectPosition).y);
  const [scale, setScale] = useState(card.backgroundScale);
  const [gallery, setGallery] = useState<SiteMediaItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [showGallery, setShowGallery] = useState(false);

  const resetDraftFromCard = useCallback(() => {
    setLabel(card.label);
    setDescription(card.description);
    setImageUrl(card.imageUrl ?? "");
    const position = parseBackgroundPosition(card.objectPosition);
    setPosX(position.x);
    setPosY(position.y);
    setScale(card.backgroundScale);
    setShowGallery(false);
    setStatus("");
  }, [card]);

  const handleCancel = useCallback(() => {
    if (busy) {
      return;
    }
    resetDraftFromCard();
    onClose();
  }, [busy, onClose, resetDraftFromCard]);

  useEffect(() => {
    resetDraftFromCard();
  }, [resetDraftFromCard]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleCancel]);

  useEffect(() => {
    if (!open || !showGallery) {
      return;
    }
    void fetch("/api/site-media-gallery", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { items?: SiteMediaItem[] }) => {
        setGallery(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => setGallery([]));
  }, [open, showGallery]);

  const savePatch = async () => {
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/category-banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: card.slug,
          patch: {
            cardLabel: label,
            cardDescription: description,
            cardImageUrl: imageUrl || undefined,
            cardObjectPosition: formatBackgroundPosition(posX, posY),
            cardBackgroundScale: scale,
          },
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Save failed");
      }
      setStatus("Saved.");
      router.refresh();
    } catch (error) {
      setStatus((error as Error).message ?? "Save failed.");
    } finally {
      setBusy(false);
      window.setTimeout(() => setStatus(""), 3200);
    }
  };

  const onUpload = async (file: File | null) => {
    if (!file) {
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const prepared = await prepareBannerImageFile(file);
      const formData = new FormData();
      formData.set("slug", card.slug);
      formData.set("target", "card");
      formData.set("image", prepared);
      const response = await fetch("/api/category-banners/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as { cardImageUrl?: string; imageUrl?: string; error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? "Upload failed");
      }
      const nextUrl = data?.cardImageUrl ?? data?.imageUrl ?? "";
      if (nextUrl) {
        setImageUrl(nextUrl);
      }
      setStatus("Image uploaded.");
      router.refresh();
    } catch (error) {
      setStatus((error as Error).message ?? "Upload failed.");
    } finally {
      setBusy(false);
      window.setTimeout(() => setStatus(""), 3200);
    }
  };

  const resetCard = async () => {
    if (!window.confirm("Reset this collection tile to catalog defaults?")) {
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/category-banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: card.slug, resetCard: true }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Reset failed");
      }
      setStatus("Reset to defaults.");
      onClose();
      router.refresh();
    } catch (error) {
      setStatus((error as Error).message ?? "Reset failed.");
    } finally {
      setBusy(false);
      window.setTimeout(() => setStatus(""), 3200);
    }
  };

  if (!open) {
    return null;
  }

  // The collection section is deliberately isolated so it can layer below the
  // hero. Render this fixed drawer at the document root so that isolation does
  // not trap it underneath the hero when a tile is edited.
  return createPortal(
    <div className="category-banner-drawer-root" role="presentation">
      <button
        type="button"
        className="category-banner-drawer-backdrop"
        aria-label="Cancel and close collection editor"
        onClick={handleCancel}
      />
      <aside className="category-banner-drawer" role="dialog" aria-label="Collection tile editor" aria-modal="true">
        <div className="category-banner-drawer-head">
          <h2 className="category-banner-drawer-title">Collection · {card.slug}</h2>
          <button type="button" className="category-banner-drawer-close" disabled={busy} onClick={handleCancel}>
            Cancel
          </button>
        </div>

        <div className="category-banner-drawer-body">
          {imageUrl ? (
            <div
              className="home-collection-editor-preview"
              style={{
                backgroundImage: `url(${imageUrl})`,
                backgroundPosition: formatBackgroundPosition(posX, posY),
                backgroundSize: formatBackgroundSize(scale),
              }}
              role="img"
              aria-label={`${label} preview`}
            />
          ) : null}

          {imageUrl ? (
            <div className="home-collection-editor-position">
              <span className="home-collection-editor-position-label">Image position in tile</span>
              <label className="category-banner-field">
                <span>Horizontal ({Math.round(posX)}%)</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={posX}
                  disabled={busy}
                  onChange={(event) => setPosX(Number(event.target.value))}
                />
              </label>
              <label className="category-banner-field">
                <span>Vertical ({Math.round(posY)}%)</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={posY}
                  disabled={busy}
                  onChange={(event) => setPosY(Number(event.target.value))}
                />
              </label>
              <label className="category-banner-field">
                <span>Scale ({scale}%)</span>
                <input
                  type="range"
                  min={50}
                  max={300}
                  step={1}
                  value={scale}
                  disabled={busy}
                  onChange={(event) => setScale(Number(event.target.value))}
                />
              </label>
              <code className="category-banner-code">
                {formatBackgroundPosition(posX, posY)} · {formatBackgroundSize(scale)}
              </code>
            </div>
          ) : null}

          <label className="category-banner-field">
            <span>Tile image</span>
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={(event) => void onUpload(event.target.files?.[0] ?? null)}
            />
          </label>

          <div className="home-collection-editor-actions">
            <button type="button" disabled={busy} onClick={() => setShowGallery((value) => !value)}>
              {showGallery ? "Hide gallery" : "Pick from gallery"}
            </button>
            <Link href="/admin/media" className="home-collection-editor-gallery-link">
              Open media gallery
            </Link>
          </div>

          {showGallery ? (
            <div className="home-collection-editor-gallery">
              {gallery.length === 0 ? (
                <p className="home-collection-editor-gallery-empty">No gallery images yet.</p>
              ) : (
                gallery.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`home-collection-editor-gallery-item${imageUrl === item.url ? " is-selected" : ""}`}
                    disabled={busy}
                    onClick={() => setImageUrl(item.url)}
                  >
                    <span
                      className="home-collection-editor-gallery-thumb"
                      style={{ backgroundImage: `url(${item.url})` }}
                      aria-hidden
                    />
                    <span className="home-collection-editor-gallery-label">{item.label ?? item.filename}</span>
                  </button>
                ))
              )}
            </div>
          ) : null}

          <label className="category-banner-field">
            <span>Title on tile</span>
            <input value={label} onChange={(event) => setLabel(event.target.value)} disabled={busy} />
          </label>

          <label className="category-banner-field">
            <span>Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={busy}
              rows={4}
            />
          </label>

          {status ? <p className="category-banner-status">{status}</p> : null}

          <div className="category-banner-actions">
            <button type="button" className="category-banner-btn primary" disabled={busy} onClick={() => void savePatch()}>
              {busy ? "Saving…" : "Save tile"}
            </button>
            <button type="button" className="category-banner-btn" disabled={busy} onClick={handleCancel}>
              Cancel
            </button>
            <button type="button" className="category-banner-btn" disabled={busy} onClick={() => void resetCard()}>
              Reset tile
            </button>
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
