"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CurrencyPrice } from "./CurrencyPrice";
import { CurrencySelector } from "./CurrencySelector";
import { ProductPdpBuyRow } from "./ProductPdpBuyRow";
import { ProductPdpGallery } from "./ProductPdpGallery";
import { ProductPdpTitle } from "./ProductPdpTitle";
import type { StickIncenseFamily } from "../../lib/stick-incense-family";
import type { ProductRecord } from "../../lib/product-types";

type Props = { product: ProductRecord; family: StickIncenseFamily; header?: ReactNode; children?: ReactNode };

export function StickIncenseFamilyPdp({ product, family, header, children }: Props) {
  const router = useRouter();
  const initial = family.members.find((member) => member.id === product.id) ?? family.members[0];
  const [productId, setProductId] = useState(initial.id);
  const member = useMemo(() => family.members.find((entry) => entry.id === productId) ?? initial, [family.members, initial, productId]);
  const selectMember = (id: string) => { const next = family.members.find((entry) => entry.id === id); if (!next) return; setProductId(next.id); router.replace(`/product/${next.id}`, { scroll: false }); };
  const buyProduct = { ...product, id: member.id, name: member.name, price: member.price, images: member.images, imageUrl: member.image };
  return <>
    <div className="product-pdp-left-column"><ProductPdpGallery images={[member.image]} productId={member.id} productName={member.name} imageScale={1} thumbnailsSide="right" variantThumbnails={family.members.map((entry) => ({ id: entry.id, src: entry.image, label: entry.variety }))} activeVariantId={member.id} onVariantSelect={selectMember} /></div>
    <div className="product-pdp-details-column">
      <div className="product-pdp-details-chrome">{header}</div>
      <div className="product-pdp-title-block"><ProductPdpTitle>{family.title}</ProductPdpTitle><p className="product-pdp-subtitle">{member.variety}</p></div>
      <div className="product-pdp-info">
        <div className="product-family-options product-incense-pack-options"><p className="product-family-option-label">Pack size</p><p className="product-incense-pack-label">{family.packLabel}</p></div>
        <div className="product-pdp-price-row"><p className="product-pdp-price"><CurrencyPrice raw={member.price} /></p><CurrencySelector compact /></div>
        <ProductPdpBuyRow product={buyProduct} />
        {children}
      </div>
    </div>
  </>;
}
