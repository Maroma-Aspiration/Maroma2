"use client";

import { useEffect, useRef, useState } from "react";
import { decodeBasicHtmlEntities } from "../../lib/decode-html-entities";
import { productImageTransform } from "../../lib/product-image-focus";
import { useAdminSession } from "../../lib/use-admin-session";
import { videoMimeType } from "../../lib/video-source";

type Props = {
  images: string[];
  productId?: string;
  videos?: string[];
  productName: string;
  ready3d?: boolean;
};

function sourceType(src: string) {
  const type = videoMimeType(src);
  return type ? { type } : {};
}

export function ProductPdpGallery({ images, videos = [], productId = "", productName, ready3d = false }: Props) {
  const { isAdminUser } = useAdminSession();
  const [uploadedVideos, setUploadedVideos] = useState<string[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const galleryVideos = uploadedVideos ?? videos;
  const list = [...images.map((src) => ({ src, type: "image" as const })), ...galleryVideos.map((src) => ({ src, type: "video" as const }))];
  const uploadVideo = async (file: File) => {
    setUploading(true);
    setUploadError("");
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error("Choose a video under 100 MB.");
      if (file.type !== "video/mp4" || !/\.mp4$/i.test(file.name)) {
        throw new Error("Use an MP4 video encoded with H.264 video and AAC audio.");
      }
      const { uploadFileToFirebase } = await import("../../lib/client-firebase-upload");
      const url = await uploadFileToFirebase(file, `admin-product-videos/${productId}`);
      const response = await fetch("/api/products/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "attach-video", productId, url }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save video.");
      setUploadedVideos(data.videos);
      setActive(images.length);
    } catch (error) { setUploadError(error instanceof Error ? error.message : "Video upload failed."); }
    finally { setUploading(false); }
  };
  const [active, setActive] = useState(0);
  const lastImageStepRef = useRef(0);
  const main = list[active];

  useEffect(() => {
    const column = document.querySelector<HTMLElement>(".product-pdp-left-column");
    if (!column || list.length < 2) return;

    const onGalleryWheel = (event: Event) => {
      const deltaY = Number((event as CustomEvent<{ deltaY?: number }>).detail?.deltaY || 0);
      if (Math.abs(deltaY) < 8) return;
      const now = Date.now();
      if (now - lastImageStepRef.current < 280) return;
      lastImageStepRef.current = now;
      setActive((current) => {
        const next = deltaY > 0 ? current + 1 : current - 1;
        return Math.min(list.length - 1, Math.max(0, next));
      });
    };

    column.addEventListener("maroma-pdp-gallery-wheel", onGalleryWheel);
    return () => column.removeEventListener("maroma-pdp-gallery-wheel", onGalleryWheel);
  }, [list.length]);
  const badge = ready3d ? <span className="product-pdp-3d-badge">3D</span> : null;

  if (!main) {
    return (
      <div className="product-pdp-gallery product-pdp-gallery--empty" aria-label="Product gallery">
        <div className="product-pdp-main-visual">
          <span className="product-pdp-no-image">No product image</span>
          {badge}
        </div>
      </div>
    );
  }

  const decodedName = decodeBasicHtmlEntities(productName);

  return (
    <div className="product-pdp-gallery" aria-label="Product gallery">
      <div className="product-pdp-main-visual">
        {main.type === "video" ? <video controls playsInline autoPlay muted preload="metadata" onEnded={() => setActive(0)} aria-label={`${decodedName} product video`}><source src={main.src} {...sourceType(main.src)} /></video> : <img src={main.src} alt={`${decodedName}, Maroma product photo`} style={{ transform: `${productImageTransform(productId) ?? ""} scale(1.491)`.trim(), transformOrigin: "center" }} fetchPriority="high" />}
        {badge}
      </div>
      {list.length > 1 || isAdminUser ? (
        <div className="product-pdp-thumbs" role="tablist" aria-label="Gallery thumbnails">
          {list.map((item, index) => (
            <button
              key={`${item.src}-${index}`}
              type="button"
              role="tab"
              aria-selected={index === active}
              className={`product-pdp-thumb${item.type === "video" ? " is-video" : ""}${index === active ? " is-active" : ""}`}
              onClick={() => setActive(index)}
              aria-label={item.type === "video" ? `${decodedName} video` : undefined}
            >
              {item.type === "video" ? (
                <>
                  <video muted playsInline preload="metadata" aria-hidden="true"><source src={`${item.src}#t=0.1`} {...sourceType(item.src)} /></video>
                  <span className="product-pdp-video-thumb-badge" aria-hidden="true">▶</span>
                </>
              ) : <img src={item.src} alt={`${decodedName} view ${index + 1}`} loading="lazy" />}
            </button>
          ))}
          {isAdminUser && productId ? <label className="product-pdp-video-upload">
            {uploading ? "Uploading…" : galleryVideos.length ? "Replace video" : "+ Upload video"}
            <input type="file" accept="video/mp4,video/webm" hidden disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadVideo(file); event.currentTarget.value = ""; }} />
            <small>MP4 · H.264 + AAC</small>
          </label> : null}
          {uploadError ? <small role="alert">{uploadError}</small> : null}
        </div>
      ) : null}
    </div>
  );
}
