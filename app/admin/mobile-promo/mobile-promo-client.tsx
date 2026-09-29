"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PROMO_MOBILE_DESIGN_WIDTH,
  PROMO_MOBILE_HEIGHT_MAX,
  PROMO_MOBILE_HEIGHT_MIN,
  PROMO_MOBILE_PREVIEW_MESSAGE,
  seedPromoMobileLayout,
} from "../../../lib/promo-mobile-layout";
import { resolvePromoAdminName } from "../../../lib/promo-client-utils";
import { usesPromoSequence } from "../../../lib/promo-sequence-utils";
import type { PromoBanner, PromoMobileLayout } from "../../../lib/promo-types";

const PHONE_WIDTHS = [
  { label: "iPhone 13 / 14 (390)", value: 390 },
  { label: "Compact (360)", value: 360 },
  { label: "Plus / Max (430)", value: 430 },
];
const PHONE_HEIGHT = 844;

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
};

function Slider({ label, value, min, max, step = 1, suffix = "px", onChange }: SliderProps) {
  return (
    <label className="mobile-promo-slider">
      <span>
        {label}
        <em>
          {value}
          {suffix}
        </em>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export default function MobilePromoClient() {
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [bannerId, setBannerId] = useState("");
  const [layout, setLayout] = useState<PromoMobileLayout | null>(null);
  const [phoneWidth, setPhoneWidth] = useState(PROMO_MOBILE_DESIGN_WIDTH);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const frameReady = useRef(false);

  const banner = useMemo(() => banners.find((item) => item.id === bannerId) ?? null, [banners, bannerId]);
  /** What the phone frame should draw: the stored banner with the unsaved sliders merged in. */
  const previewBanner = useMemo(
    () => (banner ? { ...banner, mobile: layout ?? banner.mobile } : null),
    [banner, layout]
  );

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/promos?admin=1", { cache: "no-store", credentials: "same-origin" });
      const data = (await res.json()) as { banners?: PromoBanner[]; error?: string };
      if (!res.ok) {
        setStatus(data.error || "Could not load promos.");
        return;
      }
      const rows = data.banners ?? [];
      const requestedPromoId = new URLSearchParams(window.location.search).get("promo") ?? "";
      setBanners(rows);
      setBannerId(
        (current) =>
          current ||
          rows.find((item) => item.id === requestedPromoId)?.id ||
          (rows.find((item) => item.active) ?? rows[0])?.id ||
          ""
      );
    };
    void load();
  }, []);

  useEffect(() => {
    if (!banner) return;
    const nextLayout = banner.mobile ?? null;
    setLayout(nextLayout?.textBannerHeightPct === 200 ? { ...nextLayout, textBannerHeightPct: 300 } : nextLayout);
    setStatus("");
  }, [banner]);

  const postPreview = useCallback((next: PromoBanner | null) => {
    const frame = frameRef.current?.contentWindow;
    if (!frame) return;
    frame.postMessage({ type: PROMO_MOBILE_PREVIEW_MESSAGE, banner: next }, window.location.origin);
  }, []);

  /** The frame announces itself on load, so the first draft is not lost to a race. */
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if ((event.data as { type?: string } | null)?.type !== `${PROMO_MOBILE_PREVIEW_MESSAGE}:ready`) return;
      frameReady.current = true;
      postPreview(previewBanner);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [postPreview, previewBanner]);

  useEffect(() => {
    if (!frameReady.current) return;
    postPreview(previewBanner);
  }, [postPreview, previewBanner]);

  const active = layout?.enabled === true;
  /** Frame sequences position their copy per frame, so those sliders would do nothing here. */
  const playsAsSequence = banner ? usesPromoSequence(banner, "hero") : false;
  const update = (patch: Partial<PromoMobileLayout>) => {
    setSaved(false);
    setLayout((current) => {
      const base = current ?? (banner ? seedPromoMobileLayout(banner) : null);
      return base ? { ...base, ...patch } : null;
    });
  };

  const overlayFor = (layerId: string) => {
    const stored = layout?.overlay.find((row) => row.id === layerId);
    if (stored) return stored;
    const source = banner?.overlayImages?.find((row) => row.id === layerId);
    return { id: layerId, x: source?.x ?? 50, y: source?.y ?? 50, scale: source?.scale ?? 75 };
  };

  const updateOverlay = (layerId: string, patch: { x?: number; y?: number; scale?: number }) => {
    const current = overlayFor(layerId);
    const next = { ...current, ...patch };
    const rest = (layout?.overlay ?? []).filter((row) => row.id !== layerId);
    update({ overlay: [...rest, next] });
  };

  const enableLayout = () => {
    if (!banner) return;
    setSaved(false);
    setLayout({ ...(layout ?? seedPromoMobileLayout(banner)), enabled: true });
    setStatus("Phone layout on. It starts from the automatic fit, so nothing has moved yet.");
  };

  const matchDesktop = () => {
    if (!banner) return;
    setSaved(false);
    setLayout(seedPromoMobileLayout(banner));
    setStatus("Sliders reset to the automatic fit.");
  };

  const save = async () => {
    if (!banner) return;
    setBusy(true);
    setStatus("Saving…");
    try {
      const res = await fetch("/api/promos", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...banner, mobile: layout ?? null }),
      });
      const data = (await res.json()) as { banner?: PromoBanner; error?: string };
      const next = data.banner;
      if (!res.ok || !next) throw new Error(data.error || "Could not save the phone layout.");
      setBanners((current) => current.map((item) => (item.id === next.id ? next : item)));
      setLayout(next.mobile ?? null);
      setStatus("");
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save the phone layout.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mobile-promo-page">
      <header className="mobile-promo-header">
        <div>
          <p>Maroma admin</p>
          <h1>Phone promo layout</h1>
          <span>Place every promo element for phones with sliders, and watch it update in the frame.</span>
        </div>
        <nav className="mobile-promo-view-toggle" aria-label="Promo view">
          <Link href="/?openPromoEditor=1">Desktop</Link>
          <Link href="/admin/mobile-promo" aria-current="page" className="is-active">Mobile</Link>
          <Link href="/admin/qr-pages">QR codes</Link>
          <Link href="/">Home</Link>
        </nav>
      </header>

      <div className="mobile-promo-layout">
        <section className="mobile-promo-stage">
          <div className="mobile-promo-stage-bar">
            <select value={phoneWidth} onChange={(event) => setPhoneWidth(Number(event.target.value))}>
              {PHONE_WIDTHS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                frameReady.current = false;
                frameRef.current?.contentWindow?.location.reload();
              }}
            >
              Reload frame
            </button>
          </div>
          <div className="mobile-promo-phone" style={{ width: phoneWidth + 24, height: PHONE_HEIGHT + 24 }}>
            <iframe
              ref={frameRef}
              title="Phone preview"
              src="/?mobilePromoPreview=1"
              style={{ width: phoneWidth, height: PHONE_HEIGHT }}
            />
          </div>
        </section>

        <section className="mobile-promo-panel">
          <label className="mobile-promo-field">
            Promo
            <select value={bannerId} onChange={(event) => setBannerId(event.target.value)}>
              {banners.length === 0 ? <option value="">No promos saved yet</option> : null}
              {banners.map((item) => (
                <option key={item.id} value={item.id}>
                  {resolvePromoAdminName(item)}
                  {item.active ? " · Live" : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="mobile-promo-toggle">
            <div>
              <strong>Hand-tuned phone layout</strong>
              <small>
                {active
                  ? "Phones use the sliders below. The desktop design is untouched."
                  : "Phones currently shrink the desktop design automatically."}
              </small>
            </div>
            {active ? (
              <button type="button" onClick={() => update({ enabled: false })}>
                Turn off
              </button>
            ) : (
              <button type="button" className="is-primary" disabled={!banner} onClick={enableLayout}>
                Turn on
              </button>
            )}
          </div>

          {active && layout ? (
            <div className="mobile-promo-groups">
              <details open>
                <summary>Strip</summary>
                <Slider
                  label="Strip width"
                  value={layout.stripWidthPct ?? banner?.stripWidthPct ?? 100}
                  min={20}
                  max={150}
                  suffix="%"
                  onChange={(value) => update({ stripWidthPct: value })}
                />
                <Slider
                  label="Up / down"
                  value={layout.stripPositionOffsetPx ?? 0}
                  min={-400}
                  max={400}
                  onChange={(value) => update({ stripPositionOffsetPx: value })}
                />
                <Slider
                  label="Strip height"
                  value={layout.stripHeightPx}
                  min={PROMO_MOBILE_HEIGHT_MIN}
                  max={PROMO_MOBILE_HEIGHT_MAX}
                  onChange={(value) => update({ stripHeightPx: value })}
                />
              </details>

              {playsAsSequence ? (
                <p className="mobile-promo-hint">
                  This promo plays as a frame sequence, so its headline and tagline are sized frame by
                  frame in the main promo editor. The strip, button and thumbnail sliders still apply.
                </p>
              ) : null}

              <details open hidden={playsAsSequence}>
                <summary>Headline</summary>
                <Slider label="Left / right" value={layout.headlineOffsetX} min={-300} max={300} onChange={(value) => update({ headlineOffsetX: value })} />
                <Slider label="Up / down" value={layout.headlineOffsetY} min={-300} max={300} onChange={(value) => update({ headlineOffsetY: value })} />
                <Slider label="Size" value={layout.headlineScale} min={40} max={220} suffix="%" onChange={(value) => update({ headlineScale: value })} />
              </details>

              <details hidden={playsAsSequence}>
                <summary>Tagline</summary>
                <Slider label="Left / right" value={layout.taglineOffsetX} min={-300} max={300} onChange={(value) => update({ taglineOffsetX: value })} />
                <Slider label="Up / down" value={layout.taglineOffsetY} min={-300} max={300} onChange={(value) => update({ taglineOffsetY: value })} />
                <Slider label="Size" value={layout.taglineScale} min={40} max={220} suffix="%" onChange={(value) => update({ taglineScale: value })} />
              </details>

              <details hidden={playsAsSequence || banner?.textBannerEnabled !== true}>
                <summary>Text banner strip</summary>
                <Slider label="Left / right" value={layout.textBannerOffsetX} min={-300} max={300} onChange={(value) => update({ textBannerOffsetX: value })} />
                <Slider label="Up / down" value={layout.textBannerOffsetY} min={-300} max={300} onChange={(value) => update({ textBannerOffsetY: value })} />
                <Slider label="Width" value={layout.textBannerWidthPct} min={20} max={200} suffix="%" onChange={(value) => update({ textBannerWidthPct: value })} />
                <Slider label="Height" value={layout.textBannerHeightPct} min={20} max={300} suffix="%" onChange={(value) => update({ textBannerHeightPct: value })} />
                <Slider label="Overall size" value={layout.textBannerScale} min={20} max={220} suffix="%" onChange={(value) => update({ textBannerScale: value })} />
              </details>

              <details>
                <summary>Button</summary>
                <Slider label="Left / right" value={layout.ctaOffsetX} min={-300} max={300} onChange={(value) => update({ ctaOffsetX: value })} />
                <Slider label="Up / down" value={layout.ctaOffsetY} min={-300} max={300} onChange={(value) => update({ ctaOffsetY: value })} />
                <Slider label="Size" value={layout.ctaScale} min={40} max={220} suffix="%" onChange={(value) => update({ ctaScale: value })} />
              </details>

              <details>
                <summary>Product thumbnails</summary>
                <Slider label="Left / right" value={layout.thumbnailOffsetX} min={-300} max={300} onChange={(value) => update({ thumbnailOffsetX: value })} />
                <Slider label="Up / down" value={layout.thumbnailOffsetY} min={-300} max={300} onChange={(value) => update({ thumbnailOffsetY: value })} />
              </details>

              {(banner?.overlayImages ?? []).map((layer, index) => {
                const row = overlayFor(layer.id);
                return (
                  <details key={layer.id}>
                    <summary>{layer.name?.trim() || `Image ${index + 1}`}</summary>
                    <Slider label="Across" value={row.x} min={0} max={100} suffix="%" onChange={(value) => updateOverlay(layer.id, { x: value })} />
                    <Slider label="Down" value={row.y} min={0} max={100} suffix="%" onChange={(value) => updateOverlay(layer.id, { y: value })} />
                    <Slider label="Size" value={row.scale} min={20} max={270} suffix="%" onChange={(value) => updateOverlay(layer.id, { scale: value })} />
                  </details>
                );
              })}
            </div>
          ) : null}

          <div className="mobile-promo-actions">
            <span>{saved ? "" : status}</span>
            <button type="button" disabled={!banner || busy} onClick={matchDesktop}>
              Match desktop
            </button>
            <button
              type="button"
              className={`is-primary${saved ? " is-saved" : ""}`}
              disabled={!banner || busy}
              onClick={() => void save()}
            >
              {saved ? "Saved!" : "Save phone layout"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
