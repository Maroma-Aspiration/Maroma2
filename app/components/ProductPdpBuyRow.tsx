"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "../../context/CartContext";
import type { ProductRecord } from "../../lib/product-types";

type Props = {
  product: ProductRecord;
  variant?: string;
  disabled?: boolean;
  disabledReason?: string;
};

export function ProductPdpBuyRow({ product, variant, disabled = false, disabledReason }: Props) {
  const router = useRouter();
  const { addToCart } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const handleAddToBasket = async () => {
    if (disabled) return;
    const ok = await addToCart(product, variant, qty);
    if (!ok) return;
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = async () => {
    if (disabled) return;
    const ok = await addToCart(product, variant, qty);
    if (!ok) return;
    router.push("/checkout");
  };

  return (
    <div className="product-pdp-buy-row">
      <label className="product-pdp-qty">
        <span className="sr-only">Quantity</span>
        <input
          type="number"
          min={1}
          max={99}
          value={qty}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next) && next >= 1 && next <= 99) {
              setQty(next);
            }
          }}
        />
      </label>
      <div className="product-pdp-cta-group">
        <button
          type="button"
          className={`button primary product-pdp-cta-main product-pdp-basket-btn${added ? " is-added" : ""}`}
          onClick={handleAddToBasket}
          disabled={disabled}
        >
          {added ? "Added to Basket ✓" : "Add to Basket"}
        </button>
        <button type="button" className="button primary product-pdp-cta-main product-pdp-basket-btn" onClick={handleBuyNow} disabled={disabled}>
          Buy Now
        </button>
        <button type="button" className="product-pdp-wish" aria-label="Add to wishlist">
          ♡
        </button>
      </div>
      {disabled && disabledReason ? <p className="product-family-buy-note">{disabledReason}</p> : null}
      <Link href="/cart" className="product-pdp-view-basket">
        View your basket
      </Link>
    </div>
  );
}
