"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { defaultWideBannerLayout } from "../../lib/category-banner-defaults";
import type { ResolvedCategoryBanner } from "../../lib/category-banner-types";
import { ADMIN_DRAG_STORAGE_KEY, useAdminSession } from "../../lib/use-admin-session";

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
  const { adminModeEnabled: admin } = useAdminSession();
  const isMobileCategoryHero = useMobileCategoryHero();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState(resolved.imageUrl);
  const [heroTitle, setHeroTitle] = useState(resolved.heroTitle);
  const [heroTagline, setHeroTagline] = useState(resolved.heroTagline);
  const [objectPosition, setObjectPosition] = useState(resolved.objectPosition);
  const [minHeight, setMinHeight] = useState(resolved.minHeight);
  const [maxHeight, setMaxHeight] = useState(resolved.maxHeight);
  const [thumbMaxWidth, setThumbMaxWidth] = useState(resolved.thumbMaxWidth);
  const [posX, setPosX] = useState(() => parseObjectPosition(resolved.objectPosition).x);
  const [posY, setPosY] = useState(() => parseObjectPosition(resolved.objectPosition).y);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setImageUrl(resolved.imageUrl);
    setHeroTitle(resolved.heroTitle);
    setHeroTagline(resolved.heroTagline);
    setObjectPosition(resolved.objectPosition);
    setMinHeight(resolved.minHeight);
    setMaxHeight(resolved.maxHeight);
    setThumbMaxWidth(resolved.thumbMaxWidth);
    const p = parseObjectPosition(resolved.objectPosition);
    setPosX(p.x);
    setPosY(p.y);
  }, [resolved]);

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

  const showEditor = admin && Boolean(imageUrl);
  const heroMods = `${wideCover ? "category-hero--wide" : ""} ${splitThumb ? "category-hero--split" : ""}`.trim();
  const bannerObjectPosition =
    wideCover && slug === "face-care" && isMobileCategoryHero
      ? faceCareMobileObjectPosition(objectPosition)
      : objectPosition;

  const backLink = (
    <Link href="/?skipIntro=1" className="category-back">
      Back to Home
    </Link>
  );

  const wideCoverTextPill = (
    <div className="category-hero-text-pill">
      <Link href="/?skipIntro=1" className="category-hero-pill-home" aria-label="Home">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M5.5 10.5 12 5l6.5 5.5V18a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 18v-7.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M10 19.5V13a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v6.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </Link>
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

  const savePatch = async (patch: Record<string, string | number>) => {
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/category-banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, patch })
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
      const formData = new FormData();
      formData.set("slug", slug);
      formData.set("image", file);
      const response = await fetch("/api/category-banners/upload", {
        method: "POST",
        body: formData
      });
      const data = (await response.json()) as { imageUrl?: string; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Upload failed");
      }
      if (data.imageUrl) {
        setImageUrl(data.imageUrl);
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
    if (!admin || window.localStorage.getItem(ADMIN_DRAG_STORAGE_KEY) !== "true") {
      window.alert(
        'Turn on admin mode from the homepage using the floating "Admin" control, then return here.'
      );
      return;
    }
    setDrawerOpen(true);
  };

  if (!imageUrl) {
    return (
      <header className={`category-hero ${heroMods}`} data-category-slug={slug}>
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
      <header className={`category-hero ${heroMods}`} data-category-slug={slug}>
        {wideCover ? (
          <div
            className="category-hero-wide-media category-banner-admin-target"
            style={{ minHeight, maxHeight }}
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
              src={imageUrl}
              alt={`${categoryLabel} collection — Maroma`}
              style={{ objectPosition: bannerObjectPosition }}
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
                src={imageUrl}
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
          >
            <div className="category-banner-drawer-head">
              <h2 className="category-banner-drawer-title">Banner · {categoryLabel}</h2>
              <button type="button" className="category-banner-drawer-close" onClick={() => setDrawerOpen(false)}>
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
                  onChange={(event) => void onUpload(event.target.files?.[0] ?? null)}
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
                  rows={3}
                />
              </label>

              {wideCover ? (
                <>
                  <div className="category-banner-field">
                    <span>Focal point (crop)</span>
                    <div className="category-banner-slider-row">
                      <label>
                        Horizontal
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
                        Vertical
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
                    <code className="category-banner-code">{objectPosition}</code>
                  </div>

                  <label className="category-banner-field">
                    <span>Min height</span>
                    <select
                      value={minHeightPresets.some((preset) => preset.value === minHeight) ? minHeight : "__custom__"}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value !== "__custom__") {
                          setMinHeight(value);
                        }
                      }}
                      disabled={busy}
                    >
                      {minHeightPresets.map((preset) => (
                        <option key={preset.label} value={preset.value}>
                          {preset.label}
                        </option>
                      ))}
                      <option value="__custom__">Custom (use field below)</option>
                    </select>
                    <input
                      className="category-banner-custom-css"
                      value={minHeight}
                      onChange={(event) => setMinHeight(event.target.value)}
                      disabled={busy}
                      placeholder="CSS min-height"
                    />
                  </label>

                  <label className="category-banner-field">
                    <span>Max height</span>
                    <select
                      value={maxHeightPresets.some((preset) => preset.value === maxHeight) ? maxHeight : "__custom__"}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value !== "__custom__") {
                          setMaxHeight(value);
                        }
                      }}
                      disabled={busy}
                    >
                      {maxHeightPresets.map((preset) => (
                        <option key={preset.label} value={preset.value}>
                          {preset.label}
                        </option>
                      ))}
                      <option value="__custom__">Custom</option>
                    </select>
                    <input
                      className="category-banner-custom-css"
                      value={maxHeight}
                      onChange={(event) => setMaxHeight(event.target.value)}
                      disabled={busy}
                      placeholder="CSS max-height"
                    />
                  </label>
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
                  className="category-banner-btn primary"
                  disabled={busy}
                  onClick={() =>
                    void savePatch({
                      heroTitle,
                      heroTagline,
                      ...(wideCover
                        ? { objectPosition, minHeight, maxHeight }
                        : { thumbMaxWidth })
                    })
                  }
                >
                  {busy ? "Saving…" : "Save text & layout"}
                </button>
                <button type="button" className="category-banner-btn" disabled={busy} onClick={() => void resetOverrides()}>
                  Reset all overrides
                </button>
              </div>
              <p className="category-banner-hint">
                Admin mode uses the same toggle as the homepage (`{ADMIN_DRAG_STORAGE_KEY}` in local storage). API routes
                are open on this staging build. Do not expose publicly without authentication.
              </p>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
