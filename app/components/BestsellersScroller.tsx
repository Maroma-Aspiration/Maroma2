"use client";

import { useRef } from "react";
import type { ProductRecord } from "../../lib/product-types";
import { StorefrontProductCard } from "./StorefrontProductCard";
import { CarouselScrollHint } from "./CarouselScrollHint";
import "./bestsellers-scroller.css";

export function BestsellersScroller({ products }: { products: ProductRecord[] }) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  if (!products.length) return null;

  return (
    <section className="bestsellers-scroller" aria-labelledby="bestsellers-heading">
      <div className="bestsellers-scroller-head">
        <p>Shop what people love</p>
        <h2 id="bestsellers-heading">Bestsellers</h2>
      </div>
      <div className="carousel-shell bestsellers-carousel">
        <div className="bestsellers-track" ref={trackRef} tabIndex={0} aria-label="Bestsellers, swipe or scroll sideways">
          {products.map((product) => (
            <div key={product.id} className="product-card-wrap bestsellers-card">
              <StorefrontProductCard product={product} />
            </div>
          ))}
        </div>
        <CarouselScrollHint scrollerRef={trackRef} itemSelector=".bestsellers-card" />
      </div>
    </section>
  );
}
