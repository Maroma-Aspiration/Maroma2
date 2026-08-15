"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getDisplayImageUrl } from "../../lib/product-image";
import { decodeBasicHtmlEntities } from "../../lib/decode-html-entities";
import { useCurrency } from "../../context/CurrencyContext";
import type { ProductRecord } from "../../lib/product-types";
import type { SiteContent } from "../content";
import { useAdminSession } from "../../lib/use-admin-session";

type Props = {
  query: string;
  ritualName?: string;
  products: ProductRecord[];
  initialSiteContent: SiteContent;
};

export default function SearchPageClient({ query, ritualName, products, initialSiteContent }: Props) {
  const { formatCatalogPrice, isEstimated } = useCurrency();
  const [isVisible, setIsVisible] = useState(false);
  const { adminModeEnabled: isAdmin } = useAdminSession();

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleSlotUpload = async (productId: string, slot: string, file: File) => {
    const formData = new FormData();
    formData.append("productId", productId);
    formData.append("slot", slot);
    formData.append("image", file);

    try {
      const res = await fetch("/api/products/upload", {
        method: "POST",
        body: formData
      });
      if (!res.ok) throw new Error("Upload failed");
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Failed to upload image");
    }
  };

  const isCurated = !!ritualName;

  const capitalize = (str: string) => {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const displayTitle = isCurated ? (
    <>
      <span>{capitalize(query)}</span> Selection for Your <span className="highlight-text">{ritualName}</span> Ritual
    </>
  ) : (
    <>
      Exploring <span className="highlight-text">&ldquo;{query}&rdquo;</span>
    </>
  );

  return (
    <div className={`page-container ${isCurated ? "is-curated" : ""}`}>
      <main className={`content-wrap ${isVisible ? "is-visible" : ""}`}>
        <header className="page-header">
          {isCurated && (
            <Link href="/rituals" className="back-to-rituals">
              ← Back to Maroma Rituals
            </Link>
          )}
          {!isCurated && <span className="eyebrow">Search Results</span>}
          <h1 className="main-title">{displayTitle}</h1>
          <p className="subtitle">
            {isCurated 
              ? `A hand-picked collection of ${query}s to enhance your ${ritualName.toLowerCase()} experience.`
              : `${products.length} ${products.length === 1 ? "product" : "products"} found`
            }
          </p>
        </header>

        <section className="results-grid">
          {products.length > 0 ? (
            <div className="curated-grid">
              {products.map((product) => {
                const imageSrc = getDisplayImageUrl(product);
                return (
                  <div key={product.id} className="product-card-wrap">
                    <Link href={`/product/${product.id}`} className="product-card">
                      <div className="product-visual">
                        {imageSrc ? (
                          <img src={imageSrc} alt={decodeBasicHtmlEntities(product.name)} />
                        ) : (
                          <div className="placeholder-image">✧</div>
                        )}
                        <div className="view-link">View Details →</div>
                      </div>
                      <div className="product-meta">
                        <h3 className="product-name">{decodeBasicHtmlEntities(product.name)}</h3>
                        <p className="product-price">{formatCatalogPrice(product.price) ? `${isEstimated ? "≈ " : ""}${formatCatalogPrice(product.price)}` : "Price on request"}</p>
                      </div>
                    </Link>
                    {isAdmin && (
                      <div className="product-admin-upload-panel">
                        <div className="admin-upload-label">Upload images</div>
                        <div className="admin-upload-slots">
                          {[
                            { id: "main", label: "Main" },
                            { id: "view1", label: "view 1" },
                            { id: "view2", label: "view 2" },
                            { id: "view3", label: "view 3" },
                            { id: "view4", label: "view 4" }
                          ].map((slot) => (
                            <label key={slot.id} className="admin-upload-slot">
                              <span>{slot.label}</span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleSlotUpload(product.id, slot.id, file);
                                }}
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">✧</div>
              <h2>No items found</h2>
              <p>We couldn&apos;t find any {query}s in our current curation.</p>
              <Link href="/rituals" className="back-link">Return to Rituals</Link>
            </div>
          )}
        </section>

        {isCurated && (
          <footer className="curated-footer">
            <p>Seeking something specific? <Link href="/search">Browse our full collection</Link></p>
          </footer>
        )}
      </main>

      <style jsx>{`
        .page-container {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          color: #2c2824;
        }

        .page-container::before {
          content: "";
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: url('/staging-media/backgrounds/ritual-bg.png');
          background-size: cover;
          background-position: center;
          z-index: -1;
          animation: ritual-bg-zoom 20s ease-out forwards;
        }

        .content-wrap {
          max-width: 1200px;
          margin: 0 auto;
          padding: 160px 6vw 100px;
          opacity: 0;
        }

        .content-wrap.is-visible {
          animation: ritual-content-entrance 1.25s cubic-bezier(0.19, 1, 0.22, 1) forwards;
        }

        @keyframes ritual-bg-zoom {
          from { transform: scale(1.1); }
          to { transform: scale(1); }
        }

        @keyframes ritual-content-entrance {
          from { 
            opacity: 0;
            transform: translateY(16px) scale(0.94);
            filter: blur(2px);
          }
          to { 
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        .page-header {
          text-align: center;
          margin-bottom: 100px;
          max-width: 800px;
          margin-left: auto;
          margin-right: auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }

        .back-to-rituals {
          text-decoration: none;
          color: #8c8882;
          font-size: 0.85rem;
          font-weight: 500;
          letter-spacing: 0.05em;
          transition: color 0.3s ease;
          display: block;
          margin-bottom: 8px;
        }

        .back-to-rituals:hover {
          color: #d4a373;
        }

        .eyebrow {
          display: block;
          text-transform: uppercase;
          letter-spacing: 0.3em;
          font-size: 0.7rem;
          color: #b0aca5;
          margin-bottom: 24px;
          font-weight: 700;
        }

        .main-title {
          font-family: var(--font-serif), serif;
          font-size: clamp(2.4rem, 5vw, 4.2rem);
          line-height: 1.1;
          font-weight: 400;
          margin-bottom: 24px;
          color: #1a1816;
          letter-spacing: -0.01em;
        }

        .highlight-text {
          color: #d4a373;
          font-style: italic;
        }

        .subtitle {
          font-size: 1.1rem;
          color: #8c8882;
          font-style: italic;
          line-height: 1.6;
        }

        .curated-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 60px 40px;
        }

        .product-card {
          text-decoration: none;
          color: inherit;
          display: block;
        }

        .product-visual {
          position: relative;
          aspect-ratio: 4 / 5.75;
          background: var(--maroma-site-bg);
          border-radius: 8px;
          overflow: hidden;
          margin-bottom: 24px;
          transition: transform 0.4s cubic-bezier(0.19, 1, 0.22, 1);
        }

        .product-visual img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          transition: transform 0.8s cubic-bezier(0.19, 1, 0.22, 1);
        }

        .product-card:hover .product-visual {
          transform: translateY(-8px);
        }

        .product-card:hover .product-visual img {
          transform: scale(1.05);
        }

        .view-link {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 20px;
          background: linear-gradient(to top, rgba(0,0,0,0.3), transparent);
          color: #fff;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-weight: 700;
          opacity: 0;
          transform: translateY(10px);
          transition: all 0.4s ease;
        }

        .product-card:hover .view-link {
          opacity: 1;
          transform: translateY(0);
        }

        .placeholder-image {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          color: #eee;
        }

        .product-meta {
          text-align: center;
        }

        .product-name {
          font-size: 1.05rem;
          font-weight: 500;
          margin-bottom: 8px;
          color: #1a1816;
          line-height: 1.4;
        }

        .product-price {
          font-family: var(--font-serif), serif;
          font-style: italic;
          color: #8c8882;
          font-size: 0.95rem;
        }

        .empty-state {
          text-align: center;
          padding: 120px 0;
        }

        .empty-icon {
          font-size: 3rem;
          color: #d4a373;
          margin-bottom: 24px;
        }

        .empty-state h2 {
          font-family: var(--font-serif), serif;
          font-size: 2.4rem;
          margin-bottom: 16px;
        }

        .back-link {
          display: inline-block;
          margin-top: 40px;
          padding: 16px 40px;
          border: 1px solid #1a1816;
          color: #1a1816;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          font-size: 0.75rem;
          font-weight: 700;
          transition: all 0.3s ease;
        }

        .back-link:hover {
          background: #1a1816;
          color: #fff;
        }

        .curated-footer {
          margin-top: 120px;
          padding-top: 60px;
          border-top: 1px solid #f5f5f5;
          text-align: center;
          color: #8c8882;
          font-style: italic;
        }

        .curated-footer a {
          color: #d4a373;
          text-decoration: underline;
          text-underline-offset: 4px;
        }

        .capitalize-first {
          display: inline-block;
        }
        .capitalize-first::first-letter {
          text-transform: uppercase;
        }

        @media (max-width: 1024px) {
          .curated-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 40px 24px;
          }
        }

        @media (max-width: 640px) {
          .curated-grid {
            grid-template-columns: 1fr;
          }
          .main-title {
            font-size: 2.4rem;
          }
          .content-wrap {
            padding-top: 120px;
          }
        }
      `}</style>
    </div>
  );
}
