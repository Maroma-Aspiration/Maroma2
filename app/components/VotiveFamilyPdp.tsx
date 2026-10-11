"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CurrencyPrice } from "./CurrencyPrice";
import { CurrencySelector } from "./CurrencySelector";
import { ProductPdpBuyRow } from "./ProductPdpBuyRow";
import { ProductPdpGallery } from "./ProductPdpGallery";
import { ProductPdpTitle } from "./ProductPdpTitle";
import type { VotiveFamilyMember } from "../../lib/votive-family";
import type { ProductRecord } from "../../lib/product-types";

type Props = {
  product: ProductRecord;
  members: VotiveFamilyMember[];
  initialSizeId?: string;
  header?: ReactNode;
  children?: ReactNode;
};

export function VotiveFamilyPdp({ product, members, initialSizeId, header, children }: Props) {
  const router = useRouter();
  const initial = members.find((member) => member.id === product.id) ?? members[0];
  const initialSize = members.some((member) => member.sizeId === initialSizeId) ? initialSizeId! : initial.sizeId;
  const [sizeId, setSizeId] = useState(initialSize);
  const [productId, setProductId] = useState(initial.id);
  const sizeOptions = useMemo(
    () => [...new Map(members.map((member) => [member.sizeId, member])).values()].sort((a, b) => a.sizeValue - b.sizeValue),
    [members]
  );
  const visibleVarieties = useMemo(() => members.filter((member) => member.sizeId === sizeId), [members, sizeId]);
  const member = visibleVarieties.find((entry) => entry.id === productId) ?? visibleVarieties[0] ?? initial;
  const selectMember = (next: VotiveFamilyMember) => {
    setProductId(next.id);
    setSizeId(next.sizeId);
    router.replace(`/product/${next.id}${next.sizeId !== initial.sizeId ? `?size=${next.sizeId}` : ""}`, { scroll: false });
  };
  const selectSize = (nextSizeId: string) => {
    const next = members.find((entry) => entry.sizeId === nextSizeId && entry.variety === member.variety)
      ?? members.find((entry) => entry.sizeId === nextSizeId);
    if (next) selectMember(next);
  };
  const buyProduct = { ...product, id: member.id, name: member.name, price: member.price, images: member.images, imageUrl: member.image };

  return <>
    <div className="product-pdp-left-column">
      <ProductPdpGallery
        images={[member.image]}
        productId={member.id}
        productName={member.name}
        imageScale={1}
        thumbnailsSide="right"
        variantThumbnails={visibleVarieties.map((entry) => ({ id: entry.id, src: entry.image, label: entry.variety }))}
        activeVariantId={member.id}
        onVariantSelect={(id) => { const next = visibleVarieties.find((entry) => entry.id === id); if (next) selectMember(next); }}
      />
    </div>
    <div className="product-pdp-details-column">
      <div className="product-pdp-details-chrome">{header}</div>
      <div className="product-pdp-title-block">
        <ProductPdpTitle>Votive Candles</ProductPdpTitle>
        <p className="product-pdp-subtitle">{member.variety}</p>
      </div>
      <div className="product-pdp-info">
        <div className="product-family-options product-votive-size-options" role="group" aria-label="Votive candle size">
          <div className="product-family-option-block">
            <p className="product-family-option-label">Size</p>
            <div className="product-family-size-row">
              {sizeOptions.map((size) => <button key={size.sizeId} type="button" className={`product-family-size${sizeId === size.sizeId ? " is-selected" : ""}`} aria-pressed={sizeId === size.sizeId} onClick={() => selectSize(size.sizeId)}>{size.sizeLabel}</button>)}
            </div>
          </div>
        </div>
        <div className="product-pdp-price-row"><p className="product-pdp-price"><CurrencyPrice raw={member.price} /></p><CurrencySelector compact /></div>
        <ProductPdpBuyRow product={buyProduct} variant={`size:${member.sizeId}`} />
        {children}
      </div>
    </div>
  </>;
}
