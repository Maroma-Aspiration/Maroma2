"use client";

import Link from "next/link";
import { decodeBasicHtmlEntities } from "../../lib/decode-html-entities";
import { isGift3dPreviewProduct } from "../../lib/gift-builder-catalog";
import { getProductCardImages } from "../../lib/product-gallery";
import { isGiftingProduct } from "../../lib/product-gifting";
import { resolveProductNetMeasure } from "../../lib/product-net-measure";
import { productPriceState } from "../../lib/product-pricing";
import type { ProductRecord } from "../../lib/product-types";
import { useCurrency } from "../../context/CurrencyContext";
import { ProductCardBuyNow } from "./ProductCardBuyNow";

type StorefrontProductCardProps = {
  product: ProductRecord;
  href?: string;
  compact?: boolean;
};

export function StorefrontProductCard({
  product,
  href,
  compact = false,
}: StorefrontProductCardProps) {
  const { formatCatalogPrice, isEstimated } = useCurrency();
  const { front: imageSrc, rear: rearSrc } = getProductCardImages(product);
  const priceState = productPriceState(product);
  const convertedPrice = formatCatalogPrice(priceState.active);
  const priceLabel = convertedPrice ? `${isEstimated ? "≈ " : ""}${convertedPrice}` : "Price on request";
  const name = decodeBasicHtmlEntities(product.name);
  const productHref = href ?? `/product/${product.id}`;
  const showBadge = isGiftingProduct(product) && isGift3dPreviewProduct(product.id);
  const netMeasure = resolveProductNetMeasure(product);
  const measureLabel = netMeasure.value !== "As marked on the pack" ? netMeasure.value : "";

  return (
    <article className={`product-card${compact ? " product-card--compact" : ""}${rearSrc ? " has-rear-image" : ""}`}>
      <Link href={productHref} className="product-card-link">
        <div className="product-card-media">
          <div className="product-image">
            {imageSrc ? (
              <img
                className="product-image-front"
                src={imageSrc}
                alt={`${name} - Maroma`}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <span>No image</span>
            )}
            {rearSrc ? (
              <img
                className="product-image-rear"
                src={rearSrc}
                alt=""
                loading="lazy"
                decoding="async"
                aria-hidden="true"
              />
            ) : null}
          </div>
          {showBadge ? <span className="product-card-3d-badge">3D</span> : null}
        </div>
        <div className="product-copy">
          <h3 className="product-card-title">{name}</h3>
          <p className={priceState.onSale ? "product-card-price is-on-sale" : "product-card-price"}>
            {priceState.onSale ? <s>{formatCatalogPrice(priceState.regular)}</s> : null}
            <span>{priceLabel}</span>
            {measureLabel ? <span className="product-card-measure">{measureLabel}</span> : null}
          </p>
        </div>
      </Link>
      <div className="product-card-actions">
        <Link href={productHref} className="product-card-cta product-card-cta--primary">Add to Basket</Link>
        <ProductCardBuyNow product={product} />
      </div>
    </article>
  );
}
