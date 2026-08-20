"use client";

import { useState } from "react";
import { decodeBasicHtmlEntities } from "../../lib/decode-html-entities";

type Props = {
  images: string[];
  productName: string;
  ready3d?: boolean;
};

export function ProductPdpGallery({ images, productName, ready3d = false }: Props) {
  const list = images.length > 0 ? images : [];
  const [active, setActive] = useState(0);
  const main = list[active] ?? "";
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
        <img src={main} alt={`${decodedName} — Maroma product photo`} fetchPriority="high" />
        {badge}
      </div>
      {list.length > 1 ? (
        <div className="product-pdp-thumbs" role="tablist" aria-label="Gallery thumbnails">
          {list.map((src, index) => (
            <button
              key={`${src}-${index}`}
              type="button"
              role="tab"
              aria-selected={index === active}
              className={`product-pdp-thumb ${index === active ? "is-active" : ""}`}
              onClick={() => setActive(index)}
            >
              <img src={src} alt={`${decodedName} view ${index + 1}`} loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
