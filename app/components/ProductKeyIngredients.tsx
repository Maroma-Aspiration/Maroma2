"use client";

import Link from "next/link";
import { useRef } from "react";
import { CarouselScrollHint } from "./CarouselScrollHint";

export type KeyIngredientCard = {
  name: string;
  imageUrl: string;
  href: string;
  inci?: string;
  description?: string;
  benefits?: string[];
  scentProfile?: string;
  extraNotes?: string;
  rangeLabel?: string;
  rangeHref?: string;
};

export function ProductKeyIngredients({ items }: { items: KeyIngredientCard[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  if (!items.length) {
    return <p className="product-pdp-accordion-body">Key ingredients are listed on the product label.</p>;
  }

  return (
    <div className="carousel-shell product-pdp-key-ingredient-shell">
      <div className="product-pdp-key-ingredient-scroller" ref={scrollerRef}>
        <ul className="product-pdp-key-ingredient-row">
          {items.map((item, index) => (
            <li key={`${item.name}-${index}`}>
              <article className="product-pdp-key-ingredient-card">
                <Link href={item.href} className="product-pdp-key-ingredient">
                  <span className="product-pdp-key-ingredient-thumb">
                    {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span>{item.name.slice(0, 1)}</span>}
                  </span>
                  <span className="product-pdp-key-ingredient-name">{item.name}</span>
                  {item.inci ? <span className="product-pdp-key-ingredient-inci">{item.inci}</span> : null}
                </Link>
                {item.description ? <p className="product-pdp-key-ingredient-copy">{item.description}</p> : null}
                {item.benefits?.length ? (
                  <ul className="product-pdp-key-ingredient-benefits">
                    {item.benefits.slice(0, 3).map((benefit) => (
                      <li key={benefit}>{benefit}</li>
                    ))}
                  </ul>
                ) : null}
                {item.scentProfile ? (
                  <p className="product-pdp-key-ingredient-scent">
                    <strong>Scent profile</strong> {item.scentProfile}
                  </p>
                ) : null}
                {item.extraNotes ? <p className="product-pdp-key-ingredient-note">{item.extraNotes}</p> : null}
                <Link href={item.rangeHref || item.href} className="product-pdp-key-ingredient-cta">
                  {item.rangeLabel || "View ingredient"}
                </Link>
              </article>
            </li>
          ))}
        </ul>
      </div>
      <CarouselScrollHint scrollerRef={scrollerRef} itemSelector=".product-pdp-key-ingredient-card" />
    </div>
  );
}
