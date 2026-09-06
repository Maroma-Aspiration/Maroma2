"use client";

import { useState } from "react";
import { decodeBasicHtmlEntities } from "../../lib/decode-html-entities";
import { productImageTransform } from "../../lib/product-image-focus";
import { useAdminSession } from "../../lib/use-admin-session";

type Props = {
  images: string[];
  productId?: string;
  videos?: string[];
  productName: string;
  ready3d?: boolean;
};

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
      const { upload } = await import("@vercel/blob/client");
      const blob = await upload(`admin-product-videos/${productId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`, file, { access: "public", handleUploadUrl: "/api/products/upload", clientPayload: JSON.stringify({ productId }) });
      const response = await fetch("/api/products/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "attach-video", productId, url: blob.url }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save video.");
      setUploadedVideos(data.videos);
      setActive(images.length);
    } catch (error) { setUploadError(error instanceof Error ? error.message : "Video upload failed."); }
    finally { setUploading(false); }
  };
  const [active, setActive] = useState(videos.length ? images.length : 0);
  const main = list[active];
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
        {main.type === "video" ? <video src={main.src} controls playsInline autoPlay muted preload="auto" onEnded={() => setActive(0)} aria-label={`${decodedName} product video`} /> : <img src={main.src} alt={`${decodedName} — Maroma product photo`} style={{ transform: `${productImageTransform(productId) ?? ""} scale(1.21)`.trim(), transformOrigin: "center" }} fetchPriority="high" />}
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
              className={`product-pdp-thumb ${index === active ? "is-active" : ""}`}
              onClick={() => setActive(index)}
            >
              {item.type === "video" ? <span className="product-pdp-video-thumb" aria-label={`${decodedName} video`}>▶<small>Video</small></span> : <img src={item.src} alt={`${decodedName} view ${index + 1}`} loading="lazy" />}
            </button>
          ))}
          {isAdminUser && productId ? <label className="product-pdp-video-upload">
            {uploading ? "Uploading…" : galleryVideos.length ? "Replace video" : "+ Upload video"}
            <input type="file" accept="video/mp4,video/webm" hidden disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadVideo(file); event.currentTarget.value = ""; }} />
            <small>MP4 / WebM</small>
          </label> : null}
          {uploadError ? <small role="alert">{uploadError}</small> : null}
        </div>
      ) : null}
    </div>
  );
}
