"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { PromoBanner, PromoCtaBuyLink, PromoCtaStyle } from "../../lib/promo-types";
import type { SiteMediaItem } from "../../lib/site-media-gallery-types";
import { resolvePromoAdminName } from "../../lib/promo-client-utils";
import {
  catalogProductToBuyLinkFields,
  MaromaCatalogPicker,
  type MaromaCatalogPickerProduct,
} from "./MaromaCatalogPicker";
import "../admin/site/admin-promo-banners.css";

const GRADIENTS = [
  { name: "Auroville Sunrise", value: "linear-gradient(135deg,#083f55 0%,#1688a3 45%,#efc85d 100%)" },
  { name: "Botanical Garden", value: "linear-gradient(135deg,#153f37 0%,#6d8d55 52%,#d9c77e 100%)" },
  { name: "Rose & Saffron", value: "linear-gradient(135deg,#7d3048 0%,#d98175 48%,#efc65e 100%)" },
  { name: "Midnight Gold", value: "linear-gradient(135deg,#102d39 0%,#1b5260 58%,#c99a3e 100%)" },
  { name: "Soft Spa", value: "linear-gradient(135deg,#dbe8df 0%,#d3e6e8 52%,#f3dfb5 100%)" },
];

const OCCASION_TEMPLATES = [
  { id: "mothers-day", label: "Mother's Day", title: "For every kind of mother", body: "Botanical rituals, thoughtful gifts, and moments of care—chosen with love.", ctaLabel: "Shop Mother's Day", ctaHref: "/gifting", gradient: "linear-gradient(135deg,#7d3048 0%,#d98175 48%,#efc65e 100%)", textStyle: "ivory" as const, animation: "fade" as const, keywords: ["gift", "face", "cream", "perfume", "candle", "body"] },
  { id: "diwali", label: "Diwali", title: "A festival of light and fragrance", body: "Celebrate with luminous scents, botanical care, and gifts made beautifully.", ctaLabel: "Explore Diwali gifts", ctaHref: "/gifting", gradient: "linear-gradient(135deg,#102d39 0%,#1b5260 58%,#c99a3e 100%)", textStyle: "glass" as const, animation: "pulse" as const, keywords: ["gift", "candle", "incense", "perfume", "home"] },
  { id: "christmas", label: "Christmas", title: "Gifts with warmth and wonder", body: "Natural rituals and fragrant favourites, ready to delight.", ctaLabel: "Shop festive gifts", ctaHref: "/gifting", gradient: "linear-gradient(135deg,#153f37 0%,#6d8d55 52%,#d9c77e 100%)", textStyle: "ivory" as const, animation: "slide" as const, keywords: ["gift", "candle", "perfume", "soap", "home"] },
  { id: "valentines", label: "Valentine's Day", title: "A little ritual of love", body: "Romantic fragrance and nurturing care for someone special.", ctaLabel: "Shop with love", ctaHref: "/gifting", gradient: "linear-gradient(135deg,#702d48 0%,#d06f83 52%,#f1bd8d 100%)", textStyle: "ivory" as const, animation: "fade" as const, keywords: ["perfume", "rose", "gift", "body", "cream"] },
  { id: "wellness", label: "Wellness edit", title: "A softer rhythm for every day", body: "Restore, replenish, and reconnect with purposeful botanical care.", ctaLabel: "Discover wellness", ctaHref: "/shop", gradient: "linear-gradient(135deg,#dbe8df 0%,#d3e6e8 52%,#f3dfb5 100%)", textStyle: "teal" as const, animation: "slide" as const, keywords: ["wellness", "face", "body", "oil", "cream"] },
];

function uploadPath(file: File) {
  const ext = file.name.includes(".") ? `.${file.name.split(".").pop()?.toLowerCase()}` : ".bin";
  const base = file.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-]+/gi, "-").slice(0, 42).toLowerCase();
  return `homepage-promo/${base || "media"}-${Date.now()}${ext}`;
}

async function uploadPromoMedia(file: File, kind: "image" | "video") {
  if (kind === "video") {
    const { upload } = await import("@vercel/blob/client");
    const result = await upload(uploadPath(file), file, {
      access: "public",
      handleUploadUrl: "/api/promo-strip-background/upload",
      multipart: file.size > 5 * 1024 * 1024,
      contentType: file.type || undefined,
    });
    return result.url;
  }
  const form = new FormData();
  form.append("file", file);
  form.append("mediaKind", "image");
  const res = await fetch("/api/promo-strip-background/upload", { method: "POST", body: form, credentials: "same-origin" });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error || "Upload failed.");
  return data.url;
}

type Props = {
  banner: PromoBanner;
  savedBanners?: PromoBanner[];
  status?: string;
  onChange: (banner: PromoBanner) => void;
  onModeChange?: (enabled: boolean) => void;
  onSaved: (banner: PromoBanner) => void;
  onLibrarySaved?: (banner: PromoBanner) => void;
  onLoadBanner?: (banner: PromoBanner) => void;
  onCreateNew?: () => void;
  onClose: () => void;
};

export function HomepagePromoQuickEditor({ banner, savedBanners = [], status = "", onChange, onModeChange, onSaved, onLibrarySaved, onLoadBanner, onCreateNew, onClose }: Props) {
  const [draft, setDraft] = useState(banner);
  const [panelDragging, setPanelDragging] = useState(false);
  const [dragLeft, setDragLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(status);
  const [loadId, setLoadId] = useState("");
  const [productPickerLinkId, setProductPickerLinkId] = useState<string | null>(null);
  const [overlayCatalogPickerOpen, setOverlayCatalogPickerOpen] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaItems, setMediaItems] = useState<SiteMediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [occasionId, setOccasionId] = useState("mothers-day");
  const mediaDialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    if (!mediaPickerOpen) return;
    const dialog = mediaDialogRef.current;
    dialog?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [mediaPickerOpen]);

  const panelRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{ pointerId: number; offsetX: number; width: number } | null>(null);

  useEffect(() => setDraft(banner), [banner]);
  useEffect(() => setMessage(status), [status]);

  const update = (patch: Partial<PromoBanner>) => {
    const next = { ...draft, ...patch, presentation: "static" as const, updatedAt: new Date().toISOString() };
    setDraft(next);
    onChange(next);
  };

  const publish = async () => {
    setBusy(true);
    setMessage("Publishing…");
    try {
      const res = await fetch("/api/promos", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, publishNow: true, active: true }),
      });
      const data = (await res.json()) as { banner?: PromoBanner; error?: string };
      if (!res.ok || !data.banner) throw new Error(data.error || "Unable to save promo.");
      setDraft(data.banner);
      onSaved(data.banner);
      setMessage("Published live.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save promo.");
    } finally {
      setBusy(false);
    }
  };

  const saveCurrentPromo = async () => {
    const name = draft.adminName?.trim();
    if (!name) {
      setMessage("Enter a promo name first.");
      return;
    }
    setBusy(true);
    setMessage("Saving promo…");
    try {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...copy } = draft;
      const res = await fetch("/api/promos", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...copy,
          ...(draft.active === false ? { id: draft.id } : {}),
          adminName: name,
          active: false,
          startsAt: "",
          endsAt: "",
        }),
      });
      const data = (await res.json()) as { banner?: PromoBanner; error?: string };
      if (!res.ok || !data.banner) throw new Error(data.error || "Unable to save promo.");
      onLibrarySaved?.(data.banner);
      setLoadId(data.banner.id);
      setMessage(`Saved “${resolvePromoAdminName(data.banner)}”.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save promo.");
    } finally {
      setBusy(false);
    }
  };

  const createOccasionPromo = async () => {
    const template = OCCASION_TEMPLATES.find((item) => item.id === occasionId) ?? OCCASION_TEMPLATES[0];
    setBusy(true);
    setMessage(`Creating ${template.label} promo…`);
    try {
      const params = new URLSearchParams({ limit: "60", sortBy: "product", sortDirection: "asc" });
      params.append("status", "live");
      const res = await fetch(`/api/admin/products?${params.toString()}`, { cache: "no-store", credentials: "same-origin" });
      const data = (await res.json()) as { products?: MaromaCatalogPickerProduct[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Could not load products.");
      const products = (data.products ?? []).filter((product) => Boolean(product.imageUrl));
      const ranked = products.map((product, index) => {
        const text = `${product.name} ${product.primaryCategory} ${product.categories.join(" ")}`.toLowerCase();
        const score = template.keywords.reduce((total, keyword, keywordIndex) => total + (text.includes(keyword) ? 20 - keywordIndex : 0), 0);
        return { product, score, index };
      }).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 6).map(({ product }) => product);
      const now = new Date().toISOString();
      const links = ranked.map((product, index) => ({ id: crypto.randomUUID(), side: index < 3 ? "left" as const : "right" as const, visible: true, ...catalogProductToBuyLinkFields(product) }));
      update({
        id: crypto.randomUUID(), adminName: `${template.label} promo`, title: template.title, body: template.body,
        mediaUrl: "", mediaKind: "none", overlayImages: [], stripBackgroundImageUrl: "", stripBackgroundMediaKind: "none",
        stripBackgroundGradient: template.gradient, stripAspectRatio: "fixed", stripHeightPx: 430, stripOpacity: 1,
        animation: template.animation, animateEnabled: true, sequenceLoop: true, stripBackgroundVideoLoop: true,
        ctaLabel: template.ctaLabel, ctaHref: template.ctaHref, ctaStyle: "magical", ctaBuyLinks: links,
        textBannerEnabled: true, textBannerStyle: template.textStyle,
        headlineOffsetX: 0, headlineOffsetY: 0, headlineScale: 128,
        headlineAnimation: "fade", headlineAnimationDurationMs: 1800,
        taglineOffsetX: 0, taglineOffsetY: 0, taglineScale: 100,
        taglineAnimation: "slide", taglineAnimationDurationMs: 2200,
        ctaOffsetX: 0, ctaOffsetY: 28, thumbnailOffsetX: 0, thumbnailOffsetY: 105,
        startsAt: "", endsAt: "", active: false, promoModeEnabled: true, createdAt: now, updatedAt: now,
      });
      setLoadId("");
      setMessage(`${template.label} draft created with ${links.length} product${links.length === 1 ? "" : "s"}. Review it, then save or publish.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create the occasion promo.");
    } finally {
      setBusy(false);
    }
  };

  const backgroundStyle = draft.stripBackgroundMediaKind === "video" ? "video" : "image";
  const gradientEnabled = Boolean(draft.stripBackgroundGradient);
  const gradientColours = (draft.stripBackgroundGradient?.match(/#[0-9a-f]{6}\b/gi) ?? ["#083f55", "#1688a3", "#efc85d"]);
  const gradientAngle = Number(draft.stripBackgroundGradient?.match(/linear-gradient\(([-\d.]+)deg/)?.[1] ?? 135);
  const setGradientColour = (index: number, colour: string) => {
    const colours = gradientColours.map((value, i) => i === index ? colour : value);
    update({ stripBackgroundGradient: `linear-gradient(${gradientAngle}deg,${colours.map((value, i) => `${value} ${Math.round(i * 100 / (colours.length - 1))}%`).join(",")})`, stripBackgroundImageUrl: "", stripBackgroundMediaKind: "none" });
  };
  const buyLinks = useMemo(() => draft.ctaBuyLinks ?? [], [draft.ctaBuyLinks]);
  const overlayImages = useMemo(() => draft.overlayImages?.length ? draft.overlayImages : draft.mediaUrl ? [{ id: "legacy-overlay", imageUrl: draft.mediaUrl, x: draft.overlayImageX ?? 50, y: draft.overlayImageY ?? 50, scale: draft.overlayImageScale ?? 75, radius: draft.overlayImageRadius ?? 18, shadow: draft.overlayImageShadow !== false, animation: draft.overlayImageAnimation ?? "none" as const, animationDurationMs: draft.overlayImageAnimationDurationMs ?? 2400, crop: "none" as const, cropX: 50, cropY: 50 }] : [], [draft]);
  const addOverlayImage = (imageUrl: string, label = "Image") => {
    if (!imageUrl) {
      setMessage(`${label} does not have an image.`);
      return;
    }
    if (overlayImages.length >= 8) {
      setMessage("You can add up to eight second-layer images.");
      return;
    }
    const next = [...overlayImages, { id: crypto.randomUUID(), imageUrl, x: 50, y: 50, scale: 75, radius: 18, shadow: true, animation: "none" as const, animationDurationMs: 2400, crop: "none" as const, cropX: 50, cropY: 50 }];
    update({ overlayImages: next, mediaUrl: next[0]?.imageUrl ?? "", mediaKind: "image" });
    setMessage(`${label} added—position it with the sliders or drag it on the promo.`);
  };
  const openMediaBrowser = async () => {
    setMediaPickerOpen(true);
    setMediaLoading(true);
    setMediaError("");
    try {
      const response = await fetch("/api/site-media-gallery", { cache: "no-store", credentials: "same-origin" });
      const data = (await response.json()) as { items?: SiteMediaItem[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not load the media browser.");
      setMediaItems(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      setMediaItems([]);
      setMediaError(error instanceof Error ? error.message : "Could not load the media browser.");
    } finally {
      setMediaLoading(false);
    }
  };
  const updateBuyLink = (id: string, patch: Partial<PromoCtaBuyLink>) =>
    update({ ctaBuyLinks: buyLinks.map((item) => item.id === id ? { ...item, ...patch } : item) });

  const startPanelDrag = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, width: rect.width };
    setDragLeft(rect.left);
    setPanelDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePanelDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setDragLeft(Math.max(8, Math.min(window.innerWidth - drag.width - 8, event.clientX - drag.offsetX)));
  };

  const finishPanelDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.type !== "pointercancel") {
      setDragLeft(Math.max(8, Math.min(window.innerWidth - drag.width - 8, event.clientX - drag.offsetX)));
    }
    setPanelDragging(false);
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <aside
      ref={panelRef}
      className={`homepage-promo-quick-editor is-left${panelDragging ? " is-dragging" : ""}`}
      style={dragLeft === null ? undefined : { left: `${dragLeft}px`, right: "auto" }}
      aria-label="Homepage promo controls"
    >
      <div
        className="homepage-promo-quick-header"
        onPointerDown={startPanelDrag}
        onPointerMove={handlePanelDrag}
        onPointerUp={finishPanelDrag}
        onPointerCancel={finishPanelDrag}
      >
        <div><span>Homepage designer · drag side to side</span><strong>Promo controls</strong></div>
        <button type="button" onClick={onClose} aria-label="Close promo controls">×</button>
      </div>

      <div className="homepage-promo-quick-scroll">
        <div className="homepage-mode-switch" role="group" aria-label="Homepage mode">
          <button type="button" className={draft.promoModeEnabled === false ? "is-active" : ""} onClick={() => { onModeChange?.(false); update({ promoModeEnabled: false }); }}>Home</button>
          <button type="button" className={draft.promoModeEnabled !== false ? "is-active" : ""} onClick={() => { onModeChange?.(true); update({ promoModeEnabled: true }); }}>Promo</button>
        </div>

        <details className="homepage-promo-control-section">
          <summary>Banner</summary>
          <h3>Frame</h3>
          <p>Change the frame edges without scaling the image.</p>
          <div className="homepage-promo-range-grid">
            <label><span>Frame X · left / right <b>{draft.stripPositionOffsetX ?? 0}px</b></span><input type="range" min={-1200} max={1200} value={draft.stripPositionOffsetX ?? 0} onChange={event => update({ stripPositionOffsetX: Number(event.target.value) })} /></label>
            <button type="button" className="homepage-promo-centre-button" onClick={() => update({ stripPositionOffsetX: 0 })}>Centre frame horizontally</button>
            <label><span>Frame Y · up / down <b>{draft.stripPositionOffsetPx ?? 0}px</b></span><input type="range" min={-1200} max={1200} step={1} value={draft.stripPositionOffsetPx ?? 0} onChange={event => update({ stripPositionOffsetPx: Number(event.target.value) })} /></label>
            <button type="button" className="homepage-promo-centre-button" onClick={() => update({ stripPositionOffsetPx: 0 })}>Centre frame vertically</button>
            <label><span>Frame width <b>{draft.stripWidthPct ?? 100}%</b></span><input type="range" min={20} max={150} step={1} value={draft.stripWidthPct ?? 100} onChange={event => update({ stripWidthPct: Number(event.target.value) })} /></label>
            <label><span>Frame height <b>{draft.stripHeightPx ?? 106}px</b></span><input type="range" min={48} max={1440} step={1} value={draft.stripHeightPx ?? 106} onChange={event => update({ stripHeightPx: Number(event.target.value), stripAspectRatio: "fixed" })} /></label>
            <label><span>Frame size <b>{draft.stripFrameScale ?? 100}%</b></span><input type="range" min={25} max={150} step={1} value={draft.stripFrameScale ?? 100} onChange={event => update({ stripFrameScale: Number(event.target.value), stripAspectRatio: "fixed" })} /></label>
          </div>
          <h3>Image</h3>
          <p>Move and scale the image inside the frame.</p>
          <div className="homepage-promo-range-grid">
            {([['X', 'stripBackgroundImageOffsetX', 0, 100, 50], ['Y', 'stripBackgroundImageOffsetY', 0, 100, 50], ['Scale', 'stripBackgroundImageScale', 25, 400, 100]] as const).map(([label, field, min, max, fallback]) => <label key={field}><span>Image {label} <b>{draft[field] ?? fallback}%</b></span><input type="range" min={min} max={max} value={draft[field] ?? fallback} onChange={event => update({ [field]: Number(event.target.value) })} /></label>)}
            <button type="button" className="homepage-promo-centre-button" onClick={() => update({ stripBackgroundImageOffsetX: 50, stripBackgroundImageOffsetY: 50, stripBackgroundImageScale: 100 })}>Reset image position and scale</button>
          </div>
          <label><span>Background type</span><select value={backgroundStyle} onChange={(event) => update({ stripBackgroundMediaKind: event.target.value === "video" ? "video" : "none", stripBackgroundImageUrl: "", stripAspectRatio: event.target.value === "video" ? "21:9" : "fixed" })}><option value="image">Image / colour</option><option value="video">Video</option></select></label>
          {backgroundStyle === "video" ? (
            <>
              <label className="homepage-promo-upload"><span>{draft.stripBackgroundImageUrl ? "Replace video" : "Upload video"}</span><input type="file" accept="video/*" disabled={busy} onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setBusy(true); setMessage("Uploading video…"); try { const url = await uploadPromoMedia(file, "video"); update({ stripBackgroundImageUrl: url, stripBackgroundMediaKind: "video", stripBackgroundVideoLoop: false, stripAspectRatio: "21:9" }); setMessage("Video ready in preview."); } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed."); } finally { setBusy(false); } }} /></label>
              <label className="homepage-promo-upload secondary"><span>{draft.stripBackgroundFallbackImageUrl ? "Replace end image" : "Upload end image"}</span><small>Shown after the video plays once.</small><input type="file" accept="image/*" disabled={busy} onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setBusy(true); setMessage("Uploading end image…"); try { const url = await uploadPromoMedia(file, "image"); update({ stripBackgroundFallbackImageUrl: url }); setMessage("End image ready in preview."); } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed."); } finally { setBusy(false); } }} /></label>
            </>
          ) : (
            <>
              <label><span>Colour fill</span><select value={gradientEnabled ? "gradient" : "solid"} onChange={(event) => update({ stripBackgroundGradient: event.target.value === "gradient" ? GRADIENTS[0].value : "", stripBackgroundImageUrl: "", stripBackgroundMediaKind: "none" })}><option value="gradient">Gradient</option><option value="solid">Solid colour (no gradient)</option></select></label>
              {gradientEnabled ? <>
                <label><span>Gradient preset</span><select value={GRADIENTS.some(item => item.value === draft.stripBackgroundGradient) ? draft.stripBackgroundGradient : "custom"} onChange={(event) => { if (event.target.value !== "custom") update({ stripBackgroundGradient: event.target.value, stripBackgroundImageUrl: "", stripBackgroundMediaKind: "none" }); }}><option value="custom" disabled>Custom colours</option>{GRADIENTS.map(item => <option key={item.name} value={item.value}>{item.name}</option>)}</select></label>
                <div className="homepage-gradient-swatches">{GRADIENTS.map(item => <button key={item.name} type="button" title={item.name} aria-label={item.name} style={{ background: item.value }} className={draft.stripBackgroundGradient === item.value ? "is-active" : ""} onClick={() => update({ stripBackgroundGradient: item.value, stripBackgroundImageUrl: "", stripBackgroundMediaKind: "none" })} />)}</div>
                {gradientColours.map((colour, index) => <div className="homepage-banner-colour-row" key={index}><label><span>Gradient colour {index + 1}</span><input type="color" value={colour} onChange={event => setGradientColour(index, event.target.value)} /></label></div>)}
              </> : <div className="homepage-banner-colour-row"><label><span>Banner colour</span><input type="color" value={/^#[0-9a-f]{6}$/i.test(draft.stripBackground ?? "") ? draft.stripBackground : "#134a57"} onChange={event => update({ stripBackground: event.target.value, stripBackgroundImageUrl: "", stripBackgroundMediaKind: "none" })} /></label></div>}
              <label className="homepage-promo-upload"><span>{draft.stripBackgroundImageUrl ? "Replace background" : "Upload background image"}</span><input type="file" accept="image/*" disabled={busy} onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setBusy(true); setMessage("Uploading background…"); try { const url = await uploadPromoMedia(file, "image"); update({ stripBackgroundImageUrl: url, stripBackgroundMediaKind: "image" }); setMessage("Background ready in preview."); } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed."); } finally { setBusy(false); } }} /></label>
            </>
          )}
        </details>

        <details className="homepage-promo-control-section">
          <summary>Headline</summary>
          <label><span>Headline text</span><input value={draft.title} onChange={(event) => update({ title: event.target.value })} placeholder="A beautiful seasonal offer" /></label>
          <div className="homepage-promo-range-grid"><label><span>Headline X <b>{draft.headlineOffsetX ?? 0}</b></span><input type="range" min={-800} max={800} value={draft.headlineOffsetX ?? 0} onChange={(event) => update({ headlineOffsetX: Number(event.target.value) })} /></label><label><span>Headline Y <b>{draft.headlineOffsetY ?? 0}</b></span><input type="range" min={-500} max={500} value={draft.headlineOffsetY ?? 0} onChange={(event) => update({ headlineOffsetY: Number(event.target.value) })} /></label><label><span>Headline scale <b>{draft.headlineScale ?? 100}%</b></span><input type="range" min={40} max={220} value={draft.headlineScale ?? 100} onChange={(event) => update({ headlineScale: Number(event.target.value) })} /></label><button type="button" className="homepage-promo-centre-button" onClick={() => update({ headlineOffsetX: 0, headlineOffsetY: 0 })}>Centre headline</button></div>
          <label><span>Headline animation</span><select value={draft.headlineAnimation ?? "none"} onChange={(event) => update({ headlineAnimation: event.target.value as NonNullable<PromoBanner["headlineAnimation"]> })}><option value="none">None</option><option value="fade">Silk fade</option><option value="slide">Gentle glide</option><option value="pulse">Soft glow</option><option value="zoom">Zoom in</option></select></label>
          {(draft.headlineAnimation ?? "none") !== "none" ? <label><span>Headline animation speed <b>{((draft.headlineAnimationDurationMs ?? 2400) / 1000).toFixed(1)}s</b></span><input type="range" min={500} max={8000} step={100} value={draft.headlineAnimationDurationMs ?? 2400} onChange={(event) => update({ headlineAnimationDurationMs: Number(event.target.value) })} /></label> : null}
          <label><span>Tagline</span><textarea value={draft.body} onChange={(event) => update({ body: event.target.value })} placeholder="Short, warm supporting copy" rows={2} /></label>
          <div className="homepage-promo-range-grid"><label><span>Tagline X <b>{draft.taglineOffsetX ?? 0}</b></span><input type="range" min={-800} max={800} value={draft.taglineOffsetX ?? 0} onChange={(event) => update({ taglineOffsetX: Number(event.target.value) })} /></label><label><span>Tagline Y <b>{draft.taglineOffsetY ?? 0}</b></span><input type="range" min={-500} max={500} value={draft.taglineOffsetY ?? 0} onChange={(event) => update({ taglineOffsetY: Number(event.target.value) })} /></label><label><span>Tagline scale <b>{draft.taglineScale ?? 100}%</b></span><input type="range" min={40} max={220} value={draft.taglineScale ?? 100} onChange={(event) => update({ taglineScale: Number(event.target.value) })} /></label></div>
          <label><span>Tagline animation</span><select value={draft.taglineAnimation ?? "none"} onChange={(event) => update({ taglineAnimation: event.target.value as NonNullable<PromoBanner["taglineAnimation"]> })}><option value="none">None</option><option value="fade">Silk fade</option><option value="slide">Gentle glide</option><option value="pulse">Soft glow</option><option value="zoom">Zoom in</option></select></label>
          {(draft.taglineAnimation ?? "none") !== "none" ? <label><span>Tagline animation speed <b>{((draft.taglineAnimationDurationMs ?? 2400) / 1000).toFixed(1)}s</b></span><input type="range" min={500} max={8000} step={100} value={draft.taglineAnimationDurationMs ?? 2400} onChange={(event) => update({ taglineAnimationDurationMs: Number(event.target.value) })} /></label> : null}
          <label className="homepage-promo-check"><input type="checkbox" checked={draft.textBannerEnabled === true} onChange={(event) => update({ textBannerEnabled: event.target.checked })} /><span>Banner strip behind text</span></label>
          {draft.textBannerEnabled ? <label><span>Banner appearance</span><select value={draft.textBannerStyle ?? "glass"} onChange={(event) => update({ textBannerStyle: event.target.value as NonNullable<PromoBanner["textBannerStyle"]> })}><option value="glass">Soft glass</option><option value="ivory">Warm ivory</option><option value="teal">Maroma teal</option></select></label> : null}
          {draft.textBannerEnabled ? <div className="homepage-promo-range-grid">
            <label><span>Strip X <b>{draft.textBannerOffsetX ?? 0}px</b></span><input type="range" min={-1200} max={1200} value={draft.textBannerOffsetX ?? 0} onChange={event => update({ textBannerOffsetX: Number(event.target.value) })} /></label>
            <label><span>Strip Y <b>{draft.textBannerOffsetY ?? 0}px</b></span><input type="range" min={-900} max={900} value={draft.textBannerOffsetY ?? 0} onChange={event => update({ textBannerOffsetY: Number(event.target.value) })} /></label>
            <label><span>Strip scale <b>{draft.textBannerScale ?? 100}%</b></span><input type="range" min={20} max={220} value={draft.textBannerScale ?? 100} onChange={event => update({ textBannerScale: Number(event.target.value) })} /></label>
            <button type="button" className="homepage-promo-centre-button" onClick={() => update({ textBannerOffsetX: 0, textBannerOffsetY: 0 })}>Centre strip X/Y</button>
          </div> : null}
        </details>

        <details className="homepage-promo-control-section">
          <summary>Second image layer</summary>
          <p>Add several images. Each one can be positioned, resized and animated independently.</p>
          {overlayImages.map((layer, index) => {
            const updateLayer = (patch: Partial<typeof layer>) => update({ overlayImages: overlayImages.map((item) => item.id === layer.id ? { ...item, ...patch } : item), mediaUrl: overlayImages[0]?.imageUrl ?? "", mediaKind: "image" });
            return (
              <div className="homepage-overlay-layer-card" key={layer.id}>
                <div className="homepage-overlay-layer-head"><strong>Image {index + 1}</strong><button type="button" onClick={() => { const next = overlayImages.filter((item) => item.id !== layer.id); update({ overlayImages: next, mediaUrl: next[0]?.imageUrl ?? "", mediaKind: next.length ? "image" : "none" }); }}>Remove</button></div>
                <div className="homepage-promo-range-grid">
                  <label><span>X <b>{Math.round(layer.x)}%</b></span><input type="range" min={0} max={100} value={layer.x} onChange={(event) => updateLayer({ x: Number(event.target.value) })} /></label>
                  <label><span>Y <b>{Math.round(layer.y)}%</b></span><input type="range" min={0} max={100} value={layer.y} onChange={(event) => updateLayer({ y: Number(event.target.value) })} /></label>
                  <label><span>Scale <b>{Math.round(layer.scale)}%</b></span><input type="range" min={20} max={220} value={layer.scale} onChange={(event) => updateLayer({ scale: Number(event.target.value) })} /></label>
                  <button type="button" className="homepage-promo-centre-button" onClick={() => updateLayer({ x: 50, y: 50 })}>Centre X/Y</button>
                </div>
                <label><span>Animation</span><select value={layer.animation} onChange={(event) => updateLayer({ animation: event.target.value as typeof layer.animation })}><option value="none">None</option><option value="fade">Silk fade</option><option value="slide">Gentle glide</option><option value="pulse">Soft glow</option><option value="zoom">Zoom in</option></select></label>
                {layer.animation !== "none" ? <label><span>Animation speed <b>{(layer.animationDurationMs / 1000).toFixed(1)}s</b></span><input type="range" min={500} max={8000} step={100} value={layer.animationDurationMs} onChange={(event) => updateLayer({ animationDurationMs: Number(event.target.value) })} /></label> : null}
                <label><span>Crop</span><select value={layer.crop ?? "none"} onChange={(event) => updateLayer({ crop: event.target.value as NonNullable<typeof layer.crop> })}><option value="none">Show full image</option><option value="square">Square</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
                {(layer.crop ?? "none") !== "none" ? <div className="homepage-promo-range-grid">
                  <label><span>Crop X <b>{Math.round(layer.cropX ?? 50)}%</b></span><input type="range" min={0} max={100} value={layer.cropX ?? 50} onChange={(event) => updateLayer({ cropX: Number(event.target.value) })} /></label>
                  <label><span>Crop Y <b>{Math.round(layer.cropY ?? 50)}%</b></span><input type="range" min={0} max={100} value={layer.cropY ?? 50} onChange={(event) => updateLayer({ cropY: Number(event.target.value) })} /></label>
                  <button type="button" className="homepage-promo-centre-button" onClick={() => updateLayer({ cropX: 50, cropY: 50 })}>Centre crop</button>
                </div> : null}
                <label><span>Corner curve</span><input type="range" min={0} max={50} value={layer.radius} onChange={(event) => updateLayer({ radius: Number(event.target.value) })} /></label>
                <label className="homepage-promo-check"><input type="checkbox" checked={layer.shadow} onChange={(event) => updateLayer({ shadow: event.target.checked })} /><span>Soft drop shadow</span></label>
              </div>
            );
          })}
          {overlayImages.length < 8 ? <div className="homepage-image-source-grid"><button type="button" className="homepage-image-source-button" disabled={busy} onClick={() => void openMediaBrowser()}>Upload image</button><button type="button" className="homepage-image-source-button" disabled={busy} onClick={() => setOverlayCatalogPickerOpen(true)}>Select from catalogue</button><button type="button" className="homepage-image-source-button" disabled={busy} onClick={() => void openMediaBrowser()}>Select from media</button></div> : null}
        </details>

        <details className="homepage-promo-control-section">
          <summary>Call to action</summary>
          <p>Drag the button directly on the promo, independently from the thumbnails.</p>
          <label><span>Button label</span><input value={draft.ctaLabel} onChange={(event) => update({ ctaLabel: event.target.value })} placeholder="Shop the offer" /></label>
          <label><span>Link</span><input value={draft.ctaHref} onChange={(event) => update({ ctaHref: event.target.value })} placeholder="/face-care" /></label>
          <div className="homepage-style-buttons">{(["magical", "promo", "outline"] as PromoCtaStyle[]).map((style) => <button type="button" key={style} className={draft.ctaStyle === style ? "is-active" : ""} onClick={() => update({ ctaStyle: style })}>{style}</button>)}</div>
          <button type="button" className="homepage-promo-centre-button" onClick={() => update({ ctaOffsetX: 0, ctaOffsetY: 0 })}>Centre CTA button</button>
        </details>

        <details className="homepage-promo-control-section">
          <summary>Product thumbnails</summary>
          <p>Add up to six. Drag the group directly on the promo to place it.</p>
          <button type="button" className="homepage-promo-centre-button" onClick={() => update({ thumbnailOffsetX: 0, thumbnailOffsetY: 0 })}>Centre thumbnail group</button>
          {buyLinks.map((link, index) => <div className={`homepage-product-link-row${link.visible === false ? " is-hidden" : ""}`} key={link.id}><strong>{index + 1}</strong><input value={link.label ?? ""} onChange={(event) => updateBuyLink(link.id, { label: event.target.value })} placeholder="Product name" /><input value={link.href} onChange={(event) => updateBuyLink(link.id, { href: event.target.value })} placeholder="Product link" /><button type="button" className="homepage-product-search" onClick={() => setProductPickerLinkId(link.id)}>Search products</button><label className="homepage-promo-upload compact"><span>{link.imageUrl ? "Replace thumbnail" : "Upload thumbnail"}</span><input type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; const url = await uploadPromoMedia(file, "image"); updateBuyLink(link.id, { imageUrl: url }); }} /></label><button type="button" className="homepage-product-visibility" aria-pressed={link.visible !== false} onClick={() => updateBuyLink(link.id, { visible: link.visible === false })}>{link.visible === false ? "Show" : "Hide"}</button><button type="button" className="homepage-product-remove" aria-label="Remove product" onClick={() => update({ ctaBuyLinks: buyLinks.filter((item) => item.id !== link.id) })}>×</button></div>)}
          {buyLinks.length < 6 ? <button type="button" className="homepage-promo-add" onClick={() => update({ ctaBuyLinks: [...buyLinks, { id: crypto.randomUUID(), side: buyLinks.length < 3 ? "left" : "right", visible: true, label: "", href: "", imageUrl: "" }] })}>+ Add product thumbnail</button> : null}
        </details>

        <details className="homepage-promo-control-section">
          <summary>Animation</summary>
          <label className="homepage-promo-check"><input type="checkbox" checked={draft.animateEnabled !== false} onChange={(event) => update({ animateEnabled: event.target.checked })} /><span>Animate promo</span></label>
          {draft.animateEnabled !== false ? <div className="homepage-animation-options">{[{ id: "fade", label: "Silk fade" }, { id: "slide", label: "Gentle glide" }, { id: "pulse", label: "Soft glow" }].map((item) => <button type="button" key={item.id} className={draft.animation === item.id ? "is-active" : ""} onClick={() => update({ animation: item.id as PromoBanner["animation"] })}>{item.label}</button>)}</div> : null}
          <p>Animations play once and stay on their final frame.</p>
        </details>
        <details className="homepage-promo-control-section homepage-promo-library">
          <summary>Saved promos</summary>
          <button type="button" className="homepage-promo-add is-create-new" onClick={() => {
            setLoadId("");
            onCreateNew?.();
          }}>+ Create new promo</button>
          <div className="homepage-occasion-generator">
            <label><span>Create from occasion</span><select value={occasionId} onChange={(event) => setOccasionId(event.target.value)}>{OCCASION_TEMPLATES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <button type="button" disabled={busy} onClick={() => void createOccasionPromo()}>✦ Create editable draft</button>
            <small>Builds the design, copy, CTA and product selection. It will not publish automatically.</small>
          </div>
          <label><span>Promo name</span><input value={draft.adminName ?? ""} onChange={(event) => update({ adminName: event.target.value })} placeholder="Summer face care" /></label>
          <button type="button" className="homepage-promo-centre-button" disabled={busy} onClick={() => void saveCurrentPromo()}>Save current promo</button>
          <label>
            <span>Load saved promo</span>
            <select value={loadId} onChange={(event) => {
              const id = event.target.value;
              setLoadId(id);
              const selected = savedBanners.find((item) => item.id === id);
              if (selected) onLoadBanner?.(selected);
            }}>
              <option value="">Choose a saved promo…</option>
              {savedBanners.map((item) => <option key={item.id} value={item.id}>{resolvePromoAdminName(item)}{item.active ? " · Live" : ""}</option>)}
            </select>
          </label>
        </details>
      </div>

      <div className="homepage-promo-quick-actions"><span>{message || "Changes preview here only until you publish."}</span><div><button type="button" disabled={busy} className="is-primary" onClick={() => void publish()}>Publish live</button></div></div>
      <MaromaCatalogPicker
        open={productPickerLinkId !== null}
        onClose={() => setProductPickerLinkId(null)}
        title="Choose a product thumbnail"
        onSelect={(product) => {
          if (!productPickerLinkId) return;
          updateBuyLink(productPickerLinkId, catalogProductToBuyLinkFields(product));
          setMessage(`Added ${product.name} as the thumbnail.`);
        }}
      />
      <MaromaCatalogPicker
        open={overlayCatalogPickerOpen}
        onClose={() => setOverlayCatalogPickerOpen(false)}
        title="Choose a second-layer product image"
        onSelect={(product) => addOverlayImage(product.imageUrl ?? "", product.name)}
      />
      {mediaPickerOpen ? createPortal(
        <dialog ref={mediaDialogRef} className="homepage-media-picker-root" aria-label="Choose an image" onCancel={() => setMediaPickerOpen(false)}>
          <button type="button" className="homepage-media-picker-backdrop" tabIndex={-1} aria-label="Close media browser" onClick={() => setMediaPickerOpen(false)} />
          <div className="homepage-media-picker">
            <header className="homepage-media-picker-head"><div><span>Media browser</span><h2>Choose an image</h2></div><div className="homepage-media-picker-actions"><label className="homepage-image-source-button"><span>Upload new image</span><input type="file" accept="image/*" disabled={busy} onChange={async (event) => { const input = event.currentTarget; const file = input.files?.[0]; if (!file) return; setBusy(true); try { const url = await uploadPromoMedia(file, "image"); addOverlayImage(url, file.name || "Uploaded image"); setMediaPickerOpen(false); } catch (error) { setMediaError(error instanceof Error ? error.message : "Upload failed."); } finally { setBusy(false); input.value = ""; } }} /></label><button type="button" autoFocus onClick={() => setMediaPickerOpen(false)}>Close</button></div></header>
            {mediaLoading ? <p className="homepage-media-picker-message">Loading images…</p> : null}
            {mediaError ? <p className="homepage-media-picker-message is-error">{mediaError}</p> : null}
            {!mediaLoading && !mediaError && mediaItems.length === 0 ? <p className="homepage-media-picker-message">No images are in the media browser yet.</p> : null}
            <div className="homepage-media-picker-grid">
              {mediaItems.map((item) => <button type="button" key={item.id} onClick={() => { addOverlayImage(item.url, item.label || item.filename); setMediaPickerOpen(false); }}><img src={item.url} alt="" /><span>{item.label || item.filename}</span></button>)}
            </div>
          </div>
        </dialog>,
        document.body
      ) : null}
    </aside>
  );
}
