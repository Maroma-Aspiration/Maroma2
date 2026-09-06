"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatScheduleLabel,
  promoVisibilityStatus,
  type PromoVisibilityStatus,
} from "../../lib/promo-client-utils";
import {
  notifyPromoPreviewPlayback,
  notifyPromoPreviewUpdate,
  PROMO_PREVIEW_STATUS,
  writePromoPreviewPayload,
} from "../../lib/promo-preview-storage";

export { formatScheduleLabel, promoVisibilityStatus };

const PREVIEW_VIEWPORT_WIDTH = 1440;
const PREVIEW_VIEWPORT_HEIGHT = 900;

const statusLabels: Record<PromoVisibilityStatus, string> = {
  live: "Live on site",
  scheduled: "Scheduled (not visible yet)",
  expired: "Expired",
  inactive: "Hidden (inactive)",
  draft: "Draft",
};

type PromoBannerHomePreviewProps = {
  stack: ReturnType<typeof import("../../lib/promo-client-utils").buildPreviewBannerStack>;
  draftStatus: PromoVisibilityStatus;
  scheduleLabel: string;
  isUnsaved: boolean;
};

export function PromoBannerHomePreview({
  stack,
  draftStatus,
  scheduleLabel,
  isUnsaved,
}: PromoBannerHomePreviewProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0.4);
  const [iframeReady, setIframeReady] = useState(false);
  const [animPlaying, setAnimPlaying] = useState(false);

  const previewSrc = useMemo(
    () => `/?skipIntro=1&promoPreview=1&_=${PREVIEW_VIEWPORT_WIDTH}`,
    []
  );

  useEffect(() => {
    writePromoPreviewPayload(stack);
    if (iframeReady) {
      notifyPromoPreviewUpdate(iframeRef.current?.contentWindow, stack);
    }
  }, [stack, iframeReady]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return undefined;

    const updateScale = () => {
      const width = shell.clientWidth;
      if (width <= 0) return;
      setScale(Math.min(width / PREVIEW_VIEWPORT_WIDTH, 1));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(shell);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "maroma:promo-preview-ready") {
        setIframeReady(true);
        writePromoPreviewPayload(stack);
        notifyPromoPreviewUpdate(iframeRef.current?.contentWindow, stack);
        return;
      }
      if (event.data?.type === PROMO_PREVIEW_STATUS) {
        setAnimPlaying(event.data.playback === "playing");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [stack]);

  const scaledHeight = PREVIEW_VIEWPORT_HEIGHT * scale;

  return (
    <aside className="promo-admin-preview-wrap" aria-label="Homepage preview">
      <div className="promo-admin-preview-toolbar">
        <div className="promo-admin-preview-label">Homepage preview</div>
        <div className="promo-admin-preview-toolbar-actions">
          <button
            type="button"
            className={`promo-admin-preview-anim-btn${animPlaying ? " is-active" : ""}`}
            disabled={!iframeReady}
            onClick={() => {
              setAnimPlaying(true);
              notifyPromoPreviewPlayback(iframeRef.current?.contentWindow, "play");
            }}
          >
            Start anim
          </button>
          <button
            type="button"
            className={`promo-admin-preview-anim-btn${animPlaying ? "" : " is-active"}`}
            disabled={!iframeReady}
            onClick={() => {
              setAnimPlaying(false);
              notifyPromoPreviewPlayback(iframeRef.current?.contentWindow, "stop");
            }}
          >
            Stop
          </button>
          <a
            className="promo-admin-preview-open"
            href={previewSrc}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open full size
          </a>
        </div>
      </div>
      <div
        ref={shellRef}
        className="promo-admin-preview-iframe-shell"
        style={{ height: `${scaledHeight}px` }}
      >
        <iframe
          ref={iframeRef}
          title="Homepage promo preview"
          className="promo-admin-preview-iframe"
          src={previewSrc}
          style={{
            width: `${PREVIEW_VIEWPORT_WIDTH}px`,
            height: `${PREVIEW_VIEWPORT_HEIGHT}px`,
            transform: `scale(${scale})`,
          }}
          onLoad={() => {
            writePromoPreviewPayload(stack);
            notifyPromoPreviewUpdate(iframeRef.current?.contentWindow, stack);
          }}
        />
      </div>
      <p className="promo-admin-preview-note">
        Real homepage hero at {PREVIEW_VIEWPORT_WIDTH}px width. Use Start anim to play the promo
        sequence. Stop freezes the current frame.
      </p>
      <div className="promo-admin-preview-meta">
        <span className={`promo-admin-preview-status promo-admin-preview-status--${draftStatus}`}>
          {isUnsaved ? "Unsaved changes · " : ""}
          {statusLabels[draftStatus]}
        </span>
        <span className="promo-admin-preview-schedule">{scheduleLabel}</span>
      </div>
    </aside>
  );
}
