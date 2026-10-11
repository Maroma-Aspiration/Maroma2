"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ProductPdpTitle } from "./ProductPdpTitle";
import { ProductPdpGallery } from "./ProductPdpGallery";
import { ProductPdpBuyRow } from "./ProductPdpBuyRow";
import { CurrencyPrice } from "./CurrencyPrice";
import { CurrencySelector } from "./CurrencySelector";
import {
  CLASSIC_PILLAR_SIZES,
  encodeFamilySizeVariant,
  familyImageNeedLabel,
  familySizePriceLabel,
  galleryImagesForSize,
  inkOnSwatch,
  parseFamilySizeVariant,
  type ProductFamilyMemberView,
  type ProductFamilySizeId,
} from "../../lib/product-families";
import type { ProductRecord } from "../../lib/product-types";

type Props = {
  product: ProductRecord;
  familyTitle: string;
  members: ProductFamilyMemberView[];
  initialSizeId?: string;
  videos?: string[];
  ready3d?: boolean;
  header?: ReactNode;
  children?: ReactNode;
};

function firstAvailableSize(member: ProductFamilyMemberView, preferred?: ProductFamilySizeId): ProductFamilySizeId {
  if (preferred && CLASSIC_PILLAR_SIZES.some((size) => size.id === preferred)) return preferred;
  return "100g";
}

export function ProductFamilyPdp({
  product,
  familyTitle,
  members,
  initialSizeId,
  videos,
  ready3d,
  header,
  children,
}: Props) {
  const router = useRouter();
  const parsedInitial = parseFamilySizeVariant(initialSizeId?.startsWith("size:") ? initialSizeId : `size:${initialSizeId || ""}`);
  const [sizeId, setSizeId] = useState<ProductFamilySizeId>(firstAvailableSize(members[0], parsedInitial ?? undefined));
  const [productId, setProductId] = useState(product.id);

  const member = useMemo(
    () => members.find((entry) => entry.id === productId) ?? members.find((entry) => entry.id === product.id) ?? members[0],
    [members, product, productId]
  );

  if (!member) return null;

  const images = galleryImagesForSize(member, sizeId);
  const imageNeed = familyImageNeedLabel(member, sizeId);
  const priceLabel = familySizePriceLabel({ price: member.price }, sizeId);
  const variant = encodeFamilySizeVariant(sizeId);
  const buyProduct = { ...product, id: member.id, name: member.name, price: member.price, images: member.images, imageUrl: images[0] || product.imageUrl };

  const selectFragrance = (nextId: string) => {
    setProductId(nextId);
    const next = members.find((entry) => entry.id === nextId);
    if (next) {
      router.replace(`/product/${next.id}${sizeId !== "100g" ? `?size=${sizeId}` : ""}`, { scroll: false });
    }
  };

  const selectSize = (nextSize: ProductFamilySizeId) => {
    setSizeId(nextSize);
    router.replace(`/product/${member.id}${nextSize !== "100g" ? `?size=${nextSize}` : ""}`, { scroll: false });
  };

  return (
    <>
      <div className="product-pdp-left-column">
        <ProductPdpGallery
          images={images}
          videos={videos}
          productId={member.id}
          productName={member.name}
          ready3d={ready3d}
          notice={imageNeed}
          imageScale={sizeId === "600g" ? 1.15 : undefined}
        />
      </div>
      <div className="product-pdp-details-column">
        <div className="product-pdp-details-chrome">{header}</div>
        <div className="product-pdp-title-block">
          <ProductPdpTitle>{familyTitle}</ProductPdpTitle>
          <p className="product-pdp-subtitle">{member.fragrance}</p>
        </div>
        <div className="product-pdp-info">
          <div className="product-family-options" role="group" aria-label="Pillar candle options">
            <div className="product-family-option-block">
              <p className="product-family-option-label">Fragrance</p>
              <div className="product-family-fragrance-grid">
                {members.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={`product-family-fragrance${entry.id === member.id ? " is-selected" : ""}`}
                    aria-pressed={entry.id === member.id}
                    onClick={() => selectFragrance(entry.id)}
                    title={entry.borrowedImageNote || entry.fragrance}
                    style={{ backgroundColor: entry.swatch, color: inkOnSwatch(entry.swatch) }}
                  >
                    <span>{entry.fragrance}</span>
                    {entry.borrowedImageNote && !entry.soloImages.length ? <small>Photos needed</small> : null}
                  </button>
                ))}
              </div>
            </div>
            <div className="product-family-option-block">
              <p className="product-family-option-label">Size</p>
              <div className="product-family-size-row">
                {CLASSIC_PILLAR_SIZES.map((size) => {
                  const sizeNeed = familyImageNeedLabel(member, size.id);
                  const priced = familySizePriceLabel({ price: member.price }, size.id);
                  return (
                    <button
                      key={size.id}
                      type="button"
                      className={`product-family-size${sizeId === size.id ? " is-selected" : ""}`}
                      aria-pressed={sizeId === size.id}
                      onClick={() => selectSize(size.id)}
                    >
                      <span>{size.label}</span>
                      {sizeNeed ? <small>Photo needed</small> : null}
                      {!priced ? <small>Price needed</small> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="product-pdp-price-row">
            {priceLabel ? (
              <p className="product-pdp-price">
                <CurrencyPrice raw={priceLabel} />
              </p>
            ) : (
              <p className="product-pdp-price product-family-price-needed">Price needed for {CLASSIC_PILLAR_SIZES.find((size) => size.id === sizeId)?.label}</p>
            )}
            <CurrencySelector compact />
          </div>
          <ProductPdpBuyRow
            product={buyProduct}
            variant={variant}
            disabled={!priceLabel}
            disabledReason={priceLabel ? undefined : "Please choose a size"}
          />
          {children}
        </div>
      </div>
    </>
  );
}
