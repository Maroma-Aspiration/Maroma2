"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { defaultWideBannerLayout } from "../../lib/category-banner-defaults";
import type { ResolvedCategoryBanner } from "../../lib/category-banner-types";
import { prepareBannerImageFile } from "../../lib/prepare-banner-image-file";
import { useAdminSession } from "../../lib/use-admin-session";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function parseObjectPosition(value: string): { x: number; y: number } {
  const trimmed = value.trim();
  const match = trimmed.match(/([\d.]+)%\s+([\d.]+)%/);
  if (match) {
    return {
      x: clamp(parseFloat(match[1]), 0, 100),
      y: clamp(parseFloat(match[2]), 0, 100)
    };
  }
  return { x: 82, y: 38 };
}

function faceCareMobileObjectPosition(value: string): string {
  const { x, y } = parseObjectPosition(value);
  return `calc(${x}% - 2cm) ${y}%`;
}

function useMobileCategoryHero(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return isMobile;
}

const minHeightPresets: { label: string; value: string }[] = [
  { label: "Compact", value: "clamp(180px, 26vw, 300px)" },
  { label: "Default", value: defaultWideBannerLayout.minHeight },
  { label: "Tall", value: "clamp(280px, 40vw, 480px)" }
];

const maxHeightPresets: { label: string; value: string }[] = [
  { label: "Shallow", value: "min(36vh, 360px)" },
  { label: "Default", value: defaultWideBannerLayout.maxHeight },
  { label: "Deep", value: "min(58vh, 520px)" }
];

export type CategoryHeroWithAdminProps = {
  slug: string;
  categoryLabel: string;
  productCount: number;
  wideCover: boolean;
  splitThumb: boolean;
  resolved: ResolvedCategoryBanner;
  /** When true, tagline uses italic “hero” styling (matches catalog `heroTagline` categories). */
  italicTagline?: boolean;
};

export function CategoryHeroWithAdmin({
  slug,
  categoryLabel,
  productCount,
  wideCover,
  splitThumb,
  resolved,
  italicTagline = false
}: CategoryHeroWithAdminProps) {
  const router = useRouter();
  const { isAdminUser } = useAdminSession();
  const isMobileCategoryHero = useMobileCategoryHero();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerOffsetX, setDrawerOffsetX] = useState(0);
  const drawerDragStart = useRef<{ pointerX: number; offsetX: number } | null>(null);
  const bannerMediaRef = useRef<HTMLDivElement>(null);
  const copyDragStart = useRef<{ pointerX: number; pointerY: number; left: number; bottom: number } | null>(null);
  const [copyLeftPct, setCopyLeftPct] = useState(resolved.copyLeftPct);
  const [copyBottomPct, setCopyBottomPct] = useState(resolved.copyBottomPct);
  const copyPositionRef = useRef({ left: resolved.copyLeftPct, bottom: resolved.copyBottomPct });
  const [copyDragging, setCopyDragging] = useState(false);
  const [imageUrl, setImageUrl] = useState(resolved.imageUrl);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingImagePreviewUrl, setPendingImagePreviewUrl] = useState<string | null>(null);
  const [heroTitle, setHeroTitle] = useState(resolved.heroTitle);
  const [heroTagline, setHeroTagline] = useState(resolved.heroTagline);
  const [objectPosition, setObjectPosition] = useState(resolved.objectPosition);
  const [imageScale, setImageScale] = useState(resolved.imageScale);
  const [minHeight, setMinHeight] = useState(resolved.minHeight);
  const [maxHeight, setMaxHeight] = useState(resolved.maxHeight);
  const [thumbMaxWidth, setThumbMaxWidth] = useState(resolved.thumbMaxWidth);
  const [posX, setPosX] = useState(() => parseObjectPosition(resolved.objectPosition).x);
  const [posY, setPosY] = useState(() => parseObjectPosition(resolved.objectPosition).y);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveSucceeded, setSaveSucceeded] = useState(false);

  useEffect(() => {
    if (pendingImage) {
      return;
    }
    setImageUrl(resolved.imageUrl);
    setHeroTitle(resolved.heroTitle);
    setHeroTagline(resolved.heroTagline);
    setObjectPosition(resolved.objectPosition);
    setImageScale(resolved.imageScale);
    setMinHeight(resolved.minHeight);
    setMaxHeight(resolved.maxHeight);
    setThumbMaxWidth(resolved.thumbMaxWidth);
    setCopyLeftPct(resolved.copyLeftPct);
    setCopyBottomPct(resolved.copyBottomPct);
    copyPositionRef.current = { left: resolved.copyLeftPct, bottom: resolved.copyBottomPct };
    const p = parseObjectPosition(resolved.objectPosition);
    setPosX(p.x);
    setPosY(p.y);
  }, [
    pendingImage,
    resolved.heroTagline,
    resolved.heroTitle,
    resolved.imageScale,
    resolved.imageUrl,
    resolved.maxHeight,
    resolved.minHeight,
    resolved.objectPosition,
    resolved.thumbMaxWidth,
    resolved.copyLeftPct,
    resolved.copyBottomPct,
  ]);

  useEffect(() => {
    return () => {
      if (pendingImagePreviewUrl) URL.revokeObjectURL(pendingImagePreviewUrl);
    };
  }, [pendingImagePreviewUrl]);

  useEffect(() => {
    setObjectPosition(`${Math.round(posX)}% ${Math.round(posY)}%`);
  }, [posX, posY]);

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const showEditor = isAdminUser && Boolean(imageUrl);
  const heroMods = `${wideCover ? "category-hero--wide" : ""} ${splitThumb ? "category-hero--split" : ""}`.trim();
  const bannerObjectPosition =
    wideCover && slug === "face-care" && isMobileCategoryHero
      ? faceCareMobileObjectPosition(objectPosition)
      : objectPosition;
  // Mobile banners historically receive a small crop zoom; retain it while
  // letting the admin slider control the underlying scale.
  const renderedImageScale = (imageScale / 100) * (isMobileCategoryHero ? 1.1 : 1);

  const backLink = (
    <Link href="/?skipIntro=1" className="category-back">
      Back to Home
    </Link>
  );

  const persistCopyPosition = async (left: number, bottom: number) => {
    try {
      const response = await fetch("/api/category-banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          patch: {
            copyLeftPct: Math.round(left),
            copyBottomPct: Math.round(bottom)
          }
        })
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Could not save headline position."));
      }
    } catch (error) {
      setStatus((error as Error).message ?? "Could not save headline position.");
      window.setTimeout(() => setStatus(""), 3200);
    }
  };

  const onCopyDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!showEditor || !wideCover) {
      return;
    }
    event.preventDefault();
    copyDragStart.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      left: copyLeftPct,
      bottom: copyBottomPct
    };
    setCopyDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onCopyDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!copyDragStart.current || !bannerMediaRef.current) {
      return;
    }
    const rect = bannerMediaRef.current.getBoundingClientRect();
    const deltaLeftPct = ((event.clientX - copyDragStart.current.pointerX) / rect.width) * 100;
    const deltaBottomPct = (-(event.clientY - copyDragStart.current.pointerY) / rect.height) * 100;
    const nextLeft = clamp(copyDragStart.current.left + deltaLeftPct, 0, 90);
    const nextBottom = clamp(copyDragStart.current.bottom + deltaBottomPct, 0, 90);
    copyPositionRef.current = { left: nextLeft, bottom: nextBottom };
    setCopyLeftPct(nextLeft);
    setCopyBottomPct(nextBottom);
  };

  const onCopyDragEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!copyDragStart.current) {
      return;
    }
    copyDragStart.current = null;
    setCopyDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
    void persistCopyPosition(copyPositionRef.current.left, copyPositionRef.current.bottom);
  };

  const copyMaxWidth = `min(540px, calc(${Math.max(8, 98 - copyLeftPct)}% - 20px))`;

  const wideCoverTextPill = (
    <div
      className={`category-hero-text-pill${showEditor ? " category-hero-text-pill--draggable" : ""}${copyDragging ? " category-hero-text-pill--dragging" : ""}`}
      style={{
        left: `${copyLeftPct}%`,
        bottom: `${copyBottomPct}%`,
        maxWidth: copyMaxWidth
      }}
      onPointerDown={showEditor ? onCopyDragStart : undefined}
      onPointerMove={showEditor ? onCopyDragMove : undefined}
      onPointerUp={showEditor ? onCopyDragEnd : undefined}
      onPointerCancel={showEditor ? onCopyDragEnd : undefined}
      title={showEditor ? "Drag to reposition headline" : undefined}
    >
      <span className="category-hero-pill-eyebrow eyebrow">Maroma Collection</span>
      <h1 className="category-hero-pill-title">{heroTitle}</h1>
      <p className={`category-hero-pill-tagline${italicTagline ? " category-hero-tagline" : ""}`}>{heroTagline}</p>
    </div>
  );

  const defaultHeroCopy = (
    <>
      <span className="eyebrow">Maroma Collection</span>
      <h1>{heroTitle}</h1>
      <p className={italicTagline ? "category-hero-tagline" : undefined}>{heroTagline}</p>
    </>
  );

  const heroCopy = wideCover ? wideCoverTextPill : defaultHeroCopy;

  const readApiError = async (response: Response, fallback: string): Promise<string> => {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    return data?.error || fallback;
  };

  const uploadImage = async (file: File, patch: Record<string, string | number>): Promise<string> => {
    const prepared = await prepareBannerImageFile(file);
    const formData = new FormData();
    formData.set("slug", slug);
    formData.set("image", prepared);
    formData.set("patch", JSON.stringify(patch));
    const response = await fetch("/api/category-banners/upload", {
      method: "POST",
      body: formData,
    });
    const data = (await response.json().catch(() => null)) as { imageUrl?: string; error?: string } | null;
    if (!response.ok || !data?.imageUrl) {
      throw new Error(data?.error ?? "Image upload failed");
    }
    return data.imageUrl;
  };

  const savePatch = async (patch: Record<string, string | number>) => {
    setBusy(true);
    setStatus("");
    setSaveSucceeded(false);
    try {
      const nextImageUrl = pendingImage ? await uploadImage(pendingImage, patch) : imageUrl;
      const response = pendingImage
        ? null
        : await fetch("/api/category-banners", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug, patch })
          });
      if (response && !response.ok) {
        throw new Error(await readApiError(response, "Save failed"));
      }
      if (nextImageUrl) setImageUrl(nextImageUrl);
      setPendingImage(null);
      setPendingImagePreviewUrl(null);
      setSaveSucceeded(true);
      setStatus("Banner saved successfully.");
      router.refresh();
    } catch (error) {
      setStatus((error as Error).message ?? "Save failed.");
    } finally {
      setBusy(false);
      window.setTimeout(() => {
        setStatus("");
        setSaveSucceeded(false);
      }, 3200);
    }
  };

  const onSelectImage = (file: File | null) => {
    if (!file) {
      return;
    }
    setPendingImage(file);
    setPendingImagePreviewUrl(URL.createObjectURL(file));
    setStatus("New image ready. Save text & layout to apply it.");
  };

  const displayImageUrl = pendingImagePreviewUrl ?? imageUrl;

  const resetOverrides = async () => {
    if (!window.confirm("Reset this category banner to catalog defaults?")) {
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/category-banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, reset: true })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Reset failed");
      }
      setStatus("Reset to defaults.");
      setDrawerOpen(false);
      router.refresh();
    } catch (error) {
      setStatus((error as Error).message ?? "Reset failed.");
    } finally {
      setBusy(false);
      window.setTimeout(() => setStatus(""), 3200);
    }
  };

  const openDrawer = () => {
    if (!isAdminUser) {
      return;
    }
    setDrawerOpen(true);
  };

  const onDrawerDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    drawerDragStart.current = { pointerX: event.clientX, offsetX: drawerOffsetX };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onDrawerDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawerDragStart.current) return;
    // Keep at least a practical editor width on screen, while allowing the
    // drawer to move left and back to its normal right-hand position.
    const minOffset = -(window.innerWidth - 320);
    const next = clamp(
      drawerDragStart.current.offsetX + event.clientX - drawerDragStart.current.pointerX,
      minOffset,
      0,
    );
    setDrawerOffsetX(next);
  };

  const onDrawerDragEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawerDragStart.current) return;
    drawerDragStart.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  if (!displayImageUrl) {
    return (
      <header
        className={`category-hero ${heroMods}`}
        data-category-slug={slug}
        data-review="Category hero"
        data-review-id="category-hero"
        data-review-files="app/components/CategoryHeroWithAdmin.tsx,app/[slug]/page.tsx"
      >
        <div className="category-hero-copy">
          {wideCover ? heroCopy : (
            <>
              {backLink}
              {heroCopy}
            </>
          )}
        </div>
      </header>
    );
  }

  return (
    <>
      <header
        className={`category-hero ${heroMods}`}
        data-category-slug={slug}
        data-review="Category hero"
        data-review-id="category-hero"
        data-review-files="app/components/CategoryHeroWithAdmin.tsx,app/[slug]/page.tsx"
      >
        {wideCover ? (
          <div
            ref={bannerMediaRef}
            className="category-hero-wide-media category-banner-admin-target"
          >
            {showEditor ? (
              <button
                type="button"
                className="category-banner-edit-trigger"
                onClick={openDrawer}
                aria-expanded={drawerOpen}
              >
                Edit banner
              </button>
            ) : null}
            <img
              className="category-hero-wide-img"
              src={displayImageUrl}
              alt={`${categoryLabel} collection — Maroma`}
              style={{
                objectPosition: bannerObjectPosition,
                transform: `scale(${renderedImageScale})`,
              }}
            />
            <div className="category-hero-copy category-hero-copy--overlay">{heroCopy}</div>
          </div>
        ) : (
          <>
            <div className="category-hero-copy">
              {backLink}
              {heroCopy}
            </div>
            <div className={`category-hero-banner ${showEditor ? "category-banner-admin-target" : ""}`}>
              {showEditor ? (
                <button
                  type="button"
                  className="category-banner-edit-trigger category-banner-edit-trigger--thumb"
                  onClick={openDrawer}
                  aria-expanded={drawerOpen}
                >
                  Edit banner
                </button>
              ) : null}
              <img
                src={displayImageUrl}
                alt={`${categoryLabel} | Maroma Collection`}
                style={splitThumb ? { maxWidth: thumbMaxWidth } : undefined}
              />
            </div>
          </>
        )}
      </header>

      {drawerOpen && showEditor ? (
        <div className="category-banner-drawer-root" role="presentation">
          <button
            type="button"
            className="category-banner-drawer-backdrop"
            aria-label="Close banner editor"
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            className="category-banner-drawer"
            role="dialog"
            aria-label="Category banner editor"
            aria-modal="true"
            style={{ transform: `translateX(${drawerOffsetX}px)` }}
          >
            <div
              className="category-banner-drawer-head category-banner-drawer-drag-handle"
              onPointerDown={onDrawerDragStart}
              onPointerMove={onDrawerDragMove}
              onPointerUp={onDrawerDragEnd}
              onPointerCancel={onDrawerDragEnd}
              title="Drag left or right to move this editor"
            >
              <h2 className="category-banner-drawer-title">Banner · {categoryLabel}</h2>
              <button
                type="button"
                className="category-banner-drawer-close"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setDrawerOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="category-banner-drawer-body">
              <label className="category-banner-field">
                <span>Hero image</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={busy}
                  onChange={(event) => onSelectImage(event.target.files?.[0] ?? null)}
                />
              </label>

              <label className="category-banner-field">
                <span>Headline</span>
                <input value={heroTitle} onChange={(event) => setHeroTitle(event.target.value)} disabled={busy} />
              </label>

              <label className="category-banner-field">
                <span>Tagline</span>
                <textarea
                  value={heroTagline}
                  onChange={(event) => setHeroTagline(event.target.value)}
                  disabled={busy}
                  rows={4}
                />
                <small className="category-banner-field-hint">Press Enter for a line break on the banner.</small>
              </label>

              {wideCover ? (
                <>
                  <div className="category-banner-field">
                    <span>Banner crop</span>
                    <div className="category-banner-live-preview" aria-label="Live banner preview">
                      <img
                        src={displayImageUrl}
                        alt="Live banner crop preview"
                        style={{ objectPosition: bannerObjectPosition, transform: `scale(${renderedImageScale})` }}
                      />
                      <span>Live preview · {imageScale}% · X {Math.round(posX)}% · Y {Math.round(posY)}%</span>
                    </div>
                    <div className="category-banner-slider-row">
                      <label>
                        Scale ({imageScale}%)
                        <input
                          type="range"
                          min={50}
                          max={300}
                          value={imageScale}
                          onChange={(event) => setImageScale(Number(event.target.value))}
                          disabled={busy}
                        />
                      </label>
                      <label>
                        X ({Math.round(posX)}%)
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={posX}
                          onChange={(event) => setPosX(Number(event.target.value))}
                          disabled={busy}
                        />
                      </label>
                      <label>
                        Y ({Math.round(posY)}%)
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={posY}
                          onChange={(event) => setPosY(Number(event.target.value))}
                          disabled={busy}
                        />
                      </label>
                    </div>
                    <code className="category-banner-code">
                      Scale {imageScale}% · X {Math.round(posX)}% · Y {Math.round(posY)}%
                    </code>
                  </div>

                  <p className="category-banner-code">Frame: 2048 × 694 (2.95:1), scaled proportionally to the page width.</p>
                </>
              ) : null}

              {splitThumb ? (
                <label className="category-banner-field">
                  <span>Thumbnail width ({thumbMaxWidth}px)</span>
                  <input
                    type="range"
                    min={120}
                    max={480}
                    value={thumbMaxWidth}
                    onChange={(event) => setThumbMaxWidth(Number(event.target.value))}
                    disabled={busy}
                  />
                </label>
              ) : null}

              {status ? <p className="category-banner-status">{status}</p> : null}

              <div className="category-banner-actions">
                <button
                  type="button"
                  className={`category-banner-btn primary${saveSucceeded ? " is-success" : ""}`}
                  disabled={busy}
                  onClick={() =>
                    void savePatch({
                      heroTitle,
                      heroTagline,
                      ...(wideCover
                        ? {
                            objectPosition,
                            imageScale,
                            minHeight,
                            maxHeight,
                            copyLeftPct: Math.round(copyLeftPct),
                            copyBottomPct: Math.round(copyBottomPct)
                          }
                        : { thumbMaxWidth })
                    })
                  }
                >
                  {busy ? "Saving…" : saveSucceeded ? "Saved ✓" : "Save banner changes"}
                </button>
                <button type="button" className="category-banner-btn" disabled={busy} onClick={() => void resetOverrides()}>
                  Reset all overrides
                </button>
              </div>
              <p className="category-banner-hint">
                Drag the headline on the banner to reposition it. Banner controls are available to signed-in administrators.
                API routes are open on this staging build. Do not expose publicly without authentication.
              </p>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
