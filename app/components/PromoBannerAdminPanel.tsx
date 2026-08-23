"use client";

import { useMemo, useState } from "react";
import type {
  PromoAnimation,
  PromoBanner,
  PromoCtaBuyLink,
  PromoFrame,
  PromoFrameKind,
  PromoMediaKind,
  PromoPresentation,
  PromoSequenceTransition,
} from "../../lib/promo-types";
import {
  buildDefaultCtaBuyLinks,
  normalizeCtaBuyLinks,
  splitCtaBuyLinks,
} from "../../lib/promo-buy-links-utils";
import {
  buildDefaultPromoFrames,
  createPromoFrameId,
  PROMO_FRAME_KIND_LABELS,
  PROMO_TRANSITION_OPTIONS,
} from "../../lib/promo-sequence-utils";
import {
  buildPreviewBannerStack,
  formatScheduleLabel,
  isPromoLiveClient,
  promoVisibilityStatus,
  toDatetimeLocalValue,
  toIsoScheduleValue,
} from "../../lib/promo-client-utils";
import { PROMO_STRIP_DEFAULTS, normalizePromoStripFields } from "../../lib/promo-strip-utils";
import { PromoBannerHomePreview } from "./PromoBannerHomePreview";
import {
  catalogProductToBuyLinkFields,
  MaromaCatalogPicker,
} from "./MaromaCatalogPicker";

const emptyDraft = () => ({
  title: "",
  body: "",
  mediaUrl: "",
  mediaKind: "none" as PromoMediaKind,
  animation: "marquee" as PromoAnimation,
  presentation: "sequence" as PromoPresentation,
  sequenceTransition: "fade" as PromoSequenceTransition,
  sequenceLoop: true,
  frames: buildDefaultPromoFrames(),
  ctaLabel: "",
  ctaHref: "",
  ctaBuyLinks: buildDefaultCtaBuyLinks(),
  ...normalizePromoStripFields({}),
  startsAt: "",
  endsAt: "",
  active: true,
});

const animationOptions: { value: PromoAnimation; label: string; hint: string }[] = [
  { value: "marquee", label: "Marquee", hint: "Scrolls message horizontally" },
  { value: "fade", label: "Fade", hint: "Gentle opacity pulse" },
  { value: "slide", label: "Slide", hint: "Subtle horizontal nudge" },
  { value: "pulse", label: "Pulse", hint: "Soft scale emphasis" },
];

async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload-canvas-image", {
    method: "POST",
    body: form,
    credentials: "same-origin",
  });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error || "Upload failed.");
  return data.url;
}

async function postPromos(body: Record<string, unknown>) {
  const res = await fetch("/api/promos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  let data: { error?: string; banner?: PromoBanner; ok?: boolean } = {};
  try {
    data = (await res.json()) as typeof data;
  } catch {
    throw new Error(res.ok ? "Unexpected response from server." : `Request failed (${res.status}).`);
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data;
}

type SaveMode = "draft" | "publish" | "unpublish";

type PromoBannerAdminPanelProps = {
  banners: PromoBanner[];
  onRefresh: () => Promise<void>;
  onStatus: (message: string) => void;
};

export function PromoBannerAdminPanel({ banners, onRefresh, onStatus }: PromoBannerAdminPanelProps) {
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [publishSucceeded, setPublishSucceeded] = useState(false);
  const [catalogPickerLinkId, setCatalogPickerLinkId] = useState<string | null>(null);

  const previewStack = useMemo(
    () =>
      buildPreviewBannerStack(
        banners,
        {
          ...draft,
          startsAt: toIsoScheduleValue(draft.startsAt),
          endsAt: toIsoScheduleValue(draft.endsAt),
        },
        editingId
      ),
    [banners, draft, editingId]
  );

  const draftForStatus = useMemo(
    () => ({
      active: draft.active,
      startsAt: toIsoScheduleValue(draft.startsAt),
      endsAt: toIsoScheduleValue(draft.endsAt),
    }),
    [draft.active, draft.startsAt, draft.endsAt]
  );

  const draftStatus = promoVisibilityStatus(draftForStatus);
  const scheduleLabel = formatScheduleLabel(draftForStatus.startsAt, draftForStatus.endsAt);

  const liveBanners = useMemo(
    () => banners.filter((banner) => isPromoLiveClient(banner)),
    [banners]
  );

  const bannerTypeLabel = (banner: PromoBanner) =>
    banner.presentation === "sequence"
      ? `sequence (${banner.sequenceTransition})`
      : banner.animation;

  const buildPublishPayload = (banner: PromoBanner) => {
    const strip = normalizePromoStripFields(banner);
    return {
      id: banner.id,
      title: banner.title,
      body: banner.body,
      mediaUrl: banner.mediaUrl,
      mediaKind: banner.mediaKind,
      animation: banner.animation,
      presentation: banner.presentation,
      sequenceTransition: banner.sequenceTransition,
      sequenceLoop: banner.sequenceLoop,
      frames: banner.frames,
      ctaLabel: banner.ctaLabel,
      ctaHref: banner.ctaHref,
      ctaBuyLinks: banner.ctaBuyLinks,
      stripBackground: strip.stripBackground,
      stripHeightPx: strip.stripHeightPx,
      stripOpacity: strip.stripOpacity,
      mediaOffsetXCm: strip.mediaOffsetXCm,
      marqueeForceScroll: strip.marqueeForceScroll,
      heroMarqueeStartOffsetCm: strip.heroMarqueeStartOffsetCm,
      heroMarqueeStartOffsetPx: strip.heroMarqueeStartOffsetPx,
      publishNow: true,
    };
  };

  const unpublishBanner = async (banner: PromoBanner) => {
    setBusy(true);
    try {
      await postPromos({ unpublishId: banner.id });
      onStatus(`"${banner.title}" unpublished.`);
      if (editingId === banner.id) {
        setDraft((current) => ({ ...current, active: false }));
      }
      await onRefresh();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Unpublish failed.");
    } finally {
      setBusy(false);
    }
  };

  const makeLiveBanner = async (banner: PromoBanner) => {
    setBusy(true);
    onStatus("");
    try {
      await postPromos(buildPublishPayload(banner));
      onStatus(`"${banner.title}" is now live on site.`);
      await onRefresh();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Publish failed.");
    } finally {
      setBusy(false);
    }
  };

  const renderBannerMeta = (banner: PromoBanner) => {
    const status = promoVisibilityStatus(banner);
    return (
      <>
        <span className={`promo-admin-status-badge promo-admin-status-badge--${status}`}>
          {status === "live" ? "Live" : status}
        </span>
        <span>{bannerTypeLabel(banner)}</span>
        <span className="promo-admin-list-schedule">{formatScheduleLabel(banner.startsAt, banner.endsAt)}</span>
      </>
    );
  };

  const renderBannerActions = (banner: PromoBanner, variant: "live" | "list" = "list") => {
    const isLive = isPromoLiveClient(banner);
    return (
      <div className={`promo-admin-list-actions${variant === "live" ? " promo-admin-list-actions--live" : ""}`}>
        <button type="button" className="button secondary" disabled={busy} onClick={() => loadBanner(banner)}>
          Edit
        </button>
        {!isLive ? (
          <button
            type="button"
            className="button primary button-sage"
            disabled={busy}
            onClick={() => void makeLiveBanner(banner)}
          >
            Make live
          </button>
        ) : null}
        {banner.active ? (
          <button type="button" className="button secondary" disabled={busy} onClick={() => void unpublishBanner(banner)}>
            Unpublish
          </button>
        ) : null}
        <button type="button" className="button secondary" disabled={busy} onClick={() => void deleteBanner(banner.id)}>
          Delete
        </button>
      </div>
    );
  };

  const resetForm = () => {
    setDraft(emptyDraft());
    setEditingId(null);
    setDirty(false);
    setPublishSucceeded(false);
  };

  const loadBanner = (banner: PromoBanner) => {
    const strip = normalizePromoStripFields(banner);
    setEditingId(banner.id);
    setDraft({
      title: banner.title,
      body: banner.body,
      mediaUrl: banner.mediaUrl,
      mediaKind: banner.mediaKind,
      animation: banner.animation,
      presentation: banner.presentation,
      sequenceTransition: banner.sequenceTransition,
      sequenceLoop: banner.sequenceLoop,
      frames: banner.frames,
      ctaLabel: banner.ctaLabel,
      ctaHref: banner.ctaHref,
      ctaBuyLinks: normalizeCtaBuyLinks(banner.ctaBuyLinks),
      ...strip,
      startsAt: toDatetimeLocalValue(banner.startsAt),
      endsAt: toDatetimeLocalValue(banner.endsAt),
      active: banner.active,
    });
    setDirty(false);
  };

  const applySavedBanner = (banner: PromoBanner) => {
    const strip = normalizePromoStripFields(banner);
    setEditingId(banner.id);
    setDraft({
      title: banner.title,
      body: banner.body,
      mediaUrl: banner.mediaUrl,
      mediaKind: banner.mediaKind,
      animation: banner.animation,
      presentation: banner.presentation,
      sequenceTransition: banner.sequenceTransition,
      sequenceLoop: banner.sequenceLoop,
      frames: banner.frames,
      ctaLabel: banner.ctaLabel,
      ctaHref: banner.ctaHref,
      ctaBuyLinks: normalizeCtaBuyLinks(banner.ctaBuyLinks),
      ...strip,
      startsAt: toDatetimeLocalValue(banner.startsAt),
      endsAt: toDatetimeLocalValue(banner.endsAt),
      active: banner.active,
    });
    setDirty(false);
  };

  const buildPayload = (mode: SaveMode) => {
    const base = {
      id: editingId ?? undefined,
      title: draft.title.trim(),
      body: draft.body,
      mediaUrl: draft.mediaUrl,
      mediaKind: draft.mediaKind,
      animation: draft.animation,
      presentation: draft.presentation,
      sequenceTransition: draft.sequenceTransition,
      sequenceLoop: draft.sequenceLoop,
      frames: draft.frames,
      ctaLabel: draft.ctaLabel,
      ctaHref: draft.ctaHref,
      ctaBuyLinks: draft.ctaBuyLinks,
      stripBackground: draft.stripBackground,
      stripHeightPx: draft.stripHeightPx,
      stripOpacity: draft.stripOpacity,
      mediaOffsetXCm: draft.mediaOffsetXCm,
      marqueeForceScroll: draft.marqueeForceScroll,
      heroMarqueeStartOffsetCm: draft.heroMarqueeStartOffsetCm,
      heroMarqueeStartOffsetPx: draft.heroMarqueeStartOffsetPx,
    };

    if (mode === "unpublish") {
      return { unpublishId: editingId };
    }

    if (mode === "publish") {
      return {
        ...base,
        mediaUrl: draft.mediaKind === "none" ? "" : draft.mediaUrl,
        active: true,
        startsAt: "",
        endsAt: "",
        publishNow: true,
      };
    }

    return {
      ...base,
      mediaUrl: draft.mediaKind === "none" ? "" : draft.mediaUrl,
      active: draft.active,
      startsAt: toIsoScheduleValue(draft.startsAt),
      endsAt: toIsoScheduleValue(draft.endsAt),
    };
  };

  const saveBanner = async (mode: SaveMode) => {
    if (mode === "unpublish") {
      if (!editingId) {
        onStatus("Save the banner first, then unpublish.");
        return;
      }
    } else if (!draft.title.trim()) {
      onStatus("Add a headline before saving.");
      return;
    }

    setBusy(true);
    onStatus("");
    setPublishSucceeded(false);
    try {
      const data = await postPromos(buildPayload(mode));
      if (mode === "unpublish") {
        onStatus("Banner unpublished (hidden on site).");
        setDraft((current) => ({ ...current, active: false }));
        setDirty(false);
      } else if (data.banner) {
        applySavedBanner(data.banner);
        if (mode === "publish") {
          setPublishSucceeded(true);
          onStatus("Published!");
          window.setTimeout(() => setPublishSucceeded(false), 3000);
        } else {
          onStatus(editingId ? "Draft saved." : "Banner saved as draft.");
        }
      } else {
        if (mode === "publish") {
          setPublishSucceeded(true);
          onStatus("Published!");
          window.setTimeout(() => setPublishSucceeded(false), 3000);
        } else {
          onStatus("Banner saved.");
        }
      }
      await onRefresh();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const deleteBanner = async (id: string) => {
    if (!window.confirm("Remove this banner?")) return;
    setBusy(true);
    onStatus("");
    try {
      await postPromos({ deleteId: id });
      if (editingId === id) resetForm();
      onStatus("Banner deleted.");
      await onRefresh();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  };

  const onMediaUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    onStatus("");
    try {
      const url = await uploadFile(file);
      setDraft((current) => ({ ...current, mediaUrl: url }));
      setDirty(true);
      onStatus("Media uploaded.");
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const updateDraft = (patch: Partial<ReturnType<typeof emptyDraft>>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
    setPublishSucceeded(false);
  };

  const updateFrame = (index: number, patch: Partial<PromoFrame>) => {
    setDraft((current) => ({
      ...current,
      frames: current.frames.map((frame, frameIndex) =>
        frameIndex === index ? { ...frame, ...patch } : frame
      ),
    }));
    setDirty(true);
    setPublishSucceeded(false);
  };

  const addFrame = () => {
    setDraft((current) => ({
      ...current,
      frames: [
        ...current.frames,
        {
          id: createPromoFrameId(),
          kind: "marquee" as PromoFrameKind,
          durationMs: 3200,
          bodySizeRem: 0.96,
        },
      ],
    }));
    setDirty(true);
  };

  const removeFrame = (index: number) => {
    setDraft((current) => ({
      ...current,
      frames: current.frames.filter((_, frameIndex) => frameIndex !== index),
    }));
    setDirty(true);
  };

  const resetFrames = () => {
    updateDraft({ frames: buildDefaultPromoFrames() });
  };

  const updateBuyLink = (id: string, patch: Partial<PromoCtaBuyLink>) => {
    setDraft((current) => ({
      ...current,
      ctaBuyLinks: current.ctaBuyLinks.map((link) => (link.id === id ? { ...link, ...patch } : link)),
    }));
    setDirty(true);
    setPublishSucceeded(false);
  };

  const buyLinkGroups = splitCtaBuyLinks(draft.ctaBuyLinks);

  return (
    <div className="promo-admin">
      <header className="promo-admin-head">
        <div>
          <h2 className="promo-admin-title">Homepage banners</h2>
          <p className="promo-admin-lead">
            Banners sit in the homepage hero below the headline and behind the main product image.
          </p>
        </div>
        <button type="button" className="button secondary" onClick={resetForm} disabled={busy}>
          New banner
        </button>
      </header>

      <section className="promo-admin-live" aria-label="Live banner on site">
        <div className="promo-admin-live-head">
          <h3>Live on site</h3>
          {liveBanners.length > 0 ? <span className="promo-admin-live-badge">Live</span> : null}
        </div>
        {liveBanners.length > 0 ? (
          <ul className="promo-admin-live-grid">
            {liveBanners.map((banner) => (
              <li
                key={banner.id}
                className={`promo-admin-live-card${editingId === banner.id ? " is-editing" : ""}`}
              >
                <div className="promo-admin-live-copy">
                  <strong>{banner.title}</strong>
                  <div className="promo-admin-live-meta">{renderBannerMeta(banner)}</div>
                </div>
                {renderBannerActions(banner, "live")}
              </li>
            ))}
          </ul>
        ) : (
          <p className="promo-admin-live-empty">
            No banner is live right now. Create one below or choose Make live on a saved banner.
          </p>
        )}
      </section>

      {banners.length > 0 ? (
        <section className="promo-admin-list" aria-label="All banners">
          <h3>All banners ({banners.length})</h3>
          <ul className="promo-admin-list-grid">
            {banners.map((banner) => (
              <li key={banner.id} className={`promo-admin-list-item${editingId === banner.id ? " is-editing" : ""}`}>
                <div className="promo-admin-list-copy">
                  <strong>{banner.title}</strong>
                  <div className="promo-admin-list-meta">{renderBannerMeta(banner)}</div>
                </div>
                {renderBannerActions(banner)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="promo-admin-layout">
        <section className="promo-admin-form" aria-label="Banner editor">
          <div className="promo-admin-section">
            <h3>Content</h3>
            <label className="promo-admin-field">
              <span>Headline</span>
              <input
                placeholder="e.g. Free shipping over ₹2,000"
                value={draft.title}
                onChange={(event) => updateDraft({ title: event.target.value })}
                disabled={busy}
              />
            </label>
            <label className="promo-admin-field">
              <span>Message</span>
              <textarea
                rows={3}
                placeholder="Short supporting line (optional)"
                value={draft.body}
                onChange={(event) => updateDraft({ body: event.target.value })}
                disabled={busy}
              />
            </label>
          </div>

          <div className="promo-admin-section">
            <h3>Media</h3>
            <div className="promo-admin-chip-row" role="group" aria-label="Media type">
              {(
                [
                  { value: "none", label: "Text only" },
                  { value: "image", label: "Image" },
                  { value: "video", label: "Video" },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`promo-admin-chip${draft.mediaKind === option.value ? " is-active" : ""}`}
                  onClick={() =>
                    updateDraft({
                      mediaKind: option.value,
                      mediaUrl: option.value === "none" ? "" : draft.mediaUrl,
                    })
                  }
                  disabled={busy}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {draft.mediaKind !== "none" ? (
              <label className="promo-admin-field promo-admin-upload">
                <span>{draft.mediaKind === "video" ? "Video file" : "Image file"}</span>
                <input
                  type="file"
                  accept={draft.mediaKind === "video" ? "video/*" : "image/*"}
                  disabled={busy || uploading}
                  onChange={(event) => void onMediaUpload(event.target.files?.[0])}
                />
                {draft.mediaUrl ? (
                  <code className="promo-admin-media-url">{draft.mediaUrl.split("/").pop()}</code>
                ) : null}
              </label>
            ) : (
              <p className="promo-admin-schedule-hint">
                Text only. On the homepage hero, the main product image comes from the hero layout, not this banner.
              </p>
            )}
          </div>

          <div className="promo-admin-section">
            <h3>Offer animation</h3>
            <div className="promo-admin-chip-row" role="group" aria-label="Presentation mode">
              {(
                [
                  { value: "sequence", label: "Animated sequence" },
                  { value: "static", label: "Static strip" },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`promo-admin-chip${draft.presentation === option.value ? " is-active" : ""}`}
                  onClick={() => updateDraft({ presentation: option.value })}
                  disabled={busy}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {draft.presentation === "sequence" ? (
              <>
                <label className="promo-admin-field">
                  <span>Frame transition</span>
                  <select
                    value={draft.sequenceTransition}
                    onChange={(event) =>
                      updateDraft({ sequenceTransition: event.target.value as PromoSequenceTransition })
                    }
                    disabled={busy}
                  >
                    {PROMO_TRANSITION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="promo-admin-toggle">
                  <input
                    type="checkbox"
                    checked={draft.sequenceLoop}
                    onChange={(event) => updateDraft({ sequenceLoop: event.target.checked })}
                    disabled={busy}
                  />
                  <span>Loop sequence</span>
                </label>
                <div className="promo-admin-frame-toolbar">
                  <span className="promo-admin-frame-toolbar-label">Sequence frames</span>
                  <button type="button" className="button secondary" disabled={busy} onClick={resetFrames}>
                    Reset default
                  </button>
                  <button type="button" className="button secondary" disabled={busy} onClick={addFrame}>
                    Add frame
                  </button>
                </div>
                <div className="promo-admin-frame-list">
                  {draft.frames.map((frame, index) => (
                    <div key={frame.id} className="promo-admin-frame-card">
                      <div className="promo-admin-frame-head">
                        <strong>
                          Frame {index + 1}: {PROMO_FRAME_KIND_LABELS[frame.kind]}
                        </strong>
                        <button
                          type="button"
                          className="button secondary"
                          disabled={busy || draft.frames.length <= 1}
                          onClick={() => removeFrame(index)}
                        >
                          Remove
                        </button>
                      </div>
                      <div className="promo-admin-row">
                        <label className="promo-admin-field">
                          <span>Type</span>
                          <select
                            value={frame.kind}
                            onChange={(event) =>
                              updateFrame(index, { kind: event.target.value as PromoFrameKind })
                            }
                            disabled={busy}
                          >
                            {Object.entries(PROMO_FRAME_KIND_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="promo-admin-field">
                          <span>Duration (ms)</span>
                          <input
                            type="number"
                            min={400}
                            max={30000}
                            step={100}
                            value={frame.durationMs}
                            onChange={(event) =>
                              updateFrame(index, { durationMs: Number(event.target.value) || 2400 })
                            }
                            disabled={busy}
                          />
                        </label>
                      </div>
                      {frame.kind === "title-media" ? (
                        <label className="promo-admin-field">
                          <span>Title size ({frame.titleSizeRem?.toFixed(2) ?? "1.18"}rem)</span>
                          <input
                            type="range"
                            min={0.7}
                            max={2.4}
                            step={0.02}
                            value={frame.titleSizeRem ?? 1.18}
                            onChange={(event) =>
                              updateFrame(index, { titleSizeRem: Number(event.target.value) })
                            }
                            disabled={busy}
                          />
                        </label>
                      ) : null}
                      {frame.kind === "title-media" ? (
                        <label className="promo-admin-field">
                          <span>Image scale ({frame.mediaScale?.toFixed(1) ?? "3"}×)</span>
                          <input
                            type="range"
                            min={1}
                            max={5}
                            step={0.1}
                            value={frame.mediaScale ?? 3}
                            onChange={(event) =>
                              updateFrame(index, { mediaScale: Number(event.target.value) })
                            }
                            disabled={busy}
                          />
                        </label>
                      ) : null}
                      {frame.kind === "marquee" ? (
                        <label className="promo-admin-field">
                          <span>Message size ({frame.bodySizeRem?.toFixed(2) ?? "0.96"}rem)</span>
                          <input
                            type="range"
                            min={0.65}
                            max={1.8}
                            step={0.02}
                            value={frame.bodySizeRem ?? 0.96}
                            onChange={(event) =>
                              updateFrame(index, { bodySizeRem: Number(event.target.value) })
                            }
                            disabled={busy}
                          />
                        </label>
                      ) : null}
                      {frame.kind === "cta" ? (
                        <label className="promo-admin-field">
                          <span>Button scale ({frame.ctaScale?.toFixed(2) ?? "1.00"}×)</span>
                          <input
                            type="range"
                            min={0.7}
                            max={1.8}
                            step={0.02}
                            value={frame.ctaScale ?? 1}
                            onChange={(event) =>
                              updateFrame(index, { ctaScale: Number(event.target.value) })
                            }
                            disabled={busy}
                          />
                        </label>
                      ) : null}
                    </div>
                  ))}
                </div>
                <p className="promo-admin-schedule-hint">
                  Frames use the headline, message, media, and CTA from Content unless you override them per frame.
                  Default order: empty strip, title + image, scrolling message, then button.
                </p>
              </>
            ) : (
              <div className="promo-admin-animation-grid">
                {animationOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`promo-admin-animation${draft.animation === option.value ? " is-active" : ""}`}
                    onClick={() => updateDraft({ animation: option.value })}
                    disabled={busy}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.hint}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="promo-admin-section">
            <h3>Strip appearance</h3>
            <div className="promo-admin-row">
              <label className="promo-admin-field">
                <span>Background color</span>
                <input
                  type="color"
                  value={
                    /^#[0-9a-f]{6}$/i.test(draft.stripBackground)
                      ? draft.stripBackground
                      : PROMO_STRIP_DEFAULTS.stripBackground
                  }
                  onChange={(event) => updateDraft({ stripBackground: event.target.value })}
                  disabled={busy}
                />
              </label>
              <label className="promo-admin-field">
                <span>Strip height ({draft.stripHeightPx}px)</span>
                <input
                  type="range"
                  min={48}
                  max={160}
                  step={1}
                  value={draft.stripHeightPx}
                  onChange={(event) => updateDraft({ stripHeightPx: Number(event.target.value) })}
                  disabled={busy}
                />
              </label>
            </div>
            <label className="promo-admin-field">
              <span>Strip opacity ({draft.stripOpacity.toFixed(2)})</span>
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.01}
                value={draft.stripOpacity}
                onChange={(event) => updateDraft({ stripOpacity: Number(event.target.value) })}
                disabled={busy}
              />
            </label>
            <label className="promo-admin-field">
              <span>Gift / media offset ({draft.mediaOffsetXCm.toFixed(1)}cm right)</span>
              <input
                type="range"
                min={-10}
                max={20}
                step={0.1}
                value={draft.mediaOffsetXCm}
                onChange={(event) => updateDraft({ mediaOffsetXCm: Number(event.target.value) })}
                disabled={busy}
              />
            </label>
            <label className="promo-admin-toggle">
              <input
                type="checkbox"
                checked={draft.marqueeForceScroll}
                onChange={(event) => updateDraft({ marqueeForceScroll: event.target.checked })}
                disabled={busy}
              />
              <span>Always scroll message (even when it fits)</span>
            </label>
            <label className="promo-admin-field">
              <span>
                Hero marquee start ({draft.heroMarqueeStartOffsetCm.toFixed(1)}cm from product right)
              </span>
              <input
                type="range"
                min={-5}
                max={25}
                step={0.1}
                value={draft.heroMarqueeStartOffsetCm}
                onChange={(event) =>
                  updateDraft({ heroMarqueeStartOffsetCm: Number(event.target.value) })
                }
                disabled={busy}
              />
            </label>
            <label className="promo-admin-field">
              <span>Hero marquee start fine-tune ({draft.heroMarqueeStartOffsetPx}px)</span>
              <input
                type="range"
                min={-600}
                max={600}
                step={1}
                value={draft.heroMarqueeStartOffsetPx}
                onChange={(event) =>
                  updateDraft({ heroMarqueeStartOffsetPx: Number(event.target.value) })
                }
                disabled={busy}
              />
            </label>
            <p className="promo-admin-schedule-hint">
              Opacity applies to the strip backdrop only. Set to 1.00 for a fully solid bar. Marquee
              start controls apply on the homepage hero strip only.
            </p>
          </div>

          <div className="promo-admin-section">
            <h3>Call to action</h3>
            <div className="promo-admin-row">
              <label className="promo-admin-field">
                <span>Button label</span>
                <input
                  placeholder="Shop now"
                  value={draft.ctaLabel}
                  onChange={(event) => updateDraft({ ctaLabel: event.target.value })}
                  disabled={busy}
                />
              </label>
              <label className="promo-admin-field">
                <span>Link URL</span>
                <input
                  placeholder="/shop or https://…"
                  value={draft.ctaHref}
                  onChange={(event) => updateDraft({ ctaHref: event.target.value })}
                  disabled={busy}
                />
              </label>
            </div>
          </div>

          <div className="promo-admin-section">
            <h3>CTA buy links</h3>
            <p className="promo-admin-schedule-hint">
              Three product links on each side of the main CTA button. They appear together on the CTA sequence step.
              Each link needs an image and URL.
            </p>
            <div className="promo-admin-buy-link-groups">
              {(
                [
                  { side: "left" as const, title: "Left of CTA", links: buyLinkGroups.left },
                  { side: "right" as const, title: "Right of CTA", links: buyLinkGroups.right },
                ] as const
              ).map((group) => (
                <div key={group.side} className="promo-admin-buy-link-group">
                  <h4>{group.title}</h4>
                  <div className="promo-admin-buy-link-list">
                    {group.links.map((link, index) => (
                      <div key={link.id} className="promo-admin-buy-link-card">
                        <strong>Link {index + 1}</strong>
                        <label className="promo-admin-field">
                          <span>Product image</span>
                          <div className="promo-admin-buy-link-image-row">
                            {link.imageUrl ? (
                              <span
                                className="promo-admin-buy-link-thumb"
                                style={{ backgroundImage: `url(${link.imageUrl})` }}
                                aria-hidden
                              />
                            ) : null}
                            <button
                              type="button"
                              className="button secondary promo-admin-catalog-browse"
                              disabled={busy || uploading}
                              onClick={() => setCatalogPickerLinkId(link.id)}
                            >
                              Browse catalog
                            </button>
                            {link.imageUrl ? (
                              <button
                                type="button"
                                className="button secondary promo-admin-buy-link-clear"
                                disabled={busy}
                                onClick={() => updateBuyLink(link.id, { imageUrl: "" })}
                              >
                                Clear
                              </button>
                            ) : null}
                          </div>
                          {link.imageUrl ? (
                            <code className="promo-admin-media-url">{link.imageUrl.split("/").pop()}</code>
                          ) : null}
                        </label>
                        <label className="promo-admin-field">
                          <span>Name line</span>
                          <input
                            placeholder="Aloe Vera Hibiscus"
                            value={link.label ?? ""}
                            onChange={(event) => updateBuyLink(link.id, { label: event.target.value })}
                            disabled={busy}
                          />
                        </label>
                        <label className="promo-admin-field">
                          <span>Type line</span>
                          <input
                            placeholder="Conditioner"
                            value={link.subtitleLabel ?? ""}
                            onChange={(event) => updateBuyLink(link.id, { subtitleLabel: event.target.value })}
                            disabled={busy}
                          />
                        </label>
                        <label className="promo-admin-field">
                          <span>Price line</span>
                          <input
                            placeholder="Rs755"
                            value={link.priceLabel ?? ""}
                            onChange={(event) => updateBuyLink(link.id, { priceLabel: event.target.value })}
                            disabled={busy}
                          />
                        </label>
                        <label className="promo-admin-field">
                          <span>Buy URL</span>
                          <input
                            placeholder="/shop/…"
                            value={link.href}
                            onChange={(event) => updateBuyLink(link.id, { href: event.target.value })}
                            disabled={busy}
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="promo-admin-section">
            <h3>Schedule</h3>
            <div className="promo-admin-row">
              <label className="promo-admin-field">
                <span>Starts</span>
                <input
                  type="datetime-local"
                  value={draft.startsAt}
                  onChange={(event) => updateDraft({ startsAt: event.target.value })}
                  disabled={busy}
                />
              </label>
              <label className="promo-admin-field">
                <span>Ends</span>
                <input
                  type="datetime-local"
                  value={draft.endsAt}
                  onChange={(event) => updateDraft({ endsAt: event.target.value })}
                  disabled={busy}
                />
              </label>
            </div>
            <label className="promo-admin-toggle">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(event) => updateDraft({ active: event.target.checked })}
                disabled={busy}
              />
              <span>Active on site</span>
            </label>
            <p className="promo-admin-schedule-hint">
              Use Publish now to go live immediately and clear any schedule. Future start dates keep a banner saved but hidden until then.
            </p>
          </div>

          <div className="promo-admin-actions">
            <button
              type="button"
              className={`button primary button-sage${publishSucceeded ? " process-success" : ""}`}
              disabled={busy || uploading}
              onClick={() => void saveBanner("publish")}
            >
              {busy ? "Saving…" : publishSucceeded ? "Published!" : "Publish now"}
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={busy || uploading}
              onClick={() => void saveBanner("draft")}
            >
              Save draft
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={busy || !editingId}
              onClick={() => void saveBanner("unpublish")}
            >
              Unpublish
            </button>
            {editingId ? (
              <button type="button" className="button secondary" disabled={busy} onClick={resetForm}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </section>

        <PromoBannerHomePreview
          stack={previewStack}
          draftStatus={draftStatus}
          scheduleLabel={scheduleLabel}
          isUnsaved={dirty}
        />
      </div>

      <MaromaCatalogPicker
        open={catalogPickerLinkId !== null}
        onClose={() => setCatalogPickerLinkId(null)}
        title="Choose product for buy link"
        onSelect={(product) => {
          if (!catalogPickerLinkId) return;
          updateBuyLink(catalogPickerLinkId, catalogProductToBuyLinkFields(product));
          onStatus(`Selected ${catalogProductToBuyLinkFields(product).label}.`);
        }}
      />
    </div>
  );
}
