"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  PROMO_FRAME_FADE_MS_DEFAULT,
  PROMO_FRAME_KIND_HINTS,
  PROMO_FRAME_KIND_LABELS,
  PROMO_SEQUENCE_FADE_MS_DEFAULT,
} from "../../lib/promo-sequence-utils";
import {
  buildPreviewBannerStack,
  derivePromoNameFromCopy,
  formatScheduleLabel,
  isPromoLiveClient,
  promoVisibilityStatus,
  resolvePromoAdminName,
  toDatetimeLocalValue,
  toIsoScheduleValue,
} from "../../lib/promo-client-utils";
import { PROMO_STRIP_DEFAULTS, normalizePromoStripFields, promoStripStyleVars, promoStripBannerClass, PROMO_STRIP_HEIGHT_MAX, PROMO_STRIP_HEIGHT_MIN, PROMO_STRIP_ASPECT_21_9, PROMO_STRIP_POSITION_CM_MIN, PROMO_STRIP_POSITION_CM_MAX, PROMO_STRIP_POSITION_PX_MIN, PROMO_STRIP_POSITION_PX_MAX } from "../../lib/promo-strip-utils";
import { PromoBannerHomePreview } from "./PromoBannerHomePreview";
import {
  catalogProductToBuyLinkFields,
  MaromaCatalogPicker,
  type MaromaCatalogPickerProduct,
} from "./MaromaCatalogPicker";

const emptyDraft = () => ({
  adminName: "",
  title: "",
  body: "",
  mediaUrl: "",
  mediaKind: "none" as PromoMediaKind,
  animation: "marquee" as PromoAnimation,
  presentation: "sequence" as PromoPresentation,
  sequenceTransition: "crossfade" as PromoSequenceTransition,
  sequenceFadeDurationMs: PROMO_SEQUENCE_FADE_MS_DEFAULT,
  sequenceLoop: false,
  frames: buildDefaultPromoFrames(),
  ctaLabel: "",
  ctaHref: "",
  ctaBuyLinks: buildDefaultCtaBuyLinks(),
  ...normalizePromoStripFields({}),
  startsAt: "",
  endsAt: "",
  active: true,
  promoModeEnabled: true,
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

const STRIP_BG_IMAGE_MAX_BYTES = 12 * 1024 * 1024;
const STRIP_BG_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const STRIP_BG_CLIENT_UPLOAD_MIN_BYTES = 4 * 1024 * 1024;

async function uploadStripBackgroundFile(
  file: File,
  mediaKind: "image" | "video"
): Promise<string> {
  const maxBytes = mediaKind === "video" ? STRIP_BG_VIDEO_MAX_BYTES : STRIP_BG_IMAGE_MAX_BYTES;
  if (file.size > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    throw new Error(`File is too large. Strip ${mediaKind}s must be under ${maxMb}MB.`);
  }

  const useClientUpload = mediaKind === "video" || file.size > STRIP_BG_CLIENT_UPLOAD_MIN_BYTES;
  if (useClientUpload) {
    const { uploadFileToFirebase } = await import("../../lib/client-firebase-upload");
    return uploadFileToFirebase(file, "admin-promo-strip-bg");
  }

  const form = new FormData();
  form.append("file", file);
  form.append("mediaKind", mediaKind);
  const res = await fetch("/api/promo-strip-background/upload", {
    method: "POST",
    body: form,
    credentials: "same-origin",
  });
  const data = (await res.json()) as { url?: string; error?: string; mediaKind?: "image" | "video" };
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

const FRAME_VISUAL_KIND_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "image", label: "Image" },
  { value: "title-media", label: "Text & Image" },
] as const;

type FrameVisualKind = (typeof FRAME_VISUAL_KIND_OPTIONS)[number]["value"];

function isFrameVisualKind(kind: PromoFrameKind): kind is FrameVisualKind {
  return kind === "text" || kind === "image" || kind === "title-media";
}

type CatalogPickerTarget =
  | { mode: "buy-link"; linkId: string }
  | { mode: "banner-media" }
  | { mode: "strip-bg" }
  | { mode: "frame-media"; frameIndex: number };

type PromoBannerAdminPanelProps = {
  banners: PromoBanner[];
  onRefresh: () => Promise<void>;
  onStatus: (message: string) => void;
  publishSucceeded?: boolean;
  onPublishSucceeded?: () => void;
};

export function PromoBannerAdminPanel({
  banners,
  onRefresh,
  onStatus,
  publishSucceeded = false,
  onPublishSucceeded,
}: PromoBannerAdminPanelProps) {
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stripBgUploadingKind, setStripBgUploadingKind] = useState<"image" | "video" | null>(null);
  const [stripBgLoadedKind, setStripBgLoadedKind] = useState<"image" | "video" | null>(null);
  const [dirty, setDirty] = useState(false);
  const [createSucceeded, setCreateSucceeded] = useState(false);
  const [catalogPickerTarget, setCatalogPickerTarget] = useState<CatalogPickerTarget | null>(null);
  const autoloadedRef = useRef(false);
  const editorRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!createSucceeded) return;
    const timer = window.setTimeout(() => setCreateSucceeded(false), 8000);
    return () => window.clearTimeout(timer);
  }, [createSucceeded]);

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
      adminName: banner.adminName,
      title: banner.title,
      body: banner.body,
      mediaUrl: banner.mediaUrl,
      mediaKind: banner.mediaKind,
      animation: banner.animation,
      presentation: banner.presentation,
      sequenceTransition: banner.sequenceTransition,
      sequenceFadeDurationMs: banner.sequenceFadeDurationMs ?? PROMO_SEQUENCE_FADE_MS_DEFAULT,
      sequenceLoop: banner.sequenceLoop,
      frames: banner.frames,
      ctaLabel: banner.ctaLabel,
      ctaHref: banner.ctaHref,
      ctaBuyLinks: banner.ctaBuyLinks,
      stripBackground: strip.stripBackground,
      stripBackgroundImageUrl: strip.stripBackgroundImageUrl,
      stripBackgroundMediaKind: strip.stripBackgroundMediaKind,
      stripBackgroundVideoLoop: strip.stripBackgroundVideoLoop,
      stripBackgroundFallbackImageUrl: strip.stripBackgroundFallbackImageUrl,
      stripBackgroundImageScale: strip.stripBackgroundImageScale,
      stripBackgroundImageOffsetX: strip.stripBackgroundImageOffsetX,
      stripBackgroundImageOffsetY: strip.stripBackgroundImageOffsetY,
      stripHeightPx: strip.stripHeightPx,
      stripPositionOffsetCm: strip.stripPositionOffsetCm,
      stripPositionOffsetPx: strip.stripPositionOffsetPx,
      stripAspectRatio: strip.stripAspectRatio,
      stripOpacity: strip.stripOpacity,
      mediaOffsetXCm: strip.mediaOffsetXCm,
      marqueeForceScroll: strip.marqueeForceScroll,
      heroMarqueeStartOffsetCm: strip.heroMarqueeStartOffsetCm,
      heroMarqueeStartOffsetPx: strip.heroMarqueeStartOffsetPx,
      heroMarqueeEndOffsetCm: strip.heroMarqueeEndOffsetCm,
      heroMarqueeEndOffsetPx: strip.heroMarqueeEndOffsetPx,
      publishNow: true,
    };
  };

  const unpublishBanner = async (banner: PromoBanner) => {
    setBusy(true);
    try {
      await postPromos({ unpublishId: banner.id });
      onStatus(`"${resolvePromoAdminName(banner)}" unpublished.`);
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
      onStatus(`"${resolvePromoAdminName(banner)}" is now live on site.`);
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
        <button
          type="button"
          className="button secondary promo-admin-edit-btn"
          disabled={busy}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            loadBanner(banner);
          }}
        >
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
          <button
            type="button"
            className="button secondary promo-admin-unpublish-btn"
            disabled={busy}
            onClick={() => void unpublishBanner(banner)}
          >
            Unpublish
          </button>
        ) : null}
        <button
          type="button"
          className="button secondary promo-admin-delete-btn"
          disabled={busy}
          onClick={() => void deleteBanner(banner.id)}
        >
          Delete
        </button>
      </div>
    );
  };

  const resetForm = () => {
    setDraft(emptyDraft());
    setEditingId(null);
    setDirty(false);
    setCreateSucceeded(false);
    setStripBgLoadedKind(null);
    setStripBgUploadingKind(null);
    onStatus("New banner. Strip background and other fields reset.");
  };

  const syncStripBgLoadedKind = (strip: ReturnType<typeof normalizePromoStripFields>) => {
    if (!strip.stripBackgroundImageUrl) {
      setStripBgLoadedKind(null);
      return;
    }
    setStripBgLoadedKind(strip.stripBackgroundMediaKind === "video" ? "video" : "image");
  };

  const loadBanner = (banner: PromoBanner) => {
    const strip = normalizePromoStripFields(banner);
    setEditingId(banner.id);
    setDraft({
      adminName: banner.adminName ?? "",
      title: banner.title,
      body: banner.body,
      mediaUrl: banner.mediaUrl,
      mediaKind: banner.mediaKind,
      animation: banner.animation,
      presentation: banner.presentation,
      sequenceTransition: banner.sequenceTransition,
      sequenceFadeDurationMs: banner.sequenceFadeDurationMs ?? PROMO_SEQUENCE_FADE_MS_DEFAULT,
      sequenceLoop: banner.sequenceLoop,
      frames: banner.frames,
      ctaLabel: banner.ctaLabel,
      ctaHref: banner.ctaHref,
      ctaBuyLinks: normalizeCtaBuyLinks(banner.ctaBuyLinks),
      ...strip,
      startsAt: toDatetimeLocalValue(banner.startsAt),
      endsAt: toDatetimeLocalValue(banner.endsAt),
      active: banner.active,
      promoModeEnabled: banner.promoModeEnabled !== false,
    });
    setDirty(false);
    syncStripBgLoadedKind(strip);
    onStatus(`Editing "${resolvePromoAdminName(banner)}".`);
    window.requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  useEffect(() => {
    if (autoloadedRef.current || editingId || dirty || banners.length === 0) return;
    const live = banners.find((banner) => isPromoLiveClient(banner)) ?? banners[0];
    if (!live) return;
    autoloadedRef.current = true;
    loadBanner(live);
  }, [banners, dirty, editingId]);

  const applySavedBanner = (banner: PromoBanner) => {
    const strip = normalizePromoStripFields(banner);
    setEditingId(banner.id);
    setDraft({
      adminName: banner.adminName ?? "",
      title: banner.title,
      body: banner.body,
      mediaUrl: banner.mediaUrl,
      mediaKind: banner.mediaKind,
      animation: banner.animation,
      presentation: banner.presentation,
      sequenceTransition: banner.sequenceTransition,
      sequenceFadeDurationMs: banner.sequenceFadeDurationMs ?? PROMO_SEQUENCE_FADE_MS_DEFAULT,
      sequenceLoop: banner.sequenceLoop,
      frames: banner.frames,
      ctaLabel: banner.ctaLabel,
      ctaHref: banner.ctaHref,
      ctaBuyLinks: normalizeCtaBuyLinks(banner.ctaBuyLinks),
      ...strip,
      startsAt: toDatetimeLocalValue(banner.startsAt),
      endsAt: toDatetimeLocalValue(banner.endsAt),
      active: banner.active,
      promoModeEnabled: banner.promoModeEnabled !== false,
    });
    setDirty(false);
    syncStripBgLoadedKind(strip);
  };

  const resolveAdminName = () => {
    const name = draft.adminName.trim();
    if (name) return name.slice(0, 80);
    // Borrow the headline instead of saving a placeholder name.
    return derivePromoNameFromCopy(draft);
  };

  const buildPayload = (mode: SaveMode) => {
    const base = {
      id: editingId ?? undefined,
      adminName: resolveAdminName(),
      title: draft.title.trim(),
      body: draft.body,
      mediaUrl: draft.mediaUrl,
      mediaKind: draft.mediaKind,
      animation: draft.animation,
      presentation: draft.presentation,
      sequenceTransition: draft.sequenceTransition,
      sequenceFadeDurationMs: draft.sequenceFadeDurationMs,
      sequenceLoop: draft.sequenceLoop,
      frames: draft.frames,
      ctaLabel: draft.ctaLabel,
      ctaHref: draft.ctaHref,
      ctaBuyLinks: draft.ctaBuyLinks,
      stripBackground: draft.stripBackground,
      stripBackgroundImageUrl: draft.stripBackgroundImageUrl,
      stripBackgroundMediaKind: draft.stripBackgroundMediaKind,
      stripBackgroundVideoLoop: draft.stripBackgroundVideoLoop,
      stripBackgroundFallbackImageUrl: draft.stripBackgroundFallbackImageUrl,
      stripBackgroundImageScale: draft.stripBackgroundImageScale,
      stripBackgroundImageOffsetX: draft.stripBackgroundImageOffsetX,
      stripBackgroundImageOffsetY: draft.stripBackgroundImageOffsetY,
      stripHeightPx: draft.stripHeightPx,
      stripPositionOffsetCm: draft.stripPositionOffsetCm,
      stripPositionOffsetPx: draft.stripPositionOffsetPx,
      stripAspectRatio: draft.stripAspectRatio,
      stripOpacity: draft.stripOpacity,
      mediaOffsetXCm: draft.mediaOffsetXCm,
      marqueeForceScroll: draft.marqueeForceScroll,
      heroMarqueeStartOffsetCm: draft.heroMarqueeStartOffsetCm,
      heroMarqueeStartOffsetPx: draft.heroMarqueeStartOffsetPx,
      heroMarqueeEndOffsetCm: draft.heroMarqueeEndOffsetCm,
      heroMarqueeEndOffsetPx: draft.heroMarqueeEndOffsetPx,
      promoModeEnabled: draft.promoModeEnabled,
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
    }

    setBusy(true);
    onStatus("");
    const wasNew = !editingId;
    try {
      const data = await postPromos(buildPayload(mode));
      if (mode === "unpublish") {
        onStatus("Banner unpublished (hidden on site).");
        setDraft((current) => ({ ...current, active: false }));
        setDirty(false);
      } else if (data.banner) {
        applySavedBanner(data.banner);
        if (wasNew) {
          setCreateSucceeded(true);
        }
        if (mode === "publish") {
          onPublishSucceeded?.();
          onStatus("Published!");
        } else {
          onStatus(editingId ? "Draft saved." : "Banner saved as draft.");
        }
      } else {
        if (wasNew) {
          setCreateSucceeded(true);
        }
        if (mode === "publish") {
          onPublishSucceeded?.();
          onStatus("Published!");
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

  const onStripBgUpload = async (
    file: File | undefined,
    mediaKind: "image" | "video",
    input?: HTMLInputElement | null
  ) => {
    if (!file) return;
    setUploading(true);
    setStripBgUploadingKind(mediaKind);
    setStripBgLoadedKind(null);
    onStatus("");
    try {
      const url = await uploadStripBackgroundFile(file, mediaKind);
      updateDraft({
        stripBackgroundImageUrl: url,
        stripBackgroundMediaKind: mediaKind,
        ...(mediaKind === "video" ? { stripAspectRatio: PROMO_STRIP_ASPECT_21_9 } : {}),
      });
      setStripBgLoadedKind(mediaKind);
      onStatus(`Strip background ${mediaKind} uploaded.`);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
      setStripBgUploadingKind(null);
      if (input) input.value = "";
    }
  };

  const onStripFallbackUpload = async (
    file: File | undefined,
    input?: HTMLInputElement | null
  ) => {
    if (!file) return;
    setUploading(true);
    onStatus("");
    try {
      const url = await uploadStripBackgroundFile(file, "image");
      updateDraft({ stripBackgroundFallbackImageUrl: url });
      onStatus("Fallback banner image uploaded.");
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Fallback image upload failed.");
    } finally {
      setUploading(false);
      if (input) input.value = "";
    }
  };

  const stripBgButtonLabel = (kind: "image" | "video", defaultLabel: string) => {
    if (stripBgUploadingKind === kind) return "Uploading…";
    if (stripBgLoadedKind === kind) return "Loaded";
    return defaultLabel;
  };

  const updateDraft = (patch: Partial<ReturnType<typeof emptyDraft>>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
  };

  const updateFrame = (index: number, patch: Partial<PromoFrame>) => {
    setDraft((current) => ({
      ...current,
      frames: current.frames.map((frame, frameIndex) =>
        frameIndex === index ? { ...frame, ...patch } : frame
      ),
    }));
    setDirty(true);
  };

  const setFrameVisualKind = (index: number, kind: FrameVisualKind) => {
    const current = draft.frames[index];
    updateFrame(index, { kind });
    if ((kind === "image" || kind === "title-media") && !current?.mediaUrl?.trim()) {
      setCatalogPickerTarget({ mode: "frame-media", frameIndex: index });
    }
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
          fadeInMs: PROMO_FRAME_FADE_MS_DEFAULT,
          fadeOutMs: PROMO_FRAME_FADE_MS_DEFAULT,
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
    updateDraft({ presentation: "sequence", frames: buildDefaultPromoFrames() });
  };

  const updateBuyLink = (id: string, patch: Partial<PromoCtaBuyLink>) => {
    setDraft((current) => ({
      ...current,
      ctaBuyLinks: current.ctaBuyLinks.map((link) => (link.id === id ? { ...link, ...patch } : link)),
    }));
    setDirty(true);
  };

  const applyBuyLinkProducts = (products: MaromaCatalogPickerProduct[], startLinkId: string) => {
    if (products.length === 0) return;

    setDraft((current) => {
      const links = normalizeCtaBuyLinks(current.ctaBuyLinks);
      const startIndex = Math.max(0, links.findIndex((link) => link.id === startLinkId));

      const nextLinks = links.map((link, index) => {
        const productIndex = index - startIndex;
        if (productIndex < 0 || productIndex >= products.length) {
          return link;
        }
        return {
          ...link,
          ...catalogProductToBuyLinkFields(products[productIndex]!),
        };
      });

      return { ...current, ctaBuyLinks: nextLinks };
    });
    setDirty(true);

    const labels = products.map((product) => catalogProductToBuyLinkFields(product).label).filter(Boolean);
    onStatus(
      products.length === 1
        ? `Selected ${labels[0] ?? "product"}.`
        : `Added ${products.length} products to buy links.`
    );
  };

  const buyLinkGroups = splitCtaBuyLinks(draft.ctaBuyLinks);

  const buyLinkPickerMaxSelection = useMemo(() => {
    if (catalogPickerTarget?.mode !== "buy-link") return 6;
    const links = normalizeCtaBuyLinks(draft.ctaBuyLinks);
    const startIndex = Math.max(0, links.findIndex((link) => link.id === catalogPickerTarget.linkId));
    return Math.max(1, links.length - startIndex);
  }, [catalogPickerTarget, draft.ctaBuyLinks]);

  return (
    <div className="promo-admin">
      <header className="promo-admin-head">
        <div>
          <h2 className="promo-admin-title">Homepage banners</h2>
          <p className="promo-admin-lead">
            Banners sit in the homepage hero below the headline and behind the main product image.
          </p>
        </div>
        <button
          type="button"
          className={`button secondary${createSucceeded ? " process-success promo-create-success" : ""}`}
          onClick={resetForm}
          disabled={busy && !createSucceeded}
          style={
            createSucceeded
              ? {
                  background: "#22c55e",
                  borderColor: "#16a34a",
                  color: "#fff",
                  opacity: 1,
                  boxShadow: "0 0 0 2px rgba(34, 197, 94, 0.45)",
                }
              : undefined
          }
        >
          {createSucceeded ? "Banner Created!" : "New banner"}
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
                  <strong>{resolvePromoAdminName(banner)}</strong>
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
                  <strong>{resolvePromoAdminName(banner)}</strong>
                  <div className="promo-admin-list-meta">{renderBannerMeta(banner)}</div>
                </div>
                {renderBannerActions(banner)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="promo-admin-layout">
        <section ref={editorRef} className="promo-admin-form" aria-label="Banner editor">
          {editingId ? (
            <p className="promo-admin-editing-note">
              Editing <strong>{resolvePromoAdminName(draft)}</strong>
            </p>
          ) : (
            <p className="promo-admin-editing-note">New banner. Click Edit on a live card to load it here.</p>
          )}
          <div className="promo-admin-section">
            <h3>Banner name</h3>
            <p className="promo-admin-schedule-hint">
              Saved label for this banner in admin lists. Not shown on the homepage strip.
            </p>
            <label className="promo-admin-field">
              <span>Name</span>
              <input
                placeholder="e.g. Summer hero video"
                value={draft.adminName}
                onChange={(event) => updateDraft({ adminName: event.target.value })}
                disabled={busy}
              />
            </label>
          </div>
          <div className="promo-admin-section">
            <h3>Content</h3>
            <p className="promo-admin-schedule-hint">
              Headline is the big line for Text only and Title + image frames. Scrolling copy lives on the
              Scrolling message frame below.
            </p>
            <label className="promo-admin-field">
              <span>Headline</span>
              <input
                placeholder="e.g. Free shipping over ₹2,000"
                value={draft.title}
                onChange={(event) => updateDraft({ title: event.target.value })}
                disabled={busy}
              />
            </label>
          </div>

          <div className="promo-admin-section">
            <h3>Media</h3>
            <p className="promo-admin-schedule-hint">
              Pick a catalog image here to use it in Image only, Text &amp; image, and Title + image frames on
              the homepage strip.
            </p>
            <div className="promo-admin-chip-row" role="group" aria-label="Media type">
              {(
                [
                  { value: "none", label: "Text only" },
                  { value: "title-media", label: "Text & Image" },
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
            {draft.mediaKind === "video" ? (
              <label className="promo-admin-field promo-admin-upload">
                <span>Video file</span>
                <input
                  type="file"
                  accept="video/*"
                  disabled={busy || uploading}
                  onChange={(event) => void onMediaUpload(event.target.files?.[0])}
                />
                {draft.mediaUrl ? (
                  <code className="promo-admin-media-url">{draft.mediaUrl.split("/").pop()}</code>
                ) : null}
              </label>
            ) : draft.mediaKind === "image" || draft.mediaKind === "title-media" ? (
              <div className="promo-admin-field">
                <span>Catalog image</span>
                <div className="promo-admin-buy-link-image-row">
                  {draft.mediaUrl ? (
                    <span
                      className="promo-admin-buy-link-thumb"
                      style={{ backgroundImage: `url(${draft.mediaUrl})` }}
                      aria-hidden
                    />
                  ) : null}
                  <button
                    type="button"
                    className="button secondary promo-admin-catalog-browse"
                    disabled={busy}
                    onClick={() => setCatalogPickerTarget({ mode: "banner-media" })}
                  >
                    Browse catalog
                  </button>
                  {draft.mediaUrl ? (
                    <button
                      type="button"
                      className="button secondary promo-admin-buy-link-clear"
                      disabled={busy}
                      onClick={() => updateDraft({ mediaUrl: "" })}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
                {draft.mediaUrl ? (
                  <code className="promo-admin-media-url">{draft.mediaUrl.split("/").pop()}</code>
                ) : (
                  <span className="promo-admin-schedule-hint">
                    Pick a product image from the Maroma catalog.
                  </span>
                )}
              </div>
            ) : (
              <p className="promo-admin-schedule-hint">
                Text only skips a product still in the strip. Image frames will stay empty unless you pick a
                catalog image on the frame itself.
              </p>
            )}
          </div>

          <div className="promo-admin-section">
            <details className="promo-admin-collapse">
              <summary className="promo-admin-collapse-summary">
                <span className="promo-admin-collapse-title">
                  <strong>Offer animation</strong>
                </span>
              </summary>
              <div className="promo-admin-collapse-body">
            <p className="promo-admin-schedule-hint">
              The homepage strip plays these frames in order. Set duration, fade in, and fade out on each
              frame, then Publish and press Start anim in the preview.
            </p>
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
                <p>Sequence plays once and holds the last frame.</p>
                <div className="promo-admin-timing-list">
                  {draft.frames.map((frame, index) => (
                    <details key={frame.id} className="promo-admin-collapse promo-admin-timing-card">
                      <summary className="promo-admin-collapse-summary promo-admin-timing-head">
                        <span className="promo-admin-collapse-title">
                          <strong>Frame {index + 1}</strong>
                        </span>
                        {isFrameVisualKind(frame.kind) ? (
                          <label
                            className="promo-admin-field promo-admin-timing-type"
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <span>Content</span>
                            <select
                              value={frame.kind}
                              onChange={(event) =>
                                setFrameVisualKind(index, event.target.value as FrameVisualKind)
                              }
                              disabled={busy}
                            >
                              {FRAME_VISUAL_KIND_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : (
                          <span className="promo-admin-timing-kind">
                            {PROMO_FRAME_KIND_LABELS[frame.kind]}
                          </span>
                        )}
                      </summary>
                      <div className="promo-admin-collapse-body">
                      {isFrameVisualKind(frame.kind) &&
                      (frame.kind === "text" || frame.kind === "title-media") ? (
                        <label className="promo-admin-field">
                          <span>Text</span>
                          <textarea
                            rows={2}
                            placeholder="Headline for this frame"
                            value={frame.title ?? ""}
                            onChange={(event) => updateFrame(index, { title: event.target.value })}
                            disabled={busy}
                          />
                        </label>
                      ) : null}
                      {isFrameVisualKind(frame.kind) &&
                      (frame.kind === "image" || frame.kind === "title-media") ? (
                        <div className="promo-admin-field">
                          <span>Catalog image</span>
                          <div className="promo-admin-buy-link-image-row">
                            {frame.mediaUrl ? (
                              <span
                                className="promo-admin-buy-link-thumb"
                                style={{ backgroundImage: `url(${frame.mediaUrl})` }}
                                aria-hidden
                              />
                            ) : null}
                            <button
                              type="button"
                              className="button secondary promo-admin-catalog-browse"
                              disabled={busy}
                              onClick={() =>
                                setCatalogPickerTarget({ mode: "frame-media", frameIndex: index })
                              }
                            >
                              Browse catalog
                            </button>
                            {frame.mediaUrl ? (
                              <button
                                type="button"
                                className="button secondary promo-admin-buy-link-clear"
                                disabled={busy}
                                onClick={() => updateFrame(index, { mediaUrl: "" })}
                              >
                                Clear
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                      <div className="promo-admin-timing-row">
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
                        <label className="promo-admin-field">
                          <span>Fade in (ms)</span>
                          <input
                            type="number"
                            min={0}
                            max={4000}
                            step={50}
                            value={frame.fadeInMs ?? PROMO_FRAME_FADE_MS_DEFAULT}
                            onChange={(event) =>
                              updateFrame(index, {
                                fadeInMs: Number(event.target.value) || 0,
                              })
                            }
                            disabled={busy}
                          />
                        </label>
                        <label className="promo-admin-field">
                          <span>Fade out (ms)</span>
                          <input
                            type="number"
                            min={0}
                            max={4000}
                            step={50}
                            value={frame.fadeOutMs ?? PROMO_FRAME_FADE_MS_DEFAULT}
                            onChange={(event) =>
                              updateFrame(index, {
                                fadeOutMs: Number(event.target.value) || 0,
                              })
                            }
                            disabled={busy}
                          />
                        </label>
                      </div>
                      </div>
                    </details>
                  ))}
                </div>
                <div className="promo-admin-frame-toolbar">
                  <span className="promo-admin-frame-toolbar-label">Sequence frames</span>
                  <button type="button" className="button secondary" disabled={busy} onClick={resetFrames}>
                    Use recommended sequence
                  </button>
                  <button type="button" className="button secondary" disabled={busy} onClick={addFrame}>
                    Add frame
                  </button>
                </div>
                <div className="promo-admin-frame-list">
                  {draft.frames.map((frame, index) => (
                    <details key={`${frame.id}-editor`} className="promo-admin-collapse promo-admin-frame-card">
                      <summary className="promo-admin-collapse-summary promo-admin-frame-head">
                        <strong>
                          Frame {index + 1}: {PROMO_FRAME_KIND_LABELS[frame.kind]}
                        </strong>
                        <button
                          type="button"
                          className="button secondary"
                          disabled={busy || draft.frames.length <= 1}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            removeFrame(index);
                          }}
                        >
                          Remove
                        </button>
                      </summary>
                      <div className="promo-admin-collapse-body">
                      <p className="promo-admin-schedule-hint">{PROMO_FRAME_KIND_HINTS[frame.kind]}</p>
                      <div className="promo-admin-row">
                        <label className="promo-admin-field">
                          <span>Type</span>
                          <select
                            value={frame.kind}
                            onChange={(event) => {
                              const nextKind = event.target.value as PromoFrameKind;
                              if (isFrameVisualKind(nextKind)) {
                                setFrameVisualKind(index, nextKind);
                                return;
                              }
                              updateFrame(index, { kind: nextKind });
                            }}
                            disabled={busy}
                          >
                            {isFrameVisualKind(frame.kind)
                              ? FRAME_VISUAL_KIND_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))
                              : Object.entries(PROMO_FRAME_KIND_LABELS).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                          </select>
                        </label>
                      </div>
                      {frame.kind === "title-media" || frame.kind === "text" ? (
                        <label className="promo-admin-field">
                          <span>Text</span>
                          <textarea
                            rows={2}
                            placeholder="Type the line for this frame"
                            value={frame.title ?? ""}
                            onChange={(event) => updateFrame(index, { title: event.target.value })}
                            disabled={busy}
                          />
                        </label>
                      ) : null}
                      {frame.kind === "title-media" || frame.kind === "image" ? (
                        <div className="promo-admin-field">
                          <span>Catalog image</span>
                          <div className="promo-admin-buy-link-image-row">
                            {frame.mediaUrl ? (
                              <span
                                className="promo-admin-buy-link-thumb"
                                style={{ backgroundImage: `url(${frame.mediaUrl})` }}
                                aria-hidden
                              />
                            ) : null}
                            <button
                              type="button"
                              className="button secondary promo-admin-catalog-browse"
                              disabled={busy}
                              onClick={() =>
                                setCatalogPickerTarget({ mode: "frame-media", frameIndex: index })
                              }
                            >
                              Browse catalog
                            </button>
                            {frame.mediaUrl ? (
                              <button
                                type="button"
                                className="button secondary promo-admin-buy-link-clear"
                                disabled={busy}
                                onClick={() => updateFrame(index, { mediaUrl: "" })}
                              >
                                Clear
                              </button>
                            ) : null}
                          </div>
                          {frame.mediaUrl ? (
                            <code className="promo-admin-media-url">{frame.mediaUrl.split("/").pop()}</code>
                          ) : (
                            <span className="promo-admin-schedule-hint">
                              Uses the banner media above if you do not pick one here.
                            </span>
                          )}
                        </div>
                      ) : null}
                      {frame.kind === "title-media" || frame.kind === "text" ? (
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
                      {frame.kind === "title-media" || frame.kind === "image" ? (
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
                          <span>Scrolling text</span>
                          <textarea
                            rows={2}
                            placeholder="Type the scrolling message for this frame"
                            value={frame.body ?? ""}
                            onChange={(event) => updateFrame(index, { body: event.target.value })}
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
                    </details>
                  ))}
                </div>
                <p className="promo-admin-schedule-hint">
                  Blank frame fields fall back to Headline and Catalog image above. Recommended order:
                  Image only, Text only, Scrolling message, then Call-to-action button. Click Use recommended
                  sequence, then Publish.
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
            </details>
          </div>

          <div className="promo-admin-section">
            <details className="promo-admin-collapse">
              <summary className="promo-admin-collapse-summary">
                <span className="promo-admin-collapse-title">
                  <strong>Strip appearance</strong>
                </span>
              </summary>
              <div className="promo-admin-collapse-body">
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
              <label className="promo-admin-toggle">
                <input
                  type="checkbox"
                  checked={draft.stripAspectRatio === PROMO_STRIP_ASPECT_21_9}
                  onChange={(event) =>
                    updateDraft({
                      stripAspectRatio: event.target.checked ? PROMO_STRIP_ASPECT_21_9 : "fixed",
                    })
                  }
                  disabled={busy || draft.stripBackgroundMediaKind !== "video"}
                />
                <span>21:9 video strip (taller layout for widescreen video)</span>
              </label>
              <label className="promo-admin-field">
                <span>Strip height ({draft.stripHeightPx}px)</span>
                <input
                  type="range"
                  min={PROMO_STRIP_HEIGHT_MIN}
                  max={PROMO_STRIP_HEIGHT_MAX}
                  step={1}
                  value={draft.stripHeightPx}
                  onChange={(event) => updateDraft({ stripHeightPx: Number(event.target.value) })}
                  disabled={busy}
                />
              </label>
              <label className="promo-admin-field">
                <span>
                  Strip position up / down ({draft.stripPositionOffsetCm.toFixed(1)} cm)
                </span>
                <input
                  type="range"
                  min={PROMO_STRIP_POSITION_CM_MIN}
                  max={PROMO_STRIP_POSITION_CM_MAX}
                  step={0.5}
                  value={draft.stripPositionOffsetCm}
                  onChange={(event) =>
                    updateDraft({ stripPositionOffsetCm: Number(event.target.value) })
                  }
                  disabled={busy}
                />
              </label>
              <label className="promo-admin-field">
                <span>
                  Fine position ({draft.stripPositionOffsetPx}px)
                </span>
                <input
                  type="range"
                  min={PROMO_STRIP_POSITION_PX_MIN}
                  max={PROMO_STRIP_POSITION_PX_MAX}
                  step={1}
                  value={draft.stripPositionOffsetPx}
                  onChange={(event) =>
                    updateDraft({ stripPositionOffsetPx: Number(event.target.value) })
                  }
                  disabled={busy}
                />
              </label>
            </div>
            <p className="promo-admin-hint">
              Positive values move the strip down. Negative values move it up.
            </p>
            <details className="promo-admin-collapse promo-admin-collapse-section">
              <summary className="promo-admin-collapse-summary">
                <span className="promo-admin-collapse-title">
                  <strong>Strip background</strong>
                </span>
              </summary>
              <div className="promo-admin-collapse-body">
            <div className="promo-admin-field">
              <p className="promo-admin-hint">
                Image or video is clipped to the strip. Use size and position to frame it.
              </p>
              <div className="promo-admin-buy-link-image-row">
                {draft.stripBackgroundImageUrl ? (
                  draft.stripBackgroundMediaKind === "video" ? (
                    <div
                      className="promo-admin-strip-bg-preview"
                      style={promoStripStyleVars(draft)}
                    >
                      <video
                        className="promo-strip-bg-media-video"
                        src={draft.stripBackgroundImageUrl}
                        muted
                        loop={draft.stripBackgroundVideoLoop}
                        playsInline
                        autoPlay
                        aria-hidden
                      />
                    </div>
                  ) : (
                    <span
                      className="promo-admin-buy-link-thumb promo-admin-strip-bg-thumb"
                      style={{
                        ...promoStripStyleVars(draft),
                        backgroundImage: `url(${draft.stripBackgroundImageUrl})`,
                        backgroundSize: `${draft.stripBackgroundImageScale}% auto`,
                        backgroundPosition: `${draft.stripBackgroundImageOffsetX}% ${draft.stripBackgroundImageOffsetY}%`,
                      }}
                      aria-hidden
                    />
                  )
                ) : null}
                <label
                  className={`promo-admin-upload promo-admin-upload-inline${
                    stripBgLoadedKind === "image" ? " process-success" : ""
                  }`}
                >
                  <span className="sr-only">Upload strip background image</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={busy || uploading}
                    onChange={(event) =>
                      void onStripBgUpload(event.target.files?.[0], "image", event.currentTarget)
                    }
                  />
                  {stripBgButtonLabel("image", "Load image")}
                </label>
                <label
                  className={`promo-admin-upload promo-admin-upload-inline${
                    stripBgLoadedKind === "video" ? " process-success" : ""
                  }`}
                >
                  <span className="sr-only">Upload strip background video</span>
                  <input
                    type="file"
                    accept="video/*"
                    disabled={busy || uploading}
                    onChange={(event) =>
                      void onStripBgUpload(event.target.files?.[0], "video", event.currentTarget)
                    }
                  />
                  {stripBgButtonLabel("video", "Load video")}
                </label>
                <button
                  type="button"
                  className="button secondary promo-admin-catalog-browse"
                  disabled={busy}
                  onClick={() => setCatalogPickerTarget({ mode: "strip-bg" })}
                >
                  Browse catalog
                </button>
                {draft.stripBackgroundImageUrl ? (
                  <button
                    type="button"
                    className="button secondary promo-admin-buy-link-clear"
                    disabled={busy}
                    onClick={() => {
                      updateDraft({ stripBackgroundImageUrl: "", stripBackgroundMediaKind: "none" });
                      setStripBgLoadedKind(null);
                    }}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
              <label className="promo-admin-field">
                <span>
                  {draft.stripBackgroundMediaKind === "video" ? "Video" : "Image"} size (
                  {draft.stripBackgroundImageScale}%)
                </span>
                <input
                  type="range"
                  min={25}
                  max={400}
                  step={1}
                  value={draft.stripBackgroundImageScale}
                  onChange={(event) =>
                    updateDraft({ stripBackgroundImageScale: Number(event.target.value) })
                  }
                  disabled={busy || !draft.stripBackgroundImageUrl}
                />
              </label>
              <label className="promo-admin-field">
                <span>
                  {draft.stripBackgroundMediaKind === "video" ? "Video" : "Image"} X position (
                  {draft.stripBackgroundImageOffsetX}%)
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={draft.stripBackgroundImageOffsetX}
                  onChange={(event) =>
                    updateDraft({ stripBackgroundImageOffsetX: Number(event.target.value) })
                  }
                  disabled={busy || !draft.stripBackgroundImageUrl}
                />
              </label>
              <label className="promo-admin-field">
                <span>
                  {draft.stripBackgroundMediaKind === "video" ? "Video" : "Image"} Y position (
                  {draft.stripBackgroundImageOffsetY}%)
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={draft.stripBackgroundImageOffsetY}
                  onChange={(event) =>
                    updateDraft({ stripBackgroundImageOffsetY: Number(event.target.value) })
                  }
                  disabled={busy || !draft.stripBackgroundImageUrl}
                />
              </label>
              {draft.stripBackgroundMediaKind === "video" && draft.stripBackgroundImageUrl ? (
                <div className="promo-admin-field">
                  <span>Video playback</span>
                  <div className="promo-admin-animation-grid promo-admin-animation-grid--compact">
                    <button
                      type="button"
                      className={`promo-admin-animation${
                        draft.stripBackgroundVideoLoop ? " is-active" : ""
                      }`}
                      onClick={() => updateDraft({ stripBackgroundVideoLoop: true })}
                      disabled={busy}
                    >
                      <strong>Loop</strong>
                      <span>Repeats continuously</span>
                    </button>
                    <button
                      type="button"
                      className={`promo-admin-animation${
                        !draft.stripBackgroundVideoLoop ? " is-active" : ""
                      }`}
                      onClick={() => updateDraft({ stripBackgroundVideoLoop: false })}
                      disabled={busy}
                    >
                      <strong>Play once</strong>
                      <span>Products appear when video ends</span>
                    </button>
                  </div>
                  {!draft.stripBackgroundVideoLoop ? (
                    <div className="promo-admin-field">
                      <span>After video finishes</span>
                      <p className="promo-admin-hint">
                        Assign a fallback banner image. If none is assigned, the video holds on its last frame.
                      </p>
                      <div className="promo-admin-buy-link-image-row">
                        {draft.stripBackgroundFallbackImageUrl ? (
                          <img
                            className="promo-admin-buy-link-thumb promo-admin-strip-bg-thumb"
                            src={draft.stripBackgroundFallbackImageUrl}
                            alt="Fallback banner preview"
                          />
                        ) : null}
                        <label className="promo-admin-upload promo-admin-upload-inline">
                          <span className="sr-only">Upload fallback banner image</span>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={busy || uploading}
                            onChange={(event) =>
                              void onStripFallbackUpload(
                                event.target.files?.[0],
                                event.currentTarget
                              )
                            }
                          />
                          {uploading ? "Uploading…" : "Load fallback image"}
                        </label>
                        {draft.stripBackgroundFallbackImageUrl ? (
                          <button
                            type="button"
                            className="button secondary promo-admin-buy-link-clear"
                            disabled={busy || uploading}
                            onClick={() => updateDraft({ stripBackgroundFallbackImageUrl: "" })}
                          >
                            Remove fallback
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              </div>
            </details>
            <details className="promo-admin-collapse promo-admin-collapse-section">
              <summary className="promo-admin-collapse-summary">
                <span className="promo-admin-collapse-title">
                  <strong>Opacity &amp; marquee offsets</strong>
                </span>
              </summary>
              <div className="promo-admin-collapse-body">
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
            <label className="promo-admin-field">
              <span>
                Hero marquee end ({draft.heroMarqueeEndOffsetCm.toFixed(1)}cm from strip center)
              </span>
              <input
                type="range"
                min={-15}
                max={15}
                step={0.1}
                value={draft.heroMarqueeEndOffsetCm}
                onChange={(event) =>
                  updateDraft({ heroMarqueeEndOffsetCm: Number(event.target.value) })
                }
                disabled={busy}
              />
            </label>
            <label className="promo-admin-field">
              <span>Hero marquee end fine-tune ({draft.heroMarqueeEndOffsetPx}px)</span>
              <input
                type="range"
                min={-600}
                max={600}
                step={1}
                value={draft.heroMarqueeEndOffsetPx}
                onChange={(event) =>
                  updateDraft({ heroMarqueeEndOffsetPx: Number(event.target.value) })
                }
                disabled={busy}
              />
            </label>
            <p className="promo-admin-schedule-hint">
              Opacity applies to the strip backdrop only. Set to 1.00 for a fully solid bar. Marquee
              start and end controls apply on the homepage hero strip only. Publish or Save All
              Changes to keep them.
            </p>
              </div>
            </details>
              </div>
            </details>
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
            <details className="promo-admin-collapse">
              <summary className="promo-admin-collapse-summary">
                <span className="promo-admin-collapse-title">
                  <strong>CTA buy links</strong>
                </span>
              </summary>
              <div className="promo-admin-collapse-body">
            <p className="promo-admin-schedule-hint">
              Three product links on each side of the main CTA button. With a strip background video, they slide in
              when the video finishes (use Play once playback). Each link needs an image and URL. Browse catalog
              supports selecting up to six products at once.
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
                              onClick={() => setCatalogPickerTarget({ mode: "buy-link", linkId: link.id })}
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
            </details>
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
            <label className="promo-admin-toggle">
              <input
                type="checkbox"
                checked={draft.promoModeEnabled}
                onChange={(event) => updateDraft({ promoModeEnabled: event.target.checked })}
                disabled={busy}
              />
              <span>Promo mode (shows strip, hides primary media for video promos)</span>
            </label>
            <p className="promo-admin-schedule-hint">
              Use Publish now to go live immediately and clear any schedule. Future start dates keep a banner saved but hidden until then. Turn promo mode off to hide the strip and restore the primary hero product image.
            </p>
          </div>

          <div className="promo-admin-actions">
            <button
              type="button"
              className={`button primary button-sage${publishSucceeded ? " process-success promo-publish-success" : ""}`}
              data-published={publishSucceeded ? "true" : "false"}
              disabled={(busy || uploading) && !publishSucceeded}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void saveBanner("publish");
              }}
              style={
                publishSucceeded
                  ? {
                      background: "#22c55e",
                      borderColor: "#16a34a",
                      color: "#fff",
                      opacity: 1,
                      boxShadow: "0 0 0 2px rgba(34, 197, 94, 0.45)",
                    }
                  : undefined
              }
            >
              {publishSucceeded ? "Published!" : busy ? "Publishing…" : "Publish now"}
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
        open={catalogPickerTarget !== null}
        onClose={() => setCatalogPickerTarget(null)}
        multiSelect={catalogPickerTarget?.mode === "buy-link"}
        maxSelection={buyLinkPickerMaxSelection}
        title={
          catalogPickerTarget?.mode === "buy-link"
            ? "Choose products for buy links"
            : catalogPickerTarget?.mode === "strip-bg"
              ? "Choose strip background image"
              : "Choose catalog image"
        }
        onSelect={(product) => {
          if (!catalogPickerTarget) return;
          if (catalogPickerTarget.mode === "buy-link") {
            applyBuyLinkProducts([product], catalogPickerTarget.linkId);
            return;
          }
          if (!product.imageUrl) {
            onStatus(`${product.name} has no catalog image.`);
            return;
          }
          if (catalogPickerTarget.mode === "banner-media") {
            updateDraft({
              mediaKind: draft.mediaKind === "title-media" ? "title-media" : "image",
              mediaUrl: product.imageUrl,
            });
            onStatus(`Using catalog image from ${product.name}.`);
            return;
          }
          if (catalogPickerTarget.mode === "strip-bg") {
            updateDraft({
              stripBackgroundImageUrl: product.imageUrl,
              stripBackgroundMediaKind: "image",
            });
            setStripBgLoadedKind("image");
            onStatus(`Using strip background from ${product.name}.`);
            return;
          }
          updateFrame(catalogPickerTarget.frameIndex, { mediaUrl: product.imageUrl });
          onStatus(`Using catalog image from ${product.name}.`);
        }}
        onSelectMultiple={(products) => {
          if (!catalogPickerTarget || catalogPickerTarget.mode !== "buy-link") return;
          applyBuyLinkProducts(products, catalogPickerTarget.linkId);
        }}
      />
    </div>
  );
}
